import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Maksājumi",
  description: "Pareizi apstrādājiet maksājumus.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Maksājumi",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Priekšapmaksas iestatīšana",
          excerpt: "Kā rezervācijas laikā pieprasīt tikai daļu no summas, nevis visu summu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija",
            },
            {
              type: "p",
              text: "Tā vietā, lai uzreiz iekasētu visu rezervācijas summu, kā maksājumu noteikumu varat noteikt priekšapmaksu. Viesis rezervācijas brīdī apmaksā tikai daļu no summas caur Stripe vai PayPal, atlikumu — vēlāk ar atlikuma maksājumu.",
            },
            {
              type: "steps",
              items: [
                "Objektā atveriet sadaļu „Maksājumu noteikumi“.",
                "Izveidojiet jaunu „Priekšapmaksas“ tipa noteikumu.",
                "Nosakiet priekšapmaksas summu kā procentuālo daļu vai fiksētu summu no kopējās summas.",
                "Nosakiet, kad priekšapmaksa kļūst maksājama — parasti tieši rezervācijas brīdī.",
                "Saglabājiet noteikumu un pārbaudiet to ar testa rezervāciju.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Priekšapmaksa tiek apstrādāta caur objektam norādīto maksājumu pakalpojumu sniedzēju. Atbilstošo summu attiecībā pret atlikumu iestatiet sadaļā [Atlikuma maksājuma automatizēšana](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Atlikuma maksājuma automatizēšana",
          excerpt: "Kā atklāto atlikuma summu automātiski iekasē pirms ierašanās.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija",
            },
            {
              type: "p",
              text: "Pēc priekšapmaksas paliek atklāta atlikuma summa. Tā vietā, lai to izsekotu manuāli, iestatiet maksājumu noteikumu, kas atlikuma maksājumu automātiski iekasē fiksētā laikā pirms ierašanās caur Stripe vai PayPal.",
            },
            {
              type: "steps",
              items: [
                "Objektā atveriet sadaļu „Maksājumu noteikumi“.",
                "Izveidojiet jaunu „Atlikuma maksājuma“ tipa noteikumu, ja jau ir izveidots priekšapmaksas noteikums.",
                "Nosakiet, cik dienas pirms ierašanās kļūst maksājams atlikuma maksājums.",
                "Aktivizējiet automātisko iekasēšanu, lai norādītais maksājumu pakalpojumu sniedzējs summu iekasētu patstāvīgi.",
                "Pēc tam pārbaudiet atlikuma maksājuma statusu attiecīgās rezervācijas laika skalā.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ja automātiskā iekasēšana neizdodas, piemēram, kartes derīguma termiņa beigu dēļ, rezervācija automātiski netiek anulēta. Savlaicīgi pārbaudiet neveiksmīgos atlikuma maksājumus un sazinieties ar viesi tieši.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Atmaksas veikšana",
          excerpt: "Kā viesim pilnībā vai daļēji atmaksāt summu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija",
            },
            {
              type: "p",
              text: "Anulēšanas vai sūdzības gadījumā viesim varat pilnībā vai daļēji atmaksāt samaksāto summu. Atmaksa notiek caur to pašu maksājumu pakalpojumu sniedzēju, ar kuru sākotnēji tika veikts maksājums — Stripe vai PayPal.",
            },
            {
              type: "steps",
              items: [
                "Atveriet skarto rezervāciju rezervācijas laika skalā.",
                "Sadaļā „Maksājumi“ izvēlieties sākotnējo maksājumu, kas jāatmaksā.",
                "Izvēlieties starp pilnu vai daļēju atmaksu.",
                "Daļējas atmaksas gadījumā ievadiet vēlamo summu.",
                "Apstipriniet atmaksu un pārbaudiet atjaunināto maksājuma statusu laika skalā.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Atmaksa automātiski nemaina rezervācijas statusu vai aizņemtās kalendāra naktis. Anulēšanas gadījumā papildus pārbaudiet, vai skartās naktis jāatbrīvo aizņemtības plānā.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Drošības naudas pārvaldība",
          excerpt: "Kā iestatīt drošības naudu un to atbrīvot pēc uzturēšanās.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija",
            },
            {
              type: "p",
              text: "Drošības nauda jūs pasargā no bojājumiem uzturēšanās laikā. To norāda kā savu maksājumu noteikumu, un to caur Stripe vai PayPal atkarībā no objekta konfigurācijas vai nu iepriekš autorizē, vai iekasē.",
            },
            {
              type: "steps",
              items: [
                "Objektā atveriet sadaļu „Maksājumu noteikumi“ un izveidojiet „Drošības naudas“ tipa noteikumu.",
                "Nosakiet drošības naudas summu un autorizācijas brīdi, parasti īsi pirms ierašanās.",
                "Pēc izbraukšanas pārbaudiet objekta stāvokli.",
                "Ja stāvoklis ir nevainojams, atbrīvojiet drošības naudu pilnā apmērā caur rezervāciju.",
                "Bojājuma gadījumā atmaksājiet tikai nevajadzīgo daļu un dokumentējiet aizturēšanas iemeslu.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Autorizēta, bet neiekasēta drošības nauda atkarībā no maksājumu pakalpojumu sniedzēja pēc noteikta termiņa automātiski zaudē spēku. Atbrīvojiet drošības naudu savlaicīgi pēc izbraukšanas vai laikus iekasējiet nepieciešamo summu.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Rēķina labošana",
          excerpt: "Kā vēlāk izlabot jau izsniegtu rēķinu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija",
            },
            {
              type: "p",
              text: "Ja jau izsniegtā rēķinā ir kļūda, piemēram, rēķina adresē vai pozīcijā, to labojiet caur rezervāciju, nevis vienkārši dzēsiet sākotnējo rēķinu.",
            },
            {
              type: "steps",
              items: [
                "Atveriet skarto rezervāciju rezervācijas laika skalā un pārejiet uz sadaļu „Rēķini“.",
                "Izvēlieties kļūdaino rēķinu.",
                "Izveidojiet korekcijas jeb stornorēķinu sākotnējam rēķinam.",
                "Pēc tam izveidojiet jaunu, koriģētu rēķinu ar pareiziem datiem.",
                "Nosūtiet koriģēto rēķinu no jauna viesim vai rēķina adresei.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jau nosūtītu rēķinu izsekojamības dēļ nevajadzētu tieši pārrakstīt. Labojums, izmantojot stornorēķinu, saglabā sākotnējo dokumentu un padara izmaiņu izsekojamu.",
            },
          ],
        },
      ],
    },
  ],
};
