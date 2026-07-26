"""Tests für den zentralen Gast-Masking-Helper (DSGVO-Daten-Split §4)."""
from src.features.auth.granular_permissions import (
    Permission,
    effective_permissions,
)
from src.features.auth.guest_masking import mask_for
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
