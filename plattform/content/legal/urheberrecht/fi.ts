import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Tekijänoikeuskäytäntö",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "myBestDays kunnioittaa kolmansien oikeuksia ja odottaa samaa käyttäjiltään. Tämä käytäntö kuvaa, miten ilmoitatte tekijänoikeuden loukkauksesta ja miten käsittelemme sen.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Periaate",
      paragraphs: [
        "Alustalle sisältöä julkaiseva vakuuttaa, että hänellä on tarvittavat oikeudet. Tämä koskee erityisesti ilmoitusten kuvia, pohjapiirroksia, tekstejä ja karttaotteita.",
        "Toisten sisällön julkaiseminen ilman lupaa on [Käyttöehtojen](https://mybestdays.dk/rechtliches/nutzungsbedingungen) ja [Asianmukaista sisältöä koskevien sääntöjen](https://mybestdays.dk/rechtliches/inhaltsrichtlinien) rikkomus.",
      ],
    },
    {
      id: "meldung",
      heading: "2. Loukkauksesta ilmoittaminen",
      paragraphs: [
        "Ilmoittakaa tekijänoikeuden loukkauksesta kyseisen sisällön yhteydessä olevalla ilmoitustoiminnolla tai kohdassa [Digipalvelusäädös](https://mybestdays.dk/rechtliches/dsa) mainitun yhteyspisteen kautta. Ilmoituksen tulisi sisältää:",
      ],
      list: [
        "moitteen kohteena olevan sisällön tarkka yksilöinti, erityisesti URL-osoite;",
        "suojatun teoksen kuvaus ja selvitys oikeudenhaltija-asemastanne tai oikeudestanne toimia oikeudenhaltijan puolesta;",
        "perustelu sille, miksi käyttö ei ole sallittua;",
        "nimenne ja yhteysosoite;",
        "vakuutus siitä, että tietonne ovat parhaan tietämyksen mukaan oikeita ja täydellisiä.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Miten käsittelemme ilmoitukset",
      paragraphs: [
        "Vahvistamme ilmoituksenne vastaanoton viipymättä ja ratkaisemme asian ripeästi ja huolellisesti.",
        "Jos pidämme ilmoitusta perusteltuna, poistamme sisällön tai estämme pääsyn siihen ja ilmoitamme sen julkaisseelle henkilölle perusteet ja valitusväylän.",
        "Jos pidämme ilmoitusta perusteettomana, ilmoitamme siitä perusteluineen.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Asianosaisen vastine",
      paragraphs: [
        "Jos sisältönne on poistettu ja pidätte sitä perusteettomana, voitte valittaa maksutta kuuden kuukauden kuluessa. Esittäkää tällöin, miksi olette oikeutettu käyttöön.",
        "Jos valitus osoittautuu perustelluksi, palautamme sisällön.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Toistuvat loukkaukset",
      paragraphs: [
        "Suljemme ennakkovaroituksen jälkeen tilit, joiden kautta julkaistaan toistuvasti oikeuksia loukkaavaa sisältöä. Tämä vastaa asetuksen (EU) 2022/2065 23 artiklaa.",
        "Vastaavasti suljemme ilmoitustoiminnon henkilöiltä, jotka tekevät toistuvasti ilmeisen perusteettomia ilmoituksia.",
      ],
    },
  ],
};
