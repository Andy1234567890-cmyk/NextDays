import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika kolačića",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "Ova politika objašnjava koje kolačiće i slične tehnologije myBestDays koristi, u koju svrhu, koliko dugo ostaju pohranjeni i kako njima upravljate.",
    "Dopunjuje [Politiku privatnosti](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Što su kolačići",
      paragraphs: [
        "Kolačići su male tekstualne datoteke koje internetska stranica pohranjuje u Vašem pregledniku. Slične tehnologije su lokalna pohrana preglednika i piksele za praćenje u e-porukama.",
        "Kolačiće koji su nužno potrebni za rad Platforme smijemo postaviti bez Vaše privole. Za sve ostale pribavljamo Vašu privolu (članak 5. stavak 3. Direktive 2002/58/EZ).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Nužni kolačići",
      paragraphs: [
        "Ovi su kolačići potrebni za rad i ne mogu se isključiti. Trenutačno koristimo:",
      ],
      list: [
        "„nd_access“ — održava Vašu prijavu. Čitljiv samo za poslužitelj (HttpOnly), trajanje odgovara valjanosti sjednice.",
        "„nd_refresh“ — obnavlja Vašu prijavu kako se ne biste morali stalno iznova prijavljivati. Čitljiv samo za poslužitelj, trajanje 30 dana.",
        "„nd_gast_locale“ — pamti Vaš odabrani jezik. Trajanje jedna godina.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Funkcionalni, statistički i marketinški kolačići",
      paragraphs: [
        "myBestDays trenutačno ne koristi kolačiće za statistiku, mjerenje dosega ili oglašavanje i ne ugrađuje oglasne mreže ni analitičke usluge.",
        "Promijeni li se to, prethodno ćemo pribaviti Vašu privolu putem dijaloga za odabir u kojem je odbijanje jednako jednostavno kao i pristanak te ćemo ovu politiku dopuniti konkretnim kolačićima.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Ugrađeni sadržaj trećih strana",
      paragraphs: [
        "Na stranicama s pojedinostima mogu biti ugrađene karte. Takav sadržaj učitavamo tek kada ga izričito aktivirate; tek se tada podaci mogu prenijeti dotičnom pružatelju.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Kako upravljate kolačićima",
      paragraphs: [
        "Svoju privolu možete u svakom trenutku izmijeniti ili opozvati putem postavki kolačića u podnožju.",
        "Osim toga kolačiće možete izbrisati ili blokirati u svom pregledniku. Izbrišete li nužne kolačiće, bit ćete odjavljeni, a Platforma će raditi ograničeno.",
      ],
    },
  ],
};
