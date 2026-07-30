import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Maksut",
  description: "Maksujen oikea käsittely.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Maksut",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Ennakkomaksun käyttöönotto",
          excerpt: "Näin perit varauksen yhteydessä vain osan koko summasta.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne",
            },
            {
              type: "p",
              text: "Sen sijaan että veloittaisit koko varaussumman heti, voit määrittää ennakkomaksun maksusääntönä. Vieras maksaa varauksen yhteydessä vain osan summasta Stripen tai PayPalin kautta, lopun myöhemmin loppumaksuna.",
            },
            {
              type: "steps",
              items: [
                "Avaa kohteessa osio ”Maksusäännöt”.",
                "Luo uusi sääntö tyypillä ”Ennakkomaksu”.",
                "Määritä ennakkomaksun summa prosenttiosuutena tai kiinteänä summana kokonaissummasta.",
                "Määritä, milloin ennakkomaksu erääntyy, tavallisesti heti varauksen yhteydessä.",
                "Tallenna sääntö ja testaa se testivarauksella.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ennakkomaksu käsitellään kohteelle tallennetun maksupalveluntarjoajan kautta. Loppusummaan sopivan summan asetat kohdassa [Loppumaksun automatisointi](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Loppumaksun automatisointi",
          excerpt: "Näin avoin loppusumma veloitetaan automaattisesti ennen saapumista.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne",
            },
            {
              type: "p",
              text: "Ennakkomaksun jälkeen jää avoimeksi loppusumma. Sen sijaan että seuraisit tätä käsin, otat käyttöön maksusäännön, joka veloittaa loppumaksun automaattisesti kiinteänä ajankohtana ennen saapumista Stripen tai PayPalin kautta.",
            },
            {
              type: "steps",
              items: [
                "Avaa kohteessa osio ”Maksusäännöt”.",
                "Luo uusi sääntö tyypillä ”Loppumaksu”, mikäli ennakkomaksusääntö on jo olemassa.",
                "Määritä, kuinka monta päivää ennen saapumista loppumaksu erääntyy.",
                "Aktivoi automaattinen veloitus, jotta tallennettu maksupalveluntarjoaja veloittaa summan itsenäisesti.",
                "Tarkista loppumaksun tila sen jälkeen kyseisen varauksen aikajanalta.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Jos automaattinen veloitus epäonnistuu, esimerkiksi vanhentuneen kortin vuoksi, varausta ei perua automaattisesti. Tarkista epäonnistuneet loppumaksut viipymättä ja ota yhteyttä vieraaseen suoraan.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Palautuksen tekeminen",
          excerpt: "Näin palautat vieraalle summan kokonaan tai osittain.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne",
            },
            {
              type: "p",
              text: "Peruutuksen tai reklamaation yhteydessä voit palauttaa vieraalle maksetun summan kokonaan tai osittain. Palautus tehdään saman maksupalveluntarjoajan kautta, jonka kautta alun perin maksettiin — Stripen tai PayPalin.",
            },
            {
              type: "steps",
              items: [
                "Avaa kyseinen varaus varauksen aikajanalla.",
                "Valitse osiossa ”Maksut” alkuperäinen maksu, joka halutaan palauttaa.",
                "Valitse täysi tai osittainen palautus.",
                "Syötä osittaisen palautuksen yhteydessä haluttu summa.",
                "Vahvista palautus ja tarkista päivittynyt maksun tila aikajanalla.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Palautus ei automaattisesti muuta varauksen tilaa eikä varattuja kalenteriöitä. Tarkista peruutuksen yhteydessä lisäksi, tarvitaanko kyseisten öiden vapauttamista varauskartassa.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Vakuusmaksun hallinta",
          excerpt: "Näin otat käyttöön vakuusmaksun ja vapautat sen oleskelun jälkeen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne",
            },
            {
              type: "p",
              text: "Vakuusmaksu suojaa sinua oleskelun aikaisia vahinkoja vastaan. Se tallennetaan omana maksusääntönä ja se joko autorisoidaan etukäteen tai veloitetaan Stripen tai PayPalin kautta kohteen asetuksista riippuen.",
            },
            {
              type: "steps",
              items: [
                "Avaa kohteessa osio ”Maksusäännöt” ja luo sääntö tyypillä ”Vakuusmaksu”.",
                "Määritä vakuusmaksun summa ja autorisoinnin ajankohta, yleensä hieman ennen saapumista.",
                "Tarkista kohteen kunto uloskirjautumisen jälkeen.",
                "Vapauta vakuusmaksu kokonaan varauksesta, jos kunto on moitteeton.",
                "Palauta vahingon sattuessa vain tarpeeton osuus ja dokumentoi pidätyksen syy.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Autorisoitu mutta veloittamaton vakuusmaksu raukeaa maksupalveluntarjoajasta riippuen automaattisesti tietyn määräajan jälkeen. Vapauta vakuusmaksu viipymättä uloskirjautumisen jälkeen tai veloita tarvittava summa ajoissa.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Laskun korjaaminen",
          excerpt: "Näin korjaat jo laaditun laskun jälkikäteen.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne",
            },
            {
              type: "p",
              text: "Jos jo laadittu lasku sisältää virheen, esimerkiksi laskutusosoitteessa tai rivillä, korjaa se varauksen kautta sen sijaan, että poistaisit alkuperäisen laskun.",
            },
            {
              type: "steps",
              items: [
                "Avaa kyseinen varaus varauksen aikajanalla ja siirry osioon ”Laskut”.",
                "Valitse virheellinen lasku.",
                "Luo korjaus- eli hyvityslasku alkuperäiselle laskulle.",
                "Luo sen jälkeen uusi, korjattu lasku oikeilla tiedoilla.",
                "Lähetä korjattu lasku uudelleen vieraalle tai laskutusosoitteeseen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jo lähetettyä laskua ei jäljitettävyyden vuoksi tulisi ylikirjoittaa suoraan. Korjaus hyvityslaskun kautta säilyttää alkuperäisen tositteen ja tekee muutoksesta jäljitettävän.",
            },
          ],
        },
      ],
    },
  ],
};
