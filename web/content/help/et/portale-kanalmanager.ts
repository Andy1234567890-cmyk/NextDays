import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portaalid ja kanalihaldur",
  description: "Juhtige tsentraalselt Bookingut, Airbnb't, Expediat & Co.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Portaalide ühendamine",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Mis on kanalihaldur?",
          excerpt:
            "Kanalihaldur ühtlustab hinnad, saadavuse ja broneeringud automaatselt myNextDays'i ja portaalide vahel.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Üks ühendus kõikide portaalide jaoks" },
            {
              type: "p",
              text: "Kanalihaldur on sild myNextDays'i ja suurte broneerimisportaalide, näiteks Bookingu, Airbnb & Co. vahel. Selle asemel, et hallata hindu, saadavust ja täituvust igas portaalis eraldi, sisestate kõik üks kord myNextDays'i — kanalihaldur jagab selle automaatselt kõikidele ühendatud portaalidele.",
            },
            { type: "h2", text: "Mis sünkroniseeritakse automaatselt" },
            {
              type: "ul",
              items: [
                "Saadavus — iga reserveering blokeerib öö kohe kõikidel portaalidel",
                "Hinnad ja minimaalsed peatumisajad Teie hinnakalendrist",
                "Sissetulevad portaali broneeringud imporditakse automaatselt myNextDays'i",
                "Tühistamised ja müügipeatus mõjutavad kõiki kanaleid korraga",
              ],
            },
            { type: "h2", text: "Mida Te enam käsitsi tegema ei pea" },
            {
              type: "p",
              text: "Ilma kanalihaldurita peaksite pärast iga broneeringut käsitsi igas portaalis öö blokeerima — sagedane topeltbroneeringute põhjus. Aktiivse kanalihalduriga võtab myNextDays selle ühtlustamise üle mõlemas suunas, mitu korda päevas ja reaalajas uute broneeringute puhul.",
            },
            {
              type: "note",
              variant: "info",
              text: "Portaali ühendus seadistatakse üks kord kontopõhiselt. Iga üksiku objekti puhul aktiveerite pärast seda ainult vastavuse (mapping) — rohkem selle kohta artiklis [Objekti seostamine portaaliga](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Portaali ühenduse seadistamine",
          excerpt:
            "Ühenduse portaalidega seadistate üks kord kontopõhiselt — mitte iga objekti jaoks uuesti.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Üks kord kogu konto jaoks" },
            {
              type: "p",
              text: "Ühendus portaalidega on kontopõhine seadistus: ühendate oma myNextDays'i konto täpselt üks kord kanalihalduriga. Kõik objektid, mille hiljem loote, kasutavad automaatselt seda üht ühendust — Te ei pea seda iga objekti jaoks uuesti üles seadma.",
            },
            { type: "h2", text: "Kuidas ühendus seadistada" },
            {
              type: "steps",
              items: [
                "Avage /konto ja valige jaotis „Portaalid ja kanalihaldur“",
                "Klõpsake „Seadista ühendus“ ja kinnitage oma ettevõtte andmed (aadress, kontakt, õiguslik vorm)",
                "Kontrollige automaatselt üle võetud põhiandmeid — need edastatakse kõikidele portaalidele",
                "Lõpetage seadistamine — olek muutub „Ühendatud“",
              ],
            },
            { type: "h2", text: "Järgmine samm: objektide seostamine" },
            {
              type: "p",
              text: "Pärast ühekordset seadistamist ei ole ükski objekt veel nähtav — selleks seostate iga objekti eraldi portaaliga (mapping) ja ühendate soovitud portaalid, nagu Booking.com või Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ilma täielike põhiandmeteta (aadress, maksuinfo, kontakt) lükkavad portaalid ühenduse tagasi. Kontrollige neid andmeid esmalt /konto all.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Objekti seostamine portaaliga",
          excerpt:
            "Pärast kontopõhist ühendust aktiveerite iga objekti puhul enam ainult vastavuse (mapping) vastava portaaliga.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Vastavus (mapping), mitte uus ühendus" },
            {
              type: "p",
              text: "Kui portaali ühendus on üks kord kontopõhiselt seadistatud, ühendate iga objekti enam ainult niinimetatud vastavuse (mapping) kaudu: määrate, milline myNextDays'i objekt vastab millisele toa- või pakkumise tüübile portaalis. See on iga objekti puhul ühekordne samm.",
            },
            { type: "h2", text: "Kuidas objekti seostada" },
            {
              type: "steps",
              items: [
                "Avage objekt /objekte all ja liikuge vahekaardile „Portaalid“",
                "Valige soovitud portaal, näiteks Booking.com või Airbnb",
                "Seostage objekt sobiva toa- või pakkumise tüübiga portaalis",
                "Aktiveerige sünkroniseerimine — hinnad ja saadavus edastatakse alates sellest hetkest",
              ],
            },
            { type: "h2", text: "Üks objekt, mitu portaali" },
            {
              type: "p",
              text: "Üks objekt saab olla korraga seostatud mitme portaaliga. Iga seos on sõltumatu — saate näiteks teha objekti nähtavaks Booking.com'il ja Airbnb'l, kuid jätta selle Expedial esialgu deaktiveerituks.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kontrollige pärast seostamist kohe nähtavust — vt [Nähtavus portaali kaupa](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Booking.com ühendamine",
          excerpt: "Kuidas aktiveerida Booking.com müügikanalina objekti jaoks.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Eeldus: kontopõhine ühendus" },
            {
              type: "p",
              text: "Enne Booking.com aktiveerimist objekti jaoks peab kontopõhine portaali ühendus olema seadistatud (vt [Portaali ühenduse seadistamine](/hilfe/portale-kanalmanager/portal-verbindung)). Pärast seda on Booking.com iga järgmise objekti jaoks ainult vastavuse (mapping) küsimus.",
            },
            { type: "h2", text: "Booking.com aktiveerimine" },
            {
              type: "steps",
              items: [
                "Avage objekt /objekte all, vahekaart „Portaalid“",
                "Valige „Booking.com“ saadaolevate portaalide nimekirjast",
                "Seostage sobiv toa- või pakkumise tüüp ja kinnitage hinnaplaanid",
                "Aktiveerige nähtavus — objekt läheb pärast Booking.com kontrolli otseülekandesse",
              ],
            },
            { type: "h2", text: "Mida Booking.com Teilt ootab" },
            {
              type: "ul",
              items: [
                "Täielik objekti kirjeldus, pildid ja varustus",
                "Vähemalt üks hind koos tingimuste ja tühistamiseeskirjadega",
                "Kehtiv makseviis vahendustasude jaoks",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Booking.com kinnitamine võib võtta mõne tunni. Objekti vahekaardil „Portaalid“ olek näitab, kas ühendus on juba aktiivne.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Airbnb ühendamine",
          excerpt: "Kuidas teha objekt kanalihalduri kaudu Airbnb's broneeritavaks.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Airbnb kui täiendav portaal" },
            {
              type: "p",
              text: "Airbnb ühendatakse nagu iga teine portaal kontopõhise ühenduse kaudu. Kui see on seadistatud, aktiveerite Airbnb iga objekti jaoks vastavuse (mapping) kaudu — sõltumata sellest, kas objekt on juba nähtav Booking.com'il või teistel portaalidel.",
            },
            { type: "h2", text: "Airbnb aktiveerimine objekti jaoks" },
            {
              type: "steps",
              items: [
                "Avage objekt /objekte all, vahekaart „Portaalid“",
                "Valige „Airbnb“ saadaolevate portaalide nimekirjast",
                "Kinnitage objekti kategooria ja seostatud pakkumise tüüp",
                "Kontrollige fotosid, varustust ja majareegleid — Airbnb nõuab enne kinnitamist täielikke andmeid",
                "Aktiveerige nähtavus Airbnb jaoks",
              ],
            },
            { type: "h2", text: "Pärast aktiveerimist" },
            {
              type: "p",
              text: "Niipea kui Airbnb on objekti heaks kiitnud, jooksevad hinnad ja saadavus automaatselt kanalihalduri kaudu. Airbnb's saabuvad broneeringud ilmuvad seejärel automaatselt Teie reserveeringute kalendrisse.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ilma sisestatud tühistamistingimuste ja majareegliteta lükkab Airbnb kinnitamise tagasi. Täiendage need andmed esmalt objekti juures.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Hindade ja saadavuse sünkroniseerimine",
          excerpt:
            "Hinnad ja saadavus edastatakse automaatselt kõikidele ühendatud portaalidele.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Üks kalender, kõik portaalid" },
            {
              type: "p",
              text: "Hindu ja saadavust haldate ainult vastava objekti myNextDays'i kalendris. Kanalihaldur edastab iga muudatuse automaatselt kõikidele portaalidele, millega objekt on aktiivselt seostatud — ilma et Te peaksite midagi topelt sisestama.",
            },
            { type: "h2", text: "Mis edastatakse" },
            {
              type: "ul",
              items: [
                "Päevahinnad Teie hinnakalendrist ehk hinnaplaanidest",
                "Saadaolevad ööd ja blokeeringud",
                "Minimaalne peatumisaeg ning saabumis-/lahkumispiirangud",
                "Müügipeatuse päevad — need blokeeruvad automaatselt kõikidel portaalidel",
              ],
            },
            { type: "h2", text: "Kui kiiresti sünkroniseerimine toimib" },
            {
              type: "p",
              text: "Hindade ja saadavuse muudatused edastatakse portaalidele mõne minuti jooksul. Uued reserveeringud blokeerivad puudutatud ööd kohe, et samat ööd ei saaks üheski teises kanalis uuesti müüa.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Rohkem üksikute päevade kanaliülesest blokeerimisest leiate artiklist [Topeltbroneeringute vältimine](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Portaali broneeringute vastuvõtmine",
          excerpt: "Broneeringud Bookingust, Airbnb'st & Co. jõuavad automaatselt Teie kalendrisse.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Automaatne import" },
            {
              type: "p",
              text: "Kui külaline broneerib portaali, näiteks Booking.com või Airbnb kaudu, impordib kanalihaldur reserveeringu automaatselt myNextDays'i. Te ei pea midagi käsitsi üle kandma — broneering ilmub puudutatud objekti kalendrisse ja reserveeringute nimekirja.",
            },
            { type: "h2", text: "Mis toimub portaali broneeringu korral" },
            {
              type: "steps",
              items: [
                "Portaal teatab uuest broneeringust kanalihaldurile",
                "myNextDays loob reserveeringu koos külalise andmete, perioodi ja hinnaga",
                "Broneeritud ööd blokeeritakse kohe kõikidel teistel kanalitel",
                "Saate teavituse ja leiate broneeringu kalendrist",
              ],
            },
            { type: "h2", text: "Tühistamised ja muudatused" },
            {
              type: "p",
              text: "Kui külaline tühistab portaali kaudu või muudab perioodi, edastatakse ka see automaatselt myNextDays'i ja puudutatud ööd vabastatakse uuesti.",
            },
            {
              type: "note",
              variant: "info",
              text: "Portaali broneeringud on reserveeringu detailide juures nende päritolusildi järgi äratuntavad, näiteks Booking.com või Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Topeltbroneeringute vältimine",
          excerpt: "Müügipeatus ja automaatsed blokeeringud takistavad topeltbroneeringuid mitme portaali vahel.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Miks topeltbroneeringud tekivad" },
            {
              type: "p",
              text: "Ilma tsentraalse juhtimiseta juhtub kergesti, et sama öö müüakse korraga kahel portaalil — näiteks kui hindu ja saadavust hallatakse käsitsi mitmes süsteemis. Kanalihaldur sulgeb selle lünga, kuna iga broneering igal kanalil blokeerib kohe kõik teised kanalid.",
            },
            { type: "h2", text: "Teie vahendid topeltbroneeringute vastu" },
            {
              type: "ul",
              items: [
                "Automaatne blokeerimine: iga uus reserveering — sõltumata kanalist — blokeerib öö kõikjal",
                "Müügipeatus: blokeerib päeva käsitsi korraga kõikidel kanalitel, näiteks omakasutuse või hoolduse jaoks",
                "Minimaalne peatumisaeg ja saabumispiirangud takistavad sobimatuid lühibroneeringuid",
              ],
            },
            { type: "h2", text: "Müügipeatuse seadmine" },
            {
              type: "steps",
              items: [
                "Avage objekti täituvuskalender",
                "Märgistage puudutatud päev või periood",
                "Valige „Müügipeatus“ — päev on pärast seda blokeeritud kõikidel portaalidel ning veebilehel ja platvormil",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Müügipeatus kehtib erandita kõikidele kanalitele. Puudub võimalus blokeerida päev ainult ühel portaalil ja jätta teistele avatuks.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Nähtavus portaali kaupa",
          excerpt: "Iga portaali saab sisse või välja lülitada sõltumata veebilehest ja platvormi turuplatsist.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Kolm sõltumatut müügiteed" },
            {
              type: "p",
              text: "Objekti saab korraga müüa mitme tee kaudu: portaalide (Booking, Airbnb & Co.), myNextDays platvormi turuplatsi ja Teie enda veebilehe kaudu. Igal teel on oma nähtavuse lüliti — need on üksteisest täiesti sõltumatud.",
            },
            { type: "h2", text: "Nähtavuse juhtimine portaali kaupa" },
            {
              type: "p",
              text: "Portaalide sees saab lisaks iga üksikut portaali eraldi sisse-välja lülitada. Objekt võib olla näiteks aktiivne Booking.com'il, kuid deaktiveeritud Airbnb's — mõlemad seosed jäävad sellest puutumata alles.",
            },
            { type: "h2", text: "Kuidas nähtavust muuta" },
            {
              type: "steps",
              items: [
                "Avage objekt /objekte all, vahekaart „Portaalid“",
                "Lülitage soovitud kanal (üksik portaal, veebileht või platvormi turuplats) eraldi sisse või välja",
                "Salvestage — muudatus jõustub mõne minuti jooksul",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Objekti olek (aktiivne/mitteaktiivne) ning müügipeatus mõjutavad üleüldiselt kõiki kanaleid. Nähtavuse lülitid juhivad ainult seda, millistel täiendavatel kanalitel juba aktiivne objekt kuvatakse.",
            },
          ],
        },
      ],
    },
  ],
};
