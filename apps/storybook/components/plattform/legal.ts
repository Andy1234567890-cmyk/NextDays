// Lokale Kopie der Rechtstext-Typen + Sprachliste (plattform/content/legal).
// Für die Storybook-Werkstatt — die echten Inhalte liegen in der App pro
// Sprache als eigenes TS-Modul.
export type LegalSection = {
  heading: string;
  paragraphs: string[];
  list?: string[];
};

export type LegalDoc = {
  title: string;
  stand: string;
  intro: string[];
  sections: LegalSection[];
};

// Die Gast-AGB müssen EU-weit in allen 24 Amtssprachen abrufbar sein.
export const LEGAL_LOCALES = [
  "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
  "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
] as const;

export type LegalLocale = (typeof LEGAL_LOCALES)[number];

export const LEGAL_LOCALE_LABELS: Record<LegalLocale, string> = {
  bg: "Български", cs: "Čeština", da: "Dansk", de: "Deutsch", el: "Ελληνικά",
  en: "English", es: "Español", et: "Eesti", fi: "Suomi", fr: "Français",
  ga: "Gaeilge", hr: "Hrvatski", hu: "Magyar", it: "Italiano", lt: "Lietuvių",
  lv: "Latviešu", mt: "Malti", nl: "Nederlands", pl: "Polski", pt: "Português",
  ro: "Română", sk: "Slovenčina", sl: "Slovenščina", sv: "Svenska",
};

// Beispiel-Rechtsdokument für die Story (keine Rechtsberatung, nur Layout).
export const DEMO_LEGAL_DOC: LegalDoc = {
  title: "Allgemeine Geschäftsbedingungen für Gäste",
  stand: "Stand: 3. Juli 2026",
  intro: [
    "Diese Bedingungen regeln die Nutzung des myNextDays-Marktplatzes durch Gäste.",
    "Mit einer Buchung akzeptierst du diese Bedingungen sowie die " +
      "[Datenschutzhinweise](https://mynextdays.com/datenschutz).",
  ],
  sections: [
    {
      heading: "1. Buchung und Vertragsschluss",
      paragraphs: [
        "Der Vertrag über die Unterkunft kommt zwischen dir und dem Gastgeber " +
          "zustande. myNextDays vermittelt lediglich die Buchung.",
      ],
      list: [
        "Die Buchung ist verbindlich, sobald die Zahlung bestätigt wurde.",
        "Der belegte Zeitraum wird sofort auf allen Kanälen gesperrt.",
      ],
    },
    {
      heading: "2. Zahlung",
      paragraphs: [
        "Zahlungen werden über unseren Zahlungsdienstleister abgewickelt. Die " +
          "Abrechnung erfolgt in der Währung der jeweiligen Unterkunft.",
      ],
    },
    {
      heading: "3. Stornierung",
      paragraphs: [
        "Es gelten die vom Gastgeber gewählten Stornierungsbedingungen, die vor " +
          "der Buchung angezeigt werden.",
      ],
    },
  ],
};
