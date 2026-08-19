import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Uzdevumi un uzkopšana",
  description: "Organizējiet uzkopšanas plānus un komandas uzdevumus.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Darbība",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Uzdevumu izveide",
          excerpt: "Kā izveidot jaunu uzdevumu objektam vai periodam.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Uzdevumi apvieno visu, kas jāpaveic ap objektu — no uzkopšanas pēc izbraukšanas līdz apkopes darbiem vai viesu pieprasījumiem. Katrs uzdevums ir saistīts tieši ar vienu objektu un to var piešķirt komandas dalībniekam.",
            },
            { type: "h2", text: "Jauna uzdevuma izveide" },
            {
              type: "steps",
              items: [
                "Galvenajā izvēlnē atveriet sadaļu „Uzdevumi“.",
                "Noklikšķiniet uz „Jauns uzdevums“.",
                "Izvēlieties attiecīgo objektu.",
                "Piešķiriet virsrakstu un, ja vēlaties, aprakstu.",
                "Nosakiet izpildes datumu un laiku.",
                "Saglabājiet uzdevumu.",
              ],
            },
            { type: "h2", text: "Uzdevumu tipi" },
            {
              type: "p",
              text: "Papildus brīviem uzdevumiem sistēma automātiski izveido uzdevumus, piemēram, automātiski ieplānotu uzkopšanu pēc izbraukšanas. Tie jau ir saistīti ar objektu un atbilstošo laika logu, un tikai jāpiešķir komandas dalībniekam.",
            },
            {
              type: "ul",
              items: [
                "Manuāls uzdevums: brīvi ievadīts, piem., apkope vai īpaša vēlme.",
                "Automātisks uzkopšanas uzdevums: atvasināts no izbraukšanas datuma.",
                "Atkārtots uzdevums: regulārām pārbaudēm vai inspekcijām.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Detaļas par automātisko laika plānošanu lasiet sadaļā [Uzkopšanas plāni](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Piešķiriet precīzus virsrakstus — mobilajā skatā komandas dalībnieki bieži redz vienā skatienā tikai virsrakstu un objektu.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Uzkopšanas plāni",
          excerpt: "Ļaujiet automātiski ieplānot uzkopšanu pēc izbraukšanas.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Uzkopšanas plāns nodrošina, ka pēc katras izbraukšanas automātiski rodas uzkopšanas uzdevums attiecīgajam objektam — bez nepieciešamības sekot līdzi katrai rezervācijai atsevišķi. Tas samazina aizmirstas nodošanas un nodrošina uzticamu norisi starp diviem uzturēšanās periodiem.",
            },
            { type: "h2", text: "Automātiskas plānošanas aktivizēšana" },
            {
              type: "steps",
              items: [
                "Atveriet objektu un pārejiet uz cilni „Uzkopšana“.",
                "Aktivizējiet „Automātiski plānot uzkopšanu pēc izbraukšanas“.",
                "Nosakiet, cik daudz laika pēc izbraukšanas tiek atvēlēts uzkopšanai.",
                "Pēc izvēles nosakiet standarta komandu vai standarta uzkopšanas darbinieku.",
                "Saglabājiet iestatījumu.",
              ],
            },
            { type: "h2", text: "Mijiedarbība ar kalendāru" },
            {
              type: "p",
              text: "Tiklīdz rezervācija tiek anulēta vai pārcelta, saistītais uzkopšanas uzdevums automātiski pielāgojas jaunajam izbraukšanas datumam. Tā uzkopšanas plāns vienmēr paliek sinhronizēts ar faktisko aizņemtības stāvokli.",
            },
            {
              type: "ul",
              items: [
                "Uzkopšana automātiski rodas pie katras izbraukšanas ar aktīvu plānu.",
                "Ja rezervācija tiek pārcelta, kopā tiek pārcelts arī uzkopšanas uzdevums.",
                "Ja viesis anulē uzturēšanos, uzkopšanas uzdevums tiek noņemts.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez aktivizēta uzkopšanas plāna automātiski uzdevumi nerodas — tad izveidojiet uzkopšanu manuāli sadaļā [Uzdevumu izveide](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Uzdevumu piešķiršana",
          excerpt: "Mērķtiecīgi piešķiriet uzdevumus uzkopšanas darbiniekiem vai komandas dalībniekiem.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Lai uzdevums tiktu izpildīts, to piešķirat konkrētam komandas dalībniekam — piemēram, uzkopšanas darbiniekam vai darbiniekam ar apkopes pienākumu. Pēc noklusējuma uzdevumu savā pārskatā redz tikai piešķirtā persona.",
            },
            { type: "h2", text: "Uzdevuma manuāla piešķiršana" },
            {
              type: "steps",
              items: [
                "Atveriet uzdevumu sarakstā „Uzdevumi“.",
                "Noklikšķiniet uz „Piešķirt“.",
                "No saraksta izvēlieties atbildīgo komandas dalībnieku.",
                "Apstipriniet piešķīrumu.",
              ],
            },
            { type: "h2", text: "Piešķiršana pēc objekta" },
            {
              type: "p",
              text: "Ja uzkopšanas darbiniekam jau ir fiksēti piešķirts objekts, uzdevumus šim objektam varat automātiski piešķirt arī šai personai. Tas ietaupa klikšķus atkārtotu uzkopšanu gadījumā un samazina atkārtotus jautājumus.",
            },
            {
              type: "ul",
              items: [
                "Manuāla piešķiršana: personu izvēlaties pats katram uzdevumam.",
                "Fiksēta objekta piesaiste: jaunie uzdevumi šim objektam automātiski dodas norādītajai personai.",
                "Uzdevumam vienmēr ir tieši viena atbildīgā persona.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Uzkopšanas darbinieki un darbinieki redz tikai savus piešķirtos uzdevumus, bez objekta finanšu vai pārdošanas datiem.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Uzdevumu statusa izsekošana",
          excerpt: "Reāllaikā sekojiet līdzi uzdevumu izpildes stāvoklim.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Katrs uzdevums iziet skaidru statusu — no atklāts caur pašlaik izpildē līdz pabeigts. Tā jūs vienmēr redzat, vai uzkopšana vai apkope tiks pabeigta savlaicīgi pirms nākamās ierašanās.",
            },
            { type: "h2", text: "Statusu pārskats" },
            {
              type: "ul",
              items: [
                "Atklāts: uzdevums ir izveidots, bet vēl nav sākts.",
                "Pašlaik izpildē: piešķirtā persona uzdevumu ir sākusi.",
                "Pabeigts: uzdevums ir izpildīts un apstiprināts.",
              ],
            },
            { type: "h2", text: "Statusa atjaunināšana" },
            {
              type: "steps",
              items: [
                "Atveriet uzdevumu no saraksta „Uzdevumi“.",
                "Izvēlieties atbilstošo statusu, piem., „Pašlaik izpildē“ vai „Pabeigts“.",
                "Pēc vajadzības pievienojiet īsu piezīmi, piemēram, par objektā pamanītām īpatnībām.",
                "Saglabājiet izmaiņas.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Statusa izmaiņas nekavējoties parādās kopīgotajā uzdevumu sarakstā — manuāla pārlādēšana nav nepieciešama.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ja uzkopšana īsi pirms nākamās ierašanās joprojām ir atklāta, vispirms pārbaudiet piešķīrumu, pirms sazināties ar viesi.",
            },
          ],
        },
      ],
    },
  ],
};
