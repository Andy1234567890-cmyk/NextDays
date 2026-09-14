"""Einreichung einer DAC7-Meldung bei der simulierten Empfangsstelle.

Der Weg entspricht dem bei TastSelv Erhverv: Datei hochladen, Pruefung
abwarten, Quittung erhalten. Angenommen wird nur eine fehlerfreie Datei.

ERZWUNGENE FEHLERFAELLE
=======================
Ueber den Kopf `X-Staging-Verhalten` laesst sich die Gegenstelle gezielt
zum Ablehnen bringen. Das ist der eigentliche Wert einer Teststufe: Der
GUTFALL laesst sich auch gegen die echte Behoerde einmal im Jahr pruefen —
der Fehlerpfad nicht, denn niemand reicht absichtlich eine kaputte
Steuermeldung ein.

Ohne diesen Schalter bliebe ungetestet, was passiert, wenn die Behoerde
nicht antwortet, eine Datei zurueckweist oder eine bereits eingereichte
Meldung erkennt — und genau das faellt dann am 31. Januar auf.

VERSCHLUESSELTE UMSCHLAEGE
==========================
Seit dem 11.09.2026 nimmt die Stelle die Meldung auch als verschluesselten
Umschlag entgegen (`core/umschlag.py`: RSA-4096-OAEP + AES-256-GCM). Sie
erkennt ihn am Inhalt, nicht an einem Kopf oder der Dateiendung — ein
Absender soll nicht ankuendigen muessen, was er schickt.

Ob Umschlag oder Klartext: Ab dem Moment, in dem die Datei offen
vorliegt, ist der Weg derselbe. Die Verschluesselung ist eine Huelle um
die Uebertragung, keine zweite Meldungsart.

DAS SCHRITTPROTOKOLL
====================
Jede Einreichung traegt jetzt ihre Stationen mit (`protokoll.Schritt`):
Empfang, Entschluesselung, Formaterkennung, Pruefung, Dublettenpruefung,
Quittung — jede mit eigener Dauer und einem NACHWEIS (Pruefsumme,
Schluesselkennung, Zahl), nie mit einem Feldwert.

Vorher gab es nur das Ergebnis. Fuer die Behoerde ist aber der WEG die
Frage: wo entschluesselt wird, woran eine Verfaelschung auffaellt, was
zwischen Empfang und Quittung passiert.
"""
from __future__ import annotations

import asyncio
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import asdict, dataclass

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, status

from ..core import umschlag as umschlag_modul
from ..core.auth import zugang_pruefen
from ..core.config import get_settings
from ..core.logging import get_logger
from ..core.protokoll import Eintrag, Protokoll, Schritt, pruefsumme
from ..core.pruefung_csv import Befund, Quittung, csv_pruefen
from ..core.pruefung_xml import xml_pruefen
from .schemas import BefundAusgabe, QuittungAusgabe, SchrittAusgabe

log = get_logger("einreichung")
router = APIRouter(tags=["Einreichung"], dependencies=[Depends(zugang_pruefen)])

# Der Speicher lebt im Prozess (siehe core/protokoll.py). Eine Instanz je
# Dienst; bei mehreren Arbeitern sieht jeder seinen eigenen — fuer eine
# Teststufe gewollt, in der Doku benannt.
PROTOKOLL = Protokoll(get_settings().aufbewahrung_stunden)

# Was `X-Staging-Verhalten` ausloesen kann.
_VERHALTEN = {
    "normal": "regulaer pruefen",
    "ablehnen": "unabhaengig vom Inhalt zurueckweisen",
    "wartung": "Empfangsstelle nicht erreichbar (503)",
    "zeitueberschreitung": "Antwort verzoegern, bis der Aufrufer aufgibt",
    "doppelt": "Meldung als bereits eingereicht zurueckweisen",
}


