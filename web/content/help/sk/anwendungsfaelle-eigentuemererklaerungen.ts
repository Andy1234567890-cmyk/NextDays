import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Vyúčtovania pre vlastníkov",
  description: "Vytváranie vyúčtovaní pre vlastníkov.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Vyúčtovania pre vlastníkov",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Vytvorenie vyúčtovania pre vlastníka",
          excerpt: "Ako vytvoríte pre vlastníka prehľadné vyúčtovanie za jeho obdobie.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia",
            },
            {
              type: "p",
              text: "Ak spravujete objekty pre vlastníkov, títo pravidelne potrebujú zrozumiteľný prehľad príjmov, odpočítanej provízie a výplaty za svoje objekty za určité obdobie — vyúčtovanie vlastníka tieto údaje automaticky zhrnie.",
            },
            {
              type: "steps",
              items: [
                "V konte otvorte oblasť Vlastníci a vyberte príslušného vlastníka.",
                "Vyberte zúčtovacie obdobie, za ktoré sa má vyúčtovanie vytvoriť.",
                "Skontrolujte, či sú všetky objekty tohto vlastníka správne priradené, pretože do vyúčtovania vstupujú len priradené objekty.",
                "Nechajte vyúčtovanie vytvoriť a skontrolujte úplnosť uvedených rezervácií.",
                "Vyúčtovanie sprístupnite vlastníkovi cez jeho prístup alebo ho exportujte ako dokument.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vyúčtovanie zobrazuje každú rezerváciu so sumou v príslušnej mene objektu — neexistuje žiadne paušálne označenie meny, keďže viaceré objekty môžu mať aj rôzne meny. Viac o priraďovaní nájdete v článku [Priradenie objektu vlastníkovi](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Vyúčtovanie provízie s vlastníkom",
          excerpt: "Ako zabezpečíte, aby sa vaša provízia správne počítala z príjmov vlastníka.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia",
            },
            {
              type: "p",
              text: "Vaša provízia za správu objektu je uložená v tarife vlastníka a pri každom vyúčtovaní sa automaticky odpočíta z hrubých príjmov. Aby vyúčtovanie sedelo, musí byť sadzba provízie správne nastavená ešte pred prvou rezerváciou v danom období.",
            },
            {
              type: "steps",
              items: [
                "V konte otvorte tarifu príslušného vlastníka a skontrolujte uloženú sadzbu provízie.",
                "V prípade potreby sadzbu upravte ešte predtým, než v nadchádzajúcom zúčtovacom období pribudnú nové rezervácie.",
                "Vytvorte vyúčtovanie vlastníka za dané obdobie a skontrolujte, či je provízia za jednotlivé rezervácie správne vykázaná.",
                "Overte hodnovernosť súčtu hrubých príjmov, odpočítanej provízie a čistej výplaty.",
                "Prípadné odchýlky vyjasnite s vlastníkom priamo pred schválením vyúčtovania, namiesto dodatočnej zmeny vyúčtovania.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dodatočná zmena sadzby provízie sa prejaví len na budúcich obdobiach, nie spätne na už vytvorených vyúčtovaniach. Sadzbu preto skontrolujte včas pred začiatkom nového zúčtovacieho obdobia — pozri tiež [Vyúčtovanie vlastníka (Statement)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
