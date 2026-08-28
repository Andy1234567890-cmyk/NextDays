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
from urllib.parse import unquote, urlparse

from src.core.logging import get_logger
from src.core.supabase import public_storage_url

from . import icons, medien, medien_holen, stock
from .fehler import SiteConfigError
from .schemas_mediathek import (
    IconImportRequest,
    MediaUebersicht,
    MediumBulkMove,
    MediumImportRequest,
    MediumListResponse,
    MediumResponse,
    MediumUpdate,
    PublicBildnachweis,
    StockImportRequest,
)

if TYPE_CHECKING:  # pragma: no cover — nur für die Typprüfung
    from src.core.security import AuthContext

log = get_logger("nextdays.site_config.mediathek")

#: Spalten der Mediathek-Zeilen. Aufgezählt und nicht `*`: eine neue Spalte soll
#: eine bewusste Entscheidung sein, keine automatische Mitlieferung.
_MEDIA_COLS = (
    "id, url, filename, mime, bytes, created_at, kind, "
    "folder_id, alt_text, width, height, source, credit_name, credit_url"
)


#: Medienart → Anzeigename in den SERVERseitigen Meldungen („max. 50 MB für
#: Audio"). Die Oberfläche übersetzt selbst; das hier ist der Text, der in einer
#: 413/415-Antwort landet, und der ist deutsch wie die übrigen Meldungen des
#: Slice. Gleichzeitig die Allowlist für den Reiter-Filter: was hier nicht steht,
#: gibt es nicht (fail-closed, Wurzel 5).
MEDIEN_ARTEN = {
    "image": "Bilder",
    "icon": "Symbole",
    "video": "Videos",
    "audio": "Audio",
    "file": "Dateien",
}


def _name_aus_url(url: str) -> str | None:
    """Anzeigename aus dem letzten Pfadstück einer Adresse.

    Reine ANZEIGE — der echte Bucket-Pfad ist der Zufallstoken aus
    ``add_medium``. Deshalb braucht es hier keine Traversal-Prüfung; gekürzt
    wird trotzdem, und ein leeres Ergebnis wird ``None`` statt ein Strich.
    """
    letztes = urlparse(url).path.rsplit("/", 1)[-1]
    return unquote(letztes)[:200] or None


