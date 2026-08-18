import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Védjegyekre vonatkozó szabályok",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "A „myBestDays”, a myBestDays logó és a hozzájuk kapcsolódó formatervezési elemek az üzemeltető megjelölései. A jelen szabályok leírják, hogyan használhatók.",
  ],
  sections: [
    {
      id: "erlaubt",
      heading: "1. Mi megengedett külön engedély nélkül",
      paragraphs: [
        "A „myBestDays” nevet leíró jelleggel megemlítheti, hogy a valóságnak megfelelően utaljon a Platformra — például „Ez a szálláshely foglalható a myBestDays-en”.",
        "A szolgáltatók a saját weboldalukról hivatkozhatnak a myBestDays-en lévő hirdetésükre, és eközben megemlíthetik a nevet.",
        "Szerkesztőségi anyagokban és tudósításokban a név megemlíthető, és a logó a tudósításhoz szükséges mértékben ábrázolható.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "2. Mi nem megengedett",
      paragraphs: ["Előzetes írásbeli hozzájárulásunk nélkül különösen nem megengedett:"],
      list: [
        "a logó módosítása, újrarajzolása, torzítása, átszínezése vagy más jelekkel való kombinálása;",
        "a név vagy a logó olyan használata, amely nem létező partnerség, tanúsítás, ajánlás vagy hovatartozás látszatát kelti;",
        "a „myBestDays” vagy összetéveszthetően hasonló megjelölés használata cégnévben, terméknévben, domainnévben, fiók- vagy profilnévben;",
        "a név vagy a logó kulcsszóként való lefoglalása fizetett keresőhirdetésben;",
        "megjelöléseink használata árukon, alkalmazásokban vagy értékesítésre, illetve továbbadásra szánt sablonokban.",
      ],
    },
    {
      id: "darstellung",
      heading: "3. Megjelenítés",
      paragraphs: [
        "A logót csak az általunk rendelkezésre bocsátott változatban, változatlan arányokkal és elegendő szabad térrel használja. Sötét felületeken a világos változatot használja.",
        "A nevet mindig „myBestDays” alakban írja — egy szó, kis m, nagy B és D. Az olyan rövidítések, mint a „BestDays”, nem megengedettek.",
      ],
    },
    {
      id: "abgrenzung",
      heading: "4. Elhatárolás a myNextDays-től",
      paragraphs: [
        "A „myNextDays” az üzemeltető kezelőszoftverének önálló megjelölése. A két márka nem keverhető össze és nem cserélhető fel.",
      ],
    },
    {
      id: "verstoesse",
      heading: "5. Jogsértések",
      paragraphs: [
        "Jogsértés esetén abbahagyásra szólítunk fel, és fenntartjuk a további jogi lépések jogát. Azoknak a szolgáltatóknak, akik megsértik a jelen szabályokat, kiegészítőleg a fiókjukkal szembeni intézkedésekre kell számítaniuk.",
        "A használattal kapcsolatos kérdéseket az [Impresszumban](https://mybestdays.dk/rechtliches/impressum) megadott elérhetőségekre küldje.",
      ],
    },
  ],
};
