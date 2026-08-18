import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Isäntien tietosuojastandardit",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Kun tarjoatte majoitusta myBestDaysin kautta, saatte vieraidenne henkilötietoja. Niiden käsittelyn osalta olette itsenäinen rekisterinpitäjä asetuksen (EU) 2016/679 (yleinen tietosuoja-asetus) tarkoittamassa merkityksessä. Nämä standardit kuvaavat, mitä odotamme teiltä.",
  ],
  sections: [
    {
      id: "zweckbindung",
      heading: "1. Käyttötarkoitussidonnaisuus",
      paragraphs: [
        "Käytätte vierastietoja yksinomaan varauksen toteuttamiseen, vieraan kanssa viestimiseen ja lakisääteisten velvoitteidenne täyttämiseen (esimerkiksi matkustajailmoitus, matkailijamaksu, vero- ja säilytysvelvoitteet).",
        "Kaikki muu käyttö — erityisesti markkinointi, uutiskirjeet, luovutus kolmansille, sisällyttäminen omaan asiakasrekisteriin myöhempiä suoravarauksia varten — edellyttää omaa oikeusperustaa, yleensä vieraan suostumusta.",
        "Ette käytä vierastietoja saadaksenne vieraan varaamaan alustan ulkopuolelta.",
      ],
    },
    {
      id: "datensparsamkeit",
      heading: "2. Tietojen minimointi",
      paragraphs: [
        "Keräätte vain tiedot, joita todella tarvitsette. Henkilöllisyystodistusten kopioita pyydätte vain, kun säännös sitä edellyttää, ja säilytätte niitä vain säännöksen edellyttämän ajan.",
        "Ette pyydä maksutietoja. Maksut kulkevat alustan kautta.",
      ],
    },
    {
      id: "sicherheit",
      heading: "3. Turvallisuus",
      paragraphs: [
        "Suojaatte vierastiedot asianmukaisin teknisin ja organisatorisin toimenpitein — pääsy vain henkilöille, jotka tarvitsevat tietoja, suojatut laitteet, salattu siirto.",
        "Jos käytätte työntekijöitä, siivoojia tai apuisäntiä, sitoutatte heidät salassapitoon ja annatte heille vain tehtävässään tarvittavat tiedot.",
      ],
    },
    {
      id: "loeschung",
      heading: "4. Säilytys ja poistaminen",
      paragraphs: [
        "Poistatte vierastiedot heti, kun käyttötarkoitus on lakannut eikä säilytysvelvollisuutta enää ole.",
        "Matkustajailmoituksia ja verotuksellisesti merkityksellisiä asiakirjoja säilytätte niin kauan kuin maanne laki edellyttää — ette pidempään.",
      ],
    },
    {
      id: "rechte",
      heading: "5. Vieraiden oikeudet",
      paragraphs: [
        "Jos vieras esittää teille tarkastus-, oikaisu-, poisto- tai vastustamispyynnön, vastaatte siihen määräajassa. Jos se koskee meillä olevia tietoja, ohjaatte hänet meille.",
        "Kerrotte vieraillenne, miten käsittelette heidän tietojaan siltä osin kuin menette varauksen toteuttamista pidemmälle.",
      ],
    },
    {
      id: "vorfall",
      heading: "6. Tietoturvaloukkaukset",
      paragraphs: [
        "Jos vierastietojen suoja loukkaantuu, ilmoitatte siitä viipymättä toimivaltaiselle valvontaviranomaiselle ja tarvittaessa asianomaisille vieraille.",
        "Jos loukkaus koskee alustan kautta saamianne tietoja, ilmoitatte siitä lisäksi meille, jotta voimme arvioida omat velvollisuutemme.",
      ],
    },
    {
      id: "kameras",
      heading: "7. Kamerat ja tallennuslaitteet",
      paragraphs: [
        "Sisätiloissa, joissa on perusteltu yksityisyyden odotus — makuuhuoneet, kylpyhuoneet — kamerat ja mikrofonit eivät ole sallittuja, eivät myöskään pois päältä kytkettyinä.",
        "Kaikki muut kamerat, tallentavat liiketunnistimet, kameralliset ovikellot ja äänianturit ilmoitatte ilmoituksessa mainiten niiden sijainnin ja sen, mitä tallennetaan.",
      ],
    },
    {
      id: "folgen",
      heading: "8. Rikkomusten seuraukset",
      paragraphs: [
        "Käsittelemme näiden standardien rikkomukset [Isäntien lisäehtojen](https://mybestdays.dk/rechtliches/gastgeber-bedingungen) rikkomuksina ja voimme ryhtyä toimenpiteisiin tilin sulkemiseen asti.",
      ],
    },
  ],
};
