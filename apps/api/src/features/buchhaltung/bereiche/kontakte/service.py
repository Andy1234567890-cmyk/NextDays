"""Fachlogik des Bereichs »kontakte«: Ansprechpartner, Anschriften und Notizen
je Kunde, Kundenübersicht mit Kennzahlen, Lieferantenliste.

Was vom alten Werkzeug übrig blieb, ist die FORM (Ansprechpartner mit
Hauptkontakt, mehrere Anschriften mit Standard, Kundendetail mit Belegen und
Kennzahlen). Die REGELN stehen ausschließlich hier — vorher rechnete der
Browser Umsatz und offene Posten selbst zusammen:

  * Kennzahlen kommen aus `invoices` (gross_amount, paid_amount, status,
    due_date), serverseitig aus Decimal, JE WÄHRUNG getrennt. Eine Rechnung
    ohne Währung ist ein Datenfehler → 422, kein „EUR" (Wurzel 4).
  * Genau ein Hauptkontakt je Kunde, genau eine Standardanschrift je Kunde und
    Art: beim Setzen werden die alten abgeräumt (Wurzel 1), der partielle
    Unique-Index (0665/0666) fängt den Doppelklick (Wurzel 2, 23505 → 409).
  * Jeder Unterdatensatz wird per `load_scoped` auf den Tenant UND gegen den
    Kunden aus dem Pfad geprüft (Wurzel 3 + 9): `/customers/A/contacts/x`
    liefert 404, wenn x zu Kunde B gehört.
  * Ein soft-gelöschter Kunde (`deleted_at`) ist für diesen Bereich nicht
    vorhanden — dieselbe 404 wie „gibt es nicht" (kein Existenz-Leak).
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from ...service import BuchhaltungError, BuchhaltungService
from .schemas import (
    AddressCreate,
    AddressResponse,
    AddressUpdate,
    ContactCreate,
    ContactResponse,
    ContactUpdate,
    CustomerOverview,
    NoteCreate,
    NoteResponse,
    NoteUpdate,
    OverviewInvoice,
    WaehrungsKennzahlen,
)

log = get_logger("nextdays.buchhaltung.kontakte")

# Rechnungsstatus, in denen ein Beleg ausgestellt und noch offen ist — dieselbe
# Menge wie im Bereich »mahnwesen« (`OFFENE_RECHNUNGSSTATUS`).
OFFENE_RECHNUNGSSTATUS: frozenset[str] = frozenset({"sent", "finalized", "overdue"})
# Nicht umsatzwirksam: Entwürfe und stornierte Belege.
KEIN_UMSATZ_STATUS: frozenset[str] = frozenset({"draft", "cancelled"})

# Harte Obergrenzen (Wurzel 8).
LISTEN_LIMIT_MAX = 500
LISTEN_LIMIT_STANDARD = 50
# Bis zu so vielen Belegen gehen in die Kennzahlen ein; darüber meldet die
# Antwort `truncated=true`, statt still eine zu kleine Summe zu zeigen.
KENNZAHLEN_CAP = 2000

_ZWEI_STELLEN = Decimal("0.01")


def _q(betrag: Decimal) -> Decimal:
    return betrag.quantize(_ZWEI_STELLEN, rounding=ROUND_HALF_UP)


def _dec(wert: object) -> Decimal:
    if wert is None or wert == "":
        return Decimal("0")
    return Decimal(str(wert))


def _datum(wert: object) -> date | None:
    if wert is None or wert == "":
        return None
    if isinstance(wert, date):
        return wert
    return date.fromisoformat(str(wert)[:10])


class KontakteError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _nicht_gefunden(was: str) -> KontakteError:
    return KontakteError(f"{was} nicht gefunden.", status_code=404)


def _ist_unique_verletzung(exc: APIError) -> bool:
    return getattr(exc, "code", None) == "23505"


class KontakteService:
    """Alle Operationen sind auf `ctx.tenant_id` gescopet."""

    def __init__(self, db: Client, *, bestand: BuchhaltungService | None = None) -> None:
        self._db = db
        # Die Kundensuche des Bestands wird AUFGERUFEN, nicht kopiert.
        self._bestand = bestand or BuchhaltungService(service_client=db)

    # ------------------------------------------------------------- Hilfen
    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise KontakteError("Kein Mandant im Kontext.", status_code=403)
        return ctx.tenant_id

    @staticmethod
    def _heute() -> date:
        return datetime.now(UTC).date()

    @staticmethod
    def _limit(limit: int | None) -> int:
        if limit is None:
            return LISTEN_LIMIT_STANDARD
        if not 1 <= limit <= LISTEN_LIMIT_MAX:
            raise KontakteError(
                f"limit muss zwischen 1 und {LISTEN_LIMIT_MAX} liegen.", status_code=422
            )
        return limit

    def _eigener_kunde(self, tenant_id: str, customer_id: str) -> dict:
        """Kunde des Tenants, nicht soft-gelöscht — sonst 404 (Wurzel 3)."""
        row = load_scoped(
            self._db,
            "customers",
            customer_id,
            tenant_id,
            columns="id, name, is_supplier, deleted_at",
            not_found=_nicht_gefunden("Kunde"),
        )
        if row.get("deleted_at"):
            raise _nicht_gefunden("Kunde")
        return row

    def _eigener_unterdatensatz(
        self, table: str, row_id: str, tenant_id: str, customer_id: str, was: str
    ) -> dict:
        """Unterdatensatz per ID: Tenant-Scope UND Kunde aus dem Pfad (Wurzel 9)."""
        row = load_scoped(self._db, table, row_id, tenant_id, not_found=_nicht_gefunden(was))
        if str(row.get("customer_id")) != str(customer_id):
            raise _nicht_gefunden(was)
        return row

    def _autor_name(self, tenant_id: str, user_id: str) -> str | None:
        rows = (
            self._db.table("users")
            .select("full_name")
            .eq("id", user_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        name = rows[0].get("full_name") if rows else None
        if not name:
            return None
        return str(name).strip() or None

    def _liste(
        self, table: str, tenant_id: str, customer_id: str, order: str, *, desc: bool
    ) -> list[dict]:
        return (
            self._db.table(table)
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("customer_id", customer_id)
            .order(order, desc=desc)
            .limit(LISTEN_LIMIT_MAX)
            .execute()
        ).data or []

    def _anzahl(self, table: str, tenant_id: str, customer_id: str) -> int:
        rows = (
            self._db.table(table)
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("customer_id", customer_id)
            .limit(LISTEN_LIMIT_MAX)
            .execute()
        ).data or []
        return len(rows)

    # ---------------------------------------------------- Ansprechpartner
    @staticmethod
    def _contact_antwort(row: dict) -> ContactResponse:
        return ContactResponse(
            id=str(row["id"]),
            tenant_id=str(row["tenant_id"]),
            customer_id=str(row["customer_id"]),
            name=row["name"],
            role=row.get("role"),
            email=row.get("email"),
            phone=row.get("phone"),
            is_primary=bool(row.get("is_primary")),
            notes=row.get("notes"),
            created_by=str(row["created_by"]) if row.get("created_by") else None,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def list_contacts(self, ctx: AuthContext, customer_id: str) -> list[ContactResponse]:
        tenant_id = self._tenant(ctx)
        self._eigener_kunde(tenant_id, customer_id)
        rows = self._liste("customer_contacts", tenant_id, customer_id, "created_at", desc=False)
        # Hauptkontakt zuerst, sonst Anlage-Reihenfolge.
        rows.sort(key=lambda r: not bool(r.get("is_primary")))
        return [self._contact_antwort(r) for r in rows]

    def _hauptkontakt_abraeumen(self, tenant_id: str, customer_id: str, ausser: str | None) -> None:
        """Gegenzustand (Wurzel 1): der bisherige Hauptkontakt verliert die Rolle."""
        q = (
            self._db.table("customer_contacts")
            .update({"is_primary": False})
            .eq("tenant_id", tenant_id)
            .eq("customer_id", customer_id)
            .eq("is_primary", True)
        )
        if ausser:
            q = q.neq("id", ausser)
        q.execute()

    def create_contact(
        self, ctx: AuthContext, customer_id: str, body: ContactCreate
    ) -> ContactResponse:
        tenant_id = self._tenant(ctx)
        self._eigener_kunde(tenant_id, customer_id)
        if body.is_primary:
            self._hauptkontakt_abraeumen(tenant_id, customer_id, None)
        zeile: dict[str, Any] = {
            "tenant_id": tenant_id,
            "customer_id": customer_id,
            "name": body.name,
            "role": body.role,
            "email": body.email,
            "phone": body.phone,
            "is_primary": body.is_primary,
            "notes": body.notes,
            "created_by": ctx.user_id,
        }
        try:
            res = self._db.table("customer_contacts").insert(zeile).execute()
        except APIError as exc:
            if _ist_unique_verletzung(exc):
                raise KontakteError(
                    "Es gibt bereits einen Hauptkontakt — bitte erneut versuchen.", status_code=409
                ) from exc
            raise
        neu = (res.data or [None])[0]
        if not neu:
            raise KontakteError("Ansprechpartner konnte nicht gespeichert werden.", status_code=500)
        log.info(
            "kontakte_ansprechpartner_angelegt",
            tenant_id=tenant_id,
            customer_id=customer_id,
            contact_id=neu["id"],
            is_primary=body.is_primary,
        )
        return self._contact_antwort(neu)

    def update_contact(
        self, ctx: AuthContext, customer_id: str, contact_id: str, body: ContactUpdate
    ) -> ContactResponse:
        tenant_id = self._tenant(ctx)
        self._eigener_kunde(tenant_id, customer_id)
        self._eigener_unterdatensatz(
            "customer_contacts", contact_id, tenant_id, customer_id, "Ansprechpartner"
        )
        aenderung = body.model_dump(exclude_unset=True, by_alias=False)
        if aenderung.get("name") is None and "name" in aenderung:
            raise KontakteError("Name darf nicht leer sein.", status_code=422)
        if aenderung.get("is_primary") is True:
            self._hauptkontakt_abraeumen(tenant_id, customer_id, contact_id)
        if aenderung:
            try:
                self._db.table("customer_contacts").update(aenderung).eq("id", contact_id).eq(
                    "tenant_id", tenant_id
                ).execute()
            except APIError as exc:
                if _ist_unique_verletzung(exc):
                    raise KontakteError(
                        "Es gibt bereits einen Hauptkontakt — bitte erneut versuchen.",
                        status_code=409,
                    ) from exc
                raise
            log.info(
                "kontakte_ansprechpartner_geaendert",
                tenant_id=tenant_id,
                customer_id=customer_id,
                contact_id=contact_id,
                felder=sorted(aenderung),
            )
        row = self._eigener_unterdatensatz(
            "customer_contacts", contact_id, tenant_id, customer_id, "Ansprechpartner"
        )
        return self._contact_antwort(row)

    def delete_contact(self, ctx: AuthContext, customer_id: str, contact_id: str) -> None:
        tenant_id = self._tenant(ctx)
        self._eigener_kunde(tenant_id, customer_id)
        self._eigener_unterdatensatz(
            "customer_contacts", contact_id, tenant_id, customer_id, "Ansprechpartner"
        )
        self._db.table("customer_contacts").delete().eq("id", contact_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info(
            "kontakte_ansprechpartner_geloescht",
            tenant_id=tenant_id,
            customer_id=customer_id,
            contact_id=contact_id,
        )

    # -------------------------------------------------------- Anschriften
    @staticmethod
    def _address_antwort(row: dict) -> AddressResponse:
        return AddressResponse(
            id=str(row["id"]),
            tenant_id=str(row["tenant_id"]),
            customer_id=str(row["customer_id"]),
            type=row["type"],
            label=row.get("label"),
            recipient=row.get("recipient"),
            street=row.get("street"),
            house_number=row.get("house_number"),
            postal_code=row.get("postal_code"),
            city=row.get("city"),
            country=row["country"],
            is_default=bool(row.get("is_default")),
            created_by=str(row["created_by"]) if row.get("created_by") else None,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def list_addresses(self, ctx: AuthContext, customer_id: str) -> list[AddressResponse]:
        tenant_id = self._tenant(ctx)
        self._eigener_kunde(tenant_id, customer_id)
        rows = self._liste("customer_addresses", tenant_id, customer_id, "created_at", desc=False)
        rows.sort(key=lambda r: (str(r.get("type")), not bool(r.get("is_default"))))
        return [self._address_antwort(r) for r in rows]

    def _standard_abraeumen(
        self, tenant_id: str, customer_id: str, typ: str, ausser: str | None
    ) -> None:
        """Gegenzustand (Wurzel 1): die bisherige Standardanschrift dieser Art
        verliert die Markierung."""
        q = (
            self._db.table("customer_addresses")
            .update({"is_default": False})
            .eq("tenant_id", tenant_id)
            .eq("customer_id", customer_id)
            .eq("type", typ)
            .eq("is_default", True)
        )
        if ausser:
            q = q.neq("id", ausser)
        q.execute()

    def create_address(
        self, ctx: AuthContext, customer_id: str, body: AddressCreate
    ) -> AddressResponse:
        tenant_id = self._tenant(ctx)
        self._eigener_kunde(tenant_id, customer_id)
        if body.is_default:
            self._standard_abraeumen(tenant_id, customer_id, body.type, None)
        zeile: dict[str, Any] = {
            "tenant_id": tenant_id,
            "customer_id": customer_id,
            "type": body.type,
            "label": body.label,
            "recipient": body.recipient,
            "street": body.street,
            "house_number": body.house_number,
            "postal_code": body.postal_code,
            "city": body.city,
            "country": body.country,
            "is_default": body.is_default,
            "created_by": ctx.user_id,
        }
        try:
            res = self._db.table("customer_addresses").insert(zeile).execute()
        except APIError as exc:
            if _ist_unique_verletzung(exc):
                raise KontakteError(
                    "Für diese Art gibt es bereits eine Standardanschrift — erneut versuchen.",
                    status_code=409,
                ) from exc
            raise
        neu = (res.data or [None])[0]
        if not neu:
            raise KontakteError("Anschrift konnte nicht gespeichert werden.", status_code=500)
        log.info(
            "kontakte_anschrift_angelegt",
            tenant_id=tenant_id,
            customer_id=customer_id,
            address_id=neu["id"],
            typ=body.type,
            is_default=body.is_default,
        )
        return self._address_antwort(neu)

    def update_address(
        self, ctx: AuthContext, customer_id: str, address_id: str, body: AddressUpdate
    ) -> AddressResponse:
        tenant_id = self._tenant(ctx)
        self._eigener_kunde(tenant_id, customer_id)
        row = self._eigener_unterdatensatz(
            "customer_addresses", address_id, tenant_id, customer_id, "Anschrift"
        )
        aenderung = body.model_dump(exclude_unset=True, by_alias=False)
        if "country" in aenderung and not aenderung["country"]:
            raise KontakteError("Land darf nicht leer sein.", status_code=422)
        if "type" in aenderung and aenderung["type"] is None:
            raise KontakteError("Art darf nicht leer sein.", status_code=422)
        neuer_typ = aenderung.get("type") or str(row["type"])
        wird_standard = aenderung.get("is_default") is True or (
            aenderung.get("is_default") is None
            and bool(row.get("is_default"))
            and neuer_typ != row["type"]
        )
        if wird_standard:
            self._standard_abraeumen(tenant_id, customer_id, neuer_typ, address_id)
        if aenderung:
            try:
                self._db.table("customer_addresses").update(aenderung).eq("id", address_id).eq(
                    "tenant_id", tenant_id
                ).execute()
            except APIError as exc:
                if _ist_unique_verletzung(exc):
                    raise KontakteError(
                        "Für diese Art gibt es bereits eine Standardanschrift — erneut versuchen.",
                        status_code=409,
                    ) from exc
                raise
            log.info(
                "kontakte_anschrift_geaendert",
                tenant_id=tenant_id,
                customer_id=customer_id,
                address_id=address_id,
                felder=sorted(aenderung),
            )
        row = self._eigener_unterdatensatz(
            "customer_addresses", address_id, tenant_id, customer_id, "Anschrift"
        )
        return self._address_antwort(row)

    def delete_address(self, ctx: AuthContext, customer_id: str, address_id: str) -> None:
        tenant_id = self._tenant(ctx)
        self._eigener_kunde(tenant_id, customer_id)
        self._eigener_unterdatensatz(
            "customer_addresses", address_id, tenant_id, customer_id, "Anschrift"
        )
        self._db.table("customer_addresses").delete().eq("id", address_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info(
            "kontakte_anschrift_geloescht",
            tenant_id=tenant_id,
            customer_id=customer_id,
            address_id=address_id,
        )

    # ------------------------------------------------------------ Notizen
    @staticmethod
    def _note_antwort(row: dict) -> NoteResponse:
        return NoteResponse(
            id=str(row["id"]),
            tenant_id=str(row["tenant_id"]),
            customer_id=str(row["customer_id"]),
            text=row["text"],
            tags=list(row.get("tags") or []),
            created_by=str(row["created_by"]) if row.get("created_by") else None,
            author_name=row.get("author_name"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def list_notes(self, ctx: AuthContext, customer_id: str) -> list[NoteResponse]:
        tenant_id = self._tenant(ctx)
        self._eigener_kunde(tenant_id, customer_id)
        rows = self._liste("customer_notes", tenant_id, customer_id, "created_at", desc=True)
        return [self._note_antwort(r) for r in rows]

    def create_note(self, ctx: AuthContext, customer_id: str, body: NoteCreate) -> NoteResponse:
        tenant_id = self._tenant(ctx)
        self._eigener_kunde(tenant_id, customer_id)
        zeile: dict[str, Any] = {
            "tenant_id": tenant_id,
            "customer_id": customer_id,
            "text": body.text,
            "tags": body.tags,
            "created_by": ctx.user_id,
            "author_name": self._autor_name(tenant_id, ctx.user_id),
        }
        res = self._db.table("customer_notes").insert(zeile).execute()
        neu = (res.data or [None])[0]
        if not neu:
            raise KontakteError("Notiz konnte nicht gespeichert werden.", status_code=500)
        log.info(
            "kontakte_notiz_angelegt",
            tenant_id=tenant_id,
            customer_id=customer_id,
            note_id=neu["id"],
            tags=len(body.tags),
        )
        return self._note_antwort(neu)

    def update_note(
        self, ctx: AuthContext, customer_id: str, note_id: str, body: NoteUpdate
    ) -> NoteResponse:
        tenant_id = self._tenant(ctx)
        self._eigener_kunde(tenant_id, customer_id)
        self._eigener_unterdatensatz("customer_notes", note_id, tenant_id, customer_id, "Notiz")
        aenderung = body.model_dump(exclude_unset=True, by_alias=False)
        if "text" in aenderung and not aenderung["text"]:
            raise KontakteError("Text darf nicht leer sein.", status_code=422)
        if "tags" in aenderung and aenderung["tags"] is None:
            aenderung["tags"] = []
        if aenderung:
            self._db.table("customer_notes").update(aenderung).eq("id", note_id).eq(
                "tenant_id", tenant_id
            ).execute()
            log.info(
                "kontakte_notiz_geaendert",
                tenant_id=tenant_id,
                customer_id=customer_id,
                note_id=note_id,
                felder=sorted(aenderung),
            )
        row = self._eigener_unterdatensatz(
            "customer_notes", note_id, tenant_id, customer_id, "Notiz"
        )
        return self._note_antwort(row)

    def delete_note(self, ctx: AuthContext, customer_id: str, note_id: str) -> None:
        tenant_id = self._tenant(ctx)
        self._eigener_kunde(tenant_id, customer_id)
        self._eigener_unterdatensatz("customer_notes", note_id, tenant_id, customer_id, "Notiz")
        self._db.table("customer_notes").delete().eq("id", note_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info(
            "kontakte_notiz_geloescht",
            tenant_id=tenant_id,
            customer_id=customer_id,
            note_id=note_id,
        )

    # ---------------------------------------------------------- Übersicht
    def _belege(self, tenant_id: str, customer_id: str) -> list[dict]:
        return (
            self._db.table("invoices")
            .select(
                "id, invoice_number, invoice_type, status, issue_date, due_date, "
                "gross_amount, paid_amount, currency, deleted_at, created_at"
            )
            .eq("tenant_id", tenant_id)
            .eq("customer_id", customer_id)
            .is_("deleted_at", "null")
            .order("issue_date", desc=True)
            .order("created_at", desc=True)
            .limit(KENNZAHLEN_CAP)
            .execute()
        ).data or []

    def _beleg_antwort(self, r: dict, heute: date) -> OverviewInvoice:
        brutto, bezahlt = _dec(r.get("gross_amount")), _dec(r.get("paid_amount"))
        status = str(r.get("status") or "")
        faellig = _datum(r.get("due_date"))
        offen_status = status in OFFENE_RECHNUNGSSTATUS
        return OverviewInvoice(
            id=str(r["id"]),
            invoice_number=r.get("invoice_number"),
            invoice_type=str(r.get("invoice_type") or "invoice"),
            status=status,
            issue_date=_datum(r.get("issue_date")),
            due_date=faellig,
            gross_amount=_q(brutto),
            paid_amount=_q(bezahlt),
            open_amount=_q(brutto - bezahlt) if offen_status else Decimal("0.00"),
            currency=str(r["currency"]),
            is_overdue=bool(offen_status and faellig is not None and faellig < heute),
            created_at=r.get("created_at"),
        )

    def get_overview(
        self, ctx: AuthContext, customer_id: str, *, limit: int | None = None
    ) -> CustomerOverview:
        """Kennzahlen je Währung + die letzten Belege des Kunden.

        Umsatz = Brutto aller Rechnungen (`invoice_type='invoice'`), die weder
        Entwurf noch storniert sind. Gutschriften und Storno-Belege zählen in
        `invoice_count`, aber nicht in den Umsatz — ob eine Gutschrift den
        Umsatz mindert, entscheidet der Bereich »berichte«, nicht diese Karte.
        Offen = gross − paid für Belege in OFFENE_RECHNUNGSSTATUS; überfällig =
        davon die mit Fälligkeit vor heute.
        """
        tenant_id = self._tenant(ctx)
        self._eigener_kunde(tenant_id, customer_id)
        limit = self._limit(limit)
        heute = self._heute()
        rows = self._belege(tenant_id, customer_id)

        ohne_waehrung = [str(r["id"]) for r in rows if not r.get("currency")]
        if ohne_waehrung:
            log.warning(
                "kontakte_rechnung_ohne_waehrung",
                tenant_id=tenant_id,
                customer_id=customer_id,
                invoice_ids=ohne_waehrung[:5],
            )
            raise KontakteError(
                f"{len(ohne_waehrung)} Beleg(e) ohne Währung — Datenfehler, Rechnungen prüfen.",
                status_code=422,
            )

        je_waehrung: dict[str, dict[str, Any]] = {}
        for r in rows:
            w = str(r["currency"])
            k = je_waehrung.setdefault(
                w,
                {
                    "revenue": Decimal("0"),
                    "open": Decimal("0"),
                    "overdue": Decimal("0"),
                    "count": 0,
                    "open_count": 0,
                    "overdue_count": 0,
                },
            )
            beleg = self._beleg_antwort(r, heute)
            k["count"] += 1
            if beleg.invoice_type == "invoice" and beleg.status not in KEIN_UMSATZ_STATUS:
                k["revenue"] += beleg.gross_amount
            if beleg.status in OFFENE_RECHNUNGSSTATUS and beleg.open_amount > 0:
                k["open"] += beleg.open_amount
                k["open_count"] += 1
                if beleg.is_overdue:
                    k["overdue"] += beleg.open_amount
                    k["overdue_count"] += 1

        letzter = rows[0] if rows else None
        notizen = self._liste("customer_notes", tenant_id, customer_id, "created_at", desc=True)
        tags: list[str] = []
        gesehen: set[str] = set()
        for n in notizen:
            for tag in n.get("tags") or []:
                if tag.casefold() not in gesehen:
                    gesehen.add(tag.casefold())
                    tags.append(tag)

        return CustomerOverview(
            customer_id=customer_id,
            by_currency=[
                WaehrungsKennzahlen(
                    currency=w,
                    revenue_total=_q(k["revenue"]),
                    open_amount=_q(k["open"]),
                    overdue_amount=_q(k["overdue"]),
                    invoice_count=k["count"],
                    open_count=k["open_count"],
                    overdue_count=k["overdue_count"],
                )
                for w, k in sorted(je_waehrung.items())
            ],
            invoice_count=len(rows),
            last_invoice_date=_datum(letzter.get("issue_date")) if letzter else None,
            last_invoice_number=letzter.get("invoice_number") if letzter else None,
            truncated=len(rows) >= KENNZAHLEN_CAP,
            contact_count=self._anzahl("customer_contacts", tenant_id, customer_id),
            address_count=self._anzahl("customer_addresses", tenant_id, customer_id),
            note_count=len(notizen),
            tags=tags,
            invoices=[self._beleg_antwort(r, heute) for r in rows[:limit]],
        )

    # -------------------------------------------------------- Lieferanten
    def list_suppliers(
        self,
        ctx: AuthContext,
        *,
        search: str | None = None,
        name: str | None = None,
        email: str | None = None,
        limit: int | None = None,
    ) -> list[dict]:
        """Lieferanten = Kunden mit `is_supplier`. Die Suche des Bestands wird
        aufgerufen, nicht kopiert — ein zweiter Filtercode driftet."""
        try:
            return self._bestand.search_customers(
                ctx, search=search, name=name, email=email, is_supplier=True, limit=limit
            )
        except BuchhaltungError as exc:
            raise KontakteError(exc.message, status_code=exc.status_code) from exc
