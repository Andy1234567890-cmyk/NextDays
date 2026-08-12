"""Buchungshistorie EINES Objekts direkt bei Airbnb holen — in Etappen.

WARUM DIREKT BEI AIRBNB UND NICHT ÜBER CHANNEX (live gemessen 06.08.2026):

    Channex GET /bookings je Objekt      → total: 0   (6 Objekte geprüft)
    Channex Revisions-Feed               → 0 Revisionen
    unsere Staging-Tabelle channex_booking → 0 Zeilen
    Airbnb  GET v2/reservations          → 462 Buchungen, 04/2022 bis 07/2027

Channex kennt nur, was es selbst als Revision gesehen hat. Alles, was vor dem
Verbinden gebucht wurde, meldet Airbnb dort NICHT nach. Der einzige Weg an die
Historie ist der direkte, den dieses Paket für Stammdaten/Fotos schon nutzt.

DIE DREI EIGENHEITEN DER AIRBNB-API, die den ganzen Aufbau bestimmen — alle
live gemessen, keine aus der Doku übernommen:

1. `start_date` ist KEIN „ab hier alles", sondern reicht ab dem Datum GENAU EIN
   JAHR weit; danach reißt der Cursor ab. Ein einziger Aufruf für 2020–heute
   liefert deshalb nicht die Historie, sondern still nur das erste Jahr.
   Gemessen: `start_date=2022-01-01` → 30 Treffer, letzte Anreise 2022-12-27,
   `next_cursor: null`. Genau daher die ETAPPEN.

2. `_limit` über 50 liefert 200 mit LEERER Liste — kein Fehler, keine Warnung.
   Gemessen: `_limit=100` → 0 Buchungen, `_limit=50` → 50. Wer 100 anfragt,
   glaubt, es gäbe nichts. Deshalb ist 50 fest verdrahtet und nicht wählbar.

3. `_offset` wird ignoriert; geblättert wird über `paging.next_cursor`.
   Gemessen: `_offset=50` liefert dieselbe erste Seite.

WARUM DIE ETAPPEN ÜBERLAPPEN: Schrittweite 3 Monate bei 12 Monaten Reichweite
= jede Buchung liegt in vier Etappen. Das ist der Schutz gegen Lücken an den
Rändern. Gegenprobe gefahren (Nutzer-Auflage „wir dürfen keine vergessen"):

    Quartals-Etappen (Schritt 3M):  462 Buchungen, 36 Etappen,  63 HTTP-Aufrufe
    Monats-Etappen   (Schritt 1M):  462 Buchungen, 108 Etappen, 187 HTTP-Aufrufe
    zusätzlich durch die feinere Teilung gefunden: 0

Die feinere Teilung findet KEINE einzige Buchung mehr. Quartalsschritte sind
damit nachweislich lückenlos und kosten ein Drittel der Aufrufe.

DEDUP über `confirmation_code`: durch die Überlappung kommt dieselbe Buchung
mehrfach; gespeichert wird sie einmal (Wurzel 2 — real kommt alles doppelt).

NUR DIESES EINE OBJEKT: gefiltert wird auf `properties.airbnb_listing_id`.
Buchungen fremder Inserate werden gezählt, aber nicht angefasst — über alle
Objekte des Beta-Kontos liegen 462 Buchungen, davon 322 auf 23 Inseraten, die
es bei uns gar nicht als Objekt gibt. Ein Objekt-Import darf die nicht anfassen.

NUR LESEND: ausschließlich GET gegen api.airbnb.com. Das Konto des Betriebs ist
Produktion (CLAUDE.md „Schreibtests am Live-Konto") — ein Import darf dort
nichts verändern.
"""
from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Final

import httpx

from .common import ChannelManagerError, log

AIRBNB_API: Final = "https://api.airbnb.com"

# Airbnbs echte Seitengröße. NICHT erhöhen: ab 51 antwortet die API mit 200 und
# einer leeren Liste (live gemessen) — ein „schnellerer" Import holt dann nichts.
SEITEN_GROESSE: Final = 50

# Reichweite einer Etappe ab ihrem `start_date` (live gemessen, siehe Docstring).
ETAPPEN_REICHWEITE_MONATE: Final = 12
# Schrittweite von Etappe zu Etappe. Kleiner als die Reichweite ⇒ Überlappung.
ETAPPEN_SCHRITT_MONATE: Final = 3

# Obergrenzen (Wurzel 8: kein unbegrenzter Bereich). Ein Zeitraum ist eine
# Nutzereingabe — ohne Deckel wären „01.01.1900 bis 2999" hunderttausend Aufrufe.
MAX_ETAPPEN: Final = 120  # ≈ 30 Jahre bei Quartalsschritten
MAX_SEITEN_JE_ETAPPE: Final = 60  # 3000 Buchungen in EINER Etappe
MAX_JAHRE: Final = 30

