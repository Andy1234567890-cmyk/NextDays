"""Geteilte, marken-neutrale Bewertungs-Helfer.

Zwei Slices arbeiten auf denselben Bewertungsdaten:
* ``guest_reviews`` — Gast-/Marktplatz-Seite (myBestDays): abgeben, ändern,
  öffentlich lesen.
* ``reviews`` — Betriebs-Cockpit (myNextDays): alle Kanäle vereint, antworten,
  Gast bewerten, Automatik.

Was beide brauchen, steht hier: Textsäuberung, Autor-Maskierung, die Spalten
von ``public.reviews`` und die Kategorie-Durchschnitte. Bewusst OHNE Pydantic-
Schemas — jeder Slice formt sein eigenes Antwortmodell daraus, sonst würde die
eine Seite die Antwortform der anderen mitbestimmen.
"""
from __future__ import annotations

import html
from datetime import date, datetime

import nh3

from src.core.supabase import fetch_all_rows

from .schemas import CategoryScore, ReviewScale

# Reservierungs-Status, der als „abgeschlossen" gilt (Nachweis echter Gast).
COMPLETED_STATUS = "completed"

# Airbnb double-blind: nach dieser Frist wird eine einseitige Bewertung auch
# ohne Gegenseite veröffentlicht.
DOUBLE_BLIND_DAYS = 14

# Kategorie-Sub-Score-Spalten in public.reviews (Booking-Modell, je 1..5).
SCORE_COLUMNS = (
    "score_cleanliness",
    "score_communication",
    "score_location",
    "score_value",
    "score_accuracy",
    "score_checkin",
)

# Feldname (API) → Spaltenname (DB) der 6 Kategorien.
SCORE_FIELDS: dict[str, str] = {
    "cleanliness": "score_cleanliness",
    "communication": "score_communication",
    "location": "score_location",
    "value": "score_value",
    "accuracy": "score_accuracy",
    "checkin": "score_checkin",
}

# Spalten für die eigene/Host-Sicht einer Bewertung (inkl. Sub-Scores).
# KI-Deutung (0501). Beide Slices lesen sie mit: die Marktplatzseite zeigt
# sie nicht an, aber sie soll sie nicht versehentlich beim Schreiben
# überbügeln, und der Nachlauf braucht `ki_bewertet_at`.
AI_COLUMNS = "ki_stimmung, ki_themen, ki_kernaussage, ki_bewertet_at"

REVIEW_COLUMNS = (
    "id, property_id, reservation_id, rating, text, host_reply, host_reply_at, "
    "published_at, created_at, updated_at, " + ", ".join(SCORE_COLUMNS)
    + ", " + AI_COLUMNS
)


def plaintext(value: str | None) -> str | None:
    """Bewertungstext zu Plaintext säubern (Wurzel 8): ALLE Tags entfernen.

    Ein Bewertungstext ist reiner Fließtext, kein Rich-Text — deshalb Allowlist =
    leer (nh3 strippt jedes Tag, behält den Textinhalt). Ergebnis wird öffentlich
    gerendert; roher Client-HTML darf niemals durchkommen. Gilt genauso für
    Inhalte aus Portal-Payloads (Input zweiter Ordnung). Leerer/whitespace-only
    Text → None (kein leerer String in der DB)."""
    if value is None:
        return None
    # nh3 gibt HTML zurück, auch bei leerer Allowlist: aus „Kaffee & Kuchen"
    # wird „Kaffee &amp; Kuchen". Das Ziel ist hier aber PLAINTEXT — der Wert
    # geht ins Textfeld zurück, in den KI-Prompt („Unterschrift unverändert")
    # und ans Portal. Deshalb die Entitäten wieder auflösen; Tags sind da
    # schon weg, also kann kein Markup zurückkommen.
    cleaned = html.unescape(nh3.clean(value, tags=set(), attributes={})).strip()
    return cleaned or None


