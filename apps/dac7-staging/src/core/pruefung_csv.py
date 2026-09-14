"""Die CSV-Pruefung der Empfangsstelle.

Sie liest die eingereichte Datei so, wie es eine Behoerde taete: ohne
Kenntnis davon, wie sie entstanden ist. Geprueft wird gegen `vorlage.py` —
die unabhaengige zweite Lesung der amtlichen Vorlage.

AUFBAU DER DATEI (Blatt `Indberetning` der Vorlage)
===================================================
Eine Kopfzeile mit 89 Spaltennamen, danach je Datensatz eine Zeile. Die
erste Spalte `ROW_TYPE` sagt, was die Zeile ist:

    Message                     genau einmal, als erste Zeile
    PO_Platform_Operator        der meldende Betrieb
    RS_IND_Individual_Seller    ein Verkaeufer (natuerliche Person)
    RS_ENT_Entity_Seller        ein Verkaeufer (Gesellschaft)
    ACT_Immovable_Property      eine vermietete Immobilie, je Objekt eine

Die Zugehoerigkeit entsteht ueber `RS_DOC_REF_ID` und die REIHENFOLGE der
Zeilen, nicht durch Wiederholung der Kennungen: Ein Objekt gehoert zu dem
Verkaeufer, dessen Kennung es traegt.

WAS HIER BEWUSST NICHT PASSIERT
================================
Kein Zugriff auf unsere Datenbank, kein Import aus `apps/api`. Die
Empfangsstelle sieht ausschliesslich die Bytes, die sie bekommen hat —
genau wie die echte Behoerde.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation

from . import vorlage

# Zeilentypen, die eine vermietete Immobilie beschreiben.
_AKTIVITAET = "ACT_Immovable_Property"
_VERKAEUFER = ("RS_IND_Individual_Seller", "RS_ENT_Entity_Seller")

# Spalten, die genau EINMAL in der Datei vorkommen duerfen.
_EINMALIG = ("MSG_MESSAGE_REF_ID", "PO_DOC_REF_ID")

# Pflichtspalten je Zeilentyp. Quelle: Blatt `Vejledningstekster`,
# Kardinalitaet 1..1 in Verbindung mit der Belegung des Blattes `Kolonner`.
_PFLICHT: dict[str, tuple[str, ...]] = {
    "Message": (
        "MSG_MESSAGE_REF_ID",
        "MSG_MESSAGE_TYPE_INDIC",
        "MSG_REPORTING_PERIOD",
        "MSG_VERSION",
    ),
    # `MSG_SENDING_ENTITY_IN` steht hier bewusst NICHT: Die Feldtabelle
    # `Vejledningstekster` fuehrt es mit Kardinalitaet 0..1, also optional.
    # Die echte Meldung der Vorlage fuellt es zwar (mit der CVR), das macht
    # es aber nicht zur Pflicht. Aufgefallen beim ersten Kreuztest gegen
    # unsere erzeugte Datei — dort war die Empfangsstelle strenger als die
    # Vorlage, nicht die Erzeugung zu lax.
    # `RESIDENCE` steht hier bewusst NICHT: Die Feldtabelle fuehrt es beim
    # Betreiber mit `0..*` (R27) — dort erfuellt `PO_NEXUS` die Funktion.
    # Bis zum 11.09.2026 stand es hier als Pflicht und erzeugte damit einen
    # Falsch-Fehler gegen eine KORREKTE Datei. Dass alle fuenf
    # Beispielblaetter es fuellen, macht es nicht zur Pflicht (dieselbe
    # Verwechslung wie bei `MSG_SENDING_ENTITY_IN`).
    "PO_Platform_Operator": (
        "PO_DOC_REF_ID",
        "DOC_TYPE_INDIC",
        "TIN",
        "TIN_ISSUED_BY",
        "ADDR_COUNTRY",
        # R44 `1..*` samt der Regel „For rowtype PO_Platform_Operator skal
        # mindst én adresse af typen OECD304 være angivet" — die Art selbst
        # ist damit Pflicht, der Wert OECD304 wird unten geprueft.
        "ADDR_LEGAL_ADDRESS_TYPE",
        # R50 `1..1`.
        "ORGANISATION_NAME",
    ),
    # `TIN` und `TIN_ISSUED_BY`: R174/R175, Kardinalitaet `1..1`. Sie
    # fehlten hier bis zum 11.09.2026 — eine fremde Meldung ohne
    # Steuernummer des Vermieters wurde angenommen, obwohl sie bei DAC7 der
    # Zweck der Meldung ist.
    #
    # `TIN_UNKNOWN` steht NICHT dabei, obwohl R176 ebenfalls `1..1` fuehrt:
    # Die `1..1` gilt innerhalb der Wiederholgruppe `RS_TIN` (Spalte F der
    # Feldtabelle), nicht fuer die Zeile. Belegt durch die Beispielblaetter
    # — in KEINER der sechs Verkaeuferzeilen aller fuenf Beispiele ist
    # `TIN_UNKNOWN` gefuellt, waehrend die Betreiberzeilen es mit `0`
    # tragen. Als unbedingte Pflicht gefuehrt, wuerde die Pruefung jede
    # amtliche Beispieldatei abweisen.
    "RS_IND_Individual_Seller": (
        "RS_DOC_REF_ID",
        "DOC_TYPE_INDIC",
        "RESIDENCE",
        "ADDR_COUNTRY",
        "TIN",
        "TIN_ISSUED_BY",
        "RS_NM_FIRST_NAME",
        "RS_NM_LAST_NAME",
        "RS_BIRTH_DATE",
    ),
    "RS_ENT_Entity_Seller": (
        "RS_DOC_REF_ID",
        "DOC_TYPE_INDIC",
        "RESIDENCE",
        "ADDR_COUNTRY",
        # R131/R132 `1..1` — siehe die Begruendung beim Individual Seller.
        "TIN",
        "TIN_ISSUED_BY",
        # `ORGANISATION_NAME`, nicht `RS_ENT_ORGANISATION_NAME`: Die Spalte
        # heisst in der Vorlage ohne Praefix und wird von Betreiber- UND
        # Firmenzeile geteilt. Hier stand ein erfundener Name — die Pruefung
        # verlangte damit ein Feld, das es nicht gibt, und wies jede Meldung
        # mit einer Gesellschaft als Verkaeufer ab. Aufgefallen an der
        # Demo-Meldung, nicht an einem Test: Die Testdaten hatten keine
        # Firmenzeile.
        "ORGANISATION_NAME",
    ),
    _AKTIVITAET: (
        "RS_DOC_REF_ID",
        "ADDR_COUNTRY",
    ),
}

# Die Quartalsspalten einer Taetigkeitszeile.
#
# WARUM KEINE DAVON EINZELN PFLICHT IST: Die Feldtabelle fuehrt alle 28
# mit `1..1` (R231–R261). Die amtlichen BEISPIELBLAETTER lassen sie aber
# quartalsweise leer — `Eksempel 2.1 Initiel` Zeile 7 traegt nur Q1
# (ein Objekt, das nur im ersten Quartal vermietet war), Q2–Q4 sind leer.
# Beides gleichzeitig kann nicht gelten.
#
# Aufgeloest zugunsten der Beispiele: Eine Pruefung, die die Musterdatei
# der Behoerde mit 44 Fehlern abweist, ist falsch. Fachlich ist ein
# Quartal ohne Vermietung eine leere Zelle, keine Null — eine Null
# behauptete eine Vermietung zum Preis von nichts (Wurzel 4).
#
# Was STATTDESSEN geprueft wird: mindestens ein Quartal muss belegt sein
# (`_mindestens_ein_quartal_pruefen`), und zu jedem belegten Betrag
# gehoert seine Waehrung. Eine Zeile ohne jeden Wert meldet keine
# Taetigkeit und hat in der Datei nichts zu suchen.
#
# Gefunden beim Kreuztest gegen die fuenf Beispielblaetter, nicht von
# einem Test: Unsere Testdaten fuellen immer alle vier Quartale.
_QUARTALSBETRAEGE: tuple[str, ...] = tuple(
    f"RS_ACT_{feld}_Q{q}"
    for q in (1, 2, 3, 4)
    for feld in ("NUM", "CONS", "FEES", "TAX")
)

_WERTELISTEN: dict[str, frozenset[str]] = {
    "ROW_TYPE": vorlage.ROW_TYPES,
    "MSG_MESSAGE_TYPE_INDIC": vorlage.MELDEARTEN,
    "DOC_TYPE_INDIC": vorlage.DOKUMENTARTEN,
    "RESIDENCE": vorlage.LAENDERCODES,
    "TIN_ISSUED_BY": vorlage.LAENDERCODES,
    "ADDR_COUNTRY": vorlage.LAENDERCODES,
    "ADDR_LEGAL_ADDRESS_TYPE": vorlage.ANSCHRIFTSARTEN,
    "IN_TYPE": vorlage.IN_ARTEN,
    "PO_NEXUS": vorlage.NEXUS_ARTEN,
    "RS_ACT_PROP_TYPE": vorlage.OBJEKTARTEN,
    "RS_ACT_DK_VEHICLE_CAT": vorlage.FAHRZEUGARTEN,
    "MSG_VERSION": frozenset({vorlage.FASSUNG}),
    "IN_ISSUED_BY": vorlage.LAENDERCODES,
    "RS_BIRTH_COUNTRY": vorlage.LAENDERCODES,
    # `RS_PERM_ESTABLISHMENT` prueft gegen die EU-Liste, nicht gegen alle
    # Laender: Die Vorlage bindet die Spalte im Blatt `Enumerationer` an
    # `EUCountryCodeEnum` (Spalte M). Eine feste Niederlassung ausserhalb
    # der EU ist fuer DAC7 ohne Bedeutung. Die Liste war in `vorlage.py`
    # definiert und hatte bis zum 11.09.2026 keinen einzigen Aufrufer.
    "RS_PERM_ESTABLISHMENT": vorlage.EU_LAENDERCODES,
    # Die 13 Waehrungsspalten. Ein falscher Code macht den Betrag daneben
    # unbrauchbar, ohne dass der Betrag selbst auffaellt.
    **{
        spalte: vorlage.WAEHRUNGEN
        for spalte in vorlage.SPALTEN
        if spalte.endswith("_CCY")
    },
}

# Wahrheitswerte: Excel schreibt beim CSV-Export in daenischer Fassung
# `SANDT`/`FALSK`, die Beispielblaetter der Vorlage tragen in denselben
# Zellen aber `0` bzw. `1` (nachgesehen: `TIN_UNKNOWN` der Betreiberzeile
# in allen fuenf Beispielen = `0`). Eine Empfangsstelle, die nur eine der
# beiden Schreibweisen annimmt, weist die amtliche Beispieldatei ab —
# deshalb beide.
_WAHRHEITSWERTE = frozenset({"SANDT", "FALSK", "TRUE", "FALSE", "0", "1"})

# `TIN_UNKNOWN`, nicht `RS_TIN_UNKNOWN`: Die Spalte traegt in der Vorlage
# kein Praefix (Position 18 der 89). Mit dem erfundenen Namen war diese
# Pruefung bis zum 11.09.2026 eine Attrappe — sie lief nie an, weil keine
# Zeile je eine so benannte Spalte hatte (Befund 18).
_WAHRHEITSSPALTEN = ("PO_ASSUMED_REPORTING", "TIN_UNKNOWN")

_DATUMSSPALTEN = ("MSG_REPORTING_PERIOD", "RS_BIRTH_DATE")

# Matrikelnummer: bis zu vier Ziffern und drei Buchstaben.
# Feldkommentar: „max fire cifre + max tre bogstaver".
_MATRIKEL = re.compile(r"^\d{1,4}[A-Za-zÆØÅæøå]{0,3}$")

_GANZZAHLSPALTEN = tuple(f"RS_ACT_NUM_Q{q}" for q in (1, 2, 3, 4)) + (
    "RS_ACT_RENTED_DAYS",
)
# Obergrenze der Betragsspalten. Die Datenvalidierung der Vorlage fuehrt
# drei verschiedene Werte; der niedrigste und einzige runde davon ist
# 99.999.999.999.999 — 15 Stellen, genau die Grenze, ab der Excel selbst
# nicht mehr exakt rechnet. Die beiden hoeheren Werte sind Tippfehler
# (Befund 53), weshalb hier der belastbare gilt.
_BETRAG_MAX = Decimal("99999999999999")

_BETRAGSSPALTEN = tuple(
    f"RS_ACT_{f}_Q{q}" for q in (1, 2, 3, 4) for f in ("CONS", "FEES", "TAX")
) + ("RS_ACT_DK_GRI",)


@dataclass(frozen=True, slots=True)
class Befund:
    """Ein Regelverstoss mit Fundort — ohne den ist er nicht behebbar."""

    zeile: int
    zeilentyp: str
    spalte: str
    regel: str
    grund: str
    wert: str = ""


@dataclass
class Quittung:
    """Was die Empfangsstelle zurueckmeldet."""

    zeilen: int = 0
    zeilentypen: dict[str, int] = field(default_factory=dict)
    fehler: list[Befund] = field(default_factory=list)
    hinweise: list[Befund] = field(default_factory=list)
    # Die eingereichten Saetze, Feld fuer Feld — nur die BELEGTEN Spalten,
    # eine CSV-Zeile traegt 89 und fuellt davon ein Dutzend.
    #
    # Ohne das zeigt die Empfangsstelle nur Pruefsumme und Zeilenzahl, und
    # niemand kann sehen, WAS uebermittelt wurde. Genau dafuer ist die
    # Stelle aber da: bevor die Meldung zur Behoerde geht, muss der Betrieb
    # pruefen koennen, was in ihr steht.
    saetze: list[dict[str, str]] = field(default_factory=list)

    @property
    def angenommen(self) -> bool:
        """Nur eine fehlerfreie Datei wird angenommen — wie bei der Behoerde."""
        return not self.fehler


def _melden(
    q: Quittung, nr: int, typ: str, spalte: str, regel: str, grund: str, wert: str = ""
) -> None:
    q.fehler.append(Befund(nr, typ, spalte, regel, grund, wert))


def csv_pruefen(inhalt: str) -> Quittung:
    """Eine eingereichte CSV pruefen und quittieren.

    Der BOM (`\ufeff`) wird verworfen, nicht bemaengelt. Er ist bei dieser
    Meldung ERWARTET: Ohne ihn oeffnet Excel die Datei auf einer
    daenischen oder deutschen Windows-Installation als eine einzige Spalte,
    weshalb unsere Erzeugung ihn setzt (`csv_dk.py`).

    Bis zum 11.09.2026 las die Pruefung ihn als Teil des ersten
    Spaltennamens und wies die Datei mit „unbekannte Spalte
    '\ufeffROW_TYPE'" ab — sie haette damit JEDE Datei abgelehnt, die wir
    selbst erzeugen, und alle fuenf amtlichen Beispielblaetter. Gefunden
    beim Kreuztest gegen die Beispiele der Vorlage, nicht von einem Test:
    Die Testdaten trugen keinen BOM.
    """
    q = Quittung()
    inhalt = inhalt.lstrip("\ufeff")
    zeilen = [z for z in inhalt.replace("\r\n", "\n").split("\n") if z.strip()]
    if not zeilen:
        _melden(q, 0, "", "", "Datei", "die Datei ist leer")
        return q

    kopf = zeilen[0].split(vorlage.TRENNZEICHEN)
    if tuple(kopf) != vorlage.SPALTEN:
        _kopf_bemaengeln(q, kopf)
        return q

    gesehen: dict[str, str] = {}
    kennungen: set[str] = set()
    for nr, roh in enumerate(zeilen[1:], start=2):
        _zeile_pruefen(q, nr, roh, kopf, gesehen, kennungen)

    _datei_pruefen(q, zeilen)
    return q


def _kopf_bemaengeln(q: Quittung, kopf: list[str]) -> None:
    """Ein falscher Spaltenkopf macht die ganze Datei unlesbar."""
    fehlend = [s for s in vorlage.SPALTEN if s not in kopf]
    unbekannt = [s for s in kopf if s not in vorlage.SPALTEN]
    if len(kopf) != len(vorlage.SPALTEN):
        _melden(
            q, 1, "", "", "Spaltenkopf",
            f"erwartet werden {len(vorlage.SPALTEN)} Spalten, gefunden {len(kopf)}",
        )
    for s in fehlend:
        _melden(q, 1, "", s, "Spaltenkopf", "Spalte fehlt")
    for s in unbekannt:
        _melden(q, 1, "", s, "Spaltenkopf", "unbekannte Spalte", s)
    if not fehlend and not unbekannt and len(kopf) == len(vorlage.SPALTEN):
        _melden(
            q, 1, "", "", "Spaltenkopf",
            "die Spalten stehen in einer anderen Reihenfolge als in der Vorlage",
        )


def _zeile_pruefen(
    q: Quittung,
    nr: int,
    roh: str,
    kopf: list[str],
    gesehen: dict[str, str],
    kennungen: set[str],
) -> None:
    felder = roh.split(vorlage.TRENNZEICHEN)
    if len(felder) != len(kopf):
        _melden(
            q, nr, "", "", "Feldzahl",
            f"erwartet werden {len(kopf)} Felder, gefunden {len(felder)} — "
            "ein Semikolon in einem Textfeld zerreisst die Zeile",
        )
        return

    werte = dict(zip(kopf, felder, strict=True))
    typ = werte.get("ROW_TYPE", "")
    q.zeilen += 1
    q.zeilentypen[typ] = q.zeilentypen.get(typ, 0) + 1
    # Leere Spalten weglassen: von 89 traegt eine Zeile ein Dutzend.
    q.saetze.append(
        {"__nr": str(nr), **{s: w for s, w in werte.items() if w.strip()}}
    )

    if typ not in vorlage.ROW_TYPES:
        _melden(q, nr, typ, "ROW_TYPE", "Werteliste", "unbekannter Zeilentyp", typ)
        return

    _pflicht_pruefen(q, nr, typ, werte)
    _werte_pruefen(q, nr, typ, werte)
    _einmalige_pruefen(q, nr, typ, werte, gesehen)
    _kennungen_sammeln(typ, werte, kennungen)
    _bezug_pruefen(q, nr, typ, werte, kennungen)


def _pflicht_pruefen(q: Quittung, nr: int, typ: str, werte: dict[str, str]) -> None:
    erwartet = set(_PFLICHT.get(typ, ()))
    for spalte in sorted(erwartet):
        if not werte.get(spalte, "").strip():
            _melden(
                q, nr, typ, spalte, "Pflichtangabe",
                "die Vorlage fuehrt dieses Feld fuer diesen Zeilentyp als Pflicht",
            )
    if typ == _AKTIVITAET:
        _mindestens_ein_quartal_pruefen(q, nr, typ, werte)
        _waehrung_je_betrag_pruefen(q, nr, typ, werte)
    _bedingte_pflicht_pruefen(q, nr, typ, werte)


def _mindestens_ein_quartal_pruefen(
    q: Quittung, nr: int, typ: str, werte: dict[str, str]
) -> None:
    """Eine Taetigkeitszeile ohne einen einzigen Quartalswert meldet nichts.

    Sie ist damit keine laxere Fassung der Pflicht, sondern eine andere:
    WELCHES Quartal belegt ist, entscheidet das Geschaeft; DASS eines
    belegt ist, entscheidet, ob die Zeile eine Aussage traegt.
    """
    if any(werte.get(spalte, "").strip() for spalte in _QUARTALSBETRAEGE):
        return
    _melden(
        q, nr, typ, "RS_ACT_CONS_Q1", "Quartalswerte",
        "die Zeile traegt in keinem Quartal einen Wert und meldet damit "
        "keine Taetigkeit",
    )


def _waehrung_je_betrag_pruefen(
    q: Quittung, nr: int, typ: str, werte: dict[str, str]
) -> None:
    """Zu jedem belegten Betrag gehoert seine Waehrung.

    Ein Betrag ohne Waehrung ist in einer Meldung ueber 27 Mitgliedstaaten
    keine Zahl, sondern eine Vermutung (Wurzel 4).
    """
    for spalte in _QUARTALSBETRAEGE:
        if spalte.startswith("RS_ACT_NUM_"):
            continue
        if not werte.get(spalte, "").strip():
            continue
        if not werte.get(f"{spalte}_CCY", "").strip():
            _melden(
                q, nr, typ, f"{spalte}_CCY", "Waehrung",
                "zu einem belegten Betrag gehoert seine Waehrung",
                werte.get(spalte, ""),
            )


def _bedingte_pflicht_pruefen(
    q: Quittung, nr: int, typ: str, werte: dict[str, str]
) -> None:
    """Pflichten, die von einem ANDEREN Feld abhaengen.

    Sie stehen nicht in der Kardinalitaetsspalte, sondern in den
    Feldkommentaren — eine Pruefung, die nur die Kardinalitaeten liest,
    findet keine davon.
    """
    # Mit BFE-Nummer wird die Bruttomieteinnahme Pflicht. Feldkommentar
    # RS_ACT_DK_GRI: „Obligatorisk hvis Real Property Registration Number
    # BFE er angivet."
    hat_bfe = werte.get("RS_ACT_DK_REAL_PROP_REG_NUM", "").strip()
    if typ == _AKTIVITAET and hat_bfe and not werte.get("RS_ACT_DK_GRI", "").strip():
        _melden(
            q, nr, typ, "RS_ACT_DK_GRI", "Pflicht bei BFE-Nummer",
            "mit einer BFE-Nummer ist die Bruttomieteinnahme Pflicht",
            hat_bfe,
        )
    # Die Bruttomieteinnahme ist zwingend in DKK zu melden — eine
    # daenische Zusatzangabe an eine daenische Behoerde.
    #
    # NUR bei Immobilien: `RS_ACT_DK_GRI` fuehrt die Feldtabelle zweimal —
    # als `0..1` beim Immobilienblock (R267) und als `0..*` in der Gruppe
    # `RS_ACT_TR_DT` des Fahrzeugblocks (R352). Dort ist es keine
    # Mieteinnahme, und die amtlichen Beispiele fuehren es auf
    # `ACT_TR_*`-Zeilen in EUR. Ohne diese Einschraenkung meldete die
    # Pruefung die Beispielblaetter `Eksempel 1` und `1.1` als fehlerhaft.
    gri = werte.get("RS_ACT_DK_GRI", "").strip()
    if gri and typ == _AKTIVITAET:
        gri_ccy = werte.get("RS_ACT_DK_GRI_CCY", "").strip()
        if not gri_ccy:
            _melden(
                q, nr, typ, "RS_ACT_DK_GRI_CCY", "Pflicht bei Bruttomieteinnahme",
                "zu jedem Betrag gehoert seine Waehrung", gri,
            )
        elif gri_ccy != "DKK":
            _melden(
                q, nr, typ, "RS_ACT_DK_GRI_CCY", "Waehrung",
                "die Bruttomieteinnahme ist in DKK zu melden", gri_ccy,
            )
    # `DPI910` ist „Sonstiges" — ohne den Klartext daneben ist die
    # Objektart nicht bestimmt.
    if werte.get("RS_ACT_PROP_TYPE", "").strip() == "DPI910" and not werte.get(
        "RS_ACT_OTHER_PROP_TYPE", ""
    ).strip():
        _melden(
            q, nr, typ, "RS_ACT_OTHER_PROP_TYPE", "Pflicht bei DPI910",
            "zur Objektart Sonstiges gehoert ihre Beschreibung", "DPI910",
        )
    # Eine Korrektur ohne Bezug korrigiert nichts; ein Erstsatz mit Bezug
    # behauptet einen, den es nicht gibt. Feldtabelle: `CORR_DOC_REF_ID`
    # `0..1` — die Bedingung steht im Feldkommentar, nicht in der Zahl.
    art = werte.get("DOC_TYPE_INDIC", "").strip()
    bezug = werte.get("CORR_DOC_REF_ID", "").strip()
    if art in ("OECD2", "OECD3") and not bezug:
        _melden(
            q, nr, typ, "CORR_DOC_REF_ID", "Pflicht bei Korrektur",
            "eine Korrektur oder Loeschung muss den zu ersetzenden Satz nennen",
            art,
        )
    if art in ("OECD0", "OECD1") and bezug:
        _melden(
            q, nr, typ, "CORR_DOC_REF_ID", "Nur bei Korrektur",
            "ein Erstsatz darf keinen zu korrigierenden Satz nennen", bezug,
        )
    # Beim Betreiber muss mindestens eine Anschrift der Art „eingetragener
    # Sitz" vorliegen. Feldkommentar R44: „For rowtype
    # PO_Platform_Operator skal mindst én adresse af typen OECD304 være
    # angivet." Geprueft hat das bisher nur der Erzeuger — eine fremd
    # erzeugte Datei kam daran vorbei.
    if typ == "PO_Platform_Operator":
        art_anschrift = werte.get("ADDR_LEGAL_ADDRESS_TYPE", "").strip()
        if art_anschrift and art_anschrift != "OECD304":
            _melden(
                q, nr, typ, "ADDR_LEGAL_ADDRESS_TYPE", "Eingetragener Sitz",
                "der meldende Betrieb braucht eine Anschrift der Art OECD304",
                art_anschrift,
            )


def _werte_pruefen(q: Quittung, nr: int, typ: str, werte: dict[str, str]) -> None:
    for spalte, wert in werte.items():
        if not wert.strip():
            continue
        _einen_wert_pruefen(q, nr, typ, spalte, wert.strip())


def _einen_wert_pruefen(
    q: Quittung, nr: int, typ: str, spalte: str, wert: str
) -> None:
    liste = _WERTELISTEN.get(spalte)
    if liste is not None and wert not in liste:
        _melden(q, nr, typ, spalte, "Werteliste", "Wert steht nicht in der Vorlage", wert)
    if spalte in _WAHRHEITSSPALTEN and wert not in _WAHRHEITSWERTE:
        _melden(
            q, nr, typ, spalte, "Wahrheitswert",
            "erwartet wird ein Wahrheitswert: SANDT/FALSK (daenisches Excel), "
            "TRUE/FALSE oder 0/1 (so tragen es die Beispielblaetter)", wert,
        )
    if spalte in _DATUMSSPALTEN:
        try:
            datetime.strptime(wert, "%d-%m-%Y")  # noqa: DTZ007 — reines Datum
        except ValueError:
            _melden(q, nr, typ, spalte, "Datumsformat", "erwartet wird DD-MM-YYYY", wert)
    if spalte in _GANZZAHLSPALTEN and not wert.isdigit():
        _melden(q, nr, typ, spalte, "Ganzzahl", "erwartet wird eine ganze Zahl", wert)
    if spalte in _BETRAGSSPALTEN:
        _betrag_pruefen(q, nr, typ, spalte, wert)
    if spalte == "RS_ACT_LAND_REG_NUM" and not _MATRIKEL.match(wert):
        q.hinweise.append(
            Befund(
                nr, typ, spalte, "Matrikelnummer",
                "erwartet werden bis zu vier Ziffern und bis zu drei Buchstaben",
                wert,
            )
        )
    if spalte == "RS_ACT_DK_REAL_PROP_REG_NUM" and not wert.isdigit():
        _melden(
            q, nr, typ, spalte, "BFE-Nummer",
            "die Vorlage fuehrt sie als Ganzzahl", wert,
        )


def _betrag_pruefen(q: Quittung, nr: int, typ: str, spalte: str, wert: str) -> None:
    """Ein Betrag: ganzzahlig, nicht negativ, innerhalb der Obergrenze.

    `Decimal` statt `float`: In einer Steuermeldung ist ein Betrag eine
    exakte Zahl. `float` rundet ab 2**53 und haette die Obergrenze
    ausgerechnet dort unzuverlaessig gemacht, wo sie greift.

    Kein `replace(",", ".")` mehr: Die Vorlage erlaubt keine
    Nachkommastellen, und die Ersetzung machte `1234,56` zu einer
    gueltigen Zahl.
    """
    try:
        zahl = Decimal(wert)
    except InvalidOperation:
        _melden(q, nr, typ, spalte, "Betrag", "kein gueltiger Betrag", wert)
        return
    if zahl != zahl.to_integral_value():
        _melden(
            q, nr, typ, spalte, "Betrag",
            "die Vorlage erlaubt keine Nachkommastellen", wert,
        )
    if zahl < 0:
        _melden(
            q, nr, typ, spalte, "Betrag",
            "negative Betraege sind in einer Meldung nicht vorgesehen", wert,
        )
    if zahl > _BETRAG_MAX:
        _melden(
            q, nr, typ, spalte, "Betrag",
            f"der Betrag uebersteigt die Obergrenze der Vorlage ({_BETRAG_MAX})",
            wert,
        )


def _einmalige_pruefen(
    q: Quittung, nr: int, typ: str, werte: dict[str, str], gesehen: dict[str, str]
) -> None:
    """`MSG_MESSAGE_REF_ID` und `PO_DOC_REF_ID` stehen je genau einmal.

    Die Kennungen gehoeren zur Nachricht bzw. zum Betreibersatz. Sie in jeder
    Zeile zu wiederholen ist ein Fehler — die Zugehoerigkeit entsteht ueber
    `RS_DOC_REF_ID` und die Reihenfolge.
    """
    for spalte in _EINMALIG:
        wert = werte.get(spalte, "").strip()
        if not wert:
            continue
        if spalte in gesehen:
            _melden(
                q, nr, typ, spalte, "Einmaligkeit",
                "diese Kennung steht bereits in einer frueheren Zeile", wert,
            )
        else:
            gesehen[spalte] = wert


def _kennungen_sammeln(typ: str, werte: dict[str, str], kennungen: set[str]) -> None:
    if typ in _VERKAEUFER:
        kennung = werte.get("RS_DOC_REF_ID", "").strip()
        if kennung:
            kennungen.add(kennung)


def _bezug_pruefen(
    q: Quittung, nr: int, typ: str, werte: dict[str, str], kennungen: set[str]
) -> None:
    """Ein Objekt ohne zugehoerigen Verkaeufer ist eine verwaiste Zeile.

    Die Behoerde kann sie niemandem zuordnen — der Umsatz waere gemeldet,
    aber ohne Steuerpflichtigen.
    """
    if typ != _AKTIVITAET:
        return
    kennung = werte.get("RS_DOC_REF_ID", "").strip()
    if kennung and kennung not in kennungen:
        _melden(
            q, nr, typ, "RS_DOC_REF_ID", "Bezug",
            "kein Verkaeufer mit dieser Kennung steht VOR dieser Zeile", kennung,
        )


def _datei_pruefen(q: Quittung, zeilen: list[str]) -> None:
    """Regeln, die die Datei als GANZES betreffen."""
    typen = q.zeilentypen
    if typen.get("Message", 0) != 1:
        _melden(
            q, 1, "Message", "ROW_TYPE", "Aufbau",
            f"genau eine Message-Zeile erwartet, gefunden {typen.get('Message', 0)}",
        )
    if typen.get("PO_Platform_Operator", 0) != 1:
        _melden(
            q, 1, "PO_Platform_Operator", "ROW_TYPE", "Aufbau",
            "genau eine Zeile fuer den meldenden Betrieb erwartet, gefunden "
            f"{typen.get('PO_Platform_Operator', 0)}",
        )
    erste = zeilen[1].split(vorlage.TRENNZEICHEN)[0] if len(zeilen) > 1 else ""
    if erste and erste != "Message":
        _melden(
            q, 2, erste, "ROW_TYPE", "Aufbau",
            "die erste Datenzeile muss die Message-Zeile sein", erste,
        )
    _nullmeldung_pruefen(q)


def _nullmeldung_pruefen(q: Quittung) -> None:
    """`DPI403` und „keine Verkaeuferzeile" muessen sich entsprechen.

    Beide Richtungen, weil beide Faelle einen anderen Schaden anrichten:
    Eine Nullmeldung MIT Verkaeufern meldet Umsaetze, die die Behoerde als
    nicht gemeldet fuehrt. Eine Erstmeldung OHNE Verkaeufer sieht wie eine
    vergessene Datei aus und loest eine Nachfrage aus, statt die Nullzahl
    zu erklaeren.
    """
    meldearten = [
        satz.get("MSG_MESSAGE_TYPE_INDIC", "")
        for satz in q.saetze
        if satz.get("ROW_TYPE") == "Message"
    ]
    if not meldearten:
        return
    art = meldearten[0]
    verkaeufer = sum(q.zeilentypen.get(t, 0) for t in _VERKAEUFER)
    if art == "DPI403" and verkaeufer:
        _melden(
            q, 1, "Message", "MSG_MESSAGE_TYPE_INDIC", "Nullmeldung",
            f"eine Nullmeldung darf keine Verkaeufer enthalten, gefunden {verkaeufer}",
            art,
        )
    if art != "DPI403" and not verkaeufer:
        _melden(
            q, 1, "Message", "MSG_MESSAGE_TYPE_INDIC", "Nullmeldung",
            "ohne Verkaeufer ist die Meldeart DPI403 (Nullmeldung) zu verwenden",
            art,
        )
