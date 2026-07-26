"""Beteiligung von Co-Gastgebern an einer Buchung.

DIE ZENTRALE REGEL — sie ist der ganze Punkt dieses Moduls:

    Die Plattform-Gebühr ist FEST und unantastbar. Die Beteiligung des
    Co-Gastgebers kommt OBENDRAUF und geht zulasten des Gastgebers.

    brutto = plattform_fee + summe(cohost_anteile) + gastgeber_rest

Der Gastgeber legt Art und Höhe je Co-Gastgeber fest. Was er nicht kann: die
Plattform-Gebühr drücken (die kommt aus tenants.platform_fee_bps, nie aus
Client-Input) oder mehr verteilen, als nach Abzug der Gebühr übrig ist.

Alle Beträge in CENT und Ganzzahl-Arithmetik. Kein Float: Bei Geld führt
Fließkomma zu Rundungsdifferenzen, die sich über viele Buchungen summieren
(Wurzel 4 — kein plausibler Ersatzwert, sondern exakte Zahlen).
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Beteiligung:
    """Was ein einzelner Co-Gastgeber an EINER Buchung bekommt."""

    user_id: str
    cohost_id: str
    share_kind: str
    share_bps: int | None
    betrag_cents: int


@dataclass(frozen=True)
class Aufteilung:
    """Die vollständige Aufteilung einer Buchung."""

    brutto_cents: int
    plattform_cents: int
    cohosts: list[Beteiligung]
    gastgeber_cents: int

    @property
    def cohosts_gesamt_cents(self) -> int:
        return sum(b.betrag_cents for b in self.cohosts)


class BeteiligungFehler(Exception):
    """Die Aufteilung geht nicht auf — z. B. mehr verteilt als vorhanden."""

    def __init__(self, message: str, status_code: int = 422) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _anteil_cents(vereinbarung: dict, brutto_cents: int, currency: str) -> int:
    """Beteiligung EINES Co-Gastgebers berechnen.

    Fail-closed: Eine unstimmige Vereinbarung ergibt einen Fehler, nie
    stillschweigend 0 — sonst würde jemand ohne Hinweis leer ausgehen.
    """
    art = vereinbarung.get("share_kind")
    if art in (None, "none"):
        return 0

    if art == "percent":
        bps = vereinbarung.get("share_bps")
        if not bps or bps <= 0:
            raise BeteiligungFehler(
                "Prozentuale Beteiligung ohne gültigen Satz.", status_code=500
            )
        # Ganzzahl-Division schneidet ab — zugunsten des Gastgebers, der die
        # Beteiligung trägt. Bewusst kein Runden: aufgerundet könnte die Summe
        # mehrerer Anteile den verfügbaren Rest übersteigen.
        return brutto_cents * int(bps) // 10000

    if art == "fixed":
        betrag = vereinbarung.get("share_fixed_cents")
        if not betrag or betrag <= 0:
            raise BeteiligungFehler(
                "Fixe Beteiligung ohne gültigen Betrag.", status_code=500
            )
        # Ein Fixbetrag in fremder Währung lässt sich nicht ohne Kurs umrechnen.
        # Umrechnen wäre geraten (Wurzel 4) → klar fehlschlagen.
        vereinbart = vereinbarung.get("share_currency")
        if vereinbart and vereinbart.upper() != currency.upper():
            raise BeteiligungFehler(
                f"Beteiligung ist in {vereinbart} vereinbart, die Buchung "
                f"läuft in {currency}. Bitte die Vereinbarung anpassen.",
                status_code=422,
            )
        return int(betrag)

    raise BeteiligungFehler(
        f"Unbekannte Beteiligungsart: {art}", status_code=500
    )


def berechne_aufteilung(
    *,
    brutto_cents: int,
    plattform_bps: int,
    vereinbarungen: list[dict],
    currency: str,
) -> Aufteilung:
    """Eine Buchung auf Plattform, Co-Gastgeber und Gastgeber aufteilen.

    ``vereinbarungen`` sind die aktiven property_cohosts-Zeilen des Objekts.
    Zeilen ohne Beteiligung ('none') fallen heraus — unentgeltliche Hilfe ist
    der häufigste Fall und darf keine Nullzeile erzeugen.

    Wirft, wenn die Summe der Beteiligungen den Rest nach Plattform-Gebühr
    übersteigt: Dann würde der Gastgeber für die eigene Buchung draufzahlen.
    Das ist mit hoher Wahrscheinlichkeit ein Eingabefehler und muss auffallen,
    statt still ins Minus zu laufen (Wurzel 5).
    """
    if brutto_cents < 0:
        raise BeteiligungFehler("Buchungsbetrag ist negativ.", status_code=422)
    if not currency:
        raise BeteiligungFehler("Währung der Buchung fehlt.", status_code=422)

    plattform_cents = brutto_cents * plattform_bps // 10000
    verfuegbar = brutto_cents - plattform_cents

    beteiligungen: list[Beteiligung] = []
    for v in vereinbarungen:
        betrag = _anteil_cents(v, brutto_cents, currency)
        if betrag <= 0:
            continue
        beteiligungen.append(
            Beteiligung(
                user_id=v["user_id"],
                cohost_id=v["id"],
                share_kind=v["share_kind"],
                share_bps=v.get("share_bps"),
                betrag_cents=betrag,
            )
        )

    gesamt = sum(b.betrag_cents for b in beteiligungen)
    if gesamt > verfuegbar:
        raise BeteiligungFehler(
            "Die vereinbarten Beteiligungen übersteigen den Buchungsbetrag "
            "abzüglich Plattform-Gebühr. Bitte die Anteile anpassen.",
            status_code=422,
        )

    return Aufteilung(
        brutto_cents=brutto_cents,
        plattform_cents=plattform_cents,
        cohosts=beteiligungen,
        gastgeber_cents=verfuegbar - gesamt,
    )


def pruefe_vereinbarung_gegen_gebuehr(
    *,
    share_kind: str,
    share_bps: int | None,
    plattform_bps: int,
    bestehende_bps: int,
) -> None:
    """Vorabprüfung beim FESTLEGEN einer prozentualen Beteiligung.

    Fängt den Fehler dort ab, wo er entsteht — im Dialog des Gastgebers —
    statt erst bei der nächsten Buchung. Fixbeträge lassen sich so nicht
    prüfen: Ob 50 € zu viel sind, hängt vom Buchungsbetrag ab und zeigt sich
    erst dort.
    """
    if share_kind != "percent" or not share_bps:
        return
    gesamt = bestehende_bps + int(share_bps)
    grenze = 10000 - plattform_bps
    if gesamt > grenze:
        raise BeteiligungFehler(
            f"Zusammen mit den bestehenden Beteiligungen wären das "
            f"{gesamt / 100:.2f} % — nach Abzug der Plattform-Gebühr stehen "
            f"höchstens {grenze / 100:.2f} % zur Verfügung.",
            status_code=422,
        )
