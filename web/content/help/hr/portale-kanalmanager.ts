import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portali i upravitelj kanala",
  description: "Središnje upravljanje Bookingom, Airbnb-om, Expediom i drugima.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Povezivanje portala",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Što je upravitelj kanala?",
          excerpt:
            "Upravitelj kanala automatski usklađuje cijene, dostupnost i rezervacije između myNextDays i portala.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Jedna veza za sve portale" },
            {
              type: "p",
              text: "Upravitelj kanala poveznica je između myNextDays i velikih portala za rezervacije poput Bookinga, Airbnb-a i drugih. Umjesto da na svakom portalu zasebno održavate cijene, dostupnost i popunjenost, sve unosite jednom u myNextDays — upravitelj kanala to automatski raspoređuje na sve povezane portale.",
            },
            { type: "h2", text: "Što se automatski sinkronizira" },
            {
              type: "ul",
              items: [
                "Dostupnost — svaka rezervacija odmah blokira noćenje na svim portalima",
                "Cijene i minimalni boravci iz vašeg kalendara cijena",
                "Nadolazeće rezervacije s portala automatski se uvoze u myNextDays",
                "Otkazivanja i stop-sell djeluju kanalno-obuhvatno",
              ],
            },
            { type: "h2", text: "Što više ne morate raditi ručno" },
            {
              type: "p",
              text: "Bez upravitelja kanala morali biste nakon svake rezervacije ručno blokirati noćenje na svakom portalu — čest uzrok dvostrukih rezervacija. Uz aktivan upravitelj kanala myNextDays preuzima to usklađivanje u oba smjera, više puta dnevno i u stvarnom vremenu kod novih rezervacija.",
            },
            {
              type: "note",
              variant: "info",
              text: "Veza s portalima postavlja se jednom, na razini cijelog računa. Za svaki pojedini objekt zatim aktivirate samo mapiranje — više o tome pod [Povezivanje objekta s portalom](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Postavljanje veze s portalima",
          excerpt:
            "Vezu s portalima postavljate jednom, na razini cijelog računa — ne iznova za svaki objekt.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Jednom za cijeli račun" },
            {
              type: "p",
              text: "Povezivanje s portalima postavka je na razini cijelog računa: svoj myNextDays račun povezujete s upraviteljem kanala točno jednom. Svi objekti koje kasnije izradite automatski koriste tu jednu vezu — ne morate je iznova izgrađivati za svaki objekt.",
            },
            { type: "h2", text: "Kako postaviti vezu" },
            {
              type: "steps",
              items: [
                "Otvorite /konto i odaberite odjeljak „Portali i upravitelj kanala”",
                "Kliknite „Postavi vezu” i potvrdite podatke o svom poslovanju (adresa, kontakt, pravni oblik)",
                "Provjerite automatski preuzete osnovne podatke — prosljeđuju se svim portalima",
                "Dovršite postavljanje; status se mijenja u „Povezano”",
              ],
            },
            { type: "h2", text: "Sljedeći korak: pridruživanje objekata" },
            {
              type: "p",
              text: "Nakon jednokratnog postavljanja još nijedan objekt nije vidljiv — za to svaki objekt zasebno pridružujete portalu (mapiranje) i povezujete željene portale poput Bookinga.com ili Airbnb-a.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez potpunih osnovnih podataka (adresa, porezni podaci, kontakt) portali odbijaju vezu. Te podatke prvo provjerite pod /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Povezivanje objekta s portalom",
          excerpt:
            "Nakon veze na razini cijelog računa, po objektu aktivirate samo mapiranje s dotičnim portalom.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Mapiranje umjesto ponovnog povezivanja" },
            {
              type: "p",
              text: "Kad je veza s portalima jednom postavljena na razini cijelog računa, svaki objekt povezujete samo takozvanim mapiranjem: određujete koji myNextDays objekt odgovara kojem tipu sobe odnosno ponude na portalu. To je jednokratan korak po objektu.",
            },
            { type: "h2", text: "Kako pridružiti objekt" },
            {
              type: "steps",
              items: [
                "Otvorite objekt pod /objekte i prijeđite na karticu „Portali”",
                "Odaberite željeni portal, primjerice Booking.com ili Airbnb",
                "Pridružite objekt odgovarajućem tipu sobe odnosno ponude na portalu",
                "Aktivirajte sinkronizaciju — cijene i dostupnost odmah se prenose",
              ],
            },
            { type: "h2", text: "Jedan objekt, više portala" },
            {
              type: "p",
              text: "Jedan objekt istovremeno može biti pridružen više portala. Svako je pridruživanje neovisno — objekt možete, primjerice, učiniti vidljivim na Bookingu.com i Airbnb-u, a na Expediji ga zasad ostaviti deaktiviranog.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Nakon mapiranja odmah provjerite vidljivost — vidi [Vidljivost po portalu](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Povezivanje Bookinga.com",
          excerpt: "Kako aktivirati Booking.com kao prodajni kanal za objekt.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Preduvjet: veza na razini cijelog računa" },
            {
              type: "p",
              text: "Prije nego što aktivirate Booking.com za objekt, mora biti postavljena veza s portalima na razini cijelog računa (vidi [Postavljanje veze s portalima](/hilfe/portale-kanalmanager/portal-verbindung)). Nakon toga je Booking.com za svaki sljedeći objekt samo pitanje mapiranja.",
            },
            { type: "h2", text: "Aktivacija Bookinga.com" },
            {
              type: "steps",
              items: [
                "Otvorite objekt pod /objekte, karticu „Portali”",
                "Odaberite „Booking.com” s popisa dostupnih portala",
                "Pridružite odgovarajući tip sobe odnosno ponude i potvrdite tarifne planove",
                "Aktivirajte vidljivost — objekt se nakon provjere Bookinga.com objavljuje uživo",
              ],
            },
            { type: "h2", text: "Što Booking.com očekuje od vas" },
            {
              type: "ul",
              items: [
                "Potpun opis objekta, slike i oprema",
                "Barem jedna tarifa s cijenom i uvjetima otkazivanja",
                "Valjan način plaćanja za provizije",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Odobrenje Bookinga.com može potrajati nekoliko sati. Status na kartici objekta „Portali” prikazuje je li veza već aktivna.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Povezivanje Airbnb-a",
          excerpt: "Kako objekt preko upravitelja kanala učiniti dostupnim za rezervaciju na Airbnb-u.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Airbnb kao dodatni portal" },
            {
              type: "p",
              text: "Airbnb se, kao i svaki drugi portal, povezuje preko veze na razini cijelog računa. Kad je ona postavljena, Airbnb aktivirate po objektu preko mapiranja — neovisno o tome je li objekt već vidljiv na Bookingu.com ili drugim portalima.",
            },
            { type: "h2", text: "Aktivacija Airbnb-a za objekt" },
            {
              type: "steps",
              items: [
                "Otvorite objekt pod /objekte, karticu „Portali”",
                "Odaberite „Airbnb” s popisa dostupnih portala",
                "Potvrdite kategoriju objekta i pridruženu vrstu ponude",
                "Provjerite fotografije, opremu i kućni red — Airbnb prije odobrenja zahtijeva potpune podatke",
                "Aktivirajte vidljivost za Airbnb",
              ],
            },
            { type: "h2", text: "Nakon aktivacije" },
            {
              type: "p",
              text: "Čim Airbnb odobri objekt, cijene i dostupnost automatski se vode preko upravitelja kanala. Rezervacije koje stignu na Airbnb-u zatim se automatski pojavljuju u vašem kalendaru rezervacija.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez unesenih uvjeta otkazivanja i kućnog reda Airbnb odbija odobrenje. Te podatke najprije dopunite u objektu.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Sinkronizacija cijena i dostupnosti",
          excerpt:
            "Cijene i dostupnost automatski se prenose svim povezanim portalima.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Jedan kalendar, svi portali" },
            {
              type: "p",
              text: "Cijene i dostupnost održavate isključivo u myNextDays kalendaru dotičnog objekta. Upravitelj kanala automatski prenosi svaku promjenu svim portalima za koje je objekt aktivno mapiran — bez dvostrukog unosa.",
            },
            { type: "h2", text: "Što se prenosi" },
            {
              type: "ul",
              items: [
                "Dnevne cijene iz vašeg kalendara cijena odnosno tarifnih planova",
                "Dostupna noćenja i blokade",
                "Minimalni boravak i ograničenja dolaska/odlaska",
                "Dani stop-sella — automatski se blokiraju na svim portalima",
              ],
            },
            { type: "h2", text: "Koliko brzo djeluje sinkronizacija" },
            {
              type: "p",
              text: "Promjene cijena i dostupnosti prosljeđuju se portalima unutar nekoliko minuta. Nove rezervacije odmah blokiraju zahvaćena noćenja, kako se ista noć ne bi ponovno prodala ni na jednom drugom kanalu.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Više o kanalno-obuhvatnom blokiranju pojedinih dana pronaći ćete pod [Izbjegavanje prekapacitiranih rezervacija](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Primanje rezervacija s portala",
          excerpt: "Rezervacije s Bookinga, Airbnb-a i drugih automatski dolaze u vaš kalendar.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Automatski uvoz" },
            {
              type: "p",
              text: "Kad gost rezervira preko portala poput Bookinga.com ili Airbnb-a, upravitelj kanala automatski uvozi rezervaciju u myNextDays. Ništa ne morate ručno prenositi — rezervacija se pojavljuje u kalendaru i popisu rezervacija zahvaćenog objekta.",
            },
            { type: "h2", text: "Što se događa kod rezervacije s portala" },
            {
              type: "steps",
              items: [
                "Portal prijavljuje novu rezervaciju upravitelju kanala",
                "myNextDays izrađuje rezervaciju s podacima o gostu, razdobljem i cijenom",
                "Rezervirana noćenja odmah se blokiraju na svim drugim kanalima",
                "Dobivate obavijest i pronalazite rezervaciju u kalendaru",
              ],
            },
            { type: "h2", text: "Otkazivanja i promjene" },
            {
              type: "p",
              text: "Ako gost otkaže preko portala ili promijeni razdoblje, i to se automatski prenosi u myNextDays, a zahvaćena noćenja ponovno se oslobađaju.",
            },
            {
              type: "note",
              variant: "info",
              text: "Rezervacije s portala u detaljima rezervacije prepoznatljive su po oznaci podrijetla, primjerice Booking.com ili Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Izbjegavanje prekapacitiranih rezervacija",
          excerpt: "Stop-sell i automatske blokade sprječavaju dvostruke rezervacije preko više portala.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Zašto nastaju prekapacitirane rezervacije" },
            {
              type: "p",
              text: "Bez središnjeg upravljanja lako se dogodi da se isto noćenje istovremeno proda na dva portala — primjerice kad se cijene i dostupnost ručno održavaju u više sustava. Upravitelj kanala zatvara tu prazninu jer svaka rezervacija na bilo kojem kanalu odmah blokira sve druge kanale.",
            },
            { type: "h2", text: "Vaši alati protiv prekapacitiranih rezervacija" },
            {
              type: "ul",
              items: [
                "Automatska blokada: svaka nova rezervacija — bez obzira na kojem kanalu — blokira noćenja posvuda",
                "Stop-sell: ručno blokira dan na svim kanalima istovremeno, primjerice za vlastito korištenje ili održavanje",
                "Minimalni boravak i ograničenja dolaska sprječavaju neprikladne kratke rezervacije",
              ],
            },
            { type: "h2", text: "Postavljanje stop-sella" },
            {
              type: "steps",
              items: [
                "Otvorite kalendar zauzetosti objekta",
                "Označite zahvaćeni dan ili razdoblje",
                "Odaberite „Stop-sell” — dan je nakon toga blokiran na svim portalima te na web-stranici i platformi",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-sell vrijedi bez iznimke za sve kanale. Ne postoji mogućnost blokiranja dana samo za jedan pojedini portal, a ostavljanja otvorenim za druge.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Vidljivost po portalu",
          excerpt: "Svaki se portal može uključiti ili isključiti neovisno o web-stranici i tržištu platforme.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Tri neovisna prodajna puta" },
            {
              type: "p",
              text: "Objekt se istovremeno može prodavati preko više puteva: preko portala (Booking, Airbnb i drugi), preko myBestDays tržišta platforme i preko vaše vlastite web-stranice. Svaki put ima vlastiti prekidač vidljivosti — potpuno su neovisni jedan o drugom.",
            },
            { type: "h2", text: "Upravljanje vidljivošću po portalu" },
            {
              type: "p",
              text: "Unutar portala dodatno se svaki pojedini portal može zasebno uključiti ili isključiti. Objekt može, primjerice, biti aktivan na Bookingu.com, a deaktiviran na Airbnb-u — oba pridruživanja pritom ostaju netaknuta.",
            },
            { type: "h2", text: "Kako promijeniti vidljivost" },
            {
              type: "steps",
              items: [
                "Otvorite objekt pod /objekte, karticu „Portali”",
                "Zasebno uključite ili isključite željeni kanal (pojedini portal, web-stranica ili tržište platforme)",
                "Spremite — promjena se primjenjuje unutar nekoliko minuta",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Status objekta (aktivan/neaktivan) te stop-sell djeluju nadređeno na sve kanale. Prekidači vidljivosti određuju samo na kojim se dodatnim kanalima pojavljuje već aktivan objekt.",
            },
          ],
        },
      ],
    },
  ],
};
