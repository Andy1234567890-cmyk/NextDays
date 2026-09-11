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
    "PO_Platform_Operator": (
        "PO_DOC_REF_ID",
        "DOC_TYPE_INDIC",
        "RESIDENCE",
        "TIN",
        "ADDR_COUNTRY",
    ),
    "RS_IND_Individual_Seller": (
        "RS_DOC_REF_ID",
        "DOC_TYPE_INDIC",
        "RESIDENCE",
        "ADDR_COUNTRY",
        "RS_NM_FIRST_NAME",
        "RS_NM_LAST_NAME",
        "RS_BIRTH_DATE",
    ),
    "RS_ENT_Entity_Seller": (
        "RS_DOC_REF_ID",
        "DOC_TYPE_INDIC",
        "RESIDENCE",
        "ADDR_COUNTRY",
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

# Je Quartal Anzahl, Verguetung, Gebuehren, Steuern samt Waehrung.
_QUARTALSPFLICHT: tuple[str, ...] = tuple(
    f"RS_ACT_{feld}_Q{q}{suffix}"
    for q in (1, 2, 3, 4)
    for feld, suffix in (
        ("NUM", ""),
        ("CONS", ""),
        ("CONS", "_CCY"),
        ("FEES", ""),
        ("FEES", "_CCY"),
        ("TAX", ""),
        ("TAX", "_CCY"),
    )
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
}

_WAHRHEITSWERTE = frozenset({"SANDT", "FALSK"})
_WAHRHEITSSPALTEN = ("PO_ASSUMED_REPORTING", "RS_TIN_UNKNOWN")

_DATUMSSPALTEN = ("MSG_REPORTING_PERIOD", "RS_BIRTH_DATE")

# Matrikelnummer: bis zu vier Ziffern und drei Buchstaben.
# Feldkommentar: „max fire cifre + max tre bogstaver".
_MATRIKEL = re.compile(r"^\d{1,4}[A-Za-zÆØÅæøå]{0,3}$")

_GANZZAHLSPALTEN = tuple(f"RS_ACT_NUM_Q{q}" for q in (1, 2, 3, 4)) + (
    "RS_ACT_RENTED_DAYS",
)
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
    """Eine eingereichte CSV pruefen und quittieren."""
    q = Quittung()
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
    if typ == _AKTIVITAET:
        erwartet |= set(_QUARTALSPFLICHT)
    for spalte in sorted(erwartet):
        if not werte.get(spalte, "").strip():
            _melden(
                q, nr, typ, spalte, "Pflichtangabe",
                "die Vorlage fuehrt dieses Feld fuer diesen Zeilentyp als Pflicht",
            )
    # Bedingte Pflicht: mit BFE-Nummer wird die Bruttomieteinnahme Pflicht.
    # Feldkommentar RS_ACT_DK_GRI: „Obligatorisk hvis Real Property
    # Registration Number BFE er angivet."
    hat_bfe = werte.get("RS_ACT_DK_REAL_PROP_REG_NUM", "").strip()
    if typ == _AKTIVITAET and hat_bfe and not werte.get("RS_ACT_DK_GRI", "").strip():
        _melden(
            q, nr, typ, "RS_ACT_DK_GRI", "Pflicht bei BFE-Nummer",
            "mit einer BFE-Nummer ist die Bruttomieteinnahme Pflicht",
            hat_bfe,
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
            "erwartet werden SANDT oder FALSK (Excel exportiert sie so)", wert,
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
    try:
        zahl = float(wert.replace(",", "."))
    except ValueError:
        _melden(q, nr, typ, spalte, "Betrag", "kein gueltiger Betrag", wert)
        return
    if zahl < 0:
        _melden(
            q, nr, typ, spalte, "Betrag",
            "negative Betraege sind in einer Meldung nicht vorgesehen", wert,
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
