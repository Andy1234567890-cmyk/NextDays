"""Der Weg zur Behoerde — die einzige Stelle im Haus, die dorthin spricht.

WAS HIER PASSIERT
=================
Eine fertige Meldedatei entgegennehmen, an die Gegenstelle weiterreichen,
die Quittung zurueckgeben. Mehr nicht: kein Rechnen, kein Datenbankzugriff,
kein Erzeugen. Die Datei kommt fertig aus dem PMS.

WARUM SO WENIG
==============
Eine Steuermeldung ist nicht zurueckholbar. Was diesen Weg geht, soll an
einer Stelle sichtbar sein — eine Datei, ein Empfaenger, ein Protokoll.
Jede Zeile Fachlogik hier waere eine Zeile, die zwischen Absender und
Behoerde etwas veraendern koennte.

FEHLER SIND HIER KEINE AUSNAHME, SONDERN DER NORMALFALL
=======================================================
Die Gegenstelle ist ein fremder Server: Er kann langsam sein, in Wartung,
nicht erreichbar, oder etwas antworten, das kein JSON ist. Jeder dieser
Faelle bekommt eine benannte Antwort — ein „irgendwas ging schief" waere
bei einer Steuermeldung wertlos.

Und: Eine Zeitueberschreitung heisst NICHT, dass nichts ankam. Die Datei
kann die Behoerde erreicht haben, waehrend die Antwort verlorenging. Der
Aufrufer erfaehrt das ausdruecklich, statt es fuer einen Fehlschlag zu
halten und ein zweites Mal zu senden (Wurzel 2).
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import httpx

from . import umschlag as umschlag_modul
from .config import Settings, get_settings
from .logging import get_logger

log = get_logger("versender")


@dataclass(frozen=True, slots=True)
class Versandergebnis:
    """Was aus einem Einreichversuch geworden ist."""

    # Hat die Behoerde die Meldung ANGENOMMEN? `None` heisst: unbekannt —
    # die Antwort kam nicht an. Bewusst dreiwertig: `False` waere die
    # Behauptung, sie sei abgelehnt worden, und das wissen wir nicht.
    angenommen: bool | None
    # Die Quittungsnummer der Behoerde, sofern sie eine gab.
    quittungsnummer: str | None
    # Was der Aufrufer dem Betrieb zeigen soll — in ganzen Saetzen.
    meldung: str
    # Ob ein zweiter Versuch fachlich zulaessig ist. Bei unbekanntem
    # Ausgang NEIN: Erst muss geklaert werden, ob die erste Datei ankam.
    wiederholbar: bool
    gesendet_am: datetime
    pruefsumme: str
    ziel: str
    ist_teststufe: bool
    # Ging die Meldung als verschluesselter Umschlag hinaus? Gehoert in
    # das Ergebnis, nicht nur ins Log: Der Betrieb muss belegen koennen,
    # WIE uebermittelt wurde.
    verschluesselt: bool = False
    # Die vollstaendige Antwort der Gegenstelle, unveraendert. Der Betrieb
    # braucht sie im Streitfall.
    antwort: dict[str, Any] = field(default_factory=dict)


async def senden(rohdaten: bytes, dateiname: str) -> Versandergebnis:
    """Eine fertige Meldedatei bei der Behoerde einreichen."""
    e = get_settings()
    # Die Pruefsumme des KLARTEXTS, immer. Sie ist der Nachweis, WAS
    # eingereicht wurde, und muss deshalb unabhaengig davon sein, ob und
    # womit verschluesselt wurde: Zweimal verschluesselt ergibt zweimal
    # andere Bytes (frischer Nonce), eine Pruefsumme darueber belegte
    # nichts.
    pruef = hashlib.sha256(rohdaten).hexdigest()
    ziel = e.amt_url.rstrip("/") + "/v1/einreichung"

    if e.verschluesselung_pflicht and not e.sendet_verschluesselt():
        # Fail-closed: nicht senden. Eine Klartextmeldung an eine
        # Steuerbehoerde, weil eine Variable fehlte, ist kein
        # Schoenheitsfehler (Wurzel 4/5).
        log.warning("versand_abgebrochen_kein_schluessel", ziel=ziel)
        return _ergebnis(
            angenommen=False,
            nummer=None,
            meldung=(
                "Die Meldung wurde NICHT gesendet: Verschlüsselung ist "
                "verlangt (VERSCHLUESSELUNG_PFLICHT), aber es liegt kein "
                "öffentlicher Schlüssel der Gegenstelle vor (AMT_PUBKEY). "
                "Er ist dort unter /v1/schluessel abrufbar."
            ),
            wiederholbar=True,
            pruef=pruef,
            ziel=ziel,
            e=e,
        )

    nutzlast, sendename, verschluesselt = _nutzlast_bilden(
        rohdaten, dateiname, e
    )
    if verschluesselt is None:
        return _ergebnis(
            angenommen=False,
            nummer=None,
            meldung=(
                "Die Meldung wurde NICHT gesendet: Der öffentliche "
                "Schlüssel der Gegenstelle ist unbrauchbar. "
                f"{sendename}"
            ),
            wiederholbar=True,
            pruef=pruef,
            ziel=ziel,
            e=e,
        )

    log.info(
        "versand_beginnt",
        ziel=ziel,
        teststufe=e.amt_ist_teststufe,
        bytes=len(rohdaten),
        gesendete_bytes=len(nutzlast),
        verschluesselt=verschluesselt,
        pruefsumme=pruef[:16],
    )

    try:
        antwort = await _anfragen(ziel, nutzlast, sendename, e)
    except httpx.TimeoutException:
        return _ergebnis(
            angenommen=None,
            nummer=None,
            meldung=(
                "Die Behörde hat nicht innerhalb der Wartezeit geantwortet. "
                "Ob die Meldung angekommen ist, steht damit NICHT fest — "
                "bitte im Portal der Behörde nachsehen, bevor erneut "
                "gesendet wird."
            ),
            wiederholbar=False,
            pruef=pruef,
            ziel=ziel,
            e=e,
        )
    except httpx.HTTPError as exc:
        return _ergebnis(
            angenommen=None,
            nummer=None,
            meldung=f"Die Behörde war nicht erreichbar: {exc.__class__.__name__}.",
            wiederholbar=True,
            pruef=pruef,
            ziel=ziel,
            e=e,
        )

    return _auswerten(antwort, pruef, ziel, e, verschluesselt=verschluesselt)


def _nutzlast_bilden(
    rohdaten: bytes, dateiname: str, e: Settings
) -> tuple[bytes, str, bool | None]:
    """Was tatsaechlich auf die Leitung geht.

    Gibt `(nutzlast, dateiname, verschluesselt)` zurueck. `verschluesselt`
    ist `None`, wenn der Schluessel unbrauchbar war — dann traegt der
    zweite Wert den Grund, und es wird NICHT gesendet: Auf einen
    unbrauchbaren Schluessel mit Klartext auszuweichen waere genau die
    falsche Richtung (Wurzel 5).

    Die Endung `.umschlag` ist eine Hilfe fuer den Menschen, kein
    Erkennungsmerkmal: Die Gegenstelle erkennt den Umschlag am INHALT.
    """
    if not e.sendet_verschluesselt():
        return rohdaten, dateiname, False
    try:
        brief = umschlag_modul.verschliessen(
            rohdaten, e.amt_pubkey, dateiname=dateiname
        )
    except umschlag_modul.UmschlagError as exc:
        return b"", str(exc), None
    return brief, f"{dateiname}.umschlag", True


async def _anfragen(
    ziel: str, rohdaten: bytes, dateiname: str, e: Settings
) -> httpx.Response:
    auth = (
        httpx.BasicAuth(e.amt_basic_user, e.amt_basic_password)
        if e.amt_basic_user
        else None
    )
    kopf = {"X-Staging-Token": e.amt_token} if e.amt_token else {}
    async with httpx.AsyncClient(timeout=e.zeitlimit_s, auth=auth) as klient:
        return await klient.post(
            ziel,
            files={"datei": (dateiname, rohdaten, "text/csv")},
            headers=kopf,
        )


def _auswerten(
    antwort: httpx.Response,
    pruef: str,
    ziel: str,
    e: Settings,
    *,
    verschluesselt: bool = False,
) -> Versandergebnis:
    if antwort.status_code == 503:
        return _ergebnis(
            angenommen=False,
            nummer=None,
            meldung=(
                "Die Behörde nimmt derzeit keine Meldungen entgegen "
                "(Wartung). Die Datei wurde NICHT eingereicht — ein "
                "späterer Versuch ist unbedenklich."
            ),
            wiederholbar=True,
            pruef=pruef,
            ziel=ziel,
            e=e,
            verschluesselt=verschluesselt,
        )
    if antwort.status_code in (401, 403):
        return _ergebnis(
            angenommen=False,
            nummer=None,
            meldung=(
                "Die Behörde hat den Zugang abgewiesen. Die Zugangsdaten "
                "dieses Dienstes stimmen nicht — die Datei wurde nicht "
                "eingereicht."
            ),
            wiederholbar=False,
            pruef=pruef,
            ziel=ziel,
            e=e,
            verschluesselt=verschluesselt,
        )

    try:
        daten = antwort.json()
    except ValueError:
        return _ergebnis(
            angenommen=None,
            nummer=None,
            meldung=(
                f"Die Behörde hat mit Status {antwort.status_code} geantwortet, "
                "aber nicht in einem lesbaren Format. Ob die Meldung "
                "angekommen ist, steht nicht fest."
            ),
            wiederholbar=False,
            pruef=pruef,
            ziel=ziel,
            e=e,
            verschluesselt=verschluesselt,
        )

    angenommen = bool(daten.get("angenommen"))
    nummer = daten.get("quittungsnummer")
    anzahl = len(daten.get("fehler") or [])
    meldung = (
        f"Die Meldung wurde angenommen. Quittung {nummer}."
        if angenommen
        else (
            f"Die Behörde hat die Meldung abgewiesen: {anzahl} "
            f"{'Beanstandung' if anzahl == 1 else 'Beanstandungen'}. "
            "Die Datei gilt als NICHT eingereicht."
        )
    )
    return _ergebnis(
        angenommen=angenommen,
        nummer=nummer,
        meldung=meldung,
        # Eine abgewiesene Meldung darf erneut gesendet werden — sie kam
        # ja nicht an. Eine angenommene NICHT: das wäre eine Doppelmeldung.
        wiederholbar=not angenommen,
        pruef=pruef,
        ziel=ziel,
        e=e,
        verschluesselt=verschluesselt,
        antwort=daten,
    )


def _ergebnis(
    *,
    angenommen: bool | None,
    nummer: str | None,
    meldung: str,
    wiederholbar: bool,
    pruef: str,
    ziel: str,
    e: Settings,
    antwort: dict[str, Any] | None = None,
    verschluesselt: bool = False,
) -> Versandergebnis:
    ergebnis = Versandergebnis(
        angenommen=angenommen,
        quittungsnummer=nummer,
        meldung=meldung,
        wiederholbar=wiederholbar,
        gesendet_am=datetime.now(UTC),
        pruefsumme=pruef,
        ziel=ziel,
        ist_teststufe=e.amt_ist_teststufe,
        verschluesselt=verschluesselt,
        antwort=antwort or {},
    )
    log.info(
        "versand_ergebnis",
        angenommen=angenommen,
        quittung=nummer,
        wiederholbar=wiederholbar,
        teststufe=e.amt_ist_teststufe,
    )
    return ergebnis
