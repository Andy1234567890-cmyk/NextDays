import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Cijene, rangiranje i preporuke",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "Ova stranica objašnjava kako se na myBestDays prikazuju cijene, prema čemu se ravna redoslijed rezultata pretrage i kako nastaju preporuke. Ispunjava obveze transparentnosti iz članka 6.a Direktive 2005/29/EZ, članka 5. Uredbe (EU) 2019/1150 i članka 27. Uredbe (EU) 2022/2065.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Kako se prikazuju cijene",
      paragraphs: [
        "Čim su razdoblje i broj putnika poznati, prikazujemo ukupnu cijenu za cijeli boravak, uključujući poreze i sve naknade obračunate putem Platforme.",
        "Dok razdoblje nije odabrano, prikazujemo cijenu po noćenju kao orijentaciju i tako je označavamo.",
        "Troškove koji nastaju tek na licu mjesta prikazujemo zasebno prije završetka rezervacije. Nisu dio ukupne cijene, ali su vidljivi prije rezervacije.",
        "Ako prikažemo prekriženu usporednu cijenu, to je najniža cijena koju je pružatelj za istu uslugu tražio u posljednjih 30 dana prije sniženja (članak 6.a Direktive 98/6/EZ).",
        "Cijene su za sve goste jednake. Cijenu ne prilagođavamo Vašoj osobi, Vašem uređaju ili Vašem dosadašnjem ponašanju pri pretraživanju.",
      ],
    },
    {
      id: "ranking",
      heading: "2. Prema čemu se ravna redoslijed rezultata pretrage",
      paragraphs: [
        "Kod zadanog razvrstavanja redoslijed određuju sljedeća obilježja, prema opadajućoj važnosti:",
      ],
      list: [
        "podudarnost s Vašom pretragom — raspoloživost u traženom razdoblju, kapacitet za broj putnika, položaj u traženom području i postavljeni filtri;",
        "potpunost i kvaliteta oglasa — opis, fotografije, uređeni podaci o opremi;",
        "recenzije — ukupna ocjena i broj recenzija;",
        "pouzdanost pružatelja — brzina odgovaranja, udio prihvaćenih upita i otkazivanja od strane pružatelja;",
        "aktualnost cijena i raspoloživosti;",
        "odnos cijene i kvalitete u usporedbi sa sličnim oglasima u istom području.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Plaćeno pozicioniranje",
      paragraphs: [
        "Pružatelj si ne može kupiti bolje mjesto u zadanom razvrstavanju. Visina naknade za uslugu ne utječe na redoslijed.",
        "Budemo li ubuduće nudili plaćena pozicioniranja, nedvojbeno ćemo ih označiti kao oglas i vidljivo odvojiti od ostalih rezultata.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Promjena razvrstavanja",
      paragraphs: [
        "Razvrstavanje možete u svakom trenutku promijeniti, primjerice prema cijeni ili recenziji. Koje je razvrstavanje aktivno prikazuje se iznad popisa rezultata.",
        "Na raspolaganju Vam je najmanje jedno razvrstavanje koje se ne temelji na izradi profila u smislu članka 4. točke 4. Uredbe (EU) 2016/679.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Preporuke",
      paragraphs: [
        "Ako Vam prikazujemo prijedloge („moglo bi Vam se svidjeti“, „slični smještaji“), oni se temelje na trenutačnoj pretrazi, na prethodno pregledanim oglasima i na obilježjima sličnih smještaja.",
        "Personalizirane preporuke možete isključiti u svom računu. Nakon toga vidite prijedloge koji se temelje isključivo na trenutačnoj pretrazi.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Recenzije u rangiranju",
      paragraphs: [
        "Kako recenzije nastaju i kako se provjeravaju navedeno je u [Politici recenzija](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). Recenzije utječu na redoslijed, ali pojedine recenzije ne ponderiramo više niti negativne potiskujemo.",
      ],
    },
  ],
};
