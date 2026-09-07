"""Personal & Dienstplan des Demo-Betriebs aufbauen (Slice `personal`, 0540–0543).

Ein Hotel ohne Personal ist im Screenshot dasselbe wie ein Betrieb ohne
Buchungen: die Oberfläche zeigt Leerzustände statt des Produkts. Dieses Modul
füllt deshalb die ganze Kette, die die Personal-Oberfläche speist:

  Betriebsregeln (bestätigt!) → Arbeitsbereiche → Schichtvorlagen →
  Pausenmodelle → Fremdfirma → Mitarbeitende (Login + Akte + Kartei) →
  Objektfreigaben → Qualifikationen → Verfügbarkeiten → Urlaubskonten →
  Abwesenheiten → Dienstplan (veröffentlicht) → Zeiterfassung → AZK

Warum die Regeln zuerst und BESTÄTIGT: ohne `personal_regeln.bestaetigt_am`
antwortet der Dienstplan mit 422 `regeln_fehlen` — gewollt (Wurzel 4), aber
dann ist jede Personal-Seite leer. Die Werte sind der Länder-Vorschlag aus
`laender.py` für DE, damit der Demo-Bestand keine erfundene Rechtslage zeigt.

Deterministisch wie der übrige Seed: alle IDs aus `demo_id(...)`, ein fester
Zufallskeim. Zweimal laufen lassen ergibt denselben Bestand (Wurzel 2).

Zwei Dinge tut dieses Modul bewusst NICHT:
* keine Benachrichtigungen — der Seed schreibt Zeilen, er ruft keine Dienste;
  ein veröffentlichter Demo-Plan darf niemandem eine Mail schicken.
* keine offene Stempelung älter als 16 h — sonst meldet der Worker-Tick
  („Stempelung läuft seit …") den Demo-Bestand als Störung.
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from konfig import Supabase, demo_id

KEIM = 20260904

# Zeitzone des Betriebs. Die Kalendertage (`datum`) sind Tage in DIESER Zone,
# die Zeitstempel sind UTC — dieselbe Trennung wie im Aufgabenkalender.
ZONE = timezone(timedelta(hours=2))  # Europe/Berlin, Sommerzeit im Demo-Fenster

# Fenster des Dienstplans: zwei Wochen zurück (Ist-Zeiten, Auswertung), vier
# voraus (veröffentlichter Plan, offene Schichten, Bewerbungen).
TAGE_ZURUECK = 14
TAGE_VORAUS = 28


@dataclass(frozen=True)
class Bereich:
    """Arbeitsbereich des Hotels — Farbe und Kürzel wie in der Oberfläche."""

    schluessel: str
    name: str
    kurz: str
    farbe: str


@dataclass(frozen=True)
class Vorlage:
    """Schichtvorlage: Früh/Spät/Nacht je Bereich."""

    schluessel: str
    name: str
    kurz: str
    start: str
    ende: str
    pause_min: int
    farbe: str
    bereich: str


@dataclass(frozen=True)
class Person:  # pylint: disable=too-many-instance-attributes
    """Eine Kraft des Hotels — Login, Akte und Kartei in einem Datensatz.

    Viele Felder, weil eine Personalakte viele Felder hat; getrennt wären es
    fünf Listen, die man von Hand synchron halten müsste.
    """

    schluessel: str
    vorname: str
    nachname: str
    rolle: str  # staff | cleaner | shift_lead
    position: str
    beschaeftigungsart: str  # vollzeit | teilzeit | aushilfe | extern
    bereiche: list[str]
    wochenstunden: float
    stundenlohn: float | None
    eintritt_vor_tagen: int
    urlaubstage: float | None
    geburtsjahr: int
    ort: str
    plz: str
    strasse: str
    telefon: str
    stufe: str = "selbststaendig"
    gehalt: float | None = None
    firma: bool = False
    familienstand: str = "ledig"
    kinder: int = 0
    austritt_in_tagen: int | None = None
    probezeit_in_tagen: int | None = None
    # Deutschkenntnis für den Nachweise-Reiter. Explizit am Datensatz statt aus
    # dem Namen geraten: „aus dem Nachnamen auf die Muttersprache schließen" ist
    # keine Ableitung, sondern ein Vorurteil im Code.
    deutsch: str = "muttersprache"


BEREICHE = [
    Bereich("rezeption", "Rezeption", "REZ", "#2563eb"),
    Bereich("housekeeping", "Housekeeping", "HK", "#0d9488"),
    Bereich("fruehstueck", "Frühstück & Service", "F&S", "#d97706"),
    Bereich("haustechnik", "Haustechnik", "HT", "#7c3aed"),
    Bereich("waescherei", "Wäscherei", "WÄS", "#db2777"),
]

VORLAGEN = [
    Vorlage("rez_frueh", "Rezeption früh", "RF", "06:30", "15:00", 30, "#2563eb", "rezeption"),
    Vorlage("rez_spaet", "Rezeption spät", "RS", "14:30", "23:00", 30, "#1d4ed8", "rezeption"),
    Vorlage("rez_nacht", "Nachtdienst", "NA", "22:45", "07:00", 45, "#1e3a8a", "rezeption"),
    Vorlage("hk_tag", "Housekeeping Tag", "HT", "07:00", "15:30", 30, "#0d9488", "housekeeping"),
    Vorlage("hk_spaet", "Housekeeping spät", "HS", "11:00", "19:00", 30, "#0f766e", "housekeeping"),
    Vorlage("fs_frueh", "Frühstück", "FR", "06:00", "12:30", 30, "#d97706", "fruehstueck"),
    Vorlage("ht_tag", "Haustechnik", "TE", "08:00", "16:30", 45, "#7c3aed", "haustechnik"),
    Vorlage("wa_tag", "Wäscherei", "WA", "08:00", "14:00", 30, "#db2777", "waescherei"),
]

PERSONEN = [
    Person("wagner", "Katrin", "Wagner", "shift_lead", "Empfangsleitung", "vollzeit",
           ["rezeption"], 40, 21.50, 1490, 30, 1987, "Rostock", "18119",
           "Seestraße 14", "+49 381 5194211", stufe="anleitend",
           familienstand="verheiratet", kinder=2),
    Person("brandt", "Sven", "Brandt", "staff", "Rezeptionist", "vollzeit",
           ["rezeption"], 40, 17.80, 760, 28, 1994, "Rostock", "18055",
           "Kröpeliner Straße 40", "+49 381 5194212"),
    Person("koehler", "Melina", "Köhler", "staff", "Rezeptionistin", "teilzeit",
           ["rezeption", "fruehstueck"], 25, 17.20, 320, 20, 1999, "Warnemünde", "18119",
           "Am Strom 62", "+49 381 5194213", probezeit_in_tagen=-140),
    Person("okoro", "Grace", "Okoro", "shift_lead", "Hausdamenleitung", "vollzeit",
           ["housekeeping", "waescherei"], 38, 20.40, 1120, 30, 1985, "Rostock", "18057",
           "Doberaner Straße 8", "+49 381 5194214", stufe="anleitend",
           familienstand="verheiratet", kinder=1),
    Person("dabrowska", "Agnieszka", "Dąbrowska", "cleaner", "Zimmermädchen", "vollzeit",
           ["housekeeping"], 38, 14.60, 640, 28, 1991, "Rostock", "18069",
           "Hamburger Straße 21", "+49 381 5194215", deutsch="c1"),
    Person("mensah", "Abena", "Mensah", "cleaner", "Zimmermädchen", "teilzeit",
           ["housekeeping"], 24, 14.60, 410, 22, 1996, "Rostock", "18069",
           "Lange Straße 3", "+49 381 5194216", deutsch="b2"),
    Person("ilic", "Marko", "Ilić", "cleaner", "Roomboy", "teilzeit",
           ["housekeeping", "haustechnik"], 20, 14.20, 190, 18, 2001, "Warnemünde",
           "18119", "Mühlenstraße 5", "+49 381 5194217", stufe="lernend",
           probezeit_in_tagen=10, deutsch="b2"),
    Person("radu", "Elena", "Radu", "cleaner", "Wäscherei", "teilzeit",
           ["waescherei", "housekeeping"], 20, 14.40, 520, 20, 1989, "Rostock", "18055",
           "Grubenstraße 12", "+49 381 5194218", deutsch="c1"),
    Person("timm", "Holger", "Timm", "staff", "Haustechniker", "vollzeit",
           ["haustechnik"], 40, 22.90, 2210, 30, 1978, "Rostock", "18106",
           "Warnowufer 9", "+49 381 5194219", stufe="anleitend",
           familienstand="verheiratet", kinder=3),
    Person("silva", "Rafaela", "Silva", "staff", "Frühstücksservice", "teilzeit",
           ["fruehstueck"], 22, 15.10, 300, 20, 1997, "Rostock", "18057",
           "Wismarsche Straße 30", "+49 381 5194220", deutsch="b2"),
    Person("nowak", "Piotr", "Nowak", "staff", "Frühstück & Service", "aushilfe",
           ["fruehstueck", "rezeption"], 12, 13.90, 95, 10, 2003, "Rostock", "18055",
           "Steinstraße 7", "+49 381 5194221", stufe="lernend",
           probezeit_in_tagen=85, deutsch="b1"),
    Person("keskin", "Derya", "Keskin", "cleaner", "Reinigungskraft (Fremdfirma)",
           "extern", ["housekeeping"], 20, None, 240, None, 1993, "Rostock", "18069",
           "Neubrandenburger Straße 4", "+49 381 5194222", firma=True, deutsch="c1"),
    Person("araujo", "Tiago", "Araújo", "cleaner", "Reinigungskraft (Fremdfirma)",
           "extern", ["housekeeping", "waescherei"], 20, None, 150, None, 1995,
           "Rostock", "18069", "Neubrandenburger Straße 4", "+49 381 5194223",
           firma=True, deutsch="b1"),
    Person("schulz", "Lena", "Schulz", "staff", "Rezeptionistin (Elternzeit)", "teilzeit",
           ["rezeption"], 20, 17.20, 1830, 20, 1992, "Rostock", "18055",
           "Barnstorfer Weg 2", "+49 381 5194224", familienstand="verheiratet",
           kinder=1, austritt_in_tagen=None),
]

FIRMA = {
    "name": "NordClean Service GmbH",
    "kontakt_name": "Beate Ruthenberg",
    "kontakt_email": "disposition@nordclean-rostock.de",
    "kontakt_telefon": "+49 381 4408120",
    "abrechnung": "je_stunde",
    "satz_minor": 2890,
    "currency": "EUR",
    "notiz": "Rahmenvertrag Zimmerreinigung, Abrechnung monatlich nach Stunden.",
}

# Gesetzliche Mindestwerte DE — dieselben Zahlen wie der Länder-Vorschlag in
# `apps/api/src/features/personal/laender.py`. Kein erfundenes Recht im Demo.
REGELN = {
    "land": "DE",
    "zeitzone": "Europe/Berlin",
    "feiertage_region": "MV",
    "ruhezeit_stunden": 11,
    "max_tagesstunden": 10,
    "max_wochenstunden": 48,
    "nacht_von": "23:00:00",
    "nacht_bis": "06:00:00",
    "zuschlag_nacht_pct": 25,
    "zuschlag_sonntag_pct": 50,
    "zuschlag_feiertag_pct": 125,
    "zuschlag_ueberstunden_pct": 25,
    "urlaubsjahr_start_monat": 1,
    "uebertrag_verfall_monat": 3,
    "uebertrag_max_tage": 10,
    "mindest_vorlauf_urlaub_tage": 14,
    "datev_berater_nr": "1234567",
    "datev_mandanten_nr": "54321",
    "lohnarten": {
        "grundlohn": "100", "nacht": "210", "sonntag": "220", "feiertag": "230",
        "ueberstunden": "240", "urlaub": "300", "krank": "310", "unbezahlt": "400",
    },
    # --- Ausbau 0544/0545 ---------------------------------------------------
    # Jugendschutz nach JArbSchG §8/§14 (DE): bis 18 Jahre acht Stunden am Tag
    # und keine Arbeit zwischen 20:00 und 06:00. Der Demo-Bestand hat niemanden
    # unter 18, die Regel ist also gesetzt und greift nicht — genau so soll ein
    # Betrieb sie sehen.
    "jugendschutz_bis_alter": 18,
    "jugendschutz_max_tagesstunden": 8,
    "jugendschutz_nacht_von": "20:00:00",
    "jugendschutz_nacht_bis": "06:00:00",
    "zweistufige_genehmigung": True,
    "max_urlaub_zusammenhaengend_tage": 21,
    "gps_pflicht": False,
    "gps_radius_m": 250,
    "stempel_ab_schichtbeginn": True,
    "verspaetung_melden_min": 20,
    "terminal_aktiv": True,
    "wetter_anzeigen": True,
    # Ziel-Umsatzproduktivität: 65 EUR Zimmerumsatz je geplanter Arbeitsstunde.
    # Daraus rechnet der Plan das Stundenlimit je Tag. Ohne diesen Wert bleibt
    # die Zeile im Kopf leer — richtig, aber im Demo-Bestand wenig lehrreich.
    "ziel_umsatzproduktivitaet_minor": 6500,
    "ziel_personalkostenquote_pct": 32,
    "kennzahlen_currency": "EUR",
    "kennzahlen_zeilen": ["besetzung", "stundenlimit", "einsaetze", "kosten"],
}

# Produktivitätsannahmen je Arbeitsbereich (0545). Die Basis ist das, WORAN die
# Arbeit im Hotel wirklich hängt: Housekeeping an den belegten Einheiten,
# Frühstück an den Gästen im Haus, Rezeption an den Anreisen, Wäscherei an den
# Abreisen. Haustechnik hat einen festen Grundbedarf.
#   (bereich, basis, wert, min_stunden_tag, max_stunden_tag)
PRODUKTIVITAET = [
    # Housekeeping: 1,6 Zimmer je Arbeitsstunde. Das sind ~37 Minuten je
    # Zimmer und liegt im Branchenfenster der Wechselreinigung (30–45 min).
    # Vorher stand hier 2,5 — das hätte 24 Minuten je Zimmer bedeutet, was
    # keine Reinigungskraft schafft; die Prognose hätte systematisch zu
    # wenig Personal ausgewiesen.
    ("housekeeping", "einheiten_belegt", 1.6, 4, 32),
    # Frühstück: 20 Gäste je Arbeitsstunde. WICHTIG für die Lesart der
    # Prognose: bei zwölf Zimmern greift diese Basis praktisch nie — 26 Gäste
    # ergeben 1,3 h, und die Untergrenze von 5 h (Servicezeit 06:00–11:00)
    # gewinnt. Das ist kein Fehler, sondern die Größe des Hauses: die
    # Gäste-Basis skaliert erst ab etwa hundert Gästen über die Servicezeit
    # hinaus. Dasselbe gilt für die Wäscherei. Für einen kleinen Betrieb ist
    # `fest` die ehrlichere Wahl; die Basis steht hier, damit der Demo-Bestand
    # zeigt, WIE eine Annahme aussieht, wenn sie greift.
    ("fruehstueck", "gaeste", 20, 5, 16),
    # Rezeption hängt NICHT an den Anreisen: sie ist besetzt, weil sie offen
    # ist. Darum `fest` mit 16 Stunden (Früh- plus Spätdienst) — die Anreisen
    # als Treiber hätten an einem ruhigen Tag eine halbe Stunde Rezeption
    # ergeben und die Untergrenze hätte den Wert ohnehin überschrieben, also
    # eine Rechnung ohne Wirkung mit falscher Begründung.
    ("rezeption", "fest", 16, None, None),
    # Wäscherei: vier Wäschesätze (Abreisen) je Arbeitsstunde.
    ("waescherei", "abreisen", 4, 2, 10),
    # Haustechnik hängt nicht an der Belegung: acht Stunden am Tag.
    ("haustechnik", "fest", 8, None, None),
]

# Bedarfsvorlagen (Schichthüllen, 0545): Soll-Besetzung je Bereich und
# Wochentag. Bewusst nicht flächendeckend — ein Betrieb pflegt sie dort, wo die
# Besetzung kritisch ist, und der Plan zeigt daneben die Ist-Zahl.
#   (bereich, wochentage, von, bis, anzahl)
BEDARF_VORLAGEN = [
    ("rezeption", range(0, 7), "06:30", "15:00", 1),
    ("rezeption", range(0, 7), "14:30", "23:00", 1),
    ("housekeeping", range(0, 7), "07:00", "15:30", 3),
    # Samstag und Sonntag sind Wechseltage: eine Kraft mehr.
    ("housekeeping", range(5, 7), "07:00", "15:30", 4),
    ("fruehstueck", range(0, 7), "06:00", "11:00", 2),
    ("waescherei", range(0, 5), "08:00", "14:00", 1),
]

PAUSENMODELLE = [(6 * 60, 30), (9 * 60, 45)]

# Wunsch- und Sperrzeiten. Steht als Konstante hier, weil BEIDE Seiten sie
# brauchen: `_verfuegbarkeiten` schreibt sie, und `_plan_bauen` muss die
# gesperrten Wochentage aussparen — sonst plant der Seed jemanden an seinem
# freien Tag ein, und die Oberfläche zeigt zu Recht einen Konflikt „gesperrt"
# (Wurzel 1: wer eine Restriktion setzt, muss den Gegenzustand mitpflegen).
VERFUEGBARKEITEN = [
    {"schl": "koehler", "art": "gesperrt", "wochentag": 4, "notiz": "Studium"},
    {"schl": "mensah", "art": "gesperrt", "wochentag": 2, "notiz": "Kinderbetreuung"},
    {"schl": "silva", "art": "wunsch", "wochentag": 5, "notiz": "Wochenende bevorzugt"},
    {"schl": "nowak", "art": "gesperrt", "wochentag": 0, "notiz": "Vorlesung"},
    {"schl": "ilic", "art": "wunsch", "wochentag": 6, "notiz": "Sonntag gern"},
]

# schluessel → gesperrte Wochentage (0 = Montag)
GESPERRTE_TAGE: dict[str, set[int]] = {}
for _eintrag in VERFUEGBARKEITEN:
    if _eintrag["art"] == "gesperrt":
        GESPERRTE_TAGE.setdefault(str(_eintrag["schl"]), set()).add(int(_eintrag["wochentag"]))

KRANKENKASSEN = ["AOK Nordost", "Techniker Krankenkasse", "Barmer", "DAK-Gesundheit"]


def _heute() -> date:
    return datetime.now(timezone.utc).date()


def _ts(tag: date, uhrzeit: str) -> str:
    """Ortszeit an einem Kalendertag → UTC-Zeitstempel (ISO)."""
    stunde, minute = (int(x) for x in uhrzeit.split(":")[:2])
    lokal = datetime.combine(tag, time(stunde, minute), tzinfo=ZONE)
    return lokal.astimezone(timezone.utc).isoformat()


def _ende_tag(tag: date, start: str, ende: str) -> date:
    """Nachtschicht endet am Folgetag — sonst wäre `end_at` vor `start_at`."""
    return tag + timedelta(days=1) if ende <= start else tag


def _minor(betrag: float | None) -> int | None:
    return None if betrag is None else round(betrag * 100)


def _gleiche_spalten(zeilen: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Alle Zeilen auf denselben Schlüsselsatz bringen (fehlende → NULL).

    PostgREST lehnt einen Batch mit uneinheitlichen Objekten ab
    (PGRST102 „All object keys must match"). Zeilen, die sich fachlich
    unterscheiden — ein Zertifikat hat ein Ablaufdatum, eine Sprache nicht —
    müssen deshalb auf dieselben Spalten aufgefüllt werden.
    """
    if not zeilen:
        return zeilen
    spalten = {name for zeile in zeilen for name in zeile}
    return [{name: zeile.get(name) for name in spalten} for zeile in zeilen]


