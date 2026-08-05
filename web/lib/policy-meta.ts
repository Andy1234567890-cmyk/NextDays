// Richtlinien-Datenmodell (Policies). Wird im flexiblen jsonb-Feld
// `type_attributes.policies` eines Objekts gespeichert — keine Migration nötig.
// Alle Werte sind optional/haben Defaults, damit Bestands-Objekte ohne
// Richtlinien sauber laden.

export type Bookability = "instant" | "request" | "inquiry";

// Unterstützte Sprachen: Dänisch / Englisch / Deutsch.
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

// Zahlungsplan (Payment schedule): 1–3 Zahlungen. Die LETZTE Zahlung ist immer
// der Restbetrag — deshalb hat sie keinen eigenen Betrag, nur einen Termin.
export type PaymentPlan = "one" | "two" | "three";
export const PAYMENT_PLAN_OPTIONS: { value: PaymentPlan; label: string }[] = [
  { value: "one", label: "Eine Zahlung" },
  { value: "two", label: "Zwei Zahlungen" },
  { value: "three", label: "Drei Zahlungen" },
];

// Art des Betrages einer Zahlung/Kaution.
export type AmountType = "percentage" | "fixed" | "percentage_or_fixed";
export const AMOUNT_TYPE_OPTIONS: { value: AmountType; label: string }[] = [
  { value: "percentage", label: "% der Buchung" },
  { value: "fixed", label: "Pauschalbetrag" },
  { value: "percentage_or_fixed", label: "Prozentsatz oder Pauschalbetrag" },
];

// Termin-Bezug einer geplanten Zahlung.
export type SchedulePeriod =
  | "before_checkin"
  | "after_checkin"
  | "before_checkout"
  | "not_scheduled";
export const SCHEDULE_PERIOD_OPTIONS: { value: SchedulePeriod; label: string }[] = [
  { value: "before_checkin", label: "Tage vor Ankunft" },
  { value: "after_checkin", label: "Tage nach Ankunft" },
  { value: "before_checkout", label: "Tage vor Abreise" },
  { value: "not_scheduled", label: "Nicht einplanen" },
];

// Stornoart (Guest cancellation).
export type CancellationType = "none" | "full" | "partial";
export const CANCELLATION_OPTIONS: { value: CancellationType; label: string; info: string }[] = [
  {
    value: "none",
    label: "Nicht erstattungsfähig",
    info: "Geleistete Zahlungen werden nicht zurückerstattet. Noch nicht gezahlte Beträge werden erlassen.",
  },
  {
    value: "full",
    label: "Vollständig erstattungsfähig",
    info: "Geleistete Zahlungen werden vollständig zurückerstattet. Noch nicht gezahlte Beträge werden erlassen.",
  },
  {
    value: "partial",
    label: "Teilweise erstattungsfähig",
    info: "",
  },
];

// Eine Staffel der teilweisen Erstattung: „X zurück, wenn N Tage vor Anreise
// oder früher storniert wird."
export type RefundType = "percentage" | "flat";
export const REFUND_TYPE_OPTIONS: { value: RefundType; label: string }[] = [
  { value: "percentage", label: "% der geleisteten Vorauszahlung" },
  { value: "flat", label: "Pauschalbetrag" },
];
export type RefundRule = { refundType: RefundType; value: number; daysBefore: number };
export const DEFAULT_REFUND_RULE: RefundRule = {
  refundType: "percentage",
  value: 100,
  daysBefore: 30,
};

// Kaution (Security deposit).
export type DepositMethod = "manual" | "card";
export const DEPOSIT_METHOD_OPTIONS: { value: DepositMethod; label: string; info: string }[] = [
  {
    value: "manual",
    label: "Kaution manuell berechnen und erstatten",
    info: "Die Kaution ist erstattbar und wird außerhalb von myNextDays erhoben und erstattet.",
  },
  {
    value: "card",
    label: "Kaution auf Karte autorisieren (empfohlen)",
    info: "Die Kaution wird automatisch auf der Kreditkarte des Gastes vorautorisiert.",
  },
];
// Vorautorisierung: Bezug des Zeitpunkts (nur Anreise — eine Autorisierung
// nach Abreise gibt es nicht).
export type PreAuthPeriod = "before_checkin" | "after_checkin";
export const PRE_AUTH_PERIOD_OPTIONS: { value: PreAuthPeriod; label: string }[] = [
  { value: "before_checkin", label: "Tage vor Ankunft" },
  { value: "after_checkin", label: "Tage nach Ankunft" },
];

