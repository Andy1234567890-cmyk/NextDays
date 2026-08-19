import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Objektumok és felszereltség",
  description: "Szobák és üdülőobjektumok létrehozása és karbantartása.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Objektumok kezelése",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Objektum = egy foglalható egység",
          excerpt: "Miért pontosan egy foglalható egység minden objektum a myNextDaysben.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A myNextDaysben egy objektum mindig pontosan egy foglalható egység — egy egyedi szoba egy hotelben, vagy egy teljes üdülőobjektum. Ez az elv attól függetlenül érvényes, hogy nyaralóházat, üdülő lakást vagy hotelt üzemeltet, és az elérhetőség, az árak és a foglalások alapja.",
            },
            { type: "h2", text: "Nincs épület alatta lévő szobákkal" },
            {
              type: "p",
              text: "Gyakori félreértés egy hotelépületet egy objektumként ábrázolni, amely alatt több szoba van. Ez a myNextDaysben nincs így megtervezve. Ha például egy nyolc kétágyas és négy egyágyas szobás hotelt üzemeltet, hozzon létre tizenkét egyedi objektumot — ne egyet, amelynek van egy szobaszám mezője.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Objektumszinten szándékosan nincs olyan mező, mint a „Szobák száma”. Minden szobának saját objektumra van szüksége, saját naptárral és saját árakkal.",
            },
            { type: "h2", text: "Üdülőobjektumok" },
            {
              type: "p",
              text: "Egy nyaralóház vagy üdülő lakás esetében a teljes objektum felel meg a foglalható egységnek. Itt nincs további felosztás — egy üdülőobjektum mindig önálló objektum saját naptárral.",
            },
            { type: "h2", text: "Miért fontos ez" },
            {
              type: "ul",
              items: [
                "Minden objektumnak saját elérhetőségi naptára van — a dupla foglalásokat objektumpontosan megelőzi.",
                "Az árak, a felszereltség és a fotók objektumonként érvényesek, nem épületenként.",
                "Egy objektum mindig pontosan egy tulajdonoshoz tartozik — nincs többszörös hozzárendelés.",
                "A csatorna-láthatóság (weboldal, platform-piactér, portálok) objektumonként szabályozott.",
              ],
            },
            {
              type: "p",
              text: "Hogy hogyan válassza ki a megfelelő objektumtípust szobájához vagy üdülőobjektumához, arról bővebben: [Objektumtípus meghatározása](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Objektumtípus meghatározása",
          excerpt: "Kategória, ingatlantípus és kínálati típus helyes hozzárendelése.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Az objektumtípus határozza meg, hogyan sorolják be és szűrik objektumát a portálokon és a platform-piactéren. Három egymásra épülő választómezőből áll, amelyeken az objektum létrehozásakor vagy szerkesztésekor halad végig.",
            },
            { type: "h2", text: "A három választási szint" },
            {
              type: "steps",
              items: [
                "Válassza ki először a kategóriát — például üdülőszálláshely vagy hotel.",
                "Erre építve válassza ki az ingatlantípust — például üdülő lakás, nyaralóház, kétágyas szoba vagy egyágyas szoba.",
                "Válassza ki a kínálati típust — például a teljes objektumot vagy egy privát szobát.",
                "Egészítse ki a választástól függően megjelenő kiegészítő mezőket, például az ágy típusát vagy az emeletet.",
              ],
            },
            { type: "h2", text: "Miért fontos a sorrend" },
            {
              type: "p",
              text: "A három legördülő menü egymástól függ: a kategória kiválasztása korlátozza az elérhető ingatlantípusokat, az ingatlantípus kiválasztása pedig a kínálati típusokat. Így csak értelmes kombinációk jönnek létre, amilyeneket a nagy portálok is használnak.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ha utólag módosítja a kategóriát, a myNextDays ellenőrzi, hogy az ingatlantípus és a kínálati típus még illeszkedik-e, és szükség esetén felszólítja az újbóli kiválasztásra.",
            },
            { type: "h2", text: "Objektumtípus szerkesztése" },
            {
              type: "p",
              text: "Nyissa meg a menüben az Objektumok pontot, majd a kívánt objektumot, és váltson az Alapadatok fülre. Ott találja a három legördülő menüt az Objektumtípus alatt. Ha elmenti módosítását, az új besorolás minden aktív csatornára továbbításra kerül.",
            },
            {
              type: "ul",
              items: [
                "Kategória: felsőbb szintű besorolás (pl. üdülőszálláshely, hotel)",
                "Ingatlantípus: konkrét objektumtípus (pl. üdülő lakás, kétágyas szoba)",
                "Kínálati típus: pontosan mi kerül lefoglalásra (pl. teljes objektum, privát szoba)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Felszereltség karbantartása",
          excerpt: "Felszereltségi jellemzők kiválasztása és naprakészen tartása.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Egy objektum felszereltsége jelentősen befolyásolja, mennyire jól megtalálható és szűrhető a portálokon. A vendégek célzottan szűrnek olyan jellemzőkre, mint a WiFi, a konyha vagy a parkoló — a hiányzó adatok kizárhatnak egy objektumot a keresési találatokból.",
            },
            { type: "h2", text: "Felszereltség kiválasztása" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot, és váltson a Felszereltség fülre.",
                "Válassza ki az összes érvényes jellemzőt az előre megadott listából.",
                "Szükség esetén egészítse ki a részleteket, mint a parkolóhelyek száma vagy a konyha típusa.",
                "Mentse el a módosításokat — automatikusan átkerülnek minden aktív portálra.",
              ],
            },
            { type: "h2", text: "Honnan származnak a jellemzők" },
            {
              type: "p",
              text: "A felszereltségi lista a nagy portálok jellemzőkatalógusát követi, hogy adatai ott helyesen besorolhatók legyenek. Saját, szabadon kitalált jellemzők nincsenek megtervezve, mivel azok nem lennének tisztán átvihetők a portálokra.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Ellenőrizze a felszereltséget minden építési változtatás után — például egy új légkondicionáló vagy egy további fürdőszoba esetén —, hogy az adatok minden csatornán naprakészek maradjanak.",
            },
            { type: "h2", text: "Gyakori jellemzőcsoportok" },
            {
              type: "ul",
              items: [
                "Alapfelszereltség: WiFi, fűtés, légkondicionáló",
                "Konyha és ellátás: teljesen felszerelt konyha, mosogatógép, kávéfőző",
                "Fürdőszoba és textília: saját fürdőszoba, mosógép, törölközők",
                "Kültéri terület: erkély, terasz, kert, parkoló",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Fotók és leírás",
          excerpt: "Kifejező képek és szövegek több foglalásért.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A fotók és a leírás a vendégek számára a legfontosabb döntési alap. Egy objektum csak akkor tehető közzé, ha legalább egy címfotó és egy leírás rögzítve van.",
            },
            { type: "h2", text: "Fotók feltöltése" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot, és váltson a Fotók fülre.",
                "Húzza a képfájlokat a feltöltési területre, vagy válassza ki azokat a fájlböngészőn keresztül.",
                "Állítson be egy címfotót — ez jelenik meg a keresési találatokban és a kártyákon.",
                "Rendezze a többi fotót húzással értelmes sorrendbe.",
              ],
            },
            { type: "h2", text: "Leírás megírása" },
            {
              type: "p",
              text: "Váltson a Leírás fülre, és adjon meg egy címet, valamint egy szöveget. Írja le konkrétan az objektum fekvését, különlegességeit és célközönségét — az általános frázisok kevésbé meggyőzőek a portálokon, mint a kézzelfogható részletek.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Más objektumok vagy az internetről származó fotók nem használhatók — a portálok ezt ellenőrzik, és szabályszegés esetén letilthatják az objektumokat.",
            },
            { type: "h2", text: "Ajánlások jó fotókhoz" },
            {
              type: "ul",
              items: [
                "Legalább öt fotó, ideálisan minden helyiségről egy",
                "Fekvő formátum, jó megvilágítás, vízjel nélkül",
                "A címfotó lehetőleg vonzóan és egyértelműen mutassa be az objektumot",
                "Rendszeres frissítés, különösen felújítások után",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Kapacitás és férőhelyek",
          excerpt: "Maximális vendégszám és ágyelosztás helyes rögzítése.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A kapacitás határozza meg, hány vendéget fogadhat be egy objektum, és minden keresésnél és foglalásnál ellenőrzésre kerül. A hibás adatok vagy elutasított kérésekhez, vagy túlzsúfoltsághoz vezetnek — mindkettőt el kell kerülnie.",
            },
            { type: "h2", text: "Kapacitás megadása" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot, és váltson a Kapacitás fülre.",
                "Adja meg a felnőttek maximális számát.",
                "Adja meg a gyerekek maximális számát, amennyiben engedélyezett.",
                "Rögzítse az ágyelosztást helyiségenként, például egy franciaágy és két egyszemélyes ágy.",
              ],
            },
            { type: "h2", text: "A kapacitás korlátai" },
            {
              type: "p",
              text: "Egy foglalási kérésnél a myNextDays automatikusan ellenőrzi, hogy a kért vendégszám a rögzített kapacitáson belül van-e. A maximális kapacitást meghaladó kéréseket elutasítja, illetve eleve nem jeleníti meg foglalhatóként.",
            },
            {
              type: "note",
              variant: "info",
              text: "Egy pótágy vagy gyerekágy csak akkor növeli a tényleges kapacitást, ha kifejezetten rögzíti az ágyelosztásban — máskülönben a maximális vendégszám változatlan marad.",
            },
            { type: "h2", text: "Tipikus hibaforrások" },
            {
              type: "ul",
              items: [
                "A maximális vendégszám túl magasra állítva, miközben csak kevés ágy van",
                "A gyerekek számáról megfeledkezve, pedig az objektum családokat céloz",
                "Az ágyelosztás egy felújítás után nem frissítve",
              ],
            },
            {
              type: "p",
              text: "Ha a kapacitás és a felszereltség nem illik össze, ellenőrizze emellett a [Felszereltség](/hilfe/objekte/ausstattung) fület is.",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Objektumállapot és láthatóság",
          excerpt: "Különbség az aktív/inaktív állapot és a három csatornatengely között.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A myNextDays két, gyakran összekevert dolgot különböztet meg: az objektumállapotot (aktív vagy inaktív) és a láthatóságot az egyes értékesítési csatornákon. Mindkettőt egymástól elkülönítve vezérli.",
            },
            { type: "h2", text: "Objektumállapot" },
            {
              type: "p",
              text: "Az active állapot azt jelenti, hogy egy objektum alapvetően eladható. Az inactive állapot teljesen üzemen kívül helyez egy objektumot — például egy hosszú távú felújításnál. Egy inaktív objektum egyik csatornán sem foglalható, a csatornakapcsolóktól függetlenül.",
            },
            { type: "h2", text: "A három csatornatengely" },
            {
              type: "p",
              text: "Ha egy objektum aktív, három egymástól független kapcsoló dönti el, pontosan hol látható:",
            },
            {
              type: "ul",
              items: [
                "Weboldal — láthatóság saját myNextDays weboldalán",
                "Platform-piactér — láthatóság a globális myBestDays piactéren",
                "Portálok — láthatóság a Bookingon, Airbnbn és társaikon",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ez a három tengely teljesen független az objektumállapottól és egymástól. Egy aktív objektum például csak a weboldalon lehet látható, de a portálokon nem.",
            },
            { type: "h2", text: "Állapot módosítása" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot, és váltson az Áttekintés fülre.",
                "Állítsa az állapotot aktívra vagy inaktívra.",
                "Szükség esetén állítsa be emellett a három csatornakapcsolót is a Láthatóság fülön.",
                "Mentse el a módosítást — azonnal érvénybe lép minden érintett csatornán.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Egyes napok rövid távú zárolásához ehelyett használja a Stop-Sell funkciót a naptárban — ez célzottan napokat zárol minden csatornán, anélkül hogy a teljes objektumot deaktiválná.",
            },
          ],
        },
      ],
    },
  ],
};
