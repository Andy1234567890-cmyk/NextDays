"""Fachlogik des Bereichs »zahlungen«: Zahlungskonten, Bankumsätze (Import und
Handbuchung), Kassenbuch. Die Verknüpfung Umsatz ↔ Beleg samt Zahlungseingang
steht in `verknuepfungen.py` (Mixin), damit jede Datei eine Sache tut.

Regeln, die hier gelten und nirgends sonst:
  * Die Währung eines Kontos kommt aus dem Request oder aus `tenants.currency`;
    fehlt beides → 422. Umsätze tragen IMMER die Währung ihres Kontos, nie die
    des Clients (Wurzel 4).
  * Der Kontostand ist die SUMME der Buchungen (inkl. Anfangsbestand als
    erster Buchung `source='opening'`) — nirgends gespeichert, nie geraten.
  * Die Kasse (Konto `type='cash'`) darf NIE ins Minus: jede Auszahlung wird
    gegen den laufenden Bestand an jedem Punkt der Chronologie geprüft (422).
  * Doppel-Import (Wurzel 2): `import_hash` je Betrieb eindeutig (0643) —
    Dubletten werden gezählt, nicht gebucht. Eine Handbuchung mit identischen
    Feldern trifft denselben Hash und liefert die bestehende Zeile zurück.
  * Zeitpunkte (Wurzel 5b): `booking_date`/`value_date` sind die der Bank;
    `created_at` ist unser Eingang und wird nie als Buchungstag ausgegeben.
Jede per-ID-Ladung läuft über `load_scoped` (Wurzel 3); Listen filtern auf
`tenant_id`. PostgREST liefert höchstens 1000 Zeilen je Antwort — Summen über
alle Buchungen eines Kontos laufen deshalb seitenweise (`_seitenweise`), sonst
wäre ein Kontostand ab der 1001. Buchung still falsch.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
from collections.abc import Callable, Iterable
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from . import csv_import
from .basis import ZahlungenError, log
from .basis import datum as _datum
from .basis import dec as _dec
from .basis import ist_unique_verletzung as _ist_unique_verletzung
from .basis import nicht_gefunden as _nicht_gefunden
from .basis import q as _q
from .schemas import (
    MAX_DATE_SPAN_DAYS,
    MAX_LIMIT,
    TRANSACTION_STATUSES,
    BankTransactionCreate,
    BankTransactionListResponse,
    BankTransactionResponse,
    BankTransactionUpdate,
    CashbookEntry,
    CashbookEntryCreate,
    CashbookResponse,
    CsvImportRequest,
    CsvPreviewRequest,
    CsvPreviewResponse,
    ImportResult,
    ImportRowError,
    LinkedDocument,
    PaymentAccountCreate,
    PaymentAccountResponse,
    PaymentAccountUpdate,
)
from .verknuepfungen import VerknuepfungenMixin

_SEITE = 1000
_MAX_FEHLER_IM_ERGEBNIS = 20


# noqa: ANN401 — der Query-Builder von supabase-py ist untypisiert.
def _seitenweise(fabrik: Callable[[], Any]) -> list[dict]:  # noqa: ANN401
    """Alle Zeilen einer Abfrage in 1000er-Seiten. `fabrik` baut die Abfrage
    jedes Mal neu (der Builder ist zustandsbehaftet)."""
    zeilen: list[dict] = []
    start = 0
    while True:
        seite = fabrik().range(start, start + _SEITE - 1).execute().data or []
        zeilen.extend(seite)
        if len(seite) < _SEITE:
            return zeilen
        start += _SEITE


def _status(row: dict) -> str:
    if row.get("ignored"):
        return "ignored"
    return "matched" if int(row.get("link_count") or 0) > 0 else "unmatched"


def _monat_grenzen(monat: str) -> tuple[date, date]:
    """'YYYY-MM' → (erster Tag, erster Tag des Folgemonats)."""
    try:
        start = date.fromisoformat(f"{monat}-01")
    except ValueError as exc:
        raise ZahlungenError("Monat im Format JJJJ-MM angeben.", status_code=422) from exc
    ende = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return start, ende


class ZahlungenService(VerknuepfungenMixin):
    """Alle Operationen sind auf `ctx.tenant_id` gescopet."""

    def __init__(self, db: Client) -> None:
        self._db = db

    # ------------------------------------------------------------- Hilfen
    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise ZahlungenError("Kein Mandant im Kontext.", status_code=403)
        return ctx.tenant_id

    @staticmethod
    def _heute() -> date:
        return datetime.now(UTC).date()

    def _tenant_currency(self, tenant_id: str) -> str:
        rows = (
            self._db.table("tenants").select("currency").eq("id", tenant_id).limit(1).execute()
        ).data or []
        currency = rows[0].get("currency") if rows else None
        if not currency:
            raise ZahlungenError(
                "Mandanten-Währung fehlt — bitte im Konto die Währung setzen.", status_code=422
            )
        return str(currency)

    def _konto(self, tenant_id: str, account_id: str) -> dict:
        return load_scoped(
            self._db,
            "payment_accounts",
            account_id,
            tenant_id,
            not_found=_nicht_gefunden("Zahlungskonto"),
        )

    def _umsatz(self, tenant_id: str, transaction_id: str) -> dict:
        return load_scoped(
            self._db,
            "bank_transactions",
            transaction_id,
            tenant_id,
            not_found=_nicht_gefunden("Bankumsatz"),
        )

    def _buchungen(self, tenant_id: str, account_id: str, *, bis: date | None = None) -> list[dict]:
        """Alle Buchungen eines Kontos (optional nur vor `bis`), seitenweise."""

        def fabrik() -> Any:  # noqa: ANN401 — Query-Builder ist untypisiert
            q = (
                self._db.table("bank_transactions")
                .select("id, booking_date, amount, created_at")
                .eq("tenant_id", tenant_id)
                .eq("payment_account_id", account_id)
                .order("booking_date")
                .order("created_at")
            )
            return q.lt("booking_date", bis.isoformat()) if bis else q

        return _seitenweise(fabrik)

    def _konto_summen(
        self, tenant_id: str, account_ids: Iterable[str]
    ) -> dict[str, tuple[Decimal, int]]:
        ids = sorted(set(account_ids))
        if not ids:
            return {}
        zeilen = _seitenweise(
            lambda: (
                self._db.table("bank_transactions")
                .select("payment_account_id, amount")
                .eq("tenant_id", tenant_id)
                .in_("payment_account_id", ids)
                .order("id")
            )
        )
        summen: dict[str, tuple[Decimal, int]] = {i: (Decimal("0"), 0) for i in ids}
        for z in zeilen:
            konto = str(z["payment_account_id"])
            saldo, anzahl = summen.get(konto, (Decimal("0"), 0))
            summen[konto] = (saldo + _dec(z.get("amount")), anzahl + 1)
        return summen

    def _konto_antwort(self, row: dict, summe: tuple[Decimal, int]) -> PaymentAccountResponse:
        saldo, anzahl = summe
        return PaymentAccountResponse(
            id=str(row["id"]),
            tenant_id=str(row["tenant_id"]),
            name=row["name"],
            type=row["type"],
            iban=row.get("iban"),
            bic=row.get("bic"),
            bank_name=row.get("bank_name"),
            currency=row["currency"],
            opening_balance=_dec(row.get("opening_balance")),
            balance=_q(saldo),
            transaction_count=anzahl,
            is_default=bool(row.get("is_default")),
            active=bool(row.get("active", True)),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    # ------------------------------------------------------ Zahlungskonten
    def list_accounts(
        self, ctx: AuthContext, *, include_inactive: bool = False
    ) -> list[PaymentAccountResponse]:
        tenant_id = self._tenant(ctx)
        query = (
            self._db.table("payment_accounts")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("is_default", desc=True)
            .order("name")
            .limit(MAX_LIMIT)
        )
        if not include_inactive:
            query = query.eq("active", True)
        rows = query.execute().data or []
        summen = self._konto_summen(tenant_id, (str(r["id"]) for r in rows))
        return [self._konto_antwort(r, summen.get(str(r["id"]), (Decimal("0"), 0))) for r in rows]

    def get_account(self, ctx: AuthContext, account_id: str) -> PaymentAccountResponse:
        tenant_id = self._tenant(ctx)
        row = self._konto(tenant_id, account_id)
        summen = self._konto_summen(tenant_id, [account_id])
        return self._konto_antwort(row, summen.get(account_id, (Decimal("0"), 0)))

    def _standard_zuruecknehmen(self, tenant_id: str) -> None:
        self._db.table("payment_accounts").update({"is_default": False}).eq(
            "tenant_id", tenant_id
        ).eq("is_default", True).execute()

    def _hat_konten(self, tenant_id: str) -> bool:
        rows = (
            self._db.table("payment_accounts")
            .select("id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return bool(rows)

    def create_account(
        self, ctx: AuthContext, body: PaymentAccountCreate
    ) -> PaymentAccountResponse:
        tenant_id = self._tenant(ctx)
        currency = body.currency or self._tenant_currency(tenant_id)
        # Das erste Konto des Betriebs ist automatisch Standard — sonst gäbe es
        # keins, und die Kasse/der Import hätte kein Ziel.
        standard = body.is_default or not self._hat_konten(tenant_id)
        if standard:
            self._standard_zuruecknehmen(tenant_id)
        zeile = {
            "tenant_id": tenant_id,
            "name": body.name.strip(),
            "type": body.type,
            "iban": (body.iban or "").replace(" ", "").upper() or None,
            "bic": (body.bic or "").strip().upper() or None,
            "bank_name": (body.bank_name or "").strip() or None,
            "currency": currency,
            "opening_balance": str(_q(body.opening_balance)),
            "is_default": standard,
            "active": True,
        }
        try:
            res = self._db.table("payment_accounts").insert(zeile).execute()
        except APIError as exc:
            if _ist_unique_verletzung(exc):
                raise ZahlungenError("Es gibt bereits ein Standardkonto.", status_code=409) from exc
            raise
        neu = (res.data or [None])[0]
        if not neu:
            raise ZahlungenError("Zahlungskonto konnte nicht gespeichert werden.", status_code=500)
        log.info(
            "zahlungen_konto_angelegt",
            tenant_id=tenant_id,
            account_id=neu["id"],
            type=body.type,
            currency=currency,
            is_default=standard,
        )
        if _q(body.opening_balance) != 0:
            self._anfangsbestand_buchen(tenant_id, neu, body.opening_date or self._heute())
        return self.get_account(ctx, str(neu["id"]))

    def _anfangsbestand_buchen(self, tenant_id: str, konto: dict, tag: date) -> None:
        """Der Anfangsbestand ist die ERSTE Buchung des Kontos (`source='opening'`).
        Der Unique-Index (0648) fängt den Doppelklick."""
        betrag = _q(_dec(konto.get("opening_balance")))
        zeile = {
            "tenant_id": tenant_id,
            "payment_account_id": konto["id"],
            "booking_date": tag.isoformat(),
            "amount": str(betrag),
            "currency": konto["currency"],
            "purpose": "Anfangsbestand",
            "source": "opening",
            "import_hash": csv_import.import_hash(
                str(konto["id"]), tag, betrag, konto["currency"], None, "Anfangsbestand", "opening"
            ),
        }
        try:
            self._db.table("bank_transactions").insert(zeile).execute()
        except APIError as exc:
            if not _ist_unique_verletzung(exc):
                raise
            log.info(
                "zahlungen_anfangsbestand_bereits_gebucht",
                tenant_id=tenant_id,
                account_id=konto["id"],
            )
            return
        log.info(
            "zahlungen_anfangsbestand_gebucht",
            tenant_id=tenant_id,
            account_id=konto["id"],
            amount=str(betrag),
            currency=konto["currency"],
        )

    def update_account(
        self, ctx: AuthContext, account_id: str, body: PaymentAccountUpdate
    ) -> PaymentAccountResponse:
        tenant_id = self._tenant(ctx)
        row = self._konto(tenant_id, account_id)
        gesetzt = body.model_dump(exclude_unset=True, by_alias=False)
        aenderung: dict[str, Any] = {}
        if "name" in gesetzt and gesetzt["name"]:
            aenderung["name"] = gesetzt["name"].strip()
        for feld in ("iban", "bic", "bank_name"):
            if feld in gesetzt:
                wert = (gesetzt[feld] or "").strip()
                aenderung[feld] = (
                    wert.replace(" ", "").upper() if feld == "iban" else wert
                ) or None
        if gesetzt.get("is_default") is False and row.get("is_default"):
            raise ZahlungenError(
                "Ein Standardkonto muss bleiben — wählen Sie stattdessen ein anderes Konto "
                "als Standard.",
                status_code=422,
            )
        if gesetzt.get("active") is False and row.get("is_default"):
            raise ZahlungenError(
                "Das Standardkonto kann nicht deaktiviert werden.", status_code=422
            )
        if "active" in gesetzt and gesetzt["active"] is not None:
            aenderung["active"] = bool(gesetzt["active"])
        if gesetzt.get("is_default") is True and not row.get("is_default"):
            self._standard_zuruecknehmen(tenant_id)
            aenderung["is_default"] = True
        if aenderung:
            self._db.table("payment_accounts").update(aenderung).eq("id", account_id).eq(
                "tenant_id", tenant_id
            ).execute()
            log.info(
                "zahlungen_konto_geaendert",
                tenant_id=tenant_id,
                account_id=account_id,
                felder=sorted(aenderung),
            )
        return self.get_account(ctx, account_id)

    def deactivate_account(self, ctx: AuthContext, account_id: str) -> None:
        """DELETE = deaktivieren. Buchungen bleiben (GoBD), das Konto verschwindet
        aus Auswahlen. Ein zweiter Aufruf ist ein No-Op (Wurzel 2)."""
        tenant_id = self._tenant(ctx)
        row = self._konto(tenant_id, account_id)
        if row.get("is_default"):
            raise ZahlungenError(
                "Das Standardkonto kann nicht deaktiviert werden.", status_code=422
            )
        if not row.get("active", True):
            return
        self._db.table("payment_accounts").update({"active": False}).eq("id", account_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info("zahlungen_konto_deaktiviert", tenant_id=tenant_id, account_id=account_id)

    # ---------------------------------------------------------- Umsätze
    def _konto_namen(self, tenant_id: str, ids: Iterable[str]) -> dict[str, str]:
        ids = sorted(set(ids))
        if not ids:
            return {}
        rows = (
            self._db.table("payment_accounts")
            .select("id, name")
            .eq("tenant_id", tenant_id)
            .in_("id", ids)
            .execute()
        ).data or []
        return {str(r["id"]): str(r["name"]) for r in rows}

    def _verknuepfte_belege(
        self, tenant_id: str, tx_ids: Iterable[str]
    ) -> dict[str, list[LinkedDocument]]:
        ids = sorted(set(tx_ids))
        if not ids:
            return {}
        rows = (
            self._db.table("transaction_links")
            .select(
                "id, transaction_id, invoice_id, expense_id, cashbook_entry_id, document_type, "
                "document_number, customer_name, amount_allocated"
            )
            .eq("tenant_id", tenant_id)
            .in_("transaction_id", ids)
            .execute()
        ).data or []
        ergebnis: dict[str, list[LinkedDocument]] = {}
        for r in rows:
            ergebnis.setdefault(str(r["transaction_id"]), []).append(
                LinkedDocument(
                    link_id=str(r["id"]),
                    document_id=str(
                        r.get("invoice_id")
                        or r.get("expense_id")
                        or r.get("cashbook_entry_id")
                        or ""
                    ),
                    document_type=r["document_type"],
                    document_number=str(r.get("document_number") or ""),
                    customer_name=str(r.get("customer_name") or ""),
                    amount_allocated=_dec(r.get("amount_allocated")),
                )
            )
        return ergebnis

    def _umsatz_antwort(
        self, row: dict, konto_name: str | None, belege: list[LinkedDocument]
    ) -> BankTransactionResponse:
        betrag, verknuepft = _dec(row.get("amount")), _dec(row.get("linked_amount"))
        return BankTransactionResponse(
            id=str(row["id"]),
            tenant_id=str(row["tenant_id"]),
            payment_account_id=str(row["payment_account_id"]),
            payment_account_name=konto_name,
            import_batch_id=str(row["import_batch_id"]) if row.get("import_batch_id") else None,
            booking_date=_datum(row["booking_date"]) or self._heute(),
            value_date=_datum(row.get("value_date")),
            amount=betrag,
            currency=row["currency"],
            counterpart_name=row.get("counterpart_name"),
            counterpart_iban=row.get("counterpart_iban"),
            counterpart_bic=row.get("counterpart_bic"),
            purpose=row.get("purpose"),
            reference=row.get("reference"),
            transaction_code=row.get("transaction_code"),
            source=row.get("source") or "import",
            ignored=bool(row.get("ignored")),
            note=row.get("note"),
            link_count=int(row.get("link_count") or 0),
            linked_amount=verknuepft,
            remaining_amount=_q(betrag - verknuepft),
            status=_status(row),
            linked_documents=belege,
            created_at=row["created_at"],
        )

    def _umsaetze_anreichern(
        self, tenant_id: str, rows: list[dict]
    ) -> list[BankTransactionResponse]:
        namen = self._konto_namen(tenant_id, (str(r["payment_account_id"]) for r in rows))
        belege = self._verknuepfte_belege(
            tenant_id, (str(r["id"]) for r in rows if int(r.get("link_count") or 0) > 0)
        )
        return [
            self._umsatz_antwort(
                r, namen.get(str(r["payment_account_id"])), belege.get(str(r["id"]), [])
            )
            for r in rows
        ]

    @staticmethod
    def _zeitraum_pruefen(von: date | None, bis: date | None) -> None:
        if von and bis:
            if bis < von:
                raise ZahlungenError("Enddatum liegt vor dem Startdatum.", status_code=422)
            if (bis - von).days > MAX_DATE_SPAN_DAYS:
                raise ZahlungenError(
                    f"Zeitraum größer als {MAX_DATE_SPAN_DAYS} Tage.", status_code=422
                )

    def list_transactions(
        self,
        ctx: AuthContext,
        *,
        account_id: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        status: str | None = None,
        search: str | None = None,
        limit: int = 200,
    ) -> BankTransactionListResponse:
        tenant_id = self._tenant(ctx)
        if status is not None and status not in TRANSACTION_STATUSES:
            raise ZahlungenError("Unbekannter Umsatzstatus.", status_code=422)
        self._zeitraum_pruefen(date_from, date_to)
        if account_id:
            self._konto(tenant_id, account_id)  # fremdes Konto → 404, kein Leak
        limit = max(1, min(limit, MAX_LIMIT))
        query = (
            self._db.table("bank_transactions")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("booking_date", desc=True)
            .order("created_at", desc=True)
            .limit(limit)
        )
        if account_id:
            query = query.eq("payment_account_id", account_id)
        if date_from:
            query = query.gte("booking_date", date_from.isoformat())
        if date_to:
            query = query.lte("booking_date", date_to.isoformat())
        if status == "ignored":
            query = query.eq("ignored", True)
        elif status == "matched":
            query = query.gt("link_count", 0)
        elif status == "unmatched":
            query = query.eq("ignored", False).eq("link_count", 0)
        if search:
            # PostgREST-`or`: Kommas/Klammern trennen Bedingungen — aus dem
            # Suchwort entfernen, sonst wird die Eingabe zur Filter-Grammatik.
            wort = "".join(ch for ch in search.strip() if ch not in ",()")[:80]
            if wort:
                muster = f"%{wort}%"
                query = query.or_(
                    f"purpose.ilike.{muster},"
                    f"counterpart_name.ilike.{muster},"
                    f"reference.ilike.{muster}"
                )
        rows = query.execute().data or []
        items = self._umsaetze_anreichern(tenant_id, rows)
        return BankTransactionListResponse(
            items=items,
            total=len(items),
            sum_in=_q(sum((i.amount for i in items if i.amount > 0), Decimal("0"))),
            sum_out=_q(sum((i.amount for i in items if i.amount < 0), Decimal("0"))),
        )

    def get_transaction(self, ctx: AuthContext, transaction_id: str) -> BankTransactionResponse:
        tenant_id = self._tenant(ctx)
        return self._umsaetze_anreichern(tenant_id, [self._umsatz(tenant_id, transaction_id)])[0]

    def _kassenbestand_pruefen(
        self, tenant_id: str, konto: dict, tag: date, betrag: Decimal
    ) -> None:
        """Eine Kasse darf an KEINEM Punkt ihrer Chronologie ins Minus — auch
        nicht rückwirkend (eine Auszahlung am 3. gegen eine Einzahlung erst am 5.)."""
        if konto.get("type") != "cash" or betrag >= 0:
            return
        buchungen = self._buchungen(tenant_id, str(konto["id"]))
        punkte = [(_datum(b["booking_date"]) or tag, 1, _dec(b.get("amount"))) for b in buchungen]
        # Die neue Buchung zählt am Ende ihres Tages (Rang 2 hinter Bestehendem).
        punkte.append((tag, 2, betrag))
        punkte.sort(key=lambda p: (p[0], p[1]))
        stand = Decimal("0")
        for punkt_tag, _rang, wert in punkte:
            stand += wert
            if stand < 0:
                log.info(
                    "zahlungen_kasse_wuerde_negativ",
                    tenant_id=tenant_id,
                    account_id=konto["id"],
                    tag=punkt_tag.isoformat(),
                    stand=str(_q(stand)),
                )
                raise ZahlungenError(
                    f"Kassenbestand würde am {punkt_tag.isoformat()} negativ "
                    f"({_q(stand)} {konto['currency']}).",
                    status_code=422,
                )

    def create_transaction(
        self, ctx: AuthContext, body: BankTransactionCreate, *, quelle: str = "manual"
    ) -> BankTransactionResponse:
        tenant_id = self._tenant(ctx)
        konto = self._konto(tenant_id, body.payment_account_id)
        if not konto.get("active", True):
            raise ZahlungenError("Zahlungskonto ist deaktiviert.", status_code=422)
        betrag = _q(body.amount)
        if betrag == 0:
            raise ZahlungenError("Betrag darf nicht 0 sein.", status_code=422)
        if body.booking_date > self._heute() + timedelta(days=1):
            raise ZahlungenError("Buchungstag liegt in der Zukunft.", status_code=422)
        self._kassenbestand_pruefen(tenant_id, konto, body.booking_date, betrag)
        name = " ".join((body.counterpart_name or "").split()) or None
        zweck = " ".join((body.purpose or "").split()) or None
        referenz = " ".join((body.reference or "").split()) or None
        hash_ = csv_import.import_hash(
            str(konto["id"]), body.booking_date, betrag, konto["currency"], name, zweck, referenz
        )
        zeile = {
            "tenant_id": tenant_id,
            "payment_account_id": konto["id"],
            "booking_date": body.booking_date.isoformat(),
            "value_date": body.value_date.isoformat() if body.value_date else None,
            "amount": str(betrag),
            "currency": konto["currency"],
            "counterpart_name": name,
            "purpose": zweck,
            "reference": referenz,
            "note": (body.note or "").strip() or None,
            "source": quelle,
            "import_hash": hash_,
        }
        try:
            res = self._db.table("bank_transactions").insert(zeile).execute()
        except APIError as exc:
            if not _ist_unique_verletzung(exc):
                raise
            # Doppelklick/Retry: dieselbe Buchung existiert — die liefern (Wurzel 2).
            bestehend = (
                self._db.table("bank_transactions")
                .select("*")
                .eq("tenant_id", tenant_id)
                .eq("import_hash", hash_)
                .limit(1)
                .execute()
            ).data or []
            if not bestehend:
                raise
            log.info(
                "zahlungen_buchung_bereits_vorhanden",
                tenant_id=tenant_id,
                transaction_id=bestehend[0]["id"],
            )
            return self._umsaetze_anreichern(tenant_id, bestehend)[0]
        neu = (res.data or [None])[0]
        if not neu:
            raise ZahlungenError("Buchung konnte nicht gespeichert werden.", status_code=500)
        log.info(
            "zahlungen_buchung_angelegt",
            tenant_id=tenant_id,
            transaction_id=neu["id"],
            account_id=konto["id"],
            amount=str(betrag),
            currency=konto["currency"],
            source=quelle,
        )
        return self._umsaetze_anreichern(tenant_id, [neu])[0]

    def update_transaction(
        self, ctx: AuthContext, transaction_id: str, body: BankTransactionUpdate
    ) -> BankTransactionResponse:
        tenant_id = self._tenant(ctx)
        row = self._umsatz(tenant_id, transaction_id)
        gesetzt = body.model_dump(exclude_unset=True, by_alias=False)
        aenderung: dict[str, Any] = {}
        if gesetzt.get("ignored") is not None:
            if gesetzt["ignored"] and int(row.get("link_count") or 0) > 0:
                raise ZahlungenError(
                    "Ein verknüpfter Umsatz kann nicht beiseitegelegt werden — erst die "
                    "Verknüpfung lösen.",
                    status_code=409,
                )
            aenderung["ignored"] = bool(gesetzt["ignored"])
        if "note" in gesetzt:
            aenderung["note"] = (gesetzt["note"] or "").strip() or None
        if aenderung:
            self._db.table("bank_transactions").update(aenderung).eq("id", transaction_id).eq(
                "tenant_id", tenant_id
            ).execute()
            log.info(
                "zahlungen_umsatz_geaendert",
                tenant_id=tenant_id,
                transaction_id=transaction_id,
                felder=sorted(aenderung),
            )
        return self.get_transaction(ctx, transaction_id)

    # ------------------------------------------------------------ Import
    @staticmethod
    def _base64_lesen(inhalt: str) -> bytes:
        roh = inhalt.split(",", 1)[1] if inhalt.startswith("data:") else inhalt
        try:
            return base64.b64decode(roh, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ZahlungenError("Dateiinhalt ist kein gültiges Base64.", status_code=422) from exc

    def _datei(self, body: CsvPreviewRequest) -> csv_import.GeleseneDatei:
        daten = self._base64_lesen(body.content_base64)
        try:
            return csv_import.datei_lesen(
                daten, delimiter=body.delimiter, has_header=body.has_header, encoding=body.encoding
            )
        except csv_import.CsvFehler as exc:
            raise ZahlungenError(exc.message, status_code=exc.status_code) from exc

    def preview_csv(self, ctx: AuthContext, body: CsvPreviewRequest) -> CsvPreviewResponse:
        self._tenant(ctx)
        datei = self._datei(body)
        return CsvPreviewResponse(
            delimiter=datei.delimiter,
            encoding=datei.encoding,
            header=datei.header,
            rows=datei.rows[:10],
            row_count=len(datei.rows),
            suggested_mapping=csv_import.mapping_raten(datei.header),
        )

    def _vorhandene_hashes(self, tenant_id: str, hashes: list[str]) -> set[str]:
        vorhanden: set[str] = set()
        for i in range(0, len(hashes), 200):
            rows = (
                self._db.table("bank_transactions")
                .select("import_hash")
                .eq("tenant_id", tenant_id)
                .in_("import_hash", hashes[i : i + 200])
                .execute()
            ).data or []
            vorhanden.update(str(r["import_hash"]) for r in rows)
        return vorhanden

    def _zeilen_einfuegen(self, zeilen: list[dict]) -> tuple[int, int]:
        """→ (eingefügt, Dubletten). Erst als Block; bricht der an EINER Dublette
        (paralleler Import), Zeile für Zeile."""
        if not zeilen:
            return 0, 0
        try:
            self._db.table("bank_transactions").insert(zeilen).execute()
            return len(zeilen), 0
        except APIError as exc:
            if not _ist_unique_verletzung(exc):
                raise
        eingefuegt = dubletten = 0
        for z in zeilen:
            try:
                self._db.table("bank_transactions").insert(z).execute()
                eingefuegt += 1
            except APIError as exc:
                if not _ist_unique_verletzung(exc):
                    raise
                dubletten += 1
        return eingefuegt, dubletten

    def import_csv(self, ctx: AuthContext, body: CsvImportRequest) -> ImportResult:
        tenant_id = self._tenant(ctx)
        konto = self._konto(tenant_id, body.payment_account_id)
        if not konto.get("active", True):
            raise ZahlungenError("Zahlungskonto ist deaktiviert.", status_code=422)
        if (
            body.mapping.amount is None
            and body.mapping.debit is None
            and body.mapping.credit is None
        ):
            raise ZahlungenError("Spaltenzuordnung: Betrag oder Soll/Haben fehlt.", status_code=422)
        daten = self._base64_lesen(body.content_base64)
        datei = self._datei(body)
        file_sha = hashlib.sha256(daten).hexdigest()

        batch = (
            self._db.table("bank_import_batches")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "payment_account_id": konto["id"],
                    "format": "csv",
                    "file_name": body.file_name[:200],
                    "file_sha256": file_sha,
                    "row_count": len(datei.rows),
                    "column_mapping": body.mapping.model_dump(exclude_none=True),
                    "created_by": ctx.user_id,
                }
            )
            .execute()
        ).data or [None]
        batch_id = str((batch[0] or {}).get("id") or "")
        if not batch_id:
            raise ZahlungenError("Import konnte nicht angelegt werden.", status_code=500)

        fehler: list[ImportRowError] = []
        gelesen: list[tuple[str, dict]] = []
        gesehen: set[str] = set()
        dubletten_in_datei = 0
        for nr, zeile in enumerate(datei.rows, start=2 if body.has_header else 1):
            try:
                z = csv_import.zeile_lesen(
                    zeile,
                    body.mapping,
                    date_format=body.date_format,
                    decimal_separator=body.decimal_separator,
                )
            except csv_import.CsvFehler as exc:
                fehler.append(ImportRowError(row=nr, message=exc.message))
                continue
            if z.currency and z.currency != konto["currency"]:
                fehler.append(
                    ImportRowError(
                        row=nr,
                        message=f"Währung {z.currency} passt nicht zum Konto "
                        f"({konto['currency']}).",
                    )
                )
                continue
            hash_ = csv_import.import_hash(
                str(konto["id"]),
                z.booking_date,
                z.amount,
                konto["currency"],
                z.counterpart_name,
                z.purpose,
                z.reference,
            )
            if hash_ in gesehen:
                dubletten_in_datei += 1
                continue
            gesehen.add(hash_)
            gelesen.append(
                (
                    hash_,
                    {
                        "tenant_id": tenant_id,
                        "payment_account_id": konto["id"],
                        "import_batch_id": batch_id,
                        "booking_date": z.booking_date.isoformat(),
                        "value_date": z.value_date.isoformat() if z.value_date else None,
                        "amount": str(z.amount),
                        "currency": konto["currency"],
                        "counterpart_name": z.counterpart_name,
                        "counterpart_iban": z.counterpart_iban,
                        "purpose": z.purpose,
                        "reference": z.reference,
                        "source": "import",
                        "import_hash": hash_,
                    },
                )
            )

        vorhanden = self._vorhandene_hashes(tenant_id, [h for h, _ in gelesen])
        neu = [zeile for h, zeile in gelesen if h not in vorhanden]
        eingefuegt, dubletten_beim_einfuegen = self._zeilen_einfuegen(neu)
        dubletten = dubletten_in_datei + (len(gelesen) - len(neu)) + dubletten_beim_einfuegen

        self._db.table("bank_import_batches").update(
            {
                "imported_count": eingefuegt,
                "duplicate_count": dubletten,
                "error_count": len(fehler),
            }
        ).eq("id", batch_id).eq("tenant_id", tenant_id).execute()
        log.info(
            "zahlungen_import_abgeschlossen",
            tenant_id=tenant_id,
            batch_id=batch_id,
            account_id=konto["id"],
            rows=len(datei.rows),
            imported=eingefuegt,
            duplicates=dubletten,
            errors=len(fehler),
            encoding=datei.encoding,
            delimiter=datei.delimiter,
        )
        return ImportResult(
            batch_id=batch_id,
            row_count=len(datei.rows),
            imported_count=eingefuegt,
            duplicate_count=dubletten,
            error_count=len(fehler),
            errors=fehler[:_MAX_FEHLER_IM_ERGEBNIS],
        )

    # -------------------------------------------------------- Kassenbuch
    def _kasse(self, tenant_id: str, account_id: str) -> dict:
        konto = self._konto(tenant_id, account_id)
        if konto.get("type") != "cash":
            raise ZahlungenError("Dieses Zahlungskonto ist keine Kasse.", status_code=422)
        return konto

    def get_cashbook(self, ctx: AuthContext, account_id: str, monat: str) -> CashbookResponse:
        tenant_id = self._tenant(ctx)
        konto = self._kasse(tenant_id, account_id)
        start, ende = _monat_grenzen(monat)
        alle = self._buchungen(tenant_id, account_id)
        anfang = Decimal("0")
        im_monat: list[dict] = []
        for b in alle:
            tag = _datum(b["booking_date"]) or start
            if tag < start:
                anfang += _dec(b.get("amount"))
            elif tag < ende:
                im_monat.append(b)
        ids = [str(b["id"]) for b in im_monat]
        details: dict[str, dict] = {}
        for i in range(0, len(ids), 200):
            rows = (
                self._db.table("bank_transactions")
                .select("*")
                .eq("tenant_id", tenant_id)
                .in_("id", ids[i : i + 200])
                .execute()
            ).data or []
            details.update({str(r["id"]): r for r in rows})
        stand = anfang
        eintraege: list[CashbookEntry] = []
        ein = aus = Decimal("0")
        for b in im_monat:
            r = details.get(str(b["id"]), b)
            betrag = _dec(r.get("amount"))
            stand += betrag
            if betrag > 0:
                ein += betrag
            else:
                aus += betrag
            eintraege.append(
                CashbookEntry(
                    id=str(r["id"]),
                    booking_date=_datum(r["booking_date"]) or start,
                    amount=betrag,
                    counterpart_name=r.get("counterpart_name"),
                    purpose=r.get("purpose"),
                    reference=r.get("reference"),
                    source=r.get("source") or "manual",
                    link_count=int(r.get("link_count") or 0),
                    running_balance=_q(stand),
                    created_at=r["created_at"],
                )
            )
        summen = self._konto_summen(tenant_id, [account_id])
        return CashbookResponse(
            account=self._konto_antwort(konto, summen.get(account_id, (Decimal("0"), 0))),
            month=monat,
            opening_balance=_q(anfang),
            entries=eintraege,
            sum_in=_q(ein),
            sum_out=_q(aus),
            closing_balance=_q(stand),
        )

    def create_cashbook_entry(
        self, ctx: AuthContext, body: CashbookEntryCreate
    ) -> BankTransactionResponse:
        tenant_id = self._tenant(ctx)
        self._kasse(tenant_id, body.payment_account_id)
        return self.create_transaction(
            ctx,
            BankTransactionCreate(
                payment_account_id=body.payment_account_id,
                booking_date=body.booking_date,
                amount=body.amount,
                counterpart_name=body.counterpart_name,
                purpose=body.purpose,
                reference=body.reference,
            ),
            quelle="manual",
        )