# ── Stammdaten ───────────────────────────────────────────────────────────────
def _regeln(db: Supabase, tenant_id: str, admin_id: str) -> None:
    """Betriebsregeln BESTÄTIGT schreiben — ohne sie ist jede Seite 422."""
    db.upsert("personal_regeln", [{
        "tenant_id": tenant_id,
        **REGELN,
        "bestaetigt_am": _ts(_heute() - timedelta(days=120), "09:00"),
        "bestaetigt_von": admin_id,
    }], konflikt="tenant_id")


def _bereiche(db: Supabase, tenant_id: str) -> dict[str, str]:
    zeilen = [{
        "id": pid(f"personal:bereich:{b.schluessel}"),
        "tenant_id": tenant_id,
        "name": b.name,
        "kurz": b.kurz,
        "farbe": b.farbe,
        "sort": nr,
    } for nr, b in enumerate(BEREICHE)]
    db.upsert("personal_arbeitsbereiche", zeilen)
    return {b.schluessel: zeilen[nr]["id"] for nr, b in enumerate(BEREICHE)}


def _vorlagen(db: Supabase, tenant_id: str, bereich_ids: dict[str, str]) -> dict[str, str]:
    zeilen = [{
        "id": pid(f"personal:vorlage:{v.schluessel}"),
        "tenant_id": tenant_id,
        "name": v.name,
        "kurz": v.kurz,
        "start_zeit": v.start,
        "end_zeit": v.ende,
        "pause_min": v.pause_min,
        "farbe": v.farbe,
        "arbeitsbereich_id": bereich_ids[v.bereich],
        "sort": nr,
    } for nr, v in enumerate(VORLAGEN)]
    db.upsert("personal_schichtvorlagen", zeilen)
    return {v.schluessel: zeilen[nr]["id"] for nr, v in enumerate(VORLAGEN)}


