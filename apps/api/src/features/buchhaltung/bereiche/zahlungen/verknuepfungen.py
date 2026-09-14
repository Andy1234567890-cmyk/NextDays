"""Verknüpfung Bankumsatz ↔ Beleg und der Zahlungseingang auf der Rechnung.

Die Kette bei einer Rechnung (Wurzel 1 — jeder Schritt hat seinen Gegenzustand
im `delete_link`):
  1. `invoice_payments`-Zeile (Betrag = zugeordneter Teil des Umsatzes, Status
     der Rechnung VORHER in `invoice_status_before`),
  2. `invoices.paid_amount` = Summe aller Zahlungen, `status='paid'` + `paid_at`,
     sobald die Summe den Bruttobetrag erreicht ODER ein Differenzgrund die
     Restsumme erklärt (Skonto, Bankgebühr, Kleinbetrag),
  3. `transaction_links`-Zeile mit id `<tx>_<doc>` (alte Form für den Bestand),
  4. `bank_transactions.link_count`/`linked_amount` hochgezählt.
Beim Lösen: 4 zurück, 3 weg, 1 weg, 2 neu gerechnet (kein Zahlungseingang mehr →
`invoice_status_before`).

Idempotenz (Wurzel 2): ein zweiter POST mit derselben (tx, doc) findet die
bestehende Verknüpfung und liefert sie; der Unique-Index auf
`invoice_payments (transaction_id, invoice_id)` und die PK `<tx>_<doc>` sind
die DB-Backstops. Ein zweites DELETE ist ein No-Op.

Beträge kommen NIE vom Client: der Rechnungsbetrag aus `invoices`, der
Umsatzbetrag aus `bank_transactions`. Der Client sagt nur, WIE VIEL dieses
Umsatzes auf den Beleg soll (Teilzahlung, Sammelüberweisung) und nennt einen
Grund, wenn der Beleg trotz Differenz erledigt sein soll. Währungen müssen
gleich sein — kein Cross-Currency-Match (422).
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Protocol

from postgrest.exceptions import APIError

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .basis import (
    ZahlungenError,
    datum,
    dec,
    ist_fehlende_tabelle,
    ist_unique_verletzung,
    log,
    nicht_gefunden,
    q,
)
from .schemas import (
    MAX_LIMIT,
    BookingAccountRef,
    LegacyLinkCreate,
    SuggestionResponse,
    TransactionLinkCreate,
    TransactionLinkResponse,
)

# Rechnungsstatus, in denen ein Zahlungseingang gebucht werden darf.
OFFENE_RECHNUNGSSTATUS: frozenset[str] = frozenset({"sent", "finalized", "overdue"})
# Kontoart → Zahlungsart der invoice_payments (0644 check).
_ZAHLUNGSART: dict[str, str] = {
    "bank": "bank_transfer",
    "cash": "cash",
    "paypal": "paypal",
    "stripe": "stripe",
    "other": "other",
}
_RECHNUNGS_SPALTEN = (
    "id, invoice_number, customer_id, status, issue_date, due_date, gross_amount, "
    "paid_amount, paid_at, currency, invoice_type, deleted_at"
)
_MAX_VORSCHLAEGE = 10


class _HatDb(Protocol):
    _db: Any

    @staticmethod
    def _tenant(ctx: AuthContext) -> str: ...
    def _umsatz(self, tenant_id: str, transaction_id: str) -> dict: ...
    def _konto(self, tenant_id: str, account_id: str) -> dict: ...


def _doc_typ_normieren(wert: str) -> str:
    """Bestand schickt 'INVOICE'/'EXPENSE' oder 'rechnung'/'gutschrift'/'beleg'."""
    w = (wert or "").strip()
    if w in ("INVOICE", "rechnung", "gutschrift"):
        return "INVOICE"
    if w in ("EXPENSE", "beleg"):
        return "EXPENSE"
    raise ZahlungenError(f"Unbekannter Belegtyp '{wert}'.", status_code=422)


def _erste(row: dict, *schluessel: str) -> object:
    for k in schluessel:
        if row.get(k) not in (None, ""):
            return row[k]
    return None


class VerknuepfungenMixin:
    """Wird in `ZahlungenService` gemischt; nutzt dessen `_db`, `_tenant`,
    `_umsatz`, `_konto`."""

    # ------------------------------------------------------------ Laden
    def _link(self: _HatDb, tenant_id: str, link_id: str) -> dict:
        return load_scoped(
            self._db,
            "transaction_links",
            link_id,
            tenant_id,
            not_found=nicht_gefunden("Verknüpfung"),
        )

    def _link_falls_vorhanden(self: _HatDb, tenant_id: str, link_id: str) -> dict | None:
        rows = (
            self._db.table("transaction_links")
            .select("*")
            .eq("id", link_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _rechnung(self: _HatDb, tenant_id: str, invoice_id: str) -> dict:
        rechnung = load_scoped(
            self._db,
            "invoices",
            invoice_id,
            tenant_id,
            columns=_RECHNUNGS_SPALTEN,
            not_found=nicht_gefunden("Rechnung"),
        )
        if rechnung.get("deleted_at"):
            raise nicht_gefunden("Rechnung")
        return rechnung

    def _kundenname(self: _HatDb, tenant_id: str, customer_id: str | None) -> str:
        if not customer_id:
            return ""
        rows = (
            self._db.table("customers")
            .select("id, name")
            .eq("id", customer_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return str(rows[0].get("name") or "") if rows else ""

    def _ausgabe(self: _HatDb, tenant_id: str, expense_id: str) -> dict:
        """Die Ausgaben-Tabelle entsteht im parallelen Bereich »ausgaben«; gibt
        es sie (noch) nicht, ist das ein klarer 503, kein 500."""
        try:
            return load_scoped(
                self._db, "expenses", expense_id, tenant_id, not_found=nicht_gefunden("Ausgabe")
            )
        except APIError as exc:
            if ist_fehlende_tabelle(exc):
                raise ZahlungenError(
                    "Ausgaben sind noch nicht verfügbar.", status_code=503
                ) from exc
            raise

    # ---------------------------------------------------------- Antwort
    @staticmethod
    def _link_antwort(row: dict) -> TransactionLinkResponse:
        konto = row.get("booking_account")
        return TransactionLinkResponse(
            id=str(row["id"]),
            tenant_id=str(row["tenant_id"]),
            transaction_id=str(row["transaction_id"]),
            document_id=str(
                row.get("invoice_id") or row.get("expense_id") or row.get("cashbook_entry_id") or ""
            ),
            document_type=row["document_type"],
            invoice_id=str(row["invoice_id"]) if row.get("invoice_id") else None,
            expense_id=str(row["expense_id"]) if row.get("expense_id") else None,
            cashbook_entry_id=str(row["cashbook_entry_id"])
            if row.get("cashbook_entry_id")
            else None,
            document_number=str(row.get("document_number") or ""),
            document_date=datum(row.get("document_date")),
            document_amount=dec(row.get("document_amount")),
            customer_name=str(row.get("customer_name") or ""),
            currency=str((row.get("transaction_data") or {}).get("currency") or ""),
            amount_allocated=dec(row.get("amount_allocated")),
            amount_difference=dec(row["amount_difference"])
            if row.get("amount_difference") is not None
            else None,
            amount_difference_reason=row.get("amount_difference_reason"),
            booking_account=BookingAccountRef(**konto)
            if isinstance(konto, dict) and konto.get("id")
            else None,
            booking_status=row.get("booking_status") or "booked",
            booked_at=row.get("booked_at"),
            link_date=row["link_date"],
            created_by=str(row.get("created_by") or ""),
            invoice_payment_id=str(row["invoice_payment_id"])
            if row.get("invoice_payment_id")
            else None,
            transaction_data=row.get("transaction_data") or {},
            document_data=row.get("document_data") or {},
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    # ------------------------------------------------------------ Liste
    def list_links(
        self: _HatDb,
        ctx: AuthContext,
        *,
        transaction_id: str | None = None,
        document_id: str | None = None,
        invoice_id: str | None = None,
        limit: int = 200,
    ) -> list[TransactionLinkResponse]:
        tenant_id = self._tenant(ctx)
        query = (
            self._db.table("transaction_links")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("link_date", desc=True)
            .limit(max(1, min(limit, MAX_LIMIT)))
        )
        if transaction_id:
            query = query.eq("transaction_id", transaction_id)
        if invoice_id:
            query = query.eq("invoice_id", invoice_id)
        if document_id:
            # Der Bestand kennt nur „das Dokument" — Rechnung ODER Ausgabe.
            query = query.or_(f"invoice_id.eq.{document_id},expense_id.eq.{document_id}")
        return [VerknuepfungenMixin._link_antwort(r) for r in query.execute().data or []]

    def get_link(self: _HatDb, ctx: AuthContext, link_id: str) -> TransactionLinkResponse:
        return VerknuepfungenMixin._link_antwort(self._link(self._tenant(ctx), link_id))

    # ---------------------------------------------------------- Anlegen
    def _zahlung_buchen(
        self: _HatDb,
        tenant_id: str,
        *,
        tx: dict,
        konto: dict,
        rechnung: dict,
        betrag: Decimal,
        grund: str | None,
        created_by: str | None,
    ) -> dict:
        """invoice_payments-Zeile + Rechnungsstatus. Liefert die Zahlung."""
        zeile = {
            "tenant_id": tenant_id,
            "invoice_id": rechnung["id"],
            "date": str(tx["booking_date"])[:10],
            "amount": str(betrag),
            "currency": tx["currency"],
            "method": _ZAHLUNGSART.get(str(konto.get("type")), "other"),
            "payment_account_id": konto["id"],
            "transaction_id": tx["id"],
            "note": grund,
            "invoice_status_before": str(rechnung["status"]),
            "created_by": created_by,
        }
        try:
            res = self._db.table("invoice_payments").insert(zeile).execute()
        except APIError as exc:
            if ist_unique_verletzung(exc):
                raise ZahlungenError(
                    "Dieser Umsatz ist mit dieser Rechnung bereits verbucht.", status_code=409
                ) from exc
            raise
        zahlung = (res.data or [None])[0]
        if not zahlung:
            raise ZahlungenError("Zahlung konnte nicht gespeichert werden.", status_code=500)
        self._rechnung_neu_rechnen(
            tenant_id,
            rechnung,
            erledigt_trotz_differenz=bool(grund),
            zahltag=str(tx["booking_date"])[:10],
        )
        log.info(
            "zahlungen_zahlung_gebucht",
            tenant_id=tenant_id,
            invoice_id=rechnung["id"],
            payment_id=zahlung["id"],
            transaction_id=tx["id"],
            amount=str(betrag),
            currency=tx["currency"],
        )
        return zahlung

    def _rechnung_neu_rechnen(
        self: _HatDb,
        tenant_id: str,
        rechnung: dict,
        *,
        erledigt_trotz_differenz: bool,
        zahltag: str | None,
        status_ohne_zahlung: str | None = None,
    ) -> None:
        """`paid_amount` = Summe aller Zahlungen; Status daraus ableiten."""
        zahlungen = (
            self._db.table("invoice_payments")
            .select("amount")
            .eq("tenant_id", tenant_id)
            .eq("invoice_id", rechnung["id"])
            .limit(MAX_LIMIT)
            .execute()
        ).data or []
        summe = q(sum((dec(z.get("amount")) for z in zahlungen), Decimal("0")))
        brutto = dec(rechnung.get("gross_amount"))
        aenderung: dict[str, Any] = {"paid_amount": str(summe)}
        if not zahlungen:
            aenderung["status"] = status_ohne_zahlung or str(rechnung["status"])
            aenderung["paid_at"] = None
        elif (
            (brutto > 0 and summe >= brutto)
            or (brutto < 0 and summe <= brutto)
            or erledigt_trotz_differenz
        ):
            aenderung["status"] = "paid"
            aenderung["paid_at"] = zahltag or datetime.now(UTC).isoformat()
        elif str(rechnung.get("status")) == "paid":
            # Teilrückbuchung von einer voll bezahlten Rechnung: wieder offen.
            aenderung["status"] = status_ohne_zahlung or "sent"
            aenderung["paid_at"] = None
        self._db.table("invoices").update(aenderung).eq("id", rechnung["id"]).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info(
            "zahlungen_rechnung_stand",
            tenant_id=tenant_id,
            invoice_id=rechnung["id"],
            paid_amount=str(summe),
            status=aenderung.get("status", rechnung.get("status")),
        )

    def _umsatz_zaehler(
        self: _HatDb, tenant_id: str, tx: dict, *, delta_anzahl: int, delta_betrag: Decimal
    ) -> None:
        anzahl = max(0, int(tx.get("link_count") or 0) + delta_anzahl)
        betrag = q(dec(tx.get("linked_amount")) + delta_betrag)
        self._db.table("bank_transactions").update(
            {"link_count": anzahl, "linked_amount": str(betrag)}
        ).eq("id", tx["id"]).eq("tenant_id", tenant_id).execute()

    def _zuteilung(
        self, *, verfuegbar: Decimal, offen: Decimal, gewuenscht: Decimal | None
    ) -> Decimal:
        """Betrag (positiv), der von diesem Umsatz auf den Beleg geht."""
        if verfuegbar <= 0:
            raise ZahlungenError(
                "Dieser Umsatz ist bereits vollständig zugeordnet.", status_code=409
            )
        if gewuenscht is None:
            return q(min(verfuegbar, offen)) if offen > 0 else q(verfuegbar)
        betrag = q(abs(gewuenscht))
        if betrag <= 0:
            raise ZahlungenError("Zugeordneter Betrag muss größer als 0 sein.", status_code=422)
        if betrag > verfuegbar:
            raise ZahlungenError(
                f"Nur noch {verfuegbar} dieses Umsatzes sind nicht zugeordnet.", status_code=422
            )
        return betrag

    def _rechnung_verknuepfen(
        self: _HatDb,
        tenant_id: str,
        *,
        tx: dict,
        konto: dict,
        body: TransactionLinkCreate,
        created_by: str | None,
    ) -> tuple[dict, dict | None, str]:
        """→ (Beleg-Felder für die Link-Zeile, Zahlung, gespeicherter document_type)."""
        rechnung = self._rechnung(tenant_id, body.document_id)
        if str(rechnung.get("status")) not in OFFENE_RECHNUNGSSTATUS:
            raise ZahlungenError(
                f"Rechnung ist nicht offen (Status {rechnung.get('status')}).", status_code=422
            )
        if not rechnung.get("currency") or rechnung["currency"] != tx["currency"]:
            raise ZahlungenError(
                f"Währung des Umsatzes ({tx['currency']}) passt nicht zur Rechnung "
                f"({rechnung.get('currency') or '—'}).",
                status_code=422,
            )
        brutto, bezahlt = dec(rechnung.get("gross_amount")), dec(rechnung.get("paid_amount"))
        gutschrift = (rechnung.get("invoice_type") or "invoice") != "invoice" or brutto < 0
        tx_betrag = dec(tx.get("amount"))
        if gutschrift and tx_betrag > 0:
            raise ZahlungenError(
                "Eine Gutschrift wird mit einem AUSGANG verknüpft.", status_code=422
            )
        if not gutschrift and tx_betrag < 0:
            raise ZahlungenError("Eine Rechnung wird mit einem EINGANG verknüpft.", status_code=422)
        offen = q(abs(brutto - bezahlt))
        if offen <= 0:
            raise ZahlungenError("Rechnung ist bereits vollständig bezahlt.", status_code=409)
        verfuegbar = q(abs(tx_betrag - dec(tx.get("linked_amount"))))
        zuteilung = self._zuteilung(
            verfuegbar=verfuegbar, offen=offen, gewuenscht=body.amount_allocated
        )
        differenz = q(offen - zuteilung)
        grund = (body.amount_difference_reason or "").strip() or None
        if differenz < 0 and not grund:
            raise ZahlungenError(
                f"Zuordnung übersteigt den offenen Betrag um {abs(differenz)} — "
                "bitte Grund angeben.",
                status_code=422,
            )
        vorzeichen = Decimal(-1) if gutschrift else Decimal(1)
        zahlung = self._zahlung_buchen(
            tenant_id,
            tx=tx,
            konto=konto,
            rechnung=rechnung,
            betrag=q(zuteilung * vorzeichen),
            grund=grund,
            created_by=created_by,
        )
        beleg = {
            "invoice_id": rechnung["id"],
            "document_number": str(rechnung.get("invoice_number") or ""),
            "document_date": str(rechnung.get("issue_date"))[:10]
            if rechnung.get("issue_date")
            else None,
            "document_amount": str(brutto),
            "customer_name": self._kundenname(tenant_id, rechnung.get("customer_id")),
            "amount_allocated": str(q(zuteilung * vorzeichen)),
            "amount_difference": str(differenz) if differenz != 0 else None,
            "amount_difference_reason": grund,
        }
        return beleg, zahlung, ("gutschrift" if gutschrift else "rechnung")

    def _ausgabe_verknuepfen(
        self: _HatDb, tenant_id: str, *, tx: dict, body: TransactionLinkCreate
    ) -> tuple[dict, None, str]:
        ausgabe = self._ausgabe(tenant_id, body.document_id)
        tx_betrag = dec(tx.get("amount"))
        if tx_betrag > 0:
            raise ZahlungenError("Eine Ausgabe wird mit einem AUSGANG verknüpft.", status_code=422)
        waehrung = _erste(ausgabe, "currency")
        if waehrung and str(waehrung) != tx["currency"]:
            raise ZahlungenError(
                f"Währung des Umsatzes ({tx['currency']}) passt nicht zur Ausgabe ({waehrung}).",
                status_code=422,
            )
        betrag_beleg = q(
            abs(dec(_erste(ausgabe, "gross_amount", "total_amount", "amount", "total")))
        )
        verfuegbar = q(abs(tx_betrag - dec(tx.get("linked_amount"))))
        zuteilung = self._zuteilung(
            verfuegbar=verfuegbar, offen=betrag_beleg, gewuenscht=body.amount_allocated
        )
        differenz = q(betrag_beleg - zuteilung) if betrag_beleg > 0 else Decimal("0")
        grund = (body.amount_difference_reason or "").strip() or None
        beleg = {
            "expense_id": ausgabe["id"],
            "document_number": str(
                _erste(ausgabe, "expense_number", "receipt_number", "number", "invoice_number")
                or ""
            ),
            "document_date": str(_erste(ausgabe, "expense_date", "date", "issue_date") or "")[:10]
            or None,
            "document_amount": str(betrag_beleg),
            "customer_name": str(
                _erste(ausgabe, "supplier_name", "vendor", "vendor_name", "description") or ""
            ),
            "amount_allocated": str(q(-zuteilung)),
            "amount_difference": str(differenz) if differenz != 0 else None,
            "amount_difference_reason": grund,
        }
        return beleg, None, "beleg"

    def create_link(
        self: _HatDb, ctx: AuthContext, body: TransactionLinkCreate
    ) -> TransactionLinkResponse:
        tenant_id = self._tenant(ctx)
        link_id = f"{body.transaction_id}_{body.document_id}"
        bestehend = self._link_falls_vorhanden(tenant_id, link_id)
        if bestehend:
            log.info("zahlungen_link_bereits_vorhanden", tenant_id=tenant_id, link_id=link_id)
            return VerknuepfungenMixin._link_antwort(bestehend)
        tx = self._umsatz(tenant_id, body.transaction_id)
        if tx.get("ignored"):
            raise ZahlungenError(
                "Umsatz ist beiseitegelegt — erst zurückholen, dann zuordnen.", status_code=409
            )
        konto = self._konto(tenant_id, str(tx["payment_account_id"]))
        typ = _doc_typ_normieren(body.document_type)
        if typ == "INVOICE":
            beleg, zahlung, doc_typ = self._rechnung_verknuepfen(
                tenant_id, tx=tx, konto=konto, body=body, created_by=ctx.user_id
            )
        else:
            beleg, zahlung, doc_typ = self._ausgabe_verknuepfen(tenant_id, tx=tx, body=body)

        jetzt = datetime.now(UTC).isoformat()
        zeile = {
            "id": link_id,
            "tenant_id": tenant_id,
            "transaction_id": tx["id"],
            "document_type": doc_typ,
            **beleg,
            "link_date": jetzt,
            "created_by": ctx.user_id or "",
            "booking_status": "booked",
            "booked_at": jetzt,
            "booking_account": body.booking_account.model_dump(by_alias=False)
            if body.booking_account
            else None,
            "transaction_data": {
                "id": str(tx["id"]),
                "name": tx.get("counterpart_name") or "",
                "verwendungszweck": tx.get("purpose") or "",
                "buchungstag": str(tx["booking_date"])[:10],
                "betrag": float(dec(tx.get("amount"))),
                "currency": tx["currency"],
                "accountId": str(tx["payment_account_id"]),
            },
            "document_data": {
                "id": body.document_id,
                "type": doc_typ,
                "number": beleg["document_number"],
                "customerName": beleg["customer_name"],
                "total": float(dec(beleg["document_amount"])),
                "date": beleg["document_date"] or "",
            },
            "invoice_payment_id": zahlung["id"] if zahlung else None,
        }
        try:
            res = self._db.table("transaction_links").insert(zeile).execute()
        except APIError as exc:
            if not ist_unique_verletzung(exc):
                raise
            # Wettlauf zweier Klicks: der andere hat gewonnen — dessen Zustand liefern.
            bestehend = self._link_falls_vorhanden(tenant_id, link_id)
            if bestehend:
                return VerknuepfungenMixin._link_antwort(bestehend)
            raise
        neu = (res.data or [None])[0]
        if not neu:
            raise ZahlungenError("Verknüpfung konnte nicht gespeichert werden.", status_code=500)
        self._umsatz_zaehler(
            tenant_id, tx, delta_anzahl=1, delta_betrag=dec(beleg["amount_allocated"])
        )
        log.info(
            "zahlungen_link_angelegt",
            tenant_id=tenant_id,
            link_id=link_id,
            transaction_id=tx["id"],
            document_type=doc_typ,
            document_id=body.document_id,
            amount_allocated=beleg["amount_allocated"],
            currency=tx["currency"],
        )
        return VerknuepfungenMixin._link_antwort(neu)

    def create_link_legacy(
        self: _HatDb, ctx: AuthContext, body: LegacyLinkCreate
    ) -> TransactionLinkResponse:
        """POST /companies/{id}/transaction-links des Bestands: Kennungen und
        Grund übernehmen, Beträge/Namen aus dem Browser verwerfen."""
        return VerknuepfungenMixin.create_link(  # type: ignore[arg-type]
            self,
            ctx,
            TransactionLinkCreate(
                transaction_id=body.transaction_id,
                document_type=_doc_typ_normieren(body.document_type),  # type: ignore[arg-type]
                document_id=body.document_id,
                amount_difference_reason=body.amount_difference_reason,
                booking_account=body.booking_account,
            ),
        )

    # ------------------------------------------------------------ Lösen
    def delete_link(self: _HatDb, ctx: AuthContext, link_id: str) -> None:
        tenant_id = self._tenant(ctx)
        row = self._link_falls_vorhanden(tenant_id, link_id)
        if not row:
            log.info("zahlungen_link_bereits_geloest", tenant_id=tenant_id, link_id=link_id)
            return
        if row.get("invoice_payment_id"):
            zahlungen = (
                self._db.table("invoice_payments")
                .select("*")
                .eq("id", row["invoice_payment_id"])
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            ).data or []
            if zahlungen:
                zahlung = zahlungen[0]
                self._db.table("invoice_payments").delete().eq("id", zahlung["id"]).eq(
                    "tenant_id", tenant_id
                ).execute()
                rechnung = self._rechnung(tenant_id, str(zahlung["invoice_id"]))
                self._rechnung_neu_rechnen(
                    tenant_id,
                    rechnung,
                    erledigt_trotz_differenz=False,
                    zahltag=None,
                    status_ohne_zahlung=str(
                        zahlung.get("invoice_status_before") or rechnung["status"]
                    ),
                )
                log.info(
                    "zahlungen_zahlung_zurueckgebucht",
                    tenant_id=tenant_id,
                    payment_id=zahlung["id"],
                    invoice_id=zahlung["invoice_id"],
                )
        self._db.table("transaction_links").delete().eq("id", link_id).eq(
            "tenant_id", tenant_id
        ).execute()
        tx_rows = (
            self._db.table("bank_transactions")
            .select("*")
            .eq("id", row["transaction_id"])
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if tx_rows:
            self._umsatz_zaehler(
                tenant_id,
                tx_rows[0],
                delta_anzahl=-1,
                delta_betrag=-dec(row.get("amount_allocated")),
            )
        log.info(
            "zahlungen_link_geloest",
            tenant_id=tenant_id,
            link_id=link_id,
            transaction_id=row["transaction_id"],
        )

    def set_booking_status(
        self: _HatDb, ctx: AuthContext, link_id: str, status: str
    ) -> TransactionLinkResponse:
        tenant_id = self._tenant(ctx)
        row = self._link(tenant_id, link_id)
        if row.get("booking_status") == status:
            return VerknuepfungenMixin._link_antwort(row)
        aenderung: dict[str, Any] = {"booking_status": status}
        aenderung["booked_at"] = datetime.now(UTC).isoformat() if status == "booked" else None
        self._db.table("transaction_links").update(aenderung).eq("id", link_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info(
            "zahlungen_link_buchungsstatus", tenant_id=tenant_id, link_id=link_id, status=status
        )
        return VerknuepfungenMixin._link_antwort(self._link(tenant_id, link_id))

    # -------------------------------------------------------- Vorschläge
    def suggestions(
        self: _HatDb, ctx: AuthContext, transaction_id: str
    ) -> list[SuggestionResponse]:
        """Offene Rechnungen, die zu diesem Umsatz passen: gleicher Betrag,
        Rechnungsnummer im Verwendungszweck, Kundenname im Gegenkonto-Namen."""
        tenant_id = self._tenant(ctx)
        tx = self._umsatz(tenant_id, transaction_id)
        tx_betrag = dec(tx.get("amount"))
        verfuegbar = q(abs(tx_betrag - dec(tx.get("linked_amount"))))
        if verfuegbar <= 0:
            return []
        gutschrift = tx_betrag < 0
        rechnungen = (
            self._db.table("invoices")
            .select(_RECHNUNGS_SPALTEN)
            .eq("tenant_id", tenant_id)
            .in_("status", sorted(OFFENE_RECHNUNGSSTATUS))
            .eq("currency", tx["currency"])
            .is_("deleted_at", "null")
            .order("due_date")
            .limit(MAX_LIMIT)
            .execute()
        ).data or []
        kandidaten = [
            r
            for r in rechnungen
            if (((r.get("invoice_type") or "invoice") != "invoice") == gutschrift)
            and abs(dec(r.get("gross_amount")) - dec(r.get("paid_amount"))) > 0
        ]
        if not kandidaten:
            return []
        kunden_ids = sorted({str(r["customer_id"]) for r in kandidaten if r.get("customer_id")})
        kunden: dict[str, str] = {}
        if kunden_ids:
            rows = (
                self._db.table("customers")
                .select("id, name")
                .eq("tenant_id", tenant_id)
                .in_("id", kunden_ids)
                .execute()
            ).data or []
            kunden = {str(r["id"]): str(r.get("name") or "") for r in rows}
        zweck = " ".join(f"{tx.get('purpose') or ''} {tx.get('reference') or ''}".lower().split())
        gegen = (tx.get("counterpart_name") or "").lower()
        ergebnis: list[SuggestionResponse] = []
        for r in kandidaten:
            brutto, bezahlt = dec(r.get("gross_amount")), dec(r.get("paid_amount"))
            offen = q(abs(brutto - bezahlt))
            punkte, gruende = 0, []
            if offen == verfuegbar:
                punkte, gruende = punkte + 100, [*gruende, "amount_exact"]
            nummer = str(r.get("invoice_number") or "").lower()
            if nummer and (nummer in zweck or nummer.replace("-", "") in zweck.replace("-", "")):
                punkte, gruende = punkte + 80, [*gruende, "number_in_purpose"]
            name = kunden.get(str(r.get("customer_id") or ""), "")
            woerter = [w for w in name.lower().split() if len(w) >= 4]
            if woerter and gegen and any(w in gegen for w in woerter):
                punkte, gruende = punkte + 30, [*gruende, "name_match"]
            if not punkte:
                continue
            ergebnis.append(
                SuggestionResponse(
                    invoice_id=str(r["id"]),
                    invoice_number=r.get("invoice_number"),
                    customer_id=str(r["customer_id"]) if r.get("customer_id") else None,
                    customer_name=name or None,
                    issue_date=datum(r.get("issue_date")),
                    due_date=datum(r.get("due_date")),
                    gross_amount=brutto,
                    paid_amount=bezahlt,
                    amount_open=offen,
                    currency=str(r.get("currency") or ""),
                    status=str(r.get("status")),
                    score=punkte,
                    reasons=gruende,
                )
            )
        ergebnis.sort(key=lambda s: (-s.score, s.due_date or datum("9999-12-31")))
        return ergebnis[:_MAX_VORSCHLAEGE]
