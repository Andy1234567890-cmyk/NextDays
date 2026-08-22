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


# ---------------------------------------------------------------------------
# Umschläge
# ---------------------------------------------------------------------------
class Blaetterinfo(BaseModel):
    """Der `pagination`-Block, der bei JEDER Liste gleich aussieht."""

    limit: int
    offset: int
    has_more: bool = Field(
        description="Es gibt eine weitere Seite. Dann steht `next_starting_after` dabei."
    )
    next_starting_after: str | None = Field(
        default=None,
        description=(
            "Cursor für die nächste Seite — unverändert als `starting_after` "
            "mitschicken. Fehlt das Feld, ist der Durchgang fertig."
        ),
    )
    total: int | None = Field(
        default=None,
        description="Gesamtzahl der Treffer. Nur vorhanden, wenn `include_total=true`.",
    )


class Seite[T](BaseModel):
    """Umschlag jeder Liste: `data` plus `pagination`.

    Ein Umschlag, der je Endpunkt anders heißt, zwingt jeden Client zu
    Sonderfällen — deshalb ist er hier ein Typ und keine handgebaute `dict`
    je Endpunkt. Er ist ausdrücklich Teil der veröffentlichten Spezifikation:
    ohne ihn steht in der OpenAPI-Datei ein leeres Objekt, und die Doku kann
    kein Antwortbeispiel zeigen.
    """

    data: list[T]
    pagination: Blaetterinfo


class GastProfil(Gast):
    """Gast als eigener Datensatz — mehr als der Gast AN einer Buchung.

    Erbt von `Gast`, damit ein Client, der beides liest, nicht zwei
    unterschiedliche Formen derselben Person auseinanderhalten muss.
    """

    company: str | None = None
    segment: str | None = None
    stays_count: int | None = Field(
        default=None, description="Zahl der abgeschlossenen Aufenthalte."
    )
    last_stay_at: date | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class VerfuegbarkeitsAntwort(BaseModel):
    """Verfügbarkeit als Spannen ODER als Tage — je nach `granularity`."""

    property_id: str
    granularity: Literal["spans", "days"]
    data: list[VerfuegbarkeitsSpanne] | list[VerfuegbarkeitsTag]


class PreisAntwort(BaseModel):
    """Tagespreise eines Rate-Plans samt seines Grundpreises."""

    rate_plan_id: str
    property_id: str
    currency: str
    base_price: str = Field(
        description="Grundpreis des Rate-Plans als Dezimalzeichenkette."
    )
    data: list[TagesPreis]


class EreignisTyp(BaseModel):
    """Ein abonnierbares Ereignis aus dem Katalog."""

    event: str
    description: str


class Ereignis(BaseModel):
    """Ein aufgetretenes Ereignis — dieselbe Nutzlast wie im Webhook.

    Der Abruf ist der Weg zurück, wenn der eigene Empfänger eine Weile weg war:
    identische Form, damit dieselbe Verarbeitung beide Wege bedient.
    """

    id: str
    event: str
    created_at: datetime
    property_id: str | None = None
    data: dict[str, Any]


# ---------------------------------------------------------------------------
# Global (Normdaten)
# ---------------------------------------------------------------------------
class LandAntwort(BaseModel):
    """Ein Land, wie die API es ausliefert."""

    code: str = Field(description="ISO-3166-1 alpha-2, immer zwei Großbuchstaben.")
    name: str = Field(description="Englischer Name des Landes.")
    currency: str = Field(
        description=(
            "Landeswährung nach ISO 4217. Sie ist der Vorschlag für ein neues "
            "Objekt in diesem Land — nicht mehr: die Währung eines Objekts "
            "steht am Objekt."
        )
    )


class WaehrungAntwort(BaseModel):
    """Eine Währung samt der Stellenzahl, mit der Beträge zu lesen sind."""

    code: str = Field(description="ISO 4217, immer drei Großbuchstaben.")
    name: str = Field(description="Englischer Name der Währung.")
    decimal_digits: int = Field(
        description=(
            "Nachkommastellen nach ISO 4217. Beträge dieser API sind "
            "Dezimalzahlen, keine kleinsten Einheiten — diese Angabe ist für "
            "die Anzeige und das Runden gedacht."
        )
    )


# ---------------------------------------------------------------------------
# Objekt-Beiwerk: Zusatzleistungen, Konditionen, Kanäle, Zugangsdaten
# ---------------------------------------------------------------------------
class Zusatzleistung(BaseModel):
    """Eine buchbare Zusatzleistung eines Objekts.

    `basis` sagt, WORAUF sich der Preis bezieht — ohne diese Angabe ist ein
    Betrag nicht rechenbar: 15 kann „pro Aufenthalt" oder „pro Nacht und Gast"
    heißen.
    """

    id: str
    name: dict[str, str] = Field(
        description=(
            "Bezeichnung je Sprache (ISO 639-1 → Text). Ein leerer Wert heißt "
            "\u201enicht \u00fcbersetzt\u201c, nicht \u201eohne Namen\u201c "
            "\u2014 wir geben keine Sprache als eine andere aus."
        )
    )
    description: dict[str, str] | None = None
    price: Decimal
    currency: str = Field(description="Währung des Objekts (ISO 4217).")
    basis: str = Field(
        description=(
            "Bezugsgröße des Preises, z. B. `per_stay`, `per_night`, "
            "`per_guest_stay`, `per_guest_night`, `per_pet_stay`."
        )
    )
    mandatory: bool = Field(
        description="Pflichtleistung — wird bei jeder Buchung berechnet."
    )
    tax_rate: Decimal | None = Field(
        default=None, description="Eigener USt-Satz in Prozent, falls abweichend."
    )