@router.post(
    "/einreichung",
    response_model=QuittungAusgabe,
    summary="Eine DAC7-Meldung einreichen (CSV oder XML)",
)
async def einreichen(
    datei: UploadFile = File(..., description="Die Meldedatei (.csv oder .xml)"),
    x_staging_verhalten: str | None = Header(default=None),
) -> QuittungAusgabe:
    """Nimmt eine Meldedatei entgegen, prueft sie und quittiert."""
    verhalten = (x_staging_verhalten or "normal").lower()
    if verhalten not in _VERHALTEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unbekanntes Verhalten. Moeglich: {', '.join(_VERHALTEN)}",
        )

    begonnen = time.perf_counter()
    mitschrift = _Mitschrift()
    await _verhalten_anwenden(verhalten)

    rohdaten = await _rohdaten_lesen(datei)
    # Die Pruefsumme der ANGEKOMMENEN Bytes — bei einem Umschlag also die
    # des Umschlags. Sie belegt, was auf der Leitung war.
    empfangen_summe = pruefsumme(rohdaten)
    mitschrift.halten(
        "Empfang", True,
        f"{len(rohdaten)} Byte entgegengenommen",
        f"SHA-256 {empfangen_summe[:16]}…",
    )

    nutzdaten, umschlag_kopf, fehler_umschlag = _umschlag_oeffnen(
        rohdaten, mitschrift
    )
    if fehler_umschlag is not None:
        return _umschlag_quittung(
            fehler_umschlag, datei, rohdaten, empfangen_summe,
            mitschrift, begonnen,
        )

    formatname = _format_bestimmen(datei.filename or "", nutzdaten)
    inhalt = _text_lesen(nutzdaten)
    mitschrift.halten(
        "Formaterkennung", True,
        f"als {formatname.upper()} gelesen, UTF-8",
        f"{len(inhalt)} Zeichen",
    )

    with mitschrift.messen() as dauer:
        quittung = _pruefen(formatname, inhalt, verhalten)
    mitschrift.halten(
        "Pruefung", quittung.angenommen,
        (
            f"{quittung.zeilen} Saetze gegen die amtliche Vorlage geprueft"
            if quittung.angenommen
            else f"{len(quittung.fehler)} Fehler gefunden"
        ),
        ", ".join(f"{t}×{n}" for t, n in quittung.zeilentypen.items()),
        dauer(),
    )

    return _abschliessen(
        quittung, mitschrift,
        _Eingang(
            datei=datei, rohdaten=rohdaten, nutzdaten=nutzdaten,
            inhalt=inhalt, formatname=formatname,
            umschlag_kopf=umschlag_kopf, begonnen=begonnen,
        ),
    )


@dataclass(frozen=True, slots=True)
class _Eingang:
    """Was von der Einreichung selbst bekannt ist, jenseits der Pruefung.

    Sie fasst zusammen, was `_abschliessen` braucht — sonst waeren es sechs
    weitere Parameter, und `einreichen` traegt ohnehin bereits mehr lokale
    Groessen, als sich ueberblicken laesst.
    """

    datei: UploadFile
    rohdaten: bytes
    nutzdaten: bytes
    inhalt: str
    formatname: str
    umschlag_kopf: dict | None
    begonnen: float


def _abschliessen(
    quittung: Quittung, mitschrift: _Mitschrift, eingang: _Eingang
) -> QuittungAusgabe:
    """Dublettensperre, Protokollablage und Quittung.

    Getrennt von `einreichen`, weil das die drei Schritte sind, die NACH
    der fachlichen Pruefung stehen und deren Ergebnis nicht mehr aendern —
    sie schreiben es nur fest.
    """
    # Die Dublettensperre greift am KLARTEXT, nicht am Umschlag: Zweimal
    # verschluesselt ergibt zweimal andere Bytes (frischer Nonce), derselbe
    # Inhalt bliebe sonst unerkannt und die Meldung ginge doppelt durch.
    # „Indtaegten skal kun indberettes een gang og ikke dobbelt."
    summe = pruefsumme(eingang.nutzdaten)
    vorher = len(quittung.fehler)
    _dublette_pruefen(summe, quittung)
    mitschrift.halten(
        "Dublettenpruefung", len(quittung.fehler) == vorher,
        (
            "diese Meldung lag noch nicht vor"
            if len(quittung.fehler) == vorher
            else "diese Meldung wurde bereits angenommen"
        ),
        f"Klartext-SHA-256 {summe[:16]}…",
    )

    mitschrift.halten(
        "Quittung", quittung.angenommen,
        "angenommen" if quittung.angenommen else "zurueckgewiesen",
    )

    eintrag = PROTOKOLL.ablegen(
        format=eingang.formatname,
        dateiname=eingang.datei.filename or "(ohne Namen)",
        bytes_gesamt=len(eingang.rohdaten),
        pruefsumme=summe,
        angenommen=quittung.angenommen,
        zeilen=quittung.zeilen,
        zeilentypen=quittung.zeilentypen,
        fehler=quittung.fehler,
        hinweise=quittung.hinweise,
        saetze=quittung.saetze,
        rohtext=eingang.inhalt,
        dauer_ms=(time.perf_counter() - eingang.begonnen) * 1000,
        schritte=mitschrift.schritte,
        verschluesselt=bool(eingang.umschlag_kopf),
        umschlag_kopf=eingang.umschlag_kopf,
    )
    log.info(
        "einreichung",
        quittung=eintrag.quittungsnummer,
        format=eingang.formatname,
        verschluesselt=eintrag.verschluesselt,
        angenommen=eintrag.angenommen,
        fehler=len(eintrag.fehler),
    )
    return _als_ausgabe(eintrag)


