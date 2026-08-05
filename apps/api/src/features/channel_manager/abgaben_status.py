"""Welche Abgabe kommt bei welchem verbundenen Portal WIRKLICH an?

Speist den Hinweis „Manuelle Synchronisierung" an einer Gebühr/Steuer — im
Branchenstandard ein Chip mit dem Logo des betroffenen Portals direkt am Posten
(live abgelesen 03.08.2026: „kr 2835 · Manuelle Synchronisierung [B]" an einem
Aufenthaltspreis). Die Aussage ist: *dieses Portal bekommt den Posten NICHT
automatisch, dort muss er im Extranet gepflegt werden.*

Der Wert wird NICHT gepflegt und nicht geschätzt, sondern aus derselben Quelle
gerechnet, aus der auch der Sync sendet (`ota_abgaben.abgaben_je_portal`). Ein
eigener Regelsatz für die Anzeige wäre eine zweite Wahrheit, die genau dann
auseinanderläuft, wenn es darauf ankommt: der Chip sagte „geht raus", und der
Sync ließe den Posten weg.

Drei Zustände je Posten × Portal, bewusst getrennt:

* `manual_portals` — verbunden, nicht ausgeschlossen, aber die Regeln des
  Portals lassen den Posten nicht durch (Booking.com nimmt keine festen Beträge,
  Airbnbs Export-Matrix kennt die Kombination nicht, Expedia nimmt gar nichts).
  Das ist der Chip.
* `restricted_portals` — der Betrieb hat den Posten selbst auf andere Kanäle
  eingeschränkt (`portalScope`). Kein Mangel, sondern die Absicht; dafür trägt
  die Zeile schon das Kennzeichen „eingeschränkt".
* `internal_only` — der Posten geht an KEIN Portal, weil er intern gedacht ist
  (optionale Gebühr: der Gast könnte sie beim Portal nicht abwählen). Auch das
  ist Absicht und kein fehlender Sync.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext
from src.core.supabase import load_scoped
from src.features.properties.gebuehren import fee_category

from .airbnb_aktionen import DISCOUNT_TYPE_LOS, regel_fuer_airbnb
from .common import ChannelManagerError, log
from .ota_abgaben import AIRBNB, NICHT_EXPORTIERBAR, Abgabe, abgaben_je_portal
from .ota_aktionen import per_tagespreis_uebertragbar
from .tax_regime import STANDARD

# --- Preis-Blöcke, die keine Gebühr und keine Steuer sind -------------------
#
# Der Branchenstandard schreibt in JEDEN Editor der Preise-Seite eine Kopfzeile
# „Gilt für <Portal-Logos> · Nicht unterstützt von <Portal-Logos>" (live
# abgelesen 04.08.2026, Lodgify `/pricing/<id>`: im Kurzaufenthalts-Editor stand
# „Gilt für [Lodgify][Airbnb] | Nicht unterstützt von [Booking.com]"). Ohne sie
# sieht jede Eingabe gleich verbindlich aus — auch die, die kein Portal je sieht.
#
# Ob ein Block bei den Portalen ankommt, ist KEINE Einschätzung: es steht in
# unserem eigenen Sync-Code. Hier die Belegstelle je Block, damit der Chip nicht
# zur zweiten Wahrheit wird (dieselbe Regel wie bei Gebühren/Steuern oben):
#
#   base_price   → `ari_push`: der Tagespreis geht an jeden verbundenen Kanal.
#   extra_guest  → `content_sync._rate_plan_options`: ein Aufschlag > 0 macht den
#                  Rate-Plan `per_person` mit einer Option je Belegung.
#   short_stay   → NICHTS sendet ihn. Der Aufschlag hängt an der Aufenthalts-
#                  LÄNGE; ein Tagespreis kennt sie nicht, und Channex hat für
#                  „nur bei kurzen Aufenthalten" keine `logic`.
#   addons       → `property_addons.appears_in` kennt genau drei Flächen
#                  (booking_engine/guest_portal/checkin) — alle drei sind unsere
#                  eigenen, kein Portal.
#
# LÄNGENPREISE stehen NICHT in dieser Tabelle: sie gehen sehr wohl an die Portale
# (Airbnbs `STAYED_AT_LEAST_X_DAYS`, airbnb_aktionen.py) und werden deshalb wie
# eine Aktion behandelt — mit echter Rechnung je Zeile, weil der abgeleitete
# Prozentsatz vom Grundpreis abhängt und beim Abrunden auf 0 landen kann.
BLOECKE_AN_PORTALE = ("base_price", "extra_guest")
BLOECKE_NUR_EIGENE = ("short_stay", "addons")


def _block(schluessel: str, *, kind: str, intern: bool) -> dict[str, Any]:
    """Ein Preis-Block in derselben Form wie ein Gebühren-/Steuer-Posten.

    Bewusst dieselbe Form: die Oberfläche hat für die drei Zustände schon eine
    Darstellung, und ein zweiter Antwort-Typ für dieselbe Frage („wohin geht
    das?") wäre eine Abzweigung, die auseinanderläuft.
    """
    return {
        "key": schluessel,
        "kind": kind,
        # Ein Block wird nie „von Hand im Extranet gepflegt": entweder trägt ihn
        # der Sync (dann ist nichts zu tun) oder er ist für die eigenen Kanäle
        # gedacht (dann ist `internal_only` die richtige Aussage). Ein
        # `manual_portals`-Chip würde hier zu „trag es bei Booking.com nach",
        # wo es bei Booking.com kein Feld dafür gibt.
        "manual_portals": [],
        "restricted_portals": [],
        "internal_only": intern,
    }


def laengenpreis_mechanik(portale: list[str]) -> dict[str, Any]:
    """Was der WEG für Längenpreise kann, unabhängig von einer konkreten Zeile.

    Gebraucht für die Kopfzeile im Editor: dort steht die Zeile noch nicht (ein
    neuer Wochenpreis hat keine Kennung), die Frage „wohin geht das?" ist aber
    genau dann interessant. Die Antwort ist keine Schätzung, sondern der Weg
    selbst: Airbnb hat für einen Längenrabatt eine Regel
    (`STAYED_AT_LEAST_X_DAYS`), jedes andere Portal nicht — dort muss der
    Wochenpreis im Extranet gepflegt werden. Ob es bei DIESER Zeile auch bei
    Airbnb klappt, sagt ihr eigener Posten (`_aktionen_status`): der abgeleitete
    Prozentsatz kann beim Abrunden auf 0 landen.
    """
    return {
        "key": "length_prices",
        "kind": "block",
        "manual_portals": sorted(p for p in portale if p != AIRBNB),
        "restricted_portals": [],
        "internal_only": False,
    }


# Die Richtlinien-Blöcke der Objektseite. Sie sind KEINE Preisposten, aber die
# Oberfläche stellt an ihnen dieselbe Frage („wohin geht das?") und soll dafür
# nicht eine zweite Wahrheit führen.
#
# Belegt in `docs/OTA/Airbnb/Booking Settings Airbnb.pdf`: Airbnb nimmt diese
# drei Angaben über `PUT channels/{id}/execute/update_booking_setting` —
# `check_in_time_start`/`check_in_time_end`/`check_out_time`,
# `instant_booking_allowed_category` und `cancellation_policy_settings`.
# Live gegengeprüft am 05.08.2026 an `GET v2/booking_settings/{id}` (Konto
# AirSmil, Objekt 020): genau diese Felder kommen von dort auch zurück.
#
# Jedes ANDERE Portal hat für dieselben Angaben kein Feld in unserem Sync-Weg →
# `manual_portals` (im Extranet pflegen), nicht `restricted`. Der Unterschied
# zählt: „gesperrt" heißt „der Betrieb hat es ausgeschlossen", hier ist es aber
# die Grenze des Portals.
RICHTLINIEN_BLOECKE = ("check_in_out", "bookability", "cancellation")


def richtlinien_status(portale: list[str]) -> list[dict[str, Any]]:
    """Reichweite der Richtlinien-Blöcke (Check-in/out, Buchbarkeit, Storno)."""
    andere = sorted(p for p in portale if p != AIRBNB)
    return [
        {
            "key": schluessel,
            "kind": "block",
            "manual_portals": andere,
            "restricted_portals": [],
            "internal_only": False,
        }
        for schluessel in RICHTLINIEN_BLOECKE
    ]


def preisblock_status() -> list[dict[str, Any]]:
    """Reichweite der Preis-Blöcke eines Objekts (Grundpreis, Aufschläge …).

    Rein aus der Sync-FÄHIGKEIT abgeleitet und deshalb ohne Argumente: anders
    als bei Gebühren und Steuern entscheidet hier keine Portal-Matrix und kein
    Feld des Postens mit, weil kein Portal für diese Blöcke ein eigenes Feld hat.
    Ein Schlüssel je BLOCK, nicht je Zeile — alle Längenpreise eines Objekts
    haben dieselbe Reichweite, und ein neuer (noch nicht gespeicherter) hätte
    sonst gar keine.
    """
    return [
        _block(key, kind="block", intern=False) for key in BLOECKE_AN_PORTALE
    ] + [_block(key, kind="block", intern=True) for key in BLOECKE_NUR_EIGENE]


def _exportiert(posten: list[Abgabe], *, schluessel: str, kategorie: str | None) -> bool:
    """Steckt der Posten in dem, was dieses Portal bekommt?

    Bei Airbnb werden Gebühren derselben Kategorie zu EINER zusammengefasst; der
    gesendete Posten trägt dann nicht die Gebühren-ID, sondern `cat:<kategorie>`
    (siehe `ota_abgaben._airbnb_gebuehren`). Ohne diesen zweiten Schlüssel würde
    jede summierte Gebühr als „nicht übertragen" gemeldet — der Chip stünde
    genau an den Gebühren, die sehr wohl rausgehen.
    """
    schluessel_menge = {a.schluessel for a in posten}
    if schluessel in schluessel_menge:
        return True
    return kategorie is not None and f"cat:{kategorie}" in schluessel_menge


class AbgabenStatusMixin:
    """Lesender Sync-Stand der Abgaben eines Objekts. Mixin des Service."""

    def abgaben_status(
        self, ctx: AuthContext, property_id: str
    ) -> dict[str, Any]:
        """Je Gebühr/Steuer: welche verbundenen Portale bekommen sie nicht?

        Rein lesend, KEIN Channex-Schreibcall — die Frage wird aus dem Preis-Blob
        und den Kanal-Einstellungen gerechnet.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        prop = load_scoped(
            db,
            "properties",
            property_id,
            tenant_id,
            columns="id, currency, type_attributes",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        pricing = (prop.get("type_attributes") or {}).get("pricing") or {}
        taxes = [t for t in (pricing.get("taxes") or []) if isinstance(t, dict)]
        fees = [f for f in (pricing.get("fees") or []) if isinstance(f, dict)]
        currency = str(prop.get("currency") or "").upper()

        portale = self._verbundene_portale(db, tenant_id, property_id)
        antwort: dict[str, Any] = {
            # Ohne Objektwährung überträgt der Steuer-Sync überhaupt nichts (er
            # wirft 422). Das ist EIN Befund über das Objekt, nicht 20 Chips an
            # den Posten — die Oberfläche sagt es deshalb einmal.
            "currency_missing": not currency,
            "portals": portale,
            "items": [],
        }
        if not portale or not currency:
            antwort["items"] = [
                self._posten_status(eintrag, kind, portale=[], nicht_gesendet={})
                for kind, liste in (("fee", fees), ("tax", taxes))
                for eintrag in liste
            ] + preisblock_status() + [laengenpreis_mechanik([])] + richtlinien_status([])
            return antwort

        regime = self.regime_je_portal(db, tenant_id, property_id)  # type: ignore[attr-defined]
        airbnb_erlaubt = self._airbnb_steuern_erlaubt(  # type: ignore[attr-defined]
            db, tenant_id, property_id
        )
        # Portal → Menge der Schlüssel, die dieses Portal NICHT bekommt.
        nicht_gesendet: dict[str, set[str]] = {}
        for portal in portale:
            reg = regime.get(portal, STANDARD)
            posten, _diagnose = abgaben_je_portal(
                portal=portal,
                taxes=taxes,
                fees=fees,
                currency=currency,
                objekt_inklusiv_erlaubt=reg.senden,
                airbnb_steuern_erlaubt=airbnb_erlaubt,
            )
            fehlt: set[str] = set()
            for fee in fees:
                schluessel = str(fee.get("id") or "")
                if schluessel and not _exportiert(
                    posten, schluessel=schluessel, kategorie=fee_category(fee)
                ):
                    fehlt.add(schluessel)
            for tax in taxes:
                schluessel = str(tax.get("id") or "")
                if schluessel and not _exportiert(
                    posten, schluessel=schluessel, kategorie=None
                ):
                    fehlt.add(schluessel)
            nicht_gesendet[portal] = fehlt

        antwort["items"] = [
            self._posten_status(
                eintrag, kind, portale=portale, nicht_gesendet=nicht_gesendet
            )
            for kind, liste in (("fee", fees), ("tax", taxes))
            for eintrag in liste
        ] + self._aktionen_status(db, tenant_id, property_id, portale)
        antwort["items"] += (
            preisblock_status()
            + [laengenpreis_mechanik(portale)]
            + richtlinien_status(portale)
        )
        return antwort

    def _aktionen_status(
        self, db: Client, tenant_id: str, property_id: str, portale: list[str]
    ) -> list[dict[str, Any]]:
        """Aktionen UND Längenpreise: welche Portale bekommen sie nicht?

        Es gibt zwei Wege zu den Portalen, und der Chip muss beide kennen:

        * **Tagespreis** — trägt JEDES Portal, aber nur Bedingungen, die sich am
          einzelnen Tag entscheiden lassen (Aufenthaltsdaten, keine Bedingung).
        * **Airbnbs eigene Rabattregeln** — tragen Mindestaufenthalt, Frühbucher
          und Last Minute, aber nur bei Airbnb und nur innerhalb der
          Airbnb-Grenzen (airbnb_aktionen.py).

        Was keiner der beiden Wege tragen kann (Angebotscode, Buchungszeitraum,
        Pauschale, zwei Bedingungen in einer Aktion), muss im Extranet des
        Portals gepflegt werden — das ist der Chip.

        LÄNGENPREISE laufen hier mit, weil sie derselbe Fall sind: ein Wochenpreis
        IST ein Längenrabatt und geht als `STAYED_AT_LEAST_X_DAYS` an Airbnb. Sie
        werden dafür in dieselbe Form gebracht (`laengenpreise_des_objekts`) —
        dieselbe Rechnung wie im Push, damit der Chip nicht „geht raus" behauptet,
        wo der Push den Prozentsatz auf 0 abrundet und nichts sendet.
        """
        try:
            rows = (
                db.table("property_discounts")
                # ALLE Felder, die `regel_fuer_airbnb` liest — sonst sieht sie
                # z. B. `discount_bps = 0` und meldet „nur ganze Prozent
                # möglich" für JEDE Aktion mit Bedingung. Der Chip schickte den
                # Betrieb dann ins Extranet, obwohl Airbnb die Regel bekommt.
                # Ein Stub-Test kann das nicht finden (er ignoriert die
                # Spaltenliste) — gefunden hat es der E2E-Lauf.
                .select(
                    "id, discount_type, discount_kind, discount_bps, "
                    "discount_amount, min_nights, lead_min_days, lead_max_days, "
                    "stay_ranges, booked_from, booked_to, promo_codes, "
                    "portal_scope, active"
                )
                .eq("tenant_id", tenant_id)
                .eq("property_id", property_id)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — kein Status ist besser als ein falscher
            log.warning(
                "aktionen_status_nicht_ladbar",
                property_id=property_id, error=str(exc)[:200],
            )
            return []
        # Längenpreise als Aktions-Zeilen anhängen. Schlägt das Laden fehl, bleibt
        # es bei den Aktionen — ein fehlender Chip ist besser als ein falscher.
        try:
            rows = rows + self.laengenpreise_des_objekts(  # type: ignore[attr-defined]
                db, tenant_id, property_id
            )
        except Exception as exc:  # noqa: BLE001 — siehe oben
            log.warning(
                "laengenpreise_status_nicht_ladbar",
                property_id=property_id, error=str(exc)[:200],
            )
        out: list[dict[str, Any]] = []
        for regel in rows:
            scope = {str(x) for x in (regel.get("portal_scope") or [])}
            restricted = sorted(p for p in portale if scope and p not in scope)
            uebertragbar, grund = per_tagespreis_uebertragbar(regel)
            # Eine Pauschale lässt sich nicht auf Nächte verteilen, ohne die
            # Aufenthaltsdauer zu raten — beim Push kennt sie niemand.
            if uebertragbar and str(regel.get("discount_kind") or "percent") != "percent":
                uebertragbar, grund = False, "pauschalbetrag"
            # Was der Tagespreis nicht kann, kann bei Airbnb noch die eigene
            # Rabattregel. Das Preismodell des Listings steht nur bei Channex —
            # hier wird der Standardfall angenommen (rein lesende Antwort, kein
            # Channex-Call); der Push protokolliert die Abweichung.
            airbnb_regel, airbnb_grund = (
                (None, None) if uebertragbar else regel_fuer_airbnb(regel)
            )
            manual = (
                []
                if uebertragbar or not regel.get("active")
                else [
                    p
                    for p in portale
                    if p not in restricted
                    and not (p == AIRBNB and airbnb_regel is not None)
                ]
            )
            out.append(
                {
                    "key": str(regel.get("id") or ""),
                    # Die Oberfläche unterscheidet die beiden Listen — ein
                    # Längenpreis ist keine Aktion, auch wenn er denselben Weg
                    # zum Portal nimmt.
                    "kind": (
                        "length_price"
                        if str(regel.get("discount_type") or "") == DISCOUNT_TYPE_LOS
                        else "promotion"
                    ),
                    "manual_portals": manual,
                    "restricted_portals": restricted,
                    # Eine INAKTIVE Aktion geht nirgends hin — das ist Absicht und
                    # kein fehlender Sync.
                    "internal_only": not regel.get("active"),
                    "reason": grund,
                    "airbnb_reason": airbnb_grund,
                }
            )
        return out

    @staticmethod
    def _posten_status(
        eintrag: dict[str, Any],
        kind: str,
        *,
        portale: list[str],
        nicht_gesendet: dict[str, set[str]],
    ) -> dict[str, Any]:
        """Ein Posten, in die drei getrennten Zustände aufgeteilt."""
        schluessel = str(eintrag.get("id") or "")
        scope = {str(x) for x in (eintrag.get("portalScope") or [])}
        # Nur eine Gebühr kann „intern gedacht" sein: `optional` heißt, der Gast
        # wählt sie ab — beim Portal könnte er das nicht; `shortStayOnly` kennt
        # keine Channex-`logic`, unbedingt gesendet würde sie JEDEM Portal-Gast
        # berechnet (ota_abgaben). Die Kaution ist der dritte Fall: Channex kennt
        # kein Kautions-Objekt.
        internal_only = kind == "fee" and (
            bool(eintrag.get("optional"))
            or bool(eintrag.get("shortStayOnly"))
            or fee_category(eintrag) in NICHT_EXPORTIERBAR
        )
        restricted = sorted(p for p in portale if scope and p not in scope)
        manual = (
            []
            if internal_only
            else sorted(
                p
                for p in portale
                if p not in restricted and schluessel in nicht_gesendet.get(p, set())
            )
        )
        return {
            "key": schluessel,
            "kind": kind,
            "manual_portals": manual,
            "restricted_portals": restricted,
            "internal_only": internal_only,
        }

    @staticmethod
    def _verbundene_portale(db: Client, tenant_id: str, property_id: str) -> list[str]:
        """Aktive Portal-Verbindungen des Objekts.

        Nur AKTIVE: eine abgeschaltete Verbindung sendet nichts, ein Chip „muss
        dort manuell gepflegt werden" wäre für sie irreführend. Fehlt die Liste
        (DB-Aussetzer), kommt eine leere zurück und die Oberfläche zeigt keinen
        Chip — kein geratener Zustand (Wurzel 4).
        """
        rows = (
            db.table("channex_channel_connection")
            .select("ota_portal_code, is_active")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .execute()
        ).data or []
        return sorted(
            {
                str(r["ota_portal_code"])
                for r in rows
                if r.get("ota_portal_code") and r.get("is_active")
            }
        )
