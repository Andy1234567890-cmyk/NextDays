"""Leads (Eigentümer-Akquise): Liste, CRUD, Notizen-Verlauf, Konvertierung.

Mixin des CrmService (service.py). Jede Query trägt den EXPLIZITEN Tenant-Scope,
per-ID-Zugriffe laufen über `load_scoped` (Wurzel 3) — der Service arbeitet mit
der Service-Role, die RLS umgeht.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import escape_like, load_scoped
from src.features.owners.schemas import OwnerCreate, OwnerPropertyAssign
from src.features.owners.service import OwnerError, OwnersService
from src.features.properties.errors import PropertyError
from src.features.properties.schemas import PropertyCreate
from src.features.properties.service import PropertiesService

from .common import LEAD_TRANSITIONS, LEADS_LIMIT_MAX, CrmError
from .schemas import (
    LeadConvertRequest,
    LeadConvertResponse,
    LeadCreate,
    LeadListResponse,
    LeadNoteCreate,
    LeadNoteResponse,
    LeadResponse,
    LeadUpdate,
)

log = get_logger("nextdays.crm.leads")

_LEAD_NOT_FOUND = "Lead nicht gefunden."

# Zeichen, die in einem PostgREST-`or`-Filter Struktur tragen. Sie aus der
# Suche zu entfernen ist keine Einschränkung des Nutzers (niemand sucht nach
# einer Klammer im Namen), aber schließt den Filter-Injektionspfad (Wurzel 8).
_OR_STRUKTUR = str.maketrans("", "", ",().")


def _lead_row(row: dict[str, Any]) -> LeadResponse:
    return LeadResponse(**{k: row.get(k) for k in LeadResponse.model_fields if k in row})


def _note_row(row: dict[str, Any]) -> LeadNoteResponse:
    return LeadNoteResponse(**{k: row.get(k) for k in LeadNoteResponse.model_fields if k in row})


class LeadsMixin:
    """Leads + Notizen + Konvertierung. Nutzt `self._db` vom CrmService."""

    _db: Client

    # -- Guards ------------------------------------------------------------------
    def _require_lead(self, tenant_id: str, lead_id: str) -> dict[str, Any]:
        return load_scoped(
            self._db, "leads", lead_id, tenant_id,
            not_found=CrmError(_LEAD_NOT_FOUND, status_code=404),
        )

    def _require_tenant_user(self, tenant_id: str, user_id: str | None) -> None:
        """Zuständiger MUSS ein Nutzer DIESES Betriebs sein — sonst wäre die
        Zuordnung an eine fremde ID ein Datenfehler, den niemand sieht."""
        if user_id is None:
            return
        rows = (
            self._db.table("users")
            .select("id")
            .eq("id", user_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise CrmError(
                "Der zuständige Nutzer gehört nicht zu diesem Betrieb.", status_code=422
            )

    # -- Liste -------------------------------------------------------------------
    def list_leads(  # pylint: disable=too-many-arguments
        self,
        tenant_id: str,
        *,
        status: str | None = None,
        lead_source: str | None = None,
        assigned_user_id: str | None = None,
        q: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> LeadListResponse:
        if offset < 0 or limit < 1 or limit > LEADS_LIMIT_MAX:
            raise CrmError(
                f"offset ≥ 0 und 1 ≤ limit ≤ {LEADS_LIMIT_MAX} erwartet.", status_code=422
            )
        query = (
            self._db.table("leads")
            .select("*", count="exact")
            .eq("tenant_id", tenant_id)
        )
        if status:
            query = query.eq("status", status)
        if lead_source:
            query = query.eq("lead_source", lead_source)
        if assigned_user_id:
            query = query.eq("assigned_user_id", assigned_user_id)
        if q and q.strip():
            needle = escape_like(q.strip().translate(_OR_STRUKTUR))
            if needle:
                query = query.or_(
                    f"name.ilike.%{needle}%,email.ilike.%{needle}%,"
                    f"city.ilike.%{needle}%,object_city.ilike.%{needle}%"
                )
        res = (
            query.order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        rows = res.data or []
        total = res.count if res.count is not None else offset + len(rows)
        return LeadListResponse(
            items=[_lead_row(r) for r in rows], total=total, offset=offset, limit=limit
        )

    # -- CRUD --------------------------------------------------------------------
    def create_lead(self, ctx: AuthContext, tenant_id: str, req: LeadCreate) -> LeadResponse:
        payload = req.model_dump(mode="json", exclude={"erste_notiz"})
        self._require_tenant_user(tenant_id, payload.get("assigned_user_id"))
        # Status IMMER `new` — der Workflow beginnt vorn (Wurzel 3: der Anfrage
        # nicht vertrauen, auch wenn das Schema den Status gar nicht annimmt).
        payload.update(tenant_id=tenant_id, status="new")
        res = self._db.table("leads").insert(payload).execute()
        if not res.data:
            raise CrmError("Lead konnte nicht angelegt werden.", status_code=500)
        row = res.data[0]
        log.info(
            "crm_lead_created", tenant_id=tenant_id, lead_id=row["id"],
            lead_source=row.get("lead_source"), by=ctx.user_id,
        )
        if req.erste_notiz and req.erste_notiz.strip():
            self._insert_note(ctx, tenant_id, row["id"], req.erste_notiz.strip())
        return _lead_row(row)

    def get_lead(self, tenant_id: str, lead_id: str) -> LeadResponse:
        return _lead_row(self._require_lead(tenant_id, lead_id))

    def update_lead(
        self, ctx: AuthContext, tenant_id: str, lead_id: str, req: LeadUpdate
    ) -> LeadResponse:
        row = self._require_lead(tenant_id, lead_id)
        changes = req.model_dump(mode="json", exclude_unset=True)
        if not changes:
            return _lead_row(row)
        if "assigned_user_id" in changes:
            self._require_tenant_user(tenant_id, changes["assigned_user_id"])
        self._status_uebergang_pruefen(row, changes)
        res = (
            self._db.table("leads")
            .update(changes)
            .eq("id", lead_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise CrmError(_LEAD_NOT_FOUND, status_code=404)
        log.info(
            "crm_lead_updated", tenant_id=tenant_id, lead_id=lead_id,
            felder=sorted(changes), status=res.data[0].get("status"), by=ctx.user_id,
        )
        return _lead_row(res.data[0])

    @staticmethod
    def _status_uebergang_pruefen(row: dict[str, Any], changes: dict[str, Any]) -> None:
        """Zustandsgraph erzwingen; `lost` braucht einen Grund, jeder andere
        Status trägt keinen (CHECK `leads_lost_reason_only_when_lost`)."""
        alt = row.get("status")
        neu = changes.get("status")
        if neu is None or neu == alt:
            # Grund ohne Verlust-Status ist ein Widerspruch, den die DB als 500
            # quittieren würde — hier als 422 benennen.
            if changes.get("lost_reason") and alt != "lost":
                raise CrmError(
                    "lost_reason gibt es nur für verlorene Leads (status='lost').",
                    status_code=422,
                )
            return
        if neu == "won":
            raise CrmError(
                "Gewonnen wird ein Lead nur über die Konvertierung "
                "(POST /crm/leads/{id}/convert) — sie legt den Eigentümer an.",
                status_code=422,
            )
        erlaubt = LEAD_TRANSITIONS.get(alt or "", frozenset())
        if neu not in erlaubt:
            raise CrmError(
                f"Statuswechsel {alt} → {neu} ist nicht vorgesehen. "
                f"Erlaubt: {', '.join(sorted(erlaubt)) or 'keiner (Endzustand)'}.",
                status_code=422,
                details={"von": alt, "nach": neu, "erlaubt": sorted(erlaubt)},
            )
        if neu == "lost":
            grund = changes.get("lost_reason") or row.get("lost_reason")
            if not (grund and str(grund).strip()):
                raise CrmError(
                    "Ein verlorener Lead braucht einen Grund (lost_reason).",
                    status_code=422,
                    details={"fehlende_felder": ["lost_reason"]},
                )
        else:
            changes["lost_reason"] = None

    def delete_lead(self, ctx: AuthContext, tenant_id: str, lead_id: str) -> None:
        self._require_lead(tenant_id, lead_id)
        # Notizen fallen per FK-Cascade (0597) mit — ein Eigentümer/Objekt aus
        # einer Konvertierung bleibt bestehen: das sind die echten Datensätze,
        # der Lead war nur der Weg dahin.
        self._db.table("leads").delete().eq("id", lead_id).eq("tenant_id", tenant_id).execute()
        log.info("crm_lead_deleted", tenant_id=tenant_id, lead_id=lead_id, by=ctx.user_id)

    # -- Notizen (append-only) ---------------------------------------------------
    def list_notes(self, tenant_id: str, lead_id: str) -> list[LeadNoteResponse]:
        self._require_lead(tenant_id, lead_id)
        rows = (
            self._db.table("lead_notes")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("lead_id", lead_id)
            .order("created_at", desc=True)
            .execute()
        ).data or []
        return [_note_row(r) for r in rows]

    def add_note(
        self, ctx: AuthContext, tenant_id: str, lead_id: str, req: LeadNoteCreate
    ) -> LeadNoteResponse:
        self._require_lead(tenant_id, lead_id)
        return self._insert_note(ctx, tenant_id, lead_id, req.body)

    def _insert_note(
        self, ctx: AuthContext, tenant_id: str, lead_id: str, body: str
    ) -> LeadNoteResponse:
        res = (
            self._db.table("lead_notes")
            .insert({
                "tenant_id": tenant_id,
                "lead_id": lead_id,
                "author_id": ctx.user_id,
                "body": body,
            })
            .execute()
        )
        if not res.data:
            raise CrmError("Notiz konnte nicht gespeichert werden.", status_code=500)
        log.info("crm_lead_note_added", tenant_id=tenant_id, lead_id=lead_id, by=ctx.user_id)
        return _note_row(res.data[0])

    # -- Konvertierung: Lead → Eigentümer (+ Objekt) -----------------------------
    def convert_lead(
        self, ctx: AuthContext, tenant_id: str, lead_id: str, req: LeadConvertRequest
    ) -> LeadConvertResponse:
        """Aus dem Lead einen Eigentümer und optional ein Objekt-Gerüst machen.

        Idempotent (Wurzel 2): steht `converted_owner_id`/`converted_property_id`
        schon am Lead, werden GENAU diese IDs zurückgegeben. Das Rennen zweier
        gleichzeitiger Aufrufe entscheidet ein bedingtes Update
        (`converted_owner_id is null`); der Verlierer räumt seine eben angelegte
        Zeile wieder ab. Wiederverwendet die Services der Slices owners und
        properties — keine zweite Anlage-Logik inline.
        """
        lead = self._require_lead(tenant_id, lead_id)
        if lead.get("status") == "lost":
            raise CrmError(
                "Ein verlorener Lead wird nicht konvertiert — erst wieder öffnen "
                "(status='contacted').",
                status_code=409,
            )
        self._konvertierung_pflichtfelder(lead, req)

        owners = OwnersService(service_client=self._db)
        bereits = True
        owner_id = lead.get("converted_owner_id")
        if not owner_id:
            bereits = False
            owner_id = self._eigentuemer_anlegen(ctx, tenant_id, lead, req, owners)
            lead = self._require_lead(tenant_id, lead_id)
            if lead.get("converted_owner_id") != owner_id:
                # Rennen verloren: ein paralleler Aufruf hat zuerst geschrieben.
                # Der eigene Eigentümer ist überzählig → weg (frisch, ohne
                # Objekte und Eigennutzungen, also ohne 409-Rückfrage).
                log.warning(
                    "crm_lead_convert_race_lost", tenant_id=tenant_id, lead_id=lead_id,
                    verworfen_owner_id=owner_id, gewinner=lead.get("converted_owner_id"),
                )
                owners.delete(ctx, owner_id)
                owner_id = str(lead["converted_owner_id"])
                bereits = True

        property_id = lead.get("converted_property_id")
        if req.mit_objekt and not property_id:
            bereits = False
            property_id = self._objekt_anlegen(ctx, tenant_id, lead, req, owners, owner_id)
            lead = self._require_lead(tenant_id, lead_id)

        log.info(
            "crm_lead_converted", tenant_id=tenant_id, lead_id=lead_id,
            owner_id=owner_id, property_id=property_id, bereits=bereits, by=ctx.user_id,
        )
        return LeadConvertResponse(
            lead=_lead_row(lead),
            owner_id=str(owner_id),
            property_id=str(property_id) if property_id else None,
            bereits_konvertiert=bereits,
        )

    @staticmethod
    def _konvertierung_pflichtfelder(lead: dict[str, Any], req: LeadConvertRequest) -> None:
        """Was das Objekt braucht und weder Lead noch Anfrage tragen → 422 mit
        Liste, KEIN erfundener Titel/Typ/Kapazität (Wurzel 4)."""
        fehlend: list[str] = []
        if req.mit_objekt and not lead.get("converted_property_id"):
            if not (req.property_title and req.property_title.strip()):
                fehlend.append("property_title")
            if req.property_type is None:
                fehlend.append("property_type")
            if not lead.get("object_max_guests"):
                fehlend.append("object_max_guests")
        if req.portalzugang and not (lead.get("email") or "").strip():
            fehlend.append("email")
        if fehlend:
            raise CrmError(
                "Für die Konvertierung fehlen Angaben: " + ", ".join(fehlend) + ".",
                status_code=422,
                details={"fehlende_felder": fehlend},
            )

    def _eigentuemer_anlegen(  # pylint: disable=too-many-arguments
        self,
        ctx: AuthContext,
        tenant_id: str,
        lead: dict[str, Any],
        req: LeadConvertRequest,
        owners: OwnersService,
    ) -> str:
        owner_req = OwnerCreate(
            name=lead["name"],
            email=lead.get("email"),
            phone=lead.get("phone"),
            street=lead.get("street"),
            house_number=lead.get("house_number"),
            postal_code=lead.get("postal_code"),
            city=lead.get("city"),
            country=lead.get("country"),
            default_commission_pct=req.default_commission_pct,
            notes=lead.get("notes"),
            portalzugang=req.portalzugang,
        )
        try:
            owner = owners.create(ctx, owner_req)
        except OwnerError as exc:
            raise CrmError(
                f"Eigentümer konnte nicht angelegt werden: {exc.message}",
                status_code=exc.status_code, details=exc.details,
            ) from exc
        owner_id = str(owner.id)
        # Bedingtes Update = der Claim (Wurzel 2). `won` und die Owner-ID in
        # EINEM Schritt, damit CHECK `leads_won_has_owner` nie dazwischen greift.
        self._db.table("leads").update({
            "converted_owner_id": owner_id,
            "status": "won",
            "lost_reason": None,
        }).eq("id", lead["id"]).eq("tenant_id", tenant_id).is_(
            "converted_owner_id", "null"
        ).execute()
        return owner_id

    def _objekt_anlegen(  # pylint: disable=too-many-arguments
        self,
        ctx: AuthContext,
        tenant_id: str,
        lead: dict[str, Any],
        req: LeadConvertRequest,
        owners: OwnersService,
        owner_id: str,
    ) -> str:
        sqm = lead.get("object_sqm")
        prop_req = PropertyCreate(
            title=str(req.property_title).strip(),
            property_type=req.property_type,  # type: ignore[arg-type]
            max_guests=int(lead["object_max_guests"]),
            size_value=float(sqm) if sqm else None,
            size_unit="sqm" if sqm else None,
            street=lead.get("object_street"),
            house_number=lead.get("object_house_number"),
            postal_code=lead.get("object_postal_code"),
            city=lead.get("object_city"),
            country=lead.get("object_country"),
        )
        properties = PropertiesService(service_client=self._db)
        try:
            prop = properties.create(ctx, prop_req)
        except PropertyError as exc:
            raise CrmError(
                f"Objekt konnte nicht angelegt werden: {exc.message}",
                status_code=exc.status_code, details=exc.details,
            ) from exc
        property_id = str(prop.id)
        res = self._db.table("leads").update({
            "converted_property_id": property_id,
        }).eq("id", lead["id"]).eq("tenant_id", tenant_id).is_(
            "converted_property_id", "null"
        ).execute()
        if not res.data:
            # Rennen verloren — das eigene Objekt ist überzählig (frisch, ohne
            # Buchungen; der Löschschutz greift nicht).
            log.warning(
                "crm_lead_convert_property_race_lost", tenant_id=tenant_id,
                lead_id=lead["id"], verworfen_property_id=property_id,
            )
            properties.delete(ctx, property_id)
            aktuell = self._require_lead(tenant_id, lead["id"])
            return str(aktuell["converted_property_id"])
        try:
            owners.assign_property(ctx, owner_id, OwnerPropertyAssign(property_id=property_id))
        except OwnerError as exc:
            raise CrmError(
                f"Objekt angelegt, Zuordnung zum Eigentümer fehlgeschlagen: {exc.message}",
                status_code=exc.status_code, details=exc.details,
            ) from exc
        return property_id
