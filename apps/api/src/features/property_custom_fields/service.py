"""Betriebs-eigene Zusatzfelder für Objekte (Migration 0242).

Definitionen gehören dem Betrieb, Werte dem einzelnen Objekt. Der Service-Client
umgeht RLS, deshalb wird JEDER Zugriff explizit auf ``ctx.tenant_id`` gescopt
(Wurzel 3) — inklusive der Objekt-ID aus dem Pfad: ohne diesen Scope könnte ein
Betrieb Zusatzfelder an einem fremden Objekt lesen oder setzen.
"""
from __future__ import annotations

import re
from datetime import UTC, datetime

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .schemas import (
    CustomField,
    CustomFieldCreate,
    CustomFieldUpdate,
    CustomFieldWithValue,
)

log = get_logger("nextdays.property_custom_fields")

# Ein Betrieb soll nicht unbegrenzt Felder anlegen können: die Objekt-Detailseite
# lädt sie alle, und jedes Feld kostet eine Zeile in jeder Ansicht (Wurzel 8 —
# jeder unbegrenzte Bereich bekommt eine Obergrenze).
MAX_FELDER = 50


class CustomFieldError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _schluessel(label: str) -> str:
    """Stabiler Schlüssel aus dem Label. Ohne Umlaut-Ersatz käme „Müllabfuhr"
    als „m_llabfuhr" heraus."""
    ersatz = {"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"}
    text = label.strip().lower()
    for alt, neu in ersatz.items():
        text = text.replace(alt, neu)
    text = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    return text[:60] or "feld"


