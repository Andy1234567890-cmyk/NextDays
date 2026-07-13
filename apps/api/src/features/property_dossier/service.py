"""Service für property_dossier (8-stufige Objektkartei, Lastenheft §6).

Läuft mit Service-Role (RLS umgangen) → JEDER Zugriff scopet EXPLIZIT über
property→tenant (Wurzel 3), sonst 404. Stufe 1 liefert den Eigentümer READ-ONLY
aus dem verknüpften owners-Datensatz (owner_properties) — die Kartei erfasst
keine Eigentümer-Stammdaten. Enum-Felder tragen sprachneutrale Keys (i18n).
"""

from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from pydantic import BaseModel
from supabase import Client

from src.core.logging import get_logger

from .schemas import (
    AccessData,
    DossierFull,
    EmergencyAuthority,
    HousebookData,
    LinkedOwner,
    MarketingData,
    PlatformLaunchBase,
    PlatformLaunchResponse,
    ProcessData,
    ServiceAgreementBase,
    ServiceAgreementResponse,
    SliceHealth,
    TradespersonBase,
    TradespersonResponse,
)

log = get_logger("nextdays.property_dossier")

_OWNER_COLS = (
    "id, name, company, email, phone, iban, bic, bank_name, account_holder, "
    "tax_id, vat_id, cpr_number"
)


