import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Rezervācijas un bukšanas",
  description: "Pārvaldiet, pārceliet un anulējiet rezervācijas.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Rezervācijas",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Rezervācijas manuāla ievadīšana",
          excerpt:
            "Kā tieši myNextDays ievadīt pa tālruni vai e-pastu saņemtu rezervāciju.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Kad ievadīt manuāli" },
            {
              type: "p",
              text: "Ne katra rezervācija ienāk caur portālu vai jūsu pašu platformu — pieprasījumi pa tālruni, e-pastu vai klātienē jums jāievada pašiem, lai objekts myNextDays tiktu pareizi bloķēts un neveidotos dubultā aizņemtība.",
            },
            {
              type: "steps",
              items: [
                "Atveriet Rezervācijas un noklikšķiniet uz „Jauna rezervācija“.",
                "Izvēlieties objektu — katrs objekts myNextDays ir viena rezervējama vienība, tātad konkrēts numurs vai brīvdienu mājoklis.",
                "Norādiet ierašanās un izbraukšanas datumu, kā arī viesu skaitu.",
                "Ievadiet viesa datus (vārdu, kontaktinformāciju, ja nepieciešams, adresi rēķinam).",
                "Pārbaudiet piedāvāto cenu un pēc vajadzības to pielāgojiet.",
                "Saglabājiet rezervāciju — naktis kalendārā tiek nekavējoties bloķētas.",
              ],
            },
            { type: "h2", text: "Maksājums un apstiprinājums" },
            {
              type: "p",
              text: "Pēc saglabāšanas darbojas tie paši maksājumu noteikumi kā tiešsaistes rezervācijām. Ja ir savienots maksājumu pakalpojumu sniedzējs, varat tieši nosūtīt viesam maksājuma saiti vai manuāli atzīmēt maksājumu kā saņemtu.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Uzreiz ievadiet piezīmēs īpašas vēlmes (agra ierašanās, papildu gultas) — komanda tās redzēs rezervācijas laika skalā.",
            },
            { type: "h2", text: "Pēc izveides" },
            {
              type: "p",
              text: "Jaunā rezervācija nekavējoties parādās sadaļā [Rezervācijas laika skala](/hilfe/reservierungen/buchungs-zeitleiste) kopā ar visiem turpmākajiem soļiem — ziņām, uzdevumiem un maksājumiem — vienā vietā.",
            },
            {
              type: "ul",
              items: [
                "Kalendārs un portāli tiek automātiski sinhronizēti, tiklīdz saglabājat.",
                "Viesis pēc vajadzības saņem automātisku apstiprinājuma ziņu.",
                "Izmaiņas datumos ievadiet, izmantojot „Pārcelt rezervāciju“.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "Rezervācijas laika skala",
          excerpt:
            "Rezervācijas laika skala apvieno visu rezervācijas gaitu vienā vietā.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Ko laika skala rāda" },
            {
              type: "p",
              text: "Katrai rezervācijai ir sava laika skala, kas hronoloģiski attēlo visu gaitu — no rezervācijas pieprasījuma vai portāla importa līdz izbraukšanai. Tā jūs vienā skatienā redzat, kas jau ir noticis un kas gaidāms tālāk.",
            },
            {
              type: "ul",
              items: [
                "Ziņas ar viesi",
                "Uzdevumi, piemēram, uzkopšana vai sagatavošana",
                "Maksājumi un rēķini",
                "Rezervētie papildpakalpojumi",
                "Pārcelšanas (Move) un anulēšanas",
              ],
            },
            { type: "h2", text: "Laika skalas izmantošana ikdienā" },
            {
              type: "steps",
              items: [
                "Atveriet Rezervācijas un izvēlieties vēlamo rezervāciju.",
                "Pārejiet uz cilni „Laika skala“.",
                "Pārlūkojiet visus notikumus hronoloģiski.",
                "Izmantojiet ātrās darbības, lai tieši nosūtītu ziņu vai izveidotu uzdevumu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ja rezervācija tiek pārcelta vai anulēta, arī šis solis parādās laika skalā — ieskaitot kalendārā atbrīvotās naktis.",
            },
            { type: "h2", text: "Kāpēc tas ir svarīgi" },
            {
              type: "p",
              text: "Tā kā komanda, īpašnieks un atbalsts redz vienu un to pašu laika skalu, starp ziņām, uzdevumiem un maksājumiem nerodas informācijas plaisas. Detaļas par atmaksām lasiet sadaļā [Atmaksas](/hilfe/zahlungen/rueckerstattungen), par papildpakalpojumiem — sadaļā [Papildpakalpojumi](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Rezervācijas pārcelšana",
          excerpt:
            "Kā pārcelt esošu rezervāciju uz jaunu periodu, nesajaucot kalendāru.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Pārbaude pirms pārcelšanas" },
            {
              type: "p",
              text: "Pirms rezervācijas pārcelšanas pārbaudiet rezervētā objekta pieejamību jaunajā periodā. myNextDays sākotnēji rezervētās naktis atbrīvo tikai tad, kad jaunais periods ir apstiprināts — tā nerodas plaisa, kurā objekts kļūdaini uzskatīts par brīvu vai dubultoti aizņemtu.",
            },
            {
              type: "steps",
              items: [
                "Atveriet rezervāciju sadaļā Rezervācijas.",
                "Izvēlieties „Pārcelt“ un ievadiet jauno periodu.",
                "Pārbaudiet rādīto pieejamību jaunajiem datumiem.",
                "Apstipriniet pārcelšanu.",
                "Pārbaudiet, vai jaunā nakšu skaita dēļ mainās cena, un pēc vajadzības to pielāgojiet.",
              ],
            },
            { type: "h2", text: "Kas notiek automātiski" },
            {
              type: "p",
              text: "Pēc apstiprināšanas vecās naktis kalendārā tiek pareizi atbrīvotas un jaunās naktis — bloķētas, savienotie portāli tiek atjaunināti. Process tiek reģistrēts rezervācijas laika skalā.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ja rezervācija saņemta caur portālu, pārcelšanai tur var būt savi noteikumi — pirms lielākām izmaiņām pārbaudiet portāla noteikumus.",
            },
            { type: "h2", text: "Maksājumu starpības" },
            {
              type: "p",
              text: "Ja pārcelšanas dēļ mainās cena, attiecīgi pielāgojiet maksājumu noteikumus — skatiet [Maksājumu noteikumi](/hilfe/zahlungen/zahlungsregeln). Vairāk par rezervācijas kopējo gaitu lasiet sadaļā [Rezervācijas laika skala](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Anulēšana un atmaksa",
          excerpt:
            "Kā pareizi anulēt rezervāciju un pēc vajadzības sākt atmaksu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Rezervācijas anulēšana" },
            {
              type: "p",
              text: "Anulēšana nekavējoties atkal atbrīvo objektu rezervētajam periodam — gan jūsu kalendārā, gan visos savienotajos portālos. Pirms anulēšanas pārbaudiet, kādi anulēšanas nosacījumi attiecas uz šo rezervāciju.",
            },
            {
              type: "steps",
              items: [
                "Atveriet rezervāciju sadaļā Rezervācijas.",
                "Izvēlieties „Anulēt“ un norādiet iemeslu.",
                "Pārbaudiet piedāvāto atmaksājamo summu.",
                "Apstipriniet anulēšanu.",
              ],
            },
            { type: "h2", text: "Atmaksas sākšana" },
            {
              type: "p",
              text: "Ja maksājums veikts caur savienotu maksājumu pakalpojumu sniedzēju, atmaksu varat sākt tieši no rezervācijas. Summa tiek norādīta šim objektam piešķirtajā valūtā. Detaļas par procesu lasiet sadaļā [Atmaksas](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Iespējama pilnīga vai daļēja atmaksa",
                "Process parādās rezervācijas laika skalā",
                "Portāla rezervācijām papildus attiecas attiecīgā portāla noteikumi",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Anulēšanu nevar atsaukt. Pirms apstiprināšanas rūpīgi pārbaudiet periodu un viesi.",
            },
            { type: "h2", text: "Pēc anulēšanas" },
            {
              type: "p",
              text: "Objekts no šī brīža atkal ir rezervējams, atklātie ar rezervāciju saistītie uzdevumi — piemēram, sagatavošana — tiek automātiski atzīmēti kā vairs nevajadzīgi. Viss process paliek izsekojams sadaļā [Rezervācijas laika skala](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Check-in un Check-out",
          excerpt: "Kā myNextDays dokumentēt viesa ierašanos un izbraukšanu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Check-in ievadīšana" },
            {
              type: "p",
              text: "Check-in iezīmē uzturēšanās sākumu un ir īpaši noderīgs pašapkalpošanās reģistrēšanās gadījumā vai atslēgu nodošanā, ko veic komanda, lai katras rezervācijas statuss būtu aktuāls.",
            },
            {
              type: "steps",
              items: [
                "Atveriet rezervāciju sadaļā Rezervācijas.",
                "Ierašanās dienā izvēlieties „Check-in“.",
                "Pēc vajadzības ievadiet piezīmi, piemēram, par laiku vai īpatnībām.",
              ],
            },
            { type: "h2", text: "Check-out un nodošana" },
            {
              type: "p",
              text: "Ar Check-out atzīmējat uzturēšanos kā pabeigtu. Daudzos gadījumos tas automātiski izraisa uzkopšanas uzdevumu objektam, lai to sagatavotu nākamajai rezervācijai.",
            },
            {
              type: "ul",
              items: [
                "Check-in un Check-out ir daļa no rezervācijas laika skalas",
                "Laikus var noteikt katram objektam objekta iestatījumos",
                "Mobilās piekļuves gadījumā komanda var ievadīt Check-in un Check-out tieši uz vietas",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Nokavēts Check-out automātiski nebloķē turpmākos uzdevumus — regulāri pārbaudiet nokavētos statusus sadaļā Rezervācijas.",
            },
            { type: "h2", text: "Saistība ar uzdevumiem" },
            {
              type: "p",
              text: "Check-in un Check-out ir cieši saistīti ar uzdevumiem un laika skalu. Vairāk par kopējo gaitu lasiet sadaļā [Rezervācijas laika skala](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Papildpakalpojumi",
          excerpt:
            "Kā piedāvāt viesiem rezervējamus papildpakalpojumus, piemēram, brokastis vai transfēru, un tos ievadīt rezervācijā.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Kas ir papildpakalpojumi" },
            {
              type: "p",
              text: "Papildpakalpojumi ir izvēles papildu pakalpojumi rezervācijai — piemēram, brokastis, agra ierašanās, transfērs vai vēla izbraukšana. Tie tiek norādīti katram objektam un tos var pievienot rezervācijai gan pats viesis, gan jūsu komanda.",
            },
            {
              type: "steps",
              items: [
                "Atveriet objektu un sadaļā „Papildpakalpojumi“ izveidojiet vēlamos papildpakalpojumus ar cenu.",
                "Atveriet esošu rezervāciju sadaļā Rezervācijas.",
                "Izvēlieties „Pievienot papildpakalpojumu“ un izvēlieties vēlamo pakalpojumu.",
                "Apstipriniet pakalpojuma daudzumu un laiku.",
              ],
            },
            { type: "h2", text: "Norēķini" },
            {
              type: "p",
              text: "Papildpakalpojumi tiek norēķināti attiecīgā objekta valūtā un parādās rēķinā kā atsevišķa pozīcija. Jau apmaksātus papildpakalpojumus anulēšanas gadījumā var proporcionāli atmaksāt.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Reiz norādiet populārus papildpakalpojumus centralizēti pie objekta — tā tos var pievienot katrai jaunai rezervācijai ar dažiem klikšķiem.",
            },
            { type: "h2", text: "Redzamība viesim" },
            {
              type: "p",
              text: "Ja platforma vai pati vietne ir aktīva, viesi bieži var izvēlēties atbilstošus papildpakalpojumus jau rezervācijas laikā. Katrs papildinājums pēc tam parādās sadaļā [Rezervācijas laika skala](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Papildpakalpojumus var individuāli nosaukt un cenot katram objektam",
                "Vēlāku pievienošanu var veikt jebkurā laikā caur rezervāciju",
                "Anulētie papildpakalpojumi tiek proporcionāli atmaksāti",
              ],
            },
          ],
        },
      ],
    },
  ],
};
