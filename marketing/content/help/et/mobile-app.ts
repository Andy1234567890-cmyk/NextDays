import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Mobiilirakendus",
  description: "myNextDays rakendus liikvel olles.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "Rakendus",
      articles: [
        {
          slug: "die-app",
          title: "myNextDays rakendus",
          excerpt: "Üks konto, neli kogemust: külaline, agentuur, omanik ja töötaja.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays rakendus on mobiilne platvorm kogu Teie ettevõtte jaoks. See ei ole eraldi toode, vaid võrdväärne frontend Teie veebi töölauale — mõlemad kasutavad sama kontot ja samu andmeid, ainult kasutajaliides on optimeeritud liikvel olemiseks.",
            },
            { type: "h2", text: "Neli kogemust ühes rakenduses" },
            {
              type: "ul",
              items: [
                "Külaline: broneeringute vaatamine, ettevõttega suhtlemine, sisseregistreerimise info vaatamine.",
                "Agentuur: mitme ettevõtte ja objekti ülevaatlik haldamine.",
                "Omanik: kirjutuskaitstud ülevaade oma objektidest, täituvusest ja aruannetest.",
                "Töötaja: kalender, ülesanded ja koristuskavad igapäevase operatiivse töö jaoks.",
              ],
            },
            { type: "h2", text: "Millist kogemust Te näete" },
            {
              type: "p",
              text: "Pärast sisselogimist kuvab rakendus automaatselt Teie rollile sobiva kogemuse — sama roll, mis kehtib ka veebi töölaual. Piiratud õigustega töötaja näeb rakenduses täpselt samu piiranguid nagu brauseris, kuna õigused kontrollitakse serveripoolselt.",
            },
            {
              type: "note",
              variant: "info",
              text: "Rohkem rollidest ja sellest, mida iga roll näeb, leiate artiklist [Rollid ja õigused](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Rakenduse jaoks ei ole vaja eraldi registreerimist — logige lihtsalt sisse oma olemasolevate myNextDays sisselogimisandmetega.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Rakenduse paigaldamine ja sisselogimine",
          excerpt: "Kuidas laadida alla myNextDays rakendus ja sisse logida.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays rakendus on saadaval iOS-ile ja Androidile. Sisselogimine toimub samade andmetega mis veebi töölaual — eraldi kontot ega uuesti registreerimist ei ole vaja.",
            },
            { type: "h2", text: "Paigaldamine" },
            {
              type: "steps",
              items: [
                "Avage App Store (iOS) või Google Play (Android).",
                "Otsige „myNextDays“.",
                "Paigaldage rakendus oma nutitelefonile või tahvelarvutile.",
                "Avage rakendus pärast paigaldamist.",
              ],
            },
            { type: "h2", text: "Sisselogimine" },
            {
              type: "steps",
              items: [
                "Puudutage „Logi sisse“.",
                "Sisestage oma e-posti aadress ja parool.",
                "Kinnitage vajadusel kaheastmelise autentimise päring.",
                "Jõuate automaatselt Teie rollile sobivasse kogemusse.",
              ],
            },
            {
              type: "ul",
              items: [
                "Sisselogimisandmed on identsed veebi töölauaga.",
                "Kui Teie juurdepääs on tühistatud, on ka sisselogimine rakenduses kohe blokeeritud.",
                "Parooliprobleemide korral kasutage rakenduses otse „Unustasin parooli“.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Logige sisse ainult ametliku App Store'i kirje „myNextDays“ kaudu; rakendus ei küsi kunagi sisselogimisandmeid väljaspool sisselogimisekraani.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Haldamine liikvel olles",
          excerpt: "Töödelge broneeringuid, sõnumeid ja ülesandeid otse nutitelefonist.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays rakendus sobib eriti hästi jooksva tegevuse jaoks liikvel olles: näete käimasolevaid broneeringuid, vastate külaliste sõnumitele ja täidate ülesandeid, ilma et peaksite arvuti taga istuma — muudatused ilmuvad reaalajas ka veebi töölaual.",
            },
            { type: "h2", text: "Broneeringud silmapiiril" },
            {
              type: "p",
              text: "Jaotises „Broneeringud“ näete saabumisi ja lahkumisi, täituvust ja olekut objekti kohta. Töötajad ja koristajad näevad seejuures ainult neile olulist infot, ilma hindade või müügiüksikasjadeta.",
            },
            { type: "h2", text: "Sõnumid ja ülesanded" },
            {
              type: "steps",
              items: [
                "Avage jaotis „Sõnumid“, et vastata otse külaliste päringutele.",
                "Liikuge jaotisse „Ülesanded“, et näha Teile määratud tegevusi.",
                "Puudutage ülesannet, et avada üksikasjad ja see lõpetada.",
                "Märkige tehtud koristustermininid otse kohapeal lõpetatuks.",
              ],
            },
            {
              type: "ul",
              items: [
                "Uued sõnumid ja ülesanded ilmuvad otseülekandes, ilma käsitsi värskendamiseta.",
                "Lõpetatud ülesanded on kohe nähtavad ka veebi töölaual.",
                "Omanikud näevad oma objektide broneeringuid ja aruandeid, kuid ainult lugemisõigusega.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Push-teavitused teavitavad Teid uutest sõnumitest ja Teile määratud ülesannetest, niipea kui lubate need seadme seadetes.",
            },
          ],
        },
      ],
    },
  ],
};
