"""Tests für den zentralen Gast-Masking-Helper (DSGVO-Daten-Split §4)."""
from src.features.auth.granular_permissions import (
    ROLE_DEFAULT_PERMISSIONS,
    Permission,
    effective_permissions,
)
from src.features.auth.guest_masking import mask_for
from src.features.auth.permissions import (
    Capability,
    capabilities_for,
    effective_capabilities,
    is_pm_capability,
    pm_umbrella_applies,
)
from src.features.auth.schemas import UserRole


def _perms(*ids: str) -> frozenset[Permission]:
    return frozenset(Permission(i) for i in ids)


def test_admin_sees_everything_despite_hide_prices() -> None:
    # Admin = alle Permissions (inkl. HIDE_PRICES als Opt-out), sieht trotzdem alles.
    perms = effective_permissions(UserRole.admin, [])
    m = mask_for(UserRole.admin, perms)
    assert m.full_name and m.contact and m.amounts and m.source
    assert m.name("Anna Müller") == "Anna Müller"
    assert m.amount(250.0) == 250.0


def test_no_perms_masks_all() -> None:
    m = mask_for(UserRole.owner, frozenset())
    assert not (m.full_name or m.contact or m.amounts or m.source)
    assert m.name("Anna Müller") == "Anna"     # nur Vorname
    assert m.contact_value("a@x.de") is None
    assert m.amount(250.0) is None
    assert m.source_value("Booking.com") is None


def test_view_guest_name_unlocks_full_name_only() -> None:
    m = mask_for(UserRole.staff, _perms("view_guest_name"))
    assert m.name("Anna Müller") == "Anna Müller"
    assert m.contact_value("a@x.de") is None    # Kontakt weiter verborgen
    assert m.amount(250.0) is None              # Betrag weiter verborgen


def test_amounts_need_positive_total_permission() -> None:
    # Beträge sichtbar nur mit pm_booking_total …
    assert mask_for(UserRole.staff, _perms("pm_booking_total")).amount(99.0) == 99.0
    # … und nicht, wenn HIDE_PRICES zusätzlich gesetzt ist.
    blocked = mask_for(UserRole.staff, _perms("pm_booking_total", "hide_prices"))
    assert blocked.amount(99.0) is None


def test_first_name_only_handles_empty() -> None:
    m = mask_for(UserRole.owner, frozenset())
    assert m.name(None) is None
    assert m.name("") is None
    assert m.name("Cher") == "Cher"


# --- PM-Dach (access_pm_features) ------------------------------------------

def test_pm_umbrella_removes_all_pm_children_when_dach_missing() -> None:
    # Ohne access_pm_features fallen ALLE pm_*/inbox_*-Rechte weg, auch wenn
    # sie einzeln gesetzt sind — der Entzug des Dachs sperrt das PM-Modul.
    stored = [
        "pm_chat", "pm_guest_details", "pm_booking_total", "inbox_view_all",
        "edit_property", "owner_reporting",  # Nicht-PM bleibt
    ]
    eff = {p.value for p in effective_permissions(UserRole.co_admin, stored)}
    assert "pm_chat" not in eff
    assert "pm_guest_details" not in eff
    assert "pm_booking_total" not in eff
    assert "inbox_view_all" not in eff
    # Nicht-PM-Rechte unberührt.
    assert "edit_property" in eff
    assert "owner_reporting" in eff


def test_pm_umbrella_keeps_children_when_dach_present() -> None:
    stored = ["access_pm_features", "pm_chat", "pm_guest_details", "inbox_reply"]
    eff = {p.value for p in effective_permissions(UserRole.co_admin, stored)}
    assert {"access_pm_features", "pm_chat", "pm_guest_details", "inbox_reply"} <= eff


def test_pm_umbrella_admin_always_full() -> None:
    # Admin bekommt immer alle Rechte, unabhängig vom Dach.
    eff = effective_permissions(UserRole.admin, [])
    assert Permission.PM_CHAT in eff
    assert Permission.ACCESS_PM_FEATURES in eff


# --- PM-Dach auf Capability-Ebene: gilt NICHT für owner ---------------------
# Der Eigentümer sah im Portal „Kein Zugriff auf das PM-Modul." und eine leere
# Objektliste, weil VIEW_CALENDAR eine PM-Capability ist und das Dach
# (ACCESS_PM_FEATURES) auch auf ihn angewandt wurde. Er kann das Dach
# konstruktiv nie besitzen (_OWNER enthält es bewusst nicht), also entzog ihm
# die Brücke seine einzige PM-Capability. Das Dach gilt nur für die PMS-Rollen.