class _Mitschrift:
    """Sammelt die Stationen einer Einreichung samt Dauer.

    Die Dauer wird je Schritt gemessen, nicht aus der Gesamtzeit
    geschaetzt: Sonst liesse sich nicht zeigen, was die Verschluesselung
    wirklich kostet — und eine geschaetzte Zahl in einer Vorfuehrung fuer
    eine Behoerde ist eine Behauptung.
    """

    __slots__ = ("_zuletzt", "schritte")

    def __init__(self) -> None:
        self.schritte: list[Schritt] = []
        self._zuletzt = time.perf_counter()

    def halten(
        self,
        name: str,
        geschafft: bool,
        beschreibung: str,
        belegt: str = "",
        dauer_ms: float | None = None,
    ) -> None:
        jetzt = time.perf_counter()
        self.schritte.append(
            Schritt(
                name=name,
                geschafft=geschafft,
                dauer_ms=(
                    dauer_ms
                    if dauer_ms is not None
                    else (jetzt - self._zuletzt) * 1000
                ),
                beschreibung=beschreibung,
                belegt=belegt,
            )
        )
        self._zuletzt = jetzt

    @contextmanager
    def messen(self) -> Iterator[Callable[[], float]]:
        """Die Dauer eines Blocks, abrufbar nach dem Verlassen."""
        start = time.perf_counter()
        ende: list[float] = []
        try:
            yield lambda: ende[0] if ende else (time.perf_counter() - start) * 1000
        finally:
            ende.append((time.perf_counter() - start) * 1000)


def _umschlag_oeffnen(
    rohdaten: bytes, mitschrift: _Mitschrift
) -> tuple[bytes, dict, str | None]:
    """Einen verschluesselten Umschlag oeffnen, falls es einer ist.

    Erkannt wird am INHALT, nicht an der Dateiendung oder einem Kopf: Ein
    Absender soll nicht ankuendigen muessen, was er schickt, und eine
    Endung ist ohnehin nur eine Behauptung.

    Gibt `(nutzdaten, umschlag_kopf, fehlertext)` zurueck. Ist der
    Fehlertext gesetzt, ist die Einreichung gescheitert — und zwar
    fail-closed: Ein Umschlag, der sich nicht oeffnen laesst, wird NIE als
    Klartext weiterverarbeitet. Sonst landete ein Geheimtext in der
    Formatpruefung und die Stelle meldete „unbekanntes Format" statt
    „konnte nicht entschluesselt werden".
    """
    if not _sieht_wie_umschlag_aus(rohdaten):
        mitschrift.halten(
            "Entschluesselung", True,
            "nicht verschluesselt eingereicht — Klartext",
        )
        return rohdaten, {}, None

    einstellungen = get_settings()
    if not einstellungen.nimmt_verschluesselt_entgegen():
        grund = (
            "Die Meldung kam verschluesselt an, dieser Stelle fehlt aber "
            "der private Schluessel (EMPFAENGER_PRIVKEY)."
        )
        mitschrift.halten("Entschluesselung", False, grund)
        return rohdaten, {}, grund

    with mitschrift.messen() as dauer:
        try:
            geoeffnet = umschlag_modul.oeffnen(
                rohdaten, einstellungen.empfaenger_privkey
            )
        except umschlag_modul.UmschlagError as exc:
            mitschrift.halten(
                "Entschluesselung", False, str(exc), dauer_ms=dauer()
            )
            return rohdaten, {}, str(exc)

    if not geoeffnet.pruefsumme_stimmt:
        grund = (
            "Der Umschlag liess sich oeffnen, aber die Pruefsumme im Kopf "
            "passt nicht zum Inhalt."
        )
        mitschrift.halten(
            "Entschluesselung", False, grund, dauer_ms=dauer()
        )
        return rohdaten, geoeffnet.kopf, grund

    mitschrift.halten(
        "Entschluesselung", True,
        f"Umschlag geoeffnet ({geoeffnet.kopf.get('verfahren', '')})",
        f"Schluessel {geoeffnet.kopf.get('schluessel_kennung', '?')}, "
        f"Pruefsumme des Klartexts bestaetigt",
        dauer_ms=dauer(),
    )
    return geoeffnet.klartext, geoeffnet.kopf, None


