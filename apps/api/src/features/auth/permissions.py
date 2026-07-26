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
    MANAGE_SITE_CONFIG = "manage_site_config"  # White-Label-Branding + Custom-Domains
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
    MANAGE_NOTIFICATION_PREFS = "manage_notification_prefs"  # §4.2 SMS/E-Mail/aus
    # Mitarbeiter-spezifisch (§4.3)
    MANAGE_OWN_AVAILABILITY = "manage_own_availability"  # Urlaub/Verfügbarkeit
    REQUEST_SUBSTITUTE = "request_substitute"            # Vertretungs-Feature
    # Verwaltung / System (§4.1)
    RECEIVE_SYSTEM_ALERTS = "receive_system_alerts"      # System-Warnungen erhalten
    ASSIGN_STAFF_TO_PROPERTY = "assign_staff_to_property"  # Stamm-Mitarbeiter
    # Gäste-Daten
    VIEW_GUEST_FULL = "view_guest_full"      # voller Name + Preise
    VIEW_GUEST_LIMITED = "view_guest_limited"  # nur Vorname / Belegungszeit


# Volle Fähigkeiten (admin = alles).
_ALL: frozenset[Capability] = frozenset(Capability)

# Co-Admin (§4.1): operative Rechte Eigentümer+Mitarbeiter kombiniert,
# erhält System-Warnungen, kann Mitarbeiter Häusern zuweisen.
_CO_ADMIN: frozenset[Capability] = frozenset({
    Capability.MANAGE_PROPERTIES,
    Capability.MANAGE_INVENTORY,
    Capability.MANAGE_STAFF,
    Capability.MANAGE_OWNERS,
    Capability.MANAGE_TASKS,
    # Wer Aufgaben VERWALTET, kann per Definition auch seine EIGENEN sehen und
    # abschließen — Detail/Complete hängen an VIEW_OWN_TASKS; ohne diese
    # Fähigkeit könnte co_admin den Aufgaben-Kalender öffnen, aber keine
    # einzelne Aufgabe. Die Implikation manage⊇own gehört ins Rollen-Set.
    Capability.VIEW_OWN_TASKS,
    Capability.MANAGE_CALENDAR,
    Capability.VIEW_CALENDAR,
    Capability.APPROVE_BLOCK,
    Capability.VIEW_GUEST_FULL,
    Capability.RECEIVE_SYSTEM_ALERTS,
    Capability.ASSIGN_STAFF_TO_PROPERTY,
    Capability.MANAGE_SITE_CONFIG,  # gebrandete Buchungs-Site der Agentur pflegen
})

# Eigentümer (§4.2): Daten-Split, Sperrung beantragen, Zählerstände, Services
# buchen, Reports + eigenes Benachrichtigungsmenü.
_OWNER: frozenset[Capability] = frozenset({
    Capability.VIEW_CALENDAR,
    Capability.REQUEST_BLOCK,
    Capability.ADD_METER_READING,
    Capability.BOOK_SERVICES,
    Capability.VIEW_OWNER_REPORTS,
    Capability.MANAGE_NOTIFICATION_PREFS,
    Capability.VIEW_GUEST_LIMITED,  # nur Vorname, kein Gesamtpreis (§4.2)
})

# Mitarbeiter/Dienstleister (§4.3): operativ, eigene Verfügbarkeiten,
# Vertretung anfragen. KEINE Finanzen/Reports/Namen.
_STAFF: frozenset[Capability] = frozenset({
    Capability.VIEW_OWN_TASKS,
    Capability.MANAGE_INVENTORY,        # hausspezifische Inventarlisten
    Capability.MANAGE_OWN_AVAILABILITY,
    Capability.REQUEST_SUBSTITUTE,
    Capability.MANAGE_NOTIFICATION_PREFS,
    Capability.VIEW_GUEST_LIMITED,      # nur Belegungszeit, keine Namen (§4.3)
})

ROLE_CAPABILITIES: dict[UserRole, frozenset[Capability]] = {
    UserRole.admin: _ALL,
    UserRole.co_admin: _CO_ADMIN,
    UserRole.owner: _OWNER,
    UserRole.staff: _STAFF,
    UserRole.cleaner: _STAFF,  # cleaner = wie staff (operativ)
}


# --- Co-Gastgeber (Plattform-Marktplatz) ------------------------------------
# NICHT zu verwechseln mit den Rollen oben: Die gelten INNERHALB eines Tenants
# (Team-Modell, apps/web). Ein Co-Gastgeber ist tenant-FREMD und bekommt Rechte
# ausschließlich für EIN bestimmtes Objekt — deshalb keine Rolle, sondern eine
# eigene Matrix, die pro Zuordnung ausgewertet wird.
#
# Die drei Stufen bilden airbnb.com/help/article/1534 ab (abgerufen 2026-07-26).

