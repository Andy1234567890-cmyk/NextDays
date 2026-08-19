import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Naptár és elérhetőség",
  description: "Foglalási naptár, Stop-Sell és minimum tartózkodás.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Naptár",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "A foglalási naptár olvasása",
          excerpt: "Így olvashatja helyesen a foglalásokat, elérhetőséget és árakat a foglalási naptárban.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A foglalási naptár egy pillantással megmutatja, mely éjszakák vannak lefoglalva, elérhetők vagy zárolva. Üdülőobjektumoknál objektumonként egy sort lát, hoteleknél egy egymásba ágyazott nézetet, szobakategóriánként és árazási tervenként egy-egy sorral.",
            },
            { type: "h2", text: "A nézet felépítése" },
            {
              type: "steps",
              items: [
                "Nyissa meg a naptárat a „Foglalási naptár” menüponton keresztül.",
                "Válassza ki fent a megtekinteni kívánt időszakot.",
                "Szükség esetén szűrjön egyes objektumokra vagy szobakategóriákra.",
                "Kattintson egy napra az ár és elérhetőség részleteinek megnyitásához.",
                "Kattintson egy foglalt időszakra a hozzá tartozó foglalás megnyitásához.",
              ],
            },
            { type: "h2", text: "Színek és szimbólumok" },
            {
              type: "ul",
              items: [
                "Foglalt: az időszakot egy foglalás lefoglalta.",
                "Elérhető: a nap minden aktív csatornán lefoglalható.",
                "Zárolt: a nap Stop-Sell vagy kézi zárolás miatt nem foglalható.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A foglalási naptár minden sora pontosan egy foglalható egységet jelent — egy szobát vagy egy üdülőobjektumot. Nincs konténer-sor, amely egyszerre több szobát fogna össze.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Az egyes napok célzott nyitásáról és zárásáról bővebben: [Elérhetőség beállítása](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Elérhetőség beállítása",
          excerpt: "Egyes napok vagy időszakok célzott nyitása és zárása.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Az elérhetőség határozza meg, hogy egy objektum egy adott napon foglalható-e. Egyes napokat vagy teljes időszakokat nyithat meg vagy zárhat le, közvetlenül a foglalási naptárban.",
            },
            { type: "h2", text: "Időszak szerkesztése" },
            {
              type: "steps",
              items: [
                "Nyissa meg a kívánt objektum foglalási naptárát.",
                "Jelölje ki a kívánt időszakot kattintással és húzással.",
                "Válassza a műveletek menüben az „Elérhetőség módosítása” opciót.",
                "Erősítse meg, hogy az időszakot meg kell-e nyitni vagy le kell-e zárni.",
                "Mentse el a módosítást.",
              ],
            },
            { type: "h2", text: "Hatás a csatornákra" },
            {
              type: "p",
              text: "Egy elérhetőség-módosítás minden olyan értékesítési csatornára hat, amelyen az objektum látható: portálok, mint a Booking, Airbnb és társaik, a saját platform, valamint az alkalmazás. A portálokra történő átvitel automatikusan, a háttérben zajlik.",
            },
            {
              type: "ul",
              items: [
                "Nyitás: a nap minden aktív csatornán foglalhatóvá válik.",
                "Zárás: a nap eltűnik a foglalhatóságból, de a naptárban láthatóként marad.",
                "A már meglévő foglalásokat egy elérhetőség-módosítás nem érinti.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ne zárjon le egy időszakot azzal a szándékkal, hogy teljesen és tartósan kizárja az értékesítésből — erre a célra a Stop-Sell a megfelelő funkció, lásd [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-Sell",
          excerpt: "A Stop-Sell azonnal, egyszerre zárol egy napot minden értékesítési csatornán.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A Stop-Sell a leggyorsabb lehetőség arra, hogy egyetlen napot teljesen kivonjon az értékesítésből. A puszta elérhetőség-módosítással ellentétben a Stop-Sell keményen és azonnal hat minden csatornán egyszerre — a portálokon, a saját platformon és az alkalmazásban.",
            },
            { type: "h2", text: "Stop-Sell beállítása" },
            {
              type: "steps",
              items: [
                "Nyissa meg az érintett objektum foglalási naptárát.",
                "Válassza ki a kívánt napot vagy időszakot.",
                "Kattintson a műveletek menüben a „Stop-Sell aktiválása” gombra.",
                "Erősítse meg a zárolást.",
              ],
            },
            { type: "h2", text: "Mikor érdemes Stop-Sellt használni" },
            {
              type: "ul",
              items: [
                "Rövid távú karbantartási munkák vagy műszaki problémák az objektumban.",
                "Egy különleges eset, amikor azonnal és kivétel nélkül nem szeretne új foglalást.",
                "Egy gyors, platformszintű vészzárolás anélkül, hogy minden csatornát külön kellene kezelni.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A Stop-Sell nem ismer csatornaspecifikus kivételt: ha egy nap zárolva van, egyetlen vendég sem tud foglalni semmilyen csatornán, még a recepción vagy közvetlen megkeresésen keresztül sem.",
            },
            {
              type: "note",
              variant: "info",
              text: "Tartós saját használatra vagy tervezett karbantartásra ehelyett a [Kézi zárolás](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung) alkalmas.",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Minimum és maximum tartózkodás",
          excerpt: "Milyen hosszan foglalhatnak a vendégek legalább vagy legfeljebb.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A minimum és maximum tartózkodással meghatározza, hány éjszakát foglalhat egy vendég legalább vagy legfeljebb egy érkezési napra. Ez segít elkerülni a rövid résfoglalásokat, vagy célzottan hosszabb tartózkodásokra pozicionálni objektumát.",
            },
            { type: "h2", text: "Szabály beállítása" },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumban a foglalási naptárat vagy az „Árak” fület.",
                "Válassza ki az érintett időszakot.",
                "Adja meg a „Minimum tartózkodás” alatt a minimális éjszakaszámot.",
                "Opcionálisan adja meg a „Maximum tartózkodás” alatt a maximális éjszakaszámot.",
                "Mentse el a szabályt.",
              ],
            },
            { type: "h2", text: "Tipikus alkalmazási esetek" },
            {
              type: "ul",
              items: [
                "Főszezon: magasabb minimum tartózkodás, hogy a váltásnapok koncentráltabbak legyenek.",
                "Elő-/utószezon: alacsonyabb minimum tartózkodás, hogy több foglalás váljon lehetségessé.",
                "Maximum tartózkodás: hasznos, ha az objektumnak ezután karbantartásra vagy más célra szabadnak kell lennie.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A szabály az érkezési napra vonatkozik: egy vendég egy három éjszakás minimum tartózkodású napon nem érkezhet csak két éjszakára, még akkor sem, ha az egyes napok elérhetők.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombinálja a hosszabb minimum tartózkodásokat [hosszútávú kedvezményekkel](/hilfe/preise-raten/aufenthaltsrabatte), hogy növelje a vendégek számára az ösztönzést.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Kézi zárolás",
          excerpt: "Időszakok célzott lefoglalása saját használatra vagy karbantartásra.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A kézi zárolás lefoglal egy időszakot a naptárban anélkül, hogy valódi vendégfoglalás állna mögötte — például saját használatra, tervezett karbantartási munkákra vagy felújításra. Az időszak a foglalási naptárban foglalásként jelenik meg, de egyértelműen felismerhető zárolásként.",
            },
            { type: "h2", text: "Zárolás létrehozása" },
            {
              type: "steps",
              items: [
                "Nyissa meg az érintett objektum foglalási naptárát.",
                "Jelölje ki a kívánt időszakot.",
                "Válassza a műveletek menüben a „Kézi zárolás” opciót.",
                "Adjon meg egy okot, pl. „Saját használat” vagy „Karbantartás”.",
                "Mentse el a zárolást.",
              ],
            },
            { type: "h2", text: "Különbség a Stop-Selltől" },
            {
              type: "p",
              text: "A kézi zárolás konkrétan egy időszakot foglal le egy meghatározott, dokumentált célra, és később ismét feloldható. Egy azonnali, platformszintű vészzárolásra dokumentált időszak nélkül ehelyett a Stop-Sell szolgál.",
            },
            {
              type: "ul",
              items: [
                "Kézi zárolás: tervezett, indoklással, saját használatra vagy karbantartásra.",
                "A feloldás bármikor lehetséges, amint az időszakra már nincs szükség.",
                "A zárolt éjszakák nem számítanak vendégfoglalásnak, és nem jelennek meg a bevételi áttekintésben.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Törölje a kézi zárolást, amint az ok megszűnik — máskülönben az objektum feleslegesen zárolva marad minden csatornán.",
            },
            {
              type: "note",
              variant: "info",
              text: "Azonnali, tervezett időszak nélküli zárolásra használja a [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell) funkciót.",
            },
          ],
        },
      ],
    },
  ],
};
