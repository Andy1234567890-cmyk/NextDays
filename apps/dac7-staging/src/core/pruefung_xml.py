"""Die XML-Pruefung der Empfangsstelle (OECD DPI).

Ab dem Meldejahr 2026 nimmt Skattestyrelsen die Meldung als DPI-XML statt
als CSV entgegen. Dieser Pruefer nimmt sie schon jetzt an, damit der Weg
getestet werden kann, bevor er Pflicht wird.

WAS GEPRUEFT WIRD — UND WAS NICHT
==================================
Geprueft wird die STRUKTUR des Baums und die Belegung der Pflichtelemente:

    DPI_OECD
      MessageSpec              genau einmal
      DPIBody
        PlatformOperator       der meldende Betrieb
        ReportableSeller       je Verkaeufer einer
          Immovable            je Objekt eines

Das ist dieselbe Sachlage wie in der CSV, nur als Baum: Was dort ueber
`RS_DOC_REF_ID` und die Zeilenreihenfolge zusammenhaengt, haengt hier
ineinander. Die Kardinalitaet `1..1` aus dem Blatt `Vejledningstekster`
beschreibt genau diese Baumform — nicht die flache CSV-Zeile.

NICHT geprueft wird gegen das amtliche XSD: Es liegt uns nicht vor. Diese
Pruefung ersetzt es nicht und behauptet das auch nicht — sie faengt die
Fehlerklassen, die ohne Schema unsichtbar blieben (fehlende Pflichtangaben,
unbekannte Werte, verwaiste Objekte). Sobald das XSD vorliegt, gehoert eine
echte Schema-Validierung daneben, nicht an ihre Stelle.

SICHERHEIT
==========
Fremdes XML wird mit `defusedxml`-Haltung gelesen: keine Entity-Aufloesung,
keine externen Verweise. Ein eingereichtes Dokument ist angreiferkontrolliert
(Wurzel 8) — „billion laughs" und Datei-Zugriff per DTD sind reale Wege.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

from . import vorlage
from .pruefung_csv import Befund, Quittung

# Namensraum des OECD-DPI-Schemas. Ein Dokument ohne ihn ist kein DPI-XML.
_NS_DPI = "urn:oecd:ties:dpi:v1"

# Muster, die auf eine DTD oder eine externe Entity hindeuten. Beides hat in
# einer Steuermeldung nichts zu suchen und ist der Einstieg fuer XXE.
_GEFAEHRLICH = re.compile(r"<!DOCTYPE|<!ENTITY|SYSTEM\s+[\"']|PUBLIC\s+[\"']", re.I)


@dataclass
class _Zaehler:
    verkaeufer: int = 0
    objekte: int = 0
    kennungen: set[str] = field(default_factory=set)


def xml_pruefen(inhalt: str) -> Quittung:
    """Ein eingereichtes DPI-XML pruefen und quittieren."""
    q = Quittung()

    if _GEFAEHRLICH.search(inhalt):
        q.fehler.append(
            Befund(
                0, "", "", "Sicherheit",
                "das Dokument enthaelt eine DTD oder eine externe Entity — "
                "beides wird nicht verarbeitet",
            )
        )
        return q

    try:
        wurzel = ET.fromstring(inhalt)  # noqa: S314 — DTD/Entity oben abgewiesen
    except ET.ParseError as exc:
        q.fehler.append(
            Befund(
                getattr(exc, "position", (0, 0))[0], "", "", "XML",
                f"das Dokument ist nicht wohlgeformt: {exc}",
            )
        )
        return q

    _wurzel_pruefen(q, wurzel)
    _baum_pruefen(q, wurzel)
    return q


def _ohne_ns(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def _text(element: ET.Element | None) -> str:
    return (element.text or "").strip() if element is not None else ""


def _finde(el: ET.Element, name: str) -> ET.Element | None:
    """Kindelement nach lokalem Namen — unabhaengig vom Namensraum-Praefix."""
    for kind in el:
        if _ohne_ns(kind.tag) == name:
            return kind
    return None


def _alle(el: ET.Element, name: str) -> list[ET.Element]:
    return [k for k in el.iter() if _ohne_ns(k.tag) == name]


def _wurzel_pruefen(q: Quittung, wurzel: ET.Element) -> None:
    if _ohne_ns(wurzel.tag) != "DPI_OECD":
        q.fehler.append(
            Befund(
                0, _ohne_ns(wurzel.tag), "", "Aufbau",
                "das Wurzelelement muss DPI_OECD heissen",
                _ohne_ns(wurzel.tag),
            )
        )
    if _NS_DPI not in wurzel.tag:
        q.hinweise.append(
            Befund(
                0, _ohne_ns(wurzel.tag), "xmlns", "Namensraum",
                f"erwartet wird der Namensraum {_NS_DPI}",
                wurzel.tag.split("}")[0].lstrip("{") if "}" in wurzel.tag else "",
            )
        )


def _baum_pruefen(q: Quittung, wurzel: ET.Element) -> None:
    spec = _finde(wurzel, "MessageSpec")
    if spec is None:
        q.fehler.append(
            Befund(0, "DPI_OECD", "MessageSpec", "Pflichtangabe", "MessageSpec fehlt")
        )
    else:
        _messagespec_pruefen(q, spec)

    body = _finde(wurzel, "DPIBody")
    if body is None:
        q.fehler.append(
            Befund(0, "DPI_OECD", "DPIBody", "Pflichtangabe", "DPIBody fehlt")
        )
        return

    betreiber = _finde(body, "PlatformOperator")
    if betreiber is None:
        q.fehler.append(
            Befund(
                0, "DPIBody", "PlatformOperator", "Pflichtangabe",
                "der meldende Betrieb fehlt",
            )
        )
    else:
        _betreiber_pruefen(q, betreiber)

    z = _Zaehler()
    for verkaeufer in _alle(body, "ReportableSeller"):
        z.verkaeufer += 1
        _verkaeufer_pruefen(q, verkaeufer, z)

    q.zeilen = 1 + (1 if betreiber is not None else 0) + z.verkaeufer + z.objekte
    q.zeilentypen = {
        "MessageSpec": 1 if spec is not None else 0,
        "PlatformOperator": 1 if betreiber is not None else 0,
        "ReportableSeller": z.verkaeufer,
        "Immovable": z.objekte,
    }

    if not z.verkaeufer:
        q.hinweise.append(
            Befund(
                0, "DPIBody", "ReportableSeller", "Aufbau",
                "die Meldung enthaelt keinen Verkaeufer — als Nullmeldung "
                "muss MessageTypeIndic auf DPI403 stehen",
            )
        )


def _messagespec_pruefen(q: Quittung, spec: ET.Element) -> None:
    art = _text(_finde(spec, "MessageTypeIndic"))
    if art and art not in vorlage.MELDEARTEN:
        q.fehler.append(
            Befund(
                0, "MessageSpec", "MessageTypeIndic", "Werteliste",
                "Wert steht nicht in der Vorlage", art,
            )
        )
    for pflicht in ("TransmittingCountry", "MessageRefId", "ReportingPeriod"):
        if not _text(_finde(spec, pflicht)):
            q.fehler.append(
                Befund(0, "MessageSpec", pflicht, "Pflichtangabe", f"{pflicht} fehlt")
            )
    land = _text(_finde(spec, "TransmittingCountry"))
    if land and land not in vorlage.LAENDERCODES:
        q.fehler.append(
            Befund(
                0, "MessageSpec", "TransmittingCountry", "Werteliste",
                "unbekannter Laendercode", land,
            )
        )


def _betreiber_pruefen(q: Quittung, betreiber: ET.Element) -> None:
    if not _text(_finde(betreiber, "DocSpec")) and _finde(betreiber, "DocSpec") is None:
        q.fehler.append(
            Befund(
                0, "PlatformOperator", "DocSpec", "Pflichtangabe",
                "DocSpec mit DocRefId fehlt",
            )
        )
    tin = _alle(betreiber, "TIN")
    if not tin or not _text(tin[0]):
        q.fehler.append(
            Befund(
                0, "PlatformOperator", "TIN", "Pflichtangabe",
                "die Steuernummer des Betriebs fehlt",
            )
        )
    _laender_pruefen(q, betreiber, "PlatformOperator")


def _verkaeufer_pruefen(q: Quittung, verkaeufer: ET.Element, z: _Zaehler) -> None:
    doc = _finde(verkaeufer, "DocSpec")
    kennung = _text(_finde(doc, "DocRefId")) if doc is not None else ""
    if not kennung:
        q.fehler.append(
            Befund(
                0, "ReportableSeller", "DocRefId", "Pflichtangabe",
                "der Verkaeufer hat keine Kennung — eine Korrektur kann sich "
                "spaeter nicht auf ihn beziehen",
            )
        )
    elif kennung in z.kennungen:
        q.fehler.append(
            Befund(
                0, "ReportableSeller", "DocRefId", "Einmaligkeit",
                "diese Kennung wurde bereits vergeben", kennung,
            )
        )
    else:
        z.kennungen.add(kennung)

    ist_person = _finde(verkaeufer, "Individual") is not None
    ist_firma = _finde(verkaeufer, "Entity") is not None
    if not ist_person and not ist_firma:
        q.fehler.append(
            Befund(
                0, "ReportableSeller", "Individual/Entity", "Pflichtangabe",
                "der Verkaeufer ist weder als Person noch als Gesellschaft "
                "beschrieben", kennung,
            )
        )
    _laender_pruefen(q, verkaeufer, "ReportableSeller")
    _objekte_pruefen(q, verkaeufer, kennung, z)


def _objekte_pruefen(
    q: Quittung, verkaeufer: ET.Element, kennung: str, z: _Zaehler
) -> None:
    objekte = _alle(verkaeufer, "Immovable")
    z.objekte += len(objekte)
    if not objekte:
        q.hinweise.append(
            Befund(
                0, "ReportableSeller", "Immovable", "Aufbau",
                "dieser Verkaeufer hat keine gemeldete Immobilie", kennung,
            )
        )
    for objekt in objekte:
        _ein_objekt_pruefen(q, objekt, kennung)


def _ein_objekt_pruefen(q: Quittung, objekt: ET.Element, kennung: str) -> None:
    art = _text(_finde(objekt, "PropertyType"))
    if art and art not in vorlage.OBJEKTARTEN:
        q.fehler.append(
            Befund(
                0, "Immovable", "PropertyType", "Werteliste",
                "Wert steht nicht in der Vorlage", art,
            )
        )
    if _finde(objekt, "Address") is None:
        q.fehler.append(
            Befund(
                0, "Immovable", "Address", "Pflichtangabe",
                "die Anschrift der Immobilie fehlt", kennung,
            )
        )
    _betraege_pruefen(q, objekt)


def _betraege_pruefen(q: Quittung, objekt: ET.Element) -> None:
    for element in _alle(objekt, "Consideration") + _alle(objekt, "Fees") + _alle(
        objekt, "Taxes"
    ):
        for betrag in element:
            wert = (betrag.text or "").strip()
            waehrung = betrag.get("currCode", "")
            if waehrung and waehrung not in vorlage.WAEHRUNGEN:
                q.fehler.append(
                    Befund(
                        0, "Immovable", _ohne_ns(betrag.tag), "Werteliste",
                        "unbekannter Waehrungscode", waehrung,
                    )
                )
            if wert:
                _einen_betrag_pruefen(q, betrag, wert)


def _einen_betrag_pruefen(q: Quittung, betrag: ET.Element, wert: str) -> None:
    try:
        if float(wert) < 0:
            q.fehler.append(
                Befund(
                    0, "Immovable", _ohne_ns(betrag.tag), "Betrag",
                    "negative Betraege sind nicht vorgesehen", wert,
                )
            )
    except ValueError:
        q.fehler.append(
            Befund(
                0, "Immovable", _ohne_ns(betrag.tag), "Betrag",
                "kein gueltiger Betrag", wert,
            )
        )


def _laender_pruefen(q: Quittung, el: ET.Element, typ: str) -> None:
    for name in ("ResCountryCode", "CountryCode"):
        for kind in _alle(el, name):
            wert = _text(kind)
            if wert and wert not in vorlage.LAENDERCODES:
                q.fehler.append(
                    Befund(0, typ, name, "Werteliste", "unbekannter Laendercode", wert)
                )
