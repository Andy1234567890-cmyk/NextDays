import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Alusta (markkinapaikka)",
  description: "Myynti myBestDays-markkinapaikalla.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Markkinapaikka",
      articles: [
        {
          slug: "der-marktplatz",
          title: "myBestDays-markkinapaikka",
          excerpt: "Globaali myBestDays-markkinapaikka on oma varauskanava portaalien ja verkkosivuston rinnalla.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "myBestDays-markkinapaikka (/plattform) on myBestDaysin oma globaali varauskanava — verrattavissa Bookingiin tai Airbnbhin, mutta osa samaa alustaa. Vieraat selaavat siellä kaikkien liittyneiden yritysten kohteita ja varaavat suoraan.",
            },
            { type: "h2", text: "Ei ”suoravaraus”, vaan tasavertainen kanava" },
            {
              type: "p",
              text: "Markkinapaikka ei korvaa suoravarausta omalla verkkosivustollasi. Se on itsenäinen, kolmas myyntiväylä omalla näkyvyysakselillaan, omalla vieraskunnallaan ja omalla provisiollaan — aivan kuten portaali, mutta myBestDaysin itsensä ylläpitämä.",
            },
            { type: "h2", text: "Miten kohteet päätyvät markkinapaikalle" },
            {
              type: "ul",
              items: [
                "Kohteen on oltava aktiivinen (kohteen tila sallii myynnin).",
                "Markkinapaikan näkyvyyden on oltava päällä — erillään portaaleista ja verkkosivustosta.",
                "Haluttuna ajanjaksona kalenterissa on oltava saatavuutta.",
              ],
            },
            { type: "h2", text: "Markkinapaikan varaukset" },
            {
              type: "p",
              text: "Markkinapaikan varaus lukitsee vastaavat yöt heti kaikilla muilla kanavilla — aivan kuten portaali- tai verkkosivustovaraus. Se näkyy kalenterissasi ja varauksissa kuten mikä tahansa muu varaus, merkittynä kanavalla ”Alusta”.",
            },
            {
              type: "note",
              variant: "info",
              text: "Stop-Sell ja ei-aktiivinen kohteen tila vaikuttavat kaikilla kanavilla ja sulkevat myös markkinapaikan — riippumatta markkinapaikan näkyvyyskytkimestä.",
            },
            {
              type: "p",
              text: "Miten avaat kohteen markkinapaikalle, lue kohdasta [Kohteen listaaminen markkinapaikalla](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Kohteen listaaminen markkinapaikalla",
          excerpt: "Markkinapaikan näkyvyys on oma kytkin, erillään portaaleista ja verkkosivustosta.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Markkinapaikan näkyvyyttä ohjaat kohteen omalla kytkimellä — riippumatta siitä, onko sama kohde näkyvissä myös portaaleissa tai verkkosivustollasi.",
            },
            { type: "h2", text: "Näin listaat kohteen" },
            {
              type: "steps",
              items: [
                "Avaa kohde kohdassa Kohteet.",
                "Siirry Näkyvyys-välilehdelle.",
                "Aktivoi kytkin Alustan markkinapaikka.",
                "Tarkista, että kohteen tila on aktiivinen ja kalenterissa on saatavuutta.",
              ],
            },
            { type: "h2", text: "Edellytys: täydellinen profiili" },
            {
              type: "p",
              text: "Markkinapaikka näyttää vain kohteita, joilla on täydelliset tiedot — pääkuva, kuvaus, varustelu ja perushinta on oltava tallennettuna. Jos pakollisia tietoja puuttuu, kohde pysyy näkymättömänä kytkimen aktivoinnista huolimatta.",
            },
            {
              type: "ul",
              items: [
                "Vähintään yksi pääkuva ja kuvaus",
                "Varusteominaisuudet kategorialistasta",
                "Kapasiteetti ja perushinta tallennetussa kohteen valuutassa",
                "Kalenterin saatavuus halutulle ajanjaksolle",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Kun napsautat Julkaise, myNextDays avaa normaalisti markkinapaikan, portaalit ja verkkosivuston yhdessä — voit myöhemmin kytkeä markkinapaikan pois erikseen milloin tahansa.",
            },
            { type: "h2", text: "Näkyvyyden poistaminen" },
            {
              type: "p",
              text: "Jos poistat kytkimen Alustan markkinapaikka käytöstä, kohde katoaa markkinapaikan hausta. Jo vahvistetut varaukset eivät vaikuta tähän ja jatkuvat tavalliseen tapaan, katso [Markkinapaikan provisio](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Markkinapaikan provisio",
          excerpt: "Jokaisesta markkinapaikan kautta välitetystä varauksesta peritään hinnastossa tallennettu provisio.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Kuten missä tahansa varausportaalissa, myBestDays-markkinapaikan kautta syntyneistä varauksista peritään provisio. Se lasketaan varauskohtaisesti ja on riippumaton mahdollisista portaaliprovisioista.",
            },
            { type: "h2", text: "Miten provisio lasketaan" },
            {
              type: "p",
              text: "Määrä perustuu yrityksesi hinnastossa tallennettuun provisioon. Löydät nykyisen prosentin milloin tahansa kohdasta Tili, osiosta Laskutus — siellä ei oleteta yleistä arvoa, vaan näytetään hinnastoosi todellisuudessa sovellettava prosentti.",
            },
            { type: "h2", text: "Missä tarkastelet provisiota" },
            {
              type: "steps",
              items: [
                "Avaa valikosta Tili.",
                "Siirry osioon Laskutus.",
                "Avaa markkinapaikan varaus nähdäksesi liikevaihdon ja provision yksityiskohdat.",
                "Tarkista kuluvan laskutuskauden provisioiden yhteenveto.",
              ],
            },
            { type: "h2", text: "Ero portaaliprovisioihin" },
            {
              type: "ul",
              items: [
                "Markkinapaikan provisio koskee yksinomaan myBestDays-markkinapaikan kautta tehtyjä varauksia.",
                "Portaalivaraukset (Booking, Airbnb ja muut) noudattavat kyseisen portaalin ehtoja.",
                "Verkkosivustovaraukset noudattavat hinnastosi ehtoja ilman markkinapaikan provisiota.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Provisio määräytyy automaattisesti hinnastostasi. Puuttuva tai epäselvä hinnasto johtaa selkeään virheilmoitukseen arvioidun arvon sijaan.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Vierasprofiili ja arvostelut",
          excerpt: "Markkinapaikan vieraalla on profiili varaushistorioineen, ja hän voi jättää arvosteluja.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Vieraat, jotka varaavat myBestDays-markkinapaikan kautta, luovat oman vierasprofiilinsa. Siihen kertyy heidän varauksensa, viestinsä yritysten kanssa ja antamansa arvostelut — samaan tapaan kuin portaalin vierastilillä.",
            },
            { type: "h2", text: "Mitä näet yrityksenä" },
            {
              type: "p",
              text: "Markkinapaikan varauksen tiedoissa näet vierasprofiilin aiempine oleskeluineen yrityksesi luona ja, mikäli vieras on sen sallinut, julkisesti näkyvät arvostelut muista majoituksista.",
            },
            { type: "h2", text: "Arvostelut oleskelun jälkeen" },
            {
              type: "steps",
              items: [
                "Uloskirjautumisen jälkeen vieras saa kehotuksen jättää arvostelu.",
                "Arvostelu ilmestyy lyhyen tarkistuksen jälkeen kohteen sivulle markkinapaikalla.",
                "Voit yrityksenä vastata julkisesti jokaiseen arvosteluun.",
                "Asiattomat tai väärinkäyttöä sisältävät arvostelut voit ilmoittaa tarkistettavaksi.",
              ],
            },
            {
              type: "ul",
              items: [
                "Arvostelut on sidottu todelliseen varaukseen — ei arvostelua ilman oleskelua.",
                "Vieras arvioi siisteyttä, viestintää, sijaintia ja hinta-laatusuhdetta.",
                "Vastauksesi näkyy kaikille markkinapaikan kävijöille.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Hyvät arvostelut vaikuttavat suoraan kohteesi sijoitukseen markkinapaikan haussa — reagoi kritiikkiin nopeasti ja asiallisesti.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Estetyt henkilöt",
          excerpt: "Yritys voi estää vieraan, jolloin viestit ja varaukset estyvät.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Jos vieraan kanssa syntyy ongelmia, voit yrityksenä estää hänet. Estetty henkilö ei voi enää lähettää sinulle viestejä eikä tehdä uutta varausta yrityksellesi.",
            },
            { type: "h2", text: "Henkilön estäminen" },
            {
              type: "steps",
              items: [
                "Avaa viestihistoria tai varaus kyseisen vieraan kanssa.",
                "Napsauta Estä vieras.",
                "Vahvista valintaikkuna — esto astuu voimaan heti.",
                "Estetty henkilö näkyy sen jälkeen kohdassa Tili, osiossa Estetyt henkilöt.",
              ],
            },
            { type: "h2", text: "Mitä esto tekee" },
            {
              type: "ul",
              items: [
                "Vieras ei voi enää lähettää uusia viestejä yrityksellesi.",
                "Vieras ei voi tehdä uutta varausta yrityksellesi.",
                "Meneillään oleva varaus, jonka saapuminen on jo vahvistettu seuraavien kahden viikon sisällä, ei muutu estosta, jotta oleskelu voidaan hoitaa asianmukaisesti loppuun.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Esto koskee yksinomaan yritystäsi. Muut markkinapaikan yritykset eivät näe estoa eikä se vaikuta niihin.",
            },
            { type: "h2", text: "Eston poistaminen" },
            {
              type: "p",
              text: "Avaa Tili ja siellä Estetyt henkilöt. Valitse merkintä ja napsauta Poista esto — vieras voi tämän jälkeen taas lähettää viestejä ja varata.",
            },
          ],
        },
      ],
    },
  ],
};
