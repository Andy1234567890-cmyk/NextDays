import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Üzenetek és vendégek",
  description: "Postaláda, sablonok és vendégkommunikáció.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kommunikáció",
      articles: [
        {
          slug: "posteingang",
          title: "A platform postaládája",
          excerpt: "Objektumai összes vendégüzenete központilag a platform postaládájában fut össze.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Egy postaláda minden objektumhoz" },
            {
              type: "p",
              text: "A platform postaládája egy helyen egyesíti vendégei összes üzenetét — függetlenül attól, hogy melyik objektumon vagy időszakon keresztül folyik a beszélgetés. Az /nachrichten alatt nyithatja meg, ahol minden beszélgetés önálló szálként jelenik meg.",
            },
            { type: "h2", text: "A postaláda felépítése" },
            {
              type: "ul",
              items: [
                "Bal oszlop: az összes beszélgetés listája, a legújabb elöl",
                "Középső oszlop: az aktív üzenetváltás a vendéggel",
                "Jobb oszlop: a foglalás kontextusa — időszak, objektum, vendégadatok",
              ],
            },
            { type: "h2", text: "Válasz egy üzenetre" },
            {
              type: "steps",
              items: [
                "Nyissa meg az /nachrichten oldalt, és válassza ki a kívánt beszélgetést",
                "Írja meg válaszát a szövegmezőben, vagy használjon gyorsválaszt",
                "Küldje el az üzenetet — a vendég ugyanazon a csatornán kapja meg, amelyen írt",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A platform postaládája kizárólag az Ön és vendégei közötti közvetlen kommunikációt mutatja a myNextDaysen — a portálokról érkező üzeneteket továbbra is ott kezeli.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Gyorsválaszok",
          excerpt: "A gyakori kérdésekre szánt sablonok időt takarítanak meg a vendégkapcsolatban.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Mik a gyorsválaszok" },
            {
              type: "p",
              text: "A gyorsválaszok előre megfogalmazott szövegblokkok az ismétlődő kérdésekhez — például az érkezésről, a WiFi-jelszóról vagy a parkolási helyzetről. Ahelyett, hogy minden választ újra begépelne, egy kattintással illesztheti be a megfelelő sablont a [platform postaládájába](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Gyorsválasz létrehozása" },
            {
              type: "steps",
              items: [
                "Nyissa meg az /nachrichten oldalt, és kattintson a „Gyorsválaszok kezelése” gombra",
                "Kattintson az „Új sablon” gombra, és adjon neki címet, például „Check-in információk”",
                "Írja meg a válasz szövegét; a helyőrzők, mint a vendégnév vagy az érkezési dátum, küldéskor automatikusan behelyettesítésre kerülnek",
                "Mentse el a sablont — ettől kezdve minden beszélgetésben elérhető",
              ],
            },
            { type: "h2", text: "Gyorsválaszok használata a mindennapokban" },
            {
              type: "p",
              text: "Az üzenetablakban a villám ikonon keresztül nyithatja meg a sablonlistát, kiválasztja a megfelelő választ, és szükség esetén még egyénileg testre szabja, mielőtt elküldi.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Hozzon létre sablonokat a leggyakoribb öt-tíz kérdéshez — ez a gyakorlatban a beérkező üzenetek nagy részét lefedi.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Automatikus üzenetek",
          excerpt: "A visszaigazolások, check-in információk és emlékeztetők automatikusan is elküldhetők a vendégeknek.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Ismétlődő üzenetek automatizálása" },
            {
              type: "p",
              text: "Ahelyett, hogy a foglalási visszaigazolásokat, check-in tájékoztatókat vagy köszönő üzeneteket kézzel küldené el, egyszer szabályként rögzítheti őket — a myNextDays ezután automatikusan elküldi őket a megfelelő időpontban a tartózkodás előtt, alatt vagy után.",
            },
            { type: "h2", text: "Tipikus kiváltók automatikus üzenetekhez" },
            {
              type: "ul",
              items: [
                "Közvetlenül a foglalás után — visszaigazolás a legfontosabb adatokkal",
                "Néhány nappal az érkezés előtt — check-in információk és beléptető kód",
                "Távozás napján — köszönet és kérés értékelésre",
              ],
            },
            { type: "h2", text: "Automatikus üzenet beállítása" },
            {
              type: "steps",
              items: [
                "Nyissa meg az /nachrichten oldal „Automatikus üzenetek” szakaszát",
                "Válassza ki a kiváltót, például „X nappal érkezés előtt”",
                "Rögzítse a szöveget — a helyőrzők, mint a vendégnév, objektum vagy érkezési dátum, automatikusan kitöltésre kerülnek",
                "Aktiválja a szabályt; ez minden objektumra érvényes, ha nincs másképp korlátozva",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Az automatikus üzenetek teljesen normálisan megjelennek a [platform postaládájában](/hilfe/nachrichten/posteingang), és ott bármikor utólag megtekinthetők.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Üzenetek blokkolása",
          excerpt: "Egy személyt közvetlenül az üzenetváltásból kiindulva letilthat a további kapcsolatfelvételtől.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Mikor érdemes blokkolni" },
            {
              type: "p",
              text: "Sértő üzenetek, zaklatás vagy ismételten nem megfelelő viselkedés esetén közvetlenül az üzenetszálból blokkolhat egy személyt. Egy blokkolt személy ezután nem tud Önnek új üzenetet írni, és nem tud új foglalást létrehozni Önnél.",
            },
            { type: "h2", text: "Személy blokkolása a szálból" },
            {
              type: "steps",
              items: [
                "Nyissa meg az érintett beszélgetést a [platform postaládájában](/hilfe/nachrichten/posteingang)",
                "Kattintson a szál tetején a menüre, és válassza a „Személy blokkolása” lehetőséget",
                "Erősítse meg a folyamatot — a blokkolás azonnal érvénybe lép",
              ],
            },
            { type: "h2", text: "Mit jelent a blokkolás — és mit nem" },
            {
              type: "ul",
              items: [
                "A blokkolt személy új üzenetei többé nem kerülnek kézbesítésre",
                "A személy új foglalási kérelmei elutasításra kerülnek",
                "Ha e személynek jelenleg fut egy foglalása, a kommunikáció kivételesen a tartózkodás időtartamára továbbra is lehetséges marad",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A blokkolás bármikor visszavonható a fiók „Blokkolt személyek” áttekintésében. Blokkolás előtt ellenőrizze, hogy nincs-e már folyamatban lévő foglalás.",
            },
          ],
        },
      ],
    },
  ],
};
