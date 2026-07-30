import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Prvé kroky",
  description: "Nastavte si konto a začnite za pár minút.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Nastavenie",
      articles: [
        {
          slug: "willkommen",
          title: "Vitajte v myNextDays",
          excerpt: "Prehľad PMS, kanálového manažéra, trhoviska a aplikácie.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "myNextDays je vaša centrálna platforma pre rekreačné objekty a hotely. Namiesto viacerých izolovaných riešení spravujete dostupnosť, ceny, rezervácie a komunikáciu s hosťami na jednom mieste — či už prevádzkujete jeden rekreačný dom, alebo viacero hotelových izieb.",
            },
            { type: "h2", text: "Štyri stavebné bloky" },
            {
              type: "ul",
              items: [
                "PMS (systém správy nehnuteľností): objekty, kalendár, ceny, rezervácie, úlohy a platby.",
                "Kanálový manažér: prepojenie s portálmi ako Booking, Airbnb a ďalšie — jeden zápis, mnoho portálov synchronizovaných.",
                "Trhovisko platformy: vlastné trhovisko myNextDays, rovnocenný rezervačný kanál popri portáloch.",
                "Aplikácia: mobilná aplikácia pre hostí, vlastníkov a zamestnancov s rovnakými údajmi ako na webe.",
              ],
            },
            { type: "h2", text: "Ako stavebné bloky spolupracujú" },
            {
              type: "p",
              text: "Objekt, ceny a dostupnosť spravujete jedenkrát centrálne v PMS. Odtiaľ myNextDays údaje automaticky rozdeľuje na všetky aktívne kanály. Rezervácia — bez ohľadu na to, cez ktorý kanál príde — okamžite zablokuje príslušné noci všade, takže dvojité rezervácie sú vylúčené.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Začnite nastavením konta a prevádzky, potom vytvorte svoj prvý objekt — toto poradie vám neskôr ušetrí opravy.",
            },
            { type: "h2", text: "Ďalšie kroky" },
            {
              type: "steps",
              items: [
                "V menu otvorte Konto a doplňte údaje o svojej prevádzke.",
                "V sekcii Objekty vytvorte svoj prvý objekt.",
                "Skontrolujte úplnosť vybavenia, fotografií a cien.",
                "Kliknite na Zverejniť, aby bol objekt viditeľný na všetkých kanáloch.",
              ],
            },
            {
              type: "p",
              text: "Viac k jednotlivým krokom nájdete v [Nastavenie konta a prevádzky](/hilfe/erste-schritte/konto-einrichten) a [Vytvorenie vášho prvého objektu](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Nastavenie konta a prevádzky",
          excerpt: "Správne uloženie základných údajov, fakturačnej adresy a meny.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Skôr než vytvoríte objekty, nastavte si prevádzku v konte. Tieto údaje sú potrebné pre faktúry, portály a vyúčtovanie s myNextDays, a preto by mali byť úplné a správne.",
            },
            { type: "h2", text: "Uloženie základných údajov" },
            {
              type: "steps",
              items: [
                "V menu otvorte Konto.",
                "V sekcii Základné údaje zadajte názov firmy, prípadne meno živnostníka, adresu a kontaktné údaje.",
                "Uložte fakturačnú adresu — objaví sa na všetkých vystavených faktúrach.",
                "Vyberte svoju základnú menu. Tá platí pre všetky ceny, kým ju cielene nezmeníte pre jednotlivý objekt.",
              ],
            },
            { type: "h2", text: "Prečo je mena dôležitá" },
            {
              type: "p",
              text: "Mena sa neodhaduje ani nedopĺňa automaticky: ak chýba, nemožno správne zobraziť ani vyúčtovať žiadnu cenu. Preto myNextDays vyžaduje pri nastavovaní vedomý výber, namiesto použitia predvolenej hodnoty.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ak dodatočne zmeníte menu objektu, zmenia sa aj všetky s ňou spojené cenníky. Následne ceny raz skontrolujte.",
            },
            { type: "h2", text: "Fakturačná adresa a vyúčtovanie" },
            {
              type: "p",
              text: "V sekcii Vyúčtovanie v konte vidíte svoje aktuálne faktúry a uloženú fakturačnú adresu. Udržiavajte ju aktuálnu, najmä pri zmene právnej formy alebo adresy, aby boli faktúry vystavované správne.",
            },
            {
              type: "ul",
              items: [
                "Názov firmy, prípadne meno živnostníka",
                "Fakturačná adresa vrátane krajiny",
                "Daňové, resp. IČ DPH číslo, ak existuje",
                "Základná mena pre nové objekty",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Vytvorenie vášho prvého objektu",
          excerpt: "Ako krok za krokom vytvoríte svoj prvý rezervovateľný objekt.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Objekt v myNextDays je vždy presne jedna rezervovateľná jednotka: buď jednotlivá izba v hoteli, alebo kompletný rekreačný objekt. Ak prevádzkujete hotel s viacerými izbami, vytvorte pre každú izbu vlastný objekt.",
            },
            { type: "h2", text: "Vytvorenie objektu" },
            {
              type: "steps",
              items: [
                "V menu otvorte Objekty.",
                "Kliknite na Pridať objekt.",
                "Vyberte typ objektu: kategóriu, typ nehnuteľnosti a spôsob ponuky.",
                "Doplňte adresu, obsadenosť a základnú cenu vo vašej uloženej mene.",
                "Uložte objekt ako koncept, aby ste ho mohli neskôr dokončiť.",
              ],
            },
            { type: "h2", text: "Čo ešte potom chýba" },
            {
              type: "p",
              text: "Novo vytvorený objekt je najprv koncept a nie je viditeľný na žiadnom kanáli. Pred zverejnením doplňte vybavenie, fotografie, popis a dostupnosť v kalendári — len úplný objekt sa dá spoľahlivo ponúkať.",
            },
            {
              type: "ul",
              items: [
                "Výber vlastností vybavenia zo zoznamu kategórie",
                "Uloženie aspoň jednej titulnej fotografie a popisu",
                "Správne zadanie obsadenosti (dospelí, deti, postele)",
                "Kontrola základnej ceny a dostupnosti v kalendári",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ak prevádzkujete viacero typov izieb, opakujte tento postup pre každú jednotlivú izbu — neexistuje žiadna nadradená úroveň budovy s izbami pod ňou.",
            },
            {
              type: "p",
              text: "Keď sú vyplnené všetky povinné polia, môžete objekt zverejniť, pozri [Zverejnenie objektu](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Zverejnenie objektu",
          excerpt: "Jedno kliknutie súčasne aktivuje trhovisko platformy, portály a webovú stránku.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Zverejnenie robí objekt viditeľným a rezervovateľným. Zvyčajne stačí jediné kliknutie na aktiváciu všetkých troch predajných kanálov naraz — viditeľnosť na jednotlivých kanáloch však môžete kedykoľvek upraviť samostatne.",
            },
            { type: "h2", text: "Ako zverejniť objekt" },
            {
              type: "steps",
              items: [
                "Otvorte objekt v sekcii Objekty.",
                "V záložke Prehľad skontrolujte, či sú všetky povinné údaje označené zelenou farbou.",
                "Kliknite na Zverejniť.",
                "Potvrďte dialóg — aktivujú sa trhovisko platformy, portály a webová stránka.",
              ],
            },
            { type: "h2", text: "Samostatné riadenie kanálov" },
            {
              type: "p",
              text: "Po zverejnení nájdete v záložke Viditeľnosť tri samostatné prepínače: webová stránka, trhovisko platformy a portály. Ak chcete objekt ponúkať napríklad len na vlastnej webovej stránke, ale nie cez portály, jednoducho vypnite príslušný prepínač.",
            },
            {
              type: "ul",
              items: [
                "Webová stránka: viditeľnosť na vašej vlastnej webovej stránke myNextDays",
                "Trhovisko platformy: viditeľnosť na globálnom trhovisku myNextDays",
                "Portály: viditeľnosť na Booking, Airbnb a ďalších",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Tieto tri prepínače sú nezávislé od statusu objektu (aktívny/neaktívny). Aktívny objekt môže byť napriek tomu na niektorých kanáloch neviditeľný.",
            },
            { type: "h2", text: "Dočasné zablokovanie objektu" },
            {
              type: "p",
              text: "Ak chcete zablokovať len jeden deň namiesto celého objektu, použite v kalendári funkciu Stop-Sell — tá zablokuje deň na všetkých kanáloch súčasne, bez ohľadu na prepínače viditeľnosti.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Pochopenie troch predajných kanálov",
          excerpt: "Prehľad portálov, trhoviska platformy a aplikácie.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "myNextDays ponúka každý objekt súčasne cez viacero rovnocenných ciest. Pochopenie ich vzájomného pôsobenia vám pomôže cielene riadiť viditeľnosť a ceny.",
            },
            { type: "h2", text: "Portály" },
            {
              type: "p",
              text: "Cez kanálového manažéra prepojíte svoj objekt s veľkými rezervačnými portálmi ako Booking, Airbnb a ďalšie. Dostupnosť a ceny sa synchronizujú automaticky, takže nemusíte ručne spravovať viacero portálových kalendárov.",
            },
            { type: "h2", text: "Trhovisko platformy" },
            {
              type: "p",
              text: "Trhovisko myNextDays je vlastný, globálny rezervačný kanál — porovnateľný s Booking alebo Airbnb, no je súčasťou tej istej platformy. Nie je náhradou „priamych rezervácií“, ale rovnocenným kanálom s vlastnou osou viditeľnosti.",
            },
            { type: "h2", text: "Aplikácia" },
            {
              type: "p",
              text: "Mobilná aplikácia ponúka hosťom, vlastníkom a zamestnancom prístup k rovnakým údajom ako web — napríklad podrobnosti o rezervácii, správy alebo úlohy, v závislosti od príslušnej role.",
            },
            { type: "h2", text: "Tri samostatné osi viditeľnosti" },
            {
              type: "ul",
              items: [
                "Webová stránka — vaša vlastná webová stránka myNextDays",
                "Trhovisko platformy — globálne trhovisko myNextDays",
                "Portály — Booking, Airbnb a ďalšie cez kanálového manažéra",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Všetky tri osi sa dajú prepínať nezávisle od seba. Stop-Sell a status objektu naopak pôsobia naprieč kanálmi na všetky tri súčasne.",
            },
          ],
        },
      ],
    },
  ],
};
