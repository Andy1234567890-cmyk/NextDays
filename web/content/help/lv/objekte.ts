import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Objekti un aprīkojums",
  description: "Numuru un brīvdienu mājokļu izveide un uzturēšana.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Objektu pārvaldība",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Objekts = viena rezervējama vienība",
          excerpt: "Kāpēc katrs objekts myNextDays ir tieši viena rezervējama vienība.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "myNextDays objekts vienmēr ir tieši viena rezervējama vienība — viens numurs viesnīcā vai pilns brīvdienu mājoklis. Šis princips ir spēkā neatkarīgi no tā, vai pārvaldāt brīvdienu māju, brīvdienu dzīvokli vai viesnīcu, un tas ir pamats pieejamībai, cenām un rezervācijām.",
            },
            { type: "h2", text: "Nevis ēka ar numuriem zem tās" },
            {
              type: "p",
              text: "Bieža nepareiza izpratne ir attēlot viesnīcas ēku kā vienu objektu ar vairākiem numuriem zem tā. myNextDays tas nav paredzēts. Ja, piemēram, pārvaldāt viesnīcu ar astoņiem divvietīgiem numuriem un četriem vienvietīgiem numuriem, izveidojiet divpadsmit atsevišķus objektus — nevis vienu objektu ar numuru skaitu.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Objekta līmenī apzināti nav lauka „numuru skaits“. Katram numuram vajadzīgs savs objekts ar savu kalendāru un cenām.",
            },
            { type: "h2", text: "Brīvdienu mājokļi" },
            {
              type: "p",
              text: "Brīvdienu mājas vai brīvdienu dzīvokļa gadījumā viss objekts atbilst rezervējamai vienībai. Šeit nav papildu sadalījuma — brīvdienu mājoklis vienmēr ir patstāvīgs objekts ar savu kalendāru.",
            },
            { type: "h2", text: "Kāpēc tas ir svarīgi" },
            {
              type: "ul",
              items: [
                "Katram objektam ir savs pieejamības kalendārs — dubultrezervācijas tiek novērstas precīzi pa objektiem.",
                "Cenas, aprīkojums un fotogrāfijas attiecas uz vienu objektu, nevis uz ēku.",
                "Objekts vienmēr pieder tieši vienam īpašniekam — bez vairākkārtējas piesaistes.",
                "Kanāla redzamību (vietne, platformas tirgus, portāli) pārvalda katram objektam atsevišķi.",
              ],
            },
            {
              type: "p",
              text: "Kā izvēlēties piemērotu objekta tipu savam numuram vai brīvdienu mājoklim, lasiet sadaļā [Objekta tipa noteikšana](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Objekta tipa noteikšana",
          excerpt: "Pareizi piešķiriet kategoriju, nekustamā īpašuma tipu un piedāvājuma veidu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Objekta tips nosaka, kā jūsu objekts tiek klasificēts un filtrēts portālos un platformas tirgū. To veido trīs secīgi izvēles lauki, kurus izejat, izveidojot vai rediģējot objektu.",
            },
            { type: "h2", text: "Trīs izvēles līmeņi" },
            {
              type: "steps",
              items: [
                "Vispirms izvēlieties kategoriju — piemēram, brīvdienu mājoklis vai viesnīca.",
                "Uz tā pamata izvēlieties nekustamā īpašuma tipu — piemēram, brīvdienu dzīvoklis, brīvdienu māja, divvietīgs numurs vai vienvietīgs numurs.",
                "Izvēlieties piedāvājuma veidu — piemēram, visu objektu vai privātu numuru.",
                "Papildiniet atkarībā no izvēles parādītos papildu laukus, piemēram, gultas tipu vai stāvu.",
              ],
            },
            { type: "h2", text: "Kāpēc secība ir svarīga" },
            {
              type: "p",
              text: "Šie trīs nolaižamie saraksti ir savstarpēji atkarīgi: kategorijas izvēle ierobežo pieejamos nekustamā īpašuma tipus, savukārt nekustamā īpašuma tipa izvēle — piedāvājuma veidus. Tā rodas tikai jēgpilnas kombinācijas, kādas izmanto arī lielie portāli.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ja vēlāk mainīsiet kategoriju, myNextDays pārbaudīs, vai nekustamā īpašuma tips un piedāvājuma veids joprojām atbilst, un pēc vajadzības pieprasīs jaunu izvēli.",
            },
            { type: "h2", text: "Objekta tipa rediģēšana" },
            {
              type: "p",
              text: "Izvēlnē Objekti atveriet vēlamo objektu un pārejiet uz cilni Pamatdati. Tur cilnē Objekta tips atradīsiet trīs nolaižamos sarakstus. Saglabājot izmaiņas, jaunā klasifikācija tiks nodota visiem aktīvajiem kanāliem.",
            },
            {
              type: "ul",
              items: [
                "Kategorija: vispārīga klasifikācija (piem., brīvdienu mājoklis, viesnīca)",
                "Nekustamā īpašuma tips: konkrēts objekta tips (piem., brīvdienu dzīvoklis, divvietīgs numurs)",
                "Piedāvājuma veids: kas tieši tiek rezervēts (piem., viss objekts, privāts numurs)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Aprīkojuma uzturēšana",
          excerpt: "Izvēlieties aprīkojuma pazīmes un uzturiet tās aktuālas.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Objekta aprīkojums būtiski ietekmē, cik labi to var atrast un filtrēt portālos. Viesi mērķtiecīgi filtrē pēc tādām pazīmēm kā Wi-Fi, virtuve vai autostāvvieta — trūkstoša informācija var izslēgt objektu no meklēšanas rezultātiem.",
            },
            { type: "h2", text: "Aprīkojuma izvēle" },
            {
              type: "steps",
              items: [
                "Atveriet objektu un pārejiet uz cilni Aprīkojums.",
                "Izvēlieties visas atbilstošās pazīmes no dotā saraksta.",
                "Pēc vajadzības papildiniet detaļas, piemēram, autostāvvietu skaitu vai virtuves veidu.",
                "Saglabājiet izmaiņas — tās automātiski tiek nosūtītas visiem aktīvajiem portāliem.",
              ],
            },
            { type: "h2", text: "No kurienes nāk pazīmes" },
            {
              type: "p",
              text: "Aprīkojuma saraksts atbilst lielo portālu pazīmju katalogam, lai jūsu dati tur tiktu pareizi klasificēti. Pašu, brīvi izdomātas pazīmes nav paredzētas, jo tās nevarētu pareizi pārsūtīt portāliem.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Pārbaudiet aprīkojumu pēc katras būtiskas izmaiņas — piemēram, jaunas kondicionēšanas iekārtas vai papildu vannasistabas — lai dati visos kanālos paliktu aktuāli.",
            },
            { type: "h2", text: "Biežākās pazīmju grupas" },
            {
              type: "ul",
              items: [
                "Pamataprīkojums: Wi-Fi, apkure, kondicionieris",
                "Virtuve un ēdināšana: pilnībā aprīkota virtuve, trauku mazgājamā mašīna, kafijas automāts",
                "Vannasistaba un veļa: sava vannasistaba, veļas mazgājamā mašīna, dvieļi",
                "Ārtelpas: balkons, terase, dārzs, autostāvvieta",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Fotogrāfijas un apraksts",
          excerpt: "Iedarbīgi attēli un teksti vairāk rezervāciju iegūšanai.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Fotogrāfijas un apraksts viesiem ir svarīgākais lēmuma pieņemšanas pamats. Objektu var publicēt tikai tad, kad ir norādīts vismaz viens titulfoto un apraksts.",
            },
            { type: "h2", text: "Fotogrāfiju augšupielāde" },
            {
              type: "steps",
              items: [
                "Atveriet objektu un pārejiet uz cilni Fotogrāfijas.",
                "Ievelciet attēlu failus augšupielādes zonā vai izvēlieties tos ar faila dialogu.",
                "Nosakiet titulfoto — tas parādīsies meklēšanas rezultātos un kartītēs.",
                "Sakārtojiet pārējās fotogrāfijas, velkot tās jēgpilnā secībā.",
              ],
            },
            { type: "h2", text: "Apraksta rakstīšana" },
            {
              type: "p",
              text: "Pārejiet uz cilni Apraksts un ierakstiet virsrakstu, kā arī pamattekstu. Konkrēti aprakstiet objekta atrašanās vietu, īpašības un mērķauditoriju — vispārīgas frāzes portālos iedarbojas mazāk pārliecinoši nekā taustāmas detaļas.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Citu objektu vai no interneta ņemtas fotogrāfijas nedrīkst izmantot — portāli to pārbauda un pārkāpumu gadījumā var bloķēt objektus.",
            },
            { type: "h2", text: "Ieteikumi labām fotogrāfijām" },
            {
              type: "ul",
              items: [
                "Vismaz piecas fotogrāfijas, ideālā gadījumā pa vienai katrai telpai",
                "Ainavas orientācija, laba apgaismojuma kvalitāte, bez ūdenszīmēm",
                "Titulfoto attēlo objektu pēc iespējas aicinošāk un skaidri",
                "Regulāri atjaunināt, īpaši pēc renovācijām",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Ietilpība un kapacitāte",
          excerpt: "Pareizi norādiet maksimālo viesu skaitu un gultu sadalījumu.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Ietilpība nosaka, cik viesus objekts var uzņemt, un tiek pārbaudīta katrā meklēšanā un rezervācijā. Nepareizi dati izraisa vai nu noraidītus pieprasījumus, vai pārpildi — no abām lietām vajadzētu izvairīties.",
            },
            { type: "h2", text: "Ietilpības ievadīšana" },
            {
              type: "steps",
              items: [
                "Atveriet objektu un pārejiet uz cilni Ietilpība.",
                "Ievadiet maksimālo pieaugušo skaitu.",
                "Ievadiet maksimālo bērnu skaitu, ja tie ir atļauti.",
                "Norādiet gultu sadalījumu pa telpām, piemēram, viena divguļamā gulta un divas vienguļamās gultas.",
              ],
            },
            { type: "h2", text: "Ietilpības ierobežojumi" },
            {
              type: "p",
              text: "Rezervācijas pieprasījuma gadījumā myNextDays automātiski pārbauda, vai pieprasītais viesu skaits atbilst norādītajai ietilpībai. Pieprasījumi, kas pārsniedz maksimālo kapacitāti, tiek noraidīti vai vispār netiek rādīti kā rezervējami.",
            },
            {
              type: "note",
              variant: "info",
              text: "Papildu gulta vai bērna gultiņa reālo kapacitāti palielina tikai tad, ja to tieši norādāt gultu sadalījumā — pretējā gadījumā maksimālais viesu skaits paliek nemainīgs.",
            },
            { type: "h2", text: "Tipiskas kļūdu avoti" },
            {
              type: "ul",
              items: [
                "Maksimālais viesu skaits noteikts pārāk augsts, lai gan gultu ir maz",
                "Aizmirsts bērnu skaits, lai gan objekts ir domāts ģimenēm",
                "Gultu sadalījums nav atjaunināts pēc renovācijas",
              ],
            },
            {
              type: "p",
              text: "Ja ietilpība un aprīkojums neatbilst viens otram, papildus pārbaudiet cilni [Aprīkojums](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Objekta statuss un redzamība",
          excerpt: "Atšķirība starp aktīvs/neaktīvs un trim kanālu asīm.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "myNextDays izšķir divas dažādas lietas, kuras bieži tiek sajauktas: objekta statuss (aktīvs vai neaktīvs) un redzamība atsevišķos pārdošanas kanālos. Abus pārvaldāt atsevišķi vienu no otra.",
            },
            { type: "h2", text: "Objekta statuss" },
            {
              type: "p",
              text: "Statuss active nozīmē, ka objekts principā ir pārdodams. Statuss inactive pilnībā izslēdz objektu no darbības — piemēram, ilgstošas renovācijas laikā. Neaktīvs objekts nav rezervējams nevienā kanālā, neatkarīgi no kanālu slēdžiem.",
            },
            { type: "h2", text: "Trīs kanālu asis" },
            {
              type: "p",
              text: "Ja objekts ir aktīvs, trīs neatkarīgi slēdži nosaka, kur tieši tas ir redzams:",
            },
            {
              type: "ul",
              items: [
                "Vietne — redzamība jūsu pašu myNextDays vietnē",
                "Platformas tirgus — redzamība globālajā myNextDays tirgū",
                "Portāli — redzamība Booking, Airbnb un citos",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Šīs trīs asis ir pilnībā neatkarīgas no objekta statusa un cita no citas. Aktīvs objekts, piemēram, var būt redzams tikai vietnē, bet ne portālos.",
            },
            { type: "h2", text: "Statusa maiņa" },
            {
              type: "steps",
              items: [
                "Atveriet objektu un pārejiet uz cilni Pārskats.",
                "Iestatiet statusu uz aktīvs vai neaktīvs.",
                "Pēc vajadzības papildus pielāgojiet trīs kanālu slēdžus cilnē Redzamība.",
                "Saglabājiet izmaiņas — tās nekavējoties darbojas visos skartajos kanālos.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Īslaicīgai atsevišķu dienu bloķēšanai izmantojiet Stop-Sell kalendārā — tas mērķtiecīgi bloķē dienas visos kanālos, neizslēdzot visu objektu.",
            },
          ],
        },
      ],
    },
  ],
};
