// Das PM-Dach in der Oberfläche — Spiegel von
// `apps/api/src/features/auth/granular_permissions.py`.
//
// `access_pm_features` ist kein Recht neben den anderen, sondern der
// Hauptschalter über allen `pm_*`- und `inbox_*`-Rechten: fehlt es, entfernt
// `effective_permissions` serverseitig JEDES Kind-Recht — egal wie viele
// Häkchen gesetzt sind. Im Dialog stand es als 16. von 18 Zeilen unter
// „Allgemein", gleichrangig mit `hide_prices`, und die 32 Rechte, die es
// beherrscht, sahen unverändert aktiv aus. Man setzte Häkchen, sie wurden
// gespeichert, und wirkten nicht.
//
// Die Rollen-Ausnahme ist mit abgebildet, weil sie serverseitig existiert:
// für `owner` gilt das Dach NICHT (er kann `access_pm_features` konstruktiv
// nie besitzen, seine vier pm_*-Rechte beschreiben sein eigenes Portal).
// Würde die UI hier ausgrauen, wären genau die Rechte gesperrt, die live
// wirken — der Fehler wäre nur umgedreht.
import type { UserRole } from "@/lib/account";

export const PM_DACH = "access_pm_features";

// Spiegel von `_PM_UMBRELLA_ROLES`. Fail-closed wie dort: eine unbekannte
// Rolle bekommt das Dach, nicht die Freistellung.
const DACH_ROLLEN: ReadonlySet<string> = new Set<string>([
  "admin",
  "co_admin",
  "staff",
  "cleaner",
  "shift_lead",
]);

/** Gilt das PM-Dach für diese Rolle? (`pm_umbrella_applies`) */
export function pmDachGilt(rolle: UserRole | string | null | undefined): boolean {
  if (!rolle) return true;
  // Reine Allowlist, kein Negativ-Test: eine Rolle, die hier nicht steht,
  // bekommt das Dach. Ein `!== "owner"` wäre fail-open — jede künftige Rolle
  // wäre stillschweigend vom Dach befreit.
  return DACH_ROLLEN.has(rolle);
}

/** Ist ein Recht ein Kind des Dachs? (`_PM_CHILDREN`) */
export function istPmKind(id: string): boolean {
  return id.startsWith("pm_") || id.startsWith("inbox_");
}

/**
 * Sind die Kind-Rechte gerade wirkungslos?
 *
 * Genau dann, wenn das Dach für die Rolle gilt und nicht gesetzt ist. Dann
 * werden die Häkchen ausgegraut — nicht entfernt: sie bleiben gespeichert und
 * wirken wieder, sobald das Dach gesetzt wird (Wurzel 1: der Gegenzustand
 * bleibt gepflegt, statt beim Umschalten stillschweigend gelöscht zu werden).
 */
export function pmKinderWirkungslos(
  rolle: UserRole | string | null | undefined,
  rechte: ReadonlySet<string>,
): boolean {
  return pmDachGilt(rolle) && !rechte.has(PM_DACH);
}
