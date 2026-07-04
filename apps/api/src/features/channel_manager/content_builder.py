"""Reiner Content-Builder für den Channex-Push (keine DB, kein HTTP-Client).

Baut die Channex-`content`-Objekte für Property und Room-Type aus bereits
geladenen Zeilen. Bewusst nebenwirkungsfrei und unit-testbar — die dünnen
Aufruf-Stellen in `service.py` reichen nur Zeilen herein und nehmen Dicts heraus,
damit der 2.9k-LOC-Service nicht weiter wächst.

Grundsätze (Projektkonventionen):
- Keine erfundenen Werte/Fallbacks: leere Felder werden WEGGELASSEN, nicht mit
  Platzhaltern gefüllt.
- Mehrsprachig nach Objekt-Land: `caption`/Hausregeln werden in der zum Land
  passenden Sprachreihenfolge ausgewählt (DE-Objekt → Deutsch zuerst, dann EN).
- Channex verteilt EINE Beschreibung uniform an alle OTAs (kein Text pro Kanal).
"""
from __future__ import annotations

from typing import Any

# Hauptsprache je Land (DACH + EU). Reihenfolge: Landessprache zuerst, dann als
# Zweitsprache Englisch (von Channex/OTAs breit verstanden). Unbekannt → ["en"].
# Spiegelt die Mehrsprachen-Ausrichtung (27 EU-Länder), ohne € o.ä. zu erfinden.
_PRIMARY_LANG_BY_COUNTRY: dict[str, str] = {
    "DE": "de", "AT": "de", "CH": "de", "LI": "de",
    "GB": "en", "IE": "en", "MT": "en", "US": "en",
    "DK": "da", "FR": "fr", "IT": "it", "ES": "es", "PT": "pt",
    "NL": "nl", "BE": "nl", "PL": "pl", "CZ": "cs", "SE": "sv",
    "NO": "no", "FI": "fi", "GR": "el", "HU": "hu", "RO": "ro",
    "HR": "hr", "BG": "bg", "SK": "sk", "SI": "sl", "EE": "et",
    "LV": "lv", "LT": "lt", "LU": "fr", "CY": "el",
}


def locale_order_for_country(country: str | None) -> list[str]:
    """Sprachreihenfolge für Channex-Content nach Objekt-Land.

    Landessprache zuerst, dann Englisch als Zweit-Quelle (dedupliziert). Ohne
    bekanntes Land bleibt nur Englisch — es wird KEINE Sprache erfunden."""
    primary = _PRIMARY_LANG_BY_COUNTRY.get((country or "").upper())
    order = [lang for lang in (primary, "en") if lang]
    # Reihenfolge erhalten, Duplikate entfernen (primary == "en").
    seen: set[str] = set()
    return [x for x in order if not (x in seen or seen.add(x))]


def _text_in_order(value: object, locale_order: list[str]) -> str | None:
    """Ersten nicht-leeren Text aus einer (mehrsprachigen) Quelle wählen.

    - String → direkt (sofern nicht leer).
    - Dict (LocalizedText/caption) → erste nicht-leere Sprache aus locale_order,
      danach irgendeine nicht-leere Sprache als letzte Rückfallebene.
    - sonst → None (kein erfundener Text)."""
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, dict):
        for lang in locale_order:
            text = value.get(lang)
            if isinstance(text, str) and text.strip():
                return text.strip()
        for text in value.values():
            if isinstance(text, str) and text.strip():
                return text.strip()
    return None


def _photos(photos_rows: list[dict[str, Any]], locale_order: list[str]) -> list[dict[str, Any]]:
    """property_photos-Zeilen → Channex-Foto-Objekte.

    Cover (`is_cover`) zuerst (position 0), danach nach `sort_order`. `description`
    aus der mehrsprachigen `caption` (weggelassen, wenn leer). `author` = Urheber
    (weggelassen, wenn leer). `kind` = "photo"."""
    if not photos_rows:
        return []
    ordered = sorted(
        photos_rows,
        key=lambda r: (not r.get("is_cover"), int(r.get("sort_order") or 0)),
    )
    out: list[dict[str, Any]] = []
    for position, row in enumerate(ordered):
        url = row.get("url")
        if not url:
            continue
        photo: dict[str, Any] = {"url": url, "position": position, "kind": "photo"}
        caption = _text_in_order(row.get("caption"), locale_order)
        if caption:
            photo["description"] = caption
        author = row.get("author")
        if author and str(author).strip():
            photo["author"] = str(author).strip()
        out.append(photo)
    return out


def _important_information(prop_row: dict[str, Any], locale_order: list[str]) -> str | None:
    """Wichtige Infos (property-only): Check-in/out-Zeiten + Hausregeln aus
    `type_attributes.policies`. Nur vorhandene Teile werden aufgenommen — fehlt
    alles, wird das Feld weggelassen (kein Platzhalter)."""
    policies = (prop_row.get("type_attributes") or {}).get("policies") or {}
    parts: list[str] = []

    check_in = policies.get("checkInTime")
    check_out = policies.get("checkOutTime")
    if check_in and check_out:
        parts.append(f"Check-in ab {check_in}, Check-out bis {check_out}.")
    elif check_in:
        parts.append(f"Check-in ab {check_in}.")
    elif check_out:
        parts.append(f"Check-out bis {check_out}.")

    # Hausregeln/Mietvertrag (mehrsprachig) und Storno (Freitext).
    rules = _text_in_order(policies.get("rentalAgreement"), locale_order)
    if rules:
        parts.append(rules)
    cancellation = _text_in_order(policies.get("cancellation"), locale_order)
    if cancellation:
        parts.append(cancellation)

    return "\n\n".join(parts) or None


def build_property_content(
    prop_row: dict[str, Any],
    photos_rows: list[dict[str, Any]],
    *,
    locale_order: list[str],
) -> dict[str, Any]:
    """Channex-Property-`content`: {description?, important_information?, photos[]}.

    Leere Felder werden weggelassen. `description` bleibt der kanonische (OTA-)
    Text aus `properties.description` — NICHT der Eigenplattform-Text."""
    content: dict[str, Any] = {}
    desc = _text_in_order(prop_row.get("description"), locale_order)
    if desc:
        content["description"] = desc
    info = _important_information(prop_row, locale_order)
    if info:
        content["important_information"] = info
    photos = _photos(photos_rows, locale_order)
    if photos:
        content["photos"] = photos
    return content


def build_room_type_content(
    prop_row: dict[str, Any],
    photos_rows: list[dict[str, Any]],
    *,
    locale_order: list[str],
) -> dict[str, Any]:
    """Channex-Room-Type-`content`: {description?, photos[]}.

    KEIN `important_information` (das gibt es bei Channex nur auf Property-Ebene).
    Beim synthetischen 1-Zimmer-Modell teilt der Room-Type Beschreibung/Fotos der
    Property — leere Felder werden weggelassen."""
    content: dict[str, Any] = {}
    desc = _text_in_order(prop_row.get("description"), locale_order)
    if desc:
        content["description"] = desc
    photos = _photos(photos_rows, locale_order)
    if photos:
        content["photos"] = photos
    return content
