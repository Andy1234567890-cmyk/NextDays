import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Fiók és előfizetés",
  description: "Törzsadatok, csomag, biztonság és kétfaktoros hitelesítés.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Fiók",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Vállalkozási törzsadatok",
          excerpt: "Vállalkozása cégnevének, címének és elérhetőségi adatainak központi kezelése.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A /konto alatt a myNextDays minden vállalkozási és fiókfunkciót szakaszokba rendezve, egy oldalon fog össze — nem kell sok aloldal között váltania. A vállalkozási törzsadatok itt az alapot képezik: cégnév, jogi forma, cím és elérhetőségi adatok, amelyeket a számlákhoz, a portálokhoz és a vendégekkel folytatott kommunikációhoz használnak.",
            },
            { type: "h2", text: "Törzsadatok megnyitása és szerkesztése" },
            {
              type: "steps",
              items: [
                "Nyissa meg a /konto oldalt.",
                "Váltson a „Vállalkozási törzsadatok” szakaszra.",
                "Ellenőrizze a cégnevet, a címet, a telefonszámot és az e-mail-címet visszakérdezésekhez.",
                "Végezze el módosításait.",
                "Mentse el a szakaszt.",
              ],
            },
            { type: "h2", text: "Miért fontosak ezek az adatok" },
            {
              type: "p",
              text: "A vállalkozási törzsadatok bekerülnek a számlákba, a csatlakoztatott portáloknál történő regisztrációba és a jogilag kötelező adatokba, mint az impresszum. Egy hiányos vagy elavult cím a számlák hibás kiállításához vagy a portálcsatlakozások késedelméhez vezethet.",
            },
            {
              type: "ul",
              items: [
                "A cégnév és a jogi forma minden kiállított számlán megjelenik.",
                "A cím szükséges a portáloknál történő regisztrációhoz.",
                "Az elérhetőségi adatok tartalék útvonalként szolgálnak, ha a rendszerértesítések nem érkeznek meg.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ha módosítja számlázási címét, ezután ellenőrizze a már kiállított számlákat az [Elszámolás és csomagkalkulátor](/hilfe/konto-abo/abrechnung-tarifrechner) alatt — a meglévő bizonylatok nem kerülnek visszamenőlegesen módosításra.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Előfizetés és csomag",
          excerpt: "Csomagja határozza meg az objektumkontingenst — a lefoglalt objektumszámot bármikor megtekintheti a fiókban.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "myNextDays előfizetése egy objektumkontingenst tartalmaz: azt a maximális objektumszámot (szobák vagy üdülőobjektumok), amelyet egyidejűleg aktívan kezelhet. Az aktuálisan lefoglalt objektumszám az „Előfizetés és csomag” szakaszban jelenik meg a /konto alatt, a fennmaradó kontingenssel együtt.",
            },
            { type: "h2", text: "A kontingens szemmel tartása" },
            {
              type: "p",
              text: "A kontingenst szerveroldalon kényszerítik ki: ha eléri csomagja felső határát, nem hozhat létre további objektumot, amíg nem deaktivál egy meglévő objektumot, vagy nem bővíti csomagját. Ez attól függetlenül érvényes, hogy az új objektum szoba vagy üdülőobjektum — mindkettő egyformán számít a kontingensbe.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg a /konto oldalt és az „Előfizetés és csomag” szakaszt.",
                "Ellenőrizze a lefoglalt objektumszámot csomagja kontingenséhez viszonyítva.",
                "Szükség esetén válasszon nagyobb csomagot, hogy több objektumot hozhasson létre.",
                "Erősítse meg a csomagváltást.",
              ],
            },
            {
              type: "ul",
              items: [
                "Minden objektum egyenként számít a kontingensbe, objektumtípustól függetlenül.",
                "A csomagváltás azonnal hat az elérhető kontingensre.",
                "A visszaminősítés csak akkor lehetséges, ha az aktív objektumszám megfelel az új kontingensnek.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A kisebb kontingensű csomagra való visszaminősítés elutasításra kerül, amíg több objektum aktív, mint amennyit az új csomag megenged. Először deaktiválja a felesleges objektumokat.",
            },
            {
              type: "note",
              variant: "info",
              text: "A számlák és a csomagszámítás részleteiről bővebben: [Elszámolás és csomagkalkulátor](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Elszámolás és csomagkalkulátor",
          excerpt: "Számlázási cím, korábbi számlák és a csomagkalkulátor objektumkontingenséhez.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Az „Elszámolás és csomagkalkulátor” szakasz a /konto alatt mindent egybefog a számlázás körül: számlázási címét, a korábbi számlák letölthető listáját, valamint egy csomagkalkulátort, amellyel áttekintheti aktuális vagy egy nagyobb objektumkontingens költségeit.",
            },
            { type: "h2", text: "Számlázási cím és számlák" },
            {
              type: "p",
              text: "A számlázási cím eltérhet vállalkozása címétől, például ha a bizonylatokat egy könyvelőiroda kapja. A már kiállított számlákat időrendben rendezve találja; mindegyik letölthető PDF-ként.",
            },
            { type: "h2", text: "Csomagkalkulátor használata" },
            {
              type: "steps",
              items: [
                "Nyissa meg a /konto oldalt és az „Elszámolás és csomagkalkulátor” szakaszt.",
                "Adja meg a csomagkalkulátorban a kívánt objektumszámot.",
                "Hasonlítsa össze az eredő költségeket csomagszintenként.",
                "Szükség esetén váltson közvetlenül a kalkulátorból a megfelelő csomagra.",
              ],
            },
            {
              type: "ul",
              items: [
                "A csomagkalkulátor a fiókjához rögzített devizában mutatja a költségeket.",
                "A számlák tartósan letölthető formában elérhetők.",
                "A számlázási cím a vállalkozási törzsadatoktól függetlenül kezelhető.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Rendszeresen hasonlítsa össze a csomagkalkulátorral, hogy objektumkontingense még megfelel-e a ténylegesen lefoglalt objektumszámnak — lásd [Előfizetés és csomag](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Jelszó és e-mail módosítása",
          excerpt: "A biztonságkritikus módosítások ismételt bejelentkezést és megerősítési lépést igényelnek.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A jelszó és az e-mail-cím fiókja legbiztonságkritikusabb adatai közé tartozik. A myNextDays ezért mindkét módosításnál ismételt hitelesítést kér — a módosítást aktuális jelszavával erősíti meg, még akkor is, ha már bejelentkezett.",
            },
            { type: "h2", text: "Jelszó módosítása" },
            {
              type: "steps",
              items: [
                "Nyissa meg a /konto oldalt és a „Jelszó és e-mail módosítása” szakaszt.",
                "Adja meg jelenlegi jelszavát a megerősítéshez.",
                "Adja meg az új jelszót, és ismételje meg.",
                "Mentse el a módosítást.",
              ],
            },
            { type: "h2", text: "E-mail-cím módosítása" },
            {
              type: "p",
              text: "Az e-mail-cím váltása kettős jóváhagyással (double opt-in) zajlik: az aktuális jelszó megerősítése után megerősítő linket kap az ÚJ címre. A módosítás csak ennek a linknek a megkattintásával válik érvényessé — a régi cím addig aktív marad, hogy fiókjához való hozzáférés soha ne szakadjon meg.",
            },
            {
              type: "ul",
              items: [
                "Az aktuális jelszó nélkül sem a jelszó, sem az e-mail nem módosítható.",
                "Az új e-mail-cím megerősítő linkje időben korlátozottan érvényes.",
                "A megerősítésig a korábbi e-mail-cím marad aktív a bejelentkezéshez és az értesítésekhez.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Egy e-mail-módosítás után ellenőrizze a kétfaktoros hitelesítést is — lásd [Kétfaktoros hitelesítés](/hilfe/konto-abo/zwei-faktor) —, ha a helyreállítási kódok a régi címhez voltak kötve.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Kétfaktoros hitelesítés",
          excerpt: "Egy további bejelentkezési lépés védi fiókját a jogosulatlan hozzáférés ellen.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A kétfaktoros hitelesítés (2FA) jelszavát egy második tényezővel egészíti ki egy hitelesítő alkalmazáson keresztül. Így egy ellopott jelszó önmagában már nem elegendő a myNextDays fiókjába való bejelentkezéshez.",
            },
            { type: "h2", text: "2FA beállítása" },
            {
              type: "steps",
              items: [
                "Nyissa meg a /konto oldalt és a „Kétfaktoros hitelesítés” szakaszt.",
                "Erősítse meg aktuális jelszavát az ismételt hitelesítéshez.",
                "Olvassa be a megjelenített QR-kódot egy hitelesítő alkalmazással.",
                "Adja meg a generált kódot a megerősítéshez.",
                "Mentse el a megjelenített helyreállítási kódokat egy biztonságos helyen.",
              ],
            },
            { type: "h2", text: "2FA deaktiválása" },
            {
              type: "p",
              text: "A kétfaktoros hitelesítés kikapcsolása is ismételt hitelesítést igényel aktuális jelszavával. Így a myNextDays megakadályozza, hogy valaki egy már nyitva lévő munkamenettel egyszerűen kikapcsolja védelmét.",
            },
            {
              type: "ul",
              items: [
                "A helyreállítási kódok hozzáférést biztosítanak, ha a hitelesítő alkalmazás elveszik.",
                "Minden helyreállítási kód csak egyszer használható fel.",
                "A 2FA be- és kikapcsolása egyaránt jelszómegerősítéshez kötött.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Tárolja helyreállítási kódjait a hitelesítő alkalmazást futtató eszköztől elkülönítve, például egy jelszókezelőben.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Eszközelőzmények",
          excerpt: "Tartsa szemmel, mely eszközökről van bejelentkezve fiókja.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Az eszközelőzmények a /konto alatt megmutatja, mely eszközökön van jelenleg bejelentkezve fiókja — eszköztípussal, hozzávetőleges hellyel és az utolsó aktivitás időpontjával. Így gyorsan felismeri, ha egy bejelentkezés valóban Öntől származik-e.",
            },
            { type: "h2", text: "Eszközelőzmények ellenőrzése" },
            {
              type: "steps",
              items: [
                "Nyissa meg a /konto oldalt és az „Eszközelőzmények” szakaszt.",
                "Tekintse át a bejelentkezett eszközök listáját.",
                "Ha ismeretlen eszközt talál, jelentkeztesse ki.",
                "Ezután biztonságból módosítsa jelszavát.",
              ],
            },
            { type: "h2", text: "Mikor érdemes megnézni" },
            {
              type: "p",
              text: "Ellenőrizze az eszközelőzményeket különösen egy jelszó- vagy e-mail-módosítás után, valamint egy idegen vagy nyilvános eszköz használata után. Egy ismeretlen bejegyzés egyértelmű figyelmeztető jel jogosulatlan hozzáférésre.",
            },
            {
              type: "ul",
              items: [
                "Minden bejegyzés mutatja az eszköztípust, a hozzávetőleges helyet és az utolsó aktivitást.",
                "Az egyes eszközök célzottan kijelentkeztethetők anélkül, hogy a többit érintené.",
                "Egy ismeretlen eszköz azonnali jelszóváltás oka.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ha nem ismer fel egy eszközt, azonnal jelentkeztesse ki, majd módosítsa jelszavát a [Jelszó és e-mail módosítása](/hilfe/konto-abo/passwort-email-aendern) alatt.",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Adatvédelem",
          excerpt: "Keresőmotor-indexelés objektumonkénti szabályozása és adatainak exportálása.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Az „Adatvédelem” szakaszban a /konto alatt két dolgot vezérel: hogy objektumoldalait indexelhetik-e a keresőmotorok, és hogyan exportálhatja a myNextDaysnél tárolt adatait.",
            },
            { type: "h2", text: "Keresőmotor-indexelés objektumonként" },
            {
              type: "p",
              text: "Alapértelmezés szerint a keresőmotor-indexelés le van tiltva az új objektumoknál. Csak ha tudatosan bekapcsolja objektumonként, engedélyezhetik a keresőmotorok, mint a Google, hogy felvegyék az objektum nyilvános oldalát indexükbe. Így megtartja az irányítást afölött, mely objektumok találhatók meg a portálokon és a saját platformon kívül.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg a /konto oldalt és az „Adatvédelem” szakaszt.",
                "Válassza ki a kívánt objektumot a listából.",
                "Kapcsolja be vagy ki a keresőmotor-indexelést.",
                "Több objektumnál használja a gyűjtőkapcsolót, hogy egységesen állítsa be az összes objektumot.",
              ],
            },
            { type: "h2", text: "Adatok exportálása" },
            {
              type: "p",
              text: "Az adatexport funkción keresztül kérheti fiókjában tárolt adatainak teljes másolatát. Az exportot összeállítják, majd letöltésre bocsátják.",
            },
            {
              type: "ul",
              items: [
                "Az indexelés objektumonként egyénileg szabályozható, gyűjtőkapcsolóval az összes objektumhoz.",
                "Az új objektumok alapvetően keresőmotor-indexelés nélkül indulnak.",
                "Az adatexport strukturált formában tartalmazza fiók- és objektumadatait.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A keresőmotor-indexelés független a portálokon és a saját piactéren való láthatóságtól — kizárólag az objektum nyilvános oldalát érinti a keresőmotorokban.",
            },
          ],
        },
      ],
    },
  ],
};
