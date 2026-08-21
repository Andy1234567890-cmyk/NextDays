"""Antwort- und Anfrage-Schemas der v1.

Die Feldnamen hier sind ein VERSPRECHEN: sie stehen in der veröffentlichten
OpenAPI-Datei, und ein Client verlässt sich darauf. Deshalb heißen sie nicht
zwangsläufig wie die Datenbankspalten — die Datenbank darf sich weiterentwickeln,
das Schema nicht. Übersetzt wird an genau einer Stelle (den `aus_zeile`-Bauern
in den Endpunkt-Modulen), damit eine umbenannte Spalte einen Testfehler und
nicht eine geänderte öffentliche API erzeugt.

Drei Festlegungen, die für alle Modelle gelten:

* **Währung wird nie erfunden.** Jeder Betrag trägt seinen `currency`-Code aus
  den Daten. Fehlt er, schlägt der Aufruf fehl (422) — kein `"EUR"` als
  Ersatzwert, denn wir bedienen 27 EU-Länder plus Drittstaaten (Wurzel 4).
* **Fremde Zeitpunkte kommen aus der Quelle.** `booked_at` ist der Zeitpunkt,
  zu dem der GAST gebucht hat; er kann `null` sein, wenn das Portal ihn nicht
  liefert. `received_at` ist der Eingang bei uns. Die beiden werden NIE
  vermischt: unsere Uhr ist nicht der Zeitpunkt einer fremden Handlung
  (Wurzel 5b).
* **Verfügbarkeit ist eine Zahl.** `units_available` sind freie EINHEITEN, nicht
  ein Ja/Nein. Ein Objekt ist ein Einheiten-Typ mit n ≥ 1 Einheiten.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class TokenAnfrage(BaseModel):
    """Client-Credentials-Tausch."""

    grant_type: Literal["client_credentials"] = "client_credentials"
    client_id: str = Field(min_length=8, examples=["mnd_live_id_4f2c1a9b8e7d6c5b4a39"])
    client_secret: str = Field(min_length=8, examples=["mnd_live_xxxxxxxxxxxxxxxxxxxx"])


class TokenAntwort(BaseModel):
    access_token: str
    token_type: str = "Bearer"  # noqa: S105 — OAuth-Token-Typ, kein Secret
    expires_in: int = Field(description="Restgültigkeit in Sekunden.")
    scope: str = Field(description="Gewährte Scopes, durch Leerzeichen getrennt.")


class Selbstauskunft(BaseModel):
    """Was dieser Zugang darf — der erste Aufruf jeder Integration.

    Ohne diesen Endpunkt muss ein Entwickler durch Ausprobieren herausfinden,
    welche Scopes und Objekte sein Zugang hat, und liest dabei eine Reihe von
    403ern.
    """

    tenant_id: str
    client_id: str
    is_test: bool = Field(
        description=(
            "Test-Zugang. Test- und Live-Zugänge sind getrennte Welten; ein "
            "Test-Zugang sieht die Daten des Betriebs, ist aber als solcher "
            "gekennzeichnet."
        )
    )
    scopes: list[str]
    property_ids: list[str] = Field(
        description=(
            "Objekt-Beschränkung. Leere Liste = alle Objekte des Betriebs sind "
            "erlaubt."
        )
    )


# ---------------------------------------------------------------------------
# Objekte
# ---------------------------------------------------------------------------
class Einheit(BaseModel):
    """Eine verkaufbare Einheit unter einem Objekt."""

    id: str
    name: str
    position: int


class Objekt(BaseModel):
    """Ein Objekt = genau EIN Einheiten-Typ (Zimmertyp oder Ferienobjekt)."""

    id: str
    title: str
    status: Literal["draft", "active", "inactive"] = Field(
        description=(
            "Nur `active` ist verkäuflich. `draft` ist unfertig, `inactive` aus "
            "dem Verkauf genommen."
        )
    )
    currency: str = Field(description="Währungscode (ISO 4217) dieses Objekts.")
    timezone: str | None = Field(
        default=None,
        description=(
            "Zeitzone des Objekts (IANA). Kalendertage beziehen sich darauf."
        ),
    )
    max_guests: int
    units_total: int = Field(
        description="Zahl der Einheiten dieses Typs (mindestens 1)."
    )
    property_type: str | None = None
    category_slug: str | None = None
    subtype_slug: str | None = None
    listing_type: str | None = Field(
        default=None,
        description="entire_place | private_room | shared_room.",
    )
    address: dict[str, Any] = Field(
        description="Adresse in Einzelfeldern (street, house_number, postal_code, city, country)."
    )
    lat: float | None = None
    lng: float | None = None
    amenities: list[str] = Field(default_factory=list)
    photos: list[str] = Field(default_factory=list)
    building_id: str | None = Field(
        default=None,
        description=(
            "Gebäude, unter dem dieses Objekt bei den Portalen geführt wird. "
            "Mehrere Objekte desselben Gebäudes teilen dort eine Kennung."
        ),
    )
    channels: dict[str, bool] = Field(
        description=(
            "Kanal-Sichtbarkeit, je Kanal einzeln: `marketplace` (myBestDays), "
            "`website` (eigene Seite). Es gibt kein globales „veröffentlicht"
            "-Flag."
        )
    )
    created_at: datetime
    updated_at: datetime


class ObjektAenderung(BaseModel):
    """Änderbare Felder eines Objekts.

    Bewusst klein gehalten: was den Verkauf steuert (Status, Kanäle, Preise,
    Verfügbarkeit) hat eigene Endpunkte mit eigenen Scopes. Ein Sammel-PATCH,
    der alles kann, macht jede Rechteprüfung stumpf.
    """

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=20000)
    max_guests: int | None = Field(default=None, ge=1, le=100)
    amenities: list[str] | None = None


# ---------------------------------------------------------------------------
# Verfügbarkeit
# ---------------------------------------------------------------------------
class VerfuegbarkeitsSpanne(BaseModel):
    """Zusammenhängender Zeitraum gleicher freier Stückzahl.

    Spannen statt einer Zeile je Tag: ein Jahr Kalender sind so typischerweise
    ein Dutzend Zeilen statt 365. Genau diese Form braucht auch der Push an die
    Portale (ein Aufruf je Wert, nicht je Tag).
    """

    from_: date = Field(alias="from")
    to: date
    units_available: int = Field(
        description="Freie Einheiten in diesem Zeitraum. 0 = nicht verkäuflich."
    )

    model_config = {"populate_by_name": True}


class VerfuegbarkeitsTag(BaseModel):
    """Ein einzelner Tag mit allen Angaben, die ihn unverkäuflich machen können."""

    date: date
    units_available: int
    units_total: int
    stop_sell: bool = Field(
        description="Objektweiter Verkaufsstopp — sperrt über ALLE Kanäle."
    )
    closed_to_arrival: bool = Field(description="Anreise an diesem Tag gesperrt.")
    closed_to_departure: bool = Field(description="Abreise an diesem Tag gesperrt.")
    min_stay: int | None = Field(
        default=None, description="Mindestaufenthalt ab diesem Tag, falls gesetzt."
    )


class SperrAnfrage(BaseModel):
    """Nächte sperren oder freigeben.

    `action`:
      * `block` — Nächte sperren (Wartung, Eigennutzung). Wirkt auf ALLE Kanäle.
      * `open` — Sperre aufheben. Gebuchte Nächte bleiben unberührt; eine
        Buchung wird über diesen Endpunkt NICHT storniert.
      * `stop_sell` — objektweiter Verkaufsstopp. Sperrt überall, lässt aber
        bestehende Buchungen und den Kalender unverändert.
      * `resume_sell` — Verkaufsstopp aufheben.
    """

    property_id: str
    from_: date = Field(alias="from")
    to: date = Field(
        description="Letzte betroffene NACHT (einschließlich), nicht der Abreisetag."
    )
    action: Literal["block", "open", "stop_sell", "resume_sell"]
    unit_id: str | None = Field(
        default=None,
        description=(
            "Nur für `block`/`open`: eine bestimmte Einheit. Ohne Angabe gilt "
            "die Aktion für ALLE Einheiten des Objekts."
        ),
    )
    note: str | None = Field(
        default=None,
        max_length=500,
        description="Grund, erscheint im Kalender des Betriebs.",
    )

    model_config = {"populate_by_name": True}


class SperrErgebnis(BaseModel):
    property_id: str
    from_: date = Field(alias="from")
    to: date
    action: str
    nights_changed: int = Field(
        description=(
            "Wie viele Nacht-/Einheit-Kombinationen sich geändert haben. 0 heißt: "
            "der gewünschte Zustand galt bereits."
        )
    )
    nights_skipped: int = Field(
        description=(
            "Nächte, die nicht geändert wurden, weil sie gebucht sind. Eine "
            "Buchung wird hier nie überschrieben."
        )
    )

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Preise
# ---------------------------------------------------------------------------
class TagesPreis(BaseModel):
    date: date
    price: Decimal | None = Field(
        description=(
            "Gesetzter Tagespreis für diesen Tag. `null` heißt: für diesen Tag "
            "ist kein eigener Preis gesetzt, es gilt der Grundpreis des "
            "Rate-Plans."
        )
    )
    currency: str
    min_stay: int | None = None
    closed_to_arrival: bool = False
    closed_to_departure: bool = False
    max_stay: int | None = None


class RatePlan(BaseModel):
    """Ein Rate-Plan (Preisplan) eines Objekts.

    Preise hängen am Rate-Plan, nicht am Objekt — so verlangen es die Portale
    (ein Zimmertyp trägt mehrere Pläne: „Frühstück inklusive", „nicht
    erstattbar"). Bei einem Ferienobjekt gibt es im Normalfall genau einen.
    """

    id: str
    property_id: str
    name: str
    base_price: Decimal
    currency: str
    min_stay: int
    rate_mode: str | None = Field(
        default=None,
        description="`standard` oder `derived` (Preis aus einem anderen Plan abgeleitet).",
    )
    derived_from_rate_plan_id: str | None = None
    offset_amount: Decimal | None = None
    offset_percent: Decimal | None = None
    send_to_portals: bool


class PreisSetzen(BaseModel):
    """Tagespreise und/oder Aufenthaltsregeln für einen Zeitraum setzen.

    Alle Angaben sind optional; gesetzt wird nur, was mitgeschickt wurde. Ein
    Feld weglassen heißt „unverändert lassen" — nicht „zurücksetzen". Zum
    Zurücksetzen dient `price: null`.
    """

    rate_plan_id: str
    from_: date = Field(alias="from")
    to: date
    price: Decimal | None = Field(
        default=None, ge=0, description="Tagespreis. `null` löscht den Tagespreis."
    )
    min_stay: int | None = Field(default=None, ge=1, le=365)
    max_stay: int | None = Field(default=None, ge=1, le=365)
    closed_to_arrival: bool | None = None
    closed_to_departure: bool | None = None
    weekdays: list[int] | None = Field(
        default=None,
        description=(
            "Nur diese Wochentage im Zeitraum ändern (1 = Montag … 7 = Sonntag). "
            "Ohne Angabe: alle Tage."
        ),
    )

    model_config = {"populate_by_name": True}

    @field_validator("weekdays")
    @classmethod
    def _wochentage(cls, v: list[int] | None) -> list[int] | None:
        if v is None:
            return None
        if not v or any(t < 1 or t > 7 for t in v):
            raise ValueError("weekdays müssen zwischen 1 (Montag) und 7 (Sonntag) liegen")
        return sorted(set(v))


class PreisErgebnis(BaseModel):
    rate_plan_id: str
    from_: date = Field(alias="from")
    to: date
    days_changed: int

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Buchungen
# ---------------------------------------------------------------------------
class Betrag(BaseModel):
    """Ein Betrag mit seiner Währung. Nie eine Zahl ohne Währung."""

    amount: Decimal
    currency: str


class Gast(BaseModel):
    id: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    language: str | None = None
    country: str | None = None


class Buchung(BaseModel):
    id: str
    property_id: str
    unit_id: str | None = Field(
        default=None,
        description=(
            "Belegte Einheit. `null` bei Altbestand ohne Zuweisung oder wenn die "
            "Einheit gelöscht wurde."
        ),
    )
    rate_plan_id: str | None = None
    status: Literal[
        "pending", "confirmed", "cancelled", "completed", "requested", "declined", "expired"
    ]
    channel: str = Field(
        description=(
            "Buchungskanal: `direct` (Betrieb selbst, auch über diese API), "
            "`portal` (myBestDays-Marktplatz), `website` (eigene Seite), "
            "`booking`, `airbnb`, `vrbo`, `ota_other`."
        )
    )
    ota_name: str | None = Field(
        default=None, description="Name des Portals, wenn die Buchung von dort kommt."
    )
    check_in: date
    check_out: date
    nights: int
    guests: dict[str, int] = Field(
        description="Aufschlüsselung: adults, children, infants, pets."
    )
    total: Betrag
    paid: Betrag
    payment_status: str | None = None
    booked_at: datetime | None = Field(
        default=None,
        description=(
            "Wann der GAST gebucht hat — aus der Quelle des Portals. `null`, "
            "wenn das Portal den Zeitpunkt nicht liefert. Dann ist `received_at` "
            "das Einzige, was wir wissen; verwende NICHT `received_at` als "
            "Buchungszeitpunkt."
        ),
    )
    received_at: datetime = Field(
        description="Wann die Buchung bei uns eingegangen ist (unsere Uhr)."
    )
    updated_at: datetime
    cancelled_at: datetime | None = None
    cancelled_by_party: str | None = Field(
        default=None, description="Wer storniert hat: guest | host | ota | system."
    )
    guest: Gast
    external_ref: str | None = Field(
        default=None, description="Buchungsnummer beim Portal."
    )
    note: str | None = None


class BuchungAnlegen(BaseModel):
    """Neue Buchung.

    Die Nächte werden im selben Schritt im Kalender belegt — atomar, mit Sperre
    auf dem Objekt. Ist der Zeitraum inzwischen weg, kommt ein 409 und es
    entsteht KEINE halbe Buchung.

    `Idempotency-Key` ist bei diesem Aufruf Pflicht: eine wiederholte Anfrage
    ohne Schlüssel würde eine zweite Buchung erzeugen und fremde Nächte sperren.
    """

    property_id: str
    check_in: date
    check_out: date = Field(description="Abreisetag (die Nacht davor ist die letzte).")
    unit_id: str | None = Field(
        default=None,
        description=(
            "Bestimmte Einheit belegen. Ohne Angabe wählt das System die erste "
            "freie."
        ),
    )
    rate_plan_id: str | None = None
    status: Literal["pending", "confirmed"] = Field(
        default="confirmed",
        description=(
            "`confirmed` belegt den Kalender verbindlich, `pending` ebenfalls — "
            "eine Buchung sperrt in beiden Fällen die Nächte. Der Unterschied "
            "liegt in der Zahlungserwartung."
        ),
    )
    channel: Literal["direct", "website", "ota_other"] = Field(
        default="direct",
        description=(
            "Wie die Buchung zustande kam. Standard `direct`: eine über diese "
            "API eingetragene Buchung gilt als Direktbuchung des Betriebs. "
            "`ota_other` für den Import aus einem Fremdsystem. Die Kanäle der "
            "angebundenen Portale (booking, airbnb, vrbo, portal) sind hier "
            "NICHT wählbar — sie entstehen ausschließlich aus dem echten "
            "Portal-Eingang, sonst wären Kanal-Auswertungen wertlos."
        ),
    )
    total_amount: Decimal = Field(ge=0)
    currency: str = Field(
        min_length=3,
        max_length=3,
        description=(
            "Währung des Betrags (ISO 4217). MUSS zur Währung des Objekts "
            "passen; sonst 422. Es gibt keinen Standardwert."
        ),
    )
    adults: int = Field(default=1, ge=1, le=50)
    children: int = Field(default=0, ge=0, le=50)
    infants: int = Field(default=0, ge=0, le=50)
    pets: int = Field(default=0, ge=0, le=20)
    guest: Gast | None = Field(
        default=None,
        description=(
            "Gastdaten. Ohne `id` wird ein Gast angelegt bzw. über die "
            "E-Mail-Adresse wiedererkannt."
        ),
    )
    booked_at: datetime | None = Field(
        default=None,
        description=(
            "Nur beim Import aus einem Fremdsystem: der ECHTE Zeitpunkt, zu dem "
            "der Gast dort gebucht hat. Ohne Angabe bleibt das Feld leer — es "
            "wird NICHT mit der aktuellen Zeit gefüllt, denn unsere Uhr ist "
            "nicht der Zeitpunkt einer fremden Handlung."
        ),
    )
    note: str | None = Field(default=None, max_length=2000)
    external_ref: str | None = Field(
        default=None,
        max_length=120,
        description="Eigene Buchungsnummer, damit du die Buchung wiederfindest.",
    )


# ---------------------------------------------------------------------------
# Aufgaben
# ---------------------------------------------------------------------------
class Aufgabe(BaseModel):
    id: str
    property_id: str | None = None
    reservation_id: str | None = None
    title: str
    description: str | None = None
    status: Literal["open", "accepted", "in_progress", "done", "cancelled"]
    priority: int | None = None
    assignee_id: str | None = None
    due_at: datetime | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class AufgabeAnlegen(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    property_id: str | None = None
    reservation_id: str | None = None
    description: str | None = Field(default=None, max_length=5000)
    assignee_id: str | None = None
    due_at: datetime | None = None
    priority: int | None = Field(default=None, ge=0, le=9)


class AufgabeAendern(BaseModel):
    status: Literal["open", "accepted", "in_progress", "done", "cancelled"] | None = None
    assignee_id: str | None = None
    due_at: datetime | None = None
    priority: int | None = Field(default=None, ge=0, le=9)
    description: str | None = Field(default=None, max_length=5000)


# ---------------------------------------------------------------------------
# Webhooks
# ---------------------------------------------------------------------------
# Ereignis-Katalog. Er ist die Wahrheit für die Validierung eines Abos UND für
# die Doku. Ein Ereignis, das hier nicht steht, kann nicht abonniert werden —
# ein Tippfehler im Abo führt sonst zu einem Abo, das ewig still bleibt.
EREIGNISSE: dict[str, str] = {
    "reservation.created": "Eine Buchung ist entstanden — egal über welchen Kanal.",
    "reservation.updated": "Eine bestehende Buchung hat sich geändert.",
    "reservation.cancelled": "Eine Buchung wurde storniert.",
    "availability.changed": "Der Kalender eines Objekts hat sich geändert.",
    "rate.changed": "Ein Tagespreis oder eine Aufenthaltsregel hat sich geändert.",
    "task.created": "Eine Aufgabe ist entstanden.",
    "task.completed": "Eine Aufgabe wurde abgeschlossen.",
}


class WebhookAnlegen(BaseModel):
    url: str = Field(
        description=(
            "Ziel-Adresse. Muss `https://` sein und öffentlich erreichbar. "
            "Interne Adressen (localhost, private Netze) werden abgelehnt."
        )
    )
    events: list[str] = Field(
        min_length=1, description="Zu abonnierende Ereignisse aus dem Katalog."
    )
    property_ids: list[str] | None = Field(
        default=None,
        description=(
            "Nur Ereignisse dieser Objekte senden. Ohne Angabe: alle Objekte, "
            "auf die der Zugang Zugriff hat."
        ),
    )

    @field_validator("events")
    @classmethod
    def _bekannt(cls, v: list[str]) -> list[str]:
        unbekannt = sorted({e for e in v if e not in EREIGNISSE})
        if unbekannt:
            raise ValueError(
                "Unbekannte Ereignisse: " + ", ".join(unbekannt)
                + ". Erlaubt: " + ", ".join(sorted(EREIGNISSE))
            )
        return sorted(set(v))


class Webhook(BaseModel):
    id: str
    url: str
    events: list[str]
    property_ids: list[str]
    active: bool
    created_at: datetime
    last_success_at: datetime | None = None
    last_error: str | None = None
    failure_count: int = 0


class WebhookAngelegt(Webhook):
    """Antwort NUR beim Anlegen: enthält das Signier-Secret EINMALIG.

    Danach ist es nicht mehr abrufbar — wie bei Lodgify, und aus demselben
    Grund: ein Secret, das man jederzeit auslesen kann, ist keines. Wer es
    verliert, legt ein neues Abo an.
    """

    secret: str = Field(
        description=(
            "Signier-Secret für die Prüfung des Headers `MyNextDays-Signature`. "
            "Jetzt speichern — es wird nie wieder ausgeliefert."
        )
    )