class PropertyCustomFieldService:
    def __init__(self, db: Client) -> None:
        self._db = db

    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise CustomFieldError("Kein Betrieb im Kontext.", status_code=403)
        return ctx.tenant_id

    # -- Definitionen -------------------------------------------------------

    def list_fields(self, ctx: AuthContext) -> list[CustomField]:
        rows = (
            self._db.table("property_custom_fields")
            .select("*")
            .eq("tenant_id", self._tenant(ctx))
            .order("sort_order")
            .order("label")
            .execute()
        ).data or []
        return [CustomField(**r) for r in rows]

    def create_field(self, ctx: AuthContext, req: CustomFieldCreate) -> CustomField:
        tenant_id = self._tenant(ctx)
        vorhanden = (
            self._db.table("property_custom_fields")
            .select("id", count="exact")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if (vorhanden.count or 0) >= MAX_FELDER:
            raise CustomFieldError(
                f"Mehr als {MAX_FELDER} Zusatzfelder sind nicht vorgesehen.",
                status_code=422,
            )

        zeile = {
            "tenant_id": tenant_id,
            "field_key": self._freier_schluessel(tenant_id, _schluessel(req.label)),
            "label": req.label.strip(),
            "field_type": req.field_type,
            "options": req.options,
            "is_public": req.is_public,
            "sort_order": req.sort_order,
        }
        res = self._db.table("property_custom_fields").insert(zeile).execute()
        if not res.data:
            raise CustomFieldError("Feld konnte nicht angelegt werden.", status_code=500)
        log.info("custom_field_created", field_key=zeile["field_key"])
        return CustomField(**res.data[0])

    def _freier_schluessel(self, tenant_id: str, basis: str) -> str:
        """Kollisionsfreier Schlüssel. Zwei Felder „Notiz" sind erlaubt — sie
        bekommen dann `notiz` und `notiz_2`, statt dass das Anlegen scheitert."""
        belegt = {
            r["field_key"]
            for r in (
                self._db.table("property_custom_fields")
                .select("field_key")
                .eq("tenant_id", tenant_id)
                .like("field_key", f"{basis}%")
                .execute()
            ).data
            or []
        }
        if basis not in belegt:
            return basis
        for n in range(2, MAX_FELDER + 2):
            kandidat = f"{basis}_{n}"
            if kandidat not in belegt:
                return kandidat
        raise CustomFieldError("Kein freier Feldschlüssel mehr.", status_code=422)

    def update_field(
        self, ctx: AuthContext, field_id: str, req: CustomFieldUpdate
    ) -> CustomField:
        tenant_id = self._tenant(ctx)
        vorher = load_scoped(
            self._db,
            "property_custom_fields",
            field_id,
            tenant_id,
            not_found=CustomFieldError("Feld nicht gefunden.", status_code=404),
        )
        aenderung: dict = {}
        if req.label is not None:
            aenderung["label"] = req.label.strip()
        if req.is_public is not None:
            aenderung["is_public"] = req.is_public
        if req.sort_order is not None:
            aenderung["sort_order"] = req.sort_order
        if req.options is not None:
            # Optionen gibt es nur beim Auswahlfeld; und ein Auswahlfeld ohne
            # Auswahl wäre eine Attrappe (derselbe CHECK steht in der DB).
            if vorher["field_type"] != "select":
                raise CustomFieldError(
                    "Auswahlmöglichkeiten gibt es nur beim Auswahlfeld.",
                    status_code=422,
                )
            if not req.options:
                raise CustomFieldError(
                    "Ein Auswahlfeld braucht mindestens eine Auswahlmöglichkeit.",
                    status_code=422,
                )
            aenderung["options"] = req.options
        if not aenderung:
            return CustomField(**vorher)

        aenderung["updated_at"] = datetime.now(UTC).isoformat()
        res = (
            self._db.table("property_custom_fields")
            .update(aenderung)
            .eq("id", field_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise CustomFieldError("Feld nicht gefunden.", status_code=404)
        return CustomField(**res.data[0])

    def delete_field(self, ctx: AuthContext, field_id: str) -> None:
        tenant_id = self._tenant(ctx)
        load_scoped(
            self._db,
            "property_custom_fields",
            field_id,
            tenant_id,
            columns="id",
            not_found=CustomFieldError("Feld nicht gefunden.", status_code=404),
        )
        # Werte hängen per ON DELETE CASCADE daran und verschwinden mit.
        self._db.table("property_custom_fields").delete().eq("id", field_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info("custom_field_deleted", field_id=field_id)

    # -- Werte je Objekt ----------------------------------------------------

    def _require_own_property(self, tenant_id: str, property_id: str) -> None:
        load_scoped(
            self._db,
            "properties",
            property_id,
            tenant_id,
            columns="id",
            not_found=CustomFieldError("Objekt nicht gefunden.", status_code=404),
        )

    def list_values(
        self, ctx: AuthContext, property_id: str
    ) -> list[CustomFieldWithValue]:
        tenant_id = self._tenant(ctx)
        self._require_own_property(tenant_id, property_id)

        felder = self.list_fields(ctx)
        if not felder:
            return []
        werte = {
            r["field_id"]: r.get("value")
            for r in (
                self._db.table("property_custom_field_values")
                .select("field_id, value")
                .eq("tenant_id", tenant_id)
                .eq("property_id", property_id)
                .execute()
            ).data
            or []
        }
        # ALLE definierten Felder ausgeben, auch ohne Wert: sonst sähe der
        # Nutzer nur die bereits gefüllten und wüsste nicht, was er pflegen kann.
        return [
            CustomFieldWithValue(field=f, value=werte.get(f.id)) for f in felder
        ]

    def set_value(
        self, ctx: AuthContext, property_id: str, field_id: str, value: str | None
    ) -> CustomFieldWithValue:
        tenant_id = self._tenant(ctx)
        self._require_own_property(tenant_id, property_id)
        feld = CustomField(
            **load_scoped(
                self._db,
                "property_custom_fields",
                field_id,
                tenant_id,
                not_found=CustomFieldError("Feld nicht gefunden.", status_code=404),
            )
        )
        sauber = None if value is None else value.strip()
        if feld.field_type == "select" and sauber:
            # Nur definierte Auswahlmöglichkeiten zulassen — sonst steht im Feld
            # ein Wert, den die Auswahlliste gar nicht anbietet (Wurzel 3).
            if sauber not in feld.options:
                raise CustomFieldError(
                    "Wert ist keine der hinterlegten Auswahlmöglichkeiten.",
                    status_code=422,
                )
        if feld.field_type == "number" and sauber:
            try:
                float(sauber.replace(",", "."))
            except ValueError as exc:
                raise CustomFieldError(
                    "Dieses Feld erwartet eine Zahl.", status_code=422
                ) from exc
        if feld.field_type == "checkbox" and sauber not in (None, "", "ja", "nein"):
            raise CustomFieldError(
                "Dieses Feld erwartet 'ja' oder 'nein'.", status_code=422
            )

        # Upsert auf den UNIQUE-Schlüssel (property_id, field_id): Doppelklick
        # oder Retry überschreibt, statt eine zweite Zeile anzulegen (Wurzel 2).
        self._db.table("property_custom_field_values").upsert(
            {
                "tenant_id": tenant_id,
                "property_id": property_id,
                "field_id": field_id,
                "value": sauber,
                "updated_at": datetime.now(UTC).isoformat(),
            },
            on_conflict="property_id,field_id",
        ).execute()
        return CustomFieldWithValue(field=feld, value=sauber)
