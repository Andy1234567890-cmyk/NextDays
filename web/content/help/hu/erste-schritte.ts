import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Első lépések",
  description: "Fiók beállítása, és indulás néhány perc alatt.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Beállítás",
      articles: [
        {
          slug: "willkommen",
          title: "Üdvözöljük a myNextDaysben",
          excerpt: "Áttekintés a PMS-ről, a csatornakezelőről, a piactérről és az alkalmazásról.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A myNextDays üdülőobjektumok és hotelek központi platformja. Több szigetmegoldás helyett egy helyen kezeli az elérhetőséget, az árakat, a foglalásokat és a vendégkommunikációt — függetlenül attól, hogy egyetlen nyaralóházat vagy több hotelszobát üzemeltet.",
            },
            { type: "h2", text: "A négy építőelem" },
            {
              type: "ul",
              items: [
                "PMS (ingatlankezelő rendszer): objektumok, naptár, árak, foglalások, feladatok és fizetések.",
                "Csatornakezelő: kapcsolat portálokkal, mint a Booking, Airbnb és társaik — egy bevitel, sok szinkronizált portál.",
                "Platform-piactér: a saját myNextDays piactér, egyenrangú foglalási csatorna a portálok mellett.",
                "Alkalmazás: a mobilalkalmazás vendégeknek, tulajdonosoknak és munkatársaknak, ugyanazokkal az adatokkal, mint a weben.",
              ],
            },
            { type: "h2", text: "Hogyan működnek együtt az építőelemek" },
            {
              type: "p",
              text: "Az objektumot, az árakat és az elérhetőséget egyszer, központilag a PMS-ben kezeli. Onnan a myNextDays automatikusan elosztja az adatokat minden aktív csatornára. Egy foglalás — bármelyik csatornán keresztül is érkezik — azonnal lefoglalja a megfelelő éjszakákat mindenhol, így a dupla foglalások kizártak.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kezdje a Fiók és vállalkozás beállításával, majd hozza létre első objektumát — ez a sorrend időt takarít meg a későbbi javításoknál.",
            },
            { type: "h2", text: "Következő lépések" },
            {
              type: "steps",
              items: [
                "Nyissa meg a menüben a Fiók pontot, és egészítse ki vállalkozása adatait.",
                "Hozza létre első objektumát az Objektumok alatt.",
                "Ellenőrizze a felszereltség, fotók és árak teljességét.",
                "Kattintson a Közzététel gombra, hogy az objektum minden csatornán láthatóvá váljon.",
              ],
            },
            {
              type: "p",
              text: "Az egyes lépésekről bővebben: [Fiók és vállalkozás beállítása](/hilfe/erste-schritte/konto-einrichten) és [Első objektum létrehozása](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Fiók és vállalkozás beállítása",
          excerpt: "Törzsadatok, számlázási cím és deviza helyes rögzítése.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Mielőtt objektumokat hozna létre, állítsa be vállalkozását a fiókban. Ezekre az adatokra szükség van a számlákhoz, a portálokhoz és a myNextDaysszel való elszámoláshoz, ezért legyenek teljesek és helyesek.",
            },
            { type: "h2", text: "Törzsadatok rögzítése" },
            {
              type: "steps",
              items: [
                "Nyissa meg a menüben a Fiók pontot.",
                "Adja meg a Törzsadatok alatt a cégnevet, illetve az egyéni vállalkozás nevét, a címet és az elérhetőségi adatokat.",
                "Rögzítse a számlázási címet — ez jelenik meg minden kiállított számlán.",
                "Válassza ki alapdevizáját. Ez minden árra érvényes, amíg objektumonként célzottan meg nem változtatja.",
              ],
            },
            { type: "h2", text: "Miért fontos a deviza" },
            {
              type: "p",
              text: "A deviza nem tippelt vagy automatikusan kiegészített: ha hiányzik, egyetlen ár sem jeleníthető meg vagy számolható el helyesen. Ezért a myNextDays tudatos kiválasztást kér a beállításnál, ahelyett hogy alapértelmezett értéket illesztene be.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ha utólag módosítja egy objektum devizáját, minden hozzá tartozó árazási terv is átáll. Ezután egyszer ellenőrizze le az árakat.",
            },
            { type: "h2", text: "Számlázási cím és elszámolás" },
            {
              type: "p",
              text: "A fiók Elszámolás területén láthatja folyó számláit és a rögzített számlázási címet. Tartsa ezt naprakészen, különösen a jogi forma vagy a cím módosulása esetén, hogy a számlák helyesen kerüljenek kiállításra.",
            },
            {
              type: "ul",
              items: [
                "Cégnév, illetve az egyéni vállalkozás neve",
                "Számlázási cím országmegjelöléssel",
                "Adószám, illetve közösségi adószám, ha van",
                "Alapdeviza az új objektumokhoz",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Első objektum létrehozása",
          excerpt: "Így hozza létre lépésről lépésre első foglalható objektumát.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Egy objektum a myNextDaysben mindig pontosan egy foglalható egység: vagy egy egyedi szoba egy hotelben, vagy egy teljes üdülőobjektum. Ha több szobás hotelt üzemeltet, hozzon létre minden szobához saját objektumot.",
            },
            { type: "h2", text: "Objektum létrehozása" },
            {
              type: "steps",
              items: [
                "Nyissa meg a menüben az Objektumok pontot.",
                "Kattintson az Objektum hozzáadása gombra.",
                "Válassza ki az objektumtípust: kategória, ingatlantípus és kínálati típus.",
                "Egészítse ki a címet, a kapacitást és az alapárat a rögzített devizájában.",
                "Mentse el az objektumot piszkozatként, hogy később kiegészíthesse.",
              ],
            },
            { type: "h2", text: "Mi hiányzik még ezután" },
            {
              type: "p",
              text: "Egy újonnan létrehozott objektum eleinte piszkozat, és egyik csatornán sem látható. Egészítse ki a felszereltséget, a fotókat, a leírást és a naptári elérhetőséget, mielőtt közzétenné — csak egy teljes objektum értékesíthető megbízhatóan.",
            },
            {
              type: "ul",
              items: [
                "Felszereltségi jellemzők kiválasztása a kategórialistából",
                "Legalább egy címfotó és egy leírás rögzítése",
                "Kapacitás (felnőttek, gyerekek, ágyak) helyes megadása",
                "Alapár és naptári elérhetőség ellenőrzése",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ha több szobatípust üzemeltet, ismételje meg ezt a folyamatot minden egyes szobára — nincs felsőbb, épület szintű réteg, amely alatt szobák lennének.",
            },
            {
              type: "p",
              text: "Ha minden kötelező mezőt kitöltött, közzéteheti az objektumot, lásd [Objektum közzététele](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Objektum közzététele",
          excerpt: "Egy kattintás egyszerre engedélyezi a platform-piacteret, a portálokat és a weboldalt.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A közzététel láthatóvá és foglalhatóvá teszi az objektumot. Normál esetben egyetlen kattintás elegendő mind a három értékesítési csatorna egyidejű aktiválásához — de a láthatóságot csatornánként bármikor egyénileg is beállíthatja.",
            },
            { type: "h2", text: "Így teheti közzé" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot az Objektumok alatt.",
                "Ellenőrizze az Áttekintés fülön, hogy minden kötelező adat zölddel van-e jelölve.",
                "Kattintson a Közzététel gombra.",
                "Erősítse meg a párbeszédablakot — a platform-piactér, a portálok és a weboldal aktiválásra kerülnek.",
              ],
            },
            { type: "h2", text: "Csatornák egyéni vezérlése" },
            {
              type: "p",
              text: "A közzététel után a Láthatóság fülön három külön kapcsolót talál: weboldal, platform-piactér és portálok. Ha egy objektumot például csak saját weboldalán, de portálokon keresztül nem szeretne kínálni, egyszerűen kapcsolja ki a megfelelő kapcsolót.",
            },
            {
              type: "ul",
              items: [
                "Weboldal: láthatóság saját myNextDays weboldalán",
                "Platform-piactér: láthatóság a globális myNextDays piactéren",
                "Portálok: láthatóság a Bookingon, Airbnbn és társaikon",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ez a három kapcsoló független az objektumállapottól (aktív/inaktív). Egy aktív objektum ennek ellenére láthatatlan lehet egyes csatornákon.",
            },
            { type: "h2", text: "Objektum ideiglenes zárolása" },
            {
              type: "p",
              text: "Ha nem az egész objektumot, hanem csak egyetlen napot szeretne zárolni, használja a Stop-Sell funkciót a naptárban — ez a napot minden csatornán egyszerre zárolja, függetlenül a láthatósági kapcsolóktól.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "A három értékesítési csatorna megértése",
          excerpt: "Portálok, platform-piactér és alkalmazás áttekintése.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A myNextDays minden objektumot egyidejűleg több egyenrangú úton keresztül értékesít. Ha érti, hogyan működnek ezek együtt, célzottan tudja irányítani a láthatóságot és az árakat.",
            },
            { type: "h2", text: "Portálok" },
            {
              type: "p",
              text: "A csatornakezelőn keresztül köti össze objektumát nagy foglalási portálokkal, mint a Booking, Airbnb és társaik. Az elérhetőség és az árak automatikusan szinkronizálódnak, így nem kell több portálnaptárat kézzel karbantartania.",
            },
            { type: "h2", text: "Platform-piactér" },
            {
              type: "p",
              text: "A myNextDays piactér önálló, globális foglalási csatorna — összehasonlítható a Bookinggal vagy az Airbnbvel, mégis ugyanannak a platformnak a része. Nem „közvetlen foglalási” helyettesítő, hanem egyenrangú csatorna saját láthatósági tengellyel.",
            },
            { type: "h2", text: "Alkalmazás" },
            {
              type: "p",
              text: "A mobilalkalmazás hozzáférést biztosít vendégeknek, tulajdonosoknak és munkatársaknak ugyanazokhoz az adatokhoz, mint a web — például foglalási részletekhez, üzenetekhez vagy feladatokhoz, a szerepkörtől függően.",
            },
            { type: "h2", text: "Három elkülönített láthatósági tengely" },
            {
              type: "ul",
              items: [
                "Weboldal — saját myNextDays weboldala",
                "Platform-piactér — a globális myNextDays piactér",
                "Portálok — Booking, Airbnb és társaik a csatornakezelőn keresztül",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Mindhárom tengely egymástól függetlenül kapcsolható. A Stop-Sell és az objektumállapot ezzel szemben csatornákon átívelően, mindhárom tengelyre egyszerre hat.",
            },
          ],
        },
      ],
    },
  ],
};
