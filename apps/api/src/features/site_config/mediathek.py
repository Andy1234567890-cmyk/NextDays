"""Mediathek des Website-Baukastens: Upload-Prüfung und Bildbestand.

Als MIXIN und nicht als eigener Service: die Methoden gehören zur
Baukasten-Fassade (`SiteConfigService`) — der Router ruft `service.add_medium`,
und ein zweiter Dienst nur für Bilder wäre eine zweite Dependency, eine zweite
Factory und ein zweiter Ort, an dem man den Tenant-Scope vergessen kann.

Der Anlass war eine Zeilenzahl: `service.py` stand bei 1506 Zeilen und damit über
der Grenze, die `pylint` hier setzt (1500). Der Schnitt ist aber der richtige —
Bild-Uploads sind der einzige Teil des Slice, der mit dem Storage-Bucket
arbeitet, und sie haben ihre eigenen Regeln (Magic-Byte-Prüfung, Mengen- und
Größengrenzen, Aufräumen der Datei beim Löschen).

Das Mixin setzt voraus, dass die Basisklasse `_db`, `_require_tenant` und
`set_branding` mitbringt — dasselbe Muster wie der Mixin-Split im
`channel_manager`-Slice.
"""

from __future__ import annotations

import secrets
from typing import TYPE_CHECKING

from src.core.logging import get_logger
from src.core.supabase import public_storage_url

from . import medien
from .fehler import SiteConfigError
from .schemas import (
    MediumListResponse,
    MediumResponse,
)

if TYPE_CHECKING:  # pragma: no cover — nur für die Typprüfung
    from src.core.security import AuthContext

log = get_logger("nextdays.site_config.mediathek")

#: Spalten der Mediathek-Zeilen. Aufgezählt und nicht `*`: eine neue Spalte soll
#: eine bewusste Entscheidung sein, keine automatische Mitlieferung.
_MEDIA_COLS = "id, url, filename, mime, bytes, created_at"


