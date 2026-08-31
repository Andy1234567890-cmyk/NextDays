"""Pydantic-Schemas für den channel_manager-Slice (Channex-Integration)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
    # Ob der Channel-Manager einsatzbereit ist (Provider-Key gesetzt). NEUTRALER
    # Feldname — der Provider darf nie im Frontend/Network-Tab auftauchen.
    channel_manager_ready: bool = False


# --- Property-Mapping --------------------------------------------------------
class PropertyMapResponse(BaseModel):
    id: str
    property_id: str
    property_title: str | None = None
    # channex_property_id ist eine INTERNE Provider-ID — bewusst NICHT im
    # Response, damit sie nie im Frontend/Netzwerk-Tab beim Kunden auftaucht.
    sync_enabled: bool
    last_sync_at: datetime | None = None
    last_sync_status: str | None = None
    last_sync_error: str | None = None


class PropertyConnectRequest(BaseModel):
    """Lokales Objekt mit dem Channel-Manager verbinden.

    Entweder ein bestehendes Provider-Objekt anbinden (`external_property_ref`
    gesetzt) oder neu anlegen (leer → wir erzeugen es). Der Feldname ist neutral
    — KEIN Provider-Bezug, der dem Kunden im Request/Network-Tab auffällt.
    """

    property_id: str
    external_property_ref: str | None = None
    # Felder zum Anlegen (nur nötig, wenn neu erzeugt wird):
    title: str | None = Field(default=None, max_length=255)
    currency: str | None = Field(default=None, min_length=3, max_length=3)


class PropertyMapListResponse(BaseModel):
    items: list[PropertyMapResponse]
    total: int


# --- ARI-Push ----------------------------------------------------------------
class AvailabilityUpdate(BaseModel):
    room_type_map_id: str
    date_from: date
    date_to: date
    availability: int = Field(ge=0)


class RateUpdate(BaseModel):
    rate_plan_map_id: str
    date_from: date
    date_to: date
    # Preis in Cent (eindeutig). min_stay/stop_sell optional.
    rate_cents: int | None = Field(default=None, ge=0)
    min_stay_arrival: int | None = Field(default=None, ge=1)
    stop_sell: bool | None = None


class AriPushRequest(BaseModel):
    """Gebündelter ARI-Push (Best-Practice: batchen, nicht einzeln)."""

    availability: list[AvailabilityUpdate] = Field(default_factory=list)
    rates: list[RateUpdate] = Field(default_factory=list)


class AriPushResponse(BaseModel):
    availability_tasks: int = 0
    rate_tasks: int = 0
    warnings: list[str] = Field(default_factory=list)


# --- Bookings ----------------------------------------------------------------
class BookingResponse(BaseModel):
    id: str
    # neutraler Feldname (kein Provider-Name im JSON, das der Kunde sieht)
    external_id: str
    ota_name: str | None = None
    ota_reservation_code: str | None = None
    status: str
    arrival_date: date | None = None
    departure_date: date | None = None
    amount_cents: int | None = None
    currency: str | None = None
    customer: dict = Field(default_factory=dict)
    acknowledged_at: datetime | None = None


class BookingListResponse(BaseModel):
    items: list[BookingResponse]
    total: int


class BookingSyncResponse(BaseModel):
    """Ergebnis eines Feed-Pulls: wie viele Revisionen verarbeitet/ge-ackt."""

    fetched: int = 0
    saved: int = 0
    acknowledged: int = 0
    # Revisionen FREMDER Tenants, die wir bewusst übersprungen haben (Mandanten-
    # trennung). Müssen >0 sein können, ohne dass etwas durchsickert.
    skipped: int = 0
    errors: list[str] = Field(default_factory=list)


class CsvBookingImportResponse(BaseModel):
    """Ergebnis eines CSV-Bestandsimports (Alt-/Direkt-/vergangene Buchungen).

    ``imported`` = NEU angelegte Reservierungen, ``updated`` = schon vorhandene,
    die aktualisiert wurden, ``skipped`` = Zeilen ohne Wirkung, ``failed`` =
    Fehlerzeilen mit Meldung (1-basiert, inkl. Kopfzeile).

    ``imported`` und ``updated`` waren bis zum 31.08.2026 EIN Zaehler. Nach dem
    zweiten Upload derselben Datei stand deshalb „251 angelegt, 0 vorhanden" —
    die Zahl, die belegen soll, dass nichts doppelt entsteht, behauptete das
    Gegenteil (die DB war korrekt: 259 Zeilen, 259 verschiedene IDs)."""

    total_rows: int = 0
    imported: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    errors: list[str] = Field(default_factory=list)


class BestandsimportLauf(BaseModel):
    """Stand eines serverseitigen Datei-Bestandsimports (`bestandsimport_lauf`).

    Die Oberflaeche zeichnet daraus den Fortschrittsbalken. Sie liest die Zeile
    zusaetzlich per Realtime — dieses Schema ist der Erstabruf beim Seitenaufruf
    und die Antwort auf den Start.
    """

    id: str
    status: str
    quelle: str | None = None
    zeilen_gesamt: int = 0
    zeilen_fertig: int = 0
    angelegt: int = 0
    # Getrennt von `angelegt`: nur so zeigt ein zweiter Upload „0 neu, 251
    # aktualisiert" statt faelschlich „251 angelegt".
    aktualisiert: int = 0
    uebersprungen: int = 0
    fehlerhaft: int = 0
    aktuelle_zeile: str | None = None
    # Zeilen, die nicht durchliefen — mit Grund, damit der Betrieb weiss, WAS er
    # in der Datei nachbessern soll (Wurzel 5: kein stilles Ueberspringen).
    gescheitert: list[dict[str, Any]] = Field(default_factory=list)
    fehler: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    beendet_at: str | None = None


class LodgifyBookingPreview(BaseModel):
    """Eine Buchung aus der Lodgify-Vorschau (nur Anzeige, nichts geschrieben)."""

    external_id: str
    guest_name: str
    arrival: str
    departure: str
    total: float | None = None
    currency: str | None = None
    source: str | None = None
    status: str
    # importable=False → wird beim echten Import übersprungen (Anfrage/Storno).
    importable: bool = True


class LodgifyPreviewResponse(BaseModel):
    """Vorschau des Lodgify-Imports: was ankommt, bevor geschrieben wird."""

    total: int = 0
    importable: int = 0
    items: list[LodgifyBookingPreview] = Field(default_factory=list)


class LodgifyImportRequest(BaseModel):
    """Anfrage für Vorschau/Import aus Lodgify. Der API-Key ist der EIGENE Key
    des Kunden (nur lesend); er wird NICHT persistent gespeichert."""

    api_key: str
    include_past: bool = False


# --- Kanäle (OTA-Verbindungen, inhouse) -------------------------------------
class PortalFieldRule(BaseModel):
    """Sichtbarkeitsregel eines Portalfelds, 1:1 aus dem Kanal-Katalog.

    Lesart (live gegen den Katalog geprüft): `apply` ("hidden") greift, sobald
    das Feld `influence_field` den Wert `when` hat — z.B. E-Mail nur zeigen,
    wenn `send_email_notifications` NICHT false ist."""

    apply: str
    when: Any = None
    influence_field: str


class PortalField(BaseModel):
    """Ein Eingabefeld für die Verbinden-Maske eines Portals.

    Abgeleitet aus `params` des Kanal-Katalogs — NICHT geraten. `type` ist der
    Render-Hinweis fürs Frontend, `default`/`options` kommen aus dem Katalog."""

    key: str
    label: str
    placeholder: str = ""
    required: bool = True
    # Render-Hinweis: text | email | password | checkbox | select | switch | number
    type: str = "text"
    # Vorbelegung aus dem Katalog (Zahl/Bool/Text) bzw. vorbefüllte Betriebs-
    # E-Mail; None = leer lassen (nie ein erfundener Ersatzwert).
    default: Any = None
    # Auswahlwerte bei select/switch (aus dem Katalog).
    options: list[str] = Field(default_factory=list)
    # Optionales Feld mit Katalog-Default → im eingeklappten Bereich
    # „Erweiterte Einstellungen" (entspricht Advanced Settings der Referenz).
    advanced: bool = False
    # Bedingte Sichtbarkeit; das Frontend wertet sie live aus.
    rules: list[PortalFieldRule] = Field(default_factory=list)


class SupportedPortal(BaseModel):
    """Ein unterstütztes Buchungsportal + die Felder für die eigene Maske.
    `code` ist intern (Provider-Channel-Code), wird dem Kunden nicht erklärt."""

    code: str
    label: str
    icon: str
    fields: list[PortalField] = Field(default_factory=list)
    # "credential" = Hotel-ID/Zugangsdaten eingeben; "oauth" = Verbindung über
    # OAuth-URL (Airbnb, kein eingebbares Credential).
    connection_type: str = "credential"
    # Kuratierte Vorab-Anleitung (was zuerst im OTA-Extranet zu tun ist), oder
    # None, wenn wir für diesen Kanal keinen belegten Prozess kennen.
    setup_hint: str | None = None
    # Zuordnungsart des Kanals (Katalog): room_rate_multioccupancy | listing |
    # direct | tree | None. Steuert, ob und wie die UI zuordnen lässt.
    mapping_mode: str | None = None
    # Braucht dieser Kanal überhaupt eine Zuordnung? (Mietwagen & Co. nicht.)
    mapping_required: bool = True
    # Bezugswährung des Mindestpreises (Katalog `channel_restrictions`) — KEINE
    # Pflichtwährung des Kanals (live belegt: Booking.com nimmt auch GBP/USD).
    min_price_currency: str | None = None
    # Kleinster vom Kanal akzeptierter Preis in Minor Units (z.B. 500 = 5,00).
    min_price: int | None = None


class ChannelResponse(BaseModel):
    """Ein verbundener Kanal (white-label: kein Provider-Name im Feldnamen)."""

    id: str
    portal: str          # menschlich, z.B. "Booking.com"
    title: str | None = None
    is_active: bool = False


class ChannelListResponse(BaseModel):
    items: list[ChannelResponse]
    total: int


class ConnectionToggleRequest(BaseModel):
    """An-/Abschalten einer OTA-Verbindung pro (Objekt × Portal)."""

    is_active: bool


class ChannelConnectionResponse(BaseModel):
    """Eine gespeicherte OTA-Verbindung eines Objekts (white-label).

    Enthält nur Portal, Hotel-ID und Status — keine rohen Credentials, kein
    Provider-Branding."""

    portal_code: str                     # interner Code (BookingCom …)
    portal: str                          # menschlich, z.B. "Booking.com"
    # Hotel-ID beim OTA (Eingabe des Vermieters) — bei OAuth-Portalen NULL.
    # Airbnb kennt keine eingebbare Kennung: die Konto-Identität steckt im Token,
    # die Objekt-Identität in der Listing-ID. Das Feld war als `str` deklariert
    # und die Antwort brach mit HTTP 500 („Input should be a valid string,
    # input_value=None"), sobald ein Airbnb-Objekt in der Liste stand — ein
    # Datenzustand, der völlig normal ist, kein Fehler.
    hotel_id: str | None = None
    # Zimmer/Einheit beim Portal: Code + Klarname. Zusammen mit der Hotel-ID die
    # Angabe, mit der im Extranet nachgesehen wird (Lodgify zeigt sie als
    # „12298950|1229895001").
    ota_room_type_code: str | None = None
    ota_room_title: str | None = None
    channel_id: str | None = None        # erzeugter Channel (None nach Trennen)
    is_active: bool = False
    # Sync-Stand des Objekts (aus channex_property_map) — gehört in dieselbe
    # Zeile wie die Verbindung.
    sync_enabled: bool = False
    last_sync_status: str | None = None
    last_sync_error: str | None = None
    last_error: str | None = None
    updated_at: str | None = None


class ChannelConnectionListResponse(BaseModel):
    items: list[ChannelConnectionResponse]
    total: int


class ChannelRatePlanRow(BaseModel):
    """Ein Tarifplan, wie er ans Portal geht: Kondition, Name/Typ, Preisänderung.

    `offset_percent`/`offset_amount` sind nur bei abgeleiteten Plänen gesetzt
    (`rate_mode='derived'`) — bei eigenen Preisen gibt es keine Änderung, und
    dort steht deshalb auch keine 0 % (die wäre eine Behauptung)."""

    id: str
    name: str | None = None
    base_price: float | None = None
    currency: str | None = None
    min_stay: int | None = None
    rate_mode: str | None = None
    offset_amount: float | None = None
    offset_percent: float | None = None
    condition: str | None = None
    # Geht dieser Plan an die Portale (0177)? Steht als Angabe an der Zeile,
    # damit ein nicht freigegebener Plan sichtbar bleibt statt zu fehlen.
    send_to_portals: bool = False
    # Grundpreis-Plan (älteste Channex-Zuordnung): geht IMMER ans Portal —
    # `send_to_portals` schaltet nur ZUSÄTZLICHE Pläne frei. Ohne dieses Flag
    # zeigte die Zeile „nicht für Portale freigegeben" am Standard-Plan,
    # obwohl genau er die Portalpreise trägt.
    is_primary: bool = False


class ChannelPropertyDetailResponse(BaseModel):
    """Portal × Objekt: Kennungen, Sync-Stand und die Tarifpläne dazu.

    Keine Qualitäts-/Score-Angabe: Channex führt keine (die API kennt „score"
    nur bei Gästebewertungen), und erfundene Kennzahlen gibt es hier nicht."""

    portal_code: str
    portal: str
    property_id: str
    property_title: str | None = None
    currency: str | None = None
    hotel_id: str | None = None
    ota_room_type_code: str | None = None
    ota_room_title: str | None = None
    channel_id: str | None = None
    is_active: bool = False
    last_error: str | None = None
    updated_at: str | None = None
    map_id: str | None = None
    sync_enabled: bool = False
    last_sync_at: str | None = None
    last_sync_status: str | None = None
    last_sync_error: str | None = None
    property_photo: str | None = None
    rate_plans: list[ChannelRatePlanRow] = Field(default_factory=list)
    # Dynamic Pricing aktiv? Dann sind die Portalpreise die dynamischen
    # Tagespreise — base_price ist nur der Anker, nicht der Verkaufspreis.
    dynamic_pricing_enabled: bool = False
    # Preisänderung dieses Portals in % (Kanal-Plan-Offset, 0272); 0 = keine.
    price_adjustment_percent: float = 0.0
    # Airbnb-Steuererhebung (0274). Nur bei Airbnb gepflegt.
    airbnb_tax_scenario: str | None = None
    airbnb_tax_acknowledged: bool = False
    airbnb_send_user_taxes: bool = False


class AirbnbTaxSettingsRequest(BaseModel):
    """Airbnb-Steuererhebung dieses Inserats.

    `scenario` beschreibt, was AIRBNB tut (nicht, was wir wollen):
    `ineligible` — Airbnb erhebt automatisch bzw. unterstützt keine
    Beherbergungssteuern, ein Export ist unmöglich; `no_collected` — Airbnb
    erhebt nichts; `stacked` — Airbnb erhebt, unsere Werte kommen obendrauf.
    `None` = noch nicht erfasst, dann gehen keine Steuern an Airbnb.
    """

    scenario: Literal["ineligible", "no_collected", "stacked"] | None = None
    acknowledged: bool = False
    send_user_taxes: bool = False


class AirbnbTaxSettingsResponse(BaseModel):
    portal_code: str
    property_id: str
    airbnb_tax_scenario: str | None = None
    airbnb_tax_acknowledged: bool = False
    airbnb_send_user_taxes: bool = False


class PortalPriceAdjustmentRequest(BaseModel):
    """Preisänderung je Portal setzen: Prozent-Aufschlag (negativ = Abschlag)
    auf die effektive Tageskurve dieses Portals. 0 entfernt den Aufschlag."""

    percent: float = Field(ge=-99, le=500)


class PortalPriceAdjustmentResponse(BaseModel):
    portal_code: str
    percent: float


class PrepareChannelRequest(BaseModel):
    """Schritt 1+2: Zugangsdaten prüfen + OTA-Zimmer/Raten holen (legt nichts an)."""

    property_id: str                     # lokale Objekt-ID
    portal_code: str                     # interner Portal-Code (BookingCom …)
    settings: dict = Field(default_factory=dict)  # z.B. {"hotel_id": "..."}
    # WELCHES Portal-Konto (0304). Bei OAuth-Portalen steckt die Identität in
    # den Tokens des KANALS, und eine Agentur führt je Portal mehrere Zugänge —
    # mit dem Token von Konto A holt man nie die Anzeigen von Konto B.
    #
    # Ohne Angabe bleibt es beim bisherigen Weg (Konto aus der Verbindungszeile
    # des Objekts). Das ist richtig, solange das Objekt schon einem Zugang
    # gehört; für ein neues Objekt gibt es diese Zeile noch nicht, und dann
    # griff der Dialog stumm zum ersten Konto.
    account_id: str | None = None


class OtaRate(BaseModel):
    id: int | str                        # OTA-Raten-Code (integer)
    title: str | None = None
    pricing: str | None = None
    max_persons: int | None = None
    occupancies: list[int] = Field(default_factory=list)


class OtaRoom(BaseModel):
    id: int | str                        # OTA-Zimmer-Code (integer)
    title: str | None = None
    rates: list[OtaRate] = Field(default_factory=list)


class LocalRoomOption(BaseModel):
    local_property_id: str
    title: str
    # Vorgeschlagener Booking-Zimmertyp (BCRT) aus dem lokalen property_type —
    # damit die UI beim Verbinden das passende OTA-Zimmer vorwählt. None = keine
    # Entsprechung (kein Vorschlag, der Nutzer wählt selbst).
    suggested_bcrt_code: int | None = None
    suggested_bcrt_name: str | None = None


class PrepareChannelResponse(BaseModel):
    """OTA-Zimmer + unsere Zimmer (Objekte) zum Zuordnen in der UI. Zuordnung auf
    Zimmer-Ebene; die Raten des Zimmers verbindet der Server automatisch."""

    portal: str                          # menschlicher Name
    ota_rooms: list[OtaRoom] = Field(default_factory=list)
    rooms: list[LocalRoomOption] = Field(default_factory=list)


class ChannelMapping(BaseModel):
    """Eine Zuordnung: unser Zimmer (Objekt) ↔ OTA-Zimmer. Die Raten des OTA-
    Zimmers werden serverseitig auf die Rate-Plans des Objekts expandiert."""

    local_property_id: str
    room_type_code: int | str            # OTA-Zimmer-Code (Sandbox: String)
    occupancy: int = 2
    pricing_type: str = "Standard"


class ConnectChannelRequest(BaseModel):
    """Schritt 3+4: Kanal mit Zuordnung anlegen und aktivieren."""

    property_id: str
    portal_code: str
    title: str | None = None
    settings: dict = Field(default_factory=dict)        # z.B. {"hotel_id": "..."}
    mappings: list[ChannelMapping] = Field(default_factory=list)


# --- Airbnb-OAuth (white-label, ohne iFrame) --------------------------------
class OtaAccountOut(BaseModel):
    """Ein Portal-Zugang eines Betriebs (0304)."""

    id: str
    portal_code: str
    portal: str
    # Kennung beim Portal (Airbnb-Host-ID, Booking-Hotel-ID). None, solange die
    # Autorisierung läuft — Channex meldet sie erst danach.
    hotel_id: str | None = None
    channel_id: str | None = None
    display_name: str | None = None
    is_active: bool = True
    # Channex meldet abgelaufene Tokens → der Betrieb muss neu autorisieren.
    token_invalid: bool = False
    last_error: str | None = None
    connected_at: str | None = None
    # Wie viele Objekte an diesem Konto hängen.
    properties: int = 0


class OtaAccountList(BaseModel):
    items: list[OtaAccountOut] = Field(default_factory=list)
    total: int = 0


class OtaAccountRename(BaseModel):
    display_name: str | None = None


class OAuthBeginRequest(BaseModel):
    """OAuth-Start: inaktiven Channel anlegen + echte OAuth-URL erzeugen."""

    # Optional, weil verbindlich der Pfad-Parameter der Route gilt — der
    # Body-Wert ist informativ. Ein Pflichtfeld hier hätte ältere Clients, die
    # es nicht senden, mit einem nackten Typfehler abgewiesen statt mit der
    # erklärenden Meldung des Service.
    property_id: str | None = None
    portal_code: str                                  # OAuth-Portal (AirBNB)
    title: str | None = None
    settings: dict = Field(default_factory=dict)      # optionale Airbnb-Settings
    # Ein WEITERES Portal-Konto verbinden statt das bestehende wiederzuverwenden
    # (0304 — Agenturen führen mehrere Zugänge je Portal). Standard ist `false`:
    # der häufige Fall ist „mein Konto verbinden", und ein versehentlich zweiter
    # Kanal am selben Konto wird von Airbnb abgelehnt.
    neues_konto: bool = False
    # Wohin Channex nach der Autorisierung zurückleitet. Kommt vom Frontend,
    # weil das Backend seine öffentliche Adresse nicht kennt; der Service prüft
    # sie gegen die erlaubten Origins (kein offener Weiterleiter). Ohne diesen
    # Wert bleibt der Kunde nach dem Airbnb-Login bei Channex stehen — bei einer
    # Agentur mit vielen Zugängen zusätzlich ohne Hinweis, welches Konto gerade
    # verbunden wurde.
    redirect_uri: str | None = None
    # WELCHES Portal-Konto gerade verbunden wird (0304). Der stabile Anker: er
    # steht in `ota_account` und überlebt jeden Folge-Aufruf.
    #
    # `neues_konto` allein reichte nicht. Es gilt nur für EINEN Request; wurde
    # der Link ein zweites Mal angefordert (Seite neu geladen, „Verbinden"
    # nochmal geklickt), kam der Aufruf ohne das Flag und der Service fiel auf
    # den bereits autorisierten Kanal zurück — also immer auf das ERSTE Konto.
    # Live gemessen am 07.08.2026: ein Link für Konto B, danach drei für Konto A.
    # Da Channex je Verbindung nur den letzten `state` kennt, war der richtige
    # Link nach 29 Sekunden tot und Konto B blieb dauerhaft ohne Tokens.
    account_id: str | None = None


class AirbnbUebernahmeResponse(BaseModel):
    """Ergebnis der Airbnb-Übernahme: wie viele Objekte daraus entstanden sind.

    `skipped` zählt Listings, die NICHT übernommen wurden (ohne Titel/ID oder
    über der Obergrenze) — bewusst ausgewiesen statt still abgeschnitten.

    `listings_gefunden` ist die Zahl der Anzeigen, die das Portal ÜBERGEBEN hat.
    Sie ist wichtig, weil Airbnb nicht alle liefert: Anzeigen, die dort bereits
    an eine andere Software gebunden sind, fehlen in der Liste. Live gemessen am
    Beta-Betrieb: Airbnb führt 19 Anzeigen, `mapping_details` liefert 18 — genau
    die eine mit Airbnb-Sync-Status „Connected" (`021 Stjerneskud`) fehlt. Ohne
    diese Zahl im UI wundert sich der Betrieb, warum ein Objekt fehlt, und
    findet den Grund nie."""

    created: int = 0
    updated: int = 0
    skipped: int = 0
    listings_gefunden: int = 0


class AirbnbObjektAbrufResponse(BaseModel):
    """Ergebnis des Abrufs EINES Objekts bei Airbnb.

    Jedes Feld sagt, was wirklich passiert ist — keine Erfolgsmeldung ohne
    Deckung (Wurzel 5). `preis_uebernommen: false` mit `hinweis` ist der
    ehrliche Fall: die Zuordnung steht, aber Airbnb hat (noch) keinen Preis
    übergeben, und der Platzhalter 0 steht weiter im Preisplan. Das Objekt
    bleibt dann `draft` — eine Nacht für 0 ist nicht verkäuflich.

    `waehrung`/`zeitzone` kommen aus dem `country_code` der Anzeige. Beide
    fehlten nach der Übernahme (Zeitzone bei allen 18 Objekten des Beta-
    Betriebs), und ohne sie ging weder ein Preisplan noch die Aktivierung
    bei Channex.
    """

    property_id: str
    listing_id: str
    waehrung: str | None = None
    zeitzone: str | None = None
    plan_angelegt: bool = False
    zugeordnet: bool = False
    preis_uebernommen: bool = False
    base_price: float | None = None
    min_stay: int | None = None
    # Welche WEITEREN Angaben aus Airbnb übernommen wurden (Check-in-Zeiten,
    # Haustiere, max. Nächte …). Airbnb liefert beim Zuordnen deutlich mehr als
    # den Preis; die Liste macht sichtbar, was wirklich ankam, statt es zu
    # behaupten.
    uebernommene_felder: list[str] = []
    # Wie viele Fotos NEU aus Airbnb angelegt wurden. Kommt nicht über Channex
    # (dort ist `content.photos` bei allen 18 Objekten leer und kontoweit
    # `total: 0`), sondern direkt aus `v2/listing_photos` — bei Objekt 020 sind
    # das 17 Bilder mit Bildtexten. 0 heißt: keine NEUEN (schon vorhandene
    # werden nicht doppelt angelegt).
    fotos_uebernommen: int = 0
    # Was aus `action/listing_details` kam — der vollständige Content-Weg, den
    # Airbnb selbst dokumentiert: `rooms` (Zimmer je Art, privat/gemeinschaftlich),
    # `beds`, Schlafzimmer-/Bad-Anzahl, Einheiten, Storno, Sofortbuchung,
    # Gastregeln, Verfügbarkeitsregeln, Gebühren, Ausstattung, WLAN und
    # Check-in-Zeiten. Getrennt von `uebernommene_felder`, damit man sieht, ob
    # dieser Weg gegriffen hat — leer + `hinweis` heißt: er hat es nicht.
    details_uebernommen: list[str] = []
    hinweis: str | None = None


class OAuthBeginResponse(BaseModel):
    """Die OAuth-URL zum Öffnen ODER Kopieren (an den Eigentümer senden)."""

    # None bei einer NEUEN Verbindung: den Kanal legt Channex erst an, wenn die
    # Autorisierung eintrifft („we will automatically create a new inactive
    # Channel", Airbnb Connection API). Gesetzt nur beim Wiederverbinden eines
    # bestehenden Kanals.
    channel_id: str | None = None
    oauth_url: str
    portal: str                                       # menschlich, z.B. "Airbnb"
    status: str = "pending"
    # Das Konto, für das dieser Link gilt (0304). Das Frontend hält es fest und
    # gibt es bei jedem Folge-Aufruf zurück — sonst weiß der Server beim zweiten
    # Klick nicht mehr, welcher Zugang gemeint war, und erzeugt den Link für den
    # bereits verbundenen. Nur beim Mehrkonto-Weg gesetzt.
    account_id: str | None = None


class OAuthStatusResponse(BaseModel):
    """Verbindungsstatus (Poll): verbunden + Host-ID, sobald autorisiert."""

    connected: bool = False
    host_id: str | None = None
    portal: str
    # Grund, warum die Verbindung nicht steht. Der Service ermittelt ihn bereits
    # (parse_connection_status), das Schema hat ihn aber verworfen — dadurch sah
    # der Kunde endlos "Warte auf die Bestätigung …", obwohl das Portal die
    # Autorisierung abgelehnt hatte. Fehler nie verschlucken (Wurzel 5).
    last_error: str | None = None


class OAuthFinalizeRequest(BaseModel):
    """Nach erfolgreicher Verbindung: Mapping setzen + Channel aktivieren."""

    property_id: str
    portal_code: str
    mappings: list[ChannelMapping] = Field(default_factory=list)
    # WELCHES Portal-Konto (0304) — dasselbe wie beim vorangegangenen
    # `prepare`. Ohne Angabe nähme `finalize` die erste Verbindungszeile des
    # Objekts; beim Übernahme-Gerüst ist das die des ERSTEN Zugangs, und die
    # Zuordnung liefe gegen dessen Kanal (live: „Zugeordnetes Portal-Zimmer
    # nicht gefunden", weil das Listing dort nicht existiert).
    account_id: str | None = None


# --- Webhook-Registrierung (Admin) ------------------------------------------
class WebhookInfo(BaseModel):
    id: str
    callback_url: str | None = None
    event_mask: str | None = None
    is_global: bool = False
    is_active: bool = True


class WebhookRegisterResponse(BaseModel):
    callback_url: str
    event_mask: str
    webhook: WebhookInfo | None = None


# --- Flow-Debugging (channex_debug_log) -------------------------------------
class ChannexDebugEntry(BaseModel):
    """Ein Channex-Call als Trace-Zeile (sichtbares Flow-Debugging)."""

    id: str
    property_id: str | None = None
    step: str
    channex_method: str
    channex_path: str
    request_body: dict | list | None = None
    response_body: dict | list | None = None
    channex_id: str | None = None
    http_status: int | None = None
    duration_ms: int | None = None
    ok: bool = False
    error: str | None = None
    created_at: str | None = None


class ChannexDebugResponse(BaseModel):
    items: list[ChannexDebugEntry]
    total: int


# --- OTA-Zusatzflächen (Reviews, Rules, Reporting, Threads, CRS, Ereignisse) --
class ReviewReplyRequest(BaseModel):
    """Antwort des Gastgebers auf eine Gäste-Bewertung."""

    reply: str = Field(min_length=1, max_length=5000)


class GuestReviewRequest(BaseModel):
    """Gast-Bewertung des Hosts (nur Airbnb) — Struktur laut Reviews-Collection
    (scores[], tags[], public_review, private_review, is_reviewee_recommended)."""

    review: dict


class AvailabilityRuleRequest(BaseModel):
    """Kanal-Kontingent-Regel. type: close_out | availability_offset |
    max_availability; value nur für offset/max Pflicht (Channex validiert)."""

    # Channex führt title nicht als Pflichtfeld (nur in Beispielen) — optional.
    title: str | None = Field(default=None, max_length=255)
    type: str = Field(pattern="^(close_out|availability_offset|max_availability)$")
    value: int | None = None
    start_date: date
    end_date: date | None = None
    days: list[str] | None = None
    affected_channels: list[str]
    affected_room_types: list[str]


class NoShowReportRequest(BaseModel):
    waived_fees: bool


class ThreadMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10000)


class CrsBookingRequest(BaseModel):
    """Booking-CRS-Payload (Public-Booking-API-Struktur, siehe Channex-Doku).
    property_id/rooms/customer usw. werden serverseitig gegen den Tenant geprüft."""

    booking: dict


class WebhookEventEntry(BaseModel):
    """Persistiertes Channex-Webhook-Ereignis (Airbnb-Anfragen, Sync-Fehler,
    unmapped Bookings, Reviews, Kanal-Statuswechsel)."""

    id: str
    property_id: str | None = None
    event: str
    payload: dict | list | None = None
    severity: str = "info"
    resolved: bool = False
    created_at: str | None = None
    # Ohne die Channex-Ereignis-ID ist eine Airbnb-Anfrage nicht beantwortbar —
    # die Oberfläche muss deshalb wissen, ob sie da ist.
    live_feed_event_id: str | None = None
    resolution: dict | None = None
    resolved_at: str | None = None


class AirbnbAnfrageAntwort(BaseModel):
    """Die Entscheidung des Betriebs zu einer Airbnb-Anfrage.

    EIN Schema für drei Anfragearten, aber die gesendete Form ist je Art anders
    (Airbnb: `accept` boolean bei Reservation Request, STRING bei Alteration).
    Deshalb entscheidet `aktion`, welcher Bauhelfer die Form erzeugt — der Client
    schickt NIE eine rohe `resolution` (Wurzel 3: der Anfrage nicht vertrauen).
    """

    aktion: Literal[
        "annehmen",
        "ablehnen",
        "alteration_annehmen",
        "alteration_ablehnen",
        "alteration_zuruecknehmen",
        "vorab_genehmigen",
        "sonderpreis",
    ]
    # Nur bei `ablehnen`: einer der vier von Airbnb erlaubten Gründe.
    grund: str | None = None
    nachricht_an_gast: str | None = None
    nachricht_an_airbnb: str | None = None
    # Nur bei `vorab_genehmigen`.
    sofortbuchung_sperren: bool = False
    # Nur bei `sonderpreis`: GANZZAHL in Minor Units (10000 = 100,00).
    gesamtpreis_minor: int | None = None


class OtaChannelOverview(BaseModel):
    """Ein OTA-Kanal in der Kanal-Übersicht (Karte): Katalog-Metadaten + wie viele
    Objekte damit verbunden sind.

    ZWEI Zahlen, weil es ZWEI Fragen sind — und sie zu vermischen war ein echter
    Fehler: `connected_count` zählt Objekte, deren Abgleich LÄUFT (`is_active`);
    `linked_count` zählt Objekte, für die eine Verbindung BESTEHT. Bei einem
    OAuth-Portal wie Airbnb liegen dazwischen mehrere Schritte: das Konto ist
    autorisiert, aber bis die Zuordnung fertig ist, bleibt `is_active` false.
    Ohne `linked_count` zeigte die Karte in genau diesem Zustand „Verbinden" —
    und der Betrieb verband dasselbe Konto immer wieder neu.
    """

    kind: str = "ota"
    code: str
    label: str
    icon: str
    connection_type: str  # "oauth" | "credential"
    connected_count: int
    linked_count: int = 0
    # Vom Tenant in die Sidebar geholt (Dropdown „Kanal hinzufügen")?
    pinned: bool = False


class MarketplaceChannelOverview(BaseModel):
    """Eigener myBestDays-Marktplatz als Kanal (gleichrangig zu OTAs)."""

    kind: str = "marketplace"
    code: str = "myBestDays"
    label: str
    # Auf dem Marktplatz WIRKLICH sichtbar (active + gelistet + freigegeben).
    listed_count: int
    # Gelistet, aber ohne Freigabe des Betreibers (0203) → noch nicht sichtbar.
    # Zweite Achse wie `linked_count` bei den OTAs: „eingerichtet" ist nicht
    # dasselbe wie „läuft".
    pending_count: int = 0


class MarketplacePropertyRow(BaseModel):
    """Eine Zeile der Marktplatz-Objekttabelle (Pendant zur OTA-Zuordnung)."""

    property_id: str
    title: str
    city: str | None = None
    country: str | None = None
    status: str | None = None
    # Kanal-Schalter des Betriebs (`listed_on_marketplace`).
    listed: bool
    # Freigabe des Betreibers: draft/pending/approved/rejected (0203).
    moderation_status: str | None = None
    # Abgeleitet: active (sichtbar) · pending (Freigabe offen) · paused (aus).
    state: str
    # Öffentliche Inserat-Seite — nur gesetzt, wenn das Objekt dort WIRKLICH
    # steht und die Marktplatz-Adresse konfiguriert ist (keine geratene URL).
    listing_url: str | None = None
    photo: str | None = None
    bookings_count: int = 0


class MarketplaceDetailResponse(BaseModel):
    """Detailfläche des eigenen Marktplatzes (/channels/mybestdays)."""

    code: str
    label: str
    # "" = keine Marktplatz-Adresse konfiguriert → die Oberfläche zeigt keinen
    # Link, statt auf eine erfundene Domain zu verweisen.
    marketplace_url: str
    listed_count: int
    pending_count: int
    items: list[MarketplacePropertyRow]


class IcalChannelOverview(BaseModel):
    """iCal-Kalender-Sync als Kanal (nur Import)."""

    kind: str = "ical"
    code: str = "iCal"
    label: str
    synced_count: int


class ChannelOverviewResponse(BaseModel):
    """Kanal-zentrierte Übersicht für die Channel-Manager-Seite (Karten je Kanal
    mit Status/Objektzahl). Alle Zahlen aus der DB aggregiert (tenant-lokal)."""

    ota: list[OtaChannelOverview]
    marketplace: MarketplaceChannelOverview
    ical: IcalChannelOverview


class PinnedChannelsResponse(BaseModel):
    """Die vom Tenant in die Sidebar geholten Kanal-Codes."""

    codes: list[str]


class PinChannelRequest(BaseModel):
    """Ein Kanal in die Sidebar holen (Dropdown „Kanal hinzufügen")."""

    portal_code: str


class ChannelMappingRow(BaseModel):
    """Eine Zeile der Kanal-Mapping-Tabelle: unser Objekt ↔ OTA-Hotel-ID ↔
    Sync-Status (Lodgify-Muster). Nur echte, tenant-eigene Verbindungen."""

    property_id: str
    property_title: str | None = None
    # Titelbild des Objekts (Cover, sonst erstes Foto); None = keins vorhanden.
    property_photo: str | None = None
    # Teilt dieses Objekt seine Portal-Kennung mit einem BEREITS verbundenen
    # Objekt (gemeinsames Gebäude, 0264)? Nur dann darf der Verbinde-Assistent
    # die vorhandene Hotel-ID übernehmen und die Eingabe überspringen. Ohne
    # Gebäude ist jedes Objekt ein eigenes Haus mit EIGENER Kennung — dort wäre
    # eine übernommene Hotel-ID die eines fremden Objekts.
    shares_building: bool = False
    ota_hotel_id: str | None = None
    # OTA-Zimmertyp, auf den DIESES Objekt gemappt ist (unter der Hotel-ID):
    # Code (z. B. Booking room_type_code 651942003) + Klarname (z. B. „Double Room").
    # Die Anzeige nutzt Titel/Code, NICHT die Hotel-ID (die ist für alle Zimmer gleich).
    ota_room_type_code: str | None = None
    ota_room_title: str | None = None
    is_active: bool
    # Existiert eine Verbindung dieses Portals für das Objekt (verbunden vs.
    # „Verbinden"-Button in der Tabelle)?
    connected: bool = False
    # Zuordnung ist beim Portal VORHANDEN, aber unbrauchbar — das Portal kann
    # ihr Ziel nicht auflösen und führt das Listing als „Not mapped". Dann ist
    # `connected` false, aber die Handlung ist NICHT „verbinden" (der
    # Rate-Plan-Titel ist belegt, ein Neu-Verbinden scheitert an
    # „Duplication in Rate Plan title is not allowed"), sondern „reparieren":
    # POST …/connections/{portal}/reparieren korrigiert den bestehenden Eintrag.
    needs_repair: bool = False
    sync_enabled: bool
    last_sync_status: str | None = None
    last_sync_error: str | None = None
    updated_at: str | None = None


class ChannelDetailResponse(BaseModel):
    """Detailfläche eines Kanals: Portal-Metadaten + je OBJEKT des Tenants eine
    Zuordnungszeile (Objekt ↔ OTA-Listing ↔ Sync-Status). connected_count/
    total_count für den „X von Y verbunden"-Zähler."""

    portal_code: str
    portal: str
    connected: bool
    connected_count: int = 0
    total_count: int = 0
    # Channex-Kanal-ID des Portals (bei Hotels teilen sich alle Zimmer einen Kanal
    # = eine Hotel-ID). Für „Verbindung trennen" auf Portal-Ebene. None = nicht verbunden.
    channel_id: str | None = None
    # ALLE Kanal-IDs dieses Portals — eine je eigener Portal-Kennung.
    #
    # `channel_id` (oben) ist „irgendeine" und stammt aus der Hotel-Annahme: EIN
    # Hotel = EINE Hotel-ID = EIN Kanal. Bei einem Betrieb mit vielen einzelnen
    # Ferienhäusern ist jedes Haus eine EIGENE Booking.com-Hotel-ID und damit ein
    # EIGENER Channex-Kanal. Jede Aktion, die „für dieses Portal" gilt, muss
    # deshalb über ALLE Kanäle laufen, nicht über den erstbesten — sonst wirkt
    # ein Knopfdruck auf genau ein Haus und die übrigen bleiben unberührt
    # (live 10.08.2026: „Bestehende Buchungen laden" stieß von 18 Häusern immer
    # nur eines an, weshalb Kornblomst dauerhaft ohne Buchungen blieb).
    channel_ids: list[str] = Field(default_factory=list)
    # Kanal-eigene Aktionen aus dem Katalog (z.B. load_future_reservations).
    # Die UI bietet nur an, was der Kanal wirklich kann.
    actions: list[str] = Field(default_factory=list)
    # Läuft der Kanal bei Channex? Ein Kanal wird INAKTIV angelegt und geht erst
    # mit `POST channels/{id}/activate` live. Verbunden ≠ aktiv: die Airbnb-
    # Verbindung des Beta-Betriebs stand tagelang auf `is_active: false`, weil
    # der erste Aktivierungsversuch an einer fehlenden Zeitzone scheiterte
    # (live gemessen 04.08.2026) und es keinen zweiten Weg dorthin gab. Ohne
    # dieses Feld kann die Oberfläche den Zustand nicht einmal ANZEIGEN.
    channel_active: bool | None = None
    # Was Channex vor dem Aktivieren noch fehlt (Klartext, leer = bereit).
    # None = nicht geprüft (kein Kanal vorhanden).
    readiness_offen: str | None = None
    mappings: list[ChannelMappingRow]


class AbgabePostenStatus(BaseModel):
    """Sync-Stand EINES Postens (Gebühr oder Steuer) über alle Portale.

    Drei getrennte Aussagen, weil sie verschiedene Dinge bedeuten:
    `manual_portals` = dort muss der Posten von Hand gepflegt werden (das Portal
    nimmt ihn nicht), `restricted_portals` = der Betrieb hat ihn selbst
    ausgeschlossen, `internal_only` = er geht bewusst an kein Portal.
    """

    key: str
    kind: str
    manual_portals: list[str] = Field(default_factory=list)
    restricted_portals: list[str] = Field(default_factory=list)
    internal_only: bool = False
    # Nur bei Aktionen: WARUM der Tagespreis die Aktion nicht tragen kann
    # (Schlüssel, kein Satz — die Oberfläche übersetzt ihn). Gilt für alle
    # Portale außer Airbnb. `None` = kein Hindernis.
    reason: str | None = None
    # Nur bei Aktionen: warum AIRBNB sie auch nicht über die eigene Rabattregel
    # bekommt. Getrennt von `reason`, weil es ein anderer Weg mit anderen
    # Grenzen ist — ein gemeinsamer Grund wäre für ein Portal immer falsch.
    airbnb_reason: str | None = None


class AirbnbAktionenPushResponse(BaseModel):
    """Ergebnis eines Aktions-Pushes in Airbnbs eigene Rabattregeln.

    `updated` zählt die Listings, an denen sich WIRKLICH etwas geändert hat —
    ein Push ohne Änderung schreibt nichts (Wurzel 2). `skipped` nennt je Aktion
    den Grund, warum sie nicht als Airbnb-Regel ankommt (Schlüssel, kein Satz)."""

    channel_id: str | None = None
    listings: int = 0
    updated: int = 0
    rules: list[dict[str, Any]] = Field(default_factory=list)
    skipped: dict[str, str] = Field(default_factory=dict)


class AbgabenStatusResponse(BaseModel):
    """Sync-Stand der Abgaben eines Objekts (Chip „Manuelle Synchronisierung").

    `currency_missing` ist ein Befund über das OBJEKT, nicht über einen Posten:
    ohne Objektwährung überträgt der Abgaben-Sync gar nichts."""

    currency_missing: bool = False
    portals: list[str] = Field(default_factory=list)
    items: list[AbgabePostenStatus] = Field(default_factory=list)


class AirbnbFotoRaumRequest(BaseModel):
    """Ziel-Raum beim Umhängen eines Fotos. `null` = vom Raum LÖSEN.

    Airbnbs Raum-Kennung als Text (keine UUID) — Airbnb vergibt numerische IDs
    wie „817240083".

    `null` ist ein eigener, gemessener Vorgang und kein fehlender Wert: das Foto
    bleibt bestehen, hängt danach aber an keinem Raum mehr (Airbnb führt das als
    gültigen Zustand, siehe `airbnb_foto_raum.py`).
    """

    airbnb_room_id: str | None = Field(default=None, min_length=1, max_length=64)


class VerkaufPortalErgebnis(BaseModel):
    """Was an EINEM Portal passiert ist (oder warum nicht).

    Bewusst getrennte Felder statt eines Freitexts: die Oberfläche unterscheidet
    „abgeschaltet", „übersprungen, war schon aus" und „fehlgeschlagen" — drei
    verschiedene Aussagen, die als ein Satz nicht auswertbar wären.

    `war_aktiv` ist der gesicherte Vorzustand und damit der Grund, warum der
    Rückweg WIEDERHERSTELLT statt alles anzuschalten (Wurzel 1).
    """

    portal_code: str
    portal: str
    hebel: str | None = None
    channel_id: str | None = None
    mapping_id: str | None = None
    war_aktiv: bool | None = None
    ist_aktiv: bool | None = None
    objekte_am_kanal: int | None = None
    abgeschaltet: bool | None = None
    wiederhergestellt: bool | None = None
    # Grund, warum nichts geschaltet wurde, obwohl kein Fehler auftrat
    # (z. B. „war bereits abgeschaltet").
    uebersprungen: str | None = None
    fehler: str | None = None


class ObjektVerkaufResponse(BaseModel):
    """Ergebnis von „bei allen Portalen abschalten" bzw. „zurückholen".

    `pausiert` ist die EHRLICHE Gesamtaussage: sie ist nur `true`, wenn kein
    Portal fehlgeschlagen ist. Bleibt ein Portal aktiv, bleibt auch
    `properties.status` unverändert — ein „inaktiv" bei uns, während ein Portal
    weiterverkauft, ist der fail-open-Zustand, den dieser Weg verhindert
    (Wurzel 5).
    """

    property_id: str
    status: str | None = None
    pausiert: bool = False
    portale: list[VerkaufPortalErgebnis] = Field(default_factory=list)


class ObjektVerkaufStandResponse(BaseModel):
    """Live-Ist-Stand bei den Portalen — rein lesende Diagnose.

    Für den Test: nach dem Schalten sehen, was bei Channex WIRKLICH steht.
    Abweichungen zwischen unserer Sicht und dem Portal werden hier sichtbar,
    statt unentdeckt zu bleiben (ein Channex-200 ist kein Beweis).
    """

    property_id: str
    titel: str | None = None
    status: str | None = None
    portale: list[dict[str, Any]] = Field(default_factory=list)


# --- Portal-Raten-Auswahl (Dialog „Preisplan anlegen") -----------------------
class PortalRateAuswahl(BaseModel):
    """EINE Rate, die das Portal führt — als Auswahl statt als Tippvorlage.

    `title` ist der Portal-Titel EXAKT. Er ist kein Anzeigetext, sondern der
    ZUORDNUNGS-SCHLÜSSEL: `portal_raten_plaene.paar_fuer_portal_plan` findet das
    OTA-Paar eines Preisplans ausschließlich über Namensgleichheit. Ein hier
    normalisierter Titel (Groß-/Kleinschreibung, Bindestriche) ergäbe genau den
    Plan, der beim Portal nie ankommt.

    `belegt` ist DREIWERTIG und das absichtlich: `true` = die Rate hat schon
    ihren eigenen Plan (die Oberfläche zeigt sie ausgegraut, damit der Nutzer
    sieht, dass sie versorgt ist, statt einen zweiten Plan mit demselben Namen
    anzulegen — dann wäre der Name nicht mehr eindeutig und `paar_fuer_portal_plan`
    ordnete fail-closed GAR NICHTS mehr zu), `false` = frei, `null` = der Kanal
    war nicht lesbar, die Belegung ist UNBEKANNT (Wurzel 5 — kein „frei" aus
    einem fehlgeschlagenen Abruf).

    `min_stay` ist ein VORSCHLAG aus dem Titel (7 bei Wochen-, 30 bei
    Monats-Wörtern, `min_stay_aus_titel`). `null` heißt „nicht erkannt", nicht
    „kein Mindestaufenthalt" — kein geratener Wert (Wurzel 4).
    """

    rate_plan_code: str
    title: str
    room_type_code: str | None = None
    portal: str
    belegt: bool | None = None
    min_stay: int | None = None


class PortalRatenAuswahlPortal(BaseModel):
    """Die Raten EINES verbundenen Portals plus die Güte des Abrufs.

    `abruf_ok` trennt „das Portal führt keine Raten" von „der Abruf ist
    fehlgeschlagen" — in einer leeren Liste sehen beide gleich aus, und ohne
    dieses Feld behauptete die Oberfläche bei jeder Störung „keine Raten frei"
    (Wurzel 5). `kanal_lesbar` trennt zusätzlich „Raten bekannt, Belegung
    unbekannt" ab; dann tragen alle Raten `belegt: null`.

    `truncated`: die Antwort des Portals wurde auf `MAX_RATEN_JE_PORTAL` gekappt
    (Wurzel 8). Sichtbar, nicht still — sonst fehlte dem Nutzer eine Rate, ohne
    dass es jemand merkt.
    """

    portal: str
    portal_label: str
    abruf_ok: bool = False
    kanal_lesbar: bool = False
    truncated: bool = False
    rates: list[PortalRateAuswahl] = Field(default_factory=list)


class PortalRatenAuswahlResponse(BaseModel):
    """Alle Raten-Portale eines Objekts, je Portal gruppiert.

    Eine leere `portals`-Liste heißt „kein verbundenes Portal mit Raten-Ebene" —
    Airbnb erscheint hier NIE (keine Raten-Ebene: eine „Rate" je Listing mit der
    Listing-ID als Code, `PORTALE_MIT_RATEN` ist eine Allowlist).
    """

    property_id: str
    portals: list[PortalRatenAuswahlPortal] = Field(default_factory=list)


class OAuthRuecksprungRequest(BaseModel):
    """Der Ruecksprung von Airbnb, wie Channex ihn an die `redirect_uri` haengt.

    Channex haengt bei Erfolg `?success=true&channel_id=<uuid>&token=<token>`
    an, bei Fehlschlag `?success=false` an die `failure_redirect_uri`
    (OpenAPI-Spec `Meta.AirbnbConnectionLinkInput`). Der Link gilt zwei Stunden.

    ERST mit diesem Ruecksprung darf etwas entstehen — Vorgabe des Betreibers
    vom 29.08.2026: „erst wenn eine verbindung succee da ist darf bei channex
    eine Property entstehen". Vorher wurde beim blossen Klick ein Objekt, eine
    Channex-Property, ein Konto und eine Verbindungszeile angelegt; brach der
    Kunde ab, blieb alles davon liegen.
    """

    channel_id: str
    """Der Kanal, den CHANNEX nach der Autorisierung angelegt hat."""
    portal_code: str = "AirBNB"
    token: str | None = None
    """Unser eigenes Korrelations-Token (`konto_token`), falls gesetzt — bei
    einer Agentur mit mehreren Zugaengen die einzige Zuordnung."""


class OAuthRuecksprungResponse(BaseModel):
    account_id: str
    channel_id: str
    host_id: str | None = None
    """Airbnb-Host-ID aus den Tokens des Kanals. `None` = Channex hat den Kanal
    angelegt, die Tokens sind aber noch nicht da."""
    verbunden: bool
