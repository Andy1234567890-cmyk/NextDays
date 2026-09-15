"""Werbematerial des Partnerprogramms: Pflege im Backoffice (0517, 0707, 0709).

Als MIXIN und nicht als eigener Service — dasselbe Muster wie `MediathekMixin`
im Baukasten und aus demselben Anlass: `service.py` stand bei 1606 Zeilen und
damit über der Grenze, die `pylint` hier setzt (1500). Der Schnitt ist aber
auch der richtige: das Werbematerial ist der einzige Teil des Slice, der mit
einem Storage-Bucket arbeitet, und es hat seine eigenen Regeln (Magic-Byte-
Prüfung, SVG-Säuberung, Aufräumen der Datei beim Löschen).

Ein zweiter Dienst wäre dagegen eine zweite Dependency, eine zweite Factory und
ein zweiter Ort, an dem man etwas vergisst — der Router ruft weiterhin
`service.bo_material_*`.

Das Mixin setzt voraus, dass die Basisklasse `_db` mitbringt.
"""

from __future__ import annotations

import secrets
from typing import TYPE_CHECKING, Any

from postgrest.exceptions import APIError

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows, public_storage_url

from . import material_dateien
from .fehler import AffiliateError
from .material_dateien import MATERIAL_BUCKET
from .schemas import (
    BackofficeMaterial,
    BackofficeMaterialAendern,
    BackofficeMaterialAnlegen,
    BackofficeMaterialDatei,
    BackofficeMaterialVerschieben,
    BackofficeOrdner,
    BackofficeOrdnerAendern,
    BackofficeOrdnerAnlegen,
)

if TYPE_CHECKING:  # pragma: no cover — nur für die Typprüfung
    from src.core.security import PlatformContext

log = get_logger("nextdays.affiliates.material")

_UNIQUE_VIOLATION = "23505"


