import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Tulajdonosok és elszámolások",
  description: "Tulajdonosi fiókok, elszámolások és jutalékok.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Tulajdonosok",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Tulajdonos létrehozása",
          excerpt: "Így hoz létre új tulajdonosi fiókot a myNextDaysben.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A tulajdonosok önálló fiókok a myNextDaysben, amelyeken keresztül egy adott személyhez vagy társasághoz tartozó objektumokat kezel. Egy tulajdonosi fiók korlátozott, csak olvasható betekintést kap saját objektumaiba, anélkül hogy maga módosítást tehetne a vállalkozáson.",
            },
            { type: "h2", text: "Új tulajdonosi fiók létrehozása" },
            {
              type: "steps",
              items: [
                "Nyissa meg a „Tulajdonosok” területet a főmenüben.",
                "Kattintson az „Új tulajdonos létrehozása” gombra.",
                "Adja meg a nevet, az e-mail-címet és az elérhetőségi adatokat.",
                "Szükség esetén rögzítse a számlázási címet az elszámolásokhoz.",
                "Mentse el a fiókot.",
              ],
            },
            { type: "h2", text: "Hozzáférés beállítása" },
            {
              type: "p",
              text: "A létrehozás után meghívót küldhet a tulajdonosnak saját hozzáféréshez. A tulajdonos ezután saját hozzáférési adataival jelentkezik be, és kizárólag a hozzá rendelt objektumokat látja.",
            },
            {
              type: "ul",
              items: [
                "Egy tulajdonosi fiók több objektumot is magába foglalhat.",
                "Minden objektum pontosan egy tulajdonoshoz tartozik.",
                "Az elérhetőségi adatok és a számlázási cím bármikor utólag módosíthatók.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Hogyan rendelhet hozzá egy meglévő objektumot egy tulajdonoshoz, arról bővebben: [Objektum tulajdonoshoz rendelése](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Objektum tulajdonoshoz rendelése",
          excerpt: "Minden objektum pontosan egy tulajdonoshoz tartozik — így állítja be a hozzárendelést.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A myNextDaysben minden objektum pontosan egy tulajdonoshoz tartozik. Többszörös hozzárendelés nincs — ha egy objektumnak másik tulajdonoshoz kell tartoznia, először oldja fel a meglévő hozzárendelést, mielőtt újat állítana be.",
            },
            { type: "h2", text: "Hozzárendelés elvégzése" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot az „Objektumok” alatt.",
                "Váltson a „Tulajdonos” fülre.",
                "Válassza ki a felelős tulajdonost a listából.",
                "Erősítse meg a hozzárendelést.",
                "Mentse el a módosítást az objektumon.",
              ],
            },
            { type: "h2", text: "Tulajdonosváltás" },
            {
              type: "p",
              text: "Ha egy objektum tulajdonosa megváltozik, például eladás miatt, cserélje le a meglévő hozzárendelést az újra. A korábbi időszakokra már elkészített elszámolások ezalatt az eredeti tulajdonoshoz maradnak rendelve.",
            },
            {
              type: "ul",
              items: [
                "Egy objektum egy adott időpontban csak egy tulajdonoshoz rendelhető.",
                "Hozzárendelés nélkül az objektum semmilyen tulajdonosi hozzáférésben nem jelenik meg.",
                "A korábbi elszámolások az eredeti tulajdonosnál maradnak.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Egy objektum több tulajdonoshoz való egyidejű hozzárendelése kizárt — a rendszer nem engedélyez második, egyidejű hozzárendelést.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Tulajdonosi elszámolás (Statement)",
          excerpt: "Így hoz létre egy elszámolást a jutalékkal csökkentett bevételről egy tulajdonos számára.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A tulajdonosi elszámolás, más néven statement, egy kiválasztott időszakra összesíti a hozzárendelt objektumok összes bevételét, és levonja belőle a megállapodott jutalékát. Az eredmény az az összeg, amelyet a tulajdonosnak kifizet.",
            },
            { type: "h2", text: "Statement létrehozása" },
            {
              type: "steps",
              items: [
                "Nyissa meg a „Tulajdonosok” területet, és válassza ki a kívánt tulajdonost.",
                "Váltson az „Elszámolás” fülre.",
                "Válassza ki az elszámolási időszakot.",
                "Ellenőrizze az objektumonként felsorolt foglalásokat és bevételeket.",
                "Hozza létre a statementet a levont jutalékkal.",
              ],
            },
            { type: "h2", text: "A statement felépítése" },
            {
              type: "p",
              text: "Egy statement objektumonként felsorolja a foglalásokból származó bruttó bevételt, az abból levont jutalékot és az ebből adódó kifizetési összeget. A megállapodástól függően a kiegészítő költségek, mint a takarítás vagy díjak, külön is feltüntethetők.",
            },
            {
              type: "ul",
              items: [
                "Bruttó bevétel: az időszak összes foglalásának összege objektumonként.",
                "Jutalék: a megállapodott részesedése, amely a bevételből levonásra kerül.",
                "Kifizetési összeg: bevétel mínusz jutalék, illetve további tételek.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A statementben szereplő összegek mindig az objektum devizájában kerülnek feltüntetésre — nincs egységes deviza-tartalék érték.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Hozzon létre elszámolásokat rendszeresen, ugyanazon a fordulónapon, hogy a tulajdonosoknak megbízható ritmusa legyen a kifizetéseikhez.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Tulajdonosi hozzáférés",
          excerpt: "Mit láthatnak a tulajdonosok a csak olvasható hozzáférésükben.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A tulajdonosi hozzáférés önálló, csak olvasható bejelentkezés a myNextDayshez. A tulajdonosok ebben kizárólag a hozzájuk rendelt objektumokat, valamint a hozzájuk tartozó kihasználtságot és elszámolásokat látják — a beállításokat maguk nem módosíthatják.",
            },
            { type: "h2", text: "Mit látnak a tulajdonosok" },
            {
              type: "ul",
              items: [
                "Saját objektumaik kihasználtsági naptára.",
                "A létrehozott statementek a bevételekkel és a levont jutalékkal.",
                "Objektumaik alapadatai, például felszereltség és leírás.",
              ],
            },
            { type: "h2", text: "Hozzáférés aktiválása" },
            {
              type: "steps",
              items: [
                "Nyissa meg a tulajdonost a „Tulajdonosok” alatt.",
                "Kattintson a „Hozzáférés meghívása” gombra.",
                "A tulajdonos e-mailt kap saját jelszava beállításához.",
                "A bejelentkezés után a tulajdonos automatikusan csak a hozzá rendelt objektumokat látja.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A tulajdonosi hozzáférés szigorúan csak olvasható: árakat, elérhetőségeket vagy objektumadatokat csak Ön, mint vállalkozás módosíthat, maga a tulajdonos nem.",
            },
            {
              type: "note",
              variant: "info",
              text: "Az objektumok hozzárendeléséről bővebben: [Objektum tulajdonoshoz rendelése](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
