"""Partner & Deals (B2B-Rabatte, Lastenheft §2.6): CRUD, QR-Upload, QR-Erzeugung.

Mixin des CrmService (service.py). Deals tragen seit 0597 ihre eigene
`tenant_id`; jeder per-ID-Zugriff läuft über `load_scoped` (Wurzel 3). QR-Bilder
liegen im PRIVATEN Bucket `partner-deals` (0598) und verlassen den Server nur
als kurzlebige signierte URL.
"""
from __future__ import annotations

import secrets
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.supabase import escape_like, load_scoped

from .common import CrmError
from .dateien import QR_BUCKET, QR_SIGNED_URL_TTL, qr_datei_pruefen, qr_png_aus_code
from .schemas import (
    DealBase,
    DealCreate,
    DealResponse,
    DealUpdate,
    PartnerCreate,
    PartnerResponse,
    PartnerUpdate,
)

log = get_logger("nextdays.crm.partners")

_PARTNER_NOT_FOUND = "Partner nicht gefunden."
_DEAL_NOT_FOUND = "Deal nicht gefunden."
# Postgres: Unique-Verletzung. Auf `deals` heißt das genau eines:
# `deals_tenant_discount_code_key` (0597) — der Code ist im Betrieb vergeben.
_UNIQUE_VERLETZUNG = "23505"

_DEAL_COLS = tuple(DealBase.model_fields)


def _partner_row(row: dict[str, Any]) -> PartnerResponse:
    return PartnerResponse(**{k: row.get(k) for k in PartnerResponse.model_fields if k in row})


def _deal_row(row: dict[str, Any]) -> DealResponse:
    daten = {k: row.get(k) for k in DealResponse.model_fields if k in row}
    daten["hat_qr_bild"] = bool(row.get("qr_code_path"))
    daten["discount_value"] = float(row.get("discount_value") or 0)
    return DealResponse(**daten)


