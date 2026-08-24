// Nederlandse vertaling van het colofon. De referentieversie is ./de.ts —
// inhoudelijke wijzigingen horen EERST daar, pas daarna hier.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Colofon",
  metaDescription:
    "Aanbiedersgegevens van myNextDays ApS conform § 7 van de Deense e-handelslov: bedrijf, adres, directie, CVR-nummer en contact.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Gegevens over de aanbieder van het platform myNextDays — een property management system en channel manager, geëxploiteerd door ${ANBIETER.firma}.`,
    "Verplichte informatie conform § 7 van de Deense e-handelslov, die artikel 5 van Richtlijn 2000/31/EG betreffende elektronische handel omzet.",
  ],
  sections: [
    {
      heading: "Aanbieder",
      zeilen: [
        {
          label: "Onderneming",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Adres",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Vertegenwoordigingsbevoegde directie",
          werte: [`${ANBIETER.direktion.join(" en ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Contact",
      zeilen: [
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefoon",
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
      heading: "Handelsregister en btw",
      zeilen: [
        {
          label: "Handelsregister",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Denemarken",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Btw-identificatienummer",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Contactpunt op grond van de Digital Services Act",
      paragraphs: [
        `Centraal contactpunt voor autoriteiten op grond van artikel 11 en voor gebruikers op grond van artikel 12 van Verordening (EU) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Communicatietalen zijn Duits, Deens en Engels.",
      ],
    },
    {
      heading: "Buitengerechtelijke geschillenbeslechting",
      paragraphs: [
        "Wij zijn niet bereid en niet verplicht om deel te nemen aan een geschillenbeslechtingsprocedure voor een geschillencommissie voor consumenten.",
      ],
    },
    {
      heading: "Aansprakelijkheid voor links",
      paragraphs: [
        "Ondanks zorgvuldige inhoudelijke controle aanvaarden wij geen aansprakelijkheid voor de inhoud van externe links. Voor de inhoud van de gelinkte pagina's zijn uitsluitend de beheerders daarvan verantwoordelijk.",
      ],
    },
    {
      heading: "Auteursrecht",
      paragraphs: [
        `De op deze website gepubliceerde inhoud, teksten, afbeeldingen en merken zijn beschermd door het auteurs- en merkenrecht. Elk gebruik buiten de wettelijk toegestane gevallen vereist voorafgaande schriftelijke toestemming van ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Overige juridische documenten",
      paragraphs: [
        "Het gebruik van het platform is onderworpen aan onze algemene voorwaarden. Hoe wij persoonsgegevens verwerken, staat in de privacyverklaring; de gebruikte cookies staan vermeld in het cookiebeleid.",
      ],
      links: [
        { label: "Algemene voorwaarden", href: AGB_URL },
        { label: "Privacyverklaring", href: "/datenschutz" },
        { label: "Cookiebeleid", href: "/cookie-richtlinie" },
        { label: "Verwerkersovereenkomst (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Toepasselijk recht",
      paragraphs: [
        `${ANBIETER.firma} heeft haar zetel en is uitsluitend gevestigd in Denemarken. Op dit online-aanbod is daarom Deens recht van toepassing — ook op de Nederlandstalige versie (oorsprongslandbeginsel volgens artikel 3 van Richtlijn 2000/31/EG). De informatieverplichtingen volgen uit § 7 van de Deense e-handelslov.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
