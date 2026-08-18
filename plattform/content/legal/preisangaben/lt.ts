import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Kainos, reitingavimas ir rekomendacijos",
  stand: "Atnaujinta: 2026 m. rugpjūčio 18 d.",
  intro: [
    "Šis puslapis paaiškina, kaip myBestDays rodomos kainos, nuo ko priklauso paieškos rezultatų eiliškumas ir kaip atsiranda rekomendacijos. Jis įgyvendina skaidrumo pareigas pagal Direktyvos 2005/29/EB 6a straipsnį, Reglamento (ES) 2019/1150 5 straipsnį ir Reglamento (ES) 2022/2065 27 straipsnį.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Kaip rodomos kainos",
      paragraphs: [
        "Kai tik žinomi laikotarpis ir keliautojų skaičius, rodome bendrą kainą už visą viešnagę, įskaitant mokesčius ir visas per Platformą apskaičiuojamas rinkliavas.",
        "Kol laikotarpis nepasirinktas, rodome kainą už naktį kaip orientacinę ir taip ją pažymime.",
        "Išlaidas, atsirandančias tik vietoje, nurodome atskirai prieš užbaigiant rezervaciją. Jos nėra bendros kainos dalis, tačiau matomos prieš rezervaciją.",
        "Jei rodome perbrauktą palyginamąją kainą, tai yra mažiausia kaina, kurios teikėjas už tą pačią paslaugą prašė per paskutines 30 dienų iki nuolaidos (Direktyvos 98/6/EB 6a straipsnis).",
        "Kainos visiems svečiams vienodos. Kainos nepritaikome pagal Jūsų asmenį, Jūsų įrenginį ar Jūsų ankstesnę paieškos elgseną.",
      ],
    },
    {
      id: "ranking",
      heading: "2. Nuo ko priklauso paieškos rezultatų eiliškumas",
      paragraphs: [
        "Numatytajame rikiavime eiliškumą lemia šie požymiai, mažėjančia svarba:",
      ],
      list: [
        "atitikimas Jūsų paieškai – prieinamumas ieškomu laikotarpiu, talpa keliautojų skaičiui, vieta ieškomoje teritorijoje ir nustatyti filtrai;",
        "skelbimo išsamumas ir kokybė – aprašymas, nuotraukos, tvarkingi įrangos duomenys;",
        "atsiliepimai – bendras įvertinimas ir atsiliepimų skaičius;",
        "teikėjo patikimumas – atsakymo elgsena, priėmimo dalis ir teikėjo atšaukimai;",
        "kainų ir prieinamumo aktualumas;",
        "kainos ir kokybės santykis palyginti su panašiais skelbimais toje pačioje teritorijoje.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Mokamas išdėstymas",
      paragraphs: [
        "Teikėjas negali nusipirkti geresnės vietos numatytajame rikiavime. Paslaugos mokesčio dydis eiliškumui įtakos nedaro.",
        "Jei ateityje siūlytume mokamus išdėstymus, juos vienareikšmiškai pažymėsime kaip reklamą ir matomai atskirsime nuo kitų rezultatų.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Rikiavimo keitimas",
      paragraphs: [
        "Rikiavimą galite bet kada pakeisti, pavyzdžiui, pagal kainą ar atsiliepimą. Kuris rikiavimas aktyvus, rodoma virš rezultatų sąrašo.",
        "Jums prieinamas bent vienas rikiavimas, kuris nėra pagrįstas profiliavimu, kaip apibrėžta Reglamento (ES) 2016/679 4 straipsnio 4 punkte.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Rekomendacijos",
      paragraphs: [
        "Jei Jums rodome pasiūlymus („gali patikti“, „panašios apgyvendinimo vietos“), jie grindžiami dabartine paieška, anksčiau peržiūrėtais skelbimais ir panašių apgyvendinimo vietų požymiais.",
        "Suasmenintas rekomendacijas galite išjungti savo paskyroje. Po to matysite pasiūlymus, grindžiamus tik dabartine paieška.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Atsiliepimai reitingavime",
      paragraphs: [
        "Kaip atsiliepimai atsiranda ir kaip tikrinami, nurodyta [Atsiliepimų politikoje](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). Atsiliepimai daro įtaką eiliškumui, tačiau atskirų atsiliepimų nevertiname labiau ir neigiamų neslopiname.",
      ],
    },
  ],
};
