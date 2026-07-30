import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Fizetések",
  description: "Fizetések helyes lebonyolítása.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Fizetések",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Előleg beállítása",
          excerpt: "Így kérhet foglaláskor csak részösszeget a teljes összeg helyett.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet",
            },
            {
              type: "p",
              text: "Ahelyett hogy a teljes foglalási összeget azonnal beszedné, előleget állíthat be fizetési szabályként. A vendég foglaláskor csak egy részösszeget fizet a Stripe-on vagy a PayPalon keresztül, a maradékot később, egy fennmaradó összeg formájában.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumban a „Fizetési szabályok” területet.",
                "Hozzon létre egy új, „Előleg” típusú szabályt.",
                "Határozza meg az előleg összegét a teljes összeg százalékában vagy fix összegben.",
                "Állítsa be, mikor esedékes az előleg — jellemzően közvetlenül foglaláskor.",
                "Mentse el a szabályt, és ellenőrizze egy teszt-foglaláson.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Az előleg az objektumhoz rögzített fizetési szolgáltatón keresztül kerül lebonyolításra. A fennmaradó összeghez illő beállítást a [A fennmaradó összeg automatizálása](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren) alatt végezheti el.",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "A fennmaradó összeg automatizálása",
          excerpt: "Így kerül a nyitott fennmaradó összeg automatikusan beszedésre az érkezés előtt.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet",
            },
            {
              type: "p",
              text: "Egy előleg után egy fennmaradó összeg marad nyitva. Ahelyett hogy ezt kézzel követné nyomon, állítson be egy fizetési szabályt, amely a fennmaradó összeget automatikusan, egy fix időpontban az érkezés előtt beszedi a Stripe-on vagy a PayPalon keresztül.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumban a „Fizetési szabályok” területet.",
                "Hozzon létre egy új, „Fennmaradó összeg” típusú szabályt, amennyiben már létezik előleg-szabály.",
                "Határozza meg, hány nappal az érkezés előtt válik esedékessé a fennmaradó összeg.",
                "Aktiválja az automatikus beszedést, hogy a rögzített fizetési szolgáltató önállóan vonja le az összeget.",
                "Ezután ellenőrizze a fennmaradó összeg állapotát az adott foglalás foglalási idővonalán.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ha az automatikus beszedés meghiúsul, például lejárt kártya miatt, a foglalás nem kerül automatikusan sztornózásra. Ellenőrizze időben a sikertelen fennmaradó fizetéseket, és lépjen közvetlenül kapcsolatba a vendéggel.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Visszatérítés végrehajtása",
          excerpt: "Így téríthet vissza egy vendégnek egy összeget teljesen vagy részlegesen.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet",
            },
            {
              type: "p",
              text: "Lemondás vagy reklamáció esetén a vendégnek kifizetett összeget teljesen vagy részlegesen visszatérítheti. A visszatérítés ugyanazon a fizetési szolgáltatón keresztül történik, amelyen eredetileg fizettek — Stripe vagy PayPal.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az érintett foglalást a foglalási idővonalon.",
                "Válassza ki a „Fizetések” területen a visszatérítendő eredeti fizetést.",
                "Válasszon teljes vagy részleges visszatérítés között.",
                "Részleges visszatérítés esetén adja meg a kívánt összeget.",
                "Erősítse meg a visszatérítést, és ellenőrizze a frissített fizetési állapotot az idővonalon.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Egy visszatérítés automatikusan nem változtat sem a foglalás állapotán, sem a lefoglalt naptári éjszakákon. Lemondás esetén ellenőrizze külön, hogy az érintett éjszakákat fel kell-e szabadítani a foglalási naptárban.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Kaució kezelése",
          excerpt: "Így állíthat be kauciót, és így oldhatja fel a tartózkodás után.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet",
            },
            {
              type: "p",
              text: "A kaució biztosítja Önt a tartózkodás alatt keletkező károk ellen. Önálló fizetési szabályként rögzítik, és az objektum beállításától függően a Stripe-on vagy a PayPalon keresztül vagy előzetesen jóváhagyásra, vagy beszedésre kerül.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumban a „Fizetési szabályok” területet, és hozzon létre egy „Kaució” típusú szabályt.",
                "Határozza meg a kaució összegét és a jóváhagyás időpontját, jellemzően röviddel az érkezés előtt.",
                "A check-out után ellenőrizze az objektum állapotát.",
                "Kifogástalan állapot esetén oldja fel teljesen a kauciót a foglaláson keresztül.",
                "Kár esetén csak a nem szükséges részt térítse vissza, és dokumentálja a visszatartás okát.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Egy jóváhagyott, de be nem szedett kaució fizetési szolgáltatótól függően egy bizonyos határidő után automatikusan érvényét veszti. Oldja fel a kauciót időben a check-out után, vagy szedje be időben a szükséges összeget.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Számla javítása",
          excerpt: "Így javíthat egy már kiállított számlát utólag.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet",
            },
            {
              type: "p",
              text: "Ha egy már kiállított számla hibát tartalmaz, például a számlázási címben vagy egy tételben, javítsa ki a foglaláson keresztül, ahelyett hogy egyszerűen törölné az eredeti számlát.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az érintett foglalást a foglalási idővonalon, és váltson a „Számlák” területre.",
                "Válassza ki a hibás számlát.",
                "Hozzon létre helyesbítő, illetve stornó számlát az eredeti számlához.",
                "Ezután hozzon létre egy új, javított számlát a helyes adatokkal.",
                "Küldje el ismét a javított számlát a vendégnek, illetve a számlázási címre.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Egy már elküldött számlát a nyomon követhetőség érdekében nem szabad közvetlenül felülírni. A stornó számlán keresztüli javítás megőrzi az eredeti bizonylatot, és nyomon követhetővé teszi a módosítást.",
            },
          ],
        },
      ],
    },
  ],
};
