import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Valitukset ja riidanratkaisu",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Tällä sivulla kuvataan, miten tavoitatte myBestDaysin, miten käsittelemme valitukset ja mitkä väylät ovat käytettävissänne, jos ette hyväksy päätöstämme.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Miten tavoitatte meidät",
      paragraphs: [
        "Nopeimmin tavoitatte meidät ohjekeskuksen ja siellä ilmoitettujen yhteysväylien kautta. Voimassa olevaa varausta koskien käyttäkää tilinne viestitoimintoa — silloin varaus ja historia ovat jo tiedossamme.",
        `Kirjallisesti tavoitatte meidät osoitteesta ${ANBIETER.email} tai ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Tanska; puhelimitse numerosta ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Mitä valituksenne tulisi sisältää",
      paragraphs: ["Jotta voimme auttaa nopeasti, ilmoittakaa:"],
      list: [
        "varausnumeronne ja varaukseen käytetty sähköpostiosoite;",
        "lyhyt kuvaus ongelmasta;",
        "millaista ratkaisua toivotte;",
        "asiaan liittyvät todisteet — kuvat, viestit, kuitit, tiliotteet.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Miten käsittelemme",
      paragraphs: [
        "Jokainen valitus kirjataan ja saa asianumeron, jolla voitte seurata tilannetta.",
        "Vahvistamme vastaanoton viipymättä ja vastaamme asiasisältöön pääsääntöisesti seitsemän päivän kuluessa. Jos tarvitaan pidempi selvitys, ilmoitamme välitilanteen.",
        "Valitukset, joissa henkilöt ovat vaarassa tai saapuminen on välitön, käsittelemme ensisijaisesti.",
        "Perustelemme päätöksemme ja kerromme, mihin se perustuu.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Valitus toimenpiteestämme",
      paragraphs: [
        "Jos olemme poistaneet sisältöä, rajoittaneet sen näkyvyyttä, peruuttaneet varauksen tai sulkeneet tilin, voitte valittaa siitä maksutta kuuden kuukauden kuluessa. Tämä vastaa asetuksen (EU) 2022/2065 20 artiklaa.",
        "Valituksen tutkivat ihmiset, eivät pelkästään automatisoidut menettelyt. Jos se osoittautuu perustelluksi, peruutamme toimenpiteen.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Tuomioistuimen ulkopuolinen riidanratkaisu",
      paragraphs: [
        "Euroopan komission verkkovälitteisen riidanratkaisun foorumi (ODR-foorumi) on kumottu asetuksella (EU) 2024/3228 ja lopettanut toimintansa. Sen kautta ei voi enää tehdä valituksia.",
        "Emme ole velvollisia emmekä halukkaita osallistumaan kuluttajariitoja käsittelevän elimen riidanratkaisumenettelyyn.",
        `Tästä riippumatta voitte kuluttajana kääntyä toimivaltaisen tanskalaisen elimen puoleen: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Tanska ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Jos asutte toisessa jäsenvaltiossa, maanne Euroopan kuluttajakeskus auttaa eteenpäin.`,
        "Jos riita koskee toimenpidettä, jonka olemme kohdistaneet sisältöönne tai tiliinne, voitte lisäksi kääntyä asetuksen (EU) 2022/2065 21 artiklan mukaisesti sertifioidun tuomioistuimen ulkopuolisen riidanratkaisuelimen puoleen. Sen päätökset eivät sido meitä emmekä ole velvollisia osallistumaan tällaisiin menettelyihin.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Tuomioistuintie",
      paragraphs: [
        "Tuomioistuintie on käytettävissänne milloin tahansa, myös ilman edeltävää valitusmenettelyä. Toimivaltaiset tuomioistuimet ilmenevät [Käyttöehtojen](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand) kohdasta A19.",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Palveluntarjoajien valitukset",
      paragraphs: [
        "Palveluntarjoajat voivat tehdä samalla menettelyllä valituksia näiden ehtojen soveltamisesta, järjestyspäätöksistä ja ilmoituksensa rajoituksista. Tämä vastaa asetuksen (EU) 2019/1150 11 artiklaa.",
        "Raportoimme vuosittain tällaisten valitusten lukumäärästä, kohteesta ja keskimääräisestä käsittelyajasta; raportti on saatavilla kohdassa [Digipalvelusäädös](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
