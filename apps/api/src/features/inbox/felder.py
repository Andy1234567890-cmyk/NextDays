"""Platzhalter (Felder) für Vorlagen, Automationen und geplante Nachrichten.

Ohne Platzhalter kann eine Automation nur Sätze verschicken, die für jeden Gast
gleich lauten — der Automations-Tab war damit praktisch unbenutzbar. Hier steht
der Katalog, der Ersetzer und die Prüfung.

Schreibweise: ``{{guest_name}}``. Die Schlüssel sind bewusst ENGLISCH und
sprachneutral: der Text der Vorlage schreibt der Betrieb in seiner Sprache, der
Schlüssel darin muss aber stabil bleiben — sonst wäre eine Vorlage nach einem
Sprachwechsel der Oberfläche kaputt. Übersetzt wird nur das Etikett im Picker
(Frontend, ``inbox.field_*``).

Zwei Regeln, die das Verhalten bestimmen:

1. **Ersetzt wird beim SENDEN, nicht beim Planen.** Eine Automation für den
   Anreisetag wird Tage vorher geplant; der Türcode entsteht oft erst kurz
   davor. Würde beim Planen ersetzt, stünde im Text für immer der Stand von
   damals. Deshalb liegt im Zeitplan der Rohtext, und erst der Versand löst auf.

2. **Fehlt der Wert eines BENUTZTEN Feldes, wird nicht gesendet** (Wurzel 4).
   „Hallo ," ist kein akzeptabler Ersatz für „Hallo Frau Meier,". Der Versand
   schlägt mit :class:`FeldFehlt` fehl und nennt die betroffenen Felder; der
   Grund landet sichtbar an der geplanten Nachricht (``last_error``), statt
   still eine kaputte Nachricht an einen Gast zu schicken.
"""
from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation

# {{ feld }} — Leerzeichen innen erlaubt, damit ein aus der UI eingefügtes Feld
# auch nach manuellem Nachtippen noch greift.
MUSTER = re.compile(r"\{\{\s*([a-z0-9_]+)\s*\}\}")


class FeldFehlt(Exception):
    """Ein im Text benutztes Feld hat für diesen Vorgang keinen Wert."""

    def __init__(self, felder: list[str]) -> None:
        self.felder = felder
        super().__init__(
            "Diese Felder haben für diese Reservierung keinen Wert: "
            + ", ".join(sorted(felder))
        )


@dataclass(frozen=True)
class Feld:
    schluessel: str
    gruppe: str  # guest | reservation | property | company
    aufloesen: Callable[[Kontext], object]


@dataclass
class Kontext:
    """Alle Daten, aus denen sich Felder speisen. Rohwerte, kein Formatieren —
    das übernimmt der jeweilige Resolver."""

    guest_name: str | None = None
    guest_email: str | None = None
    guest_phone: str | None = None
    guest_language: str | None = None
    check_in: str | None = None
    check_out: str | None = None
    checkin_time: str | None = None
    checkout_time: str | None = None
    adults: int | None = None
    children: int | None = None
    reservation_code: str | None = None
    channel: str | None = None
    total_amount: object = None  # Cent (int) oder Betrag (float/Decimal)
    currency: str | None = None
    property_name: str | None = None
    property_address: str | None = None
    property_city: str | None = None
    door_code: str | None = None
    company_name: str | None = None


def _text(wert: object) -> str | None:
    """Rohwert → getrimmter Text, leer wird zu None (= „kein Wert")."""
    if wert is None:
        return None
    s = str(wert).strip()
    return s or None


def _vorname(k: Kontext) -> str | None:
    ganz = _text(k.guest_name)
    return ganz.split()[0] if ganz else None


def _datum(roh: str | None) -> str | None:
    """ISO-Datum → TT.MM.JJJJ. Kein Locale-Rateversuch: das Zielformat hängt an
    der Sprache des Gastes, die wir hier nicht zuverlässig kennen. Das ISO-Datum
    unverändert stehen zu lassen wäre für einen Gast schlechter lesbar."""
    s = str(roh).strip() if roh is not None else ""
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10]).strftime("%d.%m.%Y")
    except ValueError:
        return s


def _naechte(k: Kontext) -> int | None:
    if not (k.check_in and k.check_out):
        return None
    try:
        a = date.fromisoformat(str(k.check_in)[:10])
        b = date.fromisoformat(str(k.check_out)[:10])
    except ValueError:
        return None
    return (b - a).days or None


