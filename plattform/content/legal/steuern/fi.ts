import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Veropolitiikka",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Tällä sivulla selitetään, mitä veroja ja maksuja myBestDaysin kautta tehtävästä varauksesta voi aiheutua, kuka ne on velvollinen suorittamaan ja mitä ilmoitusvelvollisuuksia meillä alustan ylläpitäjänä on.",
    "Tämä ei ole veroneuvontaa. Yksittäistapauksen verokohtelusta kääntykää veroasiantuntijan puoleen.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Mikä koskee vieraita",
      paragraphs: [
        "Näytetty kokonaishinta sisältää alustan kautta tilitettävät verot — erityisesti majoituspalvelun arvonlisäveron siltä osin kuin palveluntarjoaja on siitä verovelvollinen.",
        "Paikalliset maksut kuten matkailijamaksu, vuodepaikkavero tai matkailumaksu tilitetään kunnasta riippuen joko alustan kautta tai peritään paikan päällä. Kumpi tapaus on kyseessä, ilmoitamme ennen varauksen viimeistelyä.",
        "Majoituspalvelun laskun laatii palveluntarjoaja; hän on suorittava elinkeinonharjoittaja. Jos tarvitsette laskun, jossa arvonlisävero on eritelty, pyytäkää se palveluntarjoajalta.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Mikä koskee palveluntarjoajia",
      paragraphs: [
        "Palveluntarjoajat vastaavat itse tulojensa oikeasta verokohtelusta — tulo- tai yhteisöverosta, arvonlisäverosta ja paikallisista maksuista.",
        "Onko vuokraus arvonlisäverollista ja mitä kantaa sovelletaan, määräytyy sen valtion lain mukaan, jossa majoitus sijaitsee (kiinteistöjen suorituspaikka).",
        "Palveluntarjoajat merkitsevät kohteeseen majoitustaan koskevat maksut, jotta ne ilmoitetaan ilmoituksessa oikein.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Ilmoittaminen veroviranomaisille (DAC7)",
      paragraphs: [
        "Digitaalisen alustan ylläpitäjänä olemme direktiivin (EU) 2021/514 (”DAC7”) ja sen kansallisten täytäntöönpanosäännösten nojalla velvollisia ilmoittamaan vuosittain toimivaltaiselle veroviranomaiselle tiedot ilmoitusvelvollisista palveluntarjoajista ja heidän alustan kautta saamistaan korvauksista.",
        "Ilmoitetaan erityisesti nimi, osoite, verotunniste, syntymäaika tai rekisterinumero, tilitystilin tiedot, majoituksen osoite sekä neljännesvuosittain maksetut korvaukset ja pidätetyt maksut.",
        "Palveluntarjoajat saavat kopion heitä koskevista ilmoitetuista tiedoista.",
        "Jos palveluntarjoaja ei kahdesta kehotuksesta huolimatta toimita ilmoitusta varten vaadittavia tietoja, olemme velvollisia pidättämään tilitykset ja sulkemaan tilin.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Ennakonpidätykset",
      paragraphs: [
        "Jos jonkin valtion laki velvoittaa meidät pidättämään ja tilittämään veron tilityksestä, teemme niin ja ilmoitamme pidätyksen tilityksessä.",
      ],
    },
  ],
};
