import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Platformon kívüli díjak",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "A jelen szabályzat rendezi, mely összegeket kérhet egy szolgáltató a Platformon kívül, és melyeket nem. Megvédi a vendégeket attól, hogy a helyszínen olyan követelésekkel szembesüljenek, amelyek nem szerepeltek a hirdetésben.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Alapelv",
      paragraphs: [
        "Mindent, ami a foglalt szolgáltatásért fizetendő, a foglalás lezárása előtt fel kell tüntetni a hirdetésben — vagy a teljes ár részeként, vagy helyszíni költségtételként.",
        "Az az összeg, amely sem a teljes árban, sem helyszíni költségként nem szerepelt, a vendégtől nem követelhető.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Mi kérhető a helyszínen",
      paragraphs: ["A helyszínen kizárólag a következők kérhetők:"],
      list: [
        "a hirdetésben kifejezetten helyszíni költségként feltüntetett összegek (például végtakarítás, ágyneműcsomag, parkolóhely);",
        "helyi illetékek, például az idegenforgalmi adó, amennyiben a helyi előírások szerint a helyszínen fizetendő;",
        "a hirdetésben feltüntetett kaució;",
        "olyan szolgáltatások, amelyeket a vendég csak a helyszínen és önként vesz igénybe, előzetesen megnevezett áron;",
        "a vendég által okozott, igazolt károk megtérítése.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Mi nem kérhető",
      paragraphs: ["Nem megengedett különösen:"],
      list: [
        "a szállásdíjra vonatkozó utólagos követelés a foglalás lezárása után;",
        "díj azért, mert a foglalás a myBestDays-en keresztül történt;",
        "olyan kezelési, foglalási vagy kártyadíj, amely nem szerepelt a hirdetésben;",
        "felszólítás a foglalás lemondására és ugyanazon szálláshely Platformon kívüli újrafoglalására;",
        "felszólítás az ár vagy egy részének átutalással, készpénzzel vagy Platformon kívüli fizetési szolgáltatással történő kiegyenlítésére, ha a hirdetés a Platformon keresztüli fizetést irányozza elő.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. A Platform megkerülése",
      paragraphs: [
        "Ha a vendég és a szolgáltató közötti kapcsolat a Platformon keresztül jött létre, a foglalás nem bonyolítható le a Platformot megkerülve. Ez mindkét félre vonatkozik.",
        "Aki megkerüli a Platformot, elveszíti annak védelmét: a fizetések nem biztosítottak, a lemondási és visszatérítési szabályzataink nem alkalmazandók, és vita esetén nem tudunk közvetíteni.",
        "A jogsértések a fiók letiltásához vezethetnek. A szolgáltatóknál kiegészítőleg érvényesíthetjük az elmaradt szolgáltatási díjat.",
      ],
    },
    {
      id: "melden",
      heading: "5. Bejelentés",
      paragraphs: [
        "Ha a helyszínen olyan összeget kérnek Öntől, amely nem szerepelt a hirdetésben, ne fizesse ki, és jelentse be nekünk a [Panaszok és vitarendezés](https://mybestdays.dk/rechtliches/beschwerden) oldalon található kapcsolattartási utakon. Ha már fizetett, segítünk a visszakövetelésben.",
      ],
    },
  ],
};
