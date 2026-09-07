"""Tenant-weite Saison-Vorlagen („Standard", „Skagen") — ADR-0024, 0584.

Eine Vorlage ist EINE Zeile in `season_templates`: Kategorien (volle
Regelsätze) und Zeiträume als jsonb. „Anwenden" materialisiert sie je Objekt
als `property_seasons` + `property_season_assignments` — und zwar über den
BESTEHENDEN Übertragungspfad des calendar-Slice (`CalendarService.
saison_uebernehmen` → `_apply_season_to_one`): Upsert auf (property_id, name)
(Wurzel 2: der zweite Klick aktualisiert statt zu duplizieren), Zeiträume
ersetzen mit Freigabe der alten Tage (Wurzel 1), Tagespreise materialisieren
und an die Portale pushen. Hier steht deshalb KEINE zweite Materialisierung.

Wurzel 3: Vorlage per `load_scoped` (tenant_id), jedes Zielobjekt einzeln
gescopt — eine fremde ID ist ein 404 für den ganzen Aufruf.
"""
from datetime import date, timedelta
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.supabase import load_scoped

from .schemas import (
    SeasonTemplateCreate,
    SeasonTemplateFromPropertyRequest,
    SeasonTemplateKategorie,
    SeasonTemplateUpdate,
    SeasonTemplateZeitraum,
)
from .service import CalendarError, CalendarService

log = get_logger("nextdays.calendar.saison_vorlagen")

_SPALTEN = "id, name, farbe, kategorien, zeitraeume, created_at, updated_at"


def _nicht_gefunden() -> CalendarError:
    return CalendarError("Saison-Vorlage nicht gefunden.", status_code=404)


def _ist_dublette(exc: Exception) -> bool:
    """PostgREST meldet den UNIQUE-Konflikt als APIError mit code 23505."""
    return getattr(exc, "code", None) == "23505" or "23505" in str(exc)