def _sieht_wie_umschlag_aus(rohdaten: bytes) -> bool:
    """Ob die Bytes ein Umschlag sein koennten.

    Geprueft wird auf die Formatkennung im JSON-Kopf. Das ist genauer als
    „beginnt mit {": Eine Meldung ist CSV oder XML, aber ein kuenftiges
    JSON-Format soll nicht versehentlich als Umschlag gelesen werden.
    """
    anfang = rohdaten[:400].lstrip()
    return anfang.startswith(b"{") and umschlag_modul.FORMAT.encode() in rohdaten[:800]


def _umschlag_quittung(
    grund: str,
    datei: UploadFile,
    rohdaten: bytes,
    summe: str,
    mitschrift: _Mitschrift,
    begonnen: float,
) -> QuittungAusgabe:
    """Eine Zurueckweisung, die am Umschlag scheiterte.

    Sie wird protokolliert wie jede andere: Der Betrieb soll in der
    Uebersicht sehen, DASS eine Einreichung ankam und woran sie scheiterte.
    Ein stiller 400 waere fuer eine Teststufe wertlos — genau dieser Fall
    ist der, den man ueben will.

    Der Rohinhalt wird NICHT mitgeschrieben: Er ist Geheimtext, ihn
    anzuzeigen hilft niemandem, und er koennte bei einem falschen
    Schluessel echte Daten tragen.
    """
    quittung = Quittung()
    quittung.fehler.append(
        Befund(0, "", "", "Verschluesselung", grund)
    )
    mitschrift.halten("Quittung", False, "zurueckgewiesen")
    eintrag = PROTOKOLL.ablegen(
        format="umschlag",
        dateiname=datei.filename or "(ohne Namen)",
        bytes_gesamt=len(rohdaten),
        pruefsumme=summe,
        angenommen=False,
        zeilen=0,
        zeilentypen={},
        fehler=quittung.fehler,
        hinweise=[],
        saetze=[],
        rohtext="",
        dauer_ms=(time.perf_counter() - begonnen) * 1000,
        schritte=mitschrift.schritte,
        verschluesselt=True,
        umschlag_kopf={},
    )
    log.info(
        "einreichung_umschlag_abgewiesen",
        quittung=eintrag.quittungsnummer,
    )
    return _als_ausgabe(eintrag)


async def _verhalten_anwenden(verhalten: str) -> None:
    if verhalten == "wartung":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Die Empfangsstelle ist derzeit nicht erreichbar (Wartung).",
        )
    if verhalten == "zeitueberschreitung":
        # Laenger als jedes vernuenftige Client-Zeitlimit. Der Aufrufer soll
        # abbrechen — genau das ist der zu testende Fall.
        await asyncio.sleep(120)


async def _rohdaten_lesen(datei: UploadFile) -> bytes:
    grenze = get_settings().max_datei_bytes
    rohdaten = await datei.read(grenze + 1)
    if len(rohdaten) > grenze:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Die Datei ist groesser als {grenze // (1024 * 1024)} MB. "
                "Eine DAC7-Meldung erreicht diese Groesse nicht."
            ),
        )
    if not rohdaten:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Die Datei ist leer.",
        )
    return rohdaten


def _format_bestimmen(dateiname: str, rohdaten: bytes) -> str:
    """Am INHALT erkennen, nicht am Dateinamen.

    Ein Dateiname ist eine Behauptung des Absenders. Die ersten Bytes
    sagen, was wirklich vorliegt.
    """
    anfang = rohdaten[:200].lstrip()
    if anfang.startswith(b"<?xml") or anfang.startswith(b"<"):
        return "xml"
    if dateiname.lower().endswith(".xml"):
        return "xml"
    return "csv"


