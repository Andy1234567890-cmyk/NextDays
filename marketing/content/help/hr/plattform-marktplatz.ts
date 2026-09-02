import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Platforma (tržište)",
  description: "Prodaja na myBestDays tržištu.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Tržište",
      articles: [
        {
          slug: "der-marktplatz",
          title: "myBestDays tržište",
          excerpt: "Globalno myBestDays tržište vlastiti je kanal za rezervacije uz portale i web-stranicu.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "myBestDays tržište (/plattform) globalni je kanal rezervacija samog myBestDays — usporediv s Bookingom ili Airbnb-om, ali dio je iste platforme. Gosti tamo pretražuju objekte svih povezanih poslovanja i izravno rezerviraju.",
            },
            { type: "h2", text: "Ne „izravno”, nego ravnopravan kanal" },
            {
              type: "p",
              text: "Tržište ne zamjenjuje izravnu rezervaciju preko vaše vlastite web-stranice. To je samostalan, treći prodajni put s vlastitom osi vidljivosti, vlastitom bazom gostiju i vlastitom provizijom — baš kao portal, samo što njime upravlja sam myBestDays.",
            },
            { type: "h2", text: "Kako objekti dolaze na tržište" },
            {
              type: "ul",
              items: [
                "Objekt mora biti aktivan (status objekta dopušta prodaju).",
                "Vidljivost na tržištu mora biti uključena — odvojeno od portala i web-stranice.",
                "Za željeno razdoblje mora postojati dostupnost u kalendaru.",
              ],
            },
            { type: "h2", text: "Rezervacije s tržišta" },
            {
              type: "p",
              text: "Rezervacija s tržišta odmah blokira odgovarajuća noćenja na svim drugim kanalima — jednako kao rezervacija s portala ili web-stranice. Pojavljuje se u vašem kalendaru i rezervacijama kao i svaka druga rezervacija, označena kanalom „Platforma”.",
            },
            {
              type: "note",
              variant: "info",
              text: "Stop-sell i neaktivan status objekta djeluju kanalno-obuhvatno i blokiraju i tržište — neovisno o prekidaču vidljivosti tržišta.",
            },
            {
              type: "p",
              text: "Kako aktivirati objekt za tržište, pročitajte pod [Postavljanje objekta na tržište](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Postavljanje objekta na tržište",
          excerpt: "Vidljivost na tržištu vlastiti je prekidač, odvojen od portala i web-stranice.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Vidljivošću na tržištu upravljate vlastitim prekidačem na objektu — neovisno o tome je li isti objekt vidljiv i na portalima ili vašoj web-stranici.",
            },
            { type: "h2", text: "Kako postaviti objekt na tržište" },
            {
              type: "steps",
              items: [
                "Otvorite objekt pod Objekti.",
                "Prijeđite na karticu Vidljivost.",
                "Aktivirajte prekidač Tržište platforme.",
                "Provjerite je li status objekta aktivan i postoji li dostupnost u kalendaru.",
              ],
            },
            { type: "h2", text: "Preduvjet: potpun profil" },
            {
              type: "p",
              text: "Tržište prikazuje samo objekte s potpunim podacima — naslovna fotografija, opis, oprema i osnovna cijena moraju biti uneseni. Ako nedostaju obavezni podaci, objekt ostaje nevidljiv unatoč aktiviranom prekidaču.",
            },
            {
              type: "ul",
              items: [
                "Barem jedna naslovna fotografija i opis",
                "Obilježja opreme s popisa po kategorijama",
                "Popunjenost i osnovna cijena u pohranjenoj valuti objekta",
                "Dostupnost u kalendaru za željeno razdoblje",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Kliknite na „Objavi“, myNextDays će istovremeno aktivirati portale i web stranicu. myBestDays je obvezan kanal: Svaki objekt je tamo naveden i pojavljuje se čim odobrimo oglas.",
            },
            { type: "h2", text: "Ponovno uklanjanje vidljivosti" },
            {
              type: "p",
              text: "myBestDays se ne može pojedinačno odabrati. Ako objekt više ne želite prodavati, koristite „Pauziraj prodaju“ – to će ga ukloniti iz prodaje na svim portalima, web stranici i tržnici istovremeno. Već potvrđene rezervacije ostaju nepromijenjene i nastavljaju se kao i obično, pogledajte [Provizija tržnice](/hilfe/plattform-marktplatz/marktplatz-provizija).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Provizija tržišta",
          excerpt: "Za svaku rezervaciju posredovanu preko tržišta obračunava se provizija određena tarifom.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Kao i kod svakog portala za rezervacije, za rezervacije ostvarene preko myBestDays tržišta obračunava se provizija. Izračunava se po rezervaciji i neovisna je o eventualnim provizijama za portale.",
            },
            { type: "h2", text: "Kako se izračunava provizija" },
            {
              type: "p",
              text: "Visina ovisi o proviziji određenoj tarifom vašeg poslovanja. Trenutnu stopu uvijek pronalazite pod Račun u odjeljku Obračun — ondje se ne pretpostavlja paušalna vrijednost, nego se prikazuje stopa koja stvarno vrijedi za vašu tarifu.",
            },
            { type: "h2", text: "Gdje vidite proviziju" },
            {
              type: "steps",
              items: [
                "Otvorite Račun u izborniku.",
                "Prijeđite u odjeljak Obračun.",
                "Otvorite rezervaciju s tržišta kako biste detaljno vidjeli prihod i proviziju.",
                "Provjerite pregled provizija za tekuće obračunsko razdoblje.",
              ],
            },
            { type: "h2", text: "Razlika u odnosu na provizije portala" },
            {
              type: "ul",
              items: [
                "Provizija tržišta vrijedi isključivo za rezervacije preko myBestDays tržišta.",
                "Rezervacije s portala (Booking, Airbnb i drugi) podliježu uvjetima dotičnog portala.",
                "Rezervacije s web-stranice podliježu uvjetima određenim vašom tarifom, bez provizije tržišta.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Provizija se automatski utvrđuje iz vaše tarife. Nedostajuća ili nejasna tarifa dovodi do jasne poruke o pogrešci umjesto procijenjene vrijednosti.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Profil gosta i recenzije",
          excerpt: "Gosti s tržišta imaju profil s poviješću rezervacija i mogu ostaviti recenzije.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Gosti koji rezerviraju preko myBestDays tržišta izrađuju vlastiti profil gosta. U njemu se prikupljaju njihove rezervacije, poruke s poslovanjima i ostavljene recenzije — slično kao kod korisničkog računa na portalu.",
            },
            { type: "h2", text: "Što vidite kao poslovanje" },
            {
              type: "p",
              text: "U detaljima rezervacije s tržišta pronalazite profil gosta s dosadašnjim boravcima u vašem poslovanju te, ako ih je gost učinio javnima, vidljive recenzije za druge smještaje.",
            },
            { type: "h2", text: "Recenzije nakon boravka" },
            {
              type: "steps",
              items: [
                "Nakon odjave gost dobiva poziv da ostavi recenziju.",
                "Recenzija se, nakon kratke provjere, pojavljuje na stranici objekta na tržištu.",
                "Kao poslovanje možete javno odgovoriti na svaku recenziju.",
                "Neprimjerene ili zlonamjerne recenzije možete prijaviti na provjeru putem funkcije Prijavi.",
              ],
            },
            {
              type: "ul",
              items: [
                "Recenzije su vezane uz stvarnu rezervaciju — nema recenzije bez boravka.",
                "Gost ocjenjuje čistoću, komunikaciju, lokaciju i odnos cijene i kvalitete.",
                "Vaš odgovor vidljiv je svim posjetiteljima tržišta.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Dobre recenzije izravno utječu na poziciju vašeg objekta u pretrazi tržišta — pravodobno i objektivno reagirajte na kritike.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Blokirane osobe",
          excerpt: "Poslovanje može blokirati gosta, čime se sprječavaju poruke i rezervacije.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Ako dođe do problema s gostom, kao poslovanje ga možete blokirati. Blokirana osoba vam više ne može slati poruke niti izraditi novu rezervaciju kod vašeg poslovanja.",
            },
            { type: "h2", text: "Blokiranje osobe" },
            {
              type: "steps",
              items: [
                "Otvorite povijest poruka ili rezervaciju s dotičnim gostom.",
                "Kliknite Blokiraj gosta.",
                "Potvrdite dijalog — blokada vrijedi odmah.",
                "Blokirana osoba zatim se pojavljuje u Računu pod Blokirane osobe.",
              ],
            },
            { type: "h2", text: "Što blokada uzrokuje" },
            {
              type: "ul",
              items: [
                "Gost vašem poslovanju više ne može slati nove poruke.",
                "Gost ne može izraditi novu rezervaciju kod vašeg poslovanja.",
                "Tekuća rezervacija s već potvrđenim dolaskom unutar sljedeća dva tjedna ostaje neovisna o blokadi, kako bi se boravak mogao uredno odviti.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Blokada vrijedi isključivo za vaše poslovanje. Druga poslovanja na tržištu ne vide blokadu i nisu njome zahvaćena.",
            },
            { type: "h2", text: "Ponovno ukidanje blokade" },
            {
              type: "p",
              text: "Otvorite Račun i tamo Blokirane osobe. Odaberite unos i kliknite Ukini blokadu — gost zatim ponovno može slati poruke i rezervirati.",
            },
          ],
        },
      ],
    },
  ],
};
