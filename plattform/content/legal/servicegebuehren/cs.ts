import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Servisní poplatky",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "myBestDays se financuje servisním poplatkem ze zprostředkovaných rezervací. Tato stránka vysvětluje, kdo jej platí, jak se počítá a kde se uvádí.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Kdo platí servisní poplatek",
      paragraphs: [
        "Servisní poplatek nese poskytovatel. Sráží se z hodnoty rezervace a snižuje výplatu jemu určenou; host jej neplatí navíc.",
        "Vznikne-li výjimečně u rezervace servisní poplatek pro hosta, uvedeme jej před dokončením rezervace jako samostatnou položku celkové ceny. Bez tohoto uvedení hostovi žádný poplatek nevzniká.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Jak se počítá",
      paragraphs: [
        "Servisní poplatek je procentem z hodnoty rezervace vyúčtované přes platformu. Sazba platná pro vaše rezervace je uvedena ve vašem hostitelském účtu a ve smlouvě, kterou jste při registraci odsouhlasili.",
        "Základem výpočtu je cena za ubytování zvýšená o příplatky vyúčtované přes platformu. Nezapočítávají se průběžné položky, které nejsou protiplněním poskytovatele — zejména pobytový poplatek a kauce.",
        "Servisní poplatek se počítá a uvádí v měně inzerátu.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. DPH",
      paragraphs: [
        "Ze servisního poplatku se odvádí DPH, pokud je podle zákona splatná. Zda se vykazuje, nebo se uplatní režim přenesení daňové povinnosti, závisí na sídle a statusu poskytovatele.",
        "K servisnímu poplatku vystavujeme poskytovateli vyúčtování dostupné v jeho účtu.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Zrušení a vrácení",
      paragraphs: [
        "Je-li rezervace vrácena v plné výši, vracíme servisní poplatek poměrně k vrácené hodnotě rezervace.",
        "Zruší-li poskytovatel bez důležitého důvodu, servisní poplatek automaticky nezaniká; vyhrazujeme si uplatnit náklady vzniklé zrušením.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Změna servisního poplatku",
      paragraphs: [
        "Změnu sazby oznamujeme poskytovatelům nejméně 30 dnů před nabytím účinnosti na trvalém nosiči; odpovídá to čl. 3 odst. 2 nařízení (EU) 2019/1150.",
        "Pro již potvrzené rezervace platí sazba účinná v době rezervace.",
      ],
    },
  ],
};
