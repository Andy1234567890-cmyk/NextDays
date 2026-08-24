// Český překlad právních informací. Referenční verzí je ./de.ts —
// obsahové změny se provádějí NEJPRVE tam, teprve poté zde.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Právní informace",
  metaDescription:
    "Údaje o poskytovateli myNextDays ApS podle § 7 dánského zákona o elektronickém obchodu (e-handelslov): firma, adresa, vedení, číslo CVR a kontakt.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Údaje o poskytovateli platformy myNextDays — property management system a channel manager provozovaný společností ${ANBIETER.firma}.`,
    "Povinné údaje podle § 7 dánského zákona o elektronickém obchodu (e-handelslov), který provádí článek 5 směrnice 2000/31/ES o elektronickém obchodu.",
  ],
  sections: [
    {
      heading: "Poskytovatel",
      zeilen: [
        {
          label: "Společnost",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Adresa",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Jednatelské vedení",
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
      heading: "Obchodní rejstřík a DPH",
      zeilen: [
        {
          label: "Obchodní rejstřík",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dánsko",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Identifikační číslo pro DPH",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Kontaktní místo podle nařízení o digitálních službách",
      paragraphs: [
        `Centrální kontaktní místo pro orgány podle článku 11 a pro uživatele podle článku 12 nařízení (EU) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Komunikačními jazyky jsou němčina, dánština a angličtina.",
      ],
    },
    {
      heading: "Řešení spotřebitelských sporů",
      paragraphs: [
        "Nejsme ochotni ani povinni účastnit se řízení o řešení sporů před spotřebitelským smírčím orgánem.",
      ],
    },
    {
      heading: "Odpovědnost za odkazy",
      paragraphs: [
        "Přes pečlivou kontrolu obsahu nepřebíráme žádnou odpovědnost za obsah externích odkazů. Za obsah odkazovaných stránek odpovídají výhradně jejich příslušní provozovatelé.",
      ],
    },
    {
      heading: "Autorské právo",
      paragraphs: [
        `Obsah, texty, grafika a ochranné známky zveřejněné na těchto webových stránkách jsou chráněny autorským právem a právem ochranných známek. Jakékoli použití nad rámec zákonem povolených případů vyžaduje předchozí písemný souhlas společnosti ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Další právní dokumenty",
      paragraphs: [
        "Užívání platformy se řídí našimi všeobecnými obchodními podmínkami. Způsob zpracování osobních údajů je uveden v zásadách ochrany osobních údajů; používané soubory cookie jsou uvedeny v zásadách používání souborů cookie.",
      ],
      links: [
        { label: "Všeobecné obchodní podmínky", href: AGB_URL },
        { label: "Zásady ochrany osobních údajů", href: "/datenschutz" },
        { label: "Zásady používání souborů cookie", href: "/cookie-richtlinie" },
        { label: "Smlouva o zpracování osobních údajů (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Rozhodné právo",
      paragraphs: [
        `Společnost ${ANBIETER.firma} má sídlo a je usazena výhradně v Dánsku. Pro tuto online nabídku proto platí dánské právo — i pro českou jazykovou verzi (zásada země původu podle článku 3 směrnice 2000/31/ES). Informační povinnosti se řídí § 7 dánského zákona o elektronickém obchodu (e-handelslov).`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
