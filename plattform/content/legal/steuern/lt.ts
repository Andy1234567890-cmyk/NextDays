import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Mokesčių politika",
  stand: "Atnaujinta: 2026 m. rugpjūčio 18 d.",
  intro: [
    "Šis puslapis paaiškina, kokie mokesčiai ir rinkliavos gali atsirasti rezervuojant per myBestDays, kas juos moka ir kokias deklaravimo pareigas turime mes kaip platformos operatorius.",
    "Tai nėra mokesčių konsultacija. Dėl savo apmokestinimo konkrečiu atveju kreipkitės į mokesčių konsultantą.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Kas susiję su svečiais",
      paragraphs: [
        "Rodoma bendra kaina apima mokesčius, apskaičiuojamus per Platformą – visų pirma PVM už apgyvendinimo paslaugą, jei jį moka teikėjas.",
        "Vietinės rinkliavos, tokios kaip kurortinis mokestis, lovos mokestis ar turizmo rinkliava, priklausomai nuo savivaldybės arba apskaičiuojamos per Platformą, arba renkamos vietoje. Kuris atvejis galioja, nurodome prieš užbaigiant rezervaciją.",
        "Sąskaitą faktūrą už apgyvendinimo paslaugą išrašo teikėjas; jis yra paslaugą teikiantis verslininkas. Jei Jums reikia sąskaitos su nurodytu PVM, prašykite jos iš teikėjo.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Kas susiję su teikėjais",
      paragraphs: [
        "Teikėjai patys atsako už tinkamą savo pajamų apmokestinimą – pajamų arba pelno mokestį, PVM ir vietines rinkliavas.",
        "Ar nuoma apmokestinama PVM ir koks tarifas taikomas, priklauso nuo valstybės, kurioje yra apgyvendinimo vieta, teisės (paslaugos suteikimo vieta nekilnojamojo turto atveju).",
        "Teikėjai savo apgyvendinimo vietai taikomas rinkliavas įveda objekte, kad jos skelbime būtų nurodytos teisingai.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Pranešimas mokesčių institucijoms (DAC7)",
      paragraphs: [
        "Kaip skaitmeninės platformos operatorius pagal Direktyvą (ES) 2021/514 („DAC7“) ir ją įgyvendinančias nacionalines nuostatas privalome kasmet pranešti kompetentingai mokesčių institucijai duomenis apie praneštinus teikėjus ir jų per Platformą gautą atlygį.",
        "Pranešami visų pirma vardas, adresas, mokesčių mokėtojo identifikacinis numeris, gimimo data ar registracijos numeris, sąskaitos duomenys išmokėjimui, apgyvendinimo vietos adresas ir per ketvirtį išmokėtas atlygis bei išskaičiuoti mokesčiai.",
        "Teikėjai gauna praneštų su jais susijusių duomenų kopiją.",
        "Jei teikėjas, nepaisant dviejų raginimų, nepateikia pranešimui reikalingų duomenų, privalome sulaikyti išmokėjimus ir blokuoti paskyrą.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Išskaitymai",
      paragraphs: [
        "Jei kurios nors valstybės teisė mus įpareigoja iš išmokėjimo išskaičiuoti ir pervesti mokesčius, tai darome ir išskaitymą nurodome atsiskaityme.",
      ],
    },
  ],
};
