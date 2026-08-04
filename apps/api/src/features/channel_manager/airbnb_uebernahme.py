"""Airbnb-Übernahme: bestehende Airbnb-Listings zu myNextDays holen.

Der Fall: ein Betrieb verkauft schon auf Airbnb und wechselt zu uns. Er hat
NULL Objekte bei uns und soll sie NICHT abtippen — seine Listings sind die
Wahrheit, wir holen sie.

Warum es diesen eigenen Ablauf braucht (alles live gegen app.channex.io am
04.08.2026 geprüft, nicht aus der Doku geschlossen):

1. `POST meta/airbnb/connection_link` verlangt `properties` mit mindestens
   einem Eintrag:
       ohne `properties`      → 422 {"properties": ["should have at least 1 item(s)"]}
       mit `properties: []`   → 422 dasselbe
       mit genau einem        → 200 + airbnb.com-OAuth-URL
   Die Autorisierung hängt bei Channex also zwingend an einem Property. Ein
   konto-weiter Airbnb-Connect ist NICHT möglich — `POST channels` allein
   akzeptiert zwar 0 Properties (201), aber der Link, den der Kunde öffnen
   muss, entsteht dann nie.

2. Der Katalog (`GET channels/list`) liefert für AirBNB
   `mapping_mode: "listing"` und `rate_params.listing_id` — Airbnb-Listings
   werden GEMAPPT, nicht von Channex als eigene Properties gespiegelt. Der
   Reconcile-Weg (Channex-Properties → unsere Objekte) allein reicht deshalb
   nicht: es entstehen dort keine neuen Properties, aus denen Objekte werden
   könnten.

3. Die Listing-INHALTE liegen bei Airbnb, nicht bei Channex
   (`GET /listings` → 404). Channex reicht Aufrufe an Airbnbs API durch
   (`POST channels/{id}/proxy/*path`, Bundle: `Channels.ProxyScenario`); der
   OAuth-Scope `property_management` aus dem Katalog deckt `hosting/listings`.

Daraus der Ablauf — der Kunde gibt NICHTS ein:
    a) `uebernahme_starten`: Server legt ein Übernahme-Objekt an (lokal +
       Channex) und erzeugt damit die OAuth-URL.
    b) Kunde autorisiert bei Airbnb (ein Klick).
    c) `listings_uebernehmen`: Listings über den Proxy lesen, das erste in das
       Übernahme-Objekt schreiben, für jedes weitere ein Objekt anlegen.

Das Übernahme-Objekt bleibt `status='draft'`: es ist ein Gerüst für die
Autorisierung, kein verkaufsfertiges Objekt. Erst die echten Airbnb-Daten
machen es zu einem — und ob es verkauft wird, entscheidet der Kunde.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext

from .channex_client import ChannexError
from .common import ChannelManagerError, log

# Titel des Gerüst-Objekts. Bewusst erkennbar und nicht geraten: solange die
# echten Airbnb-Daten fehlen, darf hier kein plausibler Fantasiename stehen
# (Wurzel 4) — der Kunde soll sehen, dass die Übernahme noch läuft.
_GERUEST_TITEL = "Airbnb-Übernahme läuft"

# Wie viele Listings eine Übernahme höchstens verarbeitet. Airbnb-Konten mit
# hunderten Listings sind real; ohne Obergrenze wäre der Request unbegrenzt
# (Wurzel 8). Darüber hinaus meldet der Ablauf ehrlich, was er NICHT übernommen
# hat, statt still abzuschneiden.
_MAX_LISTINGS = 100


class AirbnbUebernahmeMixin:
    """Bestehende Airbnb-Listings als Objekte übernehmen."""

    # -- a) Start: Gerüst-Objekt + OAuth-URL ----------------------------------
    def uebernahme_starten(
        self, ctx: AuthContext, *, portal_code: str = "AirBNB"
    ) -> dict[str, Any]:
        """Übernahme starten, OHNE dass der Kunde ein Objekt anlegt.

        Legt (idempotent, Wurzel 2) ein Gerüst-Objekt an, registriert es bei
        Channex und gibt die echte Airbnb-OAuth-URL zurück. Hat der Betrieb
        bereits Objekte, wird das erste davon genutzt — dann entsteht kein
        zweites Gerüst.
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        property_id = self._geruest_objekt(db, tenant_id)
        # Ab hier der bestehende, erprobte OAuth-Pfad — kein zweiter Weg zu
        # Channex (der erste Anlauf dieser Funktion hatte genau das gebaut).
        return self.begin_channel_oauth(
            ctx,
            property_id=property_id,
            portal_code=portal_code,
            title=None,
        )

    def _geruest_objekt(self, db: Client, tenant_id: str) -> str:
        """Objekt-ID, an der die Airbnb-Autorisierung hängen kann.

        Reihenfolge: ein bestehendes Objekt (der Normalfall, wenn der Kunde
        schon eins hat) → ein früheres Gerüst (Doppelklick/Retry) → ein neues
        Gerüst. So entsteht bei mehrfachem Start kein Objekt-Wildwuchs.
        """
        vorhanden = (
            db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .limit(1)
            .execute()
        ).data
        if vorhanden:
            return vorhanden[0]["id"]

        # Nur Pflichtspalten setzen (live geprüft: NOT NULL ohne Default sind
        # allein tenant_id und title). Alles andere bleibt DB-Default — kein
        # geratener Typ, keine erfundene Adresse, keine Kapazität (Wurzel 4).
        neu = (
            db.table("properties")
            .insert({
                "tenant_id": tenant_id,
                "title": _GERUEST_TITEL,
                "status": "draft",
            })
            .execute()
        ).data
        if not neu:
            raise ChannelManagerError(
                "Übernahme-Objekt konnte nicht angelegt werden.", status_code=500
            )
        property_id = neu[0]["id"]
        # Einheit sofort mit (0265): ohne sie ist das Objekt unverkäuflich und
        # eine eingehende Airbnb-Buchung liefe in 22023.
        self._ensure_default_unit(db, tenant_id, property_id, _GERUEST_TITEL)
        log.info(
            "airbnb_uebernahme_geruest_angelegt",
            tenant_id=tenant_id, property_id=property_id,
        )
        return property_id

    # -- c) Listings holen und Objekte daraus machen --------------------------
    def listings_uebernehmen(
        self, ctx: AuthContext, *, portal_code: str = "AirBNB"
    ) -> dict[str, Any]:
        """Airbnb-Listings des verbundenen Kontos als Objekte übernehmen.

        Liest die Listings über den Channex-Proxy von Airbnb und schreibt sie in
        unsere DB: das erste füllt das Gerüst-Objekt, jedes weitere wird ein
        eigenes Objekt. Idempotent über `airbnb_listing_id` (Wurzel 2) — ein
        zweiter Aufruf aktualisiert, statt zu verdoppeln.
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        verbindung = (
            db.table("channex_channel_connection")
            .select("channex_channel_id, property_id")
            .eq("tenant_id", tenant_id)
            .eq("ota_portal_code", portal_code)
            .limit(1)
            .execute()
        ).data
        if not verbindung or not verbindung[0].get("channex_channel_id"):
            raise ChannelManagerError(
                "Airbnb ist noch nicht verbunden. Starte die Übernahme und "
                "autorisiere Airbnb zuerst.",
                status_code=409,
            )
        channel_id = verbindung[0]["channex_channel_id"]

        listings = self._airbnb_listings_lesen(channel_id)
        if not listings:
            raise ChannelManagerError(
                "Airbnb hat keine Objekte zurückgegeben. Prüfe, ob die "
                "Verbindung bestätigt wurde und das Konto Objekte hat.",
                status_code=409,
            )

        uebersprungen = max(0, len(listings) - _MAX_LISTINGS)
        angelegt = aktualisiert = 0
        for listing in listings[:_MAX_LISTINGS]:
            row = self._listing_zu_objekt(listing)
            if row is None:
                uebersprungen += 1
                continue
            if self._objekt_schreiben(db, tenant_id, row):
                angelegt += 1
            else:
                aktualisiert += 1

        log.info(
            "airbnb_uebernahme_fertig",
            tenant_id=tenant_id, angelegt=angelegt,
            aktualisiert=aktualisiert, uebersprungen=uebersprungen,
        )
        return {
            "created": angelegt,
            "updated": aktualisiert,
            "skipped": uebersprungen,
        }

    def _airbnb_listings_lesen(self, channel_id: str) -> list[dict[str, Any]]:
        """Listings des autorisierten Kontos über den Channex-Proxy holen.

        Der Proxy reicht an Airbnbs eigene API durch; die Antwortform ist nicht
        dokumentiert, deshalb wird sie tolerant gelesen (Liste unter `listings`,
        `data` oder direkt) — aber NICHT geraten: fehlt die Struktur ganz, ist
        das ein Fehler und keine leere Übernahme (Wurzel 5).
        """
        try:
            res = self._channex.airbnb_proxy(channel_id, "hosting/listings")
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

        for schluessel in ("listings", "data", "results"):
            wert = res.get(schluessel)
            if isinstance(wert, list):
                return wert
        if isinstance(res, list):
            return res
        raise ChannelManagerError(
            "Die Antwort von Airbnb war nicht lesbar. Bitte später erneut "
            "versuchen.",
            status_code=502,
        )

    @staticmethod
    def _listing_zu_objekt(listing: dict[str, Any]) -> dict[str, Any] | None:
        """Ein Airbnb-Listing → properties-Spalten.

        Übernimmt nur, was das Listing WIRKLICH trägt; fehlende Felder bleiben
        weg (DB-Default), damit kein Wert erfunden wird (Wurzel 4). Ohne ID oder
        Titel ist das Listing nicht übernehmbar → None (überspringen, nicht mit
        Platzhaltern anlegen).

        Die Feldnamen sind die von Airbnbs `hosting/listings`; das Listing wird
        defensiv gelesen, weil die Antwortform undokumentiert ist.
        """
        listing_id = listing.get("id") or listing.get("listing_id")
        titel = listing.get("name") or listing.get("title")
        if not listing_id or not titel or not str(titel).strip():
            return None

        row: dict[str, Any] = {
            "airbnb_listing_id": str(listing_id),
            "title": str(titel).strip(),
        }
        paare = [
            ("address", ("address", "street")),
            ("city", ("city",)),
            ("postal_code", ("zipcode", "zip_code", "postal_code")),
            ("country", ("country_code", "country")),
            ("description", ("description", "summary")),
        ]
        for spalte, schluessel in paare:
            for k in schluessel:
                wert = listing.get(k)
                if wert:
                    row[spalte] = str(wert).strip()
                    break

        for spalte, schluessel in (("lat", "lat"), ("lng", "lng")):
            wert = listing.get(schluessel) or listing.get(f"{schluessel}itude")
            if wert is not None:
                row[spalte] = wert

        gaeste = listing.get("person_capacity") or listing.get("guests_included")
        if isinstance(gaeste, int) and gaeste > 0:
            row["max_guests"] = gaeste
        return row

    def _objekt_schreiben(
        self, db: Client, tenant_id: str, row: dict[str, Any]
    ) -> bool:
        """Objekt anlegen oder aktualisieren. True = neu angelegt.

        Idempotent über (tenant_id, airbnb_listing_id): derselbe Aufruf zweimal
        erzeugt kein zweites Objekt (Wurzel 2). Ein vorhandenes Gerüst-Objekt
        wird beim ERSTEN Listing gefüllt statt daneben ein weiteres anzulegen —
        sonst bliebe „Airbnb-Übernahme läuft" für immer als Geisterobjekt stehen
        (Wurzel 1: der Gegenzustand zum Anlegen ist das Füllen).
        """
        vorhanden = (
            db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("airbnb_listing_id", row["airbnb_listing_id"])
            .limit(1)
            .execute()
        ).data
        if vorhanden:
            db.table("properties").update(row).eq("id", vorhanden[0]["id"]).execute()
            self._ensure_default_unit(
                db, tenant_id, vorhanden[0]["id"], row.get("title")
            )
            return False

        geruest = (
            db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("title", _GERUEST_TITEL)
            .is_("airbnb_listing_id", "null")
            .limit(1)
            .execute()
        ).data
        if geruest:
            db.table("properties").update(row).eq("id", geruest[0]["id"]).execute()
            self._ensure_default_unit(
                db, tenant_id, geruest[0]["id"], row.get("title")
            )
            return False

        neu = (
            db.table("properties")
            .insert({**row, "tenant_id": tenant_id, "status": "draft"})
            .execute()
        ).data
        if not neu:
            raise ChannelManagerError(
                "Objekt konnte nicht angelegt werden.", status_code=500
            )
        self._ensure_default_unit(db, tenant_id, neu[0]["id"], row.get("title"))
        return True
