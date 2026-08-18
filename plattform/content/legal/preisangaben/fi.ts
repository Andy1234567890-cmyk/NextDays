import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Hinnat, järjestys ja suositukset",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Tällä sivulla selitetään, miten hinnat näytetään myBestDaysissa, mikä määrää hakutulosten järjestyksen ja miten suositukset syntyvät. Se täyttää direktiivin 2005/29/EY 6 a artiklan, asetuksen (EU) 2019/1150 5 artiklan ja asetuksen (EU) 2022/2065 27 artiklan mukaiset avoimuusvelvoitteet.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Miten hinnat näytetään",
      paragraphs: [
        "Heti kun ajanjakso ja matkustajien lukumäärä ovat selvillä, näytämme koko oleskelun kokonaishinnan, joka sisältää verot ja kaikki alustan kautta tilitettävät maksut.",
        "Niin kauan kuin ajanjaksoa ei ole valittu, näytämme yöhinnan suuntaa antavana ja merkitsemme sen sellaiseksi.",
        "Vasta paikan päällä erääntyvät kulut ilmoitamme erikseen ennen varauksen viimeistelyä. Ne eivät kuulu kokonaishintaan, mutta ovat näkyvissä ennen varausta.",
        "Jos näytämme yliviivatun vertailuhinnan, kyseessä on alin hinta, jonka palveluntarjoaja on pyytänyt samasta palvelusta alennusta edeltäneiden 30 päivän aikana (direktiivin 98/6/EY 6 a artikla).",
        "Hinnat ovat samat kaikille vieraille. Emme mukauta hintaa henkilöönne, laitteeseenne tai aiempaan hakukäyttäytymiseenne.",
      ],
    },
    {
      id: "ranking",
      heading: "2. Mikä määrää hakutulosten järjestyksen",
      paragraphs: [
        "Oletusjärjestyksessä seuraavat tekijät määräävät järjestyksen merkitykseltään laskevassa järjestyksessä:",
      ],
      list: [
        "osuvuus hakuunne — saatavuus haetulla ajanjaksolla, kapasiteetti matkustajamäärälle, sijainti haetulla alueella ja asetetut suodattimet;",
        "ilmoituksen täydellisyys ja laatu — kuvaus, kuvat, ylläpidetyt varustelutiedot;",
        "arvostelut — kokonaisarvosana ja arvostelujen määrä;",
        "palveluntarjoajan luotettavuus — vastausnopeus, hyväksymisaste ja palveluntarjoajan tekemät peruutukset;",
        "hintojen ja saatavuuden ajantasaisuus;",
        "hinta-laatusuhde verrattuna samankaltaisiin ilmoituksiin samalla alueella.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Maksettu sijoitus",
      paragraphs: [
        "Palveluntarjoaja ei voi ostaa parempaa sijaa oletusjärjestyksessä. Palvelumaksun suuruus ei vaikuta järjestykseen.",
        "Jos tarjoaisimme vastaisuudessa maksettuja sijoituksia, merkitsisimme ne yksiselitteisesti mainokseksi ja erottaisimme ne näkyvästi muista tuloksista.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Järjestyksen muuttaminen",
      paragraphs: [
        "Voitte muuttaa järjestystä milloin tahansa, esimerkiksi hinnan tai arvostelun mukaan. Aktiivinen järjestys näytetään tulosluettelon yläpuolella.",
        "Käytettävissänne on vähintään yksi järjestys, joka ei perustu asetuksen (EU) 2016/679 4 artiklan 4 alakohdassa tarkoitettuun profilointiin.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Suositukset",
      paragraphs: [
        "Kun näytämme teille ehdotuksia (”voisi kiinnostaa”, ”samankaltaiset majoitukset”), ne perustuvat nykyiseen hakuun, aiemmin katsottuihin ilmoituksiin ja samankaltaisten majoitusten ominaisuuksiin.",
        "Voitte poistaa personoidut suositukset käytöstä tililtänne. Sen jälkeen näette ehdotuksia, jotka perustuvat yksinomaan nykyiseen hakuun.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Arvostelut järjestyksessä",
      paragraphs: [
        "Miten arvostelut syntyvät ja miten ne tarkastetaan, selviää [Arvostelukäytännöstä](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). Arvostelut vaikuttavat järjestykseen, mutta emme painota yksittäisiä arvosteluja enemmän emmekä vaimenna kielteisiä.",
      ],
    },
  ],
};
