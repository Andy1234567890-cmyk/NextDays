import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zásady přeubytování a vrácení peněz",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "Tyto zásady se uplatní, když je s ubytováním rezervovaným přes myBestDays něco zásadně v nepořádku — jsou tedy příslibem, který jde nad rámec storno podmínky poskytovatele.",
    "Platí pro rezervace uzavřené a uhrazené přes platformu.",
  ],
  sections: [
    {
      id: "wann",
      heading: "1. Kdy se tyto zásady uplatní",
      paragraphs: [
        "Uplatní se, nastane-li před pobytem nebo během něj některá z následujících událostí:",
      ],
      list: [
        "Poskytovatel zruší rezervaci.",
        "Poskytovatel není při příjezdu k zastižení nebo se nedostanete do ubytování.",
        "Ubytování není obyvatelné — například kvůli chybějícímu vytápění v chladu, chybějící tekoucí vodě, nedostatečné čistotě nebo ohrožení zdraví.",
        "Ubytování se podstatně liší od inzerátu — jiný počet lůžek či místností, jiné místo, v inzerátu přislíbené a fakticky chybějící zásadní vybavení.",
        "V ubytování se zdržuje jiný, neohlášený host.",
      ],
    },
    {
      id: "was-sie-tun",
      heading: "2. Co musíte udělat vy",
      paragraphs: [
        "Nahlaste problém co nejdříve, nejpozději však do 24 hodin od zjištění — u problémů při příjezdu tedy v den příjezdu.",
        "Nahlaste jej nejprve poskytovateli prostřednictvím zpráv a dejte mu příležitost jej odstranit. Při ohrožení vašeho zdraví nebo není-li poskytovatel k zastižení, tato povinnost odpadá.",
        "Problém pokud možno doložte fotografiemi, videi nebo zprávami. Bez dokladů často nemůžeme skutkový stav zjistit.",
      ],
    },
    {
      id: "was-wir-tun",
      heading: "3. Co uděláme my",
      paragraphs: [
        "Potvrdí-li se problém, máte na výběr mezi srovnatelným náhradním ubytováním a vrácením peněz.",
        "Zvolíte-li náhradní ubytování, uhradíme rozdíl v ceně oproti vaší původní rezervaci, pokud je náhradní ubytování srovnatelné polohou, vybavením a velikostí.",
        "Zvolíte-li vrácení, u problému před příjezdem vracíme celou částku uhrazenou přes platformu. Nastane-li problém během pobytu, vracíme podíl za nevyužitelné noci a přiměřenou částku za snížení užitku již strávených nocí.",
        "O svém rozhodnutí vás informujeme s odůvodněním. Můžete je nechat přezkoumat cestou uvedenou pod [Stížnosti a řešení sporů](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "4. Co není zahrnuto",
      paragraphs: ["Tyto zásady se neuplatní při:"],
      list: [
        "okolnostech popsaných v inzerátu nebo patrných z fotografií;",
        "nepodstatných odchylkách, které neomezují užívání (například jiná barva stěn nebo jiná pohovka);",
        "dočasných poruchách, které poskytovatel odstraní v přiměřené lhůtě;",
        "okolnostech mimo ubytování, které poskytovatel nemůže ovlivnit — počasí, doprava, obecní staveniště, uzavření památek (pro ně platí [Zásady při závažných narušeních](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen));",
        "problémech, které jste způsobili vy nebo vaši spolucestující;",
        "rezervacích uzavřených nebo uhrazených mimo platformu.",
      ],
    },
    {
      id: "verhaeltnis",
      heading: "5. Vztah k vašim zákonným právům",
      paragraphs: [
        "Tyto zásady jsou dobrovolným příslibem myBestDays. Vaše zákonné nároky vůči poskytovateli — zejména sleva z ceny a náhrada škody — zůstávají nedotčeny a mohou jít dále.",
        "V rozsahu, v jakém vám plníme, přecházejí odpovídající nároky vůči poskytovateli na nás.",
      ],
    },
  ],
};
