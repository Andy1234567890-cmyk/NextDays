"""Terminierte Akte-Änderungen (0544, Vertrag §3.1).

Der Fall aus der Praxis: „Ab 01.07. arbeitet sie 30 statt 40 Stunden." Wer das
sofort in die Akte schreibt, verfälscht Soll, Kosten und Urlaubsanspruch der
Vergangenheit; wer es sich notiert, vergisst es. Deshalb liegt die Änderung als
Zeile mit `gueltig_ab`, und der stündliche Worker wendet sie am Stichtag an.

Zwei Dinge sind hier bewusst getrennt:

* **Der Dienst** (`AkteAenderungenService`) legt an, listet und löscht — mit
  Autorisierung (MANAGE_PERSONAL am Router, Personen-Scope hier).
* **Die Modulfunktion** `aenderungen_anwenden(db, heute)` läuft im Worker OHNE
  Nutzer und ohne `AuthContext`. Sie schreibt über
  `PersonalService.akte_patch_anwenden`, also über denselben Kern wie der
  Klick auf Speichern — eine eigene Kopie der Prüf- und Verschlüsselungslogik
  wäre am ersten neuen Pflichtfeld auseinandergelaufen.

Die Feldnamen prüft der Dienst BEIM ANLEGEN gegen `AkteUpdate` (422
`feld_unbekannt`). Erst am Stichtag zu merken, dass ein Name falsch ist, wäre
ein stiller Ausfall Wochen nach der Eingabe (Wurzel 5).
"""

from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import ValidationError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client, load_scoped

from ._base import PersonalBase, PersonalError, als_date, als_dt, jetzt
from .schemas import AkteUpdate
from .service import PersonalService
from .ueberstunden_schemas import AkteAenderung, AkteAenderungCreate

log = get_logger("nextdays.personal.akte_aenderungen")

_SPALTEN = "id, user_id, gueltig_ab, felder, grund, angewendet_am, erstellt_von, created_at"


def _erlaubte_felder() -> frozenset[str]:
    """Die Feldnamen, die eine Änderung tragen darf — aus `AkteUpdate` selbst.

    Nicht als eigene Liste: sonst fehlt hier jedes Feld, das die Akte später
    dazubekommt, und der Nutzer bekäme ein `feld_unbekannt` für etwas, das im
    Formular direkt daneben steht.
    """
    return frozenset(AkteUpdate.model_fields) - {"geleert"}


