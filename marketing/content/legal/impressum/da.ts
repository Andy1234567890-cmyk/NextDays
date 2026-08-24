// Dansk oversættelse af Impressum. Referenceversionen er ./de.ts —
// indholdsmæssige ændringer skal FØRST foretages der, derefter her.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Juridiske oplysninger",
  metaDescription:
    "Udbyderoplysninger for myNextDays ApS i henhold til § 7 i den danske e-handelslov: firma, adresse, direktion, CVR-nummer og kontakt.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Oplysninger om udbyderen af platformen myNextDays — et property management system og channel manager drevet af ${ANBIETER.firma}.`,
    "Obligatoriske oplysninger efter § 7 i den danske e-handelslov, der gennemfører artikel 5 i direktiv 2000/31/EF om elektronisk handel.",
  ],
  sections: [
    {
      heading: "Udbyder",
      zeilen: [
        {
          label: "Virksomhed",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Adresse",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Tegningsberettiget direktion",
          werte: [`${ANBIETER.direktion.join(" og ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Kontakt",
      zeilen: [
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Internet",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Registrering og moms",
      zeilen: [
        {
          label: "Erhvervsregister",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Danmark",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Momsregistreringsnummer",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Kontaktpunkt efter forordningen om digitale tjenester",
      paragraphs: [
        `Centralt kontaktpunkt for myndigheder efter artikel 11 og for brugere efter artikel 12 i forordning (EU) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Kommunikationssprogene er tysk, dansk og engelsk.",
      ],
    },
    {
      heading: "Forbrugerklagenævn",
      paragraphs: [
        "Vi er hverken villige eller forpligtede til at deltage i en tvistbilæggelsesprocedure ved et forbrugerklagenævn.",
      ],
    },
    {
      heading: "Ansvar for links",
      paragraphs: [
        "På trods af omhyggelig indholdskontrol påtager vi os intet ansvar for indholdet af eksterne links. Ansvaret for indholdet af de linkede sider ligger udelukkende hos disses respektive udbydere.",
      ],
    },
    {
      heading: "Ophavsret",
      paragraphs: [
        `Det indhold, de tekster, grafikker og varemærker, der offentliggøres på denne hjemmeside, er beskyttet af ophavsret og varemærkeret. Enhver brug ud over det lovligt tilladte kræver forudgående skriftligt samtykke fra ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Yderligere juridiske dokumenter",
      paragraphs: [
        "Brugen af platformen er reguleret af vores almindelige forretningsbetingelser. Hvordan vi behandler personoplysninger, fremgår af persondatapolitikken; de anvendte cookies er angivet i cookiepolitikken.",
      ],
      links: [
        { label: "Almindelige forretningsbetingelser", href: AGB_URL },
        { label: "Persondatapolitik", href: "/datenschutz" },
        { label: "Cookiepolitik", href: "/cookie-richtlinie" },
        { label: "Databehandleraftale (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Lovvalg",
      paragraphs: [
        `${ANBIETER.firma} har hjemsted og er udelukkende etableret i Danmark. For dette onlinetilbud gælder derfor dansk ret — også for den danske sprogversion (oprindelseslandsprincippet efter artikel 3 i direktiv 2000/31/EF). Oplysningspligterne følger af § 7 i den danske e-handelslov.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
