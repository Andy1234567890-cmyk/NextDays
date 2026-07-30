import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Vlastníci a vyúčtovania",
  description: "Kontá vlastníkov, vyúčtovania a provízie.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Vlastníci",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Vytváranie vlastníka",
          excerpt: "Ako vytvoríte nové konto vlastníka v myNextDays.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Vlastníci sú vlastné kontá v myNextDays, prostredníctvom ktorých spravujete objekty patriace určitej osobe alebo spoločnosti. Konto vlastníka získava obmedzený, read-only prehľad o svojich vlastných objektoch, bez možnosti sám vykonávať zmeny v prevádzke.",
            },
            { type: "h2", text: "Vytvorenie nového konta vlastníka" },
            {
              type: "steps",
              items: [
                "V hlavnom menu otvorte sekciu „Vlastníci“.",
                "Kliknite na „Vytvoriť nového vlastníka“.",
                "Zadajte meno, e-mailovú adresu a kontaktné údaje.",
                "V prípade potreby uložte fakturačnú adresu pre vyúčtovania.",
                "Uložte konto.",
              ],
            },
            { type: "h2", text: "Nastavenie prístupu" },
            {
              type: "p",
              text: "Po vytvorení môžete vlastníkovi poslať pozvánku na vlastný prístup. Vlastník sa potom prihlási vlastnými prihlasovacími údajmi a vidí výhradne jemu priradené objekty.",
            },
            {
              type: "ul",
              items: [
                "Konto vlastníka môže zahŕňať viacero objektov.",
                "Každý objekt patrí presne jednému vlastníkovi.",
                "Kontaktné údaje a fakturačnú adresu možno kedykoľvek dodatočne upraviť.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ako priradiť existujúci objekt vlastníkovi, si prečítajte v [Priradenie objektu vlastníkovi](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Priradenie objektu vlastníkovi",
          excerpt: "Každý objekt patrí presne jednému vlastníkovi — takto nastavíte priradenie.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "V myNextDays patrí každý objekt presne jednému vlastníkovi. Viacnásobné priradenie nie je predpokladané — ak má objekt patriť inému vlastníkovi, najprv zrušte existujúce priradenie, kým nastavíte nové.",
            },
            { type: "h2", text: "Vykonanie priradenia" },
            {
              type: "steps",
              items: [
                "Otvorte objekt v sekcii „Objekty“.",
                "Prepnite na kartu „Vlastník“.",
                "Zo zoznamu vyberte zodpovedného vlastníka.",
                "Potvrďte priradenie.",
                "Uložte zmenu na objekte.",
              ],
            },
            { type: "h2", text: "Zmena vlastníka" },
            {
              type: "p",
              text: "Ak sa vlastník objektu zmení, napríklad predajom, nahraďte existujúce priradenie novým. Už vytvorené vyúčtovania za minulé obdobia zostávajú pritom priradené pôvodnému vlastníkovi.",
            },
            {
              type: "ul",
              items: [
                "Objekt môže byť v ktoromkoľvek okamihu priradený len jednému vlastníkovi.",
                "Bez priradenia sa objekt nezobrazí v žiadnom prístupe vlastníka.",
                "Minulé vyúčtovania zostávajú zachované u pôvodného vlastníka.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Viacnásobné priradenie objektu viacerým vlastníkom je vylúčené — systém neumožňuje druhé súbežné priradenie.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Vyúčtovanie vlastníka (Statement)",
          excerpt: "Ako vytvoríte vyúčtovanie s príjmami po odpočítaní provízie pre vlastníka.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Vyúčtovanie vlastníka, nazývané aj Statement, zhŕňa za zvolené obdobie všetky príjmy priradených objektov a odpočíta vašu dohodnutú províziu. Výsledkom je suma, ktorú vlastníkovi vyplatíte.",
            },
            { type: "h2", text: "Vytvorenie vyúčtovania" },
            {
              type: "steps",
              items: [
                "Otvorte sekciu „Vlastníci“ a vyberte požadovaného vlastníka.",
                "Prepnite na kartu „Vyúčtovanie“.",
                "Vyberte zúčtovacie obdobie.",
                "Skontrolujte uvedené rezervácie a príjmy podľa objektu.",
                "Nechajte vytvoriť vyúčtovanie s odpočítanou províziou.",
              ],
            },
            { type: "h2", text: "Štruktúra vyúčtovania" },
            {
              type: "p",
              text: "Vyúčtovanie uvádza pre jednotlivý objekt hrubé príjmy z rezervácií, z nich odpočítanú províziu a výslednú vyplácanú sumu. Dodatočné náklady ako upratovanie alebo poplatky možno podľa dohody vykázať samostatne.",
            },
            {
              type: "ul",
              items: [
                "Hrubé príjmy: súčet všetkých rezervácií za obdobie podľa objektu.",
                "Provízia: váš dohodnutý podiel, odpočíta sa z príjmov.",
                "Vyplácaná suma: príjmy po odpočítaní provízie a prípadných ďalších položiek.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Sumy vo vyúčtovaní sa vždy uvádzajú v mene objektu — neexistuje žiadna paušálna náhradná mena.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Vytvárajte vyúčtovania pravidelne k rovnakému dátumu, aby mali vlastníci spoľahlivý rytmus výplat.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Prístup vlastníka",
          excerpt: "Čo vlastníci vidia vo svojom read-only prístupe.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Prístup vlastníka je vlastné, read-only prihlásenie do myNextDays. Vlastníci v ňom vidia výhradne im priradené objekty a súvisiace obsadenosti a vyúčtovania — bez možnosti sami meniť nastavenia.",
            },
            { type: "h2", text: "Čo vlastníci vidia" },
            {
              type: "ul",
              items: [
                "Kalendár obsadenosti svojich vlastných objektov.",
                "Vytvorené vyúčtovania s príjmami a odpočítanou províziou.",
                "Základné údaje svojich objektov, napríklad vybavenie a popis.",
              ],
            },
            { type: "h2", text: "Aktivácia prístupu" },
            {
              type: "steps",
              items: [
                "Otvorte vlastníka v sekcii „Vlastníci“.",
                "Kliknite na „Pozvať do prístupu“.",
                "Vlastník dostane e-mail na nastavenie vlastného hesla.",
                "Po prihlásení vidí vlastník automaticky len svoje priradené objekty.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Prístup vlastníka je striktne read-only: ceny, dostupnosti alebo údaje objektu môže meniť len vy ako prevádzka, nie samotný vlastník.",
            },
            {
              type: "note",
              variant: "info",
              text: "Viac o priraďovaní objektov nájdete v [Priradenie objektu vlastníkovi](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
