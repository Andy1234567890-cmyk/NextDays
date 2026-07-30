import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Plaćanja",
  description: "Ispravno obradite plaćanja.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Plaćanja",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Postavljanje predujma",
          excerpt: "Kako kod rezervacije zatražiti samo dio iznosa umjesto pune svote.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija",
            },
            {
              type: "p",
              text: "Umjesto da odmah naplatite cijeli iznos rezervacije, kao pravilo plaćanja možete odrediti predujam. Gost kod rezervacije plaća samo dio iznosa preko Stripea ili PayPala, a ostatak kasnije putem preostale uplate.",
            },
            {
              type: "steps",
              items: [
                "Otvorite u objektu područje „Pravila plaćanja”.",
                "Izradite novo pravilo tipa „Predujam”.",
                "Odredite iznos predujma kao postotak ili fiksan iznos ukupnog zbroja.",
                "Odredite kad predujam dospijeva, u pravilu odmah kod rezervacije.",
                "Spremite pravilo i provjerite ga na testnoj rezervaciji.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Predujam se obrađuje preko pružatelja usluga plaćanja pohranjenog u objektu. Odgovarajući iznos za preostali zbroj postavite pod [Automatizacija preostale uplate](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Automatizacija preostale uplate",
          excerpt: "Kako se otvoreni preostali iznos automatski naplaćuje prije dolaska.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija",
            },
            {
              type: "p",
              text: "Nakon predujma ostaje otvoren preostali iznos. Umjesto da ga ručno pratite, postavite pravilo plaćanja koje preostalu uplatu automatski naplaćuje u fiksno vrijeme prije dolaska preko Stripea ili PayPala.",
            },
            {
              type: "steps",
              items: [
                "Otvorite u objektu područje „Pravila plaćanja”.",
                "Izradite novo pravilo tipa „Preostala uplata”, ako već postoji pravilo predujma.",
                "Odredite koliko dana prije dolaska dospijeva preostala uplata.",
                "Aktivirajte automatsku naplatu, kako bi pohranjeni pružatelj usluga plaćanja sam naplatio iznos.",
                "Nakon toga provjerite status preostale uplate u vremenskoj crti dotične rezervacije.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ako automatska naplata ne uspije, primjerice zbog istekle kartice, rezervacija se automatski ne otkazuje. Pravodobno provjerite neuspjele preostale uplate i izravno kontaktirajte gosta.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Izvršavanje povrata novca",
          excerpt: "Kako gostu vratiti iznos u cijelosti ili djelomično.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija",
            },
            {
              type: "p",
              text: "Kod otkazivanja ili reklamacije gostu možete u cijelosti ili djelomično vratiti plaćeni iznos. Povrat novca odvija se preko istog pružatelja usluga plaćanja preko kojeg je izvorno plaćeno — Stripe ili PayPal.",
            },
            {
              type: "steps",
              items: [
                "Otvorite zahvaćenu rezervaciju u vremenskoj crti rezervacije.",
                "U području „Plaćanja” odaberite izvorno plaćanje koje treba vratiti.",
                "Odaberite između potpunog ili djelomičnog povrata novca.",
                "Kod djelomičnog povrata unesite željeni iznos.",
                "Potvrdite povrat novca i provjerite ažurirani status plaćanja u vremenskoj crti.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Povrat novca automatski ne mijenja status rezervacije niti zauzeta noćenja u kalendaru. Kod otkazivanja dodatno provjerite treba li zahvaćena noćenja ponovno osloboditi u rasporedu zauzetosti.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Upravljanje jamčevinom",
          excerpt: "Kako postaviti jamčevinu i ponovno je osloboditi nakon boravka.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija",
            },
            {
              type: "p",
              text: "Jamčevina vas osigurava od šteta tijekom boravka. Unosi se kao vlastito pravilo plaćanja i preko Stripea ili PayPala unaprijed se ovlašćuje ili naplaćuje, ovisno o konfiguraciji objekta.",
            },
            {
              type: "steps",
              items: [
                "Otvorite u objektu područje „Pravila plaćanja” i izradite pravilo tipa „Jamčevina”.",
                "Odredite iznos jamčevine i trenutak ovlaštenja, obično kratko prije dolaska.",
                "Nakon odjave provjerite stanje objekta.",
                "Ako je stanje besprijekorno, jamčevinu u cijelosti oslobodite preko rezervacije.",
                "Kod štete vratite samo nepotreban dio i dokumentirajte razlog zadržavanja.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ovlaštena, ali nenaplaćena jamčevina ovisno o pružatelju usluga plaćanja automatski istječe nakon određenog roka. Jamčevinu oslobodite pravodobno nakon odjave ili pravovremeno naplatite potreban iznos.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Ispravljanje fakture",
          excerpt: "Kako naknadno ispraviti već izdanu fakturu.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija",
            },
            {
              type: "p",
              text: "Ako već izdana faktura sadrži pogrešku, primjerice u adresi za fakturiranje ili stavci, ispravite je preko rezervacije, umjesto da jednostavno izbrišete izvornu fakturu.",
            },
            {
              type: "steps",
              items: [
                "Otvorite zahvaćenu rezervaciju u vremenskoj crti rezervacije i prijeđite u područje „Fakture”.",
                "Odaberite pogrešnu fakturu.",
                "Izradite ispravnu odnosno storno-fakturu za izvornu fakturu.",
                "Zatim izradite novu, ispravljenu fakturu s točnim podacima.",
                "Ispravljenu fakturu ponovno pošaljite gostu odnosno na adresu za fakturiranje.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Već poslanu fakturu radi sljedivosti ne biste trebali izravno prebrisati. Ispravak putem storno-fakture čuva izvorni dokument i čini promjenu sljedivom.",
            },
          ],
        },
      ],
    },
  ],
};
