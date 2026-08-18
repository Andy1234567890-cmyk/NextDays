import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Servisné poplatky",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "myBestDays sa financuje zo servisného poplatku zo sprostredkovaných rezervácií. Táto stránka vysvetľuje, kto ho platí, ako sa počíta a kde je uvedený.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Kto platí servisný poplatok",
      paragraphs: [
        "Servisný poplatok znáša poskytovateľ. Zadrží sa z hodnoty rezervácie a znižuje výplatu jemu; hosť ho neplatí navyše.",
        "Ak výnimočne pri rezervácii vzniká servisný poplatok pre hosťa, uvedieme ho pred dokončením rezervácie ako samostatnú položku v celkovej cene. Bez tohto uvedenia hosťovi žiadny poplatok nevzniká.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Ako sa počíta",
      paragraphs: [
        "Servisný poplatok je percentom z hodnoty rezervácie zúčtovanej cez Platformu. Sadzba platná pre Vaše rezervácie je uvedená vo Vašom účte hostiteľa a v dohode, s ktorou ste súhlasili pri registrácii.",
        "Základom výpočtu je cena za nocľah plus príplatky zúčtované cez Platformu. Nezahŕňajú sa prechodné položky, ktoré nie sú protiplnením poskytovateľa — najmä kúpeľný poplatok a zábezpeka.",
        "Servisný poplatok sa počíta a uvádza v mene inzerátu.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. Daň z pridanej hodnoty",
      paragraphs: [
        "Zo servisného poplatku sa platí DPH, pokiaľ je zo zákona splatná. Či sa uvádza, alebo sa uplatní prenesenie daňovej povinnosti, závisí od sídla a postavenia poskytovateľa.",
        "K servisnému poplatku vystavíme poskytovateľovi vyúčtovanie dostupné v jeho účte.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Zrušenie a vrátenie peňazí",
      paragraphs: [
        "Ak je rezervácia úplne vrátená, servisný poplatok vrátime pomerne v rozsahu, v akom sa vracia hodnota rezervácie.",
        "Ak poskytovateľ zruší bez dôležitého dôvodu, servisný poplatok automaticky nezaniká; vyhradzujeme si právo uplatniť náklady vzniknuté zrušením.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Zmena servisného poplatku",
      paragraphs: [
        "Zmenu sadzby oznámime poskytovateľom najmenej 30 dní pred nadobudnutím účinnosti na trvanlivom nosiči; zodpovedá to článku 3 ods. 2 nariadenia (EÚ) 2019/1150.",
        "Na už potvrdené rezervácie sa vzťahuje sadzba platná v čase rezervácie.",
      ],
    },
  ],
};
