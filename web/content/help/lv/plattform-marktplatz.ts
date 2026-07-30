import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Platforma (tirgus)",
  description: "Pārdodiet myNextDays tirgū.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Tirgus",
      articles: [
        {
          slug: "der-marktplatz",
          title: "myNextDays tirgus",
          excerpt: "Globālais myNextDays tirgus ir savs rezervāciju kanāls blakus portāliem un vietnei.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "myNextDays tirgus (/plattform) ir paša myNextDays globālais rezervāciju kanāls — salīdzināms ar Booking vai Airbnb, taču ir daļa no tās pašas platformas. Viesi tur meklē visu pievienoto uzņēmumu objektus un rezervē tieši.",
            },
            { type: "h2", text: "Nevis „tiešais“, bet gan vienlīdzīgs kanāls" },
            {
              type: "p",
              text: "Tirgus neaizstāj tiešo rezervēšanu jūsu pašu vietnē. Tas ir patstāvīgs, trešais pārdošanas veids ar savu redzamības asi, savu viesu bāzi un savu komisiju — tieši tāpat kā portāls, tikai to pārvalda pats myNextDays.",
            },
            { type: "h2", text: "Kā objekti nonāk tirgū" },
            {
              type: "ul",
              items: [
                "Objektam jābūt aktīvam (objekta statuss atļauj pārdošanu).",
                "Tirgus redzamībai jābūt ieslēgtai — atsevišķi no portāliem un vietnes.",
                "Vēlamajam periodam jābūt pieejamībai kalendārā.",
              ],
            },
            { type: "h2", text: "Rezervācijas no tirgus" },
            {
              type: "p",
              text: "Tirgus rezervācija nekavējoties bloķē attiecīgās naktis visos citos kanālos — tāpat kā portāla vai vietnes rezervācija. Tā parādās jūsu kalendārā un rezervācijās kā jebkura cita rezervācija, apzīmēta ar kanālu „Platforma“.",
            },
            {
              type: "note",
              variant: "info",
              text: "Stop-Sell un neaktīvs objekta statuss darbojas visos kanālos un bloķē arī tirgu — neatkarīgi no tirgus redzamības slēdža.",
            },
            {
              type: "p",
              text: "Kā objektu aktivizēt tirgum, lasiet sadaļā [Objekta ievietošana tirgū](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Objekta ievietošana tirgū",
          excerpt: "Tirgus redzamība ir savs slēdzis, atsevišķi no portāliem un vietnes.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Redzamību tirgū pārvaldāt ar savu, atsevišķu slēdzi pie objekta — neatkarīgi no tā, vai tas pats objekts ir redzams arī portālos vai jūsu vietnē.",
            },
            { type: "h2", text: "Kā ievietot objektu tirgū" },
            {
              type: "steps",
              items: [
                "Atveriet objektu sadaļā Objekti.",
                "Pārejiet uz cilni Redzamība.",
                "Aktivizējiet slēdzi Platformas tirgus.",
                "Pārbaudiet, vai objekta statuss ir aktīvs un vai ir kalendāra pieejamība.",
              ],
            },
            { type: "h2", text: "Priekšnosacījums: pilnīgs profils" },
            {
              type: "p",
              text: "Tirgus rāda tikai objektus ar pilnīgiem datiem — jābūt norādītam titulfoto, aprakstam, aprīkojumam un bāzes cenai. Ja trūkst obligāto datu, objekts, neskatoties uz aktivizēto slēdzi, paliek neredzams.",
            },
            {
              type: "ul",
              items: [
                "Vismaz viens titulfoto un apraksts",
                "Aprīkojuma pazīmes no kategorijas saraksta",
                "Ietilpība un bāzes cena norādītajā objekta valūtā",
                "Kalendāra pieejamība vēlamajam periodam",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Noklikšķinot uz Publicēt, myNextDays parasti vienlaikus aktivizē tirgu, portālus un vietni — pēc tam tirgus slēdzi jebkurā laikā varat atkal izslēgt atsevišķi.",
            },
            { type: "h2", text: "Redzamības noņemšana" },
            {
              type: "p",
              text: "Deaktivizējot slēdzi Platformas tirgus, objekts pazūd no tirgus meklēšanas. Jau apstiprinātas rezervācijas tas neietekmē, tās turpinās kā parasti, skatiet [Tirgus komisija](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Tirgus komisija",
          excerpt: "Par katru caur tirgu noslēgtu rezervāciju tiek piemērota tarifā norādītā komisija.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Tāpat kā jebkurā rezervāciju portālā, par rezervācijām, kas noslēgtas caur myNextDays tirgu, tiek piemērota komisija. Tā tiek aprēķināta par katru rezervāciju un ir neatkarīga no jebkādām portālu komisijām.",
            },
            { type: "h2", text: "Kā tiek aprēķināta komisija" },
            {
              type: "p",
              text: "Apjoms tiek noteikts pēc jūsu uzņēmuma tarifā norādītās komisijas. Aktuālo likmi vienmēr atradīsiet sadaļā Konts, apakšsadaļā Norēķini — tur netiek pieņemta vienota vērtība, bet tiek rādīta jūsu tarifam faktiski piemērojamā likme.",
            },
            { type: "h2", text: "Kur redzēt komisiju" },
            {
              type: "steps",
              items: [
                "Izvēlnē atveriet Konts.",
                "Pārejiet uz sadaļu Norēķini.",
                "Atveriet tirgus rezervāciju, lai detalizēti redzētu apgrozījumu un komisiju.",
                "Pārbaudiet komisiju pārskatu par kārtējo norēķinu periodu.",
              ],
            },
            { type: "h2", text: "Atšķirība no portālu komisijām" },
            {
              type: "ul",
              items: [
                "Tirgus komisija attiecas tikai uz rezervācijām caur myNextDays tirgu.",
                "Portālu rezervācijas (Booking, Airbnb un citi) pakļautas attiecīgā portāla nosacījumiem.",
                "Vietnes rezervācijas pakļautas jūsu tarifam noteiktajiem nosacījumiem bez tirgus komisijas.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Komisija tiek automātiski noteikta no jūsu tarifa. Trūkstošs vai neskaidrs tarifs rada skaidru kļūdas paziņojumu, nevis aptuvenu vērtību.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Viesa profils un atsauksmes",
          excerpt: "Tirgus viesiem ir profils ar rezervāciju vēsturi, un viņi var atstāt atsauksmes.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Viesi, kas rezervē caur myNextDays tirgu, izveido savu viesa profilu. Tajā apkopotas viņu rezervācijas, saziņa ar uzņēmumiem un sniegtās atsauksmes — līdzīgi kā portāla viesu kontā.",
            },
            { type: "h2", text: "Ko jūs kā uzņēmums redzat" },
            {
              type: "p",
              text: "Tirgus rezervācijas detaļās atradīsiet viesa profilu ar iepriekšējām uzturēšanās reizēm jūsu uzņēmumā un, ja viesis to atļāvis, publiski redzamām atsauksmēm par citām mītnēm.",
            },
            { type: "h2", text: "Atsauksmes pēc uzturēšanās" },
            {
              type: "steps",
              items: [
                "Pēc izbraukšanas viesis saņem uzaicinājumu sniegt atsauksmi.",
                "Pēc īsas pārbaudes atsauksme parādās objekta lapā tirgū.",
                "Kā uzņēmums varat publiski atbildēt uz katru atsauksmi.",
                "Nevietā esošas vai ļaunprātīgas atsauksmes varat iesniegt pārbaudei, izmantojot Ziņot.",
              ],
            },
            {
              type: "ul",
              items: [
                "Atsauksmes ir saistītas ar faktisku rezervāciju — bez uzturēšanās atsauksmes nav.",
                "Viesis vērtē tīrību, saziņu, atrašanās vietu un cenas atbilstību kvalitātei.",
                "Jūsu atbilde ir redzama visiem tirgus apmeklētājiem.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Labas atsauksmes tieši ietekmē jūsu objekta pozīciju tirgus meklēšanā — reaģējiet uz kritiku savlaicīgi un lietišķi.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Bloķētas personas",
          excerpt: "Uzņēmums var bloķēt viesi, tādējādi liedzot ziņas un rezervācijas.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Ja ar viesi rodas problēmas, jūs kā uzņēmums varat viņu bloķēt. Bloķēta persona vairs nevar jums sūtīt ziņas un vairs nevar izveidot jaunu rezervāciju jūsu uzņēmumā.",
            },
            { type: "h2", text: "Personas bloķēšana" },
            {
              type: "steps",
              items: [
                "Atveriet saziņas vēsturi vai rezervāciju ar attiecīgo viesi.",
                "Noklikšķiniet uz Bloķēt viesi.",
                "Apstipriniet dialoglodziņu — bloķēšana darbojas nekavējoties.",
                "Bloķētā persona pēc tam parādās sadaļā Konts, apakšsadaļā Bloķētas personas.",
              ],
            },
            { type: "h2", text: "Ko bloķēšana dara" },
            {
              type: "ul",
              items: [
                "Viesis vairs nevar sūtīt jaunas ziņas jūsu uzņēmumam.",
                "Viesis vairs nevar izveidot jaunu rezervāciju jūsu uzņēmumā.",
                "Notiekoša rezervācija ar jau apstiprinātu ierašanos nākamo divu nedēļu laikā bloķēšanu neietekmē, lai uzturēšanos varētu regulāri pabeigt.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bloķēšana attiecas tikai uz jūsu uzņēmumu. Citi tirgus uzņēmumi bloķēšanu neredz un tā uz tiem neattiecas.",
            },
            { type: "h2", text: "Bloķēšanas atcelšana" },
            {
              type: "p",
              text: "Atveriet Konts un tur Bloķētas personas. Izvēlieties ierakstu un noklikšķiniet uz Atcelt bloķēšanu — pēc tam viesis atkal var sūtīt ziņas un rezervēt.",
            },
          ],
        },
      ],
    },
  ],
};
