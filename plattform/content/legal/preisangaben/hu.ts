import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Árak, rangsorolás és ajánlások",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "Ez az oldal elmagyarázza, hogyan jelennek meg az árak a myBestDays-en, mitől függ a találatok sorrendje, és hogyan jönnek létre az ajánlások. Teljesíti a 2005/29/EK irányelv 6a. cikkéből, az (EU) 2019/1150 rendelet 5. cikkéből és az (EU) 2022/2065 rendelet 27. cikkéből eredő átláthatósági kötelezettségeket.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Hogyan jelennek meg az árak",
      paragraphs: [
        "Amint az időszak és az utazók száma rögzült, a teljes tartózkodásra vonatkozó teljes árat jelenítjük meg, az adókkal és a Platformon keresztül elszámolt valamennyi díjjal együtt.",
        "Amíg nincs kiválasztva időszak, tájékoztatásul éjszakánkénti árat mutatunk, és ekként jelöljük meg.",
        "A csak a helyszínen felmerülő költségeket a foglalás lezárása előtt külön tüntetjük fel. Ezek nem részei a teljes árnak, de a foglalás előtt láthatók.",
        "Ha áthúzott összehasonlító árat jelenítünk meg, az az a legalacsonyabb ár, amelyet a szolgáltató ugyanazért a szolgáltatásért az árcsökkentést megelőző 30 napban kért (a 98/6/EK irányelv 6a. cikke).",
        "Az árak minden vendég számára azonosak. Nem igazítjuk az árat az Ön személyéhez, készülékéhez vagy korábbi keresési viselkedéséhez.",
      ],
    },
    {
      id: "ranking",
      heading: "2. Mitől függ a találatok sorrendje",
      paragraphs: [
        "Az alapértelmezett rendezésben a következő jellemzők határozzák meg a sorrendet, csökkenő jelentőség szerint:",
      ],
      list: [
        "a keresésével való egyezés — elérhetőség a keresett időszakban, kapacitás az utazók számához, fekvés a keresett területen és a beállított szűrők;",
        "a hirdetés teljessége és minősége — leírás, fényképek, gondozott felszereltségi adatok;",
        "értékelések — összesített osztályzat és az értékelések száma;",
        "a szolgáltató megbízhatósága — válaszadási magatartás, elfogadási arány és a szolgáltató általi lemondások;",
        "az árak és elérhetőségek naprakészsége;",
        "ár-érték arány az ugyanazon területen lévő hasonló hirdetésekhez képest.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Fizetett elhelyezés",
      paragraphs: [
        "Egy szolgáltató nem vásárolhat magának jobb helyet az alapértelmezett rendezésben. A szolgáltatási díj mértéke nem befolyásolja a sorrendet.",
        "Ha a jövőben fizetett elhelyezéseket kínálunk, azokat félreérthetetlenül hirdetésként jelöljük meg, és láthatóan elkülönítjük a többi találattól.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. A rendezés módosítása",
      paragraphs: [
        "A rendezést bármikor módosíthatja, például ár vagy értékelés szerint. Hogy melyik rendezés aktív, azt a találati lista fölött jelenítjük meg.",
        "Rendelkezésére áll legalább egy olyan rendezés, amely nem az (EU) 2016/679 rendelet 4. cikkének 4. pontja értelmében vett profilalkotáson alapul.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Ajánlások",
      paragraphs: [
        "Ha javaslatokat jelenítünk meg Önnek („tetszhet Önnek”, „hasonló szálláshelyek”), azok az aktuális keresésen, a korábban megtekintett hirdetéseken és hasonló szálláshelyek jellemzőin alapulnak.",
        "A személyre szabott ajánlásokat kikapcsolhatja a fiókjában. Ezt követően kizárólag az aktuális keresésen alapuló javaslatokat lát.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Az értékelések a rangsorolásban",
      paragraphs: [
        "Hogy hogyan jönnek létre és hogyan ellenőrizzük az értékeléseket, azt az [Értékelési szabályzat](https://mybestdays.dk/rechtliches/bewertungsrichtlinien) tartalmazza. Az értékelések befolyásolják a sorrendet, de egyes értékeléseket sem súlyozunk magasabban, sem a negatívakat nem nyomjuk el.",
      ],
    },
  ],
};
