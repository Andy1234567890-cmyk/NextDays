import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Ensimmäiset askeleet",
  description: "Perusta tili ja pääse alkuun muutamassa minuutissa.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Käyttöönotto",
      articles: [
        {
          slug: "willkommen",
          title: "Tervetuloa myNextDaysiin",
          excerpt: "Yleiskatsaus PMS-järjestelmään, kanavanhallintaan, markkinapaikkaan ja sovellukseen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "myNextDays on keskitetty alustasi lomakohteille ja hotelleille. Sen sijaan että käyttäisit useita erillisiä järjestelmiä, hallinnoit saatavuutta, hintoja, varauksia ja vieraiden viestintää yhdestä paikasta — riippumatta siitä, pyöritätkö yhtä lomamökkiä vai useita hotellihuoneita.",
            },
            { type: "h2", text: "Neljä peruspilaria" },
            {
              type: "ul",
              items: [
                "PMS (kiinteistönhallintajärjestelmä): kohteet, kalenteri, hinnat, varaukset, tehtävät ja maksut.",
                "Kanavanhallinta: yhteys portaaleihin kuten Booking, Airbnb ja muut — yksi syöttö, monta portaalia synkronoituna.",
                "Alustan markkinapaikka: oma myBestDays-markkinapaikka, tasavertainen varauskanava portaalien rinnalla.",
                "Sovellus: mobiilisovellus vieraille, omistajille ja työntekijöille, samoilla tiedoilla kuin verkossa.",
              ],
            },
            { type: "h2", text: "Miten peruspilarit toimivat yhdessä" },
            {
              type: "p",
              text: "Ylläpidät kohdetta, hintoja ja saatavuutta keskitetysti yhdessä paikassa PMS:ssä. Sieltä myNextDays jakaa tiedot automaattisesti kaikille aktiivisille kanaville. Yksi varaus — riippumatta siitä, minkä kanavan kautta se tulee — lukitsee vastaavat yöt heti kaikkialla, jolloin päällekkäiset varaukset ovat poissuljettuja.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Aloita kohdasta Tili ja yritys, perusta sen jälkeen ensimmäinen kohteesi — tämä järjestys säästää sinut myöhemmiltä korjauksilta.",
            },
            { type: "h2", text: "Seuraavat askeleet" },
            {
              type: "steps",
              items: [
                "Avaa valikosta Tili ja täydennä yrityksesi tiedot.",
                "Perusta ensimmäinen kohteesi kohdassa Kohteet.",
                "Tarkista, että varusteet, kuvat ja hinnat ovat täydelliset.",
                "Napsauta Julkaise, jotta kohde näkyy kaikilla kanavilla.",
              ],
            },
            {
              type: "p",
              text: "Lisää yksittäisistä vaiheista löydät kohdista [Tili ja yritys käyttöön](/hilfe/erste-schritte/konto-einrichten) ja [Ensimmäisen kohteen perustaminen](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Tili ja yritys käyttöön",
          excerpt: "Perustiedot, laskutusosoite ja valuutta oikein tallennettuina.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Ennen kuin perustat kohteita, ota yrityksesi käyttöön Tili-osiossa. Näitä tietoja tarvitaan laskuihin, portaaleihin ja myNextDaysin kanssa tehtävään laskutukseen, joten niiden tulee olla täydelliset ja oikein.",
            },
            { type: "h2", text: "Perustietojen tallentaminen" },
            {
              type: "steps",
              items: [
                "Avaa valikosta Tili.",
                "Syötä kohtaan Perustiedot yrityksen nimi tai yksityisen elinkeinonharjoittajan nimi, osoite ja yhteystiedot.",
                "Tallenna laskutusosoite — se näkyy kaikissa lähetetyissä laskuissa.",
                "Valitse peruskäyttövaluuttasi. Se koskee kaikkia hintoja, kunnes muutat sen erikseen kunkin kohteen kohdalla.",
              ],
            },
            { type: "h2", text: "Miksi valuutta on tärkeä" },
            {
              type: "p",
              text: "Valuuttaa ei arvata eikä täydennetä automaattisesti: jos se puuttuu, hintaa ei voida näyttää tai laskuttaa oikein. Siksi myNextDays vaatii tietoisen valinnan käyttöönoton yhteydessä sen sijaan, että asettaisi oletusarvon.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Jos muutat kohteen valuuttaa jälkikäteen, kaikki siihen liittyvät hintasuunnitelmat muuttuvat mukana. Tarkista hinnat sen jälkeen kertaalleen.",
            },
            { type: "h2", text: "Laskutusosoite ja laskutus" },
            {
              type: "p",
              text: "Tilin kohdassa Laskutus näet nykyiset laskusi ja tallennetun laskutusosoitteen. Pidä nämä ajan tasalla erityisesti yhtiömuodon tai osoitteen muuttuessa, jotta laskut laaditaan oikein.",
            },
            {
              type: "ul",
              items: [
                "Yrityksen nimi tai yksityisen elinkeinonharjoittajan nimi",
                "Laskutusosoite maatietoineen",
                "Vero- tai ALV-tunnus, mikäli sellainen on",
                "Peruskäyttövaluutta uusille kohteille",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Ensimmäisen kohteen perustaminen",
          excerpt: "Näin perustat ensimmäisen varattavan kohteesi vaihe vaiheelta.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Kohde myNextDaysissä on aina täsmälleen yksi varattava yksikkö: joko yksittäinen hotellihuone tai kokonainen lomakohde. Jos pyörität hotellia, jossa on useita huoneita, perusta jokaiselle huoneelle oma kohteensa.",
            },
            { type: "h2", text: "Kohteen perustaminen" },
            {
              type: "steps",
              items: [
                "Avaa valikosta Kohteet.",
                "Napsauta Lisää kohde.",
                "Valitse kohdetyyppi: kategoria, kiinteistötyyppi ja tarjoustyyppi.",
                "Täydennä osoite, kapasiteetti ja perushinta tallennetussa valuutassasi.",
                "Tallenna kohde luonnoksena, jotta voit täydentää sen myöhemmin.",
              ],
            },
            { type: "h2", text: "Mitä sen jälkeen vielä puuttuu" },
            {
              type: "p",
              text: "Vastaperustettu kohde on aluksi luonnos eikä näy millään kanavalla. Täydennä varusteet, kuvat, kuvaus ja kalenterin saatavuus ennen julkaisemista — vain täydellinen kohde on luotettavasti markkinoitavissa.",
            },
            {
              type: "ul",
              items: [
                "Valitse varusteet kategorian mukaisesta listasta",
                "Tallenna vähintään yksi pääkuva ja kuvaus",
                "Kirjaa kapasiteetti (aikuiset, lapset, vuoteet) oikein",
                "Tarkista perushinta ja kalenterin saatavuus",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jos pyörität useita huonetyyppejä, toista tämä vaihe jokaiselle yksittäiselle huoneelle — ylätason rakennustasoa, jonka alla huoneet olisivat, ei ole olemassa.",
            },
            {
              type: "p",
              text: "Kun kaikki pakolliset kentät on täytetty, voit julkaista kohteen, katso [Kohteen julkaiseminen](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Kohteen julkaiseminen",
          excerpt: "Yksi napsautus avaa alustan markkinapaikan, portaalit ja verkkosivuston yhdessä.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Julkaiseminen tekee kohteesta näkyvän ja varattavan. Normaalisti riittää yksi napsautus, jolla aktivoidaan kaikki kolme myyntikanavaa samanaikaisesti — voit kuitenkin säätää näkyvyyttä kanavakohtaisesti milloin tahansa erikseen.",
            },
            { type: "h2", text: "Näin julkaiset" },
            {
              type: "steps",
              items: [
                "Avaa kohde valikosta Kohteet.",
                "Tarkista Yleiskatsaus-välilehdellä, että kaikki pakolliset tiedot on merkitty vihreällä.",
                "Napsauta Julkaise.",
                "Vahvista valintaikkuna — alustan markkinapaikka, portaalit ja verkkosivusto aktivoituvat.",
              ],
            },
            { type: "h2", text: "Kanavien hallinta erikseen" },
            {
              type: "p",
              text: "Julkaisun jälkeen löydät Näkyvyys-välilehdeltä kolme erillistä kytkintä: Verkkosivusto, Alustan markkinapaikka ja Portaalit. Jos haluat esimerkiksi tarjota kohdetta vain omalla verkkosivustollasi mutta et portaalien kautta, poista vastaava kytkin käytöstä.",
            },
            {
              type: "ul",
              items: [
                "Verkkosivusto: näkyvyys omalla myNextDays-verkkosivustollasi",
                "Alustan markkinapaikka: näkyvyys globaalilla myBestDays-markkinapaikalla",
                "Portaalit: näkyvyys palveluissa Booking, Airbnb ja muut",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Nämä kolme kytkintä ovat riippumattomia kohteen tilasta (aktiivinen/ei-aktiivinen). Aktiivinen kohde voi silti olla näkymätön yksittäisillä kanavilla.",
            },
            { type: "h2", text: "Kohteen väliaikainen sulkeminen" },
            {
              type: "p",
              text: "Jos haluat sulkea yksittäisen päivän koko kohteen sijaan, käytä kalenterin Stop-Sell-toimintoa — se sulkee päivän kaikilla kanavilla samanaikaisesti, riippumatta näkyvyyskytkimistä.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Kolme myyntikanavaa selkeästi",
          excerpt: "Portaalit, alustan markkinapaikka ja sovellus yhdellä silmäyksellä.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "myNextDays markkinoi jokaista kohdetta samanaikaisesti useiden tasavertaisten kanavien kautta. Sen ymmärtäminen, miten nämä toimivat yhdessä, auttaa sinua ohjaamaan näkyvyyttä ja hintoja täsmällisesti.",
            },
            { type: "h2", text: "Portaalit" },
            {
              type: "p",
              text: "Kanavanhallinnan kautta yhdistät kohteesi suuriin varausportaaleihin kuten Booking, Airbnb ja muut. Saatavuus ja hinnat synkronoituvat automaattisesti, joten sinun ei tarvitse ylläpitää useita portaalikalentereita käsin.",
            },
            { type: "h2", text: "Alustan markkinapaikka" },
            {
              type: "p",
              text: "myBestDays-markkinapaikka on oma, globaali varauskanava — verrattavissa Bookingiin tai Airbnbhin, mutta osa samaa alustaa. Se ei ole ”suoravarauksen” korvike, vaan tasavertainen kanava, jolla on oma näkyvyysakselinsa.",
            },
            { type: "h2", text: "Sovellus" },
            {
              type: "p",
              text: "Mobiilisovellus tarjoaa vieraille, omistajille ja työntekijöille pääsyn samoihin tietoihin kuin verkkosivusto — esimerkiksi varaustietoihin, viesteihin tai tehtäviin, roolista riippuen.",
            },
            { type: "h2", text: "Kolme erillistä näkyvyysakselia" },
            {
              type: "ul",
              items: [
                "Verkkosivusto — oma myNextDays-verkkosivustosi",
                "Alustan markkinapaikka — globaali myBestDays-markkinapaikka",
                "Portaalit — Booking, Airbnb ja muut kanavanhallinnan kautta",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Kaikkia kolmea akselia voi kytkeä päälle ja pois toisistaan riippumatta. Stop-Sell ja kohteen tila sen sijaan vaikuttavat kaikkiin kolmeen samanaikaisesti, kanavista riippumatta.",
            },
          ],
        },
      ],
    },
  ],
};
