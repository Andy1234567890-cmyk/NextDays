// Anzeige-Katalog der Berechtigungen für den Entwickler-API-Zugang.
//
// Die WAHRHEIT über vergebbare Scopes steht im Backend
// (`apps/api/src/features/api_clients/scopes.py`, byte-identische
// Schwesterdatei von `apps/public-api/src/core/scopes.py`). Diese Datei ist die
// ANZEIGE: Reihenfolge in der Oberfläche, Übersetzungsschlüssel je Bereich und
// die Angabe, welche Richtungen es überhaupt gibt.
//
// Warum trotzdem eine Liste hier: die Beschreibungen im Backend-Katalog sind
// deutsch, die Oberfläche läuft in 24 Sprachen. Ein zur Laufzeit geholter
// deutscher Text wäre in einer polnischen Oberfläche schlechter als ein
// übersetztes Etikett.
//
// Damit die beiden nicht auseinanderlaufen, prüft
// `scripts/i18n/api-scopes-pruefen.mjs` bei jedem CI-Lauf, dass hier GENAU die
// Scopes stehen, die das Backend kennt. Fehlt ein Bereich hier, kann niemand
// einen Zugang mit diesem Recht anlegen — die zugehörigen Endpunkte der
// öffentlichen API antworten dann dauerhaft mit 403, ohne dass irgendwo ein
// Fehler auftaucht. Genau dieser Fall lag vor, als die öffentliche API um
// Preise, Gäste, Aufgaben und Webhooks erweitert wurde und diese Liste noch
// bei vier Bereichen stand.

/** Ein Bereich der Berechtigungs-Matrix. */
export type ApiScopeBereich = {
  /** Präfix des Scopes, z. B. `rates` → `rates:read` / `rates:write`. */
  key: string;
  /** Suffix des i18n-Schlüssels: `apiAccess.scope<Label>`. */
  labelKey: string;
  /**
   * Welche Richtungen es gibt. `guests` ist bewusst nur lesend — Gastdaten
   * entstehen dort, wo der Gast sie eingibt oder das Portal sie liefert; ein
   * Schreibweg über die API wäre eine dritte Quelle für dieselbe Person.
   * Die Matrix rendert für eine fehlende Richtung KEIN Häkchen, statt eines
   * anzuzeigen, das beim Speichern mit 422 abgelehnt wird.
   */
  richtungen: readonly ("read" | "write")[];
};

const LESEN_UND_SCHREIBEN = ["read", "write"] as const;

export const API_SCOPE_CATALOG: readonly ApiScopeBereich[] = [
  { key: "properties", labelKey: "properties", richtungen: LESEN_UND_SCHREIBEN },
  { key: "availability", labelKey: "availability", richtungen: LESEN_UND_SCHREIBEN },
  { key: "rates", labelKey: "rates", richtungen: LESEN_UND_SCHREIBEN },
  { key: "reservations", labelKey: "reservations", richtungen: LESEN_UND_SCHREIBEN },
  { key: "guests", labelKey: "guests", richtungen: ["read"] },
  { key: "tasks", labelKey: "tasks", richtungen: LESEN_UND_SCHREIBEN },
  { key: "webhooks", labelKey: "webhooks", richtungen: LESEN_UND_SCHREIBEN },
  { key: "calendar_sync", labelKey: "calendarSync", richtungen: LESEN_UND_SCHREIBEN },
] as const;

/** Alle vergebbaren Scope-Namen — zum Abgleich mit dem Backend-Katalog. */
export const API_SCOPE_NAMEN: readonly string[] = API_SCOPE_CATALOG.flatMap((b) =>
  b.richtungen.map((r) => `${b.key}:${r}`),
);
