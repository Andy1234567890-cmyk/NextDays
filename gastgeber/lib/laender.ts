// Ländernamen für die Oberfläche — ISO-3166-1 alpha-2 bleibt der Datenwert.
//
// Gespeichert und übertragen wird AUSSCHLIESSLICH der ISO-Code („DE", „NZ").
// Der ausgeschriebene Name entsteht erst beim Rendern und wird nie persistiert.
//
// Warum keine gepflegte Liste mehr: Die Auswahl der Steuerländer kommt aus
// `tax_country_rules` in der DB. Eine zweite, handgepflegte Namensliste im
// Frontend lief zwangsläufig auseinander — sie hatte 32 Einträge, die DB 42,
// und für die Differenz erschien im Wizard das rohe Kürzel („CA", „NZ").
// `Intl.DisplayNames` kennt jeden gültigen ISO-Code und kann deshalb nicht
// unvollständig sein: Neue Länder in der Regeltabelle wirken sofort, ohne dass
// hier etwas nachgezogen werden muss.
//
// Die Sprache ist fest „de", solange das Frontend nur Deutsch spricht. Kommt
// eine zweite Sprache, wird sie zum Parameter — die Aufrufer bleiben gleich.

const SPRACHE = "de";

/** Wird einmal gebaut: `Intl.DisplayNames` ist pro Aufruf teuer, und die
 *  Länderauswahl rendert Dutzende Optionen. */
const ANZEIGE = new Intl.DisplayNames([SPRACHE], {
  type: "region",
  // Unbekannte Codes liefern den Code zurück statt zu werfen. Ein erfundener
  // Name wäre hier schlimmer als das Kürzel (Wurzel 4).
  fallback: "code",
});

export interface Land {
  /** ISO-3166-1 alpha-2 — der einzige Wert, der gespeichert wird. */
  code: string;
  name: string;
}

/** Ländername zum ISO-Code. Unbekannte Codes kommen unverändert zurück. */
export function landName(code: string): string {
  const iso = code.trim().toUpperCase();
  if (iso.length !== 2) return iso;
  try {
    return ANZEIGE.of(iso) ?? iso;
  } catch {
    // Ungültige Codes (z. B. Ziffern) lässt `of` werfen — dann ist der Code
    // selbst die ehrlichste Anzeige.
    return iso;
  }
}

/** Alle ISO-3166-1-alpha-2-Codes, nach deutschem Namen sortiert.
 *
 *  Für Felder, die JEDES Land zulassen müssen — etwa das Geburtsland: wer in
 *  Brasilien geboren ist und in Spanien vermietet, muss beides angeben können.
 *  Für die Steuerländer NICHT verwenden; deren Auswahl kommt aus der DB. */
export function alleLaender(): readonly Land[] {
  return ALLE;
}

/** ISO-3166-1 alpha-2: A..Z × A..Z durchgehen und behalten, was `Intl` als
 *  echtes Land kennt. Reservierte und unbelegte Kombinationen liefern mit
 *  `fallback: "code"` den Code selbst zurück und fallen so heraus. */
function baueAlleLaender(): readonly Land[] {
  const A = 65;
  const laender: Land[] = [];
  for (let i = 0; i < 26; i += 1) {
    for (let j = 0; j < 26; j += 1) {
      const code = String.fromCharCode(A + i, A + j);
      const name = ANZEIGE.of(code);
      if (name && name !== code) laender.push({ code, name });
    }
  }
  return laender.sort((a, b) => a.name.localeCompare(b.name, SPRACHE));
}

const ALLE = baueAlleLaender();
