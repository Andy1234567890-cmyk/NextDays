// Finnische Übersetzung von `de.ts` (Datenschutzerklärung).
//
// Inhaltliche Änderungen gehören ZUERST in `de.ts` und werden von dort
// nachgezogen — hier wird ausschließlich übersetzt. Struktur (Abschnitte,
// Reihenfolge, Anzahl der Absätze und Listenpunkte) ist mit `de.ts`
// deckungsgleich zu halten.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Tietosuojaseloste",
  metaDescription:
    "Miten myNextDays käsittelee henkilötietoja: käsittelyn tarkoitukset, oikeusperusteet, vastaanottajat, säilytysajat ja oikeutesi yleisen tietosuoja-asetuksen mukaan.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Tässä selosteessa kuvataan, miten ${ANBIETER.firma} käsittelee henkilötietoja — kun vierailet tällä verkkosivustolla, kun käytät myNextDays-alustaa (hallintapaneeli, markkinapaikka ja mobiilisovellus) ja asiakkaidemme kanssa solmitun liikesuhteen puitteissa.`,
    "Emme myy tietoja emmekä luo profiileja, jotka tunnistavat sinut henkilökohtaisesti. Tällä verkkosivustolla mittaamme – vain suostumuksellasi – sivujemme kattavuutta ja mainontamme menestystä; molemmat kategoriat ovat erikseen poistettavissa (katso osiot Kävijämittaus sekä Mainonta ja menestyksen mittaus). Käytämme tietojasi markkinointitarkoituksiin vain, jos olet antanut siihen nimenomaisen suostumuksesi – esimerkiksi uutiskirjeemme tilaamiseen (katso kohta Viestintä), jonka voit peruuttaa milloin tahansa yhdellä napsautuksella.",
  ],
  sections: [
    {
      heading: "Rekisterinpitäjä",
      paragraphs: ["Tässä selosteessa kuvatusta käsittelystä vastaa:"],
      zeilen: [
        {
          label: "Yritys",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Osoite",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Sähköposti",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Puhelin",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Soveltamisala ja roolit",
      unterpunkte: [
        {
          paragraphs: [
            "Tällä verkkosivustolla vierailun, asiakastilisi sekä liikesuhteemme hoitamisen osalta olemme yleisen tietosuoja-asetuksen 4 artiklan 7 alakohdassa tarkoitettu rekisterinpitäjä.",
          ],
        },
        {
          paragraphs: [
            "Niiden tietojen osalta, joita asiakkaamme (vuokranantajat, hotellit, välitystoimistot) käsittelevät alustalla vieraistaan, omistajistaan ja työntekijöistään, asiakkaat ovat rekisterinpitäjiä ja me olemme yleisen tietosuoja-asetuksen 28 artiklassa tarkoitettu henkilötietojen käsittelijä. Yksityiskohdat ilmenevät [henkilötietojen käsittelyä koskevasta sopimuksesta](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Jos varaat vieraana majoituksen markkinapaikkamme kautta, käsittelemme varaus- ja yhteystietojasi sekä omissa nimissämme (markkinapaikan ylläpito, maksujen käsittely) että majoituksen tarjoavan yrityksen puolesta. Majoitussopimuksesi syntyy yksinomaan kyseisen yrityksen kanssa; sen tietosuojatiedot ovat voimassa tämän rinnalla.",
          ],
        },
      ],
    },
    {
      heading: "Vierailu tällä verkkosivustolla",
      unterpunkte: [
        {
          titel: "Palvelimen lokitiedot",
          paragraphs: [
            "Jokaisen sivunlatauksen yhteydessä selaimesi lähettää teknisesti välttämättömiä tietoja, jotka verkkopalvelimemme kirjaa lokiin: IP-osoite, päivämäärä ja kellonaika, kutsuttu osoite, siirretyn datan määrä, tilakoodi, viittaava sivu (referrer) ja selaintunniste. Tarkoituksena on sivun toimittaminen sekä hyökkäysten ja häiriöiden havaitseminen ja torjunta. Oikeusperuste on yleisen tietosuoja-asetuksen 6 artiklan 1 kohdan f alakohta; oikeutettu etumme on turvallinen ja vakaa toiminta. Lokitietoja säilytetään vain niin kauan kuin se on toiminnan ja tietoturvan kannalta tarpeellista, eikä niitä yhdistetä muihin tietoihin.",
          ],
        },
        {
          titel: "Kirjasintyypit",
          paragraphs: [
            "Käytetyt kirjasintyypit on liitetty paikallisesti omalle palvelimellemme. Yhteyttä Google Fonts -palveluun tai muuhun kirjasinpalveluun ei muodosteta.",
          ],
        },
        {
          titel: "Kuvakkeet",
          paragraphs: [
            "Tämän verkkosivuston kuvakkeet ovat kirjasintyyppien tavoin meillä: ne asetetaan sivulle omalla palvelimellamme, eikä niitä ladata erikseen kuvakepalvelusta. Yhteyttä kolmanteen osapuoleen ei tällöin muodosteta, eikä IP-osoitettasi välitetä kenellekään.",
          ],
        },
        {
          titel: "Yhteydenottolomakkeen roskapostisuoja (reCAPTCHA)",
          paragraphs: [
            "Yhteydenottolomakkeemme on suojattu automatisoituja massaviestejä vastaan Google Ireland Limitedin reCAPTCHA Enterprise -palvelulla. Vain jos annat siihen suostumuksesi, selaimesi lataa lomakkeen täyttämisen yhteydessä komentosarjan osoitteesta www.google.com; tällöin IP-osoitteesi ja tiedot vuorovaikutuksestasi lomakkeen kanssa välitetään Googlelle ja analysoidaan siellä ihmisen ja komentosarjan erottamiseksi. Oikeusperuste on yleisen tietosuoja-asetuksen 6 artiklan 1 kohdan a alakohta (suostumus); tätä täydentäen sovelletaan [Googlen tietosuojaselostetta](https://policies.google.com/privacy).",
            "Ilman suostumustasi Googlelta ei ladata mitään eikä sinne siirry tietoja; emme hyväksy lomaketta, mutta voit lähettää meille sähköpostia milloin tahansa. Jos annat suostumuksesi, reCAPTCHA asettaa oman evästeen (_GRECAPTCHA, Googlen määrittämä voimassaoloaika, enintään kuusi kuukautta), jota käytetään riskinarviointiin. Voit muuttaa tai peruuttaa suostumuksesi milloin tahansa napsauttamalla evästekuvaketta kunkin sivun vasemmassa alakulmassa; eväste poistetaan silloin.",
          ],
        },
        {
          titel: "Kattavuuden mittaus (Google Analytics)",
          paragraphs: [
            "Tällä verkkosivustolla mittaamme Google Ireland Limitedin Google Analytics 4:n avulla, miten sivujamme käytetään – mitä sivuja avataan, mistä kävijät tulevat ja missä vaiheessa he poistuvat. Tarkoituksena on ainoastaan tarjonnan ja löydettävyyden parantaminen.",
            "Lataus tapahtuu ainoastaan suostumuksellasi. Jos annat suostumuksesi, selaimesi lataa skriptin osoitteesta www.googletagmanager.com ja tallentaa kaksi evästettä („_ga“ ja „_ga_<tunnus>“, voimassaoloaika enintään kaksi vuotta) satunnaisesti luodulla tunnuksella; nämä tunnukset, avatut sivut, viittauslähde, likimääräinen sijainti maa- tai aluetasolla, laite ja selain sekä IP-osoitteesi, jonka Google lyhentää ennen tallennusta, välitetään. Oikeusperusta on GDPR:n 6 artiklan 1 kohdan a alakohta (suostumus).",
            "Olemme rajoittaneet arviointia nimenomaisesti: Google-signaalit ja mainosten personointi on kytketty pois päältä. Siksi emme luo laitteiden välisiä profiileja tai kohderyhmiä mainontaa varten, emmekä jaa käyttötietoja mainosverkostoille. Tietojen yhdistämistä asiakastiliisi ei tapahdu.",
            "Google käsittelee tietoja toimeksiannostamme GDPR:n 28 artiklan mukaisen sopimuksen perusteella (Google Ads Data Processing Terms). IP-osoitteesi lyhennetään EU:n palvelimilla ennen tietojen siirtoa Yhdysvaltoihin; siten siirretään pseudonymisoitu tietue. Siirron perusteena on EU-komission riittävyyspäätös EU-US Data Privacy Framework -järjestelmästä (GDPR:n 45 artikla), jonka mukaisesti Google LLC on sertifioitu; lisäksi Google on sisällyttänyt EU-komission vakiolausekkeet (GDPR:n 46 artikla). Huomautamme nimenomaisesti, että Yhdysvaltain viranomaiset voivat FISA:n 702 pykälän nojalla päästä käsiksi myös sertifioitujen yritysten tietoihin, eikä jäännösriskiä voida siksi täysin poissulkea. Lisäksi sovelletaan [Googlen tietosuojakäytäntöä](https://policies.google.com/privacy).",
            "Tallennusaika: Tapahtuma- ja käyttäjäkohtaiset tiedot poistetaan automaattisesti omaisuudestamme 14 kuukauden kuluttua; kootut raporttitiedot ilman yksittäisiin kävijöihin liittyvää viittausta säilyvät pidempään. Suostumuksesi itsessään vanhenee kuuden kuukauden kuluttua.",
            "Ilman suostumustasi mitään ei ladata, evästeitä ei aseteta eikä tietoja siirry Googlelle. Voitte peruuttaa suostumuksenne milloin tahansa vasemmassa alakulmassa olevasta evästekuvakkeesta jokaisella sivulla; mittaus päättyy välittömästi ja mainitut evästeet poistetaan. Kuuden kuukauden kuluttua kysymme uudelleen.",
          ],
        },
        {
          titel: "Mainonta ja tulosten mittaaminen",
          paragraphs: [
            "Suostumuksellasi käytämme markkinointievästeitä mainontamme tehokkuuden mittaamiseen ja sopivien mainosten näyttämiseen muilla alustoilla. Mukana ovat Meta Platforms Ireland (Meta-pikseli, eväste _fbp), LinkedIn Ireland (Insight-tag, evästeet li_gc ja bcookie) ja Google Ireland Limited (Google Ads, eväste _gcl_au). Oikeusperuste on GDPR:n 6 artiklan 1 kohdan a alakohta. Ilman suostumustasi näitä skriptejä ei ladata eikä evästeitä aseteta; peruutuksen yhteydessä poistamme ne. Lisätietoja jokaisesta evästeestä on [evästekäytännössä](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Asiakastili ja alustan käyttö",
      paragraphs: [
        "Tilin rekisteröintiä ja ylläpitoa varten käsittelemme tietoja, jotka sinä tai yrityksesi syötätte: nimi, toiminimi ja yhtiömuoto, osoite, sähköpostiosoite, puhelinnumero, rooli ja käyttöoikeudet, rekisteritiedot (esim. kaupparekisteri- tai arvonlisäveronumero), tilitysten pankkiyhteys sekä tilille luodut sisällöt.",
        "Pääsyn turvaamiseksi käsittelemme lisäksi kirjautumislokeja (kirjautumisen ajankohta, IP-osoite, laite ja selain) ja — jos se on otettu käyttöön — kaksivaiheisen tunnistautumisen tiedot.",
        "Kirjautuminen Google-tunnuksella: sähköpostin ja salasanan sijaan voit kirjautua myös Google-tilillä. Jos valitset tämän tavan, saamme Google Ireland Limitedilta yksinomaan sähköpostiosoitteesi, nimesi, profiilikuvasi ja Google-tilisi tunnisteen (alueet ”openid”, ”email”, ”profile”) — nimenomaisesti emme pääsyä sähköposteihisi, yhteystietoihisi, tiedostoihisi tai kalenteriisi. Google-salasanaasi emme saa tietää. Google käsittelee kirjautumistapahtuman omana rekisterinpitäjänä; siihen sovelletaan [Googlen tietosuojaselostetta](https://policies.google.com/privacy). Oikeusperuste on yleisen tietosuoja-asetuksen 6 artiklan 1 kohdan b alakohta, koska kirjautuminen palvelee sopimuksen täyttämistä; tämän kirjautumistavan valinta on vapaaehtoista ja korvattavissa milloin tahansa sähköpostilla ja salasanalla kirjautumisella.",
        "Oikeusperuste on yleisen tietosuoja-asetuksen 6 artiklan 1 kohdan b alakohta (käyttösopimuksen täyttäminen, ks. [käyttöehdot](" +
          AGB_URL +
          ")), pääsyn turvaamisen osalta 6 artiklan 1 kohdan f alakohta ja vero- ja kirjanpitolainsäädännön mukaisen säilytyksen osalta 6 artiklan 1 kohdan c alakohta.",
      ],
    },
    {
      heading: "Varaukset, vieras- ja kohdetiedot",
      paragraphs: [
        "Alustalla käsitellään varauksia, vierastietoja, viestejä, tehtäviä ja tilityksiä. Näihin kuuluvat erityisesti vieraan nimi ja yhteystiedot, saapumis- ja lähtöpäivä, matkustajien lukumäärä, hinnat ja maksun tila, viestihistoria sekä — mikäli yritys ne kirjaa — matkustajailmoitustiedot ja erityistoiveet.",
        "Tämä käsittely tapahtuu kyseisen yrityksen toimeksiannosta ja sen ohjeiden mukaisesti. Emme käytä näitä tietoja omiin tarkoituksiin, mainontaan emmekä tekoälymallien kouluttamiseen.",
        "Yrityksen sisällä tiedot on eroteltu roolien mukaan: siivous- ja palveluhenkilöstö ei näe talous- ja myyntitietoja, omistajat näkevät vain omat kohteensa. Eri yritysten tiedot on eroteltu teknisesti toisistaan (asiakaskohtaiset pääsysäännöt tietokannassa).",
      ],
    },
    {
      heading: "Maksujen käsittely",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Korttimaksut ja tilitykset kulkevat Stripe Payments Europe, Limitedin (Irlanti) kautta. Tällöin Stripelle välitetään maksun edellyttämät tiedot (summa, valuutta, maksutapa, nimi, sähköpostiosoite, varausviite) sekä asiakkaidemme tilien osalta laissa vaaditut tunnistamistiedot (tilinhaltija, tosiasialliset edunsaajat, henkilöllisyysasiakirjojen tiedot, pankkiyhteys). Täydelliset korttitiedot eivät päädy järjestelmiimme. Oikeusperusteet ovat yleisen tietosuoja-asetuksen 6 artiklan 1 kohdan b alakohta ja, tunnistamis- ja rahanpesun estämisvelvoitteiden osalta, 6 artiklan 1 kohdan c alakohta. Yksityiskohdat ilmenevät [Stripen tietosuojaselosteesta](https://stripe.com/privacy).",
            "Lisäpalvelujen maksulinkit: jos yritys laskuttaa vieraaltaan lisäpalvelun (esim. siivouksen tai liinavaatteet) maksulinkin kautta, linkki johtaa Stripen ylläpitämälle maksusivulle. Välitämme Stripelle tätä varten palvelun nimikkeen, summan, valuutan sekä sisäisen viitteen varaukseen ja yritykseen; yrityksen logo siirretään sen Stripe-tilille, jotta sivu näyttää sen brändin. Maksusivulla Stripe kerää vieraan maksu- ja laitetiedot omalla vastuullaan. Meille palautuvat vain maksun tila, summa, pidätetyt määrät ja maksun tunnisteet — ei korttitietoja.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Jos yritys tarjoaa PayPalin maksutapana, maksutiedot välitetään PayPal (Europe) S.à r.l. et Cie, S.C.A:lle (Luxemburg). Sovelletaan [PayPalin tietosuojaselostetta](https://www.paypal.com/de/webapps/mpp/ua/privacy-full).",
          ],
        },
      ],
    },
    {
      heading: "Myyntikanavat ja portaalit",
      paragraphs: [
        "Kun yritys myy kohteitaan portaalien, kuten Booking.comin, Airbnbin tai Expedian, kautta, saatavuudet, hinnat, rajoitukset ja varaustiedot vaihdetaan kyseisen portaalin kanssa liitäntäpalvelumme toimittajan Channex.io Ltd:n (Yhdistynyt kuningaskunta) välityksellä. Samasta suunnasta saamme portaalin varaus- ja vierastiedot.",
        "Kyseiseen portaaliin sovelletaan sen omia tietosuojaehtoja; tältä osin portaali on itsenäinen rekisterinpitäjä. Siirron oikeusperuste on yleisen tietosuoja-asetuksen 6 artiklan 1 kohdan b alakohta yhdessä yrityksen toimeksiannon kanssa.",
      ],
    },
    {
      heading: "Viestintä",
      unterpunkte: [
        {
          titel: "Sähköposti",
          paragraphs: [
            "Käyttöön liittyvät sähköpostit (varausvahvistukset, järjestelmäviestit, tuki, vahvistus- ja kutsulinkit) lähetämme ja vastaanotamme omalla postipalvelimellamme, jota ylläpidämme itse. Näihin viesteihin ei ole liitetty ulkopuolista lähetyspalvelua.",
          ],
        },
        {
          titel: "Uutiskirje ja ennakkoilmoittautuminen",
          paragraphs: [
            "Verkkosivustollamme voit ilmoittautua myNextDaysia koskevien uutisten vastaanottajaksi (ennakkoilmoittautuminen/uutiskirje). Tällöin käsitellään sähköpostiosoitteesi, kieli sekä se paikka, jossa ilmoittautuminen tapahtui.",
            "Ilmoittautuminen tapahtuu kaksinkertaisella suostumusmenettelyllä (double opt-in): ilmoittautumisen jälkeen saat sähköpostin, jossa on vahvistuslinkki; ilmoittautuminen tulee voimaan vasta linkkiä napsauttamalla. Suostumuksen osoittamiseksi tallennamme ilmoittautumisen ja vahvistuksen ajankohdan, tällöin käytetyn IP-osoitteen, selaintunnisteen sekä sen sanamuodon, jonka hyväksyit. Näitä tietoja käytetään yksinomaan yleisen tietosuoja-asetuksen 7 artiklan 1 kohdan mukaiseen osoittamiseen, eikä niitä analysoida markkinointia varten.",
            "Oikeusperuste on suostumuksesi yleisen tietosuoja-asetuksen 6 artiklan 1 kohdan a alakohdan mukaisesti; osoitusaineiston säilyttäminen perustuu 6 artiklan 1 kohdan c alakohtaan yhdessä 7 artiklan 1 kohdan kanssa. Voit peruuttaa suostumuksen milloin tahansa tulevaisuutta koskevin vaikutuksin — jokaisessa uutiskirjeviestissä olevan peruutuslinkin kautta tai vapaamuotoisesti sähköpostilla meille. Peruutus ei vaikuta siihen asti tapahtuneen käsittelyn lainmukaisuuteen.",
            "Uutiskirjeiden hallintaan ja lähettämiseen käytämme henkilötietojen käsittelijänä Brevoa (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Ranska; saksalainen toimipaikka: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin). Välitettäviä tietoja ovat sähköpostiosoitteesi ja mainitut lisätiedot (kieli, lähde). Tiedot käsitellään Euroopan unionin alueella sijaitsevilla palvelimilla (Ranskassa ja Saksassa); Brevon kanssa on tehty yleisen tietosuoja-asetuksen 28 artiklan mukainen sopimus henkilötietojen käsittelystä. Sovelletaan [Brevon tietosuojaselostetta](https://www.brevo.com/legal/privacypolicy/).",
            "Kun lähetämme uutiskirjeen, Brevo mittaa toimeksiannostamme, onko viesti avattu ja onko siinä olevia linkkejä napsautettu. Tämä mittaus auttaa meitä mukauttamaan sisältöä ja lähetystiheyttä; se on osa suostumusta ja päättyy peruutukseesi. Tietoja ei yhdistetä muihin tietolähteisiin eikä profilointia tehdä.",
            "Niin kauan kuin vahvistus on antamatta, osoitteeseesi ei lähetetä viestejä eikä sitä välitetä Brevolle; vahvistamaton ilmoittautuminen raukeaa seitsemän päivän kuluttua. Peruutuksen jälkeen suljemme osoitteen lähetyksistä ja säilytämme suostumus- ja peruutusaineiston niin kauan kuin siihen perustuvia vaatimuksia voidaan esittää; pyynnöstä poistamme sen kokonaan.",
          ],
        },
        {
          titel: "Viestit alustalla",
          paragraphs: [
            "Vieraan ja yrityksen väliset viestit tallennetaan alustalle, jotta molemmat osapuolet voivat tarkastella viestihistoriaa. Jos yritys estää vieraan, viestikanava suljetaan; olemassa olevat viestit säilyvät jäljitettävyyden vuoksi.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Jos yritys käyttää WhatsApp-liitäntää, viestien sisällöt ja osapuolten puhelinnumerot välitetään Meta Platforms Ireland Limitedin WhatsApp Business Platform -palvelun kautta. Tämän toiminnon käytöstä päättää yritys; ilman aktivointia siirtoa ei tapahdu.",
          ],
        },
      ],
    },
    {
      heading: "Automaattiset toiminnot ja tekoäly",
      paragraphs: [
        "Tässä kuvattuihin toimintoihin sovelletaan yleisen tietosuoja-asetuksen ohella asetusta (EU) 2024/1689 (tekoälyasetus, ”AI Act”), jonka 50 artiklan mukaisia avoimuusvelvoitteita sovelletaan 2. elokuuta 2026 lähtien.",
      ],
      unterpunkte: [
        {
          titel: "Vastausehdotukset",
          paragraphs: [
            "Viestien saapuneet-kansion vastausehdotuksiin käytämme — mikäli toiminto on aktivoitu yritykselle — Groq, Inc:n (USA) kielimallitarjontaa. Tällöin kyseinen viestikonteksti välitetään palvelulle. Ehdotuksia ei lähetetä automaattisesti; lähettämisestä päättää aina ihminen. Yleisen tietosuoja-asetuksen 22 artiklassa tarkoitettua oikeudellisia vaikutuksia tuottavaa automaattista päätöksentekoa ei tapahdu.",
            "Kyse ei siten ole tekoälyjärjestelmästä, joka tekoälyasetuksen 50 artiklan 1 kohdassa tarkoitetulla tavalla on välittömässä vuorovaikutuksessa luonnollisten henkilöiden kanssa: velvoite edellyttää SUORAA vuorovaikutusta, jossa tekoäly itse viestii henkilön kanssa eikä ihmisen välittäjän kautta. Tässä toiminto ehdottaa yritykselle tekstiä, jonka työntekijä tarkistaa, voi muuttaa ja lähettää itse — työntekijä on tämä välittäjä, ja vieras on kirjeenvaihdossa yrityksen kanssa eikä chatbotin kanssa. Automaattisesti vastaavaa avustajaa ei ole käytössä. Arviomme mukaan toiminto ei täytä myöskään mitään tekoälyasetuksen liitteessä III tarkoitetun suuririskisen tekoälyn tunnusmerkkiä.",
            "Vieraille lähetetyt viestit eivät myöskään ole tekoälyasetuksen 50 artiklan 4 kohdassa tarkoitettua ”yleisen edun kannalta merkittäviä asioita koskevaa tekstiä”: niitä ei julkaista, vaan ne lähetetään yksilöllisesti tietylle henkilölle, ja ne koskevat oleskelun käytännön hoitamista. Tästä riippumatta tässä vaikuttaa lähettävän työntekijän tekemä ihmisen suorittama tarkistus.",
            "Jos jatkossa tarjotaan toiminto, joka vastaa vieraille itsenäisesti ilman ihmisen hyväksyntää, vieraalle ilmoitetaan keskustelun alussa näkyvästi, että hän kirjoittaa tekoälyjärjestelmän kanssa. Ilman tätä ilmoitusta tällaista toimintoa ei tarjota.",
          ],
        },
        {
          titel: "Roolit tekoälyasetuksen mukaan",
          paragraphs: [
            "Tuotteeseen sisäänrakennettujen tekoälytoimintojen osalta olemme tekoälyasetuksen 3 artiklan 4 alakohdassa tarkoitettu käyttöönottaja; taustalla olevien kielimallien tarjoajia ovat kyseiset mallien tarjoajat. Jos yritys käyttää näitä toimintoja ammattitoiminnassaan, se on niiden osalta omalta osaltaan käyttöönottaja, ja sitä koskee tekoälyasetuksen 4 artiklan mukainen tekoälylukutaitoa koskeva velvoite, jota on sovellettu 2. helmikuuta 2025 lähtien yrityksen koosta riippumatta. 27. heinäkuuta 2026 lähtien sitä sovelletaan asetuksen (EU) 2026/1744 mukaisessa muodossa: tarjoajat ja käyttöönottajat toteuttavat toimenpiteitä tukeakseen henkilöstönsä tekoälylukutaidon kehittymistä; tiettyä tasoa ei tällöin nimenomaisesti tarvitse takata. Tuemme tätä sovelluksessa ja ohjekeskuksessamme annettavilla ohjeilla; oman henkilöstön kouluttaminen on edelleen yrityksen tehtävä.",
            "Jos yritys yhdistää tilinsä omaan tekoälyavustajaan (ks. seuraava kohta), se on myös sen osalta tekoälyasetuksessa tarkoitettu käyttöönottaja — se päättää käytöstä ja muotoilee kyselyt. Liitäntä itsessään ei ole tekoälyjärjestelmä: se lukee tietoja tietokannasta ja antaa ne ulos tekemättä päätelmiä; tekoälyasetuksen johdanto-osan 12 kappale rajaa tällaiset järjestelmät nimenomaisesti tekoälyn ulkopuolelle.",
          ],
        },
        {
          titel: "Yhdistäminen omaan tekoälyavustajaan",
          paragraphs: [
            "Yritys voi yhdistää tilinsä liitännän kautta tekoälyavustajaan, jonka se on itse valinnut ja jonka kanssa sillä on oma sopimus — esimerkiksi Anthropic PBC:n (USA) Claude. Jos tällainen yhteys on annettu, avustaja voi yrityksen pyynnöstä hakea lukuoikeudella: varausasteen, saatavuuden ja päivähinnat; varaukset vieraan nimen, oleskeluajan, kohteen, varauskanavan ja tilan sekä summan ja valuutan osalta, siltä osin kuin kyselyn tekevän tilin rooli saa nähdä summia; sekä saapuneet-kansion keskustelujen yleiskatsauksen. Ilman annettua yhteyttä siirtoa ei tapahdu.",
            "Siirron ulkopuolelle jäävät vieraiden sähköpostiosoitteet ja puhelinnumerot, korttitiedot, pankkiyhteydet ja maksutositteet, kulkukoodit sekä kohdekansiot. Varausmuistiinpanot ja vierasviestien sisältö ovat oletusarvoisesti poissuljettuja, koska ne voivat sisältää terveyttä koskevia tietoja tai muita yleisen tietosuoja-asetuksen 9 artiklassa tarkoitettuja erityisiä henkilötietoryhmiä; yrityksen on vapautettava ne yhteyden antamisen yhteydessä nimenomaisesti ja erikseen.",
            "Yhteyden voi antaa vain tili, jonka rooli on ”ylläpitäjä”, ei mikä tahansa tili, jolla on pääsy. Jokainen haku kirjataan lokiin ja on yrityksen tarkasteltavissa kohdassa ”Tili → Yhteydet”; se voi katkaista yhteyden siellä milloin tahansa, ja pääsy päättyy välittömästi.",
            "Oikeudellisesti tämä siirto on yrityksen meille antama ohje (yleisen tietosuoja-asetuksen 28 artiklan 3 kohdan a alakohta). Avustajan tarjoaja ei ole meidän alikäsittelijämme — emme anna sille toimeksiantoa emmekä ohjeita; se käsittelee tietoja sen sopimuksen perusteella, jonka yritys on itse tehnyt sen kanssa. Tämän käsittelyn oikeusperusteesta, sen vieraiden informoinnista ja kolmanteen maahan tapahtuvan siirron suojatoimista vastaa siksi yritys.",
          ],
        },
        {
          titel: "Käännökset",
          paragraphs: [
            "Kohde- ja sisältötekstejä voidaan kääntää Google Ireland Limitedin Cloud Translation API -rajapinnan kautta. Välitettäviä tietoja ovat käännettävät tekstit; henkilötietoja vain siltä osin kuin ne sisältyvät näihin teksteihin.",
          ],
        },
        {
          titel: "Hintasuositukset",
          paragraphs: [
            "Hintasuosituksia varten käytämme ulkoisten lähteiden markkina-, sää- ja valuuttakurssitietoja. Nämä kyselyt eivät sisällä henkilötietoja, vaan ainoastaan paikan, ajanjakson ja kohteen ominaisuudet.",
          ],
        },
      ],
    },
    {
      heading: "Asiakkaidemme verkkosivustot ja verkkotunnukset",
      paragraphs: [
        "Jos yritys luo sivueditorilla oman verkkosivuston omalla verkkotunnuksella, hallinnoimme siihen tarvittavia DNS-tietueita Cloudflare, Inc:n kautta. Tällöin välitetään verkkotunnus- ja määritystietoja; asiakkaan verkkosivuston vierailijoiden tietoja käsittelemme tässä selosteessa kuvatulla tavalla.",
        "Asiakkaan verkkosivuston sisällöistä, ylläpitäjäilmoituksesta (Impressum) ja tietosuojatiedoista vastaa kyseinen yritys.",
      ],
    },
    {
      heading: "Kumppanuusohjelma",
      paragraphs: [
        "Ylläpidämme kumppanuusohjelmaa, jonka kautta kumppanit (vaikuttajat, konsultit, toimistot, asiakkaat) voivat suositella yrityksiä myNextDaysille ja saada siitä palkkion. Käsittelemme kumppaneiden tietoja ja – vähäisessä määrin – suositeltujen yritysten tietoja.",
      ],
      unterpunkte: [
        {
          titel: "Kumppaneiden tiedot",
          paragraphs: [
            "Hakemuksen yhteydessä käsittelemme nimen, yrityksen, oikeudellisen muodon, maan, sähköpostiosoitteen, kielen, sosiaalisen median tilit (alusta, osoite, käyttäjätunnus, itse ilmoitettu tavoittavuus), arvonlisäverotunnisteen (tarkistus EU:n VIES-järjestelmän kautta), maksutiedot (IBAN, Wise- tai PayPal-osoite) sekä suostumuksen osallistumisehtoihin version ja ajankohdan kanssa. Oikeusperusteena on kumppanuussopimuksen täytäntöönpano (GDPR 6 artiklan 1 kohdan b alakohta); hyvitysten ja säilytyksen osalta sovelletaan vero- ja kauppaoikeudellisia velvoitteita (GDPR 6 artiklan 1 kohdan c alakohta).",
            "Jos kumppanilla on tiimi, hän näkee tiimikumppaneidensa nimen tai yrityksen, arvon, maksavien asiakkaiden määrän ja siitä johtuvan tiimipalkkion. Sponsorin ja tiimikumppanin väliset viestit tallennetaan alustalle, jotta molemmat näkevät historian.",
          ],
        },
        {
          titel: "Kumppanilinkkien klikkaukset",
          paragraphs: [
            "Kun kävijä avaa kumppanilinkin (mynextdays.com/p/CODE), tallennamme koodin, ajankohdan, avatun sivun, viittaavan sivun ja mahdolliset kampanjaparametrit sekä IP-osoitteen ja selaimen tunnisteen ainoastaan lyhennettyinä tarkistussummina (hash) – väärinkäytösten havaitsemiseksi (kasautumat), ei tunnistamista varten. Seurantacookieta ei aseteta. Poistamme klikkaustiedot 90 päivän kuluttua. Oikeusperusteena on oikeutettu etumme ohjelman petoksenvastaisessa laskutuksessa (GDPR 6 artiklan 1 kohdan f alakohta).",
          ],
        },
        {
          titel: "Yhdistetyt sosiaalisen median tilit ja julkaisut",
          paragraphs: [
            "Kumppanit voivat vapaaehtoisesti yhdistää YouTube (Google), Instagram ja Facebook (Meta) sekä TikTok -tilinsä kumppanin hallintapaneeliin. Tällöin he antavat kyseiselle alustalle lukuoikeuden (OAuth); emme kirjoita mitään näille tileille. Tallennamme tilin tunnisteen ja nimen, salatun pääsytunnuksen, yhdistämisajankohdan sekä päivittäin yhden mittausarvon tiliä kohden: seuraajien tai tilaajien määrän, viimeisten 28 päivän katselukerrat, vuorovaikutusasteen ja julkaisujen määrän, kunkin alustan vastauksen ajankohdan kanssa. Julkaisujen osalta, jotka kumppani luo hallintapaneelissa (otsikko, alusta, osoite, julkaisupäivämäärä), tallennamme lisäksi katselukerrat, tykkäykset, kommentit, jaot ja tallennukset alustalta.",
            "Tarkoituksena on tarkistaa kumppanin ilmoittama kattavuus ja kohdistaa klikkaukset ja asiakkaat yksittäisiin julkaisuihin; vahvistamattomille tiedoille annetaan pienempi painoarvo julkaisun yhteydessä. Viitteet epäjohdonmukaisuuksiin (esim. seuraajien määrän kasvu ilman vastaavia näyttökertoja) on tarkoitettu ainoastaan manuaaliseen tarkistukseen meidän toimestamme, eivätkä ne johda automaattiseen päätökseen. Oikeusperusteena on kumppanin suostumus (GDPR 6 artiklan 1 kohdan a alakohta), jonka hän antaa yhdistämällä ja voi peruuttaa milloin tahansa hallintapaneelissa kohdasta ”Katkaise yhteys”; yhteyden katkaisun yhteydessä poistamme pääsytunnuksen välittömästi, tallennetut mittausarvot säilyvät historiana ja poistetaan kumppanitilin mukana. Käytämme ainoastaan alustojen virallisia rajapintoja; Googlen, Metan ja TikTokin suorittamaan käsittelyyn sovelletaan niiden omia tietosuojailmoituksia.",
          ],
        },
        {
          titel: "Suositellut yritykset",
          paragraphs: [
            "Jos yritys rekisteröityy kumppanikoodilla, tallennamme yrityksen ja kumppanin välisen yhteyden sekä ajankohdan, tavan (linkki tai koodi) ja tilan. Kumppani näkee yrityksen ainoastaan pseudonyymisti (juokseva numero, maa, tila, summat) – ei koskaan nimeä, sähköpostiosoitetta tai varaustietoja. Vain jos yritys nimenomaisesti suostuu rekisteröityessään, kumppani saa ottaa siihen yhteyttä alustan kautta. Provisiolaskentaa varten käsittelemme yrityksen maksettujen laskujen netto-tilaussummat; oikeusperusteena on kumppanuus- ja käyttöehtosopimuksen täytäntöönpano (GDPR 6 artiklan 1 kohdan b alakohta).",
          ],
        },
      ],
    },
    {
      heading: "Isännöinti ja tallennus",
      paragraphs: [
        "Alusta, tietokanta, media ja postipalvelin toimivat Hetzner Online GmbH:n (Saksa) palvelimilla Helsingin (Suomi) konesalissa — siis Euroopan unionin alueella. Hetznerin kanssa on tehty sopimus henkilötietojen käsittelystä.",
        "Varmuuskopiot luodaan salattuina ja säilytetään salattuina EU:n alueella sijaitsevalla tallennuspalvelun tarjoajalla.",
      ],
    },
    {
      heading: "Vastaanottajat yhdellä silmäyksellä",
      paragraphs: [
        "Mainittujen palveluntarjoajien lisäksi luovutamme henkilötietoja vain, jos meillä on siihen lakisääteinen velvollisuus (esim. veroviranomaiset, rikostutkinta) tai jos sinä taikka vastuussa oleva yritys sitä vaadit.",
      ],
      list: [
        "Hetzner Online GmbH (Saksa/Suomi) — isännöinti, tietokanta, media, postipalvelin",
        "Stripe Payments Europe, Limited (Irlanti) — maksut, tilitykset, henkilöllisyyden tarkistus",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxemburg) — maksut, mikäli aktivoitu",
        "Channex.io Ltd (Yhdistynyt kuningaskunta) — liitäntä varausportaaleihin",
        "Meta Platforms Ireland Limited (Irlanti) — WhatsApp-viestit, mikäli aktivoitu",
        "Sendinblue SAS / Brevo (Ranska, Saksa) — uutiskirjeen hallinta ja lähetys, vain suostumuksella",
        "Google Ireland Limited (Irlanti) — käännökset; yhteydenottolomakkeen roskapostisuoja (reCAPTCHA Enterprise), vain suostumuksella; kirjautuminen Google-tunnuksella, mikäli käytössä; Kävijämittaus (Google Analytics 4), vain suostumuksella",
        "Groq, Inc. (USA) — vastausehdotukset, mikäli aktivoitu",
        "Cloudflare, Inc. (USA) — asiakkaiden verkkotunnusten DNS-hallinta",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Tässä luettelossa eivät ole palvelut, jotka yritys sopii itse kolmannen osapuolen kanssa ja yhdistää liitännän kautta tiliinsä — esimerkiksi tekoälyavustaja, kuten Anthropic PBC:n (USA) Claude. Ne eivät ole meidän toimeksiannostamme toimivia palveluntarjoajia, vaan vastaanottajia kyseisen yrityksen ohjeen perusteella; ilman sen yhteyttä sinne ei virtaa tietoja. Anthropic ei Yhdysvaltain kauppaministeriön virallisen osallistujaluettelon mukaan ole sertifioitu EU-US Data Privacy Framework -järjestelyn nojalla; siirto perustuu siksi mallisopimuslausekkeisiin, joista kyseinen yritys vastaa rekisterinpitäjänä.",
          ],
        },
      ],
    },
    {
      heading: "Siirto kolmansiin maihin",
      paragraphs: [
        "Käsittely tapahtuu lähtökohtaisesti EU:n alueella. Edellä mainittujen, EU:n ulkopuolelle sijoittautuneiden palvelujen osalta tietoja voidaan siirtää kolmanteen maahan.",
        "Groq, Inc:n ja Cloudflare, Inc:n (USA) osalta perustamme siirron Euroopan komission mallisopimuslausekkeisiin yleisen tietosuoja-asetuksen 46 artiklan 2 kohdan c alakohdan mukaisesti, siltä osin kuin vastaanottaja ei voi vedota riittävyyspäätökseen (EU-US Data Privacy Framework).",
        "Maksujen käsittelyn sopimuskumppani on Stripe Payments Europe, Limited (Irlanti). Siltä osin kuin Stripe käyttää tässä Stripe, LLC:tä (USA), tämä on sertifioitu EU-US Data Privacy Framework -järjestelyn nojalla; siirto perustuu tältä osin Euroopan komission riittävyyspäätökseen yleisen tietosuoja-asetuksen 45 artiklan mukaisesti. Tätä täydentävät [Stripen henkilötietojen käsittelysopimuksen](https://stripe.com/legal/dpa) mallisopimuslausekkeet.",
        "Channex.io Ltd:n (Yhdistynyt kuningaskunta) osalta sovelletaan Euroopan komission Yhdistynyttä kuningaskuntaa koskevaa riittävyyspäätöstä; jos se lakkaa, sovelletaan mallisopimuslausekkeita.",
      ],
    },
    {
      heading:
        "Kolmansien valtioiden viranomaisten pääsy tietoihin (US CLOUD Act)",
      paragraphs: [
        "Palveluntarjoajat, jotka kuuluvat Yhdysvaltain oikeudenkäyttöpiiriin, voidaan Yhdysvaltain CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018) -lain nojalla velvoittaa luovuttamaan tietoja Yhdysvaltain viranomaisille — myös silloin, kun nämä tiedot sijaitsevat Euroopan unionin alueella olevilla palvelimilla. Tällainen pääsy voi olla ristiriidassa yleisen tietosuoja-asetuksen kanssa, ja palveluntarjoaja voi olla oikeudellisesti estynyt kertomasta siitä meille tai sinulle. Sen paremmin EU-US Data Privacy Framework -järjestelyä koskeva riittävyyspäätös kuin mallisopimuslausekkeet eivät poista tätä riskiä.",
        "Rajoitamme tätä riskiä siten, että kantavat järjestelmät — alusta, tietokanta, media, postipalvelin ja varmuuskopiot — toimivat eurooppalaisilla palveluntarjoajilla EU:n alueella, missä Yhdysvaltain oikeudenkäyttövalta ei ulotu.",
      ],
      unterpunkte: [
        {
          titel: "Kyseeseen tulevat palvelut",
          paragraphs: [
            "Yhdysvaltain oikeudenkäyttöpiiri voi tulla kyseeseen yksinomaan seuraavissa selvästi rajatuissa lisäpalveluissa:",
          ],
          list: [
            "Groq, Inc. (USA) — vastausehdotukset viestien saapuneet-kansiossa, vain jos yritys aktivoi toiminnon. Siirrettävää on kyseinen viestikonteksti.",
            "Cloudflare, Inc. (USA) — asiakkaiden verkkotunnusten DNS-hallinta. Siirrettäviä ovat verkkotunnus- ja määritystiedot, ei vierastietoja.",
            "Google LLC (USA) – Google-kirjautumisen, käännösten ja kävijämittauksen yhteydessä (Google Analytics 4, vain suostumuksella); sopimuskumppani on Google Ireland Limited, mutta yhdysvaltalaisen emoyhtiön pääsyä tietoihin ei voida sulkea pois.",
          ],
        },
        {
          titel: "Vältettävyys",
          paragraphs: [
            "Alustan käyttö on mahdollista ilman näitä palveluja: vastausehdotukset voidaan kytkeä pois, DNS-hallinta koskee vain asiakkaita, joilla on oma verkkotunnus, ja Google-tunnuksella kirjautuminen on vapaaehtoinen vaihtoehto sähköpostilla ja salasanalla kirjautumiselle.",
          ],
        },
        {
          titel: "Rajanveto eurooppalaiseen lainsäädäntöön",
          paragraphs: [
            "CLOUD Act on Yhdysvaltain lainsäädäntöä, ei Euroopan unionin oikeutta. Se on erotettava EU Data Actista (asetus (EU) 2023/2854), joka sääntelee vaihtamista ja siirrettävyyttä tietojenkäsittelypalveluissa, sekä Cloud and AI Development Actista, joka on tämän selosteen ajankohtana Euroopan lainsäädäntömenettelyssä.",
          ],
        },
      ],
    },
    {
      heading: "Säilytysaika",
      list: [
        "Tilitiedot: liikesuhteen kestoajan; sen jälkeen poistetaan, ellei säilytysvelvollisuutta ole.",
        "Varaus-, lasku- ja maksutiedot: Tanskan kirjanpitolain mukaan viisi vuotta sen tilikauden päättymisestä, johon ne kuuluvat; Saksaan sijoittautuneilla asiakkailla voivat tulla sovellettaviksi pidemmät kaupallis- ja verolainsäädännön määräajat.",
        "Viestit ja vierastiedot alustalla: vastuussa olevan yrityksen ohjeen mukaan, enintään siihen asti, kun se poistaa ne, tai sopimuksen päättymiseen asti.",
        "Uutiskirje: suostumuksen peruuttamiseen asti; vahvistamattomat ilmoittautumiset raukeavat seitsemän päivän kuluttua. Suostumus- ja peruutusaineisto säilyy tämän jälkeenkin niin kauan kuin sitä tarvitaan osoitusaineistona.",
        "Kirjautumislokit ja tietoturvatapahtumat: lyhytaikaisesti hyökkäysten havaitsemiseksi.",
        "Palvelimen lokitiedot: vain niin kauan kuin se on toiminnan ja tietoturvan kannalta tarpeellista.",
        "Varmuuskopiot: kiertävästi, kunnes uudemmat varmuuskopiot korvaavat ne.",
      ],
    },
    {
      heading: "Oikeutesi",
      paragraphs: [
        "Sinulla on oikeus saada tietoja (15 artikla), oikeus tietojen oikaisemiseen (16 artikla), poistamiseen (17 artikla), käsittelyn rajoittamiseen (18 artikla), tietojen siirtämiseen (20 artikla) ja oikeus vastustaa oikeutettuihin etuihin perustuvaa käsittelyä (yleisen tietosuoja-asetuksen 21 artikla). Annetun suostumuksen voit peruuttaa milloin tahansa tulevaisuutta koskevin vaikutuksin.",
        `Ota tätä varten yhteyttä osoitteeseen [${ANBIETER.email}](mailto:${ANBIETER.email}). Jos tietosi liittyvät siihen, että jokin yritys käyttää alustaa, välitämme pyyntösi vastuussa olevalle yritykselle tai tuemme sitä vastauksen antamisessa.`,
        `Voit lisäksi tehdä valituksen tietosuojaa valvovalle viranomaiselle — meidän osaltamme toimivaltainen on ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Voit kääntyä myös asuinpaikkasi valvontaviranomaisen puoleen.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Ein Abschnitt „Ihre Rechte", der die
      // Löschung nur als DSGVO-Artikel erwähnt, genügt der Prüfung nicht —
      // gefordert ist der konkrete, benannte Weg.
      heading: "Tilin ja sovelluksen tietojen poistaminen",
      paragraphs: [
        "Voit hakea tilisi poistamista milloin tahansa itse — sovelluksessa kohdassa ”Profiili → Tili” tai verkkolomakkeellamme:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "Verkossa kulkeva tie toimii tarkoituksella myös silloin, kun sovellus ei ole enää asennettuna tai kun et enää pysty kirjautumaan. Väärinkäytön estämiseksi tämä tapahtuu kahdessa vaiheessa: syötät tilisi sähköpostiosoitteen ja saat juuri tähän osoitteeseen vahvistuslinkin. Vasta sen avaaminen tekee hakemuksesta pätevän — pelkkä syötetty osoite ei saa aikaan mitään. Käsittelemme hakemuksen 30 päivän kuluessa ja vastaamme sähköpostilla.",
        "Tilin mukana poistamme kirjautumistietosi, profiilisi, kohde- ja kalenteritietosi sekä viestisi. Poistamatta jäävät asiakirjat, joita koskee lakisääteinen säilytysvelvollisuus — erityisesti laskut ja tilitettyjen jaksojen varaustositteet (Tanskan oikeuden mukainen kirjanpitovelvollisuus, yleensä viisi vuotta). Nämä asiakirjat suljetaan muulta käytöltä määräajan keston ajaksi, eli niitä säilytetään yksinomaan tämän velvollisuuden täyttämiseksi ja poistetaan sen jälkeen.",
      ],
    },
    {
      heading: "Käsittelyn turvallisuus",
      paragraphs: [
        "Suojaamme käsittelyn teknisin ja organisatorisin toimenpitein yleisen tietosuoja-asetuksen 32 artiklan mukaisesti, erityisesti: läpäisevä siirtosalaus (TLS), asiakaskohtaiset pääsysäännöt suoraan tietokannassa, roolipohjaiset käyttöoikeudet talous- ja palvelutietojen erottelulla, valinnainen kaksivaiheinen tunnistautuminen, kirjautumisyritysten rajoittaminen, salatut varmuuskopiot säännöllisin palautustesteineen sekä tietoturvan kannalta merkityksellisten tapahtumien kirjaaminen lokiin.",
      ],
    },
    {
      heading: "Velvollisuus tietojen antamiseen",
      paragraphs: [
        "Tiedot, joita tarvitsemme sopimuksen tekemiseen, laskutukseen ja lakisääteisiin velvoitteisiin, ovat välttämättömiä — ilman niitä emme voi tarjota alustaa. Kaikki muut tiedot ovat vapaaehtoisia.",
      ],
    },
    {
      heading: "Tämän selosteen muutokset",
      paragraphs: [
        "Muutamme tätä selostetta, kun käsittely, käytetyt palveluntarjoajat tai oikeustila muuttuvat. Voimassa on kussakin tapauksessa tässä julkaistu versio; yllä oleva päivämäärä osoittaa ajantasaisuuden.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default datenschutz;
