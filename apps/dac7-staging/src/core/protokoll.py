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
    # SHA-256 der eingereichten Bytes. Damit laesst sich belegen, dass
    # genau DIESE Datei ankam, und sie erkennt eine zweite Einreichung
    # desselben Inhalts wieder.
    pruefsumme: str
    angenommen: bool
    zeilen: int
    zeilentypen: dict[str, int]
    fehler: list[Befund] = field(default_factory=list)
    hinweise: list[Befund] = field(default_factory=list)
    # Die uebermittelten Saetze. Sie sind der Grund, warum es diese Stelle
    # gibt: Der Betrieb muss SEHEN koennen, was in seiner Meldung steht,
    # bevor sie zur Behoerde geht. Pruefsumme und Zeilenzahl allein
    # beantworten die Frage "was wurde uebermittelt" nicht.
    #
    # Sie verfallen mit dem Eintrag (Aufbewahrungsfrist) und liegen nur im
    # Arbeitsspeicher — ein Neustart loescht sie.
    saetze: list[dict[str, str]] = field(default_factory=list)
    # Die eingereichte Datei im Original. Ohne sie laesst sich nicht
    # zeigen, was uebermittelt wurde — und das ist der Zweck der Stelle.
    #
    # Sie liegt NUR im Arbeitsspeicher, verfaellt mit dem Eintrag und wird
    # nie auf Platte geschrieben. Ein Neustart loescht sie, `DELETE
    # /v1/quittungen` ebenso.
    rohtext: str = ""
    # Wie lange die Stelle fuer diese Einreichung gebraucht hat, in
    # Millisekunden. Gemessen vom Eintreffen der Bytes bis zur Quittung.
    #
    # Die Zahl beantwortet die Frage, ob der Weg zur Behoerde traegt: Eine
    # Meldung wird einmal im Jahr eingereicht, und wenn sie dann in ein
    # Zeitlimit laeuft, steht der Betrieb ohne Quittung da und weiss
    # nicht, ob sie angekommen ist.
    dauer_ms: float = 0.0


@dataclass(frozen=True, slots=True)
class Kennzahlen:
    """Wie die Uebermittlung laeuft — gerechnet, nicht behauptet.

    Eine DAC7-Meldung wird einmal im Jahr eingereicht. Genau dann muss der
    Weg tragen: Laeuft die Einreichung in ein Zeitlimit, steht der Betrieb
    ohne Quittung da und weiss nicht, ob die Meldung angekommen ist.
    Deshalb wird die Laufzeit jeder Einreichung gemessen und hier
    zusammengefasst, statt sich auf "laeuft" zu verlassen.

    Der Mittelwert allein taugt dafuer nicht: Er verschweigt den einen
    langsamen Fall zwischen neunundneunzig schnellen. Ausgewiesen wird
    deshalb auch das langsamste Fuenftel (p80) und der schlechteste Wert.
    """

    gesamt: int
    angenommen: int
    abgewiesen: int
    bytes_gesamt: int
    dauer_schnellste_ms: float
    dauer_mittel_ms: float
    dauer_p80_ms: float
    dauer_langsamste_ms: float
    erste: datetime | None
    letzte: datetime | None

    @property
    def annahmequote(self) -> float:
        """Anteil angenommener Einreichungen in Prozent."""
        return 100.0 * self.angenommen / self.gesamt if self.gesamt else 0.0


def kennzahlen(eintraege: list[Eintrag]) -> Kennzahlen:
    """Die Kennzahlen ueber die aufbewahrten Einreichungen.

    Die Grundgesamtheit ist bewusst das Protokoll und nicht ein eigener
    Zaehler: Was nach der Aufbewahrungsfrist verfaellt, faellt auch aus
    der Statistik. Eine Quote ueber Eintraege, die es nicht mehr gibt,
    liesse sich nicht nachpruefen.
    """
    if not eintraege:
        return Kennzahlen(0, 0, 0, 0, 0.0, 0.0, 0.0, 0.0, None, None)
    dauern = sorted(e.dauer_ms for e in eintraege)
    angenommen = sum(1 for e in eintraege if e.angenommen)
    zeiten = [e.empfangen_am for e in eintraege]
    # p80 ueber den Index, nicht interpoliert: bei wenigen Werten ist jede
    # Interpolation eine Erfindung.
    p80 = dauern[min(len(dauern) - 1, int(len(dauern) * 0.8))]
    return Kennzahlen(
        gesamt=len(eintraege),
        angenommen=angenommen,
        abgewiesen=len(eintraege) - angenommen,
        bytes_gesamt=sum(e.bytes_gesamt for e in eintraege),
        dauer_schnellste_ms=dauern[0],
        dauer_mittel_ms=sum(dauern) / len(dauern),
        dauer_p80_ms=p80,
        dauer_langsamste_ms=dauern[-1],
        erste=min(zeiten),
        letzte=max(zeiten),
    )


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

    def bereits_angenommen(self, summe: str) -> Eintrag | None:
        """Der angenommene Eintrag mit dieser Pruefsumme, falls es ihn gibt.

        Die Behoerde nimmt dieselbe Meldung kein zweites Mal an: "Indtaegten
        skal kun indberettes een gang og ikke dobbelt" (DAC7-Anleitung
        feriehusudlejerne.dk, S. 5). Ein Wiederholungsversuch nach einem
        Zeitlimit oder ein Doppelklick darf keine zweite Meldung erzeugen
        (Wurzel 2).

        Nur ANGENOMMENE Einreichungen sperren. Eine zurueckgewiesene Datei
        soll nach der Korrektur wieder eingereicht werden koennen — und wer
        unveraendert erneut sendet, bekommt dieselbe Zurueckweisung, nicht
        den Dublettenhinweis.
        """
        with self._sperre:
            self._aufraeumen()
            treffer = [
                e
                for e in self._eintraege.values()
                if e.pruefsumme == summe and e.angenommen
            ]
        return min(treffer, key=lambda e: e.empfangen_am) if treffer else None

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
