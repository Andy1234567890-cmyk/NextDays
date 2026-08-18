import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Maksuehdot",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Nämä maksuehdot sääntelevät, miten myBestDaysin kautta tehtyyn varaukseen liittyvät maksut käsitellään. Ne täydentävät [Käyttöehtoja vieraille](https://mybestdays.dk/rechtliches/nutzungsbedingungen); maksuasioita koskevassa ristiriitatilanteessa nämä maksuehdot ovat ensisijaisia.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Roolimme maksamisessa",
      paragraphs: [
        "myBestDays käsittelee maksut palveluntarjoajan lukuun. Emme ole maksulaitos emmekä sähköisen rahan liikkeeseenlaskija; itse maksupalvelun tuottaa maksupalveluntarjoajamme.",
        "Alustan kautta suoritettavat maksut käsittelee Stripe (Stripe Payments Europe, Limited). Korttitiedot ja muut maksutiedot kerää ja käsittelee suoraan Stripe. myBestDays ei tallenna täydellisiä korttitietoja.",
        "Kun maksatte alustan kautta, maksuvelvollisuutenne palveluntarjoajaa kohtaan katsotaan täytetyksi maksetun määrän osalta heti, kun maksupalveluntarjoajamme on onnistuneesti valtuuttanut ja veloittanut maksun.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Maksutavat",
      paragraphs: [
        "Käytettävissä olevat maksutavat riippuvat ilmoituksesta, palveluntarjoajan maasta ja teidän maastanne. Käytettävissä olevat maksutavat näytetään ennen varauksen viimeistelyä.",
        "Tietyissä maksutavoissa vaaditaan direktiivin (EU) 2015/2366 mukainen vahva asiakastunnistus. Ilman onnistunutta tunnistusta maksua ei voida suorittaa.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Erääntyminen, ennakkomaksu ja loppumaksu",
      paragraphs: [
        "Palveluntarjoaja määrää ilmoituksessa, milloin mikäkin määrä erääntyy. Yleisiä ovat kolme mallia: koko maksu varattaessa, ennakkomaksu varattaessa ja loppumaksu ennen saapumista, tai maksu paikan päällä palveluntarjoajalle.",
        "Varaukseenne sovellettava malli ja eräpäivät näytetään ennen varauksen viimeistelyä ja toistetaan varausvahvistuksessa.",
        "Ennen loppumaksun erääntymistä muistutamme siitä ilmoittamaanne sähköpostiosoitteeseen. Jos loppumaksu jää suorittamatta, palveluntarjoaja voi peruutusehtojensa mukaisesti purkaa sopimuksen.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Valuutta",
      paragraphs: [
        "Tilitys tapahtuu ilmoituksen valuutassa. Tämä valuutta ilmoitetaan jokaisen hinnan yhteydessä ja maksuvaiheessa.",
        "Jos määrä esitetään lisäksi toisessa valuutassa, kyseessä on sitoumukseton suuntaa antava muunnos eikä sitova hinta.",
        "Jos maksupalveluntarjoajanne muuntaa toiseen valuuttaan tai perii ulkomaanmaksun kulun, vastaatte näistä kuluista. Ne eivät kuulu kokonaishintaan, emmekä me määrää tai peri niitä.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Vakuus",
      paragraphs: [
        "Jos ilmoitus edellyttää vakuutta, sen määrä ilmoitetaan ennen varauksen viimeistelyä.",
        "Ilmoituksesta riippuen vakuus joko esiautorisoidaan maksuvälineellenne (määrä varataan mutta ei veloiteta) tai veloitetaan. Esiautorisointi voi tilapäisesti pienentää käytettävissä olevaa korttilimiittiänne.",
        "Oleskelun jälkeen esiautorisointi vapautetaan tai veloitettu vakuus palautetaan, ellei palveluntarjoaja vetoa vahinkoon. Vahinkoon vedotessaan hänen on näytettävä se toteen; vaatimuksen aiheellisuus ratkeaa teidän ja palveluntarjoajan välisessä suhteessa.",
        "Jos palveluntarjoaja vaatii vakuuden sen sijaan paikan päällä, kyse on paikan päällä maksettavasta kuluerästä eikä sitä käsitellä alustan kautta.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Hyvitykset",
      paragraphs: [
        "Hyvitykset suoritetaan maksuun käytetylle maksuvälineelle, ellei toisin ole sovittu tai se ole teknisesti mahdotonta.",
        "Käynnistämme hyvityksen viipymättä, kun sen peruste on selvillä. Kuinka kauan kestää, ennen kuin hyvitys näkyy tilillänne tai kortillanne, määräytyy maksupalveluntarjoajanne mukaan; tavallisesti viidestä kymmeneen pankkipäivää.",
        "Onko hyvitykseen oikeutta ja missä laajuudessa, määräytyy [Peruutusehtojen](https://mybestdays.dk/rechtliches/stornierungsbedingungen) ja [Uudelleenmajoitus- ja hyvityskäytännön](https://mybestdays.dk/rechtliches/rueckerstattung) mukaan.",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Epäonnistuneet maksut ja takaisinveloitukset",
      paragraphs: [
        "Jos maksu epäonnistuu, ilmoitamme siitä ja annamme teille mahdollisuuden tallentaa toisen maksuvälineen. Jos maksu jää suorittamatta, varaus voidaan peruuttaa.",
        "Jos peruutatte jo suoritetun maksun takaisinveloituksella ilman oikeutta hyvitykseen, palveluntarjoaja voi edelleen vaatia määrää. Perusteettomasta takaisinveloituksesta meille aiheutuvat kulut voimme laskuttaa teiltä.",
        "Jos pidämme maksua vilpillisenä, voimme pidättää sen tai peruuttaa varauksen. Ilmoitamme siitä teille ja perustelemme päätöksen.",
      ],
    },
    {
      id: "belege",
      heading: "8. Tositteet ja tilitykset",
      paragraphs: [
        "Alustan kautta maksetuista määristä annamme tositteen, jonka voitte hakea tililtänne kohdasta ”Varaukset”.",
        "Majoituspalvelun laskun laatii palveluntarjoaja; hän on suorittava elinkeinonharjoittaja. Veroista ks. [Veropolitiikka](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Näiden maksuehtojen muuttaminen",
      paragraphs: [
        "Näiden maksuehtojen muuttamiseen sovelletaan [Käyttöehtojen](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen) kohtaa A22.",
      ],
    },
  ],
};
