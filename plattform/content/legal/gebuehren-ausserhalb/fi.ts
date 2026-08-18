import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Alustan ulkopuoliset maksut",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Tämä käytäntö sääntelee, mitä määriä palveluntarjoaja saa vaatia alustan ulkopuolella ja mitä ei. Se suojaa vieraita siltä, että paikan päällä esitetään vaatimuksia, joita ei ollut ilmoituksessa.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Periaate",
      paragraphs: [
        "Kaiken varatusta palvelusta maksettavan on oltava ilmoitettu ilmoituksessa ennen varauksen viimeistelyä — joko osana kokonaishintaa tai paikan päällä maksettavana kuluna.",
        "Määrä, jota ei ollut ilmoitettu kokonaishinnassa eikä paikan päällä maksettavana kuluna, ei ole vieraan maksettava.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Mitä paikan päällä saa vaatia",
      paragraphs: ["Paikan päällä saa vaatia yksinomaan:"],
      list: [
        "määrät, jotka on ilmoituksessa nimenomaisesti ilmoitettu paikan päällä maksettavina kuluina (esimerkiksi loppusiivous, liinavaatepaketti, autopaikka);",
        "paikalliset maksut kuten matkailijamaksu siltä osin kuin paikalliset säännökset edellyttävät sen suorittamista paikan päällä;",
        "ilmoituksessa mainittu vakuus;",
        "palvelut, jotka vieras varaa vasta paikan päällä ja vapaaehtoisesti, etukäteen ilmoitettuun hintaan;",
        "vieraan aiheuttamien todennettujen vahinkojen korvaaminen.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Mitä ei saa vaatia",
      paragraphs: ["Kiellettyä on erityisesti:"],
      list: [
        "majoitushinnan jälkikäteinen korotus varauksen viimeistelyn jälkeen;",
        "maksu siitä, että varaus tehtiin myBestDaysin kautta;",
        "käsittely-, varaus- tai korttimaksu, jota ei ollut ilmoitettu ilmoituksessa;",
        "kehotus peruuttaa varaus ja varata sama majoitus uudelleen alustan ulkopuolelta;",
        "kehotus maksaa hinta tai osa siitä tilisiirrolla, käteisellä tai maksupalvelun kautta alustan ulkopuolella, kun ilmoitus edellyttää maksua alustan kautta.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Alustan kiertäminen",
      paragraphs: [
        "Jos yhteys vieraan ja palveluntarjoajan välille on syntynyt alustan kautta, varausta ei saa hoitaa sen ohi. Tämä koskee molempia osapuolia.",
        "Alustan kiertävä menettää sen suojan: maksut eivät ole turvattuja, peruutus- ja hyvityskäytäntömme eivät päde emmekä voi sovitella riitatilanteessa.",
        "Rikkomukset voivat johtaa tilin sulkemiseen. Palveluntarjoajilta voimme lisäksi vaatia menetetyn palvelumaksun.",
      ],
    },
    {
      id: "melden",
      heading: "5. Ilmoittaminen",
      paragraphs: [
        "Jos teiltä vaaditaan paikan päällä määrää, jota ei ollut ilmoituksessa, älkää maksako sitä ja ilmoittakaa siitä meille kohdassa [Valitukset ja riidanratkaisu](https://mybestdays.dk/rechtliches/beschwerden) mainittujen yhteysväylien kautta. Jos olette jo maksanut, autamme sen perimisessä takaisin.",
      ],
    },
  ],
};
