import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Vakavia häiriöitä koskeva käytäntö",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Toisinaan tapahtuma estää matkan tai oleskelun eikä siihen voi vaikuttaa vieras eikä palveluntarjoaja. Tämä käytäntö kuvaa, mitkä tapahtumat ovat tällaisia ja mitä silloin sovelletaan.",
    "Se on ensisijainen ilmoituksessa valittuun peruutusehtoon nähden.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Mitkä tapahtumat kuuluvat piiriin",
      paragraphs: [
        "Piiriin kuuluvat tapahtumat, jotka ilmenevät varauksen jälkeen, olivat molemmille osapuolille ennalta arvaamattomia ja tekevät matkan tai oleskelun mahdottomaksi tai oikeudellisesti luvattomaksi:",
      ],
      list: [
        "viranomaisten matkustus- tai oleskelukiellot, ulkonaliikkumiskiellot ja rajasulut, jotka koskevat kohdetta tai lähtöpaikkaa;",
        "kohdetta koettelevat luonnonkatastrofit ja luonnonilmiöt — maanjäristys, tulva, myrsky, suurpalo, tulivuorenpurkaus;",
        "sota, aseelliset selkkaukset, terrori-iskut ja levottomuudet kohteessa;",
        "viranomaisten toteama epidemia tai pandemia sekä toimenpiteet, jotka kieltävät oleskelun;",
        "sähkön, veden tai lämmön jakelun pitkäaikainen keskeytyminen kohteessa;",
        "kohteeseen matkustamisen täydellinen estyminen jonkin edellä mainitun tapahtuman seurauksena.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Mitkä tapahtumat eivät kuulu piiriin",
      paragraphs: ["Piiriin eivät kuulu erityisesti:"],
      list: [
        "vieraan tai hänen läheistensä sairaus tai vamma — tätä varten on matkavakuutus;",
        "työeste, tenttipäivät tai loman peruuntuminen;",
        "sen tapahtuman peruuntuminen, jota varten matka oli varattu, jos majoitus on edelleen käytettävissä;",
        "sää, joka ei ole luonnonkatastrofi — sade, kylmyys, kuumuus, lumen puute;",
        "yksittäisten liikennevälineiden peruuntuminen, kunhan kohtuullinen matkustaminen on edelleen mahdollista;",
        "lennon peruuntuminen tai lakko liikenneyrityksessä — näiden osalta on olemassa vaatimuksia liikenneyritystä kohtaan.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Mitä sovelletaan, kun piiriin kuuluva tapahtuma toteutuu",
      paragraphs: [
        "Jos tapahtuma koskee varauksenne ajanjaksoa, voitte peruuttaa maksutta. Saatte alustan kautta maksetun määrän kokonaan hyvitettynä.",
        "Jos oleskelu on jo alkanut, hyvitämme osuuden öistä, joita ei enää voi käyttää.",
        "Palveluntarjoajalle ei aiheudu tällaisesta peruutuksesta haittaa hänen luotettavuutensa arvioinnissa.",
        "Vaihtoehtoisesti voitte sopia palveluntarjoajan kanssa siirtämisestä; autamme muutoksessa.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Miten vetoatte tähän",
      paragraphs: [
        "Ottakaa yhteyttä kohdassa [Valitukset ja riidanratkaisu](https://mybestdays.dk/rechtliches/beschwerden) mainittuja väyliä pitkin ja ilmoittakaa varausnumero ja tapahtuma.",
        "Tarkistamme asian julkisesti saatavilla olevista lähteistä — viranomaismääräyksistä, virallisista varoituksista, tunnustettujen uutislähteiden raporteista — ja ratkaisemme ripeästi.",
        "Jos tilannetta ei voi vielä lopullisesti arvioida, odotamme kehitystä lähelle saapumispäivää ja ratkaisemme silloin. Varauksenne pysyy siihen asti muuttumattomana.",
      ],
    },
  ],
};
