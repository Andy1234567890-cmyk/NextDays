import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Ametiasutuste ja õiguskaitseasutuste päringute poliitika",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "Käesolev poliitika on suunatud ametiasutustele, kohtutele ja õiguskaitseasutustele, kes nõuavad myBestDays-ilt andmeid või esitavad korralduse sisu vastu. See on siin avalik, et ka kasutajad saaksid lugeda, millistel tingimustel me andmeid väljastame.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Põhimõte",
      paragraphs: [
        "Väljastame kasutajate andmeid üksnes siis, kui on olemas kehtiv õiguslik alus ja päring vastab vorminõuetele. Vormivaba andmetaotlus ei ole piisav.",
        "Kontrollime iga päringut pädevuse, õigusliku aluse, määratletuse ja proportsionaalsuse osas ning väljastame üksnes need andmed, mida päring nimetab.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Nõuded päringule",
      paragraphs: ["Päring peaks sisaldama:"],
      list: [
        "taotlevat asutust, toimiku numbrit ja menetleja kontaktandmeid ametlikul kirjaplangil;",
        "õiguslikku alust siseriikliku või liidu õiguse kohaselt;",
        "asjaomase isiku või asjaomase konto täpset tähistust – e-posti aadress, broneeringu number või kuulutuse URL;",
        "täpselt määratletud andmeid ja ajavahemikku;",
        "vajaduse korral kohtu korraldust, kui kohaldatav õigus seda nõuab;",
        "märget, kui asjaomase isiku teavitamine ohustaks uurimist, koos õigusliku aluse nimetamisega.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Korraldused määruse (EL) 2022/2065 kohaselt",
      paragraphs: [
        "Korraldused võtta meetmeid õigusvastase sisu vastu (artikkel 9) ja korraldused esitada teavet (artikkel 10) peavad sisaldama seal nimetatud andmeid, eelkõige õiguslikku alust, täpset elektroonilist asukohta, põhjendust, õiguskaitsevahendeid ja keelt.",
        "Kinnitame kättesaamist ja teatame korralduse andnud asutusele, milliseid meetmeid oleme võtnud ja millal.",
        "Korraldusest teavitame asjaomast isikut hiljemalt täitmise ajal, kui asutus ei ole õiguslikku alust nimetades määranud edasilükkamist.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Hädaolukorrad",
      paragraphs: [
        "Kui esineb vahetu oht elule või kehalisele puutumatusele, väljastame tõrjumiseks vajalikud andmed ka ilma eelneva vormikohase korralduseta. Märgistage selline päring sõnaselgelt hädaolukorrana ja kirjeldage ohtu.",
        "Kui on viiteid kuriteole, mis kujutab ohtu isiku elule või turvalisusele, teavitame pädevaid asutusi omal algatusel (määruse (EL) 2022/2065 artikkel 18).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Milliseid andmeid me hoiame",
      paragraphs: [
        "Milliseid andmekategooriaid töötleme ja kui kaua neid säilitame, on kirjas [Privaatsuspoliitikas](https://mybestdays.dk/rechtliches/datenschutz). Seal nimetatud tähtaegadest kauem me andmeid ei hoia.",
        "Andmete säilitamist üle vajaduse ei toimu. Nõude säilitada andmeid ajutiselt käimasoleva menetluse jaoks täidame õiguslikult lubatud ulatuses.",
        "Täielikke makseandmeid meil ei ole; neid tuleb küsida makseteenuse pakkujalt.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Asjaomase isiku teavitamine",
      paragraphs: [
        "Teavitame asjaomaseid kasutajaid nende andmeid puudutavast päringust, välja arvatud juhul, kui õigusnorm või põhjendatud ametlik korraldus seda keelab või esineb vahetu oht elule või kehalisele puutumatusele.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Kuhu päringud saata",
      paragraphs: [
        "Saatke päringud jaotises [Digiteenuste õigusakt](https://mybestdays.dk/rechtliches/dsa) nimetatud ametiasutuste kontaktpunkti. Menetleme neid saksa ja inglise keeles.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Läbipaistvus",
      paragraphs: [
        "Ametiasutuste korralduste arvu ja liigi toome välja oma iga-aastases läbipaistvusaruandes; vt [Digiteenuste õigusakt](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
