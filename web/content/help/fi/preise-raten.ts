import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Hinnat ja hintasuunnitelmat",
  description: "Hintasuunnitelmat, sesonkihinnat ja dynaamiset hinnat.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Hinnoittelu",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Perushinta ja valuutta",
          excerpt: "Näin määrität perushinnan ja kohdistat kohteellesi oikean valuutan.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Jokainen kohde myNextDaysissä on täsmälleen yksi varattava yksikkö — yksittäinen huone tai lomakohde. Tälle yksikölle tallennat perushinnan sekä keskitetyn valuutan, joka koskee koko kohdetta.",
            },
            { type: "h2", text: "Valuutan määrittäminen keskitetysti" },
            {
              type: "p",
              text: "Kohteen valuutta asetetaan kerran kohdetta kohden ja koskee automaattisesti kaikkia hintasuunnitelmia, jotka perustat kyseiselle kohteelle. Erillistä valuutan oletusarvoa ei ole — jos valuutta puuttuu, hintoja ei voi tallentaa.",
            },
            {
              type: "steps",
              items: [
                "Avaa kohteesi kohdasta ”Kohteet”.",
                "Siirry välilehdelle ”Hinnat”.",
                "Valitse kohdasta ”Kohteen valuutta” sopiva valuutta.",
                "Kirjaa perushinta vakiokapasiteetille.",
                "Tallenna muutokset.",
              ],
            },
            { type: "h2", text: "Mitä tapahtuu valuutan muuttuessa" },
            {
              type: "p",
              text: "Jos muutat kohteen valuuttaa jälkikäteen, se vaikuttaa kaikkiin kyseisen kohteen olemassa oleviin hintasuunnitelmiin, koska ne ylläpidetään aina kohteen valuutassa. Tarkista hintasi tämän jälkeen ennen kuin siirrät ne uudelleen portaaleihin.",
            },
            {
              type: "ul",
              items: [
                "Kohteella on täsmälleen yksi valuutta — ei useita hintasuunnitelmaa kohden.",
                "Perushinta on lähtöarvo johdetuille hinnoille.",
                "Summat näytetään aina tallennetussa kohteen valuutassa.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ilman tallennettua valuuttaa hintaa ei voi tallentaa eikä hintaa voi siirtää portaaleihin. Tarkista tämä ensin, jos hinnanmuutos epäonnistuu.",
            },
            {
              type: "note",
              variant: "info",
              text: "Lisää johdetuista hinnoista löydät kohdasta [Johdetut hintasuunnitelmat](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Hintasuunnitelmien perustaminen",
          excerpt: "Hintasuunnitelmat yhdistävät hinnan, peruutusehdot ja ateriapalvelun kohteelle.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Hintasuunnitelma määrittää, millä ehdoilla kohde voidaan varata: hinta, peruutussäännöt, ateriapalvelu ja vähimmäisyöpymismäärä. Kohteella voi olla useita hintasuunnitelmia samanaikaisesti, esimerkiksi joustava ja ei-peruutettavissa oleva suunnitelma.",
            },
            { type: "h2", text: "Uuden hintasuunnitelman luominen" },
            {
              type: "steps",
              items: [
                "Avaa kohde ja siirry välilehdelle ”Hinnat”.",
                "Napsauta ”Luo uusi hintasuunnitelma”.",
                "Anna kuvaava nimi, esim. ”Joustava” tai ”Ei peruutettavissa”.",
                "Määritä, onko suunnitelma perushinta vai johdettu hinta.",
                "Tallenna peruutusehdot ja ateriapalvelu.",
                "Tallenna ja aktivoi hintasuunnitelma.",
              ],
            },
            { type: "h2", text: "Perushinta vs. muut hintasuunnitelmat" },
            {
              type: "p",
              text: "Perusta ensin perushintasi (usein kutsutaan nimellä ”BAR”, Best Available Rate). Kaikkia muita hintasuunnitelmia voidaan joko ylläpitää itsenäisesti tai johtaa tästä perushinnasta.",
            },
            {
              type: "ul",
              items: [
                "Perushinta: käsin ylläpidetty yön perushinta.",
                "Muut hintasuunnitelmat: itsenäisiä tai lisä/vähennys perushintaan.",
                "Jokainen hintasuunnitelma voidaan siirtää erikseen portaaleihin.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Pidä hintasuunnitelmien määrä kohdetta kohden hallittavana — liian monta vaihtoehtoa vaikeuttaa vieraiden vertailua ja lisää ylläpitotyötä.",
            },
            {
              type: "note",
              variant: "info",
              text: "Lisätietoja lisistä ja vähennyksistä löydät kohdasta [Johdetut hintasuunnitelmat](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Johdetut hintasuunnitelmat",
          excerpt: "Johdetut hintasuunnitelmat lasketaan automaattisesti perushinnasta.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Johdettu hinta on hintasuunnitelma, jonka hintaa ei ylläpidetä käsin, vaan se lasketaan automaattisesti perushinnasta — kiinteänä lisänä, vähennyksenä tai prosenttiosuutena. Tämä säästää ylläpitotyötä, koska perushinnan muutos päivittää automaattisesti kaikki johdetut suunnitelmat.",
            },
            { type: "h2", text: "Tyypillinen esimerkki" },
            {
              type: "p",
              text: "Yleinen malli on aamiaisen sisältävä suunnitelma, joka johdetaan ilman ateriapalvelua olevasta perushinnasta: aamiaisen hinta määritetään lisänä yötä ja henkilöä kohden perushintaan. Kun muutat perushintaa, aamiaisen hinta mukautuu automaattisesti.",
            },
            { type: "h2", text: "Johdetun hinnan käyttöönotto" },
            {
              type: "steps",
              items: [
                "Avaa haluamasi hintasuunnitelma välilehdellä ”Hinnat”.",
                "Valitse hintalähteeksi ”Johdettu kohteesta …” ja siihen liittyvä perushinta.",
                "Määritä, onko erotus kiinteä summa vai prosenttiosuus.",
                "Määritä, onko kyseessä lisä vai vähennys.",
                "Tallenna kohdistus.",
              ],
            },
            {
              type: "ul",
              items: [
                "Lisä: esim. ateriapalvelu, myöhempi peruutettavuus.",
                "Vähennys: esim. ei-peruutettavissa oleva suunnitelma hintaedulla.",
                "Perushinta pysyy ainoana käsin ylläpidettävänä lähteenä.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Johdettua hintaa ei voi samanaikaisesti ylikirjoittaa käsin. Poista ensin johtaminen, jos haluat asettaa yksittäisen hinnan poikkeavasti.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Sesonki- ja viikonloppuhinnat",
          excerpt: "Sesonkijaksojen ja viikonloppujen hintojen kohdennettu säätäminen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Kysyntä vaihtelee vuoden ja viikon sisällä. Sesonki- ja viikonloppuhinnoilla säädät perushintaa tietyille jaksoille tai viikonpäiville ilman, että joudut käymään kalenterissa päivä kerrallaan.",
            },
            { type: "h2", text: "Sesonkijakson perustaminen" },
            {
              type: "steps",
              items: [
                "Avaa kohteessa välilehti ”Hinnat” ja osio ”Sesonkihinnat”.",
                "Luo uusi jakso alkamis- ja päättymispäivämäärällä.",
                "Tallenna hinta tai prosentuaalinen poikkeama perushinnasta kyseiselle jaksolle.",
                "Tallenna sesonkijakso.",
              ],
            },
            { type: "h2", text: "Viikonloppuhinnat" },
            {
              type: "p",
              text: "Lisäksi voit lisätä yksittäisille viikonpäiville, esimerkiksi perjantaille ja lauantaille, oman lisän. Tämä lisä vaikuttaa lisäksi kulloinkin voimassa olevaan sesonki- tai perushintaan.",
            },
            {
              type: "ul",
              items: [
                "Sesonkihinnat vaikuttavat yhtenäisiin jaksoihin.",
                "Viikonloppuhinnat vaikuttavat viikonpäivittäin, sesongista riippumatta.",
                "Molempia sääntöjä voi yhdistää.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jos useat sesonkijaksot menevät päällekkäin, sovelletaan viimeksi luotua tai tarkinta sääntöä. Tarkista kalenteri tallentamisen jälkeen.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Automaattisiin, kysyntäpohjaisiin säätöihin sopii lisäksi [Dynaamiset hinnat](/hilfe/preise-raten/dynamische-preise).",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Dynaamiset hinnat",
          excerpt: "Hintojen automaattinen säätäminen kysynnän, varausajan ja käyttöasteen mukaan.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Dynaamiset hinnat säätävät perushintaa automaattisesti tekijöiden, kuten varausajan, nykyisen käyttöasteen ja kysynnän, perusteella — samaan tapaan kuin suuret portaalit tekevät omissa hintasuosituksissaan. Näin reagoit markkinamuutoksiin ilman, että säädät hintaa käsin joka päivä.",
            },
            { type: "h2", text: "Dynaamisten hintojen käyttöönotto" },
            {
              type: "steps",
              items: [
                "Avaa kohteessa välilehti ”Hinnat” ja osio ”Dynaamiset hinnat”.",
                "Aktivoi toiminto kohteen perushinnalle.",
                "Määritä hinnan alaraja ja yläraja.",
                "Määritä, kuinka voimakkaasti käyttöaste saa vaikuttaa hintaan.",
                "Tallenna asetukset.",
              ],
            },
            { type: "h2", text: "Rajat ja turvallisuus" },
            {
              type: "p",
              text: "Hinnan alaraja ja yläraja estävät automaattista algoritmia asettamasta hintoja, jotka eivät ole yrityksellesi kannattavia. Johdetut hintasuunnitelmat seuraavat automaattisesti dynaamisesti laskettua perushintaa.",
            },
            {
              type: "ul",
              items: [
                "Hinnan alaraja suojaa liian alhaisilta hinnoilta heikon kysynnän aikana.",
                "Hinnan yläraja suojaa liian korkeilta hinnoilta suuren kysynnän aikana.",
                "Johdetut hinnat ottavat automaattisesti käyttöön uuden perushinnan.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dynaamiset hinnat vaikuttavat vain perushintaan. Käsin kiinteästi asetetut hintasuunnitelmat ilman johtamista eivät muutu automaattisesti mukana.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Oleskelualennukset",
          excerpt: "Alennukset pidemmille oleskeluille ja varhaisille varauksille.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "p",
              text: "Oleskelualennukset palkitsevat vieraita pidemmistä varauksista tai varhaisesta varaamisesta. Ne kohdistetaan prosenttiosuutena oleskelun kokonaishintaan ja ne voidaan määrittää itsenäisesti kohteittain.",
            },
            { type: "h2", text: "Alennustyypit" },
            {
              type: "ul",
              items: [
                "Pitkäaikaisalennus: tietystä yömäärästä alkaen, esim. 7 tai 28 yöstä alkaen.",
                "Varhaisvaraajan alennus: kun varaus tehdään riittävän ajoissa.",
                "Viime hetken alennus: lyhyellä varoitusajalla lähellä saapumispäivää tehtäville varauksille.",
              ],
            },
            { type: "h2", text: "Alennuksen käyttöönotto" },
            {
              type: "steps",
              items: [
                "Avaa kohteessa välilehti ”Hinnat” ja osio ”Alennukset”.",
                "Valitse haluamasi alennustyyppi.",
                "Määritä kynnysarvo, esim. vähimmäisyöt tai varausaika.",
                "Kirjaa alennus prosentteina.",
                "Tallenna sääntö.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Alennukset vaikuttavat kyseisen hintasuunnitelman kokonaishintaan ja näytetään vieraalle jo hintanäkymässä.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Yhdistä pidemmät vähimmäisyöpymiset kohtaan [Vähimmäis- ja enimmäisoleskelu](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt) kannustaaksesi pidempiin varauksiin.",
            },
          ],
        },
      ],
    },
  ],
};
