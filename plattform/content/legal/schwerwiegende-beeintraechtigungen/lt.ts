import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika esant dideliems trikdžiams",
  stand: "Atnaujinta: 2026 m. rugpjūčio 18 d.",
  intro: [
    "Kartais kelionę ar viešnagę sutrukdo įvykis, dėl kurio nekaltas nei svečias, nei teikėjas. Ši politika aprašo, kokie tai įvykiai ir kas tada galioja.",
    "Ji viršesnė už skelbime pasirinktą atšaukimo sąlygą.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Kokie įvykiai apimami",
      paragraphs: [
        "Apimami įvykiai, kurie įvyksta po rezervacijos, buvo abiem pusėms nenumatomi ir padaro kelionę ar viešnagę neįmanomą arba teisiškai neleistiną:",
      ],
      list: [
        "valdžios institucijų kelionės ar buvimo draudimai, komendanto valanda ir sienų uždarymai, susiję su kelionės tikslo ar kilmės vieta;",
        "gaivalinės nelaimės ir gamtos reiškiniai, paveikiantys kelionės tikslo vietą – žemės drebėjimas, potvynis, audra, didelis gaisras, ugnikalnio išsiveržimas;",
        "karas, ginkluoti konfliktai, teroro aktai ir neramumai kelionės tikslo vietoje;",
        "valdžios institucijų nustatyta epidemija ar pandemija su priemonėmis, draudžiančiomis viešnagę;",
        "elektros, vandens ar šilumos tiekimo nutrūkimas kelionės tikslo vietoje ilgesnį laiką;",
        "visiškas negalėjimas pasiekti kelionės tikslo vietos dėl vieno iš nurodytų įvykių.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Kokie įvykiai neapimami",
      paragraphs: ["Neapimami visų pirma:"],
      list: [
        "svečio ar jo artimųjų liga ar sužalojimas – tam skirtas kelionės draudimas;",
        "profesinės kliūtys, egzaminų datos ar atostogų netekimas;",
        "renginio, dėl kurio kelionė buvo rezervuota, atšaukimas, jei apgyvendinimo vieta lieka tinkama naudoti;",
        "oras, kuris nėra gaivalinė nelaimė – lietus, šaltis, karštis, sniego trūkumas;",
        "atskirų transporto priemonių neveikimas, kol lieka galimas protingas atvykimas;",
        "skrydžio atšaukimas ar streikas transporto įmonėje – tam yra reikalavimai transporto įmonei.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Kas galioja įvykus apimtam įvykiui",
      paragraphs: [
        "Jei įvykis susijęs su Jūsų rezervacijos laikotarpiu, galite atšaukti nemokamai. Per Platformą sumokėtą sumą gaunate visą atgal.",
        "Jei viešnagė jau prasidėjo, grąžiname dalį už naktis, kurių nebegalima panaudoti.",
        "Teikėjui dėl tokio atšaukimo neatsiranda trūkumų vertinant jo patikimumą.",
        "Kaip alternatyvą su teikėju galite susitarti dėl atidėjimo; padedame perrezervuoti.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Kaip ja remtis",
      paragraphs: [
        "Susisiekite kontaktiniais keliais skiltyje [Skundai ir ginčų sprendimas](https://mybestdays.dk/rechtliches/beschwerden) ir nurodykite rezervacijos numerį bei įvykį.",
        "Tikriname remdamiesi viešai prieinamais šaltiniais – valdžios institucijų nurodymais, oficialiais įspėjimais, pripažintų naujienų šaltinių pranešimais – ir sprendžiame greitai.",
        "Jei padėties dar negalima galutinai įvertinti, laukiame raidos iki pat prieš atvykimo dieną ir tada sprendžiame. Jūsų rezervacija iki tol lieka nepakitusi.",
      ],
    },
  ],
};
