import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Maksut ja laskut",
  description: "Maksupalveluntarjoajat, maksusäännöt ja laskut.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Maksut",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Maksupalveluntarjoajan yhdistäminen",
          excerpt:
            "Näin yhdistät Stripen tai PayPalin myNextDaysiin, jotta maksut käsitellään automaattisesti.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Käytettävissä olevat palveluntarjoajat" },
            {
              type: "p",
              text: "myNextDays käsittelee maksut yhdistettyjen maksupalveluntarjoajien kautta. Tällä hetkellä tuettuina ovat Stripe ja PayPal — voit yhdistää yhden tai molemmat palveluntarjoajat samanaikaisesti ja käyttää niitä kohteen tai vieraan toiveen mukaan.",
            },
            {
              type: "steps",
              items: [
                "Avaa Tili ja siirry osioon ”Maksut”.",
                "Valitse haluamasi palveluntarjoaja — Stripe tai PayPal.",
                "Seuraa yhdistämisohjeita ja kirjaudu palveluntarjoajalle tai luo uusi tili.",
                "Vahvista yhteys — tila vaihtuu ”yhdistetty”-tilaan.",
              ],
            },
            { type: "h2", text: "Mitä sen jälkeen tapahtuu" },
            {
              type: "p",
              text: "Kun palveluntarjoaja on yhdistetty, voit lähettää maksulinkkejä, veloittaa ennakkomaksuja ja käynnistää palautuksia suoraan varauksesta. Kaikki summat käsitellään kyseiselle kohteelle tallennetussa valuutassa.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ilman yhdistettyä palveluntarjoajaa voit merkitä maksut vain käsin vastaanotetuiksi — automaattinen veloitus ei silloin ole mahdollista.",
            },
            { type: "h2", text: "Useita kohteita, yksi palveluntarjoaja" },
            {
              type: "p",
              text: "Kerran muodostettu yhteys koskee koko tiliä kaikkien kohteidesi osalta. Miten veloitus tarkalleen ottaen etenee, määrität kohdassa [Maksusäännöt](/hilfe/zahlungen/zahlungsregeln). Maksut sinulle tapahtuvat sen jälkeen kyseisen palveluntarjoajan kautta, katso [Tilitykset](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe sopii korttimaksuihin ja moniin paikallisiin maksutapoihin",
                "PayPal tarjoaa vieraille tutun vaihtoehdon",
                "Molemmat palveluntarjoajat voidaan irrottaa ja yhdistää uudelleen toisistaan riippumatta",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Maksusäännöt",
          excerpt: "Määritä, milloin varauksen ennakkomaksu ja loppumaksu erääntyvät.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Ennakkomaksu ja loppumaksu" },
            {
              type: "p",
              text: "Maksusäännöt määrittävät, miten varaus käsitellään taloudellisesti — esimerkiksi ennakkomaksu varauksen yhteydessä ja loppumaksu ennen saapumista, tai koko summa heti. Säännöt koskevat kohdetta ja niitä voi muuttaa milloin tahansa.",
            },
            {
              type: "steps",
              items: [
                "Avaa kohde ja siirry osioon ”Maksusäännöt”.",
                "Valitse, peritäänkö ennakkomaksu, ja määritä osuus.",
                "Määritä, milloin loppumaksu erääntyy, esimerkiksi tietty määrä päiviä ennen saapumista.",
                "Tallenna asetukset.",
              ],
            },
            { type: "h2", text: "Automaattinen veloitus" },
            {
              type: "p",
              text: "Jos maksupalveluntarjoaja on yhdistetty, myNextDays veloittaa ennakkomaksun ja loppumaksun automaattisesti tallennettuna ajankohtana ja ilmoittaa vieraalle etukäteen viestillä.",
            },
            {
              type: "note",
              variant: "info",
              text: "Maksusäännöt vaikuttavat vain varauksiin, joilla on yhdistetty maksupalveluntarjoaja. Ilman palveluntarjoajaa merkitset maksut käsin varauksessa.",
            },
            { type: "h2", text: "Erot kanavittain" },
            {
              type: "p",
              text: "Portaaleissa voi poikkeuksellisesti olla voimassa niiden oma maksukäsittely — tarkista tässä tapauksessa kyseisen portaalin ehdot. Omalla alustalla tai verkkosivustolla tehdyissä varauksissa sovelletaan aina täällä tallennettuja sääntöjäsi. Lisätietoja palveluntarjoajan yhdistämisestä löydät kohdasta [Maksupalveluntarjoajan yhdistäminen](/hilfe/zahlungen/zahlungsanbieter-verbinden), laskutuksesta kohdasta [Laskujen luominen](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Ennakkomaksu voi olla kiinteä summa tai prosenttiosuus",
                "Loppumaksun eräpäivä valittavissa vapaasti",
                "Muutokset vaikuttavat vain uusiin varauksiin, eivät taannehtivasti",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Laskujen luominen",
          excerpt: "Näin luot varaukselle laskun oikealla laskutusosoitteella.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Laskun luominen" },
            {
              type: "p",
              text: "Jokaiselle varaukselle voidaan luoda lasku — vieraalle itselleen tai eri yritykselle, jos varaus tehtiin liiketoiminnan yhteydessä.",
            },
            {
              type: "steps",
              items: [
                "Avaa varaus kohdassa Varaukset.",
                "Valitse ”Luo lasku”.",
                "Tarkista tai täydennä laskutusosoite.",
                "Tarkista listatut rivit — yöpyminen, lisäpalvelut, maksut.",
                "Luo lasku ja lähetä se vieraalle.",
              ],
            },
            { type: "h2", text: "Laskutusosoitteen ylläpito" },
            {
              type: "p",
              text: "Voit tallentaa laskutusosoitteen suoraan varaukseen tai antaa vieraan täydentää sen varausvahvistuksen kautta jälkikäteen. Ilman täydellistä osoitetta tietyissä maissa ei voida antaa lain mukaista laskua.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Tarkista yritysasiakkaiden kohdalla erityisesti yrityksen nimi ja osoite — jälkikäteiset korjaukset vaativat korjauslaskun.",
            },
            { type: "h2", text: "Summat ja valuutta" },
            {
              type: "p",
              text: "Kaikki rivit ilmoitetaan kohteelle tallennetussa valuutassa. Jo suoritetut maksut merkitään laskulle maksusuorituksena. Miten ennakkomaksu ja loppumaksu muodostuvat, lue kohdasta [Maksusäännöt](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Laskut voidaan ladata PDF-muodossa",
                "Korjauslaskut ovat mahdollisia milloin tahansa muutosten yhteydessä",
                "Lisäpalvelut näkyvät omana rivinään",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Palautukset",
          excerpt:
            "Näin palautat maksun kokonaan tai osittain, kun varaus perutaan tai sitä muutetaan.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Milloin palautus on tarpeen" },
            {
              type: "p",
              text: "Palautus on tyypillisesti tarpeen peruutuksen yhteydessä, mutta se voi olla tarpeen myös jälkikäteisen hinnanmuutoksen tai peruutetun lisäpalvelun yhteydessä.",
            },
            {
              type: "steps",
              items: [
                "Avaa kyseinen varaus kohdassa Varaukset.",
                "Valitse ”Palautus” varauksen maksuosiossa.",
                "Syötä palautettava summa — kokonaan tai osittain.",
                "Vahvista palautus.",
              ],
            },
            { type: "h2", text: "Kulku maksupalveluntarjoajan kautta" },
            {
              type: "p",
              text: "Palautus suoritetaan maksussa käytetyn palveluntarjoajan — Stripen tai PayPalin — kautta ja palautetaan suoraan vieraan alkuperäiselle maksutavalle. Tapahtuma kirjataan automaattisesti varauksen aikajanalle.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ilman yhdistettyä maksupalveluntarjoajaa palautusta ei voida käynnistää automaattisesti — sovi tässä tapauksessa palautuksesta suoraan vieraan kanssa.",
            },
            { type: "h2", text: "Vaikutus provisioihin" },
            {
              type: "p",
              text: "Jo laskutetut markkinapaikan tai portaalin provisiot mukautetaan palautuksen yhteydessä suhteutetusti. Lisää tästä kohdassa [Provisioiden ymmärtäminen](/hilfe/zahlungen/provisionen-verstehen). Lisätietoja itse peruutuksesta löydät kohdasta [Peruutus ja palautus](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Osittaiset palautukset ovat mahdollisia yksittäisille riveille",
                "Käsittelyn tila näkyy varauksessa milloin tahansa",
                "Palautukset kulkevat yksinomaan alun perin käytetyn palveluntarjoajan kautta",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Tilitykset",
          excerpt:
            "Näin saat varaustesi tuotot tilitettynä yhdistetyiltä maksupalveluntarjoajilta.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Miten tilitykset toimivat" },
            {
              type: "p",
              text: "Saapuvat maksut kertyvät ensin yhdistetylle maksupalveluntarjoajalle. Sieltä tilitys tapahtuu tallennetulle pankkitilillesi palveluntarjoajan tavanomaisen aikataulun mukaisesti.",
            },
            {
              type: "steps",
              items: [
                "Avaa Tili ja siirry osioon ”Maksut”.",
                "Tarkista kohdasta ”Tilitykset” kyseisen palveluntarjoajan tila.",
                "Avaa tarvittaessa palveluntarjoajan yksityiskohtainen näkymä koko tilityshistoriaa varten.",
              ],
            },
            { type: "h2", text: "Mitä vähennetään ennen tilitystä" },
            {
              type: "p",
              text: "Ennen tilitystä otetaan huomioon aiheutuvat markkinapaikan ja portaalin provisiot sekä palveluntarjoajan maksut. Tilitetty summa ei siis välttämättä vastaa alkuperäistä varaussummaa.",
            },
            {
              type: "note",
              variant: "info",
              text: "Vähennysten tarkan rakenteen selittää [Provisioiden ymmärtäminen](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Useita kohteita ja omistajia" },
            {
              type: "p",
              text: "Jos hallinnoit kohteita eri omistajille, tilitykset kohdistetaan tallennettujen omistajatilitysten mukaisesti. Tarkista poikkeamissa ensin taustalla olevien varausten tila kohdassa Varaukset.",
            },
            {
              type: "ul",
              items: [
                "Tilitysaikataulun ja -tavan määrittää kyseinen palveluntarjoaja",
                "Pidätetyt summat, esimerkiksi käynnissä olevien palautusten yhteydessä, on merkitty",
                "Täydellinen historia on nähtävissä suoraan palveluntarjoajalla",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Provisioiden ymmärtäminen",
          excerpt:
            "Yleiskatsaus siihen, miten markkinapaikan ja portaalin provisiot muodostuvat ja missä ne laskutetaan.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            { type: "h2", text: "Kaksi provisiotyyppiä" },
            {
              type: "p",
              text: "myNextDaysin kautta tehdyissä varauksissa voi olla kahdenlaisia provisioita: markkinapaikan provisio omalla alustalla tehdyistä varauksista sekä portaaliprovisiot varauksista, jotka tulevat yhdistettyjen portaalien, kuten Bookingin tai Airbnbn, kautta. Molemmat ovat toisistaan riippumattomia ja voivat vaihdella varauksen myyntiväylän mukaan.",
            },
            {
              type: "ul",
              items: [
                "Markkinapaikan provisio: peritään myNextDays-alustan kautta tehdyistä varauksista",
                "Portaaliprovisio: kyseisen portaalin omien ehtojen mukaan laskettu",
                "Suoravaraukset omalla verkkosivustollasi ovat näistä riippumattomia",
              ],
            },
            { type: "h2", text: "Missä provisiot näkyvät" },
            {
              type: "steps",
              items: [
                "Avaa Tili ja siirry osioon ”Laskutus”.",
                "Valitse haluamasi kuukausi.",
                "Tarkista erittely varauksittain provisioineen.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Sen, minkä kanavan kautta varaus tuli, näet suoraan varauksesta itsestään — se selittää, mikä provisio kussakin tapauksessa on sovellettu.",
            },
            { type: "h2", text: "Yhteys tilityksiin" },
            {
              type: "p",
              text: "Provisiot vähennetään varaussummasta ennen tilitystä. Lisätietoja tilitysprosessista löydät kohdasta [Tilitykset](/hilfe/zahlungen/auszahlungen). Palautuksen yhteydessä siihen liittyvä provisio korjataan suhteutetusti — koko varauksen kulun näyttää [Varauksen aikajana](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
