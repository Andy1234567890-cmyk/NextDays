// Finnische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin
// (dort stehen auch die Belege für die technischen und organisatorischen
// Maßnahmen und die Liste der Unterauftragsverarbeiter).
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Henkilötietojen käsittelysopimus",
  metaDescription:
    "Henkilötietojen käsittely yleisen tietosuoja-asetuksen 28 artiklan mukaisesti myNextDays ApS:n ja alustaa käyttävien yritysten välillä: kohde, ohjeet, turvallisuus, alikäsittelijät.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Tämä sopimus (jäljempänä ”käsittelysopimus”) on voimassa myNextDays-alustaa käyttävän yrityksen (jäljempänä ”rekisterinpitäjä”) ja ${ANBIETER.firma}:n (jäljempänä ”henkilötietojen käsittelijä” tai ”me”) välillä ja täsmentää asetuksen (EU) 2016/679 (yleinen tietosuoja-asetus) 28 artiklasta johtuvat velvollisuudet.`,
    `Se otetaan osaksi sopimusta [yleisillä sopimusehdoilla](${AGB_URL}) ja on voimassa koko alustan käytön ajan. Se on ensisijainen yleisiin sopimusehtoihin nähden siltä osin kuin kyse on henkilötietojen käsittelystä rekisterinpitäjän toimeksiannosta.`,
    "Täydentävästi sovelletaan [tietosuojaselostetta](/datenschutz) niihin tietoihin, joita käsittelemme itsenäisenä rekisterinpitäjänä — erityisesti tilin ja liikesuhteen tietoihin.",
  ],
  sections: [
    {
      heading: "Kohde ja roolien jako",
      unterpunkte: [
        {
          paragraphs: [
            "Kohteena on niiden henkilötietojen käsittely, jotka rekisterinpitäjä syöttää alustalle tai kerää sen kautta, jotta voimme tuottaa sopimuksessa sovitut palvelut: kohteiden, varausten ja käyttöasteen hallinta, viestintä vieraiden kanssa, maksujen käsittely, kirjanpito ja omistajatilitykset, liittäminen varausportaaleihin, verkkosivujen rakennustyökalu sekä tehtävien ja tiimin hallinta.",
          ],
        },
        {
          paragraphs: [
            "Rekisterinpitäjä päättää tämän käsittelyn tarkoituksista ja keinoista. Käsittelemme tietoja yksinomaan sen dokumentoitujen ohjeiden mukaisesti eikä omiin tarkoituksiimme.",
          ],
        },
        {
          paragraphs: [
            "Tilin tietojen, omien palvelujemme laskutuksen, järjestelmän turvallisuuden ja lakisääteisen säilyttämisen osalta olemme itse rekisterinpitäjä. Tämä käsittely ei ole tämän käsittelysopimuksen kohde.",
          ],
        },
      ],
    },
    {
      heading: "Käsittelyn luonne, laajuus ja tarkoitus",
      paragraphs: [
        "Käsittely tapahtuu keräämällä, tallentamalla, näyttämällä, muuttamalla, luovuttamalla rekisterinpitäjän valitsemille vastaanottajille (esim. varausportaalit, maksupalveluntarjoajat), rajoittamalla ja poistamalla — automatisoidussa muodossa alustalla.",
        "Käsittelypaikka on Euroopan unioni; poikkeukset on mainittu tyhjentävästi jaksossa 8.",
      ],
    },
    {
      heading: "Rekisteröityjen ryhmät",
      list: [
        "Vieraat ja varauksen tekijät, mukaan lukien matkakumppanit",
        "Kiinnostuneet, jotka esittävät tiedusteluja tai lähettävät viestejä",
        "Hallinnoitavien kohteiden omistajat",
        "Rekisterinpitäjän työntekijät (tiimi, siivous, palvelu, vastaanotto)",
        "Rekisterinpitäjän kumppanien ja palveluntarjoajien yhteyshenkilöt",
      ],
    },
    {
      heading: "Henkilötietojen ryhmät",
      list: [
        "Perustiedot: nimi, osoite, syntymäaika jos se kirjataan, kansalaisuus jos se kirjataan ilmoitusvelvollisuutta varten",
        "Yhteystiedot: sähköpostiosoite, puhelinnumero",
        "Varaustiedot: ajanjakso, kohde, matkustajien määrä, hinnat, lisäpalvelut, peruutukset",
        "Maksutiedot: summa, valuutta, maksutapa, maksun tila, viitteet (täydelliset korttitiedot eivät päädy järjestelmiimme)",
        "Viestintätiedot: viestit, muistiinpanot, arvostelut",
        "Työntekijöiden käyttöoikeus- ja käyttötiedot: rooli, oikeudet, kirjautumisen ajankohta, kirjautumisen laite ja IP-osoite",
        "Yleisen tietosuoja-asetuksen 9 artiklan mukaiset erityiset henkilötietoryhmät eivät ole toimeksiannon kohteena; rekisterinpitäjä ei syötä tällaisia tietoja vapaan tekstin kenttiin.",
      ],
    },
    {
      heading: "Ohjeet",
      unterpunkte: [
        {
          paragraphs: [
            "Rekisterinpitäjä antaa ohjeita alustan käytöllä ja määrityksillä sekä kirjallisesti yhteysosoitteeseemme. Suulliset ohjeet vahvistamme kirjallisesti.",
          ],
        },
        {
          paragraphs: [
            "Jos pidämme ohjetta lainvastaisena, ilmoitamme siitä viipymättä ja voimme keskeyttää sen toteuttamisen, kunnes rekisterinpitäjä vahvistaa tai muuttaa sen.",
          ],
        },
        {
          paragraphs: [
            "Jos olemme lain nojalla velvollisia käsittelemään tietoja (esimerkiksi viranomaisiin nähden), ilmoitamme siitä rekisterinpitäjälle ennakolta siltä osin kuin laki sen meille sallii.",
          ],
        },
        {
          titel: "Rekisterinpitäjän omien palvelujen liittäminen",
          paragraphs: [
            "Rekisterinpitäjä voi liittää tilinsä rajapinnan kautta palveluun, jonka se on itse valinnut ja jonka kanssa se on tehnyt oman sopimuksen — esimerkiksi tekoälyavustajaan. Jos se myöntää tällaisen liitännän, se on sen nimenomainen ohje yleisen tietosuoja-asetuksen 28 artiklan 3 kohdan a alakohdan mukaisesti luovuttaa vapautetut tiedot tälle palvelulle. Se kattaa nimenomaisesti myös siihen liittyvän siirron kolmanteen maahan, jos palvelun kotipaikka on Euroopan unionin ulkopuolella.",
            "Lyhyesti: tällaisesta liitännästä päättää yksin rekisterinpitäjä, ja liitetystä palvelusta se vastaa itse.",
            "Sen voi myöntää vain tili, jolla on oikeus hallinnoida ulkoisia liitäntöjä. Tämä oikeus on varattu roolille ”pääkäyttäjä”; rajoitetuin oikeuksin toimivat tilit — myös rooli ”apupääkäyttäjä” — eivät voi myöntää liitäntää. Kirjaamme, kuka sen myönsi, milloin ja mille palvelulle, mitkä tietolajit vapautettiin ja mitkä haut tehtiin; tämä kirjaus on rekisterinpitäjän käytettävissä käyttöliittymässä kohdassa ”Tili → Liitännät”, jotta se voi täyttää osoitusvelvollisuutensa ja vastata tietopyyntöihin.",
            "Liitetty palvelu ei ole meidän alikäsittelijämme: emme anna sille toimeksiantoa, emme valitse sitä emmekä anna sille ohjeita. Se käsittelee tietoja sen sopimuksen perusteella, jonka rekisterinpitäjä on itse tehnyt sen kanssa. Tästä käsittelystä, sen oikeusperustasta ja kolmanteen maahan siirron suojatoimista vastaa siksi rekisterinpitäjä; se ei ole tämän käsittelysopimuksen kohde.",
            "Vapaan tekstin kentät — varausmuistiinpanot ja vieraiden viestien sisältö — on oletusarvoisesti rajattu tällaisen liitännän ulkopuolelle. Ne voivat sisältää yleisen tietosuoja-asetuksen 9 artiklan mukaisia erityisiä henkilötietoryhmiä, esimerkiksi terveyttä koskevia tietoja. Rekisterinpitäjän on vapautettava ne erikseen liitäntää myöntäessään; ilman tätä vapautusta niitä ei siirretä.",
            "Rekisterinpitäjä voi katkaista myönnetyn liitännän milloin tahansa käyttöliittymässä. Uudistamistunnisteet poistetaan tällöin, ja jokaisen uuden haun yhteydessä tarkistetaan, onko suostumus vielä voimassa — katkaistu palvelu ei siksi voi lukea enää mitään välittömästi, eikä vasta sen pääsytunnisteen umpeutuessa.",
          ],
        },
      ],
    },
    {
      heading: "Luottamuksellisuus",
      paragraphs: [
        "Kaikki henkilöt, jotka toimeksiannon mukaisesti voivat päästä tietoihin, ovat sitoutuneet luottamuksellisuuteen, ja heitä perehdytetään säännöllisesti tietosuojaan. Käyttöoikeus on rajattu kyseisen tehtävän kannalta tarpeelliseen.",
        "Työntekijöidemme pääsy asiakastietoihin tapahtuu vain virheiden korjaamiseksi, tukipyynnön perusteella tai lakisääteisten velvollisuuksien täyttämiseksi.",
      ],
    },
    {
      heading: "Käsittelyn turvallisuus",
      paragraphs: [
        "Toteutamme yleisen tietosuoja-asetuksen 32 artiklan edellyttämät tekniset ja organisatoriset toimenpiteet. Käytössä ovat erityisesti:",
      ],
      list: [
        "Siirron salaus (TLS) kaikille yhteyksille, HTTP-turvaotsakkeet mukaan lukien tiukka Content-Security-Policy",
        "Asiakkaiden erottelu suoraan tietokannassa: riviperusteiset käyttöoikeussäännöt (Row Level Security) sekä arkaluonteisten tietojen taulukko-oikeuksien peruuttaminen, jolloin pääsy oman yrityksen ulkopuolelle on suljettu pois myös suoraa tietokantareittiä käyttäen",
        "Rooliperusteiset oikeudet tietojen erottelulla: palvelu- ja siivoushenkilöstö ei saa talous- ja myyntitietoja, omistajat vain omat kohteensa; vieraiden tiedot peitetään rooleilta, joilla ei ole oikeutta",
        "Kaksivaiheinen tunnistautuminen (TOTP) käytettävissä tileille; uudelleentunnistautuminen turvallisuuden kannalta kriittisissä muutoksissa",
        "Kirjautumisloki laitteen, ajankohdan ja IP-osoitteen kanssa, rekisterinpitäjän nähtävissä",
        "Liitäntöjä ulkoisiin palveluihin voi myöntää vain tili roolilla ”pääkäyttäjä”; jokainen tällaisen liitännän kautta tehty haku kirjataan (työkalu, ajankohta, laajuus — ilman itse sisältöä) ja on rekisterinpitäjän nähtävissä. Katkaistu liitäntä menettää pääsyn välittömästi: jokaisen haun yhteydessä tarkistetaan, onko suostumus vielä voimassa",
        "Pyyntötiheyden rajoittaminen automatisoituja hyökkäyksiä vastaan, saapuvien webhook-kutsujen allekirjoitusten tarkistus",
        "Salatut varmuuskopiot, joita säilytetään tuotantojärjestelmän ulkopuolella, säännöllisin palautustestein",
        "Erilliset ympäristöt kehitykselle ja tuotannolle; muutokset tietokantaan yksinomaan versioitujen migraatioiden kautta",
      ],
    },
    {
      heading: "Alikäsittelijät",
      paragraphs: [
        "Rekisterinpitäjä hyväksyy seuraavien alikäsittelijöiden käytön. Jokaisen kanssa on tehty yleisen tietosuoja-asetuksen 28 artiklan 4 kohdan mukaiset sopimukset, joiden velvollisuudet vastaavat tätä käsittelysopimusta.",
      ],
      list: [
        "Hetzner Online GmbH, Saksa (palvelimet, tietokanta, media, sähköpostipalvelin; konesali Helsingissä, Suomessa)",
        "Stripe Payments Europe, Limited, Irlanti (maksut, maksatukset, lakisääteinen henkilöllisyyden todentaminen)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg (maksut, jos rekisterinpitäjä ottaa ne käyttöön)",
        "Channex.io Ltd, Yhdistynyt kuningaskunta (liittäminen varausportaaleihin, jos käytössä)",
        "Meta Platforms Ireland Limited, Irlanti (WhatsApp-viestit, jos käytössä)",
        "Google Ireland Limited, Irlanti (sisällön kääntäminen; kirjautuminen Googlella, jos käytössä)",
        "Groq, Inc., Yhdysvallat (vastausehdotukset saapuneissa, jos käytössä)",
        "Cloudflare, Inc., Yhdysvallat (omien verkkotunnusten DNS-tietueiden hallinta, jos käytössä)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Vaihdoksesta tai lisäyksestä ilmoitamme vähintään 30 päivää etukäteen. Rekisterinpitäjä voi tämän määräajan kuluessa vastustaa sitä painavasta, tietosuojaan liittyvästä syystä; jos vastustusta ei saada ratkaistua, se voi irtisanoa kyseisen palvelun osan tai sopimuksen.",
          ],
        },
        {
          paragraphs: [
            "Palvelut, joista rekisterinpitäjä itse sopii kolmannen osapuolen kanssa, eivät ole alikäsittelyä vaan sen itsensä aiheuttama siirto. Tämä koskee varausportaalia, jonka kanssa sillä on oma sopimus, samoin kuin tekoälyavustajaa tai muuta ohjelmaa, jonka se liittää tiliinsä rajapinnan kautta (ks. jakso ”Ohjeet”).",
            "Ratkaisevaa ei ole se, kenen järjestelmien kautta tiedot kulkevat, vaan se, kuka ottaa palvelun mukaan: alikäsittely syntyy silloin, kun ME annamme toimeksiannon toiselle palveluntarjoajalle tuottaaksemme oman palvelumme. Jos rekisterinpitäjä valitsee palvelun itse ja tekee sopimuksen sen kanssa, tämä palvelu käsittelee tietoja rekisterinpitäjälle — ei meille. Tämä rajanveto vastaa vertailukelpoisten toimittajien sopimuskäytäntöä asiakkaan itse liittämien kolmansien palvelujen osalta.",
          ],
        },
      ],
    },
    {
      heading: "Siirrot kolmansiin maihin",
      paragraphs: [
        "Siirrot EU:n ulkopuolisille vastaanottajille rajoittuvat edellä mainittuihin palveluihin, joiden kotipaikka on Yhdysvalloissa tai Yhdistyneessä kuningaskunnassa. Perusteena ovat Euroopan komission tietosuojaa koskevat mallilausekkeet yleisen tietosuoja-asetuksen 46 artiklan 2 kohdan c alakohdan mukaisesti tai voimassa oleva riittävyyspäätös; täydentäviä suojatoimia (salaus, tietojen minimointi) sovelletaan.",
      ],
    },
    {
      heading: "Rekisterinpitäjän avustaminen",
      unterpunkte: [
        {
          paragraphs: [
            "Avustamme rekisterinpitäjää rekisteröityjen pyyntöihin vastaamisessa (yleisen tietosuoja-asetuksen 15–22 artikla). Alusta tarjoaa tähän tietojen tarkastuksen, oikaisun, viennin ja poistamisen suoraan käyttöliittymässä. Jos rekisteröidyt kääntyvät suoraan meidän puoleemme, ohjaamme heidät rekisterinpitäjälle ja ilmoitamme siitä sille.",
          ],
        },
        {
          paragraphs: [
            "Avustamme lisäksi tietosuojaa koskevissa vaikutustenarvioinneissa, yleisen tietosuoja-asetuksen 32–36 artiklan velvollisuuksien noudattamisessa ja valvontaviranomaisten tiedusteluissa.",
          ],
        },
      ],
    },
    {
      heading: "Henkilötietojen tietoturvaloukkaukset",
      paragraphs: [
        "Jos saamme tiedon henkilötietojen tietoturvaloukkauksesta, joka koskee rekisterinpitäjän tietoja, ilmoitamme siitä sille viipymättä, viimeistään 48 tunnin kuluessa tiedon saamisesta, kirjallisesti.",
        "Ilmoitus sisältää, siltä osin kuin tiedossa on, tapahtuman luonteen ja ajankohdan, kyseessä olevat tietoryhmät ja henkilöryhmät, todennäköiset seuraukset sekä toteutetut ja ehdotetut toimenpiteet. Avustamme rekisterinpitäjää sen ilmoitusvelvollisuuksissa yleisen tietosuoja-asetuksen 33 ja 34 artiklan mukaisesti.",
      ],
    },
    {
      heading: "Selvitykset ja tarkastukset",
      unterpunkte: [
        {
          paragraphs: [
            "Osoitamme pyynnöstä tämän käsittelysopimuksen noudattamisen, erityisesti antamalla tietoja toteutetuista toimenpiteistä ja käytetyistä alikäsittelijöistä.",
          ],
        },
        {
          paragraphs: [
            "Rekisterinpitäjä voi suorittaa tarkastuksia tarpeellisessa laajuudessa tai teettää ne riippumattomalla tarkastajalla, joka ei kilpaile kanssamme. Tarkastukset tehdään ennakkoilmoituksen jälkeen kohtuullisessa määräajassa, tavanomaisen työajan puitteissa ja toimintaa häiritsemättä. Tietojen antamista laajemman tarkastuksen kustannuksista vastaa rekisterinpitäjä, ellei tarkastus johdu meidän aiheuttamastamme tapahtumasta.",
          ],
        },
      ],
    },
    {
      heading: "Poistaminen ja palauttaminen",
      paragraphs: [
        "Sopimuksen päättymisen jälkeen asetamme rekisterinpitäjän tiedot pyynnöstä 30 päivän kuluessa vietäviksi yleisessä, koneellisesti luettavassa muodossa. Sen jälkeen poistamme tiedot kopioita myöten.",
        "Poikkeuksena ovat tiedot, joita koskee lakisääteinen säilytysvelvollisuus (erityisesti lasku- ja kirjanpitotiedot); ne suljetaan käytöstä ja poistetaan määräajan päätyttyä. Varmuuskopiot korvataan tavanomaisessa kierrossa.",
      ],
    },
    {
      heading: "Vastuu ja etusijajärjestys",
      paragraphs: [
        "Sovelletaan yleisen tietosuoja-asetuksen 82 artiklaa. Osapuolten välisessä suhteessa sovelletaan lisäksi yleisten sopimusehtojen vastuusääntöjä siltä osin kuin ne eivät ole ristiriidassa yleisen tietosuoja-asetuksen kanssa.",
        "Jos yleiset sopimusehdot ja tämä käsittelysopimus ovat ristiriidassa toimeksiannosta tapahtuvan käsittelyn osalta, sovelletaan tätä käsittelysopimusta. Jos jokin määräys osoittautuu pätemättömäksi, muu sisältö pysyy voimassa; osapuolet korvaavat sen sallitulla määräyksellä, jolla on sama tarkoitus.",
      ],
    },
    {
      heading: "Tämän sopimuksen muutokset",
      paragraphs: [
        "Voimme muuttaa tätä käsittelysopimusta siltä osin kuin se on tarpeen lainsäädännön muutosten, valvontaviranomaisten vaatimusten, maksupalveluntarjoajien vaatimusten tai teknisen kehityksen vuoksi eikä rekisterinpitäjän asema siitä heikkene.",
        "Muutoksista ilmoitamme kirjallisesti vähintään 30 päivää ennen voimaantuloa. Jos rekisterinpitäjä ei vastusta niitä tämän määräajan kuluessa, ne katsotaan hyväksytyiksi; tästä seurauksesta ilmoitetaan ilmoituksessa. Vastustuksen johdosta kumpikin osapuoli voi irtisanoa sopimuksen voimaantulon ajankohtaan.",
      ],
    },
    {
      heading: "Yhteystiedot",
      paragraphs: [
        `Tätä sopimusta koskevat tiedustelut, ohjeet ja ilmoitukset pyydetään lähettämään osoitteeseen [${ANBIETER.email}](mailto:${ANBIETER.email}) tai ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
