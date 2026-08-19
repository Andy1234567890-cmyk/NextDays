import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Izvještaji vlasnika",
  description: "Izradite izvještaje vlasnika.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Izvještaji vlasnika",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Izrada izvještaja vlasnika",
          excerpt: "Kako za vlasnika izraditi pregledan obračun za njegovo razdoblje.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija",
            },
            {
              type: "p",
              text: "Ako upravljate objektima za vlasnike, njima je redovito potreban sljediv pregled prihoda, odbijene provizije i isplate njihovih objekata za određeno razdoblje — izvještaj vlasnika automatski objedinjuje te podatke.",
            },
            {
              type: "steps",
              items: [
                "U Računu otvorite područje Vlasnici i odaberite dotičnog vlasnika.",
                "Odaberite obračunsko razdoblje za koje se izrađuje izvještaj.",
                "Provjerite jesu li svi objekti tog vlasnika ispravno pridruženi, jer u izvještaj ulaze samo pridruženi objekti.",
                "Izradite izvještaj i provjerite potpunost navedenih rezervacija.",
                "Izvještaj stavite vlasniku na raspolaganje preko pristupa vlasnika ili ga izvezite kao dokument.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Izvještaj prikazuje svaku rezervaciju s iznosom u dotičnoj valuti objekta — ne postoji paušalna napomena o valuti, jer više objekata može voditi i različite valute. Više o pridruživanju pod [Pridruživanje objekta vlasniku](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Obračun provizije s vlasnikom",
          excerpt: "Kako osigurati da se vaša provizija ispravno izračunava iz prihoda vlasnika.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija",
            },
            {
              type: "p",
              text: "Vaša provizija za upravljanje objektom pohranjena je u tarifi vlasnika i kod svakog se izvještaja automatski odbija od bruto prihoda. Kako bi obračun bio točan, stopa provizije mora biti ispravno postavljena prije prve rezervacije u razdoblju.",
            },
            {
              type: "steps",
              items: [
                "U Računu otvorite tarifu dotičnog vlasnika i provjerite pohranjenu stopu provizije.",
                "Po potrebi prilagodite stopu prije nego što stignu nove rezervacije u nadolazećem obračunskom razdoblju.",
                "Izradite izvještaj vlasnika za razdoblje i provjerite iskazuje li se provizija po rezervaciji ispravno.",
                "Provjerite vjerodostojnost zbroja bruto prihoda, odbijene provizije i neto isplate.",
                "Odstupanja razjasnite izravno s vlasnikom prije odobravanja izvještaja, umjesto da izvještaj naknadno mijenjate.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Naknadna promjena stope provizije djeluje samo na buduća razdoblja, ne retroaktivno na već izrađene izvještaje. Stopu stoga pravodobno provjerite prije početka novog obračunskog razdoblja — vidi i [Obračun vlasnika (izvještaj)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
