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

from .airbnb_aktionen import regel_fuer_airbnb
from .common import ChannelManagerError, log
from .ota_abgaben import AIRBNB, NICHT_EXPORTIERBAR, Abgabe, abgaben_je_portal
from .ota_aktionen import per_tagespreis_uebertragbar
from .tax_regime import STANDARD


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
            ]
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
        return antwort

    def _aktionen_status(
        self, db: Client, tenant_id: str, property_id: str, portale: list[str]
    ) -> list[dict[str, Any]]:
        """Aktionen (property_discounts): welche Portale bekommen sie nicht?

        Es gibt zwei Wege zu den Portalen, und der Chip muss beide kennen:

        * **Tagespreis** — trägt JEDES Portal, aber nur Bedingungen, die sich am
          einzelnen Tag entscheiden lassen (Aufenthaltsdaten, keine Bedingung).
        * **Airbnbs eigene Rabattregeln** — tragen Mindestaufenthalt, Frühbucher
          und Last Minute, aber nur bei Airbnb und nur innerhalb der
          Airbnb-Grenzen (airbnb_aktionen.py).

        Was keiner der beiden Wege tragen kann (Angebotscode, Buchungszeitraum,
        Pauschale, zwei Bedingungen in einer Aktion), muss im Extranet des
        Portals gepflegt werden — das ist der Chip.
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
                    "kind": "promotion",
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
