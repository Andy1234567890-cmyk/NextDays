import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Adózási szabályzat",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "Ez az oldal elmagyarázza, milyen adók és illetékek merülhetnek fel egy myBestDays-en keresztüli foglalásnál, ki köteles megfizetni azokat, és milyen bejelentési kötelezettségek terhelnek minket platformüzemeltetőként.",
    "Ez nem adótanácsadás. Az egyedi esetben történő adójogi megítéléshez forduljon adótanácsadóhoz.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Ami a vendégeket érinti",
      paragraphs: [
        "A megjelenített teljes ár tartalmazza a Platformon keresztül elszámolt adókat — különösen a szállásszolgáltatásra eső áfát, amennyiben azt a szolgáltató köteles megfizetni.",
        "A helyi illetékeket, például az idegenforgalmi adót, az ágyadót vagy a turisztikai hozzájárulást településtől függően vagy a Platformon keresztül számoljuk el, vagy a helyszínen szedik be. Hogy melyik eset áll fenn, azt a foglalás lezárása előtt feltüntetjük.",
        "A szállásszolgáltatásról a szolgáltató állít ki számlát; ő a teljesítő vállalkozó. Ha áfát tartalmazó számlára van szüksége, azt a szolgáltatótól kérje.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Ami a szolgáltatókat érinti",
      paragraphs: [
        "A szolgáltatók maguk felelnek jövedelmeik helyes adójogi kezeléséért — jövedelem- vagy társasági adó, áfa és helyi illetékek.",
        "Hogy egy bérbeadás áfaköteles-e és milyen kulcs alkalmazandó, az annak az államnak a joga szerint alakul, amelyben a szálláshely található (ingatlanoknál a teljesítés helye).",
        "A szolgáltatók az objektumban rögzítik a szálláshelyükre vonatkozó illetékeket, hogy azok a hirdetésben helyesen jelenjenek meg.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Bejelentés az adóhatóságoknak (DAC7)",
      paragraphs: [
        "Digitális platform üzemeltetőjeként az (EU) 2021/514 irányelv („DAC7”) és az azt átültető nemzeti előírások szerint kötelesek vagyunk évente bejelenteni az illetékes adóhatóságnak az adatszolgáltatási kötelezettség alá tartozó szolgáltatókra és az általuk a Platformon keresztül elért ellenszolgáltatásokra vonatkozó adatokat.",
        "Bejelentésre kerül különösen a név, a cím, az adóazonosító szám, a születési dátum vagy nyilvántartási szám, a kifizetéshez tartozó számlaadatok, a szálláshely címe és a negyedévenként kifizetett ellenszolgáltatások, valamint a visszatartott díjak.",
        "A szolgáltatók másolatot kapnak a rájuk vonatkozó bejelentett adatokról.",
        "Ha egy szolgáltató kétszeri felszólítás ellenére sem bocsátja rendelkezésre a bejelentéshez szükséges adatokat, kötelesek vagyunk visszatartani a kifizetéseket és letiltani a fiókot.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Levonások",
      paragraphs: [
        "Ha egy állam joga arra kötelez minket, hogy egy kifizetésből adót vonjunk le és fizessünk be, ezt megtesszük, és a levonást feltüntetjük az elszámolásban.",
      ],
    },
  ],
};
