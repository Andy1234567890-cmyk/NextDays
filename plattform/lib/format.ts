// Kleine Formatierungshelfer für die Gast-Oberfläche (deutsche Darstellung).
// Datumsstrings vom Backend sind ISO (YYYY-MM-DD oder ISO-Timestamp).

/** ISO-Datum (Tag) deutsch, z. B. "12. Aug. 2026". Ungültig → roher String. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** ISO-Timestamp deutsch inkl. Uhrzeit, z. B. "12. Aug. 2026, 14:30". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Nur die Uhrzeit HH:MM (aus "14:00" oder ISO-Timestamp). */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  // Reine Uhrzeit "HH:MM[:SS]"
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/** Zeitraum "12. Aug. – 18. Aug. 2026". */
export function formatRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start || !end) return "—";
  return `${formatDate(start)} – ${formatDate(end)}`;
}
