import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Vietne",
  description: "Izmantojiet savu vietni optimāli.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Vietne",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Vietnes aktivizēšana tiešsaistē",
          excerpt: "Kā publicēt savu vietni kā patstāvīgu pārdošanas kanālu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija",
            },
            {
              type: "p",
              text: "Jūsu vietne ir savs pārdošanas kanāls blakus portāliem un platformai. Lapas veidojat redaktorā, taču tikai ar publicēšanu vietne kļūst redzama viesiem un jūsu objekti tur parādās kā rezervējami.",
            },
            {
              type: "steps",
              items: [
                "Atveriet vietnes redaktoru un pārbaudiet, vai visas vēlamās lapas ir aizpildītas ar saturu.",
                "Objekta cilnē katram objektam izvēlieties, vai tam jābūt redzamam vietnē — šī redzamība ir neatkarīga no portāliem un platformas.",
                "Pirms došanās tiešsaistē pārbaudiet priekšskatījumu galddatora un mobilajā skatā.",
                "Noklikšķiniet uz „Publicēt“, lai aktivizētu vietni viesiem.",
                "Pēc publicēšanas pārbaudiet publisko URL un pārbaudiet piemēra rezervāciju caur vietni.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Objekta vietnes redzamība ir sava ass — objekts var būt aktīvs portālos, bet paslēpts vietnē, un otrādi. Detaļas sadaļā [Sava domēna iestatīšana](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Sava domēna iestatīšana",
          excerpt: "Kā savienot savu domēnu ar myNextDays vietni.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija",
            },
            {
              type: "p",
              text: "Savs domēns, piemēram, www.jusu-uznemums.lv, izskatās profesionālāk nekā standarta adrese un stiprina jūsu zīmolu viesu acīs, kuri vēlas rezervēt tieši pie jums.",
            },
            {
              type: "steps",
              items: [
                "Vietnes redaktorā atveriet sadaļu „Domēns“ un ievadiet vēlamo savu domēnu.",
                "Pie sava domēna sniedzēja iestatiet parādītos DNS ierakstus (parasti CNAME vai A ierakstu).",
                "Nogaidiet, līdz domēns tiek rādīts kā savienots un SSL sertifikāts kā aktīvs — atkarībā no sniedzēja tas var aizņemt vairākas stundas.",
                "Pārbaudiet sava domēna atvēršanu privātā pārlūka logā, lai izslēgtu iepriekš kešatmiņā saglabātus vecos ierakstus.",
                "Pārbaudiet, vai vecās standarta adreses joprojām pāradresē uz jauno domēnu, lai esošās saites nepaliktu neaktīvas.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Mainiet DNS ierakstus tikai tā, kā parādīts — nepareizas vērtības var traucēt jūsu domēna esošos e-pasta iestatījumus. Šaubu gadījumā konsultējieties ar savu domēna sniedzēju, pirms pārrakstāt esošos ierakstus.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Tiešo rezervāciju palielināšana",
          excerpt: "Kā novirzīt vairāk viesu uz savu vietni, nevis portāliem.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "h2",
              text: "Sākuma situācija",
            },
            {
              type: "p",
              text: "Rezervācijas caur pašu vietni jūsu uzņēmumam parasti izmaksā lētāk nekā caur portāliem, jo šeit netiek piemērota portāla komisija. Ar dažiem mērķtiecīgiem pasākumiem palielināsiet tiešo rezervāciju daļu, izmantojot savu vietni kā patstāvīgu kanālu.",
            },
            {
              type: "steps",
              items: [
                "Pārliecinieties, ka visi rezervējamie objekti ir redzami vietnē un aprīkoti ar aktuālām fotogrāfijām un aprakstiem.",
                "Iestatiet vietnei ekskluzīvu atlaidi vai priekšrocību, piemēram, nelielu cenas atlaidi salīdzinājumā ar portāliem.",
                "Ievietojiet savu domēnu rezervācijas apstiprinājumos un saziņā ar viesiem, kuri jau reiz ir rezervējuši.",
                "Regulāri pārbaudiet rezervāciju statistiku, lai laika gaitā vērotu vietnes daļu no visām rezervācijām.",
                "Optimizējiet vietnes ielādes laiku un mobilo attēlojumu, jo lielākā daļa viesu rezervē no viedtālruņa.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Vietnei ekskluzīva priekšrocība darbojas tikai tad, ja viesi vietni vispār atrod — aktīvi norādiet uz to, nevis paļaujieties tikai uz portāliem. Par publicēšanu skatiet [Vietnes aktivizēšana tiešsaistē](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
