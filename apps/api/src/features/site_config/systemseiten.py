"""Systemseiten — die Seiten, die der Renderer ausliefert, ohne dass sie jemand
angelegt hat (0466).

DER BEFUND
==========
Der Renderer bedient seit jeher Routen, die im Baukasten nicht vorkamen:
``/inserat/<id>`` (die Objekt-Karten verlinken dorthin), ``/checkout/<id>``,
``/checkout/abgeschlossen`` und ``/blog``. In ``site_pages`` stand davon nichts;
live gemessen am 25.08.2026 enthielt die Tabelle ausschließlich ``normal``.

Die Seitenliste behauptete damit, eine Website habe vier Seiten, während sie die
komplette Buchungsstrecke auslieferte — ohne SEO-Titel, ohne Beschreibung, ohne
``noindex``, und ohne dass der Betrieb überhaupt erfuhr, dass es sie gibt. Wer
den Objekt-Abschnitt auf seine Startseite setzt, veröffentlicht damit
stillschweigend drei weitere Seiten.

WAS EINE SYSTEMSEITE IST — UND WAS NICHT
========================================
Sie ist eine Zeile in ``site_pages`` wie jede andere und nutzt deren SEO-Felder
mit (warum kein zweiter Ort: siehe 0466). Sie unterscheidet sich in dem, was man
mit ihr tun darf:

* Sie wird nie angelegt und nie gelöscht. Sie EXISTIERT, weil es die Route gibt.
* Ihr Slug ist das Muster der Route und nicht änderbar.
* Sie hat keine Blöcke. Ihr Inhalt ist die Anwendung selbst — ein Objekt, eine
  Buchung, eine Bestätigung.
* Sie steht in keiner Navigation: Ein Menüpunkt „Buchung" ohne gewähltes Objekt
  führt ins Leere.

WARUM SIE NICHT PER MIGRATION EINGESÄT WERDEN
=============================================
Eine Migration hätte sie für die heutigen Betriebe angelegt — und für jeden
morgen angelegten nicht. Der Server stellt sie stattdessen beim Lesen der
Seitenliste sicher (:func:`sicherstellen`). Das ist idempotent über den
``system_key``; der eindeutige Index aus 0466 ist der Backstop, falls zwei
Aufrufe gleichzeitig durchlaufen (Wurzel 2).
"""

from __future__ import annotations

from dataclasses import dataclass

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.site_config.systemseiten")


@dataclass(frozen=True)
class Systemseite:
    """Eine Route des Renderers, die als Seite geführt wird."""

    key: str
    """Stabile Kennung. Sie steht in ``system_key`` und ist der Ort, an dem der
    Server die Zeile wiederfindet — nicht der Slug, denn der ist ein Muster."""

    slug: str
    """Das Routen-MUSTER, wie es in der Adresse steht. ``[id]`` bleibt als
    Platzhalter stehen: die Seite ist nicht EINE Adresse, sondern eine Familie
    von Adressen, eine je Objekt bzw. je Buchung."""

    titel_schluessel: str
    """Schlüssel im Übersetzungskatalog des Dashboards. Der Titel wird NICHT
    hier auf Deutsch festgeschrieben — er erscheint in der Seitenliste und muss
    in der Sprache des Betriebs stehen (Wurzel 4: kein hartkodierter Text an
    einer Stelle, die 24 Sprachen bedient)."""

    in_sitemap: bool
    """Gehört die Route in die Sitemap? Für ``/inserat`` ja — die einzelnen
    Objekt-Adressen stehen dort bereits. Für Buchung und Bestätigung nein: sie
    sind ohne Kontext leer und ohne Buchung nicht erreichbar."""


#: Die Systemseiten in der Reihenfolge, in der sie in der Liste erscheinen —
#: dem Weg des Gastes folgend: buchen, dann die Bestätigung. Der Blog steht
#: danach, weil er ein eigener Bereich ist.
#:
#: Die OBJEKT-DETAILSEITE steht hier NICHT mehr (0468). Sie ist keine starre
#: Seite, sondern eine dynamische: ein Master-Layout, das je Objekt mit
#: Live-Daten gefüllt wird — siehe `dynamische_seiten.py`. Sie war anfangs hier
#: geführt, und das war der Fehler: eine Systemseite kann man nicht gestalten,
#: eine dynamische ist genau dafür da.
#:
#: Der Blog erscheint hier auch dann, wenn noch kein Beitrag existiert. Das ist
#: Absicht: die Route antwortet ohnehin, und eine leere Blog-Seite, die man
#: nicht findet, ist schlechter als eine, die man auf `noindex` stellen kann.
SYSTEMSEITEN: tuple[Systemseite, ...] = (
    Systemseite(
        key="checkout",
        slug="checkout/[id]",
        titel_schluessel="systemseiten.checkout",
        in_sitemap=False,
    ),
    Systemseite(
        key="checkout_abgeschlossen",
        slug="checkout/abgeschlossen",
        titel_schluessel="systemseiten.checkoutAbgeschlossen",
        in_sitemap=False,
    ),
    Systemseite(
        key="blog",
        slug="blog",
        titel_schluessel="systemseiten.blog",
        in_sitemap=True,
    ),
)