def test_pm_dach_gilt_nicht_fuer_owner() -> None:
    # Ohne Dach behält der Eigentümer VIEW_CALENDAR — sonst ist /portal dicht.
    caps = effective_capabilities(UserRole.owner, has_pm_access=False)
    assert Capability.VIEW_CALENDAR in caps
    assert caps == capabilities_for(UserRole.owner)  # exakt sein Rollen-Set
    assert not pm_umbrella_applies(UserRole.owner)


def test_owner_gewinnt_durch_die_ausnahme_nichts_dazu() -> None:
    # §4.2: read-only. Die Ausnahme darf ihm keine Schreib-/Finanz-Capability
    # verschaffen — sie hebt nur den Abzug auf, sie addiert nicht.
    caps = effective_capabilities(UserRole.owner, has_pm_access=False)
    for verboten in (
        Capability.MANAGE_CALENDAR,
        Capability.MANAGE_TASKS,
        Capability.MANAGE_PROPERTIES,
        Capability.VIEW_FINANCES,
    ):
        assert verboten not in caps


def test_pm_dach_bleibt_fuer_pms_rollen_wirksam() -> None:
    # Der Entzug muss für co_admin/staff/cleaner weiter greifen, sonst wäre der
    # PM-Entzug im Rechte-Dialog entwertet. Geprüft wird je Rolle an DEREN
    # eigenen PM-Capabilities (staff/cleaner haben VIEW_CALENDAR gar nicht,
    # sondern VIEW_OWN_TASKS) — ohne Dach müssen sie alle verschwinden.
    for rolle in (UserRole.co_admin, UserRole.staff, UserRole.cleaner):
        assert pm_umbrella_applies(rolle)
        mit = effective_capabilities(rolle, has_pm_access=True)
        ohne = effective_capabilities(rolle, has_pm_access=False)
        pm_der_rolle = {c for c in mit if is_pm_capability(c)}
        assert pm_der_rolle  # jede dieser Rollen hat PM-Fläche
        assert not any(is_pm_capability(c) for c in ohne)
        assert ohne == mit - pm_der_rolle
        assert ohne < mit


def test_pm_dach_entzieht_co_admin_den_kalender() -> None:
    # VIEW_CALENDAR ist der Kern des Entzugs bei den PMS-Rollen, die ihn haben.
    assert Capability.VIEW_CALENDAR in effective_capabilities(
        UserRole.co_admin, has_pm_access=True
    )
    assert Capability.VIEW_CALENDAR not in effective_capabilities(
        UserRole.co_admin, has_pm_access=False
    )


def test_pm_dach_unbekannte_rolle_fail_closed() -> None:
    # Wurzel 5: unbekannte/fehlende Rolle → Dach greift UND leere Menge.
    assert pm_umbrella_applies(None)
    assert pm_umbrella_applies("hausmeister")
    assert effective_capabilities(None, has_pm_access=False) == frozenset()
    assert effective_capabilities("hausmeister", has_pm_access=False) == frozenset()
    # Auch mit Dach bleibt eine unbekannte Rolle leer.
    assert effective_capabilities("hausmeister", has_pm_access=True) == frozenset()


def test_owner_standard_bleibt_vollstaendig_wirksam() -> None:
    """Regression: gespeichert == wirksam, egal wie viele es sind.

    Ergänzt `test_owner_standard_wirkt_vollstaendig` weiter unten (dieselbe
    Regel, dort namentlich geprüft) um genau das, was live gemessen wurde:
    „gespeichert 6 -> wirksam 2". Fiele je ein Recht aus dem Standard, ohne
    dass jemand es merkt, sagt es dieser Test.

    KEINE feste Anzahl mehr (09.09.2026, beim Zufügen von OWNER_CHAT): Die
    Zahl 6 war eine Momentaufnahme, kein Schutz — sie brach bei jedem neuen
    Eigentümer-Recht, ohne je den Fehler zu finden, um den es geht. Geprüft
    wird die REGEL: was im Standard steht, muss auch wirken, und der Standard
    darf nicht leer laufen.

    Die Gegenprobe für staff/co_admin/cleaner steht ebenfalls unten
    (`test_permission_dach_bleibt_fuer_pms_rollen_wirksam`) — der Entzug des
    PM-Zugriffs bleibt für die PMS-Rollen voll wirksam.
    """
    gespeichert = ROLE_DEFAULT_PERMISSIONS[UserRole.owner]
    assert gespeichert, "Eigentümer ohne Standardrechte wäre ein leeres Portal"
    assert effective_permissions(UserRole.owner, list(gespeichert)) == gespeichert


