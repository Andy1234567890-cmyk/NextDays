"""Spendenanteil einer Buchung (Airbnb-Modell „Donate to Airbnb.org").

DIE ZENTRALE REGEL — analog zur Co-Gastgeber-Beteiligung (cohosts/payouts.py):

    Die Plattform-Gebühr ist FEST. Die Spende kommt OBENDRAUF und geht
    zulasten des Gastgebers.

    brutto = plattform_fee + spende + cohost_anteile + gastgeber_rest

Warum die Spende in die Stripe-application_fee wandert: Wir kassieren per
Destination Charge — das Geld geht direkt an den Connected Account des
Gastgebers, die Plattform hält es nie. Ein Betrag, der an eine Organisation
weitergeleitet werden soll, muss also beim Charge einbehalten werden, sonst
läge er bereits beim Gastgeber und müsste zurückgeholt werden.

Alle Beträge in CENT und Ganzzahl-Arithmetik. Kein Float: Bei Geld führt
Fließkomma zu Rundungsdifferenzen, die sich über viele Buchungen summieren.
"""
from __future__ import annotations

from dataclasses import dataclass

# Obergrenze wie in der Migration (0216). Ein höherer Satz ist zusammen mit
# Plattform-Gebühr und Co-Gastgeber-Beteiligung praktisch nie erfüllbar und
# deutet auf einen Eingabefehler hin.
MAX_SHARE_BPS = 5000


@dataclass(frozen=True)
class Spende:
    """Der Spendenanteil EINER Buchung."""

    recipient_id: str
    share_bps: int
    betrag_cents: int


class SpendeFehler(Exception):
    """Der Spendenanteil ist unstimmig oder passt nicht in die Aufteilung."""

    def __init__(self, message: str, status_code: int = 422) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def berechne_spende(
    *,
    brutto_cents: int,
    einstellung: dict | None,
) -> Spende | None:
    """Spendenanteil einer Buchung aus der Betriebs-Einstellung berechnen.

    ``None``, wenn kein Spendensatz eingerichtet ist oder er 0 beträgt — das
    ist der Normalfall und darf keine Nullzeile im Ledger erzeugen.

    Fail-closed: Eine eingerichtete, aber unstimmige Einstellung ergibt einen
    Fehler statt stillschweigend 0 — sonst würde die Organisation ohne
    jeden Hinweis leer ausgehen (Wurzel 5).
    """
    if not einstellung:
        return None

    bps = einstellung.get("share_bps")
    if bps in (None, 0):
        return None

    bps = int(bps)
    if bps < 0 or bps > MAX_SHARE_BPS:
        raise SpendeFehler(
            f"Spendensatz {bps / 100:.2f} % liegt außerhalb des zulässigen "
            f"Bereichs (0–{MAX_SHARE_BPS / 100:.0f} %).",
            status_code=500,
        )

    recipient_id = einstellung.get("recipient_id")
    if not recipient_id:
        # Satz gesetzt, aber kein Empfänger: Das Geld hätte kein Ziel. Nie
        # einen Empfänger raten (Wurzel 4).
        raise SpendeFehler(
            "Spendensatz ist gesetzt, aber kein Empfänger hinterlegt.",
            status_code=500,
        )

    if brutto_cents < 0:
        raise SpendeFehler("Buchungsbetrag ist negativ.", status_code=422)

    # Ganzzahl-Division schneidet ab — zugunsten des Gastgebers, der die Spende
    # trägt. Bewusst kein Runden: aufgerundet könnte die Summe aus Spende und
    # Co-Gastgeber-Beteiligungen den verfügbaren Rest übersteigen.
    betrag = brutto_cents * bps // 10000
    if betrag <= 0:
        # Bei sehr kleinen Buchungen ergibt der Anteil weniger als einen Cent.
        # Keine Zeile anlegen, statt 0 zu buchen.
        return None

    return Spende(
        recipient_id=str(recipient_id),
        share_bps=bps,
        betrag_cents=betrag,
    )


def pruefe_satz_gegen_verpflichtungen(
    *,
    share_bps: int,
    plattform_bps: int,
    cohost_bps: int,
) -> None:
    """Vorabprüfung beim FESTLEGEN des Spendensatzes.

    Fängt den Fehler dort ab, wo er entsteht — in der Einstellung des
    Gastgebers — statt erst bei der nächsten Buchung.

    ``cohost_bps`` ist die Summe der prozentualen Co-Gastgeber-Beteiligungen
    über alle Objekte des Betriebs. Fixbeträge lassen sich hier nicht
    berücksichtigen: Ob 50 € zu viel sind, hängt vom Buchungsbetrag ab und
    zeigt sich erst dort.
    """
    if share_bps < 0 or share_bps > MAX_SHARE_BPS:
        raise SpendeFehler(
            f"Der Spendenanteil muss zwischen 0 und "
            f"{MAX_SHARE_BPS / 100:.0f} % liegen.",
            status_code=422,
        )
    if share_bps == 0:
        return

    grenze = 10000 - plattform_bps - cohost_bps
    if grenze <= 0:
        raise SpendeFehler(
            "Nach Plattform-Gebühr und bestehenden Beteiligungen bleibt kein "
            "Anteil für eine Spende übrig.",
            status_code=422,
        )
    if share_bps > grenze:
        raise SpendeFehler(
            f"Nach Abzug von Plattform-Gebühr und Beteiligungen stehen "
            f"höchstens {grenze / 100:.2f} % zur Verfügung.",
            status_code=422,
        )
