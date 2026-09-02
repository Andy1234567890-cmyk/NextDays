"""Gratismonat fuer geworbene Betriebe (Partnerprogramm, Master-Strategie 02.09.2026).

Wer ueber den Link oder Code eines Partners kam, bekommt nach den 14 Testtagen
den ersten vollen Monat geschenkt. Umgesetzt als VERLAENGERTE Testphase
(`trial_end` im Checkout), nicht als Gutschein: so entsteht keine 0-Euro-
Rechnung, und die zwoelf Provisionsmonate des Partners beginnen von selbst mit
der ersten echten Zahlung (`affiliates.provision`). Einmalig je Betrieb —
`tenant_subscription.trial_used_at` und UNIQUE tenant_id der Zuordnung sind die
Riegel (Wurzel 2).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from .schemas import TESTPHASE_TAGE

if TYPE_CHECKING:
    from supabase import Client


def gratismonat_ende(start: datetime) -> datetime:
    """Ende der verlaengerten Testphase: 14 Tage Test PLUS ein voller
    Kalendermonat (31.01. + 1 Monat = 28./29.02., wie `provision.plus_monate`)."""
    nach_test = start + timedelta(days=TESTPHASE_TAGE)
    monat0 = nach_test.month  # naechster Monat, 0-basiert
    jahr = nach_test.year + monat0 // 12
    monat = monat0 % 12 + 1
    if monat == 12:
        letzter = 31
    else:
        letzter = (datetime(jahr, monat + 1, 1, tzinfo=UTC) - timedelta(days=1)).day
    return nach_test.replace(year=jahr, month=monat, day=min(nach_test.day, letzter))


def partner_gratismonat_offen(db: Client, tenant_id: str) -> bool:
    """Steht dem Betrieb der Gratismonat zu? Ja, wenn eine Partner-Zuordnung
    (`affiliate_referrals`, 0517) besteht, die nicht abgelehnt ist. Eine
    angehaltene (`held`) Zuordnung reicht: der Anreiz gilt dem Betrieb, die
    Betrugspruefung betrifft die Provision des Partners. Fail-closed: kein
    Datensatz → kein Gratismonat."""
    rows = (
        db.table("affiliate_referrals")
        .select("status")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    return bool(rows) and rows[0].get("status") != "rejected"
