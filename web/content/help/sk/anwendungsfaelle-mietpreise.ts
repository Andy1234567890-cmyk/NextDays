import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Ceny nájmu",
  description: "Optimálne nastavenie cien nájmu.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Ceny nájmu",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Optimalizácia cien pre hlavnú sezónu",
          excerpt: "Ako cielene zvýšite svoje ceny pre obdobia s vysokým dopytom.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia",
            },
            {
              type: "p",
              text: "V hlavnej sezóne výrazne stúpa dopyt, zatiaľ čo vaša základná cena zostáva rovnaká ako počas zvyšku roka. Bez sezónnej úpravy prichádzate v najsilnejšom období roka o tržby — úprava sa vykonáva cez cenový plán vášho objektu, nie manuálnym prepisovaním jednotlivých dní.",
            },
            {
              type: "steps",
              items: [
                "Otvorte cenový plán dotknutého objektu a vytvorte sezónne pravidlo pre požadované obdobie.",
                "Nastavte prirážku ako percentuálnu hodnotu alebo pevnú sumu nad základnou cenou — cenový plán automaticky preberá menu objektu.",
                "Skontrolujte v kalendári, či sa nová cena pre obdobie hlavnej sezóny zobrazuje správne, kým ju aktivujete.",
                "Skontrolujte minimálny pobyt pre hlavnú sezónu — často je vhodná vyššia minimálna dĺžka rezervácie na zoskupenie výmenných dní.",
                "Po aktivácii sledujte prvé dni situáciu s rezerváciami a v prípade potreby prirážku doladte.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Sezónne pravidlo pôsobí naprieč kanálmi rovnako na portáloch, platforme a webovej stránke. Podrobnosti o štruktúre pravidiel nájdete v [Cenové plány](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Podpora dlhších pobytov zľavou",
          excerpt: "Ako odmeníte hostí za dlhšiu dĺžku pobytu a znížite náklady na výmenu.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia",
            },
            {
              type: "p",
              text: "Krátke pobyty znamenajú viac príchodov a odchodov, viac upratovaní a vyššie riziko neobsadenosti medzi rezerváciami. Odstupňovaná zľava za dĺžku pobytu robí dlhšie rezervácie pre hostí atraktívnejšími a citeľne znižuje túto záťaž.",
            },
            {
              type: "steps",
              items: [
                "Otvorte cenový plán objektu a vytvorte zľavu za dĺžku pobytu.",
                "Definujte aspoň jedno pásmo, napríklad od 7 nocí alebo od 28 nocí, s príslušnou sadzbou zľavy.",
                "Skontrolujte, či sa pásma neprekrývajú a zľava platí len od danej minimálnej dĺžky.",
                "Otestujte v kalendári vzorovú rezerváciu prekračujúcu hranicu zľavy, aby ste potvrdili správne uplatnenie.",
                "Aktivujte zľavu a sledujte jej vplyv na priemernú dĺžku pobytu a obsadenosť.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Zľavy za dĺžku pobytu možno kombinovať so sezónnymi pravidlami — cenový plán obe úpravy vypočíta spolu. Viac o tom v [Cenové plány](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
