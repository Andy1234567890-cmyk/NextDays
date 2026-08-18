import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Accessibility Statement",
  stand: "Last updated: 18 August 2026",
  intro: [
    "myBestDays should be usable by everyone. This statement describes the state of accessibility of the Platform, known limitations and how to report barriers to us.",
    "It relates to the requirements of Directive (EU) 2019/882 on the accessibility requirements for products and services, which has applied to e-commerce services since 28 June 2025.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. State of accessibility",
      paragraphs: [
        "We follow the harmonised standard EN 301 549 and the Web Content Accessibility Guidelines (WCAG) 2.1 underlying it at conformance level AA.",
        "Implemented features include: full keyboard operability, a visible focus indicator, a semantic heading structure, labels on all form fields, text alternatives for controls, sufficient colour contrast, text scalability without loss of content, and a layout that adapts to the screen size.",
        "The legal texts are available in all 24 official languages of the Union and carry correct language markup so that screen readers read them out properly.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Known limitations",
      paragraphs: ["The following are currently not accessible:"],
      list: [
        "Photos and descriptions in listings come from providers; text alternatives to photos may be missing or inadequate. We ask providers to supply them.",
        "Embedded third-party map displays are only partly operable by keyboard. All location information is additionally available as text.",
        "Documents uploaded by providers (for example house rules as PDF) are not consistently tagged for accessibility.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Accessibility of the accommodation",
      paragraphs: [
        "This statement concerns the Platform, not the accommodation. Information about the physical accessibility of an accommodation comes from the provider.",
        "If you depend on particular features — step-free access, door widths, level-access shower, lift — please clarify them with the provider through the messaging function before booking. Inaccurate accessibility information breaches our policies and can be reported.",
      ],
    },
    {
      id: "melden",
      heading: "4. Reporting barriers",
      paragraphs: [
        `If you encounter a barrier, report it to us at ${ANBIETER.email} or via the contact routes under [Complaints and dispute resolution](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Please describe which page is affected, what you were trying to do and which assistive technology you use. We confirm receipt and tell you how and by when we will remove the barrier.",
        "If you need information in an accessible format, we will provide it on request.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Enforcement procedure",
      paragraphs: [
        "If you are not satisfied with our response, you may turn to the body responsible for market surveillance under Directive (EU) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (formerly Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Denmark",
        "Phone: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