def test_neue_owner_faehigkeiten_haengen_nicht_am_pm_dach() -> None:
    """VIEW_PROPERTY_AREA/VIEW_OCCUPANCY_STATS sind KEINE PM-Capabilities.

    Stünden sie in `_PM_CAPABILITIES`, würden sie einem co_admin ohne Dach
    entzogen — und einem owner, sobald die Dach-Ausnahme je fiele.
    """
    assert not is_pm_capability(Capability.VIEW_PROPERTY_AREA)
    assert not is_pm_capability(Capability.VIEW_OCCUPANCY_STATS)
    caps = effective_capabilities(UserRole.owner, has_pm_access=False)
    assert Capability.VIEW_PROPERTY_AREA in caps
    assert Capability.VIEW_OCCUPANCY_STATS in caps


def test_view_calendar_bleibt_pm_capability() -> None:
    # Die Ausnahme sitzt an der ROLLE, nicht an der Capability: VIEW_CALENDAR
    # muss PM-Capability bleiben, sonst verlöre staff/co_admin den Entzug.
    assert is_pm_capability(Capability.VIEW_CALENDAR)


# --- PM-Dach auf PERMISSION-Ebene: dieselbe Rollen-Ausnahme -----------------
# Die Regel stand nur auf der Capability-Ebene. `effective_permissions` wandte
# das Dach stumpf auf jede Rolle an, also auch auf `owner` — der es
# konstruktiv nie besitzen kann. Live am 23.08.2026: von den sechs
# gespeicherten Eigentümer-Rechten wirkten zwei. Die vier verschluckten
# (pm_property_area, pm_photo_album, pm_view_property_images,
# pm_nonrevenue_charts) standen im Rechte-Dialog als gesetzt da und taten
# nichts. Beide Ebenen müssen dieselbe Ausnahme kennen, sonst driften sie
# wieder auseinander.

def test_owner_standard_wirkt_vollstaendig() -> None:
    gespeichert = sorted(p.value for p in ROLE_DEFAULT_PERMISSIONS[UserRole.owner])
    wirksam = effective_permissions(UserRole.owner, gespeichert)
    assert {p.value for p in wirksam} == set(gespeichert)
    # Namentlich die vier, die vorher verschwanden:
    for p in (
        Permission.PM_PROPERTY_AREA,
        Permission.PM_PHOTO_ALBUM,
        Permission.PM_VIEW_PROPERTY_IMAGES,
        Permission.PM_NONREVENUE_CHARTS,
    ):
        assert p in wirksam


def test_owner_gewinnt_auf_permission_ebene_nichts_dazu() -> None:
    # Die Ausnahme hebt nur den Abzug auf. Ein Recht, das nicht gespeichert
    # ist, darf sie nicht herbeizaubern (§4.3: keine Finanzdaten).
    wirksam = effective_permissions(UserRole.owner, ["pm_photo_album"])
    assert wirksam == _perms("pm_photo_album")
    for verboten in (
        Permission.PM_REVENUE_CHARTS,
        Permission.PM_BOOKING_TOTAL,
        Permission.PM_DETAILED_PAYMENTS,
    ):
        assert verboten not in wirksam


def test_permission_dach_bleibt_fuer_pms_rollen_wirksam() -> None:
    # Der Entzug muss für die PMS-Rollen greifen: ohne ACCESS_PM_FEATURES fällt
    # jedes pm_*/inbox_*-Recht, egal wie viele Häkchen gesetzt sind.
    for rolle in (UserRole.co_admin, UserRole.staff, UserRole.cleaner):
        gespeichert = [
            p.value
            for p in ROLE_DEFAULT_PERMISSIONS[rolle]
            if p is not Permission.ACCESS_PM_FEATURES
        ]
        wirksam = {p.value for p in effective_permissions(rolle, gespeichert)}
        assert not any(
            i.startswith("pm_") or i.startswith("inbox_") for i in wirksam
        ), rolle
        # Was nicht am Dach hängt, bleibt: sonst wäre der Entzug zu breit.
        assert wirksam == {
            i for i in gespeichert
            if not (i.startswith("pm_") or i.startswith("inbox_"))
        }


def test_permission_dach_unbekannte_rolle_fail_closed() -> None:
    # Wurzel 5: unbekannte/fehlende Rolle → Dach greift, pm_* fällt.
    for rolle in (None, "hausmeister"):
        wirksam = {
            p.value
            for p in effective_permissions(rolle, ["pm_photo_album", "owner_reporting"])
        }
        assert wirksam == {"owner_reporting"}, rolle
