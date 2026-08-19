import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Üürihinnad",
  description: "Määrake üürihinnad optimaalselt.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Üürihinnad",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Kõrghooaja hindade optimeerimine",
          excerpt: "Kuidas tõsta sihipäraselt hindu suure nõudlusega perioodideks.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord",
            },
            {
              type: "p",
              text: "Kõrghooajal kasvab nõudlus märgatavalt, samal ajal kui Teie põhihind kehtib samade väärtustega mis ülejäänud aastal. Ilma hooajalise kohandamiseta jätate aasta kõige tugevama perioodi käibe kasutamata — kohandamine toimub Teie objekti hinnaplaani kaudu, mitte üksikute päevade käsitsi ülekirjutamisega.",
            },
            {
              type: "steps",
              items: [
                "Avage puudutatud objekti hinnaplaan ja looge hooajareegel soovitud perioodi jaoks.",
                "Määrake juurdehindlus protsendina või fikseeritud summana põhihinna kohal — hinnaplaan võtab objekti valuuta automaatselt üle.",
                "Kontrollige kalendris, et uus hind kuvatakse kõrghooaja perioodi jaoks korrektselt, enne kui selle aktiveerite.",
                "Kontrollige kõrghooaja minimaalset peatumisaega — sageli on mõistlik kõrgem minimaalne broneerimispikkus, et hoida täituvus planeeritavana.",
                "Jälgige pärast aktiveerimist broneeringute seisu esimeste päevade jooksul ja kohandage juurdehindlust vajadusel.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Hooajareegel mõjutab kanaliüleselt portaale, platvormi ja veebilehte võrdselt. Üksikasjad reeglite ülesehituse kohta leiate artiklist [Hinnaplaanid](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Pikemate viibimiste soodustamine allahindlusega",
          excerpt: "Kuidas premeerida külalisi pikema viibimisajaga ja vähendada vahetuskoormust.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord",
            },
            {
              type: "p",
              text: "Lühikesed viibimised tähendavad rohkem saabumisi ja lahkumisi, rohkem koristusi ja suuremat tühjalt seismise riski broneeringute vahel. Astmeline peatumisallahindlus muudab pikemad broneeringud külaliste jaoks atraktiivsemaks ja vähendab seda koormust märgatavalt.",
            },
            {
              type: "steps",
              items: [
                "Avage objekti hinnaplaan ja looge peatumisallahindlus.",
                "Määrake vähemalt üks aste, näiteks alates 7 ööst või alates 28 ööst, vastava allahindluse määraga.",
                "Kontrollige, et astmed ei kattu ja allahindlus kehtib alles vastavast miinimumkestusest alates.",
                "Testige kalendris näidisbroneeringut üle allahindluse piiri, et kinnitada korrektne rakendumine.",
                "Aktiveerige allahindlus ja jälgige mõju keskmisele viibimisajale ja täituvusele.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Peatumisallahindlusi saab kombineerida hooajareeglitega — hinnaplaan arvutab mõlemad kohandused kokku. Rohkem selle kohta artiklis [Hinnaplaanid](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
