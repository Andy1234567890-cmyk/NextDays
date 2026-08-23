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

from .granular_permissions import pm_umbrella_applies
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
    # Bewertungen (Portale + myBestDays)
    VIEW_REVIEWS = "view_reviews"
    MANAGE_REVIEWS = "manage_reviews"   # antworten, Gast bewerten, Automatik
    # Finanzen / Reports
    VIEW_FINANCES = "view_finances"
    VIEW_OWNER_REPORTS = "view_owner_reports"
    # Eigentümer-spezifisch
    # Objektbereich: Stammdaten/Beschreibung/Ausstattung + Bilder + Fotoalbum
    # SEINER Objekte, lesend. Deckt die drei granularen Rechte
    # pm_property_area, pm_view_property_images und pm_photo_album ab — sie
    # zeigen dieselbe Fläche in drei Ausschnitten, nicht drei Fähigkeiten.
    VIEW_PROPERTY_AREA = "view_property_area"
    # Auswertungen OHNE Geldbezug (Belegung, Auslastung, Aufenthaltsdauer,
    # Vorlaufzeit). Gegenstück zu VIEW_FINANCES/VIEW_OWNER_REPORTS, die der
    # Eigentümer für die Umsatzsicht braucht und die hier bewusst fehlen.
    VIEW_OCCUPANCY_STATS = "view_occupancy_stats"
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
    # Externe Verbindungen (MCP-Connector)
    #
    # Eine Verbindung gibt Gastdaten an einen Dienst AUSSERHALB unserer
    # Systeme heraus (z. B. claude.ai) und ist damit datenschutzrechtlich die
    # Weisung des Verantwortlichen, in ein Drittland zu übermitteln
    # (Art. 28 Abs. 3 lit. a DSGVO). Eine solche Weisung kann nur erteilen,
    # wer den Betrieb vertritt — nicht jeder, der ein Login hat. Ohne diese
    # Trennung würde eine Reinigungskraft, die ihr PRIVATES Konto verbindet,
    # eine Übermittlung ohne Weisung auslösen; nach Art. 28 Abs. 10 wären
    # dann WIR für sie verantwortlich.
    #
    # Eigene Fähigkeit statt MANAGE_TENANT, damit ein Betrieb sie gezielt
    # vergeben kann, ohne die gesamte Mandantenverwaltung mitzugeben.
    MANAGE_CONNECTIONS = "manage_connections"


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
    # Dieselbe Implikation für die Vertretung: `accept`/`decline` hängen an
    # REQUEST_SUBSTITUTE. Ohne sie konnte ein co_admin eine Vertretungsanfrage
    # seines Teams weder annehmen noch ablehnen — die Anfrage blieb offen
    # liegen, obwohl er derjenige ist, der operativ einspringt.
    Capability.REQUEST_SUBSTITUTE,
    Capability.MANAGE_CALENDAR,
    Capability.VIEW_CALENDAR,
    Capability.APPROVE_BLOCK,
    Capability.VIEW_REVIEWS,
    Capability.MANAGE_REVIEWS,
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
    # Der Objektbereich seiner eigenen Objekte (Stammdaten/Bilder/Fotoalbum)
    # und die Nicht-Umsatz-Auswertungen. Beide read-only; die zugehörigen
    # granularen Rechte (pm_property_area, pm_view_property_images,
    # pm_photo_album, pm_nonrevenue_charts) stehen im owner-Standard.
    Capability.VIEW_PROPERTY_AREA,
    Capability.VIEW_OCCUPANCY_STATS,
    # Bewertungen SEINER Objekte lesen — antworten darf er nicht (§4.2 read-only),
    # deshalb bewusst ohne MANAGE_REVIEWS.
    Capability.VIEW_REVIEWS,
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
    Capability.VIEW_REVIEWS,
    Capability.MANAGE_REVIEWS,
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


# --- Familienzugänge des Eigentümers (0389) ---------------------------------
# Ein Ferienhaus gehört einer Familie. Der Eigentümer lädt Angehörige und
# Freunde mit EIGENEM Login ein (statt sein Passwort zu teilen, was jeden
# Vorgang urheberlos machte) und legt je Person und Objekt fest, was sie darf.
#
# Wie bei den Co-Gastgebern eine Matrix statt einer Rolle — hier aus zwei
# zusätzlichen Gründen:
#   * `user_role` ist global. `_PM_UMBRELLA_ROLES` (unten) enthält `owner`
#     bewusst NICHT; eine neue owner-nahe Rolle, die man dort vergisst,
#     verlöre VIEW_CALENDAR und das Portal antwortete 403.
#   * Die Stufe ist PRO OBJEKT verschieden: die Tochter darf am Ferienhaus
#     mitreden, am zweiten Objekt des Vaters nicht. Eine Rolle am Nutzer kann
#     das konstruktiv nicht.
# Ein Familienmitglied ist deshalb `role='owner'`; was es DARF, steht hier.

