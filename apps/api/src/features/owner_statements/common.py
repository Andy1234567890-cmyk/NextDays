"""Geteilte Auszahlungs-Rechnung — die EINE Quelle der Auszahlungsformel.

Zwei Slices brauchen dieselbe Zahl:
* ``owner_statements`` — die Abrechnung (Summe je Zeitraum, Rechnung, PDF).
* ``public_portal`` — der Eigentümer-Kalender, der je NACHT seinen
  Netto-Auszahlungsbetrag zeigt (Etappe B).

Ohne diesen Ort stünde die Formel zweimal im Code und liefe auseinander: der
Kalender zeigte dann eine andere Zahl als die Abrechnung über denselben
Zeitraum — ein Fehler, den niemand als Bug erkennt, weil beide Werte plausibel
aussehen.

Bewusst OHNE Pydantic-Schemas und ohne DB-Zugriff: reine Rechnung auf Decimal.
Jeder Slice holt seine Zeilen selbst (mit seinem eigenen Scope) und formt sein
eigenes Antwortmodell — sonst bestimmte die Abrechnung die Antwortform des
Portals mit.

Wurzel 4 (keine erfundenen Werte): Fehlt eine Rechengrundlage (Provision,
Betrag, Nächte), wird NICHT auf 0 oder einen plausiblen Ersatzwert
zurückgefallen — ``PayoutUnbekannt`` sagt, WAS fehlt. Der Aufrufer entscheidet,
ob das ein 422 ist oder eine leere Zelle mit erkennbarem Grund.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

_CENT = Decimal("0.01")
_HUNDERT = Decimal("100")


class PayoutUnbekannt(Exception):
    """Die Auszahlung ist aus den Daten NICHT berechenbar.

    ``grund`` benennt die fehlende Grundlage maschinenlesbar
    (``provision`` | ``betrag`` | ``naechte``), damit der Aufrufer sie in der
    UI erkennbar machen kann, statt eine Zahl zu erfinden (Wurzel 4).
    """

    def __init__(self, grund: str, message: str) -> None:
        super().__init__(message)
        self.grund = grund
        self.message = message


def zu_decimal(value: object) -> Decimal | None:
    """In Decimal wandeln (über str, um Float-Artefakte zu vermeiden).

    ``None`` bleibt ``None`` — der Aufrufer muss entscheiden, ob ein fehlender
    Wert ein Datenfehler ist. Ein stilles ``Decimal("0")`` wäre genau der
    erfundene Ersatzwert aus Wurzel 4.
    """
    if value is None:
        return None
    return Decimal(str(value))


def effektive_provision_pct(
    override_pct: object, default_pct: object
) -> Decimal:
    """Provisionssatz je Objekt: Objekt-Override, sonst Owner-Default.

    Bildet ``owner_properties.commission_override_pct ??
    owners.default_commission_pct`` ab — dieselbe Ableitung wie
    ``OwnerStatementsService._commission_map``.

    Fehlt BEIDES, ist das ein Datenfehler und kein „0 % Provision": eine
    unterstellte Null zahlte dem Eigentümer den vollen Betrag aus und die
    Hausverwaltung nichts. Darum ``PayoutUnbekannt`` statt eines Defaults.
    """
    pct = zu_decimal(override_pct)
    if pct is None:
        pct = zu_decimal(default_pct)
    if pct is None:
        raise PayoutUnbekannt(
            "provision",
            "Keine Provision hinterlegt (weder je Objekt noch als Standard).",
        )
    if pct < 0 or pct > _HUNDERT:
        # EIGENER Grund, nicht „provision": ein FEHLENDER Satz ist eine
        # unvollständige Stammdatenzeile (die Abrechnung darf ihn historisch
        # als 0 behandeln), ein UNGÜLTIGER Satz ist ein echter Eingabefehler,
        # den niemand stillschweigend auf 0 glattbügeln darf. Die Aufrufer
        # unterscheiden das am `grund`, nicht am Meldungstext.
        raise PayoutUnbekannt(
            "provision_ungueltig",
            f"Provisionssatz {pct} liegt außerhalb von 0–100 %.",
        )
    return pct


def buchungs_payout(
    total_amount: object, channel_fee: object, addon_total: object = None
) -> Decimal:
    """Auszahlung der BUCHUNG vor Provision: total_amount + Extras − channel_fee.

    Identisch zu ``_rental_rows`` im Abrechnungs-Service. ``channel_fee`` und
    ``addon_total`` dürfen fehlen — „keine OTA-Gebühr" bzw. „keine Extras" ist
    ein echter Zustand, kein Datenloch. ``total_amount`` dagegen MUSS da sein:
    eine Buchung ohne Betrag kann keinen Auszahlungsbetrag ergeben.
    """
    betrag = zu_decimal(total_amount)
    if betrag is None:
        raise PayoutUnbekannt(
            "betrag", "Reservierung ohne Gesamtbetrag — Auszahlung unbestimmt."
        )
    gebuehr = zu_decimal(channel_fee) or Decimal("0")
    extras = zu_decimal(addon_total) or Decimal("0")
    return betrag + extras - gebuehr


def owner_payout(payout: Decimal, provision_pct: Decimal) -> Decimal:
    """Netto-Auszahlung des Eigentümers = Payout × (100 − Provision) / 100.

    UNGERUNDET (volle Decimal-Genauigkeit) — gerundet wird erst an der
    API-Grenze bzw. in ``payout_je_nacht``, damit die Nacht-Verteilung ohne
    Rundungsverlust auf diesen Wert aufgehen kann.
    """
    return payout * ((_HUNDERT - provision_pct) / _HUNDERT)


def payout_je_nacht(gesamt: Decimal, naechte: int) -> list[Decimal]:
    """Den Auszahlungsbetrag verlustfrei auf die Nächte verteilen.

    Branchenüblich (Hostaway/Guesty/Escapia weisen den Ertrag am Aufenthalt
    aus, nicht am Kalendertag) wird GLEICHMÄSSIG über die Nächte verteilt —
    nicht nach Tagespreis gewichtet. Grund: der Auszahlungsbetrag hängt an der
    Buchung als Ganzes (Provision, OTA-Gebühr und Extras gelten dem Aufenthalt,
    nicht einer einzelnen Nacht); eine Gewichtung nach Tagespreis würde eine
    Genauigkeit vortäuschen, die die Quelldaten nicht hergeben.

    RUNDUNG (ausdrücklich gelöst, kein Rundungsverlust): jede Nacht bekommt den
    kaufmännisch auf den Cent gerundeten Gleichanteil; die LETZTE Nacht trägt
    die Differenz zum Gesamtbetrag. Damit gilt immer
    ``sum(payout_je_nacht(g, n)) == g.quantize(0.01)`` — die Summe der im
    Kalender gezeigten Nächte ist exakt der Buchungs-Payout. Ohne diesen
    Ausgleich ergäbe z. B. 100,00 € auf 3 Nächte 3 × 33,33 € = 99,99 €, und dem
    Eigentümer fehlte im Kalender ein Cent gegenüber seiner Abrechnung.

    ``naechte <= 0`` ist ein Datenfehler (Check-out vor/gleich Check-in) und
    ergibt KEINE Verteilung — sonst entstünde eine Division durch Null oder ein
    stillschweigend verschwundener Betrag.
    """
    if naechte <= 0:
        raise PayoutUnbekannt(
            "naechte",
            "Reservierung ohne Nächte (Check-out nicht nach Check-in).",
        )
    gesamt_gerundet = gesamt.quantize(_CENT, rounding=ROUND_HALF_UP)
    anteil = (gesamt / naechte).quantize(_CENT, rounding=ROUND_HALF_UP)
    werte = [anteil] * naechte
    # Letzte Nacht trägt die Differenz (siehe Docstring).
    werte[-1] = gesamt_gerundet - anteil * (naechte - 1)
    return werte


@dataclass(frozen=True, slots=True)
class NachtPayout:
    """Eine Nacht mit dem auf sie entfallenden Netto-Auszahlungsbetrag."""

    payout: Decimal
    currency: str


def naechte_payout_map(
    *,
    total_amount: object,
    channel_fee: object,
    provision_pct: Decimal,
    naechte: int,
    currency: str,
    addon_total: object = None,
) -> list[NachtPayout]:
    """Die komplette Kette für EINE Buchung: Payout → Provision → je Nacht.

    Die Währung kommt aus den Daten und wird durchgereicht, nie ersetzt
    (Wurzel 4) — fehlt sie, ist das hier ein Fehler, kein ``"EUR"``.
    """
    if not (currency or "").strip():
        raise PayoutUnbekannt(
            "betrag", "Reservierung ohne Währung — Auszahlung nicht ausweisbar."
        )
    payout = buchungs_payout(total_amount, channel_fee, addon_total)
    netto = owner_payout(payout, provision_pct)
    return [NachtPayout(payout=w, currency=currency) for w in payout_je_nacht(netto, naechte)]
