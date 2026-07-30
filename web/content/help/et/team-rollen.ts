import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Meeskond ja õigused",
  description: "Töötajad, rollid ja juurdepääsuõigused.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Juurdepääs",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Töötaja kutsumine",
          excerpt: "Kuidas kutsuda uusi töötajaid oma myNextDays kontole.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Oma ettevõttesse saate kutsuda soovi korral piiramatu arvu töötajaid — näiteks vastuvõtu, koristuse või halduse jaoks. Iga kutse on seotud e-posti aadressiga ja määrab kohe kindla rolli, mis määrab juurdepääsu veebis ja myNextDays rakenduses.",
            },
            { type: "h2", text: "Kutse saatmine" },
            {
              type: "steps",
              items: [
                "Avage „Konto“ ja liikuge jaotisse „Meeskond“.",
                "Klõpsake „Kutsu töötaja“.",
                "Sisestage isiku e-posti aadress.",
                "Valige sobiv roll, nt Töötaja või Koristus.",
                "Kinnitage kutse.",
              ],
            },
            { type: "h2", text: "Mis juhtub pärast" },
            {
              type: "p",
              text: "Kutsutud isik saab e-kirja lingiga, et määrata endale parool ja logida sisse. Sisselogimine kehtib võrdselt veebi töölaual ja myNextDays rakenduses — igal frontendil eraldi kontot ei ole.",
            },
            {
              type: "ul",
              items: [
                "Kutse kehtib, kuni see aktsepteeritakse või tühistatakse.",
                "Avatud kutsed näete jaotises „Meeskond“ olekuga „Ootel“.",
                "Rolli saab igal ajal hiljem kohandada.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Milline roll näeb milliseid valdkondi, saate teada artiklist [Rollid ja õigused](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Määrake algusest peale kõige kitsam sobiv roll — õigusi saab hiljem igal ajal laiendada.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Rollid ja õigused",
          excerpt: "Viis rolli myNextDays'is ja mida igaüks tohib teha.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays eristab viit rolli: administraator, kaasadministraator, töötaja, koristus ja omanik. Iga roll määrab, millised valdkonnad on nähtavad veebi töölaual ja myNextDays rakenduses — õigused jõustatakse serveripoolselt, mitte ainult kasutajaliideses peidetuna.",
            },
            { type: "h2", text: "Rollide ülevaade" },
            {
              type: "ul",
              items: [
                "Administraator: täielik juurdepääs kõikidele valdkondadele, sealhulgas finantsid, müük ja meeskonna haldamine.",
                "Kaasadministraator: peaaegu täielik juurdepääs nagu administraatoril, ettevõtte teise juhtimistasandi jaoks.",
                "Töötaja: operatiivne juurdepääs broneeringutele, kalendrile ja ülesannetele, ilma finants- või müügiülevaateta.",
                "Koristus: juurdepääs ainult määratud koristusülesannetele ja objekti üksikasjadele, ilma finants- või müügiülevaateta.",
                "Omanik: kirjutuskaitstud ülevaade oma objektidest, ilma teiste objektide haldamise õiguseta.",
              ],
            },
            { type: "h2", text: "Rolli määramine või muutmine" },
            {
              type: "steps",
              items: [
                "Avage „Konto“ → „Meeskond“.",
                "Valige nimekirjast puudutatud töötaja.",
                "Klõpsake „Muuda rolli“.",
                "Valige uus roll ja kinnitage.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Töötaja ja koristus ei näe põhimõtteliselt hindu, käivet ega müügikanaleid — see piirang kehtib serveripoolselt ja seda ei saa kasutajaliidese kaudu vältida.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ülevaate rollide kaupa leiate artiklist [Mida iga roll näeb](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Mida iga roll näeb",
          excerpt: "Konkreetsed valdkonnad ja vaated rolliti veebis ja rakenduses.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Lisaks artikli [Rollid ja õigused](/hilfe/team-rollen/rollen-berechtigungen) põhiõigustele aitab konkreetne vaade üksikutele valdkondadele, et Te saaksite uute töötajate sisseelamisel seada õiged ootused.",
            },
            { type: "h2", text: "Kalender ja broneeringud" },
            {
              type: "p",
              text: "Administraator, kaasadministraator ja töötaja näevad täielikku täituvusplaani koos külaliste andmete ja ülesannetega. Koristus näeb ainult talle määratud termineid koos objekti aadressi ja kontrollnimekirjaga, kuid mitte külaliste nimesid ega hindu. Omanikud näevad täituvuskalendrit ainult oma objektide kohta, ainult lugemisõigusega.",
            },
            { type: "h2", text: "Finantsid ja müük" },
            {
              type: "ul",
              items: [
                "Käive, vahendustasud ja arved: ainult administraator ja kaasadministraator.",
                "Portaalid (OTA ühendus) ja platvormi nähtavus: ainult administraator ja kaasadministraator.",
                "Töötaja ja koristus: puudub juurdepääs finants- või müügivaldkondadele, ka mitte üksikasjade lehtedele.",
              ],
            },
            { type: "h2", text: "Meeskond ja seaded" },
            {
              type: "p",
              text: "Töötajate, rollide ja konto seadete haldamine jääb administraatori ja kaasadministraatori pärusmaaks. Omanikud ja operatiivsed rollid ei näe seda valdkonda üldse ei myNextDays rakenduses ega veebi töölaual.",
            },
            {
              type: "note",
              variant: "info",
              text: "See jaotus kehtib identselt veebi töölaual ja myNextDays rakenduses, kuna mõlemad frontendid päringavad sama rolli Teie kontolt.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Testige uusi rolle pärast kutsumist lühidalt koos töötajaga, et vältida arusaamatusi nähtavate valdkondade osas.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Juurdepääsu tühistamine",
          excerpt: "Eemaldage töötaja juurdepääs kohe ja täielikult.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Kui töötaja lahkub Teie ettevõttest või koostöö muutub, eemaldage juurdepääs otse Konto all. Tühistamine jõustub serveripoolselt ja kohe — mitte alles olemasoleva seansi lõppedes.",
            },
            { type: "h2", text: "Juurdepääsu eemaldamine" },
            {
              type: "steps",
              items: [
                "Avage „Konto“ → „Meeskond“.",
                "Valige puudutatud töötaja.",
                "Klõpsake „Tühista juurdepääs“.",
                "Kinnitage toiming.",
              ],
            },
            { type: "h2", text: "Mõju käimasolevatele seanssidele" },
            {
              type: "p",
              text: "Pärast tühistamist ei saa isik enam sisse logida ei veebi töölauale ega myNextDays rakendusse. Juba määratud ülesanded või koristustermininid tuleks eelnevalt seostada teise töötajaga, et miski ei jääks töötlemata.",
            },
            {
              type: "ul",
              items: [
                "Määrake avatud ülesanded enne tühistamist ümber.",
                "Juurdepääsu saab hiljem uue kutse kaudu taastada.",
                "Tühistamine puudutab ainult seda ettevõtet, mitte isiku teisi kontosid.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Tühistage juurdepääs koheselt, niipea kui koostöö lõpeb — avatud töötajakontod jäävad muidu tarbetuks turvariskiks.",
            },
          ],
        },
      ],
    },
  ],
};