def _pausen_und_firma(db: Supabase, tenant_id: str) -> str:
    db.upsert("personal_pausenmodelle", [{
        "id": pid(f"personal:pause:{ab}"),
        "tenant_id": tenant_id,
        "arbeitsbereich_id": None,
        "ab_minuten": ab,
        "pause_minuten": dauer,
    } for ab, dauer in PAUSENMODELLE])
    firma_id = pid("personal:firma:nordclean")
    db.upsert("personal_fremdfirmen", [{"id": firma_id, "tenant_id": tenant_id, **FIRMA}])
    return firma_id


def _bedarf_und_ziele(
    db: Supabase, tenant_id: str, bereich_ids: dict[str, str]
) -> tuple[int, int]:
    """Produktivitätsannahmen und Bedarfsvorlagen (0545).

    Ohne die Annahmen antwortet die KI-Prognose 422 `produktivitaet_fehlt` —
    richtig, aber im Demo-Bestand könnte niemand die Funktion ansehen. Ohne die
    Bedarfsvorlagen zeigt der Plan überall Soll 0 gegen Ist n, und die
    Autoplanung hätte nichts zu verteilen.
    """
    db.upsert("personal_produktivitaet", [{
        "id": pid(f"personal:prod:{bereich}"),
        "tenant_id": tenant_id,
        "arbeitsbereich_id": bereich_ids[bereich],
        "basis": basis,
        "wert": wert,
        "min_stunden_tag": min_std,
        "max_stunden_tag": max_std,
    } for bereich, basis, wert, min_std, max_std in PRODUKTIVITAET])

    # Die Vorlagen werden ERSETZT, nicht ergänzt: ein zweiter Lauf darf keine
    # doppelte Soll-Besetzung hinterlassen (Wurzel 1). Die IDs hängen an
    # (Bereich, Wochentag, Zeitfenster) und sind damit über Läufe hinweg
    # stabil — das allein genügt aber nicht, weil eine geänderte Konstante
    # neue IDs erzeugt und die alten Zeilen stehen blieben.
    db.delete("personal_bedarf", tenant_id=f"eq.{tenant_id}", datum="is.null")
    zeilen = []
    for bereich, tage, von, bis, anzahl in BEDARF_VORLAGEN:
        for tag in tage:
            zeilen.append({
                "id": pid(f"personal:bedarf:{bereich}:{tag}:{von}"),
                "tenant_id": tenant_id,
                "arbeitsbereich_id": bereich_ids[bereich],
                "wochentag": tag,
                "zeit_von": f"{von}:00",
                "zeit_bis": f"{bis}:00",
                "anzahl": anzahl,
                "quelle": "vorlage",
            })
    # Späterer Eintrag gewinnt: die Wochenend-Zeile für Housekeeping steht in
    # der Konstante NACH der Wochenzeile und hat dieselbe ID — so ist Sa/So mit
    # vier Kräften geplant, Mo–Fr mit drei.
    nach_id = {z["id"]: z for z in zeilen}
    db.upsert("personal_bedarf", list(nach_id.values()))
    return len(PRODUKTIVITAET), len(nach_id)


