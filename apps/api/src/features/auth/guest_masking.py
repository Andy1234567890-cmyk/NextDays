"""Zentraler Gast-Daten-Maskierer (DSGVO-Daten-Split, Lastenheft §4).

EINE Wahrheit für die Feldsichtbarkeit von Gastdaten — genutzt von inbox,
reservations und dashboard. Welche Felder ein Nutzer sieht, hängt an seinen
feingranularen Lodgify-Berechtigungen (users.permissions), nicht an der Rolle:

- voller Name      ← VIEW_GUEST_NAME (sonst nur Vorname, erstes Token)
- E-Mail/Telefon   ← VIEW_GUEST_CONTACT (sonst None)
- Beträge          ← nicht HIDE_PRICES (sonst None)
- Kanal/OTA-Quelle ← VIEW_BOOKING_SOURCE (sonst None)

Fail-closed: ohne passende Berechtigung wird maskiert. Admin hat über
effective_permissions immer alle Berechtigungen → sieht alles.
"""
from dataclasses import dataclass
from typing import TYPE_CHECKING

from .lodgify_permissions import Permission
from .schemas import UserRole

if TYPE_CHECKING:
    from supabase import Client


@dataclass(frozen=True)
class GuestMask:
    """Aufgelöste Sichtbarkeit der Gast-Felder für einen Nutzer."""

    full_name: bool       # voller Gastname statt nur Vorname
    contact: bool         # E-Mail/Telefon sichtbar
    amounts: bool         # Beträge sichtbar
    source: bool          # Kanal/OTA-Herkunft sichtbar
    id_docs: bool         # Ausweisdokumente sichtbar (DSGVO-sensibel)

    def name(self, full_name: str | None) -> str | None:
        """Gastname gemäß Maske: voll oder nur Vorname (erstes Token)."""
        if self.full_name:
            return full_name
        return _first_name_only(full_name)

    def contact_value(self, value: str | None) -> str | None:
        return value if self.contact else None

    def amount(self, value: float | None) -> float | None:
        return value if self.amounts else None

    def source_value(self, value: str | None) -> str | None:
        return value if self.source else None

    def id_number(self, value: str | None) -> str | None:
        """Ausweisnummer: voll mit Berechtigung, sonst maskiert (••• 1234)."""
        if self.id_docs:
            return value
        if not value:
            return None
        tail = value[-4:] if len(value) >= 4 else value
        return f"••• {tail}"


def _first_name_only(full_name: str | None) -> str | None:
    if not full_name:
        return None
    token = full_name.strip().split(" ", 1)[0]
    return token or None


def mask_for(role: UserRole | str | None, perms: frozenset[Permission]) -> GuestMask:
    """Maske aus den effektiven Lodgify-Berechtigungen ableiten.

    `perms` muss bereits die effektiven Berechtigungen sein (effective_permissions,
    Admin = alle).

    Beträge sind fail-closed: sichtbar nur, wenn der Nutzer die positive
    Betrags-Berechtigung hat (PM_BOOKING_TOTAL) UND HIDE_PRICES NICHT gesetzt ist.
    So sehen owner/staff (ohne PM_BOOKING_TOTAL per Default) keine Beträge,
    während HIDE_PRICES jede Betrags-Berechtigung zusätzlich überstimmt.

    Admin ist ausgenommen: `effective_permissions` gibt admin ALLE IDs (inkl. des
    Opt-outs HIDE_PRICES), das soll ihm Beträge aber nicht verbergen.
    """
    is_admin = role is UserRole.admin or role == UserRole.admin.value
    amounts = is_admin or (
        Permission.PM_BOOKING_TOTAL in perms
        and Permission.HIDE_PRICES not in perms
    )
    return GuestMask(
        full_name=Permission.VIEW_GUEST_NAME in perms,
        contact=Permission.VIEW_GUEST_CONTACT in perms,
        amounts=amounts,
        source=Permission.VIEW_BOOKING_SOURCE in perms,
        id_docs=Permission.VIEW_GUEST_ID_DOCS in perms,
    )


def load_guest_mask(
    service_client: "Client | None", user_id: str | None
) -> GuestMask:
    """Effektive Gast-Maske eines Nutzers aus der DB laden (Quelle der Wahrheit).

    Das JWT kann veraltet sein → Rolle + permissions kommen aus `users`. Ohne
    Treffer/ohne Nutzer wird fail-closed maskiert (alles aus, nur Vorname).
    """
    from .lodgify_permissions import effective_permissions

    if service_client is None or not user_id:
        return mask_for(None, frozenset())
    res = (
        service_client.table("users")
        .select("role, permissions")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    row = res.data[0] if res.data else {}
    role_raw = row.get("role")
    try:
        role = UserRole(role_raw) if role_raw else None
    except ValueError:
        role = None
    perms = effective_permissions(role, row.get("permissions"))
    return mask_for(role, perms)
