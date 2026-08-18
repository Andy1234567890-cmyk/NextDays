import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Súlyos zavarokra vonatkozó szabályzat",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "Néha egy esemény akadályozza meg az utazást vagy a tartózkodást, amelyről sem a vendég, sem a szolgáltató nem tehet. A jelen szabályzat leírja, melyek ezek az események, és mi érvényes ilyenkor.",
    "Megelőzi a hirdetésben választott lemondási feltételt.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Mely események tartoznak ide",
      paragraphs: [
        "Ide tartoznak azok az események, amelyek a foglalás után következnek be, mindkét fél számára előre nem láthatók voltak, és az utazást vagy a tartózkodást lehetetlenné vagy jogilag megengedhetetlenné teszik:",
      ],
      list: [
        "hatósági utazási vagy tartózkodási tilalmak, kijárási tilalmak és határlezárások, amelyek az úti célt vagy a kiindulási helyet érintik;",
        "az úti célt érintő természeti katasztrófák és természeti események — földrengés, árvíz, vihar, nagy tűz, vulkánkitörés;",
        "háború, fegyveres összecsapások, terrortámadások és zavargások az úti célban;",
        "hatóságilag megállapított járvány vagy világjárvány olyan intézkedésekkel, amelyek megtiltják a tartózkodást;",
        "az áram-, víz- vagy hőellátás hosszabb időszakra szóló kiesése az úti célban;",
        "az úti célba való eljutás teljes lehetetlenné válása a fentiek valamelyike miatt.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Mely események nem tartoznak ide",
      paragraphs: ["Nem tartoznak ide különösen:"],
      list: [
        "a vendég vagy hozzátartozóinak betegsége vagy sérülése — erre utasbiztosítás szolgál;",
        "munkahelyi akadályoztatás, vizsgaidőpontok vagy a szabadság elmaradása;",
        "olyan rendezvény elmaradása, amely miatt az utazást foglalták, ha a szálláshely használható marad;",
        "olyan időjárás, amely nem minősül természeti katasztrófának — eső, hideg, hőség, hóhiány;",
        "egyes közlekedési eszközök kiesése, amíg ésszerű odautazás lehetséges marad;",
        "egy járat törlése vagy sztrájk egy közlekedési vállalatnál — ezekre a közlekedési vállalattal szemben állnak fenn igények.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Mi érvényes, ha ide tartozó esemény következik be",
      paragraphs: [
        "Ha az esemény érinti a foglalása időszakát, díjmentesen lemondhat. A Platformon keresztül fizetett összeget teljes egészében visszakapja.",
        "Ha a tartózkodás már megkezdődött, visszatérítjük a már nem használható éjszakákra eső részt.",
        "A szolgáltatót az ilyen lemondásból nem éri hátrány a megbízhatóságának megítélésében.",
        "Alternatívaként a szolgáltatóval elhalasztásban is megállapodhat; segítünk az átfoglalásban.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Hogyan hivatkozhat rá",
      paragraphs: [
        "Jelentkezzen a [Panaszok és vitarendezés](https://mybestdays.dk/rechtliches/beschwerden) oldalon található kapcsolattartási utakon, és adja meg a foglalási számot és az eseményt.",
        "Nyilvánosan hozzáférhető források alapján vizsgáljuk — hatósági rendelkezések, hivatalos figyelmeztetések, elismert hírforrások tudósításai —, és gyorsan döntünk.",
        "Ha a helyzet még nem ítélhető meg véglegesen, az érkezés napja előtti rövid időszakig kivárjuk a fejleményeket, és akkor döntünk. A foglalása addig változatlanul fennmarad.",
      ],
    },
  ],
};
