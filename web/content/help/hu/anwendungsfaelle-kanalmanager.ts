import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Csatornakezelő",
  description: "Portálok és csatornakezelő elsajátítása.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Csatornakezelő",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Első portál összekapcsolása",
          excerpt: "Így engedélyez első alkalommal egy portált egy objektumhoz.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet: létrehozott egy objektumot, de még nem kapcsolt össze portált",
            },
            {
              type: "p",
              text: "Objektuma teljesen be van állítva a myNextDaysben, de még egyik portálon sem látható, mint a Booking.com vagy az Airbnb. Mielőtt egy portál elfogadna egy objektumot, fiókjának egyszer szüksége van egy fiókszintű portálkapcsolatra — utána minden további objektumhoz már csak egy hozzárendelés elegendő.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg a /konto oldalt, a „Portálok és csatornakezelő” szakaszt, és állítsa be a fiókszintű kapcsolatot vállalkozási adataival",
                "Ezután nyissa meg az objektumot a /objekte alatt, és váltson a „Portálok” fülre",
                "Válassza ki a kívánt portált, és rendelje hozzá a megfelelő szoba- vagy kínálattípushoz",
                "Ellenőrizze a fotókat, a felszereltséget, az árakat és a lemondási feltételeket — a portálok teljes adatokat kérnek",
                "Aktiválja a láthatóságot; az állapot a portál általi ellenőrzés után „Összekapcsolva”-ra vált",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A fiókszintű kapcsolatot csak egyszer állítja be. Bővebben: [Booking.com összekapcsolása](/hilfe/portale-kanalmanager/booking-verbinden) és [Airbnb összekapcsolása](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Booking.com összekapcsolása",
          excerpt: "Így teszi foglalhatóvá egy objektumot a Booking.com-on a csatornakezelőn keresztül.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet: objektuma emellett a Booking.com-on is látható legyen",
            },
            {
              type: "p",
              text: "A Booking.com az egyik olyan portál, amely a csatornakezelőn keresztül csatlakoztatható. Feltétele a fiókszintű portálkapcsolat — ha ez már be van állítva, a Booking.comhoz már csak egy hozzárendelés kell objektumonként.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot a /objekte alatt, „Portálok” fülön",
                "Válassza ki a „Booking.com”-ot az elérhető portálok listájából",
                "Rendelje hozzá a megfelelő szoba- vagy kínálattípust, és erősítsen meg legalább egy árat lemondási feltételekkel",
                "Rögzítsen egy érvényes fizetési módot a jutalékelszámoláshoz",
                "Aktiválja a láthatóságot a Booking.comhoz",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A Booking.com általi engedélyezés néhány órát is igénybe vehet. A „Portálok” fülön az állapot mutatja, amint a kapcsolat aktívvá válik.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Airbnb összekapcsolása",
          excerpt: "Így teszi foglalhatóvá egy objektumot az Airbnb-n a csatornakezelőn keresztül.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet: objektuma emellett az Airbnb-n is látható legyen",
            },
            {
              type: "p",
              text: "Az Airbnb, mint minden más portál, a fiókszintű kapcsolaton keresztül csatlakozik. Ha ez be van állítva, objektumonként hozzárendeléssel aktiválja az Airbnb-t — függetlenül attól, hogy az objektum már látható-e a Booking.com-on vagy más portálokon.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot a /objekte alatt, „Portálok” fülön",
                "Válassza ki az „Airbnb”-t az elérhető portálok listájából",
                "Erősítse meg az objektumkategóriát és a hozzárendelt kínálattípust",
                "Egészítse ki a fotókat, a felszereltséget és a házirendet — az Airbnb teljes adatokat kér az engedélyezés előtt",
                "Aktiválja a láthatóságot az Airbnb-hez",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Rögzített lemondási feltételek és házirend nélkül az Airbnb elutasítja az engedélyezést. Egészítse ki ezeket az adatokat először az objektumban.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Árak szinkronban tartása minden portálon",
          excerpt: "Egy naptár elegendő — a csatornakezelő automatikusan eloszlatja az árváltozásokat minden portálra.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet: módosít egy árat, és biztos szeretne lenni abban, hogy mindenhol helyes",
            },
            {
              type: "p",
              text: "Az árakat kizárólag az objektum myNextDays naptárában kezeli — soha nem egyenként a portálokon. A csatornakezelő minden módosítást automatikusan átvisz minden portálra, amelyhez az objektum aktívan hozzá van rendelve.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektum árnaptárát, illetve árazási terveit",
                "Igazítsa a napi árat, a minimum tartózkodást vagy az érkezési/távozási korlátozást",
                "Mentse el a módosítást — ez először belsőleg, az objektumon belül hat",
                "Ellenőrizze a „Portálok” fülön, hogy minden kívánt portál továbbra is aktívan hozzá van-e rendelve",
                "Várjon néhány percet, amíg a módosítás átvitelre kerül a portálokra",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Soha ne adjon meg árakat közvetlenül a portálon — az ilyen módosításokat a myNextDays naptár a következő egyeztetéskor felülírja.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Portálfoglalás importálása",
          excerpt: "A portálfoglalások automatikusan a naptárba kerülnek — itt ellenőrizheti, hogy az importálás sikeres volt.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet: egy vendég portálon keresztül foglalt, a foglalásnak meg kell érkeznie a myNextDaysbe",
            },
            {
              type: "p",
              text: "Ha egy vendég a Booking.com-on, az Airbnb-n vagy egy másik csatlakoztatott portálon keresztül foglal, a csatornakezelő automatikusan importálja a foglalást — semmit sem kell kézzel átvinnie. Ez a lefolyás leírja, hogyan követheti nyomon és erősítheti meg az importálást.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az érintett objektum naptárát vagy foglalási listáját",
                "Keresse meg az új foglalást — ez a portál származási jelvényét viseli, például Booking.com vagy Airbnb",
                "Ellenőrizze a vendégadatok, az időszak és az ár teljességét",
                "Ellenőrizze, hogy a lefoglalt éjszakák minden más csatornán zároltként jelennek-e meg",
                "Szükség esetén nyissa meg a foglalás részleteit a vendég kiegészítő szolgáltatásainak vagy üzeneteinek kezeléséhez",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ha a vendég a portálon keresztül lemond, vagy módosítja az időszakot, ez szintén automatikusan átvitelre kerül, és az éjszakák ismét felszabadulnak.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Dupla foglalás feloldása",
          excerpt: "Így járjon el, ha kivételesen ugyanazt az éjszakát két csatornán adták el.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet: két foglalás átfedésben van ugyanahhoz az objektumhoz és ugyanazokhoz az éjszakákhoz",
            },
            {
              type: "p",
              text: "A csatornakezelő normál esetben azonnal zárolja a lefoglalt éjszakákat csatornákon átívelően. Egy dupla foglalás ennek ellenére keletkezhet, például két portálon egyidejűleg történő foglalás esetén ugyanabban a pillanatban, vagy egy kézzel létrehozott foglalás esetén, amely ütközik egy portálfoglalással.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektum naptárát, és azonosítsa mindkét átfedő foglalást",
                "Ellenőrizze mindkét foglalás foglalási időpontját és származási jelvényét",
                "Vegye fel a kapcsolatot a később érkezett vendéggel, és ajánljon fel egy alternatív objektumot vagy időszakot",
                "Mondja le a nem tartható foglalást magán a portálon, ne csak a myNextDaysben",
                "Az érintett éjszakákra ezután állítson be Stop-Sellt, amíg az eset teljesen tisztázódik",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Egy portálfoglalást mindig magán a portálon mondjon le — ha csak a myNextDaysben mondja le, az belsőleg felszabadítja az éjszakát, de a portált nem tájékoztatja megbízhatóan.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Portál ideiglenes szüneteltetése",
          excerpt: "Láthatóság portálonkénti egyedi kikapcsolása a hozzárendelés elvesztése nélkül.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet: egy objektumnak egy portálon ideiglenesen nem szabad foglalhatónak lennie",
            },
            {
              type: "p",
              text: "A láthatóság portálonként egyénileg kapcsolható — a weboldaltól és a platform-piactértől függetlenül. Ha például az Airbnb-t rövid időre szüneteltetni szeretné, de a Booking.com-ot tovább futtatná, kizárólag ezt az egy csatornát deaktiválja.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot a /objekte alatt, „Portálok” fülön",
                "Keresse meg a szüneteltetni kívánt portál bejegyzését",
                "Kapcsolja ki a láthatóságot ehhez a portálhoz",
                "Mentse el — a módosítás néhány percen belül hatályba lép, az objektum eltűnik e portál keresési találataiból",
                "Kapcsolja vissza a láthatóságot, amint az objektumnak ismét foglalhatónak kell lennie",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A hozzárendelés a szüneteltetés alatt megmarad — a portálhoz való hozzárendelést később nem kell újra beállítania. Az összes csatorna teljes zárolásához ehelyett a Stop-Sell funkciót használja.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Objektumhozzárendelés ellenőrzése",
          excerpt: "Így ellenőrzi, hogy objektuma még helyesen van-e hozzárendelve a megfelelő kínálattípushoz a portálon.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet: az árak vagy az elérhetőség egy portálon már nem egyezik a myNextDaysszel",
            },
            {
              type: "p",
              text: "Ha a portáli megjelenítés eltér myNextDays naptárától, ennek oka gyakran egy hibás vagy megszakadt hozzárendelés — az objektuma és a portáli szoba- vagy kínálattípus közötti kapcsolat.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot a /objekte alatt, „Portálok” fülön",
                "Ellenőrizze az érintett portál állapotát — „Összekapcsolva”-t kellene mutatnia, nem „Hiba”-t vagy „Függőben”-t",
                "Ellenőrizze, hogy a hozzárendelt szoba- vagy kínálattípus a portálon még megfelel-e a tényleges objektumnak",
                "Eltérés esetén: szüntesse meg a hozzárendelést, és rendelje hozzá újra, majd aktiválja ismét a láthatóságot",
                "A javítás után várjon néhány percet, és ellenőrizze ismét az árakat és az elérhetőséget a portálon",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Egy objektum egyidejűleg több portálhoz is hozzárendelhető — eltérés esetén célzottan az egy érintett portált ellenőrizze, ne mindet egyszerre.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Eltérő árak portálonként",
          excerpt: "Hogyan rendel hozzá egy portálhoz saját árazási tervet anélkül, hogy a többi csatornát befolyásolná.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet: egy portálon eltérő árat szeretne kínálni, mint a többi csatornán",
            },
            {
              type: "p",
              text: "Az árazási tervek portálonként egyénileg hozzárendelhetők, például egy nem lemondható árazási terv az egyik portálhoz, egy rugalmas a másikhoz. Az alapárak központilag, az objektumban maradnak kezelve, a hozzárendelés határozza meg, melyik árazási terv melyik portálhoz megy.",
            },
            {
              type: "steps",
              items: [
                "Hozza létre az objektumban a további árazási tervet a kívánt feltételekkel (ár, lemondási feltételek, minimum tartózkodás)",
                "Nyissa meg a „Portálok” fület, és válassza ki az érintett portált",
                "Rendelje hozzá a hozzárendelésben az új árazási tervet ehhez a portálhoz",
                "Hagyja a többi portált változatlanul a korábbi árazási terven",
                "Mentse el, és néhány perc múlva ellenőrizze az árazás megjelenítését az adott portálon",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Minden árazási terv egymástól függetlenül kerül átvitelre — egy árazási terv módosítása nem hat azokra a portálokra, amelyek másik árazási tervhez vannak rendelve.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Gyakori portálhibák elhárítása",
          excerpt: "Tipikus okok, ha egy portál elutasít egy objektumot, vagy a szinkronizálás akadozik.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet: egy portál állapota hibát mutat, vagy az objektumot nem veszi át",
            },
            {
              type: "p",
              text: "A portálok leggyakrabban hiányzó törzsadatok vagy hiányos objektumadatok miatt utasítanak el egy kapcsolatot. Nézze végig sorban a leggyakoribb okokat, mielőtt kapcsolatba lépne a támogatással.",
            },
            {
              type: "steps",
              items: [
                "Ellenőrizze a /konto alatt, hogy a cím, az adóinformációk és az elérhetőségi adatok teljesen rögzítve vannak-e",
                "Ellenőrizze az objektumban, hogy a leírás, a fotók, a felszereltség és legalább egy ár teljes-e",
                "Ellenőrizze, hogy rögzítve van-e érvényes fizetési mód a jutalékokhoz",
                "Nyissa meg a „Portálok” fület, és olvassa el a pontos hibaüzenetet az érintett portál mellett",
                "Hárítsa el a megnevezett hiányosságot, és aktiválja ismét a láthatóságot",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Egy portálhiba mindig csak azt az egy portált érinti — a többi csatorna ettől függetlenül tovább fut, amíg saját követelményeik teljesülnek.",
            },
          ],
        },
      ],
    },
  ],
};
