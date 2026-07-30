import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Omistajat ja tilitykset",
  description: "Omistajatilit, tilitykset ja provisiot.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Omistajat",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Omistajan luominen",
          excerpt: "Näin luot uuden omistajatilin myNextDaysiin.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Omistajat ovat myNextDaysin omia tilejä, joiden kautta hallinnoit tietylle henkilölle tai yhtiölle kuuluvia kohteita. Omistajatili saa rajoitetun, vain luku -oikeuden omiin kohteisiinsa ilman mahdollisuutta muuttaa itse toimintaa koskevia asetuksia.",
            },
            { type: "h2", text: "Uuden omistajatilin luominen" },
            {
              type: "steps",
              items: [
                "Avaa päävalikosta osio ”Omistajat”.",
                "Napsauta ”Luo uusi omistaja”.",
                "Syötä nimi, sähköpostiosoite ja yhteystiedot.",
                "Tallenna tarvittaessa laskutusosoite tilityksiä varten.",
                "Tallenna tili.",
              ],
            },
            { type: "h2", text: "Käyttöoikeuden käyttöönotto" },
            {
              type: "p",
              text: "Luomisen jälkeen voit lähettää omistajalle kutsun omaan käyttöoikeuteen. Omistaja kirjautuu sen jälkeen omilla tunnuksillaan sisään ja näkee yksinomaan hänelle kohdistetut kohteet.",
            },
            {
              type: "ul",
              items: [
                "Omistajatili voi kattaa useita kohteita.",
                "Jokainen kohde kuuluu täsmälleen yhdelle omistajalle.",
                "Yhteystiedot ja laskutusosoite voidaan mukauttaa jälkikäteen milloin tahansa.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Miten kohdistat olemassa olevan kohteen omistajalle, lue kohdasta [Kohteen kohdistaminen omistajalle](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Kohteen kohdistaminen omistajalle",
          excerpt: "Jokainen kohde kuuluu täsmälleen yhdelle omistajalle — näin määrität kohdistuksen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "myNextDaysissä jokainen kohde kuuluu täsmälleen yhdelle omistajalle. Moninkertaista kohdistusta ei ole tarkoitettu — jos kohteen tulee kuulua toiselle omistajalle, poista ensin olemassa oleva kohdistus ennen uuden asettamista.",
            },
            { type: "h2", text: "Kohdistuksen tekeminen" },
            {
              type: "steps",
              items: [
                "Avaa kohde kohdassa ”Kohteet”.",
                "Siirry välilehdelle ”Omistaja”.",
                "Valitse vastuullinen omistaja listasta.",
                "Vahvista kohdistus.",
                "Tallenna muutos kohteeseen.",
              ],
            },
            { type: "h2", text: "Omistajan vaihtuminen" },
            {
              type: "p",
              text: "Jos kohteen omistaja vaihtuu, esimerkiksi myynnin myötä, korvaat olemassa olevan kohdistuksen uudella. Jo luodut tilitykset menneiltä ajanjaksoilta pysyvät alkuperäisen omistajan nimissä.",
            },
            {
              type: "ul",
              items: [
                "Kohde voi kuulua kerrallaan vain yhdelle omistajalle.",
                "Ilman kohdistusta kohde ei näy missään omistajan käyttöoikeudessa.",
                "Menneet tilitykset säilyvät alkuperäisellä omistajalla.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Kohteen kohdistaminen useammalle omistajalle samanaikaisesti on estetty — järjestelmä ei salli toista samanaikaista kohdistusta.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Omistajan tilitys (Statement)",
          excerpt: "Näin luot omistajalle tilityksen tuloista provision vähennyksen jälkeen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Omistajan tilitys, jota kutsutaan myös nimellä Statement, kokoaa valitulta ajanjaksolta kaikki kohdistettujen kohteiden tulot yhteen ja vähentää sovitun provisiosi. Tuloksena on summa, jonka maksat omistajalle.",
            },
            { type: "h2", text: "Statementin luominen" },
            {
              type: "steps",
              items: [
                "Avaa osio ”Omistajat” ja valitse haluamasi omistaja.",
                "Siirry välilehdelle ”Tilitys”.",
                "Valitse tilityskausi.",
                "Tarkista listatut varaukset ja tulot kohteittain.",
                "Anna luoda Statement provision vähennyksen jälkeen.",
              ],
            },
            { type: "h2", text: "Statementin rakenne" },
            {
              type: "p",
              text: "Statement listaa kohteittain bruttotulot varauksista, niistä vähennetyn provision sekä siitä syntyvän tilitettävän summan. Lisäkulut, kuten siivous tai maksut, voidaan sopimuksesta riippuen ilmoittaa erikseen.",
            },
            {
              type: "ul",
              items: [
                "Bruttotulot: kaikkien ajanjakson varausten summa kohteittain.",
                "Provisio: sovittu osuutesi, vähennetään tuloista.",
                "Tilitettävä summa: tulot vähennettynä provisiolla ja mahdollisilla muilla erillä.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Statementin summat ilmoitetaan aina kohteen valuutassa — yleistä valuutan oletusarvoa ei ole.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Luo Statementit säännöllisesti samana ajankohtana, jotta omistajilla on luotettava rytmi tilityksilleen.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Omistajan käyttöoikeus",
          excerpt: "Mitä omistajat näkevät vain luku -käyttöoikeudessaan.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Omistajan käyttöoikeus on oma, vain luku -kirjautuminen myNextDaysiin. Omistajat näkevät siinä yksinomaan heille kohdistetut kohteet sekä niihin liittyvät varaukset ja tilitykset — ilman mahdollisuutta muuttaa asetuksia itse.",
            },
            { type: "h2", text: "Mitä omistajat näkevät" },
            {
              type: "ul",
              items: [
                "Omien kohteidensa varauskalenterin.",
                "Luodut Statementit tuloineen ja vähennettyine provisioineen.",
                "Kohteidensa perustiedot, esimerkiksi varustelun ja kuvauksen.",
              ],
            },
            { type: "h2", text: "Käyttöoikeuden aktivoiminen" },
            {
              type: "steps",
              items: [
                "Avaa omistaja kohdassa ”Omistajat”.",
                "Napsauta ”Kutsu käyttöoikeuteen”.",
                "Omistaja saa sähköpostin oman salasanan asettamiseksi.",
                "Kirjautumisen jälkeen omistaja näkee automaattisesti vain hänelle kohdistetut kohteet.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Omistajan käyttöoikeus on ehdottomasti vain luku -tyyppinen: hintoja, saatavuutta tai kohdetietoja voi muuttaa vain sinä yrityksenä, ei omistaja itse.",
            },
            {
              type: "note",
              variant: "info",
              text: "Lisää kohteiden kohdistamisesta löydät kohdasta [Kohteen kohdistaminen omistajalle](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
