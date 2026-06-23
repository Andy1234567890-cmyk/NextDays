"""Zentrale Posteingang-Autorisierung (Enterprise-Achsen).

Löst aus Rolle + feingranularen Berechtigungen (users.permissions, Quelle der
Wahrheit aus der DB — nicht aus dem evtl. veralteten JWT) ein InboxAccess-Objekt
auf. Drei unabhängige Achsen (Lastenheft §4 / Enterprise-Inbox-Spec):

- Scope:   welche Threads sichtbar sind (alle ⟷ nur zugewiesene)
- Actions: was erlaubt ist (lesen ⟷ antworten ⟷ zuweisen ⟷ konfigurieren)
- Mask:    welche Gast-Felder sichtbar sind (zentraler guest_masking-Helper)

Admin hat über effective_permissions immer alle Berechtigungen.
"""
from dataclasses import dataclass
from typing import TYPE_CHECKING

from src.core.security import AuthContext
from src.features.auth.guest_masking import GuestMask, mask_for
from src.features.auth.lodgify_permissions import Permission, effective_permissions
from src.features.auth.schemas import UserRole

if TYPE_CHECKING:
    from supabase import Client


@dataclass(frozen=True)
class InboxAccess:
    can_access: bool          # PM_CHAT (admin immer True) — darf den Posteingang nutzen
    scope: str                # "all" | "assigned"
    can_reply: bool           # INBOX_REPLY
    can_assign: bool          # INBOX_ASSIGN
    can_manage_config: bool   # INBOX_MANAGE_CONFIG
    mask: GuestMask           # Feldsichtbarkeit der Gastdaten


def _access_from(role: UserRole | str | None, perms: frozenset[Permission]) -> InboxAccess:
    return InboxAccess(
        can_access=Permission.PM_CHAT in perms,
        scope="all" if Permission.INBOX_VIEW_ALL in perms else "assigned",
        can_reply=Permission.INBOX_REPLY in perms,
        can_assign=Permission.INBOX_ASSIGN in perms,
        can_manage_config=Permission.INBOX_MANAGE_CONFIG in perms,
        mask=mask_for(role, perms),
    )


def load_inbox_access(
    service_client: "Client | None", ctx: AuthContext
) -> InboxAccess:
    """InboxAccess eines Nutzers aus der DB laden (Rolle + permissions).

    Fail-closed: ohne Nutzer/ohne DB → kein Zugriff, assigned-Scope, alles maskiert.
    """
    if service_client is None or not ctx.user_id:
        return _access_from(None, frozenset())
    res = (
        service_client.table("users")
        .select("role, permissions")
        .eq("id", ctx.user_id)
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
    return _access_from(role, perms)
