import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Kalendārs un pieejamība",
  description: "Aizņemtības plāns, Stop-Sell un minimālā uzturēšanās.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kalendārs",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Aizņemtības plāna lasīšana",
          excerpt: "Kā pareizi lasīt rezervācijas, pieejamību un cenas aizņemtības plānā.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Aizņemtības plāns vienā skatienā parāda, kuras naktis ir rezervētas, pieejamas vai bloķētas. Brīvdienu mājokļiem redzat vienu rindu katram objektam, viesnīcām — sazarotu skatu ar rindu katrai numuru kategorijai un tarifu plānam.",
            },
            { type: "h2", text: "Skata uzbūve" },
            {
              type: "steps",
              items: [
                "Atveriet kalendāru izvēlnes punktā „Aizņemtības plāns“.",
                "Augšpusē izvēlieties vēlamo periodu.",
                "Pēc vajadzības filtrējiet pēc atsevišķiem objektiem vai numuru kategorijām.",
                "Noklikšķiniet uz dienas, lai atvērtu cenas un pieejamības detaļas.",
                "Noklikšķiniet uz aizņemta perioda, lai atvērtu saistīto rezervāciju.",
              ],
            },
            { type: "h2", text: "Krāsas un simboli" },
            {
              type: "ul",
              items: [
                "Aizņemts: periods ir rezervēts ar rezervāciju.",
                "Pieejams: dienu var rezervēt visos aktīvajos kanālos.",
                "Bloķēts: diena nav rezervējama Stop-Sell vai manuālas bloķēšanas dēļ.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Katra rinda aizņemtības plānā apzīmē tieši vienu rezervējamu vienību — numuru vai brīvdienu mājokli. Nav konteinera rindas vairākiem numuriem vienlaikus.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Vairāk par mērķtiecīgu atsevišķu dienu atvēršanu un slēgšanu lasiet sadaļā [Pieejamības iestatīšana](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Pieejamības iestatīšana",
          excerpt: "Mērķtiecīgi atveriet un aizveriet atsevišķas dienas vai periodus.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Pieejamība nosaka, vai objektu var rezervēt konkrētā dienā. Varat atvērt vai aizvērt atsevišķas dienas vai veselus periodus tieši aizņemtības plānā.",
            },
            { type: "h2", text: "Perioda rediģēšana" },
            {
              type: "steps",
              items: [
                "Atveriet vēlamā objekta aizņemtības plānu.",
                "Atzīmējiet vēlamo periodu, noklikšķinot un velkot.",
                "Darbību izvēlnē izvēlieties „Mainīt pieejamību“.",
                "Apstipriniet, vai periods jāatver vai jāaizver.",
                "Saglabājiet izmaiņas.",
              ],
            },
            { type: "h2", text: "Ietekme uz kanāliem" },
            {
              type: "p",
              text: "Pieejamības izmaiņas ietekmē visus pārdošanas kanālus, kuros objekts ir redzams: portālus, piemēram, Booking, Airbnb un citus, pašu platformu, kā arī lietotni. Pārsūtīšana uz portāliem notiek automātiski fonā.",
            },
            {
              type: "ul",
              items: [
                "Atvēršana: diena kļūst rezervējama visos aktīvajos kanālos.",
                "Aizvēršana: diena vairs nav rezervējama, bet paliek redzama kalendārā.",
                "Jau esošās rezervācijas pieejamības izmaiņas neietekmē.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Nesledziet periodu ar nolūku to pilnībā un pastāvīgi izslēgt no pārdošanas — tam paredzēta funkcija Stop-Sell, skatiet [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-Sell",
          excerpt: "Stop-Sell nekavējoties bloķē dienu visos pārdošanas kanālos vienlaikus.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Stop-Sell ir ātrākais veids, kā vienu dienu pilnībā izņemt no pārdošanas. Atšķirībā no vienkāršas pieejamības izmaiņas, Stop-Sell darbojas stingri un nekavējoties visos kanālos vienlaikus — portālos, pašu platformā un lietotnē.",
            },
            { type: "h2", text: "Stop-Sell iestatīšana" },
            {
              type: "steps",
              items: [
                "Atveriet skartā objekta aizņemtības plānu.",
                "Izvēlieties vēlamo dienu vai periodu.",
                "Darbību izvēlnē noklikšķiniet uz „Aktivizēt Stop-Sell“.",
                "Apstipriniet bloķēšanu.",
              ],
            },
            { type: "h2", text: "Kad Stop-Sell ir noderīgs" },
            {
              type: "ul",
              items: [
                "Īslaicīgi apkopes darbi vai tehniskas problēmas objektā.",
                "Īpašs gadījums, kad vēlaties nekavējoties un bez izņēmuma nevienu jaunu rezervāciju.",
                "Ātra, visai platformai kopēja avārijas bloķēšana, neapstrādājot katru kanālu atsevišķi.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell neparedz kanāla specifisku izņēmumu: ja diena ir bloķēta, neviens viesis nevar rezervēt nevienā kanālā, arī ne caur reģistratūru vai tiešu pieprasījumu.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ilgstošai pašu izmantošanai vai plānotai apkopei labāk piemērota [Manuālā bloķēšana](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung).",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Minimālā un maksimālā uzturēšanās",
          excerpt: "Cik ilgi viesi drīkst rezervēt vismaz vai ne vairāk kā.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Ar minimālo un maksimālo uzturēšanos nosakāt, cik naktis viesis konkrētā ierašanās dienā drīkst rezervēt vismaz vai ne vairāk kā. Tas palīdz izvairīties no īsām starpu rezervācijām vai mērķtiecīgi pozicionēt objektu ilgākām uzturēšanās reizēm.",
            },
            { type: "h2", text: "Noteikuma iestatīšana" },
            {
              type: "steps",
              items: [
                "Objektā atveriet aizņemtības plānu vai cilni „Cenas“.",
                "Izvēlieties skarto periodu.",
                "Sadaļā „Minimālā uzturēšanās“ ievadiet minimālo nakšu skaitu.",
                "Pēc izvēles sadaļā „Maksimālā uzturēšanās“ ievadiet maksimālo nakšu skaitu.",
                "Saglabājiet noteikumu.",
              ],
            },
            { type: "h2", text: "Tipiski pielietojuma gadījumi" },
            {
              type: "ul",
              items: [
                "Augstā sezona: augstāka minimālā uzturēšanās, lai apvienotu maiņas dienas.",
                "Zemā sezona: zemāka minimālā uzturēšanās, lai ļautu vairāk rezervāciju.",
                "Maksimālā uzturēšanās: noderīga, ja objektam pēc tam jābūt brīvam apkopei vai citam pielietojumam.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Noteikums attiecas uz ierašanās dienu: viesis ar minimālo uzturēšanos trīs naktis nevar ierasties tikai uz divām naktīm pat tad, ja atsevišķas dienas ir pieejamas.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombinējiet ilgāku minimālo uzturēšanos ar [Uzturēšanās atlaides](/hilfe/preise-raten/aufenthaltsrabatte), lai palielinātu stimulu viesiem.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Manuālā bloķēšana",
          excerpt: "Mērķtiecīgi rezervējiet periodus pašu izmantošanai vai apkopei.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Manuāla bloķēšana rezervē periodu kalendārā bez faktiskas viesu rezervācijas — piemēram, pašu izmantošanai, plānotiem apkopes darbiem vai renovācijām. Periods aizņemtības plānā tiek attēlots kā rezervācija, taču skaidri atpazīstams kā bloķējums.",
            },
            { type: "h2", text: "Bloķējuma izveide" },
            {
              type: "steps",
              items: [
                "Atveriet skartā objekta aizņemtības plānu.",
                "Atzīmējiet vēlamo periodu.",
                "Darbību izvēlnē izvēlieties „Manuāli bloķēt“.",
                "Norādiet iemeslu, piemēram, „Pašu izmantošana“ vai „Apkope“.",
                "Saglabājiet bloķējumu.",
              ],
            },
            { type: "h2", text: "Atšķirība no Stop-Sell" },
            {
              type: "p",
              text: "Manuāla bloķēšana konkrēti rezervē periodu noteiktam, dokumentētam mērķim, un to vēlāk var atkal atbrīvot. Nekavējošai, visai platformai kopējai avārijas bloķēšanai bez dokumentēta perioda ir paredzēts Stop-Sell.",
            },
            {
              type: "ul",
              items: [
                "Manuāla bloķēšana: plānota, ar iemeslu, pašu izmantošanai vai apkopei.",
                "Atbrīvošana iespējama jebkurā laikā, tiklīdz periods vairs nav nepieciešams.",
                "Bloķētās naktis netiek skaitītas kā viesu rezervācija un neparādās apgrozījuma pārskatā.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dzēsiet manuālu bloķējumu, tiklīdz iemesls vairs nav aktuāls — pretējā gadījumā objekts nevajadzīgi paliek bloķēts visos kanālos.",
            },
            {
              type: "note",
              variant: "info",
              text: "Nekavējošai bloķēšanai bez plānota perioda izmantojiet [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
