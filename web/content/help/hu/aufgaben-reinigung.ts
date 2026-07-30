import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Feladatok és takarítás",
  description: "Takarítási tervek és csapatfeladatok szervezése.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Üzemeltetés",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Feladatok létrehozása",
          excerpt: "Így hoz létre új feladatot egy objektumhoz vagy időszakhoz.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A feladatok mindent összefognak, amit egy objektum körül el kell végezni — a check-out utáni takarítástól a karbantartási munkákon át a vendégkérésekig. Minden feladat pontosan egy objektumhoz kapcsolódik, és hozzárendelhető egy csapattaghoz.",
            },
            { type: "h2", text: "Új feladat létrehozása" },
            {
              type: "steps",
              items: [
                "Nyissa meg a „Feladatok” területet a főmenüben.",
                "Kattintson az „Új feladat” gombra.",
                "Válassza ki az érintett objektumot.",
                "Adjon meg egy címet, és opcionálisan egy leírást.",
                "Állítsa be a határidő dátumát és idejét.",
                "Mentse el a feladatot.",
              ],
            },
            { type: "h2", text: "Feladattípusok" },
            {
              type: "p",
              text: "A szabadon rögzített feladatok mellett léteznek rendszer által generált feladatok is, például egy check-out után automatikusan ütemezett takarítások. Ezek már össze vannak kapcsolva az objektummal és a megfelelő időablakkal, csak egy csapattaghoz kell hozzárendelni őket.",
            },
            {
              type: "ul",
              items: [
                "Manuális feladat: szabadon rögzített, pl. karbantartás vagy különleges kérés.",
                "Automatikus takarítási feladat: a check-out dátumból levezetve.",
                "Ismétlődő feladat: rendszeres ellenőrzésekhez vagy vizsgálatokhoz.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Az automatikus időbeosztásról bővebben: [Takarítási tervek](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Adjon pontos címeket — a csapattagok a mobil nézetben gyakran csak a címet és az objektumot látják első pillantásra.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Takarítási tervek",
          excerpt: "A check-out utáni takarítások automatikus tervezése.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Egy takarítási terv gondoskodik arról, hogy minden check-out után automatikusan létrejöjjön egy takarítási feladat az érintett objektumhoz — anélkül, hogy minden foglalást egyenként kellene nyomon követnie. Ez csökkenti az elfelejtett átadásokat, és megbízható folyamatot biztosít két tartózkodás között.",
            },
            { type: "h2", text: "Automatikus tervezés aktiválása" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot, és váltson a „Takarítás” fülre.",
                "Aktiválja a „Takarítás automatikus tervezése check-out után” opciót.",
                "Állítsa be, mennyi idő legyen betervezve a takarításra a check-out után.",
                "Opcionálisan határozzon meg egy alapértelmezett csapatot vagy alapértelmezett takarítót.",
                "Mentse el a beállítást.",
              ],
            },
            { type: "h2", text: "Összjáték a naptárral" },
            {
              type: "p",
              text: "Amint egy foglalást lemondanak vagy áthelyeznek, a hozzá tartozó takarítási feladat automatikusan igazodik az új check-out dátumhoz. Így a takarítási terv mindig szinkronban marad a tényleges kihasználtsági állapottal.",
            },
            {
              type: "ul",
              items: [
                "A takarítás automatikusan létrejön minden check-outnál, ha aktív a terv.",
                "Ha a foglalás eltolódik, a takarítási feladat is vele együtt eltolódik.",
                "Ha a vendég lemondja a tartózkodást, a takarítási feladat törlésre kerül.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Aktivált takarítási terv nélkül nem jönnek létre automatikus feladatok — ekkor a takarításokat kézzel hozza létre a [Feladatok létrehozása](/hilfe/aufgaben-reinigung/aufgaben-anlegen) alatt.",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Feladatok hozzárendelése",
          excerpt: "Feladatok célzott kiosztása takarítóknak vagy csapattagoknak.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Ahhoz, hogy egy feladat elvégzésre kerüljön, rendelje hozzá egy konkrét csapattaghoz — például egy takarítóhoz vagy egy karbantartásért felelős munkatárshoz. Alapértelmezés szerint csak a hozzárendelt személy látja a feladatot saját áttekintésében.",
            },
            { type: "h2", text: "Feladat kézi hozzárendelése" },
            {
              type: "steps",
              items: [
                "Nyissa meg a feladatot a „Feladatok” listában.",
                "Kattintson a „Hozzárendelés” gombra.",
                "Válassza ki a felelős csapattagot a listából.",
                "Erősítse meg a hozzárendelést.",
              ],
            },
            { type: "h2", text: "Hozzárendelés objektum szerint" },
            {
              type: "p",
              text: "Ha egy takarítóhoz már fixen hozzá van rendelve egy objektum, az adott objektumhoz tartozó feladatokat automatikusan is hozzárendeltetheti ehhez a személyhez. Ez ismétlődő takarításoknál kattintásokat spórol, és csökkenti a visszakérdezéseket.",
            },
            {
              type: "ul",
              items: [
                "Kézi hozzárendelés: Ön maga választja ki a személyt feladatonként.",
                "Fix objektumhozzárendelés: az ehhez az objektumhoz tartozó új feladatok automatikusan a rögzített személyhez kerülnek.",
                "Egy feladatnak mindig pontosan egy felelőse van.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A takarítók és munkatársak kizárólag saját, hozzájuk rendelt feladataikat látják, az objektum pénzügyi vagy értékesítési adatait nem.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Feladatállapot nyomon követése",
          excerpt: "A feladatok feldolgozási állapotának valós idejű áttekintése.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Minden feladat egy egyértelmű állapoton megy keresztül — nyitottól a folyamatban lévőn át a befejezettig. Így bármikor láthatja, hogy egy takarítás vagy karbantartás időben elkészül-e a következő check-in előtt.",
            },
            { type: "h2", text: "Állapotáttekintés" },
            {
              type: "ul",
              items: [
                "Nyitott: a feladat létre lett hozva, de még nem kezdődött el.",
                "Folyamatban: a hozzárendelt személy elkezdte a feladatot.",
                "Befejezett: a feladat elkészült és megerősítve.",
              ],
            },
            { type: "h2", text: "Állapot frissítése" },
            {
              type: "steps",
              items: [
                "Nyissa meg a feladatot a „Feladatok” listából.",
                "Válassza ki a megfelelő állapotot, pl. „Folyamatban” vagy „Befejezett”.",
                "Szükség esetén egészítse ki egy rövid megjegyzéssel, például az objektumban tapasztalt rendellenességekről.",
                "Mentse el a módosítást.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Az állapotváltozások azonnal megjelennek a megosztott feladatlistában — kézi újratöltésre nincs szükség.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ha egy takarítás röviddel a következő check-in előtt még nyitott, először ellenőrizze a hozzárendelést, mielőtt a vendéget megkeresné.",
            },
          ],
        },
      ],
    },
  ],
};
