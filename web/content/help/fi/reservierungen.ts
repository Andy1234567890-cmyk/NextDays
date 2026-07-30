import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Varaukset",
  description: "Varausten hallinta, siirtäminen ja peruuttaminen.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Varaukset",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Varauksen kirjaaminen käsin",
          excerpt:
            "Näin kirjaat puhelimitse tai sähköpostitse tulleen varauksen suoraan myNextDaysiin.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Milloin kirjaat käsin" },
            {
              type: "p",
              text: "Kaikki varaukset eivät tule portaalin tai oman alustasi kautta — puhelimitse, sähköpostitse tai paikan päällä tulleet pyynnöt tulee kirjata itse, jotta kohde on myNextDaysissä oikein lukittu eikä synny päällekkäistä varausta.",
            },
            {
              type: "steps",
              items: [
                "Avaa Varaukset ja napsauta ”Uusi varaus”.",
                "Valitse kohde — jokainen kohde myNextDaysissä on yksittäinen varattava yksikkö, eli tietty huone tai lomakohde.",
                "Määritä saapumis- ja lähtöpäivä sekä vieraiden määrä.",
                "Tallenna vieraan tiedot (nimi, yhteystiedot, tarvittaessa osoite laskutusta varten).",
                "Tarkista ehdotettu hinta ja säädä sitä tarvittaessa.",
                "Tallenna varaus — yöt lukittuvat heti kalenteriin.",
              ],
            },
            { type: "h2", text: "Maksu ja vahvistus" },
            {
              type: "p",
              text: "Tallentamisen jälkeen sovelletaan samoja maksusääntöjä kuin verkkovarauksissa. Jos maksupalveluntarjoaja on yhdistetty, voit lähettää maksulinkin suoraan vieraalle tai merkitä maksun käsin vastaanotetuksi.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kirjaa erityistoiveet (aikainen saapuminen, lisävuoteet) heti muistiinpanoihin — tiimi näkee ne varauksen aikajanalla.",
            },
            { type: "h2", text: "Kirjaamisen jälkeen" },
            {
              type: "p",
              text: "Uusi varaus näkyy heti kohdassa [Varauksen aikajana](/hilfe/reservierungen/buchungs-zeitleiste) kaikkine seuraavine vaiheineen, kuten viestit, tehtävät ja maksut, samassa paikassa.",
            },
            {
              type: "ul",
              items: [
                "Kalenteri ja portaalit synkronoituvat automaattisesti heti tallennettuasi.",
                "Vieras saa tarvittaessa automaattisen vahvistusviestin.",
                "Ajankohdan muutokset kirjataan kohdasta ”Siirrä varausta”.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "Varauksen aikajana",
          excerpt:
            "Varauksen aikajana kokoaa koko varauksen kulun yhteen paikkaan.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Mitä aikajana näyttää" },
            {
              type: "p",
              text: "Jokaisella varauksella on oma aikajana, joka kuvaa koko kulun kronologisesti — varauspyynnöstä tai portaalituonnista aina uloskirjautumiseen. Näin näet yhdellä silmäyksellä, mitä on jo tapahtunut ja mitä on seuraavaksi tulossa.",
            },
            {
              type: "ul",
              items: [
                "Viestit vieraan kanssa",
                "Tehtävät, esimerkiksi siivous tai valmistelu",
                "Maksut ja laskut",
                "Varatut lisäpalvelut ja lisäedut",
                "Siirrot ja peruutukset",
              ],
            },
            { type: "h2", text: "Aikajanan käyttö arjessa" },
            {
              type: "steps",
              items: [
                "Avaa Varaukset ja valitse haluamasi varaus.",
                "Siirry välilehdelle ”Aikajana”.",
                "Selaa kronologisesti kaikkia tapahtumia.",
                "Käytä pikatoimintoja lähettääksesi viestin tai luodaksesi tehtävän suoraan.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jos varaus siirretään tai perutaan, tämäkin vaihe näkyy aikajanalla — mukaan lukien kalenterista vapautetut yöt.",
            },
            { type: "h2", text: "Miksi tämä on tärkeää" },
            {
              type: "p",
              text: "Koska tiimi, omistaja ja tuki näkevät saman aikajanan, viestien, tehtävien ja maksujen välille ei synny tietoaukkoja. Lisätietoja palautuksista löydät kohdasta [Palautukset](/hilfe/zahlungen/rueckerstattungen), lisäpalveluista kohdasta [Lisäpalvelut](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Varauksen siirtäminen",
          excerpt:
            "Näin siirrät olemassa olevan varauksen uudelle ajanjaksolle sekoittamatta kalenteria.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Tarkista ennen siirtämistä" },
            {
              type: "p",
              text: "Ennen kuin siirrät varausta, tarkista varatun kohteen saatavuus uudella ajanjaksolla. myNextDays vapauttaa alun perin varatut yöt vasta, kun uusi ajanjakso on vahvistettu — näin ei synny aukkoa, jossa kohde virheellisesti näyttäisi vapaalta tai kaksinkertaisesti varatulta.",
            },
            {
              type: "steps",
              items: [
                "Avaa varaus kohdassa Varaukset.",
                "Valitse ”Siirrä” ja syötä uusi ajanjakso.",
                "Tarkista näytetty saatavuus uusille päivämäärille.",
                "Vahvista siirto.",
                "Tarkista, muuttuuko hinta uuden yömäärän myötä, ja säädä sitä tarvittaessa.",
              ],
            },
            { type: "h2", text: "Mitä tapahtuu automaattisesti" },
            {
              type: "p",
              text: "Vahvistuksen jälkeen vanhat yöt vapautetaan kalenterista oikein ja uudet yöt lukitaan, yhdistetyt portaalit päivittyvät. Tapahtuma kirjataan varauksen aikajanalle.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Jos varaus vastaanotettiin portaalin kautta, siirtoon voi siellä liittyä omat säännöt — tarkista portaalin käytännöt ennen suurempia muutoksia.",
            },
            { type: "h2", text: "Maksuerotukset" },
            {
              type: "p",
              text: "Jos hinta muuttuu siirron myötä, säädä maksusäännöt vastaavasti — katso [Maksusäännöt](/hilfe/zahlungen/zahlungsregeln). Lisää varauksen kokonaiskulusta löydät kohdasta [Varauksen aikajana](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Peruutus ja palautus",
          excerpt:
            "Näin peruutat varauksen oikein ja käynnistät tarvittaessa palautuksen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Varauksen peruuttaminen" },
            {
              type: "p",
              text: "Peruutus vapauttaa kohteen varatulle ajanjaksolle heti — sekä omassa kalenterissasi että kaikissa yhdistetyissä portaaleissa. Tarkista ennen peruutusta, mitä peruutusehtoja kyseiseen varaukseen sovelletaan.",
            },
            {
              type: "steps",
              items: [
                "Avaa varaus kohdassa Varaukset.",
                "Valitse ”Peruuta” ja anna syy.",
                "Tarkista ehdotettu palautettava summa.",
                "Vahvista peruutus.",
              ],
            },
            { type: "h2", text: "Palautuksen käynnistäminen" },
            {
              type: "p",
              text: "Jos maksu käsiteltiin yhdistetyn maksupalveluntarjoajan kautta, voit käynnistää palautuksen suoraan varauksesta. Summa ilmoitetaan kyseiselle kohteelle tallennetussa valuutassa. Lisätietoja kulusta löydät kohdasta [Palautukset](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Täysi tai osittainen palautus mahdollinen",
                "Tapahtuma näkyy varauksen aikajanalla",
                "Portaalivarauksissa sovelletaan lisäksi kyseisen portaalin sääntöjä",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Peruutusta ei voi perua. Tarkista ajanjakso ja vieras huolellisesti ennen vahvistamista.",
            },
            { type: "h2", text: "Peruutuksen jälkeen" },
            {
              type: "p",
              text: "Kohde on heti taas varattavissa, ja varaukseen liittyvät avoimet tehtävät — esimerkiksi valmistelu — merkitään automaattisesti tarpeettomiksi. Koko tapahtuma pysyy jäljitettävissä kohdassa [Varauksen aikajana](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Sisään- ja uloskirjautuminen",
          excerpt: "Näin dokumentoit vieraan saapumisen ja lähdön myNextDaysissä.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Sisäänkirjautumisen kirjaaminen" },
            {
              type: "p",
              text: "Sisäänkirjautuminen merkitsee oleskelun alkua ja on erityisen hyödyllinen itsenäisessä sisäänkirjautumisessa tai tiimin luovuttaessa avaimen, jotta jokaisen varauksen tila pysyy ajan tasalla.",
            },
            {
              type: "steps",
              items: [
                "Avaa varaus kohdassa Varaukset.",
                "Valitse ”Sisäänkirjautuminen” saapumispäivänä.",
                "Tallenna tarvittaessa muistiinpano, esimerkiksi ajankohta tai erityispiirteet.",
              ],
            },
            { type: "h2", text: "Uloskirjautuminen ja luovutus" },
            {
              type: "p",
              text: "Uloskirjautumisessa merkitset oleskelun päättyneeksi. Tämä käynnistää monissa tapauksissa automaattisesti kohteen siivoustehtävän, jotta se on valmis seuraavaa varausta varten.",
            },
            {
              type: "ul",
              items: [
                "Sisään- ja uloskirjautuminen ovat osa varauksen aikajanaa",
                "Ajat voidaan määrittää kohdekohtaisesti kohteen asetuksissa",
                "Mobiilikäytössä tiimi voi kirjata sisään- ja uloskirjautumisen suoraan paikan päällä",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Väliin jäänyt uloskirjautuminen ei automaattisesti estä seuraavia tehtäviä — tarkista myöhässä olevat tilat säännöllisesti kohdassa Varaukset.",
            },
            { type: "h2", text: "Yhteys tehtäviin" },
            {
              type: "p",
              text: "Sisään- ja uloskirjautuminen liittyvät tiiviisti tehtäviin ja aikajanaan. Lisää koko kulusta löydät kohdasta [Varauksen aikajana](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Lisäpalvelut",
          excerpt:
            "Näin tarjoat vieraille varattavia lisäpalveluita, kuten aamiaista tai kuljetusta, ja kirjaat ne varaukseen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Mitä lisäpalvelut ovat" },
            {
              type: "p",
              text: "Lisäpalvelut ovat varaukseen liitettäviä valinnaisia lisäetuja — esimerkiksi aamiainen, aikainen saapuminen, kuljetus tai myöhäinen uloskirjautuminen. Ne tallennetaan kohdekohtaisesti, ja vieras itse tai tiimisi voi lisätä ne varaukseen.",
            },
            {
              type: "steps",
              items: [
                "Avaa kohde ja luo kohdassa ”Lisäpalvelut” haluamasi lisäedut hintoineen.",
                "Avaa olemassa oleva varaus kohdassa Varaukset.",
                "Valitse ”Lisää lisäpalvelu” ja valitse haluamasi palvelu.",
                "Vahvista palvelun määrä ja ajankohta.",
              ],
            },
            { type: "h2", text: "Laskutus" },
            {
              type: "p",
              text: "Lisäpalvelut laskutetaan kyseisen kohteen valuutassa ja näkyvät laskulla omana rivinä. Jo maksetut lisäpalvelut voidaan palauttaa suhteutetusti peruutuksen yhteydessä.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Tallenna suositut lisäpalvelut kerran keskitetysti kohteeseen — näin ne voidaan lisätä jokaiseen uuteen varaukseen muutamalla napsautuksella.",
            },
            { type: "h2", text: "Näkyvyys vieraalle" },
            {
              type: "p",
              text: "Jos alusta tai oma verkkosivusto on aktiivinen, vieraat voivat usein valita sopivat lisäpalvelut jo varauksen yhteydessä. Jokainen lisäys näkyy sen jälkeen kohdassa [Varauksen aikajana](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Lisäpalvelut voidaan nimetä ja hinnoitella yksilöllisesti kohdekohtaisesti",
                "Jälkikäteinen lisääminen on mahdollista milloin tahansa varauksen kautta",
                "Peruutetut lisäpalvelut palautetaan suhteutetusti",
              ],
            },
          ],
        },
      ],
    },
  ],
};
