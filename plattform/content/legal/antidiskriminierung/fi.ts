import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Syrjinnän vastainen periaate",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "myBestDays on avoin kaikille. Kukaan alustan kautta varaava tai tarjoava ei saa kohdella ketään huonommin henkilökohtaisten ominaisuuksien perusteella.",
    "Tämä periaate on osa [Käyttöehtoja](https://mybestdays.dk/rechtliches/nutzungsbedingungen) ja koskee sekä vieraita että palveluntarjoajia.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Periaate",
      paragraphs: [
        "myBestDaysissa ei ole sallittua asettaa henkilöä huonompaan asemaan alkuperän, ihonvärin, kansalaisuuden, etnisen taustan, uskonnon tai vakaumuksen, sukupuolen, sukupuoli-identiteetin, seksuaalisen suuntautumisen, vamman, iän tai siviilisäädyn perusteella.",
        "Tämä koskee varausten hyväksymistä tai hylkäämistä, hintoja ja ehtoja, kanssakäymistä oleskelun aikana sekä viestintää alustan kautta.",
        "Lisäksi sovelletaan asetuksen (EU) 2018/302 20 artiklaa: palveluntarjoajat eivät saa rajoittaa pääsyä tarjoukseensa vieraan kansalaisuuden, asuinpaikan tai sijoittautumispaikan perusteella unionin sisällä.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. Mitä tämä tarkoittaa palveluntarjoajille",
      paragraphs: ["Palveluntarjoajana ette saa erityisesti:"],
      list: [
        "hylätä varauspyyntöä jonkin mainitun ominaisuuden perusteella;",
        "vaatia vierailta erilaisia hintoja, vakuuksia tai ehtoja siksi, että heillä on jokin näistä ominaisuuksista;",
        "ilmoittaa ilmoituksessa tai viesteissä, että tietyt henkilöryhmät eivät ole tervetulleita;",
        "kieltäytyä avustaja- tai opaskoirista, vaikka järjestyssääntönne sulkisivat eläimet pois;",
        "kohdella vierasta eri tavalla siksi, että hän asuu toisessa unionin jäsenvaltiossa.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. Mikä on edelleen sallittua",
      paragraphs: [
        "Voitte määrittää enimmäishenkilömäärän, päävaraajan vähimmäisiän ja asialliset järjestyssäännöt (esimerkiksi tupakointikielto tai hiljaiset ajat), kunhan ne koskevat kaikkia vieraita samalla tavalla.",
        "Jos asutte itse majoituksessa ja jaatte tilat vieraan kanssa, voitte tuoda sen selvästi esiin ilmoituksessa; kohdan 1 ominaisuudet eivät silti oikeuta hylkäämiseen.",
        "Voitte hylätä varauksen, kun on olemassa konkreettisia viitteitä järjestyssääntöjen rikkomisesta tai petoksesta. Perusteen on liityttävä käyttäytymiseen, ei henkilöön.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Esteettömyys",
      paragraphs: [
        "Majoituksen esteettömyyttä koskevien tietojen on pidettävä paikkansa. Majoituksen kuvaaminen esteettömäksi, vaikka se ei sitä ole, on samalla [Asianmukaista sisältöä koskevien sääntöjen](https://mybestdays.dk/rechtliches/inhaltsrichtlinien) rikkomus.",
        "Kun mukautus on mahdollinen ilman kohtuutonta rasitusta, odotamme palveluntarjoajien tekevän sen.",
      ],
    },
    {
      id: "melden",
      heading: "5. Syrjinnästä ilmoittaminen",
      paragraphs: [
        "Jos olette kokenut tai havainnut syrjintää, ilmoittakaa siitä meille ilmoitustoiminnolla tai kohdassa [Valitukset ja riidanratkaisu](https://mybestdays.dk/rechtliches/beschwerden) mainittujen yhteysväylien kautta.",
        "Tutkimme jokaisen ilmoituksen. Jos rikkomus vahvistuu, ryhdymme toimenpiteisiin tilin pysyvään sulkemiseen asti. Jos teiltä on tällä perusteella evätty varaus, autamme löytämään vastaavan majoituksen.",
      ],
    },
  ],
};
