// Themenbaum des Gastgeber-Supports.
//
// Warum ein Themenbaum statt eines Freitextfelds: Airbnb („Choose" →
// Unterthema → „It's something else"), Booking („a topic and, possibly, a
// subtopic") und Amazon (Kategoriebaum mit „My issue is not listed") führen
// alle über eine geführte Auswahl. Der Grund ist nicht Bequemlichkeit, sondern
// Routing — das gewählte Thema bestimmt serverseitig die Priorität.
//
// WICHTIG: Der Melder wählt KEINE Priorität. Sie wird im Backend aus dem Thema
// abgeleitet (_PRIO_JE_THEMA). Ein frei wählbares Prioritätsfeld führt zur
// Inflation: wer schnell drankommen will, wählt immer die höchste Stufe.
// Zendesk blendet das Feld vor Endkunden aus, ServiceNow setzt es
// schreibgeschützt — wir folgen dem.

export interface SupportThema {
  /** Stabiler Slug — muss zu _PRIO_JE_THEMA im Backend passen. */
  slug: string;
  label: string;
  icon: string;
  /** Kurzbeschreibung unter dem Titel (hilft bei der Auswahl). */
  hinweis: string;
  /** Selbsthilfe VOR dem Kontakt (Amazons „Quick Solutions"-Muster). */
  selbsthilfe?: { text: string; href: string }[];
}

export const SUPPORT_THEMEN: SupportThema[] = [
  {
    slug: "buchung",
    label: "Buchung & Gäste",
    icon: "solar:calendar-line-duotone",
    hinweis: "Reservierungen, Stornierungen, Gästekommunikation",
    selbsthilfe: [
      { text: "Buchungen ansehen", href: "/buchungen" },
      { text: "Nachrichten an Gäste", href: "/nachrichten" },
    ],
  },
  {
    slug: "zahlung",
    label: "Zahlungen & Auszahlungen",
    icon: "solar:wallet-line-duotone",
    hinweis: "Auszahlungen, Gebühren, Rechnungen",
    selbsthilfe: [{ text: "Finanzen öffnen", href: "/finanzen" }],
  },
  {
    slug: "objekt",
    label: "Objekt & Inserat",
    icon: "solar:home-line-duotone",
    hinweis: "Objektdaten, Fotos, Sichtbarkeit auf den Portalen",
    selbsthilfe: [{ text: "Meine Objekte", href: "/objekte" }],
  },
  {
    slug: "konto",
    label: "Konto & Zugang",
    icon: "solar:user-line-duotone",
    hinweis: "Anmeldung, Mitarbeiter, Sicherheit",
    selbsthilfe: [{ text: "Kontoeinstellungen", href: "/konto" }],
  },
  {
    slug: "technik",
    label: "Technisches Problem",
    icon: "solar:bug-line-duotone",
    hinweis: "Fehler, etwas funktioniert nicht wie erwartet",
  },
  {
    slug: "sonstiges",
    label: "Etwas anderes",
    icon: "solar:question-circle-line-duotone",
    hinweis: "Passt nichts davon? Beschreibe dein Anliegen frei.",
  },
];

/** Anzeigename eines Themas (für die Ticket-Liste). */
export function themaLabel(slug: string | null): string | null {
  if (!slug) return null;
  return SUPPORT_THEMEN.find((t) => t.slug === slug)?.label ?? slug;
}

// Melder-Status → Anzeige. Die Werte kommen bereits übersetzt vom Server
// (_MELDER_STATUS); interne Zustände wie „waiting" erreichen den Client nie.
export const STATUS_ANZEIGE: Record<
  string,
  { label: string; ton: "offen" | "du" | "fertig" }
> = {
  in_bearbeitung: { label: "In Bearbeitung", ton: "offen" },
  wartet_auf_dich: { label: "Warten auf dich", ton: "du" },
  geloest: { label: "Gelöst", ton: "fertig" },
};
