"""Route-Einstieg: Buchungshistorie EINES Objekts holen — Vorschau und Import.

Zwei Einstiege, weil der Betrieb VOR dem Import wissen muss, worauf er sich
einlässt:

  `airbnb_historie_vorschau` — sagt, welche Etappen der gewählte Zeitraum
      ergibt und wie viele Buchungen dieses Objekt darin hat. Reiner GET, ändert
      nichts. Damit füllt der Dialog seine Zahlen, bevor irgendwas geschrieben
      wird.

  `airbnb_historie_importieren` — fährt dieselben Etappen und übernimmt. Meldet
      je Etappe den Fortschritt, damit die Oberfläche mitlaufen kann statt vor
      einem hängenden Knopf zu stehen (ein Zeitraum 2020–heute sind 27 Etappen).

BEIDE ARBEITEN AUF GENAU EINEM OBJEKT. Der Kanal trägt alle Objekte des Kontos
(live 462 Buchungen über 41 Inserate) — ein Objekt-Import darf davon nur seine
eigenen anfassen. Gefiltert wird auf `properties.airbnb_listing_id`; alles
andere wird gezählt und gemeldet, aber nicht geschrieben.
"""
from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Any

from supabase import Client

from src.core.security import AuthContext
from src.core.supabase import load_scoped
from src.jobs.queue import enqueue

from . import airbnb_bestand_cache
from .airbnb_bestand_zeitraum import bestandszeitraum
from .airbnb_historie import EtappenErgebnis, HistorieErgebnis, etappen_planen
from .airbnb_konten import kontoweise
from .common import ChannelManagerError, log, ota_buchungszeitpunkt, ota_uhrzeit

# Kein erfundener Standard-Zeitraum: fehlt eine Angabe, fragt die Oberfläche.
# Ein stillschweigendes „letzte 2 Jahre" ließe Buchungen zurück, ohne dass es
# jemandem auffällt — genau das soll dieser Weg verhindern.


