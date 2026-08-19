import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Zadaci i čišćenje",
  description: "Organizirajte planove čišćenja i timske zadatke.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Poslovanje",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Izrada zadataka",
          excerpt: "Kako izraditi novi zadatak za objekt ili razdoblje.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Zadaci objedinjuju sve što treba obaviti oko objekta — od čišćenja nakon odjave do radova na održavanju ili upita gostiju. Svaki je zadatak vezan uz točno jedan objekt i može se dodijeliti članu tima.",
            },
            { type: "h2", text: "Izrada novog zadatka" },
            {
              type: "steps",
              items: [
                "Otvorite područje „Zadaci” u glavnom izborniku.",
                "Kliknite „Novi zadatak”.",
                "Odaberite zahvaćeni objekt.",
                "Unesite naslov i po želji opis.",
                "Odredite datum i vrijeme dospijeća.",
                "Spremite zadatak.",
              ],
            },
            { type: "h2", text: "Tipovi zadataka" },
            {
              type: "p",
              text: "Uz slobodne zadatke postoje i sustavom generirani zadaci, primjerice automatski planirana čišćenja nakon odjave. Oni su već povezani s objektom i odgovarajućim vremenskim okvirom te ih je potrebno samo dodijeliti članu tima.",
            },
            {
              type: "ul",
              items: [
                "Ručni zadatak: slobodno unesen, npr. održavanje ili posebna želja.",
                "Automatski zadatak čišćenja: izveden iz datuma odjave.",
                "Ponavljajući zadatak: za redovite kontrole ili inspekcije.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Detalje o automatskom planiranju vremena pronaći ćete pod [Planovi čišćenja](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Dodijelite precizne naslove — članovi tima u mobilnom prikazu često na jedan pogled vide samo naslov i objekt.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Planovi čišćenja",
          excerpt: "Automatsko planiranje čišćenja nakon odjave.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Plan čišćenja osigurava da se nakon svake odjave automatski izradi zadatak čišćenja za zahvaćeni objekt — bez potrebe da svaku rezervaciju pojedinačno pratite. To smanjuje zaboravljene primopredaje i osigurava pouzdan tijek između dva boravka.",
            },
            { type: "h2", text: "Aktivacija automatskog planiranja" },
            {
              type: "steps",
              items: [
                "Otvorite objekt i prijeđite na karticu „Čišćenje”.",
                "Aktivirajte „Automatski planiraj čišćenje nakon odjave”.",
                "Odredite koliko se vremena nakon odjave predviđa za čišćenje.",
                "Po želji odredite zadani tim ili zadanu osobu za čišćenje.",
                "Spremite postavku.",
              ],
            },
            { type: "h2", text: "Suradnja s kalendarom" },
            {
              type: "p",
              text: "Čim se rezervacija otkaže ili pomakne, pripadajući se zadatak čišćenja automatski prilagođava novom datumu odjave. Tako plan čišćenja ostaje uvijek sinkroniziran sa stvarnim stanjem popunjenosti.",
            },
            {
              type: "ul",
              items: [
                "Čišćenje automatski nastaje kod svake odjave s aktivnim planom.",
                "Ako se rezervacija pomakne, pomiče se i zadatak čišćenja.",
                "Ako gosti otkažu boravak, zadatak čišćenja se uklanja.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez aktiviranog plana čišćenja ne nastaju automatski zadaci — u tom slučaju čišćenja unosite ručno pod [Izrada zadataka](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Dodjela zadataka",
          excerpt: "Ciljano dodijelite zadatke osoblju za čišćenje ili članovima tima.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Kako bi zadatak bio obavljen, dodjeljujete ga konkretnom članu tima — primjerice osobi za čišćenje ili zaposleniku zaduženom za održavanje. Standardno samo dodijeljena osoba vidi zadatak u vlastitom pregledu.",
            },
            { type: "h2", text: "Ručna dodjela zadatka" },
            {
              type: "steps",
              items: [
                "Otvorite zadatak na popisu „Zadaci”.",
                "Kliknite „Dodijeli”.",
                "Odaberite nadležnog člana tima s popisa.",
                "Potvrdite dodjelu.",
              ],
            },
            { type: "h2", text: "Dodjela prema objektu" },
            {
              type: "p",
              text: "Ako je osobi za čišćenje već trajno pridružen objekt, zadatke za taj objekt možete automatski dodjeljivati toj osobi. To kod ponavljajućih čišćenja štedi klikove i smanjuje dodatna pitanja.",
            },
            {
              type: "ul",
              items: [
                "Ručna dodjela: sami po zadatku birate osobu.",
                "Trajno pridruživanje objektu: novi zadaci za taj objekt automatski idu pohranjenoj osobi.",
                "Zadatak uvijek ima točno jednu nadležnu osobu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Osoblje za čišćenje i zaposlenici vide isključivo vlastite dodijeljene zadatke, bez financijskih ili prodajnih podataka objekta.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Praćenje statusa zadataka",
          excerpt: "Pratite stanje obrade zadataka u stvarnom vremenu.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Svaki zadatak prolazi jasan status — od otvoren preko u tijeku do dovršen. Tako u svakom trenutku vidite hoće li čišćenje ili održavanje biti gotovo na vrijeme prije sljedeće prijave.",
            },
            { type: "h2", text: "Pregled statusa" },
            {
              type: "ul",
              items: [
                "Otvoren: zadatak je izrađen, ali još nije započet.",
                "U tijeku: dodijeljena osoba je započela zadatak.",
                "Dovršen: zadatak je obavljen i potvrđen.",
              ],
            },
            { type: "h2", text: "Ažuriranje statusa" },
            {
              type: "steps",
              items: [
                "Otvorite zadatak s popisa „Zadaci”.",
                "Odaberite odgovarajući status, npr. „U tijeku” ili „Dovršen”.",
                "Po potrebi dodajte kratku bilješku, primjerice o posebnostima u objektu.",
                "Spremite promjenu.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Promjene statusa odmah se pojavljuju na zajedničkom popisu zadataka — ručno ponovno učitavanje nije potrebno.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ako je čišćenje malo prije sljedeće prijave i dalje otvoreno, prvo provjerite dodjelu prije nego što kontaktirate gosta.",
            },
          ],
        },
      ],
    },
  ],
};
