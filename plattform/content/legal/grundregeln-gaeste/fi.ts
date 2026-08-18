import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Vieraiden perussäännöt",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Nämä perussäännöt koskevat jokaista myBestDaysin kautta varattua oleskelua. Ne täydentävät kyseisen palveluntarjoajan järjestyssääntöjä — tiukempia järjestyssääntöjä sovelletaan lisäksi.",
    "Perussääntöjä rikkovan on varauduttava toimenpiteisiin tilin sulkemiseen asti, ja hän vastaa palveluntarjoajalle aiheutuneista vahingoista.",
  ],
  sections: [
    {
      id: "belegung",
      heading: "1. Majoittuminen",
      paragraphs: [
        "Majoituksessa yöpyvät vain varauksessa ilmoitetut henkilöt ja enintään niin monta kuin enimmäishenkilömäärä sallii.",
        "Vierailu ilman yöpymistä on sallittua, ellei järjestyssäännöissä toisin määrätä.",
        "Majoitusta ei saa jälleenvuokrata eikä luovuttaa edelleen.",
      ],
    },
    {
      id: "ruhe",
      heading: "2. Huomaavaisuus ja hiljaiset ajat",
      paragraphs: [
        "Ottakaa naapurit huomioon. Noudattakaa järjestyssäännöissä mainittuja hiljaisia aikoja; jos tietoa ei ole, sovelletaan paikkakunnalla tavanomaista yörauhaa.",
        "Juhlat ja tilaisuudet eivät ole sallittuja ilman palveluntarjoajan nimenomaista lupaa. Tämä koskee myös tilanteita, joissa enimmäishenkilömäärää noudatetaan.",
        "Majoituksen kaupallinen käyttö — esimerkiksi valokuva- tai elokuvatuotannot, myyntitilaisuudet — edellyttää palveluntarjoajan ennakkosuostumusta.",
      ],
    },
    {
      id: "umgang",
      heading: "3. Majoituksen käsittely",
      paragraphs: [
        "Käsitelkää majoitusta ja sen kalustusta huolellisesti ja jättäkää se siistiin kuntoon.",
        "Ilmoittakaa vahingoista ja häiriöistä palveluntarjoajalle viipymättä — ei vasta lähdön jälkeen. Vain näin hän voi korjata ne ja vain näin säilytätte oikeutenne.",
        "Vastaatte vahingoista, jotka te tai matkaseurueenne aiheutatte. Jos vakuudesta on sovittu, sitä voidaan käyttää tähän.",
      ],
    },
    {
      id: "sicherheit",
      heading: "4. Turvallisuus",
      paragraphs: [
        "Pitäkää palovaroittimet, sammuttimet ja poistumistiet vapaina ja toimintakuntoisina. Palovaroittimia ei saa peittää eikä poistaa.",
        "Tupakointi on sallittua vain, jos järjestyssäännöt sen nimenomaisesti sallivat, ja vain siihen osoitetuilla alueilla.",
        "Uima-altaan, saunan, takan, grillin tai poreammeen osalta noudattakaa palveluntarjoajan ohjeita. Lapset saavat käyttää tällaisia laitteita vain valvonnassa.",
      ],
    },
    {
      id: "tiere",
      heading: "5. Eläimet",
      paragraphs: [
        "Eläimiä saatte tuoda mukananne vain, jos ilmoitus sen sallii ja olette ilmoittanut ne varauksessa.",
        "Avustaja- ja opaskoirat ovat aina sallittuja, vaikka ilmoitus sulkisi eläimet pois. Ilmoittakaa niistä etukäteen, jotta palveluntarjoaja voi varautua.",
      ],
    },
    {
      id: "anreise",
      heading: "6. Saapuminen ja lähtö",
      paragraphs: [
        "Noudattakaa ilmoituksessa mainittuja saapumis- ja lähtöaikoja. Jos tarvitsette poikkeavia aikoja, sopikaa niistä etukäteen palveluntarjoajan kanssa.",
        "Antakaa ajoissa tiedot, joita palveluntarjoaja tarvitsee ilmoittautumiseen (matkustajailmoitus, henkilöllisyystiedot, matkailijamaksu).",
        "Älkää luovuttako pääsytietoja, avainkoodeja tai avaimia kolmansille.",
      ],
    },
    {
      id: "kommunikation",
      heading: "7. Viestintä",
      paragraphs: [
        "Hoitakaa varaus, maksu ja sopimiset alustan kautta. Vain silloin ne ovat dokumentoituja ja vain silloin voimme auttaa riitatilanteessa.",
        "Pysykää asiallisena palveluntarjoajaa ja tiimiämme kohtaan. Loukkaukset ja uhkaukset johtavat välittömästi tiliin kohdistuviin toimenpiteisiin.",
      ],
    },
  ],
};
