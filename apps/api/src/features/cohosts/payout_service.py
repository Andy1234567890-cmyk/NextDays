"""Beteiligungen von Co-Gastgebern erfassen und auszahlen.

ZWEI GETRENNTE SCHRITTE — bewusst, weil sie zu unterschiedlichen Zeitpunkten
passieren und unterschiedlich scheitern dürfen:

  1. ERFASSEN (``record_for_reservation``) — sofort beim Zahlungseingang.
     Rechnet die Aufteilung aus und legt cohost_payouts-Zeilen an. Rein
     buchhalterisch, kein Geld bewegt sich. Scheitert das, stimmt die
     Buchhaltung nicht — der Aufrufer muss es merken.

  2. AUSZAHLEN (``pay_pending``) — wenn das Geld verfügbar ist. Erzeugt je
     Zeile einen Stripe-Transfer. Scheitert einer, blockiert er die anderen
     nicht; der Fehler landet an der Zeile und der nächste Lauf versucht es
     erneut.

Warum überhaupt Transfers: Der bisherige Pfad ist eine Destination Charge, die
laut Stripe nur EIN verbundenes Konto bedienen kann. Für Gastgeber UND
Co-Gastgeber braucht es separate Transfers vom Plattform-Saldo, geklammert
über ``transfer_group`` (= Reservierungs-ID).
"""
from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger
from src.features.payments import stripe_client as sc
from src.features.payouts.faelligkeit import transfer_group

from .payouts import Aufteilung, BeteiligungFehler, berechne_aufteilung

log = get_logger("nextdays.cohost_payouts")

# Höchstzahl der Zeilen, die ein Lauf auszahlt. Ohne Deckel könnte ein
# Rückstand den Request unbegrenzt lange laufen lassen (Wurzel 8).
_MAX_JE_LAUF = 100


