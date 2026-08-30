"""KI-Deutung der Bewertungstexte — Stimmung, Themen, Kernaussage.

Was das Modul beantwortet: **warum** ein Objekt schwach bewertet wird. Die
Note allein sagt das nicht. Das Dashboard sortierte bisher das schlechteste
Objekt nach vorn und schwieg zur Ursache — genau die Frage, die der Betrieb
hat, wenn er auf die Zahl schaut.

Drei Entwurfsentscheidungen, die das ganze Modul tragen:

**1. Einmal beim Eingang, nicht bei jeder Ansicht.** Ein Bewertungstext ändert
sich nach dem Eingang nie mehr. Ihn bei jedem Seitenaufruf erneut durch Gemini
zu schicken hieße, bei 400 Bewertungen und zehn Aufrufen am Tag 4 000 Anfragen
für ein Ergebnis zu bezahlen, das feststeht. Die Deutung wird deshalb
gespeichert (0501) und der Nachlauf holt nur, was noch keine hat.

**2. Ein geschlossener Themen-Katalog.** Freie Themen sind nicht vergleichbar:
schreibt das Modell einmal „Lärm", einmal „Lärmbelästigung", einmal „laute
Nachbarn", zählt jede Rangliste drei verschiedene Dinge. Der Katalog steht im
Prompt UND als CHECK in der Datenbank; ein erfundenes Thema wird beim
Schreiben abgewiesen, nicht Wochen später beim Auswerten bemerkt.

**3. Die Stimmung ist NICHT die Note.** Ein Gast kann fünf Sterne geben und im
Text meckern — und genau dieser Fall ist der interessante, weil er in keiner
Statistik auftaucht. Deshalb wird der Text gedeutet und nicht die Zahl
umetikettiert.

Was das Modul NICHT tut: es antwortet nicht. Ein Antwortvorschlag auf eine
Bewertung ist eine eigene Sache mit eigener Freigabe — eine Bewertungsantwort
lässt sich bei keinem Portal zurücknehmen, und was unwiderruflich ist, geht
nie von selbst raus.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from supabase import Client

from src.core.ki import KiAntwort, KiError, VertexClient
from src.core.logging import get_logger

from .common import plaintext

log = get_logger("nextdays.reviews.ki")

# Der geschlossene Katalog. MUSS deckungsgleich sein mit der Domain
# `public.ki_bewertungsthema` und der Funktion `ki_themen_gueltig` (0501) —
# schreibt das Modell ein Thema, das hier steht und dort nicht, wirft die
# Datenbank beim Speichern, und die Auswertung fehlt still für diese eine
# Bewertung. Ein achtes Thema wird an BEIDEN Stellen ergänzt.
THEMEN: dict[str, str] = {
    "sauberkeit": "Sauberkeit, Hygiene, Zustand bei Ankunft",
    "lage": "Lage, Umgebung, Anbindung, Aussicht",
    "ausstattung": "Ausstattung, Möblierung, Geräte, WLAN, Größe",
    "kommunikation": "Erreichbarkeit und Umgang des Gastgebers",
    "anreise": "Schlüsselübergabe, Check-in, Check-out, Auffindbarkeit",
    "laerm": "Lärm jeder Art — Straße, Nachbarn, Technik, Hellhörigkeit",
    "preis": "Preis-Leistung, Nebenkosten, unerwartete Gebühren",
}

STIMMUNGEN = ("positiv", "neutral", "negativ")

# Kürzer als bei einer Gastantwort: es kommt ein kleines JSON zurück, kein
# Fließtext. Wer hier großzügig deckelt, bezahlt Tokens für Geschwätz.
_MAX_TOKENS_DEUTUNG = 400
_MAX_TOKENS_BILANZ = 900

# Ein Bewertungstext, der länger ist, ist keiner mehr — das ist dann ein
# eingefügter Roman oder ein Angriff (Wurzel 8: jeder unbegrenzte Bereich
# bekommt eine Obergrenze). Gekürzt statt abgewiesen, weil eine echte lange
# Bewertung nicht die Auswertung des ganzen Objekts kippen soll.
MAX_TEXT_ZEICHEN = 4_000

# Wie viele Bewertungen höchstens in EINE Bilanz eingehen. Bei mehr wird die
# Zusammenfassung nicht besser, nur teurer.
MAX_BILANZ_BEWERTUNGEN = 60

# UND ein Zeichen-Deckel, denn die Anzahl allein reicht nicht: 60 Bewertungen
# à 4 000 Zeichen wären 240 000 Zeichen gegen den Prompt-Deckel des Clients von
# 24 000. Der würde zwar 422 werfen (also laut scheitern, Wurzel 5) — aber die
# Meldung hieße „Kontext zu groß" und der Betrieb stünde vor einer Funktion,
# die bei seinem BESTEN Objekt nicht geht, ohne zu erfahren, warum. Besser eine
# bewusste Auswahl der neuesten Bewertungen als ein Fehler an der Grenze.
MAX_BILANZ_ZEICHEN = 18_000

_SYSTEM_DEUTUNG = (
    "Du wertest Gästebewertungen für ein Unterkunfts-Verwaltungssystem aus. "
    "Du antwortest AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Vorrede, ohne "
    "Code-Zaun, ohne Erklärung.\n\n"
    "Form:\n"
    '{"stimmung": "positiv|neutral|negativ", '
    '"themen": [{"thema": "<aus der Liste>", '
    '"richtung": "positiv|neutral|negativ"}], '
    '"kernaussage": "<ein Satz>"}\n\n'
    "Regeln:\n"
    "- 'themen' enthält NUR Themen aus der vorgegebenen Liste. Erfinde keines. "
    "Passt nichts, gib eine leere Liste zurück.\n"
    "- Jedes Thema höchstens einmal.\n"
    "- 'richtung' ist die Bewertung DIESES Themas, nicht der Gesamteindruck: "
    "ein Text kann die Lage loben und die Sauberkeit rügen.\n"
    "- 'stimmung' ist der Gesamteindruck des TEXTES. Sie kann von der "
    "Sternenote abweichen — wenn ja, richte dich nach dem Text.\n"
    "- 'kernaussage' ist EIN kurzer Satz in der Sprache des Textes, der den "
    "Kern wiedergibt. Keine Wertung von dir, keine Empfehlung.\n"
    "- Erfinde nichts, was nicht im Text steht. Steht dort nichts Deutbares, "
    "gib stimmung 'neutral', leere Themen und eine leere Kernaussage."
)

_SYSTEM_BILANZ = (
    "Du fasst für einen Gastgeber zusammen, was Gäste an einer Unterkunft "
    "wiederholt loben und bemängeln. Du antwortest AUSSCHLIESSLICH mit einem "
    "JSON-Objekt, ohne Vorrede, ohne Code-Zaun.\n\n"
    "Form:\n"
    '{"staerken": ["<Satz>"], "schwaechen": ["<Satz>"], '
    '"empfehlungen": ["<Satz>"], "zusammenfassung": "<zwei bis drei Sätze>"}\n\n'
    "Regeln:\n"
    "- Nur was in MEHREREN Bewertungen vorkommt. Ein Einzelfall ist kein "
    "Muster; lass ihn weg.\n"
    "- Höchstens vier Einträge je Liste, nach Häufigkeit geordnet.\n"
    "- 'empfehlungen' sind konkrete Handlungen des Gastgebers, keine "
    "Allgemeinplätze. 'Kommunikation verbessern' ist wertlos; 'die "
    "Schlüsselübergabe erklären, sie wird in vier Bewertungen als unklar "
    "beschrieben' ist brauchbar.\n"
    "- Nenne bei Schwächen, wie oft das Thema auftauchte.\n"
    "- Erfinde nichts. Reichen die Bewertungen für eine Aussage nicht aus, "
    "gib leere Listen und sag das in der Zusammenfassung.\n"
    "- Antworte auf Deutsch."
)


class KiDeutungFehler(Exception):
    """Das Modell hat etwas geliefert, das keine Deutung ist.

    Eigener Typ und nicht ``KiError``: der Unterschied zwischen „Vertex war
    nicht erreichbar" und „Vertex hat geantwortet, aber Unsinn" bestimmt, ob
    ein Wiederholungsversuch Sinn hat. Beim ersten ja, beim zweiten nicht.
    """


@dataclass(frozen=True)
class Deutung:
    """Das Ergebnis für EINE Bewertung — genau die vier Spalten aus 0501."""

    stimmung: str
    themen: list[dict[str, str]]
    kernaussage: str | None
    # Die ganze Modellantwort, nicht nur die Tokenzahlen: `ki_nutzung.buchen`
    # will Modell und Region mit protokollieren, und ohne sie liesse sich
    # später nicht sagen, welches Modell die Deutung erzeugt hat.
    antwort: KiAntwort

    def als_spalten(self) -> dict[str, Any]:
        """Für das ``update`` auf die Bewertungstabelle."""
        from datetime import UTC, datetime

        return {
            "ki_stimmung": self.stimmung,
            "ki_themen": self.themen,
            "ki_kernaussage": self.kernaussage,
            "ki_bewertet_at": datetime.now(UTC).isoformat(),
        }


@dataclass(frozen=True)
class Bilanz:
    """Die Zusammenfassung über viele Bewertungen eines Objekts."""

    staerken: list[str]
    schwaechen: list[str]
    empfehlungen: list[str]
    zusammenfassung: str
    grundlage: int  # wie viele Bewertungen eingegangen sind
    antwort: KiAntwort


def _themenliste() -> str:
    return "\n".join(f"- {name}: {was}" for name, was in THEMEN.items())


def _json_aus_antwort(roh: str) -> dict:
    """Das JSON aus der Modellantwort holen.

    Warum nicht einfach ``json.loads``: Modelle legen trotz klarer Ansage
    gelegentlich einen Code-Zaun (```json … ```) darum oder schreiben einen
    Satz davor. Das ist kein Grund, die Auswertung wegzuwerfen — aber es ist
    auch kein Grund, beliebigen Text zu akzeptieren. Deshalb: Zaun abräumen,
    auf das äußerste Objekt zuschneiden, und wenn dann immer noch kein JSON
    dasteht, LAUT scheitern (Wurzel 5) statt eine leere Deutung zu erfinden.
    """
    text = (roh or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1] if "\n" in text else ""
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    anfang = text.find("{")
    ende = text.rfind("}")
    if anfang == -1 or ende <= anfang:
        raise KiDeutungFehler(
            f"Die Antwort enthält kein JSON-Objekt: {text[:200]!r}"
        )
    try:
        daten = json.loads(text[anfang : ende + 1])
    except json.JSONDecodeError as exc:
        raise KiDeutungFehler(
            f"Die Antwort ist kein gültiges JSON: {exc.msg}"
        ) from exc
    if not isinstance(daten, dict):
        raise KiDeutungFehler("Die Antwort ist kein Objekt.")
    return daten


def _themen_saeubern(roh: object) -> list[dict[str, str]]:
    """Nur Themen aus dem Katalog durchlassen, jedes höchstens einmal.

    Ein erfundenes Thema wird verworfen und geloggt, nicht durchgereicht: die
    Datenbank würde es ohnehin ablehnen (CHECK aus 0501), aber dann steht ein
    23514 im Log statt der Aussage, welches Thema das Modell erfunden hat —
    und die ganze Deutung wäre verloren statt nur der eine Eintrag.
    """
    if not isinstance(roh, list):
        return []
    sauber: list[dict[str, str]] = []
    gesehen: set[str] = set()
    for eintrag in roh:
        if not isinstance(eintrag, dict):
            continue
        thema = str(eintrag.get("thema", "")).strip().lower()
        if thema not in THEMEN:
            if thema:
                log.info("ki_deutung_thema_verworfen", thema=thema[:40])
            continue
        if thema in gesehen:
            continue
        richtung = str(eintrag.get("richtung", "")).strip().lower()
        if richtung not in STIMMUNGEN:
            richtung = "neutral"
        gesehen.add(thema)
        sauber.append({"thema": thema, "richtung": richtung})
    return sauber


def deuten(
    *,
    text: str,
    note: float | None = None,
    kanal: str | None = None,
    client: VertexClient | None = None,
) -> Deutung:
    """EINEN Bewertungstext deuten.

    Wirft :class:`src.core.ki.KiError` (Dienst nicht erreichbar/eingerichtet)
    oder :class:`KiDeutungFehler` (Antwort unbrauchbar). Kein Fallback, keine
    erfundene Stimmung — eine geratene Deutung wäre schlimmer als keine, weil
    sie in der Rangliste mitzählt, ohne dass jemand sie als Rateergebnis
    erkennt (Wurzel 4).
    """
    sauber = plaintext(text)
    if not sauber:
        raise KiDeutungFehler("Kein auswertbarer Text.")
    if len(sauber) > MAX_TEXT_ZEICHEN:
        log.info("ki_deutung_text_gekuerzt", zeichen=len(sauber))
        sauber = sauber[:MAX_TEXT_ZEICHEN]

    kopf = []
    if kanal:
        kopf.append(f"Kanal: {kanal}")
    if note is not None:
        # Die Note steht MIT im Prompt, aber ausdrücklich als Nebeninformation:
        # das Modell soll den Text deuten, nicht die Zahl umformulieren. Ohne
        # diesen Hinweis übernimmt es die Note als Stimmung und der ganze
        # Zweck — den Widerspruch zwischen Zahl und Text zu finden — entfällt.
        kopf.append(
            f"Sternenote des Gastes: {note} (nur zur Einordnung — deute den "
            "TEXT, nicht die Zahl)"
        )
    kopfblock = "\n".join(kopf)

    ki = client or VertexClient()
    antwort = ki.erzeuge(
        system=_SYSTEM_DEUTUNG,
        user=(
            f"# Erlaubte Themen\n{_themenliste()}\n\n"
            + (f"# Einordnung\n{kopfblock}\n\n" if kopfblock else "")
            + f"# Bewertungstext\n{sauber}"
        ),
        # Niedrig, weil es eine Klassifikation ist und keine Textproduktion.
        # Dieselbe Bewertung soll bei einem Nachlauf dasselbe Ergebnis geben.
        temperature=0.1,
        max_tokens=_MAX_TOKENS_DEUTUNG,
    )
    daten = _json_aus_antwort(antwort.text)

    stimmung = str(daten.get("stimmung", "")).strip().lower()
    if stimmung not in STIMMUNGEN:
        raise KiDeutungFehler(f"Unbekannte Stimmung: {stimmung[:40]!r}")
    kern = str(daten.get("kernaussage") or "").strip() or None
    if kern:
        kern = kern[:500]

    return Deutung(
        stimmung=stimmung,
        themen=_themen_saeubern(daten.get("themen")),
        kernaussage=kern,
        antwort=antwort,
    )


def bilanz_ziehen(
    *,
    bewertungen: list[dict],
    objektname: str | None = None,
    client: VertexClient | None = None,
) -> Bilanz:
    """Aus vielen Bewertungen eines Objekts eine Verbesserungs-Bilanz machen.

    ``bewertungen`` sind Zeilen mit mindestens ``text``; ``rating``/``ota``
    werden mitgegeben, wenn vorhanden. Erwartet wird die ROH-Auswahl — die
    Begrenzung auf :data:`MAX_BILANZ_BEWERTUNGEN` macht diese Funktion selbst,
    damit kein Aufrufer sie vergessen kann.
    """
    mit_text = [b for b in bewertungen if plaintext(b.get("text"))]
    if not mit_text:
        raise KiDeutungFehler("Keine Bewertung mit Text.")
    # Zwei Deckel, in dieser Reihenfolge: erst die Anzahl, dann die Zeichen.
    # Der Aufrufer gibt die neuesten zuerst — was der Zeichen-Deckel abschneidet,
    # ist also das Älteste, und das ist die richtige Reihenfolge zum Weglassen.
    zeilen: list[str] = []
    zeichen = 0
    genutzt = 0
    for b in mit_text[:MAX_BILANZ_BEWERTUNGEN]:
        note = b.get("rating")
        kanal = b.get("ota") or b.get("kanal")
        marke = " · ".join(
            teil
            for teil in (f"Note {note}" if note is not None else "", kanal or "")
            if teil
        )
        text = (plaintext(b.get("text")) or "")[:MAX_TEXT_ZEICHEN]
        zeile = f"{genutzt + 1}. [{marke}] {text}" if marke else f"{genutzt + 1}. {text}"
        if zeichen + len(zeile) > MAX_BILANZ_ZEICHEN and zeilen:
            log.info(
                "ki_bilanz_gekuerzt",
                genutzt=genutzt,
                vorhanden=len(mit_text),
                zeichen=zeichen,
            )
            break
        zeilen.append(zeile)
        zeichen += len(zeile)
        genutzt += 1
    ausgewaehlt = mit_text[:genutzt]

    ki = client or VertexClient()
    antwort = ki.erzeuge(
        system=_SYSTEM_BILANZ,
        user=(
            (f"# Objekt\n{objektname}\n\n" if objektname else "")
            + f"# Bewertungen ({len(ausgewaehlt)})\n" + "\n\n".join(zeilen)
        ),
        temperature=0.2,
        max_tokens=_MAX_TOKENS_BILANZ,
    )
    daten = _json_aus_antwort(antwort.text)

    def liste(schluessel: str) -> list[str]:
        roh = daten.get(schluessel)
        if not isinstance(roh, list):
            return []
        return [str(e).strip()[:300] for e in roh[:4] if str(e).strip()]

    return Bilanz(
        staerken=liste("staerken"),
        schwaechen=liste("schwaechen"),
        empfehlungen=liste("empfehlungen"),
        zusammenfassung=str(daten.get("zusammenfassung") or "").strip()[:1500],
        grundlage=len(ausgewaehlt),
        antwort=antwort,
    )


def _nutzung_buchen(db: Client, tenant_id: str | None, antwort: KiAntwort) -> None:
    """Den Aufruf in ``site_ai_usage`` protokollieren.

    Ohne diese Buchung wäre der Tagesdeckel eine Attrappe: `deckel_pruefen`
    zählt Zeilen, und was nie gezählt wird, sprengt keine Grenze — derselbe
    Fehler, der bei den Seitenfassungen 23 bezahlte Aufrufe unsichtbar machte
    (0478).

    ``tenant_id`` kann bei ``public.reviews`` fehlen (die Tabelle hat keins,
    0006). Dann wird nicht gebucht und das LAUT geloggt: eine Zählung mit
    stillen Lücken ist als Abrechnungsgrundlage wertlos.
    """
    if not tenant_id:
        log.warning("ki_deutung_ohne_tenant_nicht_gebucht", modell=antwort.modell)
        return
    from src.features.site_config.ki_nutzung import buchen

    buchen(
        db,
        str(tenant_id),
        user_id=None,  # der Tick hat keinen Nutzer
        funktion="bewertung_deuten",
        antwort=antwort,
    )


# --------------------------------------------------------------- Nachlauf
# Welche Tabelle welche Spalten trägt. Drei Tabellen, gleiche Deutung, aber
# unterschiedliche Namen für Text und Zeitpunkt — deshalb eine Tabelle statt
# dreimal derselbe Code mit anderen Zeichenketten.
_QUELLEN: dict[str, dict[str, str]] = {
    "channex_review": {
        "text": "content",
        "note": "overall_score",
        "kanal": "ota",
        "sortierung": "received_at",
        # Portal-Noten laufen 0..10, unsere 1..5. Für den Prompt umrechnen,
        # sonst deutet das Modell eine 8 als schlechte Note (Wurzel 4: die
        # Skala gehört zum Kanal, nicht in die Deutung).
        "skala": "10",
    },
    "reviews": {
        "text": "text",
        "note": "rating",
        "kanal": "",
        "sortierung": "created_at",
        "skala": "5",
    },
    "guest_reviews_by_host": {
        "text": "text",
        "note": "rating",
        "kanal": "",
        "sortierung": "created_at",
        "skala": "5",
    },
}


def _note_normalisieren(wert: object, skala: str) -> float | None:
    """Portal-Note auf die 1..5-Skala bringen, in der der Prompt denkt."""
    if wert is None:
        return None
    try:
        zahl = float(wert)
    except (TypeError, ValueError):
        return None
    return round(zahl / 2, 1) if skala == "10" else zahl


def offene_deuten(
    db: Client,
    *,
    tabelle: str,
    tenant_id: str | None = None,
    limit: int = 25,
    client: VertexClient | None = None,
) -> tuple[int, int]:
    """Noch nicht gedeutete Bewertungen nachholen. Rückgabe: (gedeutet, Fehler).

    Für den Worker-Tick. ``limit`` deckelt den Lauf: ein Betrieb, der 2 000
    Altbewertungen hat, soll sie über mehrere Ticks abarbeiten und nicht einen
    Tick minutenlang festhalten (und nicht sein Tagesbudget in einem Rutsch
    verbrennen).

    Ein Fehler an EINER Bewertung beendet den Lauf nicht — die nächste ist
    davon unabhängig. Aber ein nicht erreichbarer Dienst schon: dann sind alle
    weiteren Versuche im selben Lauf sinnlos und kosten nur Zeit (Wurzel 5:
    spezifisch fangen, das Kontroll-Signal nicht verschlucken).
    """
    from src.features.site_config.ki_nutzung import deckel_pruefen

    if tabelle not in _QUELLEN:
        raise ValueError(f"Unbekannte Bewertungstabelle: {tabelle}")
    spalten = _QUELLEN[tabelle]
    text_spalte = spalten["text"]

    auswahl = ["id", text_spalte, spalten["note"], spalten["sortierung"]]
    if spalten["kanal"]:
        auswahl.append(spalten["kanal"])
    if tabelle != "reviews":
        # public.reviews hat kein tenant_id (0006) — dort bleibt die Buchung
        # aus, und `_nutzung_buchen` sagt das laut.
        auswahl.append("tenant_id")

    abfrage = (
        db.table(tabelle)
        .select(", ".join(dict.fromkeys(auswahl)))
        .is_("ki_bewertet_at", "null")
        .not_.is_(text_spalte, "null")
        .order(spalten["sortierung"], desc=True)
        .limit(limit)
    )
    if tenant_id and tabelle != "reviews":
        # public.reviews hat kein tenant_id — der Bezug läuft über property_id
        # (0006). Ein .eq("tenant_id", …) dort wäre ein 42703, kein leeres
        # Ergebnis.
        abfrage = abfrage.eq("tenant_id", tenant_id)
    zeilen = (abfrage.execute()).data or []

    # Deckel EINMAL vor dem Lauf, nicht je Zeile: der Stand ändert sich
    # während des Laufs zwar, aber `deckel_pruefen` je Bewertung wäre ein
    # zusätzlicher SELECT je Aufruf für eine Grenze, die der Lauf selbst
    # gar nicht sprengen kann (limit ist kleiner als jeder sinnvolle Deckel).
    # Ein `KiError` mit 429 wird unten wie jeder andere behandelt: Lauf
    # beenden, beim nächsten Tick wieder antreten.
    if tenant_id:
        try:
            deckel_pruefen(db, tenant_id)
        except KiError as exc:
            log.info(
                "ki_deutung_deckel", tenant_id=tenant_id, grund=exc.message[:120]
            )
            return 0, 0

    gedeutet = 0
    fehler = 0
    for zeile in zeilen:
        try:
            deutung = deuten(
                text=zeile.get(text_spalte) or "",
                note=_note_normalisieren(
                    zeile.get(spalten["note"]), spalten["skala"]
                ),
                kanal=zeile.get(spalten["kanal"]) if spalten["kanal"] else None,
                client=client,
            )
        except KiError as exc:
            # Dienst weg oder Deckel erreicht — jeder weitere Versuch in diesem
            # Lauf trifft denselben Zustand. Abbrechen und beim nächsten Tick
            # wieder antreten, statt `limit`-mal in dieselbe Wand zu laufen.
            log.warning(
                "ki_deutung_lauf_abgebrochen",
                tabelle=tabelle,
                gedeutet=gedeutet,
                grund=exc.message[:200],
            )
            break
        except KiDeutungFehler as exc:
            # Diese eine Bewertung ist unbrauchbar gedeutet worden. Die Zeile
            # bleibt ungedeutet und kommt beim nächsten Lauf wieder dran —
            # bewusst kein „Fehler"-Merker, weil dieselbe Antwort beim nächsten
            # Versuch anders ausfallen kann.
            fehler += 1
            log.info(
                "ki_deutung_uebersprungen",
                tabelle=tabelle,
                zeile=str(zeile["id"]),
                grund=str(exc)[:200],
            )
            continue
        db.table(tabelle).update(deutung.als_spalten()).eq(
            "id", zeile["id"]
        ).execute()
        _nutzung_buchen(db, zeile.get("tenant_id") or tenant_id, deutung.antwort)
        gedeutet += 1

    if gedeutet or fehler:
        log.info(
            "ki_deutung_lauf",
            tabelle=tabelle,
            gedeutet=gedeutet,
            fehler=fehler,
            offen_geprueft=len(zeilen),
        )
    return gedeutet, fehler
