import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Tietosuojaseloste",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Tämä seloste kuvaa, mitä henkilötietoja myBestDays käsittelee, mihin tarkoituksiin, millä oikeusperusteella ja mitkä oikeudet teillä on. Se koskee verkkosivustoa, mobiilisovelluksia ja kaikkia muita alustan käyttöyhteyksiä.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Rekisterinpitäjä ja tietosuojavastaava",
      paragraphs: [
        `Asetuksen (EU) 2016/679 (yleinen tietosuoja-asetus) tarkoittama rekisterinpitäjä on ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Tanska, CVR-nro ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Täydelliset palveluntarjoajan tiedot löytyvät kohdasta [Oikeudelliset tiedot](https://mybestdays.dk/rechtliches/impressum).`,
        "Tietosuojavastaavaa ei ole nimetty; asetuksen 37 artiklan edellytykset eivät täyty. Tietosuojaa koskevat kyselyt osoitetaan edellä mainittuun sähköpostiosoitteeseen.",
        "Palveluntarjoajat, joilta varaatte, ovat itsenäisiä rekisterinpitäjiä meiltä saamiensa tietojen osalta. Heihin sovelletaan [Isäntien tietosuojastandardeja](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Mitä tietoja käsittelemme",
      paragraphs: ["Sen mukaan, miten käytätte alustaa, käsittelemme:"],
      list: [
        "perustiedot — nimi, sähköpostiosoite, puhelinnumero, kieli ja valuutta, salasana salatussa muodossa;",
        "varaustiedot — varattu majoitus, ajanjakso, matkustajien lukumäärä ja nimet, erityistoiveet, varauksen tila;",
        "maksutiedot — määrä, valuutta, maksun tila, maksuvälineen viimeiset numerot sekä maksupalveluntarjoajamme tapahtumatunniste. Täydelliset korttitiedot eivät päädy meille;",
        "viestintätiedot — teidän ja palveluntarjoajan väliset viestit, yhteydenotot asiakaspalveluumme, valitukset;",
        "sisältötiedot — arvostelut, kuvat, toivelistat;",
        "käyttötiedot — katsotut sivut, hakukyselyt, käytön ajankohta;",
        "tekniset tiedot — IP-osoite, selain- ja laitetunnisteet, käyttöjärjestelmä, viittaava sivu.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Tarkoitukset ja oikeusperusteet",
      paragraphs: [
        "Alustan tarjoaminen, tili, haku, varaus, maksujen käsittely ja viestintä palveluntarjoajan kanssa — 6 artiklan 1 kohdan b alakohta (sopimus tai sopimusta edeltävät toimet).",
        "Asiakaspalvelu, valitusten käsittely ja riidanratkaisu — 6 artiklan 1 kohdan b ja f alakohta.",
        "Petosten, väärinkäytösten ja tietoturvapoikkeamien havaitseminen ja estäminen sekä ehtojemme toimeenpano — 6 artiklan 1 kohdan f alakohta (oikeutettu etu turvalliseen markkinapaikkaan).",
        "Arvostelut ja niiden julkaiseminen — 6 artiklan 1 kohdan b ja f alakohta.",
        "Lakisääteisten velvoitteiden täyttäminen, erityisesti kirjanpito- ja verolainsäädännön säilytysvelvoitteet, direktiivin (EU) 2021/514 (DAC7) mukainen ilmoitusvelvollisuus ja asetuksesta (EU) 2022/2065 johtuvat velvoitteet — 6 artiklan 1 kohdan c alakohta.",
        "Alustan kehittäminen koostettujen käyttötietojen analysoinnilla — 6 artiklan 1 kohdan f alakohta.",
        "Markkinointisähköpostit ja ei-välttämättömät evästeet — 6 artiklan 1 kohdan a alakohta (suostumus), jonka voitte milloin tahansa peruuttaa vaikutuksin tulevaisuuteen.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Vastaanottajat",
      paragraphs: [
        "Palveluntarjoajat saavat tiedot, joita he tarvitsevat varauksenne toteuttamiseen ja lakisääteisten velvoitteidensa täyttämiseen — erityisesti nimen, yhteystiedot, ajanjakson, matkustajien lukumäärän ja heille osoittamanne viestit.",
        "Maksupalveluntarjoajamme Stripe käsittelee maksutietoja itsenäisenä rekisterinpitäjänä; lisäksi sovelletaan [Stripen tietosuojaselostetta](https://stripe.com/privacy).",
        "Palveluntarjoajat, jotka hoitavat puolestamme konesalipalvelut, tietokantojen ylläpidon, sähköpostien lähetyksen, virhediagnostiikan ja asiakaspalvelutyökalut, käsittelevät tietoja yksinomaan ohjeidemme mukaan asetuksen 28 artiklan mukaisen sopimuksen perusteella.",
        "Viranomaiset ja tuomioistuimet saavat tietoja vain siltä osin kuin olemme siihen velvollisia; ks. [Viranomais- ja lainvalvontapyyntöjä koskevat ohjeet](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Veroviranomaiset saavat palveluntarjoajia koskevat DAC7:n mukaisesti ilmoitettavat tiedot.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Siirrot kolmansiin maihin",
      paragraphs: [
        "Palvelimemme ja henkilötietojen käsittelijöidemme palvelimet sijaitsevat Euroopan unionissa.",
        "Siltä osin kuin yksittäistapauksessa käsittelyä tapahtuu Euroopan talousalueen ulkopuolella, se tapahtuu vain Euroopan komission tietosuojan riittävyyttä koskevan päätöksen tai asetuksen 46 artiklan 2 kohdan c alakohdan mukaisten vakiolausekkeiden ja täydentävien suojatoimien perusteella.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Säilytysajat",
      paragraphs: [
        "Tilitietoja säilytämme niin kauan kuin tilinne on olemassa ja poistamme ne sen jälkeen, ellei säilytysvelvollisuus ole esteenä.",
        "Varaus- ja maksutietoja koskevat kirjanpito- ja verolainsäädännön säilytysajat; Tanskan kirjanpitolain mukaan ne ovat pääsääntöisesti viisi vuotta sen tilikauden päättymisestä, jota tiedot koskevat.",
        "Varausta koskevia viestejä säilytämme kolme vuotta oleskelun päättymisen jälkeen, jotta riitatilanteet voidaan selvittää.",
        "Arvostelut säilyvät tilinne poistamisen jälkeen anonymisoidussa muodossa, koska ne ovat osa majoituksen arviointiperustaa.",
        "Petos- ja väärinkäytöstapauksia koskevia tietoja säilytämme niin kauan kuin on tarpeen uusien rikkomusten torjumiseksi, kuitenkin enintään kolme vuotta viimeisimmästä tapahtumasta.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Oikeutenne",
      paragraphs: ["Tietosuoja-asetuksen nojalla teillä on seuraavat oikeudet:"],
      list: [
        "oikeus saada pääsy teitä koskeviin tallennettuihin tietoihin (15 artikla);",
        "virheellisten tietojen oikaiseminen (16 artikla);",
        "tietojen poistaminen (17 artikla), ellei säilytysvelvollisuus ole esteenä;",
        "käsittelyn rajoittaminen (18 artikla);",
        "tietojen siirrettävyys (20 artikla);",
        "vastustamisoikeus oikeutettuun etuun perustuvaa käsittelyä vastaan (21 artikla), erityisesti suoramarkkinointia vastaan;",
        "annetun suostumuksen peruuttaminen vaikutuksin tulevaisuuteen (7 artiklan 3 kohta);",
        `valitus valvontaviranomaiselle (77 artikla) — toimivaltainen on asuinpaikkanne, työpaikkanne tai väitetyn rikkomuksen tapahtumapaikan viranomainen. Rekisterinpitäjän kotipaikassa se on ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Tanska, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Miten käytätte oikeuksianne",
      paragraphs: [
        `Monia tietoja voitte tarkastella, muuttaa tai poistaa suoraan tililtänne. Kaikessa muussa kääntykää osoitteeseen ${ANBIETER.email}.`,
        "Vastaamme viipymättä, viimeistään kuukauden kuluessa. Jos emme voi noudattaa määräaikaa, ilmoitamme siitä perusteluineen.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Automatisoidut päätökset",
      paragraphs: [
        "Käytämme automatisoituja menetelmiä petosten, väärinkäytösten ja lainvastaisen sisällön havaitsemiseen. Jos tällainen menetelmä johtaa tiliinne tai sisältöönne kohdistuvaan toimenpiteeseen, perustelemme sen ja voitte vaatia ihmisen suorittamaa tarkastusta.",
        "Emme tee yksinomaan automaattiseen käsittelyyn perustuvia päätöksiä, joilla on asetuksen 22 artiklassa tarkoitettuja oikeusvaikutuksia.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Velvollisuus antaa tietoja",
      paragraphs: [
        "Varausta varten tarvittavat tiedot teidän on annettava; ilman niitä sopimusta ei voida tehdä eikä majoitusta asettaa käyttöön. Kaikki muut tiedot ovat vapaaehtoisia.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Tämän selosteen muutokset",
      paragraphs: [
        "Mukautamme tätä selostetta, kun käsittely tai oikeustila muuttuu. Kulloinkin voimassa oleva versio on saatavilla tässä; päivityspäivämäärä on ylhäällä.",
      ],
    },
  ],
};