# Vollzugriff: Objekt und Preise verwalten, Buchungen annehmen/ablehnen,
# Kalender bearbeiten, mit Gästen schreiben, Einnahmen einsehen.
_COHOST_FULL: frozenset[Capability] = frozenset({
    Capability.MANAGE_PROPERTIES,
    Capability.MANAGE_CALENDAR,
    Capability.VIEW_CALENDAR,
    Capability.MANAGE_TASKS,
    Capability.VIEW_OWN_TASKS,
    Capability.APPROVE_BLOCK,
    Capability.VIEW_GUEST_FULL,
    # Laut Doku sieht ein Vollzugriff-Co-Gastgeber das Earnings-Dashboard und
    # vergangene wie kommende Auszahlungen. Gesperrt ist nur das EINRICHTEN der
    # Auszahlungsdaten — das bleibt beim Eigentümer und hängt an
    # MANAGE_BILLING, das hier bewusst FEHLT.
    Capability.VIEW_FINANCES,
})

# Kalender + Nachrichten: Kalender SEHEN (nicht ändern), mit Gästen schreiben.
_COHOST_CALENDAR_MESSAGING: frozenset[Capability] = frozenset({
    Capability.VIEW_CALENDAR,
    Capability.VIEW_GUEST_FULL,  # Nachrichten setzen den Gastnamen voraus
})

# Nur Kalender: sehen, wann Gäste an- und abreisen. Keine Nachrichten, deshalb
# nur der eingeschränkte Gast-Blick (Vorname/Belegungszeit, §4).
_COHOST_CALENDAR: frozenset[Capability] = frozenset({
    Capability.VIEW_CALENDAR,
    Capability.VIEW_GUEST_LIMITED,
})

COHOST_CAPABILITIES: dict[str, frozenset[Capability]] = {
    "full": _COHOST_FULL,
    "calendar_messaging": _COHOST_CALENDAR_MESSAGING,
    "calendar": _COHOST_CALENDAR,
}


def cohost_capabilities_for(access: str | None) -> frozenset[Capability]:
    """Fähigkeiten einer Co-Gastgeber-Zugriffsstufe.

    Fail-closed (Wurzel 5): Eine unbekannte oder fehlende Stufe ergibt die
    LEERE Menge, nie ein Default-Set — sonst würde ein Tippfehler in der DB
    stillschweigend Rechte vergeben.
    """
    if not access:
        return frozenset()
    return COHOST_CAPABILITIES.get(access, frozenset())


def cohost_has_capability(access: str | None, cap: Capability) -> bool:
    return cap in cohost_capabilities_for(access)


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


# --- Brücke zwischen den zwei Rechtesystemen (Wurzel) -----------------------
# Die Rollen-Capabilities allein reichen nicht: das feingranulare PM-Dach
# (ACCESS_PM_FEATURES aus users.permissions) muss die PM-Capabilities freigeben.
# Sonst wirkt der Entzug des PM-Zugriffs im Rechte-Dialog NICHT auf die Bereiche,
# die nur an einer Rolle hängen (Kontrollzentrum, Buchungen, Aufgaben).
#
# PM-Capabilities = der operative Property-Management-Bereich. NICHT dabei:
# Stammdaten/Objekte (MANAGE_PROPERTIES), Eigentümer (MANAGE_OWNERS), Finanzen
# und die owner-spezifischen Fähigkeiten — die haben eigene Rechte und dürfen
# das Owner-Portal nicht mit sperren.
_PM_CAPABILITIES: frozenset[Capability] = frozenset({
    Capability.VIEW_CALENDAR,
    Capability.MANAGE_CALENDAR,
    Capability.MANAGE_TASKS,
    Capability.VIEW_OWN_TASKS,
})


def is_pm_capability(cap: Capability) -> bool:
    return cap in _PM_CAPABILITIES


def effective_capabilities(
    role: UserRole | str | None, *, has_pm_access: bool
) -> frozenset[Capability]:
    """Tatsächliche Fähigkeiten eines Nutzers = Rollen-Capabilities, aber ohne
    die PM-Capabilities, wenn das PM-Dach fehlt.

    Eine Quelle der Wahrheit für Guard (require_permission) UND UI (me →
    Sidebar-Gating). Admin hat immer das Dach (effective_permissions gibt ihm
    ACCESS_PM_FEATURES), verliert hier also nichts."""
    caps = capabilities_for(role)
    if has_pm_access:
        return caps
    return caps - _PM_CAPABILITIES


def first_name_only(full_name: str | None) -> str | None:
    """Nur den Vornamen (erstes Token) zurückgeben — DSGVO-Daten-Split (§4).

    Rollen ohne VIEW_GUEST_FULL sehen nur den Vornamen des Gastes, nie den
    vollen Namen. Leerer/None-Name bleibt None.
    """
    if not full_name:
        return None
    token = full_name.strip().split(" ", 1)[0]
    return token or None
