"""Steuerzahler-Angaben — Lesen, Anlegen, Bestaetigen (DAC7/PStTG).

Ein Eintrag je (tenant_id, country). Scope IMMER auf ctx.tenant_id (Wurzel 3) —
der Service-Client umgeht RLS.

Die Liste der FEHLENDEN Laender wird aus den Objekten des Betriebs ABGELEITET,
nicht gepflegt: DAC7 verlangt Angaben fuer jedes Land, in dem der Anbieter
Objekte hat. Eine zweite Liste danebenzuhalten waere ein Gegenzustand, der
auseinanderlaeuft (Wurzel 1/4).
"""
from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .schemas import TaxpayerCreate, TaxpayerEntry, TaxpayerOverview

log = get_logger("nextdays.taxpayer")


class TaxpayerError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


_SPALTEN = (
    "id, country, kind, tin, first_name, last_name, date_of_birth, "
    "birth_place_city, birth_place_country, legal_name, "
    "business_registration_number, address_line1, address_line2, "
    "postal_code, city, confirmed_at, updated_at"
)


class TaxpayerService:
    def __init__(self, db: Client) -> None:
        self._db = db

    # -- Lesen --------------------------------------------------------------

    def overview(self, ctx: AuthContext) -> TaxpayerOverview:
        """Eintraege, fehlende Laender und die USt-IdNr. fuer den Tab."""
        tenant_id = self._tenant(ctx)
        eintraege = self.list(ctx)
        abgedeckt = {e.country for e in eintraege}
        return TaxpayerOverview(
            eintraege=eintraege,
            fehlende_laender=sorted(
                self._objekt_laender(tenant_id) - abgedeckt
            ),
            vat_id=self._vat_id(tenant_id),
        )

    def list(self, ctx: AuthContext) -> list[TaxpayerEntry]:
        rows = (
            self._db.table("taxpayer_info")
            .select(_SPALTEN)
            .eq("tenant_id", self._tenant(ctx))
            .order("country")
            .execute()
        ).data or []
        return [TaxpayerEntry(**row) for row in rows]

    # -- Schreiben ----------------------------------------------------------

    def upsert(self, ctx: AuthContext, daten: TaxpayerCreate) -> TaxpayerEntry:
        """Angaben fuer ein Land anlegen oder ersetzen.

        Bewusst ein Upsert auf (tenant_id, country): Der Nutzer korrigiert im
        Wizard dasselbe Land, statt einen zweiten widerspruechlichen Eintrag zu
        erzeugen. `confirmed_at` wird dabei gesetzt — wer die Angaben abschickt,
        erklaert sie als richtig (DAC7 verlangt die Selbstauskunft).
        """
        tenant_id = self._tenant(ctx)
        zeile = daten.model_dump(mode="json", exclude_none=True)
        jetzt = datetime.now(UTC).isoformat()
        antwort = (
            self._db.table("taxpayer_info")
            .upsert(
                {
                    **zeile,
                    "tenant_id": tenant_id,
                    "confirmed_at": jetzt,
                    "updated_at": jetzt,
                },
                on_conflict="tenant_id,country",
            )
            .execute()
        )
        if not antwort.data:
            raise TaxpayerError(
                "Steuerangaben konnten nicht gespeichert werden.", status_code=500
            )
        log.info(
            "taxpayer_info_gespeichert",
            tenant_id=tenant_id,
            country=daten.country,
            kind=daten.kind.value,
        )
        return self._eintrag(tenant_id, daten.country)

    def delete(self, ctx: AuthContext, country: str) -> None:
        """Angaben eines Landes entfernen. Scope auf den eigenen Tenant."""
        tenant_id = self._tenant(ctx)
        land = (country or "").upper()
        vorhanden = (
            self._db.table("taxpayer_info")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("country", land)
            .limit(1)
            .execute()
        ).data
        if not vorhanden:
            raise TaxpayerError(
                f"Für {land} sind keine Steuerangaben hinterlegt.", status_code=404
            )
        self._db.table("taxpayer_info").delete().eq("tenant_id", tenant_id).eq(
            "country", land
        ).execute()
        log.info("taxpayer_info_geloescht", tenant_id=tenant_id, country=land)

    # -- Intern -------------------------------------------------------------

    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise TaxpayerError("Kein Betrieb im Kontext.", status_code=400)
        return ctx.tenant_id

    def _eintrag(self, tenant_id: str, country: str) -> TaxpayerEntry:
        rows = (
            self._db.table("taxpayer_info")
            .select(_SPALTEN)
            .eq("tenant_id", tenant_id)
            .eq("country", country.upper())
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise TaxpayerError(
                "Gespeicherte Steuerangaben nicht gefunden.", status_code=500
            )
        return TaxpayerEntry(**rows[0])

    def _objekt_laender(self, tenant_id: str) -> set[str]:
        """Laender, in denen der Betrieb Objekte hat — dort greift DAC7."""
        rows = (
            self._db.table("properties")
            .select("country")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return {
            (r["country"] or "").upper() for r in rows if r.get("country")
        }

    def _vat_id(self, tenant_id: str) -> str | None:
        """USt-IdNr. aus dem Rechnungsprofil — im Tab nur ANGEZEIGT.

        Sie liegt bewusst weiter auf tenant_billing_profile: sie steuert die
        Rechnungsstellung, nicht die DAC7-Meldung. Zwei Speicherorte fuer
        denselben Wert waeren ein Datenfehler (Wurzel 4).
        """
        rows = (
            self._db.table("tenant_billing_profile")
            .select("vat_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0].get("vat_id") if rows else None
