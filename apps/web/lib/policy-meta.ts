// Richtlinien-Datenmodell (Lodgify „Policies"). Wird im flexiblen jsonb-Feld
// `type_attributes.policies` eines Objekts gespeichert — keine Migration nötig.
// Alle Werte sind optional/haben Defaults, damit Bestands-Objekte ohne
// Richtlinien sauber laden.

export type Bookability = "instant" | "request" | "inquiry";

// Unterstützte Sprachen (wie Lodgify: Dänisch / Englisch / Deutsch).
export type Lang = "da" | "en" | "de";
export const LANGS: Lang[] = ["de", "en", "da"];
export const LANG_LABELS: Record<Lang, string> = {
  de: "Deutsch",
  en: "English",
  da: "Dansk",
};
export const LANG_FLAGS: Record<Lang, string> = {
  de: "twemoji:flag-germany",
  en: "twemoji:flag-united-kingdom",
  da: "twemoji:flag-denmark",
};

// Mehrsprachiger Rich-Text (HTML) pro Sprache.
export type LocalizedText = Record<Lang, string>;

export const EMPTY_LOCALIZED: LocalizedText = { de: "", en: "", da: "" };

// Zahlungsplan (Lodgify „Payment schedule").
export type PaymentPlan = "one" | "split";
export const PAYMENT_PLAN_OPTIONS: { value: PaymentPlan; label: string; info: string }[] = [
  {
    value: "one",
    label: "Eine Zahlung",
    info: "100 % der Zahlung wird bei der Reservierung berechnet.",
  },
  {
    value: "split",
    label: "Anzahlung + Restbetrag",
    info: "Eine Anzahlung wird bei Buchung fällig, der Rest vor Anreise.",
  },
];

// Stornotyp (Lodgify „Guest cancellation").
export type CancellationType = "flexible" | "moderate" | "strict" | "non_refundable";
export const CANCELLATION_OPTIONS: { value: CancellationType; label: string; info: string }[] = [
  { value: "flexible", label: "Flexibel", info: "Volle Erstattung bis kurz vor Anreise." },
  { value: "moderate", label: "Moderat", info: "Teilweise Erstattung je nach Stornozeitpunkt." },
  { value: "strict", label: "Streng", info: "Eingeschränkte Erstattung; frühe Stornofristen." },
  {
    value: "non_refundable",
    label: "Nicht erstattbar",
    info: "Geleistete Zahlungen sind nicht erstattbar. Nicht gezahlte Beträge werden nicht berechnet.",
  },
];

// Kaution (Lodgify „Security deposit").
export type DepositMode = "none" | "amount";

// Strukturierte Richtlinie (eine „Policy" wie Lodgify).
export type Policy = {
  internalName: string; // Pflicht: interner Name
  paymentPlan: PaymentPlan;
  depositPercent: number; // Anzahlung in % (bei split)
  remainingDaysBefore: number; // Restbetrag X Tage vor Anreise (bei split)
  cancellationType: CancellationType;
  depositMode: DepositMode; // Kaution gefordert?
  depositAmount: number; // Kautionsbetrag (bei amount)
  quoteValidityHours: number; // Angebots-Gültigkeit in Stunden
};

export const DEFAULT_POLICY: Policy = {
  internalName: "",
  paymentPlan: "one",
  depositPercent: 10,
  remainingDaysBefore: 45,
  cancellationType: "non_refundable",
  depositMode: "none",
  depositAmount: 0,
  quoteValidityHours: 48,
};

export type Policies = {
  // Reservation policies — strukturierte Richtlinie + optionaler Freitext (alt)
  policyName: string; // Name der zugewiesenen Richtlinie (frei, alt)
  policy: Policy; // strukturierte Richtlinie (neu)
  cancellation: string; // Stornobedingungen (Freitext, mehrzeilig — alt)
  payment: string; // Zahlungsbedingungen (Freitext — alt)
  depositText: string; // Kaution / Pre-Authorization (Freitext — alt)
  bookability: Bookability;
  checkInTime: string; // "16:00"
  checkOutTime: string; // "10:00"
  // Website legal info — mehrsprachig (Rich-Text/HTML pro Sprache)
  ratesInfo: LocalizedText; // Zusatzinfo auf der Raten-Seite
  rentalAgreement: LocalizedText; // Mietvertrag / Hausregeln
};

