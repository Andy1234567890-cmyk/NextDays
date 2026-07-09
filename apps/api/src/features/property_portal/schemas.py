"""Pydantic-Schemas für den property_portal-Slice (Gastmodul je Objekt).

Bildet property_guest_portal (Migration 0121) ab — die strukturierten Portal-
SCHALTER/Werte (Self-Check-in, Türcode + Anzeige-Regeln, Kontaktperson, Kopfbild).
Die Info-TEXTE (WLAN/Türzugang/Hausordnung/Reiseführer) leben bewusst NICHT hier,
sondern in properties.type_attributes.messaging (eine Wahrheit — siehe
docs/ANALYSE-gaeste-info-gastmodul-gaestemappe.md).
"""
from pydantic import BaseModel


class GuestPortalSettings(BaseModel):
    """Gastmodul-Einstellungen je Objekt (GET/PUT). Genau EIN Datensatz je Objekt.

    door_code ist im Response nur mit MANAGE_PROPERTIES befüllt (der Service
    entscheidet); ohne Recht bleibt es None (kein Leak des Zugangscodes)."""

    enabled: bool = False
    contact_name: str | None = None
    contact_phone: str | None = None
    self_checkin: bool = False
    # Türcode + Anzeige-Regeln (der Türzugangs-TEXT liegt in messaging).
    door_code: str | None = None
    show_code_only_if_paid: bool = False
    hide_code_until_checkin: bool = False
    # „HH:MM" — ab welcher Uhrzeit am Check-in-Tag der Code sichtbar wird.
    code_visible_from: str | None = None
    maintenance_phone: str | None = None
    header_image_path: str | None = None


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
