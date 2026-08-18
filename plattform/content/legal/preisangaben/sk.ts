import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Ceny, poradie a odporúčania",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "Táto stránka vysvetľuje, ako sa na myBestDays zobrazujú ceny, čím sa riadi poradie výsledkov vyhľadávania a ako vznikajú odporúčania. Plní povinnosti transparentnosti podľa článku 6a smernice 2005/29/ES, článku 5 nariadenia (EÚ) 2019/1150 a článku 27 nariadenia (EÚ) 2022/2065.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Ako sa zobrazujú ceny",
      paragraphs: [
        "Len čo sú známe obdobie a počet cestujúcich, zobrazujeme celkovú cenu za celý pobyt vrátane daní a všetkých poplatkov účtovaných cez Platformu.",
        "Pokiaľ nie je zvolené obdobie, zobrazujeme orientačne cenu za noc a označujeme ju ako takú.",
        "Náklady vznikajúce až na mieste uvádzame pred dokončením rezervácie samostatne. Nie sú súčasťou celkovej ceny, ale sú viditeľné pred rezerváciou.",
        "Ak zobrazujeme prečiarknutú porovnávaciu cenu, je to najnižšia cena, ktorú poskytovateľ za tú istú službu požadoval počas posledných 30 dní pred zľavou (článok 6a smernice 98/6/ES).",
        "Ceny sú pre všetkých hostí rovnaké. Cenu neprispôsobujeme Vašej osobe, Vášmu zariadeniu ani Vášmu doterajšiemu správaniu pri vyhľadávaní.",
      ],
    },
    {
      id: "ranking",
      heading: "2. Čím sa riadi poradie výsledkov vyhľadávania",
      paragraphs: [
        "V predvolenom zoradení určujú poradie tieto znaky, v zostupnom význame:",
      ],
      list: [
        "zhoda s Vaším vyhľadávaním — dostupnosť v hľadanom období, kapacita pre počet cestujúcich, poloha v hľadanej oblasti a nastavené filtre;",
        "úplnosť a kvalita inzerátu — opis, fotografie, udržiavané údaje o vybavení;",
        "hodnotenia — celkové hodnotenie a počet hodnotení;",
        "spoľahlivosť poskytovateľa — správanie pri odpovedaní, miera akceptácie a zrušenia zo strany poskytovateľa;",
        "aktuálnosť cien a dostupnosti;",
        "pomer ceny a výkonu v porovnaní s podobnými inzerátmi v tej istej oblasti.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Platené umiestnenie",
      paragraphs: [
        "Poskytovateľ si nemôže kúpiť lepšie miesto v predvolenom zoradení. Výška servisného poplatku poradie neovplyvňuje.",
        "Ak by sme v budúcnosti ponúkali platené umiestnenia, jednoznačne ich označíme ako reklamu a viditeľne oddelíme od ostatných výsledkov.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Zmena zoradenia",
      paragraphs: [
        "Zoradenie môžete kedykoľvek zmeniť, napríklad podľa ceny alebo hodnotenia. Ktoré zoradenie je aktívne, sa zobrazuje nad zoznamom výsledkov.",
        "K dispozícii máte aspoň jedno zoradenie, ktoré nie je založené na profilovaní v zmysle článku 4 bodu 4 nariadenia (EÚ) 2016/679.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Odporúčania",
      paragraphs: [
        "Ak Vám zobrazujeme návrhy („mohlo by sa Vám páčiť“, „podobné ubytovania“), vychádzajú z aktuálneho vyhľadávania, z predtým prezeraných inzerátov a zo znakov podobných ubytovaní.",
        "Personalizované odporúčania si môžete vo svojom účte vypnúť. Potom uvidíte návrhy založené výlučne na aktuálnom vyhľadávaní.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Hodnotenia v poradí",
      paragraphs: [
        "Ako hodnotenia vznikajú a ako sa overujú, uvádzajú [Zásady hodnotení](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). Hodnotenia vstupujú do poradia, ale jednotlivé hodnotenia neváhujeme vyššie ani negatívne nepotláčame.",
      ],
    },
  ],
};
