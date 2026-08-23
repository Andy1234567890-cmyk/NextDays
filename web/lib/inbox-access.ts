// Posteingang-Zugriffsmodell im Frontend (Spiegel von apps/api inbox/authz.py).
// Leitet aus den effektiven Permissions des Nutzers (account.permissions) die
// drei Achsen ab: Scope (alle/zugewiesen), Aktionen, Feld-Maske. Single Source
// of Truth sind die Permission-IDs — identisch zum Backend.
//
// Das PM-Dach (`access_pm_features`) wird hier NICHT erneut geprüft, und das
// ist richtig: `/auth/me` liefert `effective_permissions` (auth/service.py),
// das Dach ist also schon angewandt, bevor diese Funktion rechnet. Ein
// `pm_*`-Recht ohne Dach kommt hier nie an. Nur der Rechte-Dialog arbeitet mit
// `stored_permissions` — dem UNGEFILTERTEN Stand — und muss das Dach selbst
// abbilden (components/konto/pm-dach.ts).
import type { UserRole } from "@/lib/account";

export type InboxAccess = {
  canAccess: boolean; // pm_chat (admin immer)
  scope: "all" | "assigned";
  canReply: boolean;
  canAssign: boolean;
  canManageConfig: boolean;
  // Feld-Maske (gleiche Regeln wie guest_masking.py):
  fullName: boolean;
  contact: boolean;
  amounts: boolean;
  source: boolean;
};

// Maskierte Vorschau: nur Vorname (erstes Token), wenn kein voller Name erlaubt.
export function firstNameOnly(name: string | null | undefined): string | null {
  if (!name) return null;
  const token = name.trim().split(" ")[0];
  return token || null;
}

export function inboxAccessFor(
  role: UserRole | null,
  permissions: string[],
): InboxAccess {
  const has = (id: string) => permissions.includes(id);
  const isAdmin = role === "admin";
  // Beträge: positive Berechtigung (pm_booking_total) UND nicht hide_prices;
  // Admin sieht trotz hide_prices alles.
  const amounts = isAdmin || (has("pm_booking_total") && !has("hide_prices"));
  return {
    canAccess: has("pm_chat"),
    scope: has("inbox_view_all") ? "all" : "assigned",
    canReply: has("inbox_reply"),
    canAssign: has("inbox_assign"),
    canManageConfig: has("inbox_manage_config"),
    fullName: has("view_guest_name"),
    contact: has("view_guest_contact"),
    amounts,
    source: has("view_booking_source"),
  };
}
