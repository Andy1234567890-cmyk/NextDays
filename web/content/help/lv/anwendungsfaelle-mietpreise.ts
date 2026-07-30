import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Nomas cenas",
  description: "Optimāli nosakiet nomas cenas.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Nomas cenas",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Cenu optimizēšana augstajai sezonai",
          excerpt: "Kā mērķtiecīgi paaugstināt cenas periodiem ar lielu pieprasījumu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija",
            },
            {
              type: "p",
              text: "Augstajā sezonā pieprasījums ievērojami pieaug, kamēr jūsu bāzes cena saglabā tādas pašas vērtības kā pārējā gada laikā. Bez sezonālā pielāgojuma jūs zaudējat apgrozījumu gada spēcīgākajā laikā — pielāgojumu veic caur objekta tarifu plānu, nevis manuāli pārrakstot atsevišķas dienas.",
            },
            {
              type: "steps",
              items: [
                "Atveriet skartā objekta tarifu plānu un izveidojiet sezonas noteikumu vēlamajam periodam.",
                "Nosakiet uzcenojumu kā procentuālo vērtību vai fiksētu summu virs bāzes cenas — tarifu plāns automātiski pārņem objekta valūtu.",
                "Kalendārā pārbaudiet, vai jaunā cena augstās sezonas periodam parādās pareizi, pirms to aktivizējat.",
                "Pārbaudiet minimālo uzturēšanos augstajai sezonai — bieži lietderīga ir augstāka minimālā rezervācijas ilguma prasība, lai noslogojumu būtu vieglāk plānot.",
                "Pēc aktivizēšanas pirmajās dienās vērojiet rezervāciju stāvokli un pēc vajadzības koriģējiet uzcenojumu.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Sezonas noteikums darbojas visos kanālos vienlīdzīgi — portālos, platformā un vietnē. Detaļas par noteikumu veidošanu lasiet sadaļā [Tarifu plāni](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Ilgāku uzturēšanās periodu veicināšana ar atlaidi",
          excerpt: "Kā atalgot viesus ar ilgāku uzturēšanās laiku un samazināt maiņas slodzi.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija",
            },
            {
              type: "p",
              text: "Īsāki uzturēšanās periodi nozīmē vairāk ierašanos un izbraukšanu, vairāk uzkopšanas un lielāku tukšuma risku starp rezervācijām. Pakāpeniska uzturēšanās atlaide padara ilgākas rezervācijas viesiem pievilcīgākas un jūtami samazina šo slodzi.",
            },
            {
              type: "steps",
              items: [
                "Atveriet objekta tarifu plānu un izveidojiet uzturēšanās atlaidi.",
                "Definējiet vismaz vienu pakāpi, piemēram, sākot no 7 vai 28 naktīm, ar attiecīgu atlaides likmi.",
                "Pārbaudiet, vai pakāpes nepārklājas un atlaide darbojas tikai no attiecīgā minimālā ilguma.",
                "Kalendārā pārbaudiet piemēra rezervāciju, kas pārsniedz atlaides robežu, lai apstiprinātu pareizu piemērošanu.",
                "Aktivizējiet atlaidi un vērojiet ietekmi uz vidējo uzturēšanās ilgumu un noslogojumu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Uzturēšanās atlaides var kombinēt ar sezonas noteikumiem — tarifu plāns aprēķina abus pielāgojumus kopā. Vairāk par to lasiet sadaļā [Tarifu plāni](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
