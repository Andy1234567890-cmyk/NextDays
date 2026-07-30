import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Objekty a vybavení",
  description: "Vytvářejte a spravujte pokoje a rekreační objekty.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Správa objektů",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Objekt = jedna rezervovatelná jednotka",
          excerpt: "Proč je každý objekt v myNextDays přesně jednou rezervovatelnou jednotkou.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "V myNextDays je objekt vždy přesně jedna rezervovatelná jednotka — jeden pokoj v hotelu nebo kompletní rekreační objekt. Tento princip platí bez ohledu na to, zda provozujete rekreační dům, apartmán nebo hotel, a je základem pro dostupnost, ceny a rezervace.",
            },
            { type: "h2", text: "Žádná budova s pokoji uvnitř" },
            {
              type: "p",
              text: "Častým nedorozuměním je zobrazovat hotelovou budovu jako jeden objekt s několika pokoji pod ním. To v myNextDays není podporováno. Provozujete-li například hotel s osmi dvoulůžkovými pokoji a čtyřmi jednolůžkovými pokoji, vytvoříte dvanáct samostatných objektů — ne jeden objekt s počtem pokojů.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Pole jako „počet pokojů“ na úrovni objektu záměrně neexistuje. Každý pokoj potřebuje vlastní objekt s vlastním kalendářem a vlastními cenami.",
            },
            { type: "h2", text: "Rekreační objekty" },
            {
              type: "p",
              text: "U rekreačního domu nebo apartmánu odpovídá rezervovatelné jednotce celý objekt. Zde neexistuje žádné další dělení — rekreační objekt je vždy samostatným objektem s vlastním kalendářem.",
            },
            { type: "h2", text: "Proč je to důležité" },
            {
              type: "ul",
              items: [
                "Každý objekt má vlastní kalendář dostupnosti — dvojité rezervace jsou vyloučeny přesně na úrovni objektu.",
                "Ceny, vybavení a fotografie platí pro jednotlivý objekt, ne pro budovu.",
                "Objekt vždy patří přesně jednomu vlastníkovi — žádné vícenásobné přiřazení.",
                "Viditelnost na kanálech (web, tržiště platformy, portály) se řídí podle jednotlivého objektu.",
              ],
            },
            {
              type: "p",
              text: "Jak zvolit správný typ objektu pro váš pokoj nebo rekreační objekt, se dočtete v článku [Nastavení typu objektu](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Nastavení typu objektu",
          excerpt: "Správně přiřaďte kategorii, typ nemovitosti a druh nabídky.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Typ objektu určuje, jak je váš objekt zařazen a filtrován na portálech a tržišti platformy. Skládá se ze tří na sebe navazujících výběrových polí, kterými projdete při vytváření nebo úpravě objektu.",
            },
            { type: "h2", text: "Tři výběrové úrovně" },
            {
              type: "steps",
              items: [
                "Nejprve vyberte kategorii — například rekreační ubytování nebo hotel.",
                "Na základě toho vyberte typ nemovitosti — například apartmán, rekreační dům, dvoulůžkový pokoj nebo jednolůžkový pokoj.",
                "Vyberte druh nabídky — například celý objekt nebo soukromý pokoj.",
                "Doplňte podle výběru zobrazená dodatečná pole, například typ postele nebo patro.",
              ],
            },
            { type: "h2", text: "Proč je pořadí důležité" },
            {
              type: "p",
              text: "Tyto tři rozbalovací nabídky jsou na sobě závislé: výběr kategorie omezuje dostupné typy nemovitostí a výběr typu nemovitosti dále omezuje druhy nabídky. Vznikají tak jen smysluplné kombinace, jaké se používají i na velkých portálech.",
            },
            {
              type: "note",
              variant: "info",
              text: "Změníte-li kategorii dodatečně, myNextDays zkontroluje, zda k ní stále pasuje typ nemovitosti a druh nabídky, a v případě potřeby vás vyzve k novému výběru.",
            },
            { type: "h2", text: "Úprava typu objektu" },
            {
              type: "p",
              text: "Otevřete v menu Objekty požadovaný objekt a přepněte se do záložky Základní údaje. Tam najdete tři rozbalovací nabídky pod položkou Typ objektu. Uložíte-li změnu, nové zařazení se předá na všechny aktivní kanály.",
            },
            {
              type: "ul",
              items: [
                "Kategorie: nadřazené zařazení (např. rekreační ubytování, hotel)",
                "Typ nemovitosti: konkrétní typ objektu (např. apartmán, dvoulůžkový pokoj)",
                "Druh nabídky: co přesně se rezervuje (např. celý objekt, soukromý pokoj)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Správa vybavení",
          excerpt: "Vyberte vlastnosti vybavení a udržujte je aktuální.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Vybavení objektu zásadně ovlivňuje, jak dobře je nalezen a filtrován na portálech. Hosté cíleně filtrují podle vlastností jako Wi-Fi, kuchyně nebo parkoviště — chybějící údaje mohou objekt vyloučit z výsledků vyhledávání.",
            },
            { type: "h2", text: "Výběr vybavení" },
            {
              type: "steps",
              items: [
                "Otevřete objekt a přepněte se do záložky Vybavení.",
                "Vyberte všechny odpovídající vlastnosti z předdefinovaného seznamu.",
                "V případě potřeby doplňte podrobnosti, jako je počet parkovacích míst nebo typ kuchyně.",
                "Uložte změny — automaticky se přenesou na všechny aktivní portály.",
              ],
            },
            { type: "h2", text: "Odkud vlastnosti pocházejí" },
            {
              type: "p",
              text: "Seznam vybavení odpovídá katalogu vlastností velkých portálů, aby tam byly vaše údaje správně zařazeny. Vlastní, volně vymyšlené vlastnosti nejsou podporovány, protože by se nedaly čistě přenést na portály.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Zkontrolujte vybavení po každé stavební změně — například nové klimatizaci nebo dodatečné koupelně — aby údaje zůstaly aktuální na všech kanálech.",
            },
            { type: "h2", text: "Časté skupiny vlastností" },
            {
              type: "ul",
              items: [
                "Základní vybavení: Wi-Fi, topení, klimatizace",
                "Kuchyně a stravování: plně vybavená kuchyně, myčka, kávovar",
                "Koupelna a prádlo: vlastní koupelna, pračka, ručníky",
                "Venkovní prostory: balkon, terasa, zahrada, parkoviště",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Fotografie a popis",
          excerpt: "Výstižné obrázky a texty pro více rezervací.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Fotografie a popis jsou pro hosty nejdůležitějším podkladem pro rozhodnutí. Objekt lze zveřejnit teprve poté, co je uložena alespoň jedna titulní fotografie a popis.",
            },
            { type: "h2", text: "Nahrání fotografií" },
            {
              type: "steps",
              items: [
                "Otevřete objekt a přepněte se do záložky Fotografie.",
                "Přetáhněte soubory s obrázky do oblasti pro nahrávání nebo je vyberte pomocí dialogu pro výběr souborů.",
                "Nastavte titulní fotografii — zobrazuje se ve výsledcích vyhledávání a na dlaždicích.",
                "Uspořádejte ostatní fotografie přetažením do smysluplného pořadí.",
              ],
            },
            { type: "h2", text: "Sepsání popisu" },
            {
              type: "p",
              text: "Přepněte se do záložky Popis a zadejte název i souvislý text. Popište konkrétně polohu, zvláštnosti a cílovou skupinu objektu — obecné fráze působí na portálech méně přesvědčivě než hmatatelné detaily.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Fotografie jiných objektů nebo z internetu se nesmí používat — portály to kontrolují a při porušení mohou objekty zablokovat.",
            },
            { type: "h2", text: "Doporučení pro kvalitní fotografie" },
            {
              type: "ul",
              items: [
                "Alespoň pět fotografií, ideálně jedna pro každou místnost",
                "Vodorovný formát, dobré osvětlení, žádné vodoznaky",
                "Titulní fotografie ukazuje objekt co nejlákavěji a jednoznačně",
                "Pravidelně aktualizovat, zejména po rekonstrukcích",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Obsazenost a kapacita",
          excerpt: "Správně uložte maximální počet hostů a rozložení lůžek.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Obsazenost určuje, kolik hostů může objekt pojmout, a kontroluje se při každém vyhledávání i rezervaci. Nesprávné údaje vedou buď k odmítnutým poptávkám, nebo k přeobsazení — obojímu byste se měli vyhnout.",
            },
            { type: "h2", text: "Zadání obsazenosti" },
            {
              type: "steps",
              items: [
                "Otevřete objekt a přepněte se do záložky Obsazenost.",
                "Zadejte maximální počet dospělých.",
                "Zadejte maximální počet dětí, pokud jsou povoleny.",
                "Uložte rozložení lůžek podle místnosti, například jedna manželská postel a dvě jednolůžkové postele.",
              ],
            },
            { type: "h2", text: "Limity obsazenosti" },
            {
              type: "p",
              text: "Při poptávce na rezervaci myNextDays automaticky zkontroluje, zda požadovaný počet hostů odpovídá uložené obsazenosti. Poptávky, které překračují maximální kapacitu, jsou odmítnuty, respektive vůbec se nezobrazí jako rezervovatelné.",
            },
            {
              type: "note",
              variant: "info",
              text: "Přistýlka nebo dětská postýlka zvyšují reálnou kapacitu jen tehdy, pokud je explicitně zaznamenáte v rozložení lůžek — jinak zůstává maximální počet hostů beze změny.",
            },
            { type: "h2", text: "Typické zdroje chyb" },
            {
              type: "ul",
              items: [
                "Maximální počet hostů nastaven příliš vysoko, ačkoli je k dispozici jen málo lůžek",
                "Zapomenutý počet dětí, ačkoli se objekt zaměřuje na rodiny",
                "Rozložení lůžek neaktualizované po rekonstrukci",
              ],
            },
            {
              type: "p",
              text: "Pokud si obsazenost a vybavení neodpovídají, zkontrolujte navíc záložku [Vybavení](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Stav objektu a viditelnost",
          excerpt: "Rozdíl mezi aktivní/neaktivní a třemi osami kanálů.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "myNextDays rozlišuje dvě různé věci, které se často zaměňují: stav objektu (aktivní nebo neaktivní) a viditelnost na jednotlivých distribučních kanálech. Obě řídíte odděleně.",
            },
            { type: "h2", text: "Stav objektu" },
            {
              type: "p",
              text: "Stav active znamená, že objekt je v zásadě prodejný. Stav inactive objekt zcela vyřadí z provozu — například při dlouhodobé rekonstrukci. Neaktivní objekt nelze rezervovat na žádném kanálu, bez ohledu na přepínače kanálů.",
            },
            { type: "h2", text: "Tři osy kanálů" },
            {
              type: "p",
              text: "Je-li objekt aktivní, o tom, kde přesně je viditelný, rozhodují tři nezávislé přepínače:",
            },
            {
              type: "ul",
              items: [
                "Web — viditelnost na vašem vlastním webu myNextDays",
                "Tržiště platformy — viditelnost na globálním tržišti myNextDays",
                "Portály — viditelnost na Booking, Airbnb a dalších",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Tyto tři osy jsou zcela nezávislé na stavu objektu i navzájem. Aktivní objekt může být např. viditelný jen na webu, ale ne na portálech.",
            },
            { type: "h2", text: "Změna stavu" },
            {
              type: "steps",
              items: [
                "Otevřete objekt a přepněte se do záložky Přehled.",
                "Nastavte stav na aktivní nebo neaktivní.",
                "V případě potřeby dodatečně upravte tři přepínače kanálů v záložce Viditelnost.",
                "Uložte změnu — projeví se okamžitě na všech dotčených kanálech.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Pro krátkodobé zablokování jednotlivých dnů použijte místo toho v kalendáři funkci Stop-sell — ta cíleně zablokuje dny na všech kanálech, aniž by deaktivovala celý objekt.",
            },
          ],
        },
      ],
    },
  ],
};
