"""Service für die Reisebüro-/Partner-Kartei (travel_agencies).

Jede Query trägt den EXPLIZITEN Tenant-Scope (.eq("tenant_id", …)) — der
Service läuft mit dem Service-Role-Client, der RLS umgeht. Vertragsdateien
liegen im PRIVATEN Bucket agency-contracts; Downloads laufen ausschließlich
über zeitlich begrenzte signierte URLs aus diesem Service.
"""
import secrets
from datetime import date

from supabase import Client

from src.core.logging import get_logger

from .schemas import (
    AgencyCreate,
    AgencyUpdate,
    ContactCreate,
    ContractCreate,
    ContractUpdate,
    RateCreate,
)

log = get_logger("nextdays.travel_agencies")

# Erlaubte Vertragsdateien (Bucket-Allowlist spiegelt das serverseitig).
_CONTRACT_MIME_EXT: dict[str, str] = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
}
_CONTRACT_MAX_BYTES = 25 * 1024 * 1024  # 25 MB (Bucket-Limit)
_SIGNED_URL_TTL = 3600  # Sekunden


class TravelAgenciesError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class TravelAgenciesService:
    slice_name = "travel_agencies"
    CONTRACTS_BUCKET = "agency-contracts"

    def __init__(self, service_client: Client | None = None) -> None:
        self._db = service_client

    def _require_db(self) -> Client:
        if self._db is None:
            raise TravelAgenciesError("Datenbank nicht verfügbar.", status_code=500)
        return self._db

    # -- Guards (Tenant-Scope) ------------------------------------------------
    def _require_agency(self, tenant_id: str, agency_id: str) -> dict:
        rows = (
            self._require_db()
            .table("travel_agencies")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", agency_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise TravelAgenciesError("Reisebüro nicht gefunden.", status_code=404)
        return rows[0]

    def _require_contract(self, tenant_id: str, agency_id: str, contract_id: str) -> dict:
        rows = (
            self._require_db()
            .table("travel_agency_contracts")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("agency_id", agency_id)
            .eq("id", contract_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise TravelAgenciesError("Vertrag nicht gefunden.", status_code=404)
        return rows[0]

    def _require_own_property(self, tenant_id: str, property_id: str) -> None:
        rows = (
            self._require_db()
            .table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise TravelAgenciesError("Objekt nicht gefunden.", status_code=404)

    # -- Agenturen ------------------------------------------------------------
    def list_agencies(
        self, tenant_id: str, q: str | None = None, include_inactive: bool = False
    ) -> list[dict]:
        query = (
            self._require_db()
            .table("travel_agencies")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("name")
        )
        if not include_inactive:
            query = query.eq("is_active", True)
        if q:
            query = query.ilike("name", f"%{q}%")
        return query.execute().data or []

    def create_agency(self, tenant_id: str, data: AgencyCreate) -> dict:
        row = {**data.model_dump(mode="json"), "tenant_id": tenant_id}
        res = self._require_db().table("travel_agencies").insert(row).execute()
        if not res.data:
            raise TravelAgenciesError("Anlegen fehlgeschlagen.", status_code=500)
        log.info("travel_agency_created", tenant_id=tenant_id, agency_id=res.data[0]["id"])
        return res.data[0]

    def get_agency(self, tenant_id: str, agency_id: str) -> dict:
        return self._require_agency(tenant_id, agency_id)

    # Pflichtfelder (NOT NULL in der DB) — explizite null-PATCHes klar ablehnen
    # statt in eine DB-Constraint-Verletzung (500) zu laufen.
    _AGENCY_REQUIRED = ("name", "kind", "is_active")
    _CONTRACT_REQUIRED = ("title", "kind", "valid_from", "valid_to", "currency")

    @staticmethod
    def _reject_null_required(patch: dict, required: tuple[str, ...]) -> None:
        for field in required:
            if field in patch and patch[field] is None:
                raise TravelAgenciesError(f"{field} darf nicht leer sein.")

    def update_agency(self, tenant_id: str, agency_id: str, data: AgencyUpdate) -> dict:
        self._require_agency(tenant_id, agency_id)
        patch = data.model_dump(mode="json", exclude_unset=True)
        self._reject_null_required(patch, self._AGENCY_REQUIRED)
        if not patch:
            return self._require_agency(tenant_id, agency_id)
        res = (
            self._require_db()
            .table("travel_agencies")
            .update(patch)
            .eq("tenant_id", tenant_id)
            .eq("id", agency_id)
            .execute()
        )
        if not res.data:
            raise TravelAgenciesError("Aktualisieren fehlgeschlagen.", status_code=500)
        return res.data[0]

    def delete_agency(self, tenant_id: str, agency_id: str) -> None:
        """Partner löschen (Kontakte/Verträge/Raten via CASCADE). Vertrags-
        Dateien werden best-effort aus dem Storage entfernt."""
        self._require_agency(tenant_id, agency_id)
        contracts = (
            self._require_db()
            .table("travel_agency_contracts")
            .select("storage_path")
            .eq("tenant_id", tenant_id)
            .eq("agency_id", agency_id)
            .execute()
        ).data or []
        paths = [c["storage_path"] for c in contracts if c.get("storage_path")]
        if paths:
            try:
                self._require_db().storage.from_(self.CONTRACTS_BUCKET).remove(paths)
            except Exception as exc:  # noqa: BLE001 — Aufräumen darf das Löschen nie blockieren
                log.warning("agency_contract_files_cleanup_failed", error=str(exc))
        self._require_db().table("travel_agencies").delete().eq(
            "tenant_id", tenant_id
        ).eq("id", agency_id).execute()
        log.info("travel_agency_deleted", tenant_id=tenant_id, agency_id=agency_id)

    # -- Kontakte ---------------------------------------------------------------
    def list_contacts(self, tenant_id: str, agency_id: str) -> list[dict]:
        self._require_agency(tenant_id, agency_id)
        return (
            self._require_db()
            .table("travel_agency_contacts")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("agency_id", agency_id)
            .order("is_primary", desc=True)
            .order("name")
            .execute()
        ).data or []

    def add_contact(self, tenant_id: str, agency_id: str, data: ContactCreate) -> dict:
        self._require_agency(tenant_id, agency_id)
        row = {**data.model_dump(mode="json"), "tenant_id": tenant_id, "agency_id": agency_id}
        res = self._require_db().table("travel_agency_contacts").insert(row).execute()
        if not res.data:
            raise TravelAgenciesError("Anlegen fehlgeschlagen.", status_code=500)
        return res.data[0]

    def delete_contact(self, tenant_id: str, agency_id: str, contact_id: str) -> None:
        self._require_agency(tenant_id, agency_id)
        self._require_db().table("travel_agency_contacts").delete().eq(
            "tenant_id", tenant_id
        ).eq("agency_id", agency_id).eq("id", contact_id).execute()

    # -- Verträge (nach Jahren sortiert über valid_from) ------------------------
    def list_contracts(self, tenant_id: str, agency_id: str) -> list[dict]:
        self._require_agency(tenant_id, agency_id)
        return (
            self._require_db()
            .table("travel_agency_contracts")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("agency_id", agency_id)
            .order("valid_from", desc=True)
            .execute()
        ).data or []

    def add_contract(self, tenant_id: str, agency_id: str, data: ContractCreate) -> dict:
        self._require_agency(tenant_id, agency_id)
        row = {**data.model_dump(mode="json"), "tenant_id": tenant_id, "agency_id": agency_id}
        res = self._require_db().table("travel_agency_contracts").insert(row).execute()
        if not res.data:
            raise TravelAgenciesError("Anlegen fehlgeschlagen.", status_code=500)
        log.info(
            "travel_agency_contract_created",
            tenant_id=tenant_id, agency_id=agency_id, contract_id=res.data[0]["id"],
        )
        return res.data[0]

    def update_contract(
        self, tenant_id: str, agency_id: str, contract_id: str, data: ContractUpdate
    ) -> dict:
        current = self._require_contract(tenant_id, agency_id, contract_id)
        patch = data.model_dump(mode="json", exclude_unset=True)
        self._reject_null_required(patch, self._CONTRACT_REQUIRED)
        if not patch:
            return current
        # Gültigkeit auch über Feldgrenzen hinweg konsistent halten.
        valid_from = date.fromisoformat(str(patch.get("valid_from", current["valid_from"])))
        valid_to = date.fromisoformat(str(patch.get("valid_to", current["valid_to"])))
        if valid_to < valid_from:
            raise TravelAgenciesError("valid_to darf nicht vor valid_from liegen.")
        res = (
            self._require_db()
            .table("travel_agency_contracts")
            .update(patch)
            .eq("tenant_id", tenant_id)
            .eq("id", contract_id)
            .execute()
        )
        if not res.data:
            raise TravelAgenciesError("Aktualisieren fehlgeschlagen.", status_code=500)
        return res.data[0]

    def delete_contract(self, tenant_id: str, agency_id: str, contract_id: str) -> None:
        contract = self._require_contract(tenant_id, agency_id, contract_id)
        if contract.get("storage_path"):
            try:
                self._require_db().storage.from_(self.CONTRACTS_BUCKET).remove(
                    [contract["storage_path"]]
                )
            except Exception as exc:  # noqa: BLE001 — Aufräumen darf das Löschen nie blockieren
                log.warning("agency_contract_file_cleanup_failed", error=str(exc))
        self._require_db().table("travel_agency_contracts").delete().eq(
            "tenant_id", tenant_id
        ).eq("id", contract_id).execute()

    # -- Vertragsdatei (privater Bucket, signierte URLs) -------------------------
    def upload_contract_file(
        self,
        tenant_id: str,
        agency_id: str,
        contract_id: str,
        content: bytes,
        content_type: str,
        file_name: str | None,
    ) -> dict:
        contract = self._require_contract(tenant_id, agency_id, contract_id)
        ext = _CONTRACT_MIME_EXT.get(content_type)
        if not ext:
            raise TravelAgenciesError(
                "Nur PDF, JPEG, PNG, DOCX oder XLSX erlaubt.", status_code=415
            )
        if len(content) > _CONTRACT_MAX_BYTES:
            raise TravelAgenciesError("Datei ist zu groß (max. 25 MB).", status_code=413)
        path = f"{tenant_id}/{agency_id}/{contract_id}/{secrets.token_hex(8)}.{ext}"
        storage = self._require_db().storage.from_(self.CONTRACTS_BUCKET)
        try:
            storage.upload(path, content, {"content-type": content_type})
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich als 502
            log.warning("agency_contract_upload_failed", contract_id=contract_id, error=str(exc))
            raise TravelAgenciesError("Upload fehlgeschlagen.", status_code=502) from exc
        # ERST die DB auf die neue Datei zeigen lassen, DANN die alte Datei
        # aufräumen — schlüge das Update nach dem Löschen fehl, zeigte
        # storage_path auf eine bereits gelöschte Datei (Dokument verloren).
        res = (
            self._require_db()
            .table("travel_agency_contracts")
            .update({"storage_path": path, "file_name": file_name})
            .eq("tenant_id", tenant_id)
            .eq("id", contract_id)
            .execute()
        )
        if not res.data:
            raise TravelAgenciesError("Speichern fehlgeschlagen.", status_code=500)
        if contract.get("storage_path"):
            try:
                storage.remove([contract["storage_path"]])
            except Exception as exc:  # noqa: BLE001 — Altdatei-Cleanup ist best-effort
                log.warning("agency_contract_old_file_cleanup_failed", error=str(exc))
        log.info("agency_contract_uploaded", contract_id=contract_id)
        return res.data[0]

    def contract_file_url(
        self, tenant_id: str, agency_id: str, contract_id: str
    ) -> tuple[str, int]:
        """Signierte Download-URL (privater Bucket, zeitlich begrenzt)."""
        contract = self._require_contract(tenant_id, agency_id, contract_id)
        path = contract.get("storage_path")
        if not path:
            raise TravelAgenciesError("Kein Dokument hinterlegt.", status_code=404)
        try:
            signed = self._require_db().storage.from_(self.CONTRACTS_BUCKET).create_signed_url(
                path, _SIGNED_URL_TTL
            )
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich als 502
            log.warning("agency_contract_sign_failed", contract_id=contract_id, error=str(exc))
            raise TravelAgenciesError("Download nicht möglich.", status_code=502) from exc
        url = None
        if isinstance(signed, dict):
            # supabase-py-Versionen liefern den Key unterschiedlich benannt.
            url = signed.get("signedURL") or signed.get("signedUrl")
        if not url:
            raise TravelAgenciesError("Download nicht möglich.", status_code=502)
        return url, _SIGNED_URL_TTL

    # -- Saison-Preiszeilen am Vertrag (Rate-Sheet) ------------------------------
    def list_rates(self, tenant_id: str, agency_id: str, contract_id: str) -> list[dict]:
        self._require_contract(tenant_id, agency_id, contract_id)
        return (
            self._require_db()
            .table("travel_agency_rates")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("contract_id", contract_id)
            .order("season_start")
            .execute()
        ).data or []

    def add_rate(
        self, tenant_id: str, agency_id: str, contract_id: str, data: RateCreate
    ) -> dict:
        self._require_contract(tenant_id, agency_id, contract_id)
        self._require_own_property(tenant_id, data.property_id)
        row = {
            **data.model_dump(mode="json"),
            "tenant_id": tenant_id,
            "agency_id": agency_id,
            "contract_id": contract_id,
        }
        res = self._require_db().table("travel_agency_rates").insert(row).execute()
        if not res.data:
            raise TravelAgenciesError("Anlegen fehlgeschlagen.", status_code=500)
        return res.data[0]

    def delete_rate(
        self, tenant_id: str, agency_id: str, contract_id: str, rate_id: str
    ) -> None:
        self._require_contract(tenant_id, agency_id, contract_id)
        self._require_db().table("travel_agency_rates").delete().eq(
            "tenant_id", tenant_id
        ).eq("contract_id", contract_id).eq("id", rate_id).execute()