def _feiertage(db: Supabase) -> int:
    """Feiertage DE/MV für das laufende und das nächste Jahr.

    Aus dem Paket `holidays` — dieselbe Quelle wie der Worker-Tick, nicht von
    Hand eingetippt. Die Tabelle ist global (kein tenant_id), der Upsert
    deshalb idempotent über (land, region, datum).
    """
    try:
        import holidays  # noqa: PLC0415 — nur hier gebraucht
    except ImportError:
        print("  Feiertage übersprungen (Paket `holidays` fehlt)")
        return 0
    jahr = _heute().year
    zeilen = []
    for kalender_jahr in (jahr, jahr + 1):
        for tag, name in holidays.country_holidays("DE", subdiv="MV", years=kalender_jahr).items():
            zeilen.append({
                "id": demo_id(f"feiertag:DE:MV:{tag.isoformat()}"),
                "land": "DE",
                "region": "MV",
                "datum": tag.isoformat(),
                "name": name,
                "quelle": "holidays",
            })
    # KEIN Upsert: `feiertage_eindeutig` ist ein AUSDRUCKS-Index
    # (land, coalesce(region,''), datum) — darauf kann PostgREST kein
    # `on_conflict` auflösen (42P10). Stattdessen der Weg, den auch der
    # Feiertags-Import des Slice nimmt: vorhandene Jahre entfernen, dann
    # schreiben. Idempotent bleibt es dadurch trotzdem (Wurzel 2).
    db.delete(
        "feiertage",
        land="eq.DE",
        region="eq.MV",
        **{"and": f"(datum.gte.{jahr}-01-01,datum.lte.{jahr + 1}-12-31)"},
    )
    db.upsert("feiertage", zeilen)
    return len(zeilen)


# ── Personen ─────────────────────────────────────────────────────────────────
def _login(db: Supabase, tenant_id: str, person: Person, passwort: str) -> str:
    email = f"{person.schluessel}@hotel-seeblick-warnemuende.de"
    auth_id = db.auth_user_sicherstellen(
        email, passwort, {"tenant_id": tenant_id, "role": person.rolle},
    )
    db.upsert("users", [{
        "id": auth_id,
        "tenant_id": tenant_id,
        "role": person.rolle,
        "email": email,
        "full_name": f"{person.vorname} {person.nachname}",
        "phone": person.telefon,
        "preferred_language": "de",
    }])
    return auth_id


def _akte(db: Supabase, tenant_id: str, person: Person, user_id: str,
          nummer: int, firma_id: str) -> None:
    heute = _heute()
    eintritt = heute - timedelta(days=person.eintritt_vor_tagen)
    extern = person.beschaeftigungsart == "extern"
    db.upsert("personal_akten", [{
        "id": pid(f"personal:akte:{person.schluessel}"),
        "tenant_id": tenant_id,
        "user_id": user_id,
        "employee_number": f"{1000 + nummer}",
        "beschaeftigungsart": person.beschaeftigungsart,
        "firma_id": firma_id if extern else None,
        "position": person.position,
        "eintritt": eintritt.isoformat(),
        "austritt": (
            (heute + timedelta(days=person.austritt_in_tagen)).isoformat()
            if person.austritt_in_tagen else None
        ),
        "probezeit_bis": (
            (heute + timedelta(days=person.probezeit_in_tagen)).isoformat()
            if person.probezeit_in_tagen else None
        ),
        "wochenstunden": person.wochenstunden,
        "tagesstunden": round(person.wochenstunden / 5, 2),
        "arbeitstage_je_woche": 5,
        # Externe tragen KEINE Lohn-/Urlaubsfelder (CHECK in 0541) — ihre
        # Kosten hängen an der Fremdfirma.
        "stundenlohn_minor": None if extern else _minor(person.stundenlohn),
        "gehalt_minor": None if extern else _minor(person.gehalt),
        "currency": None if extern else "EUR",
        "urlaubsanspruch_tage": None if extern else person.urlaubstage,
        # Arbeitgeber-Nebenkosten in Prozent: ohne diesen Wert zeigt die
        # Kostenkachel bewusst „—" (Wurzel 4). 21 % ist der Demo-Wert des
        # Betriebs, keine gesetzliche Größe.
        "arbeitgeber_aufschlag_pct": None if extern else 21.0,
        "geburtsdatum": date(person.geburtsjahr, 3 + (nummer % 9), 5 + (nummer % 20)).isoformat(),
        "geburtsort": person.ort,
        "staatsangehoerigkeit": "DE",
        "strasse": person.strasse.rsplit(" ", 1)[0],
        "hausnummer": person.strasse.rsplit(" ", 1)[1],
        "plz": person.plz,
        "ort": person.ort,
        "land": "DE",
        "notfall_name": f"{person.nachname}, Angehörige",
        "notfall_beziehung": "Partner" if person.familienstand == "verheiratet" else "Eltern",
        "notfall_telefon": person.telefon,
        "krankenkasse": KRANKENKASSEN[nummer % len(KRANKENKASSEN)],
        "bic": "OSDDDE81ROS",
        "bank_name": "OstseeSparkasse Rostock",
        "kontoinhaber": f"{person.vorname} {person.nachname}",
        "familienstand": person.familienstand,
        "kinder_anzahl": person.kinder,
        # Landesspezifische Lohnmerkmale als Paare — KEINE deutsche
        # Auswahlliste im Modell (27 EU-Länder, 0543).
        "lohnmerkmale": [] if extern else [
            {"schluessel": "Steuerklasse",
             "wert": "3" if person.familienstand == "verheiratet" else "1"},
            {"schluessel": "Kinderfreibetrag", "wert": f"{person.kinder}.0"},
            {"schluessel": "Kirchensteuer", "wert": "nein"},
        ],
        "notiz": None,
    }], konflikt="user_id")


