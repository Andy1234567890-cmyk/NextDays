"""Granulare Berechtigungs-Matrix (Lastenheft §4).

Statt nur rollenbasierter Guards (require_role) definiert dieses Modul
**Fähigkeiten (Capabilities)** und ordnet sie Rollen zu. So lassen sich
Endpoints feingranular schützen und die Matrix bleibt erweiterbar/toggle-fähig.

Die Default-Matrix bildet das Lastenheft ab:
- admin: alles
- co_admin: operative Rechte (Aufgaben, Hausdaten, Inventar, Stammdaten), aber
  keine Mandanten-/Plattform-Einstellungen
- owner: Eigentümer-Portal (Kalender lesen, Sperrung beantragen, Zählerstände
  anlegen, Dienstleistungen buchen, eigene Reports) — Daten-Split
- staff/cleaner: nur operative Smartphone-Ansicht (Aufgaben, Inventar, eigene
  Verfügbarkeiten) — keine Finanzen/Reports/Namen
"""
from enum import StrEnum

from .schemas import UserRole


class Capability(StrEnum):
    # Plattform / Mandant
    MANAGE_TENANT = "manage_tenant"
    MANAGE_BILLING = "manage_billing"
    # Stammdaten / Objekte
    MANAGE_PROPERTIES = "manage_properties"
    MANAGE_INVENTORY = "manage_inventory"
    MANAGE_STAFF = "manage_staff"
    MANAGE_OWNERS = "manage_owners"
    # Aufgaben
    MANAGE_TASKS = "manage_tasks"
    VIEW_OWN_TASKS = "view_own_tasks"
    # Kalender / Buchungen
    MANAGE_CALENDAR = "manage_calendar"
    VIEW_CALENDAR = "view_calendar"
    REQUEST_BLOCK = "request_block"
    APPROVE_BLOCK = "approve_block"
    # Finanzen / Reports
    VIEW_FINANCES = "view_finances"
    VIEW_OWNER_REPORTS = "view_owner_reports"
    # Eigentümer-spezifisch
    ADD_METER_READING = "add_meter_reading"
    BOOK_SERVICES = "book_services"
    # Gäste-Daten
    VIEW_GUEST_FULL = "view_guest_full"      # voller Name + Preise
    VIEW_GUEST_LIMITED = "view_guest_limited"  # nur Vorname / Belegungszeit


# Volle Fähigkeiten (admin = alles).
_ALL: frozenset[Capability] = frozenset(Capability)

_CO_ADMIN: frozenset[Capability] = frozenset({
    Capability.MANAGE_PROPERTIES,
    Capability.MANAGE_INVENTORY,
    Capability.MANAGE_STAFF,
    Capability.MANAGE_OWNERS,
    Capability.MANAGE_TASKS,
    Capability.MANAGE_CALENDAR,
    Capability.VIEW_CALENDAR,
    Capability.APPROVE_BLOCK,
    Capability.VIEW_GUEST_FULL,
})

_OWNER: frozenset[Capability] = frozenset({
    Capability.VIEW_CALENDAR,
    Capability.REQUEST_BLOCK,
    Capability.ADD_METER_READING,
    Capability.BOOK_SERVICES,
    Capability.VIEW_OWNER_REPORTS,
    Capability.VIEW_GUEST_LIMITED,  # nur Vorname, kein Gesamtpreis (§4.2)
})

_STAFF: frozenset[Capability] = frozenset({
    Capability.VIEW_OWN_TASKS,
    Capability.MANAGE_INVENTORY,     # hausspezifische Inventarlisten
    Capability.VIEW_GUEST_LIMITED,   # nur Belegungszeit, keine Namen (§4.3)
})

ROLE_CAPABILITIES: dict[UserRole, frozenset[Capability]] = {
    UserRole.admin: _ALL,
    UserRole.co_admin: _CO_ADMIN,
    UserRole.owner: _OWNER,
    UserRole.staff: _STAFF,
    UserRole.cleaner: _STAFF,  # cleaner = wie staff (operativ)
}


def capabilities_for(role: UserRole | str | None) -> frozenset[Capability]:
    """Fähigkeiten einer Rolle; leere Menge für unbekannte/fehlende Rolle."""
    if role is None:
        return frozenset()
    try:
        role_enum = UserRole(role)
    except ValueError:
        return frozenset()
    return ROLE_CAPABILITIES.get(role_enum, frozenset())


def has_capability(role: UserRole | str | None, cap: Capability) -> bool:
    return cap in capabilities_for(role)
