"""Service-Schicht für dashboard (inkl. Onboarding-Fortschritt).

Tenant-scoped über die Service-Role mit EXPLIZITEM tenant-Scope (tenant_id aus
dem JWT, nie aus User-Input) — gleiches Muster wie die anderen Slices.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from supabase import Client

from src.core.security import AuthContext
from src.features.inbox.ai import GroqClient, GroqError

from .schemas import DashboardVoiceSnapshot

from .schemas import (
    DashboardVoiceRequest,
    DashboardVoiceResponse,
    OnboardingStatus,
    OnboardingUpdate,
    SliceHealth,
)


class DashboardError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class DashboardService:
    slice_name = "dashboard"

    def __init__(self, service_client: Client | None = None) -> None:
        self._db = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _require_db(self) -> Client:
        if self._db is None:
            raise DashboardError("Datenbank nicht verfügbar.", status_code=500)
        return self._db

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise DashboardError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    # -- Onboarding ------------------------------------------------------------
    def get_onboarding(self, ctx: AuthContext) -> OnboardingStatus:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        res = (
            db.table("tenant_onboarding")
            .select("*")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            # Noch kein Eintrag → frischer Tenant, Onboarding offen.
            return OnboardingStatus()
        return self._to_status(res.data[0])

    def update_onboarding(
        self, ctx: AuthContext, req: OnboardingUpdate
    ) -> OnboardingStatus:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        row: dict[str, Any] = {"tenant_id": tenant_id}
        data = req.model_dump(exclude_none=True)
        row.update(data)
        if data.get("completed") is True:
            row["completed_at"] = datetime.now(UTC).isoformat()

        saved = (
            db.table("tenant_onboarding")
            .upsert(row, on_conflict="tenant_id")
            .execute()
        )
        if not saved.data:
            raise DashboardError("Onboarding konnte nicht gespeichert werden.", status_code=500)
        return self._to_status(saved.data[0])

    def voice_assistant(
        self, ctx: AuthContext, req: DashboardVoiceRequest
    ) -> DashboardVoiceResponse:
        self._require_tenant(ctx)
        utterance = req.utterance.strip()
        if not utterance:
            raise DashboardError("Keine Spracheingabe erkannt.", status_code=400)

        prompt = self._build_voice_prompt(utterance, req.snapshot)
        try:
            reply = GroqClient().chat(
                system=(
                    "Du bist Andy, ein sprachgesteuerter Assistent fuer das myNextDays-"
                    "Dashboard. Antworte knapp, direkt und professionell. Nutze nur die "
                    "Kennzahlen und Listen aus dem Kontext. Wenn etwas nicht im Kontext "
                    "steht, sage das klar statt etwas zu erfinden. Falls der Nutzer eine "
                    "Kommunikation mit einem Gast anstossen will, formuliere den Vorschlag "
                    "als kurze gesprochene Antwort. Wenn die Anfrage ein normaler "
                    "Gesprächseinstieg oder Smalltalk ist (z. B. 'Wie geht es dir heute?'), "
                    "antworte natürlich und freundlich wie ein Assistent, nicht mit dem Satz "
                    "dass Daten fehlen. Wenn nach Objekten gefragt wird, nenne die "
                    "Objektliste aus dem Kontext und fasse sie knapp zusammen. Keine Emojis, "
                    "keine Markdown-Listen, keine Füllwörter. Antworte in der Sprache der "
                    "Anfrage. Beginne jede Antwort exakt mit 'Hallo Andy'."
                ),
                user=prompt,
                temperature=0.35,
                max_tokens=280,
            )
        except GroqError as exc:
            raise DashboardError(exc.message, status_code=exc.status_code) from exc
        return DashboardVoiceResponse(reply=reply)

    @staticmethod
    def _build_voice_prompt(utterance: str, snapshot: DashboardVoiceSnapshot) -> str:
        snap = snapshot

        def fmt_entry(entry: Any) -> str:
            guest = entry.guest_name or "unbekannt"
            prop = f", Objekt: {entry.property_title}" if entry.property_title else ""
            ota = f", Kanal: {entry.ota_name}" if entry.ota_name else ""
            return (
                f"- {guest}{prop}{ota}, {entry.check_in} bis {entry.check_out}, "
                f"Status: {entry.status}"
            )

        def fmt_property(entry: Any) -> str:
            place_bits = [entry.city, entry.country]
            place = ", ".join(part for part in place_bits if part)
            place_text = f", Ort: {place}" if place else ""
            guests_text = f", max. {entry.max_guests} Gäste" if entry.max_guests else ""
            return (
                f"- {entry.title} ({entry.property_type}, {entry.status})"
                f"{place_text}{guests_text}"
            )

        sections = [
            f"Datum: {snap.today}",
            f"Objekte im Bestand: {len(snap.properties)}",
            f"Check-outs heute: {len(snap.checkouts_today)}",
            f"Check-ins heute: {len(snap.checkins_today)}",
            f"Anstehende Reservierungen: {len(snap.upcoming)}",
            (
                f"Check-ins 30 Tage: {snap.checkins_30d.value}"
                + (
                    f" (Trend {snap.checkins_30d.change_pct} %)"
                    if snap.checkins_30d.change_pct is not None
                    else ""
                )
            ),
            (
                f"Umsatz 30 Tage: {snap.revenue_30d.value} {snap.currency}"
                if snap.revenue_30d
                else "Umsatz 30 Tage: nicht sichtbar"
            ),
            (
                f"Bestaetigt 30 Tage: {snap.confirmed_30d.value}"
                + (
                    f" (Trend {snap.confirmed_30d.change_pct} %)"
                    if snap.confirmed_30d.change_pct is not None
                    else ""
                )
            ),
        ]

        if snap.checkouts_today:
            sections.append("Heutige Check-outs:")
            sections.extend(fmt_entry(entry) for entry in snap.checkouts_today[:3])
        if snap.checkins_today:
            sections.append("Heutige Check-ins:")
            sections.extend(fmt_entry(entry) for entry in snap.checkins_today[:3])
        if snap.upcoming:
            sections.append("Naechste anstehende Reservierungen:")
            sections.extend(fmt_entry(entry) for entry in snap.upcoming[:3])
        if snap.properties:
            sections.append("Objekte im Bestand:")
            sections.extend(fmt_property(entry) for entry in snap.properties)

        sections.append(f"Nutzeranfrage: {utterance}")
        sections.append(
            "Antworte direkt auf die Nutzeranfrage und nutze nur die Daten oben."
        )
        return "\n".join(sections)

    @staticmethod
    def _to_status(row: dict[str, Any]) -> OnboardingStatus:
        return OnboardingStatus(
            has_ota=row.get("has_ota"),
            selected_portals=row.get("selected_portals") or [],
            company_data_set=row.get("company_data_set", False),
            object_created=row.get("object_created", False),
            price_set=row.get("price_set", False),
            channels_done=row.get("channels_done", False),
            completed=row.get("completed", False),
        )
