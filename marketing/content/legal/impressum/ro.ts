// Traducerea în limba română a informațiilor legale. Versiunea de
// referință este ./de.ts — modificările de conținut se fac ÎNTÂI acolo.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Informații legale",
  metaDescription:
    "Datele furnizorului myNextDays ApS conform § 7 din legea daneză privind comerțul electronic (e-handelslov): societate, adresă, conducere, număr CVR și contact.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Date despre furnizorul platformei myNextDays — un property management system și channel manager operat de ${ANBIETER.firma}.`,
    "Informații obligatorii conform § 7 din legea daneză privind comerțul electronic (e-handelslov), care transpune articolul 5 din Directiva 2000/31/CE privind comerțul electronic.",
  ],
  sections: [
    {
      heading: "Furnizor",
      zeilen: [
        {
          label: "Societate",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Adresă",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Conducere cu drept de reprezentare",
          werte: [`${ANBIETER.direktion.join(" și ")} (direktører)`],
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
      heading: "Registrul comerțului și TVA",
      zeilen: [
        {
          label: "Registrul comerțului",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Danemarca",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Cod de identificare TVA",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Punct de contact conform Legii serviciilor digitale",
      paragraphs: [
        `Punct de contact central pentru autorități conform articolului 11 și pentru utilizatori conform articolului 12 din Regulamentul (UE) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Limbile de comunicare sunt germana, daneza și engleza.",
      ],
    },
    {
      heading: "Soluționarea litigiilor cu consumatorii",
      paragraphs: [
        "Nu suntem nici dispuși, nici obligați să participăm la o procedură de soluționare a litigiilor în fața unui organism de arbitraj pentru consumatori.",
      ],
    },
    {
      heading: "Răspunderea pentru linkuri",
      paragraphs: [
        "În pofida verificării atente a conținutului, nu ne asumăm nicio răspundere pentru conținutul linkurilor externe. Pentru conținutul paginilor conectate răspund exclusiv operatorii respectivi.",
      ],
    },
    {
      heading: "Drepturi de autor",
      paragraphs: [
        `Conținutul, textele, elementele grafice și mărcile publicate pe acest site web sunt protejate prin dreptul de autor și dreptul mărcilor. Orice utilizare care depășește cazurile permise de lege necesită acordul scris prealabil al ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Alte documente juridice",
      paragraphs: [
        "Utilizarea platformei este reglementată de Condițiile generale de afaceri. Modul în care prelucrăm datele cu caracter personal este descris în Politica de confidențialitate; cookie-urile utilizate sunt enumerate în Politica privind cookie-urile.",
      ],
      links: [
        { label: "Condiții generale de afaceri", href: AGB_URL },
        { label: "Politica de confidențialitate", href: "/datenschutz" },
        { label: "Politica privind cookie-urile", href: "/cookie-richtlinie" },
        { label: "Acord de prelucrare a datelor (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Legea aplicabilă",
      paragraphs: [
        `${ANBIETER.firma} are sediul și este stabilită exclusiv în Danemarca. Prin urmare, acestei oferte online i se aplică legea daneză — inclusiv versiunii în limba română (principiul țării de origine conform articolului 3 din Directiva 2000/31/CE). Obligațiile de informare decurg din § 7 din legea daneză privind comerțul electronic (e-handelslov).`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
