// Datums-Helfer der App (eine Quelle statt lokaler Kopien pro Screen).
// Alles arbeitet mit ISO-Tagen (JJJJ-MM-TT) in LOKALER Zeit — `toISOString()`
// würde in UTC umrechnen und am Abend den Vortag liefern.

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const MONATE_KURZ = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** Ein Date als lokaler ISO-Tag (JJJJ-MM-TT). */
export function isoTag(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
}

/** Heute als ISO-Tag. */
export function heute(): string {
  return isoTag(new Date());
}

/** ISO-Tag + n Tage (n darf negativ sein). Ungültige Eingabe → unverändert. */
export function plusTage(iso: string, n: number): string {
  if (!istIsoTag(iso)) return iso;
  const [y, m, t] = iso.split("-").map(Number);
  const d = new Date(y, m - 1, t);
  d.setDate(d.getDate() + n);
  return isoTag(d);
}

/**
 * Strenge Prüfung: Format JJJJ-MM-TT UND echter Kalendertag (der 31.02. wird
 * abgelehnt, nicht stillschweigend verschoben).
 */
export function istIsoTag(wert: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(wert)) return false;
  const [y, m, t] = wert.split("-").map(Number);
  if (m < 1 || m > 12 || t < 1 || t > 31) return false;
  const d = new Date(y, m - 1, t);
  return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === t;
}

/** „18. Juni 2026" — leerer String bei ungültiger Eingabe (nie erfunden). */
export function formatTag(iso: string | null | undefined): string {
  if (!iso || !istIsoTag(iso.slice(0, 10))) return "";
  const [y, m, t] = iso.slice(0, 10).split("-").map(Number);
  return `${t}. ${MONATE[m - 1]} ${y}`;
}

/** „Do · 18. Jun" — kompakt für Karten/Listen. */
export function formatTagKurz(iso: string | null | undefined): string {
  if (!iso || !istIsoTag(iso.slice(0, 10))) return "";
  const [y, m, t] = iso.slice(0, 10).split("-").map(Number);
  const wt = WOCHENTAGE[new Date(y, m - 1, t).getDay()];
  return `${wt} · ${t}. ${MONATE_KURZ[m - 1]}`;
}

/** „18.–22. Juni 2026" bzw. mit zwei Monaten, wenn der Zeitraum sie kreuzt. */
export function formatZeitraum(von: string, bis: string): string {
  if (!istIsoTag(von.slice(0, 10)) || !istIsoTag(bis.slice(0, 10))) return "";
  const [y1, m1, t1] = von.slice(0, 10).split("-").map(Number);
  const [y2, m2, t2] = bis.slice(0, 10).split("-").map(Number);
  if (y1 === y2 && m1 === m2) return `${t1}.–${t2}. ${MONATE[m1 - 1]} ${y1}`;
  if (y1 === y2) return `${t1}. ${MONATE_KURZ[m1 - 1]} – ${t2}. ${MONATE_KURZ[m2 - 1]} ${y1}`;
  return `${t1}. ${MONATE_KURZ[m1 - 1]} ${y1} – ${t2}. ${MONATE_KURZ[m2 - 1]} ${y2}`;
}

/**
 * Ganze Tage von heute bis zum ISO-Tag (negativ = Vergangenheit).
 * null bei ungültiger Eingabe — der Aufrufer zeigt dann nichts an.
 */
export function tageBis(iso: string): number | null {
  if (!istIsoTag(iso.slice(0, 10))) return null;
  const [y, m, t] = iso.slice(0, 10).split("-").map(Number);
  const ziel = new Date(y, m - 1, t);
  const jetzt = new Date();
  const heuteMitternacht = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
  return Math.round((ziel.getTime() - heuteMitternacht.getTime()) / 86400000);
}
