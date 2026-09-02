"""Lead-Liste des Partnerprogramms (0526) — mögliche Multiplikatoren im Backoffice.

Coaches, Podcaster, Creator und Co-Hosting-Agenturen, die das Team gezielt
anspricht (Master-Strategie 02.09.2026, Abschnitt 6). Reine Backoffice-
Tabelle: die Namen stehen in der Datenbank, nie im Repo; Lesen und Schreiben
nur über FastAPI mit platform_admin (Wurzel 6, RLS + deny-all).

Nach Gewinn zeigt `affiliate_id` auf den angelegten Partner — so bleibt
nachvollziehbar, aus welcher Ansprache ein Partner entstanden ist. Der
CSV-Import nimmt die Zettel-Liste in einem Zug an; Zeilen ohne Namen werden
gezählt und übersprungen, nicht still verworfen (Wurzel 5).
"""

from __future__ import annotations

import csv
import io
from typing import TYPE_CHECKING, Any

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

from .fehler import AffiliateError
from .schemas import (
    BackofficeLead,
    BackofficeLeadAendern,
    BackofficeLeadAnlegen,
    BackofficeLeadImportErgebnis,
    BackofficeLeadListe,
    LeadKategorie,
    LeadStatus,
)

if TYPE_CHECKING:
    from supabase import Client

    from src.core.security import PlatformContext

log = get_logger("nextdays.affiliates.leads")

_MAX_LIMIT = 200
# CSV-Spalten des Imports (Kopfzeile, deutsch oder englisch). Reihenfolge egal.
_SPALTEN = {
    "name": ("name",),
    "organisation": ("organisation", "organization", "firma"),
    "category": ("category", "kategorie"),
    "reach": ("reach", "reichweite", "follower"),
    "country": ("country", "land"),
    "language": ("language", "sprache"),
    "notes": ("notes", "notiz", "notizen"),
    "url": ("url", "kanal", "channel", "link"),
}


def _lead(row: dict[str, Any]) -> BackofficeLead:
    return BackofficeLead(
        id=row["id"],
        name=row["name"],
        organisation=row.get("organisation"),
        category=row["category"],
        channels=list(row.get("channels") or []),
        reach=row.get("reach"),
        country=row.get("country"),
        language=row.get("language"),
        status=row["status"],
        owner_user_id=row.get("owner_user_id"),
        next_step=row.get("next_step"),
        next_step_at=row.get("next_step_at"),
        notes=row.get("notes"),
        affiliate_id=row.get("affiliate_id"),
        created_at=row["created_at"],
        updated_at=row.get("updated_at") or row["created_at"],
    )


def _spalte(zeile: dict[str, str], feld: str) -> str | None:
    for name in _SPALTEN[feld]:
        for k, v in zeile.items():
            if (k or "").strip().lower() == name:
                w = (v or "").strip()
                return w or None
    return None


