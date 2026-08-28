"""Der RSS-Feed-Abschnitt (0471): Vorschau eines fremden Feeds, serverseitig
gecacht.

EIGENES Mixin und keine Funktion in `bloecke.py`: es braucht einen zweiten
Zugriffsweg — nicht „ein Block dieses Tenants", sondern „ein Block irgendeines
Tenants, dessen SEITE veröffentlicht ist". Das ist absichtlich ANDERS gescopt
als jeder andere Block-Zugriff im Slice (Wurzel 3 gilt trotzdem: der Scope ist
explizit, nicht vergessen — hier eben „öffentlich sichtbar" statt „eigener
Tenant").

Warum ein Cache und kein Live-Abruf je Seitenaufruf: der Feed gehört einem
FREMDEN Server, und jeder Gast-Seitenaufruf würde sonst einen Abruf dort
auslösen — ein unbegrenzter Bereich in der Wirkung (Wurzel 8), auch wenn der
einzelne Abruf gedeckelt ist. `site_rss_widget_cache` (0471) hält die zuletzt
gesehenen Einträge `_CACHE_TTL` lang vor.

Warum der Endpunkt eine `block_id` nimmt und KEINE freie `url`: ein
öffentlicher, unauthentifizierter Endpunkt, der eine beliebige URL abruft,
wäre selbst ein offener Proxy — unabhängig von der SSRF-Härtung gegen interne
Adressen, die `core.ausgehende_url` bereits leistet. Mit `block_id` kann nur
abgerufen werden, was ein Betrieb selbst als `feed_url` in einem
VERÖFFENTLICHTEN Abschnitt gespeichert hat.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

import nh3
from pydantic import BaseModel, Field

from src.core.logging import get_logger

from . import rss_import
from .fehler import SiteConfigError

if TYPE_CHECKING:  # pragma: no cover — nur für die Typprüfung
    from supabase import Client

log = get_logger(__name__)

# Wie lange ein gecachter Feed als „frisch" gilt, bevor der nächste
# Seitenaufruf einen neuen Abruf auslöst. 30 Minuten: ein Feed ändert sich
# selten häufiger, und selbst ein sehr aktiver Blog verliert dadurch nichts,
# was ein Gast bemerken würde.
_CACHE_TTL = timedelta(minutes=30)

# Anrisstext: kürzer als beim Blog-Import (300 Zeichen), weil dieser Text in
# einer schmalen Widget-Kachel steht, nicht auf einer eigenen Seite.
_ANRISS_LAENGE = 160


class RssFeedItem(BaseModel):
    title: str
    href: str | None = None
    published_at: str | None = None
    excerpt: str | None = None


class RssFeedPreviewResponse(BaseModel):
    items: list[RssFeedItem] = Field(default_factory=list)
    fetched_at: str | None = None
    # true = die Anzeige zeigt einen ÄLTEREN Stand, weil der letzte Abruf
    # fehlschlug. Der Renderer zeigt trotzdem lieber den alten Stand als eine
    # leere Fläche — aber der Betrieb soll es im Editor erkennen können.
    stale: bool = False


def _kurztext(roh: str) -> str | None:
    text = nh3.clean(roh or "", tags=set(), attributes={}).strip()
    text = " ".join(text.split())
    if not text:
        return None
    return text[: _ANRISS_LAENGE - 1] + "…" if len(text) > _ANRISS_LAENGE else text


def _feed_zu_items(roh: bytes, *, limit: int) -> list[RssFeedItem]:
    """Baut auf `rss_import.feed_lesen` auf (RSS 2.0 + Atom, DOCTYPE-Guard
    gegen die „billion laughs"-Attacke) statt das XML ein zweites Mal selbst
    zu parsen — eine Sicherheitsprüfung, die zweimal existiert, wird in einer
    Fassung geflickt und bleibt in der anderen offen (dieselbe Lehre wie bei
    `core.ausgehende_url`)."""
    eintraege = rss_import.feed_lesen(roh)[:limit]
    items: list[RssFeedItem] = []
    for e in eintraege:
        titel = (e.get("titel") or "").strip()
        if not titel:
            continue
        items.append(
            RssFeedItem(
                title=titel[:200],
                href=_sicherer_href(e.get("adresse")),
                published_at=rss_import.datum_lesen(e.get("datum") or ""),
                excerpt=_kurztext(e.get("anriss") or e.get("inhalt") or ""),
            )
        )
    return items


def _sicherer_href(wert: str | None) -> str | None:
    """Nur absolute http(s)-Adressen. Beide Felder (`href`, `image_url`)
    landen ungeprüft in einem `href`/`src` beim Rendern — der Backstop gehört
    hierher, wo aus fremdem Feed-XML gelesen wird (Wurzel 8)."""
    if not isinstance(wert, str):
        return None
    v = wert.strip()
    if not v or len(v) > 2000:
        return None
    if not v.lower().startswith(("http://", "https://")):
        return None
    return v


def _hash(feed_url: str) -> str:
    return hashlib.sha256(feed_url.strip().encode("utf-8")).hexdigest()


#: Höchstzahl der `rss_feed`-Abschnitte, die beim Nachweis „diese Feed-Adresse
#: hat wirklich ein Betrieb konfiguriert" durchsucht werden. Ein harter Deckel
#: (Wurzel 8) statt eines unbegrenzten Scans — 500 ist weit über allem, was ein
#: realistischer Baukasten an RSS-Abschnitten trägt.
_MAX_DURCHSUCHTE_BLOECKE = 500


class RssWidgetMixin:
    """Setzt voraus, dass die Basisklasse ``_db`` mitbringt."""

    _db: Client

    def resolve_rss_widget(
        self, feed_url: str, *, max_items: int
    ) -> RssFeedPreviewResponse:
        """Vorschau EINER Feed-Adresse — aber nur, wenn irgendein Betrieb sie
        wirklich in einem VERÖFFENTLICHTEN `rss_feed`-Abschnitt eingestellt hat.

        Der Endpunkt nimmt bewusst die Adresse selbst und keine `block_id`:
        die Adresse steht ohnehin öffentlich im `content` des Abschnitts (der
        Betrieb hat sie genau dafür eingegeben, dass sie auf seiner Seite
        erscheint) — eine `block_id` wäre eine interne Kennung, die der
        öffentliche Resolver (`/site/page`) für andere Abschnittstypen
        bewusst NICHT herausgibt. Der Nachweis „diese Adresse gehört zu einem
        echten, veröffentlichten Abschnitt" ist der Schutz vor dem offenen
        Proxy (siehe Modul-Docstring), nicht die Form der Kennung."""
        gesucht = (feed_url or "").strip()
        if not gesucht:
            raise SiteConfigError("Feed-Adresse fehlt.", status_code=422)
        bloecke = (
            self._db.table("site_blocks")
            .select("content, page_id")
            .eq("type", "rss_feed")
            .limit(_MAX_DURCHSUCHTE_BLOECKE)
            .execute()
        ).data or []
        seiten_ids = {
            b["page_id"]
            for b in bloecke
            if ((b.get("content") or {}).get("feed_url") or "").strip() == gesucht
        }
        if not seiten_ids:
            raise SiteConfigError("Unbekannte Feed-Adresse.", status_code=404)
        veroeffentlicht = (
            self._db.table("site_pages")
            .select("id")
            .in_("id", list(seiten_ids))
            .eq("is_published", True)
            .limit(1)
            .execute()
        ).data
        if not veroeffentlicht:
            raise SiteConfigError("Unbekannte Feed-Adresse.", status_code=404)
        limit = max(1, min(max_items, 12))
        return _cached_feed(self._db, gesucht, limit=limit)


def _cached_feed(db: Client, feed_url: str, *, limit: int) -> RssFeedPreviewResponse:
    schluessel = _hash(feed_url)
    vorhanden = (
        db.table("site_rss_widget_cache")
        .select("items, fetched_at, last_error")
        .eq("feed_url_hash", schluessel)
        .limit(1)
        .execute()
    ).data
    cache_zeile = vorhanden[0] if vorhanden else None
    if cache_zeile:
        alter = datetime.now(UTC) - _parse_ts(cache_zeile["fetched_at"])
        if alter < _CACHE_TTL and cache_zeile.get("items"):
            return RssFeedPreviewResponse(
                items=[RssFeedItem(**i) for i in cache_zeile["items"][:limit]],
                fetched_at=cache_zeile["fetched_at"],
                stale=False,
            )

    try:
        roh = rss_import.feed_holen(feed_url)
        items = _feed_zu_items(roh, limit=limit)
    except rss_import.RssImportFehler as exc:
        log.warning("rss_widget_abruf_fehlgeschlagen", feed_url=feed_url, fehler=str(exc))
        if cache_zeile and cache_zeile.get("items"):
            return RssFeedPreviewResponse(
                items=[RssFeedItem(**i) for i in cache_zeile["items"][:limit]],
                fetched_at=cache_zeile["fetched_at"],
                stale=True,
            )
        db.table("site_rss_widget_cache").upsert(
            {
                "feed_url_hash": schluessel,
                "feed_url": feed_url,
                "items": [],
                "fetched_at": datetime.now(UTC).isoformat(),
                "last_error": str(exc),
            },
            on_conflict="feed_url_hash",
        ).execute()
        return RssFeedPreviewResponse(items=[])

    jetzt = datetime.now(UTC).isoformat()
    db.table("site_rss_widget_cache").upsert(
        {
            "feed_url_hash": schluessel,
            "feed_url": feed_url,
            "items": [i.model_dump(mode="json") for i in items],
            "fetched_at": jetzt,
            "last_error": None,
        },
        on_conflict="feed_url_hash",
    ).execute()
    return RssFeedPreviewResponse(items=items, fetched_at=jetzt, stale=False)


def _parse_ts(value: str) -> datetime:
    v = value.replace("Z", "+00:00") if isinstance(value, str) else value
    parsed = datetime.fromisoformat(v)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
