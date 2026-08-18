import type { LegalDoc } from "../types";

// Kroatische Fassung der Gast-AGB. Quelle ist content/legal/agb/de.ts —
// Änderungen immer zuerst dort.
export const agb: LegalDoc = {
  title: "Uvjeti korištenja za goste (Opći uvjeti)",
  stand: "Posljednje ažuriranje: 3. srpnja 2026.",
  intro: [
    "Ovi Uvjeti korištenja uređuju korištenje portala za rezervacije myBestDays (u daljnjem tekstu „Platforma”) od strane putnika i osoba koje rezerviraju (u daljnjem tekstu „Gost”).",
    "Operater Platforme je [puni naziv tvrtke, pravni oblik, adresa i registarski podaci operatera — dopuniti prije objave] (u daljnjem tekstu „myBestDays” ili „mi”).",
  ],
  sections: [
    {
      heading: "§ 1 Područje primjene",
      paragraphs: [
        "Ovi uvjeti primjenjuju se na korištenje Platforme, osobito na pretraživanje smještaja i rezervaciju usluga smještaja putem Platforme.",
        "Za samu uslugu smještaja dodatno vrijede uvjeti dotičnog pružatelja (npr. kućni red, uvjeti otkazivanja) navedeni u ponudi.",
      ],
    },
    {
      heading: "§ 2 Uloga platforme myBestDays; sklapanje ugovora",
      paragraphs: [
        "myBestDays posreduje pri pružanju usluga smještaja koje nude dotični pružatelji (agencije, iznajmljivači ili vlasnici, u daljnjem tekstu „Pružatelj”). Ugovor o smještaju sklapa se isključivo između Gosta i dotičnog Pružatelja. myBestDays ne postaje ugovorna strana ugovora o smještaju.",
        "Dotični Pružatelj naveden je u ponudi i u potvrdi rezervacije.",
      ],
    },
    {
      heading: "§ 3 Rezervacija i potvrda rezervacije",
      paragraphs: [
        "Prikaz smještaja na Platformi predstavlja poziv na davanje ponude za rezervaciju. Dovršetkom postupka rezervacije (klikom na gumb za rezervaciju s obvezom plaćanja) Gost daje obvezujuću ponudu za sklapanje ugovora o smještaju s Pružateljem.",
        "Ugovor je sklopljen kada rezervacija bude potvrđena. Potvrda rezervacije šalje se Gostu na navedenu adresu e-pošte.",
        "Gost je dužan prilikom rezervacije navesti točne i potpune podatke (osobito ime, kontaktne podatke i broj putnika).",
      ],
    },
    {
      heading: "§ 4 Cijene i plaćanje",
      paragraphs: [
        "Vrijede cijene navedene u ponudi u trenutku rezervacije, uključujući ondje navedene poreze, naknade i dodatne troškove. Cijene se prikazuju u valuti navedenoj u ponudi. Na licu mjesta mogu se naplatiti dodatne lokalne pristojbe (npr. boravišna pristojba), ako je to navedeno u ponudi.",
        "Plaćanje se obrađuje putem pružatelja platnih usluga Stripe. Podatke o plaćanju (npr. podatke o kartici) izravno prikuplja i obrađuje Stripe; myBestDays ne pohranjuje potpune podatke o kartici. Stripe obrađuje osobne podatke u skladu s [pravilima o privatnosti Stripea](https://stripe.com/privacy).",
        "Ako je u ponudi naveden sigurnosni polog, on može biti predautoriziran prilikom rezervacije ili dolaska te u slučaju štete u cijelosti ili djelomično zadržan; mjerodavni su podaci navedeni u ponudi.",
      ],
    },
    {
      heading: "§ 5 Otkazivanje, promjena rezervacije i pravo na odustanak",
      paragraphs: [
        "Može li se rezervacija besplatno otkazati ili promijeniti i pod kojim uvjetima, određuju uvjeti otkazivanja Pružatelja navedeni u ponudi.",
        "Za usluge smještaja rezervirane za određeno razdoblje u pravilu ne postoji zakonsko pravo na odustanak, u skladu s člankom 16. točkom (l) Direktive EU o pravima potrošača odnosno odgovarajućim nacionalnim propisima. Prisilna zakonska prava Gosta ostaju netaknuta.",
      ],
    },
    {
      heading: "§ 6 Obveze Gosta",
      paragraphs: [
        "Gost koristi smještaj u skladu s ugovorom, pridržava se najvećeg dopuštenog broja osoba navedenog u ponudi i poštuje kućni red Pružatelja.",
        "Platforma se ne smije zloupotrebljavati, osobito ne za fiktivne rezervacije, prijevarna plaćanja ili objavu nezakonitih sadržaja (npr. u recenzijama ili porukama).",
      ],
    },
    {
      heading: "§ 7 Odgovornost platforme myBestDays",
      paragraphs: [
        "Za pružanje usluge smještaja odgovoran je isključivo Pružatelj. myBestDays ne odgovara za točnost sadržaja ponuda koje objavljuju Pružatelji, ali posredovanje i obradu plaćanja obavlja s pažnjom urednog gospodarstvenika.",
        "myBestDays odgovara neograničeno za namjeru i grubu nepažnju te za štete nastale povredom života, tijela ili zdravlja. Kod obične nepažnje myBestDays odgovara samo za povredu bitnih ugovornih obveza (kardinalnih obveza), ograničeno na predvidivu štetu tipičnu za ugovor. Prisilna zakonska pravila o odgovornosti ostaju netaknuta.",
      ],
    },
    {
      heading: "§ 8 Zaštita podataka",
      paragraphs: [
        "myBestDays obrađuje osobne podatke Gosta radi provedbe posredovanja i rezervacije. Podaci o rezervaciji prosljeđuju se dotičnom Pružatelju u mjeri u kojoj je to potrebno za izvršenje ugovora o smještaju. Za obradu plaćanja vrijedi § 4.",
        "Pojedinosti proizlaze iz informacija o zaštiti podataka Platforme.",
      ],
    },
    {
      heading: "§ 9 Prigovori i rješavanje sporova",
      paragraphs: [
        "Prigovore u vezi sa smještajem Gost najprije upućuje Pružatelju; za pitanja o rezervaciji ili plaćanju podrška platforme myBestDays dostupna je putem kontaktnih kanala navedenih na Platformi.",
        "myBestDays nije obvezan niti voljan sudjelovati u postupcima rješavanja sporova pred tijelom za alternativno rješavanje potrošačkih sporova, osim ako postoji zakonska obveza.",
      ],
    },
    {
      heading: "§ 10 Izmjene ovih uvjeta",
      paragraphs: [
        "myBestDays može izmijeniti ove uvjete s učinkom za budućnost ako je to potrebno iz opravdanih razloga (osobito zbog izmjena zakonodavstva ili promjena sudske prakse) i ako Gost time nije nerazmjerno stavljen u nepovoljniji položaj. Za već sklopljene rezervacije vrijedi verzija važeća u trenutku rezervacije.",
      ],
    },
    {
      heading: "§ 11 Završne odredbe",
      paragraphs: [
        "Primjenjuje se pravo države u kojoj operater ima sjedište, uz isključenje Konvencije UN-a o ugovorima o međunarodnoj prodaji robe. Ako je Gost potrošač, prisilni propisi o zaštiti potrošača države u kojoj Gost ima uobičajeno boravište ostaju netaknuti.",
        "Ako pojedine odredbe ovih uvjeta budu ili postanu nevaljane, to ne utječe na valjanost ostalih odredaba.",
      ],
    },
  ],
};
