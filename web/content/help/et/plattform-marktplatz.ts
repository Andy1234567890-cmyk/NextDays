import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Platvorm (turuplats)",
  description: "Müüge myBestDays turuplatsil.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Turuplats",
      articles: [
        {
          slug: "der-marktplatz",
          title: "myBestDays turuplats",
          excerpt: "Globaalne myBestDays turuplats on oma broneerimiskanal koos portaalide ja veebilehega.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "myBestDays turuplats (/plattform) on myBestDays'i enda globaalne broneerimiskanal — võrreldav Bookingu või Airbnb'ga, kuid osa samast platvormist. Külalised sirvivad seal kõikide liitunud ettevõtete objekte ja broneerivad otse.",
            },
            { type: "h2", text: "Mitte „otse“, vaid võrdväärne kanal" },
            {
              type: "p",
              text: "Turuplats ei asenda otsebroneerimist Teie enda veebilehe kaudu. See on iseseisev, kolmas müügitee oma nähtavuse teljega, oma külaliste baasiga ja oma vahendustasuga — täpselt nagu portaal, ainult et myBestDays haldab seda ise.",
            },
            { type: "h2", text: "Kuidas objektid jõuavad turuplatsile" },
            {
              type: "ul",
              items: [
                "Objekt peab olema aktiivne (objekti olek lubab müüki).",
                "Turuplatsi nähtavus peab olema sisse lülitatud — eraldi portaalidest ja veebilehest.",
                "Soovitud perioodi jaoks peab kalendris olema saadavus.",
              ],
            },
            { type: "h2", text: "Broneeringud turuplatsilt" },
            {
              type: "p",
              text: "Turuplatsi broneering blokeerib vastavad ööd kohe kõikidel teistel kanalitel — täpselt nagu portaali- või veebilehe broneering. See ilmub Teie kalendrisse ja reserveeringutesse nagu iga teine broneering, tähistatuna kanaliga „Platvorm“.",
            },
            {
              type: "note",
              variant: "info",
              text: "Müügipeatus ja mitteaktiivne objekti olek mõjutavad kõiki kanaleid ning blokeerivad ka turuplatsi — olenemata turuplatsi nähtavuse lülitist.",
            },
            {
              type: "p",
              text: "Kuidas teha objekt turuplatsi jaoks nähtavaks, lugege artiklist [Objekti loetlemine turuplatsil](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Objekti loetlemine turuplatsil",
          excerpt: "Turuplatsi nähtavus on oma lüliti, eraldi portaalidest ja veebilehest.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Nähtavust turuplatsil juhite objekti juures oleva eraldi lüliti kaudu — sõltumata sellest, kas sama objekt on nähtav ka portaalidel või Teie veebilehel.",
            },
            { type: "h2", text: "Kuidas objekti loetleda" },
            {
              type: "steps",
              items: [
                "Avage objekt Objektid all.",
                "Liikuge vahekaardile Nähtavus.",
                "Aktiveerige lüliti Platvormi turuplats.",
                "Kontrollige, et objekti olek on aktiivne ja kalendris on saadavus.",
              ],
            },
            { type: "h2", text: "Eeldus: täielik profiil" },
            {
              type: "p",
              text: "Turuplats kuvab ainult täielike andmetega objekte — tiitelfoto, kirjeldus, varustus ja põhihind peavad olema sisestatud. Kui kohustuslikud andmed puuduvad, jääb objekt aktiveeritud lülitist hoolimata nähtamatuks.",
            },
            {
              type: "ul",
              items: [
                "Vähemalt üks tiitelfoto ja kirjeldus",
                "Varustuse tunnused kategooria nimekirjast",
                "Täituvus ja põhihind sisestatud objekti valuutas",
                "Kalendri saadavus soovitud perioodiks",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Kui klõpsate Avalda, lülitab myNextDays tavaliselt turuplatsi, portaalid ja veebilehe koos sisse — Te saate turuplatsi lüliti pärast seda igal ajal eraldi uuesti välja lülitada.",
            },
            { type: "h2", text: "Nähtavuse uuesti eemaldamine" },
            {
              type: "p",
              text: "Kui deaktiveerite lüliti Platvormi turuplats, kaob objekt turuplatsi otsingust. Juba kinnitatud broneeringuid see ei mõjuta ja need jätkuvad tavapäraselt, vt [Turuplatsi vahendustasu](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Turuplatsi vahendustasu",
          excerpt: "Iga turuplatsi kaudu tehtud broneeringu eest kohaldub tariifis sisestatud vahendustasu.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Nagu iga broneerimisportaali puhul, kohaldub ka myBestDays turuplatsi kaudu tehtud broneeringutele vahendustasu. See arvutatakse broneeringu kohta ja on sõltumatu portaalide võimalikest vahendustasudest.",
            },
            { type: "h2", text: "Kuidas vahendustasu arvutatakse" },
            {
              type: "p",
              text: "Suurus sõltub Teie ettevõtte tariifis sisestatud vahendustasust. Kehtiva määra leiate igal ajal Konto all jaotisest Arveldamine — seal ei eeldata ühtset väärtust, vaid kuvatakse Teie tariifi jaoks tegelikult kehtiv määr.",
            },
            { type: "h2", text: "Kust vahendustasu vaadata" },
            {
              type: "steps",
              items: [
                "Avage menüüst Konto.",
                "Liikuge jaotisse Arveldamine.",
                "Avage turuplatsi broneering, et näha käivet ja vahendustasu üksikasjalikult.",
                "Kontrollige käimasoleva arveldusperioodi vahendustasude ülevaadet.",
              ],
            },
            { type: "h2", text: "Erinevus portaalide vahendustasust" },
            {
              type: "ul",
              items: [
                "Turuplatsi vahendustasu kehtib ainult myBestDays turuplatsi kaudu tehtud broneeringutele.",
                "Portaali broneeringutele (Booking, Airbnb & Co.) kehtivad vastava portaali tingimused.",
                "Veebilehe broneeringutele kehtivad Teie tariifi tingimused ilma turuplatsi vahendustasuta.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Vahendustasu määratakse automaatselt Teie tariifi põhjal. Puuduv või ebaselge tariif viib selge veateateni, mitte hinnangulise väärtuseni.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Külalise profiil ja hinnangud",
          excerpt: "Turuplatsi külalistel on profiil broneeringute ajalooga ja nad saavad jätta hinnanguid.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Külalised, kes broneerivad myBestDays turuplatsi kaudu, loovad oma külalise profiili. Sinna koguneb nende broneeringute, ettevõtetega peetud sõnumite ja jäetud hinnangute ajalugu — sarnaselt portaali külaliskontoga.",
            },
            { type: "h2", text: "Mida Teie ettevõttena näete" },
            {
              type: "p",
              text: "Turuplatsi broneeringu reserveeringu üksikasjades leiate külalise profiili varasemate viibimistega Teie ettevõttes ning, kui külaline on selle vabastanud, avalikult nähtavate hinnangutega teiste majutuste kohta.",
            },
            { type: "h2", text: "Hinnangud pärast viibimist" },
            {
              type: "steps",
              items: [
                "Pärast väljaregistreerimist saab külaline üleskutse hinnangu jätmiseks.",
                "Hinnang ilmub pärast lühikest kontrolli objekti lehele turuplatsil.",
                "Ettevõttena saate avalikult vastata igale hinnangule.",
                "Ebaasjalikke või kuritahtlikke hinnanguid saate Teatamise kaudu esitada kontrollimiseks.",
              ],
            },
            {
              type: "ul",
              items: [
                "Hinnangud on seotud tegeliku broneeringuga — hinnangut ilma viibimiseta ei ole.",
                "Külaline hindab puhtust, suhtlust, asukohta ja hinna-kvaliteedi suhet.",
                "Teie vastus on nähtav kõikidele turuplatsi külastajatele.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Head hinnangud mõjutavad otseselt Teie objekti positsiooni turuplatsi otsingus — reageerige kriitikale kiiresti ja asjalikult.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Blokeeritud isikud",
          excerpt: "Ettevõte saab blokeerida külalise, mis takistab sõnumeid ja broneeringuid.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Kui külalisega tekib probleeme, saate teda ettevõttena blokeerida. Blokeeritud isik ei saa Teile enam sõnumeid saata ega Teie ettevõttes uut broneeringut luua.",
            },
            { type: "h2", text: "Isiku blokeerimine" },
            {
              type: "steps",
              items: [
                "Avage sõnumite ajalugu või reserveering puudutatud külalisega.",
                "Klõpsake Blokeeri külaline.",
                "Kinnitage dialoog — blokeering kehtib kohe.",
                "Blokeeritud isik ilmub seejärel Konto all jaotisse Blokeeritud isikud.",
              ],
            },
            { type: "h2", text: "Mida blokeering teeb" },
            {
              type: "ul",
              items: [
                "Külaline ei saa enam uusi sõnumeid Teie ettevõttele saata.",
                "Külaline ei saa Teie ettevõttes uut broneeringut luua.",
                "Käimasolev broneering juba kinnitatud saabumisega järgmise kahe nädala jooksul jääb blokeeringust puutumata, et viibimine saaks korrektselt lõpule viidud.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Blokeering kehtib ainult Teie ettevõtte jaoks. Teised ettevõtted turuplatsil ei näe blokeeringut ega ole sellest mõjutatud.",
            },
            { type: "h2", text: "Blokeeringu tühistamine" },
            {
              type: "p",
              text: "Avage Konto ja seal Blokeeritud isikud. Valige kanne ja klõpsake Tühista blokeering — külaline saab seejärel uuesti sõnumeid saata ja broneerida.",
            },
          ],
        },
      ],
    },
  ],
};
