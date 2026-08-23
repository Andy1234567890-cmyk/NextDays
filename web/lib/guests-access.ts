// Gästekarte-Zugriffsmodell im Frontend (Spiegel von guest_masking.py /
// guests-Service). Leitet aus den effektiven Permissions des Nutzers ab, welche
// Felder/Aktionen sichtbar sind. Single Source of Truth: die Permission-IDs.
//
// Das PM-Dach (`access_pm_features`) wird hier NICHT erneut geprüft, und das
// ist richtig: `/auth/me` liefert `effective_permissions` (auth/service.py),
// das Dach ist also schon angewandt, bevor diese Funktion rechnet. Ein
// `pm_*`-Recht ohne Dach kommt hier nie an. Nur der Rechte-Dialog arbeitet mit
// `stored_permissions` — dem UNGEFILTERTEN Stand — und muss das Dach selbst
// abbilden (components/konto/pm-dach.ts).
import type { UserRole } from "@/lib/account";

export type GuestAccess = {
  canAccess: boolean; // pm_guest_details (admin immer)
  canEdit: boolean; // edit_guest — Stammdaten/Sub-Ressourcen bearbeiten
  fullName: boolean; // view_guest_name
  contact: boolean; // view_guest_contact
  amounts: boolean; // pm_booking_total & !hide_prices
  idDocs: boolean; // view_guest_id_docs
  source: boolean; // view_booking_source
};

export function guestAccessFor(
  role: UserRole | null,
  permissions: string[],
): GuestAccess {
  const has = (id: string) => permissions.includes(id);
  const isAdmin = role === "admin";
  return {
    canAccess: isAdmin || has("pm_guest_details"),
    canEdit: isAdmin || has("edit_guest"),
    fullName: isAdmin || has("view_guest_name"),
    contact: isAdmin || has("view_guest_contact"),
    amounts: isAdmin || (has("pm_booking_total") && !has("hide_prices")),
    idDocs: isAdmin || has("view_guest_id_docs"),
    source: isAdmin || has("view_booking_source"),
  };
}
