import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Tiimi ja käyttöoikeudet",
  description: "Työntekijät, roolit ja käyttöoikeudet.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Käyttöoikeudet",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Työntekijän kutsuminen",
          excerpt: "Näin kutsut uusia työntekijöitä myNextDays-tilillesi.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Yritykseesi voit kutsua rajattoman määrän työntekijöitä — esimerkiksi vastaanottoon, siivoukseen tai hallintoon. Jokainen kutsu on sidottu sähköpostiosoitteeseen ja antaa heti kiinteän roolin, joka määrittää käyttöoikeuden verkossa ja myNextDays-sovelluksessa.",
            },
            { type: "h2", text: "Kutsun lähettäminen" },
            {
              type: "steps",
              items: [
                "Avaa ”Tili” ja siirry osioon ”Tiimi”.",
                "Napsauta ”Kutsu työntekijä”.",
                "Syötä henkilön sähköpostiosoite.",
                "Valitse sopiva rooli, esim. Työntekijä tai Siivous.",
                "Vahvista kutsu.",
              ],
            },
            { type: "h2", text: "Mitä sen jälkeen tapahtuu" },
            {
              type: "p",
              text: "Kutsuttu henkilö saa sähköpostin, jonka linkin kautta hän asettaa oman salasanan ja kirjautuu sisään. Kirjautuminen koskee samalla tavalla verkkohallintapaneelia ja myNextDays-sovellusta — erillistä tiliä kummallekin käyttöliittymälle ei ole.",
            },
            {
              type: "ul",
              items: [
                "Kutsu on voimassa, kunnes se hyväksytään tai peruutetaan.",
                "Avoimet kutsut näkyvät osiossa ”Tiimi” tilalla ”Odottaa”.",
                "Roolia voi muuttaa myöhemmin milloin tahansa.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Mikä rooli näkee mitäkin osioita, lue kohdasta [Roolit ja käyttöoikeudet](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Anna alusta alkaen mahdollisimman suppea sopiva rooli — oikeuksia voi laajentaa myöhemmin milloin tahansa.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Roolit ja käyttöoikeudet",
          excerpt: "myNextDaysin viisi roolia ja mitä kukin niistä saa tehdä.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "myNextDays erottaa viisi roolia: Admin, Apuadmin, Työntekijä, Siivous ja Omistaja. Jokainen rooli määrittää, mitkä osiot näkyvät verkkohallintapaneelissa ja myNextDays-sovelluksessa — oikeudet valvotaan palvelinpuolella, ei vain piiloteta käyttöliittymästä.",
            },
            { type: "h2", text: "Roolit yhdellä silmäyksellä" },
            {
              type: "ul",
              items: [
                "Admin: täysi pääsy kaikkiin osioihin, mukaan lukien talous, myynti ja tiimin hallinta.",
                "Apuadmin: lähes täysi pääsy kuten Adminilla, yrityksen toiselle johtotasolle.",
                "Työntekijä: operatiivinen pääsy varauksiin, kalenteriin ja tehtäviin, ilman talous- tai myyntinäkymää.",
                "Siivous: pääsy yksinomaan osoitettuihin siivoustehtäviin ja kohteen tietoihin, ilman talous- tai myyntinäkymää.",
                "Omistaja: kirjoitussuojattu näkymä omiin kohteisiin, ei vieraiden kohteiden hallintaa.",
              ],
            },
            { type: "h2", text: "Roolin osoittaminen tai muuttaminen" },
            {
              type: "steps",
              items: [
                "Avaa ”Tili” → ”Tiimi”.",
                "Valitse kyseinen työntekijä listasta.",
                "Napsauta ”Muuta roolia”.",
                "Valitse uusi rooli ja vahvista.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Työntekijä ja Siivous eivät lähtökohtaisesti näe hintoja, liikevaihtoa tai varauskanavia — tämä rajoitus toteutuu palvelinpuolella eikä sitä voi kiertää käyttöliittymän kautta.",
            },
            {
              type: "note",
              variant: "info",
              text: "Yleiskatsauksen roolikohtaisesti löydät kohdasta [Mitä mikäkin rooli näkee](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Mitä mikäkin rooli näkee",
          excerpt: "Konkreettiset osiot ja näkymät roolikohtaisesti verkossa ja sovelluksessa.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Kohdassa [Roolit ja käyttöoikeudet](/hilfe/team-rollen/rollen-berechtigungen) kuvattujen perusoikeuksien lisäksi konkreettinen katsaus yksittäisiin osioihin auttaa asettamaan oikeat odotukset uusien työntekijöiden perehdytyksessä.",
            },
            { type: "h2", text: "Kalenteri ja varaukset" },
            {
              type: "p",
              text: "Admin, Apuadmin ja Työntekijä näkevät täydellisen varauskartan vierastietoineen ja tehtävineen. Siivous näkee vain hänelle osoitetut ajankohdat kohteen osoitteineen ja tarkistuslistoineen, mutta ei vieraiden nimiä tai hintoja. Omistaja näkee varauskalenterin yksinomaan omista kohteistaan, vain luku -oikeudella.",
            },
            { type: "h2", text: "Talous ja myynti" },
            {
              type: "ul",
              items: [
                "Liikevaihto, provisiot ja laskut: vain Admin ja Apuadmin.",
                "Portaalit (OTA-yhteydet) ja alustan näkyvyys: vain Admin ja Apuadmin.",
                "Työntekijä ja Siivous: ei pääsyä talous- tai myyntiosioihin, ei myöskään yksityiskohtasivuille.",
              ],
            },
            { type: "h2", text: "Tiimi ja asetukset" },
            {
              type: "p",
              text: "Työntekijöiden, roolien ja tiliasetusten hallinta on varattu Adminille ja Apuadminille. Omistajat ja operatiiviset roolit eivät näe tätä osiota lainkaan myNextDays-sovelluksessa eivätkä verkkohallintapaneelissa.",
            },
            {
              type: "note",
              variant: "info",
              text: "Tämä jaottelu koskee identtisesti verkkohallintapaneelia ja myNextDays-sovellusta, koska molemmat käyttöliittymät hakevat saman roolin tilistäsi.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Testaa uudet roolit yhdessä työntekijän kanssa kutsun jälkeen, jotta näkyvistä osioista ei synny väärinkäsityksiä.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Käyttöoikeuden poistaminen",
          excerpt: "Työntekijän käyttöoikeuden poistaminen välittömästi ja kokonaan.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Jos työntekijä lähtee yrityksestäsi tai yhteistyö muuttuu, poista käyttöoikeus suoraan tilistä. Poisto vaikuttaa palvelinpuolella ja välittömästi — ei vasta olemassa olevan istunnon päätyttyä.",
            },
            { type: "h2", text: "Käyttöoikeuden poistaminen" },
            {
              type: "steps",
              items: [
                "Avaa ”Tili” → ”Tiimi”.",
                "Valitse kyseinen työntekijä.",
                "Napsauta ”Poista käyttöoikeus”.",
                "Vahvista toiminto.",
              ],
            },
            { type: "h2", text: "Vaikutus käynnissä oleviin istuntoihin" },
            {
              type: "p",
              text: "Poiston jälkeen henkilö ei voi kirjautua uudelleen sisään verkkohallintapaneeliin eikä myNextDays-sovellukseen. Jo osoitetut tehtävät tai siivousajat kannattaa ennen poistoa osoittaa toiselle työntekijälle, jotta mikään ei jää hoitamatta.",
            },
            {
              type: "ul",
              items: [
                "Osoita avoimet tehtävät uudelleen ennen poistoa.",
                "Käyttöoikeuden voi myöhemmin palauttaa uudella kutsulla.",
                "Poisto koskee vain tätä yritystä, ei henkilön muita tilejä.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Poista käyttöoikeus viipymättä heti, kun yhteistyö päättyy — avoimeksi jäänyt työntekijätili on muuten tarpeeton tietoturvariski.",
            },
          ],
        },
      ],
    },
  ],
};
