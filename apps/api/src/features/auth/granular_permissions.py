"""Feingranulare Berechtigungsmatrix (Konto → Benutzer, feingranular pro Nutzer).

Ergänzt das rollenbasierte Capability-System (permissions.py) um die ~43
zuweisbaren feingranularen Berechtigungen, die im Benutzer-Wizard pro Nutzer
ausgewählt und in users.permissions (JSONB) persistiert werden.

Single Source of Truth für die IDs — identisch zur Frontend-Liste
(components/konto/user-wizard-data.ts). Admin hat IMMER alle.
"""
from enum import StrEnum

from .schemas import UserRole


class Permission(StrEnum):
    # --- Allgemeine Berechtigungen ---
    EDIT_PROPERTY = "edit_property"
    EDIT_PROPERTY_CONTACT = "edit_property_contact"
    MANAGE_PROPERTY_SETTINGS = "manage_property_settings"
    MANAGE_PROPERTY_CONDITIONS = "manage_property_conditions"
    EDIT_CALENDAR_BOOKINGS = "edit_calendar_bookings"
    VIEW_GUEST_NAME = "view_guest_name"
    VIEW_GUEST_CONTACT = "view_guest_contact"
    VIEW_GUEST_ID_DOCS = "view_guest_id_docs"  # Ausweisdokumente (DSGVO-sensibel)
    EDIT_GUEST = "edit_guest"                  # Gästekarte bearbeiten (Schreibrecht)
    VIEW_BOOKING_SOURCE = "view_booking_source"
    SYNC_ICAL = "sync_ical"
    DOWNLOAD_BOOKING_REPORT = "download_booking_report"
    ACCESS_HOMEPAGE_BUILDER = "access_homepage_builder"
    HIDE_PRICES = "hide_prices"
    MANAGE_CLOSED_PERIODS = "manage_closed_periods"
    ACCESS_PM_FEATURES = "access_pm_features"
    OWNER_REPORTING = "owner_reporting"
    # --- PM-Module-Berechtigungen ---
    PM_MANAGE_BOOKING_IMAGES = "pm_manage_booking_images"
    PM_MANAGE_PROPERTY_IMAGES = "pm_manage_property_images"
    PM_CHECKOUT_ALERTS = "pm_checkout_alerts"
    PM_DEPOSIT_ALERTS = "pm_deposit_alerts"
    PM_PAYMENT_ALERTS = "pm_payment_alerts"
    PM_ALERT_ICONS = "pm_alert_icons"
    PM_CHAT = "pm_chat"
    PM_EDIT_COMMENTS = "pm_edit_comments"
    PM_EDIT_CHECKIN_TIMES = "pm_edit_checkin_times"
    PM_GUEST_MODULE = "pm_guest_module"
    PM_GUEST_PORTAL_SETTINGS = "pm_guest_portal_settings"
    PM_REVENUE_CHARTS = "pm_revenue_charts"
    PM_NONREVENUE_CHARTS = "pm_nonrevenue_charts"
    PM_PHOTO_ALBUM = "pm_photo_album"
    PM_PROPERTY_AREA = "pm_property_area"
    PM_GUEST_DETAILS = "pm_guest_details"
    PM_BOOKING_TOTAL = "pm_booking_total"
    PM_OWNER_EMAIL = "pm_owner_email"
    PM_BOOKING_PAYMENTS = "pm_booking_payments"
    PM_SHARE_ALERTS = "pm_share_alerts"
    PM_SHARE_IMAGES = "pm_share_images"
    PM_VIEW_ADD_COMMENTS = "pm_view_add_comments"
    PM_VIEW_NOTES = "pm_view_notes"
    PM_VIEW_BOOKING_IMAGES = "pm_view_booking_images"
    PM_DETAILED_PAYMENTS = "pm_detailed_payments"
    PM_OWNER_DETAILS = "pm_owner_details"
    PM_VIEW_PROPERTY_IMAGES = "pm_view_property_images"
    PM_WEBSITE_ACCESS = "pm_website_access"
    # --- Posteingang (Enterprise-Achsen: Scope/Actions) ---
    # PM_CHAT (oben) = Access. Diese steuern Sichtbarkeit & erlaubte Aktionen.
    INBOX_VIEW_ALL = "inbox_view_all"        # alle Tenant-Threads (sonst nur zugewiesene)
    INBOX_REPLY = "inbox_reply"              # ausgehende Nachrichten senden
    INBOX_ASSIGN = "inbox_assign"            # Threads (um-)zuweisen
    INBOX_MANAGE_CONFIG = "inbox_manage_config"  # Vorlagen/Automationen/KI-Settings
    # --- Reisebüro-/Partner-Kartei (Stammdaten, Verträge, Jahres-Preise) ---
    MANAGE_PARTNERS = "manage_partners"


