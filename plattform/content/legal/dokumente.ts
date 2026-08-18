// Verzeichnis aller Rechtstexte der myBestDays-Plattform.
//
// Umfang und Schnitt folgen dem, was EU-Marktplätze für Beherbergung führen
// (Airbnb „Rechtliche Bestimmungen", Booking.com-Fußzeile): EIN Vertragswerk
// (Nutzungsbedingungen) plus eigenständige Richtlinien, auf die es verweist.
// Jeder Eintrag hier MUSS eine Datei content/legal/<slug>/<locale>.ts in allen
// 24 Amtssprachen haben — die Loader-Map in index.ts erzwingt das im Typ.
//
// Nicht aufgenommen (bewusst, kein Versehen): alles, was ein Programm oder
// Produkt beschreibt, das es bei myBestDays nicht gibt — Geschenkkarten,
// Guthaben-/Empfehlungsprogramme, Reiseversicherung, Flüge/Mietwagen/
// Attraktionen, Airbnb-Partnerprogramme, US-/AU-/BR-Sonderbedingungen sowie
// die VLOP-Pflichtangaben des Digital Services Act (monatliche Nutzerzahl,
// Anzeigendepot, systemische Risikobewertung) — die treffen nur sehr große
// Plattformen. Ein Rechtstext über ein Angebot, das nicht existiert, wäre eine
// Falschaussage.

export const LEGAL_DOCUMENT_SLUGS = [
  // Bedingungen
  "nutzungsbedingungen",
  "zahlungsbedingungen",
  "gastgeber-bedingungen",
  "drittanbieter",
  // Standards und Richtlinien
  "inhaltsrichtlinien",
  "bewertungsrichtlinien",
  "antidiskriminierung",
  "grundregeln-gaeste",
  "verhaltenskodex-anbieter",
  "urheberrecht",
  "datenschutzstandards-gastgeber",
  // Gebühren, Preise und Steuern
  "servicegebuehren",
  "gebuehren-ausserhalb",
  "steuern",
  "preisangaben",
  // Buchung, Stornierung und Probleme
  "stornierungsbedingungen",
  "rueckerstattung",
  "schwerwiegende-beeintraechtigungen",
  "beschwerden",
  // Datenschutz
  "datenschutz",
  "cookies",
  // Rechtliche Informationen
  "impressum",
  "dsa",
  "barrierefreiheit",
  "kurzzeitvermietung",
  "behoerdenanfragen",
  "markenzeichen",
] as const;

export type LegalDocumentSlug = (typeof LEGAL_DOCUMENT_SLUGS)[number];

export const LEGAL_GROUPS = [
  "bedingungen",
  "standards",
  "gebuehren",
  "buchung",
  "datenschutz",
  "rechtliches",
] as const;

export type LegalGroup = (typeof LEGAL_GROUPS)[number];

// Zuordnung Dokument → Gruppe. Die Reihenfolge im Verzeichnis ergibt sich aus
// LEGAL_DOCUMENT_SLUGS, nicht aus dieser Map.
export const LEGAL_DOCUMENT_GROUP: Record<LegalDocumentSlug, LegalGroup> = {
  nutzungsbedingungen: "bedingungen",
  zahlungsbedingungen: "bedingungen",
  "gastgeber-bedingungen": "bedingungen",
  drittanbieter: "bedingungen",
  inhaltsrichtlinien: "standards",
  bewertungsrichtlinien: "standards",
  antidiskriminierung: "standards",
  "grundregeln-gaeste": "standards",
  "verhaltenskodex-anbieter": "standards",
  urheberrecht: "standards",
  "datenschutzstandards-gastgeber": "standards",
  servicegebuehren: "gebuehren",
  "gebuehren-ausserhalb": "gebuehren",
  steuern: "gebuehren",
  preisangaben: "gebuehren",
  stornierungsbedingungen: "buchung",
  rueckerstattung: "buchung",
  "schwerwiegende-beeintraechtigungen": "buchung",
  beschwerden: "buchung",
  datenschutz: "datenschutz",
  cookies: "datenschutz",
  impressum: "rechtliches",
  dsa: "rechtliches",
  barrierefreiheit: "rechtliches",
  kurzzeitvermietung: "rechtliches",
  behoerdenanfragen: "rechtliches",
  markenzeichen: "rechtliches",
};

export function isLegalDocumentSlug(
  value: string | undefined | null,
): value is LegalDocumentSlug {
  return (
    !!value && (LEGAL_DOCUMENT_SLUGS as readonly string[]).includes(value)
  );
}

// Die Rechtstexte selbst liegen 24-sprachig vor; die Rahmen-Beschriftungen der
// Verzeichnisseite (Gruppentitel, Seitentitel, Sprachwahl) ebenfalls — sonst
// stünde ein dänischer Rechtstext unter einer deutschen Überschrift.
export type LegalChrome = {
  verzeichnisTitel: string;
  verzeichnisIntro: string;
  sprachwahl: string;
  inhaltsverzeichnis: string;
  zurueckZumVerzeichnis: string;
  gruppen: Record<LegalGroup, string>;
};
