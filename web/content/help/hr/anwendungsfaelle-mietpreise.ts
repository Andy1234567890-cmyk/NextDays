import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Cijene najma",
  description: "Optimalno odredite cijene najma.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Cijene najma",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Optimizacija cijena za glavnu sezonu",
          excerpt: "Kako ciljano podići cijene za razdoblja velike potražnje.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija",
            },
            {
              type: "p",
              text: "U glavnoj sezoni potražnja znatno raste, dok vaša osnovna cijena ostaje jednaka kao i u ostatku godine. Bez sezonske prilagodbe u najjačem razdoblju godine gubite prihod — prilagodba se provodi preko tarifnog plana vašeg objekta, ne ručnim prebrisavanjem pojedinih dana.",
            },
            {
              type: "steps",
              items: [
                "Otvorite tarifni plan zahvaćenog objekta i izradite sezonsko pravilo za željeno razdoblje.",
                "Postavite doplatu kao postotak ili fiksan iznos iznad osnovne cijene — tarifni plan automatski preuzima valutu objekta.",
                "U kalendaru provjerite prikazuje li se nova cijena za razdoblje glavne sezone ispravno prije nego što je aktivirate.",
                "Provjerite minimalni boravak za glavnu sezonu — često je smislen veći minimalni boravak kako bi popunjenost ostala planabilna.",
                "Nakon aktivacije prvih dana pratite stanje rezervacija i po potrebi naknadno prilagodite doplatu.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Sezonsko pravilo djeluje kanalno-obuhvatno jednako na portalima, platformi i web-stranici. Detalje o strukturi pravila pronaći ćete pod [Tarifni planovi](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Poticanje duljih boravaka popustom",
          excerpt: "Kako nagraditi goste s duljim boravkom i smanjiti opseg izmjena.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija",
            },
            {
              type: "p",
              text: "Kratki boravci znače više dolazaka i odlazaka, više čišćenja i veći rizik od praznina između rezervacija. Stupnjevani popust za boravak čini dulje rezervacije privlačnijima gostima i osjetno smanjuje taj opseg posla.",
            },
            {
              type: "steps",
              items: [
                "Otvorite tarifni plan objekta i izradite popust za boravak.",
                "Definirajte barem jedan stupanj, primjerice od 7 noćenja ili od 28 noćenja, s pripadajućom stopom popusta.",
                "Provjerite da se stupnjevi ne preklapaju i da popust vrijedi tek od dotičnog minimalnog trajanja.",
                "U kalendaru testirajte primjer rezervacije preko granice popusta kako biste potvrdili ispravnu primjenu.",
                "Aktivirajte popust i pratite utjecaj na prosječno trajanje boravka i popunjenost.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Popusti za boravak mogu se kombinirati sa sezonskim pravilima — tarifni plan zajedno izračunava obje prilagodbe. Više o tome pod [Tarifni planovi](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
