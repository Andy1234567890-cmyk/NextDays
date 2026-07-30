import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Kanavanhallinta",
  description: "Portaalien ja kanavanhallinnan hallitseminen.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Kanavanhallinta",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Ensimmäisen portaalin yhdistäminen",
          excerpt: "Näin avaat ensimmäistä kertaa portaalin kohteelle.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne: olet perustanut kohteen, mutta et ole vielä yhdistänyt portaalia",
            },
            {
              type: "p",
              text: "Kohteesi on täysin valmis myNextDaysissä, mutta se ei vielä näy missään portaalissa, kuten Booking.com tai Airbnb. Ennen kuin portaali hyväksyy kohteen, tilisi tarvitsee kertaalleen koko tiliä koskevan portaaliyhteyden — sen jälkeen jokaiselle uudelle kohteelle riittää enää kohdistus.",
            },
            {
              type: "steps",
              items: [
                "Avaa /konto, osio ”Portaalit ja kanavanhallinta”, ja ota koko tilin yhteys käyttöön yrityksesi tiedoilla",
                "Avaa sen jälkeen kohde kohdassa /objekte ja siirry välilehdelle ”Portaalit”",
                "Valitse haluamasi portaali ja kohdista se sopivaan huone- tai tarjoustyyppiin",
                "Tarkista kuvat, varustelu, hinnat ja peruutusehdot — portaalit vaativat täydelliset tiedot",
                "Aktivoi näkyvyys; tila vaihtuu portaalin tarkistuksen jälkeen ”Yhdistetty”-tilaan",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Koko tilin yhteyden otat käyttöön vain kerran. Lisätietoja kohdista [Booking.comin yhdistäminen](/hilfe/portale-kanalmanager/booking-verbinden) ja [Airbnbn yhdistäminen](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Booking.comin yhdistäminen",
          excerpt: "Näin teet kohteesta varattavan Booking.comissa kanavanhallinnan kautta.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne: kohteesi tulee näkyä lisäksi Booking.comissa",
            },
            {
              type: "p",
              text: "Booking.com on yksi portaaleista, jotka yhdistetään kanavanhallinnan kautta. Edellytyksenä on koko tilin portaaliyhteys — jos se on jo käytössä, Booking.comia varten tarvitset enää kohdistuksen kohdetta kohden.",
            },
            {
              type: "steps",
              items: [
                "Avaa kohde kohdassa /objekte, välilehti ”Portaalit”",
                "Valitse ”Booking.com” saatavilla olevien portaalien listasta",
                "Kohdista sopiva huone- tai tarjoustyyppi ja vahvista vähintään yksi hintasuunnitelma hinnalla ja peruutusehdoilla",
                "Tallenna voimassa oleva maksutapa provisioiden laskutusta varten",
                "Aktivoi näkyvyys Booking.comille",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Booking.comin tekemä julkaisu voi kestää muutaman tunnin. Välilehden ”Portaalit” tila näyttää, kun yhteys on aktiivinen.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Airbnbn yhdistäminen",
          excerpt: "Näin teet kohteesta varattavan Airbnbssa kanavanhallinnan kautta.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne: kohteesi tulee näkyä lisäksi Airbnbssa",
            },
            {
              type: "p",
              text: "Airbnb yhdistetään kuten mikä tahansa muu portaali koko tiliä koskevan yhteyden kautta. Kun se on käytössä, aktivoit Airbnbn kohdekohtaisesti kohdistuksen avulla — riippumatta siitä, onko kohde jo näkyvissä Booking.comissa tai muissa portaaleissa.",
            },
            {
              type: "steps",
              items: [
                "Avaa kohde kohdassa /objekte, välilehti ”Portaalit”",
                "Valitse ”Airbnb” saatavilla olevien portaalien listasta",
                "Vahvista kohteen kategoria ja kohdistettu tarjoustyyppi",
                "Täydennä kuvat, varustelu ja talon säännöt — Airbnb vaatii täydelliset tiedot ennen julkaisua",
                "Aktivoi näkyvyys Airbnblle",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ilman tallennettuja peruutusehtoja ja talon sääntöjä Airbnb hylkää julkaisun. Täydennä nämä tiedot ensin kohteessa.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Hintojen pitäminen synkronoituna kaikissa portaaleissa",
          excerpt: "Yksi kalenteri riittää — kanavanhallinta jakaa hinnanmuutokset automaattisesti kaikkiin portaaleihin.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne: muutat hintaa ja haluat varmistaa, että se täsmää kaikkialla",
            },
            {
              type: "p",
              text: "Ylläpidät hintoja yksinomaan kohteen myNextDays-kalenterissa — et koskaan erikseen itse portaaleissa. Kanavanhallinta siirtää jokaisen muutoksen automaattisesti kaikkiin portaaleihin, joihin kohde on aktiivisesti kohdistettu.",
            },
            {
              type: "steps",
              items: [
                "Avaa kohteen hintakalenteri tai hintasuunnitelmat",
                "Säädä päivähintaa, vähimmäisoleskelua tai saapumis-/lähtörajoitusta",
                "Tallenna muutos — se vaikuttaa ensin sisäisesti kohteessa",
                "Tarkista välilehdellä ”Portaalit”, että kaikki halutut portaalit ovat edelleen aktiivisesti kohdistettuina",
                "Odota muutama minuutti, kunnes muutos on siirtynyt portaaleihin",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Älä koskaan syötä hintoja suoraan portaaliin — tällaiset muutokset ylikirjoitetaan seuraavassa täsmäytyksessä myNextDays-kalenterista.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Portaalivarauksen tuominen",
          excerpt: "Portaalivaraukset päätyvät automaattisesti kalenteriin — näin tarkistat, että tuonti onnistui.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne: vieras on varannut portaalin kautta, varauksen tulee näkyä myNextDaysissä",
            },
            {
              type: "p",
              text: "Kun vieras varaa Booking.comin, Airbnbn tai muun yhdistetyn portaalin kautta, kanavanhallinta tuo varauksen automaattisesti — sinun ei tarvitse siirtää mitään käsin. Tämä kulku kuvaa, miten seuraat ja vahvistat tuonnin.",
            },
            {
              type: "steps",
              items: [
                "Avaa kyseisen kohteen kalenteri tai varauslista",
                "Etsi uusi varaus — siinä on portaalin alkuperämerkintä, esimerkiksi Booking.com tai Airbnb",
                "Tarkista vierastietojen, ajanjakson ja hinnan täydellisyys",
                "Tarkista, että varatut yöt näkyvät suljettuina kaikilla muilla kanavilla",
                "Avaa tarvittaessa varauksen tiedot käsitelläksesi lisäpalveluita tai vieraan viestejä",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jos vieras peruuttaa portaalin kautta tai muuttaa ajanjaksoa, myös se siirtyy automaattisesti ja yöt vapautetaan uudelleen.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Päällekkäisen varauksen ratkaiseminen",
          excerpt: "Näin toimit, jos sama yö on poikkeuksellisesti myyty kahdella kanavalla.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne: kaksi varausta menee päällekkäin samalle kohteelle ja samoille öille",
            },
            {
              type: "p",
              text: "Kanavanhallinta sulkee varatut yöt normaalisti heti kaikilla kanavilla. Päällekkäinen varaus voi silti syntyä, esimerkiksi kahden portaalin samanaikaisen varauksen yhteydessä tai käsin luodun varauksen törmätessä portaalivaraukseen.",
            },
            {
              type: "steps",
              items: [
                "Avaa kohteen kalenteri ja tunnista molemmat päällekkäiset varaukset",
                "Tarkista molempien varausten varausajankohta ja alkuperämerkintä",
                "Ota yhteyttä myöhemmin saapuneeseen vieraaseen ja tarjoa vaihtoehtoista kohdetta tai ajanjaksoa",
                "Peru pitämätön varaus kyseisessä portaalissa, ei vain myNextDaysissä",
                "Aseta kyseisille öille sen jälkeen Stop-Sell, kunnes tapaus on täysin selvitetty",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Peru portaalivaraus aina portaalin kautta itse — pelkkä peruutus myNextDaysissä vapauttaa yön sisäisesti, mutta ei ilmoita siitä luotettavasti portaalille.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Portaalin väliaikainen keskeyttäminen",
          excerpt: "Näkyvyyden kytkeminen pois portaaleittain menettämättä kohdistusta.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne: kohteen ei tule olla väliaikaisesti varattavissa yhdessä portaalissa",
            },
            {
              type: "p",
              text: "Näkyvyys voidaan kytkeä erikseen portaaleittain — riippumatta verkkosivustosta ja alustan markkinapaikasta. Jos haluat esimerkiksi keskeyttää Airbnbn lyhyeksi aikaa mutta jättää Booking.comin käyntiin, poista käytöstä vain tämä yksi kanava.",
            },
            {
              type: "steps",
              items: [
                "Avaa kohde kohdassa /objekte, välilehti ”Portaalit”",
                "Etsi sen portaalin merkintä, jonka haluat keskeyttää",
                "Kytke näkyvyys pois tälle portaalille",
                "Tallenna — muutos vaikuttaa muutaman minuutin kuluessa, kohde katoaa tämän portaalin hakutuloksista",
                "Kytke näkyvyys takaisin päälle, kun kohteen tulee taas olla varattavissa",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kohdistus säilyy keskeytyksen ajan — sinun ei tarvitse perustaa yhteyttä portaaliin myöhemmin uudelleen. Kaikkien kanavien täydelliseen sulkemiseen käytä sen sijaan Stop-Selliä.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Kohteen kohdistuksen tarkistaminen",
          excerpt: "Näin tarkistat, onko kohteesi edelleen oikein kohdistettu oikeaan tarjoustyyppiin portaalissa.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne: hinnat tai saatavuus eivät enää täsmää portaalissa myNextDaysin kanssa",
            },
            {
              type: "p",
              text: "Jos portaalin näyttämä tieto poikkeaa myNextDays-kalenteristasi, syynä on usein virheellinen tai katkennut kohdistus — kohteesi ja portaalin huone- tai tarjoustyypin välinen yhteys.",
            },
            {
              type: "steps",
              items: [
                "Avaa kohde kohdassa /objekte, välilehti ”Portaalit”",
                "Tarkista kyseisen portaalin tila — sen tulisi näyttää ”Yhdistetty”, ei ”Virhe” tai ”Odottaa”",
                "Tarkista, vastaako portaalissa kohdistettu huone- tai tarjoustyyppi edelleen todellista kohdetta",
                "Poikkeaman yhteydessä: pura kohdistus ja tee se uudelleen, aktivoi näkyvyys sen jälkeen uudelleen",
                "Odota korjauksen jälkeen muutama minuutti ja tarkista hinnat ja saatavuus uudelleen portaalissa",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Kohde voi olla kohdistettuna useaan portaaliin samanaikaisesti — tarkista poikkeamien yhteydessä kohdennetusti vain kyseinen portaali, älä kaikkia kerralla.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Eri hintasuunnitelmat portaaleittain",
          excerpt: "Miten osoitat portaalille oman hintasuunnitelman vaikuttamatta muihin kanaviin.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne: haluat tarjota portaalissa eri hinnan kuin muilla kanavilla",
            },
            {
              type: "p",
              text: "Hintasuunnitelmat voidaan kohdistaa erikseen portaaleittain, esimerkiksi ei-peruutettavissa oleva hintasuunnitelma yhdelle portaalille ja joustava toiselle. Perushinnat ylläpidetään keskitetysti kohteessa, ja kohdistus määrittää, mikä hintasuunnitelma menee mihinkin portaaliin.",
            },
            {
              type: "steps",
              items: [
                "Luo kohteeseen lisähintasuunnitelma halutuilla ehdoilla (hinta, peruutusehdot, vähimmäisoleskelu)",
                "Avaa välilehti ”Portaalit” ja valitse kyseinen portaali",
                "Kohdista kohdistuksessa uusi hintasuunnitelma tälle portaalille",
                "Jätä muut portaalit muuttumattomiksi niiden nykyisellä hintasuunnitelmalla",
                "Tallenna ja tarkista muutaman minuutin kuluttua hinnan näyttäminen kyseisessä portaalissa",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jokainen hintasuunnitelma siirtyy itsenäisesti — yhden hintasuunnitelman muutos ei vaikuta portaaleihin, jotka on kohdistettu toiseen hintasuunnitelmaan.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Yleisten portaalivirheiden korjaaminen",
          excerpt: "Tyypilliset syyt, kun portaali hylkää kohteen tai synkronointi takkuaa.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne: portaalin tila näyttää virheen tai kohdetta ei hyväksytä",
            },
            {
              type: "p",
              text: "Portaalit hylkäävät yhteyden yleensä puuttuvien perustietojen tai puutteellisten kohdetietojen vuoksi. Käy läpi yleisimmät syyt järjestyksessä ennen kuin otat yhteyttä tukeen.",
            },
            {
              type: "steps",
              items: [
                "Tarkista kohdassa /konto, ovatko osoite, verotustiedot ja yhteystiedot täydellisesti tallennettuina",
                "Tarkista kohteessa, ovatko kuvaus, kuvat, varustelu ja vähintään yksi hintasuunnitelma täydellisiä",
                "Tarkista, onko voimassa oleva maksutapa tallennettu provisioita varten",
                "Avaa välilehti ”Portaalit” ja lue tarkka virheilmoitus kyseisen portaalin vierestä",
                "Korjaa mainittu puute ja aktivoi näkyvyys uudelleen",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Portaalivirhe koskee aina vain tätä yhtä portaalia — muut kanavat jatkavat siitä riippumatta, kunhan niiden omat vaatimukset täyttyvät.",
            },
          ],
        },
      ],
    },
  ],
};
