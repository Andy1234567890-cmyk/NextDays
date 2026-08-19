import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Vietnes konstruktors",
  description: "Izveidojiet savu rezervāciju vietni ar konstruktoru.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Vietnes konstruktors",
      articles: [
        {
          slug: "website-erstellen",
          title: "Vietnes izveide",
          excerpt: "Ar konstruktoru dažu minūšu laikā izveidojat savu rezervāciju vietni.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Vietnes konstruktors izveido jums pašu rezervāciju vietni — papildu pārdošanas kanālu blakus portāliem un myBestDays tirgum. Jūs saglabājat pilnu kontroli pār struktūru, saturu un zīmola noformējumu.",
            },
            { type: "h2", text: "Kā izveidot vietni" },
            {
              type: "steps",
              items: [
                "Izvēlnē atveriet Vietne.",
                "Noklikšķiniet uz Izveidot vietni.",
                "Izvēlieties veidni kā izejas punktu jūsu izkārtojumam.",
                "Apstipriniet ar Izveidot vietni — nonāksiet tieši redaktorā.",
              ],
            },
            { type: "h2", text: "Ko satur konstruktors" },
            {
              type: "ul",
              items: [
                "Vizuālu redaktoru ar lapām, slāņiem un priekšskatījuma skatu",
                "Sagatavotus blokus objektu sarakstiem, galerijām un kontaktformām",
                "Tiešu rezervēšanas plūsmu, kas balstīta uz jūsu kalendāra pieejamību",
                "Pielāgojamas krāsas, fontus un logotipu, kas atbilst jūsu zīmolam",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Sāciet ar veidni, kas ir tuvu jūsu objekta veidam — brīvdienu mājoklim vai viesnīcai — tas vēlāk ietaupīs laiku, pielāgojot blokus.",
            },
            { type: "h2", text: "Nākamie soļi" },
            {
              type: "p",
              text: "Pēc izveides pielāgojiet lapas un izkārtojumu, skatiet [Lapu un izkārtojuma rediģēšana](/hilfe/website/seiten-layout), un parādiet savus objektus vietnē, skatiet [Objektu rādīšana vietnē](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Lapu un izkārtojuma rediģēšana",
          excerpt: "Pielāgojiet lapas, slāņus un blokus vizuālajā redaktorā.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Redaktors ir sadalīts trīs daļās: pa kreisi lapu un slāņu pārskats, vidū jūsu vietnes priekšskatījums, pa labi izvēlētā bloka iestatījumi.",
            },
            { type: "h2", text: "Lapas rediģēšana" },
            {
              type: "steps",
              items: [
                "Pa kreisi sadaļā Lapas izvēlieties vēlamo lapu.",
                "Priekšskatījumā noklikšķiniet uz bloka, lai to izvēlētos.",
                "Pa labi pielāgojiet bloka tekstu, attēlu vai atstarpi.",
                "Velciet blokus, lai mainītu to secību.",
              ],
            },
            { type: "h2", text: "Jaunu lapu un bloku pievienošana" },
            {
              type: "p",
              text: "Ar pogu Pievienot lapu izveidojat papildu apakšlapas, piemēram, Par mums vai Kontakti. Lapas ietvaros ar Pievienot bloku ievietojat jaunas sadaļas, piemēram, galeriju, atsauksmes vai kontaktformu.",
            },
            {
              type: "ul",
              items: [
                "Sākumlapa, objektu pārskats un kontakti ir iepriekš iestatīti katrā veidnē",
                "Citas lapas var brīvi nosaukt un iekļaut navigācijā",
                "Bloki ir responsīvi un pielāgojas datoram, planšetei un viedtālrunim",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Izmaiņas redaktorā sākotnēji ir tikai melnraksts. Tikai noklikšķinot uz Publicēt, tās tiek pārnestas uz jūsu publisko vietni.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Domēna savienošana",
          excerpt: "Savienojiet savu domēnu ar myNextDays vietni.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Pēc noklusējuma jūsu vietne ir pieejama, izmantojot myNextDays apakšdomēnu. Ja tā vietā vēlaties izmantot savu domēnu, piemēram, jusu-uznemums.lv, savienojiet to sadaļā Domēns.",
            },
            { type: "h2", text: "Domēna norādīšana" },
            {
              type: "steps",
              items: [
                "Vietnes iestatījumos atveriet Domēns.",
                "Ievadiet savu domēnu un noklikšķiniet uz Savienot.",
                "Pie sava domēna sniedzēja izveidojiet parādītos DNS ierakstus.",
                "Nogaidiet apstiprinājumu — pārbaude notiek automātiski fonā.",
              ],
            },
            { type: "h2", text: "DNS ierakstu pareiza iestatīšana" },
            {
              type: "p",
              text: "myNextDays rāda jūsu domēna sniedzējam tieši nepieciešamos ierakstus. Savienojums kļūst aktīvs tikai tad, kad šie ieraksti ir pareizi iestatīti un izplatījušies visā pasaulē — atkarībā no sniedzēja tas var aizņemt vairākas stundas.",
            },
            {
              type: "ul",
              items: [
                "Iestatīt CNAME vai A ierakstu saskaņā ar parādīto instrukciju",
                "Iepriekš noņemt esošus, pretrunīgus ierakstus tam pašam domēnam",
                "https sertifikāts tiek automātiski izsniegts pēc veiksmīga savienojuma",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez pareizi iestatītiem DNS ierakstiem jūsu vietne ar savu domēnu nebūs pieejama — rūpīgi pārbaudiet rakstību pret sava sniedzēja datiem.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Objektu rādīšana vietnē",
          excerpt: "Kuri objekti ir redzami un rezervējami vietnē, pārvaldāt atsevišķi katram objektam.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Lai objekts parādītos jūsu vietnē, jābūt ieslēgtai vietnes redzamībai šim objektam. Šis slēdzis nav atkarīgs no redzamības myBestDays tirgū vai portālos.",
            },
            { type: "h2", text: "Objekta aktivizēšana vietnei" },
            {
              type: "steps",
              items: [
                "Atveriet objektu sadaļā Objekti.",
                "Pārejiet uz cilni Redzamība.",
                "Aktivizējiet slēdzi Vietne.",
                "Pārejiet uz Vietne un priekšskatījumā pārbaudiet bloku Objektu pārskats.",
              ],
            },
            { type: "h2", text: "Secības un attēlojuma pielāgošana" },
            {
              type: "p",
              text: "Blokā Objektu pārskats nosakāt, vai objekti tiek automātiski šķiroti pēc pieejamības vai jūs nosakāt fiksētu secību. Katrs objekts rāda titulfoto, bāzes cenu norādītajā valūtā un galvenās aprīkojuma pazīmes.",
            },
            {
              type: "ul",
              items: [
                "Automātiska šķirošana pēc pieejamības vai manuāla secība",
                "Filtri pēc objekta tipa vai aprīkojuma, iespējams aktivizēt pēc izvēles",
                "Rezervēšanas soļi notiek tieši vietnē, bez portāla apkārtceļa",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Objekts bez aktivizētas vietnes redzamības paliek paslēpts no objektu pārskata, pat ja tas redzams tirgū vai portālos.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Vietnes publicēšana",
          excerpt: "Melnraksti kļūst publiski redzami tikai pēc noklikšķināšanas uz Publicēt.",
          updated: "Atjaunināts: 2026. gada jūlijs",
          body: [
            {
              type: "p",
              text: "Kamēr strādājat redaktorā, tikai jūs redzat pašreizējo melnrakstu. Tikai noklikšķinot uz Publicēt, izmaiņas kļūst redzamas visiem apmeklētājiem jūsu domēnā.",
            },
            { type: "h2", text: "Kā publicēt" },
            {
              type: "steps",
              items: [
                "Redaktorā atveriet priekšskatījumu un pārbaudiet visas lapas.",
                "Augšpusē pa labi noklikšķiniet uz Publicēt.",
                "Apstipriniet dialoglodziņu — vietne kļūst tiešsaistē uzreiz pēc tam.",
                "Atveriet savu domēnu jaunā cilnē, lai pārbaudītu rezultātu.",
              ],
            },
            { type: "h2", text: "Melnraksti un atgriešana" },
            {
              type: "p",
              text: "Kamēr vēl neesat publicējis, jebkurā laikā varat atgriezties pie pēdējā publicētā stāvokļa, galīgi nezaudējot melnrakstu — izmantojiet Atmest melnrakstu vietnes iestatījumos.",
            },
            {
              type: "ul",
              items: [
                "Publicētās izmaiņas nekavējoties redzamas jūsu domēnā",
                "Nepublicēts melnraksts paliek iekšējs, kamēr to neapstiprināt",
                "Katra publicēšana ar datumu tiek reģistrēta vēsturē",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Pirms publicēšanas priekšskatījumā pārbaudiet mobilo skatu — lielākā daļa viesu atver rezervāciju vietnes no viedtālruņa.",
            },
          ],
        },
      ],
    },
  ],
};
