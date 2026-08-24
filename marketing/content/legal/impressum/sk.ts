// Slovenský preklad právnych informácií. Referenčnou verziou je ./de.ts —
// obsahové zmeny sa vykonávajú NAJPRV tam, až potom tu.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Právne informácie",
  metaDescription:
    "Údaje o poskytovateľovi myNextDays ApS podľa § 7 dánskeho zákona o elektronickom obchode (e-handelslov): spoločnosť, adresa, vedenie, číslo CVR a kontakt.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Údaje o poskytovateľovi platformy myNextDays — property management system a channel manager prevádzkovaný spoločnosťou ${ANBIETER.firma}.`,
    "Povinné údaje podľa § 7 dánskeho zákona o elektronickom obchode (e-handelslov), ktorý transponuje článok 5 smernice 2000/31/ES o elektronickom obchode.",
  ],
  sections: [
    {
      heading: "Poskytovateľ",
      zeilen: [
        {
          label: "Spoločnosť",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Adresa",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Konateľské vedenie",
          werte: [`${ANBIETER.direktion.join(" a ")} (direktører)`],
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
          label: "Telefón",
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
      heading: "Obchodný register a DPH",
      zeilen: [
        {
          label: "Obchodný register",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dánsko",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Identifikačné číslo pre DPH",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Kontaktné miesto podľa nariadenia o digitálnych službách",
      paragraphs: [
        `Centrálne kontaktné miesto pre orgány podľa článku 11 a pre používateľov podľa článku 12 nariadenia (EÚ) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Komunikačnými jazykmi sú nemčina, dánčina a angličtina.",
      ],
    },
    {
      heading: "Riešenie spotrebiteľských sporov",
      paragraphs: [
        "Nie sme ochotní ani povinní zúčastniť sa na konaní o riešení sporov pred spotrebiteľským zmierovacím orgánom.",
      ],
    },
    {
      heading: "Zodpovednosť za odkazy",
      paragraphs: [
        "Napriek starostlivej kontrole obsahu nepreberáme žiadnu zodpovednosť za obsah externých odkazov. Za obsah prepojených stránok zodpovedajú výlučne ich príslušní prevádzkovatelia.",
      ],
    },
    {
      heading: "Autorské právo",
      paragraphs: [
        `Obsah, texty, grafika a ochranné známky zverejnené na tejto webovej stránke sú chránené autorským právom a právom ochranných známok. Akékoľvek použitie presahujúce rámec zákonom povolených prípadov si vyžaduje predchádzajúci písomný súhlas spoločnosti ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Ďalšie právne dokumenty",
      paragraphs: [
        "Používanie platformy sa riadi našimi všeobecnými obchodnými podmienkami. Spôsob spracovania osobných údajov je uvedený v zásadách ochrany osobných údajov; používané súbory cookie sú uvedené v zásadách používania súborov cookie.",
      ],
      links: [
        { label: "Všeobecné obchodné podmienky", href: AGB_URL },
        { label: "Zásady ochrany osobných údajov", href: "/datenschutz" },
        { label: "Zásady používania súborov cookie", href: "/cookie-richtlinie" },
        { label: "Zmluva o spracúvaní osobných údajov (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Rozhodné právo",
      paragraphs: [
        `Spoločnosť ${ANBIETER.firma} má sídlo a je usadená výlučne v Dánsku. Na túto online ponuku sa preto vzťahuje dánske právo — aj na slovenskú jazykovú verziu (zásada krajiny pôvodu podľa článku 3 smernice 2000/31/ES). Informačné povinnosti sa riadia § 7 dánskeho zákona o elektronickom obchode (e-handelslov).`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
