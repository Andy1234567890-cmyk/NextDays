import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Tulajdonosi elszámolások",
  description: "Tulajdonosi elszámolások létrehozása.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Tulajdonosi elszámolások",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Tulajdonosi elszámolás létrehozása",
          excerpt: "Így készíthet egy tulajdonosnak áttekinthető elszámolást az adott időszakról.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet",
            },
            {
              type: "p",
              text: "Ha objektumokat kezel tulajdonosok számára, azoknak rendszeresen átlátható áttekintésre van szükségük az objektumaik bevételeiről, a levont jutalékról és a kifizetésről egy adott időszakra vonatkozóan — a tulajdonosi elszámolás automatikusan összesíti ezeket az adatokat.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg a fiókban a Tulajdonosok területet, és válassza ki az érintett tulajdonost.",
                "Válassza ki az elszámolási időszakot, amelyre az elszámolást létre szeretné hozni.",
                "Ellenőrizze, hogy e tulajdonos minden objektuma megfelelően hozzá van-e rendelve, mivel csak a hozzárendelt objektumok kerülnek be az elszámolásba.",
                "Hozza létre az elszámolást, és ellenőrizze a felsorolt foglalások teljességét.",
                "Bocsássa az elszámolást a tulajdonos rendelkezésére a tulajdonosi hozzáférésen keresztül, vagy exportálja dokumentumként.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Az elszámolás minden foglalást a saját objektumdevizájában feltüntetett összeggel mutat — nincs egységes devizajelzés, mivel a különböző objektumok eltérő devizát is használhatnak. Bővebben a hozzárendelésről: [Objektum tulajdonoshoz rendelése](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Jutalék elszámolása a tulajdonossal",
          excerpt: "Így biztosíthatja, hogy a jutaléka helyesen kerüljön kiszámításra a tulajdonos bevételeiből.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet",
            },
            {
              type: "p",
              text: "Az objektum kezeléséért járó jutaléka a tulajdonos csomagjában van rögzítve, és minden elszámolásnál automatikusan levonásra kerül a bruttó bevételből. Ahhoz, hogy az elszámolás helyes legyen, a jutalékkulcsot az időszak első foglalása előtt helyesen kell beállítani.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg a fiókban az érintett tulajdonos csomagját, és ellenőrizze a rögzített jutalékkulcsot.",
                "Szükség esetén módosítsa a kulcsot, mielőtt az új foglalások megérkeznek a következő elszámolási időszakban.",
                "Hozza létre a tulajdonosi elszámolást az időszakra, és ellenőrizze, hogy a jutalék foglalásonként helyesen jelenik-e meg.",
                "Ellenőrizze a bruttó bevétel, a levont jutalék és a nettó kifizetés összegének helyességét.",
                "Az eltéréseket az elszámolás jóváhagyása előtt közvetlenül a tulajdonossal tisztázza, ne utólag módosítsa az elszámolást.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A jutalékkulcs utólagos módosítása csak a jövőbeli időszakokra hat, a már létrehozott elszámolásokra visszamenőlegesen nem. Ezért a kulcsot időben, egy új elszámolási időszak kezdete előtt ellenőrizze — lásd még: [Tulajdonosi elszámolás (Statement)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