# Nutzung: sehen, wann das Haus frei ist, und Zeiten für sich beantragen.
# Der Antrag geht NICHT direkt an die Agentur, sondern erst an den Eigentümer
# (block_requests.owner_freigabe, 0389).
_FAMILIE_NUTZUNG: frozenset[Capability] = frozenset({
    Capability.VIEW_CALENDAR,
    Capability.REQUEST_BLOCK,
    Capability.MANAGE_NOTIFICATION_PREFS,
    # Nur Vorname/Belegungszeit (§4.2) — wer wann im Haus ist, gehört zur
    # Nutzungsplanung; der volle Gastdatensatz nicht.
    Capability.VIEW_GUEST_LIMITED,
    # Das HAUS, kein Geld: Wer es nutzt, darf sehen, wie es aussieht und was
    # drin ist (Bilder, Ausstattung, Adresse). Eine Tochter, die im Juli
    # anreist, muss wissen, ob eine Spülmaschine da ist — dafür braucht sie
    # keine Freigabe des Vaters, und die Angabe verrät nichts über das
    # Geschäft.
    Capability.VIEW_PROPERTY_AREA,
})

# Nutzung + Berichte: zusätzlich Umsatz, Abrechnung, Auszahlung.
#
# Diese Stufe ist bewusst NICHT die Voreinstellung. Umsatz und Auszahlung sind
# Geschäftsdaten des Eigentümers, keine Familienangelegenheit — ein Neffe, der
# eine Woche im Juli möchte, braucht dafür keinen Blick auf den Jahresumsatz.
# Wer sie vergeben will, schaltet sie bewusst zu (Art. 25 Abs. 2 DSGVO).
_FAMILIE_NUTZUNG_BERICHTE: frozenset[Capability] = _FAMILIE_NUTZUNG | frozenset({
    Capability.VIEW_OWNER_REPORTS,
    # WARUM VIEW_OCCUPANCY_STATS NICHT IN `_FAMILIE_NUTZUNG` STEHT:
    # Auslastung ist keine Nutzungsinformation, sondern die GESCHÄFTSLEISTUNG
    # des Betriebs. „Belegt an 214 von 365 Nächten" ist die Kennzahl, an der
    # sich Vermarktung und Provision messen lassen; zusammen mit dem Grundpreis
    # ist daraus der Jahresumsatz zu schätzen, den die Stufe `nutzung` über
    # `VIEW_OWNER_REPORTS` gerade NICHT bekommt. Eine Sperre, die man durch
    # eine Nebenkennzahl umgehen kann, ist keine.
    # Es gilt dieselbe Begründung wie oben für die Berichte: Wer sie vergeben
    # will, schaltet sie bewusst zu (Art. 25 Abs. 2 DSGVO) — der Neffe, der
    # eine Woche im Juli möchte, braucht sie nicht.
    Capability.VIEW_OCCUPANCY_STATS,
})

OWNER_FAMILY_CAPABILITIES: dict[str, frozenset[Capability]] = {
    "nutzung": _FAMILIE_NUTZUNG,
    "nutzung_berichte": _FAMILIE_NUTZUNG_BERICHTE,
}


def owner_family_capabilities_for(access: str | None) -> frozenset[Capability]:
    """Fähigkeiten einer Familien-Zugriffsstufe.

    Fail-closed (Wurzel 5): unbekannte oder fehlende Stufe → LEERE Menge.
    Ein Tippfehler in der DB darf nicht stillschweigend Rechte vergeben.
    """
    if not access:
        return frozenset()
    return OWNER_FAMILY_CAPABILITIES.get(access, frozenset())


def owner_family_has_capability(access: str | None, cap: Capability) -> bool:
    return cap in owner_family_capabilities_for(access)


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