def _kartei(db: Supabase, tenant_id: str, person: Person, user_id: str,
            admin_id: str, wuerfel: random.Random) -> None:
    """Verträge, Nachweise, Schulungen, Gespräche, Dokumente — die Kartei (0543)."""
    heute = _heute()
    eintritt = heute - timedelta(days=person.eintritt_vor_tagen)
    extern = person.beschaeftigungsart == "extern"
    schl = person.schluessel

    if not extern:
        db.upsert("personal_vertraege", [{
            "id": pid(f"personal:vertrag:{schl}"),
            "tenant_id": tenant_id,
            "user_id": user_id,
            "art": "arbeitsvertrag",
            "titel": f"Arbeitsvertrag {person.position}",
            "beschreibung": f"{person.beschaeftigungsart.capitalize()}, "
                            f"{person.wochenstunden:g} Stunden je Woche.",
            "status": "aktiv",
            "version": "1.0",
            "unterzeichnet_am": (eintritt - timedelta(days=14)).isoformat(),
            "gueltig_ab": eintritt.isoformat(),
            "unterzeichner": [f"{person.vorname} {person.nachname}", "Jonas Reimers"],
            "bedingungen": [
                {"schluessel": "Wochenstunden", "wert": f"{person.wochenstunden:g}"},
                {"schluessel": "Urlaubstage", "wert": f"{person.urlaubstage:g}"},
                {"schluessel": "Kündigungsfrist", "wert": "4 Wochen zum Monatsende"},
            ],
            "verlaengerung": "Unbefristet.",
            "kuendigung": "§ 622 BGB, beidseitig vier Wochen zum Monatsende.",
            "erstellt_von": admin_id,
        }])
    if person.eintritt_vor_tagen > 700:
        db.upsert("personal_vertrag_nachtraege", [{
            "id": pid(f"personal:nachtrag:{schl}"),
            "tenant_id": tenant_id,
            "vertrag_id": pid(f"personal:vertrag:{schl}"),
            "datum": (heute - timedelta(days=200)).isoformat(),
            "beschreibung": "Lohnerhöhung zum Jahreswechsel",
            "grund": "Tarifanpassung",
            "aenderungen": [{
                "feld": "Stundenlohn",
                "alt": f"{(person.stundenlohn or 0) - 0.9:.2f} €",
                "neu": f"{person.stundenlohn:.2f} €",
            }],
            "autorisiert_von": admin_id,
        }])

    # Nachweise: Sprachen für alle, Zertifikate wo fachlich passend.
    nachweise = [{
        "id": pid(f"personal:nachweis:{schl}:sprache-de"),
        "tenant_id": tenant_id, "user_id": user_id, "art": "sprache",
        "titel": "Deutsch", "stufe": person.deutsch,
    }, {
        "id": pid(f"personal:nachweis:{schl}:sprache-en"),
        "tenant_id": tenant_id, "user_id": user_id, "art": "sprache",
        "titel": "Englisch", "stufe": wuerfel.choice(["b1", "b2", "c1"]),
    }]
    if "rezeption" in person.bereiche:
        nachweise.append({
            "id": pid(f"personal:nachweis:{schl}:ausbildung"),
            "tenant_id": tenant_id, "user_id": user_id, "art": "ausbildung",
            "titel": "Hotelfachfrau/-mann (IHK)", "stelle": "IHK zu Rostock",
            "stufe": "gut", "von": (eintritt - timedelta(days=1200)).isoformat(),
            "bis": (eintritt - timedelta(days=90)).isoformat(),
        })
    if "haustechnik" in person.bereiche and person.stufe == "anleitend":
        nachweise.append({
            "id": pid(f"personal:nachweis:{schl}:zert"),
            "tenant_id": tenant_id, "user_id": user_id, "art": "zertifikat",
            "titel": "Elektrofachkraft für festgelegte Tätigkeiten",
            "stelle": "TÜV Nord", "von": (heute - timedelta(days=400)).isoformat(),
            # Läuft in fünf Wochen ab → die Kartei zeigt „Läuft bald ab".
            "ablauf_am": (heute + timedelta(days=35)).isoformat(),
            "kennung": "TN-EFKffT-2025-4471",
        })
    db.upsert("personal_nachweise", _gleiche_spalten(nachweise))

    # Schulungen: Brandschutz für alle, Hygiene für Küche/Housekeeping.
    schulungen = [{
        "id": pid(f"personal:schulung:{schl}:brand"),
        "tenant_id": tenant_id, "user_id": user_id,
        "titel": "Brandschutzunterweisung",
        "trainer": "Brandschutz Nord GbR",
        "abgeschlossen_am": (heute - timedelta(days=180)).isoformat(),
        "gueltig_bis": (heute + timedelta(days=185)).isoformat(),
    }]
    if {"fruehstueck", "housekeeping"} & set(person.bereiche):
        # Bei zwei Personen bewusst abgelaufen: die Compliance-Kachel soll
        # einen echten Handlungsbedarf zeigen, keine grüne Wand.
        abgelaufen = schl in ("mensah", "ilic")
        schulungen.append({
            "id": pid(f"personal:schulung:{schl}:hygiene"),
            "tenant_id": tenant_id, "user_id": user_id,
            "titel": "Hygieneschulung nach § 43 IfSG",
            "trainer": "Gesundheitsamt Rostock",
            "abgeschlossen_am": (heute - timedelta(days=760 if abgelaufen else 120)).isoformat(),
            "gueltig_bis": (heute - timedelta(days=30) if abgelaufen
                            else heute + timedelta(days=245)).isoformat(),
        })
    db.upsert("personal_schulungen", _gleiche_spalten(schulungen))

    # Dokumente: Vertrag als abgelegtes Dokument, Gesundheitszeugnis mit Ablauf,
    # ein angefordertes (noch offenes) Dokument bei den Neuen.
    dokumente = [{
        "id": pid(f"personal:dok:{schl}:vertrag"),
        "tenant_id": tenant_id, "user_id": user_id, "art": "vertrag",
        "titel": "Arbeitsvertrag (unterschrieben)",
        # Kein storage_pfad: der Seed lädt keine Personaldateien hoch; der
        # Eintrag steht als angefordert. Eine erfundene Datei wäre schlimmer
        # als ein ehrlich offener Eintrag.
        "angefragt_am": _ts(eintritt, "09:00"),
    }]
    if {"fruehstueck", "housekeeping"} & set(person.bereiche):
        dokumente.append({
            "id": pid(f"personal:dok:{schl}:gesundheit"),
            "tenant_id": tenant_id, "user_id": user_id, "art": "gesundheitszeugnis",
            "titel": "Belehrung nach § 43 IfSG",
            "dokument_nummer": f"IfSG-{2000 + len(schl)}-{schl[:3].upper()}",
            "behoerde": "Gesundheitsamt Rostock",
            "ausgestellt_am": (heute - timedelta(days=120)).isoformat(),
            "ablauf_am": (heute + timedelta(days=610)).isoformat(),
            "angefragt_am": _ts(eintritt, "09:00"),
        })
    if person.eintritt_vor_tagen < 400:
        dokumente.append({
            "id": pid(f"personal:dok:{schl}:ausweis"),
            "tenant_id": tenant_id, "user_id": user_id, "art": "ausweis",
            "titel": "Ausweiskopie",
            "angefragt_am": _ts(heute - timedelta(days=6), "10:15"),
        })
    db.upsert("personal_dokumente", _gleiche_spalten(dokumente))

    # Gespräche: Jahresgespräch für alle Festangestellten, Probezeitgespräch
    # für die Neuen — mit Bewertung, Zielen und Erfolgen.
    if not extern and person.eintritt_vor_tagen > 200:
        db.upsert("personal_gespraeche", [{
            "id": pid(f"personal:gespraech:{schl}"),
            "tenant_id": tenant_id, "user_id": user_id,
            "datum": (heute - timedelta(days=95)).isoformat(),
            "art": "jahresgespraech",
            "bewertung": wuerfel.choice([3, 4, 4, 5]),
            "notizen": "Zuverlässig, gute Rückmeldungen von Gästen. "
                       "Wunsch nach mehr Frühdiensten wurde aufgenommen.",
            "ziele": ["Einarbeitung neuer Kolleginnen begleiten",
                      "Qualitätsstandard Zimmerkontrolle halten"],
            "erfolge": ["Gästebewertung Sauberkeit über 9,0 gehalten"],
            "entwicklung": ["Englisch im Gästekontakt"],
            "gefuehrt_von": admin_id,
            "naechstes_am": (heute + timedelta(days=270)).isoformat(),
        }])


def _massnahme_und_vorfall(db: Supabase, tenant_id: str, user_ids: dict[str, str],
                           admin_id: str) -> None:
    """Je eine Maßnahme und ein Vorfall — der Reiter Disziplin darf nicht leer sein.

    Bewusst sparsam und harmlos: ein Demo-Betrieb braucht ein Beispiel, keine
    Personalakte voller Abmahnungen.
    """
    heute = _heute()
    db.upsert("personal_massnahmen", [{
        "id": pid("personal:massnahme:nowak"),
        "tenant_id": tenant_id,
        "user_id": user_ids["nowak"],
        "art": "ermahnung",
        "datum": (heute - timedelta(days=48)).isoformat(),
        "grund": "Zweimal unentschuldigt zu spät zum Frühdienst",
        "beschreibung": "Frühstücksdienst begann jeweils rund 20 Minuten verspätet; "
                        "die Kollegin musste allein eindecken.",
        "ausgestellt_von": admin_id,
        "zeuge": "Katrin Wagner",
        "stellungnahme": "Verspätung durch Busausfall; Fahrgemeinschaft ist vereinbart.",
        "folgetermin": (heute - timedelta(days=20)).isoformat(),
        "geloest": True,
        "geloest_am": (heute - timedelta(days=18)).isoformat(),
        "loesung": "Seither pünktlich. Vereinbarung gilt weiter.",
    }])
    db.upsert("personal_vorfaelle", [{
        "id": pid("personal:vorfall:ilic"),
        "tenant_id": tenant_id,
        "user_id": user_ids["ilic"],
        "datum": (heute - timedelta(days=26)).isoformat(),
        "art": "unfall",
        "schwere": "gering",
        "ort": "Treppenhaus 2. OG",
        "beschreibung": "Ausrutschen auf frisch gewischter Stufe, Prellung am Knie. "
                        "Keine Arbeitsunfähigkeit.",
        "zeugen": ["Agnieszka Dąbrowska"],
        "massnahmen": "Erstversorgung im Haus, Eintrag ins Verbandbuch.",
        "praevention": "Warnaufsteller sind ab sofort Pflicht, auch bei kurzen Wischgängen.",
        "gemeldet_von": admin_id,
        "folge_noetig": False,
    }])


# ── Einsatz: Freigaben, Qualifikation, Verfügbarkeit ─────────────────────────
def _freigaben(db: Supabase, tenant_id: str, user_id: str, schluessel: str,
               objekt_ids: list[str]) -> None:
    """Objektfreigaben — ohne sie sieht die Schichtleitung niemanden (Wurzel 3)."""
    db.upsert("staff_property_assignments", [{
        "id": pid(f"personal:freigabe:{schluessel}:{property_id}"),
        "tenant_id": tenant_id,
        "user_id": user_id,
        "property_id": property_id,
    } for property_id in objekt_ids])


