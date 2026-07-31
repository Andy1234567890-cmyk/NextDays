import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Kohteet ja varusteet",
  description: "Huoneiden ja lomakohteiden perustaminen ja ylläpito.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Kohteiden hallinta",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Kohde = yksi varattava yksikkö",
          excerpt: "Miksi jokainen kohde myNextDaysissä on täsmälleen yksi varattava yksikkö.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "myNextDaysissä kohde on aina täsmälleen yksi varattava yksikkö — yksittäinen hotellihuone tai kokonainen lomakohde. Tämä periaate pätee riippumatta siitä, pyöritätkö lomamökkiä, lomahuoneistoa vai hotellia, ja se on saatavuuden, hintojen ja varausten perusta.",
            },
            { type: "h2", text: "Ei rakennusta, jonka alla on huoneita" },
            {
              type: "p",
              text: "Yleinen väärinkäsitys on esittää hotellirakennus yhtenä kohteena, jonka alla on useita huoneita. Tätä ei ole tarkoitettu myNextDaysissä. Jos pyörität esimerkiksi hotellia, jossa on kahdeksan kahden hengen huonetta ja neljä yhden hengen huonetta, perusta kaksitoista erillistä kohdetta — ei yhtä kohdetta, jolla on huoneiden lukumäärä.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Kenttää kuten ”huoneiden lukumäärä” kohdetasolla ei ole tarkoituksella olemassa. Jokainen huone tarvitsee oman kohteensa omalla kalenterilla ja omilla hinnoilla.",
            },
            { type: "h2", text: "Lomakohteet" },
            {
              type: "p",
              text: "Lomamökin tai lomahuoneiston kohdalla koko kohde vastaa varattavaa yksikköä. Tässä ei ole enempää jaottelua — lomakohde on aina itsenäinen kohde omalla kalenterillaan.",
            },
            { type: "h2", text: "Miksi tämä on tärkeää" },
            {
              type: "ul",
              items: [
                "Jokaisella kohteella on oma saatavuuskalenteri — päällekkäiset varaukset estetään kohdekohtaisesti.",
                "Hinnat, varusteet ja kuvat koskevat kohdetta, eivät rakennusta.",
                "Kohde kuuluu aina täsmälleen yhdelle omistajalle — ei moninkertaista kohdistusta.",
                "Kanavien näkyvyyttä (verkkosivusto, alustan markkinapaikka, portaalit) ohjataan kohdekohtaisesti.",
              ],
            },
            {
              type: "p",
              text: "Miten valitset oikean kohdetyypin huoneellesi tai lomakohteellesi, lue kohdasta [Kohdetyypin määrittäminen](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Kohdetyypin määrittäminen",
          excerpt: "Kategorian, kiinteistötyypin ja tarjoustyypin oikea kohdistaminen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Kohdetyyppi määrittää, miten kohteesi luokitellaan ja suodatetaan portaaleissa sekä alustan markkinapaikalla. Se koostuu kolmesta toisiinsa perustuvasta valintakentästä, jotka käyt läpi kohdetta perustaessasi tai muokatessasi.",
            },
            { type: "h2", text: "Kolme valintatasoa" },
            {
              type: "steps",
              items: [
                "Valitse ensin kategoria — esimerkiksi lomamajoitus tai hotelli.",
                "Valitse sen pohjalta kiinteistötyyppi — esimerkiksi lomahuoneisto, lomamökki, kahden hengen huone tai yhden hengen huone.",
                "Valitse tarjoustyyppi — esimerkiksi koko kohde tai yksityinen huone.",
                "Täydennä valinnan mukaan näkyviin tulevat lisäkentät, esimerkiksi vuodetyyppi tai kerros.",
              ],
            },
            { type: "h2", text: "Miksi järjestys on tärkeä" },
            {
              type: "p",
              text: "Kolme pudotusvalikkoa ovat riippuvaisia toisistaan: kategorian valinta rajaa käytettävissä olevat kiinteistötyypit, ja kiinteistötyypin valinta puolestaan tarjoustyypit. Näin syntyy vain järkeviä yhdistelmiä, samanlaisia kuin suurilla portaaleilla käytetään.",
            },
            {
              type: "note",
              variant: "info",
              text: "Jos muutat kategoriaa jälkikäteen, myNextDays tarkistaa, sopivatko kiinteistötyyppi ja tarjoustyyppi vielä yhteen, ja pyytää tarvittaessa uutta valintaa.",
            },
            { type: "h2", text: "Kohdetyypin muokkaaminen" },
            {
              type: "p",
              text: "Avaa valikosta Kohteet haluamasi kohde ja siirry Perustiedot-välilehdelle. Sieltä löydät kolme pudotusvalikkoa kohdasta Kohdetyyppi. Kun tallennat muutoksen, uusi luokitus välittyy kaikille aktiivisille kanaville.",
            },
            {
              type: "ul",
              items: [
                "Kategoria: ylätason luokitus (esim. lomamajoitus, hotelli)",
                "Kiinteistötyyppi: konkreettinen kohdetyyppi (esim. lomahuoneisto, kahden hengen huone)",
                "Tarjoustyyppi: mitä täsmälleen varataan (esim. koko kohde, yksityinen huone)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Varusteiden ylläpito",
          excerpt: "Varusteominaisuuksien valitseminen ja ajan tasalla pitäminen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Kohteen varustelu vaikuttaa merkittävästi siihen, kuinka hyvin se löytyy ja suodattuu portaaleissa. Vieraat suodattavat kohteita ominaisuuksien, kuten WLAN, keittiö tai parkkipaikka, mukaan — puuttuvat tiedot voivat sulkea kohteen pois hakutuloksista.",
            },
            { type: "h2", text: "Varusteiden valitseminen" },
            {
              type: "steps",
              items: [
                "Avaa kohde ja siirry Varusteet-välilehdelle.",
                "Valitse kaikki sopivat ominaisuudet annetusta listasta.",
                "Täydennä tarvittaessa yksityiskohdat, kuten parkkipaikkojen lukumäärä tai keittiön tyyppi.",
                "Tallenna muutokset — ne välittyvät automaattisesti kaikkiin aktiivisiin portaaleihin.",
              ],
            },
            { type: "h2", text: "Mistä ominaisuudet ovat peräisin" },
            {
              type: "p",
              text: "Varustelista noudattaa suurten portaalien ominaisuusluetteloa, jotta tietosi kohdistuvat siellä oikein. Omia, vapaasti keksittyjä ominaisuuksia ei ole tarkoitettu, sillä niitä ei voitaisi siirtää siististi portaaleihin.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Tarkista varustelu jokaisen rakenteellisen muutoksen jälkeen — esimerkiksi uuden ilmastointilaitteen tai lisäkylpyhuoneen myötä — jotta tiedot pysyvät ajan tasalla kaikilla kanavilla.",
            },
            { type: "h2", text: "Yleisiä ominaisuusryhmiä" },
            {
              type: "ul",
              items: [
                "Perusvarustus: WLAN, lämmitys, ilmastointi",
                "Keittiö ja ruokailu: täysin varusteltu keittiö, astianpesukone, kahvinkeitin",
                "Kylpyhuone ja pyykki: oma kylpyhuone, pesukone, pyyhkeet",
                "Ulkoalueet: parveke, terassi, puutarha, parkkipaikka",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Kuvat ja kuvaus",
          excerpt: "Vakuuttavat kuvat ja tekstit lisäävät varauksia.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Kuvat ja kuvaus ovat vieraille tärkein päätöksenteon perusta. Kohteen voi julkaista vasta, kun vähintään yksi pääkuva ja kuvaus on tallennettu.",
            },
            { type: "h2", text: "Kuvien lataaminen" },
            {
              type: "steps",
              items: [
                "Avaa kohde ja siirry Kuvat-välilehdelle.",
                "Vedä kuvatiedostot lataus­alueelle tai valitse ne tiedostovalitsimen kautta.",
                "Määritä pääkuva — se näkyy hakutuloksissa ja korteissa.",
                "Järjestä loput kuvat vetämällä ne järkevään järjestykseen.",
              ],
            },
            { type: "h2", text: "Kuvauksen laatiminen" },
            {
              type: "p",
              text: "Siirry Kuvaus-välilehdelle ja syötä otsikko sekä leipäteksti. Kuvaile kohteen sijaintia, erityispiirteitä ja kohderyhmää konkreettisesti — yleiset fraasit vaikuttavat portaaleissa vähemmän vakuuttavilta kuin konkreettiset yksityiskohdat.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Muiden kohteiden tai internetistä otettuja kuvia ei saa käyttää — portaalit tarkistavat tämän ja voivat sulkea kohteita rikkomusten yhteydessä.",
            },
            { type: "h2", text: "Suosituksia hyville kuville" },
            {
              type: "ul",
              items: [
                "Vähintään viisi kuvaa, ihanteellisesti yksi jokaisesta huoneesta",
                "Vaakasuunta, hyvä valaistus, ei vesileimoja",
                "Pääkuva esittää kohteen mahdollisimman kutsuvasti ja selkeästi",
                "Päivitetään säännöllisesti, erityisesti remonttien jälkeen",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Käyttöaste ja kapasiteetti",
          excerpt: "Enimmäisvierasmäärän ja vuodejaon oikea tallentaminen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Kapasiteetti määrittää, kuinka monta vierasta kohde voi majoittaa, ja se tarkistetaan jokaisen haun ja varauksen yhteydessä. Väärät tiedot johtavat joko hylättyihin pyyntöihin tai ylitäyttöön — kumpaakin kannattaa välttää.",
            },
            { type: "h2", text: "Kapasiteetin kirjaaminen" },
            {
              type: "steps",
              items: [
                "Avaa kohde ja siirry Kapasiteetti-välilehdelle.",
                "Kirjaa aikuisten enimmäismäärä.",
                "Kirjaa lasten enimmäismäärä, mikäli lapset ovat sallittuja.",
                "Tallenna vuodejako huoneittain, esimerkiksi parisänky ja kaksi erillistä vuodetta.",
              ],
            },
            { type: "h2", text: "Kapasiteetin rajat" },
            {
              type: "p",
              text: "Varauspyynnön yhteydessä myNextDays tarkistaa automaattisesti, mahtuuko pyydetty vierasmäärä tallennettuun kapasiteettiin. Enimmäiskapasiteetin ylittävät pyynnöt hylätään tai niitä ei näytetä varattavina lainkaan.",
            },
            {
              type: "note",
              variant: "info",
              text: "Lisävuode tai vauvansänky kasvattaa todellista kapasiteettia vain, jos kirjaat sen nimenomaisesti vuodejakoon — muuten enimmäisvierasmäärä pysyy ennallaan.",
            },
            { type: "h2", text: "Tyypilliset virhelähteet" },
            {
              type: "ul",
              items: [
                "Enimmäisvierasmäärä asetettu liian suureksi, vaikka vuoteita on vain vähän",
                "Lasten määrä unohdettu, vaikka kohde on suunnattu perheille",
                "Vuodejakoa ei ole päivitetty remontin jälkeen",
              ],
            },
            {
              type: "p",
              text: "Jos kapasiteetti ja varustelu eivät täsmää, tarkista myös välilehti [Varusteet](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Kohteen tila ja näkyvyys",
          excerpt: "Ero aktiivisen/ei-aktiivisen tilan ja kolmen kanava-akselin välillä.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "myNextDays erottaa toisistaan kaksi asiaa, jotka sekoitetaan usein keskenään: kohteen tilan (aktiivinen tai ei-aktiivinen) ja näkyvyyden yksittäisillä myyntikanavilla. Molempia ohjataan toisistaan erillään.",
            },
            { type: "h2", text: "Kohteen tila" },
            {
              type: "p",
              text: "Tila active tarkoittaa, että kohde on lähtökohtaisesti myyntikelpoinen. Tila inactive poistaa kohteen kokonaan käytöstä — esimerkiksi pitkäaikaisen remontin ajaksi. Ei-aktiivinen kohde ei ole varattavissa millään kanavalla, riippumatta kanavakytkimistä.",
            },
            { type: "h2", text: "Kolme kanava-akselia" },
            {
              type: "p",
              text: "Jos kohde on aktiivinen, kolme riippumatonta kytkintä määrittää, missä se täsmälleen näkyy:",
            },
            {
              type: "ul",
              items: [
                "Verkkosivusto — näkyvyys omalla myNextDays-verkkosivustollasi",
                "Alustan markkinapaikka — näkyvyys globaalilla myBestDays-markkinapaikalla",
                "Portaalit — näkyvyys palveluissa Booking, Airbnb ja muut",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Nämä kolme akselia ovat täysin riippumattomia kohteen tilasta ja toisistaan. Aktiivinen kohde voi esimerkiksi näkyä vain verkkosivustolla, mutta ei portaaleissa.",
            },
            { type: "h2", text: "Tilan muuttaminen" },
            {
              type: "steps",
              items: [
                "Avaa kohde ja siirry Yleiskatsaus-välilehdelle.",
                "Aseta tilaksi aktiivinen tai ei-aktiivinen.",
                "Säädä tarvittaessa myös kolmea kanavakytkintä Näkyvyys-välilehdellä.",
                "Tallenna muutos — se vaikuttaa heti kaikilla asianomaisilla kanavilla.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Yksittäisten päivien lyhytaikaiseen sulkemiseen käytä sen sijaan kalenterin Stop-Sell-toimintoa — se sulkee valitut päivät kaikilla kanavilla ilman, että koko kohde poistuu käytöstä.",
            },
          ],
        },
      ],
    },
  ],
};
