import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Peruutusehdot",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Jokainen palveluntarjoaja valitsee majoitukselleen peruutusehdon. Mikä niistä on voimassa, ilmenee ilmoituksesta ja varausvahvistuksestanne. Tällä sivulla kuvataan ehdot, joita tarjoamme palveluntarjoajille.",
  ],
  sections: [
    {
      id: "modelle",
      heading: "1. Peruutusehdot yhdellä silmäyksellä",
      paragraphs: [
        "Ratkaiseva on aina ilmoituksessa mainittu ehto. Määräajat lasketaan saapumispäivän alusta majoituksen paikallista aikaa.",
      ],
      list: [
        "Joustava — maksuton peruutus 24 tuntia ennen saapumista. Sen jälkeen veloitetaan ensimmäinen yö, muut yöt hyvitetään.",
        "Kohtuullinen — maksuton peruutus 5 päivää ennen saapumista. Sen jälkeen veloitetaan 50 % majoitushinnasta.",
        "Tiukka — maksuton peruutus 14 päivää ennen saapumista, edellyttäen että varaus tehtiin vähintään 14 päivää ennen saapumista. Sen jälkeen veloitetaan 50 % 7 päivään asti ennen saapumista ja tämän jälkeen koko hinta.",
        "Ei-palautettava — ei maksutonta peruutusta. Hinta on yleensä alempi; hyvityksen puuttumisesta huomautamme erikseen ennen varausta.",
      ],
    },
    {
      id: "was-erstattet-wird",
      heading: "2. Mitä hyvitetään joka tapauksessa",
      paragraphs: [
        "Valitusta ehdosta riippumatta hyvitämme jokaisessa peruutuksessa:",
      ],
      list: [
        "matkailijamaksun ja muut läpikulkumaksut siltä osin kuin ne on tilitetty alustan kautta eikä yöpymistä tapahdu;",
        "alustan kautta veloitetun vakuuden kokonaisuudessaan;",
        "lisäpalvelut, joita ei ole tuotettu.",
      ],
    },
    {
      id: "stornierung-durch-anbieter",
      heading: "3. Palveluntarjoajan tekemä peruutus",
      paragraphs: [
        "Jos palveluntarjoaja peruuttaa, saatte alustan kautta maksetun määrän kokonaan takaisin — valitusta peruutusehdosta riippumatta.",
        "Lisäksi autamme teitä löytämään vastaavan majoituksen; ks. [Uudelleenmajoitus- ja hyvityskäytäntö](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "widerruf",
      heading: "4. Lakisääteistä peruuttamisoikeutta ei ole",
      paragraphs: [
        "Tietylle ajanjaksolle varattavissa majoituspalveluissa ei pääsääntöisesti ole direktiivin 2011/83/EU 16 artiklan l alakohdan mukaista lakisääteistä peruuttamisoikeutta. Tässä kuvatut peruutusehdot ovat siksi sopimusperusteinen lupaus, eivät peruuttamisoikeuden toteutus.",
        "Pakottavat lakisääteiset oikeudet, erityisesti majoituksen virheeseen perustuvat oikeudet, eivät rajoitu.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Muutos peruutuksen sijaan",
      paragraphs: [
        "Jos haluatte muuttaa ajanjaksoa tai matkustajamäärää, tehkää muutospyyntö varauksestanne. Palveluntarjoajan on hyväksyttävä se; siihen asti alkuperäinen varaus on voimassa.",
        "Jos muutos johtaa korkeampaan hintaan, erotus erääntyy. Jos se johtaa alempaan hintaan, hyvitämme erotuksen siltä osin kuin voimassa oleva peruutusehto sen poistuvan osan osalta sallii.",
      ],
    },
    {
      id: "wie",
      heading: "6. Miten peruutatte",
      paragraphs: [
        "Peruuttakaa tililtänne kohdasta ”Varaukset”. Määräajan kannalta ratkaiseva on hetki, jolloin peruutus saapuu meille.",
        "Saatte peruutusvahvistuksen, jossa on hyvityksen määrä. Tilityksestä ks. [Maksuehdot](https://mybestdays.dk/rechtliches/zahlungsbedingungen#rueckerstattungen).",
      ],
    },
  ],
};
