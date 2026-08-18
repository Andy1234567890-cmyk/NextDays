import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zásady hodnocení",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "Hodnocení jsou pro hosty nejdůležitějším nezávislým zdrojem. Tyto zásady popisují, kdo smí hodnotit, jak zajišťujeme, že hodnocení pocházejí od skutečných hostů, a kdy hodnocení odstraníme.",
  ],
  sections: [
    {
      id: "echtheit",
      heading: "1. Jak zajišťujeme pravost",
      paragraphs: [
        "Hodnocení může podat pouze ten, kdo si ubytování rezervoval přes myBestDays a jehož pobyt začal. Hodnocení je technicky navázáno na konkrétní rezervaci.",
        "Tím plníme povinnost podle bodu 23b přílohy I směrnice 2005/29/ES prezentovat jako hodnocení hostů pouze taková, u nichž jsme podnikli přiměřené kroky k ověření, že pocházejí od skutečných hostů.",
        "Hodnocení nekupujeme, neobjednáváme a nevkládáme falešná hodnocení. Netolerujeme to ani u poskytovatelů.",
      ],
    },
    {
      id: "frist",
      heading: "2. Lhůta a zveřejnění",
      paragraphs: [
        "Po odjezdu máte 14 dnů na podání hodnocení. Poskytovatel může ve stejné lhůtě podat hodnocení o vás.",
        "Obě hodnocení se zveřejní současně, jakmile existují obě nebo uplyne lhůta. Žádná strana tak neovlivňuje druhou.",
        "Podané hodnocení můžete ve lhůtě stáhnout. Po zveřejnění již není změna možná; můžete požádat o jeho smazání.",
      ],
    },
    {
      id: "antwort",
      heading: "3. Odpověď poskytovatele",
      paragraphs: [
        "Poskytovatel může na hodnocení veřejně odpovědět. Pro odpověď platí stejná pravidla jako pro samotné hodnocení.",
        "Odpověď hodnocení nemění a nemá vliv na celkové hodnocení.",
      ],
    },
    {
      id: "entfernung",
      heading: "4. Kdy hodnocení odstraníme",
      paragraphs: [
        "Hodnocení neodstraňujeme proto, že je záporné, ani proto, že s ním poskytovatel není spokojen. Odstraníme je, když:",
      ],
      list: [
        "porušuje [Pravidla pro vhodný obsah](https://mybestdays.dk/rechtliches/inhaltsrichtlinien);",
        "obsahuje osobní údaje třetích osob;",
        "zjevně se týká jiného ubytování nebo jiného pobytu;",
        "týká se v podstatné části okolností, které nemohl ovlivnit host ani poskytovatel (například počasí, obecní staveniště, doprava při příjezdu) — v takovém případě odstraníme jen dotčenou část, pokud ji lze oddělit;",
        "zjevně slouží k vydírání, například proto, že bylo spojeno s požadavkem;",
        "bylo získáno pomocí pobídek nebo podáno koordinovaně.",
      ],
    },
    {
      id: "anreize",
      heading: "5. Pobídky nejsou přípustné",
      paragraphs: [
        "Poskytovatelé nesmějí za hodnocení nabízet peníze, slevy, vyšší kategorii, dary ani jiné výhody — ani za to, že hodnocení nepodáte.",
        "Poskytovatelé mohou hosty vyzvat k hodnocení, aniž by ovlivňovali známku. Výzva, která žádá hodnocení jen v případě pozitivní zkušenosti, není přípustná.",
      ],
    },
    {
      id: "darstellung",
      heading: "6. Jak hodnocení zobrazujeme",
      paragraphs: [
        "Celkové hodnocení je nevážený průměr všech zveřejněných hodnocení ubytování. Žádné hodnocení neváhujeme výše proto, že je příznivější.",
        "Výchozí řazení zobrazuje nejnovější hodnocení jako první. Můžete přepnout na jiná řazení; aktivní řazení se zobrazuje.",
        "Uvádíme, na kolika hodnoceních je celkové hodnocení založeno. Při méně než třech hodnoceních celkové hodnocení nezobrazujeme, pouze jednotlivá hodnocení.",
      ],
    },
    {
      id: "beschwerde",
      heading: "7. Stížnost proti rozhodnutí",
      paragraphs: [
        "Odstraníme-li vaše hodnocení nebo odmítneme-li odstranění hodnocení, odůvodníme to a uvedeme cestu ke stížnosti — viz [Stížnosti a řešení sporů](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
  ],
};
