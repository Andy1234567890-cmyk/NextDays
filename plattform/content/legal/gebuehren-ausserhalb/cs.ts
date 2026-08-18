import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Poplatky mimo platformu",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "Tyto zásady upravují, které částky smí poskytovatel požadovat mimo platformu a které nikoli. Chrání hosty před tím, aby na místě čelili požadavkům, které nebyly v inzerátu.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Zásada",
      paragraphs: [
        "Vše, co je za rezervovanou službu splatné, musí být uvedeno v inzerátu před dokončením rezervace — buď jako součást celkové ceny, nebo jako položka nákladů na místě.",
        "Částku, která nebyla uvedena ani v celkové ceně, ani jako náklad na místě, host nedluží.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Co lze požadovat na místě",
      paragraphs: ["Na místě lze požadovat výhradně:"],
      list: [
        "částky výslovně uvedené v inzerátu jako náklady na místě (například závěrečný úklid, balíček ložního prádla, parkovací místo);",
        "místní poplatky jako pobytový poplatek, pokud jeho úhradu na místě vyžadují místní předpisy;",
        "kauci uvedenou v inzerátu;",
        "služby, které si host objedná až na místě a dobrovolně, za předem sdělenou cenu;",
        "náhradu prokázaných škod způsobených hostem.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Co požadovat nelze",
      paragraphs: ["Nepřípustné je zejména:"],
      list: [
        "doúčtování ceny za ubytování po dokončení rezervace;",
        "poplatek za to, že rezervace proběhla přes myBestDays;",
        "manipulační, rezervační nebo kartový poplatek, který nebyl uveden v inzerátu;",
        "výzva zrušit rezervaci a totéž ubytování rezervovat znovu mimo platformu;",
        "výzva uhradit cenu nebo její část převodem, hotově či platební službou mimo platformu, počítá-li inzerát s platbou přes platformu.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Obcházení platformy",
      paragraphs: [
        "Vznikl-li kontakt mezi hostem a poskytovatelem přes platformu, nesmí být rezervace vyřízena mimo ni. To platí pro obě strany.",
        "Kdo platformu obchází, ztrácí její ochranu: platby nejsou zajištěny, naše storno a refundační zásady se neuplatní a ve sporu nemůžeme zprostředkovat.",
        "Porušení mohou vést k zablokování účtu. Vůči poskytovatelům můžeme navíc uplatnit ušlý servisní poplatek.",
      ],
    },
    {
      id: "melden",
      heading: "5. Nahlásit",
      paragraphs: [
        "Je-li po vás na místě požadována částka, která nebyla v inzerátu, neplaťte ji a nahlaste nám to kontaktními cestami uvedenými pod [Stížnosti a řešení sporů](https://mybestdays.dk/rechtliches/beschwerden). Pokud jste již zaplatili, pomůžeme s vymáháním zpět.",
      ],
    },
  ],
};
