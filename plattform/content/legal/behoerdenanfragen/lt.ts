import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika dėl institucijų ir teisėsaugos užklausų",
  stand: "Atnaujinta: 2026 m. rugpjūčio 18 d.",
  intro: [
    "Ši politika skirta institucijoms, teismams ir teisėsaugos įstaigoms, kurios iš myBestDays reikalauja duomenų arba pateikia nurodymą dėl turinio. Ji čia vieša, kad ir naudotojai galėtų perskaityti, kokiomis sąlygomis duomenis teikiame.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principas",
      paragraphs: [
        "Naudotojų duomenis teikiame tik tada, kai yra galiojantis teisinis pagrindas ir užklausa atitinka formalius reikalavimus. Neformalus prašymas duomenų nepakanka.",
        "Kiekvieną užklausą tikriname dėl kompetencijos, teisinio pagrindo, apibrėžtumo ir proporcingumo ir teikiame tik tuos duomenis, kuriuos užklausa nurodo.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Reikalavimai užklausai",
      paragraphs: ["Užklausoje turėtų būti:"],
      list: [
        "besikreipianti institucija, bylos numeris ir nagrinėjančio asmens kontaktiniai duomenys oficialiame blanke;",
        "teisinis pagrindas pagal nacionalinę ar Sąjungos teisę;",
        "tikslus atitinkamo asmens ar atitinkamos paskyros nurodymas – el. pašto adresas, rezervacijos numeris ar skelbimo URL;",
        "tiksliai nurodyti duomenys ir laikotarpis;",
        "prireikus teismo nurodymas, jei taikytina teisė to reikalauja;",
        "nuoroda, jei atitinkamo asmens informavimas keltų pavojų tyrimui, nurodant teisinį pagrindą.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Nurodymai pagal Reglamentą (ES) 2022/2065",
      paragraphs: [
        "Nurodymuose imtis veiksmų prieš neteisėtą turinį (9 straipsnis) ir nurodymuose pateikti informaciją (10 straipsnis) turi būti ten nurodyti duomenys, visų pirma teisinis pagrindas, tiksli elektroninė vieta, motyvai, teisių gynimo priemonės ir kalba.",
        "Gavimą patvirtiname ir nurodymą išdavusiai institucijai pranešame, kokių priemonių ėmėmės ir kada.",
        "Apie nurodymą informuojame atitinkamą asmenį ne vėliau kaip įgyvendinimo metu, nebent institucija, nurodydama teisinį pagrindą, nurodo atidėti.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Skubūs atvejai",
      paragraphs: [
        "Esant tiesioginiam pavojui gyvybei ar kūno neliečiamumui, jam pašalinti reikalingus duomenis teikiame ir be išankstinio oficialaus nurodymo. Tokią užklausą aiškiai pažymėkite kaip skubią ir aprašykite pavojų.",
        "Esant požymių dėl nusikalstamos veikos, keliančios pavojų asmens gyvybei ar saugumui, kompetentingas institucijas informuojame savo iniciatyva (Reglamento (ES) 2022/2065 18 straipsnis).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Kokius duomenis turime",
      paragraphs: [
        "Kokias duomenų kategorijas tvarkome ir kiek laiko juos saugome, nurodyta [Privatumo politikoje](https://mybestdays.dk/rechtliches/datenschutz). Ilgiau nei ten nurodyti terminai duomenų nesaugome.",
        "Duomenų saugojimas viršijant poreikį nevykdomas. Raginimą laikinai išsaugoti duomenis vykstančiam procesui vykdome teisiškai leistinose ribose.",
        "Visų mokėjimo duomenų neturime; jų reikia teirautis mokėjimo paslaugų teikėjo.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Atitinkamo asmens informavimas",
      paragraphs: [
        "Atitinkamus naudotojus apie užklausą, susijusią su jų duomenimis, informuojame, nebent tai draudžia teisės aktas ar motyvuotas institucijos nurodymas arba yra tiesioginis pavojus gyvybei ar kūno neliečiamumui.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Kur siųsti užklausas",
      paragraphs: [
        "Užklausas siųskite į bendrą kontaktinį punktą institucijoms, nurodytą skiltyje [Skaitmeninių paslaugų aktas](https://mybestdays.dk/rechtliches/dsa). Nagrinėjame jas vokiečių ir anglų kalbomis.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Skaidrumas",
      paragraphs: [
        "Institucijų nurodymų skaičių ir rūšį nurodome savo metinėje skaidrumo ataskaitoje; žr. [Skaitmeninių paslaugų aktas](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
