import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Cijene i tarife",
  description: "Tarifni planovi, sezonske cijene i dinamične cijene.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Određivanje cijena",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Osnovna cijena i valuta",
          excerpt: "Kako odrediti osnovnu cijenu i dodijeliti objektu ispravnu valutu.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Svaki objekt u myNextDays točno je jedna jedinica koja se može rezervirati — pojedinačna soba ili objekt za odmor. Za tu jedinicu unosite osnovnu cijenu i središnju valutu, koja vrijedi za cijeli objekt.",
            },
            { type: "h2", text: "Središnje određivanje valute" },
            {
              type: "p",
              text: "Valuta objekta postavlja se jednom po objektu i automatski vrijedi za sve tarifne planove koje izradite za taj objekt. Ne postoji zasebna zamjenska valuta — ako valuta nedostaje, ne možete spremiti cijene.",
            },
            {
              type: "steps",
              items: [
                "Otvorite svoj objekt pod „Objekti”.",
                "Prijeđite na karticu „Cijene”.",
                "Pod „Valuta objekta” odaberite odgovarajuću valutu.",
                "Unesite osnovnu cijenu za standardnu popunjenost.",
                "Spremite promjene.",
              ],
            },
            { type: "h2", text: "Što se događa kod promjene valute" },
            {
              type: "p",
              text: "Ako naknadno promijenite valutu objekta, to utječe na sve postojeće tarifne planove tog objekta, jer se oni uvijek vode u valuti objekta. Nakon toga provjerite svoje cijene prije nego što ih ponovno pošaljete portalima.",
            },
            {
              type: "ul",
              items: [
                "Objekt ima točno jednu valutu — ne više njih po tarifnom planu.",
                "Osnovna cijena je polazna vrijednost za izvedene tarife.",
                "Iznosi se uvijek prikazuju u pohranjenoj valuti objekta.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez pohranjene valute ne može se spremiti nijedna cijena niti prenijeti tarifa portalima. To provjerite prvo ako promjena cijene ne uspije.",
            },
            {
              type: "note",
              variant: "info",
              text: "Više o izvedenim cijenama pronaći ćete pod [Izvedene tarife](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Izrada tarifnih planova",
          excerpt: "Tarifni planovi objedinjuju cijenu, uvjete otkazivanja i prehranu za objekt.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Tarifni plan definira pod kojim se uvjetima objekt može rezervirati: cijena, pravila otkazivanja, prehrana i minimalni boravak. Objekt može istovremeno nuditi više tarifnih planova, primjerice fleksibilan i neopozivi plan.",
            },
            { type: "h2", text: "Izrada novog tarifnog plana" },
            {
              type: "steps",
              items: [
                "Otvorite objekt i prijeđite na karticu „Cijene”.",
                "Kliknite „Izradi novi tarifni plan”.",
                "Dodijelite prepoznatljiv naziv, npr. „Fleksibilan” ili „Neopoziv”.",
                "Odredite je li plan osnovna tarifa ili izvedena tarifa.",
                "Unesite uvjete otkazivanja i prehranu.",
                "Spremite i aktivirajte tarifni plan.",
              ],
            },
            { type: "h2", text: "Osnovna tarifa naspram ostalih tarifnih planova" },
            {
              type: "p",
              text: "Najprije izradite svoju osnovnu tarifu (često se naziva „BAR”, Best Available Rate). Svi ostali tarifni planovi mogu se voditi samostalno ili se izvesti iz te osnovne tarife.",
            },
            {
              type: "ul",
              items: [
                "Osnovna tarifa: ručno održavana osnovna cijena po noćenju.",
                "Ostali tarifni planovi: samostalni ili kao doplata/popust na osnovnu tarifu.",
                "Svaki se tarifni plan zasebno može prenijeti portalima.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Broj tarifnih planova po objektu držite pregledan — previše varijanti otežava gostima usporedbu i povećava opseg održavanja.",
            },
            {
              type: "note",
              variant: "info",
              text: "Detalje o doplatama i popustima pronaći ćete pod [Izvedene tarife](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Izvedene tarife",
          excerpt: "Izvedeni tarifni planovi automatski se izračunavaju iz osnovne tarife.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Izvedena tarifa tarifni je plan čija se cijena ne održava ručno, nego se automatski izračunava iz osnovne tarife — kao fiksna doplata, popust ili postotak. To smanjuje opseg održavanja, jer promjena cijene osnovne tarife automatski ažurira sve izvedene planove.",
            },
            { type: "h2", text: "Tipičan primjer" },
            {
              type: "p",
              text: "Uobičajen obrazac je plan s doručkom koji se izvodi iz osnovne tarife bez prehrane: cijena doručka definira se kao doplata po noćenju i osobi na osnovnu tarifu. Ako promijenite osnovnu tarifu, cijena doručka automatski se prilagođava.",
            },
            { type: "h2", text: "Postavljanje izvedene tarife" },
            {
              type: "steps",
              items: [
                "Otvorite željeni tarifni plan na kartici „Cijene”.",
                "Kao izvor cijene odaberite „Izvedeno iz …” i pripadajuću osnovnu tarifu.",
                "Odredite vrijedi li razlika kao fiksan iznos ili kao postotak.",
                "Odredite radi li se o doplati ili popustu.",
                "Spremite dodjelu.",
              ],
            },
            {
              type: "ul",
              items: [
                "Doplata: npr. prehrana, kasnija mogućnost otkazivanja.",
                "Popust: npr. neopozivi plan uz nižu cijenu.",
                "Osnovna tarifa ostaje jedini ručno održavani izvor.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Izvedena tarifa ne može se istovremeno ručno prebrisati. Najprije uklonite izvođenje ako želite postaviti odstupajuću pojedinačnu cijenu.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Sezonske i vikend cijene",
          excerpt: "Ciljano prilagodite cijene za sezonska razdoblja i vikende.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Potražnja varira tijekom godine i unutar tjedna. Sezonskim i vikend cijenama prilagođavate osnovnu cijenu za određena razdoblja ili dane u tjednu, bez potrebe da za svaki dan zasebno ulazite u kalendar.",
            },
            { type: "h2", text: "Izrada sezonskog razdoblja" },
            {
              type: "steps",
              items: [
                "Otvorite karticu „Cijene” u objektu i područje „Sezonske cijene”.",
                "Izradite novo razdoblje s datumom početka i završetka.",
                "Unesite cijenu ili postotno odstupanje od osnovne cijene za to razdoblje.",
                "Spremite sezonsko razdoblje.",
              ],
            },
            { type: "h2", text: "Vikend cijene" },
            {
              type: "p",
              text: "Dodatno možete za pojedine dane u tjednu, primjerice petak i subotu, odrediti vlastitu doplatu. Ta doplata djeluje uz trenutno važeću sezonsku ili osnovnu cijenu.",
            },
            {
              type: "ul",
              items: [
                "Sezonske cijene vrijede za povezana razdoblja.",
                "Vikend cijene vrijede po danu u tjednu, neovisno o sezoni.",
                "Oba se pravila mogu kombinirati.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ako se preklapa više sezonskih razdoblja, vrijedi posljednje izrađeno odnosno najspecifičnije pravilo. Nakon spremanja provjerite kalendar.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Za automatske prilagodbe temeljene na potražnji dodatno je pogodan alat [Dinamične cijene](/hilfe/preise-raten/dynamische-preise).",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Dinamične cijene",
          excerpt: "Automatski prilagodite cijene potražnji, roku rezervacije i popunjenosti.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "note",
              variant: "info",
              text: "Dinamične cijene su dodatni modul koji se plaća. Naručujete ga u odjeljku „Proširenja“, gdje je navedena i cijena. Bez modula automatika ne izračunava cijene.",
            },
            {
              type: "p",
              text: "Dinamične cijene automatski prilagođavaju osnovnu cijenu na temelju čimbenika poput roka rezervacije, trenutne popunjenosti i potražnje — slično kako to veliki portali rade sa svojim vlastitim preporukama cijena. Tako reagirate na tržišne promjene bez ručnog prilagođavanja svaki dan.",
            },
            { type: "h2", text: "Aktivacija dinamičnih cijena" },
            {
              type: "steps",
              items: [
                "Otvorite karticu „Cijene” u objektu i područje „Dinamične cijene”.",
                "Aktivirajte funkciju za osnovnu tarifu objekta.",
                "Odredite donju i gornju granicu cijene.",
                "Odredite koliko snažno popunjenost smije utjecati na cijenu.",
                "Spremite postavke.",
              ],
            },
            { type: "h2", text: "Granice i sigurnost" },
            {
              type: "p",
              text: "Donja i gornja granica cijene sprječavaju da automatski algoritam postavi cijene koje za vaše poslovanje nisu održive. Izvedeni tarifni planovi automatski prate dinamički izračunatu osnovnu tarifu.",
            },
            {
              type: "ul",
              items: [
                "Donja granica cijene štiti od preniskih cijena pri slaboj potražnji.",
                "Gornja granica cijene štiti od pretjeranih cijena pri visokoj potražnji.",
                "Izvedene tarife automatski preuzimaju novu osnovnu tarifu.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dinamične cijene djeluju samo na osnovnu tarifu. Ručno fiksno postavljeni tarifni planovi bez izvođenja ne mijenjaju se automatski.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Popusti za boravak",
          excerpt: "Postavljanje popusta za dulje boravke i ranu rezervaciju.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Popusti za boravak nagrađuju goste za dulje rezervacije ili ranu rezervaciju. Primjenjuju se kao postotak na ukupnu cijenu boravka i mogu se neovisno konfigurirati po objektu.",
            },
            { type: "h2", text: "Vrste popusta" },
            {
              type: "ul",
              items: [
                "Popust za dulji boravak: od određenog broja noćenja, npr. od 7 ili 28 noćenja.",
                "Popust za ranu rezervaciju: kod rezervacije dovoljno unaprijed.",
                "Popust za rezervaciju u zadnji čas: kod kratkoročne rezervacije blizu datuma dolaska.",
              ],
            },
            { type: "h2", text: "Postavljanje popusta" },
            {
              type: "steps",
              items: [
                "Otvorite karticu „Cijene” u objektu i područje „Popusti”.",
                "Odaberite željenu vrstu popusta.",
                "Odredite prag, npr. minimalan broj noćenja ili rok unaprijed.",
                "Unesite popust u postotku.",
                "Spremite pravilo.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Popusti djeluju na ukupnu cijenu dotičnog tarifnog plana i gostu se prikazuju već u pregledu cijena.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombinirajte popuste za dulji boravak s [Minimalnim i maksimalnim boravkom](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt) kako biste ciljano potaknuli dulje rezervacije.",
            },
          ],
        },
      ],
    },
  ],
};
