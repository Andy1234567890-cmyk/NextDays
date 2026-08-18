import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Pravidla pro vhodný obsah",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "Tato pravidla platí pro veškerý obsah, který uživatelé vkládají na myBestDays: inzeráty, fotografie, hodnocení, zprávy, údaje profilu a odpovědi na hodnocení.",
    "Jsou součástí [Podmínek použití](https://mybestdays.dk/rechtliches/nutzungsbedingungen). Porušení může vést k odstranění obsahu a k opatřením vůči účtu.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Co není dovoleno",
      paragraphs: ["Na myBestDays je nepřípustný zejména následující obsah:"],
      list: [
        "protiprávní obsah jakéhokoli druhu, zejména výzvy k trestné činnosti, teroristický obsah a materiály zobrazující sexuální zneužívání dětí;",
        "obsah podněcující k nenávisti nebo násilí vůči osobám či skupinám z důvodu původu, barvy pleti, náboženství, světového názoru, pohlaví, genderové identity, sexuální orientace, zdravotního postižení nebo věku;",
        "urážky, výhrůžky, obtěžování a cílené vystavování jednotlivých osob;",
        "osobní údaje třetích osob bez jejich souhlasu, zejména jména, adresy, telefonní čísla, údaje z dokladů totožnosti nebo platební údaje;",
        "zavádějící údaje o ubytování, jeho poloze, vybavení, velikosti nebo dostupnosti;",
        "cizí fotografie, texty nebo ochranné známky bez potřebných práv;",
        "reklama, spam a obsah odkazující na jiné cesty rezervace mimo platformu;",
        "škodlivý software, pokusy o phishing a odkazy na takový obsah;",
        "nabídky něčeho jiného než ubytovací služby.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Fotografie",
      paragraphs: [
        "Fotografie musí zobrazovat skutečně nabízené ubytování a být pořízeny ve stavu odpovídajícím současnému.",
        "Fotografie nesmí zobrazovat rozpoznatelné osoby bez jejich souhlasu. Úpravy jsou přípustné, pokud nezkreslují dojem z ubytování — projasnění ano, vyretušovaná sousední budova ne.",
        "Kamerový dohled v ubytování je nutné uvést v inzerátu. Ve vnitřních prostorách, kde mají hosté oprávněné očekávání soukromí — ložnice, koupelny — nejsou kamery přípustné, ani vypnuté.",
      ],
    },
    {
      id: "melden",
      heading: "3. Nahlásit obsah",
      paragraphs: [
        "Považujete-li obsah za protiprávní nebo za porušení těchto pravidel, můžete jej nahlásit funkcí hlášení u každého inzerátu, hodnocení i zprávy.",
        "Postup hlášení podle článku 16 nařízení (EU) 2022/2065 a zpracování hlášení jsou popsány pod [Nařízení o digitálních službách](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Jak pravidla prosazujeme",
      paragraphs: [
        "Každý nahlášený obsah posoudíme a zvolíme nejmírnější vhodné opatření: upozornění, odstranění dotčené části, odstranění celého obsahu, omezení viditelnosti, zablokování funkce nebo zablokování účtu.",
        "Opakovaná nebo závažná porušení váží více. U zjevně protiprávního obsahu nebo ohrožení osob jednáme okamžitě.",
        "Každé opatření odůvodníme vůči dotčené osobě a uvedeme cestu ke stížnosti. Stížnost vyřizují lidé.",
      ],
    },
  ],
};
