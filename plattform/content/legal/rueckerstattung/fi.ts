import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Uudelleenmajoitus- ja hyvityskäytäntö",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Tämä käytäntö tulee sovellettavaksi, kun myBestDaysin kautta varatussa majoituksessa on jotain perustavanlaatuisesti vialla — se on siten lupaus, joka menee palveluntarjoajan peruutusehtoa pidemmälle.",
    "Se koskee varauksia, jotka on tehty ja maksettu alustan kautta.",
  ],
  sections: [
    {
      id: "wann",
      heading: "1. Milloin tätä käytäntöä sovelletaan",
      paragraphs: [
        "Sitä sovelletaan, kun ennen oleskelua tai sen aikana tapahtuu jokin seuraavista:",
      ],
      list: [
        "Palveluntarjoaja peruuttaa varauksen.",
        "Palveluntarjoaja ei ole tavoitettavissa saapuessa tai ette saa pääsyä majoitukseen.",
        "Majoitus ei ole asuinkelpoinen — esimerkiksi lämmityksen puuttuessa kylmällä säällä, juoksevan veden puuttuessa, riittämättömän siisteyden tai terveysvaaran vuoksi.",
        "Majoitus poikkeaa olennaisesti ilmoituksesta — eri määrä vuodepaikkoja tai huoneita, eri sijainti, ilmoituksessa luvattu ja tosiasiallisesti puuttuva keskeinen varuste.",
        "Majoituksessa oleskelee toinen vieras, jota ei ollut ilmoitettu.",
      ],
    },
    {
      id: "was-sie-tun",
      heading: "2. Mitä teidän on tehtävä",
      paragraphs: [
        "Ilmoittakaa ongelmasta mahdollisimman varhain, kuitenkin viimeistään 24 tunnin kuluessa sen havaitsemisesta — saapumispäivän ongelmista siis saapumispäivänä.",
        "Ilmoittakaa siitä ensin palveluntarjoajalle viestitoiminnon kautta ja antakaa hänelle tilaisuus korjata se. Terveyttänne uhkaavassa vaarassa tai jos palveluntarjoaja ei ole tavoitettavissa, tämä velvollisuus poistuu.",
        "Todentakaa ongelma mahdollisuuksien mukaan kuvin, videoin tai viestein. Ilman todisteita emme useinkaan voi selvittää asiaa.",
      ],
    },
    {
      id: "was-wir-tun",
      heading: "3. Mitä me teemme",
      paragraphs: [
        "Jos ongelma vahvistuu, voitte valita vastaavan korvaavan majoituksen ja hyvityksen välillä.",
        "Jos valitsette korvaavan majoituksen, vastaamme lisähinnasta alkuperäiseen varaukseenne verrattuna siltä osin kuin korvaava majoitus on sijainniltaan, varustelultaan ja kooltaan vastaava.",
        "Jos valitsette hyvityksen, hyvitämme ennen saapumista ilmenneessä ongelmassa alustan kautta maksetun määrän kokonaan. Jos ongelma ilmenee oleskelun aikana, hyvitämme osuuden käyttökelvottomista öistä sekä kohtuullisen määrän jo vietettyjen öiden haitasta.",
        "Ilmoitamme päätöksestämme perusteluineen. Voitte saattaa sen tarkasteltavaksi kohdassa [Valitukset ja riidanratkaisu](https://mybestdays.dk/rechtliches/beschwerden) kuvattua reittiä.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "4. Mitä ei kateta",
      paragraphs: ["Tätä käytäntöä ei sovelleta:"],
      list: [
        "olosuhteisiin, jotka oli kuvattu ilmoituksessa tai jotka olivat kuvista havaittavissa;",
        "vähäisiin poikkeamiin, jotka eivät haittaa käyttöä (esimerkiksi eri seinäväri tai eri sohva);",
        "tilapäisiin häiriöihin, jotka palveluntarjoaja korjaa kohtuullisessa ajassa;",
        "majoituksen ulkopuolisiin olosuhteisiin, joihin palveluntarjoaja ei voi vaikuttaa — sää, liikenne, kunnan työmaat, nähtävyyksien sulkeminen (näihin sovelletaan [Vakavia häiriöitä koskevaa käytäntöä](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen));",
        "ongelmiin, jotka te tai matkaseurueenne olette aiheuttaneet;",
        "varauksiin, jotka on tehty tai maksettu alustan ulkopuolella.",
      ],
    },
    {
      id: "verhaeltnis",
      heading: "5. Suhde lakisääteisiin oikeuksiinne",
      paragraphs: [
        "Tämä käytäntö on myBestDaysin vapaaehtoinen lupaus. Lakisääteiset vaatimuksenne palveluntarjoajaa kohtaan — erityisesti hinnanalennus ja vahingonkorvaus — eivät rajoitu ja voivat mennä pidemmälle.",
        "Siltä osin kuin hyvitämme teille, vastaavat vaatimukset palveluntarjoajaa kohtaan siirtyvät meille.",
      ],
    },
  ],
};
