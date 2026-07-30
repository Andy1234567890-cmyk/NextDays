import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Sõnumid ja külalised",
  description: "Postkast, mallid ja külalistega suhtlus.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Suhtlus",
      articles: [
        {
          slug: "posteingang",
          title: "Platvormi postkast",
          excerpt: "Kõik Teie objektide külaliste sõnumid koonduvad tsentraalselt platvormi postkastis.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Üks postkast kõikide objektide jaoks" },
            {
              type: "p",
              text: "Platvormi postkast koondab kõik Teie külaliste sõnumid ühte kohta — sõltumata sellest, millise objekti või perioodi kaudu vestlus toimub. Avate selle /nachrichten all ja näete seal iga vestlust eraldi lõimena.",
            },
            { type: "h2", text: "Postkasti ülesehitus" },
            {
              type: "ul",
              items: [
                "Vasak veerg: kõikide vestluste nimekiri, uuemad ees",
                "Keskmine veerg: aktiivne sõnumivahetus külalisega",
                "Parem veerg: reserveeringu kontekst — periood, objekt, külalise andmed",
              ],
            },
            { type: "h2", text: "Sõnumile vastamine" },
            {
              type: "steps",
              items: [
                "Avage /nachrichten ja valige soovitud vestlus",
                "Kirjutage oma vastus tekstiväljale või kasutage kiirvastust",
                "Saatke sõnum — külaline saab selle samal viisil, mille kaudu ta kirjutas",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Platvormi postkast näitab ainult otsest suhtlust Teie ja Teie külaliste vahel myNextDays'is — portaalide sõnumeid töötlete jätkuvalt seal.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Kiirvastused",
          excerpt: "Mallid sagedaste küsimuste jaoks säästavad aega külalistega suhtlemisel.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Mis on kiirvastused" },
            {
              type: "p",
              text: "Kiirvastused on eelvormistatud tekstiplokid korduvate küsimuste jaoks — näiteks saabumise, WiFi parooli või parkimisolukorra kohta. Selle asemel, et iga vastus uuesti trükkida, lisate sobiva malli ühe klõpsuga [Platvormi postkasti](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Kiirvastuse loomine" },
            {
              type: "steps",
              items: [
                "Avage /nachrichten ja klõpsake „Halda kiirvastuseid“",
                "Klõpsake „Uus mall“ ja andke pealkiri, näiteks „Sisseregistreerimise info“",
                "Kirjutage vastuse tekst; kohatäited nagu külalise nimi või saabumiskuupäev sisestatakse saatmisel automaatselt",
                "Salvestage mall — see on kohe saadaval igas vestluses",
              ],
            },
            { type: "h2", text: "Kiirvastuste kasutamine igapäevaselt" },
            {
              type: "p",
              text: "Sõnumiaknas avate mallide nimekirja välgu ikooni kaudu, valite sobiva vastuse ja kohandate seda vajadusel enne saatmist individuaalselt.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Looge mallid viie kuni kümne sagedasema küsimuse jaoks — see katab praktikas suurema osa sissetulevatest sõnumitest.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Automaatsed sõnumid",
          excerpt: "Kinnitused, sisseregistreerimise infot ja meeldetuletusi saab külalistele saata automaatselt.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Korduvate sõnumite automatiseerimine" },
            {
              type: "p",
              text: "Selle asemel, et saata broneeringu kinnitusi, sisseregistreerimise juhiseid või tänusõnumeid käsitsi, sisestate need üks kord reeglina — myNextDays saadab need seejärel automaatselt sobival ajahetkel enne, ajal või pärast viibimist.",
            },
            { type: "h2", text: "Tüüpilised automaatsete sõnumite käivitajad" },
            {
              type: "ul",
              items: [
                "Kohe pärast broneerimist — kinnitus koos kõige olulisemate andmetega",
                "Mõned päevad enne saabumist — sisseregistreerimise info ja juurdepääsukood",
                "Lahkumispäeval — tänu ja palve jätta hinnang",
              ],
            },
            { type: "h2", text: "Automaatse sõnumi seadistamine" },
            {
              type: "steps",
              items: [
                "Avage /nachrichten, jaotis „Automaatsed sõnumid“",
                "Valige käivitaja, näiteks „X päeva enne saabumist“",
                "Sisestage tekst — kohatäited nagu külalise nimi, objekt või saabumiskuupäev täidetakse automaatselt",
                "Aktiveerige reegel; see kehtib kõikidele objektidele, kui ei ole teisiti piiratud",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Automaatsed sõnumid ilmuvad tavaliselt [Platvormi postkasti](/hilfe/nachrichten/posteingang) ja neid saab seal igal ajal hiljem vaadata.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Sõnumite blokeerimine",
          excerpt: "Saate blokeerida isiku otse sõnumiajaloost edasise kontakti jaoks.",
          updated: "Uuendatud: juuli 2026",
          body: [
            { type: "h2", text: "Millal blokeerimine on mõistlik" },
            {
              type: "p",
              text: "Solvavate sõnumite, ahistamise või korduvalt sobimatu käitumise korral saate isiku otse sõnumilõimest blokeerida. Blokeeritud isik ei saa Teile pärast seda enam uusi sõnumeid kirjutada ega Teie juures uut broneeringut luua.",
            },
            { type: "h2", text: "Isiku blokeerimine lõimest" },
            {
              type: "steps",
              items: [
                "Avage puudutatud vestlus [Platvormi postkastis](/hilfe/nachrichten/posteingang)",
                "Klõpsake lõime ülaosas menüül ja valige „Blokeeri isik“",
                "Kinnitage toiming — blokeering kehtib kohe",
              ],
            },
            { type: "h2", text: "Mida blokeering tähendab — ja mida mitte" },
            {
              type: "ul",
              items: [
                "Blokeeritud isiku uusi sõnumeid enam ei edastata",
                "Isiku uued broneeringupäringud lükatakse tagasi",
                "Kui sellel isikul on hetkel käimasolev reserveering, jääb suhtlus erandkorras viibimise ajaks võimalikuks",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Blokeeringu saab igal ajal tühistada Konto all ülevaates „Blokeeritud isikud“. Kontrollige enne blokeerimist, kas on juba käimasolev broneering.",
            },
          ],
        },
      ],
    },
  ],
};
