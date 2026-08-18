import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zásady autorského práva",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "myBestDays respektuje práva třetích osob a totéž očekává od svých uživatelů. Tyto zásady popisují, jak nahlásit porušení autorského práva a jak s ním nakládáme.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Zásada",
      paragraphs: [
        "Kdo na platformu vkládá obsah, zaručuje, že k němu má potřebná práva. To platí zejména pro fotografie, půdorysy, texty a výřezy map v inzerátech.",
        "Vkládání cizího obsahu bez svolení je porušením [Podmínek použití](https://mybestdays.dk/rechtliches/nutzungsbedingungen) a [Pravidel pro vhodný obsah](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
      ],
    },
    {
      id: "meldung",
      heading: "2. Nahlásit porušení",
      paragraphs: [
        "Porušení autorského práva nahlaste funkcí hlášení u dotčeného obsahu nebo prostřednictvím kontaktního místa uvedeného pod [Nařízení o digitálních službách](https://mybestdays.dk/rechtliches/dsa). Hlášení by mělo obsahovat:",
      ],
      list: [
        "přesné označení napadeného obsahu, zejména URL;",
        "popis chráněného díla a doklad o vašem nositelství práv nebo o vašem oprávnění jednat za nositele práv;",
        "odůvodnění, proč užití není dovoleno;",
        "vaše jméno a kontaktní adresu;",
        "prohlášení, že vaše údaje jsou podle nejlepšího vědomí správné a úplné.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Jak hlášení zpracováváme",
      paragraphs: [
        "Přijetí vašeho hlášení neprodleně potvrdíme a rozhodneme rychle a pečlivě.",
        "Považujeme-li hlášení za důvodné, obsah odstraníme nebo k němu zablokujeme přístup a informujeme osobu, která jej vložila, s uvedením důvodů a cesty ke stížnosti.",
        "Považujeme-li hlášení za nedůvodné, sdělíme vám to s odůvodněním.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Námitka dotčené osoby",
      paragraphs: [
        "Byl-li váš obsah odstraněn a považujete-li to za neoprávněné, můžete do šesti měsíců bezplatně podat stížnost. Uveďte přitom, proč jste k užití oprávněni.",
        "Ukáže-li se stížnost jako důvodná, obsah obnovíme.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Opakovaná porušení",
      paragraphs: [
        "Účty, jejichž prostřednictvím je opakovaně vkládán obsah porušující práva, po předchozím varování zablokujeme. Odpovídá to článku 23 nařízení (EU) 2022/2065.",
        "Stejně tak zablokujeme funkci hlášení osobám, které opakovaně podávají zjevně nedůvodná hlášení.",
      ],
    },
  ],
};