// Strukturierte Richtlinie (eine „Policy").
export type Policy = {
  internalName: string; // Pflicht: interner Name
  paymentPlan: PaymentPlan;
  // Erste Zahlung
  firstAmountType: AmountType;
  firstPercent: number;
  firstAmount: number;
  // Zweite Zahlung (Betrag nur bei drei Zahlungen — sonst ist sie der Rest)
  secondPercent: number;
  secondDays: number;
  secondPeriod: SchedulePeriod;
  // Dritte Zahlung (Restbetrag)
  thirdDays: number;
  thirdPeriod: SchedulePeriod;
  // Stornierung durch den Gast
  cancellationType: CancellationType;
  refundRules: RefundRule[];
  // Kaution
  depositRequired: boolean;
  depositMethod: DepositMethod;
  depositAmountType: AmountType;
  depositPercentOfBooking: number;
  depositAmount: number;
  preAuthDays: number; // 0 oder 1
  preAuthPeriod: PreAuthPeriod;
  preAuthValidityDays: number; // 0–7 Tage nach Abreise
  quoteValidityHours: number; // Angebots-Gültigkeit in Stunden
};

export const DEFAULT_POLICY: Policy = {
  internalName: "",
  paymentPlan: "one",
  firstAmountType: "percentage",
  firstPercent: 10,
  firstAmount: 0,
  secondPercent: 25,
  secondDays: 45,
  secondPeriod: "before_checkin",
  thirdDays: 0,
  thirdPeriod: "before_checkin",
  cancellationType: "none",
  refundRules: [],
  depositRequired: false,
  depositMethod: "card",
  depositAmountType: "fixed",
  depositPercentOfBooking: 0,
  depositAmount: 0,
  preAuthDays: 1,
  preAuthPeriod: "before_checkin",
  preAuthValidityDays: 7,
  quoteValidityHours: 24,
};

// Wie viele Tage eine Vorautorisierung nach der Abreise gültig bleiben darf.
export const PRE_AUTH_VALIDITY_DAYS = [0, 1, 2, 3, 4, 5, 6, 7];

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

// Beschreibungen für die Auswahl-Karten (Bookability).
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

// Volle Stunden als Check-in/out-Optionen. Wert = 24h "HH:00",
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
// Liest eine gespeicherte Richtlinie. Vor dem Lodgify-Gleichzug hatte sie ein
// gröberes Schema (`split`-Plan, Storno-Stufen flexibel/moderat/streng,
// `depositMode`) — diese Altwerte werden hier auf das heutige Modell gehoben,
// statt sie stillschweigend auf Defaults fallen zu lassen (das hätte die
// Konditionen eines Bestandsobjekts verfälscht).
function migratePolicy(raw: Record<string, unknown>): Policy {
  const alt = raw as Record<string, unknown> & Partial<Policy>;
  const legacyPlan: string = typeof alt.paymentPlan === "string" ? alt.paymentPlan : "";
  const plan: PaymentPlan =
    legacyPlan === "split"
      ? "two"
      : legacyPlan === "one" || legacyPlan === "two" || legacyPlan === "three"
        ? legacyPlan
        : DEFAULT_POLICY.paymentPlan;

  const legacyCancellation: string =
    typeof alt.cancellationType === "string" ? alt.cancellationType : "";
  const cancellation: CancellationType =
    legacyCancellation === "none" ||
    legacyCancellation === "full" ||
    legacyCancellation === "partial"
      ? legacyCancellation
      : legacyCancellation === "flexible"
        ? "full"
        : legacyCancellation === "moderate" || legacyCancellation === "strict"
          ? "partial"
          : DEFAULT_POLICY.cancellationType;

  // Alt: `depositPercent` war die ANZAHLUNG (erste Zahlung), nicht die Kaution.
  const legacyFirstPercent = typeof alt.depositPercent === "number" ? alt.depositPercent : undefined;
  const legacyDays =
    typeof alt.remainingDaysBefore === "number" ? alt.remainingDaysBefore : undefined;
  const legacyDepositRequired = alt.depositMode === "amount";

  const rules = Array.isArray(alt.refundRules) ? (alt.refundRules as RefundRule[]) : [];
  return {
    ...DEFAULT_POLICY,
    ...(alt as Partial<Policy>),
    paymentPlan: plan,
    firstPercent: alt.firstPercent ?? legacyFirstPercent ?? DEFAULT_POLICY.firstPercent,
    secondDays: alt.secondDays ?? legacyDays ?? DEFAULT_POLICY.secondDays,
    cancellationType: cancellation,
    refundRules: cancellation === "partial" && rules.length === 0 ? [{ ...DEFAULT_REFUND_RULE }] : rules,
    depositRequired: alt.depositRequired ?? legacyDepositRequired,
    depositAmountType: alt.depositAmountType ?? (legacyDepositRequired ? "fixed" : DEFAULT_POLICY.depositAmountType),
  };
}