_ALL: frozenset[Permission] = frozenset(Permission)

# Default-Berechtigungen je Rolle beim Anlegen (im Wizard überschreibbar).
# Admin: alles. Co-Admin: voller operativer Satz. Owner: Eigentümer-Portal.
# Staff/Cleaner: nur operative Sicht (keine Finanzen/Gastdaten/Reports).
_CO_ADMIN: frozenset[Permission] = frozenset({
    Permission.EDIT_PROPERTY,
    Permission.EDIT_PROPERTY_CONTACT,
    Permission.MANAGE_PROPERTY_SETTINGS,
    Permission.MANAGE_PROPERTY_CONDITIONS,
    Permission.EDIT_CALENDAR_BOOKINGS,
    Permission.VIEW_GUEST_NAME,
    Permission.VIEW_GUEST_CONTACT,
    Permission.VIEW_GUEST_ID_DOCS,
    Permission.EDIT_GUEST,
    Permission.VIEW_BOOKING_SOURCE,
    Permission.SYNC_ICAL,
    Permission.DOWNLOAD_BOOKING_REPORT,
    Permission.ACCESS_HOMEPAGE_BUILDER,
    Permission.ACCESS_PM_FEATURES,
    Permission.PM_MANAGE_BOOKING_IMAGES,
    Permission.PM_MANAGE_PROPERTY_IMAGES,
    Permission.PM_CHAT,
    Permission.PM_EDIT_COMMENTS,
    Permission.PM_EDIT_CHECKIN_TIMES,
    Permission.PM_GUEST_MODULE,
    Permission.PM_REVENUE_CHARTS,
    Permission.PM_NONREVENUE_CHARTS,
    Permission.PM_PROPERTY_AREA,
    Permission.PM_GUEST_DETAILS,
    Permission.PM_BOOKING_TOTAL,
    Permission.PM_BOOKING_PAYMENTS,
    Permission.PM_VIEW_ADD_COMMENTS,
    Permission.PM_VIEW_NOTES,
    Permission.PM_VIEW_BOOKING_IMAGES,
    Permission.PM_VIEW_PROPERTY_IMAGES,
    Permission.PM_WEBSITE_ACCESS,
    # Posteingang voll (Agentur-Manager): alle Threads, antworten, zuweisen, konfigurieren.
    Permission.INBOX_VIEW_ALL,
    Permission.INBOX_REPLY,
    Permission.INBOX_ASSIGN,
    Permission.INBOX_MANAGE_CONFIG,
    Permission.MANAGE_PARTNERS,
})

_OWNER: frozenset[Permission] = frozenset({
    Permission.OWNER_REPORTING,
    Permission.VIEW_BOOKING_SOURCE,
    Permission.PM_PROPERTY_AREA,
    Permission.PM_PHOTO_ALBUM,
    Permission.PM_VIEW_PROPERTY_IMAGES,
    Permission.PM_NONREVENUE_CHARTS,
})

_STAFF: frozenset[Permission] = frozenset({
    Permission.ACCESS_PM_FEATURES,
    Permission.PM_PROPERTY_AREA,
    Permission.PM_ALERT_ICONS,
    Permission.PM_CHECKOUT_ALERTS,
    Permission.PM_VIEW_PROPERTY_IMAGES,
    Permission.PM_VIEW_NOTES,
})

