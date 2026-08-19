import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Kalenteri ja saatavuus",
  description: "Varauskartta, Stop-Sell ja vähimmäisoleskelu.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kalenteri",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Varauskartan lukeminen",
          excerpt: "Näin luet varaukset, saatavuuden ja hinnat varauskartasta oikein.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Varauskartta näyttää yhdellä silmäyksellä, mitkä yöt on varattu, vapaana tai suljettu. Lomakohteissa näet yhden rivin kohdetta kohden, hotelleissa sisäkkäisen näkymän, jossa on rivi jokaista huonekategoriaa ja hintasuunnitelmaa kohden.",
            },
            { type: "h2", text: "Näkymän rakenne" },
            {
              type: "steps",
              items: [
                "Avaa kalenteri valikkokohdasta ”Varauskartta”.",
                "Valitse ylhäältä ajanjakso, jonka haluat nähdä.",
                "Suodata tarvittaessa yksittäisten kohteiden tai huonekategorioiden mukaan.",
                "Napsauta päivää avataksesi tiedot hinnasta ja saatavuudesta.",
                "Napsauta varattua jaksoa avataksesi siihen liittyvän varauksen.",
              ],
            },
            { type: "h2", text: "Värit ja symbolit" },
            {
              type: "ul",
              items: [
                "Varattu: jakso on varattu varauksen kautta.",
                "Vapaa: päivä on varattavissa kaikilla aktiivisilla kanavilla.",
                "Suljettu: päivä ei ole varattavissa Stop-Sell-toiminnon tai käsin tehdyn eston vuoksi.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jokainen varauskartan rivi vastaa täsmälleen yhtä varattavaa yksikköä — huonetta tai lomakohdetta. Yhtä useamman huoneen sisältävää säilörivi­ä ei ole.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Lisää yksittäisten päivien kohdennetusta avaamisesta ja sulkemisesta löydät kohdasta [Saatavuuden asettaminen](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Saatavuuden asettaminen",
          excerpt: "Yksittäisten päivien tai jaksojen kohdennettu avaaminen ja sulkeminen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Saatavuus määrittää, voidaanko kohde varata tiettynä päivänä. Voit avata tai sulkea yksittäisiä päiviä tai kokonaisia jaksoja suoraan varauskartassa.",
            },
            { type: "h2", text: "Jakson muokkaaminen" },
            {
              type: "steps",
              items: [
                "Avaa haluamasi kohteen varauskartta.",
                "Merkitse haluamasi jakso napsauttamalla ja vetämällä.",
                "Valitse toimintovalikosta ”Muuta saatavuutta”.",
                "Vahvista, avataanko vai suljetaanko jakso.",
                "Tallenna muutos.",
              ],
            },
            { type: "h2", text: "Vaikutus kanaviin" },
            {
              type: "p",
              text: "Saatavuuden muutos vaikuttaa kaikkiin myyntikanaviin, joilla kohde on näkyvissä: portaaleihin kuten Booking, Airbnb ja muut, omaan alustaan sekä sovellukseen. Siirto portaaleihin tapahtuu automaattisesti taustalla.",
            },
            {
              type: "ul",
              items: [
                "Avaaminen: päivästä tulee varattava kaikilla aktiivisilla kanavilla.",
                "Sulkeminen: päivä poistuu varattavuudesta, mutta pysyy näkyvissä kalenterissa.",
                "Jo olemassa oleviin varauksiin saatavuuden muutos ei vaikuta.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Älä sulje jaksoa tarkoituksenasi lukita se kokonaan ja pysyvästi myynnistä — siihen tarkoitukseen on Stop-Sell oikea toiminto, katso [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-Sell",
          excerpt: "Stop-Sell sulkee päivän välittömästi kaikilla myyntikanavilla samanaikaisesti.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Stop-Sell on nopein tapa poistaa yksittäinen päivä kokonaan myynnistä. Toisin kuin tavallinen saatavuuden muutos, Stop-Sell vaikuttaa tiukasti ja välittömästi kaikilla kanavilla samanaikaisesti — portaaleissa, omalla alustalla ja sovelluksessa.",
            },
            { type: "h2", text: "Stop-Sellin asettaminen" },
            {
              type: "steps",
              items: [
                "Avaa kyseisen kohteen varauskartta.",
                "Valitse haluamasi päivä tai jakso.",
                "Napsauta toimintovalikosta ”Aktivoi Stop-Sell”.",
                "Vahvista sulkeminen.",
              ],
            },
            { type: "h2", text: "Milloin Stop-Sell on järkevä" },
            {
              type: "ul",
              items: [
                "Lyhytaikaiset huoltotyöt tai tekniset ongelmat kohteessa.",
                "Erikoistapaus, jossa et halua uutta varausta välittömästi ja poikkeuksetta.",
                "Nopea, koko alustan kattava hätäsulku ilman, että jokaista kanavaa käsitellään erikseen.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell ei tunne kanavakohtaisia poikkeuksia: jos päivä on suljettu, mikään vieras ei voi varata sitä millään kanavalla, ei myöskään vastaanotosta tai suoralla tiedustelulla.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pysyvään omakäyttöön tai suunniteltuun huoltoon sopii sen sijaan [Käsin tehtävä esto](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung).",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Vähimmäis- ja enimmäisoleskelu",
          excerpt: "Kuinka pitkään vieraat voivat varata vähintään tai enintään.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Vähimmäis- ja enimmäisoleskelulla määrität, kuinka monta yötä vieras voi vähintään tai enintään varata tietylle saapumispäivälle. Tämä auttaa välttämään lyhyitä aukkovarauksia tai kohdentamaan kohteesi pidemmille oleskeluille.",
            },
            { type: "h2", text: "Säännön käyttöönotto" },
            {
              type: "steps",
              items: [
                "Avaa kohteessa varauskartta tai välilehti ”Hinnat”.",
                "Valitse haluamasi jakso.",
                "Kirjaa kohtaan ”Vähimmäisoleskelu” pienin sallittu yömäärä.",
                "Kirjaa halutessasi kohtaan ”Enimmäisoleskelu” suurin sallittu yömäärä.",
                "Tallenna sääntö.",
              ],
            },
            { type: "h2", text: "Tyypilliset käyttötapaukset" },
            {
              type: "ul",
              items: [
                "Sesonkihuippu: korkeampi vähimmäisoleskelu vaihtopäivien yhdistämiseksi.",
                "Hiljaisempi kausi: matalampi vähimmäisoleskelu useampien varausten mahdollistamiseksi.",
                "Enimmäisoleskelu: hyödyllinen, jos kohteen tulee olla vapaa sen jälkeen huoltoa tai muuta käyttöä varten.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Sääntö koskee saapumispäivää: vieras ei voi saapua kolmen yön vähimmäisoleskelun päivänä vain kahdeksi yöksi, vaikka yksittäiset päivät olisivat vapaita.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Yhdistä pidemmät vähimmäisoleskelut kohtaan [Oleskelualennukset](/hilfe/preise-raten/aufenthaltsrabatte) kasvattaaksesi vieraiden kannustinta.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Käsin tehtävä esto",
          excerpt: "Jaksojen kohdennettu varaaminen omakäyttöön tai huoltoon.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Käsin tehtävä esto varaa jakson kalenteriin ilman, että kyseessä on todellinen vieraan varaus — esimerkiksi omakäyttöä, suunniteltuja huoltotöitä tai remonttia varten. Jakso näytetään varauskartassa varauksen tapaan, mutta se on selvästi tunnistettavissa estoksi.",
            },
            { type: "h2", text: "Eston luominen" },
            {
              type: "steps",
              items: [
                "Avaa kyseisen kohteen varauskartta.",
                "Merkitse haluamasi jakso.",
                "Valitse toimintovalikosta ”Estä käsin”.",
                "Anna syy, esim. ”Omakäyttö” tai ”Huolto”.",
                "Tallenna esto.",
              ],
            },
            { type: "h2", text: "Ero Stop-Selliin" },
            {
              type: "p",
              text: "Käsin tehtävä esto varaa konkreettisesti jakson tiettyä, dokumentoitua tarkoitusta varten, ja se voidaan myöhemmin vapauttaa. Välittömään, koko alustan kattavaan hätäsulkuun ilman dokumentoitua jaksoa on sen sijaan tarkoitettu Stop-Sell.",
            },
            {
              type: "ul",
              items: [
                "Käsin tehtävä esto: suunniteltu, syyn kanssa, omakäyttöä tai huoltoa varten.",
                "Vapautus mahdollista milloin tahansa, kun jaksoa ei enää tarvita.",
                "Estetyt yöt eivät lasketa vieraan varaukseksi eivätkä näy liikevaihtokatsauksessa.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Poista käsin tehty esto heti, kun syy poistuu — muuten kohde pysyy tarpeettomasti suljettuna kaikilla kanavilla.",
            },
            {
              type: "note",
              variant: "info",
              text: "Välittömään sulkemiseen ilman suunniteltua jaksoa käytä [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell) -toimintoa.",
            },
          ],
        },
      ],
    },
  ],
};
