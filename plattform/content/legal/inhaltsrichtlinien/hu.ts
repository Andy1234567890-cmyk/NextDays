import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Megfelelő tartalomra vonatkozó szabályok",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "A jelen szabályok minden olyan tartalomra vonatkoznak, amelyet a felhasználók a myBestDays-en közzétesznek: hirdetések, fényképek, értékelések, üzenetek, profiladatok és értékelésekre adott válaszok.",
    "A [Felhasználási feltételek](https://mybestdays.dk/rechtliches/nutzungsbedingungen) részét képezik. A megsértésük a tartalom eltávolításához és a fiókkal szembeni intézkedésekhez vezethet.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Mi nem megengedett",
      paragraphs: ["A myBestDays-en különösen a következő tartalmak nem megengedettek:"],
      list: [
        "bármilyen jogellenes tartalom, különösen bűncselekményre való felhívás, terrorista tartalom és gyermekek szexuális bántalmazását ábrázoló tartalom;",
        "olyan tartalom, amely származás, bőrszín, vallás, világnézet, nem, nemi identitás, szexuális irányultság, fogyatékosság vagy életkor alapján gyűlöletre vagy erőszakra uszít személyek vagy csoportok ellen;",
        "sértegetés, fenyegetés, zaklatás és egyes személyek célzott pellengérre állítása;",
        "harmadik személyek személyes adatai azok hozzájárulása nélkül, különösen nevek, címek, telefonszámok, személyazonosító vagy fizetési adatok;",
        "megtévesztő adatok egy szálláshelyről, annak fekvéséről, felszereltségéről, méretéről vagy elérhetőségéről;",
        "mások fényképei, szövegei vagy védjegyei a szükséges jogok nélkül;",
        "reklám, kéretlen üzenet és olyan tartalom, amely a Platformon kívüli más foglalási utakra vezet;",
        "kártékony szoftver, adathalász kísérletek és az ilyen tartalomra mutató hivatkozások;",
        "szállásszolgáltatáson kívül másra vonatkozó hirdetések.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Fényképek",
      paragraphs: [
        "A fényképeknek a ténylegesen kínált szálláshelyet kell mutatniuk, és olyan állapotban kell készülniük, amely a mainak megfelel.",
        "A fényképek nem mutathatnak felismerhető személyeket azok hozzájárulása nélkül. A szerkesztés annyiban megengedett, amennyiben nem torzítja el a szálláshelyről alkotott képet — világosítás igen, retusált szomszédos épület nem.",
        "A szálláshelyen belüli kamerás megfigyelést a hirdetésben közzé kell tenni. Olyan belső terekben, ahol a vendégeknek jogos elvárásuk van a magánélet védelmére — hálószobák, fürdőszobák —, a kamerák nem megengedettek, kikapcsolva sem.",
      ],
    },
    {
      id: "melden",
      heading: "3. Tartalom bejelentése",
      paragraphs: [
        "Ha egy tartalmat jogellenesnek vagy a jelen szabályokba ütközőnek tart, bejelentheti azt a minden hirdetésnél, értékelésnél és üzenetnél elérhető bejelentő funkción keresztül.",
        "Az (EU) 2022/2065 rendelet 16. cikke szerinti bejelentési eljárást és a bejelentések kezelését a [Digitális szolgáltatásokról szóló jogszabály](https://mybestdays.dk/rechtliches/dsa) írja le.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Hogyan érvényesítjük a szabályokat",
      paragraphs: [
        "Minden bejelentett tartalmat megvizsgálunk, és a legenyhébb alkalmas intézkedést választjuk: figyelmeztetés, az érintett rész eltávolítása, a teljes tartalom eltávolítása, a láthatóság korlátozása, egy funkció letiltása vagy a fiók letiltása.",
        "Az ismétlődő vagy súlyos jogsértések nagyobb súllyal esnek latba. Nyilvánvalóan jogellenes tartalom vagy személyek veszélyeztetése esetén azonnal eljárunk.",
        "Minden intézkedést megindokolunk az érintett személy felé, és felhívjuk a figyelmet a panasz útjára. A panaszt emberek dolgozzák fel.",
      ],
    },
  ],
};
