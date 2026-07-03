import type { LegalDoc } from "../types";

// Finnische Fassung der Gast-AGB. Quelle ist content/legal/agb/de.ts —
// Änderungen immer zuerst dort. Zielgruppe sind Verbraucher (Gäste).
export const agb: LegalDoc = {
  title: "Vieraiden käyttöehdot",
  stand: "Päivitetty: 3. heinäkuuta 2026",
  intro: [
    "Nämä käyttöehdot sääntelevät sitä, miten matkustajat ja varaajat (jäljempänä ”vieras”) käyttävät myNextDays-varausportaalia (jäljempänä ”alusta”).",
    "Alustaa ylläpitää [ylläpitäjän täydellinen toiminimi, yhtiömuoto, osoite ja rekisteritiedot — täydennettävä ennen julkaisua] (jäljempänä ”myNextDays” tai ”me”).",
  ],
  sections: [
    {
      heading: "§ 1 Soveltamisala",
      paragraphs: [
        "Nämä ehdot koskevat alustan käyttöä, erityisesti majoitusten hakua ja majoituspalvelujen varaamista alustan kautta.",
        "Itse majoituspalveluun sovelletaan lisäksi kulloisenkin palveluntarjoajan ehtoja (esim. järjestyssäännöt, peruutusehdot), jotka ilmoitetaan ilmoituksessa.",
      ],
    },
    {
      heading: "§ 2 myNextDaysin rooli; sopimuksen syntyminen",
      paragraphs: [
        "myNextDays välittää majoituspalveluja, joita tarjoavat kulloisetkin palveluntarjoajat (välitystoimistot, vuokranantajat tai omistajat, jäljempänä ”palveluntarjoaja”). Sopimus majoituksesta syntyy yksinomaan vieraan ja kulloisenkin palveluntarjoajan välillä. myNextDays ei ole majoitussopimuksen osapuoli.",
        "Kulloinenkin palveluntarjoaja nimetään ilmoituksessa ja varausvahvistuksessa.",
      ],
    },
    {
      heading: "§ 3 Varaus ja varausvahvistus",
      paragraphs: [
        "Majoitusten esittely alustalla on kehotus varaustarjouksen tekemiseen. Saattamalla varausprosessin loppuun (napsauttamalla maksuvelvoitteen sisältävää varauspainiketta) vieras tekee sitovan tarjouksen majoitussopimuksen tekemisestä palveluntarjoajan kanssa.",
        "Sopimus syntyy, kun varaus vahvistetaan. Varausvahvistus lähetetään vieraalle hänen ilmoittamaansa sähköpostiosoitteeseen.",
        "Vieras on velvollinen antamaan varauksen yhteydessä oikeat ja täydelliset tiedot (erityisesti nimi, yhteystiedot ja matkustajien lukumäärä).",
      ],
    },
    {
      heading: "§ 4 Hinnat ja maksaminen",
      paragraphs: [
        "Sovelletaan ilmoituksessa varaushetkellä ilmoitettuja hintoja, mukaan lukien siinä ilmoitetut verot, maksut ja lisäkulut. Hinnat näytetään ilmoituksessa mainitussa valuutassa. Paikan päällä voidaan periä paikallisia lisämaksuja (esim. matkailijavero), jos tästä on mainittu ilmoituksessa.",
        "Maksu käsitellään maksupalveluntarjoaja Stripen kautta. Stripe kerää ja käsittelee maksutiedot (esim. korttitiedot) suoraan; myNextDays ei tallenna täydellisiä korttitietoja. Stripe käsittelee henkilötietoja [Stripen tietosuojaselosteen](https://stripe.com/privacy) mukaisesti.",
        "Jos ilmoituksessa on mainittu vakuus, se voidaan esivaltuuttaa varauksen tai saapumisen yhteydessä ja pidättää vahinkotapauksessa kokonaan tai osittain; ratkaisevia ovat ilmoituksessa annetut tiedot.",
      ],
    },
    {
      heading: "§ 5 Peruutus, varauksen muuttaminen ja peruuttamisoikeus",
      paragraphs: [
        "Se, voiko varauksen peruuttaa tai voiko sitä muuttaa maksutta ja millä ehdoilla, määräytyy palveluntarjoajan ilmoituksessa mainittujen peruutusehtojen mukaan.",
        "Tietylle ajanjaksolle varattujen majoituspalvelujen osalta lakisääteistä peruuttamisoikeutta ei EU:n kuluttajanoikeusdirektiivin 16 artiklan l alakohdan tai vastaavien kansallisten säännösten mukaan pääsääntöisesti ole. Vieraan pakottavat lakisääteiset oikeudet jäävät voimaan.",
      ],
    },
    {
      heading: "§ 6 Vieraan velvollisuudet",
      paragraphs: [
        "Vieras käyttää majoitusta sopimuksen mukaisesti, noudattaa ilmoituksessa mainittua enimmäishenkilömäärää ja noudattaa palveluntarjoajan järjestyssääntöjä.",
        "Alustaa ei saa käyttää väärin, erityisesti ei valevarauksiin, vilpillisiin maksuihin tai lainvastaisen sisällön julkaisemiseen (esim. arvosteluissa tai viesteissä).",
      ],
    },
    {
      heading: "§ 7 myNextDaysin vastuu",
      paragraphs: [
        "Majoituspalvelun tuottamisesta vastaa yksin palveluntarjoaja. myNextDays ei vastaa palveluntarjoajien julkaisemien ilmoitussisältöjen oikeellisuudesta, mutta hoitaa välityksen ja maksujen käsittelyn huolellisen elinkeinonharjoittajan huolellisuutta noudattaen.",
        "myNextDays vastaa rajoituksetta tahallisuudesta ja törkeästä huolimattomuudesta sekä vahingoista, jotka johtuvat hengen, kehon tai terveyden vahingoittamisesta. Lievän huolimattomuuden tapauksissa myNextDays vastaa vain olennaisten sopimusvelvoitteiden (kardinaalivelvoitteiden) rikkomisesta, ja vastuu rajoittuu sopimukselle tyypilliseen, ennakoitavissa olevaan vahinkoon. Pakottavat lakisääteiset vastuusäännökset jäävät voimaan.",
      ],
    },
    {
      heading: "§ 8 Tietosuoja",
      paragraphs: [
        "myNextDays käsittelee vieraan henkilötietoja välityksen ja varauksen toteuttamiseksi. Varaustiedot välitetään kulloisellekin palveluntarjoajalle siltä osin kuin se on tarpeen majoitussopimuksen täyttämiseksi. Maksujen käsittelyyn sovelletaan § 4:ää.",
        "Yksityiskohdat ilmenevät alustan tietosuojatiedoista.",
      ],
    },
    {
      heading: "§ 9 Valitukset ja riidanratkaisu",
      paragraphs: [
        "Majoitusta koskevat huomautukset vieras osoittaa ensin palveluntarjoajalle; varausta tai maksua koskevissa kysymyksissä auttaa myNextDaysin tuki alustalla ilmoitettujen yhteydenottokanavien kautta.",
        "myNextDays ei ole velvollinen eikä halukas osallistumaan riidanratkaisumenettelyihin kuluttajariitoja käsittelevässä sovitteluelimessä, ellei siihen ole lakisääteistä velvollisuutta.",
      ],
    },
    {
      heading: "§ 10 Näiden ehtojen muuttaminen",
      paragraphs: [
        "myNextDays voi muuttaa näitä ehtoja tulevaisuutta koskevin vaikutuksin, jos se on tarpeen painavista syistä (erityisesti lainsäädännön tai oikeuskäytännön muutokset) eikä muutos aseta vierasta kohtuuttomasti epäedulliseen asemaan. Jo tehtyihin varauksiin sovelletaan varaushetkellä voimassa ollutta versiota.",
      ],
    },
    {
      heading: "§ 11 Loppumääräykset",
      paragraphs: [
        "Sovelletaan sen valtion lakia, jossa alustan ylläpitäjällä on kotipaikka, lukuun ottamatta YK:n kansainvälistä tavaran kauppaa koskevaa yleissopimusta (CISG). Jos vieras on kuluttaja, sen valtion pakottavat kuluttajansuojasäännökset, jossa hänellä on vakinainen asuinpaikka, jäävät voimaan.",
        "Jos jokin näiden ehtojen määräyksistä on tai tulee pätemättömäksi, muiden määräysten pätevyys ei muutu.",
      ],
    },
  ],
};
