import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Bérleti árak",
  description: "Bérleti árak optimális beállítása.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Bérleti árak",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Árak optimalizálása a főszezonra",
          excerpt: "Így emelheti meg célzottan az árait a nagy keresletű időszakokra.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet",
            },
            {
              type: "p",
              text: "A főszezonban a kereslet jelentősen megnő, miközben az alapára ugyanazokat az értékeket veszi alapul, mint az év többi részében. Szezonális kiigazítás nélkül az év legerősebb időszakában bevételt hagy az asztalon — a kiigazítás az objektum árazási tervén (rate plan) keresztül történik, nem az egyes napok kézi felülírásával.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az érintett objektum árazási tervét, és hozzon létre egy szezonszabályt a kívánt időszakra.",
                "Állítsa be a felárat százalékos értékként vagy fix összegként az alapár felett — az árazási terv automatikusan átveszi az objektum devizáját.",
                "Ellenőrizze a naptárban, hogy az új ár helyesen jelenik-e meg a főszezoni időszakra, mielőtt aktiválná.",
                "Ellenőrizze a minimum tartózkodási időt a főszezonra — gyakran érdemes magasabb minimális foglalási időtartamot megadni, hogy a kihasználtság tervezhető maradjon.",
                "Az aktiválás után az első napokban figyelje a foglalási helyzetet, és szükség esetén állítsa utána a felárat.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Egy szezonszabály csatornákon átívelően hat, egyaránt a portálokon, a platformon és a weboldalon. A szabályok felépítéséről bővebben: [Árazási tervek](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Hosszabb tartózkodások ösztönzése kedvezménnyel",
          excerpt: "Így jutalmazhatja meg a hosszabb tartózkodású vendégeket, és csökkentheti a cserélődés terhét.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "h2",
              text: "Kiindulási helyzet",
            },
            {
              type: "p",
              text: "A rövid tartózkodások több érkezést és távozást, több takarítást és nagyobb üresjárati kockázatot jelentenek a foglalások között. Egy sávos hosszútávú kedvezmény vonzóbbá teszi a hosszabb foglalásokat a vendégek számára, és érzékelhetően csökkenti ezt a terhet.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektum árazási tervét, és hozzon létre egy hosszútávú kedvezményt.",
                "Határozzon meg legalább egy sávot, például 7 éjszakától vagy 28 éjszakától, a hozzá tartozó kedvezménymértékkel.",
                "Ellenőrizze, hogy a sávok nem fedik egymást, és a kedvezmény csak a megfelelő minimális időtartamtól érvényesül.",
                "Teszteljen a naptárban egy példafoglalást a kedvezményhatáron átívelve, hogy megerősítse a helyes alkalmazást.",
                "Aktiválja a kedvezményt, és figyelje a hatását az átlagos tartózkodási időre és a kihasználtságra.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A hosszútávú kedvezmények kombinálhatók szezonszabályokkal — az árazási terv mindkét kiigazítást együtt számolja ki. Bővebben: [Árazási tervek](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
