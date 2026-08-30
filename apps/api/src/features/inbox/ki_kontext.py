"""Der Kontext, den die KI über einen Thread bekommt — an EINER Stelle gebaut.

Vor diesem Modul sah die KI nur die Reservierungsdaten und die Fakten der
Wissensdatenbank. Die Wissensdatenbank war live **leer** (0 Zeilen), während in
``properties.type_attributes`` gleichzeitig **700.628 Zeichen** gepflegter
Gästemappe und **193.937 Zeichen** Richtlinien lagen — Anreise, WLAN,
Hausordnung, Anfahrt, Haustiere, Stornobedingungen. Der Betrieb hatte alles
eingetragen, und die KI antwortete trotzdem „dazu liegen mir keine Angaben
vor", weil niemand dieselben Angaben ein zweites Mal in die Wissensdatenbank
getippt hatte.

Dieses Modul schließt genau diese Lücke.

**Es speichert nichts.** Bei jedem Aufruf wird frisch gelesen. Das ist bewusst
gegen den Weg entschieden, den Hospitable mit seinem „Knowledge Hub" geht: dort
werden die Objektdaten EINMAL kopiert, und spätere Änderungen fließen laut deren
eigener Dokumentation nicht nach. Ein WLAN-Passwort, das sich ändert, bleibt in
so einer Kopie für immer falsch — genau der Fehler, den Wurzel 1 beschreibt (ein
Zustand mit einem Gegenzustand, den niemand pflegt). Ein frischer Lesevorgang je
Antwort kostet drei Abfragen und kann diesen Fehler nicht machen.

Zwei Sperren, die nicht verhandelbar sind:

* **Der Rollen-Datensplit gilt auch hier** (Wurzel 3). Der Kontext läuft durch
  dieselbe Gast-Maske wie der Posteingang. Ein Mitarbeiter ohne
  ``VIEW_GUEST_NAME`` darf über den Umweg KI nicht erfahren, was ihm die
  Oberfläche verwehrt — sonst wäre der KI-Knopf ein Auskunftsloch um jede
  Berechtigungsprüfung herum.
* **Zugangsdaten erst bei bestätigter Buchung.** Türcode, WLAN-Passwort und
  die genaue Anschrift gehen NICHT in den Kontext, solange die Reservierung
  nicht bestätigt ist. Eine Anfrage ist keine Buchung; wer nur fragt, bekommt
  keinen Schlüssel. Die Sperre sitzt hier im Sammler und nicht im Prompt: eine
  Anweisung an das Modell („nenne den Türcode nicht") ist eine Bitte, ein
  weggelassener Kontext ist eine Tatsache.

Der Zeichendeckel ist der dritte Grund für dieses Modul. Ein einzelnes Objekt
hat live bis zu **39.744 Zeichen** Gästemappe, der Prompt-Deckel liegt bei
**24.000** (:data:`src.core.ki.MAX_PROMPT_ZEICHEN`). „Alles hineinschütten"
scheitert also nicht theoretisch, sondern am größten echten Objekt. Deshalb
wählt :func:`kontext_bauen` frageabhängig aus (siehe :func:`_abschnitte_waehlen`)
und kürzt LAUT, statt still abzuschneiden.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta

from httpx import HTTPError
from postgrest.exceptions import APIError
from supabase import Client

from src.core.einheiten_verfuegbar import freie_einheiten_spannen
from src.core.logging import get_logger

from .felder import html_zu_text

log = get_logger("nextdays.inbox.ki_kontext")

# Wie viele Zeichen der GESAMTE gesammelte Kontext höchstens haben darf.
# Deutlich unter MAX_PROMPT_ZEICHEN (24.000), weil System-Prompt, Verlauf und
# Auftrag noch dazukommen — die zusammen brauchen erfahrungsgemäß 4.000 bis
# 6.000 Zeichen. Wer den Deckel hier gleich auf 24.000 setzt, bekommt die
# Ablehnung erst im Client, und zwar als 422 mitten in einer Gastantwort.
MAX_KONTEXT_ZEICHEN = 14_000

# Höchstlänge EINES Abschnitts. Ein einzelner Block der Gästemappe („localGuide"
# ist live regelmäßig über 8.000 Zeichen) darf den Platz nicht allein
# aufbrauchen und die sechs anderen verdrängen.
MAX_ABSCHNITT_ZEICHEN = 2_500

# Wie viele Fakten der Wissensdatenbank höchstens mitkommen (Wurzel 8: kein
# unbegrenzter Bereich).
MAX_FAKTEN = 60

# Wie weit die Verfügbarkeitsauskunft in die Zukunft reicht. 120 Tage decken
# die üblichen Anfragen ("habt ihr im Sommer noch frei?") ab; ein Jahr würde
# den Kontext mit Spannen füllen, nach denen niemand fragt.
VERFUEGBARKEIT_TAGE = 120

# Abschnitte der Gästemappe (`type_attributes.messaging`) mit ihrer Überschrift
# im Prompt und den Stichwörtern, die sie anziehen.
#
# Die Stichwörter sind der Ersatz für eine Vektorsuche — bewusst, siehe
# `_abschnitte_waehlen`. Sie stehen mehrsprachig da (de/en/da), weil die
# Gastfrage in der Sprache des Gastes ankommt und ein deutsches Stichwort auf
# „what is the wifi password" nicht anspringt.
_MESSAGING_ABSCHNITTE: dict[str, tuple[str, tuple[str, ...]]] = {
    "checkIn": (
        "Anreise / Check-in",
        (
            "anreis", "check-in", "checkin", "ankunft", "ankomst", "arrival",
            "schlüssel", "schluessel", "key", "nøgle", "noegle", "uhrzeit",
            "wann", "when", "hvornår", "hvornaar", "früher", "frueher",
            "early", "tidlig",
        ),
    ),
    "checkOut": (
        "Abreise / Check-out",
        (
            "abreis", "check-out", "checkout", "afrejse", "departure",
            "verlassen", "leave", "später", "spaeter", "late", "sen",
        ),
    ),
    "wifi": (
        "WLAN / Internet",
        (
            "wlan", "wifi", "wi-fi", "internet", "netz", "network", "passwort",
            "password", "kodeord", "adgangskode", "router", "verbindung",
        ),
    ),
    "directions": (
        "Anfahrt / Wegbeschreibung",
        (
            "anfahrt", "weg", "route", "directions", "vej", "parken",
            "parkplatz", "parking", "auto", "car", "bil", "bahn", "train",
            "flughafen", "airport", "lufthavn", "navigation", "adresse",
            "address", "finden", "find", "bus",
        ),
    ),
    "doorInstructions": (
        "Türöffnung / Zugang",
        (
            "tür", "tuer", "door", "dør", "doer", "code", "schloss", "lock",
            "lås", "laas", "zugang", "access", "adgang", "schlüsselbox",
            "keybox", "eingang", "entrance",
        ),
    ),
    "rules": (
        "Hausordnung",
        (
            "regel", "rule", "regler", "hausordnung", "erlaubt", "allowed",
            "tilladt", "verboten", "forbidden", "rauchen", "smoking", "ryg",
            "haustier", "hund", "pet", "dog", "kæledyr", "kaeledyr", "party",
            "feier", "fest", "lärm", "laerm", "noise", "støj", "stoej",
            "ruhe", "quiet",
        ),
    ),
    "localGuide": (
        "Umgebung / Tipps",
        (
            "umgebung", "tipp", "tip", "empfehl", "recommend", "anbefal",
            "restaurant", "essen", "eat", "spis", "strand", "beach",
            "supermarkt", "shop", "einkauf", "sehenswürdig", "sehenswuerdig",
            "attraction", "aktivität", "aktivitaet", "activity", "ausflug",
            "in der nähe", "naehe", "nearby", "i nærheden",
        ),
    ),
    "emergency": (
        "Notfall / Kontakt",
        (
            "notfall", "emergency", "nødsituation", "noedsituation", "hilfe",
            "help", "hjælp", "hjaelp", "kaputt", "broken", "defekt", "arzt",
            "doctor", "læge", "laege", "krankenhaus", "hospital", "polizei",
            "police", "politi", "feuer", "fire", "brand", "kontakt",
        ),
    ),
}

# Richtlinien-Felder (`type_attributes.policies`) mit ihrer Überschrift.
# Anders als die Gästemappe sind das kurze Werte — sie kommen vollständig mit,
# ohne Stichwortauswahl. Zusammen sind sie live im Mittel unter 500 Zeichen;
# eine Auswahl brächte nichts und würde nur eine Frage falsch einschätzen
# können.
_POLICY_FELDER: dict[str, str] = {
    "checkInTime": "Check-in ab",
    "checkInTimeEnd": "Check-in bis",
    "checkOutTime": "Check-out bis",
    "cancellation": "Stornobedingungen",
    "payment": "Zahlungsbedingungen",
    "depositText": "Kaution",
    "haustiereErlaubt": "Haustiere erlaubt",
    "haustiereMax": "Haustiere höchstens",
    "rauchenErlaubt": "Rauchen erlaubt",
    "feiernErlaubt": "Feiern erlaubt",
    "kinderErlaubt": "Kinder erlaubt",
    "babysErlaubt": "Babys erlaubt",
}

# Reservierungsstatus, bei denen Zugangsdaten in den Kontext dürfen.
#
# Der Gast hat dann eine verbindliche Buchung. Eine Anfrage (`inquiry`), ein
# abgelaufenes Angebot oder eine Stornierung gehören NICHT dazu — wer storniert
# hat, braucht den Türcode nicht mehr, und wer nur fragt, hatte ihn nie.
_STATUS_MIT_ZUGANG = frozenset({"confirmed", "checked_in", "checked_out", "modified"})

# Felder, die als Zugangsdaten gelten und deshalb an `_STATUS_MIT_ZUGANG`
# hängen. Schlüssel der Gästemappe, nicht Überschriften.
_ZUGANGSFELDER = frozenset({"wifi", "doorInstructions"})

# Wortzeichen inklusive Umlauten — `\w` allein trennt „Türcode" in „T" und
# „rcode", womit das Stichwort „tür" nie träfe.
_WORT = re.compile(r"[^\W\d_]+", re.UNICODE)


@dataclass
class KiKontext:
    """Der gesammelte Kontext — Text für den Prompt UND Herkunft für die UI.

    ``quellen`` ist nicht Zierde: es ist die einzige Möglichkeit, eine falsche
    Antwort zu diagnostizieren. Ohne diese Liste rät man, ob ein Fakt fehlte,
    ein Abschnitt nicht ausgewählt wurde oder das Modell sich etwas
    zurechtgelegt hat (Debugging-Pflicht, siehe CLAUDE.md).
    """

    bloecke: list[tuple[str, str]] = field(default_factory=list)
    quellen: list[str] = field(default_factory=list)
    # Abschnitte, die wegen des Deckels NICHT mitkamen. Gehören ins Log und ins
    # Kontext-Panel: ein weggelassener Abschnitt erklärt eine unvollständige
    # Antwort, und ohne diese Liste sieht sie wie ein Modellfehler aus.
    weggelassen: list[str] = field(default_factory=list)
    zugang_gesperrt: bool = False

    @property
    def text(self) -> str:
        return "\n\n".join(f"## {titel}\n{inhalt}" for titel, inhalt in self.bloecke)

    @property
    def zeichen(self) -> int:
        return len(self.text)


def _mehrsprachig_lesen(wert: object, sprache: str | None) -> str:
    """Einen Gästemappen-Wert in der Sprache des Gastes als Klartext.

    Der Wert liegt live in ZWEI Formen vor, und das ist kein Altlast-Zufall,
    den man wegdefinieren dürfte: 18 Objekte haben ``{"de": …, "en": …,
    "da": …}``, eines („Fewo-Mosbjerg-Sindal") hat bei ``checkIn`` einen
    blanken String. Der bestehende Leser ``feld_kontext.messaging_texte``
    überspringt diese Form (``if not isinstance(werte, dict): continue``) — der
    Text dieses Objekts fällt dort still unter den Tisch. Hier nicht.

    Reihenfolge: Sprache des Gastes, dann Englisch, dann Deutsch, dann die
    erste überhaupt gepflegte. Ein dänischer Gast liest lieber den englischen
    Text als gar keinen.
    """
    if isinstance(wert, str):
        return html_zu_text(wert.strip())
    if not isinstance(wert, dict):
        return ""
    basis = (sprache or "").strip().lower().replace("_", "-").split("-")[0]
    for s in (basis, "en", "de"):
        if s and isinstance(wert.get(s), str) and wert[s].strip():
            return html_zu_text(str(wert[s]).strip())
    for v in wert.values():
        if isinstance(v, str) and v.strip():
            return html_zu_text(v.strip())
    return ""


def _stichwoerter(frage: str) -> set[str]:
    """Die Wörter der Gastfrage, klein und ohne Füllwörter-Länge.

    Wörter unter drei Zeichen fliegen raus: „ist", „the", „er" treffen sonst
    zufällig in jedem Abschnitt und machen die Auswahl wertlos.
    """
    return {w.lower() for w in _WORT.findall(frage) if len(w) >= 3}


def _abschnitte_waehlen(frage: str, vorhanden: set[str]) -> list[str]:
    """Welche Gästemappen-Abschnitte zu dieser Frage gehören — in Reihenfolge.

    Das ist bewusst KEINE Vektorsuche. Der Kontext eines Threads betrifft genau
    EIN Objekt; die Auswahl muss also nur unter acht Abschnitten entscheiden,
    nicht unter zehntausend Blöcken. Eine Stichwortliste, die man lesen und
    korrigieren kann, ist dieser Aufgabe angemessen — und sie erklärt sich
    selbst, wenn sie danebenliegt.

    Trifft NICHTS, kommen alle Abschnitte in fester Reihenfolge; der Deckel
    schneidet dann hinten ab. Das ist der richtige Rückfall: eine Frage, die
    kein Stichwort trifft („Hallo, kurze Frage"), ist keine Frage ohne Antwort,
    sondern eine, bei der wir nicht wissen, welcher Teil zählt.
    """
    worte = _stichwoerter(frage)
    treffer: list[tuple[int, str]] = []
    for schluessel, (_, stichwoerter) in _MESSAGING_ABSCHNITTE.items():
        if schluessel not in vorhanden:
            continue
        punkte = sum(
            1
            for s in stichwoerter
            # `in`-Vergleich statt Gleichheit, damit „anreise", „anreisetag"
            # und „Anreisezeit" alle auf das Stichwort „anreis" passen.
            if any(s in w or w in s for w in worte)
        )
        if punkte:
            treffer.append((punkte, schluessel))
    if not treffer:
        return [k for k in _MESSAGING_ABSCHNITTE if k in vorhanden]
    treffer.sort(key=lambda t: (-t[0], list(_MESSAGING_ABSCHNITTE).index(t[1])))
    getroffen = [k for _, k in treffer]
    # Die übrigen hinten anhängen: sie sind weniger wahrscheinlich, aber wenn
    # Platz bleibt, ist mehr Kontext besser als weniger.
    return getroffen + [
        k for k in _MESSAGING_ABSCHNITTE if k in vorhanden and k not in getroffen
    ]


def _kuerzen(text: str, grenze: int) -> str:
    """Auf ``grenze`` Zeichen kürzen — an der Satzgrenze, sichtbar markiert.

    Sichtbar, weil ein mitten im Wort abgeschnittener Text vom Modell als
    vollständig gelesen wird und dann eine halbe Hausordnung als die ganze
    ausgegeben wird. Die Marke sagt dem Modell (und im Kontext-Panel dem
    Menschen), dass hier etwas fehlt.
    """
    if len(text) <= grenze:
        return text
    schnitt = text[:grenze]
    for trenner in (". ", "\n"):
        pos = schnitt.rfind(trenner)
        if pos > grenze // 2:
            schnitt = schnitt[: pos + 1]
            break
    return schnitt.rstrip() + "\n[… gekürzt]"


def _zugang_erlaubt(status: str | None) -> bool:
    """Darf dieser Thread Türcode und WLAN sehen?

    Fail-closed (Wurzel 5): ohne Status — etwa bei einer Konversation ganz ohne
    Reservierung — gibt es keinen Zugang. Der Fehler „Gast bekommt den Code
    nicht, obwohl er gebucht hat" ist eine Rückfrage; der Fehler „Fremder
    bekommt den Code" ist ein Einbruch.
    """
    return (status or "").strip().lower() in _STATUS_MIT_ZUGANG


# Die Ausstattungscodes stehen als `amenities`/`room_amenities` in der DB
# (`nd_private_garden`, `bbq_picnic_area`). So wären sie im Prompt Rauschen —
# das Modell soll dem Gast nicht „nd_near_sea" antworten. Deshalb wird der Code
# lesbar gemacht, und zwar nur die ersten `MAX_AUSSTATTUNG`: eine Unterkunft mit
# 60 Merkmalen würde sonst allein damit den halben Kontext füllen (Wurzel 8).
MAX_AUSSTATTUNG = 25


def _ausstattung_lesbar(codes: object) -> str:
    """Ausstattungscodes als Wortliste. Unbekannte werden entschlüsselt, nicht
    weggelassen: „laundry_facilities" ist als „laundry facilities" immer noch
    eine brauchbare Angabe, als fehlender Eintrag dagegen eine Wissenslücke."""
    if not isinstance(codes, list):
        return ""
    worte: list[str] = []
    for c in codes[:MAX_AUSSTATTUNG]:
        if not isinstance(c, str) or not c.strip():
            continue
        # `nd_` ist unser eigenes Präfix und sagt dem Gast nichts.
        wort = c.strip().removeprefix("nd_").replace("_", " ").strip()
        if wort:
            worte.append(wort)
    rest = max(0, len([c for c in codes if isinstance(c, str)]) - len(worte))
    text = ", ".join(worte)
    return f"{text} (und {rest} weitere)" if rest else text


def _zahl(wert: object) -> str:
    """Eine Zahl aus `type_attributes` als Text. Live steht dort mal `2`, mal
    `1.0`, mal `"3"` — alle drei sollen gleich aussehen."""
    if isinstance(wert, bool) or wert is None:
        return ""
    if isinstance(wert, (int, float)):
        return str(int(wert)) if float(wert).is_integer() else str(wert)
    text = str(wert).strip()
    return text if text and text.lower() not in {"none", "null"} else ""


def _objekt_block(prop: dict) -> str:
    teile = [f"Name: {prop.get('title')}" if prop.get("title") else ""]
    ort = ", ".join(
        str(prop[k]).strip()
        for k in ("city", "country")
        if (prop.get(k) or "").strip()
    )
    if ort:
        teile.append(f"Ort: {ort}")

    # Die harten Zahlen zuerst und in EINER Zeile: „Wie viele Betten?", „Passen
    # wir zu sechst rein?", „Wie viele Bäder?" sind häufige Fragen, und ohne
    # diese Angaben muss die KI passen, obwohl die Antwort in der Datenbank
    # steht. Sie standen bis hierher nicht im Kontext.
    attrs = prop.get("type_attributes")
    attrs = attrs if isinstance(attrs, dict) else {}
    zahlen = [
        (label, _zahl(attrs.get(schluessel)))
        for label, schluessel in (
            ("Schlafzimmer", "schlafzimmer"),
            ("Betten", "betten"),
            ("Badezimmer", "badezimmer"),
        )
    ]
    kapazitaet = _zahl(prop.get("max_guests")) or _zahl(attrs.get("occupancy"))
    if kapazitaet:
        zahlen.append(("Gäste maximal", kapazitaet))
    zeile = ", ".join(f"{label} {wert}" for label, wert in zahlen if wert)
    if zeile:
        teile.append(zeile)

    typ = prop.get("property_type")
    if typ and str(typ).strip():
        teile.append(f"Art der Unterkunft: {typ}")

    ausstattung = _ausstattung_lesbar(prop.get("amenities"))
    if ausstattung:
        teile.append(f"Ausstattung: {ausstattung}")

    beschreibung = html_zu_text(str(prop.get("description") or "").strip())
    if beschreibung:
        teile.append(_kuerzen(beschreibung, MAX_ABSCHNITT_ZEICHEN))
    return "\n".join(t for t in teile if t)


def _policies_block(attrs: dict, sprache: str | None) -> str:
    policies = attrs.get("policies")
    if not isinstance(policies, dict):
        return ""
    zeilen: list[str] = []
    for schluessel, titel in _POLICY_FELDER.items():
        roh = policies.get(schluessel)
        if isinstance(roh, bool):
            wert = "ja" if roh else "nein"
        elif isinstance(roh, (int, float)):
            wert = str(roh)
        else:
            wert = _mehrsprachig_lesen(roh, sprache)
        if wert:
            zeilen.append(f"{titel}: {_kuerzen(wert, 600)}")
    return "\n".join(zeilen)


def _verfuegbarkeit_block(
    db: Client,
    tenant_id: str,
    property_id: str,
    heute: date,
    *,
    anreise: date | None = None,
    abreise: date | None = None,
) -> str:
    """Freie Einheiten der nächsten Monate als lesbare Spannen.

    Nutzt :func:`freie_einheiten_spannen` — dieselbe Rechnung, die auch an die
    Portale geht. Eine zweite Zählung hier hieße: die KI sagt dem Gast etwas
    anderes, als Booking.com anzeigt (Wurzel 4).

    Nur Spannen MIT freien Einheiten kommen mit; „belegt" ist die Regel und
    würde die Liste mit Rauschen füllen. Dass eine Zeit fehlt, heißt damit
    ausdrücklich: belegt — das steht als Satz dabei, sonst liest das Modell die
    Lücke als „unbekannt".
    """
    bis = heute + timedelta(days=VERFUEGBARKEIT_TAGE)
    try:
        spannen = freie_einheiten_spannen(db, tenant_id, property_id, heute, bis)
    except (APIError, HTTPError) as exc:
        # Eng gefangen und LAUT (Wurzel 5). Ein weggefallener
        # Verfügbarkeitsblock ist hier gefährlicher als ein Fehler: das Modell
        # bekäme eine Verfügbarkeitsfrage ohne Verfügbarkeitswissen und würde
        # nach der System-Regel („steht es nicht im Kontext, sag es") mit
        # „liegt mir nicht vor" antworten — auf eine Frage, deren Antwort wir
        # haben. Deshalb steht der Ausfall AUCH im Kontext und in
        # `weggelassen`, statt still zu verschwinden.
        log.error(
            "ki_kontext_verfuegbarkeit_fehlt",
            property_id=property_id,
            grund=type(exc).__name__,
            fehler=str(exc)[:200],
        )
        return ""
    frei = [(v, b, z) for v, b, z in spannen if z > 0]
    zeilen: list[str] = []

    # Die VIER Aussagen zum konkreten Aufenthalt zuerst — sie tragen die
    # häufigsten Verfügbarkeitsfragen („können wir früher kommen?", „können wir
    # später bleiben?"). Bis hierher standen nur die Spannen im Kontext, und
    # das Modell musste sie ausrechnen; genau daran irrt es.
    zeilen.extend(_anschluss_zeilen(frei, anreise, abreise))

    if not frei:
        zeilen.append(
            f"Vom {heute.isoformat()} bis {bis.isoformat()} ist nichts frei "
            "(alle Einheiten belegt oder gesperrt)."
        )
        return "\n".join(zeilen)

    zeilen.extend(
        f"{v.isoformat()} bis {b.isoformat()}: {z} Einheit(en) frei"
        for v, b, z in frei
    )
    zeilen.append(
        f"Alle nicht genannten Zeiträume bis {bis.isoformat()} sind belegt."
    )
    return "\n".join(zeilen)


def _ist_frei(spannen: list[tuple[date, date, int]], tag: date) -> int:
    """Wie viele Einheiten an diesem Tag frei sind. 0 = belegt."""
    for von, bis, zahl in spannen:
        if von <= tag <= bis:
            return zahl
    return 0


def _anschluss_zeilen(
    frei: list[tuple[date, date, int]],
    anreise: date | None,
    abreise: date | None,
) -> list[str]:
    """Die vier Aussagen rund um den gebuchten Aufenthalt, ausformuliert.

    Ohne Reisedaten (eine Anfrage ohne Buchung) bleibt die Liste leer — hier
    etwas anzunehmen wäre ein erfundener Wert (Wurzel 4)."""
    zeilen: list[str] = []
    if anreise:
        vortag = anreise - timedelta(days=1)
        zahl = _ist_frei(frei, vortag)
        zeilen.append(
            f"Früher anreisen (Vortag {vortag.isoformat()}): "
            + (f"{zahl} Einheit(en) frei" if zahl else "belegt, nicht möglich")
        )
    if abreise:
        # Der Abreisetag selbst: an ihm reist der Gast ab, die Einheit wird
        # frei. Frei heisst hier: NIEMAND ANDERES reist an diesem Tag an.
        zahl = _ist_frei(frei, abreise)
        zeilen.append(
            f"Später abreisen (Abreisetag {abreise.isoformat()}): "
            + (f"{zahl} Einheit(en) frei" if zahl else "belegt, nicht möglich")
        )
        naechster = abreise + timedelta(days=1)
        zahl_n = _ist_frei(frei, naechster)
        zeilen.append(
            f"Verlängern über den Abreisetag hinaus ({naechster.isoformat()}): "
            + (f"{zahl_n} Einheit(en) frei" if zahl_n else "belegt, nicht möglich")
        )
    return zeilen


def _fakten_laden(
    db: Client, tenant_id: str, property_id: str | None
) -> list[str]:
    """Fakten der Wissensdatenbank: die des Objekts plus die betriebsweiten.

    Die EINE Stelle dafür. Vorher stand dieselbe Abfrage zweimal im Code
    (``anhaenge._wissen_fuer_thread`` und ``whatsapp.service._ki_wissen``) —
    zwei Kopien einer Regel, die auseinanderlaufen, sobald jemand eine davon
    anfasst.
    """
    q = (
        db.table("inbox_knowledge_fact")
        .select("fact, property_id")
        .eq("tenant_id", tenant_id)
    )
    q = (
        q.or_(f"property_id.eq.{property_id},property_id.is.null")
        if property_id
        else q.is_("property_id", "null")
    )
    zeilen = q.limit(MAX_FAKTEN).execute().data or []
    # Objektbezogene Fakten zuerst: sie schlagen das Allgemeine.
    zeilen.sort(key=lambda r: 0 if r.get("property_id") else 1)
    return [str(z["fact"]).strip() for z in zeilen if (z.get("fact") or "").strip()]


def kontext_bauen(
    db: Client,
    tenant_id: str,
    *,
    prop: dict | None,
    frage: str,
    sprache: str | None,
    status: str | None,
    heute: date | None = None,
) -> KiKontext:
    """Den vollständigen Kontext eines Threads sammeln.

    ``prop`` ist die Objektzeile (mit ``type_attributes``), ``frage`` die letzte
    Gastnachricht (sie steuert die Abschnittsauswahl), ``sprache`` die Sprache
    des Gastes, ``status`` der Reservierungsstatus (entscheidet über
    Zugangsdaten).

    Ohne Objekt gibt es trotzdem einen Kontext — nur eben aus den
    betriebsweiten Fakten. Das ist der richtige Fall für eine Konversation, die
    noch keiner Unterkunft zugeordnet ist: das Modell erfährt dann weniger und
    fragt nach, statt sich etwas auszudenken.
    """
    kontext = KiKontext()
    tag = heute or datetime.now(UTC).date()
    property_id = str(prop["id"]) if prop and prop.get("id") else None
    attrs = prop.get("type_attributes") if prop else None
    attrs = attrs if isinstance(attrs, dict) else {}
    messaging = attrs.get("messaging")
    messaging = messaging if isinstance(messaging, dict) else {}

    zugang = _zugang_erlaubt(status)
    kontext.zugang_gesperrt = not zugang

    def anfuegen(titel: str, inhalt: str, quelle: str) -> bool:
        """Block anhängen, solange der Deckel es hergibt. Sonst vormerken.

        Eine Kürzung wird GENAUSO vermerkt wie ein Wegfall. Beides ist für den
        Leser derselbe Befund — „die Antwort konnte diesen Teil nicht kennen" —
        und ohne den Vermerk sähe eine halbe Hausordnung im Kontext-Panel aus
        wie die ganze.
        """
        roh = inhalt.strip()
        if not roh:
            return False
        gekuerzt = _kuerzen(roh, MAX_ABSCHNITT_ZEICHEN)
        if kontext.zeichen + len(gekuerzt) + len(titel) + 8 > MAX_KONTEXT_ZEICHEN:
            kontext.weggelassen.append(f"{quelle} (kein Platz mehr)")
            return False
        kontext.bloecke.append((titel, gekuerzt))
        kontext.quellen.append(quelle)
        if len(gekuerzt) < len(roh):
            kontext.weggelassen.append(
                f"{quelle} (gekürzt: {len(roh)} auf {len(gekuerzt)} Zeichen)"
            )
        return True

    # Reihenfolge ist Rangfolge: was zuerst kommt, überlebt den Deckel.
    # Objektstammdaten und Richtlinien sind kurz und fast immer relevant;
    # die Gästemappe ist lang und wird deshalb frageabhängig sortiert.
    if prop:
        anfuegen("Unterkunft", _objekt_block(prop), "Objektdaten")
        anfuegen("Richtlinien", _policies_block(attrs, sprache), "Richtlinien")

    fakten = _fakten_laden(db, tenant_id, property_id)
    if fakten:
        anfuegen(
            "Gesicherte Angaben (Wissensdatenbank)",
            "\n".join(f"- {f}" for f in fakten),
            "Wissensdatenbank",
        )

    # `messaging.get(k)` allein genügt NICHT: live steht dort regelmäßig
    # `{"da": "", "de": "", "en": ""}` — ein Objekt, das wahr ist und trotzdem
    # keinen Text hat. Ein so „vorhandener" Abschnitt zöge die Auswahl auf sich
    # und verdrängte einen, der Inhalt hat. Deshalb wird der Text gelesen,
    # bevor der Abschnitt als vorhanden gilt.
    texte = {
        k: _mehrsprachig_lesen(messaging.get(k), sprache)
        for k in _MESSAGING_ABSCHNITTE
        if messaging.get(k)
    }
    vorhanden = {k for k, v in texte.items() if v.strip()}
    for schluessel in _abschnitte_waehlen(frage, vorhanden):
        if schluessel in _ZUGANGSFELDER and not zugang:
            # NICHT stumm überspringen: das Kontext-Panel muss zeigen, dass
            # hier etwas absichtlich fehlt, sonst sucht jemand den Fehler in
            # der Gästemappe.
            kontext.weggelassen.append(
                f"Gästemappe → {_MESSAGING_ABSCHNITTE[schluessel][0]} "
                "(gesperrt: Buchung nicht bestätigt)"
            )
            continue
        titel, _ = _MESSAGING_ABSCHNITTE[schluessel]
        anfuegen(f"Gästemappe: {titel}", texte[schluessel], f"Gästemappe → {titel}")

    if property_id and not anfuegen(
        "Verfügbarkeit",
        _verfuegbarkeit_block(db, tenant_id, property_id, tag),
        "Kalender",
    ):
        # `anfuegen` liefert False bei leerem Inhalt — und leer ist der Block
        # genau dann, wenn die Abfrage scheiterte (sonst steht mindestens
        # „nichts frei" darin). Das gehört ins Kontext-Panel.
        kontext.weggelassen.append("Kalender (Verfügbarkeit nicht abrufbar)")

    log.info(
        "ki_kontext_gebaut",
        tenant_id=tenant_id,
        property_id=property_id,
        zeichen=kontext.zeichen,
        quellen=len(kontext.quellen),
        weggelassen=len(kontext.weggelassen),
        zugang_gesperrt=kontext.zugang_gesperrt,
    )
    return kontext
