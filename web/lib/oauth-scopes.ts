// Lesbare deutsche Beschriftungen für OAuth-Scopes, die eine Drittanbieter-App
// beim Supabase-OAuth-Server anfragt. Unbekannte Scopes werden roh angezeigt.
export const SCOPE_LABELS: Record<string, { title: string; hint: string }> = {
  openid: {
    title: "Identität bestätigen",
    hint: "Bestätigt, dass du angemeldet bist.",
  },
  profile: {
    title: "Profildaten lesen",
    hint: "Name und grundlegende Profilangaben.",
  },
  email: {
    title: "E-Mail-Adresse lesen",
    hint: "Deine E-Mail-Adresse einsehen.",
  },
  offline_access: {
    title: "Dauerhafter Zugriff",
    hint: "Bleibt aktiv, auch wenn du gerade nicht im Browser bist.",
  },
};

/** Scope-String („openid profile email") in Anzeige-Einträge zerlegen. */
export function describeScopes(scope: string | undefined | null) {
  const parts = (scope ?? "").split(/\s+/).filter(Boolean);
  return parts.map((s) => ({
    key: s,
    title: SCOPE_LABELS[s]?.title ?? s,
    hint: SCOPE_LABELS[s]?.hint ?? "Zugriff auf diesen Bereich.",
  }));
}
