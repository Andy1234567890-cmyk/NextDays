import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Foglalások és rendelések",
  description: "Foglalások kezelése, áthelyezése és lemondása.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Foglalások",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Foglalás kézi rögzítése",
          excerpt:
            "Így rögzít közvetlenül a myNextDaysben egy telefonon vagy e-mailben érkezett foglalást.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Mikor rögzítsen kézzel" },
            {
              type: "p",
              text: "Nem minden foglalás érkezik portálon vagy saját platformján keresztül — a telefonon, e-mailben vagy helyben érkező kéréseket saját maga rögzíti, hogy az objektum a myNextDaysben helyesen legyen zárolva, és ne keletkezzen dupla foglalás.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg a Foglalások menüt, és kattintson az „Új foglalás” gombra.",
                "Válassza ki az objektumot — minden objektum a myNextDaysben egy önálló foglalható egység, tehát egy konkrét szoba vagy üdülőobjektum.",
                "Adja meg az érkezést és a távozást, valamint a vendégek számát.",
                "Rögzítse a vendégadatokat (név, elérhetőség, esetleg cím a számlához).",
                "Ellenőrizze a javasolt árat, és szükség esetén igazítsa.",
                "Mentse el a foglalást — az éjszakák azonnal zárolásra kerülnek a naptárban.",
              ],
            },
            { type: "h2", text: "Fizetés és visszaigazolás" },
            {
              type: "p",
              text: "A mentés után ugyanazok a fizetési szabályok érvényesülnek, mint az online foglalásoknál. Ha egy fizetési szolgáltató csatlakoztatva van, közvetlenül küldhet fizetési linket a vendégnek, vagy kézzel megjelölheti a fizetést beérkezettként.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Rögzítse a különleges kéréseket (korai érkezés, pótágyak) mindjárt a megjegyzésekben — a csapat látja őket a foglalási idővonalon.",
            },
            { type: "h2", text: "Létrehozás után" },
            {
              type: "p",
              text: "Az új foglalás azonnal megjelenik a [Foglalási idővonal](/hilfe/reservierungen/buchungs-zeitleiste) alatt, minden további lépéssel, mint az üzenetek, feladatok és fizetések, egy helyen.",
            },
            {
              type: "ul",
              items: [
                "A naptár és a portálok automatikusan szinkronizálódnak mentéskor.",
                "A vendég szükség esetén automatikus visszaigazoló üzenetet kap.",
                "Az időpontokban történő módosításokat a „Foglalás áthelyezése” funkción keresztül rögzíti.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "A foglalási idővonal",
          excerpt:
            "A foglalási idővonal egy helyen fogja össze egy foglalás teljes lefolyását.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Mit mutat az idővonal" },
            {
              type: "p",
              text: "Minden foglalásnak saját idővonala van, amely időrendben mutatja a teljes lefolyást — a foglalási kéréstől vagy a portáli importtól a check-outig. Így egy pillantással láthatja, mi történt már meg, és mi a következő teendő.",
            },
            {
              type: "ul",
              items: [
                "Üzenetek a vendéggel",
                "Feladatok, például takarítás vagy előkészítés",
                "Fizetések és számlák",
                "Lefoglalt add-onok és kiegészítő szolgáltatások",
                "Áthelyezések (Move) és lemondások",
              ],
            },
            { type: "h2", text: "Az idővonal használata a mindennapokban" },
            {
              type: "steps",
              items: [
                "Nyissa meg a Foglalások menüt, és válassza ki a kívánt foglalást.",
                "Váltson az „Idővonal” fülre.",
                "Görgesse végig időrendben az összes eseményt.",
                "Használja a gyorsműveleteket, hogy közvetlenül üzenetet küldjön, vagy feladatot hozzon létre.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ha egy foglalást áthelyeznek vagy lemondanak, ez a lépés is megjelenik az idővonalon — beleértve a naptárban felszabadított éjszakákat.",
            },
            { type: "h2", text: "Miért fontos ez" },
            {
              type: "p",
              text: "Mivel a csapat, a tulajdonos és a támogatás ugyanazt az idővonalat látja, nem keletkeznek információs rések az üzenetek, feladatok és fizetések között. A visszatérítések részleteiről bővebben: [Visszatérítések](/hilfe/zahlungen/rueckerstattungen), a kiegészítő szolgáltatásokról: [Add-onok és kiegészítő szolgáltatások](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Foglalás áthelyezése",
          excerpt:
            "Így helyez át egy meglévő foglalást új időszakra anélkül, hogy összekuszálná a naptárat.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Ellenőrzés áthelyezés előtt" },
            {
              type: "p",
              text: "Mielőtt áthelyezne egy foglalást, ellenőrizze az elérhetőséget az új időszakban a lefoglalt objektumra vonatkozóan. A myNextDays csak akkor szabadítja fel az eredetileg lefoglalt éjszakákat, amint az új időszak megerősítésre kerül — így nem keletkezik rés, amelyben az objektum tévesen szabadnak vagy duplán foglaltnak minősül.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg a foglalást a Foglalások menüben.",
                "Válassza az „Áthelyezés” opciót, és adja meg az új időszakot.",
                "Ellenőrizze a megjelenített elérhetőséget az új dátumokra.",
                "Erősítse meg az áthelyezést.",
                "Ellenőrizze, hogy az új éjszakaszám miatt megváltozik-e az ár, és szükség esetén igazítsa.",
              ],
            },
            { type: "h2", text: "Mi történik automatikusan" },
            {
              type: "p",
              text: "A megerősítés után a régi éjszakák helyesen felszabadulnak a naptárban, az új éjszakák zárolásra kerülnek, a csatlakoztatott portálok frissítésre kerülnek. A folyamat rögzítésre kerül a foglalási idővonalon.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ha a foglalás portálon keresztül érkezett, az áthelyezésre ott saját szabályok vonatkozhatnak — ellenőrizze a portál irányelveit, mielőtt nagyobb módosítást végezne.",
            },
            { type: "h2", text: "Fizetési különbözetek" },
            {
              type: "p",
              text: "Ha az ár az áthelyezés miatt megváltozik, igazítsa ennek megfelelően a fizetési szabályokat — lásd [Fizetési szabályok](/hilfe/zahlungen/zahlungsregeln). Egy foglalás teljes lefolyásáról bővebben: [A foglalási idővonal](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Lemondás és visszatérítés",
          excerpt:
            "Így mondhat le helyesen egy foglalást, és szükség esetén így indíthat visszatérítést.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Foglalás lemondása" },
            {
              type: "p",
              text: "Egy lemondás azonnal felszabadítja az objektumot a lefoglalt időszakra — naptárában éppúgy, mint minden csatlakoztatott portálon. A lemondás előtt ellenőrizze, mely lemondási feltételek érvényesek erre a foglalásra.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg a foglalást a Foglalások menüben.",
                "Válassza a „Lemondás” opciót, és adjon meg egy okot.",
                "Ellenőrizze a javasolt visszatérítendő összeget.",
                "Erősítse meg a lemondást.",
              ],
            },
            { type: "h2", text: "Visszatérítés indítása" },
            {
              type: "p",
              text: "Ha a fizetés csatlakoztatott fizetési szolgáltatón keresztül zajlott, közvetlenül a foglalásból indíthatja el a visszatérítést. Az összeg az objektumhoz rögzített devizában jelenik meg. A folyamat részleteiről bővebben: [Visszatérítések](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Teljes vagy részleges visszatérítés lehetséges",
                "A folyamat megjelenik a foglalási idővonalon",
                "Portálfoglalásoknál emellett az adott portál szabályai is érvényesek",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Egy lemondás nem vonható vissza. Gondosan ellenőrizze az időszakot és a vendéget, mielőtt megerősítené.",
            },
            { type: "h2", text: "A lemondás után" },
            {
              type: "p",
              text: "Az objektum azonnal ismét foglalható, a foglaláshoz tartozó nyitott feladatok — például az előkészítés — automatikusan megjelölésre kerülnek mint már nem szükségesek. A teljes folyamat a [Foglalási idővonalon](/hilfe/reservierungen/buchungs-zeitleiste) nyomon követhető marad.",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Check-in és check-out",
          excerpt: "Így dokumentálja egy vendég érkezését és távozását a myNextDaysben.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Check-in rögzítése" },
            {
              type: "p",
              text: "A check-in jelzi a tartózkodás kezdetét, és különösen önálló check-in vagy a csapat általi kulcsátadás esetén hasznos, hogy minden foglalás állapota naprakész maradjon.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg a foglalást a Foglalások menüben.",
                "Válassza a „Check-in” opciót az érkezés napján.",
                "Szükség esetén rögzítsen megjegyzést, például időpontot vagy különlegességeket.",
              ],
            },
            { type: "h2", text: "Check-out és átadás" },
            {
              type: "p",
              text: "A check-outnál jelöli meg a tartózkodást befejezettként. Ez sok esetben automatikusan kiváltja egy takarítási feladat létrejöttét az objektumhoz, hogy az fel legyen készítve a következő foglalásra.",
            },
            {
              type: "ul",
              items: [
                "A check-in és a check-out a foglalási idővonal része",
                "Az időpontok objektumonként definiálhatók az objektumbeállításokban",
                "Mobil hozzáférés esetén a csapat közvetlenül helyben rögzítheti a check-int és a check-outot",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Egy elmulasztott check-out nem blokkolja automatikusan a következő feladatokat — rendszeresen ellenőrizze a lejárt állapotokat a Foglalásoknál.",
            },
            { type: "h2", text: "Kapcsolat a feladatokkal" },
            {
              type: "p",
              text: "A check-in és a check-out szorosan összefügg a feladatokkal és az idővonallal. A teljes lefolyásról bővebben: [A foglalási idővonal](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Add-onok és kiegészítő szolgáltatások",
          excerpt:
            "Így kínál a vendégeknek foglalható kiegészítő szolgáltatásokat, mint a reggeli vagy a transzfer, és így rögzíti ezeket a foglalásban.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Mik az add-onok" },
            {
              type: "p",
              text: "Az add-onok egy foglaláshoz tartozó opcionális kiegészítő szolgáltatások — például reggeli, korai érkezés, transzfer vagy késő check-out. Objektumonként kerülnek rögzítésre, és a vendég maga, vagy a csapata is hozzáadhatja a foglaláshoz.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot, és hozza létre az „Add-onok” alatt a kívánt kiegészítő szolgáltatásokat árukkal együtt.",
                "Nyissa meg egy meglévő foglalást a Foglalásoknál.",
                "Válassza az „Add-on hozzáadása” opciót, és válassza ki a kívánt szolgáltatást.",
                "Erősítse meg a szolgáltatás mennyiségét és időpontját.",
              ],
            },
            { type: "h2", text: "Elszámolás" },
            {
              type: "p",
              text: "Az add-onok az adott objektum devizájában kerülnek elszámolásra, és önálló tételként jelennek meg a számlán. A már kifizetett add-onok lemondás esetén arányosan visszatéríthetők.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Rögzítse a népszerű add-onokat egyszer, központilag az objektumnál — így minden új foglalásnál néhány kattintással hozzáadhatók.",
            },
            { type: "h2", text: "Láthatóság a vendég számára" },
            {
              type: "p",
              text: "Ha a platform vagy a saját weboldal aktív, a vendégek gyakran már a foglalás során kiválaszthatják a megfelelő add-onokat. Minden kiegészítés ezután megjelenik a [Foglalási idővonalon](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Az add-onok objektumonként egyénileg nevezhetők el és árazhatók",
                "Az utólagos hozzáadás bármikor lehetséges a foglaláson keresztül",
                "A lemondott add-onok arányosan visszatérítésre kerülnek",
              ],
            },
          ],
        },
      ],
    },
  ],
};