export function readPolicies(typeAttributes: Record<string, unknown> | undefined): Policies {
  const raw = (typeAttributes?.policies ?? {}) as Record<string, unknown>;
  const rawPolicy = (raw.policy ?? {}) as Record<string, unknown>;
  return {
    ...DEFAULT_POLICIES,
    ...raw,
    policy: migratePolicy(rawPolicy),
    ratesInfo: toLocalized(raw.ratesInfo),
    rentalAgreement: toLocalized(raw.rentalAgreement),
  };
}

// --- Zusammenfassungen (Karte/Zuweisung) -----------------------------------
// Aus der Richtlinie gebaute Sätze, wie sie der Betrieb auf der Karte liest.
// `geld` formatiert einen Betrag in der Objektwährung — kein Symbol hier
// hardcoden (Projektregel: Währung kommt aus den Daten).

function periodText(period: SchedulePeriod): string {
  return SCHEDULE_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "";
}

function amountText(type: AmountType, percent: number, amount: number, geld: (n: number) => string): string {
  if (type === "fixed") return geld(amount);
  if (type === "percentage") return `${percent} %`;
  return `${percent} % bzw. ${geld(amount)}`;
}

export function paymentPlanSummary(p: Policy, geld: (n: number) => string): string {
  if (p.paymentPlan === "one") return "100 % der Zahlung ist bei Buchungsabschluss fällig.";
  const erste = `${amountText(p.firstAmountType, p.firstPercent, p.firstAmount, geld)} fällig am Buchungstag.`;
  if (p.paymentPlan === "two") {
    if (p.secondPeriod === "not_scheduled") return `${erste} Der Restbetrag wird nicht eingeplant.`;
    return `${erste} Restbetrag ist fällig ${p.secondDays} Tag(e) ${periodText(p.secondPeriod)}.`;
  }
  const zweite = `${p.secondPercent} % fällig ${p.secondDays} Tag(e) ${periodText(p.secondPeriod)}.`;
  return `${erste} ${zweite} Restbetrag ist fällig ${p.thirdDays} Tag(e) ${periodText(p.thirdPeriod)}.`;
}

export function cancellationSummary(p: Policy, geld: (n: number) => string): string {
  if (p.cancellationType !== "partial") {
    return CANCELLATION_OPTIONS.find((o) => o.value === p.cancellationType)?.info ?? "";
  }
  const staffeln = p.refundRules.map((r) => {
    const wert = r.refundType === "flat" ? geld(r.value) : `${r.value} %`;
    return `${wert} der geleisteten Zahlungen werden zurückerstattet, wenn ${r.daysBefore} Tag(e) vor Ankunft oder früher storniert wird.`;
  });
  return [...staffeln, "Keine Rückerstattung bei späterer Stornierung."].join(" ");
}

export function depositSummary(p: Policy, geld: (n: number) => string): string {
  if (!p.depositRequired) return "";
  const betrag = amountText(p.depositAmountType, p.depositPercentOfBooking, p.depositAmount, geld);
  if (p.depositMethod === "manual") {
    return `Eine Kaution von ${betrag} wird außerhalb von myNextDays erhoben und erstattet.`;
  }
  const wann = PRE_AUTH_PERIOD_OPTIONS.find((o) => o.value === p.preAuthPeriod)?.label ?? "";
  return `Eine Vorautorisierung von ${betrag} wird ${p.preAuthDays} Tag(e) ${wann} zurückgehalten und ${p.preAuthValidityDays} Tag(e) nach Abreise storniert.`;
}

// Gibt es in irgendeiner Sprache nicht-leeren Text? (für die Vorschau)
export function hasAnyText(t: LocalizedText): boolean {
  return LANGS.some((l) => stripHtml(t[l]).trim().length > 0);
}

// HTML grob zu Klartext (nur für Vorschau/Leer-Prüfung, nicht zum Speichern).
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");
}
