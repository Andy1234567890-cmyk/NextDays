import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portāli un kanālu pārvaldnieks",
  description: "Centralizēti pārvaldiet Booking, Airbnb, Expedia un citus.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Portālu savienošana",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Kas ir kanālu pārvaldnieks?",
          excerpt:
            "Kanālu pārvaldnieks automātiski saskaņo cenas, pieejamību un rezervācijas starp myNextDays un portāliem.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Viens savienojums visiem portāliem" },
            {
              type: "p",
              text: "Kanālu pārvaldnieks ir tilts starp myNextDays un lielajiem rezervāciju portāliem, piemēram, Booking, Airbnb un citiem. Tā vietā, lai katrā portālā atsevišķi uzturētu cenas, pieejamību un aizņemtību, visu ievadāt vienreiz myNextDays — kanālu pārvaldnieks to automātiski izplata visiem savienotajiem portāliem.",
            },
            { type: "h2", text: "Kas tiek sinhronizēts automātiski" },
            {
              type: "ul",
              items: [
                "Pieejamība — katra rezervācija nekavējoties bloķē nakti visos portālos",
                "Cenas un minimālā uzturēšanās no jūsu cenu kalendāra",
                "Ienākošās portāla rezervācijas tiek automātiski importētas myNextDays",
                "Anulēšanas un Stop-Sell darbojas visos kanālos",
              ],
            },
            { type: "h2", text: "Ko jums vairs nav jādara manuāli" },
            {
              type: "p",
              text: "Bez kanālu pārvaldnieka pēc katras rezervācijas jums manuāli būtu jābloķē nakts katrā portālā — bieži tas ir dubultrezervāciju cēlonis. Ar aktīvu kanālu pārvaldnieku myNextDays šo saskaņošanu pārņem abos virzienos, vairākas reizes dienā un reāllaikā jaunu rezervāciju gadījumā.",
            },
            {
              type: "note",
              variant: "info",
              text: "Portālu savienojums tiek iestatīts vienreiz visam kontam. Pēc tam katram atsevišķam objektam aktivizējat tikai kartēšanu — vairāk par to lasiet sadaļā [Objekta piesaiste portālam](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Portāla savienojuma iestatīšana",
          excerpt:
            "Savienojumu ar portāliem iestatāt vienreiz visam kontam — nevis katram objektam no jauna.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Vienreiz visam kontam" },
            {
              type: "p",
              text: "Pieslēgums portāliem ir kontam kopīgs iestatījums: savu myNextDays kontu ar kanālu pārvaldnieku savienojat tieši vienreiz. Visi objekti, kurus izveidosiet vēlāk, automātiski izmanto šo vienu savienojumu — jums tas nav jāveido no jauna katram objektam.",
            },
            { type: "h2", text: "Kā iestatīt savienojumu" },
            {
              type: "steps",
              items: [
                "Atveriet /konto un izvēlieties sadaļu „Portāli un kanālu pārvaldnieks\"",
                "Noklikšķiniet uz „Iestatīt savienojumu\" un apstipriniet sava uzņēmuma datus (adresi, kontaktinformāciju, juridisko formu)",
                "Pārbaudiet automātiski pārņemtos pamatdatus — tie tiks nosūtīti visiem portāliem",
                "Pabeidziet iestatīšanu; statuss mainīsies uz „Savienots\"",
              ],
            },
            { type: "h2", text: "Nākamais solis: objektu piesaiste" },
            {
              type: "p",
              text: "Pēc vienreizējas iestatīšanas neviens objekts vēl nav redzams — tāpēc katru objektu atsevišķi piesaistāt portālam (kartēšana) un savienojat vēlamos portālus, piemēram, Booking.com vai Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez pilnīgiem pamatdatiem (adreses, nodokļu informācijas, kontaktinformācijas) portāli savienojumu noraida. Vispirms pārbaudiet šos datus sadaļā /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Objekta piesaiste portālam",
          excerpt:
            "Pēc kontam kopīgā savienojuma katram objektam aktivizējat tikai kartēšanu ar attiecīgo portālu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Kartēšana, nevis atkārtota savienošana" },
            {
              type: "p",
              text: "Kad portāla savienojums reiz ir iestatīts visam kontam, katru objektu savienojat, izmantojot tā saukto kartēšanu: nosakāt, kurš myNextDays objekts atbilst kuram numuram vai piedāvājuma tipam portālā. Tas katram objektam ir vienreizējs solis.",
            },
            { type: "h2", text: "Kā piesaistīt objektu" },
            {
              type: "steps",
              items: [
                "Atveriet objektu sadaļā /objekte un pārejiet uz cilni „Portāli\"",
                "Izvēlieties vēlamo portālu, piemēram, Booking.com vai Airbnb",
                "Piesaistiet objektu atbilstošajam numuram vai piedāvājuma tipam portālā",
                "Aktivizējiet sinhronizāciju — cenas un pieejamība no šī brīža tiks pārsūtītas",
              ],
            },
            { type: "h2", text: "Viens objekts, vairāki portāli" },
            {
              type: "p",
              text: "Vienam objektam var vienlaikus būt piesaistīti vairāki portāli. Katra piesaiste ir neatkarīga — objektu, piemēram, varat padarīt redzamu Booking.com un Airbnb, bet Expedia pagaidām atstāt deaktivizētu.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Pēc kartēšanas uzreiz pārbaudiet redzamību — skatiet [Redzamība katram portālam](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Booking.com savienošana",
          excerpt: "Kā aktivizēt Booking.com kā pārdošanas kanālu objektam.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Priekšnosacījums: kontam kopīgs savienojums" },
            {
              type: "p",
              text: "Pirms aktivizējat Booking.com objektam, jābūt iestatītam kontam kopīgam portāla savienojumam (skatiet [Portāla savienojuma iestatīšana](/hilfe/portale-kanalmanager/portal-verbindung)). Pēc tam Booking.com katram nākamajam objektam ir vien kartēšanas jautājums.",
            },
            { type: "h2", text: "Booking.com aktivizēšana" },
            {
              type: "steps",
              items: [
                "Atveriet objektu sadaļā /objekte, cilnē „Portāli\"",
                "No pieejamo portālu saraksta izvēlieties „Booking.com\"",
                "Piesaistiet atbilstošo numuru vai piedāvājuma tipu un apstipriniet tarifu plānus",
                "Aktivizējiet redzamību — objekts pēc Booking.com pārbaudes tiks aktivizēts",
              ],
            },
            { type: "h2", text: "Ko no jums sagaida Booking.com" },
            {
              type: "ul",
              items: [
                "Pilnīgs objekta apraksts, attēli un aprīkojums",
                "Vismaz viens tarifs ar cenu un anulēšanas nosacījumiem",
                "Derīga maksājumu metode provizoriskajam nolūkam",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Booking.com apstiprinājums var aizņemt vairākas stundas. Statuss objekta cilnē „Portāli\" rāda, vai savienojums jau ir aktīvs.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Airbnb savienošana",
          excerpt: "Kā ar kanālu pārvaldnieka palīdzību padarīt objektu rezervējamu Airbnb.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Airbnb kā vēl viens portāls" },
            {
              type: "p",
              text: "Airbnb, tāpat kā jebkurš cits portāls, tiek piesaistīts caur kontam kopīgo savienojumu. Kad tas ir iestatīts, aktivizējat Airbnb katram objektam ar kartēšanu — neatkarīgi no tā, vai objekts jau ir redzams Booking.com vai citos portālos.",
            },
            { type: "h2", text: "Airbnb aktivizēšana objektam" },
            {
              type: "steps",
              items: [
                "Atveriet objektu sadaļā /objekte, cilnē „Portāli\"",
                "No pieejamo portālu saraksta izvēlieties „Airbnb\"",
                "Apstipriniet objekta kategoriju un piesaistīto piedāvājuma tipu",
                "Pārbaudiet fotogrāfijas, aprīkojumu un mājas noteikumus — Airbnb pirms apstiprinājuma pieprasa pilnīgus datus",
                "Aktivizējiet redzamību Airbnb",
              ],
            },
            { type: "h2", text: "Pēc aktivizēšanas" },
            {
              type: "p",
              text: "Tiklīdz Airbnb objektu apstiprinājis, cenas un pieejamība automātiski tiek uzturētas caur kanālu pārvaldnieku. Rezervācijas, kas ienāk Airbnb, pēc tam automātiski parādās jūsu rezervāciju kalendārā.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez norādītiem anulēšanas nosacījumiem un mājas kārtības noteikumiem Airbnb apstiprinājumu noraida. Vispirms papildiniet šos datus objektā.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Cenu un pieejamības sinhronizēšana",
          excerpt:
            "Cenas un pieejamība tiek automātiski pārsūtītas visiem savienotajiem portāliem.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Viens kalendārs, visi portāli" },
            {
              type: "p",
              text: "Cenas un pieejamību uzturat tikai attiecīgā objekta myNextDays kalendārā. Kanālu pārvaldnieks katru izmaiņu automātiski pārsūta visiem portāliem, kuriem objekts ir aktīvi kartēts — jums nekas nav jāievada divreiz.",
            },
            { type: "h2", text: "Kas tiek pārsūtīts" },
            {
              type: "ul",
              items: [
                "Dienas cenas no jūsu cenu kalendāra vai tarifu plāniem",
                "Pieejamās naktis un bloķējumi",
                "Minimālā uzturēšanās un ierašanās/izbraukšanas ierobežojumi",
                "Stop-Sell dienas — tās automātiski bloķē visos portālos",
              ],
            },
            { type: "h2", text: "Cik ātri sinhronizācija darbojas" },
            {
              type: "p",
              text: "Cenu un pieejamības izmaiņas tiek pārsūtītas portāliem dažu minūšu laikā. Jaunas rezervācijas nekavējoties bloķē skartās naktis, lai to pašu nakti nevarētu vēlreiz pārdot nevienā citā kanālā.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Vairāk par kanālu pārklājošu atsevišķu dienu bloķēšanu lasiet sadaļā [Pārbukšanas novēršana](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Portāla rezervāciju saņemšana",
          excerpt: "Rezervācijas no Booking, Airbnb un citiem automātiski nonāk jūsu kalendārā.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Automātiskais imports" },
            {
              type: "p",
              text: "Ja viesis rezervē caur portālu, piemēram, Booking.com vai Airbnb, kanālu pārvaldnieks automātiski importē rezervāciju myNextDays. Jums nekas nav manuāli jāpārsūta — rezervācija parādās skarto objektu kalendārā un rezervāciju sarakstā.",
            },
            { type: "h2", text: "Kas notiek portāla rezervācijas gadījumā" },
            {
              type: "steps",
              items: [
                "Portāls paziņo par jauno rezervāciju kanālu pārvaldniekam",
                "myNextDays izveido rezervāciju ar viesa datiem, periodu un cenu",
                "Rezervētās naktis nekavējoties tiek bloķētas visos citos kanālos",
                "Jūs saņemat paziņojumu un rezervāciju atrodat kalendārā",
              ],
            },
            { type: "h2", text: "Anulēšanas un izmaiņas" },
            {
              type: "p",
              text: "Ja viesis anulē caur portālu vai maina periodu, tas arī automātiski tiek pārsūtīts uz myNextDays un skartās naktis atkal tiek atbrīvotas.",
            },
            {
              type: "note",
              variant: "info",
              text: "Portāla rezervācijas rezervācijas detaļās atpazīstamas pēc izcelsmes nozīmītes, piemēram, Booking.com vai Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Pārbukšanas novēršana",
          excerpt: "Stop-Sell un automātiski bloķējumi novērš dubultbukšanu vairākos portālos.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Kāpēc rodas pārbukšana" },
            {
              type: "p",
              text: "Bez centralizētas vadības viegli var gadīties, ka tā pati nakts vienlaikus tiek pārdota divos portālos — piemēram, ja cenas un pieejamība tiek manuāli uzturētas vairākās sistēmās. Kanālu pārvaldnieks šo plaisu novērš, jo katra rezervācija katrā kanālā nekavējoties bloķē visus pārējos kanālus.",
            },
            { type: "h2", text: "Jūsu instrumenti pret pārbukšanu" },
            {
              type: "ul",
              items: [
                "Automātisks bloķējums: katra jauna rezervācija — neatkarīgi no kanāla — visur bloķē naktis",
                "Stop-Sell: manuāli bloķē dienu visos kanālos vienlaikus, piemēram, pašu izmantošanai vai apkopei",
                "Minimālā uzturēšanās un ierašanās ierobežojumi novērš neatbilstošas īsas rezervācijas",
              ],
            },
            { type: "h2", text: "Stop-Sell iestatīšana" },
            {
              type: "steps",
              items: [
                "Atveriet objekta aizņemtības kalendāru",
                "Atzīmējiet skarto dienu vai periodu",
                "Izvēlieties „Stop-Sell\" — pēc tam diena būs bloķēta visos portālos, kā arī vietnē un platformā",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell bez izņēmuma attiecas uz visiem kanāliem. Nav iespējams bloķēt dienu tikai vienam portālam, atstājot to atvērtu citiem.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Redzamība katram portālam",
          excerpt: "Katru portālu var ieslēgt vai izslēgt neatkarīgi no vietnes un platformas tirgus.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Trīs neatkarīgi pārdošanas veidi" },
            {
              type: "p",
              text: "Objektu var vienlaikus pārdot vairākos veidos: caur portāliem (Booking, Airbnb un citi), caur myNextDays platformas tirgu un caur savu vietni. Katram veidam ir savs redzamības slēdzis — tie ir pilnībā neatkarīgi vienam no otra.",
            },
            { type: "h2", text: "Redzamības pārvaldība katram portālam" },
            {
              type: "p",
              text: "Portālu ietvaros papildus katru atsevišķu portālu var pārslēgt atsevišķi. Objekts, piemēram, var būt aktīvs Booking.com, bet deaktivizēts Airbnb — abas piesaistes turpina pastāvēt neietekmētas.",
            },
            { type: "h2", text: "Kā mainīt redzamību" },
            {
              type: "steps",
              items: [
                "Atveriet objektu sadaļā /objekte, cilnē „Portāli\"",
                "Ieslēdziet vai izslēdziet vēlamo kanālu (atsevišķu portālu, vietni vai platformas tirgu) atsevišķi",
                "Saglabājiet — izmaiņas darbojas dažu minūšu laikā",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Objekta statuss (aktīvs/neaktīvs), kā arī Stop-Sell darbojas pārāk visiem kanāliem. Redzamības slēdži nosaka tikai to, kuros papildu kanālos parādās jau aktīvs objekts.",
            },
          ],
        },
      ],
    },
  ],
};