class LeadsMixin:  # pylint: disable=too-few-public-methods
    """Backoffice-Methoden für `affiliate_leads`; wird in AffiliatesService gemischt."""

    _db: Client

    def _lead_row(self, lead_id: str) -> dict[str, Any]:
        res = self._db.table("affiliate_leads").select("*").eq("id", lead_id).limit(1).execute()
        row = (res.data or [None])[0]
        if not row:
            raise AffiliateError("Lead nicht gefunden.", status_code=404)
        return row

    def bo_leads(
        self,
        *,
        status: LeadStatus | None = None,
        category: LeadKategorie | None = None,
        q: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> BackofficeLeadListe:
        rows = fetch_all_rows(
            self._db.table("affiliate_leads").select("*").order("next_step_at").order("created_at")
        )
        if status:
            rows = [r for r in rows if r["status"] == status]
        if category:
            rows = [r for r in rows if r["category"] == category]
        if q:
            w = q.strip().lower()
            rows = [
                r
                for r in rows
                if w in (r.get("name") or "").lower()
                or w in (r.get("organisation") or "").lower()
                or w in (r.get("notes") or "").lower()
            ]
        limit = max(1, min(_MAX_LIMIT, limit))
        return BackofficeLeadListe(
            total=len(rows), items=[_lead(r) for r in rows[offset : offset + limit]]
        )

    def bo_lead_anlegen(self, req: BackofficeLeadAnlegen, admin: PlatformContext) -> BackofficeLead:
        daten = req.model_dump(mode="json")
        daten["channels"] = [k.model_dump(mode="json") for k in req.channels]
        daten["created_by"] = admin.user_id
        res = self._db.table("affiliate_leads").insert(daten).execute()
        row = (res.data or [None])[0]
        if not row:
            raise AffiliateError("Lead konnte nicht angelegt werden.", status_code=500)
        log.info(
            "partner_lead_angelegt", lead_id=row["id"], category=req.category, by=admin.user_id
        )
        return _lead(row)

    def bo_lead_aendern(
        self, lead_id: str, req: BackofficeLeadAendern, admin: PlatformContext
    ) -> BackofficeLead:
        alt = self._lead_row(lead_id)
        daten = req.model_dump(mode="json", exclude_unset=True)
        if "channels" in daten and req.channels is not None:
            daten["channels"] = [k.model_dump(mode="json") for k in req.channels]
        if not daten:
            return _lead(alt)
        if daten.get("affiliate_id"):
            # Verknüpfung nur zu einem existierenden Partner (Wurzel 3: kein
            # blinder Fremdschlüssel aus dem Client).
            ok = (
                self._db.table("affiliates")
                .select("id")
                .eq("id", daten["affiliate_id"])
                .limit(1)
                .execute()
            ).data
            if not ok:
                raise AffiliateError("Partner zur Verknüpfung nicht gefunden.", status_code=422)
        self._db.table("affiliate_leads").update(daten).eq("id", lead_id).execute()
        log.info(
            "partner_lead_geaendert", lead_id=lead_id, felder=sorted(daten), by=admin.user_id
        )
        return _lead(self._lead_row(lead_id))

    def bo_lead_loeschen(self, lead_id: str, admin: PlatformContext) -> None:
        self._lead_row(lead_id)
        self._db.table("affiliate_leads").delete().eq("id", lead_id).execute()
        log.info("partner_lead_geloescht", lead_id=lead_id, by=admin.user_id)

    def bo_leads_importieren(
        self, csv_text: str, admin: PlatformContext
    ) -> BackofficeLeadImportErgebnis:
        """CSV (Kopfzeile: name, organisation, kategorie, reichweite, land,
        sprache, url, notizen) → Leads. Fehlerhafte Zeilen werden mit Zeilen-
        nummer gemeldet, nicht still übersprungen."""
        text = csv_text.lstrip("﻿")
        try:
            dialekt = csv.Sniffer().sniff(text[:2048], delimiters=";,\t")
        except csv.Error:
            dialekt = csv.excel
        leser = csv.DictReader(io.StringIO(text), dialect=dialekt)
        angelegt = 0
        fehler: list[str] = []
        for nr, zeile in enumerate(leser, start=2):
            name = _spalte(zeile, "name")
            if not name:
                fehler.append(f"Zeile {nr}: kein Name")
                continue
            kategorie = (_spalte(zeile, "category") or "").upper()[:1]
            if kategorie not in ("A", "B", "C", "D"):
                fehler.append(f"Zeile {nr}: Kategorie muss A–D sein")
                continue
            reichweite_text = _spalte(zeile, "reach")
            reichweite: int | None = None
            if reichweite_text:
                ziffern = "".join(ch for ch in reichweite_text if ch.isdigit())
                reichweite = int(ziffern) if ziffern else None
            url = _spalte(zeile, "url")
            channels = [{"platform": "website", "url": url}] if url else []
            try:
                req = BackofficeLeadAnlegen(
                    name=name,
                    organisation=_spalte(zeile, "organisation"),
                    category=kategorie,  # type: ignore[arg-type]
                    reach=reichweite,
                    country=(_spalte(zeile, "country") or "").upper()[:2] or None,
                    language=(_spalte(zeile, "language") or "").lower()[:5] or None,
                    notes=_spalte(zeile, "notes"),
                    channels=channels,  # type: ignore[arg-type]
                )
            except ValueError as exc:
                fehler.append(f"Zeile {nr}: {str(exc)[:120]}")
                continue
            self.bo_lead_anlegen(req, admin)
            angelegt += 1
        log.info(
            "partner_leads_importiert", angelegt=angelegt, fehler=len(fehler), by=admin.user_id
        )
        return BackofficeLeadImportErgebnis(angelegt=angelegt, fehler=fehler)
