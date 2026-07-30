import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Tili ja tilaus",
  description: "Perustiedot, hinnasto, tietoturva ja kaksivaiheinen tunnistautuminen.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Tili",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Yrityksen perustiedot",
          excerpt: "Yrityksesi nimen, osoitteen ja yhteystietojen keskitetty ylläpito.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Kohdassa /konto myNextDays kokoaa kaikki yritys- ja tilitoiminnot osioina yhdelle sivulle — sinun ei tarvitse siirtyä usean alasivun välillä. Yrityksen perustiedot muodostavat tässä perustan: yrityksen nimi, yhtiömuoto, osoite ja yhteystiedot, joita käytetään laskuissa, portaaleissa ja vieraiden kanssa viestimisessä.",
            },
            { type: "h2", text: "Perustietojen avaaminen ja muokkaaminen" },
            {
              type: "steps",
              items: [
                "Avaa /konto.",
                "Siirry osioon ”Yrityksen perustiedot”.",
                "Tarkista yrityksen nimi, osoite, puhelinnumero ja sähköpostiosoite kyselyitä varten.",
                "Tee muutoksesi.",
                "Tallenna osio.",
              ],
            },
            { type: "h2", text: "Miksi nämä tiedot ovat tärkeitä" },
            {
              type: "p",
              text: "Yrityksen perustiedot siirtyvät laskuihin, yhdistettyjen portaalien rekisteröintiin ja lakisääteisiin tietoihin, kuten yritystietosivuun. Puutteellinen tai vanhentunut osoite voi johtaa virheellisesti laadittuihin laskuihin tai viivästyneisiin portaaliyhteyksiin.",
            },
            {
              type: "ul",
              items: [
                "Yrityksen nimi ja yhtiömuoto näkyvät kaikilla lähetetyillä laskuilla.",
                "Osoitetta tarvitaan portaaleihin rekisteröitymiseen.",
                "Yhteystiedot toimivat varakanavana, jos järjestelmäilmoitukset eivät saavu perille.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jos muutat laskutusosoitettasi, tarkista sen jälkeen jo laaditut laskut kohdasta [Laskutus ja hintalaskuri](/hilfe/konto-abo/abrechnung-tarifrechner) — olemassa olevia tositteita ei mukauteta taannehtivasti.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Tilaus ja hinnasto",
          excerpt: "Hinnastosi määrittää kohdekiintiön — käytössä olevan kohdemäärän näet aina tilistä.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "myNextDays-tilauksesi sisältää kohdekiintiön: enimmäismäärän kohteita (huoneita tai lomakohteita), joita voit hallinnoida aktiivisesti samanaikaisesti. Nykyinen käytössä oleva kohdemäärä näytetään osiossa ”Tilaus ja hinnasto” kohdassa /konto yhdessä jäljellä olevan kiintiön kanssa.",
            },
            { type: "h2", text: "Kiintiön seuraaminen" },
            {
              type: "p",
              text: "Kiintiö valvotaan palvelinpuolella: kun saavutat hinnastosi ylärajan, uutta kohdetta ei voi luoda, ennen kuin poistat olemassa olevan kohteen käytöstä tai laajennat hinnastoasi. Tämä koskee riippumatta siitä, onko uusi kohde huone vai lomakohde — molemmat lasketaan kiintiöön samalla tavalla.",
            },
            {
              type: "steps",
              items: [
                "Avaa /konto ja osio ”Tilaus ja hinnasto”.",
                "Tarkista käytössä oleva kohdemäärä suhteessa hinnastosi kiintiöön.",
                "Valitse tarvittaessa suurempi hinnasto lisää kohteita varten.",
                "Vahvista hinnaston vaihto.",
              ],
            },
            {
              type: "ul",
              items: [
                "Jokainen kohde lasketaan erikseen kiintiöön kohdetyypistä riippumatta.",
                "Hinnaston vaihto vaikuttaa heti käytettävissä olevaan kiintiöön.",
                "Alempaan hinnastoon vaihtaminen on mahdollista vain, jos aktiivinen kohdemäärä sopii uuteen kiintiöön.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Vaihto pienemmän kiintiön hinnastoon hylätään, jos aktiivisia kohteita on enemmän kuin uusi hinnasto sallii. Poista ensin ylimääräiset kohteet käytöstä.",
            },
            {
              type: "note",
              variant: "info",
              text: "Lisätietoja laskuista ja hinnastolaskennasta löydät kohdasta [Laskutus ja hintalaskuri](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Laskutus ja hintalaskuri",
          excerpt: "Laskutusosoite, aiemmat laskut ja hintalaskuri kohdekiintiöllesi.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Osio ”Laskutus ja hintalaskuri” kohdassa /konto kokoaa kaiken laskutukseen liittyvän: laskutusosoitteesi, listan aiemmista ladattavista laskuista sekä hintalaskurin, jolla voit tarkistaa nykyisen tai suuremman kohdekiintiön kustannukset.",
            },
            { type: "h2", text: "Laskutusosoite ja laskut" },
            {
              type: "p",
              text: "Laskutusosoite voi poiketa yrityksesi osoitteesta, esimerkiksi jos tilitoimisto vastaanottaa tositteet. Jo laaditut laskut näet aikajärjestyksessä; jokainen voidaan ladata PDF-muodossa.",
            },
            { type: "h2", text: "Hintalaskurin käyttö" },
            {
              type: "steps",
              items: [
                "Avaa /konto ja osio ”Laskutus ja hintalaskuri”.",
                "Syötä hintalaskuriin haluamasi kohdemäärä.",
                "Vertaile syntyviä kustannuksia hinnastotasoittain.",
                "Siirry tarvittaessa laskurista suoraan sopivaan hinnastoon.",
              ],
            },
            {
              type: "ul",
              items: [
                "Hintalaskuri näyttää kustannukset tilillesi tallennetussa valuutassa.",
                "Laskut ovat pysyvästi ladattavissa.",
                "Laskutusosoitetta voi ylläpitää yrityksen perustiedoista riippumatta.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Vertaa hintalaskurilla säännöllisesti, vastaako kohdekiintiösi todellista käytössä olevaa kohdemäärää — katso [Tilaus ja hinnasto](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Salasanan ja sähköpostin muuttaminen",
          excerpt: "Tietoturvakriittiset muutokset vaativat uudelleentunnistautumisen ja vahvistusvaiheen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Salasana ja sähköpostiosoite kuuluvat tilisi tietoturvakriittisimpiin tietoihin. myNextDays vaatii siksi molemmissa muutoksissa uudelleentunnistautumisen — vahvistat muutoksen nykyisellä salasanallasi, vaikka olisit jo kirjautunut sisään.",
            },
            { type: "h2", text: "Salasanan muuttaminen" },
            {
              type: "steps",
              items: [
                "Avaa /konto ja osio ”Salasanan ja sähköpostin muuttaminen”.",
                "Syötä nykyinen salasanasi vahvistukseksi.",
                "Aseta uusi salasana ja toista se.",
                "Tallenna muutos.",
              ],
            },
            { type: "h2", text: "Sähköpostiosoitteen muuttaminen" },
            {
              type: "p",
              text: "Sähköpostiosoitteen vaihto tapahtuu kaksivaiheisena vahvistuksena: nykyisen salasanasi vahvistamisen jälkeen saat vahvistuslinkin UUTEEN osoitteeseen. Vasta tätä linkkiä napsauttamalla muutos tulee voimaan — vanha osoite pysyy siihen asti aktiivisena, jotta pääsy tilillesi ei koskaan katkea.",
            },
            {
              type: "ul",
              items: [
                "Ilman nykyistä salasanaa ei voi muuttaa salasanaa eikä sähköpostia.",
                "Uuden sähköpostiosoitteen vahvistuslinkki on voimassa rajoitetun ajan.",
                "Vanha sähköpostiosoite pysyy vahvistukseen asti aktiivisena kirjautumista ja ilmoituksia varten.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Tarkista sähköpostimuutoksen jälkeen myös kaksivaiheinen tunnistautuminen — katso [Kaksivaiheinen tunnistautuminen](/hilfe/konto-abo/zwei-faktor) — jos palautuskoodit oli sidottu vanhaan osoitteeseen.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Kaksivaiheinen tunnistautuminen",
          excerpt: "Lisävaihe kirjautumisessa suojaa tiliäsi luvattomalta käytöltä.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Kaksivaiheinen tunnistautuminen (2FA) täydentää salasanaasi toisella tekijällä autentikointisovelluksen kautta. Näin varastettu salasana yksinään ei enää riitä kirjautumaan myNextDays-tiliisi.",
            },
            { type: "h2", text: "2FA:n käyttöönotto" },
            {
              type: "steps",
              items: [
                "Avaa /konto ja osio ”Kaksivaiheinen tunnistautuminen”.",
                "Vahvista nykyinen salasanasi uudelleentunnistautumista varten.",
                "Skannaa näytetty QR-koodi autentikointisovelluksella.",
                "Syötä luotu koodi vahvistukseksi.",
                "Tallenna näytetyt palautuskoodit turvalliseen paikkaan.",
              ],
            },
            { type: "h2", text: "2FA:n poistaminen käytöstä" },
            {
              type: "p",
              text: "Myös kaksivaiheisen tunnistautumisen poistaminen käytöstä vaatii uudelleentunnistautumisen nykyisellä salasanallasi. Näin myNextDays estää sitä, että joku jo avoimella istunnolla voisi yksinkertaisesti kytkeä suojauksesi pois päältä.",
            },
            {
              type: "ul",
              items: [
                "Palautuskoodit mahdollistavat pääsyn, jos autentikointisovellus katoaa.",
                "Jokainen palautuskoodi on käytettävissä vain kerran.",
                "2FA:n päälle ja pois kytkeminen on yhtä lailla sidottu salasanan vahvistukseen.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Säilytä palautuskoodit erillään autentikointisovelluksen sisältävästä laitteesta, esimerkiksi salasananhallinnassa.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Laitehistoria",
          excerpt: "Seuraa, miltä laitteilta tilisi on kirjautunut sisään.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Laitehistoria kohdassa /konto näyttää, millä laitteilla tilisi on tällä hetkellä kirjautuneena sisään — laitetyypin, likimääräisen sijainnin ja viimeisimmän toiminnan ajankohdan kanssa. Näin tunnistat nopeasti, onko kirjautuminen todella tehty sinun toimestasi.",
            },
            { type: "h2", text: "Laitehistorian tarkistaminen" },
            {
              type: "steps",
              items: [
                "Avaa /konto ja osio ”Laitehistoria”.",
                "Käy läpi kirjautuneiden laitteiden lista.",
                "Jos tunnistat tuntemattoman laitteen, kirjaa se ulos.",
                "Vaihda tämän jälkeen varmuuden vuoksi salasanasi.",
              ],
            },
            { type: "h2", text: "Milloin kannattaa tarkistaa" },
            {
              type: "p",
              text: "Tarkista laitehistoria erityisesti salasanan tai sähköpostin vaihdon jälkeen sekä vieraan tai julkisen laitteen käytön jälkeen. Tuntematon merkintä on selkeä varoitusmerkki luvattomasta pääsystä.",
            },
            {
              type: "ul",
              items: [
                "Jokainen merkintä näyttää laitetyypin, likimääräisen sijainnin ja viimeisimmän toiminnan.",
                "Yksittäisiä laitteita voi kirjata ulos kohdennetusti muita häiritsemättä.",
                "Tunnistamaton laite on syy vaihtaa salasana välittömästi.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Jos et tunnista laitetta, kirjaa se heti ulos ja vaihda sen jälkeen salasanasi kohdassa [Salasanan ja sähköpostin muuttaminen](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Tietosuoja",
          excerpt: "Hakukoneindeksoinnin ohjaaminen kohdekohtaisesti ja tietojesi vieminen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Osiossa ”Tietosuoja” kohdassa /konto ohjaat kahta asiaa: saavatko hakukoneet indeksoida kohdesivujasi, ja miten voit viedä myNextDaysiin tallennetut tietosi.",
            },
            { type: "h2", text: "Hakukoneindeksointi kohdekohtaisesti" },
            {
              type: "p",
              text: "Oletuksena hakukoneindeksointi on pois käytöstä uusilla kohteilla. Vasta kun kytket sen tietoisesti päälle kohdekohtaisesti, hakukoneet kuten Google saavat sisällyttää julkisen kohdesivun indeksiinsä. Näin säilytät hallinnan siitä, mitkä kohteet löytyvät portaalien ja oman alustan ulkopuolelta.",
            },
            {
              type: "steps",
              items: [
                "Avaa /konto ja osio ”Tietosuoja”.",
                "Valitse haluamasi kohde listasta.",
                "Kytke hakukoneindeksointi päälle tai pois.",
                "Käytä useamman kohteen kohdalla yhteiskytkintä asettaaksesi kaikki kohteet samalla tavalla.",
              ],
            },
            { type: "h2", text: "Tietojen vieminen" },
            {
              type: "p",
              text: "Tietojenvientitoiminnolla pyydät täydellisen kopion tiliisi tallennetuista tiedoista. Vienti kootaan ja asetetaan sen jälkeen ladattavaksi.",
            },
            {
              type: "ul",
              items: [
                "Indeksointia voi ohjata kohdekohtaisesti erikseen, yhteiskytkimellä kaikille kohteille.",
                "Uudet kohteet käynnistyvät lähtökohtaisesti ilman hakukoneindeksointia.",
                "Tietojenvienti sisältää tili- ja kohdetietosi jäsennellyssä muodossa.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Hakukoneindeksointi on riippumaton näkyvyydestä portaaleissa ja omalla markkinapaikalla — se koskee yksinomaan julkista kohdesivua hakukoneissa.",
            },
          ],
        },
      ],
    },
  ],
};
