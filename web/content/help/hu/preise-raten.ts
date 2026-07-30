import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Árak és díjszabások",
  description: "Árazási tervek, szezonárak és dinamikus árak.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Árazás",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Alapár és deviza",
          excerpt: "Így állítja be az alapárat, és így rendeli hozzá objektumához a helyes devizát.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Minden objektum a myNextDaysben pontosan egy foglalható egység — egy egyedi szoba vagy egy üdülőobjektum. Ehhez az egységhez rögzít egy alapárat, valamint egy központi devizát, amely a teljes objektumra érvényes.",
            },
            { type: "h2", text: "Deviza központi meghatározása" },
            {
              type: "p",
              text: "Az objektumdeviza objektumonként egyszer kerül beállításra, és automatikusan érvényes minden árazási tervre, amelyet ehhez az objektumhoz hoz létre. Nincs külön deviza-tartalék érték — ha hiányzik a deviza, nem menthet árakat.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg objektumát az „Objektumok” alatt.",
                "Váltson az „Árak” fülre.",
                "Válassza ki az „Objektumdeviza” alatt a megfelelő devizát.",
                "Adja meg az alapárat a standard kapacitásra.",
                "Mentse el a módosításokat.",
              ],
            },
            { type: "h2", text: "Mi történik egy devizaváltásnál" },
            {
              type: "p",
              text: "Ha utólag módosítja az objektumdevizát, ez az objektum összes meglévő árazási tervére hatással van, mivel ezeket mindig az objektumdevizában kezelik. Ezután ellenőrizze árait, mielőtt ismét átküldi őket a portálokra.",
            },
            {
              type: "ul",
              items: [
                "Egy objektumnak pontosan egy devizája van — nem több árazási tervenként.",
                "Az alapár a levezetett díjak kiindulási értéke.",
                "Az összegek mindig a rögzített objektumdevizával jelennek meg.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Rögzített deviza nélkül nem menthető ár, és nem küldhető át díj a portálokra. Ha egy áramódosítás meghiúsul, először ezt ellenőrizze.",
            },
            {
              type: "note",
              variant: "info",
              text: "A levezetett árakról bővebben: [Levezetett díjak](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Árazási tervek létrehozása",
          excerpt: "Az árazási tervek ötvözik az árat, a lemondási feltételeket és az ellátást egy objektumhoz.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Egy árazási terv meghatározza, milyen feltételek mellett foglalható egy objektum: ár, lemondási szabályok, ellátás és minimum tartózkodás. Egy objektum egyidejűleg több árazási tervet is kínálhat, például egy rugalmas és egy nem lemondható tervet.",
            },
            { type: "h2", text: "Új árazási terv létrehozása" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot, és váltson az „Árak” fülre.",
                "Kattintson az „Új árazási terv létrehozása” gombra.",
                "Adjon neki beszédes nevet, pl. „Rugalmas” vagy „Nem lemondható”.",
                "Határozza meg, hogy a terv alapdíj vagy levezetett díj legyen.",
                "Rögzítse a lemondási feltételeket és az ellátást.",
                "Mentse el és aktiválja az árazási tervet.",
              ],
            },
            { type: "h2", text: "Alapdíj kontra további árazási tervek" },
            {
              type: "p",
              text: "Először hozza létre alapdíját (gyakran „BAR”-nak nevezve, Best Available Rate). Minden további árazási tervet vagy önállóan kezelhet, vagy ebből az alapdíjból vezethet le.",
            },
            {
              type: "ul",
              items: [
                "Alapdíj: kézzel karbantartott alapár éjszakánként.",
                "További árazási tervek: önállóan vagy az alapdíjra vetített felárként/kedvezményként.",
                "Minden árazási terv egyénileg átvihető a portálokra.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Tartsa átláthatóan alacsonyan az árazási tervek számát objektumonként — túl sok variáció megnehezíti a vendégek számára az összehasonlítást, és növeli a karbantartási terhet.",
            },
            {
              type: "note",
              variant: "info",
              text: "A felárak és kedvezmények részleteiről bővebben: [Levezetett díjak](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Levezetett díjak",
          excerpt: "A levezetett árazási tervek automatikusan egy alapdíjból számolódnak ki.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Egy levezetett díj olyan árazási terv, amelynek árát nem kézzel karbantartják, hanem automatikusan egy alapdíjból számolják ki — fix felárként, kedvezményként vagy százalékos értékként. Ez karbantartási időt takarít meg, mivel az alapdíj módosítása automatikusan frissíti az összes levezetett tervet.",
            },
            { type: "h2", text: "Tipikus példa" },
            {
              type: "p",
              text: "Egy gyakori minta a reggelis terv, amely az ellátás nélküli alapdíjból van levezetve: a reggeli ára éjszakánkénti és személyenkénti felárként van meghatározva az alapdíjra vetítve. Ha módosítja az alapdíjat, a reggeli ára automatikusan alkalmazkodik.",
            },
            { type: "h2", text: "Levezetett díj beállítása" },
            {
              type: "steps",
              items: [
                "Nyissa meg a kívánt árazási tervet az „Árak” fülön.",
                "Válassza áreforrásként a „Levezetve ebből: …” opciót, és a hozzá tartozó alapdíjat.",
                "Határozza meg, hogy a különbség fix összeg vagy százalékos érték legyen.",
                "Adja meg, hogy felárról vagy kedvezményről van-e szó.",
                "Mentse el a hozzárendelést.",
              ],
            },
            {
              type: "ul",
              items: [
                "Felár: pl. ellátás, későbbi lemondhatóság.",
                "Kedvezmény: pl. nem lemondható terv árelőnnyel.",
                "Az alapdíj marad az egyetlen kézzel karbantartott forrás.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Egy levezetett díj nem írható felül egyidejűleg kézzel. Először szüntesse meg a levezetést, ha egy egyedi árat eltérően szeretne beállítani.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Szezon- és hétvégi árak",
          excerpt: "Az árak célzott igazítása szezonális időszakokra és hétvégékre.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A kereslet az év folyamán és a héten belül is ingadozik. Szezon- és hétvégi árakkal igazítja az alapárat meghatározott időszakokra vagy hétköznapokra, anélkül hogy minden napra egyenként be kellene lépnie a naptárba.",
            },
            { type: "h2", text: "Szezonidőszak létrehozása" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumban az „Árak” fület és a „Szezonárak” területet.",
                "Hozzon létre egy új időszakot kezdő- és záródátummal.",
                "Rögzítse az árat vagy az alapártól való százalékos eltérést erre az időszakra.",
                "Mentse el a szezonidőszakot.",
              ],
            },
            { type: "h2", text: "Hétvégi árak" },
            {
              type: "p",
              text: "Emellett egyes hétköznapokat, például pénteket és szombatot, saját felárral láthat el. Ez a felár a mindenkori érvényes szezon- vagy alapár mellé adódik hozzá.",
            },
            {
              type: "ul",
              items: [
                "A szezonárak összefüggő időszakokra hatnak.",
                "A hétvégi árak naponta hatnak, a szezontól függetlenül.",
                "Mindkét szabály kombinálható.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ha több szezonidőszak fedi egymást, az utoljára létrehozott, illetve legspecifikusabb szabály érvényesül. Mentés után ellenőrizze a naptárat.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Automatikus, keresletalapú kiigazításokhoz emellett a [Dinamikus árak](/hilfe/preise-raten/dynamische-preise) funkció is alkalmas.",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Dinamikus árak",
          excerpt: "Az árak automatikus igazítása a kereslethez, az előrelátási időhöz és a kihasználtsághoz.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A dinamikus árak automatikusan igazítják az alapárat olyan tényezők alapján, mint a foglalási előrelátási idő, az aktuális kihasználtság és a kereslet — hasonlóan ahhoz, ahogyan a nagy portálok teszik saját ár-ajánlásaikban. Így reagálhat a piaci változásokra anélkül, hogy minden napot kézzel kellene utánaigazítania.",
            },
            { type: "h2", text: "Dinamikus árak aktiválása" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumban az „Árak” fület és a „Dinamikus árak” területet.",
                "Aktiválja a funkciót az objektum alapdíjához.",
                "Határozzon meg egy alsó és egy felső árhatárt.",
                "Adja meg, mennyire befolyásolhatja a kihasználtság az árat.",
                "Mentse el a beállításokat.",
              ],
            },
            { type: "h2", text: "Határok és biztonság" },
            {
              type: "p",
              text: "Az alsó és felső árhatár megakadályozza, hogy az automatikus algoritmus vállalkozása számára nem fenntartható árakat állítson be. A levezetett árazási tervek automatikusan követik a dinamikusan kiszámított alapdíjat.",
            },
            {
              type: "ul",
              items: [
                "Az alsó árhatár véd a túl alacsony árak ellen gyenge kereslet esetén.",
                "A felső árhatár véd a túlzott árak ellen magas kereslet esetén.",
                "A levezetett díjak automatikusan átveszik az új alapdíjat.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A dinamikus árak csak az alapdíjra hatnak. A levezetés nélküli, kézzel fixen beállított árazási tervek automatikusan nem változnak vele.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Hosszútávú kedvezmények",
          excerpt: "Kedvezmények beállítása hosszabb tartózkodásokra és korai foglalásokra.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A hosszútávú kedvezmények jutalmazzák a vendégeket a hosszabb foglalásokért vagy a korai foglalásért. Százalékos értékként kerülnek alkalmazásra a tartózkodás teljes árára, és objektumonként egymástól függetlenül konfigurálhatók.",
            },
            { type: "h2", text: "Kedvezménytípusok" },
            {
              type: "ul",
              items: [
                "Hosszútávú kedvezmény: egy bizonyos éjszakaszámtól, pl. 7 vagy 28 éjszakától.",
                "Korai foglalási kedvezmény: kellően korai foglalás esetén.",
                "Last minute kedvezmény: rövid távú foglalás esetén, közel az érkezési dátumhoz.",
              ],
            },
            { type: "h2", text: "Kedvezmény beállítása" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumban az „Árak” fület és a „Kedvezmények” területet.",
                "Válassza ki a kívánt kedvezménytípust.",
                "Határozza meg a küszöbértéket, pl. minimum éjszakák vagy előrelátási idő.",
                "Adja meg a kedvezményt százalékban.",
                "Mentse el a szabályt.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A kedvezmények az adott árazási terv teljes árára hatnak, és már az árazási áttekintésben is megjelennek a vendég számára.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombinálja a hosszútávú kedvezményeket a [Minimum és maximum tartózkodás](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt) funkcióval, hogy célzottan ösztönözze a hosszabb foglalásokat.",
            },
          ],
        },
      ],
    },
  ],
};
