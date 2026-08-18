import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Storno podmienky",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "Každý poskytovateľ si pre svoje ubytovanie zvolí storno podmienku. Ktorá platí, je uvedené v inzeráte a vo Vašom potvrdení rezervácie. Táto stránka opisuje podmienky, ktoré poskytovateľom ponúkame na výber.",
  ],
  sections: [
    {
      id: "modelle",
      heading: "1. Prehľad storno podmienok",
      paragraphs: [
        "Rozhodujúca je vždy podmienka uvedená v inzeráte. Lehoty sa vzťahujú na začiatok dňa príchodu v miestnom čase ubytovania.",
      ],
      list: [
        "Flexibilná — bezplatné zrušenie do 24 hodín pred príchodom. Potom sa účtuje prvá noc, ostatné noci sa vracajú.",
        "Mierna — bezplatné zrušenie do 5 dní pred príchodom. Potom sa účtuje 50 % ceny za nocľah.",
        "Prísna — bezplatné zrušenie do 14 dní pred príchodom, ak rezervácia prebehla najmenej 14 dní pred príchodom. Potom sa do 7 dní pred príchodom účtuje 50 %, následne plná cena.",
        "Nevratná — žiadne bezplatné zrušenie. Cena je spravidla nižšia; na chýbajúce vrátenie upozorňujeme pred rezerváciou osobitne.",
      ],
    },
    {
      id: "was-erstattet-wird",
      heading: "2. Čo sa vracia v každom prípade",
      paragraphs: [
        "Bez ohľadu na zvolenú podmienku pri každom zrušení vraciame:",
      ],
      list: [
        "kúpeľný poplatok a iné prechodné poplatky, pokiaľ boli účtované cez Platformu a prenocovanie sa neuskutoční;",
        "zábezpeku inkasovanú cez Platformu v plnom rozsahu;",
        "doplnkové služby, ktoré neboli poskytnuté.",
      ],
    },
    {
      id: "stornierung-durch-anbieter",
      heading: "3. Zrušenie zo strany poskytovateľa",
      paragraphs: [
        "Ak zruší poskytovateľ, dostanete späť v plnom rozsahu sumu zaplatenú cez Platformu — bez ohľadu na zvolenú storno podmienku.",
        "Navyše Vás podporíme pri hľadaní porovnateľného ubytovania; pozri [Zásady zmeny rezervácie a vrátenia peňazí](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "widerruf",
      heading: "4. Žiadne zákonné právo na odstúpenie",
      paragraphs: [
        "Pri ubytovacích službách rezervovaných na určité obdobie spravidla neexistuje zákonné právo na odstúpenie podľa článku 16 písm. l) smernice 2011/83/EÚ. Tu opísané storno podmienky sú preto zmluvným prísľubom, nie implementáciou práva na odstúpenie.",
        "Kogentné zákonné práva, najmä práva zo zodpovednosti za vady ubytovania, nie sú dotknuté.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Zmena namiesto zrušenia",
      paragraphs: [
        "Ak chcete zmeniť obdobie alebo počet cestujúcich, podajte zmenu cez svoju rezerváciu. Poskytovateľ musí súhlasiť; dovtedy pôvodná rezervácia zostáva.",
        "Ak zmena vedie k vyššej cene, rozdiel sa stáva splatným. Ak vedie k nižšej cene, rozdiel vrátime, pokiaľ to platná storno podmienka pre odpadajúcu časť pripúšťa.",
      ],
    },
    {
      id: "wie",
      heading: "6. Ako zrušiť",
      paragraphs: [
        "Zrušte cez svoj účet v časti „Rezervácie“. Pre lehotu je rozhodujúci okamih, keď nám zrušenie dôjde.",
        "Dostanete potvrdenie o zrušení so sumou na vrátenie. K výplate pozri [Platobné podmienky](https://mybestdays.dk/rechtliches/zahlungsbedingungen#rueckerstattungen).",
      ],
    },
  ],
};
