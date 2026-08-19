// Posteingang-Zugriffsmodell (Mobile) — Spiegel von web/lib/inbox-access.ts und
// damit von apps/api/.../inbox/authz.py. Dieselben Permission-IDs, dieselben
// drei Achsen: Scope (alle/zugewiesen), Aktionen, Feld-Maske.
//
// WOFÜR ES HIER GEBRAUCHT WIRD: Die MASKIERUNG macht bereits der Server —
// `inbox/service.py` schickt Namen, Kontakt, Beträge und Quelle nur, wenn die
// Rolle sie sehen darf. Was der App fehlte, sind die AKTIONEN: sie zeigte jedem
// das Antwortfeld. Ein Mitarbeiter ohne `inbox_reply` tippt dann eine Antwort,
// drückt senden und bekommt erst dort einen Fehler — die Arbeit ist weg. Kein
// Datenleck, aber eine Oberfläche, die etwas verspricht, was sie nicht halten
// kann.
//
// Bewusst KEINE eigene Logik: dieselben IDs wie im Web, sonst driften die
// Antworten auf „darf ich das?" zwischen den Oberflächen auseinander.
import type { Me } from "@/contexts/AuthContext";

export type InboxAccess = {
  canAccess: boolean;
  scope: "all" | "assigned";
  canReply: boolean;
  canAssign: boolean;
  canManageConfig: boolean;
  // Feld-Maske — hier nur zur ANZEIGE-Entscheidung (Platzhalter statt leerem
  // Feld). Erzwungen wird sie serverseitig, nie hier.
  fullName: boolean;
  contact: boolean;
  amounts: boolean;
  source: boolean;
};

/** Fail-closed: ohne `me` gibt es nichts. */
export function inboxAccessFor(me: Me | null): InboxAccess {
  const permissions = me?.permissions ?? [];
  const has = (id: string) => permissions.includes(id);
  const isAdmin = me?.role === "admin";
  // Beträge: positive Berechtigung UND nicht hide_prices. Admin sieht trotz
  // hide_prices alles (gleiche Regel wie web und guest_masking.py).
  const amounts = isAdmin || (has("pm_booking_total") && !has("hide_prices"));
  // Kein weiterer `isAdmin ||`: `GET /auth/me` liefert einem Admin bereits ALLE
  // Berechtigungs-IDs (`account_service._effective_perm_ids`, „Admin = alle").
  // Ein zweiter Kurzschluss hier wäre eine stille Abweichung von web und würde
  // beim nächsten Rechte-Umbau eine andere Antwort geben als das Dashboard.
  // Die Ausnahme oben ist genau die, die web auch macht: `hide_prices` darf dem
  // Admin die Beträge nicht wegnehmen.
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

/** Maskierte Vorschau: nur der Vorname, wenn kein voller Name erlaubt ist. */
export function firstNameOnly(name: string | null | undefined): string | null {
  if (!name) return null;
  const token = name.trim().split(" ")[0];
  return token || null;
}
