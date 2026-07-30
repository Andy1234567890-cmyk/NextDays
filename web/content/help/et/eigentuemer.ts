import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Omanikud ja arvestused",
  description: "Omanikukontod, arvestused ja vahendustasud.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Omanikud",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Omaniku loomine",
          excerpt: "Kuidas luua uus omanikukonto myNextDays'is.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Omanikud on myNextDays'is oma kontod, mille kaudu haldate objekte, mis kuuluvad konkreetsele isikule või ettevõttele. Omanikukonto saab piiratud, ainult vaatamisõigusega ülevaate oma objektidest, ilma õiguseta ise ettevõttes muudatusi teha.",
            },
            { type: "h2", text: "Uue omanikukonto loomine" },
            {
              type: "steps",
              items: [
                "Avage peamenüüst jaotis „Omanikud“.",
                "Klõpsake „Loo uus omanik“.",
                "Sisestage nimi, e-posti aadress ja kontaktandmed.",
                "Sisestage vajadusel arve aadress arvestuste jaoks.",
                "Salvestage konto.",
              ],
            },
            { type: "h2", text: "Juurdepääsu seadistamine" },
            {
              type: "p",
              text: "Pärast loomist saate saata omanikule kutse oma juurdepääsu jaoks. Omanik logib seejärel sisse oma andmetega ja näeb ainult talle seostatud objekte.",
            },
            {
              type: "ul",
              items: [
                "Omanikukonto võib hõlmata mitut objekti.",
                "Iga objekt kuulub täpselt ühele omanikule.",
                "Kontaktandmeid ja arve aadressi saab igal ajal hiljem kohandada.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kuidas seostada olemasolev objekt omanikuga, lugege artiklist [Objekti seostamine omanikuga](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Objekti seostamine omanikuga",
          excerpt: "Iga objekt kuulub täpselt ühele omanikule — nii seadistate seose.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays'is kuulub iga objekt täpselt ühele omanikule. Mitmikomistus ei ole ette nähtud — kui objekt peab kuuluma teisele omanikule, lahutage esmalt olemasolev seos, enne kui seate uue.",
            },
            { type: "h2", text: "Seose loomine" },
            {
              type: "steps",
              items: [
                "Avage objekt „Objektid“ all.",
                "Liikuge vahekaardile „Omanik“.",
                "Valige nimekirjast vastutav omanik.",
                "Kinnitage seos.",
                "Salvestage muudatus objekti juures.",
              ],
            },
            { type: "h2", text: "Omaniku vahetumine" },
            {
              type: "p",
              text: "Kui objekti omanik muutub, näiteks müügi tõttu, asendage olemasolev seos uuega. Juba loodud arvestused möödunud perioodide kohta jäävad seotuks algse omanikuga.",
            },
            {
              type: "ul",
              items: [
                "Objekt saab olla igal ajahetkel seotud ainult ühe omanikuga.",
                "Ilma seoseta ei ilmu objekt ühegi omaniku juurdepääsus.",
                "Möödunud arvestused jäävad alles algse omaniku juures.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Objekti seostamine mitme omanikuga korraga on välistatud — süsteem ei luba teist samaaegset seost.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Omaniku arvestus (statement)",
          excerpt: "Kuidas koostada statement tulude ja mahaarvatud vahendustasuga omaniku jaoks.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Omaniku arvestus, mida nimetatakse ka statement'iks, koondab valitud perioodi kohta kõik seostatud objektide tulud ja arvab maha Teie kokkulepitud vahendustasu. Tulemus on summa, mille maksate omanikule välja.",
            },
            { type: "h2", text: "Statement'i koostamine" },
            {
              type: "steps",
              items: [
                "Avage jaotis „Omanikud“ ja valige soovitud omanik.",
                "Liikuge vahekaardile „Arvestus“.",
                "Valige arveldusperiood.",
                "Kontrollige loetletud broneeringuid ja tulusid objekti kaupa.",
                "Laske koostada statement mahaarvatud vahendustasuga.",
              ],
            },
            { type: "h2", text: "Statement'i ülesehitus" },
            {
              type: "p",
              text: "Statement loetleb objekti kaupa broneeringute brutotulu, sellest mahaarvatud vahendustasu ja tulemuseks oleva väljamaksesumma. Lisakulud, näiteks koristus või tasud, võib olenevalt kokkuleppest esitada eraldi.",
            },
            {
              type: "ul",
              items: [
                "Brutotulu: kõikide perioodi broneeringute summa objekti kohta.",
                "Vahendustasu: Teie kokkulepitud osa, arvatakse tuludest maha.",
                "Väljamaksesumma: tulud miinus vahendustasu ja vajadusel täiendavad kirjed.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Statement'i summad esitatakse alati objekti valuutas — ühtset valuuta-varuväärtust ei ole.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Koostage statement'id regulaarselt samal kuupäeval, et omanikel oleks usaldusväärne rütm oma väljamaksete jaoks.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Omaniku juurdepääs",
          excerpt: "Mida omanikud näevad oma ainult vaatamisõigusega juurdepääsus.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Omaniku juurdepääs on eraldi, ainult vaatamisõigusega sisselogimine myNextDays'i. Omanikud näevad seal ainult neile seostatud objekte ning vastavaid täituvusi ja arvestusi — ilma võimaluseta ise seadeid muuta.",
            },
            { type: "h2", text: "Mida omanikud näevad" },
            {
              type: "ul",
              items: [
                "Oma objektide täituvuskalender.",
                "Loodud statement'id koos tulude ja mahaarvatud vahendustasuga.",
                "Oma objektide põhiandmed, näiteks varustus ja kirjeldus.",
              ],
            },
            { type: "h2", text: "Juurdepääsu aktiveerimine" },
            {
              type: "steps",
              items: [
                "Avage omanik „Omanikud“ all.",
                "Klõpsake „Kutsu juurdepääsule“.",
                "Omanik saab e-kirja oma parooli seadistamiseks.",
                "Pärast sisselogimist näeb omanik automaatselt ainult talle seostatud objekte.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Omaniku juurdepääs on rangelt ainult vaatamisõigusega: hindu, saadavust või objekti andmeid saab muuta ainult Teie ettevõttena, mitte omanik ise.",
            },
            {
              type: "note",
              variant: "info",
              text: "Rohkem objektide seostamisest leiate artiklist [Objekti seostamine omanikuga](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