class PartnersMixin:
    """Partner + Deals + QR. Nutzt `self._db` vom CrmService."""

    _db: Client

    # -- Guards ------------------------------------------------------------------
    def _require_partner(self, tenant_id: str, partner_id: str) -> dict[str, Any]:
        return load_scoped(
            self._db, "partners", partner_id, tenant_id,
            not_found=CrmError(_PARTNER_NOT_FOUND, status_code=404),
        )

    def _require_deal(self, tenant_id: str, deal_id: str) -> dict[str, Any]:
        return load_scoped(
            self._db, "deals", deal_id, tenant_id,
            not_found=CrmError(_DEAL_NOT_FOUND, status_code=404),
        )

    # -- Partner -----------------------------------------------------------------
    def list_partners(self, tenant_id: str, q: str | None = None) -> list[PartnerResponse]:
        query = self._db.table("partners").select("*").eq("tenant_id", tenant_id).order("name")
        if q and q.strip():
            query = query.ilike("name", f"%{escape_like(q.strip())}%")
        rows = query.execute().data or []
        return [_partner_row(r) for r in rows]

    def create_partner(self, tenant_id: str, req: PartnerCreate, *, by: str) -> PartnerResponse:
        payload = {**req.model_dump(mode="json"), "tenant_id": tenant_id}
        res = self._db.table("partners").insert(payload).execute()
        if not res.data:
            raise CrmError("Partner konnte nicht angelegt werden.", status_code=500)
        log.info("crm_partner_created", tenant_id=tenant_id, partner_id=res.data[0]["id"], by=by)
        return _partner_row(res.data[0])

    def get_partner(self, tenant_id: str, partner_id: str) -> PartnerResponse:
        return _partner_row(self._require_partner(tenant_id, partner_id))

    def update_partner(
        self, tenant_id: str, partner_id: str, req: PartnerUpdate, *, by: str
    ) -> PartnerResponse:
        row = self._require_partner(tenant_id, partner_id)
        changes = req.model_dump(mode="json", exclude_unset=True)
        if not changes:
            return _partner_row(row)
        if "name" in changes and changes["name"] is None:
            raise CrmError("Der Name ist Pflicht.", status_code=422)
        res = (
            self._db.table("partners")
            .update(changes)
            .eq("id", partner_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise CrmError(_PARTNER_NOT_FOUND, status_code=404)
        log.info(
            "crm_partner_updated", tenant_id=tenant_id, partner_id=partner_id,
            felder=sorted(changes), by=by,
        )
        return _partner_row(res.data[0])

    def delete_partner(self, tenant_id: str, partner_id: str, *, by: str) -> None:
        self._require_partner(tenant_id, partner_id)
        # Gegenzustand (Wurzel 1): die QR-Dateien der Deals liegen im Bucket und
        # fallen NICHT mit dem FK-Cascade. Erst die Dateien, dann die Zeilen.
        deals = (
            self._db.table("deals")
            .select("id, qr_code_path")
            .eq("tenant_id", tenant_id)
            .eq("partner_id", partner_id)
            .execute()
        ).data or []
        pfade = [d["qr_code_path"] for d in deals if d.get("qr_code_path")]
        if pfade:
            self._qr_dateien_entfernen(pfade)
        self._db.table("partners").delete().eq("id", partner_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info(
            "crm_partner_deleted", tenant_id=tenant_id, partner_id=partner_id,
            deals=len(deals), by=by,
        )

    # -- Deals -------------------------------------------------------------------
    def list_deals(self, tenant_id: str, partner_id: str) -> list[DealResponse]:
        self._require_partner(tenant_id, partner_id)
        rows = (
            self._db.table("deals")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("partner_id", partner_id)
            .order("created_at", desc=True)
            .execute()
        ).data or []
        return [_deal_row(r) for r in rows]

    def create_deal(
        self, tenant_id: str, partner_id: str, req: DealCreate, *, by: str
    ) -> DealResponse:
        self._require_partner(tenant_id, partner_id)
        payload = {
            **req.model_dump(mode="json"),
            "tenant_id": tenant_id,
            "partner_id": partner_id,
        }
        try:
            res = self._db.table("deals").insert(payload).execute()
        except APIError as exc:
            raise self._deal_db_fehler(exc) from exc
        if not res.data:
            raise CrmError("Deal konnte nicht angelegt werden.", status_code=500)
        log.info(
            "crm_deal_created", tenant_id=tenant_id, partner_id=partner_id,
            deal_id=res.data[0]["id"], kind=req.discount_kind, by=by,
        )
        return _deal_row(res.data[0])

    def get_deal(self, tenant_id: str, deal_id: str) -> DealResponse:
        return _deal_row(self._require_deal(tenant_id, deal_id))

    def update_deal(
        self, tenant_id: str, deal_id: str, req: DealUpdate, *, by: str
    ) -> DealResponse:
        row = self._require_deal(tenant_id, deal_id)
        changes = req.model_dump(mode="json", exclude_unset=True)
        if not changes:
            return _deal_row(row)
        # Fachregeln auf dem GEMERGTEN Zustand: ein Wechsel auf `fixed` ohne
        # Währung oder ein Prozentwert über 100 muss auch dann 422 sein, wenn
        # nur EIN Feld geändert wurde. Dieselben Regeln wie beim Anlegen —
        # über dasselbe Schema, keine zweite Kopie.
        gemergt = {k: row.get(k) for k in _DEAL_COLS}
        gemergt.update(changes)
        gemergt["discount_value"] = float(gemergt.get("discount_value") or 0)
        try:
            DealBase(**gemergt)
        except ValueError as exc:
            raise CrmError(_pydantic_meldung(exc), status_code=422) from exc
        try:
            res = (
                self._db.table("deals")
                .update(changes)
                .eq("id", deal_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
        except APIError as exc:
            raise self._deal_db_fehler(exc) from exc
        if not res.data:
            raise CrmError(_DEAL_NOT_FOUND, status_code=404)
        log.info(
            "crm_deal_updated", tenant_id=tenant_id, deal_id=deal_id,
            felder=sorted(changes), by=by,
        )
        return _deal_row(res.data[0])

    def delete_deal(self, tenant_id: str, deal_id: str, *, by: str) -> None:
        row = self._require_deal(tenant_id, deal_id)
        if row.get("qr_code_path"):
            self._qr_dateien_entfernen([row["qr_code_path"]])
        self._db.table("deals").delete().eq("id", deal_id).eq("tenant_id", tenant_id).execute()
        log.info("crm_deal_deleted", tenant_id=tenant_id, deal_id=deal_id, by=by)

    @staticmethod
    def _deal_db_fehler(exc: APIError) -> CrmError:
        if getattr(exc, "code", None) == _UNIQUE_VERLETZUNG:
            return CrmError(
                "Dieser Rabattcode ist in deinem Betrieb bereits vergeben.", status_code=409
            )
        # Alles andere ist ein echter Datenbankfehler → unverändert weiter
        # (kein Verschlucken, Wurzel 5).
        raise exc

    # -- QR-Bild (Upload, signierte URL, Erzeugung) ------------------------------
    def upload_qr(
        self, tenant_id: str, deal_id: str, inhalt: bytes, *, by: str
    ) -> DealResponse:
        deal = self._require_deal(tenant_id, deal_id)
        inhalt, mime, endung = qr_datei_pruefen(inhalt)
        pfad = f"{tenant_id}/{deal['partner_id']}/{deal_id}/{secrets.token_hex(8)}.{endung}"
        storage = self._db.storage.from_(QR_BUCKET)
        try:
            storage.upload(pfad, inhalt, {"content-type": mime})
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich als 502
            log.warning("crm_deal_qr_upload_failed", deal_id=deal_id, error=str(exc))
            raise CrmError("Upload fehlgeschlagen.", status_code=502) from exc
        # ERST die Zeile auf die neue Datei zeigen lassen, DANN die alte
        # aufräumen — sonst zeigt `qr_code_path` bei einem Fehlschlag auf eine
        # bereits gelöschte Datei.
        res = (
            self._db.table("deals")
            .update({"qr_code_path": pfad})
            .eq("id", deal_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise CrmError("Speichern fehlgeschlagen.", status_code=500)
        if deal.get("qr_code_path"):
            self._qr_dateien_entfernen([deal["qr_code_path"]])
        log.info(
            "crm_deal_qr_uploaded", tenant_id=tenant_id, deal_id=deal_id,
            mime=mime, bytes=len(inhalt), by=by,
        )
        return _deal_row(res.data[0])

    def qr_url(self, tenant_id: str, deal_id: str) -> tuple[str, int]:
        """Signierte, kurzlebige URL des hochgeladenen QR-Bilds."""
        deal = self._require_deal(tenant_id, deal_id)
        pfad = deal.get("qr_code_path")
        if not pfad:
            raise CrmError(
                "Kein QR-Bild hinterlegt — GET /crm/deals/{id}/qr.png erzeugt eines "
                "aus dem Rabattcode.",
                status_code=404,
            )
        try:
            signed = self._db.storage.from_(QR_BUCKET).create_signed_url(pfad, QR_SIGNED_URL_TTL)
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich als 502
            log.warning("crm_deal_qr_sign_failed", deal_id=deal_id, error=str(exc))
            raise CrmError("QR-Bild nicht abrufbar.", status_code=502) from exc
        url = None
        if isinstance(signed, dict):
            # supabase-py-Versionen benennen den Schlüssel unterschiedlich.
            url = signed.get("signedURL") or signed.get("signedUrl")
        if not url:
            raise CrmError("QR-Bild nicht abrufbar.", status_code=502)
        return url, QR_SIGNED_URL_TTL

    def qr_png(self, tenant_id: str, deal_id: str) -> bytes:
        """QR aus dem Rabattcode — für Partner ohne eigenes Bild."""
        deal = self._require_deal(tenant_id, deal_id)
        code = (deal.get("discount_code") or "").strip()
        if not code:
            raise CrmError(
                "Der Deal hat keinen Rabattcode — ohne Code kein QR.", status_code=409
            )
        return qr_png_aus_code(code)

    def _qr_dateien_entfernen(self, pfade: list[str]) -> None:
        """Best-effort-Aufräumen im Bucket; kippt den Hauptpfad nie (Wurzel 5),
        der Fehlschlag steht im Log."""
        try:
            self._db.storage.from_(QR_BUCKET).remove(pfade)
        except Exception as exc:  # noqa: BLE001 — Altdatei-Cleanup ist best-effort
            log.warning("crm_deal_qr_cleanup_failed", pfade=pfade, error=str(exc))


def _pydantic_meldung(exc: ValueError) -> str:
    """Erste Fehlermeldung eines Pydantic-ValidationError als Text (ohne den
    technischen Rahmen); jede andere ValueError unverändert."""
    errors = getattr(exc, "errors", None)
    if callable(errors):
        try:
            erster = errors()[0]
            return str(erster.get("msg", exc)).removeprefix("Value error, ")
        except (IndexError, KeyError, TypeError):
            return str(exc)
    return str(exc)
