"""Auszahlungen an Betriebe — Ledger, Verrechnung, Auszahlungslauf.

MODELL (Booking.com): Die Plattform hält das Geld bis zur ABREISE. Ein Storno
wird VERRECHNET, nicht vom Bankkonto des Betriebs zurückgeholt.

Scope-Regel (Wurzel 3): Die service_role umgeht RLS, deshalb wird jeder
lesende Zugriff explizit auf den tenant_id aus dem Token gescopet.
"""
from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.payments import stripe_client as sc

from .faelligkeit import (
    FaelligkeitFehler,
    berechne_aufteilung,
    faellig_ab,
    transfer_group,
    verrechne,
)
from .schemas import (
    PayoutAdjustmentRow,
    PayoutOverview,
    PayoutRow,
    PayoutSettings,
    PayoutSettingsUpdate,
    PayoutSummary,
)

log = get_logger("nextdays.payouts")

# Standard-Rhythmus, wenn ein Betrieb nichts eingestellt hat. Wöchentlich wie
# bei Booking — nicht geraten, sondern der dokumentierte Branchenstandard.
STANDARD_INTERVALL = "weekly"

# Obergrenze je Auszahlungslauf. Ohne Deckel könnte ein Rückstand tausende
# Transfers in einem Durchlauf auslösen (Wurzel 8).
MAX_JE_LAUF = 200