def mask_author(name: str | None) -> str:
    """Anzeigename maskieren (Wurzel 9).

    Liefert den VORNAMEN (erstes Wort). Ist keiner vorhanden → „Gast". NIE der
    volle Name, NIE die E-Mail. Kein Rückschluss auf die Identität des Gasts."""
    first = (name or "").strip().split(" ", 1)[0].strip()
    return first or "Gast"


def as_dt(value: object) -> datetime | None:
    """Optionalen Timestamp aus der DB in datetime wandeln (None bleibt None)."""
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value))


def as_date(value: object) -> date | None:
    """Optionales Datum aus der DB (None bleibt None, kein Ersatzdatum)."""
    if value in (None, ""):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    return date.fromisoformat(str(value)[:10])


def scores_map(row: dict) -> dict[str, int | None]:
    """Die 6 Kategorie-Sub-Scores einer reviews-Zeile als Feldname→Wert."""
    return {field: row.get(col) for field, col in SCORE_FIELDS.items()}


def score_columns_payload(scores: dict[str, int | None]) -> dict[str, int | None]:
    """Feldname→Wert (API) → Spaltenname→Wert (DB)."""
    return {col: scores.get(field) for field, col in SCORE_FIELDS.items()}


def category_averages_map(rows: list[dict]) -> dict[str, float | None] | None:
    """Durchschnitt je Kategorie über die Zeilen mit gesetztem Sub-Score. None,
    wenn KEINE Zeile irgendeinen Sub-Score trägt (kein Fallback, Wurzel 4)."""
    out: dict[str, float | None] = {}
    any_set = False
    for field, col in SCORE_FIELDS.items():
        vals = [int(r[col]) for r in rows if r.get(col) is not None]
        if vals:
            any_set = True
            out[field] = round(sum(vals) / len(vals), 2)
        else:
            out[field] = None
    return out if any_set else None


def checked_out(check_out: object, today: date) -> bool:
    """True, wenn die Abreise vor heute liegt (Aufenthalt vorbei)."""
    parsed = as_date(check_out)
    return parsed is not None and parsed < today


# PostgREST-Deckel je Antwort (supabase/config.toml `max_rows`).
_PG_MAX_ROWS = 1000


def seite_laden(query: object, limit: int) -> tuple[list[dict], int]:
    """Bis zu `limit` Zeilen samt exaktem Gesamtzähler.

    PostgREST kappt JEDE Antwort bei 1000 Zeilen (config.toml max_rows), auch
    mit `.range()`. Der Export (bis 5000) und tiefe Seiten liefen deshalb still
    hinein: Datei kürzer als `total`, Seite 41 leer bei aktivem „Weiter". Über
    dem Deckel wird deshalb seitenweise geladen (`fetch_all_rows`) und erst
    danach geschnitten; der Zähler kommt aus dem ersten Aufruf."""
    seite = min(max(limit, 1), _PG_MAX_ROWS)
    erste = query.range(0, seite - 1).execute()  # type: ignore[attr-defined]
    rows = list(erste.data or [])
    total = erste.count if erste.count is not None else len(rows)
    if limit > _PG_MAX_ROWS and total > _PG_MAX_ROWS:
        rows = fetch_all_rows(query)[:limit]
    return rows, total


def score_5_from_ten(value: object) -> float | None:
    """Portal-Note (0..10) auf 5 Sterne normalisieren. None bleibt None."""
    if value is None:
        return None
    try:
        return round(float(value) / 2, 2)
    except (TypeError, ValueError):
        return None


def ota_categories(raw: object) -> list[CategoryScore]:
    """``scores``-Array einer Portal-Bewertung → Kategorien. Einträge ohne
    brauchbare Note werden verworfen, statt eine 0 zu erfinden (Wurzel 4)."""
    if not isinstance(raw, list):
        return []
    out: list[CategoryScore] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        key = entry.get("category")
        value = entry.get("score", entry.get("rating"))
        if not isinstance(key, str) or value is None:
            continue
        try:
            score = float(value)
        except (TypeError, ValueError):
            continue
        out.append(CategoryScore(key=key, score=score, scale=ReviewScale.ten))
    return out
