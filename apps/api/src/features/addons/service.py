"""Service-Schicht für addons (Zusatzleistungen/Upsells).

CRUD über die Service-Role mit explizitem tenant-Scope (tenant_id stammt immer
aus dem JWT, nie aus User-Input — Muster wie properties.service). Katalog je
Objekt (``property_addons``) plus gekaufte Extras (``reservation_addons``) mit
serverseitiger Preisberechnung und Payment-gegatetem Zahlstatus.
"""
from __future__ import annotations

import secrets
from datetime import UTC, datetime

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import public_storage_url

from .pricing import addon_total
from .schemas import (
    AddonCreate,
    AddonListResponse,
    AddonResponse,
    AddonStatus,
    AddonUpdate,
    ReservationAddonListResponse,
    ReservationAddonResponse,
    SliceHealth,
)

log = get_logger("nextdays.addons")

_ADDON_COLS = (
    "id, property_id, name, description, media, price, basis, mandatory, "
    "appears_in, available_until, tax_rate, active, sort_order"
)
_RES_ADDON_COLS = (
    "id, reservation_id, addon_id, name, price, basis, tax_rate, qty, total, "
    "status, charged_at, created_at"
)


class AddonError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class AddonsService:
    slice_name = "addons"

    IMAGE_BUCKET = "property-images"
    MEDIA_MIME = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
    MEDIA_MIN_BYTES = 10 * 1024
    MEDIA_MAX_BYTES = 20 * 1024 * 1024
    MEDIA_MAX_COUNT = 5

    def __init__(self, service_client: Client) -> None:
        self._db = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise AddonError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def _assert_own_property(self, tenant_id: str, property_id: str) -> None:
        rows = (
            self._db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise AddonError("Objekt gehört nicht zu diesem Konto.", status_code=404)

    def _property_currency(self, property_id: str) -> str | None:
        """Währung des Objekts aus dem (ersten) Rate-Plan. Kein Fallback — None,
        wenn keine hinterlegt ist (27 EU-Länder/Mehrwährung; nie € erfinden)."""
        try:
            rows = (
                self._db.table("rate_plans")
                .select("currency")
                .eq("property_id", property_id)
                .order("created_at")
                .limit(1)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = keine Währung
            log.warning("addon_currency_unavailable", error=str(exc))
            return None
        return (rows[0].get("currency") or None) if rows else None

    # --- Katalog (Dashboard, MANAGE_PROPERTIES) ------------------------------

    def list_for_property(
        self, ctx: AuthContext, property_id: str
    ) -> AddonListResponse:
        tenant_id = self._require_tenant(ctx)
        self._assert_own_property(tenant_id, property_id)
        rows = (
            self._db.table("property_addons")
            .select(_ADDON_COLS)
            .eq("property_id", property_id)
            .order("sort_order")
            .execute()
        ).data or []
        items = [AddonResponse(**_addon_row(r)) for r in rows]
        return AddonListResponse(
            items=items,
            total=len(items),
            currency=self._property_currency(property_id),
        )

    def create(
        self, ctx: AuthContext, property_id: str, req: AddonCreate
    ) -> AddonResponse:
        tenant_id = self._require_tenant(ctx)
        self._assert_own_property(tenant_id, property_id)
        payload = req.model_dump(mode="json")
        payload["property_id"] = property_id
        res = self._db.table("property_addons").insert(payload).execute()
        if not res.data:
            raise AddonError("Zusatzleistung konnte nicht angelegt werden.", status_code=500)
        log.info("addon_created", tenant_id=tenant_id, property_id=property_id)
        return AddonResponse(**_addon_row(res.data[0]))

    def _get_addon(self, tenant_id: str, addon_id: str) -> dict:
        rows = (
            self._db.table("property_addons")
            .select(_ADDON_COLS + ", properties!inner(tenant_id)")
            .eq("id", addon_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows or str(rows[0].get("properties", {}).get("tenant_id")) != tenant_id:
            raise AddonError("Zusatzleistung nicht gefunden.", status_code=404)
        return rows[0]

    def update(
        self, ctx: AuthContext, addon_id: str, req: AddonUpdate
    ) -> AddonResponse:
        tenant_id = self._require_tenant(ctx)
        self._get_addon(tenant_id, addon_id)  # 404, wenn fremd
        changes = req.model_dump(mode="json", exclude_unset=True)
        if changes:
            res = (
                self._db.table("property_addons")
                .update(changes)
                .eq("id", addon_id)
                .execute()
            )
            if not res.data:
                raise AddonError("Zusatzleistung nicht gefunden.", status_code=404)
        row = self._get_addon(tenant_id, addon_id)
        log.info("addon_updated", tenant_id=tenant_id, addon_id=addon_id)
        return AddonResponse(**_addon_row(row))

    def delete(self, ctx: AuthContext, addon_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        self._get_addon(tenant_id, addon_id)  # 404, wenn fremd
        self._db.table("property_addons").delete().eq("id", addon_id).execute()
        log.info("addon_deleted", tenant_id=tenant_id, addon_id=addon_id)

    def add_media(
        self, ctx: AuthContext, addon_id: str, content: bytes, content_type: str
    ) -> AddonResponse:
        """Ein Medium (Bild) hochladen → property-images-Bucket + an media anhängen."""
        tenant_id = self._require_tenant(ctx)
        row = self._get_addon(tenant_id, addon_id)
        ext = self.MEDIA_MIME.get(content_type)
        if not ext:
            raise AddonError("Nur JPEG/PNG/WebP erlaubt.", status_code=415)
        if len(content) < self.MEDIA_MIN_BYTES:
            raise AddonError("Bild ist zu klein (min. 10 KB).", status_code=413)
        if len(content) > self.MEDIA_MAX_BYTES:
            raise AddonError("Bild ist zu groß (max. 20 MB).", status_code=413)
        media = list(row.get("media") or [])
        if len(media) >= self.MEDIA_MAX_COUNT:
            raise AddonError("Maximal 5 Medien je Zusatzleistung.", status_code=409)

        property_id = str(row["property_id"])
        name = secrets.token_hex(8)
        path = f"{tenant_id}/{property_id}/addons/{name}.{ext}"
        storage = self._db.storage.from_(self.IMAGE_BUCKET)
        try:
            storage.upload(path, content, {"content-type": content_type})
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich
            log.warning("addon_media_upload_failed", addon_id=addon_id, error=str(exc))
            raise AddonError("Upload fehlgeschlagen.", status_code=502) from exc
        url = public_storage_url(self.IMAGE_BUCKET, path)
        media.append(url)
        self._db.table("property_addons").update({"media": media}).eq(
            "id", addon_id
        ).execute()
        log.info("addon_media_added", tenant_id=tenant_id, addon_id=addon_id)
        return AddonResponse(**_addon_row(self._get_addon(tenant_id, addon_id)))

    # --- Verkauf / Käufe (auth-gescoped Dashboard-Sicht) ---------------------

    def list_for_reservation(
        self, ctx: AuthContext, reservation_id: str
    ) -> ReservationAddonListResponse:
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("reservation_addons")
            .select(_RES_ADDON_COLS)
            .eq("tenant_id", tenant_id)
            .eq("reservation_id", reservation_id)
            .order("created_at")
            .execute()
        ).data or []
        items = [ReservationAddonResponse(**_res_addon_row(r)) for r in rows]
        total = round(sum(i.total for i in items), 2)
        currency = None
        res_rows = (
            self._db.table("reservations")
            .select("property_id, currency")
            .eq("tenant_id", tenant_id)
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data or []
        if res_rows:
            # Reservierungs-Währung bevorzugt (so wurde gebucht), sonst Objekt-Plan.
            currency = res_rows[0].get("currency") or self._property_currency(
                str(res_rows[0]["property_id"])
            )
        return ReservationAddonListResponse(
            items=items, total=total, currency=currency
        )

    def _own_reservation(self, tenant_id: str, reservation_id: str) -> dict:
        rows = (
            self._db.table("reservations")
            .select("id, tenant_id, property_id, check_in, check_out, num_guests")
            .eq("tenant_id", tenant_id)
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise AddonError("Reservierung nicht gefunden.", status_code=404)
        return rows[0]

    def available_for_reservation(
        self, ctx: AuthContext, reservation_id: str
    ) -> AddonListResponse:
        """Aktive Katalog-Add-ons des Objekts dieser Reservierung — für die
        Schnell-Hinzufügen-Auswahl im Reservierungs-Detail (Dashboard)."""
        tenant_id = self._require_tenant(ctx)
        res = self._own_reservation(tenant_id, reservation_id)
        rows = (
            self._db.table("property_addons")
            .select(_ADDON_COLS)
            .eq("property_id", str(res["property_id"]))
            .eq("active", True)
            .order("sort_order")
            .execute()
        ).data or []
        items = [AddonResponse(**_addon_row(r)) for r in rows]
        return AddonListResponse(
            items=items,
            total=len(items),
            currency=self._property_currency(str(res["property_id"])),
        )

    def add_to_reservation(
        self, ctx: AuthContext, reservation_id: str, addon_id: str, qty: int
    ) -> ReservationAddonListResponse:
        """Zusatzleistung als Schnelltaste zu einer bestehenden Buchung hinzufügen
        (Dashboard/Agentur). Betrag serverseitig aus dem Katalog; löst den
        Task-Trigger aus. Verkaufsfläche „checkin" → keine appears_in-Schranke
        für den manuellen Verkauf durch die Hausverwaltung."""
        from datetime import date  # noqa: PLC0415

        tenant_id = self._require_tenant(ctx)
        res = self._own_reservation(tenant_id, reservation_id)
        addon = self._addon_for_property(str(res["property_id"]), addon_id)
        check_in = date.fromisoformat(str(res["check_in"]))
        check_out = date.fromisoformat(str(res["check_out"]))
        nights = max((check_out - check_in).days, 1)
        guests = int(res.get("num_guests") or 1)
        tax_rate = (
            float(addon["tax_rate"]) if addon.get("tax_rate") is not None else None
        )
        _net, gross = addon_total(
            float(addon.get("price") or 0),
            str(addon.get("basis") or "per_stay"),
            tax_rate,
            nights=nights,
            guests=guests,
            qty=max(int(qty), 1),
        )
        names = addon.get("name") or {}
        try:
            self._db.table("reservation_addons").insert(
                {
                    "tenant_id": tenant_id,
                    "reservation_id": reservation_id,
                    "addon_id": addon_id,
                    "name": names,
                    "price": float(addon.get("price") or 0),
                    "basis": str(addon.get("basis") or "per_stay"),
                    "tax_rate": tax_rate,
                    "qty": max(int(qty), 1),
                    "total": gross,
                    "status": AddonStatus.pending.value,
                }
            ).execute()
        except APIError as exc:
            # Idempotenz (0109-Unique-Index): diese Zusatzleistung ist für die
            # Buchung schon aktiv gebucht → fachlicher 409 statt rohem 500
            # (Doppelklick auf die Schnelltaste).
            if "reservation_addons_active_uidx" not in str(exc):
                raise
            raise AddonError(
                "Diese Zusatzleistung ist für die Buchung bereits gebucht.",
                status_code=409,
            ) from exc
        # Trigger „addon_purchased": Vorbereitungs-Aufgabe (best-effort).
        label = names.get("de") or next(iter(names.values()), "Zusatzleistung")
        try:
            from src.features.tasks.service import TasksService  # noqa: PLC0415

            TasksService(client=self._db).generate_for_addon(
                tenant_id,
                str(res["property_id"]),
                reservation_id,
                label,
                check_in.isoformat(),
            )
        except Exception as exc:  # noqa: BLE001 — Task-Fehler darf Kauf nicht killen
            log.warning("addon_task_failed", reservation_id=reservation_id, error=str(exc))
        log.info("addon_added_to_reservation", tenant_id=tenant_id, id=reservation_id)
        return self.list_for_reservation(ctx, reservation_id)

    def _addon_for_property(self, property_id: str, addon_id: str) -> dict:
        rows = (
            self._db.table("property_addons")
            .select(_ADDON_COLS)
            .eq("id", addon_id)
            .eq("property_id", property_id)
            .eq("active", True)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise AddonError(
                "Zusatzleistung gehört nicht zu diesem Objekt.", status_code=404
            )
        return rows[0]

    def mark_paid(self, ctx: AuthContext, res_addon_id: str) -> ReservationAddonResponse:
        """Manuell als bezahlt markieren (solange kein Payment-Provider live ist)."""
        tenant_id = self._require_tenant(ctx)
        res = (
            self._db.table("reservation_addons")
            .update(
                {"status": AddonStatus.paid.value, "charged_at": _now_iso()}
            )
            .eq("tenant_id", tenant_id)
            .eq("id", res_addon_id)
            .execute()
        )
        if not res.data:
            raise AddonError("Gekaufte Zusatzleistung nicht gefunden.", status_code=404)
        log.info("reservation_addon_marked_paid", tenant_id=tenant_id, id=res_addon_id)
        return ReservationAddonResponse(**_res_addon_row(res.data[0]))


def purchase_addons(
    db: Client,
    *,
    tenant_id: str,
    reservation_id: str,
    property_id: str,
    surface: str,
    selections: list[tuple[str, int]],
    nights: int,
    guests: int,
    check_in_iso: str,
    is_before_checkin: bool,
) -> list[dict]:
    """Gewählte Upsells serverseitig bepreisen + als reservation_addons anlegen.

    Gemeinsame Verkaufslogik für Buchungsstrecke (surface=booking_engine) und
    Gäste-Portal (surface=guest_portal). Beträge kommen IMMER aus dem Katalog
    (kein Vertrauen auf Client-Preise). Es werden nur aktive Add-ons des Objekts
    berücksichtigt, die für ``surface`` freigegeben sind und deren „wann
    anzeigen"-Regel erfüllt ist (before_checkin nur vor Anreise). Löst je Kauf
    den Task-Trigger ``addon_purchased`` aus (best-effort).

    Gibt die angelegten reservation_addons-Zeilen zurück (leer = nichts gekauft).
    """
    if not selections:
        return []
    ids = [aid for aid, _ in selections]
    rows = (
        db.table("property_addons")
        .select("id, name, price, basis, tax_rate, appears_in, available_until")
        .eq("property_id", property_id)
        .eq("active", True)
        .in_("id", ids)
        .execute()
    ).data or []
    catalog = {str(r["id"]): r for r in rows}

    payload: list[dict] = []
    labels: list[str] = []
    for addon_id, qty in selections:
        addon = catalog.get(addon_id)
        if not addon:
            continue
        if surface not in (addon.get("appears_in") or []):
            continue
        # „Wann anzeigen": before_checkin nur, solange noch vor Anreise.
        if addon.get("available_until") == "before_checkin" and not is_before_checkin:
            continue
        tax_rate = (
            float(addon["tax_rate"]) if addon.get("tax_rate") is not None else None
        )
        _net, gross = addon_total(
            float(addon.get("price") or 0),
            str(addon.get("basis") or "per_stay"),
            tax_rate,
            nights=nights,
            guests=guests,
            qty=max(int(qty), 1),
        )
        names = addon.get("name") or {}
        labels.append(names.get("de") or next(iter(names.values()), "Zusatzleistung"))
        payload.append(
            {
                "tenant_id": tenant_id,
                "reservation_id": reservation_id,
                "addon_id": addon_id,
                "name": names,
                "price": float(addon.get("price") or 0),
                "basis": str(addon.get("basis") or "per_stay"),
                "tax_rate": tax_rate,
                "qty": max(int(qty), 1),
                "total": gross,
                "status": AddonStatus.pending.value,
            }
        )
    if not payload:
        return []
    # Idempotenz gegen Doppelklick/Retry: der partielle Unique-Index
    # reservation_addons_active_uidx (0109) verhindert eine zweite aktive Zeile
    # je (reservation_id, addon_id). Kollidiert der Insert, war der Kauf bereits
    # gebucht — dann die BESTEHENDE Zeile zurückgeben statt doppelt zu berechnen.
    #
    # WICHTIG: pro Addon EINZELN inserten, nicht als ein atomarer Batch. Kollidiert
    # in einem Batch nur EIN Addon, würde der gesamte Insert fehlschlagen und die
    # genuin NEUEN Addons desselben Batches gingen verloren (geräuschlos nie
    # berechnet). Einzel-Inserts halten jedes neue Addon, egal welches im Batch
    # bereits existiert.
    created: list[dict] = []
    for item in payload:
        try:
            rows_ins = (
                db.table("reservation_addons").insert(item).execute()
            ).data or []
        except APIError as exc:
            if "reservation_addons_active_uidx" not in str(exc):
                raise
            log.info(
                "addon_purchase_idempotent_skip",
                reservation_id=reservation_id,
                addon_id=item["addon_id"],
            )
            rows_ins = (
                db.table("reservation_addons")
                .select("*")
                .eq("reservation_id", reservation_id)
                .eq("addon_id", item["addon_id"])
                .neq("status", "cancelled")
                .execute()
            ).data or []
        created.extend(rows_ins)

    # Trigger „addon_purchased": je Item eine Vorbereitungs-Aufgabe (best-effort,
    # lazy import → kein Slice-Importzyklus).
    try:
        from src.features.tasks.service import TasksService  # noqa: PLC0415

        tasks = TasksService(client=db)
        for label in labels:
            tasks.generate_for_addon(
                tenant_id, property_id, reservation_id, label, check_in_iso
            )
    except Exception as exc:  # noqa: BLE001 — Task-Fehler darf Kauf nicht killen
        log.warning("addon_tasks_failed", reservation_id=reservation_id, error=str(exc))

    log.info(
        "addons_purchased",
        tenant_id=tenant_id,
        reservation_id=reservation_id,
        count=len(created),
    )
    return created


def _addon_row(r: dict) -> dict:
    """DB-Zeile → Katalog-Response (None-/Typ-Glättung)."""
    return {
        "id": str(r["id"]),
        "property_id": str(r["property_id"]),
        "name": r.get("name") or {},
        "description": r.get("description") or {},
        "media": list(r.get("media") or []),
        "price": float(r.get("price") or 0),
        "basis": r.get("basis") or "per_stay",
        "mandatory": bool(r.get("mandatory")),
        "appears_in": list(r.get("appears_in") or []),
        "available_until": r.get("available_until") or "anytime",
        "tax_rate": (float(r["tax_rate"]) if r.get("tax_rate") is not None else None),
        "active": bool(r.get("active")),
        "sort_order": int(r.get("sort_order") or 0),
    }


def _res_addon_row(r: dict) -> dict:
    """DB-Zeile → gekauftes-Add-on-Response."""
    return {
        "id": str(r["id"]),
        "reservation_id": str(r["reservation_id"]),
        "addon_id": (str(r["addon_id"]) if r.get("addon_id") else None),
        "name": r.get("name") or {},
        "price": float(r.get("price") or 0),
        "basis": r.get("basis") or "per_stay",
        "tax_rate": (float(r["tax_rate"]) if r.get("tax_rate") is not None else None),
        "qty": int(r.get("qty") or 1),
        "total": float(r.get("total") or 0),
        "status": r.get("status") or "pending",
        "charged_at": r.get("charged_at"),
        "created_at": r.get("created_at"),
    }


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


# Re-Export, damit Verkaufs-Pfade (booking_engine/public_portal) eine Wahrheit
# für die Betragsberechnung + den Kauf nutzen.
__all__ = ["AddonError", "AddonsService", "addon_total", "purchase_addons"]
