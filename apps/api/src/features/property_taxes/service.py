"""Steuern je Objekt — der Gastgeber legt sie fest, wir behalten nichts ein.

Was dieser Slice NICHT tut: Geld bewegen. Die Steuer wird dem Gast berechnet,
an den Gastgeber durchgereicht und von ihm abgefuehrt. Sie ist ein
durchlaufender Posten und darf deshalb nie in die Provisionsbasis.
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped
from src.features.property_taxes.schemas import (
    PropertyTaxInput,
    PropertyTaxResponse,
)

log = get_logger("nextdays.property_taxes")


class PropertyTaxError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class PropertyTaxService:
    def __init__(self, db: Client) -> None:
        self._db = db

    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise PropertyTaxError(
                "Kein Betrieb im Kontext.", status_code=400
            )
        return ctx.tenant_id

    def _eigenes_objekt(self, ctx: AuthContext, property_id: str) -> dict:
        """Das Objekt MUSS dem Betrieb gehoeren.

        Service-Role umgeht RLS — ohne diesen Scope koennte jemand mit einer
        fremden property_id Steuern in einem fremden Betrieb anlegen und damit
        dessen Gastpreise aendern (Wurzel 3).
        """
        return load_scoped(
            self._db,
            "properties",
            property_id,
            self._tenant(ctx),
            columns="id, currency",
            not_found=PropertyTaxError(
                "Objekt nicht gefunden.", status_code=404
            ),
        )

    def list(self, ctx: AuthContext, property_id: str) -> list[PropertyTaxResponse]:
        self._eigenes_objekt(ctx, property_id)
        rows = (
            self._db.table("property_taxes")
            .select("*")
            .eq("property_id", property_id)
            .eq("tenant_id", self._tenant(ctx))
            .order("tax_type")
            .execute()
        ).data or []
        return [PropertyTaxResponse(**r) for r in rows]

    def create(
        self, ctx: AuthContext, property_id: str, daten: PropertyTaxInput
    ) -> PropertyTaxResponse:
        self._eigenes_objekt(ctx, property_id)
        nutzlast = daten.model_dump(mode="json")
        nutzlast["tenant_id"] = self._tenant(ctx)
        nutzlast["property_id"] = property_id
        row = (
            self._db.table("property_taxes").insert(nutzlast).execute()
        ).data[0]
        log.info(
            "objektsteuer angelegt",
            extra={"property_id": property_id, "art": daten.tax_type},
        )
        return PropertyTaxResponse(**row)

    def update(
        self, ctx: AuthContext, tax_id: str, daten: PropertyTaxInput
    ) -> PropertyTaxResponse:
        """Item-Level-Scope wie im List-Pfad (Wurzel 9).

        Ohne den `load_scoped` liesse sich mit einer fremden tax_id der
        Steuersatz eines fremden Betriebs aendern.
        """
        bestand = load_scoped(
            self._db,
            "property_taxes",
            tax_id,
            self._tenant(ctx),
            not_found=PropertyTaxError(
                "Steuer nicht gefunden.", status_code=404
            ),
        )
        row = (
            self._db.table("property_taxes")
            .update(daten.model_dump(mode="json"))
            .eq("id", tax_id)
            .eq("tenant_id", self._tenant(ctx))
            .execute()
        ).data[0]
        log.info(
            "objektsteuer geaendert",
            extra={"property_id": bestand["property_id"]},
        )
        return PropertyTaxResponse(**row)

    def delete(self, ctx: AuthContext, tax_id: str) -> None:
        load_scoped(
            self._db,
            "property_taxes",
            tax_id,
            self._tenant(ctx),
            columns="id",
            not_found=PropertyTaxError(
                "Steuer nicht gefunden.", status_code=404
            ),
        )
        self._db.table("property_taxes").delete().eq("id", tax_id).eq(
            "tenant_id", self._tenant(ctx)
        ).execute()

    @staticmethod
    def berechne(
        steuern: list[PropertyTaxResponse],
        *,
        naechte: int,
        gaeste: int,
        basis_minor: dict[str, int],
    ) -> list[tuple[str, int]]:
        """Was der Gast je Steuer zusaetzlich zahlt, in kleinster Einheit.

        Additiv, nie im Preis enthalten — so machen es beide Vorbilder. Airbnb
        sagt das ausdruecklich: wer die Steuer vorher im Nachtpreis hatte, muss
        den Nachtpreis danach senken.

        Rueckgabe ist eine Liste (Steuerart, Betrag), keine Summe: der Gast
        soll sehen, was er wofuer zahlt.
        """
        ergebnis: list[tuple[str, int]] = []
        for s in steuern:
            if not s.active:
                continue
            # Befreiung fuer Langzeitaufenthalte: greift sie, faellt die
            # Steuer KOMPLETT weg, nicht nur anteilig.
            if (
                s.long_stay_exempt_nights is not None
                and naechte >= s.long_stay_exempt_nights
            ):
                continue
            # Nur die ersten N Naechte sind steuerpflichtig.
            zaehl_naechte = naechte
            if s.taxable_first_nights is not None:
                zaehl_naechte = min(naechte, s.taxable_first_nights)

            if s.rate_bps is not None:
                grundlage = sum(
                    basis_minor.get(b.value, 0) for b in s.taxable_base
                )
                betrag = grundlage * s.rate_bps // 10000
            elif s.charge_mode.value == "per_guest":
                betrag = (s.amount_minor or 0) * gaeste
            elif s.charge_mode.value == "per_night":
                betrag = (s.amount_minor or 0) * zaehl_naechte
            else:  # per_guest_per_night
                betrag = (s.amount_minor or 0) * gaeste * zaehl_naechte

            if s.max_amount_minor is not None:
                betrag = min(betrag, s.max_amount_minor)
            if betrag > 0:
                ergebnis.append((s.tax_type, betrag))
        return ergebnis
