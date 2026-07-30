import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Objekty a vybavenie",
  description: "Vytváranie a správa izieb a rekreačných objektov.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Správa objektov",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Objekt = jedna rezervovateľná jednotka",
          excerpt: "Prečo je každý objekt v myNextDays presne jedna rezervovateľná jednotka.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "V myNextDays je objekt vždy presne jedna rezervovateľná jednotka — jednotlivá izba v hoteli alebo kompletný rekreačný objekt. Táto zásada platí bez ohľadu na to, či prevádzkujete rekreačný dom, apartmán alebo hotel, a je základom pre dostupnosť, ceny a rezervácie.",
            },
            { type: "h2", text: "Žiadna budova s izbami pod ňou" },
            {
              type: "p",
              text: "Časté nedorozumenie je predstava, že hotelovú budovu zobrazíte ako jeden objekt s viacerými izbami pod ním. V myNextDays to nie je zámerom. Ak prevádzkujete napríklad hotel s ôsmimi dvojlôžkovými a štyrmi jednolôžkovými izbami, vytvorte dvanásť samostatných objektov — nie jeden objekt s počtom izieb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Pole ako „počet izieb“ na úrovni objektu zámerne neexistuje. Každá izba potrebuje vlastný objekt s vlastným kalendárom a vlastnými cenami.",
            },
            { type: "h2", text: "Rekreačné objekty" },
            {
              type: "p",
              text: "Pri rekreačnom dome alebo apartmáne zodpovedá celý objekt rezervovateľnej jednotke. Tu neexistuje ďalšie delenie — rekreačný objekt je vždy samostatný objekt s vlastným kalendárom.",
            },
            { type: "h2", text: "Prečo je to dôležité" },
            {
              type: "ul",
              items: [
                "Každý objekt má vlastný kalendár dostupnosti — dvojité rezervácie sa zabraňujú presne na úrovni objektu.",
                "Ceny, vybavenie a fotografie platia pre jednotlivý objekt, nie pre budovu.",
                "Objekt vždy patrí presne jednému vlastníkovi — žiadne viacnásobné priradenie.",
                "Viditeľnosť na kanáloch (webová stránka, trhovisko platformy, portály) sa riadi pre jednotlivý objekt.",
              ],
            },
            {
              type: "p",
              text: "Ako vybrať vhodný typ objektu pre vašu izbu alebo rekreačný objekt, sa dozviete v [Nastavenie typu objektu](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Nastavenie typu objektu",
          excerpt: "Správne priradenie kategórie, typu nehnuteľnosti a spôsobu ponuky.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Typ objektu určuje, ako je váš objekt zaradený a filtrovaný na portáloch a trhovisku platformy. Skladá sa z troch na seba nadväzujúcich výberových polí, ktoré prejdete pri vytváraní alebo úprave objektu.",
            },
            { type: "h2", text: "Tri úrovne výberu" },
            {
              type: "steps",
              items: [
                "Najprv vyberte kategóriu — napríklad rekreačné ubytovanie alebo hotel.",
                "Na jej základe vyberte typ nehnuteľnosti — napríklad apartmán, rekreačný dom, dvojlôžková alebo jednolôžková izba.",
                "Vyberte spôsob ponuky — napríklad celý objekt alebo súkromná izba.",
                "Doplňte zobrazené doplňujúce polia podľa výberu, napríklad typ postele alebo poschodie.",
              ],
            },
            { type: "h2", text: "Prečo je poradie dôležité" },
            {
              type: "p",
              text: "Tieto tri rozbaľovacie ponuky sú navzájom závislé: výber kategórie obmedzuje dostupné typy nehnuteľností, výber typu nehnuteľnosti následne spôsoby ponuky. Tak vzniknú len zmysluplné kombinácie, aké sa používajú aj na veľkých portáloch.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ak dodatočne zmeníte kategóriu, myNextDays skontroluje, či k nej ešte pasuje typ nehnuteľnosti a spôsob ponuky, a v prípade potreby vás vyzve na nový výber.",
            },
            { type: "h2", text: "Úprava typu objektu" },
            {
              type: "p",
              text: "V menu Objekty otvorte požadovaný objekt a prepnite na záložku Základné údaje. Tam nájdete tri rozbaľovacie ponuky pod položkou Typ objektu. Po uložení zmeny sa nové zaradenie odošle na všetky aktívne kanály.",
            },
            {
              type: "ul",
              items: [
                "Kategória: nadradené zaradenie (napr. rekreačné ubytovanie, hotel)",
                "Typ nehnuteľnosti: konkrétny typ objektu (napr. apartmán, dvojlôžková izba)",
                "Spôsob ponuky: čo sa presne rezervuje (napr. celý objekt, súkromná izba)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Správa vybavenia",
          excerpt: "Výber a udržiavanie aktuálnosti vlastností vybavenia.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Vybavenie objektu výrazne ovplyvňuje, ako dobre sa dá nájsť a filtrovať na portáloch. Hostia cielene filtrujú podľa vlastností ako WiFi, kuchyňa alebo parkovanie — chýbajúce údaje môžu objekt vylúčiť z výsledkov vyhľadávania.",
            },
            { type: "h2", text: "Výber vybavenia" },
            {
              type: "steps",
              items: [
                "Otvorte objekt a prepnite na záložku Vybavenie.",
                "Vyberte všetky príslušné vlastnosti zo zadaného zoznamu.",
                "V prípade potreby doplňte podrobnosti, napríklad počet parkovacích miest alebo typ kuchyne.",
                "Uložte zmeny — automaticky sa prenesú na všetky aktívne portály.",
              ],
            },
            { type: "h2", text: "Odkiaľ vlastnosti pochádzajú" },
            {
              type: "p",
              text: "Zoznam vybavenia nasleduje katalóg vlastností veľkých portálov, aby sa vaše údaje tam mohli správne priradiť. Vlastné, voľne vymyslené vlastnosti nie sú predpokladané, pretože by sa nedali čisto preniesť na portály.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Skontrolujte vybavenie po každej stavebnej zmene — napríklad novej klimatizácii alebo dodatočnej kúpeľni — aby boli údaje aktuálne na všetkých kanáloch.",
            },
            { type: "h2", text: "Časté skupiny vlastností" },
            {
              type: "ul",
              items: [
                "Základné vybavenie: WiFi, kúrenie, klimatizácia",
                "Kuchyňa a stravovanie: plne vybavená kuchyňa, umývačka riadu, kávovar",
                "Kúpeľňa a bielizeň: vlastná kúpeľňa, práčka, uteráky",
                "Vonkajší priestor: balkón, terasa, záhrada, parkovanie",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Fotografie a popis",
          excerpt: "Presvedčivé obrázky a texty pre viac rezervácií.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Fotografie a popis sú pre hostí najdôležitejším podkladom pre rozhodnutie. Objekt sa dá zverejniť až vtedy, keď je uložená aspoň jedna titulná fotografia a popis.",
            },
            { type: "h2", text: "Nahrávanie fotografií" },
            {
              type: "steps",
              items: [
                "Otvorte objekt a prepnite na záložku Fotografie.",
                "Presuňte obrazové súbory do oblasti nahrávania alebo ich vyberte cez dialógové okno súborov.",
                "Nastavte titulnú fotografiu — objaví sa vo výsledkoch vyhľadávania a na dlaždiciach.",
                "Ostatné fotografie usporiadajte ťahaním do zmysluplného poradia.",
              ],
            },
            { type: "h2", text: "Napísanie popisu" },
            {
              type: "p",
              text: "Prepnite na záložku Popis a zadajte nadpis a text. Konkrétne opíšte polohu, osobitosti a cieľovú skupinu objektu — všeobecné frázy pôsobia na portáloch menej presvedčivo než konkrétne detaily.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Fotografie iných objektov alebo z internetu sa nesmú používať — portály to kontrolujú a pri porušení môžu objekty zablokovať.",
            },
            { type: "h2", text: "Odporúčania pre kvalitné fotografie" },
            {
              type: "ul",
              items: [
                "Minimálne päť fotografií, ideálne jedna za každú miestnosť",
                "Orientácia na šírku, dobré osvetlenie, žiadne vodoznaky",
                "Titulná fotografia zobrazuje objekt čo najlákavejšie a najjednoznačnejšie",
                "Pravidelná aktualizácia, najmä po renováciách",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Obsadenosť a kapacita",
          excerpt: "Správne uloženie maximálneho počtu hostí a rozdelenia postelí.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Obsadenosť určuje, koľko hostí objekt pojme, a kontroluje sa pri každom vyhľadávaní a rezervácii. Nesprávne údaje vedú buď k zamietnutým žiadostiam, alebo k preplneniu — obom by ste sa mali vyhnúť.",
            },
            { type: "h2", text: "Zadanie obsadenosti" },
            {
              type: "steps",
              items: [
                "Otvorte objekt a prepnite na záložku Obsadenosť.",
                "Zadajte maximálny počet dospelých.",
                "Zadajte maximálny počet detí, ak sú povolené.",
                "Uložte rozdelenie postelí podľa miestnosti, napríklad jedna manželská posteľ a dve samostatné postele.",
              ],
            },
            { type: "h2", text: "Hranice obsadenosti" },
            {
              type: "p",
              text: "Pri žiadosti o rezerváciu myNextDays automaticky skontroluje, či požadovaný počet hostí je v rámci uloženej obsadenosti. Žiadosti, ktoré prekračujú maximálnu kapacitu, sa zamietnu, resp. sa vôbec nezobrazia ako rezervovateľné.",
            },
            {
              type: "note",
              variant: "info",
              text: "Prístelka alebo detská postieľka zvýši reálnu kapacitu len vtedy, ak ju výslovne zaznamenáte v rozdelení postelí — inak zostáva maximálny počet hostí nezmenený.",
            },
            { type: "h2", text: "Typické zdroje chýb" },
            {
              type: "ul",
              items: [
                "Maximálny počet hostí nastavený príliš vysoko, hoci je k dispozícii len málo postelí",
                "Zabudnutý počet detí, hoci sa objekt zameriava na rodiny",
                "Rozdelenie postelí neaktualizované po renovácii",
              ],
            },
            {
              type: "p",
              text: "Ak obsadenosť a vybavenie nesedia, skontrolujte aj záložku [Vybavenie](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Status objektu a viditeľnosť",
          excerpt: "Rozdiel medzi aktívny/neaktívny a tromi osami kanálov.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "myNextDays rozlišuje dve odlišné veci, ktoré sa často zamieňajú: status objektu (aktívny alebo neaktívny) a viditeľnosť na jednotlivých predajných kanáloch. Obe riadite navzájom oddelene.",
            },
            { type: "h2", text: "Status objektu" },
            {
              type: "p",
              text: "Status active znamená, že objekt je zásadne predajný. Status inactive úplne vyradí objekt z prevádzky — napríklad pri dlhodobej renovácii. Neaktívny objekt nie je rezervovateľný na žiadnom kanáli, bez ohľadu na prepínače kanálov.",
            },
            { type: "h2", text: "Tri osi kanálov" },
            {
              type: "p",
              text: "Ak je objekt aktívny, o tom, kde presne je viditeľný, rozhodujú tri nezávislé prepínače:",
            },
            {
              type: "ul",
              items: [
                "Webová stránka — viditeľnosť na vašej vlastnej webovej stránke myNextDays",
                "Trhovisko platformy — viditeľnosť na globálnom trhovisku myNextDays",
                "Portály — viditeľnosť na Booking, Airbnb a ďalších",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Tieto tri osi sú úplne nezávislé od statusu objektu a navzájom od seba. Aktívny objekt môže byť napr. viditeľný len na webovej stránke, ale nie na portáloch.",
            },
            { type: "h2", text: "Zmena statusu" },
            {
              type: "steps",
              items: [
                "Otvorte objekt a prepnite na záložku Prehľad.",
                "Nastavte status na aktívny alebo neaktívny.",
                "V prípade potreby dodatočne upravte tri prepínače kanálov v záložke Viditeľnosť.",
                "Uložte zmenu — okamžite sa prejaví na všetkých dotknutých kanáloch.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Pre krátkodobé zablokovanie jednotlivých dní použite namiesto toho Stop-Sell v kalendári — ten cielene zablokuje dni na všetkých kanáloch, bez deaktivácie celého objektu.",
            },
          ],
        },
      ],
    },
  ],
};
