import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "První kroky",
  description: "Nastavte si účet a začněte během několika minut.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Nastavení",
      articles: [
        {
          slug: "willkommen",
          title: "Vítejte v myNextDays",
          excerpt: "Přehled PMS, kanálového manažeru, tržiště a aplikace.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "myNextDays je vaše centrální platforma pro rekreační objekty a hotely. Místo několika oddělených řešení spravujete dostupnost, ceny, rezervace a komunikaci s hosty na jednom místě — ať už provozujete jeden rekreační dům, nebo více hotelových pokojů.",
            },
            { type: "h2", text: "Čtyři stavební kameny" },
            {
              type: "ul",
              items: [
                "PMS (systém pro správu objektů): objekty, kalendář, ceny, rezervace, úkoly a platby.",
                "Kanálový manažer: propojení s portály jako Booking, Airbnb a další — jedno zadání, více portálů synchronně.",
                "Tržiště platformy: vlastní tržiště myNextDays, rovnocenný rezervační kanál vedle portálů.",
                "Aplikace: mobilní aplikace pro hosty, vlastníky a zaměstnance se stejnými daty jako na webu.",
              ],
            },
            { type: "h2", text: "Jak stavební kameny spolupracují" },
            {
              type: "p",
              text: "Objekt, ceny a dostupnost spravujete jednou centrálně v PMS. Odtud myNextDays automaticky distribuuje data na všechny aktivní kanály. Rezervace — bez ohledu na kanál, ze kterého přichází — okamžitě zablokuje příslušné noci všude, takže dvojité rezervace jsou vyloučené.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Začněte nastavením účtu a provozu, poté vytvořte svůj první objekt — toto pořadí vám později ušetří opravy.",
            },
            { type: "h2", text: "Další kroky" },
            {
              type: "steps",
              items: [
                "Otevřete v menu Účet a doplňte údaje o svém provozu.",
                "Vytvořte v sekci Objekty svůj první objekt.",
                "Zkontrolujte úplnost vybavení, fotografií a cen.",
                "Klikněte na Zveřejnit, aby byl objekt viditelný na všech kanálech.",
              ],
            },
            {
              type: "p",
              text: "Více k jednotlivým krokům najdete v článcích [Nastavení účtu a provozu](/hilfe/erste-schritte/konto-einrichten) a [Vytvoření vašeho prvního objektu](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Nastavení účtu a provozu",
          excerpt: "Správně uložte základní údaje, fakturační adresu a měnu.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Než začnete vytvářet objekty, nastavte si svůj provoz v účtu. Tyto údaje jsou potřeba pro faktury, portály a vyúčtování s myNextDays, a proto by měly být úplné a správné.",
            },
            { type: "h2", text: "Uložení základních údajů" },
            {
              type: "steps",
              items: [
                "Otevřete v menu Účet.",
                "V sekci Základní údaje vyplňte název firmy, případně jméno živnostníka, adresu a kontaktní údaje.",
                "Uložte fakturační adresu — zobrazuje se na všech vystavených fakturách.",
                "Vyberte svou základní měnu. Ta platí pro všechny ceny, dokud ji cíleně nezměníte pro konkrétní objekt.",
              ],
            },
            { type: "h2", text: "Proč je měna důležitá" },
            {
              type: "p",
              text: "Měna se nehádá ani nedoplňuje automaticky: pokud chybí, nelze žádnou cenu správně zobrazit ani vyúčtovat. Proto myNextDays při nastavení vyžaduje vědomý výběr místo dosazení výchozí hodnoty.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Změníte-li měnu objektu dodatečně, přepnou se s ní i všechny navázané cenové plány. Poté ceny jednou zkontrolujte.",
            },
            { type: "h2", text: "Fakturační adresa a vyúčtování" },
            {
              type: "p",
              text: "V sekci Vyúčtování v účtu vidíte své aktuální faktury a uloženou fakturační adresu. Udržujte ji aktuální, zejména při změně právní formy nebo adresy, aby byly faktury vystavovány správně.",
            },
            {
              type: "ul",
              items: [
                "Název firmy, případně jméno živnostníka",
                "Fakturační adresa včetně země",
                "Daňové identifikační číslo, resp. DIČ, pokud existuje",
                "Základní měna pro nové objekty",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Vytvoření vašeho prvního objektu",
          excerpt: "Jak krok za krokem vytvořit svůj první rezervovatelný objekt.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Objekt v myNextDays je vždy přesně jedna rezervovatelná jednotka: buď jeden pokoj v hotelu, nebo kompletní rekreační objekt. Provozujete-li hotel s více pokoji, vytvořte pro každý pokoj samostatný objekt.",
            },
            { type: "h2", text: "Vytvoření objektu" },
            {
              type: "steps",
              items: [
                "Otevřete v menu Objekty.",
                "Klikněte na Přidat objekt.",
                "Vyberte typ objektu: kategorii, typ nemovitosti a druh nabídky.",
                "Doplňte adresu, obsazenost a základní cenu ve vaší uložené měně.",
                "Uložte objekt jako koncept, abyste jej mohli později dokončit.",
              ],
            },
            { type: "h2", text: "Co ještě poté chybí" },
            {
              type: "p",
              text: "Nově vytvořený objekt je nejprve konceptem a není viditelný na žádném kanálu. Před zveřejněním doplňte vybavení, fotografie, popis a dostupnost v kalendáři — spolehlivě lze nabízet jen kompletní objekt.",
            },
            {
              type: "ul",
              items: [
                "Vybrat vlastnosti vybavení ze seznamu kategorie",
                "Uložit alespoň jednu titulní fotografii a popis",
                "Správně zadat obsazenost (dospělí, děti, lůžka)",
                "Zkontrolovat základní cenu a dostupnost v kalendáři",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Provozujete-li více typů pokojů, opakujte tento postup pro každý jednotlivý pokoj — neexistuje žádná nadřazená úroveň budovy s pokoji pod ní.",
            },
            {
              type: "p",
              text: "Jsou-li vyplněna všechna povinná pole, můžete objekt zveřejnit, viz [Zveřejnění objektu](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Zveřejnění objektu",
          excerpt: "Jedno kliknutí společně aktivuje tržiště platformy, portály a web.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Zveřejnění učiní objekt viditelným a rezervovatelným. Ve většině případů stačí jedno kliknutí k současné aktivaci všech tří distribučních kanálů — viditelnost pro každý kanál ale můžete kdykoli upravit samostatně.",
            },
            { type: "h2", text: "Jak zveřejnit objekt" },
            {
              type: "steps",
              items: [
                "Otevřete objekt v sekci Objekty.",
                "Zkontrolujte v záložce Přehled, zda jsou všechny povinné údaje označeny zeleně.",
                "Klikněte na Zveřejnit.",
                "Potvrďte dialog — aktivují se tržiště platformy, portály i web.",
              ],
            },
            { type: "h2", text: "Samostatné řízení kanálů" },
            {
              type: "p",
              text: "Po zveřejnění najdete v záložce Viditelnost tři oddělené přepínače: Web, Tržiště platformy a Portály. Chcete-li objekt nabízet například jen na vlastním webu, ale ne přes portály, jednoduše deaktivujte příslušný přepínač.",
            },
            {
              type: "ul",
              items: [
                "Web: viditelnost na vašem vlastním webu myNextDays",
                "Tržiště platformy: viditelnost na globálním tržišti myNextDays",
                "Portály: viditelnost na Booking, Airbnb a dalších",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Tyto tři přepínače jsou nezávislé na stavu objektu (aktivní/neaktivní). Aktivní objekt může být přesto na jednotlivých kanálech neviditelný.",
            },
            { type: "h2", text: "Dočasné zablokování objektu" },
            {
              type: "p",
              text: "Chcete-li zablokovat jen jeden den místo celého objektu, použijte v kalendáři funkci Stop-sell — ta zablokuje daný den na všech kanálech současně, nezávisle na přepínačích viditelnosti.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Pochopení tří distribučních kanálů",
          excerpt: "Přehled portálů, tržiště platformy a aplikace.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "myNextDays prodává každý objekt současně přes několik rovnocenných cest. Pochopení jejich vzájemné souhry vám pomůže cíleně řídit viditelnost i ceny.",
            },
            { type: "h2", text: "Portály" },
            {
              type: "p",
              text: "Prostřednictvím kanálového manažeru propojíte svůj objekt s velkými rezervačními portály jako Booking, Airbnb a dalšími. Dostupnost i ceny se automaticky synchronizují, takže nemusíte ručně spravovat více kalendářů portálů.",
            },
            { type: "h2", text: "Tržiště platformy" },
            {
              type: "p",
              text: "Tržiště myNextDays je vlastní, globální rezervační kanál — srovnatelný s Booking nebo Airbnb, avšak součást téže platformy. Není náhradou za „přímou rezervaci“, ale rovnocenným kanálem s vlastní osou viditelnosti.",
            },
            { type: "h2", text: "Aplikace" },
            {
              type: "p",
              text: "Mobilní aplikace nabízí hostům, vlastníkům i zaměstnancům přístup ke stejným datům jako web — například k detailům rezervací, zprávám nebo úkolům, v závislosti na jejich roli.",
            },
            { type: "h2", text: "Tři oddělené osy viditelnosti" },
            {
              type: "ul",
              items: [
                "Web — váš vlastní web myNextDays",
                "Tržiště platformy — globální tržiště myNextDays",
                "Portály — Booking, Airbnb a další prostřednictvím kanálového manažeru",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Všechny tři osy lze zapínat nezávisle na sobě. Naproti tomu Stop-sell a stav objektu působí napříč kanály na všechny tři současně.",
            },
          ],
        },
      ],
    },
  ],
};
