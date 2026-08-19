import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Ceny a sadzby",
  description: "Cenové plány, sezónne ceny a dynamické ceny.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Tvorba cien",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Základná cena a mena",
          excerpt: "Ako určíte základnú cenu a priradíte objektu správnu menu.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Každý objekt v myNextDays je presne jedna rezervovateľná jednotka — jednotlivá izba alebo rekreačný objekt. Pre túto jednotku uložíte základnú cenu a centrálnu menu, ktorá platí pre celý objekt.",
            },
            { type: "h2", text: "Centrálne nastavenie meny" },
            {
              type: "p",
              text: "Mena objektu sa nastavuje jedenkrát pre objekt a automaticky platí pre všetky cenové plány, ktoré pre tento objekt vytvoríte. Neexistuje žiadna samostatná náhradná mena — ak mena chýba, ceny nemôžete uložiť.",
            },
            {
              type: "steps",
              items: [
                "Otvorte svoj objekt v sekcii „Objekty“.",
                "Prepnite na kartu „Ceny“.",
                "V položke „Mena objektu“ vyberte príslušnú menu.",
                "Zadajte základnú cenu pre štandardnú obsadenosť.",
                "Uložte zmeny.",
              ],
            },
            { type: "h2", text: "Čo sa stane pri zmene meny" },
            {
              type: "p",
              text: "Ak dodatočne zmeníte menu objektu, prejaví sa to na všetkých existujúcich cenových plánoch tohto objektu, keďže sa vždy vedú v mene objektu. Následne skontrolujte svoje ceny, kým ich znova neprenesiete na portály.",
            },
            {
              type: "ul",
              items: [
                "Objekt má presne jednu menu — nie viacero podľa cenového plánu.",
                "Základná cena je východisková hodnota pre odvodené sadzby.",
                "Sumy sa vždy zobrazujú v uloženej mene objektu.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez uloženej meny nemožno uložiť žiadnu cenu ani preniesť sadzbu na portály. Toto skontrolujte ako prvé, ak zmena ceny zlyhá.",
            },
            {
              type: "note",
              variant: "info",
              text: "Viac o odvodených cenách nájdete v [Odvodené sadzby](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Vytváranie cenových plánov",
          excerpt: "Cenové plány spájajú cenu, storno podmienky a stravovanie pre objekt.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Cenový plán definuje, za akých podmienok možno objekt rezervovať: cenu, storno pravidlá, stravovanie a minimálny pobyt. Objekt môže súčasne ponúkať viacero cenových plánov, napríklad flexibilný a nevratný plán.",
            },
            { type: "h2", text: "Vytvorenie nového cenového plánu" },
            {
              type: "steps",
              items: [
                "Otvorte objekt a prepnite na kartu „Ceny“.",
                "Kliknite na „Vytvoriť nový cenový plán“.",
                "Zadajte výstižný názov, napr. „Flexibilný“ alebo „Nevratný“.",
                "Určte, či je plán základnou sadzbou, alebo odvodenou sadzbou.",
                "Uložte storno podmienky a stravovanie.",
                "Uložte a aktivujte cenový plán.",
              ],
            },
            { type: "h2", text: "Základná sadzba vs. ďalšie cenové plány" },
            {
              type: "p",
              text: "Najprv vytvorte svoju základnú sadzbu (často označovanú ako „BAR“, Best Available Rate). Všetky ďalšie cenové plány môžu byť spravované buď samostatne, alebo odvodené z tejto základnej sadzby.",
            },
            {
              type: "ul",
              items: [
                "Základná sadzba: manuálne spravovaná základná cena za noc.",
                "Ďalšie cenové plány: samostatné alebo ako prirážka/zľava k základnej sadzbe.",
                "Každý cenový plán možno samostatne preniesť na portály.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Udržujte počet cenových plánov na objekt prehľadný — príliš veľa variantov sťažuje hosťom porovnávanie a zvyšuje náročnosť správy.",
            },
            {
              type: "note",
              variant: "info",
              text: "Podrobnosti o prirážkach a zľavách nájdete v [Odvodené sadzby](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Odvodené sadzby",
          excerpt: "Odvodené cenové plány sa počítajú automaticky zo základnej sadzby.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Odvodená sadzba je cenový plán, ktorého cena sa nespravuje manuálne, ale automaticky sa počíta zo základnej sadzby — ako pevná prirážka, zľava alebo percentuálny podiel. To šetrí náročnosť správy, pretože zmena ceny na základnej sadzbe automaticky aktualizuje všetky odvodené plány.",
            },
            { type: "h2", text: "Typický príklad" },
            {
              type: "p",
              text: "Bežným vzorom je plán s raňajkami, ktorý sa odvodzuje zo základnej sadzby bez stravovania: cena raňajok sa definuje ako prirážka za noc a osobu k základnej sadzbe. Ak zmeníte základnú sadzbu, cena raňajok sa automaticky upraví.",
            },
            { type: "h2", text: "Nastavenie odvodenej sadzby" },
            {
              type: "steps",
              items: [
                "Otvorte požadovaný cenový plán na karte „Ceny“.",
                "Ako zdroj ceny vyberte „Odvodené od …“ a príslušnú základnú sadzbu.",
                "Určte, či rozdiel platí ako pevná suma, alebo ako percentuálny podiel.",
                "Určte, či ide o prirážku, alebo o zľavu.",
                "Uložte priradenie.",
              ],
            },
            {
              type: "ul",
              items: [
                "Prirážka: napr. stravovanie, neskoršia možnosť storna.",
                "Zľava: napr. nevratný plán s cenovou výhodou.",
                "Základná sadzba zostáva jediným manuálne spravovaným zdrojom.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Odvodenú sadzbu nemožno súčasne manuálne prepísať. Ak chcete nastaviť odchylnú jednotlivú cenu, najprv zrušte odvodenie.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Sezónne a víkendové ceny",
          excerpt: "Cielené prispôsobenie cien pre sezónne obdobia a víkendy.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Dopyt sa mení v priebehu roka a v rámci týždňa. Pomocou sezónnych a víkendových cien prispôsobíte základnú cenu pre určité obdobia alebo dni v týždni, bez toho, aby ste museli pre každý deň zvlášť zasahovať do kalendára.",
            },
            { type: "h2", text: "Vytvorenie sezónneho obdobia" },
            {
              type: "steps",
              items: [
                "V objekte otvorte kartu „Ceny“ a oblasť „Sezónne ceny“.",
                "Vytvorte nové obdobie s dátumom začiatku a konca.",
                "Uložte cenu alebo percentuálnu odchýlku od základnej ceny pre toto obdobie.",
                "Uložte sezónne obdobie.",
              ],
            },
            { type: "h2", text: "Víkendové ceny" },
            {
              type: "p",
              text: "Okrem toho môžete jednotlivé dni v týždni, napríklad piatok a sobotu, opatriť vlastnou prirážkou. Táto prirážka pôsobí navyše k práve platnej sezónnej alebo základnej cene.",
            },
            {
              type: "ul",
              items: [
                "Sezónne ceny pôsobia pre súvislé obdobia.",
                "Víkendové ceny pôsobia podľa dňa v týždni, nezávisle od sezóny.",
                "Obe pravidlá možno kombinovať.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ak sa viaceré sezónne obdobia prekrývajú, platí naposledy vytvorené, resp. najšpecifickejšie pravidlo. Po uložení skontrolujte kalendár.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Pre automatické úpravy podľa dopytu je vhodné aj [Dynamické ceny](/hilfe/preise-raten/dynamische-preise).",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Dynamické ceny",
          excerpt: "Automatické prispôsobenie cien podľa dopytu, predstihu a obsadenosti.",
          updated: "Aktualizované: august 2026",
          body: [
            {
              type: "note",
              variant: "info",
              text: "Dynamické ceny sú platený doplnkový modul. Objednáte si ho v časti „Rozšírenia“, kde je uvedená aj cena. Bez modulu automatika nepočíta.",
            },
            {
              type: "p",
              text: "Dynamické ceny automaticky prispôsobujú základnú cenu na základe faktorov ako predstih rezervácie, aktuálna obsadenosť a dopyt — podobne, ako to robia veľké portály so svojimi vlastnými cenovými odporúčaniami. Tak reagujete na zmeny trhu bez toho, aby ste museli každý deň manuálne dolaďovať.",
            },
            { type: "h2", text: "Aktivácia dynamických cien" },
            {
              type: "steps",
              items: [
                "Objednajte modul v „Nástroje → Rozšírenia“ — bez modulu automatika nepočíta.",
                "V hlavnej ponuke otvorte „Distribúcia → Dynamické ceny“.",
                "V tabuľke objektov kliknite pri požadovanom objekte na ikonu ceruzky („Nastaviť základnú cenu“).",
                "Vyberte stratégiu základnej ceny: na základe dát, alebo pevnú základnú cenu.",
                "Nastavte minimálnu a maximálnu cenu a v poli „Citlivosť na obsadenosť (%)“ určte, ako silno obsadenosť pôsobí.",
                "Zapnite „Dynamické ceny aktívne“ a uložte.",
              ],
            },
            { type: "h2", text: "Hranice a bezpečnosť" },
            {
              type: "p",
              text: "Spodná a horná cenová hranica zabraňujú tomu, aby automatický algoritmus nastavil ceny, ktoré by boli pre vašu prevádzku neúnosné. Odvodené cenové plány automaticky nasledujú dynamicky vypočítanú základnú sadzbu.",
            },
            {
              type: "ul",
              items: [
                "Spodná cenová hranica chráni pred príliš nízkymi cenami pri slabom dopyte.",
                "Horná cenová hranica chráni pred prehnanými cenami pri vysokom dopyte.",
                "Odvodené sadzby automaticky preberajú novú základnú sadzbu.",
                "Denná cena zadaná ručne v kalendári má vždy prednosť pred automatikou.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dynamické ceny pôsobia len na základnú sadzbu. Manuálne pevne nastavené cenové plány bez odvodenia sa automaticky nemenia.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Zľavy za dĺžku pobytu",
          excerpt: "Nastavenie zliav za dlhšie pobyty a včasné rezervácie.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Zľavy za dĺžku pobytu odmeňujú hostí za dlhšie rezervácie alebo včasné rezervovanie. Uplatňujú sa ako percentuálny podiel z celkovej ceny pobytu a možno ich nastaviť nezávisle pre jednotlivý objekt.",
            },
            { type: "h2", text: "Typy zliav" },
            {
              type: "ul",
              items: [
                "Zľava za dlhodobý pobyt: od určitého počtu nocí, napr. od 7 alebo 28 nocí.",
                "Zľava za včasnú rezerváciu: pri rezervácii dostatočne dopredu.",
                "Zľava last-minute: pri krátkodobej rezervácii blízko dátumu príchodu.",
              ],
            },
            { type: "h2", text: "Nastavenie zľavy" },
            {
              type: "steps",
              items: [
                "V objekte otvorte kartu „Ceny“ a oblasť „Zľavy“.",
                "Vyberte požadovaný typ zľavy.",
                "Určte prah, napr. minimálny počet nocí alebo predstih.",
                "Zadajte zľavu v percentách.",
                "Uložte pravidlo.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Zľavy pôsobia na celkovú cenu príslušného cenového plánu a hosťovi sa zobrazujú už v prehľade cien.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombinujte zľavy za dlhodobý pobyt s [Minimálny a maximálny pobyt](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt), aby ste cielene podporili dlhšie rezervácie.",
            },
          ],
        },
      ],
    },
  ],
};
