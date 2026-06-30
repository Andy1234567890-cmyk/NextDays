// Mehrsprachige Texte: ein Block-Textfeld ist ein {locale: text}-Objekt (aus der
// DB). Diese Helfer wählen den Text der aktiven Sprache mit Fallback — nie ein
// hartkodierter Inhalt, immer aus den Daten. Default-Locale "de"; gibt es die
// nicht, die erste vorhandene nicht-leere Sprache.
const DEFAULT_LOCALE = "de";

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
