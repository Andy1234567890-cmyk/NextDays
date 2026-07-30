import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Mobiilisovellus",
  description: "myNextDays-sovellus liikkeellä ollessa.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "Sovellus",
      articles: [
        {
          slug: "die-app",
          title: "myNextDays-sovellus",
          excerpt: "Yksi tili, neljä kokemusta: vieras, agentuuri, omistaja ja työntekijä.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "myNextDays-sovellus on mobiilialusta koko toiminnallesi. Se ei ole erillinen tuote, vaan tasavertainen käyttöliittymä verkkohallintapaneelin rinnalla — molemmat käyttävät samaa tiliä ja samoja tietoja, vain käyttöliittymä on optimoitu liikkeellä oloon.",
            },
            { type: "h2", text: "Neljä kokemusta yhdessä sovelluksessa" },
            {
              type: "ul",
              items: [
                "Vieras: varausten katselu, viestintä yrityksen kanssa, sisäänkirjautumistietojen haku.",
                "Agentuuri: useiden yritysten ja kohteiden hallinta yhdellä silmäyksellä.",
                "Omistaja: kirjoitussuojattu näkymä omiin kohteisiin, käyttöasteeseen ja raportteihin.",
                "Työntekijä: kalenteri, tehtävät ja siivoussuunnitelmat operatiiviseen arkeen.",
              ],
            },
            { type: "h2", text: "Minkä kokemuksen näet" },
            {
              type: "p",
              text: "Kirjautumisen jälkeen sovellus näyttää automaattisesti roolillesi sopivan kokemuksen — saman roolin, joka on voimassa myös verkkohallintapaneelissa. Työntekijä, jolla on rajoitetut oikeudet, näkee sovelluksessa täsmälleen samat rajoitukset kuin selaimessa, koska käyttöoikeus tarkistetaan palvelinpuolella.",
            },
            {
              type: "note",
              variant: "info",
              text: "Lisää rooleista ja siitä, mitä kukin niistä saa nähdä, löydät kohdasta [Roolit ja käyttöoikeudet](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Et tarvitse erillistä rekisteröitymistä sovellukseen — kirjaudu vain olemassa olevilla myNextDays-tunnuksillasi.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Sovelluksen asentaminen ja kirjautuminen",
          excerpt: "Näin lataat myNextDays-sovelluksen ja kirjaudut sisään.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "myNextDays-sovellus on saatavilla iOS:lle ja Androidille. Kirjautuminen tapahtuu samoilla tunnuksilla kuin verkkohallintapaneelissa — erillistä tiliä tai uutta rekisteröitymistä ei tarvita.",
            },
            { type: "h2", text: "Asennus" },
            {
              type: "steps",
              items: [
                "Avaa App Store (iOS) tai Google Play (Android).",
                "Etsi ”myNextDays”.",
                "Asenna sovellus älypuhelimeesi tai tablettiisi.",
                "Avaa sovellus asennuksen jälkeen.",
              ],
            },
            { type: "h2", text: "Kirjautuminen" },
            {
              type: "steps",
              items: [
                "Napauta ”Kirjaudu sisään”.",
                "Syötä sähköpostiosoitteesi ja salasanasi.",
                "Vahvista tarvittaessa kaksivaiheisen tunnistautumisen kysely.",
                "Pääset automaattisesti roolillesi sopivaan kokemukseen.",
              ],
            },
            {
              type: "ul",
              items: [
                "Tunnukset ovat samat kuin verkkohallintapaneelissa.",
                "Jos käyttöoikeutesi on poistettu, myös sovelluksen kirjautuminen estyy heti.",
                "Jos salasanan kanssa on ongelmia, käytä ”Unohditko salasanan” suoraan sovelluksessa.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Kirjaudu sisään yksinomaan virallisen ”myNextDays”-sovelluskauppamerkinnän kautta; sovellus ei koskaan kysy tunnuksia kirjautumisnäytön ulkopuolella.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Hallinnointi liikkeellä ollessa",
          excerpt: "Varausten, viestien ja tehtävien hoitaminen suoraan älypuhelimesta.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "myNextDays-sovellus sopii erityisesti jatkuvaan toimintaan liikkeellä ollessa: näet ajankohtaiset varaukset, vastaat vieraiden viesteihin ja hoidat tehtäviä ilman, että sinun tarvitsee istua tietokoneen ääressä — muutokset näkyvät reaaliajassa myös verkkohallintapaneelissa.",
            },
            { type: "h2", text: "Varaukset hallinnassa" },
            {
              type: "p",
              text: "Osiossa ”Varaukset” näet saapumiset ja lähdöt, käyttöasteen ja tilan kohteittain. Työntekijä ja Siivous näkevät tällöin vain heille olennaiset tiedot, ilman hintoja tai myyntitietoja.",
            },
            { type: "h2", text: "Viestit ja tehtävät" },
            {
              type: "steps",
              items: [
                "Avaa osio ”Viestit” vastataksesi vieraiden pyyntöihin suoraan.",
                "Siirry kohtaan ”Tehtävät” nähdäksesi sinulle osoitetut tehtävät.",
                "Napauta tehtävää avataksesi tiedot ja merkitäksesi sen valmiiksi.",
                "Merkitse valmistuneet siivousajankohdat suoraan paikan päällä valmiiksi.",
              ],
            },
            {
              type: "ul",
              items: [
                "Uudet viestit ja tehtävät näkyvät reaaliajassa ilman käsin päivittämistä.",
                "Valmiiksi merkityt tehtävät näkyvät heti myös verkkohallintapaneelissa.",
                "Omistajat näkevät kohteidensa varaukset ja raportit, mutta vain luku -oikeudella.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Push-ilmoitukset kertovat sinulle uusista viesteistä ja osoitetuista tehtävistä heti, kun sallit ne laitteesi asetuksissa.",
            },
          ],
        },
      ],
    },
  ],
};
