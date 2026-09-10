"""Prüft eine FERTIGE CSV so, wie die Behörde sie prüfen würde.

WOZU DAS NEBEN `pruefung.py`: Jene prüft das Modell, bevor die Datei
entsteht — sie kennt Anbieter und Objekte. Dieser Prüfer kennt nur Text. Er
liest die erzeugte Datei zurück, als käme sie von aussen, und misst sie an
den Regeln der amtlichen Vorlage.

Das ist der Unterschied zwischen „unser Code meint, alles sei gut" und „die
Datei hält den Regeln stand". Ein Fehler im Serialisierer — eine verrutschte
Spalte, ein falsch geschriebener Wahrheitswert — ist für `pruefung.py`
unsichtbar, weil sie die Datei nie zu Gesicht bekommt. Genau solche Fehler
sind hier real passiert (0/1 statt SANDT/FALSK, Kennungen in jeder Zeile).

WOHER DIE REGELN STAMMEN: alle aus
`docs/Duck7/CSV fil indberetning til DAC7 2025.xlsm`, Fundstelle je Regel im
Kommentar. Nichts hier ist hergeleitet oder aus anderen Quellen ergänzt.
Belege und Lesefallen: `docs/dac7/VORLAGE-BEFUNDE.md`.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime

from . import enums
from .spalten import SPALTEN, TRENNZEICHEN

# Pflichtfelder je Zeilentyp, maschinell aus dem Blatt "Vejledningstekster"
# gezogen: dort trägt Spalte E die Kardinalität, `1..` bedeutet Pflicht.
#
# ABZUG GEGENÜBER JENER TABELLE: Sie führt für jeden Zeilentyp auch
# MSG_MESSAGE_REF_ID und PO_DOC_REF_ID als `1..1`. Diese Kardinalität
# beschreibt das DPI-XML-Zielschema, in dem die Zuordnung aus dem Baum
# folgt. In der flachen CSV steht die Nachrichtenkennung nur in der
# Message-Zeile und die Betreiberkennung nur in der Betreiberzeile — so
# zeigen es die Belegungsmatrix im Blatt "Kolonner" und alle fünf
# Beispielblätter. Geprüft wird deshalb hier, nicht je Zeile.
_PFLICHT: dict[str, frozenset[str]] = {
    "Message": frozenset({
        "MSG_MESSAGE_REF_ID",
        "MSG_MESSAGE_TYPE_INDIC",
        "MSG_REPORTING_PERIOD",
        "MSG_VERSION",
    }),
    "PO_Platform_Operator": frozenset({
        "PO_DOC_REF_ID",
        "DOC_TYPE_INDIC",
        "TIN",
        "TIN_ISSUED_BY",
        "TIN_UNKNOWN",
        "ADDR_COUNTRY",
        "ADDR_LEGAL_ADDRESS_TYPE",
        "ORGANISATION_NAME",
    }),
    "AG_Assuming_Platform_Operator": frozenset({
        "AG_DOC_REF_ID",
        "DOC_TYPE_INDIC",
        "TIN",
        "TIN_ISSUED_BY",
        "TIN_UNKNOWN",
        "ADDR_COUNTRY",
        "ORGANISATION_NAME",
    }),
    "AD_Assumed_Platform_Operator": frozenset({
        "AD_DOC_REF_ID",
        "DOC_TYPE_INDIC",
        "RESIDENCE",
        "ADDR_COUNTRY",
        "ORGANISATION_NAME",
    }),
    "RS_ENT_Entity_Seller": frozenset({
        "RS_DOC_REF_ID",
        "DOC_TYPE_INDIC",
        "RESIDENCE",
        "TIN",
        "TIN_ISSUED_BY",
        "TIN_UNKNOWN",
        "ADDR_COUNTRY",
        "ORGANISATION_NAME",
    }),
    "RS_IND_Individual_Seller": frozenset({
        "RS_DOC_REF_ID",
        "DOC_TYPE_INDIC",
        "RESIDENCE",
        "TIN",
        "TIN_ISSUED_BY",
        "TIN_UNKNOWN",
        "ADDR_COUNTRY",
        "RS_BIRTH_DATE",
        "RS_NM_FIRST_NAME",
        "RS_NM_LAST_NAME",
    }),
}

# Die vier Quartalsblöcke, die jede Aktivitätszeile vollständig tragen muss —
# auch mit Wert 0. Die Vorlage führt sie als `1..1`, und ihre Beispiele
# schreiben die Nullen aus.
_QUARTALSPFLICHT: frozenset[str] = frozenset(
    [f"RS_ACT_NUM_Q{q}" for q in (1, 2, 3, 4)]
    + [f"RS_ACT_{art}_Q{q}{suffix}"
       for art in ("CONS", "FEES", "TAX")
       for q in (1, 2, 3, 4)
       for suffix in ("", "_CCY")]
)

_AKTIVITAETEN: frozenset[str] = frozenset({
    "ACT_Immovable_Property",
    "ACT_Personal_Services",
    "ACT_TR_Transportation_Rental",
    "ACT_Sale_Of_Goods",
})

# Spalten, die eine Aktivitätszeile über die Quartalsblöcke hinaus braucht.
_AKTIVITAET_ZUSATZ: dict[str, frozenset[str]] = {
    "ACT_Immovable_Property": frozenset({"RS_DOC_REF_ID", "ADDR_COUNTRY"}),
    "ACT_Personal_Services": frozenset({"RS_DOC_REF_ID"}),
    "ACT_TR_Transportation_Rental": frozenset({"RS_DOC_REF_ID"}),
    "ACT_Sale_Of_Goods": frozenset({"RS_DOC_REF_ID"}),
}

# Wertelisten je Spalte, alle aus dem Blatt "Enumerationer".
_WERTELISTEN: dict[str, frozenset[str]] = {
    "MSG_MESSAGE_TYPE_INDIC": enums.MELDEART,
    "DOC_TYPE_INDIC": enums.SATZART,
    "RESIDENCE": enums.LAENDER,
    "TIN_ISSUED_BY": enums.LAENDER,
    "ADDR_COUNTRY": enums.LAENDER,
    "IN_ISSUED_BY": enums.LAENDER,
    "IN_TYPE": enums.IN_ART,
    "ADDR_LEGAL_ADDRESS_TYPE": enums.ANSCHRIFTSART,
    "PO_NEXUS": enums.NEXUS,
    "RS_ACT_PROP_TYPE": enums.OBJEKTART,
    "RS_ACT_DK_VEHICLE_CAT": enums.FAHRZEUGART,
    "RS_BIRTH_COUNTRY": enums.LAENDER,
    "RS_PERM_ESTABLISHMENT": enums.LAENDER,
}

# Währungsspalten enden alle auf _CCY.
_WAEHRUNG_SUFFIX = "_CCY"

# Wahrheitswerte: dänisch, nicht 0/1. Datenvalidierung der Vorlage auf den
# Spalten R und AJ führt genau diese Liste; ihr Exportmakro ersetzt
# ;TRUE;->;SANDT; und ;FALSE;->;FALSK;.
_WAHRHEITSSPALTEN: frozenset[str] = frozenset({
    "TIN_UNKNOWN",
    "PO_ASSUMED_REPORTING",
})
_WAHRHEITSWERTE: frozenset[str] = frozenset({"SANDT", "FALSK"})

# Ganzzahlig und mindestens null — `type="whole"` mit `formula1=0`.
_GANZZAHLSPALTEN: frozenset[str] = frozenset(
    [f"RS_ACT_NUM_Q{q}" for q in (1, 2, 3, 4)]
    + [f"RS_ACT_{art}_Q{q}"
       for art in ("CONS", "FEES", "TAX")
       for q in (1, 2, 3, 4)]
    + ["RS_ACT_RENTED_DAYS", "RS_ACT_DK_GRI"]
)

# Datumsspalten im Format DD-MM-YYYY.
_DATUMSSPALTEN: frozenset[str] = frozenset({
    "MSG_REPORTING_PERIOD",
    "RS_BIRTH_DATE",
})

# Kennungen: nur Ziffern und Buchstaben, höchstens 100 Zeichen.
_KENNUNGSSPALTEN: frozenset[str] = frozenset({
    "MSG_MESSAGE_REF_ID",
    "PO_DOC_REF_ID",
    "AD_DOC_REF_ID",
    "AG_DOC_REF_ID",
    "RS_DOC_REF_ID",
    "CORR_DOC_REF_ID",
})
_KENNUNG_MAXLAENGE = 100

# Matrikelnummer: höchstens vier Ziffern und drei Buchstaben.
_MATRIKEL = re.compile(r"^\d{1,4}[A-Za-zÆØÅæøå]{0,3}$")

# Zeilentypen, die höchstens einmal vorkommen dürfen.
_EINMALIG: frozenset[str] = frozenset({"Message", "PO_Platform_Operator"})


@dataclass(frozen=True, slots=True)
class Dateibefund:
    """Ein Regelverstoss in der fertigen Datei."""

    zeile: int
    zeilentyp: str
    spalte: str
    regel: str
    grund: str
    wert: str = ""


@dataclass(slots=True)
class Dateibericht:
    """Was die Prüfung der fertigen Datei ergeben hat."""

    fehler: list[Dateibefund] = field(default_factory=list)
    hinweise: list[Dateibefund] = field(default_factory=list)
    zeilen: int = 0
    zeilentypen: dict[str, int] = field(default_factory=dict)

    @property
    def besteht(self) -> bool:
        return not self.fehler


def _spaltenzuordnung(kopf: list[str]) -> dict[str, int]:
    return {name: i for i, name in enumerate(kopf)}


def _pflicht_pruefen(
    typ: str, werte: dict[str, str], nummer: int, bericht: Dateibericht
) -> None:
    erwartet = set(_PFLICHT.get(typ, frozenset()))
    if typ in _AKTIVITAETEN:
        erwartet |= _QUARTALSPFLICHT | _AKTIVITAET_ZUSATZ.get(typ, frozenset())
    for spalte in sorted(erwartet):
        if not werte.get(spalte, ""):
            bericht.fehler.append(
                Dateibefund(
                    zeile=nummer,
                    zeilentyp=typ,
                    spalte=spalte,
                    regel="Pflichtangabe",
                    grund="die Vorlage fuehrt dieses Feld als Pflicht",
                )
            )
    _bedingte_pflicht_pruefen(typ, werte, nummer, bericht)


def _bedingte_pflicht_pruefen(
    typ: str, werte: dict[str, str], nummer: int, bericht: Dateibericht
) -> None:
    """Pflichten, die erst durch ein anderes Feld entstehen.

    Bisher genau eine, woertlich aus dem Feldkommentar zu
    `RS_ACT_DK_GRI`: „Obligatorisk hvis Real Property Registration Number
    BFE er angivet." Eine Feld-fuer-Feld-Pruefung sieht so etwas nie,
    weil beide Felder einzeln freiwillig sind.
    """
    if typ not in _AKTIVITAETEN:
        return
    if werte.get("RS_ACT_DK_REAL_PROP_REG_NUM") and not werte.get(
        "RS_ACT_DK_GRI"
    ):
        bericht.fehler.append(
            Dateibefund(
                zeile=nummer,
                zeilentyp=typ,
                spalte="RS_ACT_DK_GRI",
                regel="Pflicht bei BFE-Nummer",
                grund=(
                    "mit einer BFE-Nummer ist die Bruttomieteinnahme "
                    "Pflicht"
                ),
                wert=werte.get("RS_ACT_DK_REAL_PROP_REG_NUM", ""),
            )
        )


def _werte_pruefen(
    typ: str, werte: dict[str, str], nummer: int, bericht: Dateibericht
) -> None:
    for spalte, wert in werte.items():
        if not wert:
            continue
        _einen_wert_pruefen(typ, spalte, wert, nummer, bericht)


def _melden(
    bericht: Dateibericht,
    nummer: int,
    typ: str,
    spalte: str,
    regel: str,
    grund: str,
    wert: str,
) -> None:
    bericht.fehler.append(
        Dateibefund(
            zeile=nummer,
            zeilentyp=typ,
            spalte=spalte,
            regel=regel,
            grund=grund,
            wert=wert,
        )
    )


def _einen_wert_pruefen(  # noqa: PLR0912 — eine Regel je Spaltenart, flach
    typ: str, spalte: str, wert: str, nummer: int, bericht: Dateibericht
) -> None:
    if spalte in _WAHRHEITSSPALTEN and wert not in _WAHRHEITSWERTE:
        _melden(
            bericht, nummer, typ, spalte, "Wahrheitswert",
            "erlaubt sind nur SANDT und FALSK", wert,
        )
    if spalte in _WERTELISTEN and wert not in _WERTELISTEN[spalte]:
        _melden(
            bericht, nummer, typ, spalte, "Werteliste",
            "steht nicht in der Liste der Vorlage", wert,
        )
    if spalte.endswith(_WAEHRUNG_SUFFIX) and wert not in enums.WAEHRUNGEN:
        _melden(
            bericht, nummer, typ, spalte, "Waehrung",
            "kein gueltiger ISO-4217-Code", wert,
        )
    if spalte in _GANZZAHLSPALTEN:
        _ganzzahl_pruefen(typ, spalte, wert, nummer, bericht)
    if spalte in _DATUMSSPALTEN:
        try:
            datetime.strptime(wert, "%d-%m-%Y")  # noqa: DTZ007 — reines Datum
        except ValueError:
            _melden(
                bericht, nummer, typ, spalte, "Datumsformat",
                "erwartet wird DD-MM-YYYY", wert,
            )
    if spalte in _KENNUNGSSPALTEN:
        _kennung_pruefen(typ, spalte, wert, nummer, bericht)
    if spalte == "RS_ACT_LAND_REG_NUM" and not _MATRIKEL.match(wert):
        bericht.hinweise.append(
            Dateibefund(
                zeile=nummer, zeilentyp=typ, spalte=spalte,
                regel="Matrikelnummer",
                grund="erwartet werden bis zu vier Ziffern und drei Buchstaben",
                wert=wert,
            )
        )
    if spalte == "RS_ACT_DK_REAL_PROP_REG_NUM" and not wert.isdigit():
        _melden(
            bericht, nummer, typ, spalte, "BFE-Nummer",
            "die Vorlage fuehrt sie als Ganzzahl", wert,
        )


def _ganzzahl_pruefen(
    typ: str, spalte: str, wert: str, nummer: int, bericht: Dateibericht
) -> None:
    try:
        zahl = int(wert)
    except ValueError:
        _melden(
            bericht, nummer, typ, spalte, "Ganzzahl",
            "keine ganze Zahl (die Vorlage erlaubt keine Nachkommastellen)",
            wert,
        )
        return
    if zahl < 0:
        _melden(
            bericht, nummer, typ, spalte, "Untergrenze",
            "die Vorlage laesst nur Werte ab 0 zu", wert,
        )


def _kennung_pruefen(
    typ: str, spalte: str, wert: str, nummer: int, bericht: Dateibericht
) -> None:
    if not wert.isalnum():
        _melden(
            bericht, nummer, typ, spalte, "Kennung",
            "nur Ziffern und Buchstaben erlaubt, keine Sonderzeichen", wert,
        )
    if len(wert) > _KENNUNG_MAXLAENGE:
        _melden(
            bericht, nummer, typ, spalte, "Kennung",
            f"laenger als {_KENNUNG_MAXLAENGE} Zeichen", wert,
        )


def _kennungen_nur_oben(
    zeilen: list[tuple[int, str, dict[str, str]]], bericht: Dateibericht
) -> None:
    """Nachrichten- und Betreiberkennung stehen genau einmal.

    Belegt durch die Belegungsmatrix im Blatt "Kolonner", alle fünf
    Beispielblätter und die ausgefüllte Meldung im Blatt "Indberetning":
    dort trägt keine Zeile jenseits der ersten beiden diese Spalten.
    """
    for spalte, gehoert_zu in (
        ("MSG_MESSAGE_REF_ID", "Message"),
        ("PO_DOC_REF_ID", "PO_Platform_Operator"),
    ):
        for nummer, typ, werte in zeilen:
            if werte.get(spalte) and typ != gehoert_zu:
                _melden(
                    bericht, nummer, typ, spalte, "Zeilenzuordnung",
                    f"gehoert ausschliesslich in die Zeile {gehoert_zu}",
                    werte[spalte],
                )


def _struktur_pruefen(
    zeilen: list[tuple[int, str, dict[str, str]]], bericht: Dateibericht
) -> None:
    """Reihenfolge und Verknüpfung der Zeilen.

    Die CSV ist die flachgeklopfte Form eines Baums; die Hierarchie steckt
    in der Reihenfolge und in RS_DOC_REF_ID.
    """
    if not zeilen:
        bericht.fehler.append(
            Dateibefund(0, "", "", "Aufbau", "die Datei enthaelt keine Zeilen")
        )
        return

    if zeilen[0][1] != "Message":
        bericht.fehler.append(
            Dateibefund(
                zeilen[0][0], zeilen[0][1], "ROW_TYPE", "Aufbau",
                "die erste Zeile muss vom Typ Message sein",
            )
        )

    for typ in _EINMALIG:
        anzahl = bericht.zeilentypen.get(typ, 0)
        if anzahl > 1:
            bericht.fehler.append(
                Dateibefund(
                    0, typ, "ROW_TYPE", "Aufbau",
                    f"{typ} darf nur einmal vorkommen, gefunden: {anzahl}",
                )
            )

    verkaeufer: set[str] = set()
    for nummer, typ, werte in zeilen:
        if typ in {"RS_IND_Individual_Seller", "RS_ENT_Entity_Seller"}:
            kennung = werte.get("RS_DOC_REF_ID", "")
            if kennung in verkaeufer:
                bericht.fehler.append(
                    Dateibefund(
                        nummer, typ, "RS_DOC_REF_ID", "Aufbau",
                        "diese Verkaeuferkennung ist doppelt vergeben",
                        kennung,
                    )
                )
            verkaeufer.add(kennung)
        elif typ in _AKTIVITAETEN:
            kennung = werte.get("RS_DOC_REF_ID", "")
            if kennung and kennung not in verkaeufer:
                bericht.fehler.append(
                    Dateibefund(
                        nummer, typ, "RS_DOC_REF_ID", "Aufbau",
                        "verweist auf einen Verkaeufer, der davor nicht steht",
                        kennung,
                    )
                )


def _kopf_pruefen(kopf: list[str], bericht: Dateibericht) -> bool:
    """Die Kopfzeile muss den 89 Spalten der Vorlage exakt entsprechen."""
    if list(kopf) == list(SPALTEN):
        return True
    if len(kopf) != len(SPALTEN):
        bericht.fehler.append(
            Dateibefund(
                1, "", "", "Kopfzeile",
                f"{len(kopf)} Spalten statt {len(SPALTEN)}",
            )
        )
        return False
    for i, (ist, soll) in enumerate(zip(kopf, SPALTEN, strict=True)):
        if ist != soll:
            bericht.fehler.append(
                Dateibefund(
                    1, "", ist, "Kopfzeile",
                    f"an Position {i + 1} erwartet die Vorlage {soll}", ist,
                )
            )
    return False


def datei_pruefen(inhalt: str) -> Dateibericht:
    """Eine fertige DAC7-CSV gegen die Regeln der Vorlage prüfen.

    Nimmt den Text, wie er zur Behörde ginge, und gibt zurück, was daran
    nicht durchginge. Kennt das Modell nicht — genau das ist der Zweck.
    """
    bericht = Dateibericht()
    roh = inhalt.replace("\r\n", "\n").rstrip("\n").split("\n")
    if not roh or not roh[0].strip():
        bericht.fehler.append(
            Dateibefund(0, "", "", "Aufbau", "die Datei ist leer")
        )
        return bericht

    kopf = roh[0].lstrip("﻿").split(TRENNZEICHEN)
    if not _kopf_pruefen(kopf, bericht):
        return bericht

    zuordnung = _spaltenzuordnung(kopf)
    zeilen: list[tuple[int, str, dict[str, str]]] = []

    for versatz, text in enumerate(roh[1:], start=2):
        if not text.strip():
            continue
        felder = text.split(TRENNZEICHEN)
        if len(felder) != len(kopf):
            bericht.fehler.append(
                Dateibefund(
                    versatz, "", "", "Satzlaenge",
                    f"{len(felder)} Felder statt {len(kopf)} — "
                    "vermutlich ein Trennzeichen im Text",
                )
            )
            continue
        werte = {name: felder[i].strip() for name, i in zuordnung.items()}
        typ = werte.get("ROW_TYPE", "")
        if typ not in enums.ZEILENTYPEN:
            bericht.fehler.append(
                Dateibefund(
                    versatz, typ, "ROW_TYPE", "Zeilentyp",
                    "unbekannter Zeilentyp", typ,
                )
            )
            continue
        bericht.zeilentypen[typ] = bericht.zeilentypen.get(typ, 0) + 1
        zeilen.append((versatz, typ, werte))

    bericht.zeilen = len(zeilen)
    for nummer, typ, werte in zeilen:
        _pflicht_pruefen(typ, werte, nummer, bericht)
        _werte_pruefen(typ, werte, nummer, bericht)
    _kennungen_nur_oben(zeilen, bericht)
    _struktur_pruefen(zeilen, bericht)
    return bericht
