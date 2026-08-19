import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Ziņas un viesi",
  description: "Iesūtne, veidnes un saziņa ar viesiem.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Saziņa",
      articles: [
        {
          slug: "posteingang",
          title: "Platformas iesūtne",
          excerpt: "Visas jūsu objektu viesu ziņas centralizēti sakrājas platformas iesūtnē.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Viena iesūtne visiem objektiem" },
            {
              type: "p",
              text: "Platformas iesūtne apkopo visas viesu ziņas vienuviet — neatkarīgi no tā, ar kuru objektu vai kuru periodu saistīta saruna. To atveriet sadaļā /nachrichten, kur katra saruna redzama kā atsevišķs pavediens.",
            },
            { type: "h2", text: "Iesūtnes uzbūve" },
            {
              type: "ul",
              items: [
                "Kreisā slejа: visu sarunu saraksts, jaunākās vispirms",
                "Vidējā slejа: aktīvā ziņu vēsture ar viesi",
                "Labā slejа: rezervācijas konteksts — periods, objekts, viesa dati",
              ],
            },
            { type: "h2", text: "Atbildēšana uz ziņu" },
            {
              type: "steps",
              items: [
                "Atveriet /nachrichten un izvēlieties vēlamo sarunu",
                "Rakstiet savu atbildi teksta laukā vai izmantojiet ātro atbildi",
                "Nosūtiet ziņu — viesis to saņems tādā pašā veidā, kādā rakstīja",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Platformas iesūtne rāda tikai tiešo saziņu starp jums un jūsu viesiem myNextDays — ziņas no portāliem joprojām apstrādājat tur.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Ātrās atbildes",
          excerpt: "Veidnes biežiem jautājumiem ietaupa laiku saziņā ar viesiem.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Kas ir ātrās atbildes" },
            {
              type: "p",
              text: "Ātrās atbildes ir iepriekš sagatavoti teksta bloki atkārtotiem jautājumiem — piemēram, par ierašanos, Wi-Fi paroli vai autostāvvietu. Tā vietā, lai katru atbildi rakstītu no jauna, ar vienu klikšķi ievietojat atbilstošo veidni [Platformas iesūtnē](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Ātrās atbildes izveide" },
            {
              type: "steps",
              items: [
                "Atveriet /nachrichten un noklikšķiniet uz „Pārvaldīt ātrās atbildes“",
                "Noklikšķiniet uz „Jauna veidne“ un piešķiriet nosaukumu, piemēram, „Check-in informācija“",
                "Uzrakstiet atbildes tekstu; vietturi, piemēram, viesa vārds vai ierašanās datums, tiks automātiski aizpildīti nosūtot",
                "Saglabājiet veidni — tā uzreiz ir pieejama katrā sarunā",
              ],
            },
            { type: "h2", text: "Ātro atbilžu izmantošana ikdienā" },
            {
              type: "p",
              text: "Ziņu logā atveriet veidņu sarakstu ar zibens simbolu, izvēlieties atbilstošo atbildi un pēc vajadzības to individuāli pielāgojiet, pirms nosūtāt.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Izveidojiet veidnes piecu līdz desmit biežāko jautājumu atbildēm — praksē tas sedz lielāko daļu ienākošo ziņu.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Automātiskās ziņas",
          excerpt: "Apstiprinājumus, check-in informāciju un atgādinājumus var sūtīt viesiem automātiski.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Atkārtotu ziņu automatizēšana" },
            {
              type: "p",
              text: "Tā vietā, lai rezervācijas apstiprinājumus, check-in norādes vai pateicības ziņas sūtītu manuāli, izveidojat tos vienreiz kā noteikumu — myNextDays tos pēc tam automātiski nosūta piemērotā laikā pirms, uzturēšanās laikā vai pēc tās.",
            },
            { type: "h2", text: "Tipiski automātisko ziņu sprūdi" },
            {
              type: "ul",
              items: [
                "Tieši pēc rezervēšanas — apstiprinājums ar svarīgākajiem datiem",
                "Dažas dienas pirms ierašanās — check-in informācija un piekļuves kods",
                "Izbraukšanas dienā — pateicība un lūgums novērtēt",
              ],
            },
            { type: "h2", text: "Automātiskas ziņas izveide" },
            {
              type: "steps",
              items: [
                "Atveriet /nachrichten, sadaļu „Automātiskās ziņas“",
                "Izvēlieties sprūdi, piemēram, „X dienas pirms ierašanās“",
                "Ievadiet tekstu — vietturi, piemēram, viesa vārds, objekts vai ierašanās datums, tiks aizpildīti automātiski",
                "Aktivizējiet noteikumu; tas attiecas uz visiem objektiem, ja vien nav citādi ierobežots",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Automātiskās ziņas parasti parādās [Platformas iesūtnē](/hilfe/nachrichten/posteingang) un tur jebkurā laikā var tās vēlāk apskatīt.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Ziņu bloķēšana",
          excerpt: "Personu var bloķēt turpmākai saziņai tieši no ziņu vēstures.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            { type: "h2", text: "Kad bloķēšana ir jēgpilna" },
            {
              type: "p",
              text: "Aizskarošu ziņu, aizskaršanas vai atkārtotas neatbilstošas uzvedības gadījumā personu varat bloķēt tieši no ziņu pavediena. Bloķēta persona pēc tam vairs nevar jums rakstīt jaunas ziņas un vairs nevar izveidot jaunu rezervāciju pie jums.",
            },
            { type: "h2", text: "Personas bloķēšana no pavediena" },
            {
              type: "steps",
              items: [
                "Atveriet skarto sarunu sadaļā [Platformas iesūtne](/hilfe/nachrichten/posteingang)",
                "Pavediena augšpusē noklikšķiniet uz izvēlnes un izvēlieties „Bloķēt personu“",
                "Apstipriniet darbību — bloķēšana darbojas nekavējoties",
              ],
            },
            { type: "h2", text: "Ko bloķēšana nozīmē — un ko nē" },
            {
              type: "ul",
              items: [
                "Bloķētās personas jaunās ziņas vairs netiek piegādātas",
                "Personas jaunie rezervāciju pieprasījumi tiek noraidīti",
                "Ja šai personai pašlaik notiek rezervācija, saziņa izņēmuma kārtā paliek iespējama uz uzturēšanās laiku",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bloķēšanu jebkurā laikā var atcelt pārskatā „Bloķētas personas“ kontā. Pirms bloķēšanas pārbaudiet, vai jau nenotiek aktīva rezervācija.",
            },
          ],
        },
      ],
    },
  ],
};
