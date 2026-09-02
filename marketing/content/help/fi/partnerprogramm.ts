import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Kumppanuusohjelma",
  description: "Suosittele yrityksiä, rakenna tiimi ja ansaitse osuus tilaustuloista.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Näin se toimii",
      articles: [
        {
          slug: "ueberblick",
          title: "Kumppanuusohjelma yhdellä silmäyksellä",
          excerpt: "Kuka voi osallistua, miten provisio syntyy ja mitä näet.",
          updated: "Tilanne: syyskuu 2026",
          body: [
            {
              type: "p",
              text: "Kumppanina suosittelet myNextDaysia vuokranantajille, toimistoille ja hotelleille. Jos yritys rekisteröityy koodillasi tai linkilläsi ja maksaa tilauslaskunsa, saat osuuden tilausten nettotuloista kahdentoista kuukauden ajan. Maksavien asiakkaiden mukainen porrastus näkyy ohjelmasivulla reaaliaikaisesti.",
            },
            { type: "h2", text: "Kuka voi tulla kumppaniksi" },
            {
              type: "ul",
              items: [
                "Henkilöt ja yritykset EU:ssa, Sveitsissä tai Yhdistyneessä kuningaskunnassa, joilla on todellinen kanava majoittajiin: vaikuttajat, konsultit, toimistot, verotoimistot, yhdistykset.",
                "Myös myNextDays-asiakkaat itse – tilaus ei ole edellytys.",
                "Pakollinen hakemuksessa: vähintään yksi sosiaalisen median tili (Instagram, TikTok, YouTube, Facebook, LinkedIn…) osoitteella, käyttäjätunnuksella ja kattavuudella. Verkkosivusto tai uutiskirje mielellään lisäksi.",
              ],
            },
            { type: "h2", text: "Miten yritys liitetään sinuun" },
            {
              type: "steps",
              items: [
                "Jaat linkkisi (mynextdays.com/p/KOODISI) tai koodisi.",
                "Yritys näkee koodin rekisteröityessään kentässä ”Suosittelija” ja vahvistaa sen lähettämällä – ilman evästettä.",
                "Kahdentoista kuukauden jakso alkaa ensimmäisestä maksetusta tilauslaskusta.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Näet asiakkaasi salanimellä (asiakas #1, #2…) maan, tilan ja summien kera – et koskaan nimeä tai sähköpostia. Yritys liitetään täsmälleen yhteen kumppaniin; ensimmäinen voittaa.",
            },
            { type: "h2", text: "Mitä löydät hallintapaneelista" },
            {
              type: "ul",
              items: [
                "Yleiskatsaus: sijoitus, klikkaukset, rekisteröityneet ja maksavat yritykset, avoimet, maksettavat ja maksetut provisiot.",
                "Provisiot: jokainen maksettu tilauslasku rivinä, jossa on perusta, korko, summa ja tila.",
                "Maksut: kuukausittain per valuutta vähimmäissummasta alkaen, hyvityksellä (itse laskutus) tositteena.",
                "Linkit ja materiaali: koodisi, mainosmateriaali ja pakollinen merkintä maittain.",
                "Viestit: suora yhteys kumppanitiimiin.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Rakenna tiimi: tiimiprovisio",
          excerpt: "Rekrytoi kumppaneita, jotka liittyvät koodillasi – ja ansaitse osuus heidän asiakkaidensa tuloista.",
          updated: "Tilanne: syyskuu 2026",
          body: [
            {
              type: "p",
              text: "Voit tuoda muita kumppaneita tiimiisi. Jos joku hakee tiimilinkkisi kautta (mynextdays.com/p/KOODISI?team=1) ja syöttää koodisi näkyvästi hakemukseen, hän kuuluu tiimiisi hyväksynnän jälkeen. Saat tiimiprovision tiimikumppaneidesi asiakkaiden tilausten nettotuloista.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "Tiimikorko määräytyy SINUN sijoituksesi mukaan maksuhetkellä – ei tiimisi koon mukaan. Korot näkyvät ohjelmasivulla.",
                "Sijoituksesi muodostuu vain omista maksavista asiakkaistasi. Tiimiasiakkaat eivät vaikuta sijoitukseen.",
                "Täsmälleen yksi taso: tiimikumppanisi eivät rakenna omaa tiimiäsi alapuolellesi.",
                "Ei osallistumismaksua, ei rahaa kumppanin rekrytoinnista. Tiimiprovisio syntyy yksinomaan maksetuista tilaustuloista.",
                "Kaksitoista kuukautta kyseisen tiimiasiakkaan ensimmäisestä maksetusta laskusta, 30 päivän palautusikkuna, palautus tai takaisinperintä – kuten omassa provisiossa.",
                "Tiimiprovisio syntyy vain, jos sinä ja tiimikumppanisi olette hyväksyttyjä; muuten se keskeytetään.",
              ],
            },
            { type: "h2", text: "Tiimianalyysi" },
            {
              type: "p",
              text: "Kohdassa ”Tiimi” näet jokaisen tiimikumppanin arvon, maksavat asiakkaat, heidän asiakkaidensa tilaustulot (30 päivää ja yhteensä) ja tiimiprovisiosi niistä – avoinna, maksettavissa, maksettu – sekä viimeisten kahdentoista kuukauden kehityksen. Et näe tiimikumppaneidesi asiakastietoja; ne kuuluvat heille.",
            },
            {
              type: "note",
              variant: "tip",
              text: "”Tiimin” kautta tavoitat tiimikumppanisi suoraan viestillä – ja sponsorisi sinut.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Sponsorin ja tiimikumppanin sama sähköpostidomain tai sama pankkiyhteys merkitään ja tiimitiimi tarkistaa sen ennen tiimiprovision maksamista.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Maksu, hyvitys ja verot",
          excerpt: "Milloin provisio on maksettavissa, miltä hyvitys näyttää ja mitä verotuksellisia sääntöjä sovelletaan.",
          updated: "Tilanne: syyskuu 2026",
          body: [
            {
              type: "steps",
              items: [
                "Provisiorivi syntyy maksetun tilauslaskun myötä ja on 30 päivää ”avoinna” (palautusikkuna).",
                "Sen jälkeen se on maksettavissa. Kuukauden ensimmäisenä päivänä yhdistämme kaikki maksettavissa olevat rivit valuutoittain.",
                "Jos summa ylittää valuuttasi vähimmäismäärän, syntyy maksu hyvityksellä (self-billing). Sinun ei tarvitse lähettää laskua.",
                "Siirron jälkeen maksu näkyy ”Maksettuna” viitteellä hallintapaneelissa.",
              ],
            },
            {
              type: "ul",
              items: [
                "Yritykset: Hyvityksessä on käännetyn verovelvollisuuden merkintä; edellytyksenä on vahvistettu ALV-tunnus (VIES-tarkistus).",
                "Yksityishenkilöt: Hyvityksessä ei ole arvonlisäveroa; provisio on verotettava itse.",
                "Maksu SEPA:lla, Wise:lla tai PayPalilla – tiedot syötetään profiiliin; muutokset vaativat salasanasi.",
                "Ei muuntamista: DKK-provisio maksetaan DKK:na, EUR-provisio EUR:na.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Mainonnan on oltava tunnistettavissa mainontana – viestin alussa, viestin kielellä. Todistetut sanamuodot maittain löytyvät kohdasta ”Linkit ja materiaali”. Rikkomukset voivat johtaa estoon.",
            },
          ],
        },
      ],
    },
  ],
};
