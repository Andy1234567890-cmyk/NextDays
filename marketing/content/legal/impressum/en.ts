// Englische Übersetzung des Impressums. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Legal notice",
  metaDescription:
    "Provider information for myNextDays ApS under § 7 of the Danish E-handelslov: company, address, management, CVR number and contact details.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Details about the provider of the myNextDays platform — a property management system and channel manager operated by ${ANBIETER.firma}.`,
    "Mandatory disclosures under § 7 of the Danish E-handelslov, which implements Article 5 of Directive 2000/31/EC on electronic commerce.",
  ],
  sections: [
    {
      heading: "Provider",
      zeilen: [
        {
          label: "Company",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Address",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Authorised management",
          werte: [`${ANBIETER.direktion.join(" and ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Contact",
      zeilen: [
        {
          label: "Email",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Phone",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Website",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Register and VAT",
      zeilen: [
        {
          label: "Commercial register",
          werte: [
            `CVR no. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Denmark",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "VAT identification number",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Contact point under the Digital Services Act",
      paragraphs: [
        `Central contact point for authorities under Article 11 and for users under Article 12 of Regulation (EU) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Communication languages are German, Danish and English.",
      ],
    },
    {
      heading: "Consumer dispute resolution",
      paragraphs: [
        "We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.",
      ],
    },
    {
      heading: "Liability for links",
      paragraphs: [
        "Despite careful review of content, we accept no liability for the content of external links. Responsibility for the content of linked pages lies solely with their respective operators.",
      ],
    },
    {
      heading: "Copyright",
      paragraphs: [
        `The content, texts, graphics and trademarks published on this website are protected by copyright and trademark law. Any use beyond what is permitted by law requires the prior written consent of ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Further legal documents",
      paragraphs: [
        "Use of the platform is governed by our General Terms and Conditions. How we process personal data is set out in the Privacy Policy; the cookies we use are listed in the Cookie Policy.",
      ],
      links: [
        { label: "General Terms and Conditions", href: AGB_URL },
        { label: "Privacy Policy", href: "/datenschutz" },
        { label: "Cookie Policy", href: "/cookie-richtlinie" },
        { label: "Data Processing Agreement (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Applicable law",
      paragraphs: [
        `${ANBIETER.firma} is headquartered and exclusively established in Denmark. Danish law therefore applies to this online offering — including this English-language version (country-of-origin principle under Article 3 of Directive 2000/31/EC). The information obligations are governed by § 7 of the Danish E-handelslov.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