ROLE_DEFAULT_PERMISSIONS: dict[UserRole, frozenset[Permission]] = {
    UserRole.admin: _ALL,
    UserRole.co_admin: _CO_ADMIN,
    UserRole.owner: _OWNER,
    UserRole.staff: _STAFF,
    UserRole.cleaner: _STAFF,
}


def default_permissions_for(role: UserRole) -> list[str]:
    """Default-Berechtigungs-IDs einer Rolle (sortiert, für DB/JSON)."""
    return sorted(p.value for p in ROLE_DEFAULT_PERMISSIONS.get(role, frozenset()))


def normalize_permissions(
    raw: object,
    role: UserRole | None = None,
    *,
    granter: frozenset[Permission] | None = None,
) -> list[str]:
    """Eingabe (Liste von IDs) auf gültige Permission-IDs filtern.

    Admin (Ziel-Rolle) erhält immer ALLE Berechtigungen, unabhängig von der
    Eingabe. Unbekannte IDs werden verworfen. Ergebnis ist sortiert + dedupliziert.

    ``granter`` (Wurzel 3): die effektiven Rechte des VERGEBENDEN Nutzers. Ist er
    gesetzt, wird die Eingabe zusätzlich darauf geklemmt — niemand kann ein Recht
    vergeben, das er selbst nicht hat (Privilege-Escalation). Nur ein Admin
    (granter == _ALL) darf uneingeschränkt vergeben.
    """
    if role is UserRole.admin:
        return sorted(p.value for p in _ALL)
    valid = {p.value for p in Permission}
    if not isinstance(raw, (list, tuple, set, frozenset)):
        return []
    picked = {str(x) for x in raw if str(x) in valid}
    if granter is not None:
        allowed = {p.value for p in granter}
        picked &= allowed
    return sorted(picked)


# Dach-Recht des PM-Moduls: ohne ACCESS_PM_FEATURES ist das GESAMTE PM-Modul
# dicht — jedes pm_*-Recht wird unwirksam, egal ob es einzeln gesetzt ist. Der
# Posteingang lebt im PM-Modul (pm_chat), die inbox_*-Rechte hängen an pm_chat
# und fallen damit automatisch mit. Ein Hauptschalter, keine 30 Einzelpflege.
def _pm_child_permissions() -> frozenset[Permission]:
    return frozenset(
        p for p in Permission if p.value.startswith("pm_") or p.value.startswith("inbox_")
    )


_PM_CHILDREN: frozenset[Permission] = _pm_child_permissions()


def effective_permissions(role: UserRole | None, stored: object) -> frozenset[Permission]:
    """Tatsächliche Berechtigungen eines Nutzers (Admin = alle).

    Wendet das PM-Dach an: fehlt ACCESS_PM_FEATURES, werden alle PM-Kind-Rechte
    (pm_*, inbox_*) entfernt — der Entzug des Dach-Rechts sperrt das komplette
    PM-Modul, serverseitig wie in der UI (Wurzel 3/5)."""
    if role is UserRole.admin:
        return _ALL
    if not isinstance(stored, (list, tuple, set, frozenset)):
        return frozenset()
    out: set[Permission] = set()
    for x in stored:
        try:
            out.add(Permission(str(x)))
        except ValueError:
            continue
    if Permission.ACCESS_PM_FEATURES not in out:
        out -= _PM_CHILDREN
    return frozenset(out)


def has_permission(role: UserRole | None, stored: object, perm: Permission) -> bool:
    return perm in effective_permissions(role, stored)


def has_pm_access(role: UserRole | None, stored: object) -> bool:
    """Darf der Nutzer überhaupt ins PM-Modul (Dach-Recht ACCESS_PM_FEATURES)?

    Admin immer. Sonst nur, wenn das Dach gesetzt ist. Verbindet die beiden
    Rechtesysteme: PM-Endpunkte/UI, die an einer Rollen-Capability (VIEW_CALENDAR,
    MANAGE_TASKS …) hängen, müssen ZUSÄTZLICH dieses Dach verlangen — sonst wirkt
    der Entzug im Rechte-Dialog nicht (die Capability bleibt ja rollenbasiert)."""
    return has_permission(role, stored, Permission.ACCESS_PM_FEATURES)
