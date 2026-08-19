import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Poruke i gosti",
  description: "Pristigla pošta, predlošci i komunikacija s gostima.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Komunikacija",
      articles: [
        {
          slug: "posteingang",
          title: "Pristigla pošta platforme",
          excerpt: "Sve poruke gostiju vaših objekata objedinjene su u pristigloj pošti platforme.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Jedna pristigla pošta za sve objekte" },
            {
              type: "p",
              text: "Pristigla pošta platforme objedinjuje sve poruke vaših gostiju na jednom mjestu — neovisno o tome preko kojeg se objekta ili razdoblja odvija razgovor. Otvarate je pod /nachrichten i tamo svaki razgovor vidite kao zaseban niz poruka.",
            },
            { type: "h2", text: "Struktura pristigle pošte" },
            {
              type: "ul",
              items: [
                "Lijevi stupac: popis svih razgovora, najnoviji prvi",
                "Srednji stupac: aktivan tijek poruka s gostom",
                "Desni stupac: kontekst rezervacije — razdoblje, objekt, podaci o gostu",
              ],
            },
            { type: "h2", text: "Odgovor na poruku" },
            {
              type: "steps",
              items: [
                "Otvorite /nachrichten i odaberite željeni razgovor",
                "Napišite svoj odgovor u tekstualno polje ili upotrijebite brzi odgovor",
                "Pošaljite poruku — gost je prima istim putem kojim je i napisao",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Pristigla pošta platforme prikazuje isključivo izravnu komunikaciju između vas i vaših gostiju na myNextDays — poruke s portala i dalje obrađujete ondje.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Brzi odgovori",
          excerpt: "Predlošci za česta pitanja štede vrijeme u kontaktu s gostima.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Što su brzi odgovori" },
            {
              type: "p",
              text: "Brzi odgovori unaprijed su formulirani tekstualni blokovi za ponavljajuća pitanja — primjerice o dolasku, WiFi lozinci ili parkiranju. Umjesto da svaki odgovor iznova tipkate, odgovarajući predložak jednim klikom umećete u [Pristiglu poštu platforme](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Izrada brzog odgovora" },
            {
              type: "steps",
              items: [
                "Otvorite /nachrichten i kliknite „Upravljanje brzim odgovorima”",
                "Kliknite „Novi predložak” i dodijelite naslov, primjerice „Podaci za prijavu”",
                "Napišite tekst odgovora; zamjenske oznake poput imena gosta ili datuma dolaska automatski se popunjavaju kod slanja",
                "Spremite predložak — od tog trenutka dostupan je u svakom razgovoru",
              ],
            },
            { type: "h2", text: "Korištenje brzih odgovora u svakodnevnom radu" },
            {
              type: "p",
              text: "U prozoru poruka otvarate popis predložaka preko ikone munje, odaberete odgovarajući odgovor i po potrebi ga još pojedinačno prilagodite prije slanja.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Izradite predloške za pet do deset najčešćih pitanja — to u praksi pokriva veliku većinu pristiglih poruka.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Automatske poruke",
          excerpt: "Potvrde, podaci za prijavu i podsjetnici mogu se automatski slati gostima.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Automatiziranje ponavljajućih poruka" },
            {
              type: "p",
              text: "Umjesto ručnog slanja potvrda rezervacije, napomena za prijavu ili poruka zahvale, unosite ih jednom kao pravilo — myNextDays ih zatim automatski šalje u odgovarajuće vrijeme prije, tijekom ili nakon boravka.",
            },
            { type: "h2", text: "Tipični okidači za automatske poruke" },
            {
              type: "ul",
              items: [
                "Odmah nakon rezervacije — potvrda s najvažnijim podacima",
                "Nekoliko dana prije dolaska — informacije za prijavu i pristupna šifra",
                "Na dan odlaska — zahvala i molba za recenziju",
              ],
            },
            { type: "h2", text: "Postavljanje automatske poruke" },
            {
              type: "steps",
              items: [
                "Otvorite /nachrichten, odjeljak „Automatske poruke”",
                "Odaberite okidač, primjerice „X dana prije dolaska”",
                "Unesite tekst — zamjenske oznake poput imena gosta, objekta ili datuma dolaska automatski se popunjavaju",
                "Aktivirajte pravilo; vrijedi za sve objekte, ako nije drukčije ograničeno",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Automatske poruke pojavljuju se sasvim uobičajeno u [Pristigloj pošti platforme](/hilfe/nachrichten/posteingang) i ondje se mogu naknadno u svakom trenutku pregledati.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Blokiranje poruka",
          excerpt: "Osobu možete blokirati izravno iz niza poruka za daljnje kontaktiranje.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Kad je blokiranje smisleno" },
            {
              type: "p",
              text: "Kod uvredljivih poruka, uznemiravanja ili ponovljenog neprimjerenog ponašanja možete blokirati osobu izravno iz niza poruka. Blokirana vam osoba nakon toga više ne može pisati nove poruke niti kod vas izraditi novu rezervaciju.",
            },
            { type: "h2", text: "Blokiranje osobe iz niza poruka" },
            {
              type: "steps",
              items: [
                "Otvorite zahvaćeni razgovor u [Pristigloj pošti platforme](/hilfe/nachrichten/posteingang)",
                "Kliknite pri vrhu niza na izbornik i odaberite „Blokiraj osobu”",
                "Potvrdite postupak — blokada vrijedi odmah",
              ],
            },
            { type: "h2", text: "Što blokiranje znači — i što ne znači" },
            {
              type: "ul",
              items: [
                "Nove poruke blokirane osobe više se ne dostavljaju",
                "Novi upiti za rezervaciju te osobe odbijaju se",
                "Ako je trenutno u tijeku rezervacija te osobe, komunikacija iznimno ostaje moguća za trajanje boravka",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Blokada se u svakom trenutku može ukinuti u pregledu „Blokirane osobe” u Računu. Prije blokiranja provjerite postoji li već tekuća rezervacija.",
            },
          ],
        },
      ],
    },
  ],
};
