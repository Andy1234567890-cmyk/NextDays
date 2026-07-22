"""Pydantic-Schemas für den guest_stay-Slice (Gastmodul / Self-Check-in).

Response-Sicht des Gasts auf SEINE Buchung: Objekt-Basis, Check-in/out-Daten und
-Zeiten, Self-Check-in-Flag, Kontakt/Notfall, Kopfbild, die gast-relevanten
Info-TEXTE aus properties.type_attributes.messaging (mehrsprachig, gefiltert) und
— nur wenn die Freigaberegeln erfüllt sind — der door_code.

Die messaging-Texte sind Client-/OTA-nahe Freitexte (Wurzel 8): sie werden als
PLAINTEXT behandelt (kein serverseitiges HTML-Rendern) und nur auf die bekannten,
gast-relevanten Keys gefiltert durchgereicht — keine erfundenen Felder.
"""
from pydantic import BaseModel


class GuestStayMessaging(BaseModel):
    """Gast-relevante Info-Texte aus type_attributes.messaging.

    Jedes Feld ist ein mehrsprachiges Objekt (`{"de": "…", "en": "…"}`) oder None,
    wenn der Vermieter den Block nicht gepflegt hat. Nur diese bekannten Keys
    werden durchgereicht (Allowlist, Wurzel 8) — als Plaintext zu behandeln.
    """

    check_in: dict[str, str] | None = None
    check_out: dict[str, str] | None = None
    directions: dict[str, str] | None = None
    door_instructions: dict[str, str] | None = None
    rules: dict[str, str] | None = None
    wifi: dict[str, str] | None = None
    local_guide: dict[str, str] | None = None
    emergency: dict[str, str] | None = None


class GuestStayResponse(BaseModel):
    """Das Gastmodul für EINE Buchung (Gast-Sicht)."""

    reservation_id: str
    property_id: str
    property_title: str
    property_address: str | None = None
    currency: str | None = None
    # Aufenthaltsdaten + tatsächliche Zeitstempel (0091).
    check_in: str
    check_out: str
    checked_in_at: str | None = None
    checked_out_at: str | None = None
    payment_status: str
    # Portal-Schalter/Kontakte (property_guest_portal, 0121).
    self_checkin: bool = False
    contact_name: str | None = None
    contact_phone: str | None = None
    maintenance_phone: str | None = None
    header_image_path: str | None = None
    # Info-Texte (messaging, gast-relevant gefiltert).
    messaging: GuestStayMessaging
    # Türcode NUR wenn die Freigaberegeln erfüllt sind (sonst None + Grund).
    door_code: str | None = None
    door_code_hidden_reason: str | None = None


class GuestCheckInResponse(BaseModel):
    """Ergebnis des Self-Check-ins (idempotent)."""

    reservation_id: str
    checked_in_at: str
    already_checked_in: bool = False


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
