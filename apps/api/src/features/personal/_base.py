"""Gemeinsamer Unterbau der Personal-Dienste: Fehler, Scope, Regeln, Personen.

Scope (Wurzel 3/9) — EINE Wahrheit für alle vier Dienste, deckungsgleich mit
`public.personal_sieht_person` (0541) auf DB-Ebene:
  * admin / co_admin   → alle Personen des Mandanten
  * shift_lead         → sich selbst + Personen, die an einem gemeinsam
                         freigegebenen Objekt eingeteilt sind
  * staff / cleaner    → nur sich selbst
Personen im Personalbereich sind Nutzer mit den Rollen staff, cleaner und
shift_lead. Admin/Co-Admin planen, werden aber nicht geplant.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, time
from decimal import Decimal
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from . import feiertage as feiertage_mod
from .regelwerk import Regeln

log = get_logger("nextdays.personal")

LEITUNG = frozenset({"admin", "co_admin"})
PLANBARE_ROLLEN = frozenset({"staff", "cleaner", "shift_lead"})
_UNIQUE_VERLETZUNG = "23505"


class PersonalError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(
        self, message: str, *, status_code: int = 400, details: dict[str, Any] | None = None
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details


def jetzt() -> datetime:
    return datetime.now(UTC)


def als_dt(wert: object) -> datetime | None:
    if isinstance(wert, datetime):
        return wert if wert.tzinfo else wert.replace(tzinfo=UTC)
    if isinstance(wert, str) and wert:
        try:
            return datetime.fromisoformat(wert.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def als_date(wert: object) -> date | None:
    if isinstance(wert, date) and not isinstance(wert, datetime):
        return wert
    if isinstance(wert, datetime):
        return wert.date()
    if isinstance(wert, str) and wert:
        try:
            return date.fromisoformat(wert[:10])
        except ValueError:
            return None
    return None


def als_time(wert: object) -> time | None:
    if isinstance(wert, time):
        return wert
    if isinstance(wert, str) and wert:
        try:
            return time.fromisoformat(wert)
        except ValueError:
            return None
    return None


def als_float(wert: object) -> float | None:
    if wert is None:
        return None
    try:
        return float(wert)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _als_int(wert: object) -> int | None:
    """Ganzzahl oder None — `None` bleibt None (kein 0-Ersatz, Wurzel 4)."""
    if wert is None:
        return None
    try:
        return int(wert)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def als_dec(wert: object) -> Decimal:
    try:
        return Decimal(str(wert))
    except (TypeError, ValueError, ArithmeticError):
        return Decimal(0)


class PersonalBase:
    """Datenbank, Scope und die geteilten Lesepfade."""

    def __init__(self, service_client: Client) -> None:
        self._db = service_client

    # --- Kontext ----------------------------------------------------------

    @staticmethod
    def _require_tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise PersonalError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    @staticmethod
    def _ist_leitung(ctx: AuthContext) -> bool:
        return ctx.role in LEITUNG

    def _rolle_aus_db(self, ctx: AuthContext, tenant_id: str) -> str | None:
        """Rolle frisch aus `users` (Wurzel 7) — für Scope-Entscheidungen, die
        Personendaten freigeben."""
        rows = (
            self._db.table("users")
            .select("role")
            .eq("id", ctx.user_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return str(rows[0]["role"]) if rows and rows[0].get("role") else None

    # --- Personen ---------------------------------------------------------

    def _users(self, tenant_id: str, user_ids: set[str] | None = None) -> list[dict[str, Any]]:
        q = (
            self._db.table("users")
            .select(
                "id, full_name, email, phone, role, avatar_url, deactivated_at, "
                "preferred_language, created_at"
            )
            .eq("tenant_id", tenant_id)
        )
        if user_ids is not None:
            if not user_ids:
                return []
            q = q.in_("id", sorted(user_ids))
        return q.execute().data or []

    def _objekte_von(self, tenant_id: str, user_id: str) -> set[str]:
        rows = (
            self._db.table("staff_property_assignments")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .execute()
        ).data or []
        return {str(r["property_id"]) for r in rows}

    def _personen_im_scope(self, ctx: AuthContext, tenant_id: str) -> set[str]:
        """user_ids der planbaren Personen, die `ctx` sehen darf."""
        rolle = self._rolle_aus_db(ctx, tenant_id)
        if rolle in LEITUNG:
            return {
                str(u["id"])
                for u in self._users(tenant_id)
                if str(u.get("role")) in PLANBARE_ROLLEN
            }
        if rolle == "shift_lead":
            meine = self._objekte_von(tenant_id, ctx.user_id)
            ids = {ctx.user_id}
            if meine:
                rows = (
                    self._db.table("staff_property_assignments")
                    .select("user_id")
                    .eq("tenant_id", tenant_id)
                    .in_("property_id", sorted(meine))
                    .execute()
                ).data or []
                ids |= {str(r["user_id"]) for r in rows}
            return ids
        if rolle in PLANBARE_ROLLEN:
            return {ctx.user_id}
        # owner, unbekannt: nichts (fail-closed).
        return set()

    def _require_person_im_scope(self, ctx: AuthContext, tenant_id: str, user_id: str) -> None:
        if user_id not in self._personen_im_scope(ctx, tenant_id):
            # Dieselbe Meldung wie „gibt es nicht": kein Existenz-Leak (Wurzel 9).
            raise PersonalError("Person nicht gefunden.", status_code=404)

    def _require_planbar(self, tenant_id: str, user_id: str) -> dict[str, Any]:
        rows = self._users(tenant_id, {user_id})
        if not rows or str(rows[0].get("role")) not in PLANBARE_ROLLEN:
            raise PersonalError(
                "Nur Mitarbeitende (staff, cleaner, shift_lead) können eingeplant werden.",
                status_code=422,
            )
        return rows[0]

    def _property_im_tenant(self, tenant_id: str, property_id: str) -> dict[str, Any]:
        return load_scoped(
            self._db,
            "properties",
            property_id,
            tenant_id,
            columns="id, title, timezone, archived_at, building_id",
            not_found=PersonalError("Objekt nicht gefunden.", status_code=404),
        )

    def _property_titel(self, tenant_id: str, ids: set[str]) -> dict[str, str]:
        if not ids:
            return {}
        rows = (
            self._db.table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .in_("id", sorted(ids))
            .execute()
        ).data or []
        return {str(r["id"]): str(r.get("title") or "") for r in rows}

    # --- Regeln -----------------------------------------------------------

    def _regeln_row(self, tenant_id: str) -> dict[str, Any] | None:
        rows = (
            self._db.table("personal_regeln")
            .select("*")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _regeln(self, tenant_id: str) -> Regeln:
        """Bestätigte Betriebsregeln — ohne sie kein Plan, keine Zuschläge (422)."""
        row = self._regeln_row(tenant_id)
        if row is None or not row.get("bestaetigt_am"):
            raise PersonalError(
                "Die Betriebsregeln (Ruhezeit, Höchststunden, Zuschläge) sind noch nicht "
                "bestätigt. Bitte unter Personal → Einstellungen prüfen und bestätigen.",
                status_code=422,
                details={"code": "regeln_fehlen"},
            )
        return Regeln(
            zeitzone=str(row["zeitzone"]),
            ruhezeit_stunden=float(row["ruhezeit_stunden"]),
            max_tagesstunden=float(row["max_tagesstunden"]),
            max_wochenstunden=float(row["max_wochenstunden"]),
            nacht_von=als_time(row["nacht_von"]) or time(22, 0),
            nacht_bis=als_time(row["nacht_bis"]) or time(6, 0),
            zuschlag_nacht_pct=float(row["zuschlag_nacht_pct"]),
            zuschlag_sonntag_pct=float(row["zuschlag_sonntag_pct"]),
            zuschlag_feiertag_pct=float(row["zuschlag_feiertag_pct"]),
            zuschlag_ueberstunden_pct=float(row["zuschlag_ueberstunden_pct"]),
            urlaubsjahr_start_monat=int(row["urlaubsjahr_start_monat"]),
            uebertrag_verfall_monat=(
                int(row["uebertrag_verfall_monat"])
                if row.get("uebertrag_verfall_monat") is not None
                else None
            ),
            uebertrag_max_tage=als_float(row.get("uebertrag_max_tage")),
            mindest_vorlauf_urlaub_tage=int(row.get("mindest_vorlauf_urlaub_tage") or 0),
            # 0544/0545: die Migration setzt Defaults, `.get` liest sie mit.
            # Ein `or`-Ersatzwert wäre hier falsch (Wurzel 4) — `None` heißt
            # „Prüfung aus", nicht „nimm irgendwas".
            jugendschutz_bis_alter=_als_int(row.get("jugendschutz_bis_alter")),
            jugendschutz_max_tagesstunden=als_float(row.get("jugendschutz_max_tagesstunden")),
            jugendschutz_nacht_von=als_time(row.get("jugendschutz_nacht_von")),
            jugendschutz_nacht_bis=als_time(row.get("jugendschutz_nacht_bis")),
            zweistufige_genehmigung=bool(row.get("zweistufige_genehmigung")),
            max_urlaub_zusammenhaengend_tage=_als_int(
                row.get("max_urlaub_zusammenhaengend_tage")
            ),
            gps_pflicht=bool(row.get("gps_pflicht")),
            gps_radius_m=_als_int(row.get("gps_radius_m")) or 250,
            stempel_ab_schichtbeginn=bool(row.get("stempel_ab_schichtbeginn")),
            verspaetung_melden_min=_als_int(row.get("verspaetung_melden_min")),
            terminal_aktiv=bool(row.get("terminal_aktiv")),
            wetter_anzeigen=bool(row.get("wetter_anzeigen", True)),
            ziel_umsatzproduktivitaet_minor=_als_int(
                row.get("ziel_umsatzproduktivitaet_minor")
            ),
            ziel_personalkostenquote_pct=als_float(row.get("ziel_personalkostenquote_pct")),
            kennzahlen_currency=row.get("kennzahlen_currency"),
            kennzahlen_zeilen=tuple(
                str(z) for z in (row.get("kennzahlen_zeilen") or ["besetzung", "stundenlimit"])
            ),
        )

    def _land_und_region(self, tenant_id: str) -> tuple[str, str | None]:
        row = self._regeln_row(tenant_id)
        if row is None:
            raise PersonalError(
                "Betriebsregeln fehlen.", status_code=422, details={"code": "regeln_fehlen"}
            )
        return str(row["land"]), row.get("feiertage_region")

    def _feiertage(self, tenant_id: str, von: date, bis: date) -> dict[date, str]:
        land, region = self._land_und_region(tenant_id)
        try:
            return feiertage_mod.laden(self._db, land, region, von, bis)
        except feiertage_mod.FeiertageFehlen as exc:
            raise PersonalError(
                str(exc), status_code=422, details={"code": "feiertage_fehlen", "land": land}
            ) from exc

    # --- Akte-Kurzdaten -----------------------------------------------------

    def _akten(self, tenant_id: str, user_ids: set[str]) -> dict[str, dict[str, Any]]:
        if not user_ids:
            return {}
        rows = (
            self._db.table("personal_akten")
            .select(
                "user_id, beschaeftigungsart, firma_id, employee_number, position, eintritt, "
                "austritt, wochenstunden, tagesstunden, arbeitstage_je_woche, "
                "stundenlohn_minor, gehalt_minor, currency, urlaubsanspruch_tage, "
                "arbeitgeber_aufschlag_pct"
            )
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(user_ids))
            .execute()
        ).data or []
        return {str(r["user_id"]): r for r in rows}

    def _arbeitstage(self, akte: dict[str, Any] | None) -> set[int]:
        """Wochentage (0–6), an denen die Person regulär arbeitet.

        Ohne Akte oder ohne Angabe: Montag–Freitag — das ist KEIN erfundener
        Lohnwert, sondern die Zählbasis, die BUrlG/Ferieloven selbst zugrunde
        legen (Fünf-Tage-Woche). Eine Sechs-Tage-Kraft trägt 6 in der Akte ein.
        """
        n = int((akte or {}).get("arbeitstage_je_woche") or 5)
        return set(range(min(7, max(1, n))))

    def _protokoll(  # noqa: PLR0913 — Protokollzeile mit allen Bezügen
        self,
        tenant_id: str,
        schicht_id: str,
        akteur_id: str | None,
        art: str,
        alt: dict[str, Any] | None,
        neu: dict[str, Any] | None,
    ) -> None:
        try:
            self._db.table("personal_schicht_aenderungen").insert(
                {
                    "tenant_id": tenant_id,
                    "schicht_id": schicht_id,
                    "akteur_id": akteur_id,
                    "art": art,
                    "alt": alt,
                    "neu": neu,
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Protokoll ist Nebenpfad
            log.warning("personal_protokoll_fehlgeschlagen", schicht_id=schicht_id, error=str(exc))
