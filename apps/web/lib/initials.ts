// Monogramm aus dem Namen (CRM-Muster statt generischem Icon).
// Codepoint-weise, damit Emojis/Surrogate-Paare nicht zerrissen werden.
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = [...(parts[0] ?? "")];
  const last = [...(parts[parts.length - 1] ?? "")];
  return ((first[0] ?? "") + (parts.length > 1 ? (last[0] ?? "") : (first[1] ?? ""))).toUpperCase();
}
