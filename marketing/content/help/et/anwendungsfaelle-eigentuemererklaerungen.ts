import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Omanike aruanded",
  description: "Omanike aruannete koostamine.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Omanike aruanded",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Omaniku statement'i loomine",
          excerpt: "Kuidas koostada omanikule ülevaatlik arvestus tema perioodi kohta.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord",
            },
            {
              type: "p",
              text: "Kui haldate objekte omanike jaoks, vajavad nad regulaarselt jälgitavat ülevaadet oma objektide tuludest, mahaarvatud vahendustasust ja väljamaksest kindla perioodi kohta — omaniku statement koondab need andmed automaatselt.",
            },
            {
              type: "steps",
              items: [
                "Avage Konto all jaotis Omanikud ja valige puudutatud omanik.",
                "Valige arveldusperiood, mille kohta statement koostatakse.",
                "Kontrollige, et kõik selle omaniku objektid on korrektselt seostatud, kuna ainult seostatud objektid lähevad statement'i.",
                "Laske statement koostada ja kontrollige loetletud reserveeringute täielikkust.",
                "Tehke statement omanikule kättesaadavaks omaniku juurdepääsu kaudu või eksportige see dokumendina.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Statement näitab iga reserveeringut summaga vastavas objekti valuutas — ühtset valuutaviidet ei ole, kuna mitmel objektil võib olla erinev valuuta. Rohkem seostamisest artiklis [Objekti seostamine omanikuga](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Vahendustasu arveldamine omanikuga",
          excerpt: "Kuidas tagada, et Teie vahendustasu arvutatakse omaniku tuludest korrektselt.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "h2",
              text: "Lähteolukord",
            },
            {
              type: "p",
              text: "Teie vahendustasu objekti haldamise eest on sisestatud omaniku tariifis ja arvatakse igal statement'il automaatselt brutotuludest maha. Selleks et arvestus oleks korrektne, peab vahendustasu määr olema õigesti seatud enne perioodi esimest broneeringut.",
            },
            {
              type: "steps",
              items: [
                "Avage Konto all puudutatud omaniku tariif ja kontrollige sisestatud vahendustasu määra.",
                "Kohandage määra vajadusel enne uute reserveeringute laekumist järgmisel arveldusperioodil.",
                "Koostage omaniku statement perioodi kohta ja kontrollige, et vahendustasu näidatakse iga reserveeringu juures korrektselt.",
                "Kontrollige brutotulude, mahaarvatud vahendustasu ja netoväljamakse summa usutavust.",
                "Selgitage erisused enne statement'i kinnitamist otse omanikuga, selle asemel et statement'i hiljem muuta.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Vahendustasu määra hilisem muutmine mõjutab ainult tulevasi perioode, mitte tagasiulatuvalt juba koostatud statement'eid. Kontrollige määra seetõttu õigeaegselt enne uue arveldusperioodi algust — vt ka [Omaniku arvestus (statement)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
