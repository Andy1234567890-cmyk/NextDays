import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Veebilehe koostaja",
  description: "Looge oma broneerimisveebileht koostaja abil.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Veebilehe koostaja",
      articles: [
        {
          slug: "website-erstellen",
          title: "Veebilehe loomine",
          excerpt: "Koostajaga loote mõne minutiga oma broneerimisveebilehe.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Veebilehe koostaja loob Teile oma broneerimisveebilehe — täiendava müügikanali koos portaalide ja myNextDays turuplatsiga. Teil säilib täielik kontroll ülesehituse, sisu ja brändingu üle.",
            },
            { type: "h2", text: "Kuidas luua veebileht" },
            {
              type: "steps",
              items: [
                "Avage menüüst Veebileht.",
                "Klõpsake Loo veebileht.",
                "Valige oma paigutuse lähtepunktiks mall.",
                "Kinnitage nupuga Loo veebileht — jõuate otse redaktorisse.",
              ],
            },
            { type: "h2", text: "Mida koostaja sisaldab" },
            {
              type: "ul",
              items: [
                "Visuaalne redaktor lehtede, kihtide ja eelvaate kuvaga",
                "Valmis komponendid objektinimekirjade, galeriide ja kontaktvormide jaoks",
                "Otsene broneerimistee, mis põhineb Teie kalendri saadavusel",
                "Kohandatavad värvid, kirjatüübid ja logo, mis sobivad Teie brändiga",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Alustage mallist, mis on lähedal Teie objekti liigile — puhkemajutus või hotell — see säästab Teile hiljem aega komponentide kohandamisel.",
            },
            { type: "h2", text: "Järgmised sammud" },
            {
              type: "p",
              text: "Pärast loomist kohandate lehti ja paigutust, vt [Lehtede ja paigutuse muutmine](/hilfe/website/seiten-layout), ning kuvate oma objekte veebilehel, vt [Objektide kuvamine veebilehel](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Lehtede ja paigutuse muutmine",
          excerpt: "Kohandage lehti, kihte ja komponente visuaalses redaktoris.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Redaktor jaguneb kolmeks alaks: vasakul lehtede ja kihtide ülevaade, keskel Teie veebilehe eelvaade, paremal valitud komponendi seaded.",
            },
            { type: "h2", text: "Lehe muutmine" },
            {
              type: "steps",
              items: [
                "Valige vasakul Lehed all soovitud leht.",
                "Klõpsake eelvaates komponendil, et see valida.",
                "Kohandage paremal komponendi teksti, pilti või vahemikku.",
                "Lohistage komponente järjekorra muutmiseks.",
              ],
            },
            { type: "h2", text: "Uute lehtede ja komponentide lisamine" },
            {
              type: "p",
              text: "Nupu Lisa leht kaudu loote täiendavaid alamlehti, näiteks Meist või Kontakt. Lehe sees lisate nupu Lisa komponent kaudu uusi jaotisi, nagu galerii, hinnangud või kontaktvorm.",
            },
            {
              type: "ul",
              items: [
                "Avaleht, objektiülevaade ja kontakt on igas mallis eeldefineeritud",
                "Täiendavaid lehti saab vabalt nimetada ja navigatsiooni lisada",
                "Komponendid on responsiivsed ja kohanduvad arvuti, tahvelarvuti ja nutitelefoniga",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Muudatused redaktoris on esialgu ainult mustand. Alles klõps nupul Avalda võtab need üle Teie avalikule veebilehele.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Domeeni ühendamine",
          excerpt: "Ühendage oma domeen Teie myNextDays veebilehega.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Vaikimisi on Teie veebileht saadaval myNextDays alamdomeeni kaudu. Kui soovite selle asemel kasutada oma domeeni, näiteks teie-ettevote.ee, ühendage see jaotises Domeen.",
            },
            { type: "h2", text: "Domeeni sisestamine" },
            {
              type: "steps",
              items: [
                "Avage veebilehe seaded ja seal Domeen.",
                "Sisestage oma domeen ja klõpsake Ühenda.",
                "Looge oma domeeniteenuse pakkuja juures kuvatud DNS-kirjed.",
                "Oodake kinnitust — kontroll toimub automaatselt taustal.",
              ],
            },
            { type: "h2", text: "DNS-kirjete korrektne sisestamine" },
            {
              type: "p",
              text: "myNextDays kuvab Teile täpselt vajalikud kirjed Teie domeeniteenuse pakkuja jaoks. Ühendus aktiveerub alles siis, kui need kirjed on korrektselt sisestatud ja üleilmselt levinud — see võib pakkujast olenevalt võtta mõne tunni.",
            },
            {
              type: "ul",
              items: [
                "Sisestage CNAME- või A-kirje vastavalt kuvatud juhendile",
                "Eemaldage eelnevalt olemasolevad, vastukäivad kirjed sama domeeni jaoks",
                "https sertifikaat väljastatakse automaatselt pärast edukat ühendamist",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ilma korrektselt sisestatud DNS-kirjeteta ei ole Teie veebileht oma domeeni all saadaval — kontrollige kirjapilti hoolikalt oma pakkuja andmete alusel.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Objektide kuvamine veebilehel",
          excerpt: "Milliseid objekte veebilehel kuvatakse ja saab broneerida, juhite iga objekti kohta eraldi.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Selleks et objekt ilmuks Teie veebilehele, peab selle objekti veebilehe nähtavus olema sisse lülitatud. See lüliti on sõltumatu nähtavusest myNextDays turuplatsil või portaalidel.",
            },
            { type: "h2", text: "Objekti aktiveerimine veebilehe jaoks" },
            {
              type: "steps",
              items: [
                "Avage objekt Objektid all.",
                "Liikuge vahekaardile Nähtavus.",
                "Aktiveerige lüliti Veebileht.",
                "Liikuge veebilehele ja kontrollige eelvaates komponenti Objektiülevaade.",
              ],
            },
            { type: "h2", text: "Järjekorra ja kuvamise kohandamine" },
            {
              type: "p",
              text: "Komponendis Objektiülevaade määrate, kas objektid sorteeritakse automaatselt saadavuse järgi või kas sätestate fikseeritud järjekorra. Iga objekt kuvab tiitelfotot, oma valuutas põhihinda ja kõige olulisemaid varustuse tunnuseid.",
            },
            {
              type: "ul",
              items: [
                "Automaatne sortimine saadavuse järgi või käsitsi järjekord",
                "Filter objekti tüübi või varustuse järgi valikuliselt aktiveeritav",
                "Broneerimissammud toimuvad otse veebilehel, ilma portaali ümbersuunamiseta",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Objekt ilma aktiveeritud veebilehe nähtavuseta jääb objektiülevaatest peidetuks, isegi kui see on nähtav turuplatsil või portaalidel.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Veebilehe avaldamine",
          excerpt: "Mustandid muutuvad avalikult nähtavaks alles pärast klõpsamist nupul Avalda.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Kuni töötate redaktoris, näete praegust mustandit ainult Teie ise. Alles klõps nupul Avalda muudab muudatused Teie domeeni all kõikidele külastajatele nähtavaks.",
            },
            { type: "h2", text: "Kuidas avaldada" },
            {
              type: "steps",
              items: [
                "Avage redaktoris eelvaade ja kontrollige kõiki lehti.",
                "Klõpsake üleval paremal Avalda.",
                "Kinnitage dialoog — veebileht on kohe pärast seda otseülekandes.",
                "Avage oma domeen uues vahelehes, et tulemust kontrollida.",
              ],
            },
            { type: "h2", text: "Mustandid ja lähtestamine" },
            {
              type: "p",
              text: "Kuni Te pole avaldanud, saate igal ajal naasta viimase avaldatud seisu juurde, ilma mustandit lõplikult kaotamata — kasutage selleks veebilehe seadetes funktsiooni Loobu mustandist.",
            },
            {
              type: "ul",
              items: [
                "Avaldatud muudatused on kohe nähtavad Teie domeeni all",
                "Avaldamata mustand jääb sisemiseks, kuni Te selle kinnitate",
                "Iga avaldamine salvestatakse kuupäevaga ajaloosse",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Enne avaldamist kontrollige eelvaates mobiilivaadet — enamik külalisi avab broneerimisveebilehti nutitelefoni kaudu.",
            },
          ],
        },
      ],
    },
  ],
};
