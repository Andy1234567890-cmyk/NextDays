import type { LegalDoc } from "../types";

// Finnische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. § 5 Absatz 1–2 entspricht inhaltlich Stripes offiziellem
// Empfehlungstext (Stripe Connected Account Agreement) — URLs nicht verändern.
export const agb: LegalDoc = {
  title: "Yleiset sopimusehdot välitystoimistoille ja vuokranantajille",
  stand: "Päivitetty: 30. heinäkuuta 2026",
  intro: [
    "Nämä yleiset sopimusehdot (jäljempänä ”ehdot”) sääntelevät myNextDays-ohjelmistoalustan (jäljempänä ”alusta”) käyttöä, kun käyttäjinä ovat välitystoimistot, vuokranantajat, isännöintiyritykset ja muut elinkeinonharjoittajat (jäljempänä ”käyttäjä”).",
    "Alustan tarjoaa myNextDays ApS, Tanskan oikeuden mukainen osakeyhtiö (anpartsselskab), Hirtshalsvej 21, 9881 Bindslev, Tanska, rekisteröity Tanskan kaupparekisteriin (CVR) numerolla CVR 46615182 (jäljempänä ”myNextDays” tai ”me”).",
    "Alusta on tarkoitettu yksinomaan Saksan siviililain (BGB) 14 §:ssä tai kulloisenkin EU-jäsenvaltion vastaavissa säännöksissä tarkoitetuille elinkeinonharjoittajille. Sitä ei ole tarkoitettu kuluttajille.",
  ],
  sections: [
    {
      heading: "§ 1 Soveltamisala",
      paragraphs: [
        "Nämä ehdot koskevat kaikkia myNextDaysin ja käyttäjän välisiä alustan käyttöä koskevia sopimuksia sekä kaikkia alustan kautta tarjottavia palveluja ja moduuleja.",
        "Käyttäjän poikkeavat, ristiriitaiset tai täydentävät sopimusehdot tulevat sopimuksen osaksi vain, jos myNextDays on nimenomaisesti hyväksynyt niiden soveltamisen tekstimuodossa.",
      ],
    },
    {
      heading: "§ 2 Sopimuksen kohde ja palvelut",
      paragraphs: [
        "myNextDays tarjoaa käyttäjälle pilvipohjaisen ohjelmiston loma-asuntojen ja majoitusliikkeiden hallintaan. Toimintojen laajuus määräytyy kulloinkin voimassa olevan palvelukuvauksen mukaan ja käsittää erityisesti:",
      ],
      list: [
        "kohteiden, varauskalenterien ja varausten hallinnan (Property-Management-järjestelmä),",
        "liitännän kolmansien osapuolten varauskanaviin (esim. Booking.com, Airbnb) kanavanhallintajärjestelmän (Channel Manager) kautta,",
        "ilmoitusten julkaisemisen alustan oman myNextDays-varauskanavan kautta,",
        "omien verkkosivustojen luomisen integroidulla sivueditorilla (Page Builder),",
        "kirjanpito-, tilitys- ja raportointitoiminnot, mukaan lukien omistajatilitykset,",
        "viestinnän vieraiden kanssa sekä maksujen vastaanottamisen integroidun maksunvälityksen kautta (§ 5).",
      ],
    },
    {
      heading: "§ 3 Rekisteröityminen, tili ja käyttäjän tiedot",
      paragraphs: [
        "Alustan käyttö edellyttää tilin rekisteröimistä. Käyttäjä on velvollinen antamaan rekisteröitymisen yhteydessä ja koko sopimuskauden ajan oikeat, ajantasaiset ja täydelliset tiedot itsestään ja yrityksestään sekä päivittämään ne viipymättä tietojen muuttuessa.",
        "Kirjautumistiedot on pidettävä salassa ja suojattava kolmansien osapuolten pääsyltä. Käyttäjän on ilmoitettava myNextDaysille viipymättä, jos on viitteitä hänen tilinsä väärinkäytöstä.",
        "Tili ei ole siirrettävissä. Käyttäjä varmistaa, että kaikki tiliä hänen puolestaan käyttävät henkilöt noudattavat näitä ehtoja.",
      ],
    },
    {
      heading: "§ 4 myNextDaysin rooli varauksissa",
      paragraphs: [
        "Majoitussopimukset majoituksista, joita tarjotaan alustalla, liitetyissä kolmansien osapuolten kanavissa tai käyttäjän omalla verkkosivustolla, syntyvät yksinomaan käyttäjän (tai hänen edustamansa omistajan) ja kulloisenkin vieraan välillä. myNextDays ei ole majoitussopimuksen osapuoli.",
        "Ilmoitusten sisällön (kuvaukset, valokuvat, hinnat, saatavuus, verot ja maksut) oikeellisuudesta ja lainmukaisuudesta vastaa yksin käyttäjä.",
      ],
    },
    {
      heading: "§ 5 Maksujen käsittely Stripen kautta",
      paragraphs: [
        "Maksunvälityspalvelut välitystoimistoille ja vuokranantajille myNextDays-alustalla tarjoaa Stripe, ja niihin sovelletaan [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full) -sopimusta, joka sisältää Stripen käyttöehdot (yhdessä ”Stripe-palvelusopimus”). Hyväksymällä nämä ehdot tai jatkamalla toimintaansa välitystoimistona tai vuokranantajana myNextDays-alustalla käyttäjä sitoutuu noudattamaan Stripe-palvelusopimusta, jota Stripe voi ajoittain muuttaa.",
        "Edellytyksenä sille, että myNextDays mahdollistaa maksunvälityspalvelut Stripen kautta, on, että käyttäjä antaa myNextDaysille oikeat ja täydelliset tiedot itsestään ja yrityksestään. Käyttäjä valtuuttaa myNextDaysin luovuttamaan Stripelle nämä tiedot sekä tapahtumatiedot, jotka liittyvät Stripen tarjoamien maksunvälityspalvelujen käyttöön.",
        "Oikeussuhteeseen Stripen kanssa sovelletaan linkitettyä englanninkielistä sopimustekstiä sen kulloinkin voimassa olevassa muodossa. Euroopan talousalueella olevien käyttäjien sopimuskumppani on Stripe-palvelusopimuksessa nimetty Stripe-yhtiö (tällä hetkellä Stripe Payments Europe, Limited, Irlanti). Stripe käsittelee henkilötietoja [Stripen tietosuojaselosteen](https://stripe.com/privacy) mukaisesti.",
        "Lakisääteisten tunnistamis- ja tarkastusvelvoitteiden täyttämiseksi (mm. rahanpesun estäminen, ”Know Your Customer”) myNextDays ja Stripe voivat milloin tahansa vaatia lisätietoja ja todisteita, erityisesti henkilöllisyysasiakirjoja sekä tietoja tosiasiallisista edunsaajista ja pankkiyhteydestä. Jos pyydettyjä tietoja tai todisteita ei toimiteta asetetussa määräajassa, maksujen vastaanottaminen tai tilitykset voidaan keskeyttää kokonaan tai osittain, kunnes tiedot ovat täydelliset.",
      ],
    },
    {
      heading: "§ 6 Tilitykset, takaisinveloitukset ja negatiiviset saldot",
      paragraphs: [
        "Maksureitti määräytyy varauskanavan mukaan. Käyttäjän oman varausjärjestelmän kautta tehdyissä varauksissa ja liitettyjen jakeluportaalien kautta tehdyissä varauksissa vieraiden maksut vastaanotetaan suoraan käyttäjän maksutilille; näissä tapauksissa käyttäjä on suhteessa vieraaseen maksun saaja ja majoituspalvelun sopimusosapuoli (§ 4), eikä myNextDays missään vaiheessa tule näiden varojen haltijaksi. Tällaisista varauksista myNextDays ei peri prosentuaalista varausmaksua; liitettyjen jakeluportaalien kautta tehtyjen varausten välityspalkkio ilmoitetaan erikseen ja laskutetaan jälkikäteen.",
        "myNextDays-varausportaalin kautta tehdyissä varauksissa maksu käsitellään myNextDaysin kautta. myNextDays pidättää tällöin kulloinkin voimassa olevassa hinnastossa ilmoitetun välityspalkkion maksun käsittelykustannuksineen ja tilittää jäljelle jäävän summan käyttäjälle jäljempänä olevien kohtien mukaisesti. Ohjelmiston käytöstä perittävä korvaus (§ 7) ei muutu.",
        "Tilitykset maksetaan käyttäjän ilmoittamalle pankkitilille. myNextDays voi muuttaa tilitysaikataulua riskisyistä, erityisesti uusien tilien, poikkeavien tapahtumamallien tai käynnissä olevien tarkastusten yhteydessä.",
        "Vieraille maksettavat hyvitykset kantaa taloudellisesti käyttäjä. Takaisinveloitukset ja niistä aiheutuvat maksut kantaa käyttäjä varauksissa, jotka on tehty hänen oman varausjärjestelmänsä ja liitettyjen jakeluportaalien kautta, koska käyttäjä on näissä tapauksissa maksun saaja; myNextDays-varausportaalin kautta tehdyissä varauksissa takaisinveloitusriskin kantaa myNextDays, ellei se johdu käyttäjän velvoitteiden laiminlyönnistä (erityisesti majoituspalvelun suorittamatta jättämisestä tai olennaisesta poikkeamasta). myNextDaysilla on oikeus kuitata käyttäjän kannettavat määrät tulevista tilityksistä.",
        "Jos käyttäjän maksutilille syntyy negatiivinen saldo, käyttäjän on tasattava se viipymättä. Käyttäjä valtuuttaa myNextDaysin ja Stripen veloittamaan negatiiviset saldot ilmoitetulta pankkitililtä siltä osin kuin se on oikeudellisesti sallittua.",
      ],
    },
    {
      heading: "§ 7 Maksut ja laskutus",
      paragraphs: [
        "Alustan käytöstä perittävät maksut määräytyvät sopimusta tehtäessä sovitun hinnaston tai yksilöllisen tarjouksen mukaan. Kaikki hinnat ovat ilman kulloinkin sovellettavia lakisääteisiä veroja, ja ne ilmoitetaan sopimuksessa mainitussa valuutassa.",
        "Tapahtumakohtaiset maksut (esim. maksu- tai kanavamaksut) voidaan pidättää tai kuitata suoraan kyseisen tapahtuman käsittelyn yhteydessä.",
        "Jos käyttäjä viivästyy maksuissaan, myNextDays voi ennakkoilmoituksen jälkeen estää pääsyn alustalle, kunnes avoimet saatavat on maksettu.",
      ],
    },
    {
      heading: "§ 8 Käyttäjän velvollisuudet; omat oikeudelliset tekstit",
      paragraphs: [
        "Käyttäjä varmistaa, että hänen ilmoituksensa, sisältönsä ja liiketoimintakäytäntönsä ovat kulloinkin sovellettavan lainsäädännön mukaisia, erityisesti majoituksen sijaintipaikassa sovellettavan majoitus-, ilmoitus-, vero- ja kuluttajansuojalainsäädännön. Käyttäjä hankkii ja ylläpitää tarvittavat luvat, rekisteröinnit ja lisenssit omalla vastuullaan.",
        "Käyttäjä vastaa itse verkkosivustoista, joita hän ylläpitää sivueditorin avulla, sekä ilmoituksistaan alustalla; tähän kuuluvat erityisesti omat vieraita koskevat sopimusehdot, oma lakisääteinen ylläpitäjäilmoitus (Impressum) ja omat tietosuojatiedot.",
        "Kiellettyä on erityisesti: virheellisten tai harhaanjohtavien ilmoitusten julkaiseminen, valekauppojen tai vilpillisten maksutapahtumien toteuttaminen, § 5:n mukaisen maksunvälityksen kiertäminen alustan kautta syntyneissä varauksissa sekä kaikki käyttö, joka heikentää alustan turvallisuutta tai käytettävyyttä.",
      ],
    },
    {
      heading: "§ 9 Kolmansien osapuolten varauskanavat",
      paragraphs: [
        "Kolmansien osapuolten kanavia (esim. Booking.com, Airbnb) liitettäessä sovelletaan lisäksi kulloisenkin kanavaoperaattorin ehtoja. Käyttäjä tekee tätä varten tarvittavat sopimukset suoraan kanavaoperaattorin kanssa.",
        "myNextDays huolehtii saatavuuksien, hintojen ja varaustietojen teknisestä synkronoinnista, mutta sillä ei ole vaikutusvaltaa kanavaoperaattorien sisältöihin, palkkioihin tai päätöksiin, eikä se vastaa niiden käytettävyydestä.",
      ],
    },
    {
      heading: "§ 10 Käytettävyys ja jatkokehitys",
      paragraphs: [
        "myNextDays tuottaa palvelut huolellisen elinkeinonharjoittajan huolellisuutta noudattaen ja pyrkii alustan korkeaan käytettävyyteen. Huoltoikkunat, jatkokehitys ja myNextDaysin vaikutusmahdollisuuksien ulkopuolella olevat olosuhteet (esim. häiriöt kolmansien palveluntarjoajien järjestelmissä) voivat rajoittaa käytettävyyttä tilapäisesti.",
        "myNextDays saa kehittää alustaa edelleen ja muuttaa toimintoja, kunhan sopimuksen tarkoitus ei vaarannu ja muutos on käyttäjän kannalta kohtuullinen.",
      ],
    },
    {
      heading: "§ 11 Tiedot ja tietosuoja",
      paragraphs: [
        "Siltä osin kuin myNextDays käsittelee alustaa tarjotessaan henkilötietoja käyttäjän lukuun (erityisesti vierastietoja), osapuolet tekevät yleisen tietosuoja-asetuksen (GDPR) 28 artiklan mukaisen sopimuksen henkilötietojen käsittelystä.",
        "Käyttäjä vastaa edelleen syöttämiensä tietojen keräämisen ja käsittelyn tietosuojaoikeudellisesta lainmukaisuudesta. Yksityiskohdat myNextDaysin suorittamasta tietojenkäsittelystä ilmenevät alustan tietosuojatiedoista; Stripen suorittamaan tietojenkäsittelyyn sovelletaan § 5:tä.",
      ],
    },
    {
      heading: "§ 12 Immateriaalioikeudet",
      paragraphs: [
        "Kaikki oikeudet alustaan, sen ohjelmistoon ja sisältöihin (lukuun ottamatta käyttäjän lisäämiä sisältöjä) kuuluvat myNextDaysille tai sen lisenssinantajille. Käyttäjä saa sopimuskauden ajaksi yksinkertaisen, ei-siirrettävän oikeuden käyttää alustaa sopimuksessa sovitussa laajuudessa.",
        "Käyttäjä myöntää myNextDaysille lisäämiinsä sisältöihin alustan toiminnan edellyttämät yksinkertaiset käyttöoikeudet (erityisesti tallentamiseen, kopiointiin, näyttämiseen ja välittämiseen liitettyihin kanaviin).",
      ],
    },
    {
      heading: "§ 13 Vastuu",
      paragraphs: [
        "myNextDays vastaa rajoituksetta tahallisuudesta ja törkeästä huolimattomuudesta sekä vahingoista, jotka johtuvat hengen, kehon tai terveyden vahingoittamisesta.",
        "Lievän huolimattomuuden tapauksissa myNextDays vastaa vain olennaisten sopimusvelvoitteiden (kardinaalivelvoitteiden) rikkomisesta, ja vastuu rajoittuu sopimukselle tyypilliseen, ennakoitavissa olevaan vahinkoon. Tuotevastuulainsäädännön mukainen vastuu sekä annetuista takuista johtuva vastuu jäävät voimaan.",
        "Tietojen katoamisesta myNextDays vastaa vain siinä laajuudessa, jossa vahinko olisi syntynyt myös silloin, jos käyttäjä olisi tehnyt asianmukaiset, säännölliset varmuuskopiot, ellei varmuuskopiointi ole sopimuksen mukaan myNextDaysin vastuulla.",
      ],
    },
    {
      heading: "§ 14 Sopimuskausi, irtisanominen ja käytön estäminen",
      paragraphs: [
        "Sopimuskausi ja irtisanomisajat määräytyvät kulloisenkin sopimuksen mukaan. Oikeus sopimuksen purkamiseen painavasta syystä jää voimaan.",
        "myNextDays voi tilapäisesti estää pääsyn alustalle tai yksittäisiin toimintoihin (mukaan lukien maksujen vastaanottaminen ja tilitykset), jos on konkreettisia viitteitä näiden ehtojen rikkomisesta, petoksesta tai väärinkäytöstä tai jos myNextDays on siihen velvollinen lain tai maksupalveluntarjoajan määräyksen perusteella. Käyttäjälle ilmoitetaan estosta siltä osin kuin se on oikeudellisesti sallittua.",
        "Sopimuksen päätyttyä myNextDays asettaa käyttäjän tiedot pyynnöstä 30 päivän kuluessa vietäväksi yleisessä tiedostomuodossa; sen jälkeen tiedot poistetaan, elleivät lakisääteiset säilytysvelvoitteet sitä estä.",
      ],
    },
    {
      heading: "§ 15 Näiden ehtojen muuttaminen",
      paragraphs: [
        "myNextDays voi muuttaa näitä ehtoja tulevaisuutta koskevin vaikutuksin, jos se on tarpeen painavista syistä (erityisesti lainsäädännön muutokset, oikeuskäytännön muutokset tai maksupalveluntarjoajien vaatimukset) eikä muutos aseta käyttäjää kohtuuttomasti epäedulliseen asemaan.",
        "Muutoksista ilmoitetaan käyttäjälle tekstimuodossa vähintään kuusi viikkoa ennen niiden voimaantuloa. Jos käyttäjä ei vastusta muutoksia ilmoitusajan kuluessa tai jatkaa alustan käyttöä muutosten voimaantulon jälkeen, muutetut ehdot katsotaan hyväksytyiksi; tästä seurauksesta mainitaan ilmoituksessa erikseen.",
      ],
    },
    {
      heading: "§ 16 Loppumääräykset",
      paragraphs: [
        "Sovelletaan sen valtion lakia, jossa alustan tarjoajalla on kotipaikka, lukuun ottamatta YK:n kansainvälistä tavaran kauppaa koskevaa yleissopimusta (CISG). Sen valtion pakottavat säännökset, jossa käyttäjällä on kotipaikka, jäävät voimaan.",
        "Yksinomainen oikeuspaikka kaikissa tästä sopimuksesta johtuvissa tai siihen liittyvissä riidoissa on — siltä osin kuin se on lain mukaan sallittua — alustan tarjoajan kotipaikka.",
        "Jos jokin näiden ehtojen määräyksistä on tai tulee pätemättömäksi, muiden määräysten pätevyys ei muutu.",
      ],
    },
  ],
};
