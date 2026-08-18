import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Digipalvelusäädös",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "myBestDays on digitaalisten palvelujen sisämarkkinoista annetussa asetuksessa (EU) 2022/2065 (digipalvelusäädös, DSA) tarkoitettu välityspalvelu ja verkkoalusta. Tälle sivulle on koottu asetuksen edellyttämät tiedot ja menettelyt.",
    "myBestDays ei ole asetuksen 33 artiklassa tarkoitettu erittäin suuri verkkoalusta. Niitä koskevat lisävelvoitteet — järjestelmäriskien arviointi, riippumaton auditointi, mainosarkisto ja kuukausittaisen käyttäjämäärän julkaiseminen siinä säädetyssä menettelyssä — eivät siis koske meitä.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Yhteyspisteet (11 ja 12 artikla)",
      paragraphs: [
        `Keskitetty yhteyspiste jäsenvaltioiden viranomaisille, komissiolle ja Euroopan digitaalisten palvelujen lautakunnalle: ${ANBIETER.email}, postitse ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Tanska.`,
        `Keskitetty yhteyspiste käyttäjille: ${ANBIETER.email}. Tavoitatte meidät sieltä suoraan ilman automatisoitua välivaihetta.`,
        "Molempien yhteyspisteiden kanssa voi viestiä saksaksi, tanskaksi ja englanniksi.",
        "Asetuksen 13 artiklan mukaista laillista edustajaa unionissa ei tarvitse nimetä: ylläpitäjä on sijoittautunut Tanskaan ja siten unioniin.",
        `Toimivaltainen digitaalisten palvelujen koordinaattori 49 artiklan mukaisesti: ${DSA_KOORDINATOR.name}, Tanska ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Lainvastaisen sisällön ilmoittaminen (16 artikla)",
      paragraphs: [
        "Kuka tahansa voi ilmoittaa meille sisällöstä, jota pitää lainvastaisena. Käyttäkää ilmoitustoimintoa, joka on jokaisen ilmoituksen, arvostelun ja viestin yhteydessä, tai käyttäjien yhteyspistettä.",
        "Jotta voimme arvioida ilmoituksen ilman perusteellista oikeudellista tarkastelua, sen tulisi sisältää:",
      ],
      list: [
        "riittävästi perusteltu selvitys siitä, miksi sisältö on lainvastainen;",
        "tarkka sähköinen sijainti, erityisesti URL-osoite;",
        "ilmoittajan nimi ja sähköpostiosoite — lukuun ottamatta lasten seksuaalista itsemääräämisoikeutta loukkaavia rikoksia koskevia ilmoituksia, joissa tieto on vapaaehtoinen;",
        "vakuutus siitä, että tiedot ovat parhaan tietämyksen mukaan oikeita ja täydellisiä.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Miten käsittelemme ilmoitukset",
      paragraphs: [
        "Vahvistamme vastaanoton viipymättä ja ratkaisemme asian oikea-aikaisesti, huolellisesti, syrjimättömästi ja objektiivisesti.",
        "Jos ilmoitus sisältää kohdassa 2 mainitut tiedot, se perustaa asetuksen 6 artiklassa tarkoitetun tietoisuutemme.",
        "Ilmoitamme päätöksestämme ilmoittajalle ja kerromme oikeussuojakeinot.",
        "Jos käsittely on automatisoitua, ilmoitamme siitä.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Toimenpiteiden perustelu (17 artikla)",
      paragraphs: [
        "Kun rajoitamme sisällön näkyvyyttä, poistamme sen, estämme pääsyn siihen, keskeytämme maksuja, keskeytämme palvelun tarjoamisen tai tilin, asianosainen saa selkeän ja yksilöidyn perustelun.",
        "Perustelussa mainitaan toimenpiteen luonne ja laajuus, sen alueellinen ja ajallinen soveltamisala, päätöksen tosiseikat ja olosuhteet, oliko automatisoitu käsittely osallisena, oikeusperusta tai rikottu sopimusmääräys sekä käytettävissä olevat oikeussuojakeinot.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Rikosepäily (18 artikla)",
      paragraphs: [
        "Jos on viitteitä rikoksesta, joka aiheuttaa vaaran henkilön hengelle tai turvallisuudelle, ilmoitamme siitä viipymättä toimivaltaisille lainvalvonta- tai oikeusviranomaisille.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Sisäinen valitustenkäsittelyjärjestelmä (20 artikla)",
      paragraphs: [
        "Jokaisesta kohdan 4 mukaisesta toimenpiteestä ja ilmoituksen hylkäämisestä voi valittaa maksutta kuuden kuukauden kuluessa.",
        "Valitukset käsitellään oikea-aikaisesti, syrjimättömästi ja huolellisesti — pätevien henkilöiden valvonnassa eikä yksinomaan automatisoiduin keinoin.",
        "Jos valitus osoittautuu perustelluksi, peruutamme toimenpiteen. Reitti kuvataan kohdassa [Valitukset ja riidanratkaisu](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Tuomioistuimen ulkopuolinen riidanratkaisu (21 artikla)",
      paragraphs: [
        "Kohdan 4 toimenpiteitä koskevissa riidoissa käyttäjät voivat kääntyä toimivaltaisen digitaalisten palvelujen koordinaattorin sertifioiman tuomioistuimen ulkopuolisen riidanratkaisuelimen puoleen. Euroopan komissio ylläpitää luetteloa sertifioiduista elimistä.",
        "Näiden elinten päätökset eivät sido meitä; emme ole velvollisia osallistumaan riippumattomien toimijoiden menettelyihin. Tuomioistuintie säilyy avoimena.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Luotetut ilmoittajat (22 artikla)",
      paragraphs: [
        "Luotetuksi ilmoittajaksi omalla erikoisalallaan tunnustetun ilmoittajan tekemät ilmoitukset käsittelemme ensisijaisesti.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Toimenpiteet väärinkäyttöä vastaan (23 artikla)",
      paragraphs: [
        "Tilit, joiden kautta tarjotaan usein ilmeisen lainvastaista sisältöä, suljemme kohtuulliseksi ajaksi ennakkovaroituksen jälkeen.",
        "Ilmoitusten ja valitusten käsittelyn keskeytämme henkilöiltä, jotka tekevät usein ilmeisen perusteettomia ilmoituksia tai valituksia — myös ennakkovaroituksen jälkeen.",
        "Arvioimme aina yksittäistapauksen: kyseisten tapausten lukumäärän, osuuden ja vakavuuden sekä tarkoituksen.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Avoimuusraportit (15 ja 24 artikla)",
      paragraphs: [
        "Julkaisemme vuosittain raportin sisällön moderoinnista: viranomaismääräysten lukumäärä, ilmoitusten lukumäärä ja laji, toteutetut toimenpiteet, valitusten lukumäärä ja lopputulos, tiedot automatisoitujen keinojen käytöstä sekä tuomioistuimen ulkopuolisissa elimissä käsiteltyjen riitojen lukumäärä.",
        `Mikroyritykset ja pienet yritykset on vapautettu osasta näitä velvoitteita asetuksen 19 artiklan nojalla. Niin kauan kuin vapautus on voimassa, annamme tiedot pyynnöstä osoitteesta ${ANBIETER.email}; heti kun ensimmäinen raportti on julkaistu, siihen linkitetään tässä.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Elinkeinonharjoittajien jäljitettävyys (30–32 artikla)",
      paragraphs: [
        "Alustalla elinkeinotoimintaa harjoittavat palveluntarjoajat voivat tarjota vasta annettuaan meille nimen, osoitteen, puhelinnumeron, sähköpostiosoitteen, rekisteritiedot, arvonlisäverotunnisteen ja maksutilin sekä edellyttäen, että tiedot ovat uskottavia.",
        "Näytämme nämä tiedot ilmoituksessa siltä osin kuin asetus sitä edellyttää.",
        "Jos saamme tietää, että ilmoitus koski lainvastaista tuotetta tai palvelua, ilmoitamme siitä asianomaisille vieraille siltä osin kuin meillä on heidän yhteystietonsa.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Suositusjärjestelmät (27 artikla)",
      paragraphs: [
        "Hakutulosten järjestyksen ja suositusten keskeiset parametrit sekä mahdollisuus vaikuttaa niihin kuvataan kohdassa [Hinnat, järjestys ja suositukset](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Mainonta (26 artikla)",
      paragraphs: [
        "Emme tällä hetkellä näytä kolmansien maksettua mainontaa emmekä maksettuja sijoituksia hakutuloksissa.",
        "Jos ottaisimme mainonnan käyttöön, merkitsisimme sen selvästi, ilmoittaisimme mainostajan ja näyttämisen keskeiset parametrit. Suljemme pois mainonnan, joka perustuu asetuksen (EU) 2016/679 9 artiklassa tarkoitettuihin erityisiin henkilötietoryhmiin, sekä profilointiin perustuvan alaikäisille suunnatun mainonnan.",
      ],
    },
  ],
};