# Fähigkeiten, deren Guard die Rolle aus der DATENBANK lesen MUSS (Wurzel 7).
#
# Der rollenbasierte Schnellpfad in `require_permission` prüft `ctx.role` aus
# dem JWT — eine entzogene Rolle gilt dort bis zum Token-Ablauf weiter. Für die
# meisten Fähigkeiten ist das vertretbar (der Schaden endet mit dem Token). Für
# eine Fähigkeit, die Gastdaten dauerhaft an einen EXTERNEN Dienst freigibt,
# ist es das nicht: die erteilte Verbindung überlebt den Token um 30 Tage
# (Refresh-Token), ein entzogenes Recht wirkt also nicht mehr.
#
# Kein PM-Dach für diese Fähigkeiten — sie sollen nicht am PM-Zugriff hängen,
# nur an einer FRISCHEN Rollenprüfung.
_DB_ROLLE_ERFORDERLICH: frozenset[Capability] = frozenset({
    Capability.MANAGE_CONNECTIONS,
    # MANAGE_STAFF gehört aus demselben Grund dazu: sie legt NUTZER an und
    # vergibt Rechte (`/auth/invite`, Eigentümer-Portalzugang). Eine
    # rechtevergebende Operation an einer bis zu einer Stunde veralteten
    # JWT-Rolle zu hängen heißt, dass ein gerade herabgestufter Verwalter noch
    # Konten mit Rechten anlegen kann — und die überleben den Token.
    Capability.MANAGE_STAFF,
})


def braucht_db_rolle(cap: Capability) -> bool:
    """Muss der Guard die Rolle frisch aus der DB lesen statt aus dem JWT?"""
    return cap in _DB_ROLLE_ERFORDERLICH


# Das PM-Dach und die Rollen, für die es gilt, leben jetzt EINE Ebene tiefer
# (granular_permissions.py) — dort, wo ACCESS_PM_FEATURES und die pm_*-Kinder
# definiert sind. Hier wird die Regel nur weiterverwendet, damit die
# Capability-Ebene und die Permission-Ebene nicht zwei Meinungen haben können.
#
# Genau dieser Widerspruch war der Fehler: `pm_umbrella_applies` schloss
# `owner` aus dem Dach aus, `effective_permissions` wandte es trotzdem auf ihn
# an und löschte ihm vier seiner sechs Standardrechte (pm_property_area,
# pm_photo_album, pm_view_property_images, pm_nonrevenue_charts) — Rechte, die
# im Rechte-Dialog gesetzt aussahen und nie wirkten.


def effective_capabilities(
    role: UserRole | str | None,
    *,
    has_pm_access: bool,
    family_access: str | None = None,
) -> frozenset[Capability]:
    """Tatsächliche Fähigkeiten eines Nutzers = Rollen-Capabilities, aber ohne
    die PM-Capabilities, wenn das PM-Dach fehlt.

    Eine Quelle der Wahrheit für Guard (require_permission) UND UI (me →
    Sidebar-Gating). Admin hat immer das Dach (effective_permissions gibt ihm
    ACCESS_PM_FEATURES), verliert hier also nichts. Für Rollen, die das Dach nie
    tragen können (``pm_umbrella_applies`` → False, aktuell ``owner``), wird es
    gar nicht erst angewandt — sie behalten ihr Rollen-Set unverändert und
    gewinnen dadurch nichts hinzu.

    ``family_access`` ist die Stufe eines FAMILIENZUGANGS (0389). Sie DECKELT
    das Ergebnis: ein Familienmitglied trägt in ``users`` die Rolle ``owner``,
    soll aber nur können, was seine Stufe hergibt.

    WARUM DAS HIER STEHT UND NICHT NUR IM PORTAL: die abgestufte Prüfung
    (``owner_family_has_capability``) gab es ausschließlich in
    ``public_portal`` — jeder andere Slice (properties, calendar, reservations,
    reviews, pricing, property_dossier, tasks) scopte allein über
    ``owner_property_assignments`` und gab dem Familienmitglied die VOLLEN
    Eigentümer-Fähigkeiten. Live tragen alle drei Mitglieder die höchste Stufe,
    weshalb es nicht auffiel; ein Mitglied der Stufe ``nutzung`` hätte
    ``VIEW_OWNER_REPORTS`` überall außer im Portal gehabt.

    Deckeln statt ersetzen: die Stufe kann nie MEHR geben als die Rolle. Sonst
    wäre ein Familienzugang ein Weg, Eigentümer-Grenzen zu überschreiten."""
    caps = capabilities_for(role)
    if not (has_pm_access or not pm_umbrella_applies(role)):
        caps = caps - _PM_CAPABILITIES
    if family_access is not None:
        # Schnittmenge: fail-closed über `owner_family_capabilities_for`, das
        # bei unbekannter Stufe die LEERE Menge liefert.
        caps = caps & owner_family_capabilities_for(family_access)
    return caps
