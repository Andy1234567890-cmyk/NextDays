import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Foglalások és naptár",
  description: "Foglalások és naptár kézben tartása.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Foglalások és naptár",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Túlfoglalások megbízható elkerülése",
          excerpt: "Így biztosíthatja, hogy egy objektumot soha ne foglaljanak le duplán.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet",
            },
            {
              type: "p",
              text: "Egy objektumot egyidejűleg több csatornán keresztül értékesítenek — portálokon, mint a Booking, Airbnb és társaik, a saját platformon, valamint az alkalmazáson keresztül. Túlfoglalás akkor keletkezik, ha az elérhetőség egy csatornán nem kerül időben lezárásra azt követően, hogy egy másik csatornán foglalás történt.",
            },
            {
              type: "steps",
              items: [
                "Ellenőrizze a foglalási naptárban, hogy minden objektum pontosan egy sor egy foglalható egységgel — ne legyen több szoba megosztott kapacitása.",
                "Az új foglalásokat kizárólag a foglalási naptáron vagy a csatlakoztatott csatornákon keresztül hozza létre, soha ne az egyes napok kézi átírásával.",
                "Minden foglalás után ellenőrizze, hogy a lefoglalt éjszakák azonnal foglaltként jelennek meg a naptárban.",
                "Technikai probléma vagy karbantartás esetén azonnal használjon Stop-Sell funkciót, ahelyett hogy nyitva hagyná a napot.",
                "Bizonytalanság esetén ellenőrizze az érintett foglalás foglalási idővonalát, hogy nyomon követhesse az időbeli lefolyást.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Soha ne módosítson éjszakákat vagy zárolásokat kézzel a foglalási naptáron kívül — csak így biztosítható, hogy minden csatorna ugyanazt az elérhetőségi állapotot lássa, és ne keletkezzen rés dupla foglalásra.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Foglalás áthelyezése másik objektumba",
          excerpt: "Így helyezhet át tisztán egy meglévő foglalást egy másik objektumra.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet",
            },
            {
              type: "p",
              text: "Néha egy vendégnek át kell költöznie egyik objektumból a másikba, például egy műszaki hiba vagy a vendég kérése miatt. Az áthelyezés során a korábbi naptári éjszakák automatikusan felszabadulnak, és a célobjektumban újra lefoglalásra kerülnek.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az érintett foglalást a foglalási idővonalon.",
                "Válassza a műveletek menüben az „Objektum váltása” illetve „Áthelyezés” opciót.",
                "Válassza ki a célobjektumot, és ellenőrizze annak elérhetőségét a kiválasztott időszakban.",
                "Erősítse meg az áthelyezést.",
                "Ezután ellenőrizze a foglalási naptárban, hogy a régi éjszakák ismét elérhetőként jelennek meg az eredeti objektumban.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A régi éjszakák felszabadítását a rendszer automatikusan elvégzi — az eredeti időszakot nem kell saját kezűleg megnyitnia. Tájékoztassa a vendéget az objektumváltásról, különösen ha a felszereltség vagy a bejutás eltér.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Hosszú távú foglalás létrehozása",
          excerpt: "Így hozhat létre helyesen egy hosszabb időszakra szóló foglalást.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet",
            },
            {
              type: "p",
              text: "Hosszú távú vendégek esetén — például több hétre vagy hónapra — a foglalást a megszokott módon hozza létre, de emellett figyeljen a minimum tartózkodási időre, a fizetési szabályokra és az objektum csatorna-láthatóságára a teljes időszak alatt.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg a kívánt objektum foglalási naptárát, és jelölje ki a teljes időszakot.",
                "Hozza létre a foglalást a vendégadatokkal és a tervezett érkezési és távozási dátummal.",
                "Szükség esetén állítson be fizetési szabályt előleggel és fennmaradó összeggel, ahelyett hogy a teljes összeget azonnal esedékessé tenné.",
                "Ellenőrizze, hogy semmilyen minimum- vagy maximum tartózkodási szabály nem mond ellent a hosszú időszaknak.",
                "Mentse a foglalást, és ellenőrizze, hogy a teljes időszak helyesen foglaltként jelenik meg a naptárban.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Nagyon hosszú tartózkodások esetén ajánlott a fennmaradó összeget több részletben beszedni egyetlen nagy esedékesség helyett — így a fizetési kockázat kezelhető marad. Részletek: [A fennmaradó összeg automatizálása](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
