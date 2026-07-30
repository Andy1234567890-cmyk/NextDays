import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Veebileht",
  description: "Kasutage oma veebilehte optimaalselt.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Veebileht",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Veebilehe avaldamine",
          excerpt: "Kuidas avaldada oma veebileht iseseisva müügikanalina.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord",
            },
            {
              type: "p",
              text: "Teie veebileht on oma müügikanal koos portaalide ja platvormiga. Ehitate lehed redaktoris üles, kuid alles avaldamisega muutub veebileht külalistele nähtavaks ja Teie objektid ilmuvad seal broneeritavana.",
            },
            {
              type: "steps",
              items: [
                "Avage veebilehe redaktor ja kontrollige, kas kõik soovitud lehed on sisuga täidetud.",
                "Valige objekti vahekaardil iga objekti kohta, kas see peaks olema veebilehel nähtav — see nähtavus on sõltumatu portaalidest ja platvormist.",
                "Kontrollige eelvaadet arvuti ja mobiilivaates enne otseülekandesse minemist.",
                "Klõpsake „Avalda“, et vabastada veebileht külaliste jaoks.",
                "Kontrollige pärast avaldamist avalikku URL-i ja testige näidisbroneeringut veebilehe kaudu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Objekti veebilehe nähtavus on oma telg — objekt võib olla portaalidel aktiivne, kuid veebilehel peidetud, ja vastupidi. Üksikasjad artiklis [Oma domeeni seadistamine](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Oma domeeni seadistamine",
          excerpt: "Kuidas ühendada oma domeen Teie myNextDays veebilehega.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord",
            },
            {
              type: "p",
              text: "Oma domeen nagu www.teie-ettevote.ee mõjub professionaalsemalt kui standardaadress ja tugevdab Teie brändi külaliste seas, kes soovivad Teie juures otse broneerida.",
            },
            {
              type: "steps",
              items: [
                "Avage veebilehe redaktoris jaotis „Domeen“ ja sisestage soovitud oma domeen.",
                "Seadistage oma domeeniteenuse pakkuja juures kuvatud DNS-kirjed (tavaliselt CNAME või A-kirje).",
                "Oodake, kuni domeen kuvatakse ühendatuna ja SSL-sertifikaat aktiivsena — see võib pakkujast olenevalt võtta mõne tunni.",
                "Testige oma domeeni avamist privaatses brauseriaknas, et välistada vahemällu salvestatud vanad kirjed.",
                "Kontrollige, et vanad standardaadressid suunavad jätkuvalt uuele domeenile, et olemasolevad lingid ei jääks kehtetuks.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Muutke DNS-kirjeid ainult vastavalt kuvatule — valed väärtused võivad häirida Teie domeeni olemasolevaid e-posti seadeid. Kahtluse korral konsulteerige oma domeeniteenuse pakkujaga enne olemasolevate kirjete ülekirjutamist.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Otsebroneeringute suurendamine",
          excerpt: "Kuidas suunata rohkem külalisi oma veebilehele portaalide asemel.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord",
            },
            {
              type: "p",
              text: "Broneeringud oma veebilehe kaudu on Teie ettevõtte jaoks tavaliselt soodsamad kui portaalide kaudu, kuna siin ei kohaldu portaali vahendustasu. Mõne sihipärase meetmega suurendate otsebroneeringute osakaalu oma veebilehe kui iseseisva kanali kaudu.",
            },
            {
              type: "steps",
              items: [
                "Veenduge, et kõik broneeritavad objektid on veebilehel nähtavad ning varustatud ajakohaste fotode ja kirjeldustega.",
                "Seadistage veebilehele ainuomane allahindlus või eelis, näiteks väike hinnasoodustus võrreldes portaalidega.",
                "Lisage oma domeeni link broneeringu kinnitustesse ja suhtlusesse külalistega, kes on juba korra broneerinud.",
                "Kontrollige regulaarselt broneeringute statistikat, et jälgida veebilehe osakaalu kõikidest broneeringutest aja jooksul.",
                "Optimeerige veebilehe laadimisaega ja mobiilikuvamist, kuna suur osa külalisi broneerib nutitelefoni kaudu.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Veebilehele ainuomane eelis toimib ainult siis, kui külalised veebilehe üldse leiavad — viidake sellele aktiivselt, mitte ärge toetuge ainult portaalidele. Avaldamise kohta vt [Veebilehe avaldamine](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