export const DEFAULT_POLICIES: Policies = {
  policyName: "",
  policy: { ...DEFAULT_POLICY },
  cancellation: "",
  payment: "",
  depositText: "",
  bookability: "instant",
  checkInTime: "16:00",
  checkOutTime: "10:00",
  ratesInfo: { ...EMPTY_LOCALIZED },
  rentalAgreement: { ...EMPTY_LOCALIZED },
};

// Normalisiert ein evtl. altes Plain-String-Feld in eine LocalizedText-Map
// (alter Text landet unter „de", Rückwärtskompatibilität).
function toLocalized(value: unknown): LocalizedText {
  if (typeof value === "string") return { ...EMPTY_LOCALIZED, de: value };
  if (value && typeof value === "object") {
    const v = value as Partial<LocalizedText>;
    return { de: v.de ?? "", en: v.en ?? "", da: v.da ?? "" };
  }
  return { ...EMPTY_LOCALIZED };
}

export const BOOKABILITY_LABELS: Record<Bookability, string> = {
  instant: "Sofortbuchung",
  request: "Buchungsanfrage",
  inquiry: "Nur Anfrage",
};

// Beschreibungen für die Auswahl-Karten (wie Lodgify „Bookability").
export const BOOKABILITY_OPTIONS: {
  value: Bookability;
  label: string;
  description: string;
  recommended?: boolean;
}[] = [
  {
    value: "instant",
    label: "Sofortbuchung",
    description:
      "Reservierungen werden sofort ohne deine vorherige Zustimmung angenommen — Gäste können direkt buchen und bezahlen, sofern sie deine Bedingungen akzeptieren.",
    recommended: true,
  },
  {
    value: "request",
    label: "Buchungsanfrage",
    description:
      "Reservierungen werden erst nach deiner Prüfung und Zustimmung angenommen. Du bestätigst jede Reservierung manuell.",
  },
  {
    value: "inquiry",
    label: "Nur Anfrage",
    description:
      "Du nimmst ausschließlich Anfragen entgegen — Gäste sind nicht verpflichtet, nach einer Anfrage zu buchen.",
  },
];

// Volle Stunden als Check-in/out-Optionen (wie Lodgify). Wert = 24h "HH:00",
// Anzeige im 12h-Format ("4pm", "10am") + 24h dahinter.
export type HourOption = { value: string; label: string };

function hourLabel(h: number): string {
  const period = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const pad = `${h.toString().padStart(2, "0")}:00`;
  return `${h12}${period} (${pad})`;
}

export const HOUR_OPTIONS: HourOption[] = Array.from({ length: 24 }, (_, h) => ({
  value: `${h.toString().padStart(2, "0")}:00`,
  label: hourLabel(h),
}));

// Hilfsanzeige für eine gespeicherte Zeit ("16:00" → "4pm (16:00)").
export function formatHour(value: string): string {
  const found = HOUR_OPTIONS.find((o) => o.value === value);
  if (found) return found.label;
  const h = Number(value.slice(0, 2));
  return Number.isFinite(h) ? hourLabel(h) : value;
}

// Liest die Richtlinien aus einem Objekt (mit Defaults aufgefüllt). Die
// mehrsprachigen Felder werden normalisiert (alter Plain-String → de).
export function readPolicies(typeAttributes: Record<string, unknown> | undefined): Policies {
  const raw = (typeAttributes?.policies ?? {}) as Record<string, unknown>;
  const rawPolicy = (raw.policy ?? {}) as Partial<Policy>;
  return {
    ...DEFAULT_POLICIES,
    ...raw,
    policy: { ...DEFAULT_POLICY, ...rawPolicy },
    ratesInfo: toLocalized(raw.ratesInfo),
    rentalAgreement: toLocalized(raw.rentalAgreement),
  };
}

// Gibt es in irgendeiner Sprache nicht-leeren Text? (für die Vorschau)
export function hasAnyText(t: LocalizedText): boolean {
  return LANGS.some((l) => stripHtml(t[l]).trim().length > 0);
}

// HTML grob zu Klartext (nur für Vorschau/Leer-Prüfung, nicht zum Speichern).
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");
}
