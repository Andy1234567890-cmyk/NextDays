import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Viranomais- ja lainvalvontapyyntöjä koskevat ohjeet",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Nämä ohjeet on suunnattu viranomaisille, tuomioistuimille ja lainvalvontaelimille, jotka pyytävät myBestDaysilta tietoja tai kohdistavat sisältöön määräyksen. Ne ovat tässä julkisia, jotta myös käyttäjät voivat lukea, millä edellytyksillä luovutamme tietoja.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Periaate",
      paragraphs: [
        "Luovutamme käyttäjätietoja vain, kun on olemassa pätevä oikeusperusta ja pyyntö täyttää muotovaatimukset. Vapaamuotoinen tietopyyntö ei riitä.",
        "Tarkastamme jokaisen pyynnön toimivallan, oikeusperustan, täsmällisyyden ja oikeasuhteisuuden osalta ja luovutamme vain pyynnössä yksilöidyt tiedot.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Pyynnön vaatimukset",
      paragraphs: ["Pyynnön tulisi sisältää:"],
      list: [
        "pyynnön esittävä taho, asianumero ja asiaa käsittelevän henkilön yhteystiedot virallisella kirjelomakkeella;",
        "oikeusperusta kansallisen lain tai unionin oikeuden mukaan;",
        "asianomaisen henkilön tai tilin tarkka yksilöinti — sähköpostiosoite, varausnumero tai ilmoituksen URL-osoite;",
        "tarkasti yksilöidyt tiedot ja ajanjakso;",
        "tarvittaessa tuomioistuimen määräys, jos sovellettava laki sitä edellyttää;",
        "maininta, jos asianomaisen henkilön informointi vaarantaisi tutkinnan, oikeusperusta mainiten.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Asetuksen (EU) 2022/2065 mukaiset määräykset",
      paragraphs: [
        "Määräysten toimia laitonta sisältöä vastaan (9 artikla) ja määräysten antaa tietoja (10 artikla) on sisällettävä siinä mainitut tiedot, erityisesti oikeusperusta, tarkka sähköinen sijainti, perustelut, oikeussuojakeinot ja kieli.",
        "Vahvistamme vastaanoton ja ilmoitamme määräyksen antaneelle viranomaiselle, mihin toimenpiteisiin olemme ryhtyneet ja milloin.",
        "Ilmoitamme määräyksestä asianomaiselle henkilölle viimeistään täytäntöönpanohetkellä, ellei viranomainen oikeusperustan mainiten määrää lykkäystä.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Hätätilanteet",
      paragraphs: [
        "Jos hengelle tai ruumiilliselle koskemattomuudelle on välitön vaara, luovutamme sen torjumiseksi tarvittavat tiedot myös ilman ennakolta annettua muodollista määräystä. Merkitkää tällainen pyyntö nimenomaisesti hätätilanteeksi ja kuvatkaa vaara.",
        "Jos on viitteitä rikoksesta, joka aiheuttaa vaaran henkilön hengelle tai turvallisuudelle, ilmoitamme siitä oma-aloitteisesti toimivaltaisille viranomaisille (asetuksen (EU) 2022/2065 18 artikla).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Mitä tietoja meillä on",
      paragraphs: [
        "Käsittelemämme tietoryhmät ja niiden säilytysajat ilmenevät [Tietosuojaselosteesta](https://mybestdays.dk/rechtliches/datenschutz). Siinä mainittujen määräaikojen yli emme säilytä tietoja.",
        "Tarpeen ylittävää säilyttämistä ei tapahdu. Kehotuksen säilyttää tietoja väliaikaisesti vireillä olevaa menettelyä varten toteutamme oikeudellisesti sallituissa rajoissa.",
        "Täydellisiä maksutietoja meillä ei ole; ne on tiedusteltava maksupalveluntarjoajalta.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Asianomaisen henkilön informointi",
      paragraphs: [
        "Ilmoitamme asianomaisille käyttäjille heidän tietojaan koskevasta pyynnöstä, ellei säännös tai perusteltu viranomaismääräys sitä kiellä tai ellei ole välitöntä vaaraa hengelle tai ruumiilliselle koskemattomuudelle.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Minne pyynnöt osoitetaan",
      paragraphs: [
        "Osoittakaa pyynnöt kohdassa [Digipalvelusäädös](https://mybestdays.dk/rechtliches/dsa) mainittuun viranomaisten keskitettyyn yhteyspisteeseen. Käsittelemme ne saksaksi, tanskaksi ja englanniksi.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Avoimuus",
      paragraphs: [
        "Viranomaismääräysten lukumäärän ja lajin ilmoitamme vuosittaisessa avoimuusraportissamme; ks. [Digipalvelusäädös](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
