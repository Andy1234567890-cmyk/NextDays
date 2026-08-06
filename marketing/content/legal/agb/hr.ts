// KOPIE aus web/content/legal/agb/hr.ts — bewusst dupliziert, weil die
// Apps isoliert gebaut werden (ADR-0016): der Docker-Kontext dieser App
// enthält web/ nicht. Inhaltliche Änderungen IMMER in beiden Dateien.
// Zusätzlich zur web-Fassung: slug/metaDescription/numbered/toc für den
// Renderer dieser App.
import type { LegalDoc } from "../types";

// Kroatische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. § 5 folgt Stripes offiziellem Empfehlungstext (Stripe Connected
// Account Agreement) — Wortlaut und URLs nicht verändern.
export const agb: LegalDoc = {
  slug: "agb",
  metaDescription:
    "Opći uvjeti korištenja platforme myNextDays za agencije i najmodavce.",
  numbered: false,
  toc: true,
  title: "Opći uvjeti poslovanja za agencije i iznajmljivače",
  stand: "Posljednje ažuriranje: 30. srpnja 2026.",
  intro: [
    "Ovi Opći uvjeti poslovanja (u daljnjem tekstu „Uvjeti”) uređuju korištenje softverske platforme myNextDays (u daljnjem tekstu „Platforma”) od strane agencija, iznajmljivača, upravitelja nekretnina i drugih poslovnih korisnika (u daljnjem tekstu „Korisnik”).",
    "Pružatelj Platforme je myNextDays ApS, društvo s ograničenom odgovornošću (anpartsselskab) po danskom pravu, Hirtshalsvej 21, 9881 Bindslev, Danska, registrirano u danskom Središnjem registru poslovnih subjekata (CVR) pod CVR br. 46615182 (u daljnjem tekstu „myNextDays” ili „mi”).",
    "Platforma je namijenjena isključivo poduzetnicima u smislu članka 14. njemačkog Građanskog zakonika (BGB) odnosno odgovarajućih propisa dotične države članice EU-a. Nije namijenjena potrošačima.",
  ],
  sections: [
    {
      heading: "§ 1 Područje primjene",
      paragraphs: [
        "Ovi Uvjeti primjenjuju se na sve ugovore o korištenju Platforme između društva myNextDays i Korisnika te na sve usluge i module koji se putem nje pružaju.",
        "Odstupajući, suprotni ili dopunski uvjeti poslovanja Korisnika postaju sastavni dio ugovora samo ako je myNextDays njihovoj primjeni izričito pristao u tekstualnom obliku.",
      ],
    },
    {
      heading: "§ 2 Predmet ugovora i usluge",
      paragraphs: [
        "myNextDays stavlja Korisniku na raspolaganje softver u oblaku za upravljanje smještajem za odmor i objektima za pružanje usluga smještaja. Opseg funkcija proizlazi iz važećeg opisa usluga i obuhvaća osobito:",
      ],
      list: [
        "upravljanje objektima, kalendarima zauzetosti i rezervacijama (sustav za upravljanje nekretninama),",
        "povezivanje s kanalima rezervacija trećih strana (npr. Booking.com, Airbnb) putem channel managera,",
        "objavu ponuda putem vlastitog kanala rezervacija Platforme myNextDays,",
        "izradu vlastitih web-stranica putem integriranog alata za izradu stranica (page builder),",
        "funkcije računovodstva, obračuna i izvještavanja, uključujući obračune za vlasnike,",
        "komunikaciju s gostima te primanje uplata putem integrirane obrade plaćanja (§ 5).",
      ],
    },
    {
      heading: "§ 3 Registracija, račun i podaci Korisnika",
      paragraphs: [
        "Korištenje Platforme zahtijeva registraciju računa. Korisnik je dužan prilikom registracije i tijekom cijelog trajanja ugovora navesti točne, ažurne i potpune podatke o sebi i svojoj tvrtki te ih u slučaju promjena bez odgode ažurirati.",
        "Pristupni podaci moraju se čuvati u tajnosti i zaštititi od pristupa trećih osoba. Korisnik je dužan bez odgode obavijestiti myNextDays ako postoje naznake zlouporabe njegova računa.",
        "Račun nije prenosiv. Korisnik osigurava da sve osobe koje u njegovo ime koriste račun poštuju ove Uvjete.",
      ],
    },
    {
      heading: "§ 4 Uloga platforme myNextDays kod rezervacija",
      paragraphs: [
        "Ugovori o smještaju za smještajne jedinice ponuđene na Platformi, putem povezanih kanala trećih strana ili putem vlastite web-stranice Korisnika sklapaju se isključivo između Korisnika (odnosno vlasnika kojeg on zastupa) i dotičnog gosta. myNextDays ne postaje ugovorna strana ugovora o smještaju.",
        "Za točnost i zakonitost sadržaja ponuda (opisi, fotografije, cijene, raspoloživost, porezi i pristojbe) odgovoran je isključivo Korisnik.",
      ],
    },
    {
      heading: "§ 5 Obrada plaćanja putem Stripea",
      paragraphs: [
        "Usluge obrade plaćanja za agencije i iznajmljivače na platformi myNextDays pruža Stripe i one podliježu ugovoru [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), koji uključuje uvjete pružanja usluga Stripea (zajedno „Okvirni ugovor sa Stripeom”). Prihvaćanjem ovih Uvjeta ili nastavkom djelovanja kao agencija ili iznajmljivač na platformi myNextDays Korisnik pristaje biti vezan Okvirnim ugovorom sa Stripeom, koji Stripe s vremena na vrijeme može izmijeniti.",
        "Uvjet da myNextDays omogući usluge obrade plaćanja putem Stripea jest da Korisnik društvu myNextDays dostavi točne i potpune informacije o sebi i svojoj tvrtki. Korisnik ovlašćuje myNextDays da te informacije, kao i podatke o transakcijama povezane s korištenjem usluga obrade plaćanja koje pruža Stripe, proslijedi Stripeu.",
        "Za pravni odnos sa Stripeom mjerodavan je poveznicom navedeni tekst ugovora na engleskom jeziku u važećoj verziji. Ugovorna strana za korisnike u Europskom gospodarskom prostoru jest društvo Stripea navedeno u Okvirnom ugovoru sa Stripeom (trenutačno Stripe Payments Europe, Limited, Irska). Stripe obrađuje osobne podatke u skladu s [pravilima o privatnosti Stripea](https://stripe.com/privacy).",
        "Radi ispunjenja zakonskih obveza identifikacije i provjere (među ostalim sprječavanje pranja novca, „Know Your Customer”) myNextDays i Stripe mogu u svakom trenutku zatražiti dodatne podatke i dokaze, osobito identifikacijske dokumente, podatke o stvarnim vlasnicima i podatke o bankovnom računu. Ako se zatraženi podaci ili dokazi ne dostave u zadanom roku, primanje uplata ili isplate mogu se u cijelosti ili djelomično obustaviti dok podaci ne budu potpuni.",
      ],
    },
    {
      heading: "§ 6 Isplate, povrati terećenja i negativni saldi",
      paragraphs: [
        "Put plaćanja ovisi o kanalu rezervacije. Kod rezervacija ostvarenih putem vlastitog rezervacijskog sustava Korisnika i kod rezervacija putem povezanih distribucijskih portala plaćanja gostiju primaju se izravno na platni račun Korisnika; u tim je slučajevima Korisnik prema gostu primatelj plaćanja i ugovorna strana usluge smještaja (§ 4), a myNextDays ni u jednom trenutku ne postaje imatelj tih sredstava. Za takve rezervacije myNextDays ne naplaćuje postotnu naknadu za rezervaciju; provizija za rezervacije putem povezanih distribucijskih portala iskazuje se zasebno i naplaćuje naknadno.",
        "Kod rezervacija ostvarenih putem rezervacijskog portala myNextDays plaćanje se obrađuje putem myNextDaysa. myNextDays pritom zadržava posredničku proviziju navedenu u svakodobno važećem cjeniku, uključujući troškove obrade plaćanja, a preostali iznos prosljeđuje Korisniku u skladu s odredbama u nastavku. Naknada za korištenje softvera (§ 7) time nije zahvaćena.",
        "Isplate se vrše na bankovni račun koji je Korisnik naveo. myNextDays može iz razloga upravljanja rizicima prilagoditi ritam isplata, osobito kod novih računa, neuobičajenih obrazaca transakcija ili tekućih provjera.",
        "Povrate gostima ekonomski snosi Korisnik. Povrate terećenja i iz njih proizašle naknade snosi Korisnik kod rezervacija ostvarenih putem vlastitog rezervacijskog sustava i putem povezanih distribucijskih portala, budući da je Korisnik u tim slučajevima primatelj plaćanja; kod rezervacija ostvarenih putem rezervacijskog portala myNextDays rizik povrata terećenja snosi myNextDays, osim ako proizlazi iz povrede obveza Korisnika (osobito neizvršenja ili bitnog odstupanja usluge smještaja). myNextDays ima pravo prebiti iznose na teret Korisnika s budućim isplatama.",
        "Ako na računu za plaćanja Korisnika nastane negativan saldo, Korisnik ga je dužan bez odgode podmiriti. Korisnik ovlašćuje myNextDays i Stripe da negativne salde naplate s navedenog bankovnog računa, u mjeri u kojoj je to pravno dopušteno.",
      ],
    },
    {
      heading: "§ 7 Naknade i obračun",
      paragraphs: [
        "Naknade za korištenje Platforme proizlaze iz cjenika dogovorenog prilikom sklapanja ugovora odnosno iz individualne ponude. Na sve cijene dodatno se obračunavaju pripadajući zakonski porezi; cijene su iskazane u valuti navedenoj u ugovoru.",
        "Naknade ovisne o transakcijama (npr. naknade za plaćanje ili kanale) mogu se zadržati ili prebiti neposredno prilikom obrade dotične transakcije.",
        "Ako Korisnik kasni s plaćanjima, myNextDays može nakon prethodne najave blokirati pristup Platformi do podmirenja otvorenih potraživanja.",
      ],
    },
    {
      heading: "§ 8 Obveze Korisnika; vlastiti pravni tekstovi",
      paragraphs: [
        "Korisnik osigurava da su njegove ponude, sadržaji i poslovne prakse u skladu s primjenjivim propisima, osobito s propisima o pružanju usluga smještaja, prijavi gostiju, porezima i zaštiti potrošača na lokaciji smještaja. Potrebne dozvole, registracije i licencije Korisnik pribavlja i održava na vlastitu odgovornost.",
        "Za web-stranice kojima Korisnik upravlja putem alata za izradu stranica te za svoje ponude na Platformi odgovoran je sam Korisnik; to osobito uključuje vlastite opće uvjete za goste, vlastiti impresum i vlastite informacije o zaštiti podataka.",
        "Zabranjeno je osobito: objavljivanje netočnih ili obmanjujućih ponuda, provođenje fiktivnih ili prijevarnih transakcija, zaobilaženje obrade plaćanja prema § 5 za rezervacije sklopljene putem Platforme te svako korištenje koje ugrožava sigurnost ili dostupnost Platforme.",
      ],
    },
    {
      heading: "§ 9 Kanali rezervacija trećih strana",
      paragraphs: [
        "Pri povezivanju kanala trećih strana (npr. Booking.com, Airbnb) dodatno vrijede uvjeti dotičnog operatera kanala. Ugovore koji su za to potrebni Korisnik sklapa izravno s operaterom kanala.",
        "myNextDays obavlja tehničku sinkronizaciju raspoloživosti, cijena i podataka o rezervacijama, ali nema utjecaja na sadržaje, provizije ili odluke operatera kanala i ne odgovara za njihovu dostupnost.",
      ],
    },
    {
      heading: "§ 10 Dostupnost i daljnji razvoj",
      paragraphs: [
        "myNextDays pruža usluge s pažnjom urednog gospodarstvenika i nastoji postići visoku dostupnost Platforme. Razdoblja održavanja, daljnji razvoj i okolnosti izvan utjecaja društva myNextDays (npr. smetnje kod trećih pružatelja) mogu privremeno ograničiti dostupnost.",
        "myNextDays smije dalje razvijati Platformu i mijenjati funkcije ako se time ne ugrožava svrha ugovora i ako je promjena za Korisnika razumno prihvatljiva.",
      ],
    },
    {
      heading: "§ 11 Podaci i zaštita podataka",
      paragraphs: [
        "Ako myNextDays pri pružanju Platforme obrađuje osobne podatke u ime Korisnika (osobito podatke o gostima), stranke sklapaju ugovor o obradi podataka u skladu s čl. 28. Opće uredbe o zaštiti podataka (GDPR).",
        "Korisnik ostaje odgovoran za dopuštenost prikupljanja i obrade podataka koje unosi u skladu s propisima o zaštiti podataka. Pojedinosti o obradi podataka od strane društva myNextDays proizlaze iz informacija o zaštiti podataka Platforme; za obradu podataka od strane Stripea vrijedi § 5.",
      ],
    },
    {
      heading: "§ 12 Intelektualno vlasništvo",
      paragraphs: [
        "Sva prava na Platformi, njezinu softveru i njezinim sadržajima (osim sadržaja koje je unio Korisnik) pripadaju društvu myNextDays odnosno njegovim davateljima licencija. Korisnik za vrijeme trajanja ugovora dobiva jednostavno, neprenosivo pravo korištenja Platforme u ugovorenom opsegu.",
        "Korisnik na sadržajima koje unese daje društvu myNextDays jednostavna prava korištenja potrebna za rad Platforme (osobito za pohranu, umnožavanje, prikazivanje i prijenos na povezane kanale).",
      ],
    },
    {
      heading: "§ 13 Odgovornost",
      paragraphs: [
        "myNextDays odgovara neograničeno za namjeru i grubu nepažnju te za štete nastale povredom života, tijela ili zdravlja.",
        "Kod obične nepažnje myNextDays odgovara samo za povredu bitnih ugovornih obveza (kardinalnih obveza), ograničeno na predvidivu štetu tipičnu za ugovor. Odgovornost prema propisima o odgovornosti za proizvode te iz preuzetih jamstava ostaje netaknuta.",
        "Za gubitak podataka myNextDays odgovara samo u opsegu u kojem bi šteta nastala i da je Korisnik uredno i redovito izrađivao sigurnosne kopije podataka, osim ako izrada sigurnosnih kopija ugovorno nije obveza društva myNextDays.",
      ],
    },
    {
      heading: "§ 14 Trajanje, otkaz i blokada",
      paragraphs: [
        "Trajanje i otkazni rokovi proizlaze iz dotičnog ugovora. Pravo na izvanredni otkaz iz važnog razloga ostaje netaknuto.",
        "myNextDays može privremeno blokirati pristup Platformi ili pojedinim funkcijama (uključujući primanje uplata i isplate) ako postoje konkretne naznake povrede ovih Uvjeta, prijevare ili zlouporabe, ili ako je myNextDays na to obvezan zakonom ili nalogom pružatelja platnih usluga. Korisnik će o blokadi biti obaviješten u mjeri u kojoj je to pravno dopušteno.",
        "Nakon prestanka ugovora myNextDays će Korisniku na zahtjev u roku od 30 dana staviti njegove podatke na raspolaganje za izvoz u uobičajenom formatu; nakon toga podaci se brišu, osim ako tome nisu protivne zakonske obveze čuvanja.",
      ],
    },
    {
      heading: "§ 15 Izmjene ovih Uvjeta",
      paragraphs: [
        "myNextDays može izmijeniti ove Uvjete s učinkom za budućnost ako je to potrebno iz opravdanih razloga (osobito zbog izmjena zakonodavstva, promjena sudske prakse ili zahtjeva pružatelja platnih usluga) i ako Korisnik time nije nerazmjerno stavljen u nepovoljniji položaj.",
        "Izmjene se Korisniku najavljuju u tekstualnom obliku najmanje šest tjedana prije stupanja na snagu. Ako Korisnik ne prigovori u roku najave ili nastavi koristiti Platformu nakon stupanja izmjena na snagu, izmijenjeni Uvjeti smatraju se prihvaćenima; na tu će se posljedicu u najavi posebno upozoriti.",
      ],
    },
    {
      heading: "§ 16 Završne odredbe",
      paragraphs: [
        "Primjenjuje se pravo države u kojoj pružatelj ima sjedište, uz isključenje Konvencije UN-a o ugovorima o međunarodnoj prodaji robe. Prisilni propisi države u kojoj Korisnik ima sjedište ostaju netaknuti.",
        "Isključivo mjesto nadležnosti za sve sporove koji proizlaze iz ovog ugovora ili u vezi s njim jest — u mjeri u kojoj je to zakonski dopušteno — sjedište pružatelja.",
        "Ako pojedine odredbe ovih Uvjeta budu ili postanu nevaljane, to ne utječe na valjanost ostalih odredaba.",
      ],
    },
  ],
};