class AkteAenderungenService(PersonalBase):
    """Anlegen, listen und löschen terminierter Änderungen."""

    def liste(self, ctx: AuthContext, user_id: str) -> list[AkteAenderung]:
        tenant_id = self._require_tenant(ctx)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        rows = (
            self._db.table("personal_akte_aenderungen")
            .select(_SPALTEN)
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .order("gueltig_ab", desc=False)
            .execute()
        ).data or []
        ersteller = {str(r["erstellt_von"]) for r in rows if r.get("erstellt_von")}
        namen = self._namen(tenant_id, ersteller)
        return [self._aus_row(r, namen) for r in rows]

    def anlegen(
        self, ctx: AuthContext, user_id: str, req: AkteAenderungCreate
    ) -> AkteAenderung:
        tenant_id = self._require_tenant(ctx)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        self._require_planbar(tenant_id, user_id)
        heute = jetzt().date()
        if req.gueltig_ab < heute:
            raise PersonalError(
                "Eine Änderung wirkt ab heute oder später. Für die Vergangenheit "
                "die Akte direkt bearbeiten.",
                status_code=422,
                details={"code": "gueltig_ab_vergangen", "heute": heute.isoformat()},
            )
        felder = self._felder_pruefen(req.felder)
        row = (
            self._db.table("personal_akte_aenderungen")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "gueltig_ab": req.gueltig_ab.isoformat(),
                    "felder": felder,
                    "grund": req.grund,
                    "erstellt_von": ctx.user_id,
                }
            )
            .execute()
        ).data[0]
        log.info(
            "personal_akte_aenderung_angelegt",
            tenant_id=tenant_id,
            user_id=user_id,
            gueltig_ab=req.gueltig_ab.isoformat(),
            felder=sorted(felder),
        )
        return self._aus_row(row, self._namen(tenant_id, {ctx.user_id}))

    def loeschen(self, ctx: AuthContext, aenderung_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        row = load_scoped(
            self._db,
            "personal_akte_aenderungen",
            aenderung_id,
            tenant_id,
            not_found=PersonalError("Änderung nicht gefunden.", status_code=404),
        )
        self._require_person_im_scope(ctx, tenant_id, str(row["user_id"]))
        if row.get("angewendet_am") is not None:
            raise PersonalError(
                "Diese Änderung ist schon angewendet. Sie steht in der Akte und "
                "wird dort geändert.",
                status_code=409,
                details={"code": "schon_angewendet"},
            )
        (
            self._db.table("personal_akte_aenderungen")
            .delete()
            .eq("id", aenderung_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )

    # ------------------------------------------------------------------
    # Intern
    # ------------------------------------------------------------------

    @staticmethod
    def _felder_pruefen(felder: dict[str, Any]) -> dict[str, Any]:
        """Namen gegen `AkteUpdate` prüfen und die Werte durch das Schema schicken."""
        erlaubt = _erlaubte_felder()
        unbekannt = sorted(set(felder) - erlaubt)
        if unbekannt:
            raise PersonalError(
                f"Unbekanntes Feld: {', '.join(unbekannt)}.",
                status_code=422,
                details={"code": "feld_unbekannt", "felder": unbekannt},
            )
        try:
            geprueft = AkteUpdate.model_validate(felder)
        except ValidationError as exc:
            erste = exc.errors()[0]
            feld = ".".join(str(t) for t in erste.get("loc", ())) or "?"
            raise PersonalError(
                f"Der Wert für {feld} passt nicht: {erste.get('msg', '')}",
                status_code=422,
                details={"code": "wert_ungueltig", "feld": feld},
            ) from exc
        # Nur die gesetzten Felder speichern, in JSON-fähiger Form.
        return geprueft.model_dump(exclude_unset=True, exclude={"geleert"}, mode="json")

    def _namen(self, tenant_id: str, ids: set[str]) -> dict[str, str]:
        if not ids:
            return {}
        return {
            str(u["id"]): str(u.get("full_name") or "")
            for u in self._users(tenant_id, ids)
        }

    @staticmethod
    def _aus_row(row: dict[str, Any], namen: dict[str, str]) -> AkteAenderung:
        return AkteAenderung(
            id=str(row["id"]),
            user_id=str(row["user_id"]),
            gueltig_ab=als_date(row["gueltig_ab"]) or jetzt().date(),
            felder=dict(row.get("felder") or {}),
            grund=row.get("grund"),
            angewendet_am=als_dt(row.get("angewendet_am")),
            erstellt_von_name=namen.get(str(row.get("erstellt_von") or "")) or None,
            created_at=als_dt(row.get("created_at")),
        )


def aenderungen_anwenden(db: Client, heute: date) -> int:
    """Alle fälligen Änderungen anwenden (Worker-Tick, §1.7).

    Ein Fehler in einer Zeile kippt die anderen nicht (Wurzel 5): er wird LAUT
    geloggt und die Zeile bleibt offen, damit der nächste Lauf sie erneut
    versucht — still „angewendet" zu markieren wäre der schlimmere Fall.
    """
    rows = (
        db.table("personal_akte_aenderungen")
        .select("id, tenant_id, user_id, gueltig_ab, felder")
        .lte("gueltig_ab", heute.isoformat())
        .is_("angewendet_am", "null")
        .order("gueltig_ab", desc=False)
        .execute()
    ).data or []
    if not rows:
        return 0
    dienst = PersonalService(service_client=db)
    angewendet = 0
    for row in rows:
        tenant_id = str(row["tenant_id"])
        user_id = str(row["user_id"])
        try:
            req = AkteUpdate.model_validate(dict(row.get("felder") or {}))
            rolle = _rolle(db, user_id)
            dienst.akte_patch_anwenden(tenant_id, user_id, req, rolle=rolle)
        except (PersonalError, ValidationError) as exc:
            log.warning(
                "personal_akte_aenderung_fehlgeschlagen",
                tenant_id=tenant_id,
                user_id=user_id,
                aenderung_id=str(row["id"]),
                error=str(exc)[:200],
            )
            continue
        (
            db.table("personal_akte_aenderungen")
            .update({"angewendet_am": jetzt().isoformat()})
            .eq("id", str(row["id"]))
            .execute()
        )
        angewendet += 1
        log.info(
            "personal_akte_aenderung_angewendet",
            tenant_id=tenant_id,
            user_id=user_id,
            gueltig_ab=str(row["gueltig_ab"]),
        )
    return angewendet


def _rolle(db: Client, user_id: str) -> str:
    rows = db.table("users").select("role").eq("id", user_id).limit(1).execute().data or []
    return str(rows[0].get("role") or "") if rows else ""


def get_akte_aenderungen_service() -> AkteAenderungenService:
    return AkteAenderungenService(service_client=get_service_client())


__all__ = [
    "AkteAenderungenService",
    "aenderungen_anwenden",
    "get_akte_aenderungen_service",
]
