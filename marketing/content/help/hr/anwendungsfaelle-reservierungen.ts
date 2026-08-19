import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Rezervacije i kalendar",
  description: "Držite rezervacije i kalendar pod kontrolom.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Rezervacije i kalendar",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Pouzdano izbjegavanje prekapacitiranih rezervacija",
          excerpt: "Kako osigurati da objekt nikad ne bude dvostruko rezerviran.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija",
            },
            {
              type: "p",
              text: "Objekt se istovremeno prodaje preko više kanala — portala poput Bookinga, Airbnb-a i drugih, vlastite platforme te aplikacije. Prekapacitirana rezervacija nastaje kad se dostupnost na jednom kanalu ne blokira pravovremeno nakon što je izvršena rezervacija na drugom kanalu.",
            },
            {
              type: "steps",
              items: [
                "U rasporedu zauzetosti provjerite je li svaki objekt točno jedan redak s jednom jedinicom koja se može rezervirati — bez zajedničkog kapaciteta više soba.",
                "Nove rezervacije unosite isključivo preko rasporeda zauzetosti ili povezanih kanala, nikad ručnim opisivanjem pojedinih dana.",
                "Nakon svake rezervacije provjerite pojavljuju li se rezervirana noćenja odmah kao zauzeta u kalendaru.",
                "Kod tehničkih problema ili održavanja odmah upotrijebite stop-sell, umjesto da ostavite dan otvorenim.",
                "Kod nejasnoća provjerite vremensku crtu rezervacije zahvaćene rezervacije kako biste rekonstruirali tijek događaja.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Nikad ručno ne mijenjajte noćenja ili blokade izvan rasporeda zauzetosti — samo tako ostaje osigurano da svi kanali vide isto stanje dostupnosti i da ne nastane praznina za dvostruku rezervaciju.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Premještanje rezervacije u drugi objekt",
          excerpt: "Kako uredno premjestiti postojeću rezervaciju u drugi objekt.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija",
            },
            {
              type: "p",
              text: "Ponekad se gost mora preseliti iz jednog objekta u drugi, primjerice zbog tehničkog kvara ili na želju gosta. Kod premještaja dosadašnja se noćenja u kalendaru automatski oslobađaju i ponovno zauzimaju u ciljnom objektu.",
            },
            {
              type: "steps",
              items: [
                "Otvorite zahvaćenu rezervaciju u vremenskoj crti rezervacije.",
                "U izborniku radnji odaberite „Promijeni objekt” odnosno „Premjesti”.",
                "Odaberite ciljni objekt i provjerite njegovu dostupnost u odabranom razdoblju.",
                "Potvrdite premještaj.",
                "Nakon toga u rasporedu zauzetosti provjerite prikazuju li se stara noćenja u izvornom objektu ponovno kao dostupna.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Oslobađanje starih noćenja preuzima sustav automatski — izvorno razdoblje ne morate sami ručno otvarati. Obavijestite gosta o promjeni objekta, posebno ako se oprema ili pristup razlikuju.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Izrada dugoročne rezervacije",
          excerpt: "Kako ispravno izraditi rezervaciju za dulje razdoblje.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija",
            },
            {
              type: "p",
              text: "Za dugoročne goste — primjerice više tjedana ili mjeseci — rezervaciju izrađujete kao uobičajeno, ali dodatno pazite na minimalni boravak, pravila plaćanja i vidljivost kanala objekta tijekom cijelog razdoblja.",
            },
            {
              type: "steps",
              items: [
                "Otvorite raspored zauzetosti željenog objekta i označite cijelo razdoblje.",
                "Izradite rezervaciju s podacima o gostu te planiranim datumom dolaska i odlaska.",
                "Po potrebi postavite pravilo plaćanja s predujmom i preostalom uplatom, umjesto da odmah dospijeva puni iznos.",
                "Provjerite da nijedno pravilo minimalnog ili maksimalnog boravka nije u suprotnosti s dugim razdobljem.",
                "Spremite rezervaciju i provjerite prikazuje li se cijelo razdoblje u kalendaru ispravno kao zauzeto.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Kod vrlo dugih boravaka preporučuje se preostala uplata u više obroka umjesto jednog velikog dospijeća — tako rizik plaćanja ostaje pregledan. Detalje o tome pod [Automatizacija preostale uplate](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
