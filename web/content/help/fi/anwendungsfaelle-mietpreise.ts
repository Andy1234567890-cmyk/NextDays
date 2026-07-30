import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Vuokrahinnat",
  description: "Vuokrahintojen optimaalinen määrittäminen.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Vuokrahinnat",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Hintojen optimointi sesonkihuippua varten",
          excerpt: "Näin nostat hintojasi kohdennetusti suuren kysynnän ajanjaksoille.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne",
            },
            {
              type: "p",
              text: "Sesonkihuipulla kysyntä kasvaa selvästi, kun taas perushintasi pysyy samana kuin muuna vuoden aikana. Ilman sesonkikohtaista säätöä jätät liikevaihtoa käyttämättä vuoden vahvimpana aikana — säätö tehdään kohteesi hintasuunnitelman kautta, ei ylikirjoittamalla yksittäisiä päiviä käsin.",
            },
            {
              type: "steps",
              items: [
                "Avaa kyseisen kohteen hintasuunnitelma ja luo sesonkisääntö halutulle ajanjaksolle.",
                "Aseta lisä prosenttiarvona tai kiinteänä summana perushinnan päälle — hintasuunnitelma käyttää kohteen valuuttaa automaattisesti.",
                "Tarkista kalenterista, että uusi hinta näytetään oikein sesonkihuipun ajanjaksolle ennen aktivointia.",
                "Tarkista vähimmäisoleskelu sesonkihuippua varten — usein korkeampi vähimmäisvarausaika on järkevä käyttöasteen ennustettavuuden kannalta.",
                "Seuraa varaustilannetta ensimmäisten päivien ajan aktivoinnin jälkeen ja säädä lisää tarvittaessa.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Sesonkisääntö vaikuttaa kanavista riippumatta yhtä lailla portaaleihin, alustaan ja verkkosivustoon. Lisätietoja sääntöjen rakenteesta löydät kohdasta [Hintasuunnitelmat](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Pidempien oleskeluiden edistäminen alennuksella",
          excerpt: "Näin palkitset pidempään viipyviä vieraita ja vähennät vaihtokuormaa.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne",
            },
            {
              type: "p",
              text: "Lyhyet oleskelut tarkoittavat enemmän saapumisia ja lähtöjä, enemmän siivouksia ja suurempaa tyhjäkäyntiriskiä varausten välissä. Porrastettu oleskelualennus tekee pidemmistä varauksista houkuttelevampia vieraille ja vähentää tätä kuormaa selvästi.",
            },
            {
              type: "steps",
              items: [
                "Avaa kohteen hintasuunnitelma ja luo oleskelualennus.",
                "Määritä vähintään yksi porras, esimerkiksi 7 yöstä tai 28 yöstä alkaen, kullekin sopivalla alennusprosentilla.",
                "Tarkista, etteivät portaat mene päällekkäin ja että alennus astuu voimaan vasta kyseisestä vähimmäiskestosta alkaen.",
                "Testaa kalenterissa esimerkkivaraus alennusrajan yli vahvistaaksesi oikean soveltamisen.",
                "Aktivoi alennus ja seuraa sen vaikutusta keskimääräiseen oleskeluaikaan ja käyttöasteeseen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Oleskelualennuksia voi yhdistää sesonkisääntöihin — hintasuunnitelma laskee molemmat säädöt yhdessä. Lisää tästä kohdassa [Hintasuunnitelmat](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
