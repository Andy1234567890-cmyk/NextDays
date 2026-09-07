"""Schemas des booking_offers-Slices (Buchungsangebot, Lastenheft §2.2, 0586).

Drei Sichten auf dieselbe Zeile, die sich bewusst unterscheiden:

* ``BookingOfferOut`` — was der BETRIEB sieht: alles, inklusive interner Notiz
  und Zustandszeitstempeln.
* ``PublicOfferOut`` — was der GAST auf der Annahmeseite sieht: Objektname,
  Zeitraum, Positionen, Summe, Frist. KEINE internen Felder, keine IDs, über
  die man andere Angebote erraten könnte, und keine interne Notiz.
* ``BookingOfferCreate`` — was der Betrieb eingibt. Preis und Währung stehen
  NICHT darin: die rechnet der Server über den zentralen Resolver (Wurzel 3 —
  ein Client-Preis wäre ein Angebot, das der Gast selbst bestimmt).
"""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

# Ein Angebot darf nicht beliebig weit in die Zukunft reichen: die
# Preisaufschlüsselung ist eine Momentaufnahme, und je länger sie gilt, desto
# weiter läuft sie vom Kalender weg. 90 Tage sind der Rahmen, in dem ein
# Betrieb üblicherweise verhandelt.
MAX_GUELTIG_TAGE = 90

# Obergrenze für den Aufenthalt eines Angebots. Jeder unbegrenzte Bereich
# bekommt eine harte Grenze (Wurzel 8) — ohne sie erzeugt ein Tippfehler im
# Abreisedatum eine Nächte-Schleife über Jahre.
MAX_NAECHTE = 365


class OfferQuoteLine(BaseModel):
    """Eine Position der Aufschlüsselung, wie sie im Angebot festgehalten wird.

    Bewusst eine EIGENE Form und nicht `pricing.QuoteLine` importiert: Das
    Angebot speichert die Positionen als Tatsache in `quote_snapshot`. Ändert
    der Resolver morgen seine interne Form, muss ein zwei Wochen altes Angebot
    weiterhin lesbar sein — deshalb ein flaches, stabiles Schema mit
    `extra="ignore"`-Verhalten beim Einlesen.
    """

    label: str
    amount: float
    kind: str | None = None


class BookingOfferCreate(BaseModel):
    """Ein Angebot anlegen. Der Preis kommt vom Server, nicht vom Client."""

    property_id: str
    unit_id: str | None = None
    check_in: date
    check_out: date
    adults: int = Field(default=2, ge=1, le=50)
    children: int = Field(default=0, ge=0, le=50)
    pets: int = Field(default=0, ge=0, le=50)
    guest_name: str = Field(min_length=1, max_length=200)
    guest_email: EmailStr
    guest_phone: str | None = Field(default=None, max_length=50)
    # Sprache des Gastes (Mail + Annahmeseite). Ohne Angabe entscheidet der
    # Server über `mail_sprache.aufloesen` — nie hart Deutsch.
    language: str | None = Field(default=None, max_length=10)
    # Wie lange das Angebot gilt. Als Tage und nicht als Zeitstempel, weil der
    # Betrieb in Tagen denkt („eine Woche Zeit") und ein Zeitstempel aus dem
    # Browser die Zeitzone des Clients mitbrächte.
    gueltig_tage: int = Field(default=7, ge=1, le=MAX_GUELTIG_TAGE)
    # Anzahlung. None = der Gesamtbetrag ist sofort fällig.
    deposit_amount: float | None = Field(default=None, gt=0)
    internal_note: str | None = Field(default=None, max_length=2000)
    # Der Rate-Plan, zu dem angeboten wird (Hotel: Twin/BAR ≠ Double/B&B).
    rate_plan_id: str | None = None

    @field_validator("guest_name")
    @classmethod
    def _name_nicht_leer(cls, wert: str) -> str:
        geputzt = wert.strip()
        if not geputzt:
            msg = "Der Gastname darf nicht leer sein."
            raise ValueError(msg)
        return geputzt

    @model_validator(mode="after")
    def _zeitraum_pruefen(self) -> BookingOfferCreate:
        if self.check_out <= self.check_in:
            msg = "Die Abreise muss nach der Anreise liegen."
            raise ValueError(msg)
        naechte = (self.check_out - self.check_in).days
        if naechte > MAX_NAECHTE:
            msg = f"Ein Angebot umfasst höchstens {MAX_NAECHTE} Nächte."
            raise ValueError(msg)
        return self


class BookingOfferOut(BaseModel):
    """Die Sicht des Betriebs auf ein Angebot."""

    id: str
    property_id: str
    property_title: str | None = None
    unit_id: str | None = None
    check_in: date
    check_out: date
    nights: int
    adults: int
    children: int
    pets: int
    guest_name: str
    guest_email: str
    guest_phone: str | None = None
    language: str | None = None
    currency: str
    total_amount: float
    deposit_amount: float | None = None
    lines: list[OfferQuoteLine] = Field(default_factory=list)
    expires_at: datetime
    status: str
    sent_at: datetime | None = None
    viewed_at: datetime | None = None
    accepted_at: datetime | None = None
    declined_at: datetime | None = None
    reservation_id: str | None = None
    internal_note: str | None = None
    created_at: datetime
    updated_at: datetime


class BookingOfferList(BaseModel):
    """Liste mit Gesamtzahl — die Oberfläche blättert."""

    items: list[BookingOfferOut]
    total: int


class PublicOfferOut(BaseModel):
    """Was der Gast auf der Annahmeseite sieht.

    Enthält bewusst KEINE `id` und keine Objekt-/Mandanten-IDs: der Gast
    braucht sie nicht, und jede ausgelieferte ID ist ein Ansatzpunkt, andere
    Angebote zu erraten. Der Token in der URL ist der ganze Zugang.
    """

    property_title: str
    property_city: str | None = None
    check_in: date
    check_out: date
    nights: int
    adults: int
    children: int
    pets: int
    guest_name: str
    currency: str
    total_amount: float
    # Was jetzt zu zahlen ist: Anzahlung, sonst der Gesamtbetrag.
    amount_due_now: float
    lines: list[OfferQuoteLine] = Field(default_factory=list)
    expires_at: datetime
    status: str
    # Kann der Gast noch annehmen? Der Server entscheidet das, nicht die Seite —
    # sie würde sonst aus Status und Frist eine eigene, abweichende Regel bauen.
    acceptable: bool
    # Warum nicht (abgelaufen, zurückgezogen, schon bezahlt) — als Schlüssel,
    # den die Seite in der Gastsprache ausgibt.
    blocked_reason: str | None = None
    company_name: str | None = None


class PublicOfferAcceptResponse(BaseModel):
    """Antwort auf die Annahme: der Weg zur Zahlung."""

    # Die URL des Zahlungslinks im Konto des Betriebs. Der Gast wird dorthin
    # geschickt; erst der Stripe-Webhook erzeugt die Buchung (0409).
    payment_url: str
    amount_due_now: float
    currency: str


class SliceHealth(BaseModel):
    status: str
    slice: str = "booking_offers"