class StornoStaffel(BaseModel):
    """Eine Stufe der Stornostaffel: bis `days_before` Tage vor Anreise."""

    days_before: int
    refund_percent: Decimal


class Konditionen(BaseModel):
    """Zahlungsplan und Stornoregel, die für dieses Objekt gelten.

    Zugeordnet wird sie über den RATE-PLAN, nicht über das Objekt: beim Hotel
    kosten BAR und „nicht erstattbar" verschieden und haben verschiedene
    Storno-Zusagen. Ohne `rate_plan_id` antwortet der Endpunkt mit der
    Standard-Kondition des Betriebs.

    Ist keine gepflegt, kommt `null` in allen Feldern — dann gilt „vollständig
    bei Buchung" und es gibt KEINE Stornozusage. Eine erfundene Staffel wäre
    eine Zusage, die niemand eingelöst hat (Wurzel 4).
    """

    rate_plan_id: str | None = None
    name: str | None = None
    installments: int | None = Field(
        default=None, description="Zahl der Teilzahlungen (1 = alles auf einmal)."
    )
    first_payment_percent: Decimal | None = None
    first_payment_timing: str | None = Field(
        default=None, description="Wann die erste Zahlung fällig ist."
    )
    balance_days_before_arrival: int | None = None
    deposit_required: bool = False
    deposit_method: str | None = None
    cancellation_mode: str | None = Field(
        default=None, description="Art der Stornoregel."
    )
    refund_rules: list[StornoStaffel] = []


class KanalZuordnung(BaseModel):
    """Wie dieses Objekt an die Portale angebunden ist.

    `sync_enabled` allein heißt nicht „verkauft sich": dazu gehören der
    Objekt-Status, die Kanal-Sichtbarkeit und freie Einheiten. Was hier steht,
    ist die technische Verbindung.
    """

    channel: str = Field(
        description=(
            "Der Kanal. `portale` steht für die Anbindung über den "
            "Kanal-Aggregator (Booking, Airbnb, Expedia & Co.), `marktplatz` "
            "für den myBestDays-Marktplatz, `website` für die eigene Seite."
        )
    )
    enabled: bool
    external_id: str | None = Field(
        default=None, description="Kennung des Objekts beim Kanal, falls vorhanden."
    )
    last_sync_at: datetime | None = None
    last_sync_status: str | None = None
    last_sync_error: str | None = None


class Zugangsdaten(BaseModel):
    """Türcode und WLAN eines Objekts — die Angaben für die Anreise.

    Sie stehen am OBJEKT, nicht an der Buchung: bei uns hat ein Objekt einen
    Code, den der Gast zur passenden Zeit sieht. Wer je Buchung einen eigenen
    Code braucht, findet das hier NICHT — eine erfundene Zuordnung wäre
    schlimmer als eine fehlende.
    """

    property_id: str
    self_checkin: bool
    door_code: str | None = None
    wifi_ssid: str | None = None
    wifi_password: str | None = None
    show_code_only_if_paid: bool = Field(
        description="Code erst zeigen, wenn die Zahlung eingegangen ist."
    )
    hide_code_until_checkin: bool = Field(
        description="Code erst am Anreisetag zeigen."
    )
    code_visible_from: datetime | None = None


class ZugangsdatenSetzen(BaseModel):
    """Türcode und WLAN setzen. Nur mitgeschickte Felder werden geändert."""

    door_code: str | None = Field(default=None, max_length=100)
    wifi_ssid: str | None = Field(default=None, max_length=100)
    wifi_password: str | None = Field(default=None, max_length=200)
    self_checkin: bool | None = None
    show_code_only_if_paid: bool | None = None
    hide_code_until_checkin: bool | None = None


class PortalRohdaten(BaseModel):
    """Was das Portal zu dieser Buchung geliefert hat — unverändert.

    Für den Fall, dass ein Feld gebraucht wird, das diese API nicht abbildet.
    Der Inhalt ist NICHT stabil: er ist das, was das Portal schickt, und ändert
    sich, wenn das Portal sich ändert. Wer darauf baut, baut auf fremdem Grund.
    """

    reservation_id: str
    channel: str
    ota_name: str | None = None
    external_ref: str | None = Field(
        default=None, description="Buchungsnummer beim Portal."
    )
    booked_at: datetime | None = Field(
        default=None, description="Wann der Gast beim Portal gebucht hat."
    )
    received_at: datetime | None = Field(
        default=None, description="Wann die Buchung bei uns eingegangen ist."
    )
    payment_collect: str | None = Field(
        default=None, description="Wer das Geld einzieht: Portal oder Betrieb."
    )
    commission: Decimal | None = Field(
        default=None, description="Provision des Portals, wie es sie meldet."
    )
    withheld_taxes: Decimal | None = Field(
        default=None, description="Abgaben, die das Portal einbehält."
    )
    notes: str | None = None
    details: dict[str, Any] | None = Field(
        default=None, description="Die Rohdaten des Portals."
    )
