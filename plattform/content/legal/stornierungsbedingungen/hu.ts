import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Lemondási feltételek",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "Minden szolgáltató kiválaszt a szálláshelyéhez egy lemondási feltételt. Hogy melyik érvényes, az a hirdetésben és a foglalási visszaigazolásában szerepel. Ez az oldal azokat a feltételeket írja le, amelyeket a szolgáltatók választására bocsátunk.",
  ],
  sections: [
    {
      id: "modelle",
      heading: "1. A lemondási feltételek áttekintése",
      paragraphs: [
        "Mindig a hirdetésben feltüntetett feltétel az irányadó. A határidők az érkezés napjának kezdetére vonatkoznak a szálláshely helyi ideje szerint.",
      ],
      list: [
        "Rugalmas — díjmentes lemondás az érkezés előtt 24 óráig. Ezt követően az első éjszakát számítjuk fel, a többi éjszakát visszatérítjük.",
        "Mérsékelt — díjmentes lemondás az érkezés előtt 5 napig. Ezt követően a szállásdíj 50 %-át számítjuk fel.",
        "Szigorú — díjmentes lemondás az érkezés előtt 14 napig, ha a foglalás legalább 14 nappal az érkezés előtt történt. Ezt követően az érkezés előtti 7. napig 50 %-ot, azt követően a teljes árat számítjuk fel.",
        "Nem visszatéríthető — nincs díjmentes lemondás. Az ár rendszerint alacsonyabb; a visszatérítés hiányára a foglalás előtt külön felhívjuk a figyelmet.",
      ],
    },
    {
      id: "was-erstattet-wird",
      heading: "2. Mi térül vissza minden esetben",
      paragraphs: [
        "A választott feltételtől függetlenül minden lemondásnál visszatérítjük:",
      ],
      list: [
        "az idegenforgalmi adót és más átfutó illetékeket, amennyiben azokat a Platformon keresztül számoltuk el és az éjszakázás nem valósul meg;",
        "a Platformon keresztül beszedett kauciót teljes egészében;",
        "a nem teljesített kiegészítő szolgáltatásokat.",
      ],
    },
    {
      id: "stornierung-durch-anbieter",
      heading: "3. Lemondás a szolgáltató részéről",
      paragraphs: [
        "Ha a szolgáltató mond le, a Platformon keresztül fizetett összeget teljes egészében visszakapja — a választott lemondási feltételtől függetlenül.",
        "Ezen felül támogatjuk hasonló szálláshely keresésében; lásd az [Átfoglalási és visszatérítési szabályzatot](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "widerruf",
      heading: "4. Nincs törvényi elállási jog",
      paragraphs: [
        "Meghatározott időszakra foglalt szállásszolgáltatások esetén a 2011/83/EU irányelv 16. cikkének l) pontja szerint rendszerint nem áll fenn törvényi elállási jog. Az itt leírt lemondási feltételek ezért szerződéses vállalás, nem pedig egy elállási jog átültetése.",
        "A kógens törvényi jogokat, különösen a szálláshely hibái esetén fennálló szavatossági jogokat, ez nem érinti.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Módosítás lemondás helyett",
      paragraphs: [
        "Ha módosítani szeretné az időszakot vagy az utazók számát, a módosítást a foglalásán keresztül nyújtsa be. A szolgáltatónak hozzá kell járulnia; addig az eredeti foglalás érvényben marad.",
        "Ha a módosítás magasabb árat eredményez, a különbözet esedékessé válik. Ha alacsonyabb árat eredményez, visszatérítjük a különbözetet, amennyiben az alkalmazandó lemondási feltétel ezt a megszűnő részre megengedi.",
      ],
    },
    {
      id: "wie",
      heading: "6. Hogyan mondja le",
      paragraphs: [
        "A fiókjában a „Foglalások” alatt mondjon le. A határidő szempontjából az az időpont irányadó, amikor a lemondás hozzánk beérkezik.",
        "Lemondási visszaigazolást kap a visszatérítendő összeggel. A kifizetéshez lásd a [Fizetési feltételeket](https://mybestdays.dk/rechtliches/zahlungsbedingungen#rueckerstattungen).",
      ],
    },
  ],
};
