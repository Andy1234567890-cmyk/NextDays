"""Spenden-Service: Einstellung lesen/setzen, Ledger je Buchung, Übersicht.

Scope-Regel (Wurzel 3): Die service_role umgeht RLS, deshalb wird JEDER Zugriff
explizit auf den tenant_id aus dem Token gescopet — nie auf eine ID aus dem
Request-Body.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .berechnung import (
    MAX_SHARE_BPS,
    Spende,
    SpendeFehler,
    berechne_spende,
    pruefe_satz_gegen_verpflichtungen,
)
from .schemas import (
    DonationOverview,
    DonationRecipient,
    DonationRow,
    DonationSettings,
    DonationSettingsUpdate,
    DonationSummary,
)

log = get_logger("nextdays.donations")


class DonationsError(Exception):
    """Fachlicher Fehler des Spenden-Slices."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class DonationsService:
    """Spendeneinstellung und -ledger eines Betriebs."""

    def __init__(self, db: Client) -> None:
        self._db = db

    # --- Hilfen ------------------------------------------------------------

    def _tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise DonationsError("Kein Betrieb im Token.", status_code=403)
        return ctx.tenant_id

    def _plattform_bps(self, tenant_id: str) -> int:
        """Feste Plattform-Gebühr des Betriebs. Fehlt sie, ist das ein
        Datenfehler — nie einen Satz erfinden (Wurzel 4)."""
        row = (
            self._db.table("tenants")
            .select("platform_fee_bps")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not row:
            raise DonationsError("Betrieb nicht gefunden.", status_code=404)
        bps = row[0].get("platform_fee_bps")
        if bps is None:
            raise DonationsError(
                "Provisions-Satz des Betriebs fehlt.", status_code=422
            )
        return int(bps)

    def _cohost_bps(self, tenant_id: str) -> int:
        """Summe der PROZENTUALEN Co-Gastgeber-Beteiligungen über alle Objekte.

        Maßgeblich ist das Objekt mit der höchsten Summe, nicht die Summe über
        alle Objekte: Die Anteile einer Buchung hängen an genau EINEM Objekt.
        Über alle zu summieren würde den Spendensatz unnötig begrenzen.
        """
        rows = (
            self._db.table("property_cohosts")
            .select("property_id, share_bps")
            .eq("owner_tenant_id", tenant_id)
            .eq("status", "active")
            .eq("share_kind", "percent")
            .execute()
        ).data or []
        if not rows:
            return 0
        je_objekt: dict[str, int] = {}
        for r in rows:
            pid = r.get("property_id")
            bps = int(r.get("share_bps") or 0)
            je_objekt[pid] = je_objekt.get(pid, 0) + bps
        return max(je_objekt.values()) if je_objekt else 0

    def _payouts_ready(self, tenant_id: str) -> bool:
        """Ist ein abrechnungsfähiges Auszahlungskonto verbunden?

        Ohne das gibt es keine Auszahlung, von der eine Spende abgehen könnte —
        die UI sperrt dann die Auswahl (wie Airbnb).
        """
        row = (
            self._db.table("tenant_billing_profile")
            .select("stripe_account_id, stripe_charges_enabled")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not row:
            return False
        return bool(row[0].get("stripe_account_id")) and bool(
            row[0].get("stripe_charges_enabled")
        )

    def _settings_row(self, tenant_id: str) -> dict[str, Any] | None:
        rows = (
            self._db.table("tenant_donation_settings")
            .select("share_bps, recipient_id, accepted_at")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        return rows[0] if rows else None

    def _recipient_name(self, recipient_id: str | None) -> str | None:
        if not recipient_id:
            return None
        rows = (
            self._db.table("donation_recipients")
            .select("name")
            .eq("id", recipient_id)
            .limit(1)
            .execute()
        ).data
        return rows[0]["name"] if rows else None

    # --- Lesen -------------------------------------------------------------

    def recipients(self) -> list[DonationRecipient]:
        """Aktive Empfänger (Auswahl in der UI)."""
        rows = (
            self._db.table("donation_recipients")
            .select("id, name, description, website")
            .eq("active", True)
            .order("name")
            .execute()
        ).data or []
        return [DonationRecipient(**r) for r in rows]

    def settings(self, ctx: AuthContext) -> DonationSettings:
        """Aktuelle Spendeneinstellung inkl. echter Obergrenze."""
        tenant_id = self._tenant(ctx)
        row = self._settings_row(tenant_id)
        plattform_bps = self._plattform_bps(tenant_id)
        cohost_bps = self._cohost_bps(tenant_id)
        grenze = max(0, min(MAX_SHARE_BPS, 10000 - plattform_bps - cohost_bps))
        return DonationSettings(
            share_bps=int(row["share_bps"]) if row else 0,
            recipient_id=row.get("recipient_id") if row else None,
            recipient_name=self._recipient_name(
                row.get("recipient_id") if row else None
            ),
            accepted_at=row.get("accepted_at") if row else None,
            max_share_bps=grenze,
            platform_fee_bps=plattform_bps,
            payouts_ready=self._payouts_ready(tenant_id),
        )

    def overview(self, ctx: AuthContext, *, limit: int = 20) -> DonationOverview:
        """Alles, was die Spenden-Ansicht braucht — in einem Aufruf."""
        tenant_id = self._tenant(ctx)
        # Harte Obergrenze auf die Liste (Wurzel 8).
        limit = max(1, min(limit, 100))

        rows = (
            self._db.table("donations")
            .select(
                "id, reservation_id, recipient_id, share_bps, gross_amount_cents,"
                " amount_cents, reversed_amount_cents, currency, status, created_at"
            )
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        ).data or []

        namen = {r.id: r.name for r in self.recipients()}
        recent = [
            DonationRow(**r, recipient_name=namen.get(r["recipient_id"]))
            for r in rows
        ]

        # Summen je Währung. Storniertes zählt nicht als gespendet — sonst
        # zeigte die Übersicht Geld an, das nie geflossen ist (Wurzel 1).
        alle = (
            self._db.table("donations")
            .select("currency, amount_cents, reversed_amount_cents")
            .eq("tenant_id", tenant_id)
            .in_("status", ["collected", "paid_out"])
            .execute()
        ).data or []
        je_waehrung: dict[str, DonationSummary] = {}
        for r in alle:
            cur = r["currency"]
            eintrag = je_waehrung.get(cur) or DonationSummary(
                currency=cur, total_amount_cents=0, reversed_amount_cents=0, count=0
            )
            je_waehrung[cur] = DonationSummary(
                currency=cur,
                total_amount_cents=eintrag.total_amount_cents + int(r["amount_cents"]),
                reversed_amount_cents=eintrag.reversed_amount_cents
                + int(r["reversed_amount_cents"] or 0),
                count=eintrag.count + 1,
            )

        return DonationOverview(
            settings=self.settings(ctx),
            recipients=self.recipients(),
            summary=sorted(je_waehrung.values(), key=lambda s: s.currency),
            recent=recent,
        )

    # --- Schreiben ---------------------------------------------------------

    def update_settings(
        self, ctx: AuthContext, req: DonationSettingsUpdate
    ) -> DonationSettings:
        """Spendenanteil festlegen. Fail-closed bei jeder Unstimmigkeit."""
        tenant_id = self._tenant(ctx)

        if req.share_bps > 0:
            if not req.recipient_id:
                raise DonationsError(
                    "Bitte eine Organisation auswählen.", status_code=422
                )
            # Empfänger MUSS existieren und aktiv sein — nie eine ID aus dem
            # Request ungeprüft speichern (Wurzel 3).
            gueltig = (
                self._db.table("donation_recipients")
                .select("id")
                .eq("id", req.recipient_id)
                .eq("active", True)
                .limit(1)
                .execute()
            ).data
            if not gueltig:
                raise DonationsError(
                    "Diese Organisation ist nicht verfügbar.", status_code=422
                )
            if not req.accept_terms:
                raise DonationsError(
                    "Bitte den Spendenbedingungen zustimmen.", status_code=422
                )
            if not self._payouts_ready(tenant_id):
                raise DonationsError(
                    "Zuerst ein Auszahlungskonto verbinden — ohne Auszahlung "
                    "kann keine Spende abgehen.",
                    status_code=409,
                )
            try:
                pruefe_satz_gegen_verpflichtungen(
                    share_bps=req.share_bps,
                    plattform_bps=self._plattform_bps(tenant_id),
                    cohost_bps=self._cohost_bps(tenant_id),
                )
            except SpendeFehler as exc:
                raise DonationsError(
                    exc.message, status_code=exc.status_code
                ) from exc

        payload: dict[str, Any] = {
            "tenant_id": tenant_id,
            "share_bps": req.share_bps,
            "updated_at": "now()",
        }
        if req.share_bps > 0:
            payload["recipient_id"] = req.recipient_id
            payload["accepted_at"] = "now()"
        else:
            # Satz auf 0: Empfänger bleibt stehen (der Gastgeber schaltet oft
            # nur vorübergehend ab), die Zustimmung wird zurückgenommen.
            bestehend = self._settings_row(tenant_id)
            if bestehend and bestehend.get("recipient_id"):
                payload["recipient_id"] = bestehend["recipient_id"]
            else:
                # Ohne bestehenden Empfänger braucht die NOT-NULL-Spalte einen
                # Wert — den ersten aktiven nehmen. Kein Geldfluss bei 0 bps.
                aktive = self.recipients()
                if not aktive:
                    raise DonationsError(
                        "Kein Spendenempfänger eingerichtet.", status_code=409
                    )
                payload["recipient_id"] = aktive[0].id
            payload["accepted_at"] = None

        self._db.table("tenant_donation_settings").upsert(
            payload, on_conflict="tenant_id"
        ).execute()
        log.info(
            "donation_settings_updated",
            tenant_id=tenant_id,
            share_bps=req.share_bps,
        )
        return self.settings(ctx)

    # --- Ledger (vom Zahlungspfad aufgerufen) ------------------------------

    def spende_fuer_buchung(
        self, tenant_id: str, brutto_cents: int
    ) -> Spende | None:
        """Spendenanteil einer Buchung berechnen — ohne zu schreiben.

        Der Zahlungspfad ruft das VOR dem Charge auf, um den Betrag in die
        application_fee einzurechnen.
        """
        try:
            return berechne_spende(
                brutto_cents=brutto_cents,
                einstellung=self._settings_row(tenant_id),
            )
        except SpendeFehler as exc:
            raise DonationsError(
                exc.message, status_code=exc.status_code
            ) from exc

    def merke_spende(
        self,
        *,
        tenant_id: str,
        reservation_id: str,
        spende: Spende,
        brutto_cents: int,
        currency: str,
    ) -> None:
        """Spendenzeile anlegen (Status pending).

        Idempotent (Wurzel 2): Ein zweiter Aufruf für dieselbe Buchung — durch
        Doppelklick oder Wiederholung — aktualisiert die bestehende Zeile,
        statt eine zweite anzulegen. Der UNIQUE-Index ist der Backstop.
        """
        self._db.table("donations").upsert(
            {
                "tenant_id": tenant_id,
                "reservation_id": reservation_id,
                "recipient_id": spende.recipient_id,
                "share_bps": spende.share_bps,
                "gross_amount_cents": brutto_cents,
                "amount_cents": spende.betrag_cents,
                "currency": currency,
                "status": "pending",
                "updated_at": "now()",
            },
            on_conflict="reservation_id",
        ).execute()

    def markiere_eingesammelt(self, reservation_id: str) -> None:
        """pending → collected, sobald die Zahlung bestätigt ist.

        Status-Guard macht die Webhook-Redelivery idempotent (Wurzel 2).
        """
        self._db.table("donations").update(
            {"status": "collected", "updated_at": "now()"}
        ).eq("reservation_id", reservation_id).eq("status", "pending").execute()

    def markiere_storniert(
        self, reservation_id: str, *, anteil_cents: int | None = None
    ) -> None:
        """Gegenzustand bei Storno/Erstattung (Wurzel 1).

        Ohne ``anteil_cents`` wird die ganze Spende zurückgenommen. Bei einer
        Teilerstattung nur der anteilige Betrag — sonst behielte die Plattform
        Geld für eine Buchung, die es nicht mehr gibt.
        """
        rows = (
            self._db.table("donations")
            .select("id, amount_cents, reversed_amount_cents")
            .eq("reservation_id", reservation_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            return
        zeile = rows[0]
        offen = int(zeile["amount_cents"]) - int(zeile["reversed_amount_cents"] or 0)
        if offen <= 0:
            return
        betrag = offen if anteil_cents is None else min(anteil_cents, offen)
        neu = int(zeile["reversed_amount_cents"] or 0) + betrag
        payload: dict[str, Any] = {
            "reversed_amount_cents": neu,
            "updated_at": "now()",
        }
        # Nur bei VOLLER Rücknahme den Status kippen — eine Teilerstattung
        # lässt die Spende bestehen, nur eben mit geringerem Betrag.
        if neu >= int(zeile["amount_cents"]):
            payload["status"] = "reversed"
        self._db.table("donations").update(payload).eq(
            "id", zeile["id"]
        ).execute()
        log.info(
            "donation_reversed",
            reservation_id=reservation_id,
            amount_cents=betrag,
        )
