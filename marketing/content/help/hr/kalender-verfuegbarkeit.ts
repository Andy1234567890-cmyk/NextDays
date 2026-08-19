import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Kalendar i dostupnost",
  description: "Raspored zauzetosti, stop-sell i minimalni boravak.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kalendar",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Čitanje rasporeda zauzetosti",
          excerpt: "Kako ispravno čitati rezervacije, dostupnost i cijene u rasporedu zauzetosti.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Raspored zauzetosti na jedan pogled prikazuje koja su noćenja rezervirana, dostupna ili blokirana. Kod objekata za odmor vidite jedan redak po objektu, a kod hotela ugniježđeni prikaz s jednim retkom po kategoriji sobe i tarifnom planu.",
            },
            { type: "h2", text: "Struktura prikaza" },
            {
              type: "steps",
              items: [
                "Otvorite kalendar preko stavke izbornika „Raspored zauzetosti”.",
                "Pri vrhu odaberite razdoblje koje želite pregledati.",
                "Po potrebi filtrirajte prema pojedinim objektima ili kategorijama soba.",
                "Kliknite na dan kako biste otvorili detalje o cijeni i dostupnosti.",
                "Kliknite na zauzeto razdoblje kako biste otvorili pripadajuću rezervaciju.",
              ],
            },
            { type: "h2", text: "Boje i simboli" },
            {
              type: "ul",
              items: [
                "Zauzeto: razdoblje je rezervirano rezervacijom.",
                "Dostupno: dan se može rezervirati na svim aktivnim kanalima.",
                "Blokirano: dan nije dostupan za rezervaciju zbog stop-sella ili ručnog blokiranja.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Svaki redak u rasporedu zauzetosti predstavlja točno jednu jedinicu koja se može rezervirati — sobu ili objekt za odmor. Ne postoji zajednički redak za više soba istovremeno.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Više o ciljanom otvaranju i zatvaranju pojedinih dana pronaći ćete pod [Postavljanje dostupnosti](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Postavljanje dostupnosti",
          excerpt: "Ciljano otvaranje i zatvaranje pojedinih dana ili razdoblja.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Dostupnost određuje može li se objekt rezervirati određenog dana. Pojedine dane ili cijela razdoblja možete otvoriti ili zatvoriti izravno u rasporedu zauzetosti.",
            },
            { type: "h2", text: "Uređivanje razdoblja" },
            {
              type: "steps",
              items: [
                "Otvorite raspored zauzetosti željenog objekta.",
                "Označite željeno razdoblje klikom i povlačenjem.",
                "U izborniku radnji odaberite „Promijeni dostupnost”.",
                "Potvrdite treba li razdoblje biti otvoreno ili zatvoreno.",
                "Spremite promjenu.",
              ],
            },
            { type: "h2", text: "Utjecaj na kanale" },
            {
              type: "p",
              text: "Promjena dostupnosti utječe na sve prodajne kanale na kojima je objekt vidljiv: portale poput Bookinga, Airbnb-a i drugih, vlastitu platformu te aplikaciju. Prijenos portalima odvija se automatski u pozadini.",
            },
            {
              type: "ul",
              items: [
                "Otvaranje: dan postaje dostupan za rezervaciju na svim aktivnim kanalima.",
                "Zatvaranje: dan nestaje iz dostupnosti za rezervaciju, ali ostaje vidljiv u kalendaru.",
                "Postojeće rezervacije ne pogađa promjena dostupnosti.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ne zatvarajte razdoblje s namjerom da ga potpuno i trajno blokirate za prodaju — za to je prava funkcija stop-sell, vidi [Stop-sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-sell",
          excerpt: "Stop-sell odmah blokira dan na svim prodajnim kanalima istovremeno.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Stop-sell je najbrži način da se pojedini dan potpuno ukloni iz prodaje. Za razliku od obične promjene dostupnosti, stop-sell djeluje strogo i odmah na svim kanalima istovremeno — na portalima, vlastitoj platformi i u aplikaciji.",
            },
            { type: "h2", text: "Postavljanje stop-sella" },
            {
              type: "steps",
              items: [
                "Otvorite raspored zauzetosti zahvaćenog objekta.",
                "Odaberite željeni dan ili razdoblje.",
                "U izborniku radnji kliknite „Aktiviraj stop-sell”.",
                "Potvrdite blokadu.",
              ],
            },
            { type: "h2", text: "Kad je stop-sell smislen" },
            {
              type: "ul",
              items: [
                "Kratkoročni radovi na održavanju ili tehnički problemi u objektu.",
                "Poseban slučaj kada odmah i bez iznimke ne želite novu rezervaciju.",
                "Brza blokada u nuždi na cijeloj platformi, bez zasebnog uređivanja svakog kanala.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-sell ne poznaje iznimku po kanalu: ako je dan blokiran, nijedan gost ne može rezervirati ni preko jednog kanala, čak ni preko recepcije ili izravnog upita.",
            },
            {
              type: "note",
              variant: "info",
              text: "Za trajno vlastito korištenje ili planirano održavanje umjesto toga je pogodno [Ručno blokiranje](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung).",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Minimalni i maksimalni boravak",
          excerpt: "Koliko najmanje ili najviše gosti smiju rezervirati.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Minimalnim i maksimalnim boravkom određujete koliko najmanje ili najviše noćenja gost može rezervirati za pojedini dan dolaska. To pomaže izbjeći kratke rezervacije koje ostavljaju praznine ili ciljano pozicionirati objekt za dulje boravke.",
            },
            { type: "h2", text: "Postavljanje pravila" },
            {
              type: "steps",
              items: [
                "Otvorite raspored zauzetosti objekta ili karticu „Cijene”.",
                "Odaberite zahvaćeno razdoblje.",
                "Pod „Minimalni boravak” unesite najmanji broj noćenja.",
                "Po želji pod „Maksimalni boravak” unesite najveći broj noćenja.",
                "Spremite pravilo.",
              ],
            },
            { type: "h2", text: "Tipični slučajevi primjene" },
            {
              type: "ul",
              items: [
                "Glavna sezona: veći minimalni boravak, kako bi se dani izmjene grupirali.",
                "Predsezona/posezona: manji minimalni boravak, kako bi se omogućilo više rezervacija.",
                "Maksimalni boravak: smislen kada objekt nakon toga mora biti slobodan za održavanje ili drugu namjenu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Pravilo vrijedi za dan dolaska: gost ne može doći na dan s minimalnim boravkom od tri noćenja samo na dvije noći, čak i ako su pojedini dani dostupni.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombinirajte dulje minimalne boravke s [Popustima za boravak](/hilfe/preise-raten/aufenthaltsrabatte) kako biste povećali poticaj za goste.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Ručno blokiranje",
          excerpt: "Ciljano rezervirajte razdoblja za vlastito korištenje ili održavanje.",
          updated: "Ažurirano: srpanj 2026.",
          body: [
            {
              type: "p",
              text: "Ručno blokiranje rezervira razdoblje u kalendaru bez stvarne rezervacije gosta — primjerice za vlastito korištenje, planirane radove na održavanju ili renovacije. Razdoblje se u rasporedu zauzetosti prikazuje poput rezervacije, ali je jasno prepoznatljivo kao blokada.",
            },
            { type: "h2", text: "Izrada blokade" },
            {
              type: "steps",
              items: [
                "Otvorite raspored zauzetosti zahvaćenog objekta.",
                "Označite željeno razdoblje.",
                "U izborniku radnji odaberite „Ručno blokiraj”.",
                "Navedite razlog, npr. „vlastito korištenje” ili „održavanje”.",
                "Spremite blokadu.",
              ],
            },
            { type: "h2", text: "Razlika u odnosu na stop-sell" },
            {
              type: "p",
              text: "Ručno blokiranje konkretno rezervira razdoblje za određenu, dokumentiranu svrhu i kasnije se može ponovno osloboditi. Za trenutnu blokadu u nuždi na cijeloj platformi bez dokumentiranog razdoblja umjesto toga je namijenjen stop-sell.",
            },
            {
              type: "ul",
              items: [
                "Ručno blokiranje: planirano, s razlogom, za vlastito korištenje ili održavanje.",
                "Oslobađanje moguće u svakom trenutku, čim razdoblje više nije potrebno.",
                "Blokirana noćenja ne broje se kao rezervacija gosta i ne pojavljuju se u pregledu prihoda.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Izbrišite ručnu blokadu čim razlog prestane vrijediti — inače objekt ostaje nepotrebno blokiran na svim kanalima.",
            },
            {
              type: "note",
              variant: "info",
              text: "Za trenutnu blokadu bez planiranog razdoblja upotrijebite [Stop-sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
