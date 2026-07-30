import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Alat za izradu web-stranica",
  description: "Izradite vlastitu web-stranicu za rezervacije pomoću alata.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Alat za izradu web-stranica",
      articles: [
        {
          slug: "website-erstellen",
          title: "Izrada web-stranice",
          excerpt: "Alatom u nekoliko minuta izrađujete vlastitu web-stranicu za rezervacije.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Alat za izradu web-stranica izrađuje vam vlastitu web-stranicu za rezervacije — dodatni prodajni kanal uz portale i myNextDays tržište. Zadržavate potpunu kontrolu nad strukturom, sadržajem i brendiranjem.",
            },
            { type: "h2", text: "Kako izraditi web-stranicu" },
            {
              type: "steps",
              items: [
                "Otvorite Web-stranica u izborniku.",
                "Kliknite Izradi web-stranicu.",
                "Odaberite predložak kao polazište za svoj izgled.",
                "Potvrdite s Izradi web-stranicu — izravno se otvara uređivač.",
              ],
            },
            { type: "h2", text: "Što alat sadrži" },
            {
              type: "ul",
              items: [
                "Vizualni uređivač sa stranicama, slojevima i pregledom",
                "Gotovi blokovi za popise objekata, galerije i kontaktne obrasce",
                "Izravan tijek rezervacije koji se temelji na dostupnosti vašeg kalendara",
                "Prilagodljive boje, fontove i logotip u skladu s vašim brendom",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Počnite s predloškom koji je blizak vrsti vašeg objekta — objekt za odmor ili hotel — to vam kasnije štedi vrijeme pri prilagodbi blokova.",
            },
            { type: "h2", text: "Sljedeći koraci" },
            {
              type: "p",
              text: "Nakon izrade prilagodite stranice i izgled, vidi [Uređivanje stranica i izgleda](/hilfe/website/seiten-layout), te prikažite svoje objekte na web-stranici, vidi [Prikaz objekata na web-stranici](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Uređivanje stranica i izgleda",
          excerpt: "Prilagodite stranice, slojeve i blokove u vizualnom uređivaču.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Uređivač je podijeljen na tri područja: lijevo pregled stranica i slojeva, u sredini pregled vaše web-stranice, desno postavke trenutno odabranog bloka.",
            },
            { type: "h2", text: "Uređivanje stranice" },
            {
              type: "steps",
              items: [
                "Lijevo pod Stranice odaberite željenu stranicu.",
                "U pregledu kliknite na blok kako biste ga odabrali.",
                "Desno prilagodite tekst, sliku ili razmak bloka.",
                "Povucite blokove kako biste promijenili redoslijed.",
              ],
            },
            { type: "h2", text: "Dodavanje novih stranica i blokova" },
            {
              type: "p",
              text: "Putem gumba Dodaj stranicu izrađujete dodatne podstranice, primjerice O nama ili Kontakt. Unutar stranice putem Dodaj blok umećete nove odjeljke poput galerije, recenzija ili kontaktnog obrasca.",
            },
            {
              type: "ul",
              items: [
                "Početna stranica, pregled objekata i kontakt unaprijed su postavljeni kod svakog predloška",
                "Dodatne stranice mogu se slobodno nazvati i uključiti u navigaciju",
                "Blokovi su responzivni i prilagođavaju se stolnom računalu, tabletu i pametnom telefonu",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Promjene u uređivaču najprije su samo nacrt. Tek klik na Objavi primjenjuje ih na vašu javnu web-stranicu.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Povezivanje domene",
          excerpt: "Povežite vlastitu domenu sa svojom myNextDays web-stranicom.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Vaša je web-stranica standardno dostupna preko myNextDays poddomene. Ako umjesto toga želite koristiti vlastitu domenu poput primjerice vase-poslovanje.hr, povežite je u odjeljku Domena.",
            },
            { type: "h2", text: "Unos domene" },
            {
              type: "steps",
              items: [
                "U web-stranici otvorite postavke i tamo Domena.",
                "Unesite svoju vlastitu domenu i kliknite Poveži.",
                "Kod svog pružatelja domene izradite prikazane DNS zapise.",
                "Pričekajte potvrdu — provjera se automatski odvija u pozadini.",
              ],
            },
            { type: "h2", text: "Ispravno postavljanje DNS zapisa" },
            {
              type: "p",
              text: "myNextDays vam prikazuje točno potrebne zapise za svog pružatelja domene. Veza postaje aktivna tek kad su ti zapisi ispravno postavljeni i prošireni diljem svijeta — to ovisno o pružatelju može potrajati nekoliko sati.",
            },
            {
              type: "ul",
              items: [
                "Postavite CNAME ili A zapis prema prikazanim uputama",
                "Prethodno uklonite postojeće, proturječne zapise za istu domenu",
                "Certifikat za https automatski se izdaje nakon uspješnog povezivanja",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez ispravno postavljenih DNS zapisa vaša web-stranica ostaje nedostupna na vlastitoj domeni — pažljivo provjerite zapis prema podacima svog pružatelja.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Prikaz objekata na web-stranici",
          excerpt: "Koji su objekti vidljivi i dostupni za rezervaciju preko web-stranice, upravljate zasebno po objektu.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Kako bi se objekt pojavio na vašoj web-stranici, vidljivost web-stranice za taj objekt mora biti uključena. Taj je prekidač neovisan o vidljivosti na myNextDays tržištu ili portalima.",
            },
            { type: "h2", text: "Aktivacija objekta za web-stranicu" },
            {
              type: "steps",
              items: [
                "Otvorite objekt pod Objekti.",
                "Prijeđite na karticu Vidljivost.",
                "Aktivirajte prekidač Web-stranica.",
                "Prijeđite na web-stranicu i provjerite blok Pregled objekata u pregledu.",
              ],
            },
            { type: "h2", text: "Prilagodba redoslijeda i prikaza" },
            {
              type: "p",
              text: "U bloku Pregled objekata određujete hoće li se objekti automatski razvrstavati prema dostupnosti ili zadajete fiksan redoslijed. Svaki objekt prikazuje naslovnu fotografiju, osnovnu cijenu u svojoj pohranjenoj valuti i najvažnija obilježja opreme.",
            },
            {
              type: "ul",
              items: [
                "Automatsko razvrstavanje prema dostupnosti ili ručni redoslijed",
                "Filtriranje po tipu objekta ili opremi po izboru moguće aktivirati",
                "Koraci rezervacije odvijaju se izravno na web-stranici, bez zaobilaska preko portala",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Objekt bez aktivirane vidljivosti web-stranice ostaje skriven iz pregleda objekata, čak i ako je vidljiv na tržištu ili kod portala.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Objavljivanje web-stranice",
          excerpt: "Nacrti postaju javno vidljivi tek klikom na Objavi.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Dok radite u uređivaču, samo vi vidite trenutni nacrt. Tek klik na Objavi čini promjene vidljivima svim posjetiteljima na vašoj domeni.",
            },
            { type: "h2", text: "Kako objaviti" },
            {
              type: "steps",
              items: [
                "U uređivaču otvorite pregled i provjerite sve stranice.",
                "Kliknite gore desno na Objavi.",
                "Potvrdite dijalog — web-stranica je odmah nakon toga uživo.",
                "Otvorite svoju domenu u novoj kartici kako biste provjerili rezultat.",
              ],
            },
            { type: "h2", text: "Nacrti i vraćanje" },
            {
              type: "p",
              text: "Dok još niste objavili, u svakom se trenutku možete vratiti na posljednje objavljeno stanje bez trajnog gubitka nacrta — za to upotrijebite Odbaci nacrt u postavkama web-stranice.",
            },
            {
              type: "ul",
              items: [
                "Objavljene promjene odmah su vidljive na vašoj domeni",
                "Neobjavljen nacrt ostaje interan dok ga ne potvrdite",
                "Svako objavljivanje bilježi se s datumom u povijesti",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Prije objavljivanja provjerite mobilni prikaz u pregledu — većina gostiju web-stranice za rezervacije otvara preko pametnog telefona.",
            },
          ],
        },
      ],
    },
  ],
};
