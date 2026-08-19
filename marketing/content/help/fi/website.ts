import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Verkkosivustotyökalu",
  description: "Oman varausverkkosivuston luominen sivustotyökalulla.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Verkkosivustotyökalu",
      articles: [
        {
          slug: "website-erstellen",
          title: "Verkkosivuston luominen",
          excerpt: "Sivustotyökalulla luot oman varausverkkosivuston muutamassa minuutissa.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Verkkosivustotyökalu luo sinulle oman varausverkkosivuston — lisämyyntikanavan portaalien ja myBestDays-markkinapaikan rinnalle. Säilytät täyden hallinnan rakenteesta, sisällöstä ja brändistä.",
            },
            { type: "h2", text: "Näin luot verkkosivuston" },
            {
              type: "steps",
              items: [
                "Avaa valikosta Verkkosivusto.",
                "Napsauta Luo verkkosivusto.",
                "Valitse pohja lähtökohdaksi ulkoasullesi.",
                "Vahvista napsauttamalla Luo verkkosivusto — pääset suoraan editoriin.",
              ],
            },
            { type: "h2", text: "Mitä sivustotyökalu sisältää" },
            {
              type: "ul",
              items: [
                "Visuaalisen editorin, jossa on sivut, tasot ja esikatselunäkymä",
                "Valmiit lohkot kohdelistoille, galleriolle ja yhteydenottolomakkeille",
                "Suoran varauspolun, joka perustuu kalenterisi saatavuuteen",
                "Muokattavat värit, fontit ja logon brändiisi sopivaksi",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Aloita pohjalla, joka on lähellä kohdetyyppiäsi — lomakohde tai hotelli — se säästää aikaa lohkojen mukauttamisessa myöhemmin.",
            },
            { type: "h2", text: "Seuraavat askeleet" },
            {
              type: "p",
              text: "Luomisen jälkeen mukautat sivuja ja ulkoasua, katso [Sivujen ja ulkoasun muokkaaminen](/hilfe/website/seiten-layout), ja näytät kohteesi verkkosivustolla, katso [Kohteiden näyttäminen verkkosivustolla](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Sivujen ja ulkoasun muokkaaminen",
          excerpt: "Sivujen, tasojen ja lohkojen mukauttaminen visuaalisessa editorissa.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Editori jakautuu kolmeen osaan: vasemmalla sivujen ja tasojen yleiskatsaus, keskellä verkkosivustosi esikatselu, oikealla valitun lohkon asetukset.",
            },
            { type: "h2", text: "Sivun muokkaaminen" },
            {
              type: "steps",
              items: [
                "Valitse vasemmalta kohdasta Sivut haluamasi sivu.",
                "Napsauta esikatselussa lohkoa valitaksesi sen.",
                "Mukauta oikealla lohkon tekstiä, kuvaa tai välejä.",
                "Vedä lohkoja järjestyksen muuttamiseksi.",
              ],
            },
            { type: "h2", text: "Uusien sivujen ja lohkojen lisääminen" },
            {
              type: "p",
              text: "Painikkeella Lisää sivu luot uusia alisivuja, esimerkiksi Meistä tai Yhteystiedot. Sivun sisällä lisäät painikkeella Lisää lohko uusia osioita, kuten galleria, arvostelut tai yhteydenottolomake.",
            },
            {
              type: "ul",
              items: [
                "Etusivu, kohdeyleiskatsaus ja yhteystiedot ovat valmiina jokaisessa pohjassa",
                "Muut sivut voidaan nimetä vapaasti ja lisätä navigaatioon",
                "Lohkot ovat responsiivisia ja mukautuvat pöytäkoneelle, tabletille ja älypuhelimelle",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Editorin muutokset ovat aluksi vain luonnos. Vasta napsautus Julkaise vie ne julkiselle verkkosivustollesi.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Verkkotunnuksen yhdistäminen",
          excerpt: "Oman verkkotunnuksen liittäminen myNextDays-verkkosivustoosi.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Oletusarvoisesti verkkosivustosi on saatavilla myNextDays-alatunnuksen kautta. Jos haluat käyttää sen sijaan omaa verkkotunnusta, esimerkiksi yrityksesi.fi, yhdistä se osiossa Verkkotunnus.",
            },
            { type: "h2", text: "Verkkotunnuksen tallentaminen" },
            {
              type: "steps",
              items: [
                "Avaa verkkosivuston asetuksissa kohta Verkkotunnus.",
                "Syötä oma verkkotunnuksesi ja napsauta Yhdistä.",
                "Lisää verkkotunnuspalveluntarjoajallesi näytetyt DNS-tietueet.",
                "Odota vahvistusta — tarkistus tapahtuu automaattisesti taustalla.",
              ],
            },
            { type: "h2", text: "DNS-tietueiden oikea asettaminen" },
            {
              type: "p",
              text: "myNextDays näyttää sinulle tarkalleen tarvittavat tietueet verkkotunnuspalveluntarjoajaasi varten. Yhteys aktivoituu vasta, kun nämä tietueet on asetettu oikein ja ne ovat levinneet maailmanlaajuisesti — tämä voi kestää palveluntarjoajasta riippuen muutaman tunnin.",
            },
            {
              type: "ul",
              items: [
                "Aseta CNAME- tai A-tietue näytetyn ohjeen mukaisesti",
                "Poista ensin olemassa olevat, ristiriitaiset tietueet samalle verkkotunnukselle",
                "Https-varmenne myönnetään automaattisesti onnistuneen yhdistämisen jälkeen",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ilman oikein asetettuja DNS-tietueita verkkosivustosi ei ole tavoitettavissa omalla verkkotunnuksella — tarkista kirjoitusasu huolellisesti palveluntarjoajasi tietoja vasten.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Kohteiden näyttäminen verkkosivustolla",
          excerpt: "Mitkä kohteet näkyvät ja ovat varattavissa verkkosivustolla, ohjataan erikseen kohteittain.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Jotta kohde näkyy verkkosivustollasi, kyseisen kohteen verkkosivustonäkyvyyden on oltava päällä. Tämä kytkin on riippumaton näkyvyydestä myBestDays-markkinapaikalla tai portaaleissa.",
            },
            { type: "h2", text: "Kohteen avaaminen verkkosivustolle" },
            {
              type: "steps",
              items: [
                "Avaa kohde kohdassa Kohteet.",
                "Siirry Näkyvyys-välilehdelle.",
                "Aktivoi kytkin Verkkosivusto.",
                "Siirry verkkosivustolle ja tarkista lohko Kohdeyleiskatsaus esikatselussa.",
              ],
            },
            { type: "h2", text: "Järjestyksen ja esitystavan mukauttaminen" },
            {
              type: "p",
              text: "Lohkossa Kohdeyleiskatsaus määrität, järjestyvätkö kohteet automaattisesti saatavuuden mukaan vai annatko kiinteän järjestyksen. Jokainen kohde näyttää pääkuvan, perushinnan tallennetussa valuutassaan ja tärkeimmät varusteominaisuudet.",
            },
            {
              type: "ul",
              items: [
                "Automaattinen lajittelu saatavuuden mukaan tai käsin määritetty järjestys",
                "Suodatus kohdetyypin tai varustelun mukaan voidaan halutessa aktivoida",
                "Varausvaiheet tapahtuvat suoraan verkkosivustolla ilman portaalikiertoa",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kohde, jonka verkkosivustonäkyvyys ei ole aktivoitu, pysyy piilossa kohdeyleiskatsauksesta, vaikka se olisikin näkyvissä markkinapaikalla tai portaaleissa.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Verkkosivuston julkaiseminen",
          excerpt: "Luonnokset tulevat julkisesti näkyviksi vasta, kun napsautat Julkaise.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Niin kauan kuin työskentelet editorissa, vain sinä näet nykyisen luonnoksen. Vasta napsautus Julkaise tekee muutokset näkyviksi kaikille kävijöille verkkotunnuksellasi.",
            },
            { type: "h2", text: "Näin julkaiset" },
            {
              type: "steps",
              items: [
                "Avaa editorissa esikatselu ja tarkista kaikki sivut.",
                "Napsauta oikeasta yläkulmasta Julkaise.",
                "Vahvista valintaikkuna — verkkosivusto on välittömästi sen jälkeen käytössä.",
                "Avaa verkkotunnuksesi uudessa välilehdessä tuloksen tarkistamiseksi.",
              ],
            },
            { type: "h2", text: "Luonnokset ja palauttaminen" },
            {
              type: "p",
              text: "Niin kauan kuin et ole vielä julkaissut, voit milloin tahansa palata viimeksi julkaistuun tilaan menettämättä luonnosta lopullisesti — käytä tähän kohtaa Hylkää luonnos verkkosivuston asetuksissa.",
            },
            {
              type: "ul",
              items: [
                "Julkaistut muutokset näkyvät heti verkkotunnuksellasi",
                "Julkaisematon luonnos pysyy sisäisenä, kunnes vahvistat sen",
                "Jokainen julkaisu tallennetaan päivämäärineen historiaan",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Tarkista ennen julkaisua mobiilinäkymä esikatselussa — useimmat vieraat avaavat varausverkkosivustoja älypuhelimella.",
            },
          ],
        },
      ],
    },
  ],
};
