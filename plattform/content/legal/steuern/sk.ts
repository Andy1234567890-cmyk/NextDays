import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Daňové zásady",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "Táto stránka vysvetľuje, aké dane a poplatky môžu pri rezervácii cez myBestDays vzniknúť, kto ich dlží a aké ohlasovacie povinnosti máme my ako prevádzkovateľ platformy.",
    "Nie je to daňové poradenstvo. Pre svoje daňové posúdenie v konkrétnom prípade sa obráťte na daňového poradcu.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Čo sa týka hostí",
      paragraphs: [
        "Zobrazená celková cena obsahuje dane účtované cez Platformu — najmä DPH z ubytovacej služby, pokiaľ ju poskytovateľ dlží.",
        "Miestne poplatky ako kúpeľný poplatok, daň z ubytovania alebo turistický poplatok sa podľa obce buď účtujú cez Platformu, alebo vyberajú na mieste. Ktorý prípad platí, uvádzame pred dokončením rezervácie.",
        "Faktúru za ubytovaciu službu vystavuje poskytovateľ; on je poskytujúcim podnikateľom. Ak potrebujete faktúru s vykázanou DPH, vyžiadajte si ju od poskytovateľa.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Čo sa týka poskytovateľov",
      paragraphs: [
        "Poskytovatelia zodpovedajú sami za správne daňové posúdenie svojich príjmov — daň z príjmov alebo daň z príjmov právnických osôb, DPH a miestne poplatky.",
        "Či prenájom podlieha DPH a aká sadzba sa uplatní, sa riadi právom štátu, v ktorom sa ubytovanie nachádza (miesto dodania pri nehnuteľnostiach).",
        "Poskytovatelia zapisujú poplatky platné pre ich ubytovanie do objektu, aby sa v inzeráte správne uviedli.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Oznamovanie daňovým orgánom (DAC7)",
      paragraphs: [
        "Ako prevádzkovateľ digitálnej platformy sme podľa smernice (EÚ) 2021/514 („DAC7“) a jej vnútroštátnych transpozičných predpisov povinní každoročne oznamovať príslušnému daňovému orgánu údaje o oznamovaných poskytovateľoch a o odmenách dosiahnutých cez Platformu.",
        "Oznamujú sa najmä meno, adresa, daňové identifikačné číslo, dátum narodenia alebo registračné číslo, údaje o účte na výplatu, adresa ubytovania a odmeny vyplatené za jednotlivé štvrťroky, ako aj zadržané poplatky.",
        "Poskytovatelia dostávajú kópiu oznámených údajov, ktoré sa ich týkajú.",
        "Ak poskytovateľ napriek dvojitej výzve neposkytne údaje potrebné na oznámenie, sme povinní zadržať výplaty a zablokovať účet.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Zrážky",
      paragraphs: [
        "Ak nás právo niektorého štátu zaväzuje zraziť z výplaty dane a odviesť ich, urobíme tak a zrážku uvedieme vo vyúčtovaní.",
      ],
    },
  ],
};
