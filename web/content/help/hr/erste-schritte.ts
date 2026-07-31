import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Prvi koraci",
  description: "Postavite račun i počnite raditi za nekoliko minuta.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Postavljanje",
      articles: [
        {
          slug: "willkommen",
          title: "Dobrodošli u myNextDays",
          excerpt: "Pregled PMS-a, upravitelja kanala, tržišta i aplikacije.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "myNextDays je vaša središnja platforma za smještajne objekte za odmor i hotele. Umjesto više odvojenih rješenja, dostupnost, cijene, rezervacije i komunikaciju s gostima upravljate na jednom mjestu — bez obzira vodite li jednu kuću za odmor ili više hotelskih soba.",
            },
            { type: "h2", text: "Četiri gradivna elementa" },
            {
              type: "ul",
              items: [
                "PMS (sustav za upravljanje objektima): objekti, kalendar, cijene, rezervacije, zadaci i plaćanja.",
                "Upravitelj kanala: povezivanje s portalima poput Bookinga, Airbnb-a i drugih — jedan unos, svi portali sinkronizirano.",
                "Tržište platforme: vlastito myBestDays tržište, ravnopravan kanal rezervacija uz portale.",
                "Aplikacija: mobilna aplikacija za goste, vlasnike i zaposlenike s istim podacima kao na webu.",
              ],
            },
            { type: "h2", text: "Kako gradivni elementi surađuju" },
            {
              type: "p",
              text: "Objekt, cijene i dostupnost uređujete jednom, središnje u PMS-u. Odatle myNextDays automatski distribuira podatke na sve aktivne kanale. Rezervacija — bez obzira preko kojeg kanala stigne — odmah blokira odgovarajuća noćenja posvuda, tako da su dvostruke rezervacije isključene.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Počnite s postavljanjem računa i poslovanja, a zatim izradite svoj prvi objekt — taj redoslijed vam kasnije štedi ispravke.",
            },
            { type: "h2", text: "Sljedeći koraci" },
            {
              type: "steps",
              items: [
                "Otvorite Račun u izborniku i dopunite podatke o svom poslovanju.",
                "Izradite svoj prvi objekt pod Objekti.",
                "Provjerite jesu li oprema, fotografije i cijene potpuni.",
                "Kliknite Objavi kako biste objekt učinili vidljivim na svim kanalima.",
              ],
            },
            {
              type: "p",
              text: "Više o pojedinim koracima pronaći ćete u [Postavljanje računa i poslovanja](/hilfe/erste-schritte/konto-einrichten) i [Izrada vašeg prvog objekta](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Postavljanje računa i poslovanja",
          excerpt: "Ispravno unesite osnovne podatke, adresu za fakturiranje i valutu.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Prije nego što izradite objekte, postavite svoje poslovanje u Računu. Ti podaci potrebni su za fakture, portale i obračun s myNextDays, pa bi trebali biti potpuni i točni.",
            },
            { type: "h2", text: "Unos osnovnih podataka" },
            {
              type: "steps",
              items: [
                "Otvorite Račun u izborniku.",
                "Pod Osnovni podaci unesite naziv tvrtke odnosno ime obrta, adresu i kontaktne podatke.",
                "Unesite adresu za fakturiranje — pojavljuje se na svim izdanim fakturama.",
                "Odaberite svoju osnovnu valutu. Ona vrijedi za sve cijene, dok je ne promijenite posebno za pojedini objekt.",
              ],
            },
            { type: "h2", text: "Zašto je valuta važna" },
            {
              type: "p",
              text: "Valuta se ne pretpostavlja niti automatski dopunjava: ako nedostaje, nijedna cijena ne može se ispravno prikazati ili obračunati. Zato myNextDays pri postavljanju zahtijeva svjestan odabir, umjesto da postavi zadanu vrijednost.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ako naknadno promijenite valutu objekta, svi tarifni planovi vezani uz njega preračunavaju se u novu valutu. Nakon toga jednom provjerite cijene.",
            },
            { type: "h2", text: "Adresa za fakturiranje i obračun" },
            {
              type: "p",
              text: "Pod Obračun u Računu vidite svoje tekuće fakture i pohranjenu adresu za fakturiranje. Održavajte je ažurnom, osobito kod promjene pravnog oblika ili adrese, kako bi fakture bile ispravno izdane.",
            },
            {
              type: "ul",
              items: [
                "Naziv tvrtke odnosno ime obrta",
                "Adresa za fakturiranje s državom",
                "OIB odnosno PDV identifikacijski broj, ako postoji",
                "Osnovna valuta za nove objekte",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Izrada vašeg prvog objekta",
          excerpt: "Korak po korak do vašeg prvog objekta koji se može rezervirati.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Objekt u myNextDays uvijek je točno jedna jedinica koja se može rezervirati: ili pojedinačna soba u hotelu ili cijeli objekt za odmor. Ako vodite hotel s više soba, za svaku sobu izradite zaseban objekt.",
            },
            { type: "h2", text: "Izrada objekta" },
            {
              type: "steps",
              items: [
                "Otvorite Objekti u izborniku.",
                "Kliknite Dodaj objekt.",
                "Odaberite tip objekta: kategoriju, tip nekretnine i vrstu ponude.",
                "Dopunite adresu, kapacitet i osnovnu cijenu u svojoj pohranjenoj valuti.",
                "Spremite objekt kao nacrt kako biste ga kasnije dovršili.",
              ],
            },
            { type: "h2", text: "Što još nedostaje nakon toga" },
            {
              type: "p",
              text: "Novoizrađeni objekt najprije je nacrt i nije vidljiv ni na jednom kanalu. Dopunite opremu, fotografije, opis i dostupnost u kalendaru prije nego što ga objavite — samo se potpun objekt može pouzdano prodavati.",
            },
            {
              type: "ul",
              items: [
                "Odaberite obilježja opreme s popisa po kategorijama",
                "Unesite barem jednu naslovnu fotografiju i opis",
                "Točno unesite kapacitet (odrasli, djeca, kreveti)",
                "Provjerite osnovnu cijenu i dostupnost u kalendaru",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ako vodite više tipova soba, ponovite ovaj postupak za svaku pojedinu sobu — ne postoji nadređena razina zgrade sa sobama ispod nje.",
            },
            {
              type: "p",
              text: "Kad su sva obavezna polja popunjena, možete objaviti objekt, vidi [Objavljivanje objekta](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Objavljivanje objekta",
          excerpt: "Jedan klik istovremeno uključuje tržište platforme, portale i web-stranicu.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Objavljivanje čini objekt vidljivim i dostupnim za rezervaciju. U pravilu je dovoljan jedan klik kako biste istovremeno aktivirali sva tri prodajna kanala — no vidljivost svakog kanala možete u svakom trenutku prilagoditi zasebno.",
            },
            { type: "h2", text: "Kako objaviti" },
            {
              type: "steps",
              items: [
                "Otvorite objekt pod Objekti.",
                "Na kartici Pregled provjerite jesu li svi obavezni podaci označeni zeleno.",
                "Kliknite Objavi.",
                "Potvrdite dijalog — tržište platforme, portali i web-stranica se aktiviraju.",
              ],
            },
            { type: "h2", text: "Zasebno upravljanje kanalima" },
            {
              type: "p",
              text: "Nakon objave na kartici Vidljivost pronaći ćete tri odvojena prekidača: web-stranica, tržište platforme i portali. Ako, primjerice, želite objekt ponuditi samo na svojoj web-stranici, ali ne preko portala, jednostavno isključite odgovarajući prekidač.",
            },
            {
              type: "ul",
              items: [
                "Web-stranica: vidljivost na vašoj vlastitoj myNextDays web-stranici",
                "Tržište platforme: vidljivost na globalnom myBestDays tržištu",
                "Portali: vidljivost na Bookingu, Airbnb-u i drugima",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ova tri prekidača neovisna su o statusu objekta (aktivan/neaktivan). Aktivan objekt svejedno može biti nevidljiv na pojedinim kanalima.",
            },
            { type: "h2", text: "Privremeno blokiranje objekta" },
            {
              type: "p",
              text: "Ako želite blokirati samo jedan dan umjesto cijelog objekta, upotrijebite stop-sell u kalendaru — time se dan blokira na svim kanalima istovremeno, neovisno o prekidačima vidljivosti.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Razumijevanje triju prodajnih kanala",
          excerpt: "Pregled portala, tržišta platforme i aplikacije.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "myNextDays istovremeno prodaje svaki objekt preko više ravnopravnih putova. Razumijevanje kako oni surađuju pomaže vam da ciljano upravljate vidljivošću i cijenama.",
            },
            { type: "h2", text: "Portali" },
            {
              type: "p",
              text: "Preko upravitelja kanala povezujete svoj objekt s velikim portalima za rezervacije poput Bookinga, Airbnb-a i drugih. Dostupnost i cijene automatski se sinkroniziraju, tako da ne morate ručno održavati više kalendara portala.",
            },
            { type: "h2", text: "Tržište platforme" },
            {
              type: "p",
              text: "myBestDays tržište vlastiti je, globalni kanal za rezervacije — usporediv s Bookingom ili Airbnb-om, ali dio je iste platforme. Nije zamjena za „izravno rezerviranje”, nego ravnopravan kanal s vlastitom osi vidljivosti.",
            },
            { type: "h2", text: "Aplikacija" },
            {
              type: "p",
              text: "Mobilna aplikacija gostima, vlasnicima i zaposlenicima pruža pristup istim podacima kao web — primjerice detaljima rezervacije, porukama ili zadacima, ovisno o ulozi.",
            },
            { type: "h2", text: "Tri odvojene osi vidljivosti" },
            {
              type: "ul",
              items: [
                "Web-stranica — vaša vlastita myNextDays web-stranica",
                "Tržište platforme — globalno myBestDays tržište",
                "Portali — Booking, Airbnb i drugi preko upravitelja kanala",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Sve tri osi mogu se uključivati i isključivati neovisno jedna o drugoj. Stop-sell i status objekta, s druge strane, djeluju kanalno-obuhvatno na sve tri istovremeno.",
            },
          ],
        },
      ],
    },
  ],
};
