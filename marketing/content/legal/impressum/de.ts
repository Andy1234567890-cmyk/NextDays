// Impressum (Anbieterangaben) der Marketing-Site.
//
// Rechtsgrundlage: § 7 der dänischen E-handelslov (Sitzland = Dänemark), die
// Artikel 5 der Richtlinie 2000/31/EG umsetzt. Das deutsche DDG ist NICHT
// anwendbar: nach dem Herkunftslandprinzip (Art. 3 der Richtlinie, § 3 DDG)
// gilt für einen in Dänemark niedergelassenen Anbieter dänisches Recht, auch
// für das deutschsprachige Angebot.
//
// Firmen-/Registerdaten kommen AUSSCHLIESSLICH aus ./anbieter.ts.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Impressum",
  metaDescription:
    "Anbieterangaben der myNextDays ApS nach § 7 der dänischen E-handelslov: Firma, Anschrift, Direktion, CVR-Nummer und Kontakt.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Angaben zum Anbieter der Plattform myNextDays — Property-Management-System und Channel-Manager der ${ANBIETER.firma}.`,
    "Pflichtangaben nach § 7 der dänischen E-handelslov, die Artikel 5 der Richtlinie 2000/31/EG über den elektronischen Geschäftsverkehr umsetzt.",
  ],
  sections: [
    {
      heading: "Anbieter",
      zeilen: [
        {
          label: "Unternehmen",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Anschrift",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Vertretungsberechtigte Direktion",
          werte: [`${ANBIETER.direktion.join(" und ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Kontakt",
      zeilen: [
        {
          label: "E-Mail",
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
      heading: "Register und Umsatzsteuer",
      zeilen: [
        {
          label: "Handelsregister",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dänemark",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Umsatzsteuer-Identifikationsnummer",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Kontaktstelle nach dem Digital Services Act",
      paragraphs: [
        `Zentrale Kontaktstelle für Behörden nach Artikel 11 und für Nutzerinnen und Nutzer nach Artikel 12 der Verordnung (EU) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Kommunikationssprachen sind Deutsch, Dänisch und Englisch.",
      ],
    },
    {
      heading: "Verbraucherstreitbeilegung",
      paragraphs: [
        "Wir sind nicht bereit und nicht verpflichtet, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
      ],
    },
    {
      heading: "Haftung für Links",
      paragraphs: [
        "Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.",
      ],
    },
    {
      heading: "Urheberrecht",
      paragraphs: [
        `Die auf dieser Website veröffentlichten Inhalte, Texte, Grafiken und Marken sind urheber- und markenrechtlich geschützt. Eine Verwendung außerhalb der gesetzlich zugelassenen Fälle bedarf der vorherigen schriftlichen Zustimmung der ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Weitere Rechtsdokumente",
      paragraphs: [
        "Die Nutzung der Plattform richtet sich nach unseren Allgemeinen Geschäftsbedingungen. Wie wir personenbezogene Daten verarbeiten, steht in der Datenschutzerklärung; die eingesetzten Cookies sind in der Cookie-Richtlinie aufgeführt.",
      ],
      links: [
        { label: "Allgemeine Geschäftsbedingungen", href: AGB_URL },
        { label: "Datenschutzerklärung", href: "/datenschutz" },
        { label: "Cookie-Richtlinie", href: "/cookie-richtlinie" },
        { label: "Auftragsverarbeitung (AVV)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Anwendbares Recht",
      paragraphs: [
        `Die ${ANBIETER.firma} hat ihren Sitz in Dänemark und ist ausschließlich dort niedergelassen. Für dieses Online-Angebot gilt daher dänisches Recht — auch für die deutschsprachige Fassung (Herkunftslandprinzip nach Artikel 3 der Richtlinie 2000/31/EG). Die Informationspflichten richten sich nach § 7 der dänischen E-handelslov.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
