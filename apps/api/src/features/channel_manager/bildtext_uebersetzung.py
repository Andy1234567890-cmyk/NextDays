"""Airbnb-Bildtexte in die Sprache des Betriebs übersetzen.

WARUM DIESES MODUL EXISTIERT (gemessen 05.08.2026, Objekt 020):
Airbnb liefert die Bildtexte in EINER Sprache — bei diesem Konto Englisch
(`GET v2/listing_photos` → 200, 11473 B, 17 Fotos, jedes mit `caption`, z. B.
„Living-dining area with sofa bed 140x200 and open kitchen").

Unsere Spalte `property_photos.caption` ist mehrsprachig (`{locale: text}`), und
die Foto-Verwaltung liest GENAU EINE Sprache: `photo.caption[lang]`, wobei `lang`
die Oberflächensprache ist (`photos-manager.tsx`). Beim Import landeten alle 17
Texte unter `en` — die deutsche Oberfläche las `caption["de"]`, fand nichts und
zeigte den Platzhalter „z. B. Wohnzimmer mit Kamin". Die Daten WAREN da (17
Zeilen in der DB gemessen, alle mit englischem Text), nur nie in der gelesenen
Sprache.

Lodgify zeigt an derselben Stelle „Wohn-Essbereich mit Schlafsofa 140×200 und
offener Küche" — also den ÜBERSETZTEN Text. Live gegengeprüft mit demselben
Dienst, den wir für Inhalte schon nutzen (Google Cloud Translation v2,
`features/content/service.py`):

    POST translation.googleapis.com/language/translate/v2
         q=Living-dining area with sofa bed 140x200 and open kitchen
         source=en target=de
    → 200 „Wohn-Essbereich mit Schlafsofa (140 x 200 cm) und offener Küche"

Deshalb wird beim Import BEIDES gespeichert: das Original unter seiner Sprache
(nachvollziehbar, und es geht so an die Portale zurück) UND die Übersetzung unter
der Zielsprache. Ohne Schlüssel oder bei einem Fehler bleibt es beim Original —
ein Bildtext in der falschen Sprache ist besser als keiner, aber es wird NIE ein
Text erfunden (Wurzel 4).
"""
from __future__ import annotations

import httpx

from src.core.config import get_settings

from .common import log

TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2"

# Google nimmt bis zu 128 `q`-Werte je Anfrage. 17 Bildtexte gehen also in EINEM
# Aufruf raus — je Text einzeln zu fragen wäre 17-mal Latenz und 17-mal Quote.
_MAX_BATCH = 100

_TIMEOUT = httpx.Timeout(30.0)


def _abfragen(
    schluessel: str, texte: list[str], quelle: str, ziel: str
) -> dict | None:
    """Der eine HTTP-Aufruf. None = keine verwertbare Antwort."""
    # `q` mehrfach: httpx erwartet dafür einen LISTEN-Wert im dict, keine Liste
    # von Tupeln (die wirft `TypeError: expected a bytes-like object, tuple
    # found` erst beim Senden — live so passiert).
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            antwort = client.post(
                TRANSLATE_URL,
                params={"key": schluessel},
                data={
                    "q": texte,
                    "source": quelle,
                    "target": ziel,
                    "format": "text",
                },
            )
    except httpx.HTTPError as exc:
        log.warning("bildtext_uebersetzung_netzfehler", error=str(exc)[:200])
        return None
    if antwort.status_code != 200:
        log.warning(
            "bildtext_uebersetzung_kein_200",
            status=antwort.status_code, body=antwort.text[:200],
        )
        return None
    try:
        return antwort.json()
    except ValueError:
        log.warning("bildtext_uebersetzung_kein_json")
        return None


def bildtexte_uebersetzen(
    texte: list[str], *, quelle: str, ziel: str
) -> list[str] | None:
    """Alle Bildtexte in EINEM Aufruf übersetzen. None = nicht verfügbar.

    Die Reihenfolge der Antwort entspricht der Anfrage (Google-Doku und live
    geprüft) — deshalb passt Index zu Index. Kommt eine andere Anzahl zurück,
    ist die Zuordnung nicht mehr sicher und es gibt lieber KEINE Übersetzung als
    einen Text am falschen Bild (Wurzel 4/5).
    """
    if not texte or quelle == ziel:
        return None
    schluessel = get_settings().google_translate_api_key.get_secret_value()
    if not schluessel:
        log.info("bildtext_uebersetzung_kein_schluessel")
        return None
    if len(texte) > _MAX_BATCH:
        # Kein stilles Kappen: der Aufrufer erfährt, dass nichts übersetzt wurde.
        log.warning("bildtext_uebersetzung_zu_viele", anzahl=len(texte))
        return None

    daten = _abfragen(schluessel, texte, quelle, ziel)
    if daten is None:
        return None

    treffer = ((daten.get("data") or {}).get("translations")) or []
    if len(treffer) != len(texte):
        log.warning(
            "bildtext_uebersetzung_anzahl_abweichend",
            gesendet=len(texte), erhalten=len(treffer),
        )
        return None
    return [str((t or {}).get("translatedText") or "") for t in treffer]


def caption_mehrsprachig(
    original: str, uebersetzt: str | None, *, quelle: str, ziel: str
) -> dict[str, str]:
    """`{"en": Original, "de": Übersetzung}` — leere Werte fallen weg.

    Das Original bleibt IMMER erhalten: es ist der Stand bei Airbnb und geht so
    auch wieder an die Portale. Die Übersetzung kommt dazu, damit die Oberfläche
    in ihrer Sprache etwas findet.
    """
    caption: dict[str, str] = {}
    if original.strip():
        caption[quelle] = original.strip()
    if uebersetzt and uebersetzt.strip() and ziel != quelle:
        caption[ziel] = uebersetzt.strip()
    return caption
