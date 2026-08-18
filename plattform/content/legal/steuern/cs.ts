import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Daňové zásady",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "Tato stránka vysvětluje, jaké daně a poplatky mohou při rezervaci přes myBestDays vzniknout, kdo je dluží a jaké oznamovací povinnosti máme jako provozovatel platformy.",
    "Nejde o daňové poradenství. Ke svému daňovému posouzení v konkrétním případě se obraťte na daňového poradce.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Co se týká hostů",
      paragraphs: [
        "Zobrazená celková cena obsahuje daně vyúčtované přes platformu — zejména DPH z ubytovací služby, pokud ji poskytovatel dluží.",
        "Místní poplatky jako pobytový poplatek, lázeňský poplatek nebo turistický poplatek se podle obce buď vyúčtovávají přes platformu, nebo se vybírají na místě. Který případ nastává, uvádíme před dokončením rezervace.",
        "Fakturu za ubytovací službu vystavuje poskytovatel; je poskytujícím podnikatelem. Potřebujete-li fakturu s vyčíslenou DPH, vyžádejte si ji u poskytovatele.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Co se týká poskytovatelů",
      paragraphs: [
        "Za správné zdanění svých příjmů odpovídají poskytovatelé sami — daň z příjmů fyzických či právnických osob, DPH a místní poplatky.",
        "Zda je pronájem předmětem DPH a jaká sazba platí, se řídí právem státu, v němž se ubytování nachází (místo plnění u nemovitostí).",
        "Poskytovatelé zadávají u objektu poplatky platné pro jejich ubytování, aby byly v inzerátu uvedeny správně.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Oznamování správcům daně (DAC7)",
      paragraphs: [
        "Jako provozovatel digitální platformy jsme podle směrnice (EU) 2021/514 („DAC7“) a vnitrostátních prováděcích předpisů povinni každoročně oznamovat příslušnému správci daně údaje o oznamovaných poskytovatelích a o odměnách dosažených přes platformu.",
        "Oznamují se zejména jméno, adresa, daňové identifikační číslo, datum narození nebo registrační číslo, údaje o účtu pro výplatu, adresa ubytování a odměny vyplacené po čtvrtletích i zadržené poplatky.",
        "Poskytovatelé obdrží kopii oznámených údajů, které se jich týkají.",
        "Neposkytne-li poskytovatel přes dvě výzvy údaje potřebné k oznámení, jsme povinni zadržet výplaty a zablokovat účet.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Srážky",
      paragraphs: [
        "Ukládá-li nám právo některého státu srazit a odvést z výplaty daň, učiníme tak a srážku uvedeme ve vyúčtování.",
      ],
    },
  ],
};
