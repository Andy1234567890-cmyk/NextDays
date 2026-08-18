import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Ceny, řazení a doporučení",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "Tato stránka vysvětluje, jak se na myBestDays zobrazují ceny, co určuje pořadí výsledků vyhledávání a jak vznikají doporučení. Plní povinnosti transparentnosti podle článku 6a směrnice 2005/29/ES, článku 5 nařízení (EU) 2019/1150 a článku 27 nařízení (EU) 2022/2065.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Jak se zobrazují ceny",
      paragraphs: [
        "Jakmile jsou známy období a počet cestujících, zobrazujeme celkovou cenu za celý pobyt včetně daní a všech poplatků vyúčtovaných přes platformu.",
        "Dokud není zvoleno období, zobrazujeme orientační cenu za noc a označujeme ji jako takovou.",
        "Náklady splatné až na místě uvádíme zvlášť před dokončením rezervace. Nejsou součástí celkové ceny, ale jsou před rezervací viditelné.",
        "Zobrazujeme-li přeškrtnutou srovnávací cenu, jde o nejnižší cenu, kterou poskytovatel za tutéž službu požadoval během 30 dnů před snížením (článek 6a směrnice 98/6/ES).",
        "Ceny jsou pro všechny hosty stejné. Cenu nepřizpůsobujeme vaší osobě, vašemu zařízení ani vaší dosavadní historii vyhledávání.",
      ],
    },
    {
      id: "ranking",
      heading: "2. Co určuje pořadí výsledků vyhledávání",
      paragraphs: [
        "Ve výchozím řazení určují pořadí následující faktory, v sestupném významu:",
      ],
      list: [
        "shoda s vaším vyhledáváním — dostupnost v hledaném období, kapacita pro počet cestujících, poloha v hledané oblasti a nastavené filtry;",
        "úplnost a kvalita inzerátu — popis, fotografie, udržované údaje o vybavení;",
        "hodnocení — celkové hodnocení a počet hodnocení;",
        "spolehlivost poskytovatele — rychlost odpovědí, míra přijetí a zrušení ze strany poskytovatele;",
        "aktuálnost cen a dostupnosti;",
        "poměr ceny a výkonu ve srovnání s podobnými inzeráty ve stejné oblasti.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Placené umístění",
      paragraphs: [
        "Poskytovatel si nemůže koupit lepší místo ve výchozím řazení. Výše servisního poplatku pořadí neovlivňuje.",
        "Pokud bychom v budoucnu nabízeli placená umístění, jednoznačně bychom je označili jako reklamu a viditelně oddělili od ostatních výsledků.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Změna řazení",
      paragraphs: [
        "Řazení můžete kdykoli změnit, například podle ceny nebo hodnocení. Aktivní řazení se zobrazuje nad seznamem výsledků.",
        "K dispozici máte nejméně jedno řazení, které není založeno na profilování ve smyslu čl. 4 bodu 4 nařízení (EU) 2016/679.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Doporučení",
      paragraphs: [
        "Zobrazujeme-li vám návrhy („mohlo by se vám líbit“, „podobná ubytování“), vycházejí z aktuálního vyhledávání, z dříve zobrazených inzerátů a z vlastností podobných ubytování.",
        "Personalizovaná doporučení můžete ve svém účtu vypnout. Poté uvidíte návrhy založené výhradně na aktuálním vyhledávání.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Hodnocení v řazení",
      paragraphs: [
        "Jak hodnocení vznikají a jak se ověřují, uvádějí [Zásady hodnocení](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). Hodnocení do pořadí vstupují, ale jednotlivá hodnocení neváhujeme výše ani nepotlačujeme záporná.",
      ],
    },
  ],
};
