"""Bilanzstatistik des Eigentümer-Reportings — bezahltes Geld im Zeitverlauf.

Eigenes Modul, weil die Statistik eine ANDERE Frage stellt als der Bericht: der
Bericht fragt „was ist im Zeitraum entstanden", die Statistik „was ist
tatsächlich geflossen". Sie rechnet deshalb über die TEILZAHLUNGEN
(``owner_report_payment_parts``) und nicht über die Zahlungsbeträge — über
Letztere gerechnet zeigte die Kurve Forderungen und hieße trotzdem „gezahltes
Geld".

MISCHWÄHRUNG WIRD NICHT ADDIERT (Wurzel 4): die Auswertung nennt eine
Leitwährung und stellt die übrigen daneben. Eine Summe über DKK und EUR wäre
eine Zahl, die es nicht gibt.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from supabase import Client

from src.core.supabase import fetch_all_rows

from .auswertung import CENT, NULL, d, f
from .schemas import (
    Abschnitt,
    StatistikResponse,
    StatKategorie,
    StatPunkt,
    WaehrungsBetrag,
)

PAYMENT_COLUMNS = (
    "id, tenant_id, report_id, owner_id, currency, summe_unterkunftspreis, "
    "summe_gebuehren, summe_steuern, summe_ausgaben, summe_andere, betrag, "
    "bezahlt_am, notiz, statement_id, created_at, updated_at"
)


class StatistikRechner:
    """Liest Zahlungen + Teilzahlungen und formt daraus die Bilanzstatistik."""

    def __init__(self, service_client: Client) -> None:
        self._db = service_client

    def teilzahlungen(self, payment_ids: list[str]) -> dict[str, Decimal]:
        """Summe der geleisteten Teilzahlungen je Zahlung."""
        if not payment_ids:
            return {}
        rows = fetch_all_rows(
            self._db.table("owner_report_payment_parts")
            .select("id, payment_id, betrag")
            .in_("payment_id", sorted(set(payment_ids)))
            .order("id")
        )
        summen: dict[str, Decimal] = defaultdict(lambda: NULL)
        for r in rows:
            summen[str(r["payment_id"])] += d(r.get("betrag"))
        return dict(summen)


    def statistik(
        self,
        tenant_id: str,
        *,
        von: date,
        bis: date,
        currency: str | None = None,
        owner_ids: list[str] | None = None,
    ) -> StatistikResponse:
        """„Bilanzstatistik": bezahltes Geld im Zeitverlauf + nach Abschnitt.

        Grundlage sind die TEILZAHLUNGEN, nicht die Zahlungsbeträge: die Kurve
        heißt „im Laufe der Zeit gezahltes Geld" und meint tatsächlich geflossenes
        Geld. Über die Zahlungsbeträge gerechnet zeigte sie Forderungen.
        """
        zahlungen = fetch_all_rows(
            self._db.table("owner_report_payments")
            .select(PAYMENT_COLUMNS)
            .eq("tenant_id", tenant_id)
            .order("id")
        )
        if owner_ids:
            erlaubt = set(owner_ids)
            zahlungen = [z for z in zahlungen if str(z["owner_id"]) in erlaubt]
        je_id = {str(z["id"]): z for z in zahlungen}
        if not je_id:
            return StatistikResponse(currency=currency or "", total=0.0)

        # Ohne ausdrückliche Wahl: die Währung mit den meisten Zahlungen. Sie
        # wird BENANNT zurückgegeben und die übrigen stehen getrennt daneben —
        # addiert wird nichts (Wurzel 4).
        haeufigkeit: dict[str, int] = defaultdict(int)
        for z in zahlungen:
            haeufigkeit[str(z["currency"])] += 1
        leit = (currency or max(haeufigkeit, key=lambda c: haeufigkeit[c])).upper()

        parts = fetch_all_rows(
            self._db.table("owner_report_payment_parts")
            .select("payment_id, betrag, currency, bezahlt_am")
            .eq("tenant_id", tenant_id)
            .gte("bezahlt_am", von.isoformat())
            .lte("bezahlt_am", bis.isoformat())
            .order("bezahlt_am")
        )
        monate: dict[str, Decimal] = defaultdict(lambda: NULL)
        andere: dict[str, Decimal] = defaultdict(lambda: NULL)
        total = NULL
        for p in parts:
            if str(p["payment_id"]) not in je_id:
                continue
            betrag = d(p["betrag"])
            if str(p["currency"]).upper() != leit:
                andere[str(p["currency"]).upper()] += betrag
                continue
            monate[str(p["bezahlt_am"])[:7]] += betrag
            total += betrag

        # Kategorien: die Abschnittsanteile der bezahlten Zahlungen. Anteilig
        # nach bezahltem Prozentsatz — eine halb bezahlte Zahlung darf ihre
        # Abschnitte nicht voll zählen.
        teil = self.teilzahlungen(list(je_id))
        kategorien: dict[Abschnitt, Decimal] = {a: NULL for a in Abschnitt}
        for pid, z in je_id.items():
            if str(z["currency"]).upper() != leit:
                continue
            betrag = d(z["betrag"])
            if betrag == 0:
                continue
            anteil = teil.get(pid, NULL) / betrag
            kategorien[Abschnitt.unterkunftspreis] += (
                d(z["summe_unterkunftspreis"]) * anteil
            )
            kategorien[Abschnitt.gebuehren] += d(z["summe_gebuehren"]) * anteil
            kategorien[Abschnitt.steuern] += d(z["summe_steuern"]) * anteil
            kategorien[Abschnitt.ausgaben] += d(z["summe_ausgaben"]) * anteil
            kategorien[Abschnitt.andere] += d(z["summe_andere"]) * anteil

        return StatistikResponse(
            currency=leit,
            total=f(total),
            change_pct=self._veraenderung(tenant_id, leit, von, bis, total, je_id),
            points=[
                StatPunkt(period=m, amount=f(monate[m])) for m in sorted(monate)
            ],
            categories=[
                StatKategorie(abschnitt=a, amount=f(v))
                for a, v in kategorien.items()
                if v != 0
            ],
            other_currencies=[
                WaehrungsBetrag(currency=c, amount=f(v))
                for c, v in sorted(andere.items())
            ],
        )

    def _veraenderung(  # noqa: PLR0913 — Bezugsgrößen der Vorperiode
        self,
        tenant_id: str,
        currency: str,
        von: date,
        bis: date,
        total: Decimal,
        je_id: dict[str, dict[str, Any]],
    ) -> float | None:
        """Veränderung zur gleich langen Vorperiode.

        ``None``, wenn die Vorperiode 0 war: „+100 %" wäre dort eine Aussage
        über nichts — genau der plausibel aussehende Ersatzwert aus Wurzel 4.
        """
        laenge = (bis - von).days + 1
        vor_bis = von - timedelta(days=1)
        vor_von = vor_bis - timedelta(days=laenge - 1)
        parts = fetch_all_rows(
            self._db.table("owner_report_payment_parts")
            .select("payment_id, betrag, currency, bezahlt_am")
            .eq("tenant_id", tenant_id)
            .gte("bezahlt_am", vor_von.isoformat())
            .lte("bezahlt_am", vor_bis.isoformat())
            .order("bezahlt_am")
        )
        vorher = sum(
            (
                d(p["betrag"])
                for p in parts
                if str(p["payment_id"]) in je_id
                and str(p["currency"]).upper() == currency
            ),
            NULL,
        )
        if vorher == 0:
            return None
        return float(
            ((total - vorher) / vorher * 100).quantize(
                CENT, rounding=ROUND_HALF_UP
            )
        )