class AirbnbHistorieDienstMixin:
    """Vorschau und Import der Airbnb-Historie eines Objekts."""

    def nachpflege_bestand(
        self, db: Client, token: str
    ) -> HistorieErgebnis | None:
        """Der Kontobestand für die Nachpflege — geteilt und datengetrieben.

        Die EINE Stelle, über die alle vier Nachpflege-Schritte ihren Bestand
        holen. Sie bündelt die zwei Sparmaßnahmen vom 12.08.2026, damit sie nicht
        an vier Stellen kopiert leben und dort einzeln verfallen:

          * `airbnb_bestand_cache` — je Tick wird EINMAL abgerufen, nicht je
            Schritt. Vorher stand dieselbe Abrufzeile viermal pro Tick im Log.
          * `bestandszeitraum` — der Zeitraum kommt aus dem eigenen Bestand statt
            aus `heute.year - 6 … + 2`. Beim Beta-Betrieb waren davon vier von
            acht Jahren garantiert leer.

        `None` heisst: kein Airbnb-Bestand, also nichts zu heilen. Der Aufrufer
        hört dann auf — ein Abruf „für alle Fälle" wäre der teuerste Weg zu
        derselben Auskunft.
        """
        zeitraum = bestandszeitraum(db)
        if zeitraum is None:
            return None
        von, bis = zeitraum
        return airbnb_bestand_cache.bestand(
            token,
            lambda t: self.airbnb_historie_lesen(  # type: ignore[attr-defined]
                t, listing_id="", von=von, bis=bis, alle_listings=True,
            ),
        )

    def _historie_kontext(
        self, ctx: AuthContext, property_id: str
    ) -> tuple[Any, str, dict[str, Any], str, str]:
        """Gemeinsame Vorprüfung beider Einstiege.

        Liefert (db, tenant_id, objekt, listing_id, token). Wirft mit klarer
        Begründung, wenn etwas fehlt — nie mit einem Ersatzwert weiterarbeiten.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        # Wurzel 3/9: derselbe Tenant-Scope wie im List-Pfad, gescopt geladen.
        prop = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, title, currency, airbnb_listing_id",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        listing_id = str(prop.get("airbnb_listing_id") or "")
        if not listing_id:
            raise ChannelManagerError(
                "Dieses Objekt ist mit keiner Airbnb-Anzeige verknüpft. Rufe es "
                "zuerst bei Airbnb ab, dann steht die Verknüpfung.",
                status_code=422,
            )
        zugang = self._airbnb_token(db, tenant_id, property_id)  # type: ignore[attr-defined]
        if not zugang:
            raise ChannelManagerError(
                "Es ist kein Airbnb-Konto verbunden. Verbinde zuerst Airbnb im "
                "Kanalmanager.",
                status_code=409,
            )
        return db, tenant_id, prop, listing_id, zugang[0]

    @staticmethod
    def _zeitraum(von: str, bis: str) -> tuple[date, date]:
        """Zeitraum der Anfrage prüfen. Ungültiges Datum → 422, kein Ersatz."""
        try:
            return date.fromisoformat(von), date.fromisoformat(bis)
        except ValueError as exc:
            raise ChannelManagerError(
                "Bitte Start und Ende als Datum angeben (JJJJ-MM-TT).",
                status_code=422,
            ) from exc

    def airbnb_historie_vorschau(
        self, ctx: AuthContext, property_id: str, *, von: str, bis: str
    ) -> dict[str, Any]:
        """Was würde dieser Zeitraum bringen? Liest, schreibt nichts.

        Zeigt die Etappen mit Fundzahlen, damit der Betrieb den Umfang sieht,
        bevor er importiert — und sieht, wenn eine Etappe scheitert.
        """
        _db, _tid, prop, listing_id, token = self._historie_kontext(ctx, property_id)
        start, ende = self._zeitraum(von, bis)
        ergebnis = self.airbnb_historie_lesen(  # type: ignore[attr-defined]
            token, listing_id, von=start, bis=ende
        )
        return {
            "property_id": property_id,
            "titel": prop.get("title"),
            "listing_id": listing_id,
            "von": ergebnis.von,
            "bis": ergebnis.bis,
            "etappen": [vars(e) for e in ergebnis.etappen],
            "gefunden": len(ergebnis.buchungen),
            "mit_nachrichten": sum(
                1 for b in ergebnis.buchungen if b.get("thread_id")
            ),
            "fremde": ergebnis.fremde,
            "vollstaendig": ergebnis.vollstaendig,
            "jahre": _jahresverteilung(ergebnis.buchungen),
        }

    def airbnb_historie_importieren(
        self,
        ctx: AuthContext,
        property_id: str,
        *,
        von: str,
        bis: str,
        melden: Callable[[EtappenErgebnis], None] | None = None,
    ) -> dict[str, Any]:
        """Die Historie dieses Objekts holen und übernehmen.

        `vollstaendig: false` heißt: mindestens eine Etappe ist gescheitert, es
        FEHLEN also möglicherweise Buchungen. Die Oberfläche muss das zeigen und
        zum erneuten Lauf auffordern, statt „fertig" zu melden (Wurzel 5).
        """
        db, tenant_id, prop, listing_id, token = self._historie_kontext(
            ctx, property_id
        )
        waehrung = str(prop.get("currency") or "").strip()
        if not waehrung:
            # Wurzel 4: keine Buchung ohne echte Währung schreiben, kein „EUR".
            raise ChannelManagerError(
                "Dem Objekt fehlt die Währung. Trage sie zuerst am Objekt ein, "
                "sonst könnten Beträge falsch übernommen werden.",
                status_code=422,
            )
        start, ende = self._zeitraum(von, bis)

        gelesen = self.airbnb_historie_lesen(  # type: ignore[attr-defined]
            token, listing_id, von=start, bis=ende, melden=melden
        )
        uebernommen = self.airbnb_buchungen_uebernehmen(  # type: ignore[attr-defined]
            db, tenant_id, property_id, gelesen.buchungen, waehrung=waehrung
        )

        log.info(
            "airbnb_historie_import_fertig",
            tenant_id=tenant_id, property_id=property_id,
            listing_id=listing_id, von=gelesen.von, bis=gelesen.bis,
            gelesen=len(gelesen.buchungen), angelegt=uebernommen.angelegt,
            aktualisiert=uebernommen.aktualisiert,
            uebersprungen=uebernommen.uebersprungen,
            vollstaendig=gelesen.vollstaendig,
        )
        return {
            "property_id": property_id,
            "titel": prop.get("title"),
            "listing_id": listing_id,
            "von": gelesen.von,
            "bis": gelesen.bis,
            "etappen": [vars(e) for e in gelesen.etappen],
            "gelesen": len(gelesen.buchungen),
            "angelegt": uebernommen.angelegt,
            "aktualisiert": uebernommen.aktualisiert,
            "uebersprungen": uebernommen.uebersprungen,
            "gruende": uebernommen.gruende,
            "fremde": gelesen.fremde,
            "vollstaendig": gelesen.vollstaendig,
            "fehlgeschlagene_etappen": [
                vars(e) for e in gelesen.fehlgeschlagene
            ],
        }

    def airbnb_historie_etappe(
        self,
        ctx: AuthContext,
        property_id: str,
        *,
        von: str,
        bis: str,
        nummer: int,
        uebernehmen: bool,
        bekannt: list[str] | None = None,
    ) -> dict[str, Any]:
        """GENAU EINE Etappe fahren — der Weg für einen sichtbaren Fortschritt.

        Warum überhaupt einzeln: Ein Zeitraum 2020–heute sind 27 Etappen mit
        rund 60 Aufrufen und über einer Minute Laufzeit. Als EIN Request bleibt
        die Oberfläche so lange stumm — der Betrieb sieht einen Spinner und
        weiß nicht, ob noch etwas passiert. Also holt die Oberfläche Etappe für
        Etappe und zeigt jede Zeile, sobald sie fertig ist.

        `bekannt` sind die Bestätigungscodes der VORHERIGEN Etappen. Ohne sie
        wüsste dieser Aufruf nichts von der Überlappung und meldete dieselbe
        Buchung viermal als „neu" — der Zähler im Dialog wäre schlicht falsch.
        Geschrieben wird trotzdem idempotent (Upsert über den Code), die Liste
        korrigiert also die ANZEIGE, nicht die Wirkung.

        `uebernehmen=False` ist der Vorschau-Modus: nur zählen, nichts
        schreiben. Damit fährt der Dialog dieselbe Kette zweimal — einmal zum
        Zeigen, einmal zum Übernehmen.
        """
        db, tenant_id, prop, listing_id, token = self._historie_kontext(
            ctx, property_id
        )
        start, ende = self._zeitraum(von, bis)
        plan = etappen_planen(start, ende)
        if not 1 <= nummer <= len(plan):
            raise ChannelManagerError(
                f"Etappe {nummer} gibt es in diesem Zeitraum nicht "
                f"({len(plan)} Etappen).",
                status_code=422,
            )
        etappen_start, etappen_ende = plan[nummer - 1]

        waehrung = str(prop.get("currency") or "").strip()
        if uebernehmen and not waehrung:
            raise ChannelManagerError(
                "Dem Objekt fehlt die Währung. Trage sie zuerst am Objekt ein, "
                "sonst könnten Beträge falsch übernommen werden.",
                status_code=422,
            )

        # Nur DIESE eine Etappe lesen: `airbnb_historie_lesen` mit einem
        # Zeitraum, der genau einen Etappen-Start ergibt.
        gelesen = self.airbnb_historie_lesen(  # type: ignore[attr-defined]
            token, listing_id, von=etappen_start, bis=etappen_start
        )
        schon = set(bekannt or [])
        frisch = [
            b for b in gelesen.buchungen
            if str(b.get("confirmation_code") or "") not in schon
        ]

        uebernommen = None
        if uebernehmen and frisch:
            uebernommen = self.airbnb_buchungen_uebernehmen(  # type: ignore[attr-defined]
                db, tenant_id, property_id, frisch, waehrung=waehrung
            )

        etappe = gelesen.etappen[0] if gelesen.etappen else None
        return {
            "nummer": nummer,
            "gesamt": len(plan),
            "von": etappen_start.isoformat(),
            "bis": etappen_ende.isoformat(),
            "gefunden": len(gelesen.buchungen),
            "neu": len(frisch),
            "codes": [
                str(b.get("confirmation_code") or "") for b in gelesen.buchungen
            ],
            "jahre": _jahresverteilung(frisch),
            "mit_nachrichten": sum(1 for b in frisch if b.get("thread_id")),
            "fremde": gelesen.fremde,
            "angelegt": uebernommen.angelegt if uebernommen else 0,
            "aktualisiert": uebernommen.aktualisiert if uebernommen else 0,
            "uebersprungen": uebernommen.uebersprungen if uebernommen else 0,
            "gruende": uebernommen.gruende if uebernommen else [],
            # Wurzel 5: eine gescheiterte Etappe wird benannt, nicht verschluckt
            # — sonst zählt der Dialog munter weiter, obwohl Buchungen fehlen.
            "fehler": etappe.fehler if etappe else None,
        }

    def buchungszeitpunkte_heilen(self, grenze: int = 200) -> dict[str, int]:
        """Fehlende `booked_at` bei ALLEN Tenants nachtragen (Worker-Tick).

        DER GRUND, warum das ein Dauerlauf und keine Einmal-Reparatur ist: Ein
        Zeitpunkt kann aus drei Richtungen fehlen — Buchungen von VOR 0291/0292,
        ein Portal ohne das Feld, oder ein Feed-Eingang, bevor die Anbindung
        stand. In allen drei Fällen zeigte der Posteingang unseren
        Anlagezeitpunkt statt des echten (live: 22 Buchungen aus März/Juni/Juli
        alle als „heute 10:48"). Ein Handlauf heilt das einmal; die nächste
        Buchung ohne Feld steht wieder falsch da. Deshalb heilt das System sich
        selbst.

        Arbeitet je AIRBNB-KANAL, nicht je Buchung: ein Abruf deckt alle
        offenen Zeilen eines Kontos ab (bei 22 offenen sonst 22 Rundreisen).
        Angefasst wird nur, was `booked_at IS NULL` hat — ein vorhandener Wert
        ist der echte und wird nie überschrieben.
        """
        db = self._require_db()  # type: ignore[attr-defined]
        # Grenze JE TENANT (siehe `anreisezeiten_heilen`): global gezogen würde
        # ein Betrieb mit vielen offenen Zeilen alle anderen verdrängen, und die
        # Verdrängten kämen bei jedem Tick erneut zu spät.
        alle = (
            db.table("channex_booking")
            .select("id, tenant_id, ota_reservation_code, ota_name")
            .is_("booked_at", "null")
            .eq("ota_name", "AirBNB")
            .limit(grenze * 50)
            .execute()
        ).data or []
        if not alle:
            return {"geprueft": 0, "gesetzt": 0}

        # Nach Tenant bündeln: der Airbnb-Kanal hängt am Konto, nicht am Objekt.
        je_tenant: dict[str, list[dict[str, Any]]] = {}
        for zeile in alle:
            tid = str(zeile.get("tenant_id") or "")
            if tid and len(je_tenant.setdefault(tid, [])) < grenze:
                je_tenant[tid].append(zeile)
        offen = [z for zeilen in je_tenant.values() for z in zeilen]

        gesetzt = 0
        for tenant_id, zeilen in je_tenant.items():
            try:
                gesetzt += self._zeitpunkte_eines_tenants(db, tenant_id, zeilen)
            except (ChannelManagerError, OSError) as exc:
                # Ein Konto ohne Token/Kanal darf die anderen nicht aufhalten;
                # der nächste Tick versucht es erneut (best effort, Wurzel 5:
                # spezifisch gefangen, nicht blind).
                log.warning(
                    "buchungszeitpunkt_heilung_tenant_fehlgeschlagen",
                    tenant_id=tenant_id, error=str(exc)[:200],
                )
        log.info(
            "buchungszeitpunkte_geheilt",
            geprueft=len(offen), gesetzt=gesetzt, tenants=len(je_tenant),
        )
        return {"geprueft": len(offen), "gesetzt": gesetzt}

    def anreisezeiten_heilen(self, grenze: int = 200) -> dict[str, int]:
        """Fehlende An-/Abreisezeiten nachtragen (Worker-Tick, 0295-Reihe).

        Channex reicht Airbnbs Check-in-Zeit NICHT durch: `raw` enthält weder
        `checkin_time` noch `arrival_hour` (live geprüft). Airbnb selbst liefert
        sie an der Reservierung als `check_in_datetime`
        (`'…T16:00+02:00[Europe/Copenhagen]'`). Ohne diesen Lauf blieb
        `reservations.checkin_time` leer — bei allen 23 Reservierungen — und
        jede Anreise-Vorlage scheiterte mit „Feld ohne Wert: checkin_time".

        Wie bei den Buchungszeitpunkten ein Dauerlauf, kein Einmal-Fix: die
        nächste Buchung käme sonst wieder ohne Zeit herein.
        """
        db = self._require_db()  # type: ignore[attr-defined]
        # Die Grenze gilt JE TENANT, nicht global. Eine globale Obergrenze über
        # alle Betriebe hungert einen einzelnen dauerhaft aus: beim ersten Lauf
        # füllten 187 Zeilen fremder Tenants das Kontingent von 200, und dieser
        # Betrieb bekam nur 13 seiner 23 Zeiten — die übrigen 10 wären bei jedem
        # weiteren Tick erneut hinten angestanden. Deshalb zuerst die betroffenen
        # Tenants ermitteln, dann je Tenant bis zur Grenze holen.
        alle = (
            db.table("reservations")
            # `property_id` gehört dazu: bei mehreren Airbnb-Konten (0304)
            # entscheidet das Objekt, mit WELCHEM Token die Reservierung
            # abgefragt werden darf.
            .select("id, tenant_id, external_ref, property_id")
            .is_("checkin_time", "null")
            .eq("channel", "airbnb")
            .not_.is_("external_ref", "null")
            .limit(grenze * 50)
            .execute()
        ).data or []
        if not alle:
            return {"geprueft": 0, "gesetzt": 0}

        je_tenant: dict[str, list[dict[str, Any]]] = {}
        for zeile in alle:
            tid = str(zeile.get("tenant_id") or "")
            if tid and len(je_tenant.setdefault(tid, [])) < grenze:
                je_tenant[tid].append(zeile)
        offen = [z for zeilen in je_tenant.values() for z in zeilen]

        gesetzt = 0
        for tenant_id, zeilen in je_tenant.items():
            try:
                gesetzt += self._anreisezeiten_eines_tenants(db, tenant_id, zeilen)
            except (ChannelManagerError, OSError) as exc:
                log.warning(
                    "anreisezeit_heilung_tenant_fehlgeschlagen",
                    tenant_id=tenant_id, error=str(exc)[:200],
                )
        log.info(
            "anreisezeiten_geheilt",
            geprueft=len(offen), gesetzt=gesetzt, tenants=len(je_tenant),
        )
        return {"geprueft": len(offen), "gesetzt": gesetzt}

    def _anreisezeiten_eines_tenants(
        self, db: Client, tenant_id: str, zeilen: list[dict[str, Any]]
    ) -> int:
        """Offene An-/Abreisezeiten holen — je verbundenem Konto einmal (0304).

        `reservations` trägt `property_id` selbst, deshalb `hat_property=True`:
        die Zuordnung Zeile → Konto braucht keinen Umweg über die Buchung.
        """
        return kontoweise(
            db, tenant_id, zeilen, self._anreisezeiten_eines_kontos,
            hat_property=True,
        )

    def _anreisezeiten_eines_kontos(
        self, db: Client, tenant_id: str, zeilen: list[dict[str, Any]],
        channel_id: str,
    ) -> int:
        """Die offenen An-/Abreisezeiten EINES Kontos holen und setzen."""
        zugang = self._airbnb_token_am_kanal(channel_id)  # type: ignore[attr-defined]
        if not zugang:
            return 0

        gelesen = self.nachpflege_bestand(db, zugang[0])
        if gelesen is None:
            return 0
        zeiten = {
            str(b.get("confirmation_code") or ""): (
                ota_uhrzeit(b.get("check_in_datetime")),
                ota_uhrzeit(b.get("check_out_datetime")),
            )
            for b in gelesen.buchungen
        }

        gesetzt = 0
        for zeile in zeilen:
            an, ab = zeiten.get(str(zeile.get("external_ref") or ""), (None, None))
            if not an and not ab:
                continue
            (
                db.table("reservations")
                .update({"checkin_time": an, "checkout_time": ab})
                .eq("tenant_id", tenant_id)
                .eq("id", zeile["id"])
                .is_("checkin_time", "null")
                .execute()
            )
            gesetzt += 1
        return gesetzt

    def _zeitpunkte_eines_tenants(
        self, db: Client, tenant_id: str, zeilen: list[dict[str, Any]]
    ) -> int:
        """Offene Buchungszeitpunkte holen — je verbundenem Konto einmal (0304)."""
        return kontoweise(db, tenant_id, zeilen, self._zeitpunkte_eines_kontos)

    def _zeitpunkte_eines_kontos(
        self, db: Client, tenant_id: str, zeilen: list[dict[str, Any]],
        channel_id: str,
    ) -> int:
        """Die offenen Zeitpunkte EINES Kontos beim Portal holen und setzen."""
        zugang = self._airbnb_token_am_kanal(channel_id)  # type: ignore[attr-defined]
        if not zugang:
            return 0
        token = zugang[0]

        # Ein Abruf über den Bestandszeitraum liefert die Zeitpunkte aller
        # Inserate DIESES Kontos auf einmal. Das einzelne Listing ist dabei egal
        # — zugeordnet wird über den Bestätigungscode.
        gelesen = self.nachpflege_bestand(db, token)
        if gelesen is None:
            return 0
        zeitpunkt = {
            str(b.get("confirmation_code") or ""): ota_buchungszeitpunkt(b)
            for b in gelesen.buchungen
        }

        gesetzt = 0
        for zeile in zeilen:
            code = str(zeile.get("ota_reservation_code") or "")
            wert = zeitpunkt.get(code)
            if not wert:
                continue
            db.table("channex_booking").update({"booked_at": wert}).eq(
                "id", zeile["id"]
            ).execute()
            (
                db.table("reservations")
                .update({"booked_at": wert})
                .eq("tenant_id", tenant_id)
                .eq("external_ref", code)
                .is_("booked_at", "null")
                .execute()
            )
            gesetzt += 1
        return gesetzt

    def airbnb_buchungszeitpunkte_nachziehen(
        self, ctx: AuthContext, property_id: str
    ) -> dict[str, Any]:
        """`booked_at` für bestehende Buchungen dieses Objekts nachtragen (0291).

        Für alles, was über den Feed hereinkam: dort steht das echte
        Buchungsdatum NICHT drin (Channex' `ota_booked_at` ist leer, live
        geprüft), also zeigte der Posteingang eine Buchung vom 23.03. als
        „heute". Dieser Lauf holt den Zeitpunkt beim Portal nach.

        Angefasst werden NUR Zeilen ohne `booked_at` — ein vorhandener Wert ist
        bereits der echte und wird nicht überschrieben.
        """
        db, tenant_id, prop, listing_id, token = self._historie_kontext(
            ctx, property_id
        )
        offen = (
            db.table("reservations")
            .select("id, external_ref")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("booked_at", "null")
            .execute()
        ).data or []
        if not offen:
            return {"geprueft": 0, "gesetzt": 0, "ohne_datum": 0}

        # Den vollen Zeitraum des Objekts einmal lesen und daraus eine
        # Code→Zeitpunkt-Tabelle bauen: ein Abruf je Etappe statt einer je
        # Buchung (bei 22 offenen Zeilen sonst 22 Rundreisen).
        heute = date.today()
        gelesen = self.airbnb_historie_lesen(  # type: ignore[attr-defined]
            token, listing_id,
            von=date(heute.year - 6, 1, 1), bis=date(heute.year + 2, 12, 31),
        )
        zeitpunkt = {
            str(b.get("confirmation_code") or ""):
                b.get("booked_at") or b.get("created_at")
            for b in gelesen.buchungen
        }

        gesetzt = 0
        for zeile in offen:
            wert = zeitpunkt.get(str(zeile.get("external_ref") or ""))
            if not wert:
                continue
            (
                db.table("reservations")
                .update({"booked_at": wert})
                .eq("tenant_id", tenant_id)
                .eq("id", zeile["id"])
                .execute()
            )
            gesetzt += 1

        # Der Posteingang liest aus `channex_booking`, nicht aus
        # `reservations` (0292) — ohne diesen zweiten Durchgang stünde dort
        # weiter der Feed-Eingang, obwohl die Reservierung schon stimmt.
        for code, wert in zeitpunkt.items():
            if not (code and wert):
                continue
            (
                db.table("channex_booking")
                .update({"booked_at": wert})
                .eq("tenant_id", tenant_id)
                .eq("ota_reservation_code", code)
                .is_("booked_at", "null")
                .execute()
            )

        log.info(
            "airbnb_buchungszeitpunkte_nachgezogen",
            tenant_id=tenant_id, property_id=property_id,
            geprueft=len(offen), gesetzt=gesetzt,
        )
        return {
            "titel": prop.get("title"),
            "geprueft": len(offen),
            "gesetzt": gesetzt,
            # Was das Portal nicht kennt, bleibt leer statt geraten (Wurzel 4).
            "ohne_datum": len(offen) - gesetzt,
        }

    def airbnb_verbundene_objekte(self, ctx: AuthContext) -> list[dict[str, Any]]:
        """Die Objekte, für die ein Historien-Import überhaupt etwas holen kann.

        „Verbunden" heißt BEIDES: das Objekt trägt eine `airbnb_listing_id`
        (sonst weiß niemand, welche Anzeige gemeint ist) UND sein Mapping steht
        auf `sync_enabled` (sonst ist der Kanal für dieses Objekt bewusst aus).
        Ein Objekt ohne Verknüpfung wird NICHT stillschweigend übersprungen,
        sondern gar nicht erst angeboten — der Betrieb soll sehen, was fehlt.

        Fremde Anzeigen des Airbnb-Kontos bleiben damit außen vor: der Kanal
        trägt alle Inserate des Kontos, aber importiert wird nur, was hier auch
        einem Objekt zugeordnet ist.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        return self.verbundene_objekte_des_tenants(tenant_id)

    def verbundene_objekte_des_tenants(
        self, tenant_id: str
    ) -> list[dict[str, Any]]:
        """Wie `airbnb_verbundene_objekte`, aber mit der Tenant-ID statt einem
        `AuthContext` — der Weg für den Worker, der keine Sitzung hat.

        Der Tenant kommt hier aus der Job-Payload und wird beim Einreihen aus
        dem `AuthContext` gesetzt; er darf NIE aus einer Anfrage stammen
        (Wurzel 3).
        """
        db = self._require_db()  # type: ignore[attr-defined]
        objekte = (
            db.table("properties")
            .select("id, title, currency, airbnb_listing_id")
            .eq("tenant_id", tenant_id)
            .not_.is_("airbnb_listing_id", "null")
            .order("title")
            .execute()
        ).data or []
        if not objekte:
            return []
        erlaubt = {
            str(z["property_id"])
            for z in (
                db.table("channex_property_map")
                .select("property_id, sync_enabled")
                .eq("tenant_id", tenant_id)
                .eq("sync_enabled", True)
                # `sync_enabled` allein genügt NICHT: eine gelöschte Zuordnung
                # behält ihren alten `sync_enabled`-Wert (beide werden gemeinsam
                # gesetzt, aber die Zeile bleibt als Beleg stehen). Ohne diesen
                # Filter gilt ein Objekt als verbunden, dessen Channex-Property
                # längst weg ist — live: FeWo Stjerneskud trug drei Zeilen, zwei
                # davon gelöscht und auf 404-Properties zeigend.
                .is_("deleted_at", "null")
                .execute()
            ).data
            or []
        }
        return [o for o in objekte if str(o["id"]) in erlaubt]

    def airbnb_historie_alle_importieren(
        self, ctx: AuthContext, *, von: str, bis: str,
    ) -> dict[str, Any]:
        """Die Historie ALLER verbundenen Objekte holen — ein Knopf, ein Lauf.

        Bisher ging der Import nur objektweise. Bei 18 verbundenen Objekten
        heißt das 18 Klicks, und wer eines übersieht, merkt es nie: der
        Kalender sieht vollständig aus, dem Objekt fehlt nur seine Vergangenheit.

        Doppelte Buchungen kann dieser Weg nicht erzeugen: `_bestehende_buchung`
        sucht den Bestätigungscode unter BEIDEN Spalten und aktualisiert die
        gefundene Zeile, statt eine zweite anzulegen; der UNIQUE-Index auf
        `source_channex_booking_id` ist der Backstop, falls zwei Läufe sich
        überholen (Wurzel 2). Ein zweiter Klick auf den Knopf ist deshalb
        gefahrlos — er aktualisiert, er verdoppelt nicht.

        Ein gescheitertes Objekt beendet den Lauf NICHT: die übrigen werden
        fertig importiert, und der Fehler steht namentlich im Ergebnis. Sonst
        entschiede die alphabetische Reihenfolge darüber, wessen Historie
        ankommt (Wurzel 5 — nicht verschlucken, aber auch nicht alles kippen).
        """
        objekte = self.airbnb_verbundene_objekte(ctx)
        if not objekte:
            raise ChannelManagerError(
                "Kein Objekt ist mit einer Airbnb-Anzeige verbunden. Ordne die "
                "Anzeigen zuerst im Kanalmanager zu.",
                status_code=409,
            )

        ergebnisse: list[dict[str, Any]] = []
        angelegt = aktualisiert = uebersprungen = 0
        gescheitert: list[dict[str, str]] = []
        for objekt in objekte:
            pid = str(objekt["id"])
            try:
                eines = self.airbnb_historie_importieren(
                    ctx, pid, von=von, bis=bis
                )
            except ChannelManagerError as exc:
                # Namentlich melden statt still überspringen: ein Objekt ohne
                # Währung oder mit abgelaufenem Token muss auffallen.
                gescheitert.append(
                    {"property_id": pid,
                     "titel": str(objekt.get("title") or ""),
                     "grund": exc.message}
                )
                continue
            angelegt += int(eines.get("angelegt") or 0)
            aktualisiert += int(eines.get("aktualisiert") or 0)
            uebersprungen += int(eines.get("uebersprungen") or 0)
            ergebnisse.append(eines)

        # `vollstaendig` nur, wenn KEIN Objekt gescheitert ist UND jedes seine
        # Etappen ganz gefahren hat. Sonst fehlen Buchungen, und der Lauf ist zu
        # wiederholen — „fertig" wäre hier eine Falschaussage.
        vollstaendig = not gescheitert and all(
            bool(e.get("vollstaendig")) for e in ergebnisse
        )
        log.info(
            "airbnb_historie_alle_fertig",
            objekte=len(objekte), erfolgreich=len(ergebnisse),
            gescheitert=len(gescheitert), angelegt=angelegt,
            aktualisiert=aktualisiert, vollstaendig=vollstaendig,
        )
        return {
            "objekte": len(objekte),
            "erfolgreich": len(ergebnisse),
            "angelegt": angelegt,
            "aktualisiert": aktualisiert,
            "uebersprungen": uebersprungen,
            "gescheitert": gescheitert,
            "vollstaendig": vollstaendig,
            "ergebnisse": ergebnisse,
        }

    def historie_lauf_starten(
        self, ctx: AuthContext, *, von: str, bis: str
    ) -> dict[str, Any]:
        """Einen serverseitigen Lauf einreihen und seine Zeile zurückgeben.

        Der Klick wartet NICHT auf den Import — er reiht nur ein. Der Worker
        arbeitet die Objekte ab und schreibt seinen Stand in
        `airbnb_historie_lauf`; die Oberfläche liest ihn per Realtime. Damit
        überlebt ein Lauf das Schließen des Tabs, was er vorher nicht tat
        (18 Objekte dauern Minuten, so lange bleibt niemand auf der Seite).

        Läuft schon einer, wird DIESER zurückgegeben statt ein zweiter
        gestartet: zwei parallele Läufe würden dieselben Buchungen gleichzeitig
        schreiben (Wurzel 2). Der partielle Unique-Index ist der Backstop.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        self._zeitraum(von, bis)  # 422 bei unbrauchbarem Datum, vor dem Insert

        offen = (
            db.table("airbnb_historie_lauf")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("status", "laeuft")
            .limit(1)
            .execute()
        ).data
        if offen:
            return dict(offen[0])

        objekte = self.verbundene_objekte_des_tenants(tenant_id)
        if not objekte:
            raise ChannelManagerError(
                "Kein Objekt ist mit einer Airbnb-Anzeige verbunden. Ordne die "
                "Anzeigen zuerst im Kanalmanager zu.",
                status_code=409,
            )

        try:
            zeile = (
                db.table("airbnb_historie_lauf")
                .insert({
                    "tenant_id": tenant_id,
                    "gestartet_von": getattr(ctx, "user_id", None),
                    "von": von,
                    "bis": bis,
                    "objekte_gesamt": len(objekte),
                })
                .execute()
            ).data[0]
        except Exception as exc:  # noqa: BLE001 — Supabase-Client, Typ variiert
            # 23505 = der Unique-Index hat einen parallelen Start abgefangen.
            # Das ist der ZIELZUSTAND: den bestehenden Lauf liefern.
            if "23505" not in str(exc):
                raise
            bestehend = (
                db.table("airbnb_historie_lauf")
                .select("*")
                .eq("tenant_id", tenant_id)
                .eq("status", "laeuft")
                .limit(1)
                .execute()
            ).data
            if bestehend:
                return dict(bestehend[0])
            raise

        enqueue(
            db, "airbnb_historie_import",
            payload={"lauf_id": str(zeile["id"]), "tenant_id": tenant_id,
                     "von": von, "bis": bis},
            tenant_id=tenant_id,
            dedup_key=f"airbnb_historie_import:{tenant_id}",
            # Ein Import ist Minutenarbeit; ein hängengebliebener Versuch soll
            # nicht zehnmal wiederholt werden und dabei Airbnb belasten.
            max_attempts=3,
        )
        log.info(
            "airbnb_historie_lauf_gestartet",
            tenant_id=tenant_id, lauf_id=str(zeile["id"]),
            objekte=len(objekte), von=von, bis=bis,
        )
        return dict(zeile)

    def historie_lauf_aktuell(self, ctx: AuthContext) -> dict[str, Any] | None:
        """Der jüngste Lauf dieses Betriebs — für die Anzeige beim Seitenaufruf.

        Ohne diesen Weg wüsste eine frisch geladene Seite nichts von einem
        laufenden Import und böte den Knopf an, als sei nichts los.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        zeilen = (
            db.table("airbnb_historie_lauf")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data
        return dict(zeilen[0]) if zeilen else None

    def historie_lauf_ausfuehren(self, lauf_id: str) -> dict[str, Any]:
        """Den eingereihten Lauf abarbeiten — läuft im WORKER, ohne Sitzung.

        Nach JEDEM Objekt wird der Stand geschrieben, nicht erst am Ende: genau
        dafür ist die Tabelle da. Bricht der Worker mitten drin ab, steht der
        letzte erreichte Stand da statt einer Zeile, die ewig auf 0 zeigt.
        """
        db = self._require_db()  # type: ignore[attr-defined]
        lauf = (
            db.table("airbnb_historie_lauf")
            .select("*")
            .eq("id", lauf_id)
            .limit(1)
            .execute()
        ).data
        if not lauf:
            raise ChannelManagerError("Lauf nicht gefunden.", status_code=404)
        lauf = lauf[0]
        tenant_id = str(lauf["tenant_id"])
        von, bis = str(lauf["von"]), str(lauf["bis"])

        objekte = self.verbundene_objekte_des_tenants(tenant_id)
        angelegt = aktualisiert = uebersprungen = 0
        gescheitert: list[dict[str, str]] = []

        for i, objekt in enumerate(objekte):
            pid = str(objekt["id"])
            titel = str(objekt.get("title") or "")
            db.table("airbnb_historie_lauf").update({
                "objekte_fertig": i,
                "objekte_gesamt": len(objekte),
                "aktuelles_objekt": titel,
                "angelegt": angelegt,
                "aktualisiert": aktualisiert,
                "updated_at": datetime.now(UTC).isoformat(),
            }).eq("id", lauf_id).execute()
            # Denselben Stand in die Glocke: der Betrieb hat die Seite längst
            # verlassen und sieht dort sonst 20 Minuten lang gar nichts.
            self._glocke_fortschritt(
                db, lauf, fertig=i, gesamt=len(objekte), objekt=titel,
                buchungen=angelegt + aktualisiert,
            )

            try:
                eines = self.historie_eines_objekts_importieren(
                    tenant_id, pid, von=von, bis=bis
                )
            except ChannelManagerError as exc:
                # Ein Objekt scheitern lassen, die übrigen fertig fahren —
                # sonst entscheidet die Reihenfolge, wessen Historie ankommt.
                gescheitert.append({"titel": titel, "grund": exc.message})
                continue
            angelegt += int(eines.get("angelegt") or 0)
            aktualisiert += int(eines.get("aktualisiert") or 0)
            uebersprungen += int(eines.get("uebersprungen") or 0)
            if not eines.get("vollstaendig"):
                gescheitert.append(
                    {"titel": titel, "grund": "Etappen unvollständig"}
                )

        status = "fertig" if not gescheitert else "unvollstaendig"
        db.table("airbnb_historie_lauf").update({
            "status": status,
            "objekte_fertig": len(objekte),
            "aktuelles_objekt": None,
            "angelegt": angelegt,
            "aktualisiert": aktualisiert,
            "uebersprungen": uebersprungen,
            "gescheitert": gescheitert,
            "beendet_at": datetime.now(UTC).isoformat(),
            "updated_at": datetime.now(UTC).isoformat(),
        }).eq("id", lauf_id).execute()

        log.info(
            "airbnb_historie_lauf_fertig",
            tenant_id=tenant_id, lauf_id=lauf_id, status=status,
            objekte=len(objekte), angelegt=angelegt,
            aktualisiert=aktualisiert, gescheitert=len(gescheitert),
        )
        self._historie_glocke(
            db, lauf, status=status, objekte=len(objekte),
            angelegt=angelegt, aktualisiert=aktualisiert,
            gescheitert=gescheitert,
        )
        return {
            "status": status, "objekte": len(objekte), "angelegt": angelegt,
            "aktualisiert": aktualisiert, "gescheitert": gescheitert,
        }

    def historie_eines_objekts_importieren(
        self, tenant_id: str, property_id: str, *, von: str, bis: str,
    ) -> dict[str, Any]:
        """Ein Objekt importieren — Worker-Weg, Tenant statt `AuthContext`.

        Inhaltlich identisch zu `airbnb_historie_importieren`; nur die Herkunft
        des Tenants unterscheidet sich (Job-Payload statt Sitzung). Der Tenant
        wird beim Einreihen aus dem `AuthContext` gesetzt, nie aus einer
        Anfrage (Wurzel 3).
        """
        db = self._require_db()  # type: ignore[attr-defined]
        prop = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, title, currency, airbnb_listing_id",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        listing_id = str(prop.get("airbnb_listing_id") or "")
        if not listing_id:
            raise ChannelManagerError(
                "Dieses Objekt ist mit keiner Airbnb-Anzeige verknüpft.",
                status_code=422,
            )
        waehrung = str(prop.get("currency") or "").strip()
        if not waehrung:
            # Wurzel 4: keine Buchung ohne echte Währung schreiben, kein „EUR".
            raise ChannelManagerError(
                f"Dem Objekt „{prop.get('title')}“ fehlt die Währung.",
                status_code=422,
            )
        zugang = self._airbnb_token(db, tenant_id, property_id)  # type: ignore[attr-defined]
        if not zugang:
            raise ChannelManagerError(
                "Es ist kein Airbnb-Konto verbunden.", status_code=409
            )
        start, ende = self._zeitraum(von, bis)

        gelesen = self.airbnb_historie_lesen(  # type: ignore[attr-defined]
            zugang[0], listing_id, von=start, bis=ende
        )
        uebernommen = self.airbnb_buchungen_uebernehmen(  # type: ignore[attr-defined]
            db, tenant_id, property_id, gelesen.buchungen, waehrung=waehrung
        )
        return {
            "angelegt": uebernommen.angelegt,
            "aktualisiert": uebernommen.aktualisiert,
            "uebersprungen": uebernommen.uebersprungen,
            "vollstaendig": gelesen.vollstaendig,
        }

    @staticmethod
    def _glocke_fortschritt(
        db: Client, lauf: dict[str, Any], *, fertig: int, gesamt: int,
        objekt: str, buchungen: int,
    ) -> None:
        """Den LAUFENDEN Stand in die Glocke schreiben, nicht erst das Ergebnis.

        Der Betrieb startet den Import und verlässt die Seite — die Glocke ist
        dann der einzige Ort, an dem er sieht, dass etwas passiert. Eine
        Meldung erst am Ende hieße: 20 Minuten lang „Keine Benachrichtigungen",
        obwohl der Import läuft.

        EINE Meldung je Lauf, die fortgeschrieben wird (`dedup_key`), nicht 18
        einzelne — sonst wäre die Glocke nach einem Import zugemüllt. Update
        zuerst, Insert nur wenn nichts getroffen wurde: so entsteht die Zeile
        beim ersten Aufruf und wird danach nur noch aktualisiert.

        Best-effort: eine gescheiterte Meldung darf den Import nicht kippen.
        """
        user_id = lauf.get("gestartet_von")
        if not user_id:
            return
        schluessel = f"airbnb_historie:{lauf['id']}"
        text = (
            f"Objekt {fertig} von {gesamt}"
            + (f" · {objekt}" if objekt else "")
            + f" · {buchungen} Buchungen eingelesen"
        )
        try:
            treffer = (
                db.table("notifications")
                .update({"titel": "Buchungshistorie wird eingelesen",
                         "text": text})
                .eq("user_id", user_id)
                .eq("dedup_key", schluessel)
                .is_("gelesen_am", "null")
                .execute()
            ).data
            if treffer:
                return
            db.table("notifications").insert({
                "tenant_id": lauf["tenant_id"],
                "user_id": user_id,
                "kategorie": "listing_activity",
                "titel": "Buchungshistorie wird eingelesen",
                "text": text,
                "ziel_pfad": "/channels",
                "dedup_key": schluessel,
            }).execute()
        except Exception as exc:  # noqa: BLE001 — Meldung darf den Lauf nicht kippen
            log.warning(
                "airbnb_historie_glocke_fortschritt_fehlgeschlagen",
                lauf_id=str(lauf.get("id")), error=str(exc)[:200],
            )

    @staticmethod
    def _historie_glocke(  # noqa: PLR0913 — eine Meldung mit ihren Zahlen
        db: Client, lauf: dict[str, Any], *, status: str, objekte: int,
        angelegt: int, aktualisiert: int, gescheitert: list[dict[str, str]],
    ) -> None:
        """Das Ergebnis in die Glocke legen.

        Der Betrieb hat den Lauf gestartet und die Seite verlassen — ohne diese
        Meldung erführe er nie, ob er durchlief. Best-effort: eine gescheiterte
        Benachrichtigung darf den fertigen Import nicht als Fehler dastehen
        lassen (Wurzel 5).
        """
        user_id = lauf.get("gestartet_von")
        if not user_id:
            return
        if status == "fertig":
            titel = "Buchungshistorie eingelesen"
            text = (
                f"{objekte} Objekte · {angelegt} neu, {aktualisiert} aktualisiert."
            )
        else:
            namen = ", ".join(g["titel"] for g in gescheitert if g.get("titel"))
            titel = "Buchungshistorie unvollständig"
            text = (
                f"{objekte} Objekte · {angelegt} neu, {aktualisiert} "
                f"aktualisiert. Nicht geschafft: {namen or len(gescheitert)}. "
                "Bitte erneut einlesen."
            )
        # Die Fortschrittsmeldung dieses Laufs wird zur Ergebnismeldung — sie
        # trägt denselben `dedup_key`. Ein Insert daneben ergäbe zwei Zeilen zum
        # selben Lauf, von denen eine für immer „wird eingelesen" behauptet.
        schluessel = f"airbnb_historie:{lauf['id']}"
        try:
            treffer = (
                db.table("notifications")
                .update({"titel": titel, "text": text})
                .eq("user_id", user_id)
                .eq("dedup_key", schluessel)
                .is_("gelesen_am", "null")
                .execute()
            ).data
            if treffer:
                return
            # Keine offene Zeile (der Betrieb hat sie während des Laufs
            # gelesen) → das Ergebnis ist neu und gehört gemeldet.
            db.table("notifications").insert({
                "tenant_id": lauf["tenant_id"],
                "user_id": user_id,
                "kategorie": "listing_activity",
                "titel": titel,
                "text": text,
                "ziel_pfad": "/channels",
                "dedup_key": schluessel,
            }).execute()
        except Exception as exc:  # noqa: BLE001 — Meldung darf den Lauf nicht kippen
            log.warning(
                "airbnb_historie_glocke_fehlgeschlagen",
                lauf_id=str(lauf.get("id")), error=str(exc)[:200],
            )

    @staticmethod
    def airbnb_historie_etappen_plan(von: str, bis: str) -> list[dict[str, str]]:
        """Nur der Plan, ohne einen einzigen Aufruf bei Airbnb.

        Damit kann die Oberfläche sofort sagen „das werden 27 Etappen", während
        der Nutzer noch am Datum dreht.
        """
        try:
            start, ende = date.fromisoformat(von), date.fromisoformat(bis)
        except ValueError as exc:
            raise ChannelManagerError(
                "Bitte Start und Ende als Datum angeben (JJJJ-MM-TT).",
                status_code=422,
            ) from exc
        return [
            {"nummer": str(i), "von": a.isoformat(), "bis": b.isoformat()}
            for i, (a, b) in enumerate(etappen_planen(start, ende), start=1)
        ]


def _jahresverteilung(buchungen: list[dict[str, Any]]) -> dict[str, int]:
    """Buchungen je Anreisejahr — die Tabelle, die der Dialog vorab zeigt."""
    jahre: dict[str, int] = {}
    for b in buchungen:
        jahr = str(b.get("start_date") or "")[:4]
        if jahr:
            jahre[jahr] = jahre.get(jahr, 0) + 1
    return dict(sorted(jahre.items()))
