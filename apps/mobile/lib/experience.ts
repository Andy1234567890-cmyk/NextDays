// Erlebnis-Routing (eine zentrale Stelle, NICHT in Screens verstreut). Leitet
// aus der Server-Rolle (me.role aus /auth/me) das Ziel-Erlebnis der App ab:
//   admin | co_admin → Agentur (HostTabs)
//   owner            → Eigentümer (OwnerTabs, Ausbau P6)
//   staff | cleaner  → Mitarbeiter (HostTabs mit Tasks-Fokus, Ausbau P3)
// Kein clientseitiges „Aufmachen" — die Rolle kommt ausschließlich vom Server.
import type { Me, Role } from "@/contexts/AuthContext";
import type { RootStackParamList } from "@/navigation/types";

type RootRoute = keyof RootStackParamList;

// Ziel-Route + optionale verschachtelte Tab-Auswahl (params.screen).
export type ExperienceTarget = {
  route: RootRoute;
  params?: Record<string, unknown>;
};

const BY_ROLE: Record<Role, ExperienceTarget> = {
  admin: { route: "HostTabs", params: { screen: "Dashboard" } },
  co_admin: { route: "HostTabs", params: { screen: "Dashboard" } },
  owner: { route: "OwnerTabs", params: { screen: "OwnerProperties" } },
  // Mitarbeiter starten im Aufgaben-Fokus (Tabs-Ausbau folgt in P3).
  staff: { route: "HostTabs", params: { screen: "Dashboard" } },
  cleaner: { route: "HostTabs", params: { screen: "Dashboard" } },
};

/**
 * Ziel-Erlebnis für ein geladenes Konto. Fehlende/unbekannte Rolle → null
 * (fail-closed, Wurzel 5): der Aufrufer behandelt das als „Konto ohne gültige
 * Rolle" (Logout + Login-Screen) — NIE Default ins Agentur-Dashboard.
 */
export function experienceFor(me: Me | null): ExperienceTarget | null {
  if (me?.role && me.role in BY_ROLE) return BY_ROLE[me.role];
  return null;
}
