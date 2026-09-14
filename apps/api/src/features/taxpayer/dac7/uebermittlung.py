"""Die Meldung an den Versanddienst uebergeben.

WARUM EIN EIGENES MODUL UND NICHT IM SERVICE
=============================================
Der Service rechnet die Meldung und legt sie ab. Er spricht KEIN HTTP.
Diese Trennung ist nicht Kosmetik: Eine Steuermeldung ist nicht
zurueckholbar, und die Stelle, die sie aus dem Haus gibt, soll genau eine
sein und nichts anderes tun.

WARUM DER WEG UEBER `apps/dac7-API` GEHT
=========================================
Dieses PMS spricht nie selbst mit der Steuerbehoerde. Dazwischen steht der
Versanddienst — ein eigener Dienst, auf einem eigenen Server, mit eigenem
Protokoll. Dadurch gibt es einen Ort, an dem nachvollziehbar ist, was das
Haus an eine Behoerde geschickt hat, und dieser Ort haengt nicht am
Lebenszyklus des PMS.

Der Versanddienst verschluesselt die Nutzdaten, wenn ihm der oeffentliche
Schluessel der Gegenstelle vorliegt (`AMT_PUBKEY`). Das PMS entscheidet
darueber NICHT — es weiss nicht, mit wem der Versanddienst spricht, und
soll es nicht wissen.

DER UNKLARE AUSGANG IST DER WICHTIGSTE FALL
============================================
Eine Zeitueberschreitung heisst NICHT, dass nichts ankam. Wer daraufhin
erneut sendet, erzeugt eine Doppelmeldung — und der Vermieter wird
doppelt veranlagt. `angenommen=None` ist deshalb ein eigener Zustand und
wird bis in die Oberflaeche durchgereicht, statt zu `False` verkuerzt zu
werden.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from src.core.config import get_settings
from src.core.logging import get_logger

log = get_logger("nextdays.dac7.uebermittlung")


class UebermittlungError(Exception):
    """Die Uebermittlung war nicht moeglich — vor dem Senden."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True, slots=True)
class Uebermittlungsergebnis:
    """Was aus der Uebergabe an den Versanddienst geworden ist."""

    # `None` heisst UNBEKANNT: Die Antwort kam nicht an, die Datei kann die
    # Behoerde aber erreicht haben. Bewusst dreiwertig — `False` waere die
    # Behauptung, sie sei abgelehnt worden, und das wissen wir nicht.
    angenommen: bool | None
    quittungsnummer: str | None
    meldung: str
    wiederholbar: bool
    pruefsumme: str
    ziel: str
    ist_teststufe: bool
    verschluesselt: bool
    antwort: dict[str, Any]


def ist_eingerichtet() -> bool:
    """Ob aus der Oberflaeche heraus uebermittelt werden kann.

    Ist sie es nicht, bleibt der bisherige Weg: Datei herunterladen und
    bei der Behoerde hochladen. Die Oberflaeche fragt das ab, um keinen
    Knopf anzubieten, der nur fehlschlagen kann.
    """
    e = get_settings()
    return bool(e.dac7_versand_url.strip() and e.dac7_versand_token.strip())


async def uebermitteln(datei: str, dateiname: str) -> Uebermittlungsergebnis:
    """Eine fertige Meldedatei dem Versanddienst uebergeben."""
    e = get_settings()
    if not ist_eingerichtet():
        msg = (
            "Die Übermittlung ist nicht eingerichtet (DAC7_VERSAND_URL, "
            "DAC7_VERSAND_TOKEN). Die Datei lässt sich herunterladen und "
            "bei der Behörde hochladen."
        )
        raise UebermittlungError(msg, status_code=503)

    ziel = e.dac7_versand_url.rstrip("/") + "/v1/einreichen"
    rohdaten = datei.encode("utf-8")
    log.info("dac7_uebermittlung_beginnt", ziel=ziel, bytes=len(rohdaten))

    try:
        async with httpx.AsyncClient(
            timeout=e.dac7_versand_zeitlimit_s
        ) as klient:
            antwort = await klient.post(
                ziel,
                files={"datei": (dateiname, rohdaten, "text/csv")},
                headers={"X-Versand-Token": e.dac7_versand_token},
            )
    except httpx.TimeoutException as exc:
        # KEIN Fehler nach aussen, sondern ein Ergebnis mit unbekanntem
        # Ausgang: Ein 502 wuerde die Oberflaeche zu „nicht gesendet"
        # verleiten, und der naechste Klick erzeugte die Doppelmeldung.
        log.warning("dac7_uebermittlung_zeitlimit", ziel=ziel)
        return Uebermittlungsergebnis(
            angenommen=None,
            quittungsnummer=None,
            meldung=(
                "Der Versanddienst hat nicht innerhalb der Wartezeit "
                "geantwortet. Ob die Meldung bei der Behörde angekommen "
                "ist, steht damit NICHT fest — bitte dort nachsehen, "
                "bevor erneut gesendet wird."
            ),
            wiederholbar=False,
            pruefsumme="",
            ziel=ziel,
            ist_teststufe=True,
            verschluesselt=False,
            antwort={"fehler": exc.__class__.__name__},
        )
    except httpx.HTTPError as exc:
        # Hier ist nichts hinausgegangen — der Aufruf kam nicht zustande.
        msg = f"Der Versanddienst war nicht erreichbar: {exc.__class__.__name__}."
        log.warning("dac7_uebermittlung_unerreichbar", ziel=ziel, fehler=str(exc)[:200])
        raise UebermittlungError(msg) from exc

    if antwort.status_code == 401:
        msg = "Der Versanddienst hat das Token abgelehnt (DAC7_VERSAND_TOKEN)."
        raise UebermittlungError(msg)
    if antwort.status_code >= 400:
        msg = (
            f"Der Versanddienst hat die Datei nicht angenommen "
            f"(HTTP {antwort.status_code})."
        )
        raise UebermittlungError(msg)

    try:
        daten = antwort.json()
    except ValueError as exc:
        msg = "Der Versanddienst hat keine lesbare Antwort geliefert."
        raise UebermittlungError(msg) from exc

    ergebnis = Uebermittlungsergebnis(
        angenommen=daten.get("angenommen"),
        quittungsnummer=daten.get("quittungsnummer"),
        meldung=daten.get("meldung") or "",
        wiederholbar=bool(daten.get("wiederholbar")),
        pruefsumme=daten.get("pruefsumme") or "",
        ziel=daten.get("ziel") or ziel,
        ist_teststufe=bool(daten.get("ist_teststufe", True)),
        verschluesselt=bool(daten.get("verschluesselt")),
        antwort=daten.get("antwort") or {},
    )
    log.info(
        "dac7_uebermittlung_ergebnis",
        angenommen=ergebnis.angenommen,
        quittung=ergebnis.quittungsnummer,
        verschluesselt=ergebnis.verschluesselt,
        teststufe=ergebnis.ist_teststufe,
    )
    return ergebnis
