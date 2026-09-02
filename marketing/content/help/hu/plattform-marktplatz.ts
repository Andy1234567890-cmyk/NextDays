import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Platform (piactér)",
  description: "Értékesítés a myBestDays piactéren.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Piactér",
      articles: [
        {
          slug: "der-marktplatz",
          title: "A myBestDays piactér",
          excerpt: "A globális myBestDays piactér önálló foglalási csatorna a portálok és a weboldal mellett.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A myBestDays piactér (/plattform) magának a myBestDaysnek a globális foglalási csatornája — összehasonlítható a Booking vagy az Airbnb szolgáltatással, mégis ugyanannak a platformnak a része. A vendégek itt az összes csatlakoztatott vállalkozás objektumai között böngésznek, és közvetlenül foglalnak.",
            },
            { type: "h2", text: "Nem „közvetlen”, hanem egyenrangú csatorna" },
            {
              type: "p",
              text: "A piactér nem helyettesíti a saját weboldalán keresztüli közvetlen foglalást. Önálló, harmadik értékesítési út, saját láthatósági tengellyel, saját vendégkörrel és saját jutalékkal — pontosan úgy, mint egy portál, csak éppen magát a myBestDays üzemelteti.",
            },
            { type: "h2", text: "Hogyan kerülnek objektumok a piactérre" },
            {
              type: "ul",
              items: [
                "Az objektumnak aktívnak kell lennie (az objektumállapot engedélyezi az értékesítést).",
                "A piactér-láthatóságnak be kell lennie kapcsolva — a portáloktól és a weboldaltól elkülönítve.",
                "A kívánt időszakra elérhetőségnek kell fennállnia a naptárban.",
              ],
            },
            { type: "h2", text: "Foglalások a piactérről" },
            {
              type: "p",
              text: "Egy piactéri foglalás azonnal zárolja a megfelelő éjszakákat minden más csatornán — pontosan úgy, mint egy portál- vagy weboldal-foglalás. Ugyanúgy megjelenik naptárában és a foglalások között, mint bármely más foglalás, „Platform” csatornajelöléssel.",
            },
            {
              type: "note",
              variant: "info",
              text: "A Stop-Sell és egy inaktív objektumállapot csatornákon átívelően hatnak, és a piacteret is zárolják — függetlenül a piactér-láthatósági kapcsolótól.",
            },
            {
              type: "p",
              text: "Hogy hogyan engedélyezheti egy objektumát a piactérhez, arról bővebben: [Objektum listázása a piactéren](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Objektum listázása a piactéren",
          excerpt: "A piactér-láthatóság önálló kapcsoló, elkülönítve a portáloktól és a weboldaltól.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A piactéri láthatóságot egy önálló, objektumhoz tartozó kapcsolóval szabályozza — függetlenül attól, hogy ugyanaz az objektum a portálokon vagy weboldalán is látható-e.",
            },
            { type: "h2", text: "Így listáz egy objektumot" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot az Objektumok alatt.",
                "Váltson a Láthatóság fülre.",
                "Aktiválja a Platform-piactér kapcsolót.",
                "Ellenőrizze, hogy az objektumállapot aktív, és hogy van naptári elérhetőség.",
              ],
            },
            { type: "h2", text: "Feltétel: teljes profil" },
            {
              type: "p",
              text: "A piactér csak teljes adatokkal rendelkező objektumokat jelenít meg — a címfotónak, a leírásnak, a felszereltségnek és az alapárnak rögzítve kell lennie. Ha kötelező adatok hiányoznak, az objektum a bekapcsolt kapcsoló ellenére is láthatatlan marad.",
            },
            {
              type: "ul",
              items: [
                "Legalább egy címfotó és egy leírás",
                "Felszereltségi jellemzők a kategórialistából",
                "Kapacitás és alapár a rögzített objektumdevizában",
                "Naptári elérhetőség a kívánt időszakra",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "A Közzététel gombra kattintva a myNextDays portálok és a weboldal egyidejűleg válnak elérhetővé. A myBestDays kötelező csatorna: minden ingatlan szerepel rajta, és megjelenik, amint jóváhagytuk a hirdetést.",
            },
            { type: "h2", text: "Láthatóság ismételt eltávolítása" },
            {
              type: "p",
              text: "A myBestDays nem választható le külön. Ha egy ingatlant már nem szeretne értékesíteni, használja az „Értékesítés szüneteltetése” funkciót – ezáltal az ingatlan az összes portálról, a weboldalról és a piactérről egyidejűleg kikerül az értékesítésből. A már visszaigazolt foglalásokat ez nem érinti, azok a szokásos módon folytatódnak, lásd: [Piactéri jutalék](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Piactéri jutalék",
          excerpt: "Minden a piactéren keresztül közvetített foglalás után a csomagban rögzített jutalék terheli.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Mint minden foglalási portál esetében, a myBestDays piactéren keresztül létrejövő foglalásokért jutalék terheli. Ezt foglalásonként számítják, és független a portálokra vonatkozó esetleges jutalékoktól.",
            },
            { type: "h2", text: "Hogyan számítják a jutalékot" },
            {
              type: "p",
              text: "Az összeg vállalkozása csomagjában rögzített jutaléktól függ. Az aktuális mértéket bármikor megtalálja a Fiók menü Elszámolás területén — ott nem egy egységes érték feltételezésre kerül, hanem a csomagjára ténylegesen érvényes mérték jelenik meg.",
            },
            { type: "h2", text: "Hol tekintheti meg a jutalékot" },
            {
              type: "steps",
              items: [
                "Nyissa meg a menüben a Fiók pontot.",
                "Váltson az Elszámolás területre.",
                "Nyisson meg egy piactéri foglalást, hogy részletesen lássa a bevételt és a jutalékot.",
                "Ellenőrizze a jutalékok áttekintését a folyó elszámolási időszakra.",
              ],
            },
            { type: "h2", text: "Elhatárolás a portáljutalékoktól" },
            {
              type: "ul",
              items: [
                "A piactéri jutalék kizárólag a myBestDays piactéren keresztüli foglalásokra vonatkozik.",
                "A portálfoglalások (Booking, Airbnb és társaik) az adott portál feltételei alá tartoznak.",
                "A weboldali foglalásokra a csomagjához rögzített feltételek vonatkoznak, piactéri jutalék nélkül.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A jutalék automatikusan a csomagja alapján kerül megállapításra. Egy hiányzó vagy nem egyértelmű csomag egyértelmű hibaüzenetet eredményez egy becsült érték helyett.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Vendégprofil és értékelések",
          excerpt: "A piactéri vendégeknek profiljuk van foglalási előzményekkel, és értékeléseket hagyhatnak.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A myBestDays piactéren keresztül foglaló vendégek saját vendégprofilt hoznak létre. Ebben gyűlnek össze foglalásaik, a vállalkozásokkal folytatott üzenetváltásaik és leadott értékeléseik — hasonlóan egy portál vendégfiókjához.",
            },
            { type: "h2", text: "Mit lát vállalkozásként" },
            {
              type: "p",
              text: "Egy piactéri foglalás foglalási részleteiben megtalálja a vendégprofilt a vállalkozásánál eddig eltöltött tartózkodásokkal, és amennyiben a vendég engedélyezte, más szálláshelyekre vonatkozó, nyilvánosan látható értékelésekkel.",
            },
            { type: "h2", text: "Értékelések a tartózkodás után" },
            {
              type: "steps",
              items: [
                "A check-out után a vendég felkérést kap az értékelésre.",
                "Az értékelés rövid ellenőrzés után megjelenik az objektumoldalon a piactéren.",
                "Vállalkozásként nyilvánosan válaszolhat minden értékelésre.",
                "A tárgyszerűtlen vagy visszaélésszerű értékeléseket a Jelentés funkción keresztül vizsgálatra beküldheti.",
              ],
            },
            {
              type: "ul",
              items: [
                "Az értékelések egy tényleges foglaláshoz kötöttek — nincs értékelés tartózkodás nélkül.",
                "A vendég a tisztaságot, a kommunikációt, a fekvést és az ár-érték arányt értékeli.",
                "Válasza minden piactéri látogató számára látható.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A jó értékelések közvetlenül hatnak objektuma elhelyezésére a piactéri keresésben — reagáljon időben és tárgyszerűen a kritikára.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Blokkolt személyek",
          excerpt: "Egy vállalkozás blokkolhat egy vendéget, aminek következtében az üzenetek és foglalások meghiúsulnak.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Ha problémák merülnek fel egy vendéggel, vállalkozásként blokkolhatja őt. Egy blokkolt személy ezután nem tud Önnek üzenetet küldeni, és nem tud új foglalást létrehozni vállalkozásánál.",
            },
            { type: "h2", text: "Személy blokkolása" },
            {
              type: "steps",
              items: [
                "Nyissa meg az üzenetváltást vagy a foglalást az érintett vendéggel.",
                "Kattintson a Vendég blokkolása gombra.",
                "Erősítse meg a párbeszédablakot — a tiltás azonnal érvénybe lép.",
                "A blokkolt személy ezután megjelenik a Fiók menü Blokkolt személyek területén.",
              ],
            },
            { type: "h2", text: "Mit eredményez a tiltás" },
            {
              type: "ul",
              items: [
                "A vendég többé nem tud új üzenetet küldeni vállalkozásának.",
                "A vendég nem tud új foglalást létrehozni vállalkozásánál.",
                "Egy folyamatban lévő foglalás, amelynek érkezése a következő két héten belül már megerősített, a tiltástól érintetlen marad, hogy a tartózkodás rendezetten lebonyolítható legyen.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A tiltás kizárólag vállalkozására érvényes. A piactér más vállalkozásai nem látják a tiltást, és azt nem érinti.",
            },
            { type: "h2", text: "Tiltás ismételt feloldása" },
            {
              type: "p",
              text: "Nyissa meg a Fiók menüt, ott a Blokkolt személyek pontot. Válassza ki a bejegyzést, és kattintson a Tiltás feloldása gombra — a vendég ezután ismét tud üzenetet küldeni és foglalni.",
            },
          ],
        },
      ],
    },
  ],
};
