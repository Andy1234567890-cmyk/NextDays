"""Fälligkeit und Aufteilung einer Auszahlung — reine Rechenlogik, ohne DB.

MODELL (Booking.com): Die Auszahlung wird durch die ABREISE ausgelöst, nicht
durch den Zahlungseingang und nicht durch die Anreise. Zum Zeitpunkt der Abreise
steht der Aufenthalt fest — Schäden, verkürzte Aufenthalte und Beschwerden sind
bekannt, BEVOR Geld fließt.

Alle Beträge in CENT und Ganzzahl-Arithmetik. Kein Float: Bei Geld führt
Fließkomma zu Rundungsdifferenzen, die sich über viele Buchungen summieren.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

# Nachtragefrist: Trägt ein Betrieb den Checkout nicht ein, wird nach dem
# geplanten Abreisedatum plus diesem Puffer trotzdem fällig. Ohne den Rückfall
# bliebe das Geld dauerhaft liegen.
NACHTRAGEFRIST_TAGE = 1

# Booking zahlt wöchentlich donnerstags. 0=Montag … 3=Donnerstag.
WOECHENTLICH_WOCHENTAG = 3

# Booking zahlt monatlich bis zum 15. des Folgemonats.
MONATLICH_STICHTAG = 15


def transfer_group(reservation_id: str) -> str:
    """Klammer zwischen Charge und späterem Transfer einer Buchung.

    EINE Quelle für beide Seiten: Der Charge (features/payments) und der
    Auszahlungs-Transfer (features/payouts) müssen exakt denselben Wert tragen,
    sonst ordnet Stripe sie nicht einander zu. Eine Buchung kann mehrfach
    kassiert werden (Anzahlung + Restzahlung) — alle tragen dieselbe Gruppe.

    Liegt hier statt im payments-Slice, weil dieses Modul importfrei ist und
    beide Slices es ziehen können, ohne den bestehenden Import-Zyklus
    payments↔payouts zu verschärfen.
    """
    return f"reservation:{reservation_id}"


class FaelligkeitFehler(Exception):
    """Die Fälligkeit lässt sich nicht bestimmen."""

    def __init__(self, message: str, status_code: int = 422) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class Aufteilung:
    """Wie sich eine Buchung auf die Beteiligten verteilt."""

    brutto_cents: int
    plattform_cents: int
    spende_cents: int
    cohost_cents: int
    netto_cents: int

    def __post_init__(self) -> None:
        summe = (
            self.plattform_cents
            + self.spende_cents
            + self.cohost_cents
            + self.netto_cents
        )
        if summe != self.brutto_cents:
            raise FaelligkeitFehler(
                f"Aufteilung geht nicht auf: {summe} != {self.brutto_cents}.",
                status_code=500,
            )


def basis_faelligkeit(
    *,
    checked_out_at: datetime | None,
    check_out: date | None,
) -> datetime:
    """Ab wann eine Auszahlung frühestens fällig ist.

    Der TATSÄCHLICHE Checkout hat Vorrang — er ist der Beleg, dass der
    Aufenthalt vorbei ist. Fehlt er, gilt das geplante Abreisedatum plus
    Nachtragefrist (sonst bliebe Geld liegen, wenn niemand auscheckt).
    """
    if checked_out_at is not None:
        return checked_out_at
    if check_out is None:
        raise FaelligkeitFehler(
            "Buchung hat weder Checkout noch Abreisedatum.", status_code=422
        )
    return datetime.combine(
        check_out + timedelta(days=NACHTRAGEFRIST_TAGE),
        datetime.min.time(),
        tzinfo=UTC,
    )


def _naechster_wochentag(ab: datetime, wochentag: int) -> datetime:
    """Der nächste angegebene Wochentag ab einem Zeitpunkt (heute zählt mit)."""
    versatz = (wochentag - ab.weekday()) % 7
    return (ab + timedelta(days=versatz)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )


def _stichtag_folgemonat(ab: datetime, tag: int) -> datetime:
    """Der Stichtag im Folgemonat — Booking zahlt monatlich bis zum 15."""
    if ab.month == 12:
        jahr, monat = ab.year + 1, 1
    else:
        jahr, monat = ab.year, ab.month + 1
    return datetime(jahr, monat, tag, tzinfo=UTC)


def faellig_ab(
    *,
    checked_out_at: datetime | None,
    check_out: date | None,
    intervall: str,
) -> datetime:
    """Fälligkeitszeitpunkt nach dem gewählten Rhythmus (Booking-Modell).

    * ``daily``   — einen Tag nach Abreise
    * ``weekly``  — der nächste Donnerstag nach der Abreise
    * ``monthly`` — der 15. des Folgemonats
    """
    basis = basis_faelligkeit(checked_out_at=checked_out_at, check_out=check_out)

    if intervall == "daily":
        return basis + timedelta(days=1)
    if intervall == "weekly":
        # Fällt die Abreise selbst auf einen Donnerstag, wird erst der nächste
        # genommen — sonst zahlten wir am Abreisetag selbst aus.
        return _naechster_wochentag(basis + timedelta(days=1), WOECHENTLICH_WOCHENTAG)
    if intervall == "monthly":
        return _stichtag_folgemonat(basis, MONATLICH_STICHTAG)

    raise FaelligkeitFehler(
        f"Unbekannter Auszahlungsrhythmus: {intervall}", status_code=500
    )


def berechne_aufteilung(
    *,
    brutto_cents: int,
    plattform_cents: int,
    spende_cents: int,
    cohost_cents: int,
) -> Aufteilung:
    """Die Aufteilung einer Buchung — Airbnb teilt auf, BEVOR Geld fließt.

    Reihenfolge der Abzüge ist festgelegt: Plattform-Provision zuerst (sie ist
    fest und unantastbar), dann Spende und Co-Gastgeber-Anteile, die beide
    zulasten des Gastgebers gehen. Was bleibt, ist seine Auszahlung.

    Fail-closed: Übersteigen die Abzüge den Bruttobetrag, ist das ein
    Rechenfehler — dann klar fehlschlagen statt einen negativen Betrag zu
    buchen (Wurzel 5).
    """
    if brutto_cents < 0:
        raise FaelligkeitFehler("Buchungsbetrag ist negativ.", status_code=422)

    abzuege = plattform_cents + spende_cents + cohost_cents
    if abzuege > brutto_cents:
        raise FaelligkeitFehler(
            f"Abzüge ({abzuege}) übersteigen den Buchungsbetrag "
            f"({brutto_cents}).",
            status_code=422,
        )

    return Aufteilung(
        brutto_cents=brutto_cents,
        plattform_cents=plattform_cents,
        spende_cents=spende_cents,
        cohost_cents=cohost_cents,
        netto_cents=brutto_cents - abzuege,
    )


def verrechne(
    *, netto_cents: int, offene_posten_cents: int
) -> tuple[int, int]:
    """Verrechnungsposten von einer Auszahlung abziehen (Airbnb-Modell).

    Gibt ``(auszahlbar, verrechnet)`` zurück. Übersteigen die offenen Posten
    die Auszahlung, wird alles einbehalten und der Rest bleibt für die nächste
    stehen — es wird NIE ein negativer Betrag ausgezahlt.
    """
    if netto_cents < 0 or offene_posten_cents < 0:
        raise FaelligkeitFehler("Negative Beträge in der Verrechnung.", 500)
    verrechnet = min(netto_cents, offene_posten_cents)
    return netto_cents - verrechnet, verrechnet