class PayoutsError(Exception):
    """Fachlicher Fehler des Auszahlungs-Slices."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class PayoutsService:
    """Auszahlungs-Ledger und -lauf."""

    def __init__(self, db: Client) -> None:
        self._db = db

    # --- Hilfen ------------------------------------------------------------

    def _tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise PayoutsError("Kein Betrieb im Token.", status_code=403)
        return ctx.tenant_id

    def _intervall(self, tenant_id: str) -> str:
        rows = (
            self._db.table("payout_settings")
            .select("interval, paused")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        return rows[0]["interval"] if rows else STANDARD_INTERVALL

    def _pausiert(self, tenant_id: str) -> bool:
        rows = (
            self._db.table("payout_settings")
            .select("paused")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        return bool(rows[0]["paused"]) if rows else False

    def _steuerangaben_fehlen(self, tenant_id: str) -> bool:
        """Steht für diesen Betrieb ein Einbehalt nach § 23 PStTG?

        Import lokal, um einen Zyklus payouts ↔ taxpayer zu vermeiden: der
        taxpayer-Slice liest seinerseits Objekte und Rechnungsprofil.
        """
        from src.features.taxpayer.enforcement import (  # noqa: PLC0415
            TaxpayerEnforcement,
        )

        return TaxpayerEnforcement(self._db).zahlungen_einbehalten(tenant_id)

    # --- Ledger: Zeile anlegen ---------------------------------------------

    def plane_auszahlung(
        self,
        *,
        reservation_id: str,
        tenant_id: str,
        brutto_cents: int,
        plattform_cents: int,
        spende_cents: int,
        cohost_cents: int,
        currency: str,
        checked_out_at: datetime | None,
        check_out: date | None,
        source_charge_id: str | None = None,
    ) -> None:
        """Auszahlungszeile für eine bezahlte Buchung anlegen.

        Idempotent (Wurzel 2): Ein zweiter Aufruf für dieselbe Buchung
        aktualisiert die bestehende Zeile, statt eine zweite anzulegen. Der
        UNIQUE-Index auf reservation_id ist der Backstop.

        Beträge werden EINGEFROREN: Ändert der Betrieb später seinen
        Spendenanteil, verschiebt das keine bereits geplante Auszahlung.
        """
        try:
            aufteilung = berechne_aufteilung(
                brutto_cents=brutto_cents,
                plattform_cents=plattform_cents,
                spende_cents=spende_cents,
                cohost_cents=cohost_cents,
            )
            faellig = faellig_ab(
                checked_out_at=checked_out_at,
                check_out=check_out,
                intervall=self._intervall(tenant_id),
            )
        except FaelligkeitFehler as exc:
            raise PayoutsError(
                exc.message, status_code=exc.status_code
            ) from exc

        self._db.table("payouts").upsert(
            {
                "tenant_id": tenant_id,
                "reservation_id": reservation_id,
                "gross_amount_cents": aufteilung.brutto_cents,
                "platform_fee_cents": aufteilung.plattform_cents,
                "donation_cents": aufteilung.spende_cents,
                "cohost_cents": aufteilung.cohost_cents,
                "net_amount_cents": aufteilung.netto_cents,
                "currency": currency,
                "status": "scheduled",
                "source_charge_id": source_charge_id,
                # Herkunft festhalten (0220): Entstand die Zeile, während der
                # Charge das Geld noch sofort weiterreichte, darf sie NIE
                # ausgezahlt werden — auch nicht, nachdem das Flag umgelegt
                # wurde. Der Flag-Zustand allein sagt nichts über Altzeilen.
                "charge_modell": (
                    "separate"
                    if get_settings().stripe_separate_transfers
                    else "destination"
                ),
                "due_at": faellig.isoformat(),
                "updated_at": "now()",
            },
            on_conflict="reservation_id",
        ).execute()
        log.info(
            "payout_scheduled",
            reservation_id=reservation_id,
            net_cents=aufteilung.netto_cents,
            due_at=faellig.isoformat(),
        )

    # --- Gegenzustand (Wurzel 1) -------------------------------------------

    def storniere(self, reservation_id: str) -> None:
        """Storno VOR der Auszahlung: Zeile auf 'withheld', kein Geld bewegt.

        Nur aus noch nicht ausgezahlten Zuständen — eine bereits ausgezahlte
        Zeile darf nicht still verschwinden, dafür gibt es ``verrechne_storno``.
        """
        self._db.table("payouts").update(
            {"status": "withheld", "updated_at": "now()"}
        ).eq("reservation_id", reservation_id).in_(
            "status", ["scheduled", "due", "held", "failed"]
        ).execute()

    def transfer_zu_buchung(self, reservation_id: str) -> dict[str, Any] | None:
        """Auszahlungszeile einer Buchung — für die Frage: ist Geld schon raus?

        ``stripe_transfer_id`` gesetzt = der Betrieb hat es bereits. Das
        entscheidet beim Storno, ob zurückgeholt oder nur gestoppt wird.
        """
        rows = (
            self._db.table("payouts")
            .select("id, status, stripe_transfer_id, currency, net_amount_cents")
            .eq("reservation_id", reservation_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def verrechne_storno(
        self,
        *,
        reservation_id: str,
        tenant_id: str,
        betrag_cents: int,
        currency: str,
        kind: str = "refund",
    ) -> None:
        """Storno NACH der Auszahlung: Verrechnungsposten anlegen.

        DER KERN DES MODELLS. Airbnb: der Betrag "wird von den nächsten
        Auszahlungen einbehalten". Kein Rückholen vom Bankkonto — das scheitert,
        sobald der Betrieb das Geld abgehoben hat.
        """
        if betrag_cents <= 0:
            return
        # Wurzel 2: Refund-Pfad UND charge.refunded-Webhook laufen beide hier
        # durch, dazu Retries. Ohne Guard entstünden zwei Forderungen über
        # denselben Betrag und der Betrieb würde doppelt gekürzt. Ein
        # vorhandener offener Posten gleicher Art wird deshalb wiederverwendet.
        vorhanden = (
            self._db.table("payout_adjustments")
            .select("id, amount_cents, settled_cents")
            .eq("reservation_id", reservation_id)
            .eq("kind", kind)
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            log.info(
                "payout_adjustment_exists",
                reservation_id=reservation_id,
                kind=kind,
                vorhanden_cents=vorhanden[0].get("amount_cents"),
            )
            return
        self._db.table("payout_adjustments").insert(
            {
                "tenant_id": tenant_id,
                "reservation_id": reservation_id,
                "kind": kind,
                "amount_cents": betrag_cents,
                "currency": currency,
            }
        ).execute()
        log.info(
            "payout_adjustment_created",
            reservation_id=reservation_id,
            amount_cents=betrag_cents,
            kind=kind,
        )

    def halte_zurueck(
        self,
        *,
        payout_id: str,
        reason: str,
        expires_at: datetime,
        note: str | None = None,
    ) -> None:
        """Auszahlung zurückhalten (Airbnb: bis 45 Tage bei Prüfung).

        Schützt davor, Geld auszuzahlen, das kurz darauf zurückgebucht wird.
        """
        self._db.table("payout_holds").insert(
            {
                "payout_id": payout_id,
                "reason": reason,
                "expires_at": expires_at.isoformat(),
                "note": note,
            }
        ).execute()
        self._db.table("payouts").update(
            {"status": "held", "updated_at": "now()"}
        ).eq("id", payout_id).execute()
        log.info("payout_held", payout_id=payout_id, reason=reason)

    # --- Auszahlungslauf ---------------------------------------------------

    def _offene_posten(self, tenant_id: str, currency: str) -> list[dict[str, Any]]:
        """Noch nicht verrechnete Posten eines Betriebs in einer Währung.

        Währungsrein: Ein EUR-Posten darf keine DKK-Auszahlung mindern — das
        wäre eine geratene Umrechnung (Wurzel 4).
        """
        rows = (
            self._db.table("payout_adjustments")
            .select("id, amount_cents, settled_cents")
            .eq("tenant_id", tenant_id)
            .eq("currency", currency)
            .order("created_at")
            .execute()
        ).data or []
        return [r for r in rows if int(r["settled_cents"]) < int(r["amount_cents"])]

    def _verrechne_posten(
        self, posten: list[dict[str, Any]], betrag_cents: int, payout_id: str
    ) -> int:
        """Posten der Reihe nach abarbeiten. Gibt den verrechneten Betrag zurück."""
        rest = betrag_cents
        verrechnet_gesamt = 0
        for p in posten:
            if rest <= 0:
                break
            offen = int(p["amount_cents"]) - int(p["settled_cents"])
            nimm = min(offen, rest)
            self._db.table("payout_adjustments").update(
                {
                    "settled_cents": int(p["settled_cents"]) + nimm,
                    "settled_payout_id": payout_id,
                    "updated_at": "now()",
                }
            ).eq("id", p["id"]).execute()
            rest -= nimm
            verrechnet_gesamt += nimm
        return verrechnet_gesamt

    def _ziel_konto(self, tenant_id: str) -> str | None:
        rows = (
            self._db.table("tenant_billing_profile")
            .select("stripe_account_id, stripe_payouts_enabled")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            return None
        if not rows[0].get("stripe_payouts_enabled"):
            return None
        return rows[0].get("stripe_account_id")

    def fuehre_lauf_aus(self, *, jetzt: datetime | None = None) -> dict[str, int]:
        """Alle fälligen Auszahlungen abarbeiten.

        Ablauf je Zeile: offene Verrechnungsposten abziehen → Rest transferieren.
        Bleibt nach der Verrechnung nichts übrig, gilt die Zeile als erledigt,
        ohne dass Geld fließt.

        Fehler einer Zeile isolieren den Rest nicht (Wurzel 5): Sie wird auf
        'failed' gesetzt und beim nächsten Lauf erneut versucht.
        """
        jetzt = jetzt or datetime.now(UTC)
        faellige = (
            self._db.table("payouts")
            .select(
                "id, tenant_id, reservation_id, net_amount_cents, currency,"
                " status, source_charge_id, charge_modell"
            )
            .in_("status", ["scheduled", "due", "failed"])
            # Nur Zeilen, deren Geld wirklich noch bei uns liegt (0220).
            # Altzeilen aus der Destination-Charge-Welt bleiben als Beleg
            # stehen und werden nie ausgezahlt.
            .eq("charge_modell", "separate")
            .lte("due_at", jetzt.isoformat())
            .order("due_at")
            .limit(MAX_JE_LAUF)
            .execute()
        ).data or []

        bilanz = {"geprueft": len(faellige), "ausgezahlt": 0,
                  "verrechnet": 0, "uebersprungen": 0, "fehler": 0}

        for zeile in faellige:
            try:
                if self._verarbeite_zeile(zeile):
                    bilanz["ausgezahlt"] += 1
                else:
                    bilanz["verrechnet"] += 1
            except _Uebersprungen:
                bilanz["uebersprungen"] += 1
            except Exception as exc:  # noqa: BLE001 — je Zeile isolieren
                bilanz["fehler"] += 1
                self._merke_fehler(zeile["id"], str(exc)[:300])

        log.info("payout_run_finished", **bilanz)
        return bilanz

    def _verarbeite_zeile(self, zeile: dict[str, Any]) -> bool:
        """Eine fällige Zeile abarbeiten. True = Geld geflossen."""
        tenant_id = zeile["tenant_id"]

        # ZWEI SPERREN gegen dieselbe Gefahr: doppelt auszahlen.
        #
        # Bei einer Destination Charge (transfer_data.destination) ist das Geld
        # BEREITS beim Betrieb — Stripe transferiert es unmittelbar nach dem
        # Charge. Ein Transfer aus diesem Lauf wäre die ZWEITE Zahlung
        # derselben Buchung, zu Lasten des Plattform-Saldos:
        #   Marktplatz  1000 → 920 (Charge) + 920 (hier)  = 920 Verlust
        #   PMS         1000 → 1000 (Charge) + 1000 (hier) = 1000 Verlust
        #
        # 1. JE ZEILE (0220): Was unter dem alten Modell entstand, wird nie
        #    ausgezahlt — auch nicht nach dem Umlegen des Flags. Das ist der
        #    eigentliche Schutz, denn der Flag-Zustand sagt nichts über die
        #    Herkunft einer Altzeile.
        # 2. GLOBAL: Solange der Charge überhaupt noch weiterreicht, steht der
        #    Lauf ganz still (fail-closed, Wurzel 5).
        #
        # Zeilen bleiben dabei liegen — die Fälligkeit bleibt erhalten, es geht
        # nichts verloren, es fließt nur nichts doppelt.
        if zeile.get("charge_modell") != "separate":
            raise _Uebersprungen
        if not self._trennt_charge_und_transfer():
            raise _Uebersprungen

        if self._pausiert(tenant_id):
            raise _Uebersprungen

        # § 23 PStTG (DAC7): Fehlen die Steuerangaben nach zwei Erinnerungen und
        # Ablauf der Frist, MUSS die Plattform die Vergütung einbehalten — das
        # Unterlassen ist bußgeldbewehrt (§ 25 Abs. 1 Nr. 6, bis 30.000 EUR).
        # Gewählt ist der Einbehalt (Satz 2 Nr. 2), nicht die Kontosperre
        # (Nr. 1) — das ist das Airbnb-Modell und trifft nur den säumigen
        # Betrieb. Die Zeile bleibt liegen und wird ausgezahlt, sobald die
        # Angaben vorliegen; § 23 Satz 3 macht diese Aufhebung zur Pflicht.
        if self._steuerangaben_fehlen(tenant_id):
            raise _Uebersprungen

        konto = self._ziel_konto(tenant_id)
        if not konto:
            # Kein abrechnungsfähiges Konto: nicht als Fehler werten, sondern
            # liegen lassen — der Betrieb muss erst sein Konto einrichten.
            raise _Uebersprungen

        currency = zeile["currency"]
        netto = int(zeile["net_amount_cents"])

        posten = self._offene_posten(tenant_id, currency)
        offen_gesamt = sum(
            int(p["amount_cents"]) - int(p["settled_cents"]) for p in posten
        )
        auszahlbar, _ = verrechne(
            netto_cents=netto, offene_posten_cents=offen_gesamt
        )
        if posten:
            self._verrechne_posten(posten, netto - auszahlbar, zeile["id"])

        if auszahlbar <= 0:
            # Vollständig verrechnet — kein Transfer, Zeile ist erledigt.
            self._db.table("payouts").update(
                {"status": "paid", "paid_at": "now()", "updated_at": "now()"}
            ).eq("id", zeile["id"]).execute()
            log.info("payout_fully_offset", payout_id=zeile["id"])
            return False

        # WÄHRUNG DES TRANSFERS ≠ WÄHRUNG DER BUCHUNG.
        #
        # Stripe rechnet eingehende Zahlungen in die Saldo-Währung der
        # Plattform um (bei uns DKK, weil das Plattformkonto dänisch ist) —
        # live nachgewiesen: Eine 500-EUR-Zahlung landete als 3737,32 DKK zum
        # Kurs 7,47464 im Saldo. Ein Transfer MUSS deshalb in der
        # Saldo-Währung laufen; ein EUR-Transfer scheitert selbst mit
        # source_transaction ("currency of source_transaction's balance
        # transaction (dkk) must be the same").
        #
        # Der umgerechnete Betrag kommt aus der Balance-Transaktion des
        # Charges — nie selbst umrechnen, das wäre ein geratener Kurs
        # (Wurzel 4). Der Betrieb bekommt sein Geld dann in DKK; Stripe
        # rechnet bei der Auszahlung auf sein Bankkonto erneut um.
        charge_id = zeile.get("source_charge_id")
        betrag, waehrung = self._in_saldo_waehrung(
            charge_id=charge_id,
            betrag_cents=auszahlbar,
            netto_cents=int(zeile["net_amount_cents"]),
            currency=currency,
        )
        transfer = sc.create_transfer(
            amount_cents=betrag,
            currency=waehrung,
            destination_acct=konto,
            # Dieselbe Klammer, die der Charge trägt — sonst findet die
            # Zuordnung Charge↔Transfer in Stripe nicht statt.
            transfer_group=transfer_group(zeile["reservation_id"]),
            # Bindet den Transfer an den konkreten Zahlungseingang: Stripe
            # wartet auf dessen Verfügbarkeit, statt am freien Saldo zu
            # scheitern.
            source_transaction=charge_id,
            metadata={
                "payout_id": zeile["id"],
                "reservation_id": zeile["reservation_id"],
            },
            # Wurzel 2: Ein Retry mit gleichem Key liefert denselben Transfer
            # zurück, statt ein zweites Mal auszuzahlen.
            idempotency_key=f"payout-{zeile['id']}",
        )
        self._db.table("payouts").update(
            {
                "status": "paid",
                "paid_at": "now()",
                "stripe_transfer_id": transfer["id"],
                "last_error": None,
                "updated_at": "now()",
            }
        ).eq("id", zeile["id"]).execute()
        log.info(
            "payout_paid",
            payout_id=zeile["id"],
            amount_cents=auszahlbar,
            transfer_id=transfer["id"],
        )
        return True

    @staticmethod
    def _trennt_charge_und_transfer() -> bool:
        """Läuft der Zahlungspfad auf Separate Charges (Geld liegt bei uns)?

        Nur dann darf dieser Lauf transferieren. Bei Destination Charges hat der
        Betrieb sein Geld schon aus dem Charge — ein Transfer hier wäre eine
        zweite Zahlung derselben Buchung.
        """
        return get_settings().stripe_separate_transfers

    def _in_saldo_waehrung(
        self,
        *,
        charge_id: str | None,
        betrag_cents: int,
        netto_cents: int,
        currency: str,
    ) -> tuple[int, str]:
        """Auszahlungsbetrag in der Saldo-Währung der Plattform.

        Stripe schreibt eingehende Zahlungen in der Plattform-Währung gut und
        rechnet dabei selbst um. Der Transfer muss in derselben Währung laufen.

        Der Kurs kommt AUS der Balance-Transaktion des Charges, nie aus einer
        eigenen Umrechnung (Wurzel 4) — ein selbst geschätzter Kurs würde je
        Buchung Cent-Beträge verschieben.

        Ohne Charge-Bezug (Altzeilen) bleibt es bei der Buchungswährung: Dann
        entscheidet Stripe beim Transfer, und bei fehlender Deckung schlägt er
        klar fehl, statt still einen falschen Betrag zu senden.
        """
        if not charge_id:
            return betrag_cents, currency

        try:
            charge = sc.retrieve_charge(charge_id)
        except Exception as exc:  # noqa: BLE001 — Transfer soll trotzdem laufen
            log.warning(
                "charge_lookup_failed", charge_id=charge_id, error=str(exc)[:150]
            )
            return betrag_cents, currency

        gutschrift = charge.get("balance_amount")
        saldo_waehrung = charge.get("balance_currency")
        if not gutschrift or not saldo_waehrung:
            return betrag_cents, currency
        if saldo_waehrung.lower() == currency.lower():
            return betrag_cents, currency

        # Anteilig: Der Betrieb bekommt denselben Anteil der Gutschrift, den
        # seine Auszahlung am Nettobetrag der Buchung hat. Abrunden zugunsten
        # der Plattform — aufgerundet könnte die Summe die Gutschrift
        # übersteigen und der Transfer scheitern.
        if netto_cents <= 0:
            return betrag_cents, currency
        umgerechnet = int(gutschrift) * betrag_cents // netto_cents
        log.info(
            "payout_currency_converted",
            von=f"{betrag_cents} {currency}",
            nach=f"{umgerechnet} {saldo_waehrung}",
        )
        return umgerechnet, str(saldo_waehrung)

    def _merke_fehler(self, payout_id: str, fehler: str) -> None:
        self._db.table("payouts").update(
            {"status": "failed", "last_error": fehler, "updated_at": "now()"}
        ).eq("id", payout_id).execute()
        log.warning("payout_failed", payout_id=payout_id, error=fehler)

    def gib_holds_frei(self, *, jetzt: datetime | None = None) -> int:
        """Abgelaufene Zurückhaltungen freigeben (Airbnb: max. 45 Tage).

        Ohne diesen Schritt bliebe Geld unbegrenzt liegen.
        """
        jetzt = jetzt or datetime.now(UTC)
        abgelaufen = (
            self._db.table("payout_holds")
            .select("id, payout_id")
            .is_("released_at", "null")
            .lte("expires_at", jetzt.isoformat())
            .execute()
        ).data or []
        for h in abgelaufen:
            self._db.table("payout_holds").update(
                {"released_at": "now()"}
            ).eq("id", h["id"]).execute()
            self._db.table("payouts").update(
                {"status": "due", "updated_at": "now()"}
            ).eq("id", h["payout_id"]).eq("status", "held").execute()
        if abgelaufen:
            log.info("payout_holds_released", anzahl=len(abgelaufen))
        return len(abgelaufen)

    # --- Lesen -------------------------------------------------------------

    def settings(self, ctx: AuthContext) -> PayoutSettings:
        tenant_id = self._tenant(ctx)
        rows = (
            self._db.table("payout_settings")
            .select("interval, paused, paused_reason")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            return PayoutSettings(interval=STANDARD_INTERVALL)
        return PayoutSettings(**rows[0])

    def update_settings(
        self, ctx: AuthContext, req: PayoutSettingsUpdate
    ) -> PayoutSettings:
        """Auszahlungsrhythmus ändern (Booking: Partner wählt selbst)."""
        tenant_id = self._tenant(ctx)
        self._db.table("payout_settings").upsert(
            {
                "tenant_id": tenant_id,
                "interval": req.interval,
                "updated_at": "now()",
            },
            on_conflict="tenant_id",
        ).execute()
        log.info(
            "payout_settings_updated", tenant_id=tenant_id, interval=req.interval
        )
        return self.settings(ctx)

    def overview(self, ctx: AuthContext, *, limit: int = 25) -> PayoutOverview:
        """Auszahlungsübersicht des eigenen Betriebs."""
        tenant_id = self._tenant(ctx)
        limit = max(1, min(limit, 100))  # harte Obergrenze (Wurzel 8)

        zeilen = (
            self._db.table("payouts")
            .select(
                "id, reservation_id, gross_amount_cents, platform_fee_cents,"
                " donation_cents, cohost_cents, net_amount_cents, currency,"
                " status, due_at, paid_at"
            )
            .eq("tenant_id", tenant_id)
            .order("due_at", desc=True)
            .limit(limit)
            .execute()
        ).data or []

        posten = (
            self._db.table("payout_adjustments")
            .select(
                "id, reservation_id, kind, amount_cents, settled_cents,"
                " currency, note, created_at"
            )
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        ).data or []

        # Summen je Währung: was kommt noch, was ist geflossen.
        alle = (
            self._db.table("payouts")
            .select("currency, net_amount_cents, status")
            .eq("tenant_id", tenant_id)
            .in_("status", ["scheduled", "due", "held", "paid"])
            .execute()
        ).data or []
        je_waehrung: dict[str, dict[str, int]] = {}
        for r in alle:
            cur = r["currency"]
            eintrag = je_waehrung.setdefault(
                cur, {"offen": 0, "ausgezahlt": 0, "anzahl": 0}
            )
            betrag = int(r["net_amount_cents"])
            if r["status"] == "paid":
                eintrag["ausgezahlt"] += betrag
            else:
                eintrag["offen"] += betrag
            eintrag["anzahl"] += 1

        return PayoutOverview(
            settings=self.settings(ctx),
            summary=[
                PayoutSummary(
                    currency=cur,
                    pending_amount_cents=v["offen"],
                    paid_amount_cents=v["ausgezahlt"],
                    count=v["anzahl"],
                )
                for cur, v in sorted(je_waehrung.items())
            ],
            recent=[PayoutRow(**z) for z in zeilen],
            adjustments=[PayoutAdjustmentRow(**p) for p in posten],
        )


class _Uebersprungen(Exception):
    """Zeile wird in diesem Lauf nicht bearbeitet (kein Fehler)."""
