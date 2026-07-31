import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portálok és csatornakezelő",
  description: "Booking, Airbnb, Expedia és társaik központi kezelése.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Portálok összekapcsolása",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Mi a csatornakezelő?",
          excerpt:
            "A csatornakezelő automatikusan összehangolja az árakat, az elérhetőséget és a foglalásokat a myNextDays és a portálok között.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Egy kapcsolat minden portálhoz" },
            {
              type: "p",
              text: "A csatornakezelő a híd a myNextDays és a nagy foglalási portálok, mint a Booking, Airbnb és társaik között. Ahelyett hogy minden portálon egyenként kellene karbantartania az árakat, az elérhetőséget és a kihasználtságot, mindent egyszer, a myNextDaysben ad meg — a csatornakezelő automatikusan eloszlatja minden csatlakoztatott portálra.",
            },
            { type: "h2", text: "Mi kerül automatikusan szinkronizálásra" },
            {
              type: "ul",
              items: [
                "Elérhetőség — minden foglalás azonnal zárolja az éjszakát minden portálon",
                "Árak és minimum tartózkodások az árnaptárból",
                "A beérkező portálfoglalások automatikusan importálásra kerülnek a myNextDaysbe",
                "A lemondások és a Stop-Sell csatornákon átívelően hatnak",
              ],
            },
            { type: "h2", text: "Mit nem kell többé kézzel elvégeznie" },
            {
              type: "p",
              text: "Csatornakezelő nélkül minden foglalás után kézzel kellene zárolnia az éjszakát minden portálon — ez a dupla foglalások gyakori oka. Aktív csatornakezelővel a myNextDays átveszi ezt az egyeztetést mindkét irányban, naponta többször, és valós időben az új foglalásoknál.",
            },
            {
              type: "note",
              variant: "info",
              text: "A portálkapcsolat egyszer, fiókszinten kerül beállításra. Minden egyes objektumhoz ezután már csak a hozzárendelést kell aktiválnia — bővebben: [Objektum portálhoz rendelése](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Portálkapcsolat beállítása",
          excerpt:
            "A portálokkal való kapcsolatot egyszer, fiókszinten állítja be — nem objektumonként újra.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Egyszer az egész fiókhoz" },
            {
              type: "p",
              text: "A portálokhoz való csatlakozás fiókszintű beállítás: myNextDays fiókját pontosan egyszer köti össze a csatornakezelővel. Minden objektum, amelyet később hoz létre, automatikusan erre az egy kapcsolatra épül — nem kell objektumonként újra felépítenie.",
            },
            { type: "h2", text: "Így állítja be a kapcsolatot" },
            {
              type: "steps",
              items: [
                "Nyissa meg a /konto oldalt, és válassza a „Portálok és csatornakezelő” szakaszt",
                "Kattintson a „Kapcsolat beállítása” gombra, és erősítse meg vállalkozási adatait (cím, elérhetőség, jogi forma)",
                "Ellenőrizze az automatikusan átvett törzsadatokat — ezek minden portálra továbbításra kerülnek",
                "Fejezze be a beállítást; az állapot „Összekapcsolva”-ra vált",
              ],
            },
            { type: "h2", text: "Következő lépés: objektumok hozzárendelése" },
            {
              type: "p",
              text: "Az egyszeri beállítás után még egyetlen objektum sem látható — ehhez minden objektumot egyenként hozzá kell rendelnie egy portálhoz (mapping), és összeköti a kívánt portálokat, mint a Booking.com vagy az Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Teljes törzsadatok (cím, adóinformációk, elérhetőség) nélkül a portálok elutasítják a kapcsolatot. Ellenőrizze ezeket az adatokat először a /konto alatt.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Objektum portálhoz rendelése",
          excerpt:
            "A fiókszintű kapcsolat után objektumonként csak a hozzárendelést (mapping) kell a megfelelő portálhoz aktiválnia.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Hozzárendelés újbóli csatlakozás helyett" },
            {
              type: "p",
              text: "Ha a portálkapcsolat egyszer, fiókszinten be van állítva, minden objektumot csak úgynevezett hozzárendelésen (mapping) keresztül köt össze: meghatározza, mely myNextDays objektum melyik szoba- vagy kínálattípusnak felel meg a portálon. Ez objektumonként egyszeri lépés.",
            },
            { type: "h2", text: "Így rendel hozzá egy objektumot" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot a /objekte alatt, és váltson a „Portálok” fülre",
                "Válassza ki a kívánt portált, például a Booking.com-ot vagy az Airbnb-t",
                "Rendelje hozzá az objektumot a megfelelő szoba- vagy kínálattípushoz a portálon",
                "Aktiválja a szinkronizálást — az árak és az elérhetőség ettől kezdve átvitelre kerülnek",
              ],
            },
            { type: "h2", text: "Egy objektum, több portál" },
            {
              type: "p",
              text: "Egyetlen objektum egyidejűleg több portálhoz is hozzárendelhető. Minden hozzárendelés független — egy objektumot például láthatóvá tehet a Booking.com-on és az Airbnb-n, de az Expedián egyelőre deaktiválva hagyhat.",
            },
            {
              type: "note",
              variant: "tip",
              text: "A hozzárendelés után közvetlenül ellenőrizze a láthatóságot — lásd [Láthatóság portálonként](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Booking.com összekapcsolása",
          excerpt: "Így engedélyezi a Booking.com-ot értékesítési csatornaként egy objektumhoz.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Feltétel: fiókszintű kapcsolat" },
            {
              type: "p",
              text: "Mielőtt aktiválná a Booking.com-ot egy objektumhoz, a fiókszintű portálkapcsolatnak be kell lennie állítva (lásd [Portálkapcsolat beállítása](/hilfe/portale-kanalmanager/portal-verbindung)). Ezután a Booking.com minden további objektumhoz már csak hozzárendelés kérdése.",
            },
            { type: "h2", text: "Booking.com aktiválása" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot a /objekte alatt, „Portálok” fülön",
                "Válassza ki a „Booking.com”-ot az elérhető portálok listájából",
                "Rendelje hozzá a megfelelő szoba- vagy kínálattípust, és erősítse meg az árazási terveket",
                "Aktiválja a láthatóságot — az objektum a Booking.com általi ellenőrzés után élesbe kerül",
              ],
            },
            { type: "h2", text: "Mit vár el Öntől a Booking.com" },
            {
              type: "ul",
              items: [
                "Teljes objektumleírás, képek és felszereltség",
                "Legalább egy ár lemondási feltételekkel",
                "Érvényes fizetési mód a jutalékokhoz",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A Booking.com általi engedélyezés néhány órát is igénybe vehet. Az állapot az objektum „Portálok” fülén mutatja, hogy a kapcsolat már aktív-e.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Airbnb összekapcsolása",
          excerpt: "Így teszi foglalhatóvá egy objektumot az Airbnb-n a csatornakezelőn keresztül.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Az Airbnb mint további portál" },
            {
              type: "p",
              text: "Az Airbnb, mint minden más portál, a fiókszintű kapcsolaton keresztül csatlakozik. Ha ez be van állítva, objektumonként a hozzárendelésen keresztül aktiválja az Airbnb-t — függetlenül attól, hogy az objektum már látható-e a Booking.com-on vagy más portálokon.",
            },
            { type: "h2", text: "Airbnb aktiválása egy objektumhoz" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot a /objekte alatt, „Portálok” fülön",
                "Válassza ki az „Airbnb”-t az elérhető portálok listájából",
                "Erősítse meg az objektumkategóriát és a hozzárendelt kínálattípust",
                "Ellenőrizze a fotókat, a felszereltséget és a házirendet — az Airbnb teljes adatokat kér az engedélyezés előtt",
                "Aktiválja a láthatóságot az Airbnb-hez",
              ],
            },
            { type: "h2", text: "Az aktiválás után" },
            {
              type: "p",
              text: "Amint az Airbnb engedélyezte az objektumot, az árak és az elérhetőség automatikusan a csatornakezelőn keresztül futnak. Az Airbnb-n beérkező foglalások ezután automatikusan megjelennek foglalási naptárában.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Rögzített lemondási feltételek és házirend nélkül az Airbnb elutasítja az engedélyezést. Egészítse ki ezeket az adatokat először az objektumban.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Árak és elérhetőség szinkronizálása",
          excerpt:
            "Az árak és az elérhetőség automatikusan átvitelre kerülnek minden csatlakoztatott portálra.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Egy naptár, minden portál" },
            {
              type: "p",
              text: "Az árakat és az elérhetőséget kizárólag az adott objektum myNextDays naptárában kezeli. A csatornakezelő minden módosítást automatikusan átvisz minden portálra, amelyhez az objektum aktívan hozzá van rendelve — anélkül, hogy bármit is duplán kellene beírnia.",
            },
            { type: "h2", text: "Mi kerül átvitelre" },
            {
              type: "ul",
              items: [
                "Napi árak az árnaptárból, illetve az árazási tervekből",
                "Elérhető éjszakák és zárolások",
                "Minimum tartózkodás és érkezési/távozási korlátozások",
                "Stop-Sell napok — ezek automatikusan zárolnak minden portálon",
              ],
            },
            { type: "h2", text: "Milyen gyorsan hat a szinkronizálás" },
            {
              type: "p",
              text: "Az árak és az elérhetőség módosításai néhány percen belül továbbításra kerülnek a portálokra. Az új foglalások azonnal zárolják az érintett éjszakákat, hogy azonos éjszaka semmilyen más csatornán ne kerülhessen újra eladásra.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Az egyes napok csatornákon átívelő zárolásáról bővebben: [Túlfoglalások elkerülése](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Portálfoglalások fogadása",
          excerpt: "A Booking, Airbnb és társaik foglalásai automatikusan naptárába kerülnek.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Automatikus importálás" },
            {
              type: "p",
              text: "Ha egy vendég egy portálon, mint a Booking.com vagy az Airbnb keresztül foglal, a csatornakezelő automatikusan importálja a foglalást a myNextDaysbe. Semmit sem kell kézzel átvinnie — a foglalás megjelenik az érintett objektum naptárában és foglalási listájában.",
            },
            { type: "h2", text: "Mi történik egy portálfoglalásnál" },
            {
              type: "steps",
              items: [
                "A portál jelenti az új foglalást a csatornakezelőnek",
                "A myNextDays létrehozza a foglalást vendégadatokkal, időszakkal és árral",
                "A lefoglalt éjszakák azonnal zárolásra kerülnek minden más csatornán",
                "Ön értesítést kap, és megtalálja a foglalást a naptárban",
              ],
            },
            { type: "h2", text: "Lemondások és módosítások" },
            {
              type: "p",
              text: "Ha egy vendég a portálon keresztül lemond, vagy módosítja az időszakot, ez szintén automatikusan átvitelre kerül a myNextDaysbe, és az érintett éjszakák ismét felszabadulnak.",
            },
            {
              type: "note",
              variant: "info",
              text: "A portálfoglalások a foglalási részleteknél származási jelvényükről felismerhetők, például Booking.com vagy Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Túlfoglalások elkerülése",
          excerpt: "A Stop-Sell és az automatikus zárolások megakadályozzák a dupla foglalásokat több portálon.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Miért keletkeznek túlfoglalások" },
            {
              type: "p",
              text: "Központi vezérlés nélkül könnyen megtörténhet, hogy ugyanazt az éjszakát két portálon egyszerre adják el — például ha az árakat és az elérhetőséget kézzel kezelik több rendszerben. A csatornakezelő bezárja ezt a rést azzal, hogy minden foglalás bármelyik csatornán azonnal zárolja az összes többi csatornát.",
            },
            { type: "h2", text: "Eszközei a túlfoglalások ellen" },
            {
              type: "ul",
              items: [
                "Automatikus zárolás: minden új foglalás — bármelyik csatornán — mindenhol zárolja az éjszakákat",
                "Stop-Sell: kézzel zárol egy napot egyszerre minden csatornán, például saját használatra vagy karbantartásra",
                "A minimum tartózkodás és az érkezési korlátozások megakadályozzák a nem megfelelő rövid foglalásokat",
              ],
            },
            { type: "h2", text: "Stop-Sell beállítása" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektum foglalási naptárát",
                "Jelölje ki az érintett napot vagy időszakot",
                "Válassza a „Stop-Sell” opciót — a nap ezután minden portálon, valamint a weboldalon és a platformon is zárolva van",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A Stop-Sell kivétel nélkül minden csatornára vonatkozik. Nincs lehetőség arra, hogy egy napot csak egyetlen portálra zároljon, és másoknak nyitva hagyja.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Láthatóság portálonként",
          excerpt: "Minden portál a weboldaltól és a platform-piactértől függetlenül be- vagy kikapcsolható.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Három független értékesítési út" },
            {
              type: "p",
              text: "Egy objektumot egyidejűleg több úton is értékesíthet: a portálokon (Booking, Airbnb és társaik), a myBestDays platform-piactéren és saját weboldalán keresztül. Minden útnak saját láthatósági kapcsolója van — ezek teljesen függetlenek egymástól.",
            },
            { type: "h2", text: "Láthatóság portálonkénti vezérlése" },
            {
              type: "p",
              text: "A portálokon belül emellett minden egyes portál külön kapcsolható. Egy objektum például lehet aktív a Booking.com-on, de deaktiválva az Airbnb-n — mindkét hozzárendelés ettől érintetlenül fennmarad.",
            },
            { type: "h2", text: "Így módosítja a láthatóságot" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot a /objekte alatt, „Portálok” fülön",
                "Kapcsolja be vagy ki egyenként a kívánt csatornát (egyedi portál, weboldal vagy platform-piactér)",
                "Mentse el — a módosítás néhány percen belül hatályba lép",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Az objektumállapot (aktív/inaktív), valamint a Stop-Sell felsőbb szinten hat minden csatornára. A láthatósági kapcsolók csak azt vezérlik, mely további csatornákon jelenik meg egy már aktív objektum.",
            },
          ],
        },
      ],
    },
  ],
};
