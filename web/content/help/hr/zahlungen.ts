import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Plaćanja i fakture",
  description: "Pružatelji usluga plaćanja, pravila plaćanja i fakture.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Plaćanja",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Povezivanje pružatelja usluga plaćanja",
          excerpt:
            "Kako povezati Stripe ili PayPal s myNextDays radi automatske obrade plaćanja.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Dostupni pružatelji" },
            {
              type: "p",
              text: "myNextDays obrađuje plaćanja preko povezanih pružatelja usluga plaćanja. Trenutno su podržani Stripe i PayPal — možete povezati jednog ili oba pružatelja istovremeno i koristiti ih ovisno o objektu ili želji gosta.",
            },
            {
              type: "steps",
              items: [
                "Otvorite Račun i prijeđite u odjeljak „Plaćanja”.",
                "Odaberite željenog pružatelja — Stripe ili PayPal.",
                "Pratite dijalog povezivanja i prijavite se kod pružatelja ili izradite novi račun.",
                "Potvrdite vezu — status se mijenja u „povezano”.",
              ],
            },
            { type: "h2", text: "Što se događa nakon toga" },
            {
              type: "p",
              text: "Čim je pružatelj povezan, možete slati poveznice za plaćanje, naplaćivati predujmove i pokretati povrate novca izravno iz rezervacije. Svi se iznosi obrađuju u valuti pohranjenoj za dotični objekt.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez povezanog pružatelja plaćanja možete samo ručno označiti kao primljena — automatska naplata tada nije moguća.",
            },
            { type: "h2", text: "Više objekata, jedan pružatelj" },
            {
              type: "p",
              text: "Jednom uspostavljena veza vrijedi na razini cijelog računa za sve vaše objekte. Kako naplata točno teče, određujete putem [Pravila plaćanja](/hilfe/zahlungen/zahlungsregeln). Isplate vama zatim se odvijaju preko dotičnog pružatelja, vidi [Isplate](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe je pogodan za plaćanja karticom i mnoge lokalne načine plaćanja",
                "PayPal gostima nudi poznatu alternativu",
                "Oba se pružatelja mogu neovisno jedan o drugom odspojiti i ponovno povezati",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Pravila plaćanja",
          excerpt: "Odredite kada dospijevaju predujam i preostala uplata za rezervaciju.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Predujam i preostala uplata" },
            {
              type: "p",
              text: "Pravila plaćanja određuju kako se rezervacija financijski obrađuje — primjerice predujam kod rezervacije i preostala uplata prije dolaska, ili puno plaćanje odmah. Pravila vrijede po objektu i mogu se u svakom trenutku prilagoditi.",
            },
            {
              type: "steps",
              items: [
                "Otvorite objekt i prijeđite u odjeljak „Pravila plaćanja”.",
                "Odaberite hoće li se naplaćivati predujam i odredite udio.",
                "Odredite kada dospijeva preostala uplata, primjerice određen broj dana prije dolaska.",
                "Spremite postavke.",
              ],
            },
            { type: "h2", text: "Automatska naplata" },
            {
              type: "p",
              text: "Ako je povezan pružatelj usluga plaćanja, myNextDays automatski naplaćuje predujam i preostalu uplatu u pohranjeno vrijeme te unaprijed obavještava gosta porukom.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pravila plaćanja djeluju samo kod rezervacija s povezanim pružateljem usluga plaćanja. Bez pružatelja plaćanja ručno označavate u rezervaciji.",
            },
            { type: "h2", text: "Razlike po kanalu" },
            {
              type: "p",
              text: "Na portalima može odstupajuće vrijediti njihova vlastita obrada plaćanja — u tom slučaju provjerite uvjete dotičnog portala. Za rezervacije preko vlastite platforme ili web-stranice uvijek vrijede vaša ovdje pohranjena pravila. Detalje o povezivanju pružatelja pronaći ćete pod [Povezivanje pružatelja usluga plaćanja](/hilfe/zahlungen/zahlungsanbieter-verbinden), a o izdavanju faktura pod [Izrada faktura](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Predujam moguć kao fiksni iznos ili postotak",
                "Rok preostale uplate slobodno odabir",
                "Promjene djeluju tek na nove rezervacije, ne retroaktivno",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Izrada faktura",
          excerpt: "Kako za rezervaciju izraditi fakturu s ispravnom adresom za fakturiranje.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Izrada fakture" },
            {
              type: "p",
              text: "Za svaku se rezervaciju može izraditi faktura — za samog gosta ili za odstupajuću tvrtku, ako je rezervacija poslovna.",
            },
            {
              type: "steps",
              items: [
                "Otvorite rezervaciju u Rezervacijama.",
                "Odaberite „Izradi fakturu”.",
                "Provjerite ili dopunite adresu za fakturiranje.",
                "Provjerite navedene stavke — noćenje, dodatne usluge, naknade.",
                "Izradite fakturu i pošaljite je gostu.",
              ],
            },
            { type: "h2", text: "Održavanje adrese za fakturiranje" },
            {
              type: "p",
              text: "Adresu za fakturiranje možete unijeti izravno u rezervaciji ili je zatražiti od gosta putem potvrde rezervacije. Bez potpune adrese u određenim se državama ne može izdati pravovaljana faktura.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Kod poslovnih klijenata posebno provjerite naziv tvrtke i adresu — naknadne ispravke zahtijevaju ispravnu fakturu.",
            },
            { type: "h2", text: "Iznosi i valuta" },
            {
              type: "p",
              text: "Sve se stavke iskazuju u valuti pohranjenoj za objekt. Već izvršena plaćanja bilježe se na fakturi kao primitak plaćanja. Kako nastaju predujam i preostala uplata, pročitajte pod [Pravila plaćanja](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Fakture se mogu preuzeti kao PDF",
                "Ispravne fakture moguće su u svakom trenutku kod promjena",
                "Dodatne usluge pojavljuju se kao zasebna stavka",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Povrati novca",
          excerpt:
            "Kako u cijelosti ili djelomično vratiti plaćanje kad se rezervacija otkaže ili promijeni.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Kad je potreban povrat novca" },
            {
              type: "p",
              text: "Povrat novca tipično nastaje kod otkazivanja, ali može biti potreban i kod naknadne prilagodbe cijene ili otkazane dodatne usluge.",
            },
            {
              type: "steps",
              items: [
                "Otvorite zahvaćenu rezervaciju u Rezervacijama.",
                "Odaberite „Povrat novca” u dijelu rezervacije za plaćanja.",
                "Unesite iznos koji treba vratiti — u cijelosti ili djelomično.",
                "Potvrdite povrat novca.",
              ],
            },
            { type: "h2", text: "Postupak preko pružatelja usluga plaćanja" },
            {
              type: "p",
              text: "Povrat novca izvršava se preko pružatelja korištenog pri plaćanju — Stripe ili PayPal — i izravno se vraća na izvorno sredstvo plaćanja gosta. Postupak se automatski bilježi u vremenskoj crti rezervacije.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez povezanog pružatelja usluga plaćanja povrat novca ne može se automatski pokrenuti — u tom slučaju povrat izravno dogovorite s gostom.",
            },
            { type: "h2", text: "Utjecaj na provizije" },
            {
              type: "p",
              text: "Već obračunane provizije tržišta ili portala kod povrata novca razmjerno se prilagođavaju. Više o tome pod [Razumijevanje provizija](/hilfe/zahlungen/provisionen-verstehen). Detalje o samom otkazivanju pronaći ćete pod [Otkazivanje i povrat novca](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Djelomični povrati novca mogući su za pojedine stavke",
                "Status obrade u svakom je trenutku vidljiv u rezervaciji",
                "Povrati novca odvijaju se isključivo preko izvorno korištenog pružatelja",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Isplate",
          excerpt:
            "Kako dobiti isplaćen prihod od svojih rezervacija od povezanih pružatelja usluga plaćanja.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Kako funkcioniraju isplate" },
            {
              type: "p",
              text: "Pristigla plaćanja najprije se prikupljaju kod povezanog pružatelja usluga plaćanja. Odatle se isplata na vaš pohranjeni bankovni račun odvija prema uobičajenom ritmu tog pružatelja.",
            },
            {
              type: "steps",
              items: [
                "Otvorite Račun i prijeđite u odjeljak „Plaćanja”.",
                "Pod „Isplate” provjerite status dotičnog pružatelja.",
                "Po potrebi otvorite detaljni prikaz pružatelja za potpunu povijest isplata.",
              ],
            },
            { type: "h2", text: "Što se odbija prije isplate" },
            {
              type: "p",
              text: "Prije isplate uzimaju se u obzir provizije tržišta i portala te naknade pružatelja. Isplaćeni iznos stoga ne odgovara nužno izvornom iznosu rezervacije.",
            },
            {
              type: "note",
              variant: "info",
              text: "Točnu strukturu odbitaka objašnjava [Razumijevanje provizija](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Više objekata i vlasnika" },
            {
              type: "p",
              text: "Ako upravljate objektima za različite vlasnike, isplate se dodjeljuju u skladu s pohranjenim obračunima vlasnika. Kod nesuglasja najprije provjerite status povezanih rezervacija u Rezervacijama.",
            },
            {
              type: "ul",
              items: [
                "Ritam i način isplate određuje dotični pružatelj",
                "Zadržani iznosi, primjerice kod tekućih povrata novca, posebno su označeni",
                "Potpuna povijest dostupna je za uvid izravno kod pružatelja",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Razumijevanje provizija",
          excerpt:
            "Pregled kako se sastavljaju provizije tržišta i portala te gdje se obračunavaju.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            { type: "h2", text: "Dvije vrste provizija" },
            {
              type: "p",
              text: "Kod rezervacija preko myNextDays mogu nastati dvije različite provizije: provizija tržišta za rezervacije preko vlastite platforme te provizije portala za rezervacije koje stižu preko povezanih portala poput Bookinga ili Airbnb-a. Obje su neovisne jedna o drugoj i mogu se razlikovati ovisno o prodajnom putu rezervacije.",
            },
            {
              type: "ul",
              items: [
                "Provizija tržišta: nastaje kod rezervacija preko myNextDays platforme",
                "Provizija portala: izračunava dotični portal prema vlastitim uvjetima",
                "Izravne rezervacije preko vaše vlastite web-stranice treba promatrati neovisno o tome",
              ],
            },
            { type: "h2", text: "Gdje su provizije vidljive" },
            {
              type: "steps",
              items: [
                "Otvorite Račun i prijeđite u odjeljak „Obračun”.",
                "Odaberite željeni mjesec.",
                "Provjerite pregled po rezervaciji s pripadajućom provizijom.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Preko kojeg je kanala rezervacija stigla, vidite izravno na samoj rezervaciji — to objašnjava koja je provizija primijenjena.",
            },
            { type: "h2", text: "Povezanost s isplatama" },
            {
              type: "p",
              text: "Provizije se od iznosa rezervacije odbijaju prije isplate. Detalje o postupku isplate pronaći ćete pod [Isplate](/hilfe/zahlungen/auszahlungen). Kod povrata novca pripadajuća se provizija razmjerno korigira — cjelovit tijek rezervacije prikazuje [Vremenska crta rezervacije](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