def _text_lesen(rohdaten: bytes) -> str:
    """UTF-8 mit und ohne BOM. Excel schreibt die Datei mit BOM."""
    try:
        return rohdaten.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Die Datei ist nicht UTF-8-kodiert. Die Vorlage exportiert "
                "als UTF-8 (xlCSVUTF8)."
            ),
        ) from exc


def _pruefen(formatname: str, inhalt: str, verhalten: str) -> Quittung:
    quittung = xml_pruefen(inhalt) if formatname == "xml" else csv_pruefen(inhalt)
    if verhalten == "ablehnen":
        quittung.fehler.append(
            Befund(
                0, "", "", "Teststufe",
                "Diese Einreichung wurde auf Anforderung zurueckgewiesen "
                "(X-Staging-Verhalten: ablehnen).",
            )
        )
    if verhalten == "doppelt":
        quittung.fehler.append(
            Befund(
                0, "Message", "MSG_MESSAGE_REF_ID", "Einmaligkeit",
                "Fuer diesen Meldezeitraum liegt bereits eine Meldung mit "
                "dieser Kennung vor. Eine Korrektur braucht DPI402 und einen "
                "Verweis auf die urspruengliche Kennung.",
            )
        )
    return quittung


def _dublette_pruefen(summe: str, quittung: Quittung) -> None:
    """Dieselbe Datei ein zweites Mal — die Behoerde nimmt sie nicht an.

    Geprueft wird die Pruefsumme der Bytes, nicht die Meldungskennung: Zwei
    Einreichungen, die sich in keinem Byte unterscheiden, sind derselbe
    Vorgang. Eine Korrektur sieht anders aus — sie traegt DPI402 und
    CORR_DOC_REF_ID und hat damit eine andere Pruefsumme.

    Warum das hier steht und nicht nur hinter `X-Staging-Verhalten:
    doppelt`: Die Teststufe soll die Behoerde nachbilden. Nahm sie dieselbe
    Datei zweimal an, bestand das PMS einen Test, den die echte Stelle
    nicht durchgehen laesst — und die Einnahme waere doppelt gemeldet.
    """
    frueher = PROTOKOLL.bereits_angenommen(summe)
    if frueher is None:
        return
    quittung.fehler.append(
        Befund(
            0,
            "Message",
            "MSG_MESSAGE_REF_ID",
            "Einmaligkeit",
            "Diese Datei wurde bereits angenommen "
            f"(Quittung {frueher.quittungsnummer}, "
            f"{frueher.empfangen_am:%d-%m-%Y %H:%M} UTC). Eine Einnahme "
            "wird nur einmal gemeldet. Eine Korrektur traegt DPI402 und "
            "verweist ueber CORR_DOC_REF_ID auf die urspruengliche Kennung.",
        )
    )


def _als_ausgabe(eintrag: Eintrag) -> QuittungAusgabe:
    """Protokolleintrag in die Antwort umsetzen.

    `dataclasses.asdict` statt `vars()`: Die Befunde sind
    `slots=True`-Dataclasses und haben deshalb gar kein `__dict__` —
    `vars()` wirft darauf einen TypeError. Aufgefallen ist das erst im
    Test, weil der Gutfall keine Befunde enthaelt und die Schleife dort
    nie lief.
    """
    return QuittungAusgabe(
        quittungsnummer=eintrag.quittungsnummer,
        empfangen_am=eintrag.empfangen_am,
        format=eintrag.format,
        dateiname=eintrag.dateiname,
        bytes_gesamt=eintrag.bytes_gesamt,
        pruefsumme=eintrag.pruefsumme,
        angenommen=eintrag.angenommen,
        zeilen=eintrag.zeilen,
        zeilentypen=eintrag.zeilentypen,
        fehler=[BefundAusgabe(**asdict(b)) for b in eintrag.fehler],
        hinweise=[BefundAusgabe(**asdict(b)) for b in eintrag.hinweise],
        saetze=eintrag.saetze,
        schritte=[SchrittAusgabe(**asdict(s)) for s in eintrag.schritte],
        verschluesselt=eintrag.verschluesselt,
        umschlag_kopf=eintrag.umschlag_kopf,
    )
