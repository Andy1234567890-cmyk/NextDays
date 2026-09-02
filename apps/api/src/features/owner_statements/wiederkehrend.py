"""Wiederkehrende Posten in Beträge übersetzen — die EINE Quelle dafür.

Ein wiederkehrender Posten (``owner_recurring_items``, 0365) ist eine
Dauervereinbarung zwischen Betrieb und Eigentümer: „Kaffee & Co, 50 DKK je
Buchung" oder „Nebenkosten-Pauschale, 200 DKK je Buchung". Er hängt NICHT an
einer einzelnen Buchung, sondern an ihrer ANZAHL — und genau deshalb braucht
er eine eigene Rechnung.

WARUM DIESES MODUL EXISTIERT: Seit 0365 rechnete diese Regel ausschließlich im
Slice ``owner_reporting`` (``_recurring_betraege``). Die ABRECHNUNG
(``owner_statements``) kannte die Tabelle gar nicht — der Betrieb musste die
50 DKK je Buchung von Hand als Verrechnungsposten anlegen. Live nachgewiesen
am 20.08.2026: zwei Posten „Indflytning-gebyr" à 50 DKK auf Feriehus „Perlen",
weil die Betreiberin ihre vertraglich hinterlegte Pauschale in der Abrechnung
nicht fand.

Die Regel hier zweimal zu schreiben wäre derselbe Fehler wie zwei
Provisionsformeln: Bericht und Abrechnung zeigten für denselben Posten zwei
Zahlen, und beide sähen plausibel aus. Darum liegt sie EINMAL hier, DB-frei
wie ``common.py``, und beide Slices rufen sie.

Bewusst OHNE Pydantic und ohne DB-Zugriff: die Aufrufer laden ihre Zeilen
selbst (mit ihrem eigenen Scope) und formen ihr eigenes Antwortmodell.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any


class WiederkehrendFehler(Exception):
    """Ein wiederkehrender Posten lässt sich nicht verrechnen.

    Heute genau ein Grund: die Währung des Postens passt nicht zu der, in der
    abgerechnet wird. ``label`` trägt den Namen des Postens, weil die Meldung
    sonst nicht sagt, WELCHEN der Betrieb korrigieren muss.
    """

    def __init__(self, grund: str, message: str, *, label: str) -> None:
        super().__init__(message)
        self.grund = grund
        self.message = message
        self.label = label


@dataclass(frozen=True, slots=True)
class Bezugsmenge:
    """Wie viele Buchungen und Nächte ein Posten trifft.

    Getrennt je Objekt, weil ein Posten ``property_id`` tragen kann und dann
    nur für dieses eine Objekt gilt. ``gesamt`` ist die Summe über alle
    Objekte des Zeitraums — die Bezugsmenge eines Postens OHNE ``property_id``.
    """

    je_objekt: dict[str, tuple[int, int]]
    gesamt: tuple[int, int]


def bezugsmenge(
    buchungen: list[tuple[str, int]],
) -> Bezugsmenge:
    """Buchungen ``(property_id, naechte)`` zu Bezugsmengen verdichten.

    Der Aufrufer übergibt seine Buchungen als Paare; welche Buchungen zum
    Zeitraum gehören, hat er bereits entschieden (Abrechnung: ``basis``
    check_in/check_out; Bericht: seine eigene Auswertung). Dieses Modul zählt
    nur noch.
    """
    je_objekt: dict[str, tuple[int, int]] = {}
    n_buchungen = 0
    n_naechte = 0
    for property_id, naechte in buchungen:
        anzahl, summe = je_objekt.get(property_id, (0, 0))
        je_objekt[property_id] = (anzahl + 1, summe + naechte)
        n_buchungen += 1
        n_naechte += naechte
    return Bezugsmenge(je_objekt=je_objekt, gesamt=(n_buchungen, n_naechte))


def posten_betraege(
    items: list[dict[str, Any]],
    mengen: Bezugsmenge,
    currency: str,
) -> list[tuple[dict[str, Any], int, Decimal]]:
    """Wiederkehrende Posten in konkrete Beträge übersetzen.

    Rückgabe je Posten ``(zeile, anzahl, betrag)`` — ``anzahl`` ist die
    Bezugsmenge (Buchungen, Nächte oder 1) und gehört ausdrücklich zum
    Ergebnis: „50,00 DKK" allein ist auf einer Abrechnung nicht prüfbar,
    „3 × 50,00 DKK" ist es.

    ``je_buchung``/``je_nacht`` zählen nur die Buchungen der Objekte, für die
    der Posten gilt; ``je_zeitraum`` fällt einmal an — auch bei leerem
    Zeitraum, denn eine Dauervereinbarung hängt nicht an einer Buchung.

    Die Währung wird NICHT umgerechnet, sondern muss zur Abrechnungswährung
    passen: 50 DKK sind 50 DKK, und ein stiller Kurs 1,0 wäre plausibel
    aussehender Unsinn (dieselbe Regel wie bei der Pauschale im Vertrag,
    ``common._pruefe_waehrung``). Ein Kurs hätte hier auch keinen Stichtag —
    ein wiederkehrender Posten hat kein Datum.

    Der BETRAG ist unsigniert (die DB erzwingt ``betrag > 0``); das Vorzeichen
    entsteht aus ``abschnitt`` und ist Sache des Aufrufers — ``ausgaben``
    mindert, alles andere erhöht. Zwei Achsen für dieselbe Aussage wären
    derselbe Fehler wie ein Minuszeichen in ``owner_expenses.amount`` (0344).
    """
    out: list[tuple[dict[str, Any], int, Decimal]] = []
    for zeile in items:
        label = str(zeile.get("label") or "")
        posten_currency = str(zeile.get("currency") or "").upper()
        if posten_currency != currency.upper():
            raise WiederkehrendFehler(
                "waehrung_posten",
                f"Der wiederkehrende Posten „{label}“ lautet auf "
                f"{posten_currency or '—'}, die Abrechnung auf "
                f"{currency or '—'}. Beträge verschiedener Währungen werden "
                "nicht verrechnet.",
                label=label,
            )
        betrag = Decimal(str(zeile.get("betrag") or 0))
        pid = zeile.get("property_id")
        pid_str = str(pid) if pid else None
        n_buchungen, n_naechte = (
            mengen.je_objekt.get(pid_str, (0, 0))
            if pid_str is not None
            else mengen.gesamt
        )
        modus = str(zeile.get("modus") or "")
        if modus == "je_buchung":
            anzahl = n_buchungen
        elif modus == "je_nacht":
            anzahl = n_naechte
        else:
            # `je_zeitraum` fällt einmal an, unabhängig von Buchungen.
            anzahl = 1
        wert = betrag * anzahl
        if wert != 0:
            out.append((zeile, anzahl, wert))
    return out


def ist_abzug(abschnitt: str) -> bool:
    """Mindert dieser Abschnitt die Auszahlung?

    Nur ``ausgaben`` ist ein Abzug — so sagt es der DB-CHECK von 0365
    (``summe_ausgaben <= 0``). Die Ableitung steht hier statt an den
    Anzeigestellen, damit Bericht, Abrechnung und Beleg dasselbe Vorzeichen
    bilden.
    """
    return abschnitt == "ausgaben"
