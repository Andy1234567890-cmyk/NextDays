import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Házigazdákra vonatkozó adatvédelmi előírások",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "Ha a myBestDays-en kínál, megkapja vendégei személyes adatait. Azok kezeléséért Ön önálló adatkezelő az (EU) 2016/679 rendelet (GDPR) értelmében. A jelen előírások leírják, mit várunk el Öntől ennek során.",
  ],
  sections: [
    {
      id: "zweckbindung",
      heading: "1. Célhoz kötöttség",
      paragraphs: [
        "A vendégadatokat kizárólag a foglalás lebonyolítására, a vendéggel való kommunikációra és jogszabályi kötelezettségei teljesítésére használja (például bejelentőlap, idegenforgalmi adó, adó- és megőrzési kötelezettségek).",
        "Minden további felhasználás — különösen reklám, hírlevél, harmadik félnek történő továbbítás, saját vendégnyilvántartásba vétel későbbi közvetlen foglalásokhoz — önálló jogalapot igényel, rendszerint a vendég hozzájárulását.",
        "Nem használja a vendégadatokat arra, hogy a vendéget a Platformon kívüli foglalásra bírja.",
      ],
    },
    {
      id: "datensparsamkeit",
      heading: "2. Adattakarékosság",
      paragraphs: [
        "Csak azokat az adatokat gyűjti, amelyekre ténylegesen szüksége van. Személyazonosító okmány másolatát csak akkor kér, ha jogszabály előírja, és csak addig tárolja, ameddig az előírás rendelkezik.",
        "Fizetési adatokat nem kér. A fizetések a Platformon keresztül zajlanak.",
      ],
    },
    {
      id: "sicherheit",
      heading: "3. Biztonság",
      paragraphs: [
        "A vendégadatokat megfelelő technikai és szervezési intézkedésekkel védi — hozzáférés csak azoknak, akiknek szükségük van rá, védett eszközök, titkosított továbbítás.",
        "Ha munkatársakat, takarítószemélyzetet vagy társházigazdákat alkalmaz, titoktartásra kötelezi őket, és csak azokat az adatokat adja meg, amelyekre a feladatukhoz szükségük van.",
      ],
    },
    {
      id: "loeschung",
      heading: "4. Megőrzés és törlés",
      paragraphs: [
        "A vendégadatokat törli, amint a cél megszűnt, és már nem áll fenn megőrzési kötelezettség.",
        "A bejelentőlapokat és az adózás szempontjából releváns dokumentumokat addig őrzi meg, ameddig országa joga előírja — tovább nem.",
      ],
    },
    {
      id: "rechte",
      heading: "5. A vendégek jogai",
      paragraphs: [
        "Ha egy vendég hozzáférési, helyesbítési, törlési vagy tiltakozási kérelemmel fordul Önhöz, azt határidőn belül megválaszolja. Ha az nálunk tárolt adatokat érint, hozzánk irányítja.",
        "Tájékoztatja vendégeit arról, hogyan kezeli az adataikat, amennyiben túllép a foglalás lebonyolításán.",
      ],
    },
    {
      id: "vorfall",
      heading: "6. Adatvédelmi incidensek",
      paragraphs: [
        "Ha a vendégadatok védelmének megsértése történik, haladéktalanul értesíti az illetékes felügyeleti hatóságot, és ahol szükséges, az érintett vendégeket.",
        "Ha az incidens a Platformon keresztül kapott adatokat érinti, kiegészítőleg minket is értesít, hogy megvizsgálhassuk saját kötelezettségeinket.",
      ],
    },
    {
      id: "kameras",
      heading: "7. Kamerák és rögzítőeszközök",
      paragraphs: [
        "A magánélet védelmére vonatkozó jogos elvárással bíró belső terekben — hálószobák, fürdőszobák — a kamerák és mikrofonok nem megengedettek, kikapcsolva sem.",
        "Minden egyéb kamerát, rögzítéssel járó mozgásérzékelőt, kamerás csengőt és zajérzékelőt feltüntet a hirdetésben, megadva az elhelyezést és azt, hogy mit rögzít.",
      ],
    },
    {
      id: "folgen",
      heading: "8. A jogsértések következményei",
      paragraphs: [
        "A jelen előírások megsértését a [Kiegészítő feltételek házigazdáknak](https://mybestdays.dk/rechtliches/gastgeber-bedingungen) megsértéseként kezeljük, és intézkedéseket hozhatunk a fiók letiltásáig.",
      ],
    },
  ],
};
