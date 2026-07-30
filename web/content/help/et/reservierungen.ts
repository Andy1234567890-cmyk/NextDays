import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Reserveeringud ja broneeringud",
  description: "Broneeringute haldamine, edasilükkamine ja tühistamine.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Broneeringud",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Broneeringu käsitsi sisestamine",
          excerpt:
            "Kuidas sisestada telefoni või e-posti teel saabunud broneering otse myNextDays'i.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Millal sisestada käsitsi" },
            {
              type: "p",
              text: "Mitte iga broneering ei tule portaali või Teie enda platvormi kaudu — telefoni, e-posti või kohapealseid päringuid peate ise looma, et objekt oleks myNextDays'is korrektselt blokeeritud ja ei tekiks topeltbroneeringut.",
            },
            {
              type: "steps",
              items: [
                "Avage Reserveeringud ja klõpsake „Uus broneering“.",
                "Valige objekt — iga objekt myNextDays'is on üks broneeritav üksus, seega konkreetne tuba või puhkemajutus.",
                "Määrake saabumine ja lahkumine ning külaliste arv.",
                "Sisestage külalise andmed (nimi, kontakt, vajadusel aadress arve jaoks).",
                "Kontrollige pakutud hinda ja kohandage vajadusel.",
                "Salvestage broneering — ööd blokeeritakse kohe kalendris.",
              ],
            },
            { type: "h2", text: "Makse ja kinnitus" },
            {
              type: "p",
              text: "Pärast salvestamist kehtivad samad maksereeglid mis veebibroneeringute puhul. Kui makseteenuse pakkuja on ühendatud, saate saata külalisele otse makselingi või märkida makse käsitsi laekunuks.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Sisestage erisoovid (varajane saabumine, lisavoodid) kohe märkmetesse — meeskond näeb neid broneeringu ajajoonel.",
            },
            { type: "h2", text: "Pärast loomist" },
            {
              type: "p",
              text: "Uus broneering ilmub kohe [Broneeringu ajajoonele](/hilfe/reservierungen/buchungs-zeitleiste) koos kõikide järgmiste sammudega, nagu sõnumid, ülesanded ja maksed ühest kohast.",
            },
            {
              type: "ul",
              items: [
                "Kalender ja portaalid sünkroniseeritakse automaatselt salvestamisel.",
                "Külaline saab vajadusel automaatse kinnitussõnumi.",
                "Kuupäevade muudatused sisestage funktsiooniga „Broneeringu edasilükkamine“.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "Broneeringu ajajoon",
          excerpt:
            "Broneeringu ajajoon koondab kogu reserveeringu käigu ühte kohta.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Mida ajajoon näitab" },
            {
              type: "p",
              text: "Igal reserveeringul on oma ajajoon, mis kujutab kogu käiku kronoloogiliselt — broneeringupäringust või portaali impordist kuni väljaregistreerimiseni. Nii näete ühe pilguga, mis on juba juhtunud ja mis on järgmisena ees.",
            },
            {
              type: "ul",
              items: [
                "Sõnumid külalisega",
                "Ülesanded, näiteks koristamine või ettevalmistus",
                "Maksed ja arved",
                "Broneeritud lisateenused",
                "Edasilükkamised (kuupäevamuudatused) ja tühistamised",
              ],
            },
            { type: "h2", text: "Ajajoone kasutamine igapäevaselt" },
            {
              type: "steps",
              items: [
                "Avage Reserveeringud ja valige soovitud broneering.",
                "Liikuge vahekaardile „Ajajoon“.",
                "Kerige kronoloogiliselt läbi kõik sündmused.",
                "Kasutage kiirtoiminguid, et saata otse sõnum või luua ülesanne.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kui broneering lükatakse edasi või tühistatakse, ilmub see samm samuti ajajoonele — koos kalendris vabastatud öödega.",
            },
            { type: "h2", text: "Miks see oluline on" },
            {
              type: "p",
              text: "Kuna meeskond, omanik ja tugi näevad sama ajajoont, ei teki infolünki sõnumite, ülesannete ja maksete vahel. Üksikasjad tagasimaksete kohta leiate artiklist [Tagasimaksed](/hilfe/zahlungen/rueckerstattungen), lisateenuste kohta artiklist [Lisateenused](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Broneeringu edasilükkamine",
          excerpt:
            "Kuidas lükata olemasolev broneering uuele perioodile, ilma kalendrit segamini ajamata.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Enne edasilükkamist kontrollida" },
            {
              type: "p",
              text: "Enne broneeringu edasilükkamist kontrollige broneeritud objekti saadavust uuel perioodil. myNextDays vabastab algselt reserveeritud ööd alles siis, kui uus periood on kinnitatud — nii ei teki lünka, kus objekt loetakse ekslikult vabaks või topeltbroneerituks.",
            },
            {
              type: "steps",
              items: [
                "Avage broneering Reserveeringutes.",
                "Valige „Lükka edasi“ ja sisestage uus periood.",
                "Kontrollige kuvatud saadavust uute kuupäevade jaoks.",
                "Kinnitage edasilükkamine.",
                "Kontrollige, kas uue ööde arvu tõttu muutub hind, ja kohandage vajadusel.",
              ],
            },
            { type: "h2", text: "Mis toimub automaatselt" },
            {
              type: "p",
              text: "Pärast kinnitamist vabastatakse vanad ööd kalendris korrektselt ja uued ööd blokeeritakse, ühendatud portaalid uuendatakse. Toiming logitakse broneeringu ajajoonele.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Kui broneering saabus portaali kaudu, võib edasilükkamine seal alluda oma reeglitele — kontrollige portaali eeskirju enne suuremate muudatuste tegemist.",
            },
            { type: "h2", text: "Maksete erinevused" },
            {
              type: "p",
              text: "Kui hind muutub edasilükkamise tõttu, kohandage maksereegleid vastavalt — vt [Maksereeglid](/hilfe/zahlungen/zahlungsregeln). Rohkem broneeringu kogukäigust leiate artiklist [Broneeringu ajajoon](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Tühistamine ja tagasimakse",
          excerpt:
            "Kuidas tühistada broneering korrektselt ja vajadusel algatada tagasimakse.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Broneeringu tühistamine" },
            {
              type: "p",
              text: "Tühistamine vabastab objekti broneeritud perioodiks kohe uuesti — nii Teie kalendris kui ka kõikidel ühendatud portaalidel. Enne tühistamist kontrollige, millised tühistamistingimused sellele broneeringule kehtivad.",
            },
            {
              type: "steps",
              items: [
                "Avage broneering Reserveeringutes.",
                "Valige „Tühista“ ja sisestage põhjus.",
                "Kontrollige pakutud tagasimakse summat.",
                "Kinnitage tühistamine.",
              ],
            },
            { type: "h2", text: "Tagasimakse algatamine" },
            {
              type: "p",
              text: "Kui makse töödeldi ühendatud makseteenuse pakkuja kaudu, saate algatada tagasimakse otse broneeringust. Summa esitatakse selle objekti jaoks sisestatud valuutas. Üksikasjad protsessi kohta leiate artiklist [Tagasimaksed](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Täielik või osaline tagasimakse võimalik",
                "Toiming ilmub broneeringu ajajoonel",
                "Portaali broneeringute puhul kehtivad lisaks vastava portaali reeglid",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Tühistamist ei saa tagasi võtta. Kontrollige perioodi ja külalist hoolikalt enne kinnitamist.",
            },
            { type: "h2", text: "Pärast tühistamist" },
            {
              type: "p",
              text: "Objekt on nüüd uuesti broneeritav, avatud ülesanded broneeringu kohta — näiteks ettevalmistus — märgitakse automaatselt enam mittevajalikuks. Kogu toiming jääb jälgitavaks [Broneeringu ajajoonel](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Sisseregistreerimine ja väljaregistreerimine",
          excerpt: "Kuidas dokumenteerida külalise saabumine ja lahkumine myNextDays'is.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Sisseregistreerimise sisestamine" },
            {
              type: "p",
              text: "Sisseregistreerimine märgib viibimise alguse ja on eriti kasulik iseteeninduse sisseregistreerimise või meeskonna võtmeüleandmise korral, et hoida iga broneeringu olek ajakohasena.",
            },
            {
              type: "steps",
              items: [
                "Avage broneering Reserveeringutes.",
                "Valige „Sisseregistreerimine“ saabumispäeval.",
                "Sisestage vajadusel märkus, näiteks kellaaeg või eripärad.",
              ],
            },
            { type: "h2", text: "Väljaregistreerimine ja üleandmine" },
            {
              type: "p",
              text: "Väljaregistreerimisel märgite viibimise lõpetatuks. See käivitab paljudel juhtudel automaatselt objekti koristusülesande, et see valmistataks ette järgmise broneeringu jaoks.",
            },
            {
              type: "ul",
              items: [
                "Sisse- ja väljaregistreerimine on osa broneeringu ajajoonest",
                "Kellaajad saab objekti kohta defineerida objekti seadetes",
                "Mobiilse juurdepääsu korral saab meeskond sisse- ja väljaregistreerimise sisestada otse kohapeal",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ununenud väljaregistreerimine ei blokeeri automaatselt järgnevaid ülesandeid — kontrollige regulaarselt tähtaega ületanud olekuid Reserveeringutes.",
            },
            { type: "h2", text: "Seos ülesannetega" },
            {
              type: "p",
              text: "Sisse- ja väljaregistreerimine on tihedalt seotud ülesannete ja ajajoonega. Rohkem kogukäigust lugege artiklist [Broneeringu ajajoon](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Lisateenused",
          excerpt:
            "Kuidas pakkuda külalistele broneeritavaid lisateenuseid nagu hommikusöök või transfer ja need reserveeringus sisestada.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Mis on lisateenused" },
            {
              type: "p",
              text: "Lisateenused on valikulised täiendavad teenused broneeringule — näiteks hommikusöök, varajane saabumine, transfer või hiline väljaregistreerimine. Need sisestatakse objekti kohta ja külaline ise või Teie meeskond saab need broneeringule lisada.",
            },
            {
              type: "steps",
              items: [
                "Avage objekt ja looge „Lisateenused“ all soovitud teenused koos hinnaga.",
                "Avage olemasolev broneering Reserveeringutes.",
                "Valige „Lisa lisateenus“ ja valige soovitud teenus.",
                "Kinnitage teenuse kogus ja ajahetk.",
              ],
            },
            { type: "h2", text: "Arveldamine" },
            {
              type: "p",
              text: "Lisateenuseid arveldatakse vastava objekti valuutas ja need kuvatakse arvel eraldi kirjena. Juba tasutud lisateenuseid saab tühistamisel proportsionaalselt tagasi maksta.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Sisestage populaarsed lisateenused üks kord tsentraalselt objekti juures — nii saab neid iga uue broneeringu puhul mõne klõpsuga lisada.",
            },
            { type: "h2", text: "Nähtavus külalisele" },
            {
              type: "p",
              text: "Kui platvorm või oma veebileht on aktiivne, saavad külalised sobivaid lisateenuseid sageli juba broneeringu ajal ise valida. Iga täiendus ilmub seejärel [Broneeringu ajajoonele](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Lisateenuseid saab objekti kohta individuaalselt nimetada ja hinnastada",
                "Hilisem lisamine on igal ajal broneeringu kaudu võimalik",
                "Tühistatud lisateenused makstakse proportsionaalselt tagasi",
              ],
            },
          ],
        },
      ],
    },
  ],
};
