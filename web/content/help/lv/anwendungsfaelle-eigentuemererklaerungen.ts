import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Īpašnieku norēķini",
  description: "Izveidojiet īpašnieku norēķinus.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Īpašnieku norēķini",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Īpašnieka statement izveide",
          excerpt: "Kā izveidot īpašniekam pārskatāmu viņa perioda norēķinu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija",
            },
            {
              type: "p",
              text: "Ja pārvaldāt objektus īpašniekiem, viņiem regulāri nepieciešams izsekojams pārskats par ieņēmumiem, atskaitīto komisiju un izmaksu par saviem objektiem noteiktā periodā — īpašnieka statement šos datus apkopo automātiski.",
            },
            {
              type: "steps",
              items: [
                "Kontā atveriet sadaļu Īpašnieki un izvēlieties skarto īpašnieku.",
                "Izvēlieties norēķinu periodu, par kuru jāizveido statement.",
                "Pārbaudiet, vai visi šī īpašnieka objekti ir pareizi piesaistīti, jo statement tiek iekļauti tikai piesaistīti objekti.",
                "Ļaujiet izveidot statement un pārbaudiet norādīto rezervāciju pilnīgumu.",
                "Nodrošiniet statement īpašniekam caur īpašnieka piekļuvi vai eksportējiet to kā dokumentu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Statement katru rezervāciju rāda ar summu attiecīgā objekta valūtā — nav vienotas valūtas norādes, jo vairākiem objektiem var būt arī dažādas valūtas. Vairāk par piesaisti sadaļā [Objekta piesaiste īpašniekam](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Komisijas norēķins ar īpašnieku",
          excerpt: "Kā nodrošināt, ka jūsu komisija tiek pareizi aprēķināta no īpašnieka ieņēmumiem.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija",
            },
            {
              type: "p",
              text: "Jūsu komisija par objekta pārvaldību ir norādīta īpašnieka tarifā un katra statement izveidē automātiski tiek atskaitīta no bruto ieņēmumiem. Lai norēķins būtu pareizs, komisijas likmei jābūt pareizi iestatītai pirms pirmās rezervācijas periodā.",
            },
            {
              type: "steps",
              items: [
                "Kontā atveriet skartā īpašnieka tarifu un pārbaudiet norādīto komisijas likmi.",
                "Pēc vajadzības pielāgojiet likmi, pirms jaunas rezervācijas ienāk nākamajā norēķinu periodā.",
                "Izveidojiet īpašnieka statement periodam un pārbaudiet, vai komisija katrai rezervācijai tiek pareizi norādīta.",
                "Pārbaudiet bruto ieņēmumu, atskaitītās komisijas un neto izmaksas summas ticamību.",
                "Neatbilstības noskaidrojiet tieši ar īpašnieku pirms statement apstiprināšanas, nevis vēlāk mainiet statement.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Vēlāka komisijas likmes izmaiņa attiecas tikai uz turpmākajiem periodiem, nevis ar atpakaļejošu spēku uz jau izveidotajiem statement. Tāpēc pārbaudiet likmi savlaicīgi pirms jauna norēķinu perioda sākuma — skatiet arī [Īpašnieka norēķins (Statement)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
