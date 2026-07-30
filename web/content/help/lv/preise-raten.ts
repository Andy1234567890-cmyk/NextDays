import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Cenas un tarifi",
  description: "Tarifu plāni, sezonas cenas un dinamiskās cenas.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Cenu veidošana",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Bāzes cena un valūta",
          excerpt: "Kā noteikt bāzes cenu un piešķirt objektam pareizo valūtu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Katrs objekts myNextDays ir tieši viena rezervējama vienība — viens numurs vai brīvdienu mājoklis. Šai vienībai norādāt bāzes cenu, kā arī centrālu valūtu, kas attiecas uz visu objektu.",
            },
            { type: "h2", text: "Valūtas centrāla noteikšana" },
            {
              type: "p",
              text: "Objekta valūta tiek iestatīta vienreiz katram objektam un automātiski attiecas uz visiem tarifu plāniem, ko izveidojat šim objektam. Nav atsevišķas valūtas noklusējuma vērtības — ja valūtas nav, cenas saglabāt nevar.",
            },
            {
              type: "steps",
              items: [
                "Atveriet savu objektu sadaļā „Objekti“.",
                "Pārejiet uz cilni „Cenas“.",
                "Sadaļā „Objekta valūta“ izvēlieties atbilstošo valūtu.",
                "Ievadiet bāzes cenu standarta ietilpībai.",
                "Saglabājiet izmaiņas.",
              ],
            },
            { type: "h2", text: "Kas notiek, mainot valūtu" },
            {
              type: "p",
              text: "Ja vēlāk mainīsiet objekta valūtu, tas ietekmēs visus esošos šī objekta tarifu plānus, jo tie vienmēr tiek uzturēti objekta valūtā. Pēc tam pārbaudiet savas cenas, pirms tās atkārtoti nosūtāt portāliem.",
            },
            {
              type: "ul",
              items: [
                "Objektam ir tieši viena valūta — nevis vairākas katram tarifu plānam.",
                "Bāzes cena ir sākuma vērtība atvasinātajiem tarifiem.",
                "Summas vienmēr tiek rādītas norādītajā objekta valūtā.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez norādītas valūtas nevar saglabāt nevienu cenu un nevar pārsūtīt nevienu tarifu portāliem. Pārbaudiet to vispirms, ja cenas maiņa neizdodas.",
            },
            {
              type: "note",
              variant: "info",
              text: "Vairāk par atvasinātajām cenām lasiet sadaļā [Atvasinātie tarifi](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Tarifu plānu izveide",
          excerpt: "Tarifu plāni apvieno cenu, anulēšanas nosacījumus un ēdināšanu vienam objektam.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Tarifu plāns definē, ar kādiem nosacījumiem objektu var rezervēt: cenu, anulēšanas noteikumus, ēdināšanu un minimālo uzturēšanos. Objekts var vienlaikus piedāvāt vairākus tarifu plānus, piemēram, elastīgu un neatceļamu plānu.",
            },
            { type: "h2", text: "Jauna tarifu plāna izveide" },
            {
              type: "steps",
              items: [
                "Atveriet objektu un pārejiet uz cilni „Cenas“.",
                "Noklikšķiniet uz „Izveidot jaunu tarifu plānu“.",
                "Piešķiriet saprotamu nosaukumu, piemēram, „Elastīgs“ vai „Neatceļams“.",
                "Nosakiet, vai plāns ir bāzes tarifs vai atvasināts tarifs.",
                "Norādiet anulēšanas nosacījumus un ēdināšanu.",
                "Saglabājiet un aktivizējiet tarifu plānu.",
              ],
            },
            { type: "h2", text: "Bāzes tarifs pret citiem tarifu plāniem" },
            {
              type: "p",
              text: "Vispirms izveidojiet savu bāzes tarifu (bieži saukts arī par „BAR“, Best Available Rate). Visus citus tarifu plānus var vai nu uzturēt patstāvīgi, vai atvasināt no šī bāzes tarifa.",
            },
            {
              type: "ul",
              items: [
                "Bāzes tarifs: manuāli uzturēta pamatcena par nakti.",
                "Citi tarifu plāni: patstāvīgi vai kā uzcenojums/atlaide pret bāzes tarifu.",
                "Katru tarifu plānu var pārsūtīt portāliem atsevišķi.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Uzturiet tarifu plānu skaitu katram objektam pārskatāmu — pārāk daudz variantu apgrūtina viesu salīdzināšanu un palielina uzturēšanas darbu.",
            },
            {
              type: "note",
              variant: "info",
              text: "Detaļas par uzcenojumiem un atlaidēm lasiet sadaļā [Atvasinātie tarifi](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Atvasinātie tarifi",
          excerpt: "Atvasinātie tarifu plāni tiek aprēķināti automātiski no bāzes tarifa.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Atvasinātais tarifs ir tarifu plāns, kura cena netiek uzturēta manuāli, bet tiek automātiski aprēķināta no bāzes tarifa — kā fiksēts uzcenojums, atlaide vai procentuālā daļa. Tas ietaupa uzturēšanas darbu, jo cenas izmaiņa bāzes tarifā automātiski atjaunina visus atvasinātos plānus.",
            },
            { type: "h2", text: "Tipisks piemērs" },
            {
              type: "p",
              text: "Bieži izmantots modelis ir plāns ar brokastīm, kas atvasināts no bāzes tarifa bez ēdināšanas: brokastu cena tiek definēta kā uzcenojums par nakti un personu pret bāzes tarifu. Mainot bāzes tarifu, brokastu cena pielāgojas automātiski.",
            },
            { type: "h2", text: "Atvasinātā tarifa izveide" },
            {
              type: "steps",
              items: [
                "Atveriet vēlamo tarifu plānu cilnē „Cenas“.",
                "Kā cenas avotu izvēlieties „Atvasināts no…“ un attiecīgo bāzes tarifu.",
                "Nosakiet, vai starpība ir fiksēta summa vai procentuālā daļa.",
                "Nosakiet, vai tas ir uzcenojums vai atlaide.",
                "Saglabājiet piesaisti.",
              ],
            },
            {
              type: "ul",
              items: [
                "Uzcenojums: piem., ēdināšana, vēlāka anulēšanas iespēja.",
                "Atlaide: piem., neatceļams plāns ar cenas priekšrocību.",
                "Bāzes tarifs paliek vienīgais manuāli uzturētais avots.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Atvasinātu tarifu nevar vienlaikus manuāli pārrakstīt. Ja vēlaties noteikt atsevišķu cenu ar atšķirīgu vērtību, vispirms atceliet atvasinājumu.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Sezonas un nedēļas nogales cenas",
          excerpt: "Mērķtiecīgi pielāgojiet cenas sezonas periodiem un nedēļas nogalēm.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Pieprasījums svārstās gan gada, gan nedēļas ietvaros. Ar sezonas un nedēļas nogales cenām pielāgojat bāzes cenu noteiktiem periodiem vai nedēļas dienām, neejot kalendārā katrai dienai atsevišķi.",
            },
            { type: "h2", text: "Sezonas perioda izveide" },
            {
              type: "steps",
              items: [
                "Objektā atveriet cilni „Cenas“ un sadaļu „Sezonas cenas“.",
                "Izveidojiet jaunu periodu ar sākuma un beigu datumu.",
                "Norādiet cenu vai procentuālo novirzi no bāzes cenas šim periodam.",
                "Saglabājiet sezonas periodu.",
              ],
            },
            { type: "h2", text: "Nedēļas nogales cenas" },
            {
              type: "p",
              text: "Papildus varat noteiktām nedēļas dienām, piemēram, piektdienai un sestdienai, piemērot savu uzcenojumu. Šis uzcenojums darbojas papildus attiecīgi spēkā esošajai sezonas vai bāzes cenai.",
            },
            {
              type: "ul",
              items: [
                "Sezonas cenas darbojas saistītos periodos.",
                "Nedēļas nogales cenas darbojas pa nedēļas dienām, neatkarīgi no sezonas.",
                "Abus noteikumus var kombinēt.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ja pārklājas vairāki sezonas periodi, ir spēkā pēdējais izveidotais vai visspecifiskākais noteikums. Pēc saglabāšanas pārbaudiet kalendāru.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Automātiskiem, uz pieprasījumu balstītiem pielāgojumiem papildus noder [Dinamiskās cenas](/hilfe/preise-raten/dynamische-preise).",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Dinamiskās cenas",
          excerpt: "Automātiski pielāgojiet cenas pieprasījumam, laika rezervei un noslogojumam.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Dinamiskās cenas automātiski pielāgo bāzes cenu, ņemot vērā tādus faktorus kā rezervēšanas apsteidzošais laiks, pašreizējais noslogojums un pieprasījums — līdzīgi kā to dara lielie portāli savos cenu ieteikumos. Tā jūs reaģējat uz tirgus izmaiņām, katru dienu manuāli nepielāgojot.",
            },
            { type: "h2", text: "Dinamisko cenu aktivizēšana" },
            {
              type: "steps",
              items: [
                "Objektā atveriet cilni „Cenas“ un sadaļu „Dinamiskās cenas“.",
                "Aktivizējiet funkciju objekta bāzes tarifam.",
                "Nosakiet cenas apakšējo un augšējo robežu.",
                "Nosakiet, cik lielā mērā noslogojums drīkst ietekmēt cenu.",
                "Saglabājiet iestatījumus.",
              ],
            },
            { type: "h2", text: "Robežas un drošība" },
            {
              type: "p",
              text: "Cenas apakšējā un augšējā robeža novērš, ka automātiskais algoritms nosaka jūsu uzņēmumam nepieņemamas cenas. Atvasinātie tarifu plāni automātiski seko dinamiski aprēķinātajam bāzes tarifam.",
            },
            {
              type: "ul",
              items: [
                "Cenas apakšējā robeža aizsargā pret pārāk zemām cenām vāja pieprasījuma apstākļos.",
                "Cenas augšējā robeža aizsargā pret pārmērīgām cenām augsta pieprasījuma apstākļos.",
                "Atvasinātie tarifi automātiski pārņem jauno bāzes tarifu.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dinamiskās cenas darbojas tikai uz bāzes tarifu. Manuāli fiksēti tarifu plāni bez atvasinājuma automātiski nemainās.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Uzturēšanās atlaides",
          excerpt: "Iestatiet atlaides ilgākiem uzturēšanās periodiem un agrīnām rezervācijām.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Uzturēšanās atlaides atalgo viesus par ilgākām rezervācijām vai agrīnu rezervēšanu. Tās tiek piemērotas kā procentuālā daļa no kopējās uzturēšanās cenas un tiek konfigurētas neatkarīgi katram objektam.",
            },
            { type: "h2", text: "Atlaižu veidi" },
            {
              type: "ul",
              items: [
                "Ilgtermiņa atlaide: sākot no noteikta nakšu skaita, piemēram, no 7 vai 28 naktīm.",
                "Agrīnas rezervēšanas atlaide: rezervējot pietiekami savlaicīgi.",
                "Pēdējā brīža atlaide: rezervējot īsi pirms ierašanās datuma.",
              ],
            },
            { type: "h2", text: "Atlaides iestatīšana" },
            {
              type: "steps",
              items: [
                "Objektā atveriet cilni „Cenas“ un sadaļu „Atlaides“.",
                "Izvēlieties vēlamo atlaides veidu.",
                "Nosakiet slieksni, piemēram, minimālo nakšu skaitu vai apsteidzošo laiku.",
                "Ievadiet atlaidi procentos.",
                "Saglabājiet noteikumu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Atlaides darbojas uz attiecīgā tarifu plāna kopējo cenu un tiek parādītas viesim jau cenu pārskatā.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombinējiet ilgtermiņa atlaides ar [Minimālā un maksimālā uzturēšanās](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt), lai mērķtiecīgi veicinātu ilgākas rezervācijas.",
            },
          ],
        },
      ],
    },
  ],
};
