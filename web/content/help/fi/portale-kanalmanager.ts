import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portaalit ja kanavanhallinta",
  description: "Booking, Airbnb, Expedia ja muut keskitetysti hallittuina.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Portaalien yhdistäminen",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Mikä on kanavanhallinta?",
          excerpt:
            "Kanavanhallinta täsmäyttää hinnat, saatavuuden ja varaukset automaattisesti myNextDaysin ja portaalien välillä.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Yksi yhteys kaikkiin portaaleihin" },
            {
              type: "p",
              text: "Kanavanhallinta on silta myNextDaysin ja suurten varausportaalien, kuten Booking, Airbnb ja muut, välillä. Sen sijaan että ylläpitäisit hintoja, saatavuutta ja käyttöastetta erikseen jokaisessa portaalissa, syötät kaiken kerran myNextDaysiin — kanavanhallinta jakaa sen automaattisesti kaikkiin yhdistettyihin portaaleihin.",
            },
            { type: "h2", text: "Mikä synkronoituu automaattisesti" },
            {
              type: "ul",
              items: [
                "Saatavuus — jokainen varaus lukitsee yön heti kaikissa portaaleissa",
                "Hinnat ja vähimmäisoleskelut hintakalenteristasi",
                "Saapuvat portaalivaraukset tuodaan automaattisesti myNextDaysiin",
                "Peruutukset ja Stop-Sell vaikuttavat kaikilla kanavilla",
              ],
            },
            { type: "h2", text: "Mitä sinun ei enää tarvitse tehdä käsin" },
            {
              type: "p",
              text: "Ilman kanavanhallintaa jouduit sulkemaan yön käsin jokaisessa portaalissa jokaisen varauksen jälkeen — yleinen syy päällekkäisiin varauksiin. Aktiivisen kanavanhallinnan kanssa myNextDays hoitaa tämän täsmäytyksen molempiin suuntiin, useita kertoja päivässä ja reaaliajassa uusien varausten yhteydessä.",
            },
            {
              type: "note",
              variant: "info",
              text: "Portaaliyhteys perustetaan kerran koko tilin laajuisesti. Jokaiselle yksittäiselle kohteelle aktivoit sen jälkeen vain kohdistuksen — lisää tästä kohdassa [Kohteen kohdistaminen portaaliin](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Portaaliyhteyden käyttöönotto",
          excerpt:
            "Yhteyden portaaleihin otat käyttöön kerran koko tilin laajuisesti — et jokaiselle kohteelle erikseen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Kertaalleen koko tilille" },
            {
              type: "p",
              text: "Portaaliyhteys on koko tiliä koskeva asetus: yhdistät myNextDays-tilisi kanavanhallintaan täsmälleen kerran. Kaikki myöhemmin perustamasi kohteet käyttävät automaattisesti tätä samaa yhteyttä — sinun ei tarvitse rakentaa sitä uudelleen jokaiselle kohteelle.",
            },
            { type: "h2", text: "Näin otat yhteyden käyttöön" },
            {
              type: "steps",
              items: [
                "Avaa /konto ja valitse osio ”Portaalit ja kanavanhallinta”",
                "Napsauta ”Ota yhteys käyttöön” ja vahvista yrityksesi tiedot (osoite, yhteystiedot, yhtiömuoto)",
                "Tarkista automaattisesti siirretyt perustiedot — ne välitetään kaikille portaaleille",
                "Viimeistele käyttöönotto; tila vaihtuu ”Yhdistetty”-tilaan",
              ],
            },
            { type: "h2", text: "Seuraava vaihe: kohteiden kohdistaminen" },
            {
              type: "p",
              text: "Kertaluontoisen käyttöönoton jälkeen mikään kohde ei ole vielä näkyvissä — tätä varten kohdistat jokaisen kohteen erikseen portaaliin (mapping) ja yhdistät halutut portaalit, kuten Booking.com tai Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ilman täydellisiä perustietoja (osoite, verotustiedot, yhteystiedot) portaalit hylkäävät yhteyden. Tarkista nämä tiedot ensin kohdassa /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Kohteen kohdistaminen portaaliin",
          excerpt:
            "Koko tiliä koskevan yhteyden jälkeen aktivoit kohdekohtaisesti enää kohdistuksen kyseiseen portaaliin.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Kohdistus ei uusi yhteys" },
            {
              type: "p",
              text: "Kun portaaliyhteys on kerran otettu käyttöön koko tilin laajuisesti, yhdistät jokaisen kohteen enää niin sanotulla kohdistuksella: määrität, mikä myNextDays-kohde vastaa mitäkin huone- tai tarjoustyyppiä portaalissa. Tämä on kohdekohtaisesti kertaluontoinen vaihe.",
            },
            { type: "h2", text: "Näin kohdistat kohteen" },
            {
              type: "steps",
              items: [
                "Avaa kohde kohdassa /objekte ja siirry välilehdelle ”Portaalit”",
                "Valitse haluamasi portaali, esimerkiksi Booking.com tai Airbnb",
                "Kohdista kohde sopivaan huone- tai tarjoustyyppiin portaalissa",
                "Aktivoi synkronointi — hinnat ja saatavuus siirtyvät siitä lähtien",
              ],
            },
            { type: "h2", text: "Yksi kohde, useita portaaleja" },
            {
              type: "p",
              text: "Yksittäinen kohde voi olla kohdistettuna useaan portaaliin samanaikaisesti. Jokainen kohdistus on riippumaton — voit esimerkiksi tehdä kohteesta näkyvän Booking.comissa ja Airbnbissa, mutta jättää Expedian toistaiseksi pois käytöstä.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Tarkista näkyvyys heti kohdistuksen jälkeen — katso [Näkyvyys portaaleittain](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Booking.comin yhdistäminen",
          excerpt: "Näin avaat Booking.comin myyntikanavaksi kohteelle.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Edellytys: koko tilin yhteys" },
            {
              type: "p",
              text: "Ennen kuin aktivoit Booking.comin kohteelle, koko tiliä koskeva portaaliyhteys on oltava käytössä (katso [Portaaliyhteyden käyttöönotto](/hilfe/portale-kanalmanager/portal-verbindung)). Sen jälkeen Booking.com on jokaiselle uudelle kohteelle enää kohdistuskysymys.",
            },
            { type: "h2", text: "Booking.comin aktivointi" },
            {
              type: "steps",
              items: [
                "Avaa kohde kohdassa /objekte, välilehti ”Portaalit”",
                "Valitse ”Booking.com” saatavilla olevien portaalien listasta",
                "Kohdista sopiva huone- tai tarjoustyyppi ja vahvista hintasuunnitelmat",
                "Aktivoi näkyvyys — kohde julkaistaan Booking.comin tarkistuksen jälkeen",
              ],
            },
            { type: "h2", text: "Mitä Booking.com odottaa sinulta" },
            {
              type: "ul",
              items: [
                "Täydellinen kohteen kuvaus, kuvat ja varustelu",
                "Vähintään yksi hintasuunnitelma hinnalla ja peruutusehdoilla",
                "Voimassa oleva maksutapa provisioita varten",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Booking.comin tekemä julkaisu voi kestää muutaman tunnin. Kohteen välilehden ”Portaalit” tila näyttää, onko yhteys jo aktiivinen.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Airbnbn yhdistäminen",
          excerpt: "Näin teet kohteesta varattavan Airbnbssa kanavanhallinnan kautta.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Airbnb yhtenä portaalina lisää" },
            {
              type: "p",
              text: "Airbnb yhdistetään kuten mikä tahansa muu portaali koko tiliä koskevan yhteyden kautta. Kun se on käytössä, aktivoit Airbnbn kohdekohtaisesti kohdistuksen avulla — riippumatta siitä, onko kohde jo näkyvissä Booking.comissa tai muissa portaaleissa.",
            },
            { type: "h2", text: "Airbnbn aktivointi kohteelle" },
            {
              type: "steps",
              items: [
                "Avaa kohde kohdassa /objekte, välilehti ”Portaalit”",
                "Valitse ”Airbnb” saatavilla olevien portaalien listasta",
                "Vahvista kohteen kategoria ja kohdistettu tarjoustyyppi",
                "Tarkista kuvat, varustelu ja talon säännöt — Airbnb vaatii täydelliset tiedot ennen julkaisua",
                "Aktivoi näkyvyys Airbnblle",
              ],
            },
            { type: "h2", text: "Aktivoinnin jälkeen" },
            {
              type: "p",
              text: "Kun Airbnb on julkaissut kohteen, hinnat ja saatavuus kulkevat automaattisesti kanavanhallinnan kautta. Airbnbssa tehdyt varaukset näkyvät sen jälkeen automaattisesti varauskalenterissasi.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ilman tallennettuja peruutusehtoja ja talon sääntöjä Airbnb hylkää julkaisun. Täydennä nämä tiedot ensin kohteessa.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Hintojen ja saatavuuden synkronointi",
          excerpt:
            "Hinnat ja saatavuus siirretään automaattisesti kaikkiin yhdistettyihin portaaleihin.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Yksi kalenteri, kaikki portaalit" },
            {
              type: "p",
              text: "Ylläpidät hintoja ja saatavuutta yksinomaan kyseisen kohteen myNextDays-kalenterissa. Kanavanhallinta siirtää jokaisen muutoksen automaattisesti kaikkiin portaaleihin, joihin kohde on aktiivisesti kohdistettu — ilman että sinun tarvitsee syöttää mitään kahteen kertaan.",
            },
            { type: "h2", text: "Mitä siirretään" },
            {
              type: "ul",
              items: [
                "Päivähinnat hintakalenteristasi tai hintasuunnitelmista",
                "Vapaat yöt ja sulkemiset",
                "Vähimmäisoleskelu sekä saapumis-/lähtörajoitukset",
                "Stop-Sell-päivät — nämä sulkeutuvat automaattisesti kaikissa portaaleissa",
              ],
            },
            { type: "h2", text: "Kuinka nopeasti synkronointi vaikuttaa" },
            {
              type: "p",
              text: "Hintojen ja saatavuuden muutokset välittyvät portaaleihin muutamassa minuutissa. Uudet varaukset lukitsevat kyseiset yöt heti, jotta samaa yötä ei voida myydä uudelleen millään muulla kanavalla.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Lisää yksittäisten päivien kanavien välisestä sulkemisesta löydät kohdasta [Ylivarausten välttäminen](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Portaalivarausten vastaanottaminen",
          excerpt: "Booking, Airbnb ja muiden kautta tulevat varaukset päätyvät automaattisesti kalenteriisi.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Automaattinen tuonti" },
            {
              type: "p",
              text: "Kun vieras varaa portaalin, kuten Booking.com tai Airbnb, kautta, kanavanhallinta tuo varauksen automaattisesti myNextDaysiin. Sinun ei tarvitse siirtää mitään käsin — varaus näkyy kalenterissa ja kyseisen kohteen varauslistassa.",
            },
            { type: "h2", text: "Mitä portaalivarauksessa tapahtuu" },
            {
              type: "steps",
              items: [
                "Portaali ilmoittaa uudesta varauksesta kanavanhallinnalle",
                "myNextDays luo varauksen vierastietoineen, ajanjaksoineen ja hintoineen",
                "Varatut yöt lukitaan heti kaikilla muilla kanavilla",
                "Saat ilmoituksen ja löydät varauksen kalenterista",
              ],
            },
            { type: "h2", text: "Peruutukset ja muutokset" },
            {
              type: "p",
              text: "Jos vieras peruuttaa portaalin kautta tai muuttaa ajanjaksoa, se siirtyy myös automaattisesti myNextDaysiin ja kyseiset yöt vapautetaan uudelleen.",
            },
            {
              type: "note",
              variant: "info",
              text: "Portaalivaraukset tunnistaa varauksen tiedoista alkuperämerkinnästä, esimerkiksi Booking.com tai Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Ylivarausten välttäminen",
          excerpt: "Stop-Sell ja automaattiset sulkemiset estävät päällekkäiset varaukset useassa portaalissa.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Miksi ylivarauksia syntyy" },
            {
              type: "p",
              text: "Ilman keskitettyä ohjausta sama yö voidaan helposti myydä kahdessa portaalissa samanaikaisesti — esimerkiksi jos hintoja ja saatavuutta ylläpidetään käsin useassa järjestelmässä. Kanavanhallinta sulkee tämän aukon, koska jokainen varaus millä tahansa kanavalla lukitsee heti kaikki muut kanavat.",
            },
            { type: "h2", text: "Työkalusi ylivarauksia vastaan" },
            {
              type: "ul",
              items: [
                "Automaattinen sulkeminen: jokainen uusi varaus — kanavasta riippumatta — lukitsee yöt kaikkialla",
                "Stop-Sell: sulkee päivän käsin kaikilla kanavilla samanaikaisesti, esimerkiksi omakäyttöä tai huoltoa varten",
                "Vähimmäisoleskelu ja saapumisrajoitukset estävät sopimattomat lyhyet varaukset",
              ],
            },
            { type: "h2", text: "Stop-Sellin asettaminen" },
            {
              type: "steps",
              items: [
                "Avaa kohteen varauskartta",
                "Merkitse kyseinen päivä tai jakso",
                "Valitse ”Stop-Sell” — päivä on sen jälkeen suljettu kaikissa portaaleissa sekä verkkosivustolla ja alustalla",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell koskee poikkeuksetta kaikkia kanavia. Ei ole mahdollista sulkea päivää vain yhdeltä portaalilta ja jättää se auki muille.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Näkyvyys portaaleittain",
          excerpt: "Jokainen portaali voidaan kytkeä päälle tai pois riippumatta verkkosivustosta ja alustan markkinapaikasta.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Kolme riippumatonta myyntikanavaa" },
            {
              type: "p",
              text: "Kohdetta voidaan myydä samanaikaisesti useaa väylää pitkin: portaalien (Booking, Airbnb ja muut) kautta, myBestDays-alustan markkinapaikan kautta ja oman verkkosivustosi kautta. Jokaisella väylällä on oma näkyvyyskytkimensä — ne ovat täysin riippumattomia toisistaan.",
            },
            { type: "h2", text: "Näkyvyyden ohjaaminen portaaleittain" },
            {
              type: "p",
              text: "Portaalien sisällä myös jokainen yksittäinen portaali on erikseen kytkettävissä. Kohde voi olla esimerkiksi aktiivinen Booking.comissa, mutta pois käytöstä Airbnbssa — molemmat kohdistukset pysyvät tästä huolimatta voimassa.",
            },
            { type: "h2", text: "Näin muutat näkyvyyttä" },
            {
              type: "steps",
              items: [
                "Avaa kohde kohdassa /objekte, välilehti ”Portaalit”",
                "Kytke haluamasi kanava (yksittäinen portaali, verkkosivusto tai alustan markkinapaikka) päälle tai pois erikseen",
                "Tallenna — muutos vaikuttaa muutaman minuutin kuluessa",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kohteen tila (aktiivinen/ei-aktiivinen) sekä Stop-Sell vaikuttavat ylätasolla kaikkiin kanaviin. Näkyvyyskytkimet ohjaavat vain sitä, millä lisäkanavilla jo aktiivinen kohde näkyy.",
            },
          ],
        },
      ],
    },
  ],
};
