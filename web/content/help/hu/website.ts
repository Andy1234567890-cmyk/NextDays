import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Weboldal-szerkesztő",
  description: "Saját foglalási weboldal létrehozása a szerkesztővel.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Weboldal-szerkesztő",
      articles: [
        {
          slug: "website-erstellen",
          title: "Weboldal létrehozása",
          excerpt: "A szerkesztővel néhány perc alatt létrehozhatja saját foglalási weboldalát.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A weboldal-szerkesztő saját foglalási weboldalt hoz létre Önnek — egy további értékesítési csatornát a portálok és a myBestDays piactér mellett. Ön megőrzi a teljes irányítást a felépítés, a tartalmak és a márkaépítés felett.",
            },
            { type: "h2", text: "Így hozhat létre egy weboldalt" },
            {
              type: "steps",
              items: [
                "Nyissa meg a menüben a Weboldal pontot.",
                "Kattintson a Weboldal létrehozása gombra.",
                "Válasszon egy sablont kiindulópontként az elrendezéshez.",
                "Erősítse meg a Weboldal létrehozása gombbal — közvetlenül a szerkesztőbe jut.",
              ],
            },
            { type: "h2", text: "Mit tartalmaz a szerkesztő" },
            {
              type: "ul",
              items: [
                "Vizuális szerkesztőt oldalakkal, rétegekkel és előnézeti nézettel",
                "Előre elkészített elemeket objektumlistákhoz, galériákhoz és kapcsolatfelvételi űrlapokhoz",
                "Közvetlen foglalási folyamatot, amely a naptári elérhetőségén alapul",
                "Testreszabható színeket, betűtípusokat és logót márkájához illeszkedve",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Kezdje egy olyan sablonnal, amely közel áll objektumtípusához — üdülőobjektum vagy hotel —, ez időt takarít meg később az elemek testreszabásánál.",
            },
            { type: "h2", text: "Következő lépések" },
            {
              type: "p",
              text: "A létrehozás után szabja testre az oldalakat és az elrendezést, lásd [Oldalak és elrendezés szerkesztése](/hilfe/website/seiten-layout), majd jelenítse meg objektumait a weboldalon, lásd [Objektumok megjelenítése a weboldalon](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Oldalak és elrendezés szerkesztése",
          excerpt: "Oldalak, rétegek és elemek testreszabása a vizuális szerkesztőben.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A szerkesztő három területre tagolódik: balra az oldal- és rétegáttekintés, középen weboldala előnézete, jobbra a kiválasztott elem beállításai.",
            },
            { type: "h2", text: "Oldal szerkesztése" },
            {
              type: "steps",
              items: [
                "Válassza ki balra az Oldalak alatt a kívánt oldalt.",
                "Kattintson az előnézetben egy elemre a kiválasztásához.",
                "Szabja testre jobbra az elem szövegét, képét vagy térközét.",
                "Húzza az elemeket fogd és vidd módszerrel a sorrend módosításához.",
              ],
            },
            { type: "h2", text: "Új oldalak és elemek hozzáadása" },
            {
              type: "p",
              text: "Az Oldal hozzáadása gombbal további aloldalakat hozhat létre, például Rólunk vagy Kapcsolat. Egy oldalon belül az Elem hozzáadása gombbal új szakaszokat illeszthet be, mint galéria, értékelések vagy kapcsolatfelvételi űrlap.",
            },
            {
              type: "ul",
              items: [
                "A kezdőlap, az objektumáttekintés és a kapcsolat minden sablonnál előre kitöltött",
                "A további oldalak szabadon elnevezhetők és felvehetők a navigációba",
                "Az elemek reszponzívak, és alkalmazkodnak asztali géphez, tablethez és okostelefonhoz",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A szerkesztőben végzett módosítások eleinte csak piszkozatok. Csak a Közzététel gombra kattintva kerülnek át nyilvános weboldalára.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Domain összekapcsolása",
          excerpt: "Saját domain összekapcsolása myNextDays weboldalával.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Alapértelmezés szerint weboldala egy myNextDays aldomainen érhető el. Ha helyette saját domaint szeretne használni, például az-on-vallalkozasa.hu, kapcsolja össze azt a Domain területen.",
            },
            { type: "h2", text: "Domain rögzítése" },
            {
              type: "steps",
              items: [
                "Nyissa meg a weboldalon a beállításokat, majd ott a Domain pontot.",
                "Adja meg saját domainjét, és kattintson az Összekapcsolás gombra.",
                "Állítsa be domain-szolgáltatójánál a megjelenített DNS-bejegyzéseket.",
                "Várja meg a megerősítést — az ellenőrzés automatikusan, a háttérben történik.",
              ],
            },
            { type: "h2", text: "DNS-bejegyzések helyes beállítása" },
            {
              type: "p",
              text: "A myNextDays pontosan megjeleníti a domain-szolgáltatójánál szükséges bejegyzéseket. A kapcsolat csak akkor válik aktívvá, amint ezek a bejegyzések helyesen be vannak állítva, és világszerte elterjedtek — ez szolgáltatótól függően néhány óráig is eltarthat.",
            },
            {
              type: "ul",
              items: [
                "CNAME- vagy A-bejegyzés beállítása a megjelenített útmutató szerint",
                "A meglévő, ellentmondó bejegyzések eltávolítása ugyanazon domainhez előzőleg",
                "A https-tanúsítvány a sikeres kapcsolat után automatikusan kiadásra kerül",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Helyesen beállított DNS-bejegyzések nélkül weboldala saját domainje alatt nem lesz elérhető — ellenőrizze gondosan az írásmódot szolgáltatója adatai alapján.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Objektumok megjelenítése a weboldalon",
          excerpt: "Hogy mely objektumok láthatók és foglalhatók a weboldalon, azt objektumonként külön szabályozza.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Ahhoz, hogy egy objektum megjelenjen weboldalán, a weboldal-láthatóságot be kell kapcsolni ehhez az objektumhoz. Ez a kapcsoló független a myBestDays piactéren vagy a portálokon való láthatóságtól.",
            },
            { type: "h2", text: "Objektum engedélyezése a weboldalhoz" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot az Objektumok alatt.",
                "Váltson a Láthatóság fülre.",
                "Aktiválja a Weboldal kapcsolót.",
                "Váltson a weboldalra, és ellenőrizze az objektumáttekintés elemet az előnézetben.",
              ],
            },
            { type: "h2", text: "Sorrend és megjelenítés testreszabása" },
            {
              type: "p",
              text: "Az objektumáttekintés elemben állítja be, hogy az objektumok automatikusan elérhetőség szerint rendeződjenek, vagy fix sorrendet határozzon meg. Minden objektum megjeleníti a címfotót, az alapárat a hozzá rendelt devizában és a legfontosabb felszereltségi jellemzőket.",
            },
            {
              type: "ul",
              items: [
                "Automatikus rendezés elérhetőség szerint vagy kézi sorrend",
                "Szűrés objektumtípus vagy felszereltség szerint opcionálisan aktiválható",
                "A foglalási lépések közvetlenül a weboldalon zajlanak, portál-kitérő nélkül",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Egy objektum, amelynek nincs aktiválva a weboldal-láthatósága, rejtve marad az objektumáttekintésben, még akkor is, ha a piactéren vagy a portálokon látható.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Weboldal közzététele",
          excerpt: "A piszkozatok csak a Közzététel gombra kattintva válnak nyilvánosan láthatóvá.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Amíg a szerkesztőben dolgozik, csak Ön látja az aktuális piszkozatot. Csak a Közzététel gombra kattintva válnak a módosítások láthatóvá domainje alatt minden látogató számára.",
            },
            { type: "h2", text: "Így teheti közzé" },
            {
              type: "steps",
              items: [
                "Nyissa meg a szerkesztőben az előnézetet, és ellenőrizze az összes oldalt.",
                "Kattintson jobbra fent a Közzététel gombra.",
                "Erősítse meg a párbeszédablakot — a weboldal közvetlenül ezután élesbe kerül.",
                "Nyissa meg domainjét egy új lapon az eredmény ellenőrzéséhez.",
              ],
            },
            { type: "h2", text: "Piszkozatok és visszaállítás" },
            {
              type: "p",
              text: "Amíg még nem tett közzé módosítást, bármikor visszatérhet az utoljára közzétett állapothoz anélkül, hogy a piszkozatot véglegesen elveszítené — ehhez használja a Piszkozat elvetése opciót a weboldal-beállításokban.",
            },
            {
              type: "ul",
              items: [
                "A közzétett módosítások azonnal láthatók domainje alatt",
                "A nem közzétett piszkozat belső marad, amíg meg nem erősíti",
                "Minden közzététel dátummal rögzítésre kerül az előzményekben",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "A közzététel előtt ellenőrizze a mobil nézetet az előnézetben — a legtöbb vendég okostelefonon keresztül hívja meg a foglalási weboldalakat.",
            },
          ],
        },
      ],
    },
  ],
};