_NACH_KEY = {s.key: s for s in SYSTEMSEITEN}


def ist_systemseite(row: dict) -> bool:
    """Ist diese Zeile eine Systemseite?"""
    return row.get("page_type") == "system"


def finde(key: str) -> Systemseite | None:
    """Die Beschreibung zu einer Kennung, oder ``None``.

    ``None`` ist ein echter Fall und kein Fehler: eine Zeile kann eine Kennung
    tragen, die eine spätere Fassung nicht mehr kennt (eine Route wurde
    entfernt). Sie wird dann weiterhin gelistet — mit ihren SEO-Angaben, damit
    nichts still verschwindet —, aber nicht mehr als bekannte Route behandelt.
    """
    return _NACH_KEY.get(key)


def sicherstellen(db: Client, tenant_id: str) -> None:
    """Fehlende Systemseiten dieses Betriebs anlegen.

    Wird beim Lesen der Seitenliste gerufen. Idempotent über den ``system_key``;
    der eindeutige Index aus 0466 ist der Backstop, falls zwei Aufrufe
    gleichzeitig durchlaufen (Wurzel 2).

    EINZELN eingefügt und nicht als Stapel. Ein Stapel ist alles-oder-nichts:
    kollidiert EINE Zeile, entsteht keine einzige. Genau das kann passieren —
    siehe unten.

    Ein Fehlschlag darf die Seitenliste NICHT kippen: der Betrieb sähe sonst
    seine eigenen Seiten nicht mehr, weil eine Systemseite fehlt.
    """
    vorhanden = {
        r["system_key"]
        for r in (
            db.table("site_pages")
            .select("system_key")
            .eq("tenant_id", tenant_id)
            .eq("page_type", "system")
            .execute()
        ).data
        or []
        if r.get("system_key")
    }
    for seite in SYSTEMSEITEN:
        if seite.key in vorhanden:
            continue
        try:
            db.table("site_pages").insert(_zeile(tenant_id, seite)).execute()
        except APIError as exc:
            if getattr(exc, "code", None) != "23505":
                raise
            _kollision_melden(tenant_id, seite, exc)


def _zeile(tenant_id: str, seite: Systemseite) -> dict:
    """Die einzufügende Zeile einer Systemseite."""
    return {
        "tenant_id": tenant_id,
        "page_type": "system",
        "system_key": seite.key,
        "slug": seite.slug,
        # Der Titel bleibt LEER. Die Anzeige übersetzt ihn über
        # `titel_schluessel`; ein hier eingetragener deutscher Text stünde
        # sonst in allen 24 Sprachen (Wurzel 4).
        "title": "",
        # Sie sind da, sobald es die Route gibt — es gibt nichts zu
        # veröffentlichen und nichts zurückzuhalten.
        "is_published": True,
        "is_home": False,
        # In keiner Navigation, siehe Modul-Kopf.
        "nav_area": "none",
    }


def _kollision_melden(
    tenant_id: str, seite: Systemseite, exc: APIError
) -> None:
    """Einen 23505 einordnen — und den gefährlichen Fall LAUT melden.

    Zwei verschiedene Dinge lösen hier denselben Fehlercode aus, und sie
    bedeuten das Gegenteil voneinander:

    * ``site_pages_system_key_uniq`` — zwei Aufrufe liefen gleichzeitig, der
      andere war schneller. Das gewünschte Ergebnis; nichts zu tun.

    * ``site_pages_tenant_slug_key`` — der Betrieb hat bereits eine EIGENE Seite
      unter diesem Slug. Das betrifft realistisch nur ``blog``: legt jemand eine
      normale Seite mit diesem Slug an, ist sie schon heute unerreichbar, weil
      die feste Route des Renderers gewinnt. Die Systemseite entsteht dann
      nicht — und das darf NICHT stillschweigend passieren. Ein
      Konfigurationsproblem, dessen Fehlen still bleibt, ist derselbe Fehler wie
      ein verschluckter Exception (Wurzel 5): niemand sucht danach, weil nichts
      danach aussieht.
    """
    text = str(exc)
    if "system_key" in text:
        return
    log.warning(
        "systemseite_slug_kollision",
        tenant_id=tenant_id,
        system_key=seite.key,
        slug=seite.slug,
        hinweis=(
            "Eine eigene Seite belegt diesen Slug. Sie ist bereits heute "
            "unerreichbar, weil die feste Route des Renderers gewinnt — die "
            "Systemseite konnte deshalb nicht angelegt werden."
        ),
    )