class MediathekMixin:
    """Bildbestand des Betriebs: auflisten, hochladen, löschen."""

    # === Mediathek (Dashboard, MANAGE_SITE_CONFIG) ==========================

    #: Bucket der Mediathek (Migration 0422). Öffentlich, weil die Bilder als
    #: <img src> in gespeicherte Blöcke wandern.
    MEDIA_BUCKET = "site-media"
    #: Erlaubte Bildtypen → Dateiendung. SVG fehlt bewusst: es darf <script>
    #: tragen und wäre im public Bucket Stored-XSS (Wurzel 8).
    MEDIA_MIME = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }
    MEDIA_MAX_BYTES = 20 * 1024 * 1024
    #: Obergrenze je Betrieb — kein unbegrenzter Bereich (Wurzel 8). Reicht für
    #: jede echte Vermieter-Website und verhindert, dass ein Konto den Bucket
    #: füllt.
    MEDIA_MAX_COUNT = 500

    def list_media(
        self, ctx: AuthContext, *, limit: int = 100, offset: int = 0
    ) -> MediumListResponse:
        """Bildbestand des Betriebs, neueste zuerst."""
        tenant_id = self._require_tenant(ctx)
        # Harte Obergrenze auch hier: ein Client, der limit=100000 schickt, darf
        # keine unbegrenzte Antwort auslösen.
        limit = max(1, min(limit, 200))
        offset = max(0, offset)
        rows = (
            self._db.table("site_media")
            .select(_MEDIA_COLS)
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        ).data or []
        items = [MediumResponse(**self._medium_row(r)) for r in rows]
        return MediumListResponse(items=items, total=len(items))

    def add_medium(
        self,
        ctx: AuthContext,
        content: bytes,
        *,
        filename: str | None = None,
    ) -> MediumResponse:
        """Ein Bild in die Mediathek legen.

        Der Typ wird aus den ANFANGSBYTES bestimmt, nicht aus dem, was der Client
        behauptet: ein `content_type` ist eine Angabe der Gegenseite und kostet
        nichts. Wer „image/jpeg" schreibt und HTML oder SVG schickt, hätte sonst
        eine Datei im öffentlichen Bucket, die der Browser als Dokument ausführt
        (Wurzel 8)."""
        tenant_id = self._require_tenant(ctx)
        mime = medien.bild_typ(content)
        if mime is None or mime not in self.MEDIA_MIME:
            raise SiteConfigError(
                "Nur JPEG, PNG oder WebP.", status_code=415
            )
        if len(content) > self.MEDIA_MAX_BYTES:
            raise SiteConfigError("Bild ist zu groß (max. 20 MB).", status_code=413)

        # Gegenzustand zur Obergrenze: erst zählen, dann schreiben. Sonst wächst
        # der Bestand still über das Limit (Wurzel 1).
        vorhanden = (
            self._db.table("site_media")
            .select("id", count="exact")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if (vorhanden.count or 0) >= self.MEDIA_MAX_COUNT:
            raise SiteConfigError(
                f"Die Mediathek ist voll (max. {self.MEDIA_MAX_COUNT} Bilder). "
                "Löschen Sie ältere Bilder, um Platz zu machen.",
                status_code=409,
            )

        ext = self.MEDIA_MIME[mime]
        # Nicht-ratbarer Name: der Bucket ist öffentlich, der Pfad ist der
        # einzige Schutz vor dem Erraten fremder Bilder.
        path = f"{tenant_id}/{secrets.token_hex(16)}.{ext}"
        try:
            self._db.storage.from_(self.MEDIA_BUCKET).upload(
                path, content, {"content-type": mime}
            )
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich
            log.warning(
                "site_media_upload_failed", tenant_id=tenant_id, error=str(exc)
            )
            raise SiteConfigError("Upload fehlgeschlagen.", status_code=502) from exc

        url = public_storage_url(self.MEDIA_BUCKET, path)
        payload = {
            "tenant_id": tenant_id,
            "path": path,
            "url": url,
            # Nur der Anzeigename, gekürzt. Er landet in keinem Pfad und in
            # keinem href — der echte Pfad ist der Token oben.
            "filename": (filename or "")[:200] or None,
            "mime": mime,
            "bytes": len(content),
        }
        res = self._db.table("site_media").insert(payload).execute()
        if not res.data:
            # Die Datei liegt schon im Bucket; ohne DB-Zeile wäre sie eine Waise,
            # die niemand mehr findet oder löschen kann. Also aufräumen.
            self._entferne_datei(path)
            raise SiteConfigError(
                "Bild konnte nicht gespeichert werden.", status_code=500
            )
        log.info("site_media_added", tenant_id=tenant_id, bytes=len(content))
        return MediumResponse(**self._medium_row(res.data[0]))

    def remove_medium(self, ctx: AuthContext, medium_id: str) -> None:
        """Ein Bild aus der Mediathek entfernen — Zeile UND Datei.

        Beide Seiten, sonst bleibt eine Waise im Bucket, die Platz belegt und
        weiterhin öffentlich erreichbar ist (Wurzel 1: jede Aktion hat einen
        Gegenzustand).

        Was NICHT passiert: Abschnitte, die dieses Bild noch verwenden, werden
        nicht angetastet. Ein Bild aus einem veröffentlichten Block zu entfernen
        wäre eine stille Änderung an einer lebenden Seite — der Kunde sieht das
        fehlende Bild in der Vorschau und entscheidet selbst."""
        tenant_id = self._require_tenant(ctx)
        row = self._own_medium(tenant_id, medium_id)
        self._db.table("site_media").delete().eq("id", medium_id).eq(
            "tenant_id", tenant_id
        ).execute()
        self._entferne_datei(row["path"])
        log.info("site_media_removed", tenant_id=tenant_id, medium_id=medium_id)

    def _entferne_datei(self, path: str) -> None:
        """Datei aus dem Bucket löschen. Best-effort: schlägt es fehl, ist die
        DB-Zeile schon weg und das Bild aus der Mediathek verschwunden — ein
        harter Fehler hier würde dem Kunden einen Misserfolg melden, obwohl die
        Aktion für ihn stattgefunden hat."""
        try:
            self._db.storage.from_(self.MEDIA_BUCKET).remove([path])
        except Exception as exc:  # noqa: BLE001 — Aufräumen kippt nicht den Pfad
            log.warning("site_media_file_orphan", path=path, error=str(exc))

    def _own_medium(self, tenant_id: str, medium_id: str) -> dict:
        rows = (
            self._db.table("site_media")
            .select("id, path")
            .eq("id", medium_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise SiteConfigError(
                "Bild gehört nicht zu diesem Konto.", status_code=404
            )
        return rows[0]

    @staticmethod
    def _medium_row(row: dict) -> dict:
        out = {k: row.get(k) for k in MediumResponse.model_fields}
        created = row.get("created_at")
        out["created_at"] = str(created) if created else None
        return out
