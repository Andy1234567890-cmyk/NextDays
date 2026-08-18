import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Sütiszabályzat",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "A jelen szabályzat elmagyarázza, mely sütiket és hasonló technológiákat alkalmaz a myBestDays, milyen célból, meddig tárolódnak, és hogyan kezelheti őket.",
    "Kiegészíti az [Adatvédelmi tájékoztatót](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Mik azok a sütik",
      paragraphs: [
        "A sütik kis szövegfájlok, amelyeket egy webhely az Ön böngészőjében tárol. Hasonló technológiák a böngésző helyi tárolója és az e-mailekben lévő számlálópixelek.",
        "Azokat a sütiket, amelyek a Platform működéséhez feltétlenül szükségesek, az Ön hozzájárulása nélkül is elhelyezhetjük. Minden továbbihoz beszerezzük az Ön hozzájárulását (a 2002/58/EK irányelv 5. cikkének (3) bekezdése).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Szükséges sütik",
      paragraphs: [
        "Ezek a sütik a működéshez szükségesek, és nem kapcsolhatók ki. Jelenleg a következőket alkalmazzuk:",
      ],
      list: [
        "„nd_access” — fenntartja a bejelentkezését. Csak a szerver számára olvasható (HttpOnly), időtartama a munkamenet érvényességének megfelelő.",
        "„nd_refresh” — megújítja a bejelentkezését, hogy ne kelljen folyamatosan újra bejelentkeznie. Csak a szerver számára olvasható, időtartama 30 nap.",
        "„nd_gast_locale” — megjegyzi a választott nyelvét. Időtartama egy év.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Funkcionális, statisztikai és marketingsütik",
      paragraphs: [
        "A myBestDays jelenleg nem alkalmaz sütiket statisztikához, elérésméréshez vagy reklámhoz, és nem ágyaz be hirdetési hálózatokat vagy elemzőszolgáltatásokat.",
        "Ha ez megváltozik, előzetesen beszerezzük az Ön hozzájárulását egy választódialógusban, amelyben az elutasítás ugyanolyan egyszerű, mint az elfogadás, és kiegészítjük a jelen szabályzatot a konkrét sütikkel.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Harmadik felek beágyazott tartalma",
      paragraphs: [
        "A részletoldalakon térképek lehetnek beágyazva. Az ilyen tartalmat csak akkor töltjük be, ha Ön kifejezetten aktiválja; adatok csak ekkor kerülhetnek átadásra az adott szolgáltatónak.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Hogyan kezelheti a sütiket",
      paragraphs: [
        "Hozzájárulását bármikor módosíthatja vagy visszavonhatja a láblécben található sütibeállításokon keresztül.",
        "Ezen felül böngészőjében törölheti vagy blokkolhatja a sütiket. Ha törli a szükséges sütiket, kijelentkeztetjük, és a Platform korlátozottan működik.",
      ],
    },
  ],
};
