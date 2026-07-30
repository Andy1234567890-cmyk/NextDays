import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Rezervācijas un kalendārs",
  description: "Kontrolējiet rezervācijas un kalendāru.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Rezervācijas un kalendārs",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Uzticama pārbukšanas novēršana",
          excerpt: "Kā nodrošināt, ka objekts nekad netiek dubultoti rezervēts.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija",
            },
            {
              type: "p",
              text: "Objektu vienlaikus pārdod vairākos kanālos — portālos, piemēram, Booking, Airbnb un citos, pašu platformā, kā arī lietotnē. Pārbukšana rodas, ja pieejamība vienā kanālā netiek savlaicīgi bloķēta pēc tam, kad rezervācija notikusi citā kanālā.",
            },
            {
              type: "steps",
              items: [
                "Aizņemtības plānā pārbaudiet, ka katrs objekts ir tieši viena rinda ar vienu rezervējamu vienību — bez vairāku numuru kopīgas kapacitātes.",
                "Ļaujiet jaunās rezervācijas veidot tikai caur aizņemtības plānu vai pievienotajiem kanāliem, nekad manuāli aprakstot atsevišķas dienas.",
                "Pēc katras rezervācijas pārbaudiet, ka rezervētās naktis kalendārā uzreiz parādās kā aizņemtas.",
                "Tehnisku problēmu vai apkopes gadījumā nekavējoties izmantojiet Stop-Sell, nevis atstājiet dienu atvērtu.",
                "Neskaidrību gadījumā pārbaudiet skartās rezervācijas laika skalu, lai izsekotu notikumu hronoloģiju.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Nekad manuāli nemainiet naktis vai bloķējumus ārpus aizņemtības plāna — tikai tā ir nodrošināts, ka visi kanāli redz vienu un to pašu pieejamības stāvokli un neveidojas plaisa dubultrezervācijai.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Rezervācijas pārcelšana uz citu objektu",
          excerpt: "Kā korekti pārcelt esošu rezervāciju uz citu objektu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija",
            },
            {
              type: "p",
              text: "Reizēm viesim jāpāriet no viena objekta uz citu, piemēram, tehniska defekta vai viesa vēlmes dēļ. Pārceļoties automātiski tiek atbrīvotas iepriekšējās kalendāra naktis un no jauna aizņemtas mērķa objektā.",
            },
            {
              type: "steps",
              items: [
                "Atveriet skarto rezervāciju rezervācijas laika skalā.",
                "Darbību izvēlnē izvēlieties „Mainīt objektu“ vai „Pārcelt“.",
                "Izvēlieties mērķa objektu un pārbaudiet tā pieejamību izvēlētajā periodā.",
                "Apstipriniet pārcelšanu.",
                "Pēc tam aizņemtības plānā pārbaudiet, ka vecās naktis sākuma objektā atkal tiek rādītas kā pieejamas.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Veco nakšu atbrīvošanu automātiski veic sistēma — jums pašiem sākotnējais periods manuāli nav jāatver. Informējiet viesi par objekta maiņu, īpaši ja atšķiras aprīkojums vai piekļuve.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Ilgtermiņa rezervācijas izveide",
          excerpt: "Kā pareizi izveidot rezervāciju uz ilgāku periodu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija",
            },
            {
              type: "p",
              text: "Ilgtermiņa viesiem — piemēram, uz vairākām nedēļām vai mēnešiem — rezervāciju izveidojat kā parasti, taču papildus pievēršat uzmanību minimālajai uzturēšanās prasībai, maksājumu noteikumiem un objekta kanālu redzamībai visā periodā.",
            },
            {
              type: "steps",
              items: [
                "Atveriet vēlamā objekta aizņemtības plānu un atzīmējiet visu periodu.",
                "Izveidojiet rezervāciju ar viesa datiem un plānoto ierašanās un izbraukšanas datumu.",
                "Pēc vajadzības iestatiet maksājumu noteikumu ar priekšapmaksu un atlikuma maksājumu, nevis pieprasiet visu summu uzreiz.",
                "Pārbaudiet, ka nevienam minimālās vai maksimālās uzturēšanās noteikumam nav pretrunas ar garo periodu.",
                "Saglabājiet rezervāciju un pārbaudiet, ka viss periods kalendārā pareizi tiek rādīts kā aizņemts.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Ļoti ilgu uzturēšanās periodu gadījumā ieteicams atlikuma maksājumu sadalīt vairākās daļās, nevis vienā lielā termiņā — tā maksājuma risks paliek pārskatāms. Detaļas sadaļā [Atlikuma maksājuma automatizēšana](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