def _qualifikationen(db: Supabase, tenant_id: str, person: Person, user_id: str,
                     bereich_ids: dict[str, str]) -> None:
    db.upsert("personal_qualifikationen", [{
        "id": pid(f"personal:quali:{person.schluessel}:{bereich}"),
        "tenant_id": tenant_id,
        "user_id": user_id,
        "arbeitsbereich_id": bereich_ids[bereich],
        "property_id": None,
        # Nur im Hauptbereich anleitend/lernend, sonst selbstständig.
        "stufe": person.stufe if nr == 0 else "selbststaendig",
    } for nr, bereich in enumerate(person.bereiche)])


def _verfuegbarkeiten(db: Supabase, tenant_id: str, user_ids: dict[str, str]) -> int:
    """Wunsch- und Sperrzeiten — der Planer sieht, warum eine Zelle leer bleibt."""
    heute = _heute()
    zeilen = VERFUEGBARKEITEN
    db.upsert("personal_verfuegbarkeiten", [{
        "id": pid(f"personal:verf:{z['schl']}:{z['wochentag']}"),
        "tenant_id": tenant_id,
        "user_id": user_ids[z["schl"]],
        "art": z["art"],
        "wiederkehrend_wochentag": z["wochentag"],
        "datum_von": None,
        "datum_bis": None,
        "ganztags": True,
        "zeit_von": None,
        "zeit_bis": None,
        "notiz": z["notiz"],
    } for z in zeilen])
    # Eine Urlaubssperre in der Hochsaison — der Grund steht dabei.
    sommer_start = date(heute.year if heute.month <= 8 else heute.year + 1, 7, 1)
    db.upsert("personal_urlaubssperren", [{
        "id": pid("personal:sperre:hochsaison"),
        "tenant_id": tenant_id,
        "von": sommer_start.isoformat(),
        "bis": (sommer_start + timedelta(days=45)).isoformat(),
        "grund": "Hochsaison Warnemünde — Urlaub nur in Ausnahmefällen",
        "arbeitsbereich_id": None,
    }])
    return len(zeilen)


# ── Urlaub, Abwesenheit ──────────────────────────────────────────────────────
def _urlaubskonten(db: Supabase, tenant_id: str, personen: list[Person],
                   user_ids: dict[str, str]) -> None:
    jahr = _heute().year
    db.upsert("personal_urlaubskonten", [{
        "id": pid(f"personal:urlaubskonto:{p.schluessel}:{jahr}"),
        "tenant_id": tenant_id,
        "user_id": user_ids[p.schluessel],
        "jahr": jahr,
        "anspruch": p.urlaubstage,
        "uebertrag": 3 if p.eintritt_vor_tagen > 400 else 0,
        "verfall_am": date(jahr, 3, 31).isoformat(),
        "korrektur": 0,
        "korrektur_grund": None,
    } for p in personen if p.beschaeftigungsart != "extern"],
        konflikt="tenant_id,user_id,jahr")


def _abwesenheiten(db: Supabase, tenant_id: str, user_ids: dict[str, str],
                   admin_id: str) -> list[dict[str, Any]]:
    """Genehmigte, offene und abgelehnte Anträge — alle vier Zustände sichtbar."""
    heute = _heute()
    entwurf = [
        # (Person, Art, Start-Versatz, Tage, Status)
        ("brandt", "urlaub", 21, 12, "genehmigt"),
        ("dabrowska", "urlaub", 40, 10, "genehmigt"),
        ("timm", "urlaub", -9, 5, "genehmigt"),
        ("koehler", "urlaub", 34, 7, "beantragt"),
        ("silva", "frei", 12, 1, "beantragt"),
        ("mensah", "urlaub", 5, 4, "beantragt"),
        ("radu", "krank", -4, 3, "genehmigt"),
        ("nowak", "urlaub", 3, 9, "abgelehnt"),
        ("ilic", "schulung", 16, 2, "genehmigt"),
        ("schulz", "unbezahlt", -30, 400, "genehmigt"),
    ]
    zeilen = []
    for schl, art, versatz, tage, status in entwurf:
        von = heute + timedelta(days=versatz)
        bis = von + timedelta(days=tage - 1)
        entschieden = status in ("genehmigt", "abgelehnt")
        zeilen.append({
            "id": pid(f"personal:abw:{schl}:{art}:{versatz}"),
            "tenant_id": tenant_id,
            "user_id": user_ids[schl],
            "art": art,
            "von": von.isoformat(),
            "bis": bis.isoformat(),
            "halbtag_start": False,
            "halbtag_ende": False,
            # Werktage im Zeitraum (Mo–Fr) — dieselbe Zählbasis wie der Dienst.
            "tage_berechnet": sum(
                1 for n in range(tage) if (von + timedelta(days=n)).weekday() < 5
            ),
            "status": status,
            "grund": {
                "krank": "Krankmeldung telefonisch, AU liegt vor.",
                "schulung": "Einweisung Reinigungschemie (Lieferant).",
                "unbezahlt": "Elternzeit.",
                "frei": "Familienfeier.",
            }.get(art),
            "kommentar_entscheidung": (
                "In diesem Zeitraum fehlt sonst die Besetzung im Frühstück."
                if status == "abgelehnt" else None
            ),
            "entschieden_von": admin_id if entschieden else None,
            "entschieden_am": _ts(heute - timedelta(days=3), "10:30") if entschieden else None,
        })
    db.upsert("personal_abwesenheiten", zeilen)
    return zeilen


# ── Dienstplan ───────────────────────────────────────────────────────────────
def _plan_bauen(heute: date,  # pylint: disable=too-many-branches
                abwesend: dict[str, set[str]]) -> list[dict[str, Any]]:
    """Wer arbeitet wann — Schichtzuteilung ohne DB, damit sie prüfbar bleibt.

    Regeln, die der Plan einhält (sonst zeigt die Oberfläche zu Recht Konflikte):
    * niemand arbeitet an einem Tag, an dem er abwesend ist,
    * höchstens eine Schicht je Person und Tag,
    * fünf Arbeitstage je Woche, danach frei,
    * nach dem Nachtdienst am Folgetag frei (Ruhezeit 11 h).
    """
    wuerfel = random.Random(KEIM)
    zuteilung = {
        "rez_frueh": ["wagner", "brandt", "koehler"],
        "rez_spaet": ["brandt", "koehler", "wagner"],
        "rez_nacht": ["brandt", "nowak"],
        "hk_tag": ["okoro", "dabrowska", "mensah", "keskin"],
        "hk_spaet": ["ilic", "araujo", "dabrowska"],
        "fs_frueh": ["silva", "nowak", "koehler"],
        "ht_tag": ["timm"],
        "wa_tag": ["radu", "araujo"],
    }
    # Nachtdienst am Vortag → heute frei; je Person Zähler der Woche.
    nach_nacht: dict[str, date] = {}
    woche_zaehler: dict[tuple[str, int], int] = {}
    schichten: list[dict[str, Any]] = []

    for versatz in range(-TAGE_ZURUECK, TAGE_VORAUS + 1):
        tag = heute + timedelta(days=versatz)
        iso = tag.isoformat()
        kw = tag.isocalendar()[1]
        belegt_heute: set[str] = set()
        # Wochenende: Frühstück und Housekeeping laufen weiter, Haustechnik nicht.
        for vorlage in VORLAGEN:
            if vorlage.schluessel == "ht_tag" and tag.weekday() >= 5:
                continue
            bedarf = 2 if vorlage.schluessel in ("hk_tag", "rez_frueh") else 1
            if vorlage.schluessel == "hk_tag" and tag.weekday() >= 5:
                bedarf = 3  # Wechseltag: mehr Zimmer
            kandidaten = [
                s for s in zuteilung[vorlage.schluessel]
                if s not in belegt_heute
                and iso not in abwesend.get(s, set())
                and tag.weekday() not in GESPERRTE_TAGE.get(s, set())
                and nach_nacht.get(s) != tag
                and woche_zaehler.get((s, kw), 0) < 5
            ]
            for schluessel in kandidaten[:bedarf]:
                belegt_heute.add(schluessel)
                woche_zaehler[(schluessel, kw)] = woche_zaehler.get((schluessel, kw), 0) + 1
                if vorlage.schluessel == "rez_nacht":
                    nach_nacht[schluessel] = tag + timedelta(days=1)
                schichten.append({
                    "person": schluessel, "vorlage": vorlage, "tag": tag,
                })
            # Unbesetzt gebliebener Bedarf in der Zukunft = offene Schicht
            # (user_id NULL). In der Vergangenheit wäre das ein Loch im Ist,
            # kein Angebot — deshalb nur voraus.
            offen = bedarf - len(kandidaten[:bedarf])
            if offen > 0 and versatz > 2:
                for nummer in range(offen):
                    schichten.append({
                        "person": None, "vorlage": vorlage, "tag": tag, "nr": nummer,
                    })
    wuerfel.shuffle(schichten)
    return schichten


