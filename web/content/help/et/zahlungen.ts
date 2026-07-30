import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Maksed ja arved",
  description: "Makseteenuse pakkujad, maksereeglid ja arved.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Maksed",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Makseteenuse pakkuja ühendamine",
          excerpt:
            "Kuidas ühendada Stripe või PayPal myNextDays'iga, et maksed automaatselt töödelda.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Saadaolevad pakkujad" },
            {
              type: "p",
              text: "myNextDays töötleb makseid ühendatud makseteenuse pakkujate kaudu. Praegu toetatakse Stripe't ja PayPali — saate ühendada üht või mõlemat pakkujat korraga ja kasutada neid objekti või külalise soovi järgi.",
            },
            {
              type: "steps",
              items: [
                "Avage Konto ja liikuge jaotisse „Maksed“.",
                "Valige soovitud pakkuja — Stripe või PayPal.",
                "Järgige ühendamisdialoogi ja logige pakkuja juures sisse või looge uus konto.",
                "Kinnitage ühendus — olek muutub „ühendatud“.",
              ],
            },
            { type: "h2", text: "Mis juhtub pärast" },
            {
              type: "p",
              text: "Niipea kui pakkuja on ühendatud, saate saata makselinke, koguda ettemakseid ja algatada tagasimakseid otse broneeringust. Kõik summad töödeldakse vastava objekti jaoks sisestatud valuutas.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ilma ühendatud pakkujata saate makseid ainult käsitsi laekunuks märkida — automaatne debiteerimine ei ole siis võimalik.",
            },
            { type: "h2", text: "Mitu objekti, üks pakkuja" },
            {
              type: "p",
              text: "Üks kord loodud ühendus kehtib kontopõhiselt kõikide Teie objektide jaoks. Kuidas debiteerimine üksikasjalikult toimub, määrate [Maksereeglite](/hilfe/zahlungen/zahlungsregeln) kaudu. Väljamaksed Teile toimuvad seejärel vastava pakkuja kaudu, vt [Väljamaksed](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe sobib kaardimaksete ja paljude kohalike makseviiside jaoks",
                "PayPal pakub külalistele tuttavat alternatiivi",
                "Mõlemat pakkujat saab üksteisest sõltumatult lahutada ja uuesti ühendada",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Maksereeglid",
          excerpt: "Määrake, millal broneeringu ettemaks ja lõppmakse muutuvad tähtaegseks.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Ettemaks ja lõppmakse" },
            {
              type: "p",
              text: "Maksereeglid määravad, kuidas broneering finantsiliselt töödeldakse — näiteks ettemaks broneerimisel ja lõppmakse enne saabumist, või kogu summa kohe. Reeglid kehtivad objekti kohta ja neid saab igal ajal kohandada.",
            },
            {
              type: "steps",
              items: [
                "Avage objekt ja liikuge jaotisse „Maksereeglid“.",
                "Valige, kas kogutakse ettemaksu, ja määrake osakaal.",
                "Määrake, millal lõppmakse muutub tähtaegseks, näiteks teatud arv päevi enne saabumist.",
                "Salvestage seaded.",
              ],
            },
            { type: "h2", text: "Automaatne sissenõudmine" },
            {
              type: "p",
              text: "Kui makseteenuse pakkuja on ühendatud, kogub myNextDays ettemaksu ja lõppmakse automaatselt sisestatud ajahetkel ning teavitab külalist eelnevalt sõnumiga.",
            },
            {
              type: "note",
              variant: "info",
              text: "Maksereeglid kehtivad ainult ühendatud makseteenuse pakkujaga broneeringute puhul. Ilma pakkujata märgite maksed broneeringus käsitsi.",
            },
            { type: "h2", text: "Erinevused kanaliti" },
            {
              type: "p",
              text: "Portaalidel võib erinevalt kehtida nende oma maksete töötlus — kontrollige sel juhul vastavaid portaali tingimusi. Broneeringute puhul oma platvormi või veebilehe kaudu kehtivad alati siin sisestatud reeglid. Üksikasjad pakkuja ühendamise kohta leiate artiklist [Makseteenuse pakkuja ühendamine](/hilfe/zahlungen/zahlungsanbieter-verbinden), arvestamise kohta artiklist [Arvete koostamine](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Ettemaks võimalik fikseeritud summana või protsendina",
                "Lõppmakse tähtaeg vabalt valitav",
                "Muudatused kehtivad ainult uutele broneeringutele, mitte tagasiulatuvalt",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Arvete koostamine",
          excerpt: "Kuidas koostada broneeringu kohta arve korrektse arve aadressiga.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Arve loomine" },
            {
              type: "p",
              text: "Iga broneeringu kohta saab koostada arve — külalisele endale või erinevale ettevõttele, kui broneering tehti äriliselt.",
            },
            {
              type: "steps",
              items: [
                "Avage broneering Reserveeringutes.",
                "Valige „Koosta arve“.",
                "Kontrollige või täiendage arve aadressi.",
                "Kontrollige loetletud kirjeid — ööbimine, lisateenused, tasud.",
                "Koostage arve ja saatke see külalisele.",
              ],
            },
            { type: "h2", text: "Arve aadressi haldamine" },
            {
              type: "p",
              text: "Arve aadressi saate sisestada otse broneeringus või lasta külalisel selle broneeringu kinnituse kaudu hiljem täiendada. Ilma täieliku aadressita ei saa teatud riikides õiguslikult kehtivat arvet väljastada.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Kontrollige äriklientide puhul eriti hoolikalt ettevõtte nime ja aadressi — hilisemad parandused nõuavad korrigeeritud arvet.",
            },
            { type: "h2", text: "Summad ja valuuta" },
            {
              type: "p",
              text: "Kõik kirjed esitatakse objekti jaoks sisestatud valuutas. Juba tehtud maksed märgitakse arvel maksena laekunuks. Kuidas ettemaks ja lõppmakse kujunevad, lugege artiklist [Maksereeglid](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Arveid saab alla laadida PDF-ina",
                "Korrigeeritud arved on muudatuste korral igal ajal võimalikud",
                "Lisateenused ilmuvad eraldi kirjena",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Tagasimaksed",
          excerpt:
            "Kuidas maksta makse tervikuna või osaliselt tagasi, kui broneering tühistatakse või muudetakse.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Millal on tagasimakse vajalik" },
            {
              type: "p",
              text: "Tagasimakse on tüüpiliselt vajalik tühistamise korral, kuid võib olla vajalik ka hilisema hinnamuudatuse või tühistatud lisateenuse puhul.",
            },
            {
              type: "steps",
              items: [
                "Avage puudutatud broneering Reserveeringutes.",
                "Valige broneeringu maksete alas „Tagasimakse“.",
                "Sisestage tagastatav summa — täielikult või osaliselt.",
                "Kinnitage tagasimakse.",
              ],
            },
            { type: "h2", text: "Käik makseteenuse pakkuja kaudu" },
            {
              type: "p",
              text: "Tagasimakse tehakse makse jaoks kasutatud pakkuja — Stripe või PayPal — kaudu ja kantakse otse tagasi külalise algsele maksevahendile. Toiming märgitakse automaatselt broneeringu ajajoonele.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ilma ühendatud makseteenuse pakkujata ei saa tagasimakset automaatselt algatada — lahendage tagasimakse sel juhul otse külalisega.",
            },
            { type: "h2", text: "Mõju vahendustasudele" },
            {
              type: "p",
              text: "Juba arvestatud turuplatsi või portaali vahendustasusid kohandatakse tagasimakse korral proportsionaalselt. Rohkem selle kohta artiklis [Vahendustasude mõistmine](/hilfe/zahlungen/provisionen-verstehen). Üksikasjad tühistamise enda kohta leiate artiklist [Tühistamine ja tagasimakse](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Osalised tagasimaksed on üksikute kirjete jaoks võimalikud",
                "Töötlemise olek on broneeringus igal ajal nähtav",
                "Tagasimaksed toimuvad ainult algselt kasutatud pakkuja kaudu",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Väljamaksed",
          excerpt:
            "Kuidas saate oma broneeringute tulu ühendatud makseteenuse pakkujatelt välja makstud.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Kuidas väljamaksed toimivad" },
            {
              type: "p",
              text: "Sissetulevad maksed kogunevad esmalt ühendatud makseteenuse pakkuja juures. Sealt toimub väljamakse Teie sisestatud pangakontole vastavalt pakkuja tavapärasele rütmile.",
            },
            {
              type: "steps",
              items: [
                "Avage Konto ja liikuge jaotisse „Maksed“.",
                "Kontrollige „Väljamaksed“ all vastava pakkuja olekut.",
                "Avage vajadusel pakkuja üksikasjalik vaade täieliku väljamaksete ajaloo jaoks.",
              ],
            },
            { type: "h2", text: "Mis maha arvatakse enne väljamakset" },
            {
              type: "p",
              text: "Enne väljamakset arvestatakse kohalduvaid turuplatsi ja portaali vahendustasusid ning pakkuja tasusid. Väljamakstav summa ei vasta seega tingimata algsele broneeringusummale.",
            },
            {
              type: "note",
              variant: "info",
              text: "Mahaarvamiste täpset ülesehitust selgitab [Vahendustasude mõistmine](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Mitu objekti ja omanikku" },
            {
              type: "p",
              text: "Kui haldate objekte erinevate omanike jaoks, seostatakse väljamaksed vastavalt sisestatud omanikuarvestustele. Erisuste korral kontrollige esmalt aluseks olevate broneeringute olekut Reserveeringutes.",
            },
            {
              type: "ul",
              items: [
                "Väljamaksete rütmi ja meetodi määrab vastav pakkuja",
                "Kinnipeetud summad, näiteks käimasolevate tagasimaksete korral, on tähistatud",
                "Täielik ajalugu on otse pakkuja juures vaatamiseks saadaval",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Vahendustasude mõistmine",
          excerpt:
            "Ülevaade sellest, kuidas moodustuvad turuplatsi ja portaali vahendustasud ning kus need arveldatakse.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Kaks vahendustasu liiki" },
            {
              type: "p",
              text: "myNextDays'i kaudu tehtud broneeringute puhul võib tekkida kaks erinevat vahendustasu: turuplatsi vahendustasu oma platvormi kaudu tehtud broneeringute jaoks ning portaali vahendustasud broneeringute jaoks, mis saabuvad ühendatud portaalide, nagu Booking või Airbnb kaudu. Mõlemad on üksteisest sõltumatud ja võivad olenevalt broneeringu müügiteest erinevalt kujuneda.",
            },
            {
              type: "ul",
              items: [
                "Turuplatsi vahendustasu: kohaldub myNextDays platvormi kaudu tehtud broneeringutele",
                "Portaali vahendustasu: arvutab vastav portaal oma tingimuste alusel",
                "Otsebroneeringuid Teie enda veebilehe kaudu tuleb vaadelda neist sõltumatult",
              ],
            },
            { type: "h2", text: "Kust vahendustasud on näha" },
            {
              type: "steps",
              items: [
                "Avage Konto ja liikuge jaotisse „Arveldamine“.",
                "Valige soovitud kuu.",
                "Kontrollige ülevaadet broneeringute kaupa koos vastava vahendustasuga.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Millise kanali kaudu broneering saabus, näete otse broneeringu juures — see selgitab, milline vahendustasu kohaldati.",
            },
            { type: "h2", text: "Seos väljamaksetega" },
            {
              type: "p",
              text: "Vahendustasud arvatakse maha broneeringusummast enne väljamakset. Üksikasjad väljamakse protsessi kohta leiate artiklist [Väljamaksed](/hilfe/zahlungen/auszahlungen). Tagasimakse korral korrigeeritakse vastavat vahendustasu proportsionaalselt — täieliku broneeringu käigu näitab [Broneeringu ajajoon](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
