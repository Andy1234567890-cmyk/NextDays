// Finnische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Evästekäytäntö",
  metaDescription:
    "Mitä evästeitä myNextDays asettaa: teknisesti välttämättömiä evästeitä sekä – vain suostumuksellasi – toiminnallisia, analyyttisiä ja markkinointievästeitä. Jokainen kategoria on erikseen kytkettävissä päälle ja pois päältä.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Tämä käytäntö selittää, mitä evästeitä ja vastaavia tallennustekniikoita ${ANBIETER.firma} käyttää tällä verkkosivustolla ja myNextDays-alustalla.`,
    "Lyhyesti sanottuna: Välttämättömiä ovat vain evästeet, joita ilman verkkosivusto ei toimi pyydetyllä tavalla. Kaikki muu vaatii suostumuksesi eikä lataudu ilman sitä – yhteydenottolomakkeemme roskapostisuojaus, kävijämittaus ja markkinointievästeet, joilla mittaamme mainontamme menestystä. Voit sallia tai hylätä jokaisen näistä kategorioista erikseen ja peruuttaa päätöksesi milloin tahansa.",
  ],
  sections: [
    {
      heading: "Mitä evästeet ovat",
      paragraphs: [
        "Evästeet ovat pieniä tekstitiedostoja, jotka verkkosivusto tallentaa selaimeen. Niiden avulla istunto voidaan tunnistaa uudelleen — esimerkiksi jotta pysytte kirjautuneena sisäänkirjautumisen jälkeen. Evästeiden lisäksi selaimet käyttävät muita tallennustiloja, kuten Local Storagea, jotka toimivat teknisesti samalla tavalla.",
      ],
    },
    {
      heading: "Mihin tarvitsemme suostumuksenne",
      paragraphs: [
        "Suostumus on tarpeen Tanskan evästeasetuksen (Cookie-bekendtgørelsen) 9 §:n mukaan (direktiivin 2002/58/EY 5 artiklan 3 kohdan täytäntöönpano) vain, jos pääsy laitteeseenne ei palvele yksinomaan viestin välittämistä tai ei ole ehdottoman välttämätön nimenomaisesti pyytämänne palvelun tarjoamiseksi.",
        "Kaikki asettamamme evästeet ovat tarpeen kirjautumista, istunnon turvallisuutta tai itse tekemäänne asetusta varten — emme kysy niitä varten mitään, emmekä toisaalta aseta mitään, mikä vaatisi suostumusta.",
        "Sinun on annettava suostumus kolmelle kategorialle, joita kaikkia ei ladata ilman lupaasi: yhteydenottolomakkeemme roskapostisuojaus (Googlen reCAPTCHA), tämän verkkosivuston kävijämittaus (Google Analytics 4) ja markkinointievästeet (Meta, LinkedIn, Google Ads). Tätä varten avautuu ikkuna, jossa on luettelo kategorioista – ensimmäisellä käynnillä, ilman esivalintaa, jokaisella kategorialla on oma kytkin. Niin kauan kuin et ole tehnyt päätöstä, sovelletaan ”ei sallittu” -periaatetta, eikä tietoja arvioida tai mainosteta.",
        "Päätöksenne sijaitsee selaimenne tallennustilassa (Local Storage, arvo ”nd_consent”); se sisältää vain kategorian, ajankohdan ja versionumeron, ei henkilöllisyyttänne. Voitte muuttaa tai peruuttaa sen milloin tahansa jokaisen sivun vasemmassa alakulmassa olevan evästekuvakkeen kautta. Kuuden kuukauden kuluttua kysymme uudelleen — suostumus ei saa olla voimassa rajattomasti.",
      ],
    },
    {
      heading: "Tämä verkkosivusto",
      paragraphs: [
        "Tämä verkkosivusto ei itsessään aseta evästeitä. Fontit ja symbolit sijaitsevat omalla palvelimellamme – kolmannen osapuolen symboli- tai fonttipalvelua ei käytetä. Lisäksi käytössä ovat vain sallimasi palvelut: yhteydenottolomakkeen roskapostisuojaus, kävijämittaus ja markkinointipalvelut. Mitä evästeitä asetetaan, millä voimassaoloajalla ja millä isännällä, on kuvattu alla olevassa osiossa ”Kolmannen osapuolen evästeet”. Peruutus tapahtuu vasemmassa alakulmassa olevan evästekuvakkeen kautta – kyseinen palvelu päättyy välittömästi ja sen evästeet poistetaan. Yksityiskohdat löytyvät [tietosuojakäytännöstä](/datenschutz).",
      ],
    },
    {
      heading: "Alustan evästeet",
      paragraphs: [
        "Heti kun kirjaudutte hallintapaneeliin, markkinapaikkaan tai mobiilinäkymään, asetetaan seuraavat evästeet:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — kirjautuminen (teknisesti välttämätön)",
          list: [
            "Tarkoitus: tunnistaa kirjautuneen istuntonne palvelimelle.",
            "Sisältö: lyhytikäinen käyttöoikeustunniste; luettavissa vain palvelimella (HttpOnly), välitetään vain HTTPS:n kautta.",
            "Voimassaolo: istunnon ajan tai tunnisteen vanhenemiseen asti.",
          ],
        },
        {
          titel: "nd_refresh — istunnon jatkaminen (teknisesti välttämätön)",
          list: [
            "Tarkoitus: uusii käyttöoikeustunnisteen, jotta teidän ei tarvitse kirjautua jatkuvasti uudelleen.",
            "Sisältö: uusimistunniste; HttpOnly, vain HTTPS:n kautta.",
            "Voimassaolo: uloskirjautumiseen tai vanhenemiseen asti.",
          ],
        },
        {
          titel: "nd_locale — kielivalinta (toiminnallinen)",
          list: [
            "Tarkoitus: muistaa valitsemanne kielen.",
            "Sisältö: kielikoodi, esim. ”de” tai ”en”.",
            "Voimassaolo: muutokseen tai poistoon asti.",
          ],
        },
        {
          titel: "sidebar_state — sivupalkki (toiminnallinen)",
          list: [
            "Tarkoitus: muistaa, onko navigointipalkki avattu vai suljettu.",
            "Sisältö: ”true” tai ”false”.",
            "Voimassaolo: muutokseen tai poistoon asti.",
          ],
        },
        {
          titel:
            "sb-… — kirjautuminen Googlella (teknisesti välttämätön, vain käytettäessä)",
          list: [
            "Tarkoitus: ylläpitää istuntoa, kun kirjaudutte sisään Googlen kautta.",
            "Sisältö: kirjautumispalvelun istuntotunniste.",
            "Voimassaolo: istunnon ajan tai tunnisteen vanhenemiseen asti. Asetetaan vain, jos valitsette Google-kirjautumisen.",
          ],
        },
      ],
    },
    {
      heading: "Local Storage",
      unterpunkte: [
        {
          titel: "nd_consent",
          paragraphs: [
            "Tallentaa päätöksesi suostumusta vaativista palveluista (yhteydenottolomakkeen roskapostisuojaus ja kattavuuden mittaus).",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Asetetaan vain, jos avaatte itse tämän verkkosivuston chatin ja lähetätte viestin. Se on avain omaan keskusteluunne — ilman sitä ette löytäisi vastaustamme sivun vaihtamisen jälkeen. Se ei sisällä tietoja teistä ja sitä käytetään vain tähän tarkoitukseen.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Tallentaa selaimeen, oletteko suostuneet puheentunnistuksen käyttöön, jotta suostumusta ei kysytä uudelleen jokaisella käynnillä. Arvo ei poistu laitteeltanne.",
          ],
        },
      ],
    },
    {
      heading: "Mobiilisovelluksen evästeet",
      paragraphs: [
        "Mobiilisovellus ei käytä evästeitä. Käyttöoikeus- ja uusimistunnisteet tallennetaan laitteen suojattuun avainsäilöön (iOS Keychain, Android Keystore) ja poistetaan uloskirjautumisen yhteydessä.",
      ],
    },
    {
      heading: "Kolmansien osapuolten evästeet",
      paragraphs: [
        "Kun teette maksun, maksupalveluntarjoaja (Stripe tai PayPal) voi asettaa omalla sivullaan evästeitä, jotka ovat tarpeen käsittelyä ja petosten torjuntaa varten. Näihin sovelletaan kyseisen palveluntarjoajan ehtoja.",
        "Verkkosivustoilla, jotka yritykset luovat sivustorakentajallamme, kyseinen yritys päättää lisäevästeistä ja vastaa siellä annetuista tiedoista.",
        "Vain suostumuksellasi Googlen palvelut asettavat tälle verkkosivustolle seuraavat evästeet – kaksi mittausta varten, yksi roskapostisuojaukseen. Ilman suostumustasi kyseistä skriptiä ei ladata eikä näitä evästeitä aseteta; jos peruutat suostumuksesi, poistamme ne.",
      ],
      unterpunkte: [
        {
          titel: "_fbp – Mainonnan tulosten mittaus (suostumus vaaditaan)",
          list: [
            "Tarkoitus: Yhdistää vierailusi mainokseen, jotta voimme mitata kampanjoidemme menestystä.",
            "Sisältö: Satunnaisesti luotu tunniste; ei nimeä, sähköpostia tai tilitietoja meiltä.",
            "Palveluntarjoaja: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Irlanti.",
            "Isäntä: mynextdays.com (ensimmäisen osapuolen eväste, Metan skriptin asettama). Kesto: noin kolme kuukautta.",
          ],
        },
        {
          titel: "_gcl_au – Google Ads -tulosten mittaus (suostumus vaaditaan)",
          list: [
            "Tarkoitus: Yhdistää vierailusi Google-mainokseen, jotta voimme mitata kampanjoidemme menestystä.",
            "Sisältö: Satunnaisesti luotu tunniste ilman henkilökohtaista viittausta.",
            "Palveluntarjoaja: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlanti.",
            "Isäntä: mynextdays.com (ensimmäisen osapuolen eväste). Kesto: noin kolme kuukautta.",
          ],
        },
        {
          titel: "li_gc ja bcookie – LinkedIn-mainonta (suostumus vaaditaan)",
          list: [
            "Tarkoitus: Tunnistaa selaimesi LinkedInille, jotta mainokset ja niiden menestys voidaan yhdistää; li_gc tallentaa myös suostumuksesi siellä.",
            "Sisältö: Selaimen tunniste sekä suostumuksen tila; ei tietoja tililtäsi meillä.",
            "Palveluntarjoaja: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Irlanti.",
            "Isäntä: linkedin.com (kolmannen osapuolen evästeet). Kesto: noin kuusi kuukautta tai yksi vuosi.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA – Yhteydenottolomakkeen roskapostisuojaus (suostumus vaaditaan)",
          list: [
            "Isäntä: www.google.com (kolmannen osapuolen eväste).",
            "Tarkoitus: Sallii Googlen riskinarvioinnin, jolla erotetaan automaattiset massaviestit aidoista kyselyistä.",
            "Sisältö: Googlen luoma tunniste tätä arviointia varten; ei nimitietoja, sähköpostiosoitteita tai tilitietoja meiltä.",
            "Palveluntarjoaja: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlanti.",
            "Kesto: Googlen määrittämä, enintään kuusi kuukautta. Se asetetaan vasta, kun olet sallinut roskapostisuojauksen ja avannut yhteydenottolomakkeen.",
          ],
        },
        {
          titel: "_ga – Kattavuuden mittaus (suostumus vaaditaan)",
          list: [
            "Isäntä: mynextdays.com (ensimmäisen osapuolen eväste, Googlen komentosarjan asettama).",
            "Tarkoitus: erottaa kävijät, jotta toistuvia käyntejä ei lasketa kahdesti.",
            "Sisältö: satunnaisesti luotu tunnus, joka ei liity henkilöösi; ei nimi-, sähköposti- tai tilitietoja.",
            "Tarjoaja: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlanti.",
            "Kesto: enintään kaksi vuotta.",
          ],
        },
        {
          titel:
            "_ga_<tunnus> – Mittauksen istunnon tila (suostumus vaaditaan)",
          list: [
            "Isäntä: mynextdays.com (ensimmäisen osapuolen eväste, Googlen komentosarjan asettama).",
            "Tarkoitus: tallentaa, milloin nykyinen käyntisi alkoi, jotta istunnon sivunäkymät kuuluvat yhteen.",
            "Sisältö: aikaleima ja istunnon laskuri; nimen tunnus viittaa omaisuuteemme, ei sinuun.",
            "Tarjoaja: Google Ireland Limited.",
            "Kesto: enintään kaksi vuotta.",
          ],
        },
      ],
    },
    {
      heading: "Evästeiden poistaminen ja hallinta",
      paragraphs: [
        "Voitte poistaa tai estää evästeitä milloin tahansa selaimenne asetuksista. Jos estätte välttämättömät evästeet, kirjautuminen alustalle ei ole teknisesti mahdollista — julkinen verkkosivusto ja markkinapaikka pysyvät käytettävissä ilman kirjautumista.",
        "Poistamme kirjautumisevästeet itse uloskirjautumisen yhteydessä.",
      ],
    },
    {
      heading: "Tämän käytännön muutokset",
      paragraphs: [
        "Jos lisätään toimintoja, jotka vaativat lisäevästeitä, päivitämme tätä luetteloa. Voimassa on aina tässä julkaistu versio; yllä oleva päivämäärä osoittaa tilanteen.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