def _gaeste(k: Kontext) -> int | None:
    summe = (k.adults or 0) + (k.children or 0)
    return summe or None


def _betrag(k: Kontext) -> str | None:
    """Betrag mit zwei Nachkommastellen. Ohne Währungszeichen — dafür gibt es
    ``{{currency}}``; ein hier hartkodiertes € wäre in 26 der 27 EU-Länder
    falsch (Wurzel 4)."""
    roh = k.total_amount
    if roh is None:
        return None
    try:
        wert = Decimal(str(roh))
    except (InvalidOperation, ValueError):
        return None
    return f"{wert:.2f}".replace(".", ",")


FELDER: tuple[Feld, ...] = (
    Feld("guest_name", "guest", lambda k: _text(k.guest_name)),
    Feld("guest_first_name", "guest", _vorname),
    Feld("guest_email", "guest", lambda k: _text(k.guest_email)),
    Feld("guest_phone", "guest", lambda k: _text(k.guest_phone)),
    Feld("guest_language", "guest", lambda k: _text(k.guest_language)),
    Feld("check_in", "reservation", lambda k: _datum(k.check_in)),
    Feld("check_out", "reservation", lambda k: _datum(k.check_out)),
    Feld("checkin_time", "reservation", lambda k: _text(k.checkin_time)),
    Feld("checkout_time", "reservation", lambda k: _text(k.checkout_time)),
    Feld("nights", "reservation", _naechte),
    Feld("guests", "reservation", _gaeste),
    Feld("adults", "reservation", lambda k: k.adults or None),
    Feld("children", "reservation", lambda k: k.children),
    Feld("reservation_code", "reservation", lambda k: _text(k.reservation_code)),
    Feld("channel", "reservation", lambda k: _text(k.channel)),
    Feld("total_amount", "reservation", _betrag),
    Feld("currency", "reservation", lambda k: _text(k.currency)),
    Feld("property_name", "property", lambda k: _text(k.property_name)),
    Feld("property_address", "property", lambda k: _text(k.property_address)),
    Feld("property_city", "property", lambda k: _text(k.property_city)),
    Feld("door_code", "property", lambda k: _text(k.door_code)),
    Feld("company_name", "company", lambda k: _text(k.company_name)),
)

NACH_SCHLUESSEL: dict[str, Feld] = {f.schluessel: f for f in FELDER}

# `children` darf legitim 0 sein („0 Kinder" ist eine Aussage, kein fehlender
# Wert) — anders als die übrigen Felder, bei denen leer = Datenfehler ist.
_NULL_IST_GUELTIG = frozenset({"children"})


def benutzte_felder(text: str) -> list[str]:
    """Alle Feldschlüssel, die im Text vorkommen (Reihenfolge, ohne Dubletten)."""
    gesehen: list[str] = []
    for treffer in MUSTER.findall(text or ""):
        if treffer not in gesehen:
            gesehen.append(treffer)
    return gesehen


def unbekannte_felder(text: str) -> list[str]:
    """Benutzte Schlüssel, die es im Katalog nicht gibt. Beim Speichern einer
    Vorlage/Automation ein 422 wert: ein Tippfehler soll auffallen, solange der
    Autor davorsitzt — nicht Wochen später beim Versand an einen Gast."""
    return [f for f in benutzte_felder(text) if f not in NACH_SCHLUESSEL]


def rendern(text: str, kontext: Kontext) -> str:
    """Platzhalter ersetzen. Wirft :class:`FeldFehlt`, wenn ein benutztes Feld
    für diesen Vorgang keinen Wert hat.

    Ein Schlüssel, den der Katalog nicht kennt, bleibt unverändert stehen statt
    zu werfen: beim Speichern ist er bereits abgewiesen worden, und eine von
    Hand getippte Nachricht, die zufällig `{{...}}` enthält, soll nicht am
    Versand scheitern.
    """
    fehlt: list[str] = []
    werte: dict[str, str] = {}
    for schluessel in benutzte_felder(text):
        feld = NACH_SCHLUESSEL.get(schluessel)
        if feld is None:
            continue
        wert = feld.aufloesen(kontext)
        if wert is None and schluessel not in _NULL_IST_GUELTIG:
            fehlt.append(schluessel)
            continue
        werte[schluessel] = str(wert if wert is not None else 0)
    if fehlt:
        raise FeldFehlt(fehlt)
    return MUSTER.sub(lambda m: werte.get(m.group(1), m.group(0)), text)
