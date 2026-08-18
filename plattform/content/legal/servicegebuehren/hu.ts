import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Szolgáltatási díjak",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "A myBestDays a közvetített foglalásokra felszámított szolgáltatási díjból finanszírozza magát. Ez az oldal elmagyarázza, ki fizeti, hogyan számítjuk ki, és hol tüntetjük fel.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Ki fizeti a szolgáltatási díjat",
      paragraphs: [
        "A szolgáltatási díjat a szolgáltató viseli. Azt a foglalási értékből visszatartjuk, és csökkenti a neki történő kifizetést; a vendég nem fizeti meg külön.",
        "Ha kivételesen egy foglalásnál a vendégre is esik szolgáltatási díj, azt a foglalás lezárása előtt külön tételként feltüntetjük a teljes árban. Ilyen feltüntetés nélkül a vendégre nem esik díj.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Hogyan számítjuk ki",
      paragraphs: [
        "A szolgáltatási díj a Platformon keresztül elszámolt foglalási érték százaléka. A foglalásaira vonatkozó mérték a házigazdafiókjában és a regisztrációkor elfogadott megállapodásban található.",
        "A számítási alap a szállásdíj és a Platformon keresztül elszámolt felárak. Nem számítanak bele az átfutó tételek, amelyek nem a szolgáltató ellenszolgáltatásai — különösen az idegenforgalmi adó és a kaució.",
        "A szolgáltatási díjat a hirdetés pénznemében számítjuk ki és tüntetjük fel.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. Általános forgalmi adó",
      paragraphs: [
        "A szolgáltatási díjra áfa esik, amennyiben azt jogszabály előírja. Hogy azt felszámítjuk, vagy fordított adózás alkalmazandó, az a szolgáltató székhelyétől és jogállásától függ.",
        "A szolgáltatási díjról a szolgáltatónak elszámolást állítunk ki, amely a fiókjában elérhető.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Lemondás és visszatérítés",
      paragraphs: [
        "Ha egy foglalást teljes egészében visszatérítenek, a szolgáltatási díjat arányosan térítjük vissza olyan mértékben, amilyen mértékben a foglalási értéket visszatérítik.",
        "Ha a szolgáltató fontos ok nélkül mond le, a szolgáltatási díj nem szűnik meg automatikusan; fenntartjuk a jogot a lemondásból eredő költségek érvényesítésére.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. A szolgáltatási díj módosítása",
      paragraphs: [
        "A mérték módosítását a szolgáltatóknak a hatálybalépés előtt legalább 30 nappal tartós adathordozón bejelentjük; ez az (EU) 2019/1150 rendelet 3. cikke (2) bekezdésének felel meg.",
        "A már visszaigazolt foglalásokra a foglalás időpontjában hatályos mérték irányadó.",
      ],
    },
  ],
};
