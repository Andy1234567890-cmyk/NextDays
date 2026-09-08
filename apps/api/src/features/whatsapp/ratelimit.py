"""Metas Ratenbegrenzungen lesen und benennen — die EINE Stelle dafür.

Meta drosselt auf zwei Ebenen, die nichts miteinander zu tun haben und die man
nicht verwechseln darf:

1. **Graph-Ratenbegrenzung** (dieses Modul): wie viele API-Aufrufe unsere App
   machen darf. Für die WhatsApp Business Management API sind das 200 Aufrufe
   pro Stunde je App UND je WABA, bei aktiver WABA mit registrierter Nummer
   5000. Verbraucht wird sie von Vorlagen-Aufrufen, ``phone_numbers`` und
   ``subscribed_apps`` — NICHT vom Nachrichtenversand.
2. **Sendelimit** (``messaging_limit_tier``, hier nur mitgeführt): wie viele
   business-initiierte Konversationen die NUMMER in 24 h beginnen darf. Das ist
   Metas Zustellgrenze, keine API-Grenze; sie meldet sich mit einem eigenen
   Fehler beim Senden, nicht über die Header hier.

Die Nutzungswerte kommen als JSON-String in Antwort-Headern zurück, sobald
genügend Aufrufe an einem Endpunkt angefallen sind — sie fehlen also regulär
und ihr Fehlen ist KEIN Fehler (Wurzel 4: nichts erfinden, wenn nichts da ist).

Beleg: Graph API „Rate Limiting", Abschnitte „Platform Rate Limits",
„Business Use Case Rate Limits" und „WhatsApp Business Management API".
"""
from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass, replace
from typing import Any

# Metas Drosselungs-Fehlercodes. Sie sind das VERLÄSSLICHE Signal — die Header
# sagen nur, wie voll der Eimer ist, der Code sagt, dass er übergelaufen ist.
#
# Graph-/Management-Seite (Vorlagen, phone_numbers, subscribed_apps):
#   4      App-Ratenbegrenzung erreicht (App-Token)
#   17     Nutzer-Ratenbegrenzung erreicht
#   32     Seiten-Ratenbegrenzung (App-/Nutzer-Token)
#   613    selbstdefinierte Ratenbegrenzung / uneinheitliches Anfragevolumen
#   80008  BUC-Limit der WhatsApp Business Management API
#
# SENDEPFAD (Cloud API). Diese fehlten zuerst, und ausgerechnet der häufigste
# Drosselungsfall im Betrieb — 130429 — wäre als gewöhnlicher 502 durchgegangen:
# der Betrieb hätte „Aufruf fehlgeschlagen" gelesen und sofort neu gesendet,
# also genau das getan, was die Sperre verlängert.
#   80007  WABA hat ihre Ratenbegrenzung erreicht
#   130429 Cloud-API-Durchsatz erreicht (Nachrichten/Sekunde)
#   131048 Sende-Beschränkung für DIESE Nummer (Spam-/Qualitätsbremse)
#   131056 zu viele Nachrichten an DIESELBE Empfängernummer (Paarlimit)
#   133016 zu viele Registrierungsversuche für diese Nummer
_DROSSEL_CODES = frozenset(
    {4, 17, 32, 613, 80007, 80008, 130429, 131048, 131056, 133016}
)

# Metas Header. `x-app-usage` trägt die Plattform-Grenze, `x-business-use-case-
# usage` die BUC-Grenze je Geschäftsobjekt. Beide können gleichzeitig kommen;
# bei Überschneidung gilt laut Doku die BUC-Grenze.
_HEADER_APP = "x-app-usage"
_HEADER_BUC = "x-business-use-case-usage"

# Ab wann wir warnen. Metas Werte sind Prozentzahlen des Stundenfensters; wer
# erst bei 100 hinsieht, hat die Sperre schon.
WARNSCHWELLE = 80


@dataclass(frozen=True)
class Nutzung:
    """Ein Ratenbegrenzungs-Stand aus Metas Headern.

    Alle Felder sind optional, weil Meta die Header erst ab genügend Aufrufen
    mitschickt. ``None`` heißt „Meta hat nichts gesagt" — nicht „null Prozent".
    """

    call_count: int | None = None
    total_cputime: int | None = None
    total_time: int | None = None
    # Nur im BUC-Header: geschätzte Sperrdauer in MINUTEN.
    estimated_time_to_regain_access: int | None = None
    typ: str | None = None

    @property
    def hoechstwert(self) -> int | None:
        """Der kritischste der drei Prozentwerte — an ihm hängt die Drosselung.

        Meta drosselt, sobald EINER der drei 100 erreicht, nicht erst ihr
        Mittel. Deshalb zählt das Maximum, nie ein Durchschnitt.
        """
        werte = [
            w
            for w in (self.call_count, self.total_cputime, self.total_time)
            if isinstance(w, int)
        ]
        return max(werte) if werte else None

    @property
    def kritisch(self) -> bool:
        wert = self.hoechstwert
        return wert is not None and wert >= WARNSCHWELLE

    def als_log_felder(self) -> dict[str, Any]:
        """Nur belegte Werte — ein Log voller ``None`` verdeckt die echten."""
        felder = {
            "call_count": self.call_count,
            "total_cputime": self.total_cputime,
            "total_time": self.total_time,
            "sperrdauer_min": self.estimated_time_to_regain_access,
            "buc_typ": self.typ,
        }
        return {k: v for k, v in felder.items() if v is not None}


