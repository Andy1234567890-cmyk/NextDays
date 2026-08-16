"""Startseiten-Layout — lesen, speichern, zuruecksetzen.

Drei Quellen, in dieser Reihenfolge:
    1. das Layout DIESES Nutzers (dashboard_layouts.user_id)
    2. der Standard SEINER Rolle in SEINEM Betrieb (dashboard_role_defaults)
    3. der Katalog-Standard aus dem Code (Frontend) — hier als `None` signalisiert

Der Service liefert nie ein erfundenes Layout: fehlt Stufe 1 und 2, kommt
`quelle="standard"` und `layout=None` zurueck, und das Frontend nimmt seinen
Katalog. Ein serverseitig zusammengebautes Ersatz-Layout waere ein zweiter
Wahrheitsort fuer den Katalog (Wurzel 4).

Der Service-Client umgeht RLS. Jede Abfrage wird deshalb explizit gescopt: das
Benutzer-Layout auf `ctx.user_id`, die Rollen-Standards auf `ctx.tenant_id`
(Wurzel 3).
"""
from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .schemas import (
    DashboardLayout,
    DashboardLayoutAntwort,
    RollenStandardAntwort,
)

log = get_logger("nextdays.dashboard_layout")


class DashboardLayoutError(Exception):
    """Fachlicher Fehler mit HTTP-Status (der Router mappt ihn)."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class DashboardLayoutService:
    def __init__(self, db: Client) -> None:
        self._db = db

    # -- Benutzer-Layout ---------------------------------------------------

    def get(self, ctx: AuthContext) -> DashboardLayoutAntwort:
        """Wirksames Layout des eingeloggten Nutzers samt Herkunft.

        Der Rollen-Standard wird IMMER mitgeliefert, auch wenn das eigene
        Layout gewinnt: „Auf Standard zuruecksetzen" soll ohne zweiten Aufruf
        zeigen koennen, worauf es zuruecksetzt.
        """
        rollen_standard = self._rollen_standard_laden(ctx, ctx.role)

        eigen = self._eigenes_layout_laden(ctx)
        if eigen is not None:
            return DashboardLayoutAntwort(
                layout=eigen, quelle="benutzer", rollen_standard=rollen_standard
            )
        if rollen_standard is not None:
            return DashboardLayoutAntwort(
                layout=rollen_standard,
                quelle="rolle",
                rollen_standard=rollen_standard,
            )
        return DashboardLayoutAntwort(
            layout=None, quelle="standard", rollen_standard=None
        )

    def speichern(
        self, ctx: AuthContext, layout: DashboardLayout
    ) -> DashboardLayoutAntwort:
        """Eigenes Layout ablegen (Upsert auf user_id)."""
        self._db.table("dashboard_layouts").upsert(
            {
                "user_id": ctx.user_id,
                "layout": layout.model_dump(),
                "updated_at": datetime.now(UTC).isoformat(),
            },
            on_conflict="user_id",
        ).execute()
        log.info(
            "dashboard_layout_gespeichert",
            user_id=ctx.user_id,
            kacheln=len(layout.kacheln),
            ausgeblendet=len(layout.ausgeblendet),
        )
        return self.get(ctx)

    def zuruecksetzen(self, ctx: AuthContext) -> DashboardLayoutAntwort:
        """Eigenes Layout loeschen — danach greift wieder der Rollen-Standard
        bzw. der Katalog-Standard. Kein 404, wenn es keins gab: das Ziel ist
        „kein eigenes Layout", und das ist danach erreicht (idempotent)."""
        self._db.table("dashboard_layouts").delete().eq(
            "user_id", ctx.user_id
        ).execute()
        log.info("dashboard_layout_zurueckgesetzt", user_id=ctx.user_id)
        return self.get(ctx)

    # -- Rollen-Standards (MANAGE_TENANT, Guard im Router) -----------------

    def rollen_standard_lesen(
        self, ctx: AuthContext, role: str
    ) -> RollenStandardAntwort:
        """Standard einer Rolle im eigenen Betrieb. Kein Treffer → `layout=None`
        (die Rolle erbt dann den Katalog-Standard), kein 404."""
        return RollenStandardAntwort(
            role=role,  # type: ignore[arg-type]  # Literal vom Router validiert
            layout=self._rollen_standard_laden(ctx, role),
        )

    def rollen_standard_setzen(
        self, ctx: AuthContext, role: str, layout: DashboardLayout
    ) -> RollenStandardAntwort:
        """Standard einer Rolle setzen (Upsert auf tenant_id+role)."""
        tenant_id = self._tenant_id(ctx)
        self._db.table("dashboard_role_defaults").upsert(
            {
                "tenant_id": tenant_id,
                "role": role,
                "layout": layout.model_dump(),
                "updated_at": datetime.now(UTC).isoformat(),
            },
            on_conflict="tenant_id,role",
        ).execute()
        log.info(
            "dashboard_rollen_standard_gesetzt",
            tenant_id=tenant_id,
            role=role,
            kacheln=len(layout.kacheln),
        )
        return self.rollen_standard_lesen(ctx, role)

    def rollen_standard_entfernen(
        self, ctx: AuthContext, role: str
    ) -> RollenStandardAntwort:
        """Standard einer Rolle entfernen. Danach erbt die Rolle den
        Katalog-Standard. Idempotent wie `zuruecksetzen`."""
        tenant_id = self._tenant_id(ctx)
        self._db.table("dashboard_role_defaults").delete().eq(
            "tenant_id", tenant_id
        ).eq("role", role).execute()
        log.info(
            "dashboard_rollen_standard_entfernt", tenant_id=tenant_id, role=role
        )
        return self.rollen_standard_lesen(ctx, role)

    # -- intern ------------------------------------------------------------

    def _tenant_id(self, ctx: AuthContext) -> str:
        """Tenant des Aufrufers. Fehlt er, ist der Aufruf nicht scopebar — dann
        lieber klar fehlschlagen als tenant-weit zu schreiben (Wurzel 3/4)."""
        if not ctx.tenant_id:
            raise DashboardLayoutError(
                "Kein Betrieb am Konto hinterlegt.", status_code=422
            )
        return ctx.tenant_id

    def _eigenes_layout_laden(self, ctx: AuthContext) -> DashboardLayout | None:
        row = (
            self._db.table("dashboard_layouts")
            .select("layout")
            .eq("user_id", ctx.user_id)
            .limit(1)
            .execute()
        ).data
        return self._layout_aus_zeile(row)

    def _rollen_standard_laden(
        self, ctx: AuthContext, role: str | None
    ) -> DashboardLayout | None:
        if not ctx.tenant_id or not role:
            return None
        row = (
            self._db.table("dashboard_role_defaults")
            .select("layout")
            .eq("tenant_id", ctx.tenant_id)
            .eq("role", role)
            .limit(1)
            .execute()
        ).data
        return self._layout_aus_zeile(row)

    @staticmethod
    def _layout_aus_zeile(row: list[dict] | None) -> DashboardLayout | None:
        """Gespeichertes jsonb in ein Layout uebersetzen.

        Passt es nicht mehr zum Schema (aeltere Version, entfernte Kachel-ID),
        wird es VERWORFEN statt teilweise uebernommen — der Aufrufer faellt dann
        auf die naechste Quelle zurueck. Genau das ist der Wurzel-4-konforme
        Ausgang: lieber der bekannte Standard als ein halbes Layout.
        """
        if not row:
            return None
        try:
            return DashboardLayout.model_validate(row[0]["layout"])
        except (ValueError, KeyError, TypeError) as exc:
            # Kein breites except: nur Formfehler des gespeicherten Werts. Ein
            # Verbindungsfehler soll weiterhin durchschlagen (Wurzel 5).
            log.warning("dashboard_layout_unlesbar", fehler=str(exc))
            return None
