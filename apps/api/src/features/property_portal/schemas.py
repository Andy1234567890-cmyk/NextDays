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

    door_code und wifi_password sind im Response nur mit MANAGE_PROPERTIES
    befüllt (der Service entscheidet); ohne Recht bleiben sie None (kein Leak
    der Zugangsgeheimnisse)."""

    enabled: bool = False
    contact_name: str | None = None
    contact_phone: str | None = None
    self_checkin: bool = False
    # Türcode + Anzeige-Regeln (der Türzugangs-TEXT liegt in messaging).
    door_code: str | None = None
    # WLAN-Zugang, strukturiert (0296). Das ist die Heimat von `{{wifi_ssid}}`
    # und `{{wifi_password}}` in den Nachrichten-Vorlagen. Beide Spalten gab es
    # seit 0296, aber KEIN Feld in Schema oder Maske — eine Vorlage mit diesen
    # Platzhaltern konnte deshalb nie gefüllt werden und schlug bei JEDER
    # Anreise mit „Feld ohne Wert" fehl (live: 6 Anreise-Automails in Folge,
    # 09.–11.08.2026). Der Freitext `messaging.wifi` ({{WifiInformation}})
    # bleibt daneben — er ist der ganze Satz, das hier sind die zwei Werte, die
    # auch der QR-Code des Gastportals braucht.
    wifi_ssid: str | None = None
    wifi_password: str | None = None
    show_code_only_if_paid: bool = False
    hide_code_until_checkin: bool = False
    # „HH:MM" — ab welcher Uhrzeit am Check-in-Tag der Code sichtbar wird.
    code_visible_from: str | None = None
    maintenance_phone: str | None = None
    header_image_path: str | None = None


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