class MediathekMixin:
    """Bildbestand des Betriebs: auflisten, hochladen, löschen."""

    # === Mediathek (Dashboard, MANAGE_SITE_CONFIG) ==========================

    #: Bucket der Mediathek (Migration 0422). Öffentlich, weil die Bilder als
    #: <img src> in gespeicherte Blöcke wandern.
    MEDIA_BUCKET = "site-media"
    #: Erlaubte Typen → Dateiendung. Die Tabelle steht in ``medien`` neben der
    #: Signaturprüfung, die sie erzeugt — zwei Listen, die dasselbe behaupten,
    #: laufen auseinander (SVG fehlt in beiden: es darf <script> tragen und wäre
    #: im public Bucket Stored-XSS, Wurzel 8).
    MEDIA_MIME = medien.DATEI_ENDUNGEN
    #: Deckel JE ART, nicht einer für alles. 20 MB sind für ein Foto großzügig
    #: und für ein Video nichts; 200 MB für ein Bild wären dagegen die Ansage,
    #: dass ein unkomprimiertes Handyvideo als „Bild" durchgeht. Der Bucket
    #: deckelt zusätzlich bei 200 MB (0479) — das ist der zweite Riegel, nicht
    #: dieser.
    MEDIA_MAX_BYTES_JE_ART = {
        "image": 20 * 1024 * 1024,
        "video": 200 * 1024 * 1024,
        "audio": 50 * 1024 * 1024,
        "file": 25 * 1024 * 1024,
    }
    #: Für Aufrufer, die nach der GRÖSSTEN erlaubten Menge fragen (Bild-Import
    #: per Adresse). Kein zweiter handgeschriebener Wert.
    MEDIA_MAX_BYTES = max(MEDIA_MAX_BYTES_JE_ART.values())
    #: Obergrenze je Betrieb — kein unbegrenzter Bereich (Wurzel 8). Reicht für
    #: jede echte Vermieter-Website und verhindert, dass ein Konto den Bucket
    #: füllt.
    MEDIA_MAX_COUNT = 500

    #: Nach welchen Feldern die Oberfläche sortieren darf — und WELCHE Spalte
    #: das jeweils ist. Als Tabelle und nicht als durchgereichter Spaltenname:
    #: ein Client, der `order=tenant_id` schickt, darf nicht die Sortierung
    #: einer fremden Spalte auslösen (Wurzel 3).
    MEDIA_SORTIERUNG: dict[str, tuple[str, bool]] = {
        "neueste": ("created_at", True),
        "aelteste": ("created_at", False),
        "name": ("filename", False),
        "groesse": ("bytes", True),
    }

    def list_media(
        self,
        ctx: AuthContext,
        *,
        limit: int = 100,
        offset: int = 0,
        folder_id: str | None = None,
        nur_wurzel: bool = False,
        suche: str | None = None,
        sortierung: str = "neueste",
        art: str | None = None,
    ) -> MediumListResponse:
        """Bildbestand des Betriebs, gefiltert und sortiert.

        ``art`` ist der Reiter der Oberfläche (Bilder · Symbole · Videos ·
        Audio · Dateien, 0479). ``None`` heißt „alle Arten" — bewusst nicht
        „Bilder", denn dann könnte die Oberfläche einen Gesamtbestand nie
        zeigen.

        ``nur_wurzel`` ist ein eigener Schalter und nicht ``folder_id=None``,
        weil die beiden verschiedene Fragen sind: „egal wo" und „genau in
        keinem Ordner". Mit nur einem Parameter wären sie nicht
        unterscheidbar — und die Oberfläche braucht beide, sobald es einen
        Eintrag „Alle Bilder" neben der Wurzel gibt."""
        tenant_id = self._require_tenant(ctx)
        # Harte Obergrenze auch hier: ein Client, der limit=100000 schickt, darf
        # keine unbegrenzte Antwort auslösen.
        limit = max(1, min(limit, 200))
        offset = max(0, offset)
        spalte, absteigend = self.MEDIA_SORTIERUNG.get(
            sortierung, self.MEDIA_SORTIERUNG["neueste"]
        )
        q = (
            self._db.table("site_media")
            .select(_MEDIA_COLS, count="exact")
            .eq("tenant_id", tenant_id)
        )
        if folder_id:
            # Scope: der Ordner muss dem Betrieb gehören. Ohne diese Zeile wäre
            # eine fremde Ordner-ID einfach ein Filter, der nichts findet — die
            # Antwort sähe wie „leerer Ordner" aus statt wie „gibt es nicht"
            # (Wurzel 9).
            self._eigener_ordner_pflicht(tenant_id, folder_id)
            q = q.eq("folder_id", folder_id)
        elif nur_wurzel:
            q = q.is_("folder_id", "null")
        if art:
            # Unbekannte Art = Fehler, nicht „ergibt nichts". Ein stiller
            # Leerbestand sähe wie ein leerer Reiter aus (fail-closed, Wurzel 5).
            if art not in MEDIEN_ARTEN:
                raise SiteConfigError("Unbekannte Medienart.", status_code=422)
            q = q.eq("kind", art)
        if suche and suche.strip():
            # Nur der Dateiname. Über Alt-Text mitzusuchen klänge hilfreich,
            # würde aber Treffer liefern, deren Grund man in der Kachel nicht
            # sieht — der Kunde sucht sichtbar nach dem, was er getippt hat.
            q = q.ilike("filename", f"%{suche.strip()[:80]}%")
        res = q.order(spalte, desc=absteigend).range(offset, offset + limit - 1).execute()
        rows = res.data or []
        items = [MediumResponse(**self._medium_row(r)) for r in rows]
        # `total` ist die Zahl ALLER Treffer, nicht die der gelieferten Seite:
        # ohne sie kann die Oberfläche keine Seitenzahl anzeigen und weiß nicht,
        # ob es noch etwas gibt.
        return MediumListResponse(items=items, total=res.count or len(items))

    def add_medium(
        self,
        ctx: AuthContext,
        content: bytes,
        *,
        filename: str | None = None,
        folder_id: str | None = None,
    ) -> MediumResponse:
        """Eine Datei in die Mediathek legen — Bild, Video, Audio oder Dokument.

        Der Typ wird aus den ANFANGSBYTES bestimmt, nicht aus dem, was der Client
        behauptet: ein `content_type` ist eine Angabe der Gegenseite und kostet
        nichts. Wer „image/jpeg" schreibt und HTML oder SVG schickt, hätte sonst
        eine Datei im öffentlichen Bucket, die der Browser als Dokument ausführt
        (Wurzel 8).

        Die ART kommt aus derselben Prüfung wie der MIME-Typ und wird NICHT vom
        Client übernommen: sonst läge ein PNG als ``kind='video'`` im Bestand,
        und der Check aus 0479 wäre der einzige, der es merkt."""
        tenant_id = self._require_tenant(ctx)
        # Ordner ZUERST prüfen, vor dem Upload: eine Datei im Bucket, deren
        # DB-Zeile danach an einer fremden Ordner-ID scheitert, wäre eine Waise
        # (Wurzel 1).
        self._eigener_ordner(tenant_id, folder_id)
        erkannt = medien.datei_typ(content)
        if erkannt is None:
            raise SiteConfigError(
                "Dateityp nicht erlaubt. Möglich sind Bilder (JPEG, PNG, WebP), "
                "Videos (MP4, WebM), Audio (MP3, M4A, WAV, OGG) und Dokumente "
                "(PDF, DOCX, XLSX, PPTX, ZIP).",
                status_code=415,
            )
        mime, art = erkannt
        deckel = self.MEDIA_MAX_BYTES_JE_ART[art]
        if len(content) > deckel:
            raise SiteConfigError(
                f"Datei ist zu groß (max. {deckel // (1024 * 1024)} MB "
                f"für {MEDIEN_ARTEN[art]}).",
                status_code=413,
            )

        self._platz_pruefen(tenant_id)

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
        # Maße gibt es nur bei Bildern. Für ein Video die Auflösung zu lesen
        # hieße, den Container zu parsen — dafür ist die Anzeige „1920 × 1080"
        # kein hinreichender Grund, und ein geratener Wert wäre eine
        # Falschaussage (Wurzel 4). Die Spalten bleiben dort leer.
        masse = medien.bild_masse(content) if art == "image" else None
        payload = {
            "tenant_id": tenant_id,
            "path": path,
            "url": url,
            "kind": art,
            "folder_id": folder_id,
            # Maße aus den Kopfbytes. Fehlen sie (abgeschnittener Kopf), bleibt
            # die Spalte leer — kein geratener Wert (Wurzel 4).
            "width": masse[0] if masse else None,
            "height": masse[1] if masse else None,
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
        log.info(
            "site_media_added", tenant_id=tenant_id, art=art, bytes=len(content)
        )
        return MediumResponse(**self._medium_row(res.data[0]))

    def update_medium(
        self, ctx: AuthContext, medium_id: str, daten: MediumUpdate
    ) -> MediumResponse:
        """Anzeigename, Ordner und Alt-Text ändern.

        ``exclude_unset``: NICHT gesendete Felder bleiben, wie sie sind.
        Gesendetes ``null`` ist dagegen ein echter Wert — „raus aus dem Ordner"
        und „Alt-Text löschen" müssen ausdrückbar sein, und ein Schema, in dem
        `null` und `nicht gesendet` dasselbe bedeuten, kann das nicht."""
        tenant_id = self._require_tenant(ctx)
        self._own_medium(tenant_id, medium_id)
        felder = daten.model_dump(exclude_unset=True)
        if not felder:
            return self.get_medium(ctx, medium_id)
        if "folder_id" in felder:
            self._eigener_ordner(tenant_id, felder["folder_id"])
        if "filename" in felder:
            name = (felder["filename"] or "").strip()
            # Der Anzeigename landet in KEINEM Pfad — der echte Pfad ist der
            # Zufallstoken aus `add_medium`. Umbenennen ist deshalb reine
            # Anzeige und braucht keine Traversal-Prüfung; die Länge wird
            # trotzdem gedeckelt (Schema, 200).
            felder["filename"] = name or None
        if "alt_text" in felder:
            felder["alt_text"] = (felder["alt_text"] or "").strip() or None
        self._db.table("site_media").update(felder).eq("id", medium_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info("site_media_updated", tenant_id=tenant_id, medium_id=medium_id)
        return self.get_medium(ctx, medium_id)

    def get_medium(self, ctx: AuthContext, medium_id: str) -> MediumResponse:
        """Ein Bild mit allen Feldern. Gleicher Scope wie die Liste (Wurzel 9)."""
        tenant_id = self._require_tenant(ctx)
        return MediumResponse(
            **self._medium_row(self._own_medium_voll(tenant_id, medium_id))
        )

    def move_media(
        self, ctx: AuthContext, daten: MediumBulkMove
    ) -> MediumListResponse:
        """Mehrere Bilder in einen Ordner schieben (Mehrfachauswahl).

        EIN Aufruf statt n: bei 50 Bildern wären es sonst 50 Rundreisen, von
        denen die 30. scheitern kann — und dann liegen 29 verschoben und 21
        nicht, ohne dass jemand weiß, welche.

        Der Scope wird VOR dem Schreiben für ALLE IDs geprüft. Eine fremde ID
        mittendrin darf nicht dazu führen, dass die davor schon verschoben
        sind (Wurzel 3 + Wurzel 1)."""
        tenant_id = self._require_tenant(ctx)
        self._eigener_ordner(tenant_id, daten.folder_id)
        ids = list(dict.fromkeys(daten.media_ids))
        for medium_id in ids:
            self._own_medium(tenant_id, medium_id)
        self._db.table("site_media").update({"folder_id": daten.folder_id}).in_(
            "id", ids
        ).eq("tenant_id", tenant_id).execute()
        log.info("site_media_moved", tenant_id=tenant_id, anzahl=len(ids))
        return MediumListResponse(
            items=[
                MediumResponse(**self._medium_row(self._own_medium_voll(tenant_id, i)))
                for i in ids
            ],
            total=len(ids),
        )

    def remove_media_bulk(self, ctx: AuthContext, media_ids: list[str]) -> int:
        """Mehrere Medien löschen — Zeilen UND Dateien. Rückgabe: Anzahl.

        Eigener Vorgang und nicht n Einzelaufrufe, aus demselben Grund wie
        ``move_media``: bei 40 markierten Bildern wären es 40 Rundreisen, von
        denen die 25. scheitern kann.

        Der Scope wird für ALLE IDs geprüft, BEVOR die erste Zeile fällt
        (Wurzel 3). Eine fremde ID mittendrin darf nicht bedeuten, dass die
        davor schon gelöscht sind — Löschen ist der eine Vorgang, den man nicht
        zurücknehmen kann.
        """
        tenant_id = self._require_tenant(ctx)
        ids = list(dict.fromkeys(media_ids))
        zeilen = [self._own_medium(tenant_id, medium_id) for medium_id in ids]
        self._db.table("site_media").delete().in_("id", ids).eq(
            "tenant_id", tenant_id
        ).execute()
        for zeile in zeilen:
            # Stock- und Symbol-Zeilen sind Hotlinks ohne Datei bei uns.
            if zeile.get("path"):
                self._entferne_datei(zeile["path"])
        log.info("site_media_removed_bulk", tenant_id=tenant_id, anzahl=len(ids))
        return len(ids)

    def media_uebersicht(self, ctx: AuthContext) -> MediaUebersicht:
        """Wie viele Medien es je ART und je HERKUNFT gibt.

        Die linke Spalte des Media Managers zeigt „HOCHGELADEN (65)" und
        „GEKAUFT (0)", und jeder Reiter trägt seine Zahl. Beides kommt von HIER
        und wird NICHT im Browser aus der geladenen Seite gezählt: geladen sind
        höchstens 200 Zeilen, die Zahl daneben wäre dann die Zahl der gerade
        sichtbaren — plausibel und falsch (Wurzel 4).

        ``gekauft`` ist heute zwangsläufig 0: einen kostenpflichtigen
        Bildanbieter gibt es nicht (siehe ``stock.py`` — Shutterstock braucht Abo
        und AGB-Erweiterung). Die Zahl wird trotzdem GEZÄHLT und nicht
        hartkodiert, damit sie am Tag der Freischaltung stimmt, ohne dass jemand
        hier etwas nachzieht.
        """
        tenant_id = self._require_tenant(ctx)

        def zaehle(**filter_paare: str) -> int:
            q = (
                self._db.table("site_media")
                .select("id", count="exact")
                .eq("tenant_id", tenant_id)
            )
            for spalte, wert in filter_paare.items():
                q = q.eq(spalte, wert)
            return q.limit(1).execute().count or 0

        je_art = {art: zaehle(kind=art) for art in MEDIEN_ARTEN}
        return MediaUebersicht(
            total=sum(je_art.values()),
            je_art=je_art,
            hochgeladen_je_art={
                art: zaehle(kind=art, source="upload") for art in MEDIEN_ARTEN
            },
            gekauft_je_art={
                art: sum(
                    zaehle(kind=art, source=anbieter)
                    for anbieter in stock.BEZAHLTE_ANBIETER
                )
                for art in MEDIEN_ARTEN
            },
            grenze=self.MEDIA_MAX_COUNT,
        )

    def import_medium_von_url(
        self, ctx: AuthContext, daten: MediumImportRequest
    ) -> MediumResponse:
        """Ein Bild von einer fremden Adresse in die Mediathek holen (0479).

        Der Unterschied zum Stock-Import: dort liefert der Kunde eine KENNUNG
        beim Anbieter, hier eine beliebige Adresse. Deshalb ist das hier der
        gefährlichere Weg — ein Server, der eine vom Kunden gelieferte Adresse
        abruft, ist ein SSRF-Vektor. Der Abruf läuft über
        ``medien_holen.datei_holen`` (IP geprüft und gepinnt, keine
        Weiterleitungen, Byte-Deckel beim Lesen).

        Was ankommt, muss ein BILD sein. Ein PDF hinter einer Adresse, die
        „…/logo.png" heißt, wird abgelehnt statt als Datei einsortiert: der
        Vorgang heißt „Bild importieren", und ein stiller Artwechsel wäre genau
        die Sorte Überraschung, die niemand als Fehler meldet.

        Die Datei landet als normaler Upload in unserem Bucket (``source =
        'upload'``): sie liegt bei uns, sie hat einen Pfad, sie zählt gegen die
        Bestandsgrenze. Ein eigener Herkunftswert „import" wäre eine Aussage
        über den WEG, nicht über die Herkunft der Rechte — und die Rechte klärt
        der Kunde, nicht der Weg.
        """
        inhalt = medien_holen.datei_holen(
            str(daten.url),
            max_bytes=self.MEDIA_MAX_BYTES_JE_ART["image"],
            zweck="Das Bild",
        )
        erkannt = medien.datei_typ(inhalt)
        if erkannt is None or erkannt[1] != "image":
            raise SiteConfigError(
                "Hinter dieser Adresse liegt kein Bild (JPEG, PNG oder WebP).",
                status_code=422,
            )
        return self.add_medium(
            ctx,
            inhalt,
            filename=daten.filename or _name_aus_url(str(daten.url)),
            folder_id=daten.folder_id,
        )

    # === Symbole (0479) =====================================================

    def import_icon(
        self, ctx: AuthContext, daten: IconImportRequest
    ) -> MediumResponse:
        """Ein Symbol in die Mediathek übernehmen.

        Wie beim Stock-Foto trägt die Anfrage NUR die Kennung; Adresse, Satzname
        und Lizenz holt der Server frisch bei der Bibliothek (Wurzel 3), und
        ohne vollständigen Nachweis wird nicht übernommen (``icons._nachweis``,
        fail-closed).

        Doppelklick und Retry legen NICHT zwei Zeilen an: erst wird die
        vorhandene gesucht, und der partielle Unique-Index
        ``site_media_extern_einmal`` (0461) ist der Riegel dahinter (Wurzel 2).
        Er greift hier ohne Änderung, weil ``external_id`` dieselbe Spalte ist.
        """
        tenant_id = self._require_tenant(ctx)
        self._eigener_ordner(tenant_id, daten.folder_id)
        kennung = daten.icon.strip()
        vorhanden = (
            self._db.table("site_media")
            .select(_MEDIA_COLS)
            .eq("tenant_id", tenant_id)
            .eq("source", "iconify")
            .eq("external_id", kennung)
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            return MediumResponse(**self._medium_row(vorhanden[0]))

        self._platz_pruefen(tenant_id)
        adresse, nachweis, nachweis_url = icons.symbol_pruefen(kennung)
        _, name = icons.zerlegen(kennung)
        payload = {
            "tenant_id": tenant_id,
            # KEIN `path` und KEINE `bytes`: das SVG bleibt bei der Bibliothek
            # (siehe `icons`-Docstring). Genau diesen Fall lässt der Constraint
            # `site_media_herkunft_stimmig` für fremde Herkunft zu.
            "url": adresse,
            "kind": "icon",
            "mime": "image/svg+xml",
            "filename": name[:200] or None,
            "folder_id": daten.folder_id,
            # Der Alt-Text ist der Symbolname — ein Symbol OHNE Alt-Text wäre
            # für einen Screenreader ein stummes Bild, und „house" ist die
            # ehrlichste Beschreibung, die wir ohne Raten haben.
            "alt_text": name[:300] or None,
            "source": "iconify",
            "credit_name": nachweis,
            "credit_url": nachweis_url,
            "external_id": kennung,
        }
        res = self._db.table("site_media").insert(payload).execute()
        if not res.data:
            raise SiteConfigError(
                "Symbol konnte nicht gespeichert werden.", status_code=500
            )
        log.info("site_media_icon_imported", tenant_id=tenant_id, icon=kennung)
        return MediumResponse(**self._medium_row(res.data[0]))

    # === Stock-Fotos (0461) =================================================

    def import_stock_photo(
        self, ctx: AuthContext, daten: StockImportRequest
    ) -> MediumResponse:
        """Ein Stock-Foto in die Mediathek übernehmen.

        Drei Dinge passieren hier, und keines davon darf fehlen:

        1. Die Bilddaten werden FRISCH beim Anbieter geholt (``stock.foto_holen``)
           — die Anfrage liefert nur Anbieter und Kennung. Käme die Bildadresse
           aus dem Browser, könnte jeder eine beliebige Adresse in die Website
           schreiben und den „Bildnachweis" selbst ausfüllen (Wurzel 3).
        2. Die Zeile trägt den vollständigen Nachweis. Der CHECK-Constraint
           ``site_media_herkunft_stimmig`` (0461) ist der Backstop dazu: eine
           Stock-Zeile ohne Fotograf lässt die DB nicht zu.
        3. Unsplashs Download-Zähler wird angepingt. Das ist Vertragspflicht bei
           der Übernahme, kein Download.

        Doppelklick und Retry legen NICHT zweimal dasselbe Foto an: erst wird
        eine vorhandene Zeile gesucht und zurückgegeben, und der partielle
        Unique-Index in der DB ist der Riegel dahinter (Wurzel 2)."""
        tenant_id = self._require_tenant(ctx)
        self._eigener_ordner(tenant_id, daten.folder_id)
        anbieter = daten.provider.value
        vorhanden = (
            self._db.table("site_media")
            .select(_MEDIA_COLS)
            .eq("tenant_id", tenant_id)
            .eq("source", anbieter)
            .eq("external_id", daten.external_id)
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            # Schon da — dieselbe Zeile zurückgeben statt eine zweite anzulegen.
            return MediumResponse(**self._medium_row(vorhanden[0]))

        self._platz_pruefen(tenant_id)
        foto, download_ziel = stock.foto_holen(anbieter, daten.external_id)
        if not foto.credit_name or not foto.credit_url:
            # Ohne Nachweis wird NICHT übernommen. Ein Bild, das den Vertrag
            # bricht, sobald es auf einer Seite steht, ist kein halber Erfolg
            # (fail-closed, Wurzel 5).
            raise SiteConfigError(
                "Der Anbieter hat keinen Bildnachweis geliefert; dieses Foto "
                "kann nicht übernommen werden.",
                status_code=502,
            )
        payload = {
            "tenant_id": tenant_id,
            # KEIN `path`: Stock-Bilder werden nicht auf unseren Bucket kopiert
            # (Anbietervorgabe). Der Constraint aus 0461 erlaubt genau das.
            "url": foto.full_url,
            # Ausdrücklich gesetzt, obwohl die Spalte 'image' als Default hat:
            # ein Default ist die Antwort auf eine NICHT gestellte Frage, und ein
            # Stock-Foto ist zweifelsfrei ein Bild (Wurzel 4).
            "kind": "image",
            "filename": (foto.alt_text or foto.credit_name)[:200] or None,
            "mime": "image/jpeg",
            "folder_id": daten.folder_id,
            "alt_text": foto.alt_text,
            "width": foto.width,
            "height": foto.height,
            "source": anbieter,
            "credit_name": foto.credit_name,
            "credit_url": foto.credit_url,
            "external_id": foto.external_id,
        }
        res = self._db.table("site_media").insert(payload).execute()
        if not res.data:
            raise SiteConfigError(
                "Bild konnte nicht gespeichert werden.", status_code=500
            )
        # NACH dem Speichern: der Zähler gehört zur Übernahme, und eine
        # Übernahme, die an der DB scheitert, hat nicht stattgefunden.
        stock.download_melden(anbieter, download_ziel)
        log.info("site_media_stock_imported", tenant_id=tenant_id, anbieter=anbieter)
        return MediumResponse(**self._medium_row(res.data[0]))

    def _platz_pruefen(self, tenant_id: str) -> None:
        """Gegenzustand zur Obergrenze: erst zählen, dann schreiben. Sonst
        wächst der Bestand still über das Limit (Wurzel 1)."""
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

    # === Bildnachweise für den Renderer (0461) ==============================

    def bildnachweise(self, tenant_id: str) -> list[PublicBildnachweis]:
        """Alle Stock-Bilder des Betriebs mit Fotograf und Profil-Adresse.

        Geht mit der ÖFFENTLICHEN Antwort des Domain-Resolvers hinaus, weil die
        Attribution dort gebraucht wird, wo das Foto ANGEZEIGT wird — auf der
        veröffentlichten Website. Eine Attribution nur im Editor erfüllt
        Unsplashs Nutzungsbedingungen nicht, und geschlossen haben wir sie im
        Namen des Kunden.

        Der Renderer schlägt über die ``url`` nach. Damit ist jedes Bildfeld
        abgedeckt — auch die Block-Typen, die es heute noch nicht gibt.

        Kosten: EINE zusätzliche Abfrage je aufgelöster Domain, gefiltert auf
        ``source <> 'upload'``. Ein Betrieb ohne Stock-Bilder bekommt eine leere
        Liste; die Abfrage trotzdem zu machen ist billiger, als an jeder
        Anzeigestelle einzeln nachzuschlagen."""
        rows = (
            self._db.table("site_media")
            .select("url, credit_name, credit_url, source")
            .eq("tenant_id", tenant_id)
            .neq("source", "upload")
            .limit(self.MEDIA_MAX_COUNT)
            .execute()
        ).data or []
        nachweise: list[PublicBildnachweis] = []
        for r in rows:
            quelle = str(r.get("source") or "")
            profil = stock.ANBIETER.get(quelle)
            if profil is None or not r.get("credit_name") or not r.get("credit_url"):
                # Unvollständig = NICHT ausliefern. Ein halber Nachweis
                # („Photo by  on Unsplash") ist schlechter als keiner: er sieht
                # aus, als wäre die Pflicht erfüllt (Wurzel 5).
                continue
            nachweise.append(
                PublicBildnachweis(
                    url=str(r["url"]),
                    photographer=str(r["credit_name"]),
                    photographer_url=str(r["credit_url"]),
                    provider=profil.anzeigename,
                    provider_url=stock.startseite_mit_utm(quelle),
                )
            )
        return nachweise

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
        # Stock-Bilder liegen als Hotlink beim Anbieter — sie haben keine Datei
        # bei uns, und `remove([None])` wäre ein Aufruf ins Leere.
        if row.get("path"):
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
            .select("id, path, source")
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

    def _own_medium_voll(self, tenant_id: str, medium_id: str) -> dict:
        """Wie ``_own_medium``, aber mit allen Anzeigefeldern.

        Zwei Fassungen, weil der Löschpfad nur den Bucket-Pfad braucht und ein
        `select *` dort mehr liest, als er verwendet — die Spaltenliste ist an
        beiden Stellen aufgezählt, damit eine neue Spalte eine Entscheidung
        bleibt (Wurzel 4)."""
        rows = (
            self._db.table("site_media")
            .select(_MEDIA_COLS + ", path, external_id")
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
