import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Račun i pretplata",
  description: "Osnovni podaci, tarifa, sigurnost i 2FA.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Račun",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Osnovni podaci poslovanja",
          excerpt: "Središnje održavajte naziv tvrtke, adresu i kontaktne podatke svog poslovanja.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Pod /konto myNextDays objedinjuje sve funkcije poslovanja i računa kao odjeljke na jednoj stranici — ne morate prelaziti između mnogih podstranica. Osnovni podaci poslovanja pritom su temelj: naziv tvrtke, pravni oblik, adresa i kontaktni podaci koji se koriste za fakture, portale i komunikaciju s gostima.",
            },
            { type: "h2", text: "Otvaranje i uređivanje osnovnih podataka" },
            {
              type: "steps",
              items: [
                "Otvorite /konto.",
                "Prijeđite u odjeljak „Osnovni podaci poslovanja”.",
                "Provjerite naziv tvrtke, adresu, telefonski broj i e-adresu za povratne upite.",
                "Unesite svoje promjene.",
                "Spremite odjeljak.",
              ],
            },
            { type: "h2", text: "Zašto su ti podaci važni" },
            {
              type: "p",
              text: "Osnovni podaci poslovanja koriste se u fakturama, u registraciji kod povezanih portala te u zakonski obveznim podacima poput impresuma. Nepotpuna ili zastarjela adresa može dovesti do pogrešno izdanih faktura ili odgode povezivanja s portalima.",
            },
            {
              type: "ul",
              items: [
                "Naziv tvrtke i pravni oblik pojavljuju se na svim izdanim fakturama.",
                "Adresa je potrebna za registraciju kod portala.",
                "Kontaktni podaci služe kao rezervni put ako sustavske obavijesti ne stignu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ako promijenite adresu za fakturiranje, nakon toga provjerite već izdane fakture pod [Obračun i kalkulator tarifa](/hilfe/konto-abo/abrechnung-tarifrechner) — postojeći dokumenti se retroaktivno ne prilagođavaju.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Pretplata i tarifa",
          excerpt: "Vaša tarifa određuje kvotu objekata — trenutno rezervirani broj objekata vidite u svakom trenutku u Računu.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Vaša myNextDays pretplata obuhvaća kvotu objekata: najveći broj objekata (soba ili objekata za odmor) koje istovremeno možete aktivno upravljati. Trenutno rezervirani broj objekata prikazan je u odjeljku „Pretplata i tarifa” pod /konto, zajedno s preostalom kvotom.",
            },
            { type: "h2", text: "Praćenje kvote" },
            {
              type: "p",
              text: "Kvota se provodi na strani poslužitelja: kad dosegnete gornju granicu svoje tarife, ne možete izraditi dodatan objekt sve dok ne deaktivirate postojeći objekt ili proširite svoju tarifu. To vrijedi neovisno o tome je li novi objekt soba ili objekt za odmor — oboje jednako ulazi u kvotu.",
            },
            {
              type: "steps",
              items: [
                "Otvorite /konto i odjeljak „Pretplata i tarifa”.",
                "Provjerite rezervirani broj objekata u odnosu na kvotu svoje tarife.",
                "Po potrebi odaberite veću tarifu kako biste izradili više objekata.",
                "Potvrdite promjenu tarife.",
              ],
            },
            {
              type: "ul",
              items: [
                "Svaki objekt zasebno ulazi u kvotu, neovisno o tipu objekta.",
                "Promjena tarife odmah utječe na dostupnu kvotu.",
                "Prijelaz na nižu tarifu moguć je samo ako broj aktivnih objekata odgovara novoj kvoti.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Prijelaz na tarifu s manjom kvotom odbija se dok je aktivno više objekata nego što nova tarifa dopušta. Najprije deaktivirajte suvišne objekte.",
            },
            {
              type: "note",
              variant: "info",
              text: "Detalje o fakturama i izračunu tarife pronaći ćete pod [Obračun i kalkulator tarifa](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Obračun i kalkulator tarifa",
          excerpt: "Adresa za fakturiranje, dosadašnje fakture i kalkulator tarifa za vašu kvotu objekata.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Odjeljak „Obračun i kalkulator tarifa” pod /konto objedinjuje sve vezano uz izdavanje faktura: vašu adresu za fakturiranje, popis dosadašnjih faktura za preuzimanje te kalkulator tarifa kojim možete pratiti troškove za svoju trenutnu ili veću kvotu objekata.",
            },
            { type: "h2", text: "Adresa za fakturiranje i fakture" },
            {
              type: "p",
              text: "Adresa za fakturiranje može se razlikovati od adrese vašeg poslovanja, primjerice ako dokumente prima knjigovodstveni servis. Već izdane fakture pronalazite kronološki poredane; svaka se može preuzeti kao PDF.",
            },
            { type: "h2", text: "Korištenje kalkulatora tarifa" },
            {
              type: "steps",
              items: [
                "Otvorite /konto i odjeljak „Obračun i kalkulator tarifa”.",
                "U kalkulatoru unesite željeni broj objekata.",
                "Usporedite troškove koji proizlaze po tarifnoj razini.",
                "Po potrebi izravno iz kalkulatora prijeđite na odgovarajuću tarifu.",
              ],
            },
            {
              type: "ul",
              items: [
                "Kalkulator tarifa prikazuje troškove u valuti pohranjenoj za vaš račun.",
                "Fakture su trajno dostupne za preuzimanje.",
                "Adresa za fakturiranje može se održavati neovisno o osnovnim podacima poslovanja.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Redovito kalkulatorom tarifa provjeravajte odgovara li vaša kvota objekata stvarno rezerviranom broju objekata — vidi [Pretplata i tarifa](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Promjena lozinke i e-pošte",
          excerpt: "Sigurnosno kritične promjene zahtijevaju ponovnu prijavu i korak potvrde.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Lozinka i e-adresa spadaju u sigurnosno najkritičnije podatke vašeg računa. myNextDays stoga kod obje promjene zahtijeva ponovnu autentifikaciju — promjenu potvrđujete trenutnom lozinkom, čak i ako ste već prijavljeni.",
            },
            { type: "h2", text: "Promjena lozinke" },
            {
              type: "steps",
              items: [
                "Otvorite /konto i odjeljak „Promjena lozinke i e-pošte”.",
                "Unesite trenutnu lozinku radi potvrde.",
                "Odredite novu lozinku i ponovite je.",
                "Spremite promjenu.",
              ],
            },
            { type: "h2", text: "Promjena e-adrese" },
            {
              type: "p",
              text: "Promjena e-adrese odvija se kao dvostruko potvrđivanje: nakon potvrde trenutne lozinke dobivate poveznicu za potvrdu na NOVU adresu. Tek klikom na tu poveznicu promjena postaje aktivna — stara adresa do tada ostaje aktivna, kako pristup vašem računu nikad ne bi bio prekinut.",
            },
            {
              type: "ul",
              items: [
                "Bez trenutne lozinke ne može se promijeniti ni lozinka ni e-pošta.",
                "Poveznica za potvrdu nove e-adrese vremenski je ograničeno valjana.",
                "Do potvrde dosadašnja e-adresa ostaje aktivna za prijavu i obavijesti.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Nakon promjene e-pošte provjerite i dvofaktorsku autentifikaciju — vidi [Dvofaktorska autentifikacija](/hilfe/konto-abo/zwei-faktor) — ako su kodovi za oporavak bili vezani uz staru adresu.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Dvofaktorska autentifikacija",
          excerpt: "Dodatni korak prijave štiti vaš račun od neovlaštenog pristupa.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Dvofaktorska autentifikacija (2FA) dopunjuje vašu lozinku drugim faktorom preko aplikacije za autentifikaciju. Time sama ukradena lozinka više nije dovoljna za prijavu na vaš myNextDays račun.",
            },
            { type: "h2", text: "Postavljanje 2FA" },
            {
              type: "steps",
              items: [
                "Otvorite /konto i odjeljak „Dvofaktorska autentifikacija”.",
                "Potvrdite trenutnu lozinku radi ponovne autentifikacije.",
                "Skenirajte prikazani QR kod aplikacijom za autentifikaciju.",
                "Unesite generirani kod radi potvrde.",
                "Pohranite prikazane kodove za oporavak na sigurno mjesto.",
              ],
            },
            { type: "h2", text: "Deaktivacija 2FA" },
            {
              type: "p",
              text: "I deaktivacija dvofaktorske autentifikacije zahtijeva ponovnu autentifikaciju vašom trenutnom lozinkom. Tako myNextDays sprječava da netko s već otvorenom sesijom jednostavno isključi vašu zaštitu.",
            },
            {
              type: "ul",
              items: [
                "Kodovi za oporavak omogućuju pristup ako se izgubi aplikacija za autentifikaciju.",
                "Svaki je kod za oporavak upotrebljiv samo jednom.",
                "Uključivanje i isključivanje 2FA jednako su vezani uz potvrdu lozinke.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Kodove za oporavak čuvajte odvojeno od uređaja s aplikacijom za autentifikaciju, primjerice u upravitelju lozinkama.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Povijest uređaja",
          excerpt: "Pratite s kojih je uređaja vaš račun prijavljen.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Povijest uređaja pod /konto prikazuje na kojim je uređajima vaš račun trenutno prijavljen — s tipom uređaja, približnom lokacijom i vremenom posljednje aktivnosti. Tako brzo prepoznajete potječe li prijava zaista od vas.",
            },
            { type: "h2", text: "Provjera povijesti uređaja" },
            {
              type: "steps",
              items: [
                "Otvorite /konto i odjeljak „Povijest uređaja”.",
                "Pregledajte popis prijavljenih uređaja.",
                "Ako prepoznate nepoznat uređaj, odjavite ga.",
                "Nakon toga radi sigurnosti promijenite lozinku.",
              ],
            },
            { type: "h2", text: "Kad je pogled smislen" },
            {
              type: "p",
              text: "Provjerite povijest uređaja posebno nakon promjene lozinke ili e-pošte te nakon korištenja tuđeg ili javnog uređaja. Nepoznat unos jasan je znak upozorenja za neovlašten pristup.",
            },
            {
              type: "ul",
              items: [
                "Svaki unos prikazuje tip uređaja, približnu lokaciju i posljednju aktivnost.",
                "Pojedini se uređaji mogu ciljano odjaviti, bez utjecaja na ostale.",
                "Neprepoznat uređaj razlog je za odmah promijeniti lozinku.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ako ne prepoznate uređaj, odmah ga odjavite i zatim promijenite lozinku pod [Promjena lozinke i e-pošte](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Zaštita podataka",
          excerpt: "Upravljajte indeksiranjem na tražilicama po objektu i izvezite svoje podatke.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "U odjeljku „Zaštita podataka” pod /konto upravljate s dvije stvari: smiju li tražilice indeksirati stranice vaših objekata i kako izvesti svoje podatke pohranjene kod myNextDays.",
            },
            { type: "h2", text: "Indeksiranje na tražilicama po objektu" },
            {
              type: "p",
              text: "Standardno je indeksiranje na tražilicama za nove objekte deaktivirano. Tek kad ga svjesno uključite po objektu, tražilice poput Googlea smiju javnu stranicu objekta uvrstiti u svoj indeks. Tako zadržavate kontrolu koji su objekti pronalazivi izvan portala i vlastite platforme.",
            },
            {
              type: "steps",
              items: [
                "Otvorite /konto i odjeljak „Zaštita podataka”.",
                "Odaberite željeni objekt s popisa.",
                "Uključite ili isključite indeksiranje na tražilicama.",
                "Kod više objekata upotrijebite zbirni prekidač kako biste ih sve postavili jedinstveno.",
              ],
            },
            { type: "h2", text: "Izvoz podataka" },
            {
              type: "p",
              text: "Preko funkcije izvoza podataka zahtijevate potpunu kopiju svojih podataka pohranjenih u računu. Izvoz se sastavlja i zatim vam se stavlja na raspolaganje za preuzimanje.",
            },
            {
              type: "ul",
              items: [
                "Indeksiranje se pojedinačno upravlja po objektu, sa zbirnim prekidačem za sve objekte.",
                "Novi objekti u načelu počinju bez indeksiranja na tražilicama.",
                "Izvoz podataka sadrži vaše podatke o računu i objektima u strukturiranom obliku.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Indeksiranje na tražilicama neovisno je o vidljivosti na portalima i vlastitom tržištu — odnosi se isključivo na javnu stranicu objekta u tražilicama.",
            },
          ],
        },
      ],
    },
  ],
};
