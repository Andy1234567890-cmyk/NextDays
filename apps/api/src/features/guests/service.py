"""Service-Schicht für den guests-Slice (Enterprise-Gästekarte).

CRUD für Gast-Stammdaten + Sub-Ressourcen (Adressen, Kontakte, Identitäts-
dokumente, Präferenzen, Consents, Notizen, Dokumente) sowie Joins (Reservierungs-
historie, Posteingang-Threads, Rechnungen). Tenant-scoped: tenant_id immer aus
dem JWT, in jeder Query explizit gefiltert (nicht nur RLS).

Datensichtbarkeit über den zentralen guest_masking-Helper (DSGVO-Daten-Split) —
KEINE zweite Maskierungslogik. DSGVO-Löschung anonymisiert, wo Reservierungs-/
Rechnungsbezug besteht (statt hartem Delete).
"""
# Die Service-Methode `list` überschattet den built-in `list`; lazy-Annotations
# (PEP 563) lösen `list[str]` etc. erst zur Laufzeit auf → kein Namenskonflikt.
from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.auth.guest_masking import GuestMask, load_guest_mask

from .schemas import (
    AddressCreate,
    AddressResponse,
    ConsentCreate,
    ConsentListResponse,
    ConsentResponse,
    ContactCreate,
    ContactResponse,
    DocumentCreate,
    DocumentResponse,
    GuestCreate,
    GuestInvoiceItem,
    GuestListItem,
    GuestListResponse,
    GuestReservationItem,
    GuestResponse,
    GuestThreadItem,
    GuestUpdate,
    IdentityDocCreate,
    IdentityDocResponse,
    ListResponse,
    NoteCreate,
    NoteResponse,
    PreferencesBase,
    PreferencesResponse,
    SliceHealth,
)

log = get_logger("nextdays.guests")


def _or_ilike_term(q: str) -> str:
    """Suchbegriff für die PostgREST-``or``-Grammatik entschärfen (I-1).

    Roh eingesetzt könnte ``q`` mit ``,`` ``.`` ``(`` ``)`` die Filter-Struktur
    injizieren (Spalten-/Operator-Injection innerhalb des Tenants). Der Wert wird
    in Doppelquotes gesetzt — darin behandelt PostgREST die Grammatik-Trenner als
    Literale. Rohe ``"`` und ``\\`` würden den Quote-Kontext brechen und werden
    daher entfernt; LIKE-Wildcards ``%``/``_`` bleiben als Literale erhalten (der
    Nutzer sucht einen Teilstring, keine Wildcard-Semantik) — dazu werden sie
    entfernt, statt sie zu escapen, weil der Quote-Kontext keinen ESCAPE-Zusatz
    trägt. Fail-closed: der Begriff kann nur enger, nie breiter matchen."""
    safe = (
        q.replace("\\", "")
        .replace('"', "")
        .replace("%", "")
        .replace("_", " ")
    )
    return f'"%{safe}%"'


