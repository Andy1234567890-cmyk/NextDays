// Darstellungshilfen des Bereichs E-Rechnung: Übersetzungsschlüssel je Format/
// Status und die Farbklassen der Status-Pillen. Keine Fachlogik — die liegt
// im Backend (bereiche/erechnung).
import type {
  EInvoiceFormat,
  TransmissionChannel,
  TransmissionStatus,
  ValidationStatus,
} from "@/lib/buchhaltung-erechnung-typen";

export const FORMAT_KEY: Record<EInvoiceFormat, string> = {
  xrechnung_ubl: "eRechnungPage.formatXrechnungUbl",
  xrechnung_cii: "eRechnungPage.formatXrechnungCii",
  zugferd_en16931: "eRechnungPage.formatZugferd",
};

export const STATUS_KEY: Record<ValidationStatus, string> = {
  valid: "eRechnungPage.statusValid",
  invalid: "eRechnungPage.statusInvalid",
  unchecked: "eRechnungPage.statusUnchecked",
};

export const STATUS_CLASSES: Record<ValidationStatus, string> = {
  valid: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  invalid: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  unchecked: "bg-muted text-muted-foreground",
};

export const KANAL_KEY: Record<TransmissionChannel, string> = {
  email: "eRechnungPage.channelEmail",
  peppol_manuell: "eRechnungPage.channelPeppol",
  download: "eRechnungPage.channelDownload",
};

export const UEBERTRAGUNG_KEY: Record<TransmissionStatus, string> = {
  pending: "eRechnungPage.transmissionPending",
  sent: "eRechnungPage.transmissionSent",
  failed: "eRechnungPage.transmissionFailed",
  downloaded: "eRechnungPage.transmissionDownloaded",
};

export function formatDate(iso: string | null, locale: string, mitZeit = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, mitZeit ? { dateStyle: "medium", timeStyle: "short" } : {}).format(d);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
