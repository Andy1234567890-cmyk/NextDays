"""Schemas rund um eine BESTEHENDE Buchung — und die Preisvorschau davor.

Abgetrennt von `schemas.py`, weil dort der Kern steht: Auth, Objekt,
Verfügbarkeit, Preise, Buchung, Aufgabe, Webhook. Hier liegt, was danach
kommt — Preisaufstellung, Änderung, An- und Abreise, Ablage, Nachrichten,
Zahlungen, Storno — plus die Preisvorschau, die derselben Domäne vorausgeht.

Die Feldnamen sind wie im Kern ein VERSPRECHEN: sie stehen in der
veröffentlichten OpenAPI-Datei, und ein Client verlässt sich darauf.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Buchung: Preisaufstellung, Änderung, An- und Abreise
# ---------------------------------------------------------------------------
class QuotePosten(BaseModel):
    """Eine Zeile der Preisaufstellung einer Buchung."""

    kind: str = Field(
        description=(
            "Art der Position, z. B. `lodging` (Unterkunft), `fee` (Gebühr), "
            "`tax` (Abgabe), `addon` (Zusatzleistung), `discount` (Rabatt)."
        )
    )
    label: str = Field(description="Bezeichnung, wie der Gast sie sieht.")
    amount: Decimal


class Quote(BaseModel):
    """Die Preisaufstellung einer bestehenden Buchung.

    Sie wird NICHT neu berechnet, sondern wiedergegeben: es ist die Aufstellung,
    die zur Buchung gehört und die der Gast so gesehen hat. Eine Neuberechnung
    hier wäre eine zweite Wahrheit über den Preis — und die erste steht auf der
    Rechnung.
    """

    reservation_id: str
    currency: str
    total_amount: Decimal
    paid_amount: Decimal
    due_amount: Decimal = Field(
        description="Offener Betrag: `total_amount` minus `paid_amount`."
    )
    items: list[QuotePosten] = Field(
        description=(
            "Die Positionen. Leer, wenn zu dieser Buchung keine Aufstellung "
            "gespeichert ist — dann ist `total_amount` alles, was wir wissen."
        )
    )


class BuchungAenderung(BaseModel):
    """Änderbare Felder einer Buchung.

    Bewusst NICHT dabei: `check_in`, `check_out`, `property_id`, `unit_id`,
    `status`, Beträge. Jedes davon hat einen Gegenzustand, der mitgepflegt
    werden muss — belegte Nächte, Portal-Meldung, Rechnung. Eine Verschiebung
    über diesen Endpunkt würde Nächte belegt lassen, die frei sein müssten
    (Wurzel 1). Umbuchen und Stornieren laufen über das Dashboard; die
    Dokumentation nennt das unter „Grenzen von v1".

    Alle Felder sind optional; nur mitgeschickte werden geändert. Ein `null`
    LÖSCHT den Wert — deshalb wird zwischen „nicht mitgeschickt" und „auf null
    gesetzt" unterschieden.
    """

    adults: int | None = Field(default=None, ge=1, le=50)
    children: int | None = Field(default=None, ge=0, le=50)
    infants: int | None = Field(default=None, ge=0, le=50)
    pets: int | None = Field(default=None, ge=0, le=20)
    note: str | None = Field(default=None, max_length=5000)
    external_ref: str | None = Field(default=None, max_length=200)
    checkin_time: str | None = Field(
        default=None,
        max_length=5,
        description="Erwartete Ankunftszeit als `HH:MM`, oder `null` zum Löschen.",
    )
    checkout_time: str | None = Field(default=None, max_length=5)
    guest_email: str | None = Field(default=None, max_length=320)
    guest_phone: str | None = Field(default=None, max_length=50)
    guest_language: str | None = Field(default=None, max_length=5)

    @field_validator("checkin_time", "checkout_time")
    @classmethod
    def _uhrzeit(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        teile = v.split(":")
        if len(teile) != 2 or not all(t.isdigit() for t in teile):
            raise ValueError("Uhrzeit muss `HH:MM` sein.")
        stunde, minute = int(teile[0]), int(teile[1])
        if not (0 <= stunde <= 23 and 0 <= minute <= 59):
            raise ValueError("Uhrzeit liegt außerhalb des Tages.")
        return f"{stunde:02d}:{minute:02d}"


class AnkunftAntwort(BaseModel):
    """Ergebnis einer An- oder Abreise-Meldung."""

    reservation_id: str
    checked_in_at: datetime | None = None
    checked_out_at: datetime | None = None


# ---------------------------------------------------------------------------
# Ablage, Nachrichten, Zahlungen
# ---------------------------------------------------------------------------
class AblageAntwort(BaseModel):
    """Ergebnis von Ablegen und Zurückholen.

    Ablegen ist eine ANSICHTS-Entscheidung, kein Storno: Status, Belegung und
    Kalenderwirkung bleiben unverändert. Wer Nächte freigeben will, storniert —
    und das geht in v1 nicht (siehe „Grenzen von v1").
    """

    reservation_id: str
    archived_at: datetime | None = Field(
        default=None, description="`null` heißt: die Buchung ist wieder aktiv."
    )


class Nachricht(BaseModel):
    """Eine Nachricht im Gespräch zu einer Buchung."""

    id: str
    sender: str = Field(
        description="Wer geschrieben hat: `guest` oder `host`."
    )
    body: str
    read_at: datetime | None = Field(
        default=None,
        description="Wann der Empfänger sie gelesen hat. `null` = ungelesen.",
    )
    created_at: datetime


class NachrichtSenden(BaseModel):
    """Eine Nachricht an den Gast."""

    body: str = Field(min_length=1, max_length=5000)


class UngelesenAntwort(BaseModel):
    """Zähler für die Arbeitsliste: wie viel wartet auf eine Antwort."""

    unread_threads: int = Field(
        description="Gespräche mit mindestens einer ungelesenen Gast-Nachricht."
    )
    unread_messages: int = Field(description="Ungelesene Gast-Nachrichten insgesamt.")


class Zahlung(BaseModel):
    """Eine Zahlung oder Zahlungsaufforderung zu einer Buchung."""

    id: str
    amount: Decimal
    currency: str
    type: str = Field(
        description="Art der Bewegung, z. B. `deposit`, `balance`, `refund`."
    )
    status: str
    gateway: str | None = Field(
        default=None, description="Über wen sie läuft, z. B. `stripe`, `paypal`."
    )
    due_at: datetime | None = Field(
        default=None, description="Wann sie fällig ist, falls terminiert."
    )
    created_at: datetime


# ---------------------------------------------------------------------------
# Storno
# ---------------------------------------------------------------------------
class StornoAnfrage(BaseModel):
    """Eine Buchung stornieren.

    `reason` und `party` sind PFLICHT und haben bewusst keinen Standardwert.
    Die Partei sagt, WESSEN Sphäre storniert hat, und entscheidet über
    Stornogebühren und Provision — ein Standard hier hiesse, dass irgendwann
    stillschweigend die bequemste Partei in einer Geldentscheidung steht.
    """

    reason: str = Field(
        min_length=3,
        max_length=1000,
        description="Der Grund im Klartext. Wird im Storno-Protokoll festgehalten.",
    )
    party: Literal["gast", "eigentuemer", "agentur", "betrieb", "portal", "system"] = (
        Field(
            description=(
                "Wessen Sphäre storniert: `gast` (der Gast hat abgesagt), "
                "`eigentuemer`, `agentur`, `betrieb` (der Betrieb selbst), "
                "`portal` (die Absage kam über ein Portal zu uns), `system`."
            )
        )
    )
    reason_code: (
        Literal[
            "gast_wunsch",
            "zahlung_ausgeblieben",
            "objekt_nicht_verfuegbar",
            "schaden_instandsetzung",
            "eigennutzung",
            "eigennutzung_aufgeloest",
            "doppelbuchung",
            "verdacht_betrug",
        ]
        | None
    ) = Field(
        default=None,
        description=(
            "Kategorie ZUSÄTZLICH zum Freitext. Optional — nicht jeder Grund "
            "passt in eine Kategorie, und dann wird keine erfunden."
        ),
    )


class StornoAntwort(BaseModel):
    """Bestätigung, dass der Storno beauftragt ist.

    Der Aufruf antwortet mit 202, nicht mit 200: die Buchung ist in diesem
    Moment noch nicht storniert. Die Storno-Kette (Nächte freigeben, Portale
    melden, Gebühren und Auszahlungs-Karenz rechnen, Protokoll schreiben) läuft
    an EINER Stelle im Betriebssystem, und diese Stelle arbeitet den Auftrag ab.
    Ein `200 OK` würde behaupten, alles sei erledigt — das wäre eine
    Falschaussage über einen Vorgang, der Geld bewegt.

    Wann es fertig ist, erfährst du über das Ereignis
    `reservation.cancelled` (Webhook oder `GET /v1/events`) oder indem du die
    Buchung liest: dann steht `status` auf `cancelled` und `cancelled_at`.
    """

    reservation_id: str
    status: Literal["accepted", "already_cancelled"] = Field(
        description=(
            "`accepted` — der Auftrag ist eingereiht. `already_cancelled` — die "
            "Buchung war schon storniert; es passiert nichts weiter."
        )
    )
    cancelled_at: datetime | None = Field(
        default=None,
        description="Nur bei `already_cancelled` gesetzt: wann sie storniert wurde.",
    )


# ---------------------------------------------------------------------------
# Preisvorschau
# ---------------------------------------------------------------------------
class PreisvorschauPosten(BaseModel):
    """Eine Position der Preisvorschau."""

    kind: str = Field(
        description=(
            "Art der Position: `lodging` (Übernachtung), `surcharge` "
            "(Aufschlag), `fee` (Gebühr), `discount` (Rabatt, negativ), `tax` "
            "(Abgabe), `addon` (Zusatzleistung)."
        )
    )
    label: str = Field(description="Bezeichnung, wie der Gast sie sieht.")
    amount: Decimal = Field(description="Betrag in der Währung des Objekts.")


class Preisvorschau(BaseModel):
    """Was ein Aufenthalt kostet — mit denselben Regeln wie die Buchung.

    Gerechnet wird mit der EINEN Preisberechnung des Betriebssystems (dieselbe
    Datei, byte-identisch geführt). Trotzdem ist das Ergebnis eine Vorschau und
    keine Zusage: zwischen Vorschau und Buchung kann eine Aktion beginnen oder
    ein Tagespreis gesetzt werden. Verbindlich ist der Betrag, der beim Anlegen
    der Buchung mitgeschickt und geprüft wird.
    """

    property_id: str
    rate_plan_id: str | None = None
    check_in: date
    check_out: date
    nights: int
    guests: int
    pets: int
    currency: str = Field(
        description="Währung des Objekts. Nie erfunden — fehlt sie, schlägt der Aufruf fehl."
    )
    nightly_total: Decimal = Field(
        description="Summe der Übernachtungen ohne Gebühren, Rabatte und Abgaben."
    )
    total_amount: Decimal = Field(description="Endsumme über alle Positionen.")
    promo_code_applied: bool = Field(
        description=(
            "Hat der mitgeschickte Aktionscode WIRKLICH eine Aktion ausgelöst? "
            "`false` bei ungültigem Code — auch dann kann eine automatische "
            "Aktion gegriffen haben, sichtbar als `discount`-Position."
        )
    )
    items: list[PreisvorschauPosten]


# ---------------------------------------------------------------------------
# Verschieben
# ---------------------------------------------------------------------------
class VerschiebeAnfrage(BaseModel):
    """Eine Buchung in einen anderen Zeitraum und/oder ein anderes Objekt legen.

    Anders als `PATCH` ist das eine Änderung MIT Gegenzustand: die alten Nächte
    werden frei, die neuen belegt, und beide Zustände müssen an die Portale.
    Deshalb läuft sie über einen Auftrag an die eine Stelle, die diese Kette
    führt — und nicht über ein Update auf zwei Datumsfelder.
    """

    property_id: str = Field(
        description=(
            "Ziel-Objekt. Für eine reine Verlängerung oder Verkürzung dasselbe "
            "Objekt mitschicken wie bisher."
        )
    )
    check_in: date
    check_out: date = Field(description="Abreisetag — die Nacht davor ist die letzte.")
    reprice: bool | None = Field(
        default=None,
        description=(
            "Ohne Angabe bleibt der Preis UNVERÄNDERT — der vereinbarte Preis "
            "ist bindend, und ein automatisches Nachrechnen wäre eine "
            "stillschweigende Preisänderung. `true` lässt den Preis für den "
            "neuen Zeitraum neu berechnen (Upsell)."
        ),
    )


class VerschiebeAntwort(BaseModel):
    """Bestätigung, dass das Verschieben beauftragt ist.

    Wie beim Storno eine 202: die Buchung liegt in diesem Moment noch im alten
    Zeitraum. Der Abschluss kommt als Ereignis `reservation.updated`.

    Die Zieltage wurden VOR dem Auftrag geprüft; ein belegter Zeitraum wird
    sofort mit 409 abgelehnt. Zwischen Prüfung und Ausführung kann trotzdem eine
    Buchung entstehen — dann schlägt der Auftrag fehl, statt zwei Gäste in
    dasselbe Zimmer zu legen.
    """

    reservation_id: str
    status: Literal["accepted"] = "accepted"
    property_id: str
    check_in: date
    check_out: date