class MaterialMixin:
    """Pflege des Werbematerials. `_db` kommt aus der Basisklasse."""

    _db: Any

    def bo_material_liste(self) -> list[BackofficeMaterial]:
        rows = fetch_all_rows(
            self._db.table("affiliate_assets").select("*").order("sort").order("created_at")
        )
        return [self._material(r) for r in rows]

    def bo_material_anlegen(
        self, req: BackofficeMaterialAnlegen, admin: PlatformContext
    ) -> BackofficeMaterial:
        res = self._db.table("affiliate_assets").insert(req.model_dump()).execute()
        row = (res.data or [None])[0]
        if not row:
            raise AffiliateError("Material konnte nicht angelegt werden.", status_code=500)
        log.info("partner_material_angelegt", asset_id=row["id"], kind=req.kind, by=admin.user_id)
        return self._material(row)

    def bo_material_aendern(
        self, asset_id: str, req: BackofficeMaterialAendern, admin: PlatformContext
    ) -> BackofficeMaterial:
        alt = self._material_row(asset_id)
        daten = req.model_dump(exclude_unset=True)
        if not daten:
            return self._material(alt)
        neu = {**alt, **daten}
        # Dieselbe Vollständigkeitsregel wie beim Anlegen — sonst ließe sich
        # per PATCH die Adresse eines Links leeren.
        if neu["kind"] == "text" and not (neu.get("body") or "").strip():
            raise AffiliateError("Ein Textbaustein braucht einen Text.", status_code=422)
        if neu["kind"] != "text" and not neu.get("url"):
            raise AffiliateError("Video, Bild und Link brauchen eine Adresse.", status_code=422)
        # Die Adresse einer hochgeladenen Datei gehört zum Bucket-Pfad. Ließe
        # sie sich per PATCH umbiegen, zeigte die Zeile woandershin, während
        # `storage_path` weiter auf die alte Datei verweist — die wäre dann
        # weder erreichbar noch je wieder löschbar (Wurzel 1).
        if alt.get("storage_path") and "url" in daten and daten["url"] != alt.get("url"):
            raise AffiliateError(
                "Die Adresse einer hochgeladenen Datei kann nicht geändert werden — "
                "stattdessen die Datei ersetzen.",
                status_code=422,
            )
        self._db.table("affiliate_assets").update(daten).eq("id", asset_id).execute()
        log.info(
            "partner_material_geaendert", asset_id=asset_id, felder=sorted(daten), by=admin.user_id
        )
        return self._material(self._material_row(asset_id))

    def bo_material_loeschen(self, asset_id: str, admin: PlatformContext) -> None:
        zeile = self._material_row(asset_id)
        self._db.table("affiliate_assets").delete().eq("id", asset_id).execute()
        # Gegenzustand (Wurzel 1): die Zeile ist weg, die Datei liegt noch im
        # Bucket. Ohne diesen Schritt wäre sie eine Waise — ihren Pfad kannte
        # nur die gelöschte Zeile, niemand findet sie je wieder.
        self._material_datei_entfernen(zeile.get("storage_path"))
        log.info("partner_material_geloescht", asset_id=asset_id, by=admin.user_id)

    # --- Werbematerial als DATEI (0707) --------------------------------------

    def bo_material_hochladen(
        self,
        inhalt: bytes,
        dateiname: str | None,
        req: BackofficeMaterialDatei,
        admin: PlatformContext,
    ) -> BackofficeMaterial:
        """Eine Datei in den Bucket legen und als Material eintragen.

        Die ART kommt aus der Magic-Byte-Prüfung und NICHT vom Client: sonst
        läge ein PDF als `kind='image'` im Bestand, und die Kachel im
        Partner-Dashboard zeigte eine Bildvorschau auf ein Dokument (Wurzel 8).
        """
        # Den Ordner VOR dem Upload prüfen: eine Datei, die danach am
        # Fremdschlüssel scheitert, läge als Waise im Bucket (Wurzel 1).
        if req.folder_id:
            self._ordner_row(req.folder_id)
        datei = self._material_datei_ablegen(inhalt, dateiname)
        nutzlast = {
            **req.model_dump(),
            "kind": datei.pop("kind"),
            **datei,
        }
        res = self._db.table("affiliate_assets").insert(nutzlast).execute()
        row = (res.data or [None])[0]
        if not row:
            # Die Datei liegt schon im Bucket; ohne Zeile wäre sie eine Waise
            # (Wurzel 1) — also aufräumen und klar fehlschlagen.
            self._material_datei_entfernen(nutzlast["storage_path"])
            raise AffiliateError("Material konnte nicht angelegt werden.", status_code=500)
        log.info(
            "partner_material_datei_angelegt",
            asset_id=row["id"],
            kind=row["kind"],
            bytes=len(inhalt),
            by=admin.user_id,
        )
        return self._material(row)

    def bo_material_datei_ersetzen(
        self, asset_id: str, inhalt: bytes, dateiname: str | None, admin: PlatformContext
    ) -> BackofficeMaterial:
        """Die Datei eines vorhandenen Eintrags austauschen.

        Eigener Weg statt eines Feldes in `bo_material_aendern`: ein Austausch
        hat einen Gegenzustand, ein Titel nicht. Die ALTE Datei wird entfernt,
        nachdem die Zeile auf die neue zeigt — in dieser Reihenfolge, damit ein
        Fehler beim Schreiben nicht beide Fassungen kostet (Wurzel 1).
        """
        alt = self._material_row(asset_id)
        if alt["kind"] == "text":
            raise AffiliateError(
                "Ein Textbaustein hat keine Datei.", status_code=422
            )
        datei = self._material_datei_ablegen(inhalt, dateiname)
        neuer_pfad = datei["storage_path"]
        self._db.table("affiliate_assets").update(datei).eq("id", asset_id).execute()
        if alt.get("storage_path") and alt["storage_path"] != neuer_pfad:
            self._material_datei_entfernen(alt["storage_path"])
        log.info(
            "partner_material_datei_ersetzt",
            asset_id=asset_id,
            bytes=len(inhalt),
            by=admin.user_id,
        )
        return self._material(self._material_row(asset_id))

    def _material_datei_ablegen(self, inhalt: bytes, dateiname: str | None) -> dict[str, Any]:
        """Datei prüfen, in den Bucket legen, die Spaltenwerte zurückgeben.

        Der Pfad ist ein Zufallstoken und NICHT der Dateiname: der Bucket ist
        öffentlich, der nicht ratbare Pfad ist damit der einzige Schutz davor,
        dass jemand fremdes Material errät — und ein übernommener Dateiname
        wäre zugleich ein Traversal-Vektor.
        """
        sauber, mime, endung, art = material_dateien.datei_pruefen(inhalt)
        pfad = f"{secrets.token_hex(16)}.{endung}"
        try:
            self._db.storage.from_(MATERIAL_BUCKET).upload(
                pfad, sauber, {"content-type": mime, "upsert": "false"}
            )
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich
            log.warning("partner_material_upload_fehlgeschlagen", fehler=str(exc))
            raise AffiliateError("Upload fehlgeschlagen.", status_code=502) from exc
        return {
            "kind": art,
            "storage_path": pfad,
            "url": public_storage_url(MATERIAL_BUCKET, pfad),
            "filename": material_dateien.anzeigename(dateiname, endung),
            "mime": mime,
            "bytes": len(sauber),
        }

    def _material_datei_entfernen(self, pfad: str | None) -> None:
        """Eine Datei aus dem Bucket nehmen — Best-effort.

        Scheitert das Entfernen, bleibt eine Waise im Bucket; das darf aber den
        Hauptpfad (Zeile ist gelöscht/ersetzt) nicht kippen. Deshalb breit
        gefangen und LAUT geloggt statt still verschluckt (Wurzel 5).
        """
        if not pfad:
            return
        try:
            self._db.storage.from_(MATERIAL_BUCKET).remove([pfad])
        except Exception as exc:  # noqa: BLE001 — best effort, Hauptpfad steht
            log.warning("partner_material_datei_bleibt_liegen", pfad=pfad, fehler=str(exc))

    def _material_row(self, asset_id: str) -> dict[str, Any]:
        res = self._db.table("affiliate_assets").select("*").eq("id", asset_id).limit(1).execute()
        row = (res.data or [None])[0]
        if not row:
            raise AffiliateError("Material nicht gefunden.", status_code=404)
        return row

    @staticmethod
    def _material(r: dict[str, Any]) -> BackofficeMaterial:
        return BackofficeMaterial(
            id=r["id"],
            kind=r["kind"],
            title=r["title"],
            description=r.get("description"),
            language=r.get("language"),
            url=r.get("url"),
            body=r.get("body"),
            sort=int(r.get("sort") or 0),
            active=bool(r.get("active", True)),
            created_at=str(r.get("created_at") or ""),
            folder_id=r.get("folder_id"),
            **material_dateien.datei_felder(r),
        )

    # --- Ordner (0709) -------------------------------------------------------

    def bo_ordner_liste(self) -> list[BackofficeOrdner]:
        """Die Reiter samt Belegung.

        Die Zahl wird aus der Materialliste gezählt und nicht je Ordner per
        `count` geholt: bei zehn Ordnern wären das elf Abfragen für eine
        Information, die in EINER Liste schon vollständig vorliegt.
        """
        ordner = fetch_all_rows(
            self._db.table("affiliate_asset_folders").select("*").order("sort").order("name")
        )
        belegung: dict[str, int] = {}
        for zeile in fetch_all_rows(
            self._db.table("affiliate_assets").select("folder_id")
        ):
            fid = zeile.get("folder_id")
            if fid:
                belegung[fid] = belegung.get(fid, 0) + 1
        return [
            BackofficeOrdner(
                id=o["id"],
                name=o["name"],
                sort=int(o.get("sort") or 0),
                anzahl=belegung.get(o["id"], 0),
            )
            for o in ordner
        ]

    def bo_ordner_anlegen(
        self, req: BackofficeOrdnerAnlegen, admin: PlatformContext
    ) -> BackofficeOrdner:
        try:
            res = self._db.table("affiliate_asset_folders").insert(req.model_dump()).execute()
        except APIError as exc:
            # Der eindeutige Index ist der Wahrheitsort, nicht eine Abfrage
            # davor: zwischen „gibt es schon?" und `insert` passt ein zweiter
            # Klick (Wurzel 2). 23505 = unique_violation.
            if getattr(exc, "code", None) == _UNIQUE_VIOLATION:
                raise AffiliateError(
                    f"Einen Ordner „{req.name}“ gibt es schon.", status_code=409
                ) from exc
            raise
        row = (res.data or [None])[0]
        if not row:
            raise AffiliateError("Ordner konnte nicht angelegt werden.", status_code=500)
        log.info("partner_material_ordner_angelegt", ordner_id=row["id"], by=admin.user_id)
        return BackofficeOrdner(id=row["id"], name=row["name"], sort=int(row["sort"]), anzahl=0)

    def bo_ordner_aendern(
        self, folder_id: str, req: BackofficeOrdnerAendern, admin: PlatformContext
    ) -> BackofficeOrdner:
        alt = self._ordner_row(folder_id)
        daten = req.model_dump(exclude_unset=True, exclude_none=True)
        if daten:
            try:
                self._db.table("affiliate_asset_folders").update(daten).eq(
                    "id", folder_id
                ).execute()
            except APIError as exc:
                if getattr(exc, "code", None) == _UNIQUE_VIOLATION:
                    raise AffiliateError(
                        "Einen Ordner mit diesem Namen gibt es schon.", status_code=409
                    ) from exc
                raise
            log.info(
                "partner_material_ordner_geaendert",
                ordner_id=folder_id,
                felder=sorted(daten),
                by=admin.user_id,
            )
        neu = {**alt, **daten}
        return BackofficeOrdner(
            id=folder_id, name=neu["name"], sort=int(neu.get("sort") or 0), anzahl=0
        )

    def bo_ordner_loeschen(self, folder_id: str, admin: PlatformContext) -> None:
        """Einen Reiter entfernen. Das Material darin bleibt.

        Der Gegenzustand steht in der DB (`on delete set null`, 0709) und nicht
        hier: eine Schleife, die erst alle Zeilen auf NULL setzt, könnte nach
        der Hälfte abbrechen und Material an einem Ordner zurücklassen, den es
        nicht mehr gibt (Wurzel 1).
        """
        self._ordner_row(folder_id)
        self._db.table("affiliate_asset_folders").delete().eq("id", folder_id).execute()
        log.info("partner_material_ordner_geloescht", ordner_id=folder_id, by=admin.user_id)

    def bo_material_verschieben(
        self, req: BackofficeMaterialVerschieben, admin: PlatformContext
    ) -> list[BackofficeMaterial]:
        """Material in einen Ordner ziehen — oder mit `folder_id=None` heraus."""
        if req.folder_id:
            # Der Ordner muss existieren. Ohne diese Zeile wäre eine erfundene
            # ID ein Fremdschlüsselfehler als roher 500 — oder, schlimmer, bei
            # einem später gelockerten Schlüssel ein Reiter, den es nicht gibt
            # und der das Material unsichtbar macht (Wurzel 9).
            self._ordner_row(req.folder_id)
        self._db.table("affiliate_assets").update({"folder_id": req.folder_id}).in_(
            "id", req.asset_ids
        ).execute()
        log.info(
            "partner_material_verschoben",
            anzahl=len(req.asset_ids),
            ordner_id=req.folder_id,
            by=admin.user_id,
        )
        rows = fetch_all_rows(
            self._db.table("affiliate_assets").select("*").in_("id", req.asset_ids)
        )
        return [self._material(r) for r in rows]

    def _ordner_row(self, folder_id: str) -> dict[str, Any]:
        res = (
            self._db.table("affiliate_asset_folders")
            .select("*")
            .eq("id", folder_id)
            .limit(1)
            .execute()
        )
        row = (res.data or [None])[0]
        if not row:
            raise AffiliateError("Ordner nicht gefunden.", status_code=404)
        return row
