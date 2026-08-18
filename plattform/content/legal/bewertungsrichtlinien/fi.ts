import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Arvostelukäytäntö",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Arvostelut ovat vieraille tärkein riippumaton tietolähde. Tämä käytäntö kuvaa, kuka saa arvostella, miten varmistamme arvostelujen olevan todellisilta vierailta ja milloin poistamme arvostelun.",
  ],
  sections: [
    {
      id: "echtheit",
      heading: "1. Miten varmistamme aitouden",
      paragraphs: [
        "Arvostelun voi jättää vain se, joka on varannut majoituksen myBestDaysin kautta ja jonka oleskelujakso on alkanut. Arvostelu sidotaan teknisesti kyseiseen varaukseen.",
        "Näin täytämme direktiivin 2005/29/EY liitteessä I olevan 23 b kohdan mukaisen velvollisuuden esittää vierasarvosteluina vain sellaisia, joiden osalta olemme ryhtyneet kohtuullisiin toimiin varmistaaksemme, että ne ovat todellisilta vierailta.",
        "Emme osta arvosteluja, emme tilaa niitä emmekä julkaise valearvosteluja. Emme myöskään salli palveluntarjoajien tekevän niin.",
      ],
    },
    {
      id: "frist",
      heading: "2. Määräaika ja julkaiseminen",
      paragraphs: [
        "Lähdön jälkeen teillä on 14 päivää aikaa jättää arvostelu. Palveluntarjoaja voi samassa määräajassa arvostella teidät.",
        "Molemmat arvostelut julkaistaan samanaikaisesti heti, kun molemmat ovat olemassa tai määräaika on kulunut umpeen. Näin kumpikaan osapuoli ei vaikuta toiseen.",
        "Jätetyn arvostelun voitte perua määräajassa. Julkaisemisen jälkeen muuttaminen ei ole enää mahdollista; voitte pyytää sen poistamista.",
      ],
    },
    {
      id: "antwort",
      heading: "3. Palveluntarjoajan vastaus",
      paragraphs: [
        "Palveluntarjoaja voi vastata arvosteluun julkisesti. Vastaukseen sovelletaan samoja sääntöjä kuin itse arvosteluun.",
        "Vastaus ei muuta arvostelua eikä vaikuta kokonaisarvosanaan.",
      ],
    },
    {
      id: "entfernung",
      heading: "4. Milloin poistamme arvostelun",
      paragraphs: [
        "Emme poista arvostelua siksi, että se on kielteinen, emmekä siksi, että palveluntarjoaja on siihen tyytymätön. Poistamme sen, kun se:",
      ],
      list: [
        "rikkoo [Asianmukaista sisältöä koskevia sääntöjä](https://mybestdays.dk/rechtliches/inhaltsrichtlinien);",
        "sisältää kolmansien henkilötietoja;",
        "koskee ilmeisesti toista majoitusta tai toista oleskelua;",
        "koskee olennaisilta osin seikkoja, joihin vieras tai palveluntarjoaja ei ole voinut vaikuttaa (esimerkiksi sää, kunnan työmaa, saapumisliikenne) — tällöin poistamme vain kyseisen osan, jos se on erotettavissa;",
        "palvelee ilmeisesti kiristystä, esimerkiksi koska se on kytketty vaatimukseen;",
        "on hankittu kannustimin tai jätetty koordinoidusti.",
      ],
    },
    {
      id: "anreize",
      heading: "5. Kannustimet eivät ole sallittuja",
      paragraphs: [
        "Palveluntarjoajat eivät saa tarjota arvostelusta rahaa, alennuksia, tasokorotuksia, lahjoja tai muita etuja — eivät myöskään arvostelusta pidättäytymisestä.",
        "Palveluntarjoajat saavat kutsua vieraita arvostelemaan vaikuttamatta arvosanaan. Kutsu, joka pyytää arvostelua vain myönteisen kokemuksen tapauksessa, ei ole sallittu.",
      ],
    },
    {
      id: "darstellung",
      heading: "6. Miten esitämme arvostelut",
      paragraphs: [
        "Kokonaisarvosana on kaikkien julkaistujen majoitusta koskevien arvostelujen painottamaton keskiarvo. Emme painota mitään arvostelua enemmän siksi, että se on myönteisempi.",
        "Oletusjärjestys näyttää uusimmat arvostelut ensin. Voitte vaihtaa muihin järjestyksiin; aktiivinen järjestys näytetään.",
        "Ilmoitamme, kuinka moneen arvosteluun kokonaisarvosana perustuu. Alle kolmen arvostelun tapauksessa emme näytä kokonaisarvosanaa, vaan ainoastaan yksittäiset arvostelut.",
      ],
    },
    {
      id: "beschwerde",
      heading: "7. Valitus päätöksestä",
      paragraphs: [
        "Jos poistamme arvostelunne tai kieltäydymme poistamasta arvostelua, perustelemme sen ja kerromme valitusväylän — ks. [Valitukset ja riidanratkaisu](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
  ],
};
