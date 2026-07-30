import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Weboldal",
  description: "Weboldalának optimális kihasználása.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Weboldal",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Weboldalának élesítése",
          excerpt: "Így teszi közzé saját weboldalát önálló értékesítési csatornaként.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet",
            },
            {
              type: "p",
              text: "A weboldala önálló értékesítési csatorna a portálok és a platform mellett. Az oldalakat a szerkesztőben állítja össze, de a weboldal csak a közzététellel válik láthatóvá a vendégek számára, és objektumai csak ekkor jelennek meg foglalhatóként.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg a weboldal-szerkesztőt, és ellenőrizze, hogy minden kívánt oldal tartalommal van-e feltöltve.",
                "Az Objektum fülön objektumonként válassza ki, hogy az objektum látható legyen-e a weboldalon — ez a láthatóság független a portáloktól és a platformtól.",
                "Az élesítés előtt ellenőrizze az előnézetet asztali és mobil nézetben egyaránt.",
                "Kattintson a „Közzététel” gombra, hogy a weboldalt elérhetővé tegye a vendégek számára.",
                "A közzététel után ellenőrizze a nyilvános URL-t, és teszteljen egy példa foglalást a weboldalon keresztül.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Egy objektum weboldal-láthatósága önálló tengely — egy objektum aktív lehet a portálokon, miközben a weboldalon el van rejtve, és fordítva. Részletek: [Saját domain beállítása](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Saját domain beállítása",
          excerpt: "Így köti össze saját domainjét a myNextDays weboldalával.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet",
            },
            {
              type: "p",
              text: "Egy saját domain, mint például www.az-on-vallalkozasa.hu, professzionálisabb hatást kelt egy alapértelmezett címnél, és erősíti márkáját azon vendégek felé, akik közvetlenül Önnél szeretnének foglalni.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg a weboldal-szerkesztőben a „Domain” területet, és adja meg a kívánt saját domaint.",
                "Állítsa be domain-szolgáltatójánál a megjelenített DNS-bejegyzéseket (jellemzően CNAME vagy A-rekord).",
                "Várjon, amíg a domain csatlakoztatottként és az SSL-tanúsítvány aktívként jelenik meg — ez szolgáltatótól függően néhány óráig is eltarthat.",
                "Tesztelje a saját domain elérését egy privát böngészőablakban, hogy kizárja a gyorsítótárazott régi bejegyzéseket.",
                "Ellenőrizze, hogy a régi alapértelmezett címek továbbra is átirányítanak az új domainre, hogy a meglévő linkek ne vezessenek a semmibe.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A DNS-bejegyzéseket csak a megjelenítettek szerint módosítsa — hibás értékek megzavarhatják domainje meglévő e-mail beállításait. Kétség esetén egyeztessen domain-szolgáltatójával, mielőtt meglévő bejegyzéseket felülírna.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Közvetlen foglalások növelése",
          excerpt: "Így terelhet több vendéget saját weboldalára a portálok helyett.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet",
            },
            {
              type: "p",
              text: "A saját weboldalon keresztüli foglalások vállalkozása számára többnyire kedvezőbbek, mint a portálokon keresztüliek, mivel itt nem merül fel portáljutalék. Néhány célzott intézkedéssel növelheti a közvetlen foglalások arányát weboldalán, mint önálló csatornán keresztül.",
            },
            {
              type: "steps",
              items: [
                "Győződjön meg róla, hogy minden foglalható objektum látható a weboldalon, aktuális fotókkal és leírásokkal ellátva.",
                "Állítson be egy weboldal-exkluzív kedvezményt vagy előnyt, például kisebb árengedményt a portálokhoz képest.",
                "Linkelje saját domainjét a foglalási visszaigazolásokban és a már egyszer foglalt vendégekkel folytatott kommunikációban.",
                "Rendszeresen ellenőrizze a foglalási statisztikát, hogy nyomon kövesse a weboldal arányát az összes foglaláson belül az idő múlásával.",
                "Optimalizálja a weboldal betöltési idejét és mobil megjelenítését, mivel a vendégek nagy része okostelefonon keresztül foglal.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Egy weboldal-exkluzív előny csak akkor működik, ha a vendégek egyáltalán megtalálják a weboldalt — aktívan hívja fel rá a figyelmet, ahelyett hogy csak a portálokra hagyatkozna. A közzétételről lásd: [Weboldalának élesítése](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