def _als_int(wert: object) -> int | None:
    """Metas Prozentwerte sind mal int, mal float, mal String — nie raten.

    Ein unbrauchbarer Wert wird zu ``None``, nicht zu 0: „unbekannt" und
    „ausgelastet zu 0 %" sind verschiedene Aussagen (Wurzel 4).
    """
    if isinstance(wert, bool):
        return None
    if isinstance(wert, int):
        return wert
    if isinstance(wert, float):
        return int(wert)
    if isinstance(wert, str):
        try:
            return int(float(wert.strip()))
        except ValueError:
            return None
    return None


def _json_header(headers: Mapping[str, str], name: str) -> object:
    """Einen JSON-Header lesen. Kaputter Inhalt ist kein Grund für einen 500.

    Der Header kommt von außen; ein Parserfehler darf den Aufruf, der gerade
    erfolgreich war, nicht nachträglich kippen (Wurzel 5/8).
    """
    try:
        roh = headers.get(name)
    except AttributeError:
        return None
    if not roh:
        return None
    try:
        return json.loads(roh)
    except (TypeError, ValueError):
        return None


def nutzung_lesen(headers: Mapping[str, str]) -> Nutzung | None:
    """Die schärfste Ratenbegrenzung aus den Antwort-Headern.

    Kommen beide Header, gewinnt der BUC-Header — so schreibt es Metas Doku
    vor („Können für eine Anfrage Plattform- und BUC-Ratenbegrenzungen
    angewendet werden, finden die BUC-Ratenbegrenzungen Anwendung").

    Der BUC-Header trägt je Geschäftsobjekt-ID eine Liste von Einträgen. Wir
    nehmen den kritischsten über alle Objekte, weil jeder einzelne die Sperre
    auslösen kann.
    """
    buc = _json_header(headers, _HEADER_BUC)
    schaerfste: Nutzung | None = None
    # Die längste Sperrdauer wird GETRENNT über alle Einträge gesucht. Der
    # Eintrag mit dem höchsten Prozentwert ist nicht zwingend der, der eine
    # Wartezeit nennt — wer nur einen Eintrag durchreicht, verliert sie und
    # liefert kein `Retry-After`, obwohl Meta eines geliefert hat.
    laengste_sperre: int | None = None
    if isinstance(buc, dict):
        for eintraege in buc.values():
            if not isinstance(eintraege, list):
                continue
            for eintrag in eintraege:
                if not isinstance(eintrag, dict):
                    continue
                sperre = _als_int(eintrag.get("estimated_time_to_regain_access"))
                if sperre is not None and (
                    laengste_sperre is None or sperre > laengste_sperre
                ):
                    laengste_sperre = sperre
                kandidat = Nutzung(
                    call_count=_als_int(eintrag.get("call_count")),
                    total_cputime=_als_int(eintrag.get("total_cputime")),
                    total_time=_als_int(eintrag.get("total_time")),
                    estimated_time_to_regain_access=sperre,
                    typ=eintrag.get("type")
                    if isinstance(eintrag.get("type"), str)
                    else None,
                )
                if _schaerfer(kandidat, schaerfste):
                    schaerfste = kandidat
    if schaerfste is not None:
        return replace(
            schaerfste, estimated_time_to_regain_access=laengste_sperre
        )

    app = _json_header(headers, _HEADER_APP)
    if isinstance(app, dict):
        kandidat = Nutzung(
            call_count=_als_int(app.get("call_count")),
            total_cputime=_als_int(app.get("total_cputime")),
            total_time=_als_int(app.get("total_time")),
        )
        if kandidat.hoechstwert is not None:
            return kandidat
    return None


def _schaerfer(kandidat: Nutzung, bisher: Nutzung | None) -> bool:
    """Ist ``kandidat`` näher an der Sperre als ``bisher``?

    Ein Eintrag ohne jeden Prozentwert zählt nicht — sonst verdrängt ein leerer
    Eintrag einen belegten und die Anzeige wird schlechter statt besser.
    """
    wert = kandidat.hoechstwert
    if wert is None:
        return False
    if bisher is None:
        return True
    alt = bisher.hoechstwert
    return alt is None or wert > alt


def ist_drosselung(fehlercode: object, unterkode: object = None) -> bool:
    """Sagt Metas Fehler „du bist gedrosselt"?

    Ohne diese Unterscheidung sieht eine Drosselung aus wie ein abgelehnter
    Vorlagentext — beides käme sonst als 502 heraus, und der Aufrufer könnte
    nicht entscheiden, ob Warten hilft (Wurzel 5: Kontroll-Signal nicht
    verschlucken).
    """
    code = _als_int(fehlercode)
    if code in _DROSSEL_CODES:
        return True
    # Ads-API v3.3 und älter melden die Drosselung als Code 17 mit diesem
    # Unterkode. Wir rufen sie nicht, aber der Unterkode taucht auch bei
    # anderen Grenzen auf und ist eindeutig genug, um ihn zu erkennen.
    return _als_int(unterkode) == 2446079
