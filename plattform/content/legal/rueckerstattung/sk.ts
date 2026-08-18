import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zásady zmeny rezervácie a vrátenia peňazí",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "Tieto zásady sa uplatnia, keď pri ubytovaní rezervovanom cez myBestDays niečo zásadne nesedí — sú teda prísľubom, ktorý ide nad rámec storno podmienky poskytovateľa.",
    "Platia pre rezervácie uzavreté a zaplatené cez Platformu.",
  ],
  sections: [
    {
      id: "wann",
      heading: "1. Kedy sa tieto zásady uplatnia",
      paragraphs: [
        "Uplatnia sa, keď pred pobytom alebo počas neho nastane niektorá z týchto udalostí:",
      ],
      list: [
        "Poskytovateľ zruší rezerváciu.",
        "Poskytovateľ nie je pri príchode dostupný alebo nedostanete prístup do ubytovania.",
        "Ubytovanie nie je obývateľné — napríklad pre chýbajúce kúrenie v chlade, chýbajúcu tečúcu vodu, nedostatočnú čistotu alebo ohrozenie zdravia.",
        "Ubytovanie sa podstatne odchyľuje od inzerátu — iný počet lôžok alebo miestností, iné miesto, ústredné vybavenie prisľúbené v inzeráte a skutočne chýbajúce.",
        "V ubytovaní sa zdržiava ďalší hosť, ktorý nebol ohlásený.",
      ],
    },
    {
      id: "was-sie-tun",
      heading: "2. Čo musíte urobiť",
      paragraphs: [
        "Problém nahláste čo najskôr, najneskôr však do 24 hodín od zistenia — pri problémoch pri príchode teda v deň príchodu.",
        "Nahláste ho najprv poskytovateľovi cez funkciu správ a dajte mu možnosť ho odstrániť. Pri ohrození Vášho zdravia alebo ak poskytovateľ nie je dostupný, táto povinnosť odpadá.",
        "Problém pokiaľ možno doložte fotografiami, videami alebo správami. Bez dokladov často nemôžeme skutkový stav zistiť.",
      ],
    },
    {
      id: "was-wir-tun",
      heading: "3. Čo robíme my",
      paragraphs: [
        "Ak sa problém potvrdí, máte na výber medzi porovnateľným náhradným ubytovaním a vrátením peňazí.",
        "Ak zvolíte náhradné ubytovanie, prevezmeme rozdiel v cene oproti Vašej pôvodnej rezervácii, pokiaľ je náhradné ubytovanie porovnateľné polohou, vybavením a veľkosťou.",
        "Ak zvolíte vrátenie peňazí, pri probléme pred príchodom vrátime celú sumu zaplatenú cez Platformu. Ak problém nastane počas pobytu, vrátime podiel za nepoužiteľné noci a primeranú sumu za zhoršenie už strávených nocí.",
        "O našom rozhodnutí Vás informujeme s odôvodnením. Môžete ho dať preskúmať cestou uvedenou v časti [Sťažnosti a riešenie sporov](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "4. Na čo sa nevzťahujú",
      paragraphs: ["Tieto zásady sa neuplatnia pri:"],
      list: [
        "okolnostiach, ktoré boli opísané v inzeráte alebo rozpoznateľné na fotografiách;",
        "nepatrných odchýlkach, ktoré neovplyvňujú užívanie (napríklad iná farba steny alebo iná pohovka);",
        "dočasných poruchách, ktoré poskytovateľ odstráni v primeranej lehote;",
        "okolnostiach mimo ubytovania, na ktoré poskytovateľ nemá vplyv — počasie, doprava, obecné stavby, zatvorenie pamiatok (na tie sa vzťahujú [Zásady pri závažných narušeniach](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen));",
        "problémoch, ktoré spôsobili Vy alebo Vaši spolucestujúci;",
        "rezerváciách uzavretých alebo zaplatených mimo Platformy.",
      ],
    },
    {
      id: "verhaeltnis",
      heading: "5. Vzťah k Vašim zákonným právam",
      paragraphs: [
        "Tieto zásady sú dobrovoľným prísľubom myBestDays. Vaše zákonné nároky voči poskytovateľovi — najmä zľava a náhrada škody — tým nie sú dotknuté a môžu ísť ďalej.",
        "V rozsahu, v akom Vám vrátime peniaze, prechádzajú príslušné nároky voči poskytovateľovi na nás.",
      ],
    },
  ],
};