class GuestsError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class GuestsService:
    slice_name = "guests"

    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    # --- Infrastruktur ------------------------------------------------------
    def _db(self) -> Client:
        if self._client is None:
            raise GuestsError("Gäste-DB nicht verfügbar.", status_code=500)
        return self._client

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise GuestsError("Kein Tenant im Konto.", status_code=403)
        return ctx.tenant_id

    def _mask(self, ctx: AuthContext) -> GuestMask:
        return load_guest_mask(self._client, ctx.user_id)

    def _load_guest_row(self, tenant_id: str, guest_id: str) -> dict:
        """Gast-Zeile dieses Tenants laden (404, wenn fremd/fehlt)."""
        res = (
            self._db()
            .table("guests")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", guest_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise GuestsError("Gast nicht gefunden.", status_code=404)
        return res.data[0]

    # --- Liste / Suche ------------------------------------------------------
    def list(
        self, ctx: AuthContext, *, q: str | None = None, vip: str | None = None,
        segment: str | None = None, blocked: bool | None = None,
        limit: int = 50, offset: int = 0,
    ) -> GuestListResponse:
        tenant_id = self._require_tenant(ctx)
        mask = self._mask(ctx)
        query = (
            self._db()
            .table("guests")
            .select(
                "id, name, email, phone, company, vip_code, segment, is_blocked, "
                "stays_count, last_stay_at",
                count="exact",
            )
            .eq("tenant_id", tenant_id)
        )
        if vip:
            query = query.eq("vip_code", vip)
        if segment:
            query = query.eq("segment", segment)
        if blocked is not None:
            query = query.eq("is_blocked", blocked)
        if q:
            # Suche über Name/E-Mail/Telefon/Firma (case-insensitive). Der Term
            # wird für die or-Grammatik entschärft (I-1, Filter-Injection).
            term = _or_ilike_term(q)
            query = query.or_(
                f"name.ilike.{term},email.ilike.{term},"
                f"phone.ilike.{term},company.ilike.{term}"
            )
        res = (
            query.order("name").range(offset, offset + limit - 1).execute()
        )
        items = [
            GuestListItem(
                id=r["id"],
                name=mask.name(r.get("name")),
                email=mask.contact_value(r.get("email")),
                phone=mask.contact_value(r.get("phone")),
                company=r.get("company"),
                vip_code=r.get("vip_code"),
                segment=r.get("segment"),
                is_blocked=bool(r.get("is_blocked")),
                stays_count=r.get("stays_count") or 0,
                last_stay_at=r.get("last_stay_at"),
            )
            for r in (res.data or [])
        ]
        total = res.count if res.count is not None else len(items)
        return GuestListResponse(items=items, total=total)

    # --- Detail / CRUD ------------------------------------------------------
    def get(self, ctx: AuthContext, guest_id: str) -> GuestResponse:
        tenant_id = self._require_tenant(ctx)
        row = self._load_guest_row(tenant_id, guest_id)
        return self._to_response(row, self._mask(ctx))

    def create(self, ctx: AuthContext, req: GuestCreate) -> GuestResponse:
        tenant_id = self._require_tenant(ctx)
        payload = req.model_dump(exclude_none=True)
        # name ist NOT NULL → aus first/last_name ableiten, wenn nicht gesetzt.
        if not payload.get("name"):
            name = " ".join(
                x for x in [req.first_name, req.last_name] if x
            ).strip()
            payload["name"] = name or "—"
        payload = self._serialize_dates(payload)
        payload["tenant_id"] = tenant_id
        payload["created_by"] = ctx.user_id
        payload["updated_by"] = ctx.user_id
        ins = self._db().table("guests").insert(payload).execute()
        if not ins.data:
            raise GuestsError("Gast konnte nicht angelegt werden.", status_code=500)
        return self._to_response(ins.data[0], self._mask(ctx))

    def update(
        self, ctx: AuthContext, guest_id: str, req: GuestUpdate
    ) -> GuestResponse:
        tenant_id = self._require_tenant(ctx)
        self._load_guest_row(tenant_id, guest_id)
        patch = self._serialize_dates(req.model_dump(exclude_unset=True))
        patch["updated_by"] = ctx.user_id
        upd = (
            self._db()
            .table("guests")
            .update(patch)
            .eq("tenant_id", tenant_id)
            .eq("id", guest_id)
            .execute()
        )
        if not upd.data:
            raise GuestsError("Gast nicht gefunden.", status_code=404)
        return self._to_response(upd.data[0], self._mask(ctx))

    def delete(self, ctx: AuthContext, guest_id: str) -> dict:
        """DSGVO-Löschung. Mit Reservierungs-/Rechnungsbezug wird anonymisiert
        (PII genullt, anonymized_at gesetzt), sonst hart gelöscht."""
        tenant_id = self._require_tenant(ctx)
        self._load_guest_row(tenant_id, guest_id)
        has_refs = bool(
            (
                self._db()
                .table("reservations")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("guest_id", guest_id)
                .limit(1)
                .execute()
            ).data
        )
        if has_refs:
            anon = {
                "name": "Anonymisiert", "first_name": None, "last_name": None,
                "birth_name": None, "email": None, "phone": None,
                "birth_date": None, "birth_place": None, "company": None,
                "vat_id": None, "block_reason": None,
                "anonymized_at": datetime.now(UTC).isoformat(),
                "updated_by": ctx.user_id,
            }
            self._db().table("guests").update(anon).eq("tenant_id", tenant_id).eq(
                "id", guest_id
            ).execute()
            # Sensible Sub-Daten entfernen (Ausweis/Adressen/Kontakte/Dokumente).
            for tbl in (
                "guest_identity_documents", "guest_addresses", "guest_contacts",
                "guest_documents",
            ):
                self._db().table(tbl).delete().eq("tenant_id", tenant_id).eq(
                    "guest_id", guest_id
                ).execute()
            return {"anonymized": True}
        # Kein Bezug → hart löschen (Sub-Tabellen via ON DELETE CASCADE).
        self._db().table("guests").delete().eq("tenant_id", tenant_id).eq(
            "id", guest_id
        ).execute()
        return {"deleted": True}

    # --- Sub-Ressource: Adressen -------------------------------------------
    def list_addresses(self, ctx: AuthContext, guest_id: str) -> ListResponse:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        mask = self._mask(ctx)
        if not mask.contact:
            return ListResponse(items=[], total=0)
        res = (
            db.table("guest_addresses").select("*").eq("tenant_id", tenant_id)
            .eq("guest_id", guest_id).order("is_primary", desc=True).execute()
        )
        items = [self._address(r) for r in (res.data or [])]
        return ListResponse(items=items, total=len(items))

    def add_address(
        self, ctx: AuthContext, guest_id: str, req: AddressCreate
    ) -> AddressResponse:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        ins = db.table("guest_addresses").insert(
            {"tenant_id": tenant_id, "guest_id": guest_id, **req.model_dump()}
        ).execute()
        return self._address(ins.data[0])

    def delete_address(self, ctx: AuthContext, guest_id: str, addr_id: str) -> None:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        db.table("guest_addresses").delete().eq("tenant_id", tenant_id).eq(
            "guest_id", guest_id
        ).eq("id", addr_id).execute()

    # --- Sub-Ressource: Kontakte -------------------------------------------
    def list_contacts(self, ctx: AuthContext, guest_id: str) -> ListResponse:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        mask = self._mask(ctx)
        if not mask.contact:
            return ListResponse(items=[], total=0)
        res = (
            db.table("guest_contacts").select("*").eq("tenant_id", tenant_id)
            .eq("guest_id", guest_id).order("is_primary", desc=True).execute()
        )
        items = [self._contact(r) for r in (res.data or [])]
        return ListResponse(items=items, total=len(items))

    def add_contact(
        self, ctx: AuthContext, guest_id: str, req: ContactCreate
    ) -> ContactResponse:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        ins = db.table("guest_contacts").insert(
            {"tenant_id": tenant_id, "guest_id": guest_id, **req.model_dump()}
        ).execute()
        return self._contact(ins.data[0])

    def delete_contact(self, ctx: AuthContext, guest_id: str, cid: str) -> None:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        db.table("guest_contacts").delete().eq("tenant_id", tenant_id).eq(
            "guest_id", guest_id
        ).eq("id", cid).execute()

    # --- Sub-Ressource: Identitätsdokumente (DSGVO-sensibel) ---------------
    def list_identity_docs(self, ctx: AuthContext, guest_id: str) -> ListResponse:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        res = (
            db.table("guest_identity_documents").select("*")
            .eq("tenant_id", tenant_id).eq("guest_id", guest_id).execute()
        )
        mask = self._mask(ctx)
        items = [self._id_doc(r, mask) for r in (res.data or [])]
        return ListResponse(items=items, total=len(items))

    def add_identity_doc(
        self, ctx: AuthContext, guest_id: str, req: IdentityDocCreate
    ) -> IdentityDocResponse:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        mask = self._mask(ctx)
        if not mask.id_docs:
            raise GuestsError(
                "Keine Berechtigung für Ausweisdokumente.", status_code=403
            )
        payload = self._serialize_dates(req.model_dump())
        ins = db.table("guest_identity_documents").insert(
            {"tenant_id": tenant_id, "guest_id": guest_id, **payload}
        ).execute()
        return self._id_doc(ins.data[0], mask)

    def delete_identity_doc(self, ctx: AuthContext, guest_id: str, did: str) -> None:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        mask = self._mask(ctx)
        if not mask.id_docs:
            raise GuestsError(
                "Keine Berechtigung für Ausweisdokumente.", status_code=403
            )
        db.table("guest_identity_documents").delete().eq(
            "tenant_id", tenant_id
        ).eq("guest_id", guest_id).eq("id", did).execute()

    # --- Sub-Ressource: Präferenzen (1:1, upsert) --------------------------
    def get_preferences(self, ctx: AuthContext, guest_id: str) -> PreferencesResponse:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        res = (
            db.table("guest_preferences").select("*").eq("tenant_id", tenant_id)
            .eq("guest_id", guest_id).limit(1).execute()
        ).data
        if not res:
            return PreferencesResponse(guest_id=guest_id)
        r = res[0]
        return PreferencesResponse(guest_id=guest_id, **{
            k: r.get(k) for k in PreferencesBase.model_fields
        })

    def save_preferences(
        self, ctx: AuthContext, guest_id: str, req: PreferencesBase
    ) -> PreferencesResponse:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        db.table("guest_preferences").upsert(
            {"tenant_id": tenant_id, "guest_id": guest_id, **req.model_dump()},
            on_conflict="guest_id",
        ).execute()
        return PreferencesResponse(guest_id=guest_id, **req.model_dump())

    # --- Sub-Ressource: Consents (append-only) -----------------------------
    def list_consents(self, ctx: AuthContext, guest_id: str) -> ConsentListResponse:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        res = (
            db.table("guest_consents").select("*").eq("tenant_id", tenant_id)
            .eq("guest_id", guest_id).order("created_at", desc=True).execute()
        )
        items = [self._consent(r) for r in (res.data or [])]
        return ConsentListResponse(items=items, total=len(items))

    def add_consent(
        self, ctx: AuthContext, guest_id: str, req: ConsentCreate
    ) -> ConsentResponse:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        if req.status not in ("granted", "revoked"):
            raise GuestsError("Ungültiger Consent-Status.", status_code=422)
        payload = self._serialize_dates(req.model_dump())
        ins = db.table("guest_consents").insert(
            {
                "tenant_id": tenant_id, "guest_id": guest_id,
                "created_by": ctx.user_id, **payload,
            }
        ).execute()
        return self._consent(ins.data[0])

    # --- Sub-Ressource: Notizen (intern) -----------------------------------
    def list_notes(self, ctx: AuthContext, guest_id: str) -> ListResponse:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        res = (
            db.table("guest_notes").select("*").eq("tenant_id", tenant_id)
            .eq("guest_id", guest_id).order("created_at", desc=True).execute()
        )
        rows = res.data or []
        names = self._user_names(
            db, tenant_id, [r["author_id"] for r in rows if r.get("author_id")]
        )
        items = [
            NoteResponse(
                id=r["id"], guest_id=guest_id, author_id=r.get("author_id"),
                author_name=names.get(r.get("author_id")),
                category=r.get("category"), body=r.get("body") or "",
                created_at=r["created_at"],
            )
            for r in rows
        ]
        return ListResponse(items=items, total=len(items))

    def add_note(
        self, ctx: AuthContext, guest_id: str, req: NoteCreate
    ) -> NoteResponse:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        ins = db.table("guest_notes").insert(
            {
                "tenant_id": tenant_id, "guest_id": guest_id,
                "author_id": ctx.user_id, "body": req.body, "category": req.category,
            }
        ).execute()
        r = ins.data[0]
        names = self._user_names(db, tenant_id, [ctx.user_id] if ctx.user_id else [])
        return NoteResponse(
            id=r["id"], guest_id=guest_id, author_id=r.get("author_id"),
            author_name=names.get(ctx.user_id), category=r.get("category"),
            body=r.get("body") or "", created_at=r["created_at"],
        )

    def delete_note(self, ctx: AuthContext, guest_id: str, nid: str) -> None:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        db.table("guest_notes").delete().eq("tenant_id", tenant_id).eq(
            "guest_id", guest_id
        ).eq("id", nid).execute()

    # --- Sub-Ressource: Dokumente ------------------------------------------
    def list_documents(self, ctx: AuthContext, guest_id: str) -> ListResponse:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        res = (
            db.table("guest_documents").select("*").eq("tenant_id", tenant_id)
            .eq("guest_id", guest_id).order("created_at", desc=True).execute()
        )
        items = [self._document(r) for r in (res.data or [])]
        return ListResponse(items=items, total=len(items))

    def add_document(
        self, ctx: AuthContext, guest_id: str, req: DocumentCreate
    ) -> DocumentResponse:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        ins = db.table("guest_documents").insert(
            {
                "tenant_id": tenant_id, "guest_id": guest_id,
                "uploaded_by": ctx.user_id, **req.model_dump(),
            }
        ).execute()
        return self._document(ins.data[0])

    def delete_document(self, ctx: AuthContext, guest_id: str, did: str) -> None:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        db.table("guest_documents").delete().eq("tenant_id", tenant_id).eq(
            "guest_id", guest_id
        ).eq("id", did).execute()

    # --- Joins --------------------------------------------------------------
    def reservations(self, ctx: AuthContext, guest_id: str) -> ListResponse:
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        mask = self._mask(ctx)
        res = (
            db.table("reservations")
            .select("id, property_id, check_in, check_out, status, channel, "
                    "total_amount, currency")
            .eq("tenant_id", tenant_id).eq("guest_id", guest_id)
            .order("check_in", desc=True).execute()
        )
        rows = res.data or []
        addon_totals = self._addon_totals_for([str(r["id"]) for r in rows])
        items = [
            GuestReservationItem(
                id=r["id"], property_id=r.get("property_id"),
                check_in=r.get("check_in"), check_out=r.get("check_out"),
                status=r.get("status"), channel=r.get("channel"),
                total_amount=mask.amount(
                    float(r["total_amount"]) if r.get("total_amount") is not None else None
                ),
                currency=(r.get("currency") if mask.amounts else None),
                addons_total=mask.amount(addon_totals.get(str(r["id"]), 0.0)),
            )
            for r in rows
        ]
        return ListResponse(items=items, total=len(items))

    def _addon_totals_for(self, reservation_ids: list[str]) -> dict[str, float]:
        """Summe der nicht-stornierten Zusatzleistungen je Reservierung."""
        ids = [r for r in reservation_ids if r]
        if not ids:
            return {}
        try:
            rows = (
                self._db()
                .table("reservation_addons")
                .select("reservation_id, total, status")
                .in_("reservation_id", ids)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = keine Extras
            log.warning("guest_reservation_addons_unavailable", error=str(exc))
            return {}
        out: dict[str, float] = {}
        for a in rows:
            if (a.get("status") or "pending") == "cancelled":
                continue
            rid = str(a["reservation_id"])
            out[rid] = out.get(rid, 0.0) + float(a.get("total") or 0)
        return out

    def threads(self, ctx: AuthContext, guest_id: str) -> ListResponse:
        """Verknüpfte Posteingang-Threads (channex_booking) über den Gast.

        Direkter Link via channex_booking.guest_id (vom zentralen Resolver beim
        Ingest gesetzt). Robust auch ohne projizierte Reservierung — anders als
        die frühere Brücke über reservations.source_channex_booking_id.
        """
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        res = (
            db.table("channex_booking")
            .select("id, ota_name, ota_reservation_code, updated_at")
            .eq("tenant_id", tenant_id)
            .eq("guest_id", guest_id)
            .order("updated_at", desc=True)
            .execute()
        )
        items = [
            GuestThreadItem(
                id=r["id"], ota_name=r.get("ota_name"),
                ota_reservation_code=r.get("ota_reservation_code"),
                last_message_at=r.get("updated_at"),
            )
            for r in (res.data or [])
        ]
        return ListResponse(items=items, total=len(items))

    def invoices(self, ctx: AuthContext, guest_id: str) -> ListResponse:
        """Verknüpfte Rechnungen. Brücke: guest.email → customers.email →
        invoices.customer_id (es gibt keine guest_id auf customers/invoices)."""
        db, tenant_id = self._sub_ctx(ctx, guest_id)
        mask = self._mask(ctx)
        guest = self._load_guest_row(tenant_id, guest_id)
        email = (guest.get("email") or "").strip()
        if not email:
            return ListResponse(items=[], total=0)
        customer = (
            db.table("customers").select("id").eq("tenant_id", tenant_id)
            .eq("email", email).limit(1).execute()
        ).data
        if not customer:
            return ListResponse(items=[], total=0)
        res = (
            db.table("invoices")
            .select("id, invoice_number, status, issue_date, gross_amount, currency")
            .eq("tenant_id", tenant_id).eq("customer_id", customer[0]["id"])
            .order("issue_date", desc=True).execute()
        )
        items = [
            GuestInvoiceItem(
                id=r["id"], invoice_number=r.get("invoice_number"),
                status=r.get("status"), issue_date=r.get("issue_date"),
                gross_amount=mask.amount(
                    float(r["gross_amount"]) if r.get("gross_amount") is not None else None
                ),
                currency=(r.get("currency") if mask.amounts else None),
            )
            for r in (res.data or [])
        ]
        return ListResponse(items=items, total=len(items))

    # Sub-Ressourcen mit `guest_id`-Fremdschlüssel (n:1 zum Gast) — beim Merge
    # werden alle Zeilen von source → target umgehängt. `guest_preferences` ist
    # 1:1 (Unique auf guest_id) und `guest_external_ids` personenbezogen mit
    # Unique-Constraint — beide werden gesondert behandelt (s. merge()).
    _MERGE_REPARENT_TABLES = (
        "guest_addresses", "guest_contacts", "guest_documents",
        "guest_identity_documents", "guest_notes", "guest_consents",
        "reservations", "channex_booking", "whatsapp_conversation",
    )

    def merge(self, ctx: AuthContext, source_id: str, target_id: str) -> dict:
        """Dubletten zusammenführen: Sub-Ressourcen + Reservierungen/Buchungen
        von source → target umhängen, danach source anonymisieren.

        Rechnungen hängen NICHT am Gast, sondern über die E-Mail-Brücke am
        `customers`-Eintrag (s. invoices()); sie bleiben am Ziel automatisch
        sichtbar, sobald dessen E-Mail erhalten ist. `guest_preferences` ist
        1:1 — nur umhängen, wenn das Ziel noch keine hat, sonst die des Quell-
        Gastes verwerfen (Ziel-Präferenzen haben Vorrang).
        """
        tenant_id = self._require_tenant(ctx)
        if source_id == target_id:
            raise GuestsError(
                "Quelle und Ziel müssen verschieden sein.", status_code=400
            )
        # Beide Gäste müssen existieren und zum Tenant gehören (sonst 404).
        self._load_guest_row(tenant_id, source_id)
        self._load_guest_row(tenant_id, target_id)
        db = self._db()

        for tbl in self._MERGE_REPARENT_TABLES:
            db.table(tbl).update({"guest_id": target_id}).eq(
                "tenant_id", tenant_id
            ).eq("guest_id", source_id).execute()

        # guest_preferences (1:1): nur übernehmen, wenn das Ziel noch keine hat.
        target_has_prefs = bool(
            db.table("guest_preferences").select("guest_id")
            .eq("tenant_id", tenant_id).eq("guest_id", target_id)
            .limit(1).execute().data
        )
        if target_has_prefs:
            db.table("guest_preferences").delete().eq(
                "tenant_id", tenant_id
            ).eq("guest_id", source_id).execute()
        else:
            db.table("guest_preferences").update({"guest_id": target_id}).eq(
                "tenant_id", tenant_id
            ).eq("guest_id", source_id).execute()

        # guest_external_ids: gelten als personenbezogen und tragen ein Unique
        # (tenant, channel, external_id) — ein Umhängen kann mit den Kanal-IDs
        # des Ziel-Gastes kollidieren. Bei Anonymisierung werden sie ohnehin
        # gelöscht (DSGVO, s. Migration 0047), daher hier verwerfen.
        db.table("guest_external_ids").delete().eq(
            "tenant_id", tenant_id
        ).eq("guest_id", source_id).execute()

        # Quell-Gast anonymisieren (PII nullen, anonymized_at setzen) — die
        # Reservierungen hängen jetzt am Ziel, daher nicht hart löschen.
        db.table("guests").update({
            "name": "Zusammengeführt", "first_name": None, "last_name": None,
            "birth_name": None, "email": None, "phone": None,
            "birth_date": None, "birth_place": None, "company": None,
            "vat_id": None, "block_reason": None,
            "anonymized_at": datetime.now(UTC).isoformat(),
            "updated_by": ctx.user_id,
        }).eq("tenant_id", tenant_id).eq("id", source_id).execute()

        log.info(
            "guest_merged", tenant_id=tenant_id,
            source_id=source_id, target_id=target_id,
        )
        return {"merged": True, "target_id": target_id}

    # --- Helfer -------------------------------------------------------------
    def _sub_ctx(self, ctx: AuthContext, guest_id: str) -> tuple[Client, str]:
        """Gemeinsamer Einstieg für Sub-Ressourcen: Tenant + Gast-Existenz (404)."""
        tenant_id = self._require_tenant(ctx)
        self._load_guest_row(tenant_id, guest_id)  # 404, wenn fremd/fehlt
        return self._db(), tenant_id

    def _user_names(
        self, db: Client, tenant_id: str, user_ids: list[str]
    ) -> dict[str, str]:
        if not user_ids:
            return {}
        res = (
            db.table("users").select("id, full_name, email")
            .eq("tenant_id", tenant_id).in_("id", list(set(user_ids))).execute()
        )
        return {
            u["id"]: (u.get("full_name") or u.get("email") or "")
            for u in (res.data or [])
        }

    @staticmethod
    def _serialize_dates(payload: dict) -> dict:
        """date/datetime → ISO-String (Supabase-JSON)."""
        out = {}
        for k, v in payload.items():
            out[k] = v.isoformat() if hasattr(v, "isoformat") else v
        return out

    def _to_response(self, r: dict, mask: GuestMask) -> GuestResponse:
        return GuestResponse(
            id=r["id"], tenant_id=r["tenant_id"],
            name=mask.name(r.get("name")),
            salutation=r.get("salutation"), title=r.get("title"),
            first_name=r.get("first_name"),
            last_name=(r.get("last_name") if mask.full_name else None),
            birth_name=(r.get("birth_name") if mask.full_name else None),
            birth_date=r.get("birth_date"), birth_place=r.get("birth_place"),
            gender=r.get("gender"), nationality=r.get("nationality"),
            language=r.get("language"), currency=r.get("currency"),
            email=mask.contact_value(r.get("email")),
            phone=mask.contact_value(r.get("phone")),
            company=r.get("company"), position=r.get("position"),
            vat_id=r.get("vat_id"), vip_code=r.get("vip_code"),
            segment=r.get("segment"), source=mask.source_value(r.get("source")),
            is_blocked=bool(r.get("is_blocked")), block_reason=r.get("block_reason"),
            stays_count=r.get("stays_count") or 0,
            last_stay_at=r.get("last_stay_at"),
            total_revenue=mask.amount(
                float(r["total_revenue"]) if r.get("total_revenue") is not None else None
            ),
            anonymized_at=r.get("anonymized_at"),
            created_at=r["created_at"], updated_at=r["updated_at"],
        )

    @staticmethod
    def _address(r: dict) -> AddressResponse:
        return AddressResponse(
            id=r["id"], guest_id=r["guest_id"], type=r.get("type") or "private",
            street=r.get("street"), house_no=r.get("house_no"),
            postal_code=r.get("postal_code"), city=r.get("city"),
            country=r.get("country"), is_primary=bool(r.get("is_primary")),
        )

    @staticmethod
    def _contact(r: dict) -> ContactResponse:
        return ContactResponse(
            id=r["id"], guest_id=r["guest_id"], type=r.get("type") or "mobile",
            value=r.get("value") or "", is_primary=bool(r.get("is_primary")),
        )

    @staticmethod
    def _id_doc(r: dict, mask: GuestMask) -> IdentityDocResponse:
        return IdentityDocResponse(
            id=r["id"], guest_id=r["guest_id"], doc_type=r.get("doc_type") or "",
            number=mask.id_number(r.get("number")),
            issuing_country=r.get("issuing_country"),
            valid_until=r.get("valid_until"),
        )

    @staticmethod
    def _consent(r: dict) -> ConsentResponse:
        return ConsentResponse(
            id=r["id"], guest_id=r["guest_id"],
            consent_type=r.get("consent_type") or "", status=r.get("status") or "",
            source=r.get("source"), expires_at=r.get("expires_at"),
            created_at=r["created_at"],
        )

    @staticmethod
    def _document(r: dict) -> DocumentResponse:
        return DocumentResponse(
            id=r["id"], guest_id=r["guest_id"], name=r.get("name") or "",
            doc_type=r.get("doc_type"), storage_path=r.get("storage_path") or "",
            uploaded_by=r.get("uploaded_by"), created_at=r["created_at"],
        )


def recompute_guest_aggregates(db: Client, tenant_id: str, guest_id: str) -> None:
    """Loyalty-Aggregate eines Gastes (stays_count/total_revenue/last_stay_at)
    aus seinen Reservierungen neu berechnen und in die guests-Zeile schreiben.

    Single Source of Truth: wird nach jedem Anlegen/Stornieren einer Reservierung
    aufgerufen (reservations.create, booking_engine.create_public_booking,
    Storno). Stornierte Reservierungen zählen nicht; der Umsatz enthält den
    Mietbetrag plus die nicht-stornierten Zusatzleistungen (reservation_addons).
    Best-effort: Fehler werden geloggt, nicht propagiert (kein Buchungs-Abbruch).
    """
    if not guest_id:
        return
    try:
        res_rows = (
            db.table("reservations")
            .select("id, total_amount, status, check_out")
            .eq("tenant_id", tenant_id)
            .eq("guest_id", guest_id)
            .execute()
        ).data or []
        active = [r for r in res_rows if (r.get("status") or "") != "cancelled"]

        addon_by_res: dict[str, float] = {}
        res_ids = [str(r["id"]) for r in active]
        if res_ids:
            try:
                addon_rows = (
                    db.table("reservation_addons")
                    .select("reservation_id, total, status")
                    .in_("reservation_id", res_ids)
                    .execute()
                ).data or []
                for a in addon_rows:
                    if (a.get("status") or "pending") == "cancelled":
                        continue
                    rid = str(a["reservation_id"])
                    addon_by_res[rid] = addon_by_res.get(rid, 0.0) + float(
                        a.get("total") or 0
                    )
            except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = kein Extra
                log.warning("guest_addons_unavailable", error=str(exc))

        revenue = 0.0
        last_stay: str | None = None
        for r in active:
            revenue += float(r.get("total_amount") or 0)
            revenue += addon_by_res.get(str(r["id"]), 0.0)
            co = r.get("check_out")
            if co and (last_stay is None or str(co) > last_stay):
                last_stay = str(co)

        db.table("guests").update(
            {
                "stays_count": len(active),
                "total_revenue": round(revenue, 2),
                "last_stay_at": last_stay,
            }
        ).eq("tenant_id", tenant_id).eq("id", guest_id).execute()
        log.info(
            "guest_aggregates_recomputed",
            tenant_id=tenant_id,
            guest_id=guest_id,
            stays=len(active),
        )
    except Exception as exc:  # noqa: BLE001 — Aggregat-Fehler darf Buchung nicht killen
        log.warning("guest_aggregates_failed", guest_id=guest_id, error=str(exc))
