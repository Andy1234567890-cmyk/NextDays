import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Slapukų politika",
  stand: "Atnaujinta: 2026 m. rugpjūčio 18 d.",
  intro: [
    "Ši politika paaiškina, kokius slapukus ir panašias technologijas naudoja myBestDays, kokiu tikslu, kiek laiko jie saugomi ir kaip juos valdote.",
    "Ji papildo [Privatumo politiką](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Kas yra slapukai",
      paragraphs: [
        "Slapukai yra maži tekstiniai failai, kuriuos svetainė išsaugo Jūsų naršyklėje. Panašios technologijos yra naršyklės vietinė saugykla ir sekimo pikseliai el. laiškuose.",
        "Slapukus, kurie būtini Platformos veikimui, galime nustatyti be Jūsų sutikimo. Dėl visų kitų prašome Jūsų sutikimo (Direktyvos 2002/58/EB 5 straipsnio 3 dalis).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Būtinieji slapukai",
      paragraphs: [
        "Šie slapukai reikalingi veikimui ir jų negalima atsisakyti. Šiuo metu naudojame:",
      ],
      list: [
        "„nd_access“ – palaiko Jūsų prisijungimą. Skaitomas tik serverio (HttpOnly), trukmė atitinka seanso galiojimą.",
        "„nd_refresh“ – atnaujina Jūsų prisijungimą, kad nereikėtų nuolat prisijungti iš naujo. Skaitomas tik serverio, trukmė 30 dienų.",
        "„nd_gast_locale“ – įsimena Jūsų pasirinktą kalbą. Trukmė vieni metai.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Funkciniai, statistiniai ir rinkodaros slapukai",
      paragraphs: [
        "myBestDays šiuo metu nenaudoja slapukų statistikai, pasiekiamumo matavimui ar reklamai ir neįterpia reklamos tinklų ar analizės paslaugų.",
        "Jei tai pasikeistų, iš anksto prašysime Jūsų sutikimo per pasirinkimo dialogą, kuriame atsisakyti bus taip pat paprasta, kaip ir sutikti, ir šią politiką papildysime konkrečiais slapukais.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Įterptas trečiųjų šalių turinys",
      paragraphs: [
        "Išsamios informacijos puslapiuose gali būti įterptų žemėlapių. Tokį turinį įkeliame tik tada, kai jį aiškiai aktyvuojate; tik tada duomenys gali būti perduoti atitinkamam teikėjui.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Kaip valdote slapukus",
      paragraphs: [
        "Savo sutikimą galite bet kada pakeisti ar atšaukti per slapukų nustatymus poraštėje.",
        "Be to, slapukus galite ištrinti ar blokuoti savo naršyklėje. Ištrynus būtinuosius slapukus būsite atjungti, o Platforma veiks ribotai.",
      ],
    },
  ],
};
