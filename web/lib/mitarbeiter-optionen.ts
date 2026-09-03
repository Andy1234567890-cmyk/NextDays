// Auswahlliste „wer ist zuständig" — EINE Wahrheit für alle Stellen, die
// Personen zur Auswahl stellen (Aufgabe anlegen, Aufgabe umweisen, Regel,
// Team-Filter, Kalender-Filter).
//
// Vorher stand `u.full_name ?? u.email ?? u.user_id` an vier Stellen kopiert.
// Das war nicht nur doppelt, es war falsch: im Beta-Betrieb tragen ZWEI
// Konten denselben `full_name` („Torsten Ågaard" — einmal owner, einmal
// co_admin, verschiedene Mailadressen). Die Liste zeigte beide identisch, man
// wählte den einen und traf den anderen. Genau so entsteht ein „die Zuweisung
// funktioniert nicht", bei dem technisch alles funktioniert.
import type { TaskAssigneeOption } from "@/lib/tasks";

export type MitarbeiterOption = {
  value: string;
  label: string;
};

/**
 * Auswahloptionen aus der Nutzerliste des Betriebs.
 *
 * Zwei Regeln, beide aus dem Livebetrieb:
 *  - Bei mehrdeutigem Namen kommt die E-Mail dazu. Nur dann — sie überall
 *    anzuhängen machte die häufige, eindeutige Zeile unnötig lang.
 *  - Gesperrte Zugänge (`deactivated_at`) fallen raus. Wer sich nicht
 *    anmelden kann, kann keine Aufgabe übernehmen; ihn anzubieten erzeugt
 *    eine Zuweisung, auf die nie jemand reagiert.
 *
 * Kein erfundener Ersatzname: fehlen Name UND E-Mail, bleibt die ID stehen.
 * Sie ist hässlich, aber wahr — ein „Unbekannt" wäre geraten (Wurzel 4).
 */
export function mitarbeiterOptionen(
  users: TaskAssigneeOption[],
  /** Beschriftung, die hinter einen EIGENTÜMER gehängt wird (übersetzt vom
   *  Aufrufer). Ohne sie stünde der Hauseigentümer ununterscheidbar neben dem
   *  Personal — und genau dieser Unterschied entscheidet, wer die Aufgabe im
   *  Portal statt im Team-Kalender sieht (03.09.2026). */
  kennungen: { eigentuemer?: string } = {},
): MitarbeiterOption[] {
  // Gesperrte filtert bereits der Server heraus (`/tasks/assignees`), ebenso
  // Rollen ohne `view_own_tasks`. Hier bleibt nur die Beschriftung.
  const aktiv = users;
  const proName = new Map<string, number>();
  for (const u of aktiv) {
    const name = u.full_name?.trim();
    if (name) proName.set(name, (proName.get(name) ?? 0) + 1);
  }
  const zusatz = (u: TaskAssigneeOption): string =>
    u.role === "owner" && kennungen.eigentuemer
      ? ` · ${kennungen.eigentuemer}`
      : "";
  return aktiv.map((u) => {
    const name = u.full_name?.trim();
    if (!name) {
      return { value: u.user_id, label: `${u.email ?? u.user_id}${zusatz(u)}` };
    }
    const mehrdeutig = (proName.get(name) ?? 0) > 1;
    return {
      value: u.user_id,
      label: `${mehrdeutig && u.email ? `${name} (${u.email})` : name}${zusatz(u)}`,
    };
  });
}
