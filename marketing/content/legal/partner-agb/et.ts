// Partner-AGB — Estnisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "myNextDaysi partnerprogrammi osalemistingimused: omistamine, vahendustasu alus, tasemed, meeskonnavahendustasu, keelud, märgistus, väljamakse.",
  numbered: false,
  toc: true,
  title: "Partnerprogrammi osalemistingimused (partneri üldtingimused) – mustand",
  standIso: "2026-09-02",
  intro: [
    "MUSTAND – Need tingimused on myNextDaysi tööversioon ja neid ei ole veel juristiga kooskõlastatud. Kuni kooskõlastatud versiooni avaldamiseni kehtivad need programmi kirjeldusena, mitte lõpliku lepingu tekstina. Kooskõlastatud versioon avaldatakse sellel aadressil uue versiooninumbriga; partnereid palutakse järgmisel sisselogimisel uuesti nõustuda.",
    `Käesolevad osalemistingimused reguleerivad ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (edaspidi „myNextDays“ või „meie“) partnerprogrammis (affiliate-programm) osalemist partnerite (edaspidi „partner“) poolt.`,
    "Partnerprogramm on suunatud EL-is, Šveitsis või Ühendkuningriigis asuvatele isikutele ja ettevõtetele, kes soovitavad myNextDaysis ettevõtteid (majutajad, agentuurid, hotellid).",
  ],
  sections: [
    {
      heading: "§ 1 Osalemine ja heakskiit",
      paragraphs: [
        "Osalemine eeldab kandideerimist partneri armatuurlaua kaudu. Kohustuslikud andmed on nimi või ettevõtte nimi, õiguslik vorm, riik, vähemalt üks sotsiaalmeedia konto aadressi, kasutajanime ja levialaga ning ettevõtete puhul käibemaksukohustuslase number.",
        "myNextDays vaatab iga avalduse isiklikult läbi ja otsustab vabalt heakskiidu üle. Vastuvõtmisele ei ole õigust. Osalemine on tasuta; myNextDaysi tellimus ei ole eeltingimus.",
        "Partner hoiab oma andmed ajakohastena, eriti kanalid, õigusliku vormi, maksu- ja väljamakseandmed.",
        "Märgitud leviala on esialgu enesedeklaratsioon. Partner saab oma YouTube'i, Instagrami, Facebooki ja TikToki kontod vabatahtlikult ühendada; siis loetakse jälgijad ja vaatamised platvormilt ning need märgitakse kinnitatuks. Kinnitamata leviala kaalutakse heakskiitmisel ja hilisematel kontrollidel vähem. Ühenduse saab armatuurlaual igal ajal katkestada; töötlemise üksikasjad on esitatud privaatsuspoliitikas.",
      ],
    },
    {
      heading: "§ 2 Ettevõtete omistamine (Attribution)",
      paragraphs: [
        "Ettevõte omistatakse partnerile, kui see registreerib end partneri soovituskoodiga. Kood kuvatakse ettevõttele registreerimisel nähtavalt ja kinnitatakse saatmisega. Jälgimisküpsiseid ei paigaldata.",
        "Ettevõte omistatakse täpselt ühele partnerile; määrav on registreerimisel kinnitatud kood. Hilisem ümberkorraldamine toimub ainult myNextDaysi poolt tõendatud vea korral.",
        "Ei omistata partneri enda, tema osanike, töötajate või sugulaste ettevõtteid ega ettevõtteid, mis on või on olnud myNextDaysi kliendid.",
      ],
    },
    {
      heading: "§ 3 Vahendustasu oma klientidelt",
      paragraphs: [
        "Vahendustasu aluseks on omistatud ettevõtte netotellimuse käive (põhitariif ja moodulid) tasutud arvetest – ilma käibemaksuta, ilma portaalitasudeta, lisateenusteta, järelarvestusteta ja muude läbivate kirjeteta.",
        "Vahendustasu määr sõltub partneri astmest makse tegemise ajal. Astmed ja määrad on avaldatud programmi lehel. Aste määratakse partneri struktuuris olevate maksvate klientide arvu alusel: tema enda maksvad kliendid ja tema meeskonnapartnerite maksvad kliendid (§ 4), iga klient üks kord. Aste määratakse igakuiselt tähtpäeval; tõus kehtib koheselt, langus aga alles siis, kui arv on kahel järjestikusel tähtpäeval olnud allpool läve.",
        "Kui partner saavutab esimest korda astme alates „Aufsteiger“, saab ta ühekordselt selle astme eest programmi lehel näidatud edutamisboonuse (praegu 50,00 EUR astme kohta, kõigile partneritele eurodes). Iga astet tasustatakse ainult üks kord, ka pärast langust ja uuesti tõusu. Boonus kuulub tagastusperioodi alla vastavalt § 7.",
        "Vahendustasu tekib iga ettevõtte kohta kaheteistkümneks kuuks alates selle esimesest tasulisest tellimuse arvest; partneri kaudu vahendatud tasuta prooviperiood ja tasuta kuu ei arvestata. Kui tellimus lõpeb varem, lõpeb vahendustasu viimase tasutud arvega.",
        "Alates astmest „Elite-Partner“ saab partner lisaks supervahendustasu programmi lehel näidatud summas (praegu 2,5 %) kõigi oma struktuuri klientide – oma klientide ja oma meeskonnapartnerite klientide – netotellimuse käibelt, ilma kaheteistkümne kuu piiranguta, seni kuni vastaval kliendil on maksev tellimus ja partneril on makse tegemise ajal vastav aste. See tekib lisaks vahendustasule vastavalt lausele 2 ja § 4.",
        "Iga myBestDays kaudu laekuva ja tasutud broneeringu eest ettevõttelt, mis on seotud partneri või ühe tema meeskonnapartneriga, saab partner broneeringu osa programmi lehel näidatud summas (praegu 0,5 %) külalise poolt tasutud broneeringu summast broneeringu valuutas, ilma ajapiiranguta, seni kuni seos püsib. Tagatisrahad ei ole broneeringu summa. Külalisele tehtud tagasimaksed vähendavad osa proportsionaalselt (§ 7).",
      ],
    },
    {
      heading: "§ 4 Meeskonnavahendustasu",
      paragraphs: [
        "Alates astmest „Aufsteiger“ võib partner juhtida meeskonnapartnereid. Kui teine partner kandideerib partneri meeskonnalingi kaudu ja kinnitab oma koodi nähtavalt oma avalduses, määratakse ta pärast heakskiitu partneri meeskonda (edaspidi „Sponsor“). Kui sponsoril ei ole kandideerimise ajal vastavat astet, jääb avaldus kehtivaks, kuid meeskonna seost ei teki.",
        "Sponsor saab oma meeskonnapartnerite klientide netotellimuse käibelt meeskonnavahendustasu oma vahendustasu määra ja meeskonnapartneri vahendustasu määra vahe ulatuses, vastavalt astmele makse tegemise ajal. Kui mõlemad on samas astmes või meeskonnapartner kõrgemal, siis meeskonnavahendustasu ei teki. Meeskonnapartneri vahendustasu ja sponsori meeskonnavahendustasu ei ületa kokku kunagi astmestiku kõrgeimat määra (praegu 30 %).",
        "Meeskonna vahendustasu on täpselt ühe taseme sügavune: meeskonnapartnerid ei saa meeskonna vahendustasu partnerite eest, keda nad ise värbavad. Partneri värbamise eest tasu ei maksta; osalustasu ei nõuta. Meeskonna vahendustasu tekib ainult tasulise tellimuse käibest.",
        "Meeskonna vahendustasu kehtib iga meeskonnakliendi kohta kaksteist kuud alates tema esimesest tasulisest arvest, sellele kehtib sama tagastusperiood ja see võetakse tagastamise või tagasinõudmise korral proportsionaalselt tagasi (§ 7). See tekib ainult seni, kuni sponsor ja meeskonnapartner on heaks kiidetud; vastasel juhul peatatakse see kuni olukorra selgitamiseni.",
        "Meeskonna määramine on ühekordne. Muudatusi teeb ainult myNextDays dokumenteeritud põhjusega.",
      ],
    },
    {
      heading: "§ 5 Partneri kohustused ja märgistamine",
      paragraphs: [
        "Partner märgistab iga soovituse oma lingi või koodiga kui reklaami – postituse alguses, postituse keeles, vastavalt oma riigi nõuetele (Saksamaal muu hulgas § 5a lõige 4 UWG, Taanis markedsføringsloven § 6 lõige 4). MyNextDays pakub iga riigi jaoks sõnastusi partneri armatuurlaual.",
        "Partner esitab myNextDays kohta ainult teavet, mis vastab avaldatud teenusekirjeldustele, ega anna myNextDays nimel lubadusi. Eelkõige on keelatud edu- ja garantiilubadused (näiteks „garanteeritud täielik täituvus kolme päevaga“) ning avaldused sissetulekute kohta, mis ei tulene avaldatud teenusekirjeldustest.",
        "Iga video ja postitus, mis mainib myNextDaysi või sisaldab partneri linki, esitatakse enne avaldamist partneri armatuurlaual failina kontrollimiseks. Partneri link tekib alles pärast myNextDaysi kirjalikku heakskiitu; avaldamine ilma heakskiiduta on keelatud. MyNextDays võib heakskiidu tagasi võtta; juba tekkinud vahendustasud jäävad puutumata.",
        "Logode, ekraanipiltide, B-rolli, ülekatete ja ekraanipiltide jaoks kasutab partner ainult myNextDaysi pakutavat reklaammaterjali. Oma, kontrollimata tarkvara salvestused ei ole lubatud.",
      ],
    },
    {
      heading: "§ 6 Keelatud tavad",
      paragraphs: ["Eelkõige on keelatud:"],
      list: [
        "Brändipakkumine: tasulised reklaamid kaubamärgile „myNextDays“, kirjavariatsioonidele ja kombinatsioonidele (nt „myNextDays hinnad“) otsingumootorites ja võrkudes;",
        "Küpsiste kukutamine, varjatud ümbersuunamised, iFrame'id, partneri lingi automatiseeritud kutsumine või muu seose tehniline manipuleerimine;",
        "Enesereklaam: oma ettevõtete, osanike, töötajate või sugulaste registreerimine oma koodi või meeskonnapartneri koodi kaudu;",
        "Ostetud ulatus (ostetud jälgijad, klikifarmid, botiliiklus) ning stiimulid ettevõtetele registreerimiseks (tagasimaksed, kingitused, loteriid);",
        "Värbamislubadused: partnerite värbamine teenistuslubadustega, mis ei tulene tasulisest tellimuse käibest, või programmi esitamine sissetulekuallikana teiste partnerite värbamise kaudu;",
        "Spämm, loata otseturundus ja võõraste kaubamärkide või sisu kasutamine ilma õiguseta.",
      ],
    },
    {
      heading: "§ 7 Tagastusaken, tagasivõtmine, kinnipidamine",
      paragraphs: [
        "Iga komisjonitasu rida on pärast selle tekkimist avatud 30 päeva (tagastusaken) ja seejärel väljamakstav. Kui aluseks olev arve tagastatakse täielikult või osaliselt või tühistatakse (chargeback), võetakse komisjonitasu – sealhulgas sellel põhinev meeskonnakomisjon – proportsionaalselt tagasi, ka pärast väljamaksmist tulevaste komisjonitasudega tasaarvestamise teel.",
        "Kahtluse korral § 2, § 5 või § 6 rikkumise kohta võib myNextDays hoida jaotusi ja komisjonitasusid kuni selgitamiseni kinni. Kui rikkumine kinnitust leiab, kaotavad asjaomased komisjonitasud kehtivuse.",
      ],
    },
    {
      heading: "§ 8 Väljamakse ja kreedit",
      paragraphs: [
        "Väljamakstavad komisjonitasud koondatakse igakuiselt valuutade kaupa ja makstakse välja, kui need jõuavad programmi lehel või armatuurlaual nimetatud vastava valuuta miinimumsummani. Valuutade vahel ümberarvestust ei toimu.",
        "Arveldamine toimub kreeditmenetluse teel (enesearveldamine, momsloven § 52a): myNextDays koostab iga väljamakse kohta kreeditarve; partner arvet ei esita. Partner nõustub kreeditmenetlusega.",
        "Ettevõtjad saavad kreeditarve koos viitega teenuse saaja maksukohustusele (pöördmaksustamine); eelduseks on kehtiv, kinnitatud käibemaksukohustuslase number. Eraettevõtjad saavad kreeditarve ilma käibemaksuta ja maksustavad komisjonitasu ise.",
        "Väljamakse toimub SEPA-ülekande, Wise'i või PayPali kaudu partneri poolt armatuurlauale sisestatud andmetele.",
      ],
    },
    {
      heading: "§ 9 Andmed ja ülevaade",
      paragraphs: [
        "Partner näeb määratud ettevõtteid pseudonüümselt (number, riik, staatus, summad). Ettevõtete nimesid, e-posti aadresse ega broneeringuandmeid ei avaldata. Sponsor näeb oma meeskonnapartnerite nime või ettevõtte nime, auastet, maksvate klientide arvu ja sellest tulenevat meeskonnakomisjoni, mitte kliendiandmeid.",
        "Seotud kontode ja loodud postituste kohta näeb myNextDays jälgijaid, vaatamisi, interaktsioone ning klikke ja kliente iga postituse kohta. Ebatavalised nähtused (näiteks jälgijate hüpe ilma sobivate vaatamisteta või märkimisväärne lahknevus enesedeklaratsiooni ja kontrollitud väärtuse vahel) on viited isiklikuks kontrolliks vastavalt § 6 ja § 10, mitte automaatne blokeerimine.",
        "Isikuandmete töötlemine partnerprogrammis on kirjeldatud andmekaitsepoliitikas.",
      ],
    },
    {
      heading: "§ 10 Kehtivusaeg, blokeerimine ja ülesütlemine",
      paragraphs: [
        "Osalemine on tähtajatu ja selle saab mõlemalt poolt igal ajal tekstivormis lõpetada. Juba tekkinud, väljamakstavad komisjonitasud makstakse välja vastavalt § 8; pärast lõpetamist uusi komisjonitasusid ei teki.",
        "myNextDays võib partneri nende tingimuste rikkumise korral blokeerida. Blokeerimise ajal hoitakse komisjonitasusid kinni; kinnitatud rikkumise korral need kaotavad kehtivuse.",
      ],
    },
    {
      heading: "§ 11 Muudatused",
      paragraphs: [
        "myNextDays võib neid tingimusi ja astmestikku tulevikus muuta. Muudatused avaldatakse partneri armatuurlaual ja sellel lehel koos versiooninumbriga; oluliste muudatuste korral palutakse partneril uuesti nõustuda. Juba tekkinud vahendustasud jäävad puutumata.",
      ],
    },
    {
      heading: "§ 12 Kohaldatav õigus",
      paragraphs: [
        "Kohaldatakse Taani õigust, välja arvatud kollisiooninormid. Tarbijakaitsenormid riigis, kus eraisikust partneril on alaline elukoht, jäävad puutumata.",
      ],
    },
  ],
};
