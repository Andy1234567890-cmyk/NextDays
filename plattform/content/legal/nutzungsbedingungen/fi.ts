import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Käyttöehdot vieraille",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "Nämä käyttöehdot koskevat varausportaali myBestDaysin (jäljempänä ”alusta”) käyttöä matkustajien ja varaajien (jäljempänä ”vieras” tai ”te”) osalta.",
    `Alustaa ylläpitää ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Tanska, CVR-nro ${ANBIETER.cvr} (jäljempänä ”myBestDays” tai ”me”). myBestDays on tämän yhtiön tavaramerkki eikä itsenäinen oikeushenkilö. Täydelliset palveluntarjoajan tiedot löytyvät kohdasta [Oikeudelliset tiedot](https://mybestdays.dk/rechtliches/impressum).`,
    "Käyttämällä alustaa hyväksytte nämä ehdot. Pyydämme lukemaan ne huolellisesti.",
  ],
  summary: {
    heading: "Tiivistelmä näistä ehdoista",
    paragraphs: [
      "myBestDays on markkinapaikka. Tarjoamme alustan, jolla palveluntarjoajat tarjoavat majoitustaan — itse majoitusta emme tuota. Majoitussopimus syntyy teidän ja palveluntarjoajan välille, ei meidän kanssamme.",
      "Ilmoituksessa näkemänne tiedot ovat peräisin palveluntarjoajalta: kuvaus, kuvat, varustelu, hinta, peruutusehdot ja järjestyssäännöt. Tarkastamme ilmoitukset, mutta emme voi vastata jokaisesta palveluntarjoajan antamasta tiedosta.",
      "Varausta viimeisteltäessä näkyvä hinta on varattujen palvelujen kokonaishinta. Määrät, jotka erääntyvät vasta paikan päällä (esimerkiksi matkailijamaksu tai vakuus), ilmoitamme erikseen etukäteen.",
      "Jos jokin menee pieleen, ottakaa ensin yhteyttä meihin. Kohdassa A15 kuvataan, miten teette valituksen ja mitkä väylät ovat sen jälkeen käytettävissänne.",
      "Tämä tiivistelmä selittää ehdot mutta ei korvaa niitä. Ratkaiseva on koko teksti.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Kaikki varaukset myBestDaysin kautta",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Määritelmät",
          paragraphs: [
            "Näissä ehdoissa käytetyt käsitteet selitetään asiakirjan lopussa olevassa sanastossa. Tärkeimmät ovat:",
          ],
          list: [
            "”Alusta” — verkkosivusto, mobiilisovellukset ja kaikki muut käyttöyhteydet, joiden kautta myBestDays esittää majoituksia ja välittää varauksia.",
            "”Palveluntarjoaja” — luonnollinen henkilö tai oikeushenkilö, joka tarjoaa majoitusta alustan kautta (isäntä, vuokranantaja, välitysliike, hotelli- tai majoitusliike).",
            "”Majoitus” — palveluntarjoajan tarjoama majoituspalvelu eli lomakohde tai huone- tai kohdetyypin yksikkö.",
            "”Varaus” — alustan kautta tehty majoituksen varaus tietylle ajanjaksolle.",
            "”Kokonaishinta” — varausta viimeisteltäessä ilmoitettu määrä, joka sisältää kaikki alustan kautta tilitettävät verot, maksut ja lisät.",
            "”Paikan päällä maksettavat kulut” — määrät, joita ei tilitetä alustan kautta vaan jotka maksetaan palveluntarjoajalle (esimerkiksi matkailijamaksu, vakuus, loppusiivous palveluntarjoajan valinnan mukaan).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. Näistä ehdoista",
          paragraphs: [
            "Nämä ehdot koskevat kaikkea alustan käyttöä riippumatta siitä, luotteko tilin ja syntyykö varaus.",
            "Kohta A koskee kaikkia varauksia. Kohta B sisältää majoituksia koskevat täydentävät säännöt. Ristiriitatilanteessa kohta B on ensisijainen.",
            "Itse majoituspalveluun sovelletaan lisäksi kyseisen palveluntarjoajan ehtoja (erityisesti järjestyssääntöjä ja peruutusehtoja), jotka on ilmoitettu ilmoituksessa. Nämä palveluntarjoajan ehdot täydentävät omiamme; ne eivät voi syrjäyttää ehtojamme siltä osin kuin on kyse suhteestanne meihin.",
            "Nämä ehdot ovat saatavilla kaikilla Euroopan unionin 24 virallisella kielellä. Kieliversioiden poiketessa toisistaan saksankielinen versio on ratkaiseva, ellei asuinvaltionne pakottava lainsäädäntö toisin määrää.",
            "Asuinvaltionne lainsäädännön mukaiset pakottavat kuluttajaoikeudet eivät rajoitu näiden ehtojen johdosta.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. Tietoa myBestDaysista",
          paragraphs: [
            "myBestDays on lomamajoitusten ja majoitusliikkeiden verkkomarkkinapaikka. Ylläpidämme alustaa, jolla palveluntarjoajat esittelevät majoitustaan ja vieraat voivat varata sen.",
            "Olemme välittäjä, emme majoituksen tarjoaja. Emme omista, ylläpidä, hallinnoi emmekä valvo mitään alustalla tarjottavaa majoitusta emmekä ole majoitussopimuksen osapuoli.",
            "myBestDays on digitaalisia palveluja koskevan asetuksen (EU) 2022/2065 mukainen välityspalvelu. Kyseisen asetuksen mukaiset tietomme ja menettelymme löytyvät kohdasta [Digipalvelusäädös](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays ei ole matkanjärjestäjä. Emme kokoa direktiivissä (EU) 2015/2302 tarkoitettuja matkapaketteja; yhdistetyistä matkajärjestelyistä ks. A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Alustamme",
          paragraphs: [
            "Ilmoituksen sisältö — kuvaus, kuvat, varustelu, majoituskapasiteetin rajat, hinnat, saatavuus, peruutusehdot ja järjestyssäännöt — on peräisin kyseiseltä palveluntarjoajalta. Hän vastaa niiden oikeellisuudesta ja täydellisyydestä.",
            "Tarkastamme ilmoitukset ennen julkaisua ja jatkuvasti [Asianmukaista sisältöä koskevien sääntöjen](https://mybestdays.dk/rechtliches/inhaltsrichtlinien) ilmeisten rikkomusten varalta. Yleistä velvollisuutta valvoa kaikkea sisältöä ei ole, eikä se olisi asetuksen (EU) 2022/2065 8 artiklan mukaan sallittuakaan.",
            "Miten järjestämme hakutulokset ja mitkä tekijät määräävät järjestyksen, selitetään kohdassa [Hinnat, järjestys ja suositukset](https://mybestdays.dk/rechtliches/preisangaben).",
            "Pyrimme jatkuvasti saatavilla olevaan alustaan, mutta emme takaa keskeytymätöntä saatavuutta. Huoltotyöt, häiriöt ja muutokset ovat mahdollisia.",
            "Palveluntarjoajien sisältöjen käännökset voivat olla konekäännöksiä. Ratkaiseva on palveluntarjoajan syöttämä alkuperäinen versio.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Arvomme",
          paragraphs: [
            "Odotamme vierailta ja palveluntarjoajilta kunnioittavaa kanssakäymistä. Syrjintää alkuperän, ihonvärin, uskonnon, vakaumuksen, sukupuolen, sukupuoli-identiteetin, seksuaalisen suuntautumisen, vamman, iän tai vastaavien ominaisuuksien perusteella ei suvaita alustalla — ks. [Syrjinnän vastainen periaate](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Oleskelun aikaiseen käyttäytymiseen sovelletaan [Vieraiden perussääntöjä](https://mybestdays.dk/rechtliches/grundregeln-gaeste) ja palveluntarjoajiin [Palveluntarjoajien menettelyohjeita](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Tilinne ja alustan käyttö",
          paragraphs: [
            "Varausta varten voitte luoda tilin. Vastaatte tunnustenne luottamuksellisuudesta ja ilmoitatte meille viipymättä, jos epäilette luvatonta käyttöä.",
            "Voitte käyttää alustaa vain, jos olette oikeustoimikelpoinen ja voitte tehdä päteviä sopimuksia.",
            "Rekisteröinnissä ja varauksessa antamienne tietojen on oltava oikeita ja täydellisiä — erityisesti nimi, yhteystiedot ja matkustajien lukumäärä. Palveluntarjoaja tarvitsee näitä tietoja majoituksen tarjoamiseen ja ilmoitusvelvollisuuksiensa täyttämiseen.",
            "Kiellettyä on erityisesti:",
          ],
          list: [
            "valevaraukset, vilpilliset maksut tai toisen maksuvälineiden käyttö ilman oikeutta;",
            "alustan automatisoitu lukeminen (scraping, indeksointirobotit) laajemmin kuin robots.txt-tiedostomme sallii;",
            "toimet, jotka häiritsevät tai ylikuormittavat alustaa tai sen infrastruktuuria taikka kiertävät sen turvatoimia;",
            "lainvastaisen, loukkaavan tai harhaanjohtavan sisällön julkaiseminen arvosteluissa, viesteissä tai profiilitiedoissa;",
            "yritys hoitaa varaus alustan ohi sen jälkeen, kun yhteys on syntynyt sen kautta — ks. [Alustan ulkopuoliset maksut](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Hinnat",
          paragraphs: [
            "Kaikki hinnat esitetään kokonaishintana, joka sisältää verot ja kaikki alustan kautta tilitettävät maksut, heti kun matkatiedot (ajanjakso ja matkustajien lukumäärä) ovat selvillä. Jos jokin osa erääntyy vasta paikan päällä, ilmoitamme sen erikseen ennen varauksen viimeistelyä.",
            "Hinnat esitetään ilmoituksen valuutassa. Jos määrä esitetään lisäksi toisessa valuutassa, kyseessä on sitoumukseton suuntaa antava muunnos; tilitys tapahtuu ilmoituksen valuutassa, ellei maksuvaiheessa muuta ilmoiteta.",
            "Hinnat voivat muuttua varauksen viimeistelyyn saakka, esimerkiksi koska palveluntarjoaja muuttaa niitä tai saatavuus muuttuu. Ratkaiseva on hinta, joka näytetään teille välittömästi ennen sitovaa varausta ja joka mainitaan varausvahvistuksessa.",
            "Ilmeiset hintavirheet (esimerkiksi kertaluokkaa väärä summa) eivät sido meitä eivätkä palveluntarjoajaa. Jos havaitsemme tällaisen virheen, ilmoitamme siitä viipymättä; voitte tällöin peruuttaa varauksen maksutta.",
            "Palvelumaksujen muodostuminen selitetään kohdassa [Palvelumaksut](https://mybestdays.dk/rechtliches/servicegebuehren). Veroista ja maksuista ks. [Veropolitiikka](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Maksaminen",
          paragraphs: [
            "Alustan kautta suoritettavat maksut käsittelee maksupalveluntarjoaja Stripe. Maksutiedot (esimerkiksi korttitiedot) kerää ja käsittelee suoraan Stripe; myBestDays ei tallenna täydellisiä korttitietoja.",
            "Milloin mikäkin määrä erääntyy — ennakkomaksu, loppumaksu vai maksu paikan päällä — riippuu ilmoituksesta ja näytetään ennen varauksen viimeistelyä. Yksityiskohdat määräytyvät [Maksuehtojen](https://mybestdays.dk/rechtliches/zahlungsbedingungen) mukaan.",
            "Jos ilmoituksessa mainitaan vakuus, se voidaan esiautorisoida tai veloittaa ja pitää vahinkotapauksessa kokonaan tai osittain. Ratkaisevia ovat ilmoituksen tiedot.",
            "Jos maksu epäonnistuu tai se peruutetaan takaisinveloituksella, varaus voidaan peruuttaa. Palveluntarjoaja voi edelleen vaatia peruutusehtojensa mukaisia määriä.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Periaatteet",
          paragraphs: [
            "Näiden ehtojen lisäksi sovelletaan seuraavia periaatteita, jotka ovat osa teidän ja meidän välistä sopimusta:",
          ],
          list: [
            "[Asianmukaista sisältöä koskevat säännöt](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Arvostelukäytäntö](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Syrjinnän vastainen periaate](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Vieraiden perussäännöt](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Peruutusehdot](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Uudelleenmajoitus- ja hyvityskäytäntö](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Vakavia häiriöitä koskeva käytäntö](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Tekijänoikeuskäytäntö](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Tietosuoja ja evästeet",
          paragraphs: [
            "Miten käsittelemme henkilötietoja, selviää [Tietosuojaselosteesta](https://mybestdays.dk/rechtliches/datenschutz). Käyttämämme evästeet ja vastaavat tekniikat selviävät [Evästekäytännöstä](https://mybestdays.dk/rechtliches/cookies).",
            "Varausta varten luovutamme palveluntarjoajalle tiedot, joita hän tarvitsee majoituspalvelun tuottamiseen. Palveluntarjoaja on tältä osin itsenäinen rekisterinpitäjä; häneen sovelletaan [Isäntien tietosuojastandardeja](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Saavutettavuus",
          paragraphs: [
            "Alustan saavutettavuuden tilaa ja esteiden ilmoittamista kuvaa [Saavutettavuusseloste](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Tiedot majoituksen esteettömyydestä ovat peräisin palveluntarjoajalta. Jos olette riippuvainen tietyistä ominaisuuksista, selvittäkää ne palveluntarjoajan kanssa viestitoiminnon kautta ennen varausta.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Arvostelut ja käyttäjien tuottama sisältö",
          paragraphs: [
            "Oleskelun jälkeen voitte jättää arvostelun. Arvostelun voi jättää vain se, joka on varannut alustan kautta ja jonka oleskelu on alkanut tai olisi voinut alkaa — näin varmistamme, että julkaistut arvostelut ovat todellisilta vierailta.",
            "Emme maksa arvosteluista, emme muuta niiden sisältöä emmekä poista arvostelua pelkästään siksi, että se on kielteinen. Yksityiskohdat ja perusteet arvostelun poistamiselle selviävät [Arvostelukäytännöstä](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "Vastaatte edelleen julkaisemastanne sisällöstä — arvosteluista, kuvista, viesteistä, profiilitiedoista. Myönnätte meille yksinkertaisen, alueellisesti ja ajallisesti rajoittamattoman, vastikkeettoman oikeuden kopioida, muokata (esimerkiksi rajata, kääntää) ja saattaa yleisön saataviin tämän sisällön alustan ylläpidon ja markkinoinnin yhteydessä. Voitte poistaa sisältönne; jo julkaistuissa kokoelmissa tehdyt käytöt eivät tästä muutu.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Viestit ja yhteydenpito palveluntarjoajaan",
          paragraphs: [
            "Viestit teidän ja palveluntarjoajan välillä kulkevat alustan kautta. Tarjoamme viestitoiminnon mutta emme ole sisällön lähettäjä emmekä vastaanottaja.",
            "Saamme tarkastaa viestit automatisoidusti näiden ehtojen rikkomusten varalta (esimerkiksi alustan kiertämiseen tähtäävät yhteystiedot, petoskuviot, lainvastainen sisältö) sekä pidättää tai poistaa kyseiset viestit. Poistamisesta ilmoitamme teille perusteluineen kohdan A17 mukaisesti.",
            "Lähetämme teille varaustanne koskevia viestejä (vahvistus, muutokset, saapumistiedot) ilmoittamaanne sähköpostiosoitteeseen. Nämä viestit ovat sopimusviestintää eikä niitä voi perua niin kauan kuin varaus on voimassa. Markkinointiviestejä saatte vain, jos olette antanut suostumuksenne tai laki sen ilman suostumusta sallii; voitte vastustaa niitä milloin tahansa.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Immateriaalioikeudet",
          paragraphs: [
            "Alusta, sen ulkoasu, ohjelmisto, tietokannat, tekstit ja tavaramerkit ovat suojattuja. Saatte yksinkertaisen, siirtokelvottoman oikeuden käyttää alustaa majoituksen hakemiseen ja varaamiseen — ette enempää.",
            "Tavaramerkkiemme ja logojemme käyttöä säätelevät [Tavaramerkkiohjeet](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Jos katsotte alustan sisällön loukkaavan tekijänoikeuttanne, noudattakaa [Tekijänoikeuskäytäntöä](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Mitä tehdä, jos jokin menee pieleen",
          paragraphs: [
            "Jos ongelma koskee itse majoitusta, kääntykää ensin palveluntarjoajan puoleen — viestitoiminnon kautta tai paikan päällä. Monet ongelmat ratkeavat näin nopeimmin.",
            "Jos ette pääse palveluntarjoajan kanssa eteenpäin tai ongelma koskee alustaa, maksua tai varauksen käsittelyä, kääntykää meidän puoleemme. Miten tavoitatte meidät ja miten käsittelemme valitukset, selviää kohdasta [Valitukset ja riidanratkaisu](https://mybestdays.dk/rechtliches/beschwerden).",
            "Pitäkää valmiina: varausnumeronne, varauksen sähköpostiosoite, lyhyt kuvaus ongelmasta ja toiveenne siitä, miten meidän tulisi auttaa, sekä asiaan liittyvät todisteet (kuvat, viestit, kuitit).",
            "Jos majoitus ei ole saapuessa käytettävissä tai poikkeaa olennaisesti ilmoituksesta, sovelletaan [Uudelleenmajoitus- ja hyvityskäytäntöä](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Euroopan komission verkkovälitteisen riidanratkaisun foorumi (ODR-foorumi) on kumottu asetuksella (EU) 2024/3228 ja lopettanut toimintansa; se ei ole enää käytettävissä. Sen tilalle tulevat elimet mainitaan kohdassa [Valitukset ja riidanratkaisu](https://mybestdays.dk/rechtliches/beschwerden).",
            "Jos olemme kohdistaneet toimenpiteen sisältöönne tai tiliinne, voitte sisäisen valitusmenettelymme ohella saattaa asian asetuksen (EU) 2022/2065 21 artiklan mukaisesti sertifioidun tuomioistuimen ulkopuolisen riidanratkaisuelimen käsiteltäväksi. Sen päätökset eivät sido meitä.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Toimenpiteet epäasiallista käyttäytymistä vastaan",
          paragraphs: [
            "Jos rikotte näitä ehtoja tai jotakin kohdassa A9 mainittua periaatetta, voimme — rikkomuksen vakavuuden, toistuvuuden ja vaikutusten mukaan porrastetusti — poistaa sisältöä tai rajoittaa sen näkyvyyttä, estää toimintoja, peruuttaa varauksia tai sulkea tilinne väliaikaisesti tai pysyvästi.",
            "Ennen toimenpidettä arvioimme yksittäistapauksen. Ilmeisen lainvastaisen sisällön, henkilöihin kohdistuvan vaaran tai petoksen kyseessä ollessa voimme toimia välittömästi.",
            "Perustelemme jokaisen toimenpiteen teille ja kerromme valitusväylän — ks. A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Lainvastaisen sisällön ilmoittaminen ja toimenpiteiden perustelu",
          paragraphs: [
            "Kuka tahansa voi ilmoittaa meille sisällöstä, jota pitää lainvastaisena. Asetuksen (EU) 2022/2065 16 artiklan mukainen ilmoitusmenettely, yhteyspisteemme ja ilmoitusten käsittely kuvataan kohdassa [Digipalvelusäädös](https://mybestdays.dk/rechtliches/dsa).",
            "Jos kohdistamme toimenpiteen julkaisemaanne sisältöön tai tiliinne, saatte perustelut, joissa mainitaan peruste, tosiseikat, oikeusperusta tai rikottu sopimusmääräys sekä valitusmahdollisuudet.",
            "Jokaisesta toimenpiteestä voitte valittaa maksutta kuuden kuukauden kuluessa. Valitukset käsittelevät ihmiset, eivät pelkästään automaattiset järjestelmät.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Vastuunrajoitus",
          paragraphs: [
            "Vastaamme rajoituksetta tahallisuudesta ja törkeästä huolimattomuudesta, hengen, terveyden tai ruumiillisen koskemattomuuden loukkaamisesta aiheutuneista vahingoista sekä antamamme takuun laajuudessa. Tuotevastuuseen perustuvat vaatimukset eivät tästä rajoitu.",
            "Muilta osin vastuumme rajoittuu ennakoitavissa olevaan vahinkoon, joka tyypillisesti aiheutuu niiden velvoitteiden rikkomisesta, joiden täyttämiseen voitte luottaa — ja vain siltä osin kuin sovellettava laki sallii tällaisen rajoituksen.",
            "Emme vastaa itse majoituspalvelun tuottamisesta emmekä palveluntarjoajien tai muiden vieraiden käyttäytymisestä. Majoituspalvelun sopimuskumppani on palveluntarjoaja.",
            "Emme vastaa palveluntarjoajien julkaisemien tietojen oikeellisuudesta, ellemme ole tienneet niistä emmekä olisi pitänyt tietää. Saatuamme tiedon lainvastaisesta tiedosta toimimme viipymättä.",
            "Kaikki laajempi vastuu on suljettu pois. Pakottavat lakisääteiset vaatimukset, erityisesti kuluttajaoikeudet, eivät rajoitu.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Sovellettava laki ja toimivaltainen tuomioistuin",
          paragraphs: [
            "Sovelletaan Tanskan lakia — ylläpitäjä on sijoittautunut Tanskaan — pois lukien YK:n kauppalaki. Sen valtion pakottavat kuluttajansuojasäännökset, jossa teillä on vakinainen asuinpaikka, eivät rajoitu asetuksen (EY) N:o 593/2008 (Rooma I) 6 artiklan mukaisesti.",
            "Kuluttajana voitte haastaa meidät asuinpaikkanne tuomioistuimeen tai kotipaikkamme tuomioistuimeen Tanskassa; me voimme haastaa teidät vain asuinpaikkanne tuomioistuimeen (asetuksen (EU) N:o 1215/2012 17–19 artikla).",
            "Majoitussopimukseen sovelletaan pääsääntöisesti sen valtion lakia, jossa majoitus sijaitsee; kiinteän omaisuuden vuokraa koskevissa kanteissa kyseisen valtion tuomioistuimet ovat yksinomaisesti toimivaltaisia.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Yhdistetyt matkajärjestelyt",
          paragraphs: [
            "myBestDays välittää yksinomaan majoituspalveluja. Emme tarjoa lentoja, autovuokrausta, kuljetuspalveluja, retkiä emmekä nähtävyyksiä emmekä kokoa direktiivissä (EU) 2015/2302 tarkoitettuja matkapaketteja.",
            "Jos välittäisimme vastaisuudessa muita matkapalveluja, ilmoittaisimme teille ennen varausta lakisääteisellä vakiolomakkeella, syntyykö matkapaketti vai yhdistetty matkajärjestely ja mitä oikeuksia teillä on.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Voimassaolo, sulkeminen ja irtisanominen",
          paragraphs: [
            "Alustan käyttöä koskeva sopimus on voimassa toistaiseksi. Voitte poistaa tilinne milloin tahansa syytä ilmoittamatta; voimassa olevat varaukset eivät tästä muutu, ja ne hoidetaan kyseisen palveluntarjoajan ehtojen mukaisesti.",
            "Voimme irtisanoa käyttösopimuksen 14 päivän irtisanomisajalla. Näiden ehtojen vakavan rikkomisen johdosta voimme purkaa sopimuksen välittömästi ja sulkea tilin.",
            "Päättymisen jälkeen poistamme tietonne, ellei lakisääteinen säilytysvelvollisuus tai oikeutettu etu säilyttämiseen ole esteenä; yksityiskohdat kuvataan [Tietosuojaselosteessa](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Muutoslauseke",
          paragraphs: [
            "Voimme muuttaa näitä ehtoja, kun siihen on asiallinen syy — esimerkiksi muuttunut oikeustila, ylimpien tuomioistuinten oikeuskäytäntö, alustan uudet tai poistuvat toiminnot tai sääntelyaukkojen täyttäminen.",
            "Ilmoitamme muutoksista vähintään 30 päivää ennen voimaantuloa kirjallisesti. Jos ette vastusta niitä ennen voimaantuloa, muutetut ehdot katsotaan hyväksytyiksi; tästä vaikutuksesta huomautamme erikseen ilmoituksessa. Jos vastustatte, voimme irtisanoa käyttösopimuksen voimaantulohetkeen.",
            "Jo tehtyihin varauksiin sovelletaan ehtoja siinä muodossa, joka oli voimassa varaushetkellä.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Majoitukset",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Tämän kohdan soveltamisala",
          paragraphs: [
            "Tämä kohta koskee majoitusten varaamista alustan kautta — sekä lomakohteita että majoitusliikkeiden huoneita ja yksiköitä.",
            "Se täydentää kohtaa A. Ristiriitatilanteessa tämä kohta B on ensisijainen.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Sopimussuhde",
          paragraphs: [
            "Majoitussopimus syntyy yksinomaan teidän ja palveluntarjoajan välille. myBestDays ei ole sopimusosapuoli.",
            "Majoituksen esittäminen alustalla on kehotus tehdä varaustarjous. Klikkaamalla maksullista varauspainiketta teette sitovan tarjouksen.",
            "Sopimus syntyy, kun varaus vahvistetaan. Lähetämme varausvahvistuksen ilmoittamaanne sähköpostiosoitteeseen; siinä mainitaan palveluntarjoaja, varattu palvelu, ajanjakso, kokonaishinta ja peruutusehdot.",
            "Kyselyvarauksena tarjottavissa majoituksissa sopimus syntyy vasta palveluntarjoajan hyväksynnällä. Siihen asti maksuvälineenne voidaan esiautorisoida mutta ei veloittaa.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Mitä me teemme",
          paragraphs: [
            "Tarjoamme alustan, esitämme palveluntarjoajien ilmoitukset, vastaanotamme varauksenne, välitämme sen palveluntarjoajalle ja lähetämme teille varausvahvistuksen.",
            "Käsittelemme maksun siltä osin kuin ilmoitus edellyttää maksua alustan kautta, ja tarjoamme viestitoiminnon teidän ja palveluntarjoajan välille.",
            "Emme tarjoa majoitusta emmekä ylläpidä sitä emmekä vastaa sen kunnosta. Emme ole matkanjärjestäjänne.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Mitä teidän on tehtävä",
          paragraphs: [
            "Tarkistakaa ilmoitus kokonaan ennen varausta: varustelu, majoituskapasiteetin raja, saapumis- ja lähtöajat, järjestyssäännöt, peruutusehdot ja vasta paikan päällä erääntyvät kulut.",
            "Noudattakaa ilmoituksessa mainittua enimmäishenkilömäärää. Jos paikalle saapuu enemmän henkilöitä kuin on varattu, palveluntarjoaja voi evätä pääsyn tai vaatia lisämaksun.",
            "Noudattakaa palveluntarjoajan järjestyssääntöjä ja [Vieraiden perussääntöjä](https://mybestdays.dk/rechtliches/grundregeln-gaeste). Käsittelette majoitusta huolellisesti ja vastaatte vahingoista, jotka te tai matkaseurueenne aiheutatte.",
            "Jos palveluntarjoaja tai viranomainen tarvitsee tietoja ilmoittautumista varten (esimerkiksi matkustajailmoitus, henkilöllisyystiedot, matkailijamaksuilmoitus), antakaa ne ajoissa.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Hinnat ja maksaminen",
          paragraphs: [
            "Kokonaishinta kattaa varatun ajanjakson majoitushinnan sekä ilmoituksessa mainitut lisät ja maksut, jotka tilitetään alustan kautta.",
            "Paikan päällä voi erääntyä lisämääriä — erityisesti matkailijamaksu tai paikalliset maksut, vakuus sekä lisäpalvelut, jotka varaatte vasta paikan päällä. Ilmoitamme ne paikan päällä maksettavina kuluina ennen varauksen viimeistelyä siltä osin kuin palveluntarjoaja on ne ilmoittanut.",
            "Jos ilmoitus edellyttää ennakkomaksua, loppusumma erääntyy ilmoituksessa mainittuna ajankohtana. Jos loppumaksu jää suorittamatta, palveluntarjoaja voi peruutusehtojensa mukaisesti purkaa sopimuksen.",
            "Emme ota vastaan emmekä voi jäljittää palveluntarjoajalle alustan ulkopuolella suoritettuja maksuja; ne eivät kuulu maksujenkäsittelyymme — ks. [Alustan ulkopuoliset maksut](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Muutokset, peruutukset ja hyvitykset",
          paragraphs: [
            "Voidaanko varaus peruuttaa tai muuttaa maksutta ja millä ehdoin, määräytyy ilmoituksessa mainittujen palveluntarjoajan peruutusehtojen mukaan. Palveluntarjoajille tarjoamamme ehdot kuvataan kohdassa [Peruutusehdot](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "Tietylle ajanjaksolle varattavissa majoituspalveluissa ei pääsääntöisesti ole direktiivin 2011/83/EU 16 artiklan l alakohdan tai vastaavien kansallisten säännösten mukaista lakisääteistä peruuttamisoikeutta. Pakottavat lakisääteiset oikeudet eivät rajoitu.",
            "Jos palveluntarjoaja peruuttaa, hyvitämme alustan kautta maksetun määrän kokonaan. Lisäksi sovelletaan [Uudelleenmajoitus- ja hyvityskäytäntöä](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Jos molempien osapuolten vaikutusmahdollisuuksien ulkopuolinen tapahtuma estää matkan tai oleskelun, sovelletaan [Vakavia häiriöitä koskevaa käytäntöä](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "Hyvitykset suoritetaan maksuun käytetylle maksuvälineelle, ellei toisin ole sovittu.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Mitä teidän on lisäksi tiedettävä",
          paragraphs: [
            "Palveluntarjoajat voivat olla yksityisiä isäntiä tai elinkeinonharjoittajia. Ilmoitamme ilmoituksessa, toimiiko palveluntarjoaja elinkeinonharjoittajana. Jos kyse ei ole elinkeinonharjoittajasta, unionin kuluttajansuojasäännöksiä ei sovelleta majoitussopimukseen — huomautamme tästä ilmoituksessa.",
            "Sijaintia, ympäristöä, etäisyyksiä ja kolmansien arvioita koskevat tiedot ovat suuntaa antavia. Sitovia ovat itse varattua palvelua koskevat tiedot.",
            "Alueilla, joilla lyhytaikaisvuokraus on rekisteröintivelvollista, ilmoitamme ilmoituksessa palveluntarjoajan antaman rekisteröintinumeron; ks. [Lyhytaikaisvuokraus](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Jos samasta kohde- tai huonetyypistä on useita samanlaisia yksiköitä, varaatte yhden kyseisen tyypin yksikön. Minkä konkreettisen yksikön saatte, määrää palveluntarjoaja.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Sanasto",
      paragraphs: [
        "Seuraavilla käsitteillä on näissä ehdoissa tässä mainittu merkitys.",
      ],
      definitions: [
        {
          term: "Palveluntarjoaja",
          description:
            "Luonnollinen henkilö tai oikeushenkilö, joka tarjoaa majoitusta alustan kautta ja josta tulee majoitussopimuksen sopimuskumppani.",
        },
        {
          term: "Kyselyvaraus",
          description:
            "Varaus, joka syntyy vasta palveluntarjoajan nimenomaisella hyväksynnällä, toisin kuin pikavaraus.",
        },
        {
          term: "Varausvahvistus",
          description:
            "Viesti, jolla vahvistamme teille majoitussopimuksen syntymisen; se sisältää palveluntarjoajan, palvelun, ajanjakson, kokonaishinnan ja peruutusehdot.",
        },
        {
          term: "Yksikkö",
          description:
            "Konkreettinen varattava kohde kohde- tai huonetyypin alla. Myydään yksikkö, kuvataan ja hinnoitellaan tyyppi.",
        },
        {
          term: "Kokonaishinta",
          description:
            "Varausta viimeisteltäessä ilmoitettu määrä, joka sisältää kaikki verot ja kaikki alustan kautta tilitettävät maksut.",
        },
        {
          term: "Enimmäishenkilömäärä",
          description:
            "Ilmoituksessa mainittu suurin sallittu henkilömäärä, joka saa yöpyä majoituksessa.",
        },
        {
          term: "Vakuus",
          description:
            "Määrä, jota palveluntarjoaja vaatii vakuudeksi vahingoista ja joka esiautorisoidaan tai veloitetaan ja vapautetaan tai kuitataan oleskelun jälkeen.",
        },
        {
          term: "Matkailijamaksu",
          description:
            "Yöpymisiin kohdistuva paikallinen maksu, joka kunnasta riippuen peritään paikan päällä tai palveluntarjoajan kautta; se ei ole myBestDaysin suorite.",
        },
        {
          term: "Alusta",
          description:
            "Verkkosivusto, mobiilisovellukset ja kaikki muut käyttöyhteydet, joiden kautta myBestDays esittää majoituksia ja välittää varauksia.",
        },
        {
          term: "Palvelumaksu",
          description:
            "Korvaus myBestDaysin välityspalvelusta. Kuka sen maksaa ja miten se ilmoitetaan, selviää Palvelumaksuista.",
        },
        {
          term: "Peruutusehdot",
          description:
            "Palveluntarjoajan valitsemat säännöt siitä, mihin asti ja millä kustannuksella varauksen voi peruuttaa tai muuttaa.",
        },
        {
          term: "Majoitus",
          description:
            "Palveluntarjoajan tarjoama majoituspalvelu — lomakohde tai huone- tai kohdetyypin yksikkö.",
        },
        {
          term: "Paikan päällä maksettavat kulut",
          description:
            "Määrät, joita ei tilitetä alustan kautta vaan jotka maksetaan palveluntarjoajalle, kuten matkailijamaksu, vakuus tai paikan päällä varatut lisäpalvelut.",
        },
      ],
    },
  ],
};
