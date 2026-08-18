import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Storno podmínky",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "Každý poskytovatel volí pro své ubytování storno podmínku. Která platí, je uvedeno v inzerátu a ve vašem potvrzení rezervace. Tato stránka popisuje podmínky, které poskytovatelům nabízíme.",
  ],
  sections: [
    {
      id: "modelle",
      heading: "1. Storno podmínky v přehledu",
      paragraphs: [
        "Rozhodující je vždy podmínka uvedená v inzerátu. Lhůty se vztahují k začátku dne příjezdu v místním čase ubytování.",
      ],
      list: [
        "Flexibilní — bezplatné zrušení do 24 hodin před příjezdem. Poté se účtuje první noc, ostatní noci se vracejí.",
        "Umírněná — bezplatné zrušení do 5 dnů před příjezdem. Poté se účtuje 50 % ceny za ubytování.",
        "Přísná — bezplatné zrušení do 14 dnů před příjezdem, pokud rezervace proběhla nejméně 14 dnů před příjezdem. Poté se do 7 dnů před příjezdem účtuje 50 %, následně plná cena.",
        "Nevratná — bez bezplatného zrušení. Cena bývá nižší; na chybějící vrácení upozorňujeme zvlášť před rezervací.",
      ],
    },
    {
      id: "was-erstattet-wird",
      heading: "2. Co vracíme v každém případě",
      paragraphs: [
        "Bez ohledu na zvolenou podmínku vracíme při každém zrušení:",
      ],
      list: [
        "pobytový poplatek a další průběžné poplatky, pokud byly vyúčtovány přes platformu a přenocování se neuskuteční;",
        "kauci strženou přes platformu v plné výši;",
        "doplňkové služby, které nebyly poskytnuty.",
      ],
    },
    {
      id: "stornierung-durch-anbieter",
      heading: "3. Zrušení poskytovatelem",
      paragraphs: [
        "Zruší-li poskytovatel, obdržíte částku uhrazenou přes platformu zpět v plné výši — bez ohledu na zvolenou storno podmínku.",
        "Navíc vám pomůžeme najít srovnatelné ubytování; viz [Zásady přeubytování a vrácení peněz](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "widerruf",
      heading: "4. Žádné zákonné právo na odstoupení",
      paragraphs: [
        "U ubytovacích služeb rezervovaných na určité období zpravidla neexistuje zákonné právo na odstoupení podle čl. 16 písm. l) směrnice 2011/83/EU. Zde popsané storno podmínky jsou proto smluvním příslibem, nikoli provedením práva na odstoupení.",
        "Kogentní zákonná práva, zejména práva z vad ubytování, zůstávají nedotčena.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Změna namísto zrušení",
      paragraphs: [
        "Chcete-li změnit období nebo počet cestujících, podejte změnu ze své rezervace. Poskytovatel musí souhlasit; do té doby trvá původní rezervace.",
        "Vede-li změna k vyšší ceně, stává se rozdíl splatným. Vede-li k nižší ceně, rozdíl vracíme v rozsahu, v jakém to platná storno podmínka pro odpadající část připouští.",
      ],
    },
    {
      id: "wie",
      heading: "6. Jak zrušíte",
      paragraphs: [
        "Zrušte ve svém účtu v části „Rezervace“. Pro lhůtu je rozhodující okamžik, kdy nám zrušení dojde.",
        "Obdržíte potvrzení o zrušení s částkou k vrácení. K výplatě viz [Platební podmínky](https://mybestdays.dk/rechtliches/zahlungsbedingungen#rueckerstattungen).",
      ],
    },
  ],
};
