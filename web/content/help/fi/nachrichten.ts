import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Viestit ja vieraat",
  description: "Saapuneet-kansio, mallipohjat ja vierasviestintä.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Viestintä",
      articles: [
        {
          slug: "posteingang",
          title: "Alustan saapuneet-kansio",
          excerpt: "Kaikki kohteidesi vierasviestit kootaan keskitetysti alustan saapuneet-kansioon.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Yksi saapuneet-kansio kaikille kohteille" },
            {
              type: "p",
              text: "Alustan saapuneet-kansio kokoaa kaikki vieraidesi viestit yhteen paikkaan — riippumatta siitä, minkä kohteen tai ajanjakson kautta keskustelu käydään. Avaat sen kohdassa /nachrichten ja näet siellä jokaisen keskustelun omana ketjunaan.",
            },
            { type: "h2", text: "Saapuneet-kansion rakenne" },
            {
              type: "ul",
              items: [
                "Vasen sarake: lista kaikista keskusteluista, uusimmat ensin",
                "Keskimmäinen sarake: aktiivinen viestihistoria vieraan kanssa",
                "Oikea sarake: varauksen konteksti — ajanjakso, kohde, vierastiedot",
              ],
            },
            { type: "h2", text: "Viestiin vastaaminen" },
            {
              type: "steps",
              items: [
                "Avaa /nachrichten ja valitse haluamasi keskustelu",
                "Kirjoita vastauksesi tekstikenttään tai käytä pikavastausta",
                "Lähetä viesti — vieras saa sen samaa väylää pitkin, jota kautta hän kirjoitti",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Alustan saapuneet-kansio näyttää yksinomaan sinun ja vieraidesi välisen suoran viestinnän myNextDaysissä — portaalien viestit käsittelet edelleen siellä.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Pikavastaukset",
          excerpt: "Mallipohjat yleisiin kysymyksiin säästävät aikaa vierasyhteydenpidossa.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Mitä pikavastaukset ovat" },
            {
              type: "p",
              text: "Pikavastaukset ovat valmiiksi muotoiltuja tekstipätkiä toistuviin kysymyksiin — esimerkiksi saapumisesta, WLAN-salasanasta tai parkkipaikkatilanteesta. Sen sijaan että kirjoittaisit jokaisen vastauksen uudelleen, lisäät sopivan mallipohjan yhdellä napsautuksella kohtaan [Alustan saapuneet-kansio](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Pikavastauksen luominen" },
            {
              type: "steps",
              items: [
                "Avaa /nachrichten ja napsauta ”Hallitse pikavastauksia”",
                "Napsauta ”Uusi mallipohja” ja anna otsikko, esimerkiksi ”Sisäänkirjautumistiedot”",
                "Kirjoita vastausteksti; paikkamerkit kuten vieraan nimi tai saapumispäivä täytetään automaattisesti lähetettäessä",
                "Tallenna mallipohja — se on sen jälkeen käytettävissä jokaisessa keskustelussa",
              ],
            },
            { type: "h2", text: "Pikavastausten käyttö arjessa" },
            {
              type: "p",
              text: "Viestikkeessä avaat mallipohjalistan salamakuvakkeesta, valitset sopivan vastauksen ja mukautat sitä tarvittaessa vielä yksilöllisesti ennen lähettämistä.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Luo mallipohjat viidelle kymmenelle yleisimmälle kysymykselle — tämä kattaa käytännössä suurimman osan saapuvista viesteistä.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Automaattiset viestit",
          excerpt: "Vahvistukset, sisäänkirjautumistiedot ja muistutukset voidaan lähettää vieraille automaattisesti.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Toistuvien viestien automatisointi" },
            {
              type: "p",
              text: "Sen sijaan että lähettäisit varausvahvistuksia, sisäänkirjautumisohjeita tai kiitosviestejä käsin, tallennat ne kerran sääntönä — myNextDays lähettää ne sitten automaattisesti sopivaan ajankohtaan ennen oleskelua, sen aikana tai sen jälkeen.",
            },
            { type: "h2", text: "Tyypilliset automaattisten viestien laukaisimet" },
            {
              type: "ul",
              items: [
                "Heti varauksen jälkeen — vahvistus tärkeimmillä tiedoilla",
                "Muutama päivä ennen saapumista — sisäänkirjautumistiedot ja pääsykoodi",
                "Lähtöpäivänä — kiitos ja pyyntö jättää arvostelu",
              ],
            },
            { type: "h2", text: "Automaattisen viestin käyttöönotto" },
            {
              type: "steps",
              items: [
                "Avaa /nachrichten, osio ”Automaattiset viestit”",
                "Valitse laukaisin, esimerkiksi ”X päivää ennen saapumista”",
                "Tallenna teksti — paikkamerkit kuten vieraan nimi, kohde tai saapumispäivä täytetään automaattisesti",
                "Aktivoi sääntö; se koskee kaikkia kohteita, ellei sitä rajata toisin",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Automaattiset viestit näkyvät tavallisesti kohdassa [Alustan saapuneet-kansio](/hilfe/nachrichten/posteingang) ja ovat siellä milloin tahansa jälkikäteen tarkasteltavissa.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Viestien estäminen",
          excerpt: "Voit estää henkilön suoraan viestihistoriasta jatkokontaktia varten.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Milloin esto on järkevä" },
            {
              type: "p",
              text: "Loukkaavien viestien, häirinnän tai toistuvasti sopimattoman käytöksen yhteydessä voit estää henkilön suoraan viestiketjusta. Estetty henkilö ei sen jälkeen voi enää kirjoittaa sinulle uusia viestejä eikä tehdä uutta varausta luoksesi.",
            },
            { type: "h2", text: "Henkilön estäminen ketjusta" },
            {
              type: "steps",
              items: [
                "Avaa kyseinen keskustelu kohdassa [Alustan saapuneet-kansio](/hilfe/nachrichten/posteingang)",
                "Napsauta ketjun yläreunassa valikkoa ja valitse ”Estä henkilö”",
                "Vahvista toiminto — esto astuu voimaan heti",
              ],
            },
            { type: "h2", text: "Mitä esto tarkoittaa — ja mitä ei" },
            {
              type: "ul",
              items: [
                "Estetyn henkilön uusia viestejä ei enää toimiteta",
                "Henkilön uudet varauspyynnöt hylätään",
                "Jos henkilöllä on käynnissä oleva varaus, viestintä pysyy poikkeuksellisesti mahdollisena oleskelun ajan",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Eston voi poistaa milloin tahansa kohdasta ”Estetyt henkilöt” tilissä. Tarkista ennen estämistä, onko käynnissä oleva varaus jo olemassa.",
            },
          ],
        },
      ],
    },
  ],
};
