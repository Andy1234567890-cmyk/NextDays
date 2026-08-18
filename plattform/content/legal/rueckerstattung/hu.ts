import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Átfoglalási és visszatérítési szabályzat",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "A jelen szabályzat akkor alkalmazandó, ha egy myBestDays-en keresztül foglalt szálláshelynél valami alapvetően nincs rendben — így ez az a vállalás, amely túlmegy a szolgáltató lemondási feltételén.",
    "A Platformon keresztül megkötött és kifizetett foglalásokra vonatkozik.",
  ],
  sections: [
    {
      id: "wann",
      heading: "1. Mikor alkalmazandó a jelen szabályzat",
      paragraphs: [
        "Akkor alkalmazandó, ha a tartózkodás előtt vagy alatt a következő események valamelyike bekövetkezik:",
      ],
      list: [
        "A szolgáltató lemondja a foglalást.",
        "A szolgáltató érkezéskor nem elérhető, vagy Ön nem kap bejutást a szálláshelyre.",
        "A szálláshely lakhatatlan — például hideg időben hiányzó fűtés, hiányzó folyóvíz, elégtelen tisztaság vagy egészségi veszély miatt.",
        "A szálláshely lényegesen eltér a hirdetéstől — más számú fekvőhely vagy helyiség, más helyszín, a hirdetésben ígért és ténylegesen hiányzó központi felszereltség.",
        "A szálláshelyen egy előre be nem jelentett további vendég tartózkodik.",
      ],
    },
    {
      id: "was-sie-tun",
      heading: "2. Amit Önnek tennie kell",
      paragraphs: [
        "A problémát a lehető legkorábban, de legkésőbb az észleléstől számított 24 órán belül jelentse be — érkezéskori problémáknál tehát az érkezés napján.",
        "Először a szolgáltatónak jelentse be az üzenetküldő funkción keresztül, és adjon neki lehetőséget az elhárításra. Az Ön egészségét fenyegető veszély esetén, vagy ha a szolgáltató nem elérhető, ez a kötelezettség nem áll fenn.",
        "A problémát lehetőség szerint fényképekkel, videókkal vagy üzenetekkel igazolja. Bizonyítékok nélkül gyakran nem tudjuk megállapítani a tényállást.",
      ],
    },
    {
      id: "was-wir-tun",
      heading: "3. Amit mi teszünk",
      paragraphs: [
        "Ha a probléma beigazolódik, választhat egy hasonló pótszálláshely és a visszatérítés között.",
        "Ha pótszálláshelyet választ, átvállaljuk az eredeti foglalásához képesti többletköltséget, amennyiben a pótszálláshely fekvés, felszereltség és méret tekintetében hasonló.",
        "Ha a visszatérítést választja, az érkezés előtt felmerülő probléma esetén a Platformon keresztül fizetett teljes összeget visszatérítjük. Ha a probléma a tartózkodás alatt merül fel, visszatérítjük a nem használható éjszakákra eső részt, valamint a már eltöltött éjszakák zavarásáért járó méltányos összeget.",
        "Döntésünkről indokolással tájékoztatjuk Önt. Azt a [Panaszok és vitarendezés](https://mybestdays.dk/rechtliches/beschwerden) oldalon leírt úton felülvizsgáltathatja.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "4. Mire nem terjed ki",
      paragraphs: ["A jelen szabályzat nem alkalmazandó:"],
      list: [
        "olyan körülményekre, amelyek a hirdetésben le voltak írva vagy a fényképeken felismerhetők voltak;",
        "csekély eltérésekre, amelyek nem befolyásolják a használatot (például más falszín vagy más kanapé);",
        "átmeneti zavarokra, amelyeket a szolgáltató ésszerű határidőn belül elhárít;",
        "a szálláshelyen kívüli körülményekre, amelyekre a szolgáltatónak nincs befolyása — időjárás, forgalom, önkormányzati építkezések, látványosságok bezárása (ezekre a [Súlyos zavarokra vonatkozó szabályzat](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen) alkalmazandó);",
        "az Ön vagy útitársai által okozott problémákra;",
        "a Platformon kívül megkötött vagy kifizetett foglalásokra.",
      ],
    },
    {
      id: "verhaeltnis",
      heading: "5. Viszony az Ön törvényes jogaihoz",
      paragraphs: [
        "A jelen szabályzat a myBestDays önkéntes vállalása. A szolgáltatóval szembeni törvényes igényeit — különösen az árcsökkentést és a kártérítést — ez nem érinti, és azok tovább is terjedhetnek.",
        "Amennyiben visszatérítünk Önnek, a szolgáltatóval szembeni megfelelő igények ránk szállnak át.",
      ],
    },
  ],
};