class PayoutService:
    def __init__(self, db: Client) -> None:
        self._db = db

    # -- 1. Erfassen --------------------------------------------------------

    def record_for_reservation(
        self,
        *,
        reservation_id: str,
        tenant_id: str,
        property_id: str,
        brutto_cents: int,
        currency: str,
        plattform_bps: int,
    ) -> Aufteilung:
        """Beteiligungen einer Buchung festhalten.

        Idempotent (Wurzel 2): Bestehende Zeilen werden per UNIQUE
        (reservation_id, user_id) nicht dupliziert. Bereits AUSGEZAHLTE Zeilen
        bleiben unangetastet — eine nachträgliche Änderung der Vereinbarung
        darf geflossenes Geld nicht rückwirkend umdeuten (Wurzel 1).
        """
        vereinbarungen = (
            self._db.table("property_cohosts")
            .select("id, user_id, share_kind, share_bps, share_fixed_cents, "
                    "share_currency")
            .eq("property_id", property_id)
            .eq("status", "active")
            .neq("share_kind", "none")
            .execute()
        ).data or []

        aufteilung = berechne_aufteilung(
            brutto_cents=brutto_cents,
            plattform_bps=plattform_bps,
            vereinbarungen=vereinbarungen,
            currency=currency,
        )
        if not aufteilung.cohosts:
            return aufteilung

        # Bereits ausgezahlte Zeilen ausklammern: Ihr Betrag steht fest.
        bezahlt = {
            r["user_id"]
            for r in (
                self._db.table("cohost_payouts")
                .select("user_id")
                .eq("reservation_id", reservation_id)
                .neq("status", "pending")
                .execute()
            ).data or []
        }

        zeilen = [
            {
                "tenant_id": tenant_id,
                "reservation_id": reservation_id,
                "cohost_id": b.cohost_id,
                "user_id": b.user_id,
                "share_kind": b.share_kind,
                "share_bps": b.share_bps,
                "gross_amount_cents": brutto_cents,
                "payout_amount_cents": b.betrag_cents,
                "currency": currency,
                "status": "pending",
                # Dieselbe Klammer wie Charge und Gastgeber-Transfer — die
                # nackte ID würde eine eigene Gruppe aufmachen und die
                # Zuordnung in Stripe zerreißen.
                "transfer_group": transfer_group(reservation_id),
            }
            for b in aufteilung.cohosts
            if b.user_id not in bezahlt
        ]
        if zeilen:
            self._db.table("cohost_payouts").upsert(
                zeilen, on_conflict="reservation_id,user_id"
            ).execute()
            log.info(
                "cohost_payouts_recorded",
                reservation_id=reservation_id,
                anzahl=len(zeilen),
            )
        return aufteilung

    def cancel_for_reservation(self, reservation_id: str) -> None:
        """Storno: offene Beteiligungen entfernen (Gegenzustand, Wurzel 1).

        Bereits ausgezahlte Zeilen bleiben stehen — das Geld ist geflossen und
        muss über ``reverse`` zurückgeholt werden, nicht durch Löschen der
        Buchführung.
        """
        self._db.table("cohost_payouts").update(
            {"status": "cancelled", "updated_at": datetime.now(UTC).isoformat()}
        ).eq("reservation_id", reservation_id).eq("status", "pending").execute()

    # -- 2. Auszahlen -------------------------------------------------------

    def pay_pending(
        self, *, reservation_id: str, charge_id: str | None = None
    ) -> int:
        """Offene Beteiligungen einer Buchung per Stripe-Transfer auszahlen.

        Gibt die Anzahl erfolgreicher Transfers zurück. Ein Fehler an einer
        Zeile stoppt die übrigen NICHT: Ein Co-Gastgeber ohne fertiges
        Stripe-Konto darf die Auszahlung der anderen nicht blockieren. Der
        Grund landet in last_error und ist damit sichtbar, statt still zu
        verschwinden (Wurzel 5).
        """
        # DIESELBE SPERRE WIE IM AUSZAHLUNGSLAUF (payouts/service.py).
        #
        # Bei einer Destination Charge geht der VOLLE Betrag an den Gastgeber —
        # der Co-Gastgeber-Anteil steckt NICHT in der application_fee, sondern
        # wird vom Gastgeber-Anteil abgezogen (cohosts/payouts.py). Ein Transfer
        # hier käme also zusätzlich aus dem PLATTFORM-Saldo, während der
        # Gastgeber denselben Anteil bereits hat: Verlust = Co-Gastgeber-Anteil,
        # bei jeder Buchung mit Beteiligung.
        #
        # Erst wenn der Charge das Geld nicht mehr sofort weiterreicht, darf
        # hier transferiert werden (fail-closed, Wurzel 5).
        if not get_settings().stripe_separate_transfers:
            return 0

        offen = (
            self._db.table("cohost_payouts")
            .select("*")
            .eq("reservation_id", reservation_id)
            .eq("status", "pending")
            .limit(_MAX_JE_LAUF)
            .execute()
        ).data or []
        if not offen:
            return 0

        konten = self._konten_von({r["user_id"] for r in offen})
        erfolge = 0
        for zeile in offen:
            konto = konten.get(zeile["user_id"])
            if not konto or not konto.get("payouts_enabled"):
                self._merke_fehler(
                    zeile["id"],
                    "Stripe-Konto des Co-Gastgebers ist nicht auszahlungsbereit.",
                )
                continue
            try:
                transfer = sc.create_transfer(
                    amount_cents=int(zeile["payout_amount_cents"]),
                    currency=zeile["currency"],
                    destination_acct=konto["stripe_account_id"],
                    transfer_group=(
                        zeile.get("transfer_group") or transfer_group(reservation_id)
                    ),
                    source_transaction=charge_id,
                    metadata={
                        "reservation_id": reservation_id,
                        "cohost_payout_id": zeile["id"],
                    },
                    # Deterministischer Key: Ein Retry erzeugt bei Stripe
                    # denselben Transfer statt einer zweiten Auszahlung.
                    idempotency_key=f"cohost-payout-{zeile['id']}",
                )
            except Exception as exc:  # noqa: BLE001 — Zeile markieren, weiter
                # Bewusst breit: Netzfehler, Stripe-Fehler, Saldo-Probleme —
                # alle führen zum selben Ergebnis (diese Zeile bleibt offen).
                # Der Hauptpfad darf davon nicht kippen; der nächste Lauf
                # versucht es erneut.
                log.warning(
                    "cohost_transfer_failed",
                    payout_id=zeile["id"],
                    error=str(exc)[:200],
                )
                self._merke_fehler(zeile["id"], str(exc)[:500])
                continue

            self._db.table("cohost_payouts").update(
                {
                    "status": "paid",
                    "stripe_transfer_id": transfer["id"],
                    "paid_at": datetime.now(UTC).isoformat(),
                    "last_error": None,
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            ).eq("id", zeile["id"]).eq("status", "pending").execute()
            erfolge += 1

        if erfolge:
            log.info(
                "cohost_payouts_paid",
                reservation_id=reservation_id,
                anzahl=erfolge,
            )
        return erfolge

    def reverse_for_reservation(self, reservation_id: str) -> int:
        """Ausgezahlte Beteiligungen zurückholen (Storno nach Auszahlung).

        Gegenzustand zu pay_pending (Wurzel 1): Wird eine Buchung nach der
        Auszahlung storniert, muss das Geld zurück — sonst trägt der Gastgeber
        die Erstattung allein, obwohl der Co-Gastgeber seinen Anteil behält.
        """
        bezahlt = (
            self._db.table("cohost_payouts")
            .select("id, stripe_transfer_id, payout_amount_cents")
            .eq("reservation_id", reservation_id)
            .eq("status", "paid")
            .not_.is_("stripe_transfer_id", "null")
            .execute()
        ).data or []
        erfolge = 0
        for zeile in bezahlt:
            try:
                sc.reverse_transfer(
                    zeile["stripe_transfer_id"],
                    idempotency_key=f"cohost-reverse-{zeile['id']}",
                )
            except Exception as exc:  # noqa: BLE001 — Zeile markieren, weiter
                log.warning(
                    "cohost_reversal_failed",
                    payout_id=zeile["id"],
                    error=str(exc)[:200],
                )
                self._merke_fehler(zeile["id"], f"Rückbuchung: {str(exc)[:400]}")
                continue
            self._db.table("cohost_payouts").update(
                {
                    "status": "cancelled",
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            ).eq("id", zeile["id"]).execute()
            erfolge += 1
        return erfolge

    # -- Hilfen -------------------------------------------------------------

    def _konten_von(self, user_ids: set[str]) -> dict[str, dict]:
        if not user_ids:
            return {}
        rows = (
            self._db.table("cohost_stripe_accounts")
            .select("user_id, stripe_account_id, payouts_enabled")
            .in_("user_id", list(user_ids))
            .execute()
        ).data or []
        return {r["user_id"]: r for r in rows}

    def _merke_fehler(self, payout_id: str, fehler: str) -> None:
        """Fehlergrund an der Zeile festhalten. Best-effort — schlägt auch das
        fehl, steht der Grund im Log."""
        try:
            self._db.table("cohost_payouts").update(
                {"last_error": fehler, "updated_at": datetime.now(UTC).isoformat()}
            ).eq("id", payout_id).execute()
        except Exception as exc:  # noqa: BLE001 — Diagnose darf nie kippen
            log.warning("cohost_payout_error_write_failed", error=str(exc)[:200])


__all__ = ["BeteiligungFehler", "PayoutService"]
