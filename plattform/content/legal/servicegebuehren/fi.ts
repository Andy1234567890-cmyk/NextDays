import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Palvelumaksut",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "myBestDaysin toiminta rahoitetaan välitetyistä varauksista perittävällä palvelumaksulla. Tällä sivulla selitetään, kuka sen maksaa, miten se lasketaan ja missä se ilmoitetaan.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Kuka maksaa palvelumaksun",
      paragraphs: [
        "Palvelumaksun kantaa palveluntarjoaja. Se pidätetään varausarvosta ja pienentää hänelle maksettavaa tilitystä; vieras ei maksa sitä erikseen.",
        "Jos varauksesta poikkeuksellisesti peritään palvelumaksu vieraalta, ilmoitamme sen omana eränä kokonaishinnassa ennen varauksen viimeistelyä. Ilman tätä ilmoitusta vieraalta ei peritä maksua.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Miten se lasketaan",
      paragraphs: [
        "Palvelumaksu on prosenttiosuus alustan kautta tilitettävästä varausarvosta. Varauksiinne sovellettava prosentti näkyy isäntätilillänne ja rekisteröinnin yhteydessä hyväksymässänne sopimuksessa.",
        "Laskentaperusteena on majoitushinta lisättynä alustan kautta tilitettävillä lisillä. Mukaan ei lueta läpikulkueriä, jotka eivät ole palveluntarjoajan vastasuoritetta — erityisesti matkailijamaksua ja vakuutta.",
        "Palvelumaksu lasketaan ja ilmoitetaan ilmoituksen valuutassa.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. Arvonlisävero",
      paragraphs: [
        "Palvelumaksusta peritään arvonlisävero siltä osin kuin se on lain mukaan suoritettava. Ilmoitetaanko se erikseen vai sovelletaanko käännettyä verovelvollisuutta, riippuu palveluntarjoajan kotipaikasta ja asemasta.",
        "Palvelumaksusta annamme palveluntarjoajalle tilityksen, joka on saatavilla hänen tilillään.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Peruutus ja hyvitys",
      paragraphs: [
        "Jos varaus hyvitetään kokonaan, hyvitämme palvelumaksun suhteessa hyvitettyyn varausarvoon.",
        "Jos palveluntarjoaja peruuttaa ilman painavaa syytä, palvelumaksu ei automaattisesti raukea; pidätämme oikeuden vaatia peruutuksesta aiheutuneet kulut.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Palvelumaksun muuttaminen",
      paragraphs: [
        "Ilmoitamme prosentin muutoksesta palveluntarjoajille vähintään 30 päivää ennen voimaantuloa pysyvällä välineellä; tämä vastaa asetuksen (EU) 2019/1150 3 artiklan 2 kohtaa.",
        "Jo vahvistettuihin varauksiin sovelletaan varaushetkellä voimassa ollutta prosenttia.",
      ],
    },
  ],
};
