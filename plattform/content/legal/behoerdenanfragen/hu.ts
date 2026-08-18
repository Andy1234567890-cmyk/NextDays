import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Hatósági és bűnüldözési megkeresésekre vonatkozó szabályzat",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "A jelen szabályzat azokhoz a hatóságokhoz, bíróságokhoz és bűnüldöző szervekhez szól, amelyek a myBestDays-től adatokat kérnek vagy tartalommal szemben határozatot hoznak. Azért nyilvános itt, hogy a felhasználók is elolvashassák, milyen feltételek mellett adunk ki adatot.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Alapelv",
      paragraphs: [
        "Felhasználói adatokat csak akkor adunk ki, ha érvényes jogalap áll fenn, és a megkeresés megfelel a formai követelményeknek. Az adatok formátlan kérése nem elegendő.",
        "Minden megkeresést megvizsgálunk hatáskör, jogalap, meghatározottság és arányosság szempontjából, és csak azokat az adatokat adjuk ki, amelyeket a megkeresés megjelöl.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. A megkereséssel szembeni követelmények",
      paragraphs: ["A megkeresésnek tartalmaznia kell:"],
      list: [
        "a megkereső szervet, az ügyszámot és az ügyintéző elérhetőségét hivatalos fejléces papíron;",
        "a jogalapot a nemzeti jog vagy az uniós jog szerint;",
        "az érintett személy vagy fiók pontos megjelölését — e-mail-cím, foglalási szám vagy a hirdetés URL-je;",
        "a pontosan megjelölt adatokat és az időszakot;",
        "adott esetben bírósági határozatot, amennyiben az alkalmazandó jog azt előírja;",
        "utalást arra, ha az érintett személy tájékoztatása veszélyeztetné a nyomozást, a jogalap megjelölésével.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Határozatok az (EU) 2022/2065 rendelet szerint",
      paragraphs: [
        "A jogellenes tartalom elleni fellépésre vonatkozó (9. cikk) és az információszolgáltatásra vonatkozó (10. cikk) határozatoknak tartalmazniuk kell az ott megnevezett adatokat, különösen a jogalapot, a pontos elektronikus lelőhelyet, az indokolást, a jogorvoslatokat és a nyelvet.",
        "A beérkezést visszaigazoljuk, és közöljük az elrendelő hatósággal, milyen intézkedéseket hoztunk és mikor.",
        "A határozatról az érintett személyt legkésőbb a végrehajtás időpontjában tájékoztatjuk, kivéve ha a hatóság a jogalap megjelölésével halasztást rendel el.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Vészhelyzetek",
      paragraphs: [
        "Ha közvetlen veszély fenyegeti az életet vagy a testi épséget, az elhárításhoz szükséges adatokat előzetes alaki határozat nélkül is kiadjuk. Az ilyen megkeresést kifejezetten jelölje meg vészhelyzetként, és írja le a veszélyt.",
        "Ha olyan bűncselekményre utaló jelek merülnek fel, amely valamely személy életét vagy biztonságát veszélyezteti, saját kezdeményezésünkre tájékoztatjuk az illetékes hatóságokat (az (EU) 2022/2065 rendelet 18. cikke).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Mely adatokat tartjuk nyilván",
      paragraphs: [
        "Hogy mely adatkategóriákat kezelünk, és meddig tároljuk azokat, az az [Adatvédelmi tájékoztatóban](https://mybestdays.dk/rechtliches/datenschutz) szerepel. Az ott megnevezett határidőkön túl nem tartunk nyilván adatokat.",
        "Szükségleten túli adattárolás nem történik. A folyamatban lévő eljáráshoz szükséges ideiglenes adatmegőrzésre irányuló felhívást a jogilag megengedett keretek között teljesítjük.",
        "Teljes fizetési adatokkal nem rendelkezünk; azokat a pénzforgalmi szolgáltatótól kell kérni.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Az érintett személy tájékoztatása",
      paragraphs: [
        "Az érintett felhasználókat tájékoztatjuk az adataikat érintő megkeresésről, kivéve ha jogszabály vagy indokolt hatósági határozat ezt megtiltja, vagy ha közvetlen veszély fenyegeti az életet vagy a testi épséget.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Hova kell a megkereséseket küldeni",
      paragraphs: [
        "A megkereséseket a [Digitális szolgáltatásokról szóló jogszabály](https://mybestdays.dk/rechtliches/dsa) alatt megnevezett hatósági kapcsolattartó pontra küldje. Ezeket német és angol nyelven dolgozzuk fel.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Átláthatóság",
      paragraphs: [
        "A hatósági határozatok számát és típusát az éves átláthatósági jelentésünkben mutatjuk ki; lásd a [Digitális szolgáltatásokról szóló jogszabályt](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
