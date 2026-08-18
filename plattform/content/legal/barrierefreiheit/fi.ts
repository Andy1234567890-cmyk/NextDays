import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Saavutettavuusseloste",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "myBestDaysin tulee olla kaikkien käytettävissä. Tämä seloste kuvaa alustan saavutettavuuden tilan, tunnetut rajoitukset ja tavan ilmoittaa meille esteistä.",
    "Se liittyy tuotteiden ja palvelujen esteettömyysvaatimuksista annetun direktiivin (EU) 2019/882 vaatimuksiin, joita on sovellettu verkkokaupan palveluihin 28. kesäkuuta 2025 alkaen.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Saavutettavuuden tila",
      paragraphs: [
        "Noudatamme yhdenmukaistettua standardia EN 301 549 ja sen taustalla olevia Web Content Accessibility Guidelines (WCAG) 2.1 -ohjeita vaatimustasolla AA.",
        "Toteutettuja ovat muun muassa: läpikotainen näppäimistökäyttö, näkyvä kohdistus, semanttinen otsikkorakenne, nimilaput kaikissa lomakekentissä, tekstivastineet hallintaelementeille, riittävät värikontrastit, tekstin skaalautuvuus ilman sisällön menetystä sekä näytön kokoon mukautuva esitys.",
        "Oikeudelliset tekstit ovat saatavilla kaikilla unionin 24 virallisella kielellä ja niissä on oikea kielimerkintä, jotta ruudunlukuohjelmat lukevat ne oikein.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Tunnetut rajoitukset",
      paragraphs: ["Tällä hetkellä eivät ole saavutettavia erityisesti:"],
      list: [
        "Ilmoitusten kuvat ja kuvaukset ovat peräisin palveluntarjoajilta; kuvien tekstivastineet voivat puuttua tai olla riittämättömiä. Kehotamme palveluntarjoajia täydentämään niitä.",
        "Upotetut kolmansien karttanäkymät ovat vain rajoitetusti näppäimistöllä käytettävissä. Kaikki sijaintitiedot ovat lisäksi saatavilla tekstinä.",
        "Palveluntarjoajien lataamia asiakirjoja (esimerkiksi järjestyssäännöt PDF-muodossa) ei ole johdonmukaisesti merkitty saavutettaviksi.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Majoitusten esteettömyys",
      paragraphs: [
        "Tämä seloste koskee alustaa, ei majoituksia. Tiedot majoituksen rakennusteknisestä esteettömyydestä ovat peräisin palveluntarjoajalta.",
        "Jos olette riippuvainen tietyistä ominaisuuksista — tasoon pääsy, ovileveydet, lattiakaivollinen suihku, hissi — selvittäkää ne palveluntarjoajan kanssa viestitoiminnon kautta ennen varausta. Virheelliset esteettömyystiedot ovat sääntöjemme rikkomus ja niistä voi ilmoittaa.",
      ],
    },
    {
      id: "melden",
      heading: "4. Esteistä ilmoittaminen",
      paragraphs: [
        `Jos kohtaatte esteen, ilmoittakaa siitä meille osoitteeseen ${ANBIETER.email} tai kohdassa [Valitukset ja riidanratkaisu](https://mybestdays.dk/rechtliches/beschwerden) mainittujen yhteysväylien kautta.`,
        "Kuvatkaa, mitä sivua asia koskee, mitä olitte tekemässä ja mitä apuvälineitä käytätte. Vahvistamme vastaanoton ja kerromme, miten ja mihin mennessä poistamme esteen.",
        "Jos tarvitsette tiedon saavutettavassa muodossa, toimitamme sen pyynnöstä.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Täytäntöönpanomenettely",
      paragraphs: [
        "Jos ette ole tyytyväinen vastaukseemme, voitte kääntyä direktiivin (EU) 2019/882 mukaisesta markkinavalvonnasta vastaavan viranomaisen puoleen.",
        "Erhvervsstyrelsen | Markedsovervågning (aiemmin Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Tanska",
        "Puhelin: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
