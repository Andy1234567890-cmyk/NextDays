// Mehrsprachige Texte: ein Block-Textfeld ist ein {locale: text}-Objekt (aus der
// DB). Diese Helfer wählen den Text der aktiven Sprache mit Fallback — nie ein
// hartkodierter Inhalt, immer aus den Daten. Default-Locale "de"; gibt es die
// nicht, die erste vorhandene nicht-leere Sprache.
/** Sprache, in der eine Kunden-Site steht, solange nichts anderes bekannt ist.
 *
 *  Exportiert, damit das Layout sein `lang`-Attribut daraus zieht statt ein
 *  festes „de" zu behaupten. Sobald Sites eine eigene Sprachwahl haben, ist das
 *  hier die EINE Stelle, die sich ändert. */
export const STANDARD_SPRACHE = "de";

const DEFAULT_LOCALE = STANDARD_SPRACHE;

export function pickText(
  field: unknown,
  locale: string = DEFAULT_LOCALE,
): string {
  if (typeof field === "string") return field;
  if (field && typeof field === "object") {
    const map = field as Record<string, unknown>;
    const direct = map[locale];
    if (typeof direct === "string" && direct.trim()) return direct;
    for (const v of Object.values(map)) {
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return "";
}
