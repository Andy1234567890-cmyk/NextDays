"""Wo wird dieses Bild verwendet — und ein Bild überall ersetzen (0460).

Zwei Vorgänge, ein Modul, weil sie DIESELBE Landkarte brauchen: die Liste der
Orte, an denen eine Bildadresse in dieser Website stehen kann. Getrennt gebaut
wären es zwei Landkarten, und die zweite wäre die unvollständige.

**Warum überhaupt.** Ein Bild löschen heißt heute: die Datei ist weg, und auf
einer veröffentlichten Seite steht ein kaputtes Bild. Der Kunde merkt es, wenn
ein Gast es meldet. Die Verwendungsprüfung ist der Gegenzustand dazu (Wurzel 1):
vor dem Löschen sagen, was dabei kaputtgeht.

**Warum die Suche über den JSON-TEXT läuft und nicht über eine Feldliste.**
Die Blöcke tragen Bildadressen in mindestens fünfzehn verschiedenen Schlüsseln,
teils in Listen (`gallery.images[]`), teils in Listen von Objekten
(`media_slider.slides[].image_url`), teils in den Einstellungen
(`settings.background_image_url`). Eine aufgezählte Feldliste wäre am Tag ihrer
Entstehung vollständig und beim nächsten neuen Block-Typ still unvollständig —
und „still unvollständig" heißt hier: die Oberfläche meldet „wird nirgends
verwendet", der Kunde löscht, die Seite bricht. Deshalb wird der GANZE
Inhaltsbaum durchlaufen und jeder String verglichen. Ein neuer Block-Typ ist
damit automatisch abgedeckt.

Was NICHT gesucht wird: Adressen in freiem HTML (`head_html`, `custom_js`,
Rich-Text-Inhalte mit eingebettetem `<img>`). Sie werden im Ersetzen NICHT
angefasst — eine Zeichenkettenersetzung in fremdem HTML ist ein Eingriff, dessen
Ergebnis niemand vorhersagen kann. Stattdessen werden sie GEMELDET: die Antwort
trägt sie als eigene Fundstelle mit dem Hinweis, dass der Kunde dort selbst
nachsehen muss. Ein Fund, den man nicht automatisch behandeln kann, ist immer
noch besser als ein verschwiegener (Wurzel 5).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from src.core.logging import get_logger

from .fehler import SiteConfigError
from .schemas_mediathek import (
    MediaReplaceResponse,
    MediaUsage,
    MediaUsageResponse,
)

if TYPE_CHECKING:  # pragma: no cover — nur für die Typprüfung
    from src.core.security import AuthContext

log = get_logger("nextdays.site_config.mediathek_verwendung")

#: Bildfelder der Seiten-Tabelle. Hier IST eine Aufzählung richtig: es sind
#: benannte Spalten, keine freie Struktur — eine neue Spalte ist eine Migration
#: und damit ein bewusster Schritt, bei dem diese Liste mitgeht.
_SEITEN_BILDFELDER = ("og_image_url", "cover_image_url")

#: Bildfelder der Site-Konfiguration (Logo, Startbild, Favicon, RSS-Bild).
_BRANDING_BILDFELDER = (
    "logo_url",
    "hero_image_url",
    "favicon_url",
    "rss_image_url",
)

#: Freitext-Felder, die eine Adresse enthalten KÖNNEN, aber nicht angefasst
#: werden. Nur Meldung, keine Ersetzung — siehe Modul-Docstring.
_NUR_MELDEN = ("head_html", "custom_js", "checkout_js", "head_css")

#: Deckel für den Durchlauf durch einen Inhaltsbaum. Ein Block-Inhalt ist ein
#: Objekt mit ein paar Dutzend Knoten; 20 000 ist weit darüber und beendet
#: jeden Baum, den ein defekter Datensatz unbegrenzt macht (Wurzel 8).
_MAX_KNOTEN = 20_000


#: Ein Knoten eines JSON-Inhaltsbaums. Ausgeschrieben und nicht `Any`: der Typ
#: sagt damit, WAS in einem Block-Inhalt stehen darf — und `Any` würde jede
#: Typprüfung an dieser Stelle abschalten, ausgerechnet in der Funktion, die
#: fremde gespeicherte Daten durchläuft.
type JsonWert = (
    str | int | float | bool | None | list["JsonWert"] | dict[str, "JsonWert"]
)


def _knoten_durchlaufen(
    wert: JsonWert, treffer: str, *, ersetzen: str | None
) -> tuple[JsonWert, int]:
    """Baum durchgehen; zählt Treffer und ersetzt sie optional.

    Gibt ``(neuer_wert, anzahl)`` zurück. Ohne ``ersetzen`` bleibt der Baum
    unverändert — dieselbe Funktion beantwortet damit beide Fragen, und es kann
    nicht passieren, dass „gefunden" und „ersetzt" verschiedene Stellen meinen.
    """
    zaehler = 0
    budget = [_MAX_KNOTEN]

    def gehe(knoten: JsonWert) -> JsonWert:
        nonlocal zaehler
        budget[0] -= 1
        if budget[0] <= 0:
            return knoten
        if isinstance(knoten, str):
            if knoten == treffer:
                zaehler += 1
                return ersetzen if ersetzen is not None else knoten
            return knoten
        if isinstance(knoten, list):
            return [gehe(x) for x in knoten]
        if isinstance(knoten, dict):
            return {k: gehe(v) for k, v in knoten.items()}
        return knoten

    return gehe(wert), zaehler


class MediathekVerwendungMixin:
    """Verwendungsnachweis und „Bild überall ersetzen"."""

    # === Verwendung =========================================================

    def find_media_usage(
        self, ctx: AuthContext, medium_id: str
    ) -> MediaUsageResponse:
        """Alle Stellen, an denen die Adresse dieses Bildes steht."""
        tenant_id = self._require_tenant(ctx)
        medium = self._own_medium_voll(tenant_id, medium_id)
        fundstellen = self._fundstellen(tenant_id, medium["url"], ersetzen=None)
        return MediaUsageResponse(
            medium_id=medium_id,
            items=fundstellen,
            total=len(fundstellen),
        )

    # === Ersetzen ===========================================================

    def replace_medium(
        self, ctx: AuthContext, medium_id: str, ersatz_id: str
    ) -> MediaReplaceResponse:
        """Ein Bild an ALLEN Verwendungsstellen durch ein anderes tauschen.

        Der Vorgang, den Hostaway „Replace image" nennt. Ohne ihn muss der Kunde
        jeden Block einzeln öffnen — bei einem Logo, das in acht Abschnitten
        steht, ist das der Unterschied zwischen einer Minute und einem
        Nachmittag.

        Das ALTE Bild bleibt in der Mediathek. Es mit zu löschen wäre ein
        zweiter, unausgesprochener Vorgang: wer ein Bild tauscht, will nicht
        zwingend das alte verlieren — und ist es erst weg, hilft kein
        Rückgängig. Der Kunde löscht es danach selbst, und dann sagt ihm die
        Verwendungsprüfung, dass es nirgends mehr steht."""
        tenant_id = self._require_tenant(ctx)
        if medium_id == ersatz_id:
            raise SiteConfigError(
                "Altes und neues Bild sind dasselbe.", status_code=422
            )
        alt = self._own_medium_voll(tenant_id, medium_id)
        neu = self._own_medium_voll(tenant_id, ersatz_id)
        fundstellen = self._fundstellen(tenant_id, alt["url"], ersetzen=neu["url"])
        ersetzt = sum(f.count for f in fundstellen if f.replaceable)
        log.info(
            "site_media_replaced",
            tenant_id=tenant_id,
            medium_id=medium_id,
            stellen=ersetzt,
        )
        return MediaReplaceResponse(
            medium_id=medium_id,
            replacement_id=ersatz_id,
            replaced=ersetzt,
            items=fundstellen,
            # Was gefunden, aber NICHT angefasst wurde. Steht getrennt, damit die
            # Oberfläche es benennen kann statt „fertig" zu melden, während in
            # einem HTML-Feld noch die alte Adresse steht.
            manual=sum(1 for f in fundstellen if not f.replaceable),
        )

    # === Die eine Landkarte =================================================

    def _fundstellen(
        self, tenant_id: str, url: str, *, ersetzen: str | None
    ) -> list[MediaUsage]:
        """Alle Orte durchgehen. ``ersetzen=None`` = nur suchen."""
        return [
            *self._in_bloecken(tenant_id, url, ersetzen=ersetzen),
            *self._in_seiten(tenant_id, url, ersetzen=ersetzen),
            *self._in_branding(tenant_id, url, ersetzen=ersetzen),
        ]

    def _seiten_titel(self, tenant_id: str) -> dict[str, str]:
        rows = (
            self._db.table("site_pages")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .limit(1000)
            .execute()
        ).data or []
        return {str(r["id"]): str(r.get("title") or "") for r in rows}

    def _in_bloecken(
        self, tenant_id: str, url: str, *, ersetzen: str | None
    ) -> list[MediaUsage]:
        rows = (
            self._db.table("site_blocks")
            .select("id, parent_id, kind, span, page_id, type, content, settings")
            .eq("tenant_id", tenant_id)
            .limit(5000)
            .execute()
        ).data or []
        titel = self._seiten_titel(tenant_id)
        gefunden: list[MediaUsage] = []
        for r in rows:
            neu_content, n_content = _knoten_durchlaufen(
                r.get("content") or {}, url, ersetzen=ersetzen
            )
            neu_settings, n_settings = _knoten_durchlaufen(
                r.get("settings") or {}, url, ersetzen=ersetzen
            )
            gesamt = n_content + n_settings
            if gesamt == 0:
                continue
            if ersetzen is not None:
                self._db.table("site_blocks").update(
                    {"content": neu_content, "settings": neu_settings}
                ).eq("id", r["id"]).eq("tenant_id", tenant_id).execute()
            gefunden.append(
                MediaUsage(
                    kind="block",
                    page_id=str(r["page_id"]) if r.get("page_id") else None,
                    page_title=titel.get(str(r.get("page_id")), None),
                    block_id=str(r["id"]),
                    block_type=str(r.get("type") or ""),
                    field=None,
                    count=gesamt,
                    replaceable=True,
                )
            )
        return gefunden

    def _in_seiten(
        self, tenant_id: str, url: str, *, ersetzen: str | None
    ) -> list[MediaUsage]:
        rows = (
            self._db.table("site_pages")
            .select("id, title, " + ", ".join(_SEITEN_BILDFELDER))
            .eq("tenant_id", tenant_id)
            .limit(1000)
            .execute()
        ).data or []
        gefunden: list[MediaUsage] = []
        for r in rows:
            for feld in _SEITEN_BILDFELDER:
                if r.get(feld) != url:
                    continue
                if ersetzen is not None:
                    self._db.table("site_pages").update({feld: ersetzen}).eq(
                        "id", r["id"]
                    ).eq("tenant_id", tenant_id).execute()
                gefunden.append(
                    MediaUsage(
                        kind="page",
                        page_id=str(r["id"]),
                        page_title=str(r.get("title") or ""),
                        block_id=None,
                        block_type=None,
                        field=feld,
                        count=1,
                        replaceable=True,
                    )
                )
        return gefunden

    def _in_branding(
        self, tenant_id: str, url: str, *, ersetzen: str | None
    ) -> list[MediaUsage]:
        spalten = ", ".join((*_BRANDING_BILDFELDER, *_NUR_MELDEN))
        rows = (
            self._db.table("tenant_site_config")
            .select(spalten)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return []
        row = rows[0]
        gefunden: list[MediaUsage] = []
        aenderung: dict[str, object] = {}
        for feld in _BRANDING_BILDFELDER:
            if row.get(feld) != url:
                continue
            if ersetzen is not None:
                aenderung[feld] = ersetzen
            gefunden.append(
                MediaUsage(
                    kind="branding",
                    page_id=None,
                    page_title=None,
                    block_id=None,
                    block_type=None,
                    field=feld,
                    count=1,
                    replaceable=True,
                )
            )
        # Freitext: melden, nicht anfassen (siehe Modul-Docstring).
        for feld in _NUR_MELDEN:
            inhalt = row.get(feld)
            if isinstance(inhalt, str) and url in inhalt:
                gefunden.append(
                    MediaUsage(
                        kind="code",
                        page_id=None,
                        page_title=None,
                        block_id=None,
                        block_type=None,
                        field=feld,
                        count=inhalt.count(url),
                        replaceable=False,
                    )
                )
        if aenderung:
            self._db.table("tenant_site_config").update(aenderung).eq(
                "tenant_id", tenant_id
            ).execute()
        return gefunden
