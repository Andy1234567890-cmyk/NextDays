// Finnische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Evästekäytäntö",
  metaDescription:
    "Mitä evästeitä myNextDays käyttää: ainoastaan teknisesti välttämättömiä ja toiminnallisia evästeitä, ei seuranta- tai mainosevästeitä.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Tämä käytäntö selittää, mitä evästeitä ja vastaavia tallennustekniikoita ${ANBIETER.firma} käyttää tällä verkkosivustolla ja myNextDays-alustalla.`,
    "Lyhyesti: käytämme ainoastaan teknisesti välttämättömiä ja toiminnallisia evästeitä. Analytiikka-, mainos- tai seurantaevästeitä ei ole, eikä käyttötietoja luovuteta mainosverkostoille.",
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
        "Suostumusta tarvitsette täsmälleen yhtä asiaa varten: yhteydenottolomakkeemme roskapostisuojaa. Se tulee Googlelta (reCAPTCHA Enterprise) eli on ulkoinen palvelu, ja se ladataan vain, jos olette sallineet sen. Tätä varten näytön alareunassa kysyy palkki — ensimmäisellä käynnillä, tasavertaisilla painikkeilla ”Hylkää” ja ”Hyväksy” ilman ennalta valittua vaihtoehtoa. Kunnes olette päättäneet, on voimassa ”ei sallittu”.",
        "Päätöksenne sijaitsee selaimenne tallennustilassa (Local Storage, arvo ”nd_consent”); se sisältää vain kategorian, ajankohdan ja versionumeron, ei henkilöllisyyttänne. Voitte muuttaa tai peruuttaa sen milloin tahansa tämän sivun lopussa.",
      ],
    },
    {
      heading: "Tämä verkkosivusto",
      paragraphs: [
        "Markkinointisivusto ei aseta evästeitä. Fontit ja kuvakkeet sijaitsevat omalla palvelimellamme — niitä varten ei kutsuta minkään kolmannen osapuolen kuvake- tai fonttipalvelua. Tämän sivun ainoa ulkoinen palvelu on yhteydenottolomakkeen roskapostisuoja, ja se ladataan vain suostumuksellanne. Lisätietoja on [tietosuojaselosteessa](/datenschutz).",
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
          titel: "sb-… — kirjautuminen Googlella (teknisesti välttämätön, vain käytettäessä)",
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
            "Tallentaa päätöksenne yhteydenottolomakkeen roskapostisuojasta, jotta suostumuspalkki ei kysy sitä uudelleen jokaisella käynnillä. Tallennettuna on vain kategoria, ajankohta ja versionumero. Arvo ei poistu laitteeltanne eikä sitä siirretä palvelimellemme; se koskee tätä selainta. Jos poistatte sen, palkki kysyy asiaa uudelleen seuraavalla käynnillä.",
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
