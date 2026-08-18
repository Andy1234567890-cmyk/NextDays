import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Kolmannet osapuolet ja maksupalvelut",
  stand: "Päivitetty: 18. elokuuta 2026",
  intro: [
    "myBestDays käyttää alustan ylläpidossa kolmansien osapuolten palveluja. Tällä sivulla ne nimetään ja selitetään niiden rooli sekä se, kenen ehtoja sovelletaan.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Periaate",
      paragraphs: [
        "Kun kolmas osapuoli tuottaa palvelun suoraan teille, sen ehtoja ja tietosuojaselostetta sovelletaan omiemme ohella. Huomautamme siitä kyseisessä kohdassa.",
        "Kun kolmas osapuoli käsittelee tietoja yksinomaan toimeksiannostamme, olemme edelleen yhteyshenkilönne. Käyttämämme henkilötietojen käsittelijät selviävät [Tietosuojaselosteesta](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Maksupalveluntarjoaja",
      paragraphs: [
        "Alustan kautta suoritettavat maksut käsittelee Stripe. Stripe kerää ja käsittelee maksutiedot suoraan ja on niiden osalta itsenäinen rekisterinpitäjä. Lisäksi sovelletaan [Stripen tietosuojaselostetta](https://stripe.com/privacy).",
        "Isännille suoritettavaa tilitystä varten Stripe tekee lain edellyttämän henkilöllisyyden varmennuksen.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Maksupalveludirektiivi ja kolmansien pääsy",
      paragraphs: [
        "Direktiivi (EU) 2015/2366 (”PSD2”) edellyttää monissa maksuissa vahvaa asiakastunnistusta. Sen tekee pankkinne tai kortin myöntäjä; ilman onnistunutta tunnistusta maksu voidaan hylätä.",
        "myBestDays ei ole maksutoimeksianto- eikä tilitietopalvelu eikä sillä ole pääsyä pankkitileillenne.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Kartat, kuvat ja upotettu sisältö",
      paragraphs: [
        "Karttanäkymiä ja sijaintitietoja varten upotamme kolmansien osapuolten karttapalveluja. Tällaisen sisällön lataaminen voi siirtää tietoja kyseiselle palveluntarjoajalle; yksityiskohdat ja suostumuksen hallinta selviävät [Evästekäytännöstä](https://mybestdays.dk/rechtliches/cookies).",
        "Ilmoitusten kuvat ja kuvaukset ovat peräisin kyseiseltä palveluntarjoajalta, eivät meiltä.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Linkitetyt sivustot",
      paragraphs: [
        "Alusta voi linkittää kolmansien osapuolten sivustoille. Emme voi vaikuttaa niiden sisältöön emmekä vastaa siitä. Saatuamme tiedon oikeudenloukkauksesta poistamme linkin viipymättä.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. Sovelluskaupat",
      paragraphs: [
        "Jos hankitte myBestDays-sovelluksen sovelluskaupasta, sovelletaan lisäksi kyseisen kaupan ylläpitäjän ehtoja. Kaupan ylläpitäjä ei ole teidän ja meidän välisen sopimuksen osapuoli eikä ole velvollinen antamaan tukea tai takuuta sovellukselle.",
      ],
    },
  ],
};
