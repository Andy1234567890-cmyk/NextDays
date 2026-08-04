import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Ceny a sazby",
  description: "Cenové plány, sezónní ceny a dynamické ceny.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Tvorba cen",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Základní cena a měna",
          excerpt: "Jak nastavit základní cenu a přiřadit svému objektu správnou měnu.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Každý objekt v myNextDays je přesně jedna rezervovatelná jednotka — jeden pokoj nebo rekreační objekt. Pro tuto jednotku uložíte základní cenu a centrální měnu, která platí pro celý objekt.",
            },
            { type: "h2", text: "Centrální nastavení měny" },
            {
              type: "p",
              text: "Měna objektu se nastavuje jednou pro daný objekt a automaticky platí pro všechny cenové plány, které pro tento objekt vytvoříte. Neexistuje žádná náhradní výchozí měna — chybí-li měna, nelze ceny uložit.",
            },
            {
              type: "steps",
              items: [
                "Otevřete svůj objekt v sekci „Objekty“.",
                "Přepněte se do záložky „Ceny“.",
                "V položce „Měna objektu“ vyberte příslušnou měnu.",
                "Zadejte základní cenu pro standardní obsazenost.",
                "Uložte změny.",
              ],
            },
            { type: "h2", text: "Co se stane při změně měny" },
            {
              type: "p",
              text: "Změníte-li měnu objektu dodatečně, projeví se to na všech existujících cenových plánech tohoto objektu, protože jsou vždy vedeny v měně objektu. Poté zkontrolujte své ceny, než je znovu přenesete na portály.",
            },
            {
              type: "ul",
              items: [
                "Objekt má přesně jednu měnu — ne více podle cenového plánu.",
                "Základní cena je výchozí hodnota pro odvozené sazby.",
                "Částky se vždy zobrazují v uložené měně objektu.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez uložené měny nelze uložit žádnou cenu ani přenést žádnou sazbu na portály. Zkontrolujte to jako první, pokud se změna ceny nezdaří.",
            },
            {
              type: "note",
              variant: "info",
              text: "Více o odvozených cenách najdete v článku [Odvozené sazby](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Vytvoření cenových plánů",
          excerpt: "Cenové plány sdružují cenu, storno podmínky a stravování pro objekt.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Cenový plán definuje, za jakých podmínek lze objekt rezervovat: cenu, storno pravidla, stravování a minimální délku pobytu. Objekt může nabízet více cenových plánů současně, například flexibilní a nevratný plán.",
            },
            { type: "h2", text: "Vytvoření nového cenového plánu" },
            {
              type: "steps",
              items: [
                "Otevřete objekt a přepněte se do záložky „Ceny“.",
                "Klikněte na „Vytvořit nový cenový plán“.",
                "Zadejte výstižný název, např. „Flexibilní“ nebo „Nevratné“.",
                "Určete, zda je plán základní sazbou, nebo odvozenou sazbou.",
                "Uložte storno podmínky a stravování.",
                "Uložte a aktivujte cenový plán.",
              ],
            },
            { type: "h2", text: "Základní sazba vs. další cenové plány" },
            {
              type: "p",
              text: "Nejprve vytvořte svou základní sazbu (často označovanou jako „BAR“, Best Available Rate). Všechny další cenové plány lze buď spravovat samostatně, nebo odvodit od této základní sazby.",
            },
            {
              type: "ul",
              items: [
                "Základní sazba: ručně spravovaná základní cena za noc.",
                "Další cenové plány: samostatné, nebo jako přirážka/sleva k základní sazbě.",
                "Každý cenový plán lze samostatně přenášet na portály.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Udržujte počet cenových plánů na objekt přehledný — příliš mnoho variant hostům ztěžuje porovnávání a zvyšuje náročnost správy.",
            },
            {
              type: "note",
              variant: "info",
              text: "Podrobnosti o přirážkách a slevách najdete v článku [Odvozené sazby](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Odvozené sazby",
          excerpt: "Odvozené cenové plány se počítají automaticky ze základní sazby.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Odvozená sazba je cenový plán, jehož cena se nespravuje ručně, ale počítá se automaticky ze základní sazby — jako pevná přirážka, sleva nebo procento. To šetří čas při správě, protože změna ceny u základní sazby automaticky aktualizuje všechny odvozené plány.",
            },
            { type: "h2", text: "Typický příklad" },
            {
              type: "p",
              text: "Častým vzorem je plán se snídaní, odvozený od základní sazby bez stravování: cena snídaně je definována jako přirážka za noc a osobu k základní sazbě. Změníte-li základní sazbu, cena snídaně se automaticky přizpůsobí.",
            },
            { type: "h2", text: "Nastavení odvozené sazby" },
            {
              type: "steps",
              items: [
                "Otevřete požadovaný cenový plán v záložce „Ceny“.",
                "Jako zdroj ceny vyberte „Odvozeno od …“ a příslušnou základní sazbu.",
                "Určete, zda rozdíl platí jako pevná částka, nebo jako procento.",
                "Určete, zda se jedná o přirážku, nebo slevu.",
                "Uložte přiřazení.",
              ],
            },
            {
              type: "ul",
              items: [
                "Přirážka: např. stravování, pozdější storno lhůta.",
                "Sleva: např. nevratný plán s cenovou výhodou.",
                "Základní sazba zůstává jediným ručně spravovaným zdrojem.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Odvozenou sazbu nelze současně ručně přepsat. Chcete-li nastavit odchylnou jednotlivou cenu, nejprve zrušte odvození.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Sezónní a víkendové ceny",
          excerpt: "Cíleně upravte ceny pro sezónní období a víkendy.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Poptávka kolísá v průběhu roku i v rámci týdne. Pomocí sezónních a víkendových cen upravíte základní cenu pro určitá období nebo dny v týdnu, aniž byste museli procházet kalendář den po dni.",
            },
            { type: "h2", text: "Vytvoření sezónního období" },
            {
              type: "steps",
              items: [
                "Otevřete v objektu záložku „Ceny“ a sekci „Sezónní ceny“.",
                "Vytvořte nové období s datem začátku a konce.",
                "Uložte cenu nebo procentní odchylku od základní ceny pro toto období.",
                "Uložte sezónní období.",
              ],
            },
            { type: "h2", text: "Víkendové ceny" },
            {
              type: "p",
              text: "Navíc můžete jednotlivé dny v týdnu, například pátek a sobotu, opatřit vlastní přirážkou. Tato přirážka platí navíc k aktuálně platné sezónní nebo základní ceně.",
            },
            {
              type: "ul",
              items: [
                "Sezónní ceny platí pro souvislá období.",
                "Víkendové ceny platí podle dne v týdnu, nezávisle na sezóně.",
                "Obě pravidla lze kombinovat.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Pokud se překrývá více sezónních období, platí naposledy vytvořené, respektive nejspecifičtější pravidlo. Po uložení zkontrolujte kalendář.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Pro automatické úpravy podle poptávky se navíc hodí [Dynamické ceny](/hilfe/preise-raten/dynamische-preise).",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Dynamické ceny",
          excerpt: "Automatické přizpůsobení cen podle poptávky, předstihu a obsazenosti.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "note",
              variant: "info",
              text: "Dynamické ceny jsou zpoplatněný doplňkový modul. Objednáte si jej v části „Rozšíření“, kde je uvedena i cena. Bez zakoupeného modulu automatika nepočítá.",
            },
            {
              type: "p",
              text: "Dynamické ceny automaticky upravují základní cenu podle faktorů, jako je předstih rezervace, aktuální obsazenost a poptávka — podobně jako to velké portály dělají u svých vlastních cenových doporučení. Reagujete tak na změny na trhu, aniž byste museli každý den ručně dolaďovat ceny.",
            },
            { type: "h2", text: "Aktivace dynamických cen" },
            {
              type: "steps",
              items: [
                "Otevřete v objektu záložku „Ceny“ a sekci „Dynamické ceny“.",
                "Aktivujte funkci pro základní sazbu objektu.",
                "Nastavte dolní a horní cenovou hranici.",
                "Určete, jak silně smí obsazenost ovlivňovat cenu.",
                "Uložte nastavení.",
              ],
            },
            { type: "h2", text: "Hranice a bezpečnost" },
            {
              type: "p",
              text: "Dolní a horní cenová hranice brání tomu, aby automatický algoritmus nastavil ceny, které jsou pro váš provoz neúnosné. Odvozené cenové plány automaticky sledují dynamicky vypočtenou základní sazbu.",
            },
            {
              type: "ul",
              items: [
                "Dolní cenová hranice chrání před příliš nízkými cenami při slabé poptávce.",
                "Horní cenová hranice chrání před přemrštěnými cenami při vysoké poptávce.",
                "Odvozené sazby automaticky přebírají novou základní sazbu.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dynamické ceny působí pouze na základní sazbu. Ručně pevně nastavené cenové plány bez odvození se automaticky nemění.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Slevy za délku pobytu",
          excerpt: "Nastavte slevy za delší pobyty a včasné rezervace.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Slevy za délku pobytu odměňují hosty za delší rezervace nebo včasné rezervování. Aplikují se jako procento z celkové ceny pobytu a lze je nastavit nezávisle pro každý objekt.",
            },
            { type: "h2", text: "Typy slev" },
            {
              type: "ul",
              items: [
                "Sleva za dlouhodobý pobyt: od určitého počtu nocí, např. od 7 nebo 28 nocí.",
                "Sleva za včasnou rezervaci: při rezervaci dostatečně dopředu.",
                "Poslední chvíle: při rezervaci na poslední chvíli, blízko datu příjezdu.",
              ],
            },
            { type: "h2", text: "Nastavení slevy" },
            {
              type: "steps",
              items: [
                "Otevřete v objektu záložku „Ceny“ a sekci „Slevy“.",
                "Vyberte požadovaný typ slevy.",
                "Nastavte prahovou hodnotu, např. minimální počet nocí nebo předstih.",
                "Zadejte slevu v procentech.",
                "Uložte pravidlo.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Slevy se aplikují na celkovou cenu příslušného cenového plánu a hostovi se zobrazují už v přehledu cen.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombinujte slevy za dlouhodobý pobyt s [Minimální a maximální délkou pobytu](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt), abyste cíleně podpořili delší rezervace.",
            },
          ],
        },
      ],
    },
  ],
};
