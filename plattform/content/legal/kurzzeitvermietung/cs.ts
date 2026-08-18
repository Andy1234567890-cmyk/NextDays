import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Krátkodobý pronájem a registrační povinnosti",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "V mnoha městech a regionech podléhá krátkodobý pronájem bydlení povolení, registraci nebo ohlášení. Tato stránka vysvětluje, co to znamená pro poskytovatele a pro hosty.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Právní rámec",
      paragraphs: [
        "Nařízení (EU) 2024/1028 o shromažďování a sdílení údajů týkajících se služeb krátkodobého pronájmu ubytování vytváří jednotný rámec: kde členský stát nebo územní samospráva zavedly registrační postup, obdrží každá jednotka registrační číslo.",
        "Platformy musí toto číslo zobrazovat, namátkově ověřovat jeho platnost a v pravidelných intervalech předávat příslušným orgánům údaje o činnosti.",
        "Vedle toho nadále platí vnitrostátní a místní předpisy — například o změně účelu užívání bytů, o maximálním počtu dnů pronájmu, o požární ochraně a o hlášení hostů.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Co musí poskytovatelé udělat",
      paragraphs: [
        "Před zveřejněním ověřte, zda se na vaše ubytování vztahuje registrační, povolovací nebo ohlašovací povinnost, a splňte ji.",
        "Registrační číslo, existuje-li, zadejte u objektu. Zobrazujeme je v inzerátu.",
        "Dodržujte maximální počet dnů pronájmu a další místní limity. Jejich sledování je vaším úkolem, nikoli naším.",
        "Inzerát bez požadovaného registračního čísla nesmíme trvale zobrazovat. Chybí-li nebo ukáže-li se jako neplatné, vyžádáme si je; nebude-li údaj doplněn, inzerát deaktivujeme.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. Co to znamená pro hosty",
      paragraphs: [
        "Vztahuje-li se na ubytování registrační povinnost, uvidíte registrační číslo v inzerátu. Je to signál, že pronájem byl ohlášen příslušnému orgánu.",
        "V cílovém místě může být vyžadováno přihlášení (přihlašovací lístek, údaje z dokladu totožnosti, prohlášení k pobytovému poplatku). Poskytovatel si vyžádá potřebné údaje; poskytněte je včas.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Předávání údajů orgánům",
      paragraphs: [
        "V rozsahu, v jakém to stanoví nařízení (EU) 2024/1028 nebo vnitrostátní právo, předáváme příslušným orgánům údaje o pronájmové činnosti — zejména registrační číslo, adresu jednotky, počet obsazených nocí a počet hostů.",
        "Toto předání se uskutečňuje ke splnění právní povinnosti podle čl. 6 odst. 1 písm. c) nařízení (EU) 2016/679. Podrobnosti uvádějí [Zásady ochrany osobních údajů](https://mybestdays.dk/rechtliches/datenschutz).",
        "Odděleně od toho existuje daňová oznamovací povinnost podle DAC7; viz [Daňové zásady](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Nahlásit porušení",
      paragraphs: [
        "Máte-li indicie, že je ubytování nabízeno bez požadovaného povolení nebo registrace, nahlaste nám to funkcí hlášení u inzerátu. Každé hlášení prověříme.",
      ],
    },
  ],
};
