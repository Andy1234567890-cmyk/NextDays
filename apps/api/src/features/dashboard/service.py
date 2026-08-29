"""Service-Schicht für dashboard (inkl. Onboarding-Fortschritt).

Tenant-scoped über die Service-Role mit EXPLIZITEM tenant-Scope (tenant_id aus
dem JWT, nie aus User-Input) — gleiches Muster wie die anderen Slices.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

# Der Geruest-Titel kommt aus der Stelle, die ihn ANLEGT — nicht als zweite
# Zeichenkette hier. Sonst zaehlt diese Messung eines Tages ein Geruest mit,
# weil dort umbenannt wurde (Wurzel 4). Kein Zirkelbezug: der channel_manager
# importiert dashboard nicht.
from src.features.channel_manager.airbnb_uebernahme import GERUEST_TITEL
from src.features.inbox.ai import GroqClient, GroqError

from .schemas import (
    DashboardEntrySnapshot,
    DashboardPropertySnapshot,
    DashboardVoiceRequest,
    DashboardVoiceResponse,
    DashboardVoiceSnapshot,
    OnboardingStatus,
    OnboardingUpdate,
    SliceHealth,
)

log = get_logger("nextdays.dashboard")


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
            return self._to_status({}, tenant_id)
        return self._to_status(res.data[0], tenant_id)

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
        return self._to_status(saved.data[0], tenant_id)

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
                    "Anfrage."
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

        def fmt_entry(entry: DashboardEntrySnapshot) -> str:
            guest = entry.guest_name or "unbekannt"
            prop = f", Objekt: {entry.property_title}" if entry.property_title else ""
            ota = f", Kanal: {entry.ota_name}" if entry.ota_name else ""
            return (
                f"- {guest}{prop}{ota}, {entry.check_in} bis {entry.check_out}, "
                f"Status: {entry.status}"
            )

        def fmt_property(entry: DashboardPropertySnapshot) -> str:
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

    def _to_status(self, row: dict[str, Any], tenant_id: str) -> OnboardingStatus:
        # object_created / price_set / channels_done werden NICHT (mehr) allein aus
        # den client-gesetzten Flags abgeleitet — die logen den echten Zustand und
        # erzeugten falsch-positive "fertig"-Anzeigen (grüner Haken, obwohl kein
        # Objekt existiert / nichts bei den Portalen registriert ist). Der wahre
        # Fortschritt wird aus der DB gemessen; das Flag zählt nur als ODER-Zusatz
        # (der Nutzer kann einen Schritt bewusst als erledigt markiert haben, ohne
        # dass er DB-sichtbar ist — z. B. "keine OTA gewünscht").
        counts = self._real_progress(tenant_id)
        return OnboardingStatus(
            customer_type=row.get("customer_type"),
            has_ota=row.get("has_ota"),
            selected_portals=row.get("selected_portals") or [],
            # UND, nicht ODER: bei den anderen Feldern hebt die Messung ein
            # fehlendes Flag auf (der Zustand IST erreicht). Hier ist es
            # umgekehrt — ohne Abrechnungsprofil sind die Firmendaten NICHT
            # gespeichert, egal was das Flag behauptet (Wurzel 4: keine
            # erfundene Bestaetigung).
            company_data_set=(
                row.get("company_data_set", False) and counts["has_company"]
            ),
            subscription_active=counts["subscription_active"],
            in_trial=counts["in_trial"],
            trial_ends_at=counts["trial_ends_at"],
            imported_from_ota=row.get("imported_from_ota", False),
            object_created=row.get("object_created", False) or counts["has_property"],
            object_count=counts["object_count"],
            price_set=row.get("price_set", False) or counts["has_rate_plan"],
            channels_done=row.get("channels_done", False) or counts["has_registered"],
            completed=row.get("completed", False),
        )

    def _real_progress(self, tenant_id: str) -> dict[str, Any]:
        """Echten Onboarding-Fortschritt aus der DB messen (keine client-Flags).

        Drei Fragen: existiert ein ECHTES Objekt? hat eines einen Preisplan? ist
        ein Portal WIRKLICH autorisiert?

        WAS HIER FRUEHER FALSCH WAR (live am 29.08.2026 im frischen Testkonto):
        Beide Messungen zaehlten einen HALBFERTIGEN Zustand als fertig.

        1. `has_registered` fragte nur, ob eine Zeile in `channex_property_map`
           steht. Die legt `uebernahme_starten` aber SOFORT an — zusammen mit
           einem Geruest-Objekt und BEVOR der Kunde bei Airbnb ueberhaupt
           zugestimmt hat: Channex braucht ein Ziel, auf das die Airbnb-Anzeigen
           spaeter gemappt werden. Blieb die Zustimmung aus, stand die Zeile
           trotzdem da. Gemessen war die Lage:

               channex_property_map : 1 Zeile     (07:33:18)
               ota_account          : connected_at = NULL, is_active = true
               Channex-Kanal        : settings = {}, hat_tokens = False

           Die Oberflaeche sagte daraufhin „Ein Portal ist schon verbunden — du
           musst hier nichts erneut verbinden", waehrend derselbe Server jeden
           Abruf der Inserate mit 409 „nicht autorisiert" ablehnte. Zwei
           widersprechende Aussagen aus demselben halbfertigen Zustand.

        2. `has_property` zaehlte dasselbe Geruest-Objekt als „Objekt angelegt"
           („1 Objekt uebernommen", obwohl nichts uebernommen wurde).

        Die ehrliche Angabe ist `ota_account.connected_at`: sie wird gesetzt,
        wenn das Portal die Autorisierung BESTAETIGT hat — nicht, wenn wir sie
        angefragt haben (Wurzel 5b: unsere Uhr ist nicht der Zeitpunkt eines
        fremden Ereignisses). Ohne sie ist nichts verbunden, egal wie viele
        Zeilen wir schon vorbereitet haben.
        """
        db = self._require_db()

        # Das Geruest ist KEIN Objekt des Kunden: es traegt nur den Platz frei,
        # bis die echten Airbnb-Daten kommen (airbnb_uebernahme.GERUEST_TITEL).
        alle_props = (
            db.table("properties")
            .select("id, title, airbnb_listing_id")
            .eq("tenant_id", tenant_id)
            .limit(50)
            .execute()
        ).data or []
        echte_props = [
            p
            for p in alle_props
            if not (p.get("title") == GERUEST_TITEL and not p.get("airbnb_listing_id"))
        ]

        has_rate_plan = False
        if echte_props:
            has_rate_plan = bool(
                (
                    db.table("rate_plans")
                    .select("id, properties!inner(tenant_id)")
                    .eq("properties.tenant_id", tenant_id)
                    .limit(1)
                    .execute()
                ).data
            )

        # AUTORISIERT heisst: das Portal hat bestaetigt (`connected_at`), der
        # Zugang ist aktiv und die Tokens sind nicht verfallen. Alle drei
        # Bedingungen, nicht eine — `is_active` allein steht auch auf einem
        # Konto, das nie zustande kam (gemessen, siehe oben).
        konten = (
            db.table("ota_account")
            .select("id, ota_portal_code, connected_at, is_active, token_invalid")
            .eq("tenant_id", tenant_id)
            .limit(50)
            .execute()
        ).data or []
        autorisiert = [
            k
            for k in konten
            if k.get("connected_at") and k.get("is_active") and not k.get("token_invalid")
        ]

        # Firmendaten: gibt es das Abrechnungsprofil WIRKLICH?
        #
        # Live gemessen (29.08.2026): 4 Betriebe trugen `company_data_set=true`,
        # aber in der ganzen DB stand genau EIN `tenant_billing_profile`. Das
        # Onboarding meldete trotzdem „Firmendaten gespeichert!" — eine
        # Falschaussage aus einem Flag, das ein frueherer Durchlauf gesetzt
        # hatte und das seither niemand gegen die Daten geprueft hat.
        #
        # Dieselbe Lehre wie bei `has_registered` weiter oben: ein Flag sagt,
        # was jemand VORHATTE, die Zeile sagt, was PASSIERT ist.
        profil = (
            db.table("tenant_billing_profile")
            .select("tenant_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []

        # Laeuft ein Abo? Ohne das ist die Oberflaeche eine Sackgasse
        # (`publish` lehnt mit 422 ab), also darf die Navigation es wissen.
        abo = (
            db.table("tenant_subscription")
            .select("status, current_period_end")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        abo_aktiv = bool(abo) and abo[0].get("status") in ("active", "trialing")
        # Laeuft gerade die kostenlose Testphase? Waehrend `trialing` traegt
        # `current_period_end` das ENDE DER TESTPHASE (so fuellt Stripe es) —
        # also genau das Datum, das der Betrieb kennen muss, bevor abgebucht
        # wird. Hier mitgeliefert, damit der Hinweis im Dashboard keinen
        # zweiten Abruf braucht. Fehlt der Wert, bleibt er None und die
        # Oberflaeche zeigt kein Datum statt eines gerechneten (Wurzel 4).
        in_testphase = bool(abo) and abo[0].get("status") == "trialing"
        testphase_endet = abo[0].get("current_period_end") if in_testphase else None

        ergebnis = {
            "subscription_active": abo_aktiv,
            "in_trial": in_testphase,
            "trial_ends_at": testphase_endet,
            "has_property": bool(echte_props),
            "has_rate_plan": has_rate_plan,
            "has_registered": bool(autorisiert),
            "has_company": bool(profil),
            "object_count": len(echte_props),
        }

        # Debug-Spur: WARUM steht der Fortschritt so? Ohne diese Zeile war der
        # Widerspruch „verbunden laut UI / 409 laut Server" nur durch Raten und
        # zwei Handabfragen in der Live-DB aufzuloesen. Nur Zahlen und Codes,
        # keine Titel und keine IDs von Kundendaten.
        log.info(
            "onboarding_fortschritt",
            tenant=tenant_id[:8],
            objekte_gesamt=len(alle_props),
            objekte_echt=len(echte_props),
            geruest=len(alle_props) - len(echte_props),
            konten_gesamt=len(konten),
            konten_autorisiert=len(autorisiert),
            konten_ohne_bestaetigung=[
                k.get("ota_portal_code") for k in konten if not k.get("connected_at")
            ],
            **ergebnis,
        )
        return ergebnis