_TIMEOUT: Final = httpx.Timeout(60.0)

# Versuche je Seite. Zwei, nicht fünf: der Abbruch war live sporadisch (1–2 von 24
# Etappen) und beim zweiten Versuch weg. Mehr Versuche würden im echten Störfall
# nur die Wartezeit vervielfachen, statt die Lücke zu schliessen.
_VERSUCHE_JE_SEITE: Final = 2
# Kurze Pause, damit ein abgerissener Keep-alive nicht sofort wieder aufschlägt.
_PAUSE_VOR_WIEDERHOLUNG: Final = 1.0


@dataclass
class EtappenErgebnis:
    """Was EINE Etappe erbracht hat — die Zeile, die im Fortschritt erscheint."""

    nummer: int
    von: str
    bis: str
    seiten: int = 0
    gefunden: int = 0  # Buchungen dieses Objekts in dieser Etappe
    neu: int = 0  # davon in diesem Lauf zum ersten Mal gesehen
    fehler: str | None = None


@dataclass
class HistorieErgebnis:
    """Das Gesamtergebnis eines Etappen-Laufs.

    `vollstaendig` ist bewusst KEIN „hat geklappt": es ist false, sobald auch nur
    eine Etappe gescheitert ist. Ein Import, der 26 von 27 Etappen schafft, darf
    sich nicht „fertig" nennen — genau dann fehlen Buchungen, ohne dass es jemand
    merkt (Wurzel 5, und die ausdrückliche Auflage „wir dürfen keine vergessen").
    """

    listing_id: str
    von: str
    bis: str
    etappen: list[EtappenErgebnis] = field(default_factory=list)
    buchungen: list[dict[str, Any]] = field(default_factory=list)
    fremde: int = 0  # Buchungen anderer Inserate, bewusst nicht angefasst

    @property
    def vollstaendig(self) -> bool:
        return all(e.fehler is None for e in self.etappen)

    @property
    def fehlgeschlagene(self) -> list[EtappenErgebnis]:
        return [e for e in self.etappen if e.fehler]