class DossierError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class PropertyDossierService:
    slice_name = "property_dossier"

    def __init__(self, client: Client | None = None) -> None:
        self._client = client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _db(self) -> Client:
        if self._client is None:
            raise DossierError("Kartei-DB nicht verfügbar.", status_code=500)
        return self._client

    @staticmethod
    def _require_tenant(tenant_id: str | None) -> str:
        if not tenant_id:
            raise DossierError("Kein Tenant im Konto.", status_code=400)
        return tenant_id

    def _require_own_property(self, tenant_id: str, property_id: str) -> None:
        """Objekt MUSS dem Tenant gehören (sonst 404). Einziger Cross-Tenant-
        Schutz, da Service-Role RLS umgeht (Wurzel 3)."""
        try:
            UUID(str(property_id))
        except (ValueError, AttributeError, TypeError) as exc:
            raise DossierError("Objekt nicht gefunden.", status_code=404) from exc
        owned = (
            self._db()
            .table("properties")
            .select("id")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not owned:
            raise DossierError("Objekt nicht gefunden.", status_code=404)

    def _require_child(self, table: str, item_id: str, property_id: str) -> None:
        """Kind-Zeile MUSS zum (bereits geprüften) Objekt gehören."""
        try:
            UUID(str(item_id))
        except (ValueError, AttributeError, TypeError) as exc:
            raise DossierError("Eintrag nicht gefunden.", status_code=404) from exc
        found = (
            self._db()
            .table(table)
            .select("id")
            .eq("id", item_id)
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data
        if not found:
            raise DossierError("Eintrag nicht gefunden.", status_code=404)

    # --- generische Helfer -------------------------------------------------
    def _get_one(self, table: str, property_id: str) -> dict[str, Any]:
        rows = (
            self._db().table(table).select("*").eq("property_id", property_id).limit(1).execute()
        ).data
        return rows[0] if rows else {}

    def _upsert_one(self, table: str, property_id: str, payload: dict[str, Any]) -> None:
        self._db().table(table).upsert(
            {"property_id": property_id, **_dates(payload)}, on_conflict="property_id"
        ).execute()

    def _list(self, table: str, property_id: str) -> list[dict[str, Any]]:
        return (
            self._db()
            .table(table)
            .select("*")
            .eq("property_id", property_id)
            .order("created_at")
            .execute()
        ).data or []

    # --- Stufe 1: verknüpfter Eigentümer (read-only) -----------------------
    def get_owner(self, tenant_id: str | None, property_id: str) -> LinkedOwner | None:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        links = (
            self._db()
            .table("owner_properties")
            .select("owner_id, ownership_share")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data
        if not links:
            return None
        link = links[0]
        owners = (
            self._db()
            .table("owners")
            .select(_OWNER_COLS)
            .eq("id", link["owner_id"])
            .eq("tenant_id", tid)
            .limit(1)
            .execute()
        ).data
        if not owners:
            return None
        o = owners[0]
        return LinkedOwner(
            owner_id=o["id"],
            name=o["name"],
            company=o.get("company"),
            email=o.get("email"),
            phone=o.get("phone"),
            iban=o.get("iban"),
            bic=o.get("bic"),
            bank_name=o.get("bank_name"),
            account_holder=o.get("account_holder"),
            tax_id=o.get("tax_id"),
            vat_id=o.get("vat_id"),
            cpr_number=o.get("cpr_number"),
            ownership_share=link.get("ownership_share"),
        )

    # --- Stufe 2: Proces & Kontrakt ----------------------------------------
    def get_process(self, tenant_id: str | None, property_id: str) -> ProcessData:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        return ProcessData(**_only(self._get_one("property_process", property_id), ProcessData))

    def put_process(self, tenant_id: str | None, property_id: str, req: ProcessData) -> ProcessData:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        self._upsert_one("property_process", property_id, req.model_dump())
        return req

    # --- Stufe 3: Adgang & Teknik ------------------------------------------
    def get_access(self, tenant_id: str | None, property_id: str) -> AccessData:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        return AccessData(**_only(self._get_one("property_access", property_id), AccessData))

    def put_access(self, tenant_id: str | None, property_id: str, req: AccessData) -> AccessData:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        self._upsert_one("property_access", property_id, req.model_dump())
        return req

    # --- Stufe 4: Serviceaftaler (1:n) -------------------------------------
    def list_service_agreements(
        self, tenant_id: str | None, property_id: str
    ) -> list[ServiceAgreementResponse]:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        return [
            ServiceAgreementResponse(id=r["id"], **_only(r, ServiceAgreementBase))
            for r in self._list("property_service_agreements", property_id)
        ]

    def add_service_agreement(
        self, tenant_id: str | None, property_id: str, req: ServiceAgreementBase
    ) -> ServiceAgreementResponse:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        row = (
            self._db()
            .table("property_service_agreements")
            .insert({"property_id": property_id, **req.model_dump()})
            .execute()
        ).data[0]
        return ServiceAgreementResponse(id=row["id"], **_only(row, ServiceAgreementBase))

    def update_service_agreement(
        self, tenant_id: str | None, property_id: str, item_id: str, req: ServiceAgreementBase
    ) -> ServiceAgreementResponse:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        self._require_child("property_service_agreements", item_id, property_id)
        row = (
            self._db()
            .table("property_service_agreements")
            .update(req.model_dump())
            .eq("id", item_id)
            .eq("property_id", property_id)
            .execute()
        ).data[0]
        return ServiceAgreementResponse(id=row["id"], **_only(row, ServiceAgreementBase))

    def delete_service_agreement(
        self, tenant_id: str | None, property_id: str, item_id: str
    ) -> None:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        self._require_child("property_service_agreements", item_id, property_id)
        self._db().table("property_service_agreements").delete().eq("id", item_id).eq(
            "property_id", property_id
        ).execute()

    # --- Stufe 5: Håndværkere (1:n) + Vollmacht (1:1) ----------------------
    def list_tradespeople(
        self, tenant_id: str | None, property_id: str
    ) -> list[TradespersonResponse]:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        return [
            TradespersonResponse(id=r["id"], **_only(r, TradespersonBase))
            for r in self._list("property_tradespeople", property_id)
        ]

    def add_tradesperson(
        self, tenant_id: str | None, property_id: str, req: TradespersonBase
    ) -> TradespersonResponse:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        row = (
            self._db()
            .table("property_tradespeople")
            .insert({"property_id": property_id, **req.model_dump()})
            .execute()
        ).data[0]
        return TradespersonResponse(id=row["id"], **_only(row, TradespersonBase))

    def update_tradesperson(
        self, tenant_id: str | None, property_id: str, item_id: str, req: TradespersonBase
    ) -> TradespersonResponse:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        self._require_child("property_tradespeople", item_id, property_id)
        row = (
            self._db()
            .table("property_tradespeople")
            .update(req.model_dump())
            .eq("id", item_id)
            .eq("property_id", property_id)
            .execute()
        ).data[0]
        return TradespersonResponse(id=row["id"], **_only(row, TradespersonBase))

    def delete_tradesperson(self, tenant_id: str | None, property_id: str, item_id: str) -> None:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        self._require_child("property_tradespeople", item_id, property_id)
        self._db().table("property_tradespeople").delete().eq("id", item_id).eq(
            "property_id", property_id
        ).execute()

    def get_emergency_authority(
        self, tenant_id: str | None, property_id: str
    ) -> EmergencyAuthority:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        return EmergencyAuthority(
            **_only(self._get_one("property_emergency_authority", property_id), EmergencyAuthority)
        )

    def put_emergency_authority(
        self, tenant_id: str | None, property_id: str, req: EmergencyAuthority
    ) -> EmergencyAuthority:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        self._upsert_one("property_emergency_authority", property_id, req.model_dump())
        return req

    # --- Stufe 6: Markedsføring --------------------------------------------
    def get_marketing(self, tenant_id: str | None, property_id: str) -> MarketingData:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        return MarketingData(
            **_only(self._get_one("property_marketing", property_id), MarketingData)
        )

    def put_marketing(
        self, tenant_id: str | None, property_id: str, req: MarketingData
    ) -> MarketingData:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        self._upsert_one("property_marketing", property_id, req.model_dump())
        return req

    # --- Stufe 7: Husmappe -------------------------------------------------
    def get_housebook(self, tenant_id: str | None, property_id: str) -> HousebookData:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        row = self._get_one("property_housebook", property_id)
        return HousebookData(**_only(row, HousebookData)) if row else HousebookData()

    def put_housebook(
        self, tenant_id: str | None, property_id: str, req: HousebookData
    ) -> HousebookData:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        self._upsert_one("property_housebook", property_id, req.model_dump())
        return req

    # --- Stufe 8: Plattform-Launches (1:n) ---------------------------------
    def list_platform_launches(
        self, tenant_id: str | None, property_id: str
    ) -> list[PlatformLaunchResponse]:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        return [
            PlatformLaunchResponse(id=r["id"], **_only(r, PlatformLaunchBase))
            for r in self._list("property_platform_launches", property_id)
        ]

    def add_platform_launch(
        self, tenant_id: str | None, property_id: str, req: PlatformLaunchBase
    ) -> PlatformLaunchResponse:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        row = (
            self._db()
            .table("property_platform_launches")
            .insert({"property_id": property_id, **_dates(req.model_dump())})
            .execute()
        ).data[0]
        return PlatformLaunchResponse(id=row["id"], **_only(row, PlatformLaunchBase))

    def update_platform_launch(
        self, tenant_id: str | None, property_id: str, item_id: str, req: PlatformLaunchBase
    ) -> PlatformLaunchResponse:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        self._require_child("property_platform_launches", item_id, property_id)
        row = (
            self._db()
            .table("property_platform_launches")
            .update(_dates(req.model_dump()))
            .eq("id", item_id)
            .eq("property_id", property_id)
            .execute()
        ).data[0]
        return PlatformLaunchResponse(id=row["id"], **_only(row, PlatformLaunchBase))

    def delete_platform_launch(self, tenant_id: str | None, property_id: str, item_id: str) -> None:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        self._require_child("property_platform_launches", item_id, property_id)
        self._db().table("property_platform_launches").delete().eq("id", item_id).eq(
            "property_id", property_id
        ).execute()

    # --- Aggregat ----------------------------------------------------------
    def get_full(self, tenant_id: str | None, property_id: str) -> DossierFull:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        return DossierFull(
            owner=self.get_owner(tid, property_id),
            process=self.get_process(tid, property_id),
            access=self.get_access(tid, property_id),
            service_agreements=self.list_service_agreements(tid, property_id),
            tradespeople=self.list_tradespeople(tid, property_id),
            emergency_authority=self.get_emergency_authority(tid, property_id),
            marketing=self.get_marketing(tid, property_id),
            housebook=self.get_housebook(tid, property_id),
            platform_launches=self.list_platform_launches(tid, property_id),
        )


def _only(row: dict[str, Any], model: type[BaseModel]) -> dict[str, Any]:
    """Nur die Modell-Felder aus der DB-Zeile (id/property_id/timestamps raus),
    None-Werte weglassen, damit Schema-Defaults greifen."""
    keys = model.model_fields.keys()
    return {k: row[k] for k in keys if row.get(k) is not None}


def _dates(payload: dict[str, Any]) -> dict[str, Any]:
    """date-Werte für den PostgREST-JSON-Body auf ISO-Strings bringen."""
    return {k: (v.isoformat() if isinstance(v, date) else v) for k, v in payload.items()}
