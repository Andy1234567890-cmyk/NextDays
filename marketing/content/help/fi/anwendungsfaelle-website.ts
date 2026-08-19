import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Verkkosivusto",
  description: "Verkkosivustosi optimaalinen hyödyntäminen.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Verkkosivusto",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Verkkosivustosi julkaiseminen",
          excerpt: "Näin julkaiset oman verkkosivustosi itsenäisenä myyntikanavana.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne",
            },
            {
              type: "p",
              text: "Verkkosivustosi on oma myyntikanava portaalien ja alustan rinnalla. Rakennat sivut editorissa, mutta vasta julkaisu tekee verkkosivuston näkyväksi vieraille ja kohteesi näkyvät siellä varattavina.",
            },
            {
              type: "steps",
              items: [
                "Avaa verkkosivustoeditori ja tarkista, että kaikki halutut sivut on täytetty sisällöllä.",
                "Valitse kohde-välilehdellä kohdekohtaisesti, näkyykö se verkkosivustolla — tämä näkyvyys on riippumaton portaaleista ja alustasta.",
                "Tarkista esikatselu pöytäkone- ja mobiilinäkymässä ennen julkaisua.",
                "Napsauta ”Julkaise” avataksesi verkkosivuston vieraille.",
                "Tarkista julkaisun jälkeen julkinen URL-osoite ja testaa esimerkkivaraus verkkosivuston kautta.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kohteen verkkosivustonäkyvyys on oma akselinsa — kohde voi olla aktiivinen portaaleissa, mutta piilotettu verkkosivustolla, ja päinvastoin. Lisätietoja kohdasta [Oman verkkotunnuksen käyttöönotto](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Oman verkkotunnuksen käyttöönotto",
          excerpt: "Näin yhdistät oman verkkotunnuksesi myNextDays-verkkosivustoosi.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne",
            },
            {
              type: "p",
              text: "Oma verkkotunnus, kuten www.yrityksesi.fi, vaikuttaa ammattimaisemmalta kuin oletusosoite ja vahvistaa brändiäsi vieraille, jotka haluavat varata suoraan sinulta.",
            },
            {
              type: "steps",
              items: [
                "Avaa verkkosivustoeditorissa osio ”Verkkotunnus” ja syötä haluamasi oma verkkotunnus.",
                "Aseta verkkotunnuspalveluntarjoajallasi näytetyt DNS-tietueet (yleensä CNAME- tai A-tietue).",
                "Odota, kunnes verkkotunnus näytetään yhdistettynä ja SSL-varmenne aktiivisena — tämä voi kestää palveluntarjoajasta riippuen muutaman tunnin.",
                "Testaa oman verkkotunnuksen avaamista yksityisessä selainikkunassa sulkeaksesi pois välimuistiin tallennetut vanhat tiedot.",
                "Tarkista, että vanhat oletusosoitteet ohjaavat edelleen uuteen verkkotunnukseen, jotta olemassa olevat linkit eivät johda tyhjään.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Muuta DNS-tietueita vain näytetyllä tavalla — väärät arvot voivat häiritä verkkotunnuksesi olemassa olevia sähköpostiasetuksia. Tarkista epäselvissä tapauksissa verkkotunnuspalveluntarjoajaltasi ennen olemassa olevien tietueiden ylikirjoittamista.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Suoravarausten kasvattaminen",
          excerpt: "Näin ohjaat enemmän vieraita omalle verkkosivustollesi portaalien sijaan.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne",
            },
            {
              type: "p",
              text: "Varaukset omalla verkkosivustolla ovat yrityksellesi yleensä edullisempia kuin portaalien kautta, koska tällöin ei peritä portaaliprovisiota. Muutamalla kohdennetulla toimenpiteellä kasvatat suoravarausten osuutta verkkosivustollasi itsenäisenä kanavana.",
            },
            {
              type: "steps",
              items: [
                "Varmista, että kaikki varattavat kohteet ovat näkyvissä verkkosivustolla ajantasaisin kuvin ja kuvauksin.",
                "Ota käyttöön verkkosivustolle yksinomainen alennus tai etu, esimerkiksi pieni hinnanalennus portaaleihin verrattuna.",
                "Linkitä oma verkkotunnuksesi varausvahvistuksiin ja viestintään vieraiden kanssa, jotka ovat jo varanneet kerran.",
                "Tarkista säännöllisesti varaustilastoja seurataksesi verkkosivuston osuutta kaikista varauksista ajan mittaan.",
                "Optimoi verkkosivuston latausaika ja mobiilinäkymä, sillä suurin osa vieraista varaa älypuhelimella.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Verkkosivustolle yksinomainen etu toimii vain, jos vieraat ylipäätään löytävät verkkosivuston — viittaa siihen aktiivisesti sen sijaan, että luottaisit vain portaaleihin. Julkaisusta lisää kohdassa [Verkkosivustosi julkaiseminen](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
