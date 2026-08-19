import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Upravitelj kanala",
  description: "Ovladajte portalima i upraviteljem kanala.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Upravitelj kanala",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Povezivanje vašeg prvog portala",
          excerpt: "Kako prvi put aktivirati portal za objekt.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija: izradili ste objekt, ali još niste povezali portal",
            },
            {
              type: "p",
              text: "Vaš je objekt potpuno postavljen u myNextDays, ali još nije vidljiv ni na jednom portalu poput Bookinga.com ili Airbnb-a. Prije nego što portal prihvati objekt, vaš račun treba jednokratnu vezu s portalima na razini cijelog računa — nakon toga je za svaki daljnji objekt dovoljno samo mapiranje.",
            },
            {
              type: "steps",
              items: [
                "Otvorite /konto, odjeljak „Portali i upravitelj kanala”, i postavite vezu na razini cijelog računa sa svojim podacima o poslovanju",
                "Zatim otvorite objekt pod /objekte i prijeđite na karticu „Portali”",
                "Odaberite željeni portal i pridružite ga odgovarajućem tipu sobe odnosno ponude",
                "Provjerite fotografije, opremu, cijene i uvjete otkazivanja — portali zahtijevaju potpune podatke",
                "Aktivirajte vidljivost; status se nakon provjere od strane portala mijenja u „Povezano”",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vezu na razini cijelog računa postavljate samo jednom. Detalje o tome pod [Povezivanje Bookinga.com](/hilfe/portale-kanalmanager/booking-verbinden) i [Povezivanje Airbnb-a](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Povezivanje Bookinga.com",
          excerpt: "Kako objekt preko upravitelja kanala učiniti dostupnim za rezervaciju na Bookingu.com.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija: vaš objekt treba postati vidljiv i na Bookingu.com",
            },
            {
              type: "p",
              text: "Booking.com jedan je od portala koji se povezuju preko upravitelja kanala. Preduvjet je veza s portalima na razini cijelog računa — ako je već postavljena, za Booking.com trebate samo mapiranje po objektu.",
            },
            {
              type: "steps",
              items: [
                "Otvorite objekt pod /objekte, karticu „Portali”",
                "Odaberite „Booking.com” s popisa dostupnih portala",
                "Pridružite odgovarajući tip sobe odnosno ponude i potvrdite barem jednu tarifu s cijenom i uvjetima otkazivanja",
                "Unesite valjan način plaćanja za obračun provizije",
                "Aktivirajte vidljivost za Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Odobrenje Bookinga.com može potrajati nekoliko sati. Status na kartici „Portali” prikazuje čim je veza aktivna.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Povezivanje Airbnb-a",
          excerpt: "Kako objekt preko upravitelja kanala učiniti dostupnim za rezervaciju na Airbnb-u.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija: vaš objekt treba postati vidljiv i na Airbnb-u",
            },
            {
              type: "p",
              text: "Airbnb se, kao i svaki drugi portal, povezuje preko veze na razini cijelog računa. Kad je ona postavljena, Airbnb aktivirate po objektu preko mapiranja — neovisno o tome je li objekt već vidljiv na Bookingu.com ili drugim portalima.",
            },
            {
              type: "steps",
              items: [
                "Otvorite objekt pod /objekte, karticu „Portali”",
                "Odaberite „Airbnb” s popisa dostupnih portala",
                "Potvrdite kategoriju objekta i pridruženu vrstu ponude",
                "Dopunite fotografije, opremu i kućni red — Airbnb prije odobrenja zahtijeva potpune podatke",
                "Aktivirajte vidljivost za Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez unesenih uvjeta otkazivanja i kućnog reda Airbnb odbija odobrenje. Te podatke najprije dopunite u objektu.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Sinkroniziranje cijena na svim portalima",
          excerpt: "Jedan kalendar dovoljan je — upravitelj kanala automatski raspoređuje promjene cijena na sve portale.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija: mijenjate cijenu i želite osigurati da je svugdje ispravna",
            },
            {
              type: "p",
              text: "Cijene održavate isključivo u myNextDays kalendaru objekta — nikada pojedinačno na samim portalima. Upravitelj kanala automatski prenosi svaku promjenu svim portalima za koje je objekt aktivno mapiran.",
            },
            {
              type: "steps",
              items: [
                "Otvorite kalendar cijena odnosno tarifne planove objekta",
                "Prilagodite dnevnu cijenu, minimalni boravak ili ograničenje dolaska/odlaska",
                "Spremite promjenu — najprije djeluje interno u objektu",
                "Na kartici „Portali” provjerite jesu li svi željeni portali i dalje aktivno mapirani",
                "Pričekajte nekoliko minuta dok se promjena ne prenese portalima",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Cijene nikad ne unosite izravno na portalu — takve promjene kod sljedećeg usklađivanja prebrisuje myNextDays kalendar.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Uvoz rezervacije s portala",
          excerpt: "Rezervacije s portala automatski dolaze u kalendar — ovdje provjerite je li uvoz uspio.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija: gost je rezervirao preko portala, rezervacija treba stići u myNextDays",
            },
            {
              type: "p",
              text: "Kad gost rezervira preko Bookinga.com, Airbnb-a ili drugog povezanog portala, upravitelj kanala automatski uvozi rezervaciju — ništa ne morate ručno prenositi. Ovaj postupak opisuje kako pratiti i potvrditi uvoz.",
            },
            {
              type: "steps",
              items: [
                "Otvorite kalendar ili popis rezervacija zahvaćenog objekta",
                "Potražite novu rezervaciju — nosi oznaku podrijetla portala, primjerice Booking.com ili Airbnb",
                "Provjerite potpunost podataka o gostu, razdoblja i cijene",
                "Provjerite prikazuju li se rezervirana noćenja kao blokirana na svim drugim kanalima",
                "Po potrebi otvorite detalje rezervacije kako biste obradili dodatne usluge ili poruke gosta",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ako gost otkaže preko portala ili promijeni razdoblje, i to se automatski preuzima, a noćenja se ponovno oslobađaju.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Rješavanje dvostruke rezervacije",
          excerpt: "Kako postupiti kad je isto noćenje iznimno prodano na dva kanala.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija: dvije se rezervacije preklapaju za isti objekt i ista noćenja",
            },
            {
              type: "p",
              text: "Upravitelj kanala obično odmah blokira rezervirana noćenja kanalno-obuhvatno. Dvostruka rezervacija ipak može nastati, primjerice kod istovremenih rezervacija na dva portala u istom trenutku ili kod ručno izrađene rezervacije koja se sudara s rezervacijom s portala.",
            },
            {
              type: "steps",
              items: [
                "Otvorite kalendar objekta i identificirajte obje rezervacije koje se preklapaju",
                "Provjerite trenutak rezervacije i oznaku podrijetla obiju rezervacija",
                "Kontaktirajte kasnije pristiglog gosta i ponudite mu alternativni objekt ili razdoblje",
                "Otkažite neodrživu rezervaciju na dotičnom portalu, ne samo u myNextDays",
                "Zatim za zahvaćena noćenja postavite stop-sell dok se slučaj potpuno ne razjasni",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Rezervaciju s portala uvijek otkažite preko samog portala — otkazivanje samo u myNextDays interno oslobađa noćenje, ali ne obavještava portal pouzdano.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Privremena pauza portala",
          excerpt: "Zasebno isključite vidljivost po portalu, bez gubitka mapiranja.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija: objekt privremeno ne smije biti dostupan za rezervaciju na jednom portalu",
            },
            {
              type: "p",
              text: "Vidljivost se zasebno uključuje po portalu — neovisno o web-stranici i tržištu platforme. Ako primjerice želite kratkoročno pauzirati Airbnb, ali nastaviti s Bookingom.com, deaktivirajte isključivo taj jedan kanal.",
            },
            {
              type: "steps",
              items: [
                "Otvorite objekt pod /objekte, karticu „Portali”",
                "Potražite unos portala koji želite pauzirati",
                "Isključite vidljivost za taj portal",
                "Spremite — promjena djeluje unutar nekoliko minuta, objekt nestaje iz rezultata pretrage tog portala",
                "Ponovno uključite vidljivost čim objekt treba opet biti dostupan za rezervaciju",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Mapiranje kod pauziranja ostaje sačuvano — pridruživanje portalu kasnije ne morate ponovno postavljati. Za potpuno blokiranje svih kanala umjesto toga upotrijebite stop-sell.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Provjera mapiranja objekta",
          excerpt: "Kako provjeriti je li vaš objekt i dalje ispravno pridružen odgovarajućem tipu ponude na portalu.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija: cijene ili dostupnost na portalu više se ne podudaraju s myNextDays",
            },
            {
              type: "p",
              text: "Ako se prikaz na portalu razlikuje od vašeg myNextDays kalendara, uzrok je često neispravno ili prekinuto mapiranje — poveznica između vašeg objekta i tipa sobe odnosno ponude na portalu.",
            },
            {
              type: "steps",
              items: [
                "Otvorite objekt pod /objekte, karticu „Portali”",
                "Provjerite status dotičnog portala — trebao bi prikazivati „Povezano”, ne „Pogreška” ili „Na čekanju”",
                "Provjerite odgovara li pridruženi tip sobe odnosno ponude na portalu i dalje stvarnom objektu",
                "Kod odstupanja: raskinite mapiranje i ponovno pridružite, zatim ponovno aktivirajte vidljivost",
                "Nakon ispravka pričekajte nekoliko minuta i ponovno provjerite cijene i dostupnost na portalu",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Objekt istovremeno može biti pridružen više portala — kod nesuglasja ciljano provjerite taj jedan zahvaćeni portal, ne sve odjednom.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Različite tarife po portalu",
          excerpt: "Kako portalu dodijeliti vlastiti tarifni plan, bez utjecaja na ostale kanale.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija: na jednom portalu želite ponuditi drukčiju cijenu nego na ostalim kanalima",
            },
            {
              type: "p",
              text: "Tarifni planovi mogu se zasebno pridružiti po portalu, primjerice neopozivi tarifni plan za jedan portal i fleksibilan za drugi. Osnovne cijene ostaju središnje održavane u objektu, a mapiranje određuje koji tarifni plan ide na koji portal.",
            },
            {
              type: "steps",
              items: [
                "U objektu izradite dodatni tarifni plan sa željenim uvjetima (cijena, uvjeti otkazivanja, minimalni boravak)",
                "Otvorite karticu „Portali” i odaberite zahvaćeni portal",
                "U mapiranju pridružite novi tarifni plan tom portalu",
                "Ostale portale ostavite nepromijenjene na dosadašnjem tarifnom planu",
                "Spremite i nakon nekoliko minuta provjerite prikaz cijene na dotičnom portalu",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Svaki se tarifni plan prenosi neovisno — promjena jednog tarifnog plana ne utječe na portale pridružene drugom tarifnom planu.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Rješavanje čestih pogrešaka portala",
          excerpt: "Tipični uzroci kad portal odbije objekt ili sinkronizacija zastane.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "h2",
              text: "Polazna situacija: status portala prikazuje pogrešku ili objekt nije preuzet",
            },
            {
              type: "p",
              text: "Portali obično odbijaju vezu zbog nedostajućih osnovnih podataka ili nepotpunih podataka o objektu. Redom prođite najčešće uzroke prije nego što kontaktirate podršku.",
            },
            {
              type: "steps",
              items: [
                "Pod /konto provjerite jesu li adresa, porezni podaci i kontaktni podaci potpuno uneseni",
                "U objektu provjerite jesu li opis, fotografije, oprema i barem jedna tarifa potpuni",
                "Provjerite je li unesen valjan način plaćanja za provizije",
                "Otvorite karticu „Portali” i pročitajte točnu poruku o pogrešci uz dotični portal",
                "Uklonite navedeni nedostatak i ponovno aktivirajte vidljivost",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Pogreška portala uvijek se odnosi samo na taj jedan portal — ostali kanali nastavljaju raditi neovisno o tome, sve dok ispunjavaju vlastite zahtjeve.",
            },
          ],
        },
      ],
    },
  ],
};
