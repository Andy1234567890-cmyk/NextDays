import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Mobilna aplikacija",
  description: "myNextDays aplikacija za pokret.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "Aplikacija",
      articles: [
        {
          slug: "die-app",
          title: "myNextDays aplikacija",
          excerpt: "Jedan račun, četiri iskustva: gost, agencija, vlasnik i zaposlenik.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "myNextDays aplikacija mobilna je platforma za cijelo vaše poslovanje. Nije zaseban proizvod, nego ravnopravno sučelje uz vašu web nadzornu ploču — oboje pristupa istom računu i istim podacima, samo je sučelje optimizirano za pokret.",
            },
            { type: "h2", text: "Četiri iskustva u jednoj aplikaciji" },
            {
              type: "ul",
              items: [
                "Gost: pregled rezervacija, komunikacija s poslovanjem, dohvat podataka za prijavu.",
                "Agencija: pregledno upravljanje s više poslovanja i objekata.",
                "Vlasnik: uvid samo za čitanje u vlastite objekte, popunjenost i izvještaje.",
                "Zaposlenik: kalendar, zadaci i planovi čišćenja za operativnu svakodnevicu.",
              ],
            },
            { type: "h2", text: "Koje iskustvo vidite" },
            {
              type: "p",
              text: "Nakon prijave aplikacija automatski prikazuje odgovarajuće iskustvo za vašu ulogu — istu ulogu koja vrijedi i na web nadzornoj ploči. Zaposlenik s ograničenim pravima u aplikaciji vidi točno ista ograničenja kao u pregledniku, jer se ovlast provjerava na strani poslužitelja.",
            },
            {
              type: "note",
              variant: "info",
              text: "Više o ulogama i onome što svaka smije vidjeti pronaći ćete pod [Uloge i ovlasti](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Za aplikaciju vam ne treba zasebna registracija — jednostavno se prijavite postojećim myNextDays podacima za pristup.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Instalacija i prijava u aplikaciju",
          excerpt: "Kako preuzeti myNextDays aplikaciju i prijaviti se.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "myNextDays aplikacija dostupna je za iOS i Android. Prijava se odvija istim podacima za pristup kao na web nadzornoj ploči — nije potreban zaseban račun niti ponovna registracija.",
            },
            { type: "h2", text: "Instalacija" },
            {
              type: "steps",
              items: [
                "Otvorite App Store (iOS) ili Google Play (Android).",
                "Potražite „myNextDays”.",
                "Instalirajte aplikaciju na svom pametnom telefonu ili tabletu.",
                "Otvorite aplikaciju nakon instalacije.",
              ],
            },
            { type: "h2", text: "Prijava" },
            {
              type: "steps",
              items: [
                "Dodirnite „Prijava”.",
                "Unesite svoju e-adresu i lozinku.",
                "Po potrebi potvrdite upit za dvofaktorsku autentifikaciju.",
                "Automatski dolazite u iskustvo koje odgovara vašoj ulozi.",
              ],
            },
            {
              type: "ul",
              items: [
                "Podaci za pristup identični su onima na web nadzornoj ploči.",
                "Ako vam je pristup oduzet, i prijava u aplikaciju odmah je blokirana.",
                "Kod problema s lozinkom upotrijebite „Zaboravljena lozinka” izravno u aplikaciji.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Prijavite se isključivo preko službenog unosa „myNextDays” u trgovini aplikacija; aplikacija nikada ne traži podatke za pristup izvan ekrana za prijavu.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Upravljanje na putu",
          excerpt: "Obrada rezervacija, poruka i zadataka izravno s pametnog telefona.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "myNextDays aplikacija posebno je pogodna za tekuće poslovanje na putu: vidite trenutne rezervacije, odgovarate na poruke gostiju i obrađujete zadatke bez potrebe da sjedite za računalom — promjene se u stvarnom vremenu pojavljuju i na web nadzornoj ploči.",
            },
            { type: "h2", text: "Rezervacije na dohvat ruke" },
            {
              type: "p",
              text: "U području „Rezervacije” vidite dolaske i odlaske, popunjenost i status po objektu. Zaposlenik i čišćenje pritom vide samo za njih relevantne podatke, bez cijena ili prodajnih detalja.",
            },
            { type: "h2", text: "Poruke i zadaci" },
            {
              type: "steps",
              items: [
                "Otvorite područje „Poruke” kako biste izravno odgovorili na upite gostiju.",
                "Prijeđite u „Zadaci” kako biste vidjeli sebi dodijeljene stavke.",
                "Dodirnite zadatak kako biste otvorili detalje i dovršili ga.",
                "Obavljene termine čišćenja izravno na licu mjesta označite kao dovršene.",
              ],
            },
            {
              type: "ul",
              items: [
                "Nove poruke i zadaci pojavljuju se uživo, bez ručnog osvježavanja.",
                "Dovršeni zadaci odmah su vidljivi i na web nadzornoj ploči.",
                "Vlasnici vide rezervacije i izvještaje svojih objekata, ali samo za čitanje.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Push obavijesti informiraju vas o novim porukama i dodijeljenim zadacima, čim ih dopustite u postavkama uređaja.",
            },
          ],
        },
      ],
    },
  ],
};
