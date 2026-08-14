"""Vorläufige Aufstellung eines Provisionsmonats — die Einzelbuchungen.

Eigene Datei nach dem Muster von `provisionsdeckel.py`/`dynpricing.py`: eine
geschlossene Einheit, die `service.py` sonst über die 1500-Zeilen-Grenze
schiebt.

WOZU DIE EINZELPOSTEN:
Die Monatszeile nennt nur eine Summe (im August 2026 live: 62 Buchungen,
1.360,99 DKK). Ein Betrieb, der prüfen will, WORAUS diese Provision entsteht,
hatte bisher keinen Weg dorthin — die Rechnung kommt erst am 1. des
Folgemonats und trägt ebenfalls nur einen Betrag. Diese Aufstellung ist der
Beleg dazu, aufklappbar an der Monatszeile.

WARUM „VORLÄUFIG":
Der Monat ist noch offen. Es können Buchungen hinzukommen, storniert oder
geändert werden, und der Monatsdeckel greift erst beim Fakturieren
(`bill_pending_commissions`) — die Summe hier ist die ENTSTANDENE Provision,
nicht die abgerechnete. Die UI benennt das; ohne diesen Hinweis läse ein
Betrieb die Zwischensumme als Rechnungsbetrag.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from src.core.supabase import fetch_all_rows

from .schemas import CommissionEntry

if TYPE_CHECKING:  # pragma: no cover - nur für die Typprüfung
    from src.core.security import AuthContext


class AufstellungMixin:
    """Die Einzelposten eines Monats.

    Erwartet vom Host (`SubscriptionsService`): `_require(ctx)` → (db, tenant_id).
    """

    def get_commission_entries(
        self, ctx: AuthContext, periode: str
    ) -> list[CommissionEntry]:
        """Die Einzelbuchungen EINES Monats — die vorläufige Aufstellung.

        Dieselbe Periodenlogik wie `get_commission_months`: fakturierte Zeilen
        tragen `period`, offene noch nicht — dort zählt der Monat der
        Erfassung. Beide Wege müssen hier gleich rechnen, sonst zeigte die
        aufgeklappte Liste andere Zeilen, als die Monatssumme zusammenfasst.

        Wurzel 3: `tenant_id` steckt in der Ledger-Abfrage selbst. Die
        Reservierungen werden anschließend NUR über die eingesammelten IDs UND
        denselben Tenant geladen — ein `reservation_id`, das nicht dem Betrieb
        gehört (Datenfehler), zieht so keine fremden Gast- und Objektdaten nach.

        Der Satz kommt aus der ZEILE (`rate`), nicht aus `commission_rate()`:
        der Ledger friert ihn je Buchung ein, und eine spätere Tarifänderung
        darf eine vergangene Abrechnung nicht rückwirkend anders aussehen
        lassen.
        """
        db, tenant_id = self._require(ctx)
        rows = fetch_all_rows(
            db.table("commission_ledger")
            .select(
                "id, reservation_id, channel, currency, gross_amount, rate, "
                "commission_amount, status, period, created_at"
            )
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
        )
        zeilen = [
            r
            for r in rows
            if ((r.get("period") or "")[:7] or str(r.get("created_at") or "")[:7])
            == periode
        ]
        if not zeilen:
            return []

        # Objekt/Gast/Zeitraum in EINER Abfrage nachziehen statt je Zeile.
        res_ids = sorted(
            {str(r["reservation_id"]) for r in zeilen if r.get("reservation_id")}
        )
        details: dict[str, dict[str, Any]] = {}
        if res_ids:
            for res in fetch_all_rows(
                db.table("reservations")
                .select(
                    "id, check_in, check_out, properties(title), guests(name)"
                )
                .eq("tenant_id", tenant_id)
                .in_("id", res_ids)
            ):
                details[str(res["id"])] = res

        eintraege: list[CommissionEntry] = []
        for r in zeilen:
            res = details.get(str(r.get("reservation_id") or "")) or {}
            objekt = res.get("properties") or {}
            gast = res.get("guests") or {}
            eintraege.append(
                CommissionEntry(
                    id=str(r["id"]),
                    channel=str(r.get("channel") or ""),
                    currency=r.get("currency"),
                    gross_amount=round(float(r.get("gross_amount") or 0), 2),
                    rate=float(r.get("rate") or 0),
                    commission_amount=round(
                        float(r.get("commission_amount") or 0), 2
                    ),
                    status=str(r.get("status") or ""),
                    booked_at=str(r.get("created_at") or ""),
                    # Fehlende Reservierung bleibt leer — kein Ersatztext, der
                    # eine Buchung vortäuscht (Wurzel 4).
                    property_title=(
                        str(objekt.get("title"))
                        if isinstance(objekt, dict) and objekt.get("title")
                        else None
                    ),
                    check_in=str(res["check_in"]) if res.get("check_in") else None,
                    check_out=str(res["check_out"]) if res.get("check_out") else None,
                    guest_name=(
                        str(gast.get("name"))
                        if isinstance(gast, dict) and gast.get("name")
                        else None
                    ),
                )
            )
        return eintraege
