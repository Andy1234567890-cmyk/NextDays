import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Tehtävät ja siivous",
  description: "Siivoussuunnitelmien ja tiimin tehtävien organisointi.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Toiminta",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Tehtävien luominen",
          excerpt: "Näin luot uuden tehtävän kohteelle tai ajanjaksolle.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Tehtävät kokoavat kaiken, mitä kohteen ympärillä on hoidettava — siivouksesta uloskirjautumisen jälkeen huoltotöihin tai vieraiden pyyntöihin. Jokainen tehtävä liittyy täsmälleen yhteen kohteeseen ja voidaan osoittaa tiimin jäsenelle.",
            },
            { type: "h2", text: "Uuden tehtävän luominen" },
            {
              type: "steps",
              items: [
                "Avaa päävalikosta osio ”Tehtävät”.",
                "Napsauta ”Uusi tehtävä”.",
                "Valitse kyseinen kohde.",
                "Anna otsikko ja halutessasi kuvaus.",
                "Määritä eräpäivä ja -aika.",
                "Tallenna tehtävä.",
              ],
            },
            { type: "h2", text: "Tehtävätyypit" },
            {
              type: "p",
              text: "Vapaasti luotavien tehtävien lisäksi on järjestelmän itse luomia tehtäviä, esimerkiksi uloskirjautumisen jälkeen automaattisesti ajoitettuja siivouksia. Nämä on jo liitetty kohteeseen ja sopivaan aikaikkunaan, ja ne on vain osoitettava tiimin jäsenelle.",
            },
            {
              type: "ul",
              items: [
                "Käsin luotu tehtävä: vapaasti kirjattu, esim. huolto tai erikoistoive.",
                "Automaattinen siivoustehtävä: johdettu uloskirjautumispäivästä.",
                "Toistuva tehtävä: säännöllisiä tarkastuksia tai katselmuksia varten.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Lisätietoja automaattisesta ajoituksesta löydät kohdasta [Siivoussuunnitelmat](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Käytä täsmällisiä otsikoita — tiimin jäsenet näkevät mobiilinäkymässä usein vain otsikon ja kohteen yhdellä silmäyksellä.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Siivoussuunnitelmat",
          excerpt: "Siivousten automaattinen ajoittaminen uloskirjautumisen jälkeen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Siivoussuunnitelma varmistaa, että jokaisen uloskirjautumisen jälkeen syntyy automaattisesti siivoustehtävä kyseiselle kohteelle — ilman että sinun tarvitsee seurata jokaista varausta erikseen. Tämä vähentää unohtuneita luovutuksia ja takaa luotettavan kulun kahden oleskelun välillä.",
            },
            { type: "h2", text: "Automaattisen ajoituksen käyttöönotto" },
            {
              type: "steps",
              items: [
                "Avaa kohde ja siirry välilehdelle ”Siivous”.",
                "Aktivoi ”Ajoita siivous automaattisesti uloskirjautumisen jälkeen”.",
                "Määritä, kuinka paljon aikaa uloskirjautumisen jälkeen varataan siivoukselle.",
                "Määritä halutessasi vakiotiimi tai vakiosiivooja.",
                "Tallenna asetus.",
              ],
            },
            { type: "h2", text: "Yhteispeli kalenterin kanssa" },
            {
              type: "p",
              text: "Kun varaus perutaan tai sitä siirretään, siihen liittyvä siivoustehtävä mukautuu automaattisesti uuteen uloskirjautumispäivään. Näin siivoussuunnitelma pysyy aina synkronoituna todellisen käyttöasteen kanssa.",
            },
            {
              type: "ul",
              items: [
                "Siivous syntyy automaattisesti jokaisessa uloskirjautumisessa, jos suunnitelma on aktiivinen.",
                "Jos varaus siirtyy, siivoustehtävä siirtyy mukana.",
                "Jos vieras peruu oleskelun, siivoustehtävä poistetaan.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ilman aktivoitua siivoussuunnitelmaa automaattisia tehtäviä ei synny — luo siivoukset silloin käsin kohdasta [Tehtävien luominen](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Tehtävien osoittaminen",
          excerpt: "Tehtävien kohdennettu osoittaminen siivoojille tai tiimin jäsenille.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Jotta tehtävä tulee hoidetuksi, osoitat sen tietylle tiimin jäsenelle — esimerkiksi siivoojalle tai huoltovastuulliselle työntekijälle. Vain osoitettu henkilö näkee tehtävän oletuksena omassa yleiskatsauksessaan.",
            },
            { type: "h2", text: "Tehtävän osoittaminen käsin" },
            {
              type: "steps",
              items: [
                "Avaa tehtävä listasta ”Tehtävät”.",
                "Napsauta ”Osoita”.",
                "Valitse vastuullinen tiimin jäsen listasta.",
                "Vahvista osoitus.",
              ],
            },
            { type: "h2", text: "Osoitus kohteen mukaan" },
            {
              type: "p",
              text: "Jos siivoojalle on jo pysyvästi osoitettu tietty kohde, voit antaa myös kyseisen kohteen tehtävien mennä automaattisesti samalle henkilölle. Tämä säästää napsautuksia toistuvissa siivouksissa ja vähentää kysymyksiä.",
            },
            {
              type: "ul",
              items: [
                "Käsin osoitus: valitset henkilön itse jokaiselle tehtävälle.",
                "Kiinteä kohdekohdistus: uudet tehtävät tälle kohteelle menevät automaattisesti tallennetulle henkilölle.",
                "Tehtävällä on aina täsmälleen yksi vastuuhenkilö.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Siivoojat ja työntekijät näkevät yksinomaan omat osoitetut tehtävänsä, ei kohteen talous- tai myyntitietoja.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Tehtävien tilan seuraaminen",
          excerpt: "Tehtävien käsittelytilan seuraaminen reaaliajassa.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Jokainen tehtävä käy läpi selkeän tilan — avoimesta käsittelyssä-tilan kautta valmiiseen. Näin näet aina, valmistuuko siivous tai huolto ajoissa ennen seuraavaa sisäänkirjautumista.",
            },
            { type: "h2", text: "Tilan yleiskatsaus" },
            {
              type: "ul",
              items: [
                "Avoin: tehtävä on luotu, mutta sitä ei ole vielä aloitettu.",
                "Käsittelyssä: osoitettu henkilö on aloittanut tehtävän.",
                "Valmis: tehtävä on hoidettu ja vahvistettu.",
              ],
            },
            { type: "h2", text: "Tilan päivittäminen" },
            {
              type: "steps",
              items: [
                "Avaa tehtävä listasta ”Tehtävät”.",
                "Valitse sopiva tila, esim. ”Käsittelyssä” tai ”Valmis”.",
                "Lisää tarvittaessa lyhyt muistiinpano, esimerkiksi kohteen poikkeavuuksista.",
                "Tallenna muutos.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Tilan muutokset näkyvät heti jaetussa tehtävälistassa — käsin päivittäminen ei ole tarpeen.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Jos siivous on vielä avoinna juuri ennen seuraavaa sisäänkirjautumista, tarkista ensin osoitus ennen kuin otat yhteyttä vieraaseen.",
            },
          ],
        },
      ],
    },
  ],
};
