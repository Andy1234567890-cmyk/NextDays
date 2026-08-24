// Welche Sprachfassung an DIESEN Gast geht — die Regel, nach der auch der
// Server auswählt.
//
// EINE REGEL, ZWEI ORTE — warum das hier steht: Automails wählt der Server
// (`apps/api/src/features/inbox/sprachen.py::fassung_waehlen`), weil sie ohne
// Oberfläche entstehen. Eine von Hand eingefügte Vorlage wählt der Client,
// weil sie im Editor landet und dort noch bearbeitet wird. Beide MÜSSEN
// dieselbe Fassung nehmen — sonst schreibt die Automatisierung dänisch und der
// Mensch daneben englisch, an denselben Gast.
//
// Wer die Rangfolge ändert, ändert sie an BEIDEN Stellen. Sie ist bewusst kurz
// gehalten, damit dieser Gleichlauf nachprüfbar bleibt.
//
// WAS ES BEHOBEN HAT (24.08.2026): das Vorlagen-Menü im Gesprächsfenster fügte
// `template.body` ein — immer die Grundfassung, ohne `texts` auch nur
// anzusehen. Der Beta-Betrieb führt 18 Vorlagen in de/da/en und schrieb seine
// dänischen Gäste von Hand auf Englisch an, weil die gepflegte dänische
// Fassung nirgends angeboten wurde.

/** Zwei Kleinbuchstaben, klein geschrieben — „de-AT" → „de", „PT_BR" → „pt".
 *  Dieselbe Normierung wie `core.languages.basis_sprache` im Backend: die
 *  Portale liefern die Sprache in jeder Schreibweise, und ohne sie trifft
 *  `lang === gastsprache` bei „de-AT" nie. */
export function basisSprache(wert: string | null | undefined): string | null {
  const roh = (wert ?? "").trim().toLowerCase();
  const basis = roh.split(/[-_]/)[0];
  return /^[a-z]{2}$/.test(basis) ? basis : null;
}

/** Eine Fassung, wie Vorlagen und Regeln sie führen. */
export type SprachFassung = { lang: string; body: string };

/** Ergebnis der Auswahl. `sprache === null` heißt: es greift die Grundfassung —
 *  dann wird KEINE Sprache behauptet (Wurzel 4). `gastspracheGepflegt` sagt,
 *  ob der Gast seine eigene Sprache bekommt; nur so kann die Oberfläche die
 *  Lücke benennen, statt sie stillschweigend zu füllen. */
export type Fassungswahl = {
  text: string;
  sprache: string | null;
  gastspracheGepflegt: boolean;
};

/**
 * Rangfolge: Sprache des Gastes → Standardsprache des Betriebs → Grundfassung.
 *
 * Leere Fassungen gelten als nicht vorhanden — eine angelegte, nie ausgefüllte
 * Sprachfassung darf keine leere Nachricht einsetzen.
 */
export function fassungWaehlen(
  fassungen: SprachFassung[],
  grundfassung: string,
  opts: { gastsprache?: string | null; standard?: string | null },
): Fassungswahl {
  const gepflegt = new Map(
    fassungen.filter((f) => f.body.trim()).map((f) => [f.lang, f.body]),
  );
  const gast = basisSprache(opts.gastsprache);
  const standard = basisSprache(opts.standard);
  if (gast && gepflegt.has(gast)) {
    return { text: gepflegt.get(gast)!, sprache: gast, gastspracheGepflegt: true };
  }
  if (standard && gepflegt.has(standard)) {
    return {
      text: gepflegt.get(standard)!,
      sprache: standard,
      gastspracheGepflegt: false,
    };
  }
  return { text: grundfassung, sprache: null, gastspracheGepflegt: false };
}
