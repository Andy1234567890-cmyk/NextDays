"""Das Empfangsprotokoll der Teststufe — Kvittering wie bei der Behoerde.

Jede Einreichung bekommt eine Quittungsnummer, einen Zeitstempel und eine
Pruefsumme. Ohne das laesst sich hinterher nicht sagen, WAS wann ankam —
und genau diese Frage stellt sich, wenn eine Meldung strittig wird.

WARUM IM SPEICHER UND NICHT IN EINER DATENBANK
===============================================
Eingereichte DAC7-Dateien enthalten CPR-Nummern, Namen, Anschriften und
Bankverbindungen. Auch in einer Teststufe sind das echte Personendaten,
sobald jemand eine echte Meldung hochlaedt. Sie in eine Datenbank zu
schreiben hiesse, sie zu sichern, zu replizieren und irgendwann zu
vergessen.

Der Speicher haelt sie deshalb nur so lange, wie der Test dauert
(`aufbewahrung_stunden`, Vorgabe 24 h), und ein Neustart des Dienstes
loescht alles. Das ist keine Schwaeche, sondern die Absicht: Eine
Teststufe, deren Inhalt einen Neustart ueberlebt, ist ein Datenlager.

Der ROHINHALT wird bewusst NICHT aufbewahrt — nur die Pruefsumme, die
Kennzahlen und die Befunde. Wer die Datei erneut braucht, reicht sie
erneut ein.
"""
from __future__ import annotations

import hashlib
import secrets
import threading
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from .pruefung_csv import Befund


@dataclass(frozen=True, slots=True)
class Eintrag:
    """Eine Einreichung, so wie die Behoerde sie protokollieren wuerde."""

    quittungsnummer: str
    empfangen_am: datetime
    format: str
    dateiname: str
    bytes_gesamt: int
    # SHA-256 der eingereichten Bytes. Damit laesst sich spaeter belegen,
    # dass genau DIESE Datei ankam — der Rohinhalt muss dafuer nicht liegen
    # bleiben.
    pruefsumme: str
    angenommen: bool
    zeilen: int
    zeilentypen: dict[str, int]
    fehler: list[Befund] = field(default_factory=list)
    hinweise: list[Befund] = field(default_factory=list)


class Protokoll:
    """Der Speicher der Empfangsstelle.

    Threadsicher, weil uvicorn mehrere Anfragen nebenlaeufig bedient: Zwei
    gleichzeitige Einreichungen duerfen sich nicht gegenseitig ueberschreiben
    (Wurzel 2 — real kommt alles doppelt).
    """

    def __init__(self, aufbewahrung_stunden: int = 24) -> None:
        self._eintraege: dict[str, Eintrag] = {}
        self._sperre = threading.Lock()
        self._aufbewahrung = timedelta(hours=aufbewahrung_stunden)

    def ablegen(self, **felder: object) -> Eintrag:
        eintrag = Eintrag(
            quittungsnummer=_quittungsnummer(),
            empfangen_am=datetime.now(UTC),
            **felder,  # type: ignore[arg-type]
        )
        with self._sperre:
            self._aufraeumen()
            self._eintraege[eintrag.quittungsnummer] = eintrag
        return eintrag

    def holen(self, nummer: str) -> Eintrag | None:
        with self._sperre:
            self._aufraeumen()
            return self._eintraege.get(nummer)

    def liste(self, grenze: int = 50) -> list[Eintrag]:
        with self._sperre:
            self._aufraeumen()
            alle = sorted(
                self._eintraege.values(),
                key=lambda e: e.empfangen_am,
                reverse=True,
            )
        return alle[:grenze]

    def leeren(self) -> int:
        """Alles verwerfen. Fuer den Fall, dass echte Daten hochgeladen wurden."""
        with self._sperre:
            anzahl = len(self._eintraege)
            self._eintraege.clear()
        return anzahl

    def _aufraeumen(self) -> None:
        """Abgelaufene Eintraege verwerfen. Aufrufer haelt die Sperre."""
        grenze = datetime.now(UTC) - self._aufbewahrung
        alt = [k for k, v in self._eintraege.items() if v.empfangen_am < grenze]
        for k in alt:
            del self._eintraege[k]


def pruefsumme(rohdaten: bytes) -> str:
    return hashlib.sha256(rohdaten).hexdigest()


def _quittungsnummer() -> str:
    """Eine Quittungsnummer im Format der Behoerde: DK-JJJJMMTT-XXXXXX.

    Der Zufallsteil ist kryptographisch erzeugt, damit sich Nummern nicht
    erraten lassen — sonst koennte jemand fremde Quittungen abrufen.
    """
    tag = datetime.now(UTC).strftime("%Y%m%d")
    return f"DK-{tag}-{secrets.token_hex(3).upper()}"
