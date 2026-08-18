import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Lyhytaikaisvuokraus ja rekisteröintivelvollisuudet",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Monissa kaupungeissa ja alueilla asunnon lyhytaikainen vuokraus edellyttää lupaa, rekisteröintiä tai ilmoitusta. Tällä sivulla selitetään, mitä tämä tarkoittaa palveluntarjoajille ja vieraille.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Oikeudellinen kehys",
      paragraphs: [
        "Asetus (EU) 2024/1028 lyhytaikaisten majoituspalvelujen tietojen keruusta ja jakamisesta luo yhtenäisen kehyksen: siellä missä jäsenvaltio tai paikallinen viranomainen on ottanut käyttöön rekisteröintimenettelyn, jokainen yksikkö saa rekisteröintinumeron.",
        "Alustojen on näytettävä tämä numero, tarkastettava sen voimassaolo pistokokein ja toimitettava toimivaltaisille viranomaisille säännöllisin väliajoin tietoja toiminnasta.",
        "Lisäksi sovelletaan edelleen kansallisia ja paikallisia säännöksiä — esimerkiksi asuinkäytön muuttamisesta, vuokrauspäivien enimmäismäärästä, paloturvallisuudesta ja vieraiden ilmoittamisesta.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Mitä palveluntarjoajien on tehtävä",
      paragraphs: [
        "Tarkistakaa ennen julkaisua, koskeeko majoitustanne rekisteröinti-, lupa- tai ilmoitusvelvollisuus, ja täyttäkää se.",
        "Syöttäkää rekisteröintinumero kohteeseen, jos sellainen on. Näytämme sen ilmoituksessa.",
        "Noudattakaa vuokrauspäivien enimmäismäärää ja muita paikallisia rajoja. Niiden seuranta on teidän tehtävänne, ei meidän.",
        "Emme saa näyttää pysyvästi ilmoitusta ilman vaadittua rekisteröintinumeroa. Jos se puuttuu tai osoittautuu pätemättömäksi, pyydämme sitä; jos tietoa ei anneta, poistamme ilmoituksen käytöstä.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. Mitä tämä tarkoittaa vieraille",
      paragraphs: [
        "Jos majoitusta koskee rekisteröintivelvollisuus, näette rekisteröintinumeron ilmoituksessa. Se on osoitus siitä, että vuokraus on ilmoitettu toimivaltaiselle viranomaiselle.",
        "Kohteessa voidaan edellyttää ilmoittautumista (matkustajailmoitus, henkilöllisyystiedot, matkailijamaksuilmoitus). Palveluntarjoaja pyytää tarvittavat tiedot; antakaa ne ajoissa.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Tietojen toimittaminen viranomaisille",
      paragraphs: [
        "Siltä osin kuin asetus (EU) 2024/1028 tai kansallinen laki sitä edellyttää, toimitamme toimivaltaisille viranomaisille tietoja vuokraustoiminnasta — erityisesti rekisteröintinumeron, yksikön osoitteen, varattujen öiden määrän ja vieraiden lukumäärän.",
        "Toimittaminen tapahtuu lakisääteisen velvoitteen täyttämiseksi asetuksen (EU) 2016/679 6 artiklan 1 kohdan c alakohdan mukaisesti. Yksityiskohdat kuvataan [Tietosuojaselosteessa](https://mybestdays.dk/rechtliches/datenschutz).",
        "Tästä erillään on DAC7:n mukainen verotuksellinen ilmoitusvelvollisuus; ks. [Veropolitiikka](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Rikkomuksista ilmoittaminen",
      paragraphs: [
        "Jos teillä on viitteitä siitä, että majoitusta tarjotaan ilman vaadittua lupaa tai rekisteröintiä, ilmoittakaa siitä meille ilmoituksen ilmoitustoiminnolla. Selvitämme jokaisen ilmoituksen.",
      ],
    },
  ],
};
