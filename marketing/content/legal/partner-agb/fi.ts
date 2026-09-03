// Partner-AGB — Finnisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "myNextDays-kumppanuusohjelman osallistumisehdot: attribuutio, palkkioperuste, taso, tiimipalkkio, kiellot, merkinnät, maksut.",
  numbered: false,
  toc: true,
  title: "Kumppanuusohjelman osallistumisehdot (kumppanin yleiset ehdot) — Luonnos",
  standIso: "2026-09-02",
  intro: [
    "LUONNOS — Nämä ehdot ovat myNextDaysin työvaiheessa oleva versio, eikä niitä ole vielä lakimiehen tarkastanut. Hyväksytyn version julkaisuun asti ne toimivat ohjelman kuvauksena, eivät lopullisena sopimustekstinä. Tarkastettu versio julkaistaan tähän osoitteeseen uudella versionumerolla; kumppaneita pyydetään hyväksymään se uudelleen seuraavan kirjautumisen yhteydessä.",
    `Nämä osallistumisehdot säätelevät ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (jäljempänä ”myNextDays” tai ”me”) kumppanuusohjelmaan (affiliate-ohjelma) osallistumista kumppaneiden (jäljempänä ”kumppani”) toimesta.`,
    "Kumppanuusohjelma on tarkoitettu henkilöille ja yrityksille, joiden kotipaikka on EU:ssa, Sveitsissä tai Yhdistyneessä kuningaskunnassa ja jotka suosittelevat yrityksiä (vuokranantajia, toimistoja, hotelleja) myNextDaysille.",
  ],
  sections: [
    {
      heading: "§ 1 Osallistuminen ja hyväksyntä",
      paragraphs: [
        "Osallistuminen edellyttää hakemuksen tekemistä kumppanin hallintapaneelin kautta. Pakolliset tiedot ovat nimi tai yrityksen nimi, oikeudellinen muoto, maa, vähintään yksi sosiaalisen median tili osoitteineen, käyttäjätunnuksineen ja kattavuuksineen sekä yritysten osalta arvonlisäverotunniste.",
        "myNextDays tarkistaa jokaisen hakemuksen henkilökohtaisesti ja päättää vapaasti hyväksynnästä. Oikeutta hyväksyntään ei ole. Osallistuminen on maksutonta; myNextDays-tilauksen omistaminen ei ole edellytys.",
        "Kumppani pitää tietonsa ajan tasalla, erityisesti kanavat, oikeudellisen muodon, vero- ja maksutiedot.",
        "Ilmoitettu kattavuus on aluksi itsearviointi. Kumppani voi vapaaehtoisesti yhdistää YouTube-, Instagram-, Facebook- ja TikTok-tilinsä; tällöin seuraajat ja katselukerrat luetaan alustalta ja ilmoitetaan vahvistetuiksi. Vahvistamattoman kattavuuden painoarvo on pienempi hyväksynnässä ja myöhemmissä tarkastuksissa. Yhteys voidaan katkaista milloin tahansa hallintapaneelissa; käsittelyn yksityiskohdat löytyvät tietosuojakäytännöstä.",
      ],
    },
    {
      heading: "§ 2 Yritysten kohdentaminen (attribuutio)",
      paragraphs: [
        "Yritys kohdennetaan kumppanille, kun se rekisteröityy kumppanin suosituskoodilla. Koodi näytetään yritykselle selkeästi rekisteröinnin yhteydessä ja vahvistetaan lähettämällä. Seurantakeksejä ei aseteta.",
        "Yritys kohdennetaan täsmälleen yhdelle kumppanille; ratkaiseva on rekisteröinnin yhteydessä vahvistettu koodi. Myöhempi uudelleenkohdentaminen tapahtuu vain myNextDaysin toimesta todistetun virheen perusteella.",
        "Kumppanin omat yritykset, sen osakkaat, työntekijät tai sukulaiset sekä yritykset, jotka ovat jo tai ovat olleet myNextDaysin asiakkaita, eivät kuulu kohdennuksen piiriin.",
      ],
    },
    {
      heading: "§ 3 Palkkio omista asiakkaista",
      paragraphs: [
        "Palkkioperusteena on kohdennetun yrityksen nettotilausliikevaihto (perushinta ja moduulit) maksetuista laskuista – ilman arvonlisäveroa, ilman portaalipalkkioita, lisäpalveluita, jälkilaskutuksia ja muita läpikulkevia eriä.",
        "Provisioprosentti määräytyy kumppanin tason mukaan maksun hetkellä. Tasot ja prosentit on julkaistu ohjelmasivulla. Taso määräytyy kumppanin rakenteessa olevien maksavien asiakkaiden lukumäärän perusteella: hänen omat maksavat asiakkaansa ja hänen tiimikumppaneidensa maksavat asiakkaat (§ 4), jokainen asiakas kerran. Taso määritetään kuukausittain määräpäivänä; ylennys astuu voimaan välittömästi, alennus vasta, jos lukumäärä on ollut kahden peräkkäisen määräpäivän ajan kynnyksen alapuolella.",
        "Kun kumppani saavuttaa ensimmäisen kerran tason alkaen ”Aufsteiger”, hän saa kertaluonteisesti ohjelmasivulla kyseiselle tasolle ilmoitetun ylennysbonuksen (tällä hetkellä 50,00 EUR per taso, kaikille kumppaneille euroina). Jokainen taso palkitaan vain kerran, myös alennuksen ja uudelleen ylennyksen jälkeen. Bonus kuuluu § 7:n mukaiseen palautusikkunaan.",
        "Provisio syntyy jokaisesta yrityksestä kahdentoista kuukauden ajan sen ensimmäisestä maksullisesta tilauslaskusta alkaen; kumppanin kautta välitettyä ilmaista kokeilujaksoa ja ilmaista kuukautta ei lasketa mukaan. Jos tilaus päättyy aiemmin, provisio päättyy viimeiseen maksettuun laskuun.",
        "”Elite-Partner” -tasosta alkaen kumppani saa lisäksi ohjelmasivulla ilmoitetun suuruisen superprovision (tällä hetkellä 2,5 %) kaikkien rakenteensa asiakkaiden – omien asiakkaiden ja tiimikumppaneidensa asiakkaiden – netto-tilausliikevaihdosta ilman kahdentoista kuukauden rajaa, niin kauan kuin kyseisellä asiakkaalla on maksullinen tilaus ja kumppanilla on kyseinen taso maksun hetkellä. Se syntyy 2. lauseen ja § 4:n mukaisen provision lisäksi.",
        "”Elite-Partner” -tasosta alkaen kumppani saa jokaisesta myBestDaysin kautta vastaanotetusta ja maksetusta varauksesta, joka koskee häneen tai johonkin hänen tiimikumppaniinsa liitettyä yritystä, ohjelmasivulla ilmoitetun suuruisen varausosuuden (tällä hetkellä 0,5 %) vieraan maksamasta varausmäärästä varausvaluutassa, ilman aikarajaa, niin kauan kuin liitos on voimassa ja kumppanilla on kyseinen taso varausmaksun hetkellä. Vakuudet eivät ole varausmäärä. Vieraalle suoritetut hyvitykset vähentävät osuutta suhteellisesti (§ 7).",
      ],
    },
    {
      heading: "§ 4 Tiimiprovisio",
      paragraphs: [
        "”Aufsteiger”-tasosta alkaen kumppani saa johtaa tiimikumppaneita. Jos toinen kumppani hakee kumppanin tiimilinkin kautta ja vahvistaa hänen koodinsa näkyvästi hakemuksessaan, hänet liitetään hyväksynnän jälkeen kumppanin (jäljempänä ”Sponsori”) tiimiin. Jos Sponsorilla ei ole kyseistä tasoa hakemuksen jättämisen hetkellä, hakemus pysyy voimassa, mutta tiimiliitosta ei synny.",
        "Sponsori saa tiimikumppaneidensa asiakkaiden netto-tilausliikevaihdosta tiimiprovision, jonka suuruus on hänen oman provisioprosenttinsa ja tiimikumppanin provisioprosenttinsa välinen ero, kunkin tason mukaan maksun hetkellä. Jos molemmat ovat samalla tasolla tai tiimikumppani on korkeammalla, tiimiprovisiota ei synny. Tiimikumppanin provisio ja Sponsorin tiimiprovisio eivät yhdessä ylitä koskaan korkeinta porrastuksen prosenttia (tällä hetkellä 30 %).",
        "Tiimiprovisio on täsmälleen yhden tason syvyinen: tiimikumppanit eivät saa tiimiprovisiota kumppaneista, jotka he itse värväävät. Kumppanin värväämisestä ei makseta korvausta; osallistumismaksua ei peritä. Tiimiprovisio syntyy yksinomaan maksetusta tilausmyynnistä.",
        "Tiimiprovisio on voimassa kutakin tiimiasiakasta kohden kaksitoista kuukautta hänen ensimmäisestä maksetusta laskustaan, siihen sovelletaan samaa palautusikkunaa ja se peruutetaan suhteellisesti palautuksen tai takaisinperinnän yhteydessä (§ 7). Se syntyy vain niin kauan kuin sponsori ja tiimikumppani ovat hyväksyttyjä; muussa tapauksessa se pidätetään selvitykseen asti.",
        "Tiimimääritys on kertaluonteinen. Muutos tapahtuu vain myNextDaysin toimesta dokumentoidulla syyllä.",
      ],
    },
    {
      heading: "§ 5 Kumppanin velvollisuudet ja merkintä",
      paragraphs: [
        "Kumppani merkitsee jokaisen suosituksen linkillään tai koodillaan mainokseksi – julkaisun alussa, julkaisun kielellä, maansa vaatimusten mukaisesti (Saksassa mm. § 5a Abs. 4 UWG, Tanskassa markedsføringsloven § 6 Abs. 4). myNextDays tarjoaa kunkin maan sanamuodot kumppanin hallintapaneelissa.",
        "Kumppani antaa myNextDaysista vain tietoja, jotka vastaavat julkaistuja palvelukuvauksia, eikä anna lupauksia myNextDaysin nimissä. Erityisesti kiellettyjä ovat menestys- ja takuulupaukset (esim. ”taattu täysi käyttöaste kolmessa päivässä”) sekä lausunnot tuloista, jotka eivät johdu julkaistuista palvelukuvauksista.",
        "Jokainen video ja julkaisu, jossa mainitaan myNextDays tai joka sisältää kumppanin linkin, on toimitettava tiedostona kumppanin hallintapaneeliin tarkistettavaksi ennen julkaisua. Kumppanin linkki syntyy vasta myNextDaysin kirjallisen hyväksynnän jälkeen; julkaiseminen ilman hyväksyntää on kielletty. myNextDays voi peruuttaa hyväksynnän; jo syntyneet provisiot pysyvät ennallaan.",
        "Logojen, näyttökuvien, B-rollin, peittokuvien ja kuvakaappausten osalta kumppani käyttää yksinomaan myNextDaysin tarjoamaa mainosmateriaalia. Omien, tarkistamattomien ohjelmistotallenteiden käyttö ei ole sallittua.",
      ],
    },
    {
      heading: "§ 6 Kielletyt käytännöt",
      paragraphs: ["Erityisesti kiellettyjä ovat:"],
      list: [
        "Brand-Bidding: maksetut mainokset brändillä ”myNextDays”, kirjoitusmuunnelmat ja yhdistelmät (esim. ”myNextDays hinnat”) hakukoneissa ja verkoissa;",
        "Evästeiden pudottaminen, peitellyt uudelleenohjaukset, iFramet, kumppanilinkin automaattinen kutsuminen tai muu tekninen manipulointi määrityksessä;",
        "Itsemainonta: omien yritysten, osakkaiden, työntekijöiden tai sukulaisten rekisteröinti oman koodin tai tiimikumppanin koodin kautta;",
        "Ostettu kattavuus (ostetut seuraajat, klikkifarmit, bottiliikenne) sekä kannustimet yrityksille rekisteröitymisestä (takaisinmaksut, lahjat, kilpailut);",
        "Rekrytointilupaukset: kumppaneiden värvääminen tulolupauksilla, jotka eivät perustu maksettuun tilausmyyntiin, tai ohjelman esittäminen tulonlähteenä värväämällä lisää kumppaneita;",
        "Roskaposti, luvaton suoramarkkinointi ja vieraiden tavaramerkkien tai sisällön käyttö ilman oikeutta.",
      ],
    },
    {
      heading: "7 § Hyvitysikkuna, peruutukset, pidätykset",
      paragraphs: [
        "Jokainen provisiomerkintä on avoinna 30 päivää sen syntymisestä (hyvitysikkuna) ja sen jälkeen maksettavissa. Jos taustalla oleva lasku hyvitetään kokonaan tai osittain tai veloitetaan takaisin (chargeback), provisio – mukaan lukien siihen perustuva tiimiprovisio – peruutetaan suhteellisesti, myös maksun jälkeen, kuittaamalla se tulevilla provisioilla.",
        "Jos epäillään rikkomusta 2, 5 tai 6 §:ää vastaan, myNextDays voi pidättää kohdistukset ja provisiot selvitykseen asti. Jos rikkomus vahvistetaan, kyseiset provisiot raukeavat.",
      ],
    },
    {
      heading: "8 § Maksu ja hyvitys",
      paragraphs: [
        "Maksettavissa olevat provisiot kootaan kuukausittain valuutoittain ja maksetaan, kun ne saavuttavat ohjelmasivulla tai hallintapaneelissa mainitun kyseisen valuutan vähimmäismäärän. Valuuttojen välistä muuntamista ei tapahdu.",
        "Laskutus tapahtuu hyvitysmenettelyllä (itsepalvelulaskutus, momsloven 52a §): myNextDays luo hyvityksen jokaisesta maksusta; kumppani ei lähetä laskua. Kumppani hyväksyy hyvitysmenettelyn.",
        "Yrittäjät saavat hyvityksen viittauksella palvelun vastaanottajan verovelvollisuuteen (käännetty verovelvollisuus); edellytyksenä on voimassa oleva, vahvistettu arvonlisäverotunniste. Yksityishenkilöt saavat hyvityksen ilman arvonlisäveroa ja verottavat provision itse.",
        "Maksu suoritetaan SEPA-siirrolla, Wise-palvelun tai PayPalin kautta kumppanin hallintapaneeliin tallentamiin tietoihin.",
      ],
    },
    {
      heading: "9 § Tiedot ja näkymä",
      paragraphs: [
        "Kumppani näkee kohdistetut yritykset pseudonyymisti (numero, maa, tila, summat). Yritysten nimiä, sähköpostiosoitteita tai varaustietoja ei paljasteta. Sponsori näkee tiimikumppaneidensa nimen tai yrityksen, arvon, maksavien asiakkaiden määrän ja siitä syntyvän tiimiprovision, ei asiakastietoja.",
        "Liitettyjen tilien ja luotujen julkaisujen osalta myNextDays näkee seuraajat, katselukerrat, vuorovaikutukset sekä klikkaukset ja asiakkaat julkaisua kohden. Poikkeamat (esim. seuraajien hyppäys ilman vastaavia katselukertoja tai merkittävä poikkeama itsearvioinnin ja vahvistetun arvon välillä) ovat viitteitä henkilökohtaiseen tarkastukseen 6 ja 10 §:n mukaisesti, eivät automaattinen esto.",
        "Henkilötietojen käsittely kumppanuusohjelmassa on kuvattu tietosuojaselosteessa.",
      ],
    },
    {
      heading: "10 § Voimassaoloaika, esto ja irtisanominen",
      paragraphs: [
        "Osallistuminen on toistaiseksi voimassa ja molemmat osapuolet voivat päättää sen milloin tahansa kirjallisesti. Jo syntyneet, maksettavissa olevat provisiot maksetaan 8 §:n mukaisesti; päättymisen jälkeen uusia provisioita ei synny.",
        "myNextDays voi estää kumppanin, jos tämä rikkoo näitä ehtoja. Eston aikana provisiot pidätetään; vahvistetun rikkomuksen tapauksessa ne raukeavat.",
      ],
    },
    {
      heading: "11 § Muutokset",
      paragraphs: [
        "myNextDays voi muuttaa näitä ehtoja ja tasoja tulevaisuudessa. Muutokset julkaistaan kumppanin hallintapaneelissa ja tällä sivulla versionumerolla; olennaisista muutoksista pyydetään kumppanilta uusi hyväksyntä. Jo kertyneet palkkiot pysyvät ennallaan.",
      ],
    },
    {
      heading: "§ 12 Sovellettava laki",
      paragraphs: [
        "Sovelletaan Tanskan lakia lukuun ottamatta lainvalintasääntöjä. Pakottavat kuluttajansuojasäännökset sen valtion lainsäädännöstä, jossa yksityisellä kumppanilla on vakinainen asuinpaikka, pysyvät ennallaan.",
      ],
    },
  ],
};
