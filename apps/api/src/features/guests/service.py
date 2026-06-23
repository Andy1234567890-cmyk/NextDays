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
            # Suche über Name/E-Mail/Telefon/Firma (case-insensitive).
            pattern = f"%{q}%"
            query = query.or_(
                f"name.ilike.{pattern},email.ilike.{pattern},"
                f"phone.ilike.{pattern},company.ilike.{pattern}"
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
        items = [
            GuestReservationItem(
                id=r["id"], property_id=r.get("property_id"),
                check_in=r.get("check_in"), check_out=r.get("check_out"),
                status=r.get("status"), channel=r.get("channel"),
                total_amount=mask.amount(
                    float(r["total_amount"]) if r.get("total_amount") is not None else None
                ),
                currency=(r.get("currency") if mask.amounts else None),
            )
            for r in (res.data or [])
        ]
        return ListResponse(items=items, total=len(items))

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

    def merge(self, ctx: AuthContext, source_id: str, target_id: str) -> dict:
        """Dubletten zusammenführen (Enterprise, TODO).

        Geplant: Sub-Ressourcen (Adressen/Kontakte/Dokumente/Notizen/Consents)
        + Reservierungen/Rechnungen von source → target umhängen, danach source
        anonymisieren/löschen. Bewusst noch nicht implementiert (kein Stub-
        Verhalten erfinden — Memory „keine Fallbacks").
        """
        self._require_tenant(ctx)
        raise GuestsError(
            "Zusammenführen ist noch nicht verfügbar.", status_code=501
        )

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
