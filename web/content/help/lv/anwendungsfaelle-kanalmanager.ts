import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Kanālu pārvaldnieks",
  description: "Apgūstiet portālus un kanālu pārvaldnieku.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Kanālu pārvaldnieks",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Sava pirmā portāla savienošana",
          excerpt: "Kā pirmo reizi aktivizēt portālu objektam.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija: jūs esat izveidojis objektu, bet vēl neesat savienojis nevienu portālu",
            },
            {
              type: "p",
              text: "Jūsu objekts myNextDays ir pilnībā iestatīts, bet vēl nav redzams nevienā portālā, piemēram, Booking.com vai Airbnb. Pirms portāls pieņem objektu, jūsu kontam vienreiz nepieciešams kontam kopīgs portāla savienojums — pēc tam katram nākamajam objektam pietiek tikai ar kartēšanu.",
            },
            {
              type: "steps",
              items: [
                "Atveriet /konto, sadaļu „Portāli un kanālu pārvaldnieks“, un iestatiet kontam kopīgo savienojumu ar sava uzņēmuma datiem",
                "Pēc tam atveriet objektu sadaļā /objekte un pārejiet uz cilni „Portāli“",
                "Izvēlieties vēlamo portālu un piesaistiet to atbilstošajam numuram vai piedāvājuma tipam",
                "Pārbaudiet fotogrāfijas, aprīkojumu, cenas un anulēšanas nosacījumus — portāli pieprasa pilnīgus datus",
                "Aktivizējiet redzamību; statuss pēc portāla pārbaudes mainīsies uz „Savienots“",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kontam kopīgo savienojumu iestatāt tikai vienreiz. Detaļas par to lasiet sadaļās [Booking.com pieslēgšana](/hilfe/portale-kanalmanager/booking-verbinden) un [Airbnb pieslēgšana](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Booking.com pieslēgšana",
          excerpt: "Kā ar kanālu pārvaldnieka palīdzību padarīt objektu rezervējamu Booking.com.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija: jūsu objektam papildus jākļūst redzamam Booking.com",
            },
            {
              type: "p",
              text: "Booking.com ir viens no portāliem, kas tiek pieslēgts caur kanālu pārvaldnieku. Priekšnosacījums ir kontam kopīgs portāla savienojums — ja tas jau ir iestatīts, Booking.com nepieciešams tikai kartēšana katram objektam.",
            },
            {
              type: "steps",
              items: [
                "Atveriet objektu sadaļā /objekte, cilnē „Portāli“",
                "No pieejamo portālu saraksta izvēlieties „Booking.com“",
                "Piesaistiet atbilstošo numuru vai piedāvājuma tipu un apstipriniet vismaz vienu tarifu ar cenu un anulēšanas nosacījumiem",
                "Norādiet derīgu maksājumu metodi komisijas norēķiniem",
                "Aktivizējiet redzamību Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Booking.com apstiprinājums var aizņemt vairākas stundas. Statuss cilnē „Portāli“ rāda, tiklīdz savienojums ir aktīvs.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Airbnb pieslēgšana",
          excerpt: "Kā ar kanālu pārvaldnieka palīdzību padarīt objektu rezervējamu Airbnb.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija: jūsu objektam papildus jākļūst redzamam Airbnb",
            },
            {
              type: "p",
              text: "Airbnb, tāpat kā jebkurš cits portāls, tiek pieslēgts caur kontam kopīgo savienojumu. Kad tas ir iestatīts, aktivizējat Airbnb katram objektam ar kartēšanu — neatkarīgi no tā, vai objekts jau ir redzams Booking.com vai citos portālos.",
            },
            {
              type: "steps",
              items: [
                "Atveriet objektu sadaļā /objekte, cilnē „Portāli“",
                "No pieejamo portālu saraksta izvēlieties „Airbnb“",
                "Apstipriniet objekta kategoriju un piesaistīto piedāvājuma tipu",
                "Papildiniet fotogrāfijas, aprīkojumu un mājas noteikumus — Airbnb pirms apstiprinājuma pieprasa pilnīgus datus",
                "Aktivizējiet redzamību Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez norādītiem anulēšanas nosacījumiem un mājas kārtības noteikumiem Airbnb apstiprinājumu noraida. Vispirms papildiniet šos datus objektā.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Cenu sinhronizēta uzturēšana visos portālos",
          excerpt: "Pietiek ar vienu kalendāru — kanālu pārvaldnieks automātiski izplata cenu izmaiņas visiem portāliem.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija: jūs maināt cenu un vēlaties nodrošināt, ka tā ir pareiza visur",
            },
            {
              type: "p",
              text: "Cenas uzturat tikai objekta myNextDays kalendārā — nekad atsevišķi pašos portālos. Kanālu pārvaldnieks katru izmaiņu automātiski pārsūta visiem portāliem, kuriem objekts ir aktīvi kartēts.",
            },
            {
              type: "steps",
              items: [
                "Atveriet objekta cenu kalendāru vai tarifu plānus",
                "Pielāgojiet dienas cenu, minimālo uzturēšanos vai ierašanās/izbraukšanas ierobežojumu",
                "Saglabājiet izmaiņas — tās vispirms darbojas iekšēji objektā",
                "Cilnē „Portāli“ pārbaudiet, vai visi vēlamie portāli joprojām ir aktīvi kartēti",
                "Nogaidiet dažas minūtes, līdz izmaiņa tiek pārsūtīta portāliem",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Nekad neievadiet cenas tieši portālā — šādas izmaiņas nākamajā saskaņošanā tiks pārrakstītas ar myNextDays kalendāra vērtībām.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Portāla rezervācijas importēšana",
          excerpt: "Portāla rezervācijas automātiski nonāk kalendārā — šeit pārbaudiet, vai imports izdevies.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija: viesis rezervējis caur portālu, rezervācijai jānonāk myNextDays",
            },
            {
              type: "p",
              text: "Ja viesis rezervē caur Booking.com, Airbnb vai citu savienotu portālu, kanālu pārvaldnieks automātiski importē rezervāciju — jums nekas nav manuāli jāpārsūta. Šī gaita apraksta, kā importu izsekot un apstiprināt.",
            },
            {
              type: "steps",
              items: [
                "Atveriet skartā objekta kalendāru vai rezervāciju sarakstu",
                "Meklējiet jauno rezervāciju — tai ir portāla izcelsmes nozīmīte, piemēram, Booking.com vai Airbnb",
                "Pārbaudiet viesa datus, periodu un cenu uz pilnīgumu",
                "Kontrolējiet, ka rezervētās naktis visos citos kanālos tiek rādītas kā bloķētas",
                "Pēc vajadzības atveriet rezervācijas detaļas, lai apstrādātu viesa papildpakalpojumus vai ziņas",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ja viesis anulē caur portālu vai maina periodu, tas arī automātiski tiek pārņemts un naktis atkal tiek atbrīvotas.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Dubultrezervācijas atrisināšana",
          excerpt: "Kā rīkoties, ja izņēmuma kārtā tā pati nakts pārdota divos kanālos.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija: divas rezervācijas pārklājas tam pašam objektam un tām pašām naktīm",
            },
            {
              type: "p",
              text: "Kanālu pārvaldnieks parasti nekavējoties bloķē rezervētās naktis visos kanālos. Neskatoties uz to, dubultrezervācija var rasties, piemēram, vienlaicīgu rezervāciju gadījumā divos portālos vienā brīdī vai manuāli izveidotas rezervācijas gadījumā, kas sadursies ar portāla rezervāciju.",
            },
            {
              type: "steps",
              items: [
                "Atveriet objekta kalendāru un identificējiet abas savstarpēji pārklājošās rezervācijas",
                "Pārbaudiet abu rezervāciju izveides laiku un izcelsmes nozīmīti",
                "Sazinieties ar vēlāk saņemto viesi un piedāvājiet alternatīvu objektu vai periodu",
                "Anulējiet nenoturamo rezervāciju attiecīgajā portālā, nevis tikai myNextDays",
                "Pēc tam skartajām naktīm iestatiet Stop-Sell, kamēr gadījums nav pilnībā noskaidrots",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Portāla rezervāciju vienmēr anulējiet tieši caur pašu portālu — anulēšana tikai myNextDays gan iekšēji atbrīvo nakti, bet portālu uzticami neinformē.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Portāla pagaidu apturēšana",
          excerpt: "Izslēdziet redzamību atsevišķi katram portālam, nezaudējot kartēšanu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija: objektam pagaidām nedrīkst būt rezervējamam kādā portālā",
            },
            {
              type: "p",
              text: "Redzamību var pārslēgt atsevišķi katram portālam — neatkarīgi no vietnes un platformas tirgus. Ja, piemēram, vēlaties īslaicīgi apturēt Airbnb, bet Booking.com atstāt darbojoties, deaktivizējiet tikai šo vienu kanālu.",
            },
            {
              type: "steps",
              items: [
                "Atveriet objektu sadaļā /objekte, cilnē „Portāli“",
                "Atrodiet portāla, kuru vēlaties apturēt, ierakstu",
                "Izslēdziet redzamību šim portālam",
                "Saglabājiet — izmaiņas darbojas dažu minūšu laikā, objekts pazūd no šī portāla meklēšanas rezultātiem",
                "Ieslēdziet redzamību atkal, tiklīdz objektam atkal jābūt rezervējamam",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kartēšana apturēšanas laikā saglabājas — piesaisti portālam vēlāk nebūs jāiestata no jauna. Pilnīgai visu kanālu bloķēšanai tā vietā izmantojiet Stop-Sell.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Objekta kartēšanas pārbaude",
          excerpt: "Kā pārbaudīt, vai jūsu objekts joprojām pareizi piesaistīts pareizajam piedāvājuma tipam portālā.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija: cenas vai pieejamība portālā vairs neatbilst myNextDays",
            },
            {
              type: "p",
              text: "Ja attēlojums portālā atšķiras no jūsu myNextDays kalendāra, cēlonis bieži ir kļūdaina vai pārtraukta kartēšana — piesaiste starp jūsu objektu un numuru vai piedāvājuma tipu portālā.",
            },
            {
              type: "steps",
              items: [
                "Atveriet objektu sadaļā /objekte, cilnē „Portāli“",
                "Pārbaudiet skartā portāla statusu — tam jārāda „Savienots“, nevis „Kļūda“ vai „Gaidāms“",
                "Kontrolējiet, vai piesaistītais numurs vai piedāvājuma tips portālā joprojām atbilst faktiskajam objektam",
                "Atšķirības gadījumā: atsaistiet kartēšanu un piesaistiet no jauna, pēc tam vēlreiz aktivizējiet redzamību",
                "Pēc labojuma nogaidiet dažas minūtes un pārbaudiet portālā cenas un pieejamību vēlreiz",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Objekts var vienlaikus būt piesaistīts vairākiem portāliem — neatbilstību gadījumā mērķtiecīgi pārbaudiet tikai to vienu skarto portālu, nevis visus vienlaikus.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Dažādi tarifi katram portālam",
          excerpt: "Kā piešķirt portālam savu tarifu plānu, neietekmējot pārējos kanālus.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija: vienā portālā vēlaties piedāvāt citu cenu nekā pārējos kanālos",
            },
            {
              type: "p",
              text: "Tarifu plānus var piesaistīt atsevišķi katram portālam, piemēram, neatceļamu tarifu plānu vienam portālam un elastīgu — citam. Bāzes cenas paliek centralizēti uzturētas objektā, kartēšana nosaka, kurš tarifu plāns dodas kuram portālam.",
            },
            {
              type: "steps",
              items: [
                "Objektā izveidojiet papildu tarifu plānu ar vēlamajiem nosacījumiem (cenu, anulēšanas nosacījumiem, minimālo uzturēšanos)",
                "Atveriet cilni „Portāli“ un izvēlieties skarto portālu",
                "Kartēšanā piesaistiet jauno tarifu plānu šim portālam",
                "Atstājiet pārējos portālus nemainītus, ar iepriekšējo tarifu plānu",
                "Saglabājiet un pēc dažām minūtēm pārbaudiet cenas attēlojumu attiecīgajā portālā",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Katrs tarifu plāns tiek pārsūtīts neatkarīgi — izmaiņas vienā tarifu plānā neietekmē portālus, kas piesaistīti citam tarifu plānam.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Biežāko portāla kļūdu novēršana",
          excerpt: "Tipiski cēloņi, kad portāls noraida objektu vai sinhronizācija apstājas.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija: portāla statuss rāda kļūdu vai objekts netiek pārņemts",
            },
            {
              type: "p",
              text: "Portāli parasti noraida savienojumu trūkstošu pamatdatu vai nepilnīgu objekta datu dēļ. Pirms sazināties ar atbalstu, secīgi pārbaudiet biežākos cēloņus.",
            },
            {
              type: "steps",
              items: [
                "Pārbaudiet /konto, vai adrese, nodokļu informācija un kontaktinformācija ir norādīti pilnībā",
                "Objektā kontrolējiet, vai apraksts, fotogrāfijas, aprīkojums un vismaz viens tarifs ir pilnīgi",
                "Pārbaudiet, vai ir norādīta derīga maksājumu metode komisijām",
                "Atveriet cilni „Portāli“ un izlasiet precīzu kļūdas paziņojumu blakus skartajam portālam",
                "Novērsiet minēto trūkumu un aktivizējiet redzamību vēlreiz",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Portāla kļūda vienmēr attiecas tikai uz šo vienu portālu — pārējie kanāli turpina darboties neatkarīgi no tā, kamēr tiek izpildītas to pašu prasības.",
            },
          ],
        },
      ],
    },
  ],
};
