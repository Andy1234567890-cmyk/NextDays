import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Varaukset ja kalenteri",
  description: "Varausten ja kalenterin hallinta.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Varaukset ja kalenteri",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Ylivarausten luotettava välttäminen",
          excerpt: "Näin varmistat, ettei kohdetta koskaan varata päällekkäin.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne",
            },
            {
              type: "p",
              text: "Kohdetta myydään samanaikaisesti useilla kanavilla — portaaleilla, kuten Booking, Airbnb ja muut, omalla alustalla sekä sovelluksessa. Ylivaraus syntyy, kun saatavuutta ei suljeta ajoissa yhdellä kanavalla sen jälkeen, kun toisella kanavalla on tehty varaus.",
            },
            {
              type: "steps",
              items: [
                "Tarkista varauskartasta, että jokainen kohde on täsmälleen yksi rivi yhtä varattavaa yksikköä kohden — ei useiden huoneiden yhteistä kapasiteettia.",
                "Anna uusien varausten syntyä yksinomaan varauskartan tai yhdistettyjen kanavien kautta, älä koskaan kuvaamalla yksittäisiä päiviä käsin.",
                "Tarkista jokaisen varauksen jälkeen, että varatut yöt näkyvät heti kalenterissa varattuina.",
                "Käytä teknisten ongelmien tai huollon yhteydessä heti Stop-Selliä sen sijaan, että jättäisit päivän avoimeksi.",
                "Tarkista epäselvissä tapauksissa kyseisen varauksen aikajana ajallisen kulun selvittämiseksi.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Älä koskaan muuta öitä tai estoja käsin varauskartan ulkopuolella — vain näin varmistetaan, että kaikki kanavat näkevät saman saatavuustilanteen eikä synny aukkoa päällekkäiselle varaukselle.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Varauksen siirtäminen toiseen kohteeseen",
          excerpt: "Näin siirrät olemassa olevan varauksen siististi toiseen kohteeseen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne",
            },
            {
              type: "p",
              text: "Joskus vieraan on siirryttävä kohteesta toiseen, esimerkiksi teknisen vian tai vieraan toiveen vuoksi. Siirron yhteydessä aiemmat kalenteriyöt vapautetaan automaattisesti ja varataan uudelleen kohdekohteessa.",
            },
            {
              type: "steps",
              items: [
                "Avaa kyseinen varaus varauksen aikajanalla.",
                "Valitse toimintovalikosta ”Vaihda kohde” tai ”Siirrä”.",
                "Valitse kohdekohde ja tarkista sen saatavuus valitulla ajanjaksolla.",
                "Vahvista siirto.",
                "Tarkista sen jälkeen varauskartasta, että vanhat yöt näkyvät alkuperäisessä kohteessa taas vapaina.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vanhojen öiden vapautuksen hoitaa järjestelmä automaattisesti — sinun ei tarvitse avata alkuperäistä ajanjaksoa itse käsin. Ilmoita vieraalle kohteen vaihdosta, erityisesti jos varustelu tai kulkuoikeudet poikkeavat toisistaan.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Pitkäaikaisvarauksen luominen",
          excerpt: "Näin luot varauksen pidemmälle ajanjaksolle oikein.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne",
            },
            {
              type: "p",
              text: "Pitkäaikaisvieraille — esimerkiksi useiksi viikoiksi tai kuukausiksi — luot varauksen tavalliseen tapaan, mutta kiinnität lisäksi huomiota vähimmäisoleskeluun, maksusääntöihin ja kohteen kanavanäkyvyyteen koko ajanjakson ajan.",
            },
            {
              type: "steps",
              items: [
                "Avaa haluamasi kohteen varauskartta ja merkitse koko ajanjakso.",
                "Luo varaus vierastietoineen sekä suunniteltuine saapumis- ja lähtöpäivineen.",
                "Ota tarvittaessa käyttöön maksusääntö ennakkomaksulla ja loppumaksulla sen sijaan, että koko summa erääntyisi heti.",
                "Tarkista, ettei mikään vähimmäis- tai enimmäisoleskelusääntö ole ristiriidassa pitkän ajanjakson kanssa.",
                "Tallenna varaus ja tarkista, että koko ajanjakso näkyy kalenterissa oikein varattuna.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Hyvin pitkissä oleskeluissa suositellaan loppumaksua useassa erässä yhden suuren eräpäivän sijaan — näin maksuriski pysyy hallittavana. Lisätietoja kohdassa [Loppumaksun automatisointi](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
