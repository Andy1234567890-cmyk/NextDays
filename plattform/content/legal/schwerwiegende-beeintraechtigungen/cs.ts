import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zásady při závažných narušeních",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "Někdy cestě nebo pobytu zabrání událost, za kterou nemůže host ani poskytovatel. Tyto zásady popisují, o které události jde a co poté platí.",
    "Mají přednost před storno podmínkou zvolenou v inzerátu.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Které události jsou zahrnuty",
      paragraphs: [
        "Zahrnuty jsou události, které nastanou po rezervaci, byly pro obě strany nepředvídatelné a činí cestu nebo pobyt nemožným či právně nepřípustným:",
      ],
      list: [
        "úřední zákazy cestování či pobytu, zákazy vycházení a uzavření hranic týkající se cílového místa nebo místa odjezdu;",
        "přírodní katastrofy a přírodní jevy postihující cílové místo — zemětřesení, povodeň, vichřice, velký požár, sopečná erupce;",
        "válka, ozbrojené konflikty, teroristické útoky a nepokoje v cílovém místě;",
        "úředně vyhlášená epidemie nebo pandemie s opatřeními zakazujícími pobyt;",
        "dlouhodobý výpadek dodávek elektřiny, vody nebo tepla v cílovém místě;",
        "úplná ztráta možnosti dopravy do cílového místa v důsledku některé z výše uvedených událostí.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Které události zahrnuty nejsou",
      paragraphs: ["Zahrnuty nejsou zejména:"],
      list: [
        "nemoc nebo úraz hosta či jeho blízkých — k tomu slouží cestovní pojištění;",
        "pracovní překážka, termíny zkoušek nebo zrušení dovolené;",
        "zrušení akce, kvůli níž byla cesta rezervována, zůstává-li ubytování využitelné;",
        "počasí, které nepředstavuje přírodní katastrofu — déšť, chlad, horko, chybějící sníh;",
        "výpadek jednotlivých dopravních prostředků, dokud zůstává možná přiměřená doprava;",
        "zrušení letu nebo stávka u dopravce — v tomto ohledu existují nároky vůči dopravci.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Co platí, nastane-li zahrnutá událost",
      paragraphs: [
        "Týká-li se událost období vaší rezervace, můžete bezplatně zrušit. Částku uhrazenou přes platformu obdržíte v plné výši zpět.",
        "Pokud pobyt již začal, vracíme podíl za noci, které již nelze využít.",
        "Poskytovateli z takového zrušení nevznikají žádné nevýhody při hodnocení jeho spolehlivosti.",
        "Alternativně se můžete s poskytovatelem dohodnout na přesunu; s přerezervací pomůžeme.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Jak se toho dovoláte",
      paragraphs: [
        "Ozvěte se cestami uvedenými pod [Stížnosti a řešení sporů](https://mybestdays.dk/rechtliches/beschwerden) a uveďte číslo rezervace a událost.",
        "Ověřujeme podle veřejně dostupných zdrojů — úředních opatření, oficiálních varování, zpráv uznávaných zpravodajských zdrojů — a rozhodujeme rychle.",
        "Nelze-li situaci ještě definitivně posoudit, vyčkáme vývoje až téměř do dne příjezdu a poté rozhodneme. Vaše rezervace do té doby zůstává beze změny.",
      ],
    },
  ],
};