def _schichten_schreiben(db: Supabase, tenant_id: str, admin_id: str,
                         plan: list[dict[str, Any]], user_ids: dict[str, str],
                         bereich_ids: dict[str, str], vorlage_ids: dict[str, str],
                         objekt_ids: list[str]) -> tuple[int, int]:
    """Schichten schreiben: Vergangenheit bestätigt, Zukunft veröffentlicht."""
    heute = _heute()
    wuerfel = random.Random(KEIM + 7)
    zeilen = []
    for eintrag in plan:
        vorlage: Vorlage = eintrag["vorlage"]
        tag: date = eintrag["tag"]
        schluessel = eintrag["person"]
        ende_tag = _ende_tag(tag, vorlage.start, vorlage.ende)
        offen = schluessel is None
        kennung = (f"personal:schicht:{tag.isoformat()}:{vorlage.schluessel}:"
                   f"{schluessel or 'offen' + str(eintrag.get('nr', 0))}")
        if tag < heute:
            status = "bestaetigt"
        elif offen:
            status = "veroeffentlicht"
        else:
            status = "veroeffentlicht"
        zeilen.append({
            "id": pid(kennung),
            "tenant_id": tenant_id,
            "user_id": None if offen else user_ids[schluessel],
            "datum": tag.isoformat(),
            "start_at": _ts(tag, vorlage.start),
            "end_at": _ts(ende_tag, vorlage.ende),
            "pause_min": vorlage.pause_min,
            "arbeitsbereich_id": bereich_ids[vorlage.bereich],
            # Housekeeping hängt am Zimmer, die übrigen Bereiche am Haus.
            "property_id": (wuerfel.choice(objekt_ids)
                            if vorlage.bereich in ("housekeeping", "waescherei") else None),
            "vorlage_id": vorlage_ids[vorlage.schluessel],
            "status": status,
            "quelle": "vorlage",
            "bestaetigt_am": _ts(tag - timedelta(days=5), "18:00") if tag < heute else None,
            "notiz": None,
            "erstellt_von": admin_id,
        })
    db.upsert("personal_schichten", zeilen)
    offene = sum(1 for z in zeilen if z["user_id"] is None)
    return len(zeilen), offene


def _veroeffentlichen(db: Supabase, tenant_id: str, admin_id: str,
                      user_ids: dict[str, str]) -> int:
    """Veröffentlichungen je Woche + Lesebestätigungen der meisten Leute."""
    heute = _heute()
    montag = heute - timedelta(days=heute.weekday())
    wuerfel = random.Random(KEIM + 11)
    veroeffentlichungen, bestaetigungen = [], []
    for woche in range(-2, 4):
        start = montag + timedelta(weeks=woche)
        veroeff_id = pid(f"personal:veroeff:{start.isoformat()}")
        veroeffentlichungen.append({
            "id": veroeff_id,
            "tenant_id": tenant_id,
            "woche_start": start.isoformat(),
            "veroeffentlicht_von": admin_id,
            "veroeffentlicht_am": _ts(start - timedelta(days=6), "16:00"),
        })
        # Nicht alle bestätigen — genau das zeigt die Lesebestätigungs-Spalte.
        for schluessel, user_id in user_ids.items():
            if wuerfel.random() < 0.25:
                continue
            bestaetigungen.append({
                "id": pid(f"personal:gelesen:{start.isoformat()}:{schluessel}"),
                "veroeffentlichung_id": veroeff_id,
                "tenant_id": tenant_id,
                "user_id": user_id,
                "bestaetigt_am": _ts(start - timedelta(days=5), "08:30"),
            })
    db.upsert("personal_veroeffentlichungen", veroeffentlichungen)
    db.upsert("personal_lesebestaetigungen", bestaetigungen)
    return len(veroeffentlichungen)


def _bewerbungen(db: Supabase, tenant_id: str, user_ids: dict[str, str]) -> int:
    """Bewerbungen auf offene Schichten — der Dialog „Bewerbungen" hat Inhalt."""
    offene = db.select(
        "personal_schichten",
        tenant_id=f"eq.{tenant_id}",
        user_id="is.null",
        datum=f"gte.{(_heute() + timedelta(days=3)).isoformat()}",
        select="id,datum",
        order="datum.asc",
        limit="6",
    )
    wuerfel = random.Random(KEIM + 13)
    kandidaten = [s for s in ("nowak", "ilic", "mensah", "koehler") if s in user_ids]
    zeilen = []
    for schicht in offene[:4]:
        for schluessel in wuerfel.sample(kandidaten, k=min(2, len(kandidaten))):
            zeilen.append({
                "id": pid(f"personal:bewerbung:{schicht['id']}:{schluessel}"),
                "tenant_id": tenant_id,
                "schicht_id": schicht["id"],
                "user_id": user_ids[schluessel],
                "status": "offen",
            })
    db.upsert("personal_schicht_bewerbungen", zeilen)
    return len(zeilen)


