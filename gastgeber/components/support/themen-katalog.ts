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

// Dieses Modul ist ein Datenmodul ohne React-Kontext: `useTranslations` läuft
// hier nicht. Die Einträge tragen deshalb Übersetzungs-SCHLÜSSEL (…Key), die
// erst in der rendernden Komponente über t(...) aufgelöst werden. Slugs, Icons
// und Links bleiben unübersetzt — das sind stabile technische Werte.
export interface SupportThema {
  /** Stabiler Slug — muss zu _PRIO_JE_THEMA im Backend passen. */
  slug: string;
  labelKey: string;
  icon: string;
  /** Kurzbeschreibung unter dem Titel (hilft bei der Auswahl). */
  hinweisKey: string;
  /** Selbsthilfe VOR dem Kontakt (Amazons „Quick Solutions"-Muster). */
  selbsthilfe?: { textKey: string; href: string }[];
}

export const SUPPORT_THEMEN: SupportThema[] = [
  {
    slug: "buchung",
    labelKey: "themaBuchung",
    icon: "solar:calendar-line-duotone",
    hinweisKey: "themaBuchungHinweis",
    selbsthilfe: [
      { textKey: "themaBuchungHilfeBuchungen", href: "/buchungen" },
      { textKey: "themaBuchungHilfeNachrichten", href: "/nachrichten" },
    ],
  },
  {
    slug: "zahlung",
    labelKey: "themaZahlung",
    icon: "solar:wallet-line-duotone",
    hinweisKey: "themaZahlungHinweis",
    selbsthilfe: [{ textKey: "themaZahlungHilfeFinanzen", href: "/finanzen" }],
  },
  {
    slug: "objekt",
    labelKey: "themaObjekt",
    icon: "solar:home-line-duotone",
    hinweisKey: "themaObjektHinweis",
    selbsthilfe: [{ textKey: "themaObjektHilfeObjekte", href: "/objekte" }],
  },
  {
    slug: "konto",
    labelKey: "themaKonto",
    icon: "solar:user-line-duotone",
    hinweisKey: "themaKontoHinweis",
    selbsthilfe: [{ textKey: "themaKontoHilfeKonto", href: "/konto" }],
  },
  {
    slug: "technik",
    labelKey: "themaTechnik",
    icon: "solar:bug-line-duotone",
    hinweisKey: "themaTechnikHinweis",
  },
  {
    slug: "sonstiges",
    labelKey: "themaSonstiges",
    icon: "solar:question-circle-line-duotone",
    hinweisKey: "themaSonstigesHinweis",
  },
];

/** Übersetzungs-Schlüssel eines Themas (für die Ticket-Liste).
 *
 *  Unbekannter Slug → null statt des rohen Slugs: Ein technischer Wert in der
 *  Oberfläche ist kein Anzeigetext. Die Renderstelle lässt das Thema dann weg
 *  (sie tut das bei fehlendem Thema ohnehin schon). */
export function themaLabelKey(slug: string | null): string | null {
  if (!slug) return null;
  return SUPPORT_THEMEN.find((t) => t.slug === slug)?.labelKey ?? null;
}

// Melder-Status → Anzeige. Die Statuswerte selbst sind API-Werte und bleiben
// unübersetzt; nur der Anzeigetext kommt über den Schlüssel.
export const STATUS_ANZEIGE: Record<
  string,
  { labelKey: string; ton: "offen" | "du" | "fertig" }
> = {
  in_bearbeitung: { labelKey: "statusInBearbeitung", ton: "offen" },
  wartet_auf_dich: { labelKey: "statusWartetAufDich", ton: "du" },
  geloest: { labelKey: "statusGeloest", ton: "fertig" },
};
