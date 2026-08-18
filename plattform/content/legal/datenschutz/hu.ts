import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Adatvédelmi tájékoztató",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "A jelen tájékoztató leírja, mely személyes adatokat kezeli a myBestDays, milyen célból, milyen jogalapon, és milyen jogai vannak Önnek. A weboldalra, a mobilalkalmazásokra és a Platformhoz való minden egyéb hozzáférésre vonatkozik.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Adatkezelő és adatvédelmi tisztviselő",
      paragraphs: [
        `Az (EU) 2016/679 rendelet (GDPR) értelmében vett adatkezelő a ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dánia, CVR-szám ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. A szolgáltató teljes adatai az [Impresszumban](https://mybestdays.dk/rechtliches/impressum) találhatók.`,
        "Adatvédelmi tisztviselőt nem neveztünk ki; a GDPR 37. cikkének feltételei nem állnak fenn. Adatvédelmi kérdéseit a fenti e-mail-címre küldje.",
        "Azok a szolgáltatók, akiknél foglal, a tőlünk kapott adatok tekintetében önálló adatkezelők. Rájuk a [Házigazdákra vonatkozó adatvédelmi előírások](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber) vonatkoznak.",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Mely adatokat kezeljük",
      paragraphs: ["Attól függően, hogyan használja a Platformot, a következőket kezeljük:"],
      list: [
        "alapadatok — név, e-mail-cím, telefonszám, nyelv és pénznem, jelszó titkosított formában;",
        "foglalási adatok — a foglalt szálláshely, időszak, az utazók száma és neve, különleges kérések, a foglalás állapota;",
        "fizetési adatok — összeg, pénznem, a fizetés állapota, a fizetési eszköz utolsó számjegyei és a pénzforgalmi szolgáltatónk tranzakcióazonosítója. Teljes kártyaadatok nem jutnak el hozzánk;",
        "kommunikációs adatok — az Ön és a szolgáltató közötti üzenetek, ügyfélszolgálatunkhoz intézett megkeresések, panaszok;",
        "tartalmi adatok — értékelések, fényképek, kívánságlisták;",
        "használati adatok — meglátogatott oldalak, keresési lekérdezések, a hozzáférés időpontja;",
        "műszaki adatok — IP-cím, böngésző- és eszközazonosítók, operációs rendszer, hivatkozó oldal.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Célok és jogalapok",
      paragraphs: [
        "A Platform biztosítása, fiók, keresés, foglalás, fizetéslebonyolítás és a szolgáltatóval való kommunikáció — GDPR 6. cikk (1) bekezdés b) pont (szerződés vagy szerződéskötést megelőző lépések).",
        "Ügyfélszolgálat, panaszkezelés és vitarendezés — GDPR 6. cikk (1) bekezdés b) és f) pont.",
        "Csalás, visszaélés és biztonsági események felderítése és megelőzése, feltételeink érvényesítése — GDPR 6. cikk (1) bekezdés f) pont (jogos érdek a biztonságos piactérhez).",
        "Értékelések és azok közzététele — GDPR 6. cikk (1) bekezdés b) és f) pont.",
        "Jogi kötelezettségek teljesítése, különösen kereskedelmi és adójogi megőrzési kötelezettségek, az (EU) 2021/514 irányelv (DAC7) szerinti bejelentési kötelezettségek és az (EU) 2022/2065 rendelet szerinti kötelezettségek — GDPR 6. cikk (1) bekezdés c) pont.",
        "A Platform javítása aggregált használati adatok elemzésével — GDPR 6. cikk (1) bekezdés f) pont.",
        "Reklám e-mailek és nem szükséges sütik — GDPR 6. cikk (1) bekezdés a) pont (hozzájárulás), amelyet bármikor visszavonhat a jövőre nézve.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Címzettek",
      paragraphs: [
        "A szolgáltatók megkapják azokat az adatokat, amelyekre a foglalása teljesítéséhez és jogi kötelezettségeik teljesítéséhez szükségük van — különösen a nevet, az elérhetőségeket, az időszakot, az utazók számát és a nekik szóló üzeneteit.",
        "Pénzforgalmi szolgáltatónk, a Stripe önálló adatkezelőként kezeli a fizetési adatokat; kiegészítőleg a [Stripe adatvédelmi tájékoztatója](https://stripe.com/privacy) alkalmazandó.",
        "Azok a szolgáltatók, amelyek számunkra a tárhelyszolgáltatást, adatbázis-üzemeltetést, e-mail-küldést, hibadiagnosztikát és ügyfélszolgálati eszközöket biztosítják, az adatokat kizárólag a mi utasításaink szerint, a GDPR 28. cikke szerinti szerződés alapján kezelik.",
        "A hatóságok és bíróságok csak annyiban kapnak adatot, amennyiben erre kötelesek vagyunk; lásd a [Hatósági és bűnüldözési megkeresésekre vonatkozó szabályzatot](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Az adóhatóságok megkapják a szolgáltatók DAC7 szerint bejelentendő adatait.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Harmadik országba történő továbbítás",
      paragraphs: [
        "Szervereink és adatfeldolgozóink szerverei az Európai Unióban találhatók.",
        "Ha egyedi esetekben az Európai Gazdasági Térségen kívüli adatkezelésre kerül sor, az kizárólag az Európai Bizottság megfelelőségi határozata vagy a GDPR 46. cikke (2) bekezdésének c) pontja szerinti általános szerződési feltételek alapján, kiegészítő garanciákkal együtt történik.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Megőrzési idők",
      paragraphs: [
        "A fiókadatokat addig őrizzük, amíg a fiókja fennáll, majd töröljük azokat, amennyiben nem áll fenn megőrzési kötelezettség.",
        "A foglalási és fizetési adatokra kereskedelmi és adójogi megőrzési határidők vonatkoznak; a dán számviteli jog szerint ezek rendszerint öt évet jelentenek attól az üzleti évtől számítva, amelyre az adatok vonatkoznak.",
        "A foglaláshoz tartozó üzeneteket a tartózkodás vége után legfeljebb három évig őrizzük, hogy a viták tisztázhatók legyenek.",
        "Az értékelések a fiókja törlése után anonimizált formában megmaradnak, mivel a szálláshely értékelési alapjának részét képezik.",
        "A csalási és visszaélési esetek adatait addig őrizzük, ameddig ez a további jogsértések elhárításához szükséges, de legfeljebb három évig az utolsó esettől számítva.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Az Ön jogai",
      paragraphs: ["A GDPR szerint az alábbi jogokkal rendelkezik:"],
      list: [
        "hozzáférés az Önről tárolt adatokhoz (15. cikk);",
        "a helytelen adatok helyesbítése (16. cikk);",
        "törlés (17. cikk), amennyiben nem áll fenn megőrzési kötelezettség;",
        "az adatkezelés korlátozása (18. cikk);",
        "adathordozhatóság (20. cikk);",
        "tiltakozás a jogos érdeken alapuló adatkezelés ellen (21. cikk), különösen a közvetlen üzletszerzés ellen;",
        "a megadott hozzájárulás visszavonása a jövőre nézve (7. cikk (3) bekezdés);",
        `panasz a felügyeleti hatóságnál (77. cikk) — a lakóhelye, munkahelye vagy a feltételezett jogsértés helye szerinti hatóság illetékes. Az adatkezelő székhelyén ez a ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Dánia, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Hogyan gyakorolhatja jogait",
      paragraphs: [
        `Sok adatot közvetlenül a fiókjában tekinthet meg, módosíthat vagy törölhet. Minden egyéb esetben forduljon a ${ANBIETER.email} címre.`,
        "Haladéktalanul, de legkésőbb egy hónapon belül válaszolunk. Ha a határidőt nem tudjuk tartani, ezt indokolással közöljük Önnel.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Automatizált döntések",
      paragraphs: [
        "Automatizált eljárásokat alkalmazunk csalás, visszaélés és jogellenes tartalom felderítésére. Ha ilyen eljárás a fiókja vagy tartalma elleni intézkedéshez vezet, azt megindokoljuk, és Ön emberi felülvizsgálatot kérhet.",
        "A GDPR 22. cikke értelmében vett, kizárólag automatizált adatkezelésen alapuló, joghatással járó döntést nem hozunk.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Az adatszolgáltatási kötelezettség",
      paragraphs: [
        "A foglaláshoz szükséges adatokat meg kell adnia; ezek nélkül szerződés nem köthető és szálláshely nem biztosítható. Minden egyéb adat megadása önkéntes.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. A jelen tájékoztató módosításai",
      paragraphs: [
        "A jelen tájékoztatót módosítjuk, ha az adatkezelés vagy a jogi helyzet változik. A mindenkor hatályos változat itt érhető el; a frissítés dátuma fent szerepel.",
      ],
    },
  ],
};
