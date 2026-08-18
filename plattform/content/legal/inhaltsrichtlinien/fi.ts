import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Asianmukaista sisältöä koskevat säännöt",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Nämä säännöt koskevat kaikkea sisältöä, jota käyttäjät julkaisevat myBestDaysissa: ilmoituksia, kuvia, arvosteluja, viestejä, profiilitietoja ja vastauksia arvosteluihin.",
    "Ne ovat osa [Käyttöehtoja](https://mybestdays.dk/rechtliches/nutzungsbedingungen). Rikkomus voi johtaa sisällön poistamiseen ja tiliin kohdistuviin toimenpiteisiin.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Mikä ei ole sallittua",
      paragraphs: ["myBestDaysissa ei sallita erityisesti seuraavaa sisältöä:"],
      list: [
        "kaikenlainen lainvastainen sisältö, erityisesti kehotukset rikoksiin, terroristinen sisältö ja lasten seksuaalista hyväksikäyttöä esittävä aineisto;",
        "sisältö, joka yllyttää vihaan tai väkivaltaan henkilöitä tai ryhmiä kohtaan alkuperän, ihonvärin, uskonnon, vakaumuksen, sukupuolen, sukupuoli-identiteetin, seksuaalisen suuntautumisen, vamman tai iän perusteella;",
        "loukkaukset, uhkaukset, häirintä ja yksittäisten henkilöiden kohdennettu häpäiseminen;",
        "kolmansien henkilötiedot ilman heidän suostumustaan, erityisesti nimet, osoitteet, puhelinnumerot, henkilöllisyys- tai maksutiedot;",
        "harhaanjohtavat tiedot majoituksesta, sen sijainnista, varustelusta, koosta tai saatavuudesta;",
        "toisten kuvat, tekstit tai tavaramerkit ilman tarvittavia oikeuksia;",
        "mainonta, roskaposti ja sisältö, joka johtaa muihin varausväyliin alustan ulkopuolella;",
        "haittaohjelmat, tietojenkalasteluyritykset ja linkit tällaiseen sisältöön;",
        "muun kuin majoituspalvelun tarjoaminen.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Kuvat",
      paragraphs: [
        "Kuvien on esitettävä tosiasiallisesti tarjottua majoitusta ja oltava otettu tilassa, joka vastaa nykyistä.",
        "Kuvissa ei saa esiintyä tunnistettavia henkilöitä ilman heidän suostumustaan. Käsittely on sallittua siltä osin kuin se ei vääristä majoituksesta syntyvää käsitystä — vaalennus kyllä, pois retusoitu naapurirakennus ei.",
        "Kameravalvonta majoituksessa on ilmoitettava ilmoituksessa. Sisätiloissa, joissa vierailla on perusteltu yksityisyyden odotus — makuuhuoneet, kylpyhuoneet — kamerat eivät ole sallittuja, eivät myöskään pois päältä kytkettyinä.",
      ],
    },
    {
      id: "melden",
      heading: "3. Sisällön ilmoittaminen",
      paragraphs: [
        "Jos pidätte sisältöä lainvastaisena tai näiden sääntöjen vastaisena, voitte ilmoittaa siitä ilmoitustoiminnolla, joka on jokaisen ilmoituksen, arvostelun ja viestin yhteydessä.",
        "Asetuksen (EU) 2022/2065 16 artiklan mukainen ilmoitusmenettely ja ilmoitusten käsittely kuvataan kohdassa [Digipalvelusäädös](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Miten valvomme sääntöjä",
      paragraphs: [
        "Tarkastamme jokaisen ilmoitetun sisällön ja valitsemme lievimmän soveltuvan toimenpiteen: huomautus, kyseisen osan poistaminen, koko sisällön poistaminen, näkyvyyden rajoittaminen, toiminnon estäminen tai tilin sulkeminen.",
        "Toistuvat tai vakavat rikkomukset painavat enemmän. Ilmeisen lainvastaisen sisällön tai henkilöihin kohdistuvan vaaran kyseessä ollessa toimimme välittömästi.",
        "Perustelemme jokaisen toimenpiteen asianosaiselle ja kerromme valitusväylän. Valituksen käsittelevät ihmiset.",
      ],
    },
  ],
};
