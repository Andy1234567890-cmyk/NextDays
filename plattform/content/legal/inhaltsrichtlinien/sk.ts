import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Pravidlá pre vhodný obsah",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "Tieto pravidlá sa vzťahujú na všetok obsah, ktorý používatelia vkladajú na myBestDays: inzeráty, fotografie, hodnotenia, správy, údaje profilu a odpovede na hodnotenia.",
    "Sú súčasťou [Podmienok používania](https://mybestdays.dk/rechtliches/nutzungsbedingungen). Porušenie môže viesť k odstráneniu obsahu a k opatreniam voči účtu.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Čo nie je dovolené",
      paragraphs: ["Na myBestDays je neprípustný najmä nasledujúci obsah:"],
      list: [
        "protiprávny obsah akéhokoľvek druhu, najmä výzvy na trestné činy, teroristický obsah a zobrazenia sexuálneho zneužívania detí;",
        "obsah podnecujúci nenávisť alebo násilie voči osobám alebo skupinám z dôvodu pôvodu, farby pleti, náboženstva, presvedčenia, pohlavia, rodovej identity, sexuálnej orientácie, zdravotného postihnutia alebo veku;",
        "urážky, vyhrážky, obťažovanie a cielené zosmiešňovanie jednotlivých osôb;",
        "osobné údaje tretích osôb bez ich súhlasu, najmä mená, adresy, telefónne čísla, údaje z dokladov totožnosti alebo platobné údaje;",
        "zavádzajúce údaje o ubytovaní, jeho polohe, vybavení, veľkosti alebo dostupnosti;",
        "cudzie fotografie, texty alebo ochranné známky bez potrebných práv;",
        "reklama, spam a obsah vedúci na iné rezervačné cesty mimo Platformy;",
        "škodlivý softvér, pokusy o phishing a odkazy na takýto obsah;",
        "inzeráty na niečo iné než ubytovaciu službu.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Fotografie",
      paragraphs: [
        "Fotografie musia zobrazovať skutočne ponúkané ubytovanie a byť zhotovené v stave zodpovedajúcom súčasnému.",
        "Fotografie nesmú zobrazovať rozpoznateľné osoby bez ich súhlasu. Úpravy sú prípustné, pokiaľ neskresľujú dojem z ubytovania — zosvetlenie áno, vyretušovaná susedná stavba nie.",
        "Kamerové sledovanie v ubytovaní treba zverejniť v inzeráte. Vo vnútorných priestoroch, kde majú hostia oprávnené očakávanie súkromia — spálne, kúpeľne —, sú kamery neprípustné, aj vypnuté.",
      ],
    },
    {
      id: "melden",
      heading: "3. Nahlasovanie obsahu",
      paragraphs: [
        "Ak považujete obsah za protiprávny alebo za porušenie týchto pravidiel, môžete ho nahlásiť cez funkciu nahlásenia pri každom inzeráte, hodnotení a správe.",
        "Postup nahlasovania podľa článku 16 nariadenia (EÚ) 2022/2065 a vybavovanie hlásení sú opísané v časti [Akt o digitálnych službách](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Ako pravidlá presadzujeme",
      paragraphs: [
        "Každý nahlásený obsah preskúmame a zvolíme najmiernejšie vhodné opatrenie: upozornenie, odstránenie dotknutej časti, odstránenie celého obsahu, obmedzenie viditeľnosti, zablokovanie funkcie alebo zablokovanie účtu.",
        "Opakované alebo závažné porušenia vážia viac. Pri zjavne protiprávnom obsahu alebo ohrození osôb konáme okamžite.",
        "Každé opatrenie odôvodníme dotknutej osobe a poučíme o ceste sťažnosti. Sťažnosť spracúvajú ľudia.",
      ],
    },
  ],
};
