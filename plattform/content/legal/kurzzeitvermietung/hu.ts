import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Rövid távú bérbeadás és nyilvántartásba vételi kötelezettségek",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "Sok városban és régióban a lakóingatlanok rövid távú bérbeadása engedély-, nyilvántartásba vételi vagy bejelentési kötelezettség alá esik. Ez az oldal elmagyarázza, mit jelent ez a szolgáltatók és a vendégek számára.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Jogi keret",
      paragraphs: [
        "A rövid távú szálláshely-szolgáltatásokkal kapcsolatos adatgyűjtésről és -megosztásról szóló (EU) 2024/1028 rendelet egységes keretet teremt: ahol egy tagállam vagy területi önkormányzat nyilvántartásba vételi eljárást vezetett be, ott minden egység nyilvántartási számot kap.",
        "A platformoknak meg kell jeleníteniük ezt a számot, szúrópróbaszerűen ellenőrizniük kell annak érvényességét, és rendszeres időközönként adatokat kell továbbítaniuk a tevékenységről az illetékes szerveknek.",
        "Emellett továbbra is érvényesek a nemzeti és helyi előírások — például a lakóingatlan rendeltetésmódosítására, a maximális bérbeadási napok számára, a tűzvédelemre és a vendégek bejelentésére vonatkozóan.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Mit kell tenniük a szolgáltatóknak",
      paragraphs: [
        "A közzététel előtt ellenőrizze, hogy a szálláshelyére vonatkozik-e nyilvántartásba vételi, engedélyezési vagy bejelentési kötelezettség, és teljesítse azt.",
        "Adja meg a nyilvántartási számot az objektumnál, ha van ilyen. Azt a hirdetésben megjelenítjük.",
        "Tartsa be a maximális bérbeadási napok számát és az egyéb helyi korlátokat. Ezek felügyelete az Ön feladata, nem a miénk.",
        "Nem jeleníthetünk meg tartósan olyan hirdetést, amelynél hiányzik a szükséges nyilvántartási szám. Ha hiányzik vagy érvénytelennek bizonyul, utólag bekérjük; ha az adat elmarad, deaktiváljuk a hirdetést.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. Mit jelent ez a vendégek számára",
      paragraphs: [
        "Ha egy szálláshelyre nyilvántartásba vételi kötelezettség vonatkozik, a nyilvántartási számot a hirdetésben látja. Ez arra utal, hogy a bérbeadást bejelentették az illetékes szervnek.",
        "Az úti célban bejelentkezés lehet szükséges (bejelentőlap, személyazonosító adatok, idegenforgalmiadó-nyilatkozat). A szolgáltató bekéri a szükséges adatokat; bocsássa azokat időben rendelkezésre.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Adattovábbítás a hatóságoknak",
      paragraphs: [
        "Amennyiben az (EU) 2024/1028 rendelet vagy a nemzeti jog előírja, továbbítunk az illetékes szerveknek a bérbeadási tevékenységre vonatkozó adatokat — különösen a nyilvántartási számot, az egység címét, a foglalt éjszakák számát és a vendégek számát.",
        "Ez a továbbítás az (EU) 2016/679 rendelet 6. cikke (1) bekezdésének c) pontja szerinti jogi kötelezettség teljesítése érdekében történik. A részleteket az [Adatvédelmi tájékoztató](https://mybestdays.dk/rechtliches/datenschutz) tartalmazza.",
        "Ettől elkülönül a DAC7 szerinti adójogi bejelentési kötelezettség; lásd az [Adózási szabályzatot](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Jogsértések bejelentése",
      paragraphs: [
        "Ha arra utaló jelei vannak, hogy egy szálláshelyet a szükséges engedély vagy nyilvántartásba vétel nélkül kínálnak, jelentse be nekünk a hirdetésnél lévő bejelentő funkción keresztül. Minden bejelentésnek utánajárunk.",
      ],
    },
  ],
};
