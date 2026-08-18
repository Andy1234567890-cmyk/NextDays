import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Akadálymentesítési nyilatkozat",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "A myBestDays-nek mindenki számára használhatónak kell lennie. A jelen nyilatkozat leírja a Platform akadálymentességének állapotát, az ismert korlátokat és az akadályok bejelentésének útját.",
    "A termékek és szolgáltatások akadálymentességi követelményeiről szóló (EU) 2019/882 irányelv követelményeire vonatkozik, amely 2025. június 28-a óta alkalmazandó az elektronikus kereskedelmi szolgáltatásokra.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Az akadálymentesség állapota",
      paragraphs: [
        "Az EN 301 549 harmonizált szabványhoz és az annak alapjául szolgáló Web Content Accessibility Guidelines (WCAG) 2.1 irányelvekhez igazodunk, AA megfelelőségi szinten.",
        "Megvalósítottuk többek között: a folyamatos billentyűzetes kezelhetőséget, a látható fókuszt, a szemantikus címstruktúrát, a feliratokat minden űrlapmezőnél, a kezelőelemek szöveges alternatíváit, a megfelelő színkontrasztot, a szöveg tartalomvesztés nélküli méretezhetőségét, valamint a képernyőmérethez igazodó megjelenítést.",
        "A jogi szövegek az Unió mind a 24 hivatalos nyelvén elérhetők, és helyes nyelvi jelöléssel vannak ellátva, hogy a képernyőolvasók helyesen olvassák fel őket.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Ismert korlátok",
      paragraphs: ["Jelenleg különösen a következők nem akadálymentesek:"],
      list: [
        "A hirdetésekben szereplő fényképek és leírások szolgáltatóktól származnak; a fényképek szöveges alternatívái hiányozhatnak vagy elégtelenek lehetnek. Felhívjuk a szolgáltatókat azok pótlására.",
        "A beágyazott harmadik feles térképi megjelenítések csak korlátozottan kezelhetők billentyűzettel. Minden helyadat szövegként is rendelkezésre áll.",
        "A szolgáltatók által feltöltött dokumentumok (például PDF formátumú házirendek) nem következetesen akadálymentesen vannak megjelölve.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. A szálláshelyek akadálymentessége",
      paragraphs: [
        "A jelen nyilatkozat a Platformra vonatkozik, nem a szálláshelyekre. Egy szálláshely építészeti akadálymentességére vonatkozó adatok a szolgáltatótól származnak.",
        "Ha bizonyos jellemzőkre van szüksége — lépcsőmentes megközelítés, ajtószélességek, padlószintű zuhany, lift —, tisztázza azokat a foglalás előtt az üzenetküldő funkción keresztül a szolgáltatóval. Az akadálymentességre vonatkozó valótlan adatok sértik szabályainkat, és bejelenthetők.",
      ],
    },
    {
      id: "melden",
      heading: "4. Akadályok bejelentése",
      paragraphs: [
        `Ha akadályba ütközik, jelentse be nekünk a ${ANBIETER.email} címen vagy a [Panaszok és vitarendezés](https://mybestdays.dk/rechtliches/beschwerden) oldalon található kapcsolattartási utakon.`,
        "Kérjük, írja le, melyik oldal érintett, mit szeretett volna tenni, és milyen segédeszközöket használ. A beérkezést visszaigazoljuk, és közöljük, hogyan és meddig hárítjuk el az akadályt.",
        "Ha egy információra hozzáférhető formában van szüksége, azt kérésre rendelkezésére bocsátjuk.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Végrehajtási eljárás",
      paragraphs: [
        "Ha nem elégedett a válaszunkkal, fordulhat az (EU) 2019/882 irányelv szerinti piacfelügyeletért felelős szervhez.",
        "Erhvervsstyrelsen | Markedsovervågning (korábban Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Dánia",
        "Telefon: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
