import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Partnerprogramm",
  description: "Soovitage ettevõtteid, looge meeskond ja teenige tellimuse tulust osa.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Kuidas see töötab",
      articles: [
        {
          slug: "ueberblick",
          title: "Partnerprogrammi ülevaade",
          excerpt: "Kes saab osaleda, kuidas vahendustasu tekib ja mida näete.",
          updated: "Seisuga: september 2026",
          body: [
            {
              type: "p",
              text: "Partnerina soovitate myNextDaysi üürileandjatele, agentuuridele ja hotellidele. Kui ettevõte registreerib end teie koodiga või teie lingi kaudu ja tasub oma tellimuse arved, saate kaksteist kuud osa tellimuse netotulust. Tasuvate klientide põhjal koostatud astmestik on otse programmi lehel.",
            },
            { type: "h2", text: "Kes saab partneriks" },
            {
              type: "ul",
              items: [
                "Isikud ja ettevõtted EL-is, Šveitsis või Ühendkuningriigis, kellel on tõeline kanal majutajateni: mõjutajad, konsultandid, agentuurid, maksunõustajad, ühendused.",
                "Ka myNextDaysi kliendid ise – tellimus ei ole eeltingimus.",
                "Kohustuslik taotluses: vähemalt üks sotsiaalmeedia konto (Instagram, TikTok, YouTube, Facebook, LinkedIn …) aadressi, kasutajanime ja levialaga. Veebisait või uudiskiri on teretulnud lisaks.",
              ],
            },
            { type: "h2", text: "Kuidas ettevõte teile määratakse" },
            {
              type: "steps",
              items: [
                "Jagate oma linki (mynextdays.com/p/TEIE-KOOD) või oma koodi.",
                "Ettevõte näeb koodi registreerimisel väljal „Soovitas“ ja kinnitab selle saatmisega – ilma küpsiseta.",
                "Esimese tasutud tellimuse arvega algab kaheteistkümnekuuline periood.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Näete oma kliente pseudonüümselt (klient #1, #2 …) koos riigi, staatuse ja summadega – mitte kunagi nime või e-posti aadressi. Ettevõte määratakse täpselt ühele partnerile; esimene võidab.",
            },
            { type: "h2", text: "Mida leiate armatuurlaualt" },
            {
              type: "ul",
              items: [
                "Ülevaade: edetabel, klikid, registreeritud ja tasuvad ettevõtted, avatud, väljamakstavad ja väljamakstud vahendustasud.",
                "Vahendustasud: iga tasutud tellimuse arve reana koos aluse, määra, summa ja staatusega.",
                "Väljamaksed: igakuised valuutapõhised alates miinimumsummast, koos kreeditiga (self-billing) tõendina.",
                "Lingid ja materjalid: teie koodid, reklaammaterjalid ja kohustuslik märgistus riigiti.",
                "Sõnumid: otseühendus partnerimeeskonnaga.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Meeskonna loomine: meeskonna vahendustasu",
          excerpt: "Värbage partnereid, kes liituvad teie koodiga – ja teenige osa nende klientide tulust.",
          updated: "Seisuga: september 2026",
          body: [
            {
              type: "p",
              text: "Saate oma meeskonda kaasata teisi partnereid. Kui keegi kandideerib teie meeskonnalingi kaudu (mynextdays.com/p/TEIE-KOOD?team=1) ja sisestab teie koodi taotluses nähtavalt, kuulub ta pärast heakskiitu teie meeskonda. Teie meeskonnapartnerite klientide tellimuse netotulult saate meeskonna vahendustasu.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "Meeskonna määr sõltub TEIE edetabelist makse tegemise ajal – mitte teie meeskonna suurusest. Määrad on programmi lehel.",
                "Teie edetabel tekib ainult teie enda tasuvatest klientidest. Meeskonnakliendid ei arvestata edetabelisse.",
                "Täpselt üks tase: teie meeskonnapartnerid ei loo teie all oma meeskonda.",
                "Osavõtutasu puudub, partneri värbamise eest raha ei maksta. Meeskonna vahendustasu tekib ainult tasutud tellimuse tulust.",
                "Kaksteist kuud alates vastava meeskonnakliendi esimesest tasutud arvest, 30-päevane tagastusaken, tagastamine tagastuse või tagasimakse korral – nagu ka oma vahendustasu puhul.",
                "Meeskonna vahendustasu tekib ainult siis, kui teie ja teie meeskonnapartner olete heaks kiidetud; vastasel juhul see peatatakse.",
              ],
            },
            { type: "h2", text: "Meeskonna hindamine" },
            {
              type: "p",
              text: "Jaotises „Meeskond“ näete iga meeskonnapartnerit koos auastme, maksvate klientide, nende klientide tellimuste käibega (30 päeva ja kokku) ja teie meeskonna vahendustasuga – avatud, väljamakstav, väljamakstud – ning viimase kaheteistkümne kuu ajalugu. Te ei näe oma meeskonnapartnerite kliendiandmeid; need kuuluvad neile.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Jaotise „Meeskond“ kaudu saate oma meeskonnapartneritega otse sõnumi teel ühendust võtta – ja teie sponsor teiega.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Sama e-posti domeen või sama pangakonto sponsori ja meeskonnapartneri vahel märgitakse ja kontrollitakse partnerimeeskonna poolt enne meeskonna vahendustasu väljamaksmist.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Väljamakse, kreedit ja maksud",
          excerpt: "Millal vahendustasu muutub väljamakstavaks, milline näeb välja kreedit ja mis kehtib maksude osas.",
          updated: "Seisuga: september 2026",
          body: [
            {
              type: "steps",
              items: [
                "Vahendustasu rida tekib tasutud tellimuse arvega ja on 30 päeva „avatud“ (tagastusaken).",
                "Pärast seda on see väljamakstav. Iga kuu esimesel päeval koondame kõik väljamakstavad read valuuta kaupa.",
                "Kui summa ületab teie valuuta miinimumsumma, tekib väljamakse koos kreeditiga (self-billing). Te ei pea arvet esitama.",
                "Pärast ülekannet kuvatakse väljamakse armatuurlaual „Makstud“ koos viitega.",
              ],
            },
            {
              type: "ul",
              items: [
                "Ettevõtted: Kreeditil on pöördmaksustamise märge; eelduseks on kinnitatud käibemaksukohustuslase number (VIES-kontroll).",
                "Eraisikud: Kreeditil ei ole käibemaksu näidatud; vahendustasu tuleb ise deklareerida.",
                "Väljamakse SEPA, Wise'i või PayPali kaudu – andmed sisestate profiili; muudatused nõuavad teie parooli.",
                "Konverteerimist ei toimu: DKK-s olev vahendustasu makstakse välja DKK-s, EUR-s olev vahendustasu EUR-s.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Reklaam peab olema äratuntav kui reklaam – postituse alguses, postituse keeles. Iga riigi kinnitatud sõnastused leiate jaotisest „Lingid ja materjalid“. Rikkumised võivad kaasa tuua blokeerimise.",
            },
          ],
        },
      ],
    },
  ],
};