def _monate_dazu(tag: date, monate: int) -> date:
    """Datum um n Monate verschieben, auf den Monatsersten normiert.

    Bewusst ohne dateutil (keine neue Abhängigkeit für eine Zeile Arithmetik).
    Der Tag im Monat ist egal, weil Etappen immer am Monatsersten beginnen.
    """
    index = (tag.year * 12 + tag.month - 1) + monate
    return date(index // 12, index % 12 + 1, 1)


def etappen_planen(von: date, bis: date) -> list[tuple[date, date]]:
    """Den Zeitraum in überlappende Etappen zerlegen.

    Jede Etappe deckt ab ihrem Start 12 Monate ab, gestartet wird alle 3 Monate
    — jede Buchung liegt damit in vier Etappen. Die Überlappung ist der Schutz
    gegen Randlücken; die Gegenprobe mit Monatsschritten fand nichts zusätzlich.
    """
    if bis < von:
        raise ChannelManagerError(
            "Das Enddatum liegt vor dem Startdatum.", status_code=422
        )
        # (422 statt Tausch: eine vertauschte Eingabe ist ein Irrtum des
        #  Bedieners, den wir zeigen, statt ihn stillschweigend umzudeuten.)
    if bis.year - von.year > MAX_JAHRE:
        raise ChannelManagerError(
            f"Der Zeitraum darf höchstens {MAX_JAHRE} Jahre umfassen.",
            status_code=422,
        )

    plan: list[tuple[date, date]] = []
    start = date(von.year, von.month, 1)
    while start <= bis and len(plan) < MAX_ETAPPEN:
        plan.append((start, _monate_dazu(start, ETAPPEN_REICHWEITE_MONATE)))
        start = _monate_dazu(start, ETAPPEN_SCHRITT_MONATE)
    if not plan:
        # Kann nur passieren, wenn `bis` vor dem Monatsersten von `von` liegt
        # (z. B. 15.03. bis 20.03.) — dann ist die eine Etappe trotzdem richtig.
        plan.append((start, _monate_dazu(start, ETAPPEN_REICHWEITE_MONATE)))
    return plan


class AirbnbHistorieMixin:
    """Buchungen + Nachrichten eines Objekts direkt bei Airbnb lesen."""

    @staticmethod
    def _reservierungen_seite(
        token: str, start_date: str, cursor: str | None
    ) -> tuple[list[dict[str, Any]], str | None]:
        """EINE Seite Reservierungen. Wirft bei Netz-/HTTP-Fehler.

        Kein `return None` bei Fehlern wie im lesenden Stammdaten-Pfad: hier
        würde ein verschluckter Fehler als „keine Buchungen in dieser Etappe"
        durchgehen und eine Lücke erzeugen, die niemand sieht (Wurzel 5).

        EIN WIEDERHOLUNGSVERSUCH BEI VERBINDUNGSABBRUCH (12.08.2026, live
        gemessen): Airbnb legt beim Bestandsabruf sporadisch mitten in der Antwort
        auf — `Server disconnected without sending a response` bzw.
        `[SSL: UNEXPECTED_EOF_WHILE_READING]`. Pro Nachpflege-Lauf traf das 1–2
        der 24 Etappen. Die Etappe brach dann KOMPLETT ab (die Schleife oben fängt
        sie und macht mit der nächsten weiter), und ihre Buchungen fehlten:
        `vollstaendig=False`, 431 statt 462 Buchungen. Genau die Zeilen, die in
        einer verlorenen Etappe lagen, konnte die Nachpflege dann nicht heilen und
        suchte sie beim nächsten Tick erneut — der Fehler hielt sich selbst am
        Leben.

        Wiederholt werden die drei live beobachteten Abbruch-Formen — sie sind
        dasselbe Ereignis in drei Verkleidungen, je nachdem, wo die Verbindung
        gerissen ist:

            RemoteProtocolError   „Server disconnected without sending a response"
            ReadError             „[SSL: UNEXPECTED_EOF_WHILE_READING]"
            ConnectTimeout        „_ssl.c:993: The handshake operation timed out"

        Der Handshake-Timeout gehörte zunächst NICHT dazu, mit der Begründung
        „wenn Airbnb nicht erreichbar ist, hilft kein zweiter Versuch". Die
        Messung widerlegte das: er trifft eine einzelne Etappe, während die 23
        anderen im selben Lauf normal antworten — die Gegenstelle ist also
        erreichbar, nur dieser Handshake ist gescheitert.

        NICHT wiederholt wird eine Fehlerantwort: ein 401 oder 429 wird durch
        Wiederholen nicht besser, sondern verdoppelt nur die Last (ein 429 zu
        wiederholen ist der Weg in die Sperre). Ebenso bleibt `ConnectError`
        draussen — kein Verbindungsaufbau möglich heisst, dass auch der zweite
        Versuch keinen findet.
        """
        params: dict[str, str] = {
            "_limit": str(SEITEN_GROESSE),
            "start_date": start_date,
        }
        if cursor:
            params["_cursor"] = cursor
        kopf = {"X-Airbnb-OAuth-Token": token, "Accept": "application/json"}
        for versuch in range(1, _VERSUCHE_JE_SEITE + 1):
            try:
                with httpx.Client(timeout=_TIMEOUT) as client:
                    antwort = client.get(
                        f"{AIRBNB_API}/v2/reservations", headers=kopf, params=params
                    )
                break
            except (
                httpx.RemoteProtocolError,
                httpx.ReadError,
                httpx.ConnectTimeout,
            ) as exc:
                if versuch == _VERSUCHE_JE_SEITE:
                    raise
                log.warning(
                    "airbnb_seite_abgebrochen_wiederholung",
                    start_date=start_date, versuch=versuch, error=str(exc)[:120],
                )
                time.sleep(_PAUSE_VOR_WIEDERHOLUNG)
        if antwort.status_code != 200:
            raise ChannelManagerError(
                f"Airbnb antwortete {antwort.status_code} beim Lesen der "
                f"Buchungen ab {start_date}.",
                status_code=502,
            )
        daten = antwort.json()
        reservierungen = daten.get("reservations") or []
        weiter = (daten.get("paging") or {}).get("next_cursor")
        return reservierungen, (str(weiter) if weiter else None)

    def airbnb_historie_lesen(
        self,
        token: str,
        listing_id: str,
        *,
        von: date,
        bis: date,
        melden: Callable[[EtappenErgebnis], None] | None = None,
        alle_listings: bool = False,
    ) -> HistorieErgebnis:
        """Alle Buchungen EINES Inserats im Zeitraum, etappenweise.

        `melden` wird nach jeder Etappe mit dem `EtappenErgebnis` gerufen — so
        sieht der Betrieb den Fortschritt live, statt vor einem hängenden Knopf
        zu sitzen (ein 6½-Jahres-Zeitraum sind 27 Etappen mit ~60 Aufrufen).

        Eine gescheiterte Etappe bricht den Lauf NICHT ab: die übrigen laufen
        weiter, und `vollstaendig` bleibt false, damit die Lücke benannt wird
        statt als Erfolg durchzugehen.

        `alle_listings=True` hebt den Objekt-Filter auf — gebraucht von der
        Zeitpunkt-Heilung, die einem Konto EINEN Abruf schuldet statt einem je
        Objekt. Für den Objekt-Import bleibt es aus: dort wäre es genau der
        Fehler, fremde Buchungen ans falsche Haus zu schreiben.
        """
        ergebnis = HistorieErgebnis(
            listing_id=str(listing_id), von=von.isoformat(), bis=bis.isoformat()
        )
        gesehen: set[str] = set()
        fremde: set[str] = set()

        for nummer, (start, ende) in enumerate(etappen_planen(von, bis), start=1):
            etappe = EtappenErgebnis(
                nummer=nummer, von=start.isoformat(), bis=ende.isoformat()
            )
            cursor: str | None = None
            try:
                while etappe.seiten < MAX_SEITEN_JE_ETAPPE:
                    seite, cursor = self._reservierungen_seite(
                        token, start.isoformat(), cursor
                    )
                    etappe.seiten += 1
                    for res in seite:
                        code = str(res.get("confirmation_code") or "")
                        if not code:
                            continue
                        if not alle_listings and str(
                            res.get("listing_id") or ""
                        ) != str(listing_id):
                            fremde.add(code)
                            continue
                        etappe.gefunden += 1
                        if code not in gesehen:
                            gesehen.add(code)
                            etappe.neu += 1
                            ergebnis.buchungen.append(res)
                    if not seite or not cursor:
                        break
                else:
                    # Seiten-Deckel erreicht: NICHT still abschneiden (Wurzel 8
                    # verlangt eine Grenze, Wurzel 5 verlangt, sie zu benennen).
                    etappe.fehler = (
                        f"Mehr als {MAX_SEITEN_JE_ETAPPE} Seiten in einer Etappe — "
                        "bitte einen kleineren Zeitraum wählen."
                    )
            except (ChannelManagerError, httpx.HTTPError) as exc:
                etappe.fehler = getattr(exc, "message", None) or str(exc)[:200]
                log.warning(
                    "airbnb_historie_etappe_fehlgeschlagen",
                    listing_id=listing_id, etappe=nummer,
                    von=etappe.von, error=etappe.fehler,
                )

            ergebnis.etappen.append(etappe)
            if melden is not None:
                melden(etappe)

        ergebnis.fremde = len(fremde)
        log.info(
            "airbnb_historie_gelesen",
            listing_id=listing_id, von=ergebnis.von, bis=ergebnis.bis,
            etappen=len(ergebnis.etappen), buchungen=len(ergebnis.buchungen),
            fremde=ergebnis.fremde, vollstaendig=ergebnis.vollstaendig,
        )
        return ergebnis

    @staticmethod
    def airbnb_nachrichten_lesen(
        token: str, thread_id: str, *, grenze: int = 200
    ) -> list[dict[str, Any]]:
        """Den Nachrichtenverlauf einer Buchung lesen.

        Der Weg dahin ist NICHT der naheliegende: `v2/messages` gibt es nicht
        (404 „Route not found"), und der Thread selbst liefert seine Nachrichten
        auch mit `_format=for_api_partners_with_posts` NICHT mit (live geprüft,
        alle drei Formate → 0 Nachrichten). Nur die Unterressource gibt sie her:

            GET v2/threads/{id}/messages   → 14 Nachrichten (live gemessen)

        Fehler werden hier geschluckt und als leere Liste gemeldet: der
        Nachrichtenverlauf ist eine Beigabe zur Buchung, und eine unlesbare
        Konversation darf den Buchungsimport nicht kippen (best effort).
        """
        try:
            with httpx.Client(timeout=_TIMEOUT) as client:
                antwort = client.get(
                    f"{AIRBNB_API}/v2/threads/{thread_id}/messages",
                    headers={
                        "X-Airbnb-OAuth-Token": token,
                        "Accept": "application/json",
                    },
                    params={"_limit": str(min(grenze, SEITEN_GROESSE))},
                )
            if antwort.status_code != 200:
                log.info(
                    "airbnb_nachrichten_kein_200",
                    thread_id=thread_id, status=antwort.status_code,
                )
                return []
            return list((antwort.json().get("messages") or [])[:grenze])
        except (httpx.HTTPError, ValueError) as exc:  # noqa: BLE001 — Beigabe
            log.warning(
                "airbnb_nachrichten_unlesbar",
                thread_id=thread_id, error=str(exc)[:200],
            )
            return []