# ── Zeiterfassung ────────────────────────────────────────────────────────────
def _zeiten(db: Supabase, tenant_id: str, admin_id: str,
            user_ids: dict[str, str]) -> tuple[int, int]:
    """Ist-Zeiten zu den vergangenen Schichten — Grundlage von Auswertung und AZK.

    Die Abweichung zum Plan ist gewollt und klein (−10 bis +35 Minuten): so
    zeigt der Plan-Ist-Abgleich echte Zahlen statt einer Reihe von Nullen.
    """
    heute = _heute()
    wuerfel = random.Random(KEIM + 17)
    vergangene = db.select(
        "personal_schichten",
        tenant_id=f"eq.{tenant_id}",
        user_id="not.is.null",
        datum=f"lt.{heute.isoformat()}",
        select="id,user_id,datum,start_at,end_at,pause_min,property_id",
        order="datum.asc",
        limit="1000",
    )
    zeilen, korrekturen = [], []
    for schicht in vergangene:
        start = datetime.fromisoformat(schicht["start_at"])
        ende = datetime.fromisoformat(schicht["end_at"])
        ist_start = start + timedelta(minutes=wuerfel.choice([-5, 0, 0, 3, 6]))
        ist_ende = ende + timedelta(minutes=wuerfel.choice([-10, 0, 0, 5, 12, 25, 35]))
        pause_start = ist_start + (ist_ende - ist_start) / 2
        pause_min = schicht["pause_min"]
        datum = date.fromisoformat(schicht["datum"])
        # Die letzten drei Tage bleiben „abgeschlossen" (noch nicht bestätigt),
        # damit die Leitung im Demo etwas zu bestätigen hat.
        bestaetigt = datum < heute - timedelta(days=3)
        zeilen.append({
            "id": pid(f"personal:zeit:{schicht['id']}"),
            "tenant_id": tenant_id,
            "user_id": schicht["user_id"],
            "start_at": ist_start.isoformat(),
            "end_at": ist_ende.isoformat(),
            "pausen": [{
                "start": pause_start.isoformat(),
                "end": (pause_start + timedelta(minutes=pause_min)).isoformat(),
            }],
            "quelle": "app",
            "schicht_id": schicht["id"],
            "property_id": schicht["property_id"],
            "status": "bestaetigt" if bestaetigt else "abgeschlossen",
            "bestaetigt_von": admin_id if bestaetigt else None,
            "bestaetigt_am": _ts(datum + timedelta(days=2), "09:00") if bestaetigt else None,
            "idempotenz_key": None,
            "notiz": None,
        })
    db.upsert("personal_zeiterfassung", zeilen)

    # Eine nachvollziehbare Korrektur mit Grund — der Reiter Korrekturen ist
    # sonst leer, und genau er belegt die Revisionssicherheit.
    if zeilen:
        ziel = zeilen[len(zeilen) // 2]
        korrekturen.append({
            "id": pid(f"personal:korrektur:{ziel['id']}"),
            "tenant_id": tenant_id,
            "zeiterfassung_id": ziel["id"],
            "korrigiert_von": admin_id,
            "grund": "Vergessenes Ausstempeln nach Spätdienst; Ende laut Übergabebuch.",
            "alt": {"end_at": ziel["end_at"]},
            "neu": {"end_at": ziel["end_at"]},
        })
        db.upsert("personal_zeit_korrekturen", korrekturen)
    return len(zeilen), len(korrekturen)


def _arbeitszeitkonten(db: Supabase, tenant_id: str, user_ids: dict[str, str]) -> int:
    """Übertrag und Abbau — das AZK zeigt einen Saldo statt einer Null."""
    heute = _heute()
    wuerfel = random.Random(KEIM + 19)
    zeilen = []
    for schluessel, user_id in user_ids.items():
        uebertrag = wuerfel.choice([-180, 0, 120, 240, 360, 480])
        if uebertrag:
            zeilen.append({
                "id": pid(f"personal:azk:{schluessel}:uebertrag"),
                "tenant_id": tenant_id,
                "user_id": user_id,
                "datum": date(heute.year, 1, 1).isoformat(),
                "minuten": uebertrag,
                "grund": "uebertrag",
                "notiz": "Übertrag aus dem Vorjahr",
            })
        if uebertrag > 300:
            zeilen.append({
                "id": pid(f"personal:azk:{schluessel}:abbau"),
                "tenant_id": tenant_id,
                "user_id": user_id,
                "datum": (heute - timedelta(days=45)).isoformat(),
                "minuten": -240,
                "grund": "abbau",
                "notiz": "Freier Tag zum Abbau",
            })
    db.upsert("personal_arbeitszeitkonten", zeilen)
    return len(zeilen)


def _alten_plan_entfernen(db: Supabase, tenant_id: str) -> None:
    """Dienstplan, Zeiten und Anträge des Demo-Betriebs vorher abräumen.

    Die IDs der Schichten hängen an (Tag, Vorlage, Person). Ändert sich die
    Zuteilung — etwa weil eine Sperrzeit dazukommt —, entstehen NEUE IDs, und
    die alten Zeilen bleiben als Karteileichen stehen: der Plan zeigt dann
    Doppelbesetzungen, die nie geplant wurden. Ein Upsert allein macht diesen
    Seed also nicht idempotent (Wurzel 1: der Gegenzustand gehört mitgepflegt).

    Reihenfolge nach Fremdschlüsseln: Zeiten und Bewerbungen hängen an
    Schichten, Lesebestätigungen an Veröffentlichungen.
    """
    filter_ = {"tenant_id": f"eq.{tenant_id}"}
    for tabelle in ("personal_zeit_korrekturen", "personal_zeiterfassung",
                    "personal_schicht_bewerbungen", "personal_schicht_aenderungen",
                    "personal_schichten", "personal_lesebestaetigungen",
                    "personal_veroeffentlichungen", "personal_abwesenheiten",
                    "personal_arbeitszeitkonten"):
        db.delete(tabelle, **filter_)


# ── Einstieg ─────────────────────────────────────────────────────────────────
# Mandantenspezifische ID des laufenden Aufbaus.
#
# WARUM (07.09.2026): alle Personal-IDs entstanden aus `demo_id("personal:…")`
# OHNE den Betrieb. Seeblick und Alpenzeit teilen aber dieselbe Personenliste,
# erzeugten damit BYTEGLEICHE UUIDs — und der zweite Lauf brach mit
# „duplicate key … personal_urlaubskonten_pkey" ab, weil der ON-CONFLICT auf
# `(tenant_id, user_id, jahr)` zeigt und die kollidierende `id` gar nicht sieht
# (Wurzel 2: der Idempotenz-Schlüssel muss derselbe sein wie der Konflikt-
# Schlüssel). Alpenzeit blieb dadurch ohne Personal.
#
# Ein Modul-globaler Wert statt eines Parameters durch 31 Aufrufstellen: der
# Aufbau läuft je Betrieb streng nacheinander, nie verschachtelt.
_TENANT: str = ""


def pid(schluessel: str) -> str:
    """Deterministische ID, die den Mandanten einschließt."""
    return demo_id(f"{_TENANT}:{schluessel}")


def personal_anlegen(db: Supabase, tenant_id: str, admin_id: str,  # noqa: PLR0913
                     objekt_ids: list[str], passwort: str) -> None:
    """Den gesamten Personalbereich des Betriebs aufbauen."""
    global _TENANT  # noqa: PLW0603  # siehe Kommentar an `_TENANT`
    _TENANT = tenant_id
    heute = _heute()
    wuerfel = random.Random(KEIM + 3)

    _alten_plan_entfernen(db, tenant_id)
    _regeln(db, tenant_id, admin_id)
    feiertage = _feiertage(db)
    bereich_ids = _bereiche(db, tenant_id)
    vorlage_ids = _vorlagen(db, tenant_id, bereich_ids)
    firma_id = _pausen_und_firma(db, tenant_id)
    annahmen, bedarfszeilen = _bedarf_und_ziele(db, tenant_id, bereich_ids)
    print(f"  Regeln bestätigt, {len(bereich_ids)} Arbeitsbereiche, "
          f"{len(vorlage_ids)} Vorlagen, {feiertage} Feiertage")
    print(f"  {annahmen} Produktivitätsannahmen, {bedarfszeilen} Bedarfsvorlagen, "
          f"Kennzahlen-Ziel 65,00 EUR je Stunde")

    user_ids: dict[str, str] = {}
    for nummer, person in enumerate(PERSONEN):
        user_id = _login(db, tenant_id, person, passwort)
        user_ids[person.schluessel] = user_id
        _akte(db, tenant_id, person, user_id, nummer, firma_id)
        _kartei(db, tenant_id, person, user_id, admin_id, wuerfel)
        _qualifikationen(db, tenant_id, person, user_id, bereich_ids)
        # Housekeeping/Wäscherei sind allen Zimmern zugeordnet, Rezeption und
        # Haustechnik ebenfalls — im Hotel arbeitet niemand an nur einem Zimmer.
        _freigaben(db, tenant_id, user_id, person.schluessel, objekt_ids)
    print(f"  {len(user_ids)} Mitarbeitende mit Akte, Kartei und Objektfreigaben")

    _massnahme_und_vorfall(db, tenant_id, user_ids, admin_id)
    verf = _verfuegbarkeiten(db, tenant_id, user_ids)
    _urlaubskonten(db, tenant_id, PERSONEN, user_ids)
    abwesenheiten = _abwesenheiten(db, tenant_id, user_ids, admin_id)
    print(f"  {len(abwesenheiten)} Abwesenheiten, {verf} Verfügbarkeiten, "
          f"Urlaubskonten {heute.year}")

    # Genehmigte Abwesenheiten blocken den Plan — sonst stünde jemand im
    # Dienstplan, der laut Antrag im Urlaub ist (Wurzel 1: Gegenzustand).
    abwesend: dict[str, set[str]] = {}
    umkehr = {v: k for k, v in user_ids.items()}
    for eintrag in abwesenheiten:
        if eintrag["status"] != "genehmigt":
            continue
        schluessel = umkehr[eintrag["user_id"]]
        von = date.fromisoformat(eintrag["von"])
        bis = date.fromisoformat(eintrag["bis"])
        tage = abwesend.setdefault(schluessel, set())
        for n in range((bis - von).days + 1):
            tage.add((von + timedelta(days=n)).isoformat())

    plan = _plan_bauen(heute, abwesend)
    anzahl, offene = _schichten_schreiben(
        db, tenant_id, admin_id, plan, user_ids, bereich_ids, vorlage_ids, objekt_ids,
    )
    wochen = _veroeffentlichen(db, tenant_id, admin_id, user_ids)
    bewerbungen = _bewerbungen(db, tenant_id, user_ids)
    print(f"  {anzahl} Schichten ({offene} offen), {wochen} Wochen veröffentlicht, "
          f"{bewerbungen} Bewerbungen")

    zeiten, korrekturen = _zeiten(db, tenant_id, admin_id, user_ids)
    azk = _arbeitszeitkonten(db, tenant_id, user_ids)
    print(f"  {zeiten} erfasste Zeiten ({korrekturen} Korrektur), {azk} AZK-Buchungen")
