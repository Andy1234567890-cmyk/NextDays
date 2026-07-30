import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Kanalihaldur",
  description: "Valdage portaale ja kanalihaldurit.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Kanalihaldur",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Teie esimese portaali ühendamine",
          excerpt: "Kuidas esimest korda aktiveerida portaal objekti jaoks.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord: Te olete loonud objekti, kuid ei ole veel ühendanud portaali",
            },
            {
              type: "p",
              text: "Teie objekt on myNextDays'is täielikult seadistatud, kuid ei ole veel nähtav ühelgi portaalil, nagu Booking.com või Airbnb. Enne kui portaal objekti vastu võtab, vajab Teie konto üks kord kontopõhist portaali ühendust — pärast seda piisab iga järgmise objekti puhul ainult vastavusest (mapping).",
            },
            {
              type: "steps",
              items: [
                "Avage /konto, jaotis „Portaalid ja kanalihaldur“, ja seadistage kontopõhine ühendus oma ettevõtte andmetega",
                "Avage seejärel objekt /objekte all ja liikuge vahekaardile „Portaalid“",
                "Valige soovitud portaal ja seostage see sobiva toa- või pakkumise tüübiga",
                "Kontrollige fotosid, varustust, hindu ja tühistamistingimusi — portaalid nõuavad täielikke andmeid",
                "Aktiveerige nähtavus; olek muutub pärast portaali kontrolli „Ühendatud“ olekusse",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kontopõhise ühenduse seadistate ainult üks kord. Üksikasjad artiklites [Booking.com ühendamine](/hilfe/portale-kanalmanager/booking-verbinden) ja [Airbnb ühendamine](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Booking.com ühendamine",
          excerpt: "Kuidas teha objekt kanalihalduri kaudu Booking.com's broneeritavaks.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord: Teie objekt peaks lisaks olema nähtav Booking.com's",
            },
            {
              type: "p",
              text: "Booking.com on üks portaalidest, mis ühendatakse kanalihalduri kaudu. Eeldus on kontopõhine portaali ühendus — kui see on juba seadistatud, on Teil Booking.com jaoks vaja ainult vastavust (mapping) objekti kaupa.",
            },
            {
              type: "steps",
              items: [
                "Avage objekt /objekte all, vahekaart „Portaalid“",
                "Valige „Booking.com“ saadaolevate portaalide nimekirjast",
                "Seostage sobiv toa- või pakkumise tüüp ja kinnitage vähemalt üks hind koos tühistamistingimustega",
                "Sisestage kehtiv makseviis vahendustasu arveldamiseks",
                "Aktiveerige nähtavus Booking.com jaoks",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Booking.com kinnitamine võib võtta mõne tunni. Vahekaardi „Portaalid“ olek näitab, kui ühendus on aktiivne.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Airbnb ühendamine",
          excerpt: "Kuidas teha objekt kanalihalduri kaudu Airbnb's broneeritavaks.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord: Teie objekt peaks lisaks olema nähtav Airbnb's",
            },
            {
              type: "p",
              text: "Airbnb ühendatakse nagu iga teine portaal kontopõhise ühenduse kaudu. Kui see on seadistatud, aktiveerite Airbnb iga objekti jaoks vastavuse (mapping) kaudu — sõltumata sellest, kas objekt on juba nähtav Booking.com'il või teistel portaalidel.",
            },
            {
              type: "steps",
              items: [
                "Avage objekt /objekte all, vahekaart „Portaalid“",
                "Valige „Airbnb“ saadaolevate portaalide nimekirjast",
                "Kinnitage objekti kategooria ja seostatud pakkumise tüüp",
                "Täiendage fotosid, varustust ja majareegleid — Airbnb nõuab enne kinnitamist täielikke andmeid",
                "Aktiveerige nähtavus Airbnb jaoks",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ilma sisestatud tühistamistingimuste ja majareegliteta lükkab Airbnb kinnitamise tagasi. Täiendage need andmed esmalt objekti juures.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Hindade sünkroonis hoidmine kõikidel portaalidel",
          excerpt: "Üks kalender piisab — kanalihaldur jagab hinnamuudatused automaatselt kõikidele portaalidele.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord: Te muudate hinda ja soovite tagada, et see on kõikjal õige",
            },
            {
              type: "p",
              text: "Hindu haldate ainult objekti myNextDays'i kalendris — mitte kunagi eraldi portaalides endis. Kanalihaldur edastab iga muudatuse automaatselt kõikidele portaalidele, millega objekt on aktiivselt seostatud.",
            },
            {
              type: "steps",
              items: [
                "Avage objekti hinnakalender ehk hinnaplaanid",
                "Kohandage päevahinda, minimaalset peatumisaega või saabumis-/lahkumispiirangut",
                "Salvestage muudatus — see kehtib esmalt sisemiselt objektis",
                "Kontrollige vahekaardil „Portaalid“, et kõik soovitud portaalid on jätkuvalt aktiivselt seostatud",
                "Oodake mõni minut, kuni muudatus on portaalidele edastatud",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Ärge kunagi sisestage hindu otse portaalis — sellised muudatused kirjutatakse järgmisel ühtlustamisel myNextDays'i kalendri poolt üle.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Portaali broneeringu importimine",
          excerpt: "Portaali broneeringud jõuavad automaatselt kalendrisse — siin kontrollite, kas import õnnestus.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord: Külaline on broneerinud portaali kaudu, broneering peaks jõudma myNextDays'i",
            },
            {
              type: "p",
              text: "Kui külaline broneerib Booking.com, Airbnb või mõne teise ühendatud portaali kaudu, impordib kanalihaldur reserveeringu automaatselt — Te ei pea midagi käsitsi üle kandma. See käik kirjeldab, kuidas importi jälgida ja kinnitada.",
            },
            {
              type: "steps",
              items: [
                "Avage puudutatud objekti kalender või reserveeringute nimekiri",
                "Otsige uut reserveeringut — sellel on portaali päritolusilt, näiteks Booking.com või Airbnb",
                "Kontrollige külalise andmete, perioodi ja hinna täielikkust",
                "Kontrollige, et broneeritud ööd kuvatakse kõikidel teistel kanalitel blokeerituna",
                "Avage vajadusel broneeringu üksikasjad, et töödelda lisateenuseid või külalise sõnumeid",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kui külaline tühistab portaali kaudu või muudab perioodi, võetakse ka see automaatselt üle ja ööd vabastatakse uuesti.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Topeltbroneeringu lahendamine",
          excerpt: "Kuidas toimida, kui sama öö müüdi erandkorras kahel kanalil.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord: Kaks reserveeringut kattuvad sama objekti ja samade ööde puhul",
            },
            {
              type: "p",
              text: "Kanalihaldur blokeerib broneeritud ööd tavaliselt kohe kanaliüleselt. Topeltbroneering võib siiski tekkida, näiteks samaaegsete broneeringute korral kahel portaalil samal hetkel või käsitsi loodud reserveeringul, mis põrkub portaali broneeringuga.",
            },
            {
              type: "steps",
              items: [
                "Avage objekti kalender ja tuvastage mõlemad kattuvad reserveeringud",
                "Kontrollige mõlema reserveeringu broneerimise aega ja päritolusilti",
                "Võtke ühendust hiljem saabunud külalisega ja pakkuge asendusobjekti või alternatiivset perioodi",
                "Tühistage kehtetuks jääv reserveering vastavas portaalis, mitte ainult myNextDays'is",
                "Seadke puudutatud öödele seejärel müügipeatus, kuni juhtum on täielikult lahendatud",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Tühistage portaali broneering alati portaali enda kaudu — tühistamine ainult myNextDays'is vabastab öö küll sisemiselt, kuid ei teavita portaali usaldusväärselt.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Portaali ajutine peatamine",
          excerpt: "Lülitage nähtavus portaali kaupa välja, ilma vastavust kaotamata.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord: Objekt ei tohiks ajutiselt olla ühel portaalil broneeritav",
            },
            {
              type: "p",
              text: "Nähtavust saab portaali kaupa eraldi sisse-välja lülitada — sõltumata veebilehest ja platvormi turuplatsist. Kui soovite näiteks Airbnb lühikeseks ajaks peatada, kuid lasta Booking.com'il edasi töötada, deaktiveerige ainult see üks kanal.",
            },
            {
              type: "steps",
              items: [
                "Avage objekt /objekte all, vahekaart „Portaalid“",
                "Otsige selle portaali kirje, mille soovite peatada",
                "Lülitage selle portaali nähtavus välja",
                "Salvestage — muudatus jõustub mõne minuti jooksul, objekt kaob selle portaali otsingutulemustest",
                "Lülitage nähtavus uuesti sisse, niipea kui objekt peaks jälle broneeritav olema",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vastavus (mapping) säilib peatamisel — Te ei pea seost portaaliga hiljem uuesti üles seadma. Kõikide kanalite täielikuks blokeerimiseks kasutage selle asemel müügipeatust.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Objekti vastavuse (mapping) kontrollimine",
          excerpt: "Kuidas kontrollida, kas Teie objekt on veel korrektselt seostatud õige pakkumise tüübiga portaalis.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord: hinnad või saadavus ei ühti enam portaalil myNextDays'iga",
            },
            {
              type: "p",
              text: "Kui portaali kuvatav erineb Teie myNextDays kalendrist, on põhjuseks sageli vigane või katkenud vastavus (mapping) — seos Teie objekti ja portaali toa- või pakkumise tüübi vahel.",
            },
            {
              type: "steps",
              items: [
                "Avage objekt /objekte all, vahekaart „Portaalid“",
                "Kontrollige puudutatud portaali olekut — see peaks näitama „Ühendatud“, mitte „Viga“ või „Ootel“",
                "Kontrollige, kas portaalis seostatud toa- või pakkumise tüüp vastab veel tegelikule objektile",
                "Erinevuse korral: lahutage vastavus ja seostage uuesti, aktiveerige seejärel nähtavus uuesti",
                "Oodake pärast parandust mõni minut ja kontrollige hindu ja saadavust portaalis uuesti",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Objekt võib olla korraga seostatud mitme portaaliga — erisuste korral kontrollige sihipäraselt seda üht puudutatud portaali, mitte kõiki korraga.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Erinevad hinnad portaali kaupa",
          excerpt: "Kuidas määrata portaalile oma hinnaplaan, ilma teisi kanaleid mõjutamata.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord: Te soovite pakkuda ühel portaalil erinevat hinda kui teistel kanalitel",
            },
            {
              type: "p",
              text: "Hinnaplaane saab portaali kaupa eraldi seostada, näiteks tühistamatu hinnaplaan ühele portaalile ja paindlik teisele. Põhihinnad jäävad tsentraalselt objekti juures hallatuks, vastavus (mapping) määrab, milline hinnaplaan läheb millisele portaalile.",
            },
            {
              type: "steps",
              items: [
                "Looge objektis täiendav hinnaplaan soovitud tingimustega (hind, tühistamistingimused, minimaalne peatumisaeg)",
                "Avage vahekaart „Portaalid“ ja valige puudutatud portaal",
                "Seostage vastavuses (mapping) uus hinnaplaan selle portaaliga",
                "Jätke ülejäänud portaalid muutmata nende senise hinnaplaaniga",
                "Salvestage ja kontrollige mõne minuti pärast hinnakuvamist vastavas portaalis",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Iga hinnaplaan edastatakse sõltumatult — muudatus ühes hinnaplaanis ei mõjuta portaale, mis on seostatud teise hinnaplaaniga.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Levinud portaali vigade lahendamine",
          excerpt: "Tüüpilised põhjused, kui portaal lükkab objekti tagasi või sünkroniseerimine takerdub.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord: Portaali olek näitab viga või objekti ei võeta vastu",
            },
            {
              type: "p",
              text: "Portaalid lükkavad ühenduse tavaliselt tagasi puuduvate põhiandmete või puudulike objekti andmete tõttu. Käige läbi kõige levinumad põhjused järjekorras, enne kui võtate ühendust toega.",
            },
            {
              type: "steps",
              items: [
                "Kontrollige /konto all, kas aadress, maksuinfo ja kontaktandmed on täielikult sisestatud",
                "Kontrollige objekti juures, kas kirjeldus, fotod, varustus ja vähemalt üks hind on täielikud",
                "Kontrollige, kas kehtiv makseviis vahendustasude jaoks on sisestatud",
                "Avage vahekaart „Portaalid“ ja lugege puudutatud portaali kõrval täpset veateadet",
                "Kõrvaldage nimetatud puudus ja aktiveerige nähtavus uuesti",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Portaali viga puudutab alati ainult seda üht portaali — ülejäänud kanalid töötavad sellest sõltumatult edasi, kui nende enda nõuded on täidetud.",
            },
          ],
        },
      ],
    },
  ],
};
