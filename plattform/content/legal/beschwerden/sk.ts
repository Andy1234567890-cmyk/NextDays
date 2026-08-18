import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Sťažnosti a riešenie sporov",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "Táto stránka opisuje, ako myBestDays kontaktovať, ako vybavujeme sťažnosti a aké cesty máte, ak s naším rozhodnutím nesúhlasíte.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Ako nás kontaktovať",
      paragraphs: [
        "Najrýchlejšie nás zastihnete cez centrum pomoci a tam uvedené kontaktné cesty. K existujúcej rezervácii použite funkciu správ vo svojom účte — potom máme rezerváciu aj históriu už k dispozícii.",
        `Písomne nás zastihnete na ${ANBIETER.email} alebo ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dánsko; telefonicky na ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Čo má sťažnosť obsahovať",
      paragraphs: ["Aby sme mohli rýchlo pomôcť, uveďte prosím:"],
      list: [
        "číslo rezervácie a e-mailovú adresu použitú pri rezervácii;",
        "stručný opis problému;",
        "aké riešenie si želáte;",
        "súvisiace doklady — fotografie, správy, potvrdenky, výpisy z účtu.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Ako sťažnosti vybavujeme",
      paragraphs: [
        "Každá sťažnosť sa zaeviduje a dostane číslo spisu, pod ktorým môžete sledovať jej stav.",
        "Prijatie bezodkladne potvrdíme a vecne odpovieme spravidla do siedmich dní. Ak je potrebné dlhšie preskúmanie, oznámime Vám priebežný stav.",
        "Sťažnosti, pri ktorých sú ohrozené osoby alebo bezprostredne nastáva príchod, vybavujeme prednostne.",
        "Naše rozhodnutie odôvodníme a uvedieme, na čom sa zakladá.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Sťažnosť proti nášmu opatreniu",
      paragraphs: [
        "Ak sme odstránili obsah, obmedzili jeho viditeľnosť, zrušili rezerváciu alebo zablokovali účet, môžete proti tomu do šiestich mesiacov bezplatne podať sťažnosť. Zodpovedá to článku 20 nariadenia (EÚ) 2022/2065.",
        "Sťažnosť posudzujú ľudia, nie výlučne automatizované postupy. Ak sa ukáže ako dôvodná, opatrenie zrušíme.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Mimosúdne riešenie sporov",
      paragraphs: [
        "Platforma Európskej komisie na riešenie sporov online bola zrušená nariadením (EÚ) 2024/3228 a ukončila činnosť. Sťažnosti cez ňu už podávať nemožno.",
        "Nie sme povinní ani ochotní zúčastniť sa na konaní o riešení sporov pred subjektom alternatívneho riešenia spotrebiteľských sporov.",
        `Nezávisle od toho sa ako spotrebiteľ môžete obrátiť na príslušný dánsky subjekt: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Dánsko ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Ak bývate v inom členskom štáte, pomôže Vám Európske spotrebiteľské centrum vo Vašej krajine.`,
        "Ak sa spor týka opatrenia, ktoré sme prijali voči Vášmu obsahu alebo účtu, môžete sa navyše obrátiť na orgán mimosúdneho riešenia sporov certifikovaný podľa článku 21 nariadenia (EÚ) 2022/2065. Jeho rozhodnutia pre nás nie sú záväzné a na účasť v takýchto konaniach nie sme povinní.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Súdna cesta",
      paragraphs: [
        "Cesta k súdom je Vám kedykoľvek otvorená, aj bez predchádzajúceho konania o sťažnosti. Ktoré súdy sú príslušné, uvádza oddiel A19 [Podmienok používania](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Sťažnosti poskytovateľov",
      paragraphs: [
        "Poskytovatelia môžu rovnakým postupom podávať sťažnosti na uplatňovanie týchto podmienok, na rozhodnutia o poradí a na obmedzenia svojej ponuky. Zodpovedá to článku 11 nariadenia (EÚ) 2019/1150.",
        "O počte, predmete a priemernej dobe vybavenia takýchto sťažností podávame každoročne správu; správa je dostupná v časti [Akt o digitálnych službách](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
