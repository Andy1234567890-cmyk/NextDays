"""Push-Geraete eines Nutzers (`public.push_devices`, Migration 0414).

Ein Geraet meldet beim Anmelden sein FCM-Token an und beim Abmelden ab. Die
Tabelle steht unter hartem GRANT-Entzug (Wurzel 6) — der Weg dorthin fuehrt
ausschliesslich hierueber.
"""
from __future__ import annotations

import structlog
from supabase import Client

log = structlog.get_logger(__name__)

# Ein Geraet, das zwei Monate nicht mehr aufgetaucht ist, wird nicht mehr
# bedient. FCM meldet abgemeldete Tokens erst beim Senden; ohne diese Grenze
# waechst die Tabelle mit jedem neu installierten Telefon.
VERALTET_TAGE = 60

_APPS = frozenset({"mynextdays", "mybestdays"})
_PLATTFORMEN = frozenset({"ios", "android"})


class GeraeteFehler(Exception):
    def __init__(self, nachricht: str, status_code: int = 422) -> None:
        super().__init__(nachricht)
        self.message = nachricht
        self.status_code = status_code


class PushGeraeteService:
    def __init__(self, db: Client) -> None:
        self._db = db

    def registrieren(
        self,
        *,
        user_id: str,
        tenant_id: str | None,
        token: str,
        platform: str,
        app: str,
    ) -> None:
        """Token anmelden oder auffrischen.

        Idempotent (Wurzel 2): derselbe Token legt keine zweite Zeile an,
        sondern hebt `last_seen_at` und zieht die Zuordnung nach. Letzteres ist
        der eigentliche Grund fuer den Upsert statt eines Inserts mit
        ON CONFLICT DO NOTHING: wechselt der Nutzer eines Geraets (Telefon
        weitergegeben, zweiter Betrieb), bekaeme sonst der VORIGE Nutzer weiter
        die Pushes dieses Geraets.
        """
        tok = (token or "").strip()
        if not tok:
            raise GeraeteFehler("Token fehlt.")
        if platform not in _PLATTFORMEN:
            raise GeraeteFehler(f"Unbekannte Plattform: {platform}")
        if app not in _APPS:
            raise GeraeteFehler(f"Unbekannte App: {app}")

        self._db.table("push_devices").upsert(
            {
                "user_id": user_id,
                "tenant_id": tenant_id,
                "token": tok,
                "platform": platform,
                "app": app,
                "last_seen_at": "now()",
            },
            on_conflict="token",
        ).execute()
        log.info("push_geraet_registriert", user_id=user_id, platform=platform, app=app)

    def abmelden(self, *, user_id: str, token: str) -> None:
        """Token entfernen (Logout).

        Auf `user_id` mitgescoped, nicht nur auf den Token: sonst koennte ein
        beliebiger angemeldeter Nutzer mit einem geratenen/abgefangenen Token
        das Geraet eines anderen stummschalten (Wurzel 3/9).
        """
        tok = (token or "").strip()
        if not tok:
            return
        self._db.table("push_devices").delete().eq("token", tok).eq(
            "user_id", user_id
        ).execute()
        log.info("push_geraet_abgemeldet", user_id=user_id)

    def tokens_fuer(self, user_id: str, *, app: str) -> list[str]:
        """Aktive Tokens eines Nutzers fuer EINE App.

        Die App-Trennung ist Pflicht (ADR-0019): eine Betriebs-Meldung darf
        nicht auf dem Gast-Telefon derselben Person landen.
        """
        rows = (
            self._db.table("push_devices")
            .select("token")
            .eq("user_id", user_id)
            .eq("app", app)
            .execute()
            .data
            or []
        )
        return [r["token"] for r in rows if r.get("token")]

    def ungueltige_entfernen(self, tokens: list[str]) -> None:
        """Von FCM als abgemeldet gemeldete Tokens loeschen (Gegenzustand,
        Wurzel 1). Ohne das bliebe jedes deinstallierte Telefon fuer immer in
        der Empfaengerliste und jeder Versand liefe erneut in denselben 404."""
        if not tokens:
            return
        self._db.table("push_devices").delete().in_("token", tokens).execute()
        log.info("push_tokens_entfernt", anzahl=len(tokens))