class SeasonTemplateService:
    """CRUD + Anwenden der Vorlagen. Bekommt den CalendarService injiziert,
    weil das Anwenden dessen Übertragungspfad nutzt (eine Wahrheit)."""

    def __init__(
        self, client: Client | None = None, kalender: CalendarService | None = None,
    ) -> None:
        self._client = client
        self._kalender = kalender or CalendarService(client=client)

    def _db(self) -> Client:
        if self._client is None:
            raise RuntimeError("Saison-Vorlagen-DB nicht verfügbar.")
        return self._client

    # -- Lesen --------------------------------------------------------------
    def list_templates(self, tenant_id: str) -> list[dict]:
        rows = (
            self._db()
            .table("season_templates")
            .select(_SPALTEN)
            .eq("tenant_id", tenant_id)
            .order("name")
            .execute()
        ).data or []
        return [self._normalisiert(r) for r in rows]

    def _own_template(self, tenant_id: str, template_id: str) -> dict:
        return self._normalisiert(load_scoped(
            self._db(), "season_templates", template_id, tenant_id,
            columns=_SPALTEN, not_found=_nicht_gefunden(),
        ))

    @staticmethod
    def _normalisiert(row: dict) -> dict:
        # Die 0011-Zeile hatte die jsonb-Spalten noch nicht; ein Altbestand
        # ohne sie ist eine leere Vorlage, kein Fehler.
        row["kategorien"] = row.get("kategorien") or []
        row["zeitraeume"] = row.get("zeitraeume") or []
        return row

    # -- Schreiben ----------------------------------------------------------
    def create_template(self, tenant_id: str, req: SeasonTemplateCreate) -> dict:
        try:
            row = (
                self._db()
                .table("season_templates")
                .insert({
                    "tenant_id": tenant_id, "name": req.name, "farbe": req.farbe,
                    "kategorien": [k.model_dump(mode="json") for k in req.kategorien],
                    "zeitraeume": [z.model_dump(mode="json") for z in req.zeitraeume],
                })
                .execute()
            ).data
        except Exception as exc:
            if _ist_dublette(exc):
                raise CalendarError(
                    "Eine Vorlage mit diesem Namen gibt es bereits.", status_code=409,
                ) from exc
            raise
        if not row:
            raise CalendarError("Vorlage konnte nicht angelegt werden.", status_code=500)
        log.info(
            "saison_vorlage_angelegt", tenant_id=tenant_id, template_id=row[0]["id"],
            kategorien=len(req.kategorien), zeitraeume=len(req.zeitraeume),
        )
        return self._own_template(tenant_id, row[0]["id"])

    def update_template(
        self, tenant_id: str, template_id: str, req: SeasonTemplateUpdate,
    ) -> dict:
        alt = self._own_template(tenant_id, template_id)
        patch: dict[str, Any] = {}
        if req.name is not None:
            patch["name"] = req.name
        if req.farbe is not None:
            patch["farbe"] = req.farbe
        if req.kategorien is not None:
            patch["kategorien"] = [k.model_dump(mode="json") for k in req.kategorien]
            if req.zeitraeume is None:
                # Neue Kategorienliste, alte Zeiträume: jeder gespeicherte
                # Zeitraum muss weiter auf eine Kategorie zeigen — sonst
                # KeyError beim Anwenden (Wurzel 5: hier 422, nicht dort 500).
                zu_hoch = [
                    z for z in alt["zeitraeume"]
                    if int(z["kategorie_index"]) >= len(req.kategorien)
                ]
                if zu_hoch:
                    raise CalendarError(
                        "Gespeicherte Zeiträume zeigen auf Kategorien, die es nach "
                        "dieser Änderung nicht mehr gäbe — Zeiträume mitsenden.",
                        status_code=422,
                    )
        if req.zeitraeume is not None:
            kategorien = req.kategorien if req.kategorien is not None else [
                SeasonTemplateKategorie(**k) for k in alt["kategorien"]
            ]
            zu_hoch = [z for z in req.zeitraeume if z.kategorie_index >= len(kategorien)]
            if zu_hoch:
                raise CalendarError(
                    "Zeitraum zeigt auf eine Kategorie, die die Vorlage nicht hat.",
                    status_code=422,
                )
            patch["zeitraeume"] = [z.model_dump(mode="json") for z in req.zeitraeume]
        if not patch:
            return alt
        try:
            self._db().table("season_templates").update(patch).eq(
                "id", template_id
            ).eq("tenant_id", tenant_id).execute()
        except Exception as exc:
            if _ist_dublette(exc):
                raise CalendarError(
                    "Eine Vorlage mit diesem Namen gibt es bereits.", status_code=409,
                ) from exc
            raise
        log.info(
            "saison_vorlage_geaendert", tenant_id=tenant_id, template_id=template_id,
            felder=sorted(patch),
        )
        return self._own_template(tenant_id, template_id)

    def delete_template(self, tenant_id: str, template_id: str) -> None:
        self._own_template(tenant_id, template_id)
        # Bewusst KEIN Gegenzustand an den Objekten: angewendete Saisons sind
        # eigenständige Kopien (ADR-0024) — die Vorlage zu löschen nimmt keinem
        # Objekt seine Saison.
        self._db().table("season_templates").delete().eq("id", template_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info("saison_vorlage_geloescht", tenant_id=tenant_id, template_id=template_id)

    # -- Aus einem Objekt heraus -------------------------------------------
    def from_property(
        self, tenant_id: str, req: SeasonTemplateFromPropertyRequest,
    ) -> dict:
        """Die Saisons + Zeiträume eines Objekts als Vorlage sichern. Gleicher
        Name → Update (Wurzel 2), sonst Insert."""
        load_scoped(
            self._db(), "properties", req.property_id, tenant_id, columns="id",
            not_found=CalendarError("Objekt nicht gefunden.", status_code=404),
        )
        seasons = (
            self._db()
            .table("property_seasons")
            .select("*")
            .eq("property_id", req.property_id)
            .order("created_at")
            .execute()
        ).data or []
        if not seasons:
            raise CalendarError(
                "Dieses Objekt hat keine Saisons — eine leere Vorlage wäre nichts wert.",
                status_code=422,
            )
        assigns = (
            self._db()
            .table("property_season_assignments")
            .select("season_id, start_date, end_date")
            .eq("property_id", req.property_id)
            .order("start_date")
            .execute()
        ).data or []
        index = {s["id"]: i for i, s in enumerate(seasons)}
        kategorien = [
            SeasonTemplateKategorie(
                name=s["name"], color=s["color"], mode=s["mode"],
                amount=float(s["amount"]),
                min_stay=s.get("min_stay"), max_stay=s.get("max_stay"),
                closed_arrival_weekdays=s.get("closed_arrival_weekdays") or [],
                closed_departure_weekdays=s.get("closed_departure_weekdays") or [],
                min_stay_by_weekday={
                    int(k): int(v)
                    for k, v in (s.get("min_stay_by_weekday") or {}).items()
                },
            ).model_dump(mode="json")
            for s in seasons
        ]
        zeitraeume = [
            SeasonTemplateZeitraum(
                kategorie_index=index[a["season_id"]],
                start_date=date.fromisoformat(a["start_date"]),
                end_date=date.fromisoformat(a["end_date"]),
            ).model_dump(mode="json")
            for a in assigns if a["season_id"] in index
        ]
        vorhanden = [
            t for t in self.list_templates(tenant_id) if t["name"] == req.name
        ]
        werte = {"farbe": req.farbe, "kategorien": kategorien, "zeitraeume": zeitraeume}
        if vorhanden:
            template_id = vorhanden[0]["id"]
            self._db().table("season_templates").update(werte).eq(
                "id", template_id
            ).eq("tenant_id", tenant_id).execute()
        else:
            try:
                row = (
                    self._db()
                    .table("season_templates")
                    .insert({"tenant_id": tenant_id, "name": req.name, **werte})
                    .execute()
                ).data
            except Exception as exc:
                if _ist_dublette(exc):
                    # Race zwischen dem Lesen oben und dem Insert: der
                    # UNIQUE hat entschieden — dann eben aktualisieren.
                    return self.from_property(tenant_id, req)
                raise
            if not row:
                raise CalendarError(
                    "Vorlage konnte nicht angelegt werden.", status_code=500
                )
            template_id = row[0]["id"]
        log.info(
            "saison_vorlage_aus_objekt", tenant_id=tenant_id, template_id=template_id,
            property_id=req.property_id, kategorien=len(kategorien),
            zeitraeume=len(zeitraeume), aktualisiert=bool(vorhanden),
        )
        return self._own_template(tenant_id, template_id)

    # -- Anwenden -----------------------------------------------------------
    def apply_template(
        self, tenant_id: str, template_id: str, property_ids: list[str],
        *, zeitraeume_mitnehmen: bool = True,
    ) -> dict[str, object]:
        """Jede Kategorie der Vorlage auf jedes gewählte Objekt übertragen.

        Läuft über `CalendarService.saison_uebernehmen` — denselben Pfad wie
        „Saison auf andere Objekte übertragen": Upsert auf (property_id, name),
        Zeiträume ersetzen, Tagespreise materialisieren, Portale pushen.
        Wiederholtes Anwenden aktualisiert (Wurzel 2). Ein Objekt zählt als
        `uebertragen`, wenn JEDE Kategorie ankam; jede übersprungene
        (Objekt, Kategorie) wird benannt (Wurzel 5).
        """
        vorlage = self._own_template(tenant_id, template_id)
        if not vorlage["kategorien"]:
            raise CalendarError(
                "Diese Vorlage hat keine Kategorien — es gäbe nichts anzuwenden.",
                status_code=422,
            )
        if zeitraeume_mitnehmen and not vorlage["zeitraeume"]:
            # Dasselbe fail-closed wie beim Saison-Kopieren: „mit Zeiträumen"
            # ohne Zeiträume hieße am Ziel „Zeiträume der gleichnamigen
            # Saison löschen" — nie das, was der Knopf verspricht.
            raise CalendarError(
                "Diese Vorlage hat keine Zeiträume. Entweder Zeiträume anlegen "
                "oder nur die Kategorien ohne Zeiträume anwenden.",
                status_code=422,
            )
        ziele = list(dict.fromkeys(property_ids))
        for ziel_id in ziele:
            load_scoped(
                self._db(), "properties", ziel_id, tenant_id, columns="id",
                not_found=CalendarError("Objekt nicht gefunden.", status_code=404),
            )
        spans_je_kategorie = self._spans_je_kategorie(vorlage)
        uebertragen = 0
        uebersprungen: list[dict[str, str]] = []
        for ziel_id in ziele:
            komplett = True
            for idx, kat in enumerate(vorlage["kategorien"]):
                quelle = {"id": f"{template_id}#{idx}", **kat}
                spans = spans_je_kategorie.get(idx, []) if zeitraeume_mitnehmen else []
                grund = self._kalender.saison_uebernehmen(
                    tenant_id, quelle, ziel_id, spans,
                    mit_zeitraeumen=zeitraeume_mitnehmen and bool(spans),
                )
                if grund is not None:
                    komplett = False
                    uebersprungen.append({
                        "property_id": ziel_id, "kategorie": kat["name"], "grund": grund,
                    })
            if komplett:
                uebertragen += 1
        log.info(
            "saison_vorlage_angewendet", tenant_id=tenant_id, template_id=template_id,
            objekte=len(ziele), uebertragen=uebertragen,
            uebersprungen=len(uebersprungen), mit_zeitraeumen=zeitraeume_mitnehmen,
        )
        return {"uebertragen": uebertragen, "uebersprungen": uebersprungen}

    @staticmethod
    def _spans_je_kategorie(vorlage: dict) -> dict[int, list[tuple[date, date]]]:
        """(start, end_exklusiv) je Kategorie — die Form, die der Übertragungs-
        pfad erwartet (Vorlage speichert end INKLUSIV)."""
        out: dict[int, list[tuple[date, date]]] = {}
        for z in vorlage["zeitraeume"]:
            start = date.fromisoformat(str(z["start_date"]))
            end_excl = date.fromisoformat(str(z["end_date"])) + timedelta(days=1)
            out.setdefault(int(z["kategorie_index"]), []).append((start, end_excl))
        return out
