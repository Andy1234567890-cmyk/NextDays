import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Mokesčiai už platformos ribų",
  stand: "Atnaujinta: 2026 m. rugpjūčio 18 d.",
  intro: [
    "Ši politika reglamentuoja, kokių sumų teikėjas gali reikalauti už Platformos ribų, o kokių ne. Ji apsaugo svečius nuo to, kad vietoje susidurtų su reikalavimais, kurių skelbime nebuvo.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principas",
      paragraphs: [
        "Visa, kas mokėtina už rezervuotą paslaugą, turi būti nurodyta skelbime prieš užbaigiant rezervaciją – arba kaip bendros kainos dalis, arba kaip išlaidų vietoje pozicija.",
        "Suma, kuri nebuvo nurodyta nei bendroje kainoje, nei kaip išlaidos vietoje, svečio nėra mokėtina.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Ko galima reikalauti vietoje",
      paragraphs: ["Vietoje galima reikalauti tik:"],
      list: [
        "sumų, skelbime aiškiai nurodytų kaip išlaidos vietoje (pavyzdžiui, galutinis valymas, patalynės paketas, stovėjimo vieta);",
        "vietinių rinkliavų, tokių kaip kurortinis mokestis, jei pagal vietos taisykles jos mokamos vietoje;",
        "skelbime nurodyto užstato;",
        "paslaugų, kurias svečias užsisako tik vietoje ir savanoriškai, iš anksto nurodyta kaina;",
        "įrodytos žalos, kurią padarė svečias, atlyginimo.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Ko negalima reikalauti",
      paragraphs: ["Neleidžiama visų pirma:"],
      list: [
        "papildomas reikalavimas dėl nakvynės kainos po rezervacijos užbaigimo;",
        "mokestis už tai, kad rezervacija atlikta per myBestDays;",
        "tvarkymo, rezervavimo ar kortelės mokestis, kuris nebuvo nurodytas skelbime;",
        "raginimas atšaukti rezervaciją ir tą pačią apgyvendinimo vietą rezervuoti iš naujo už Platformos ribų;",
        "raginimas kainą ar jos dalį sumokėti pavedimu, grynaisiais ar mokėjimo paslauga už Platformos ribų, kai skelbimas numato mokėjimą per Platformą.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Platformos apėjimas",
      paragraphs: [
        "Jei kontaktas tarp svečio ir teikėjo atsirado per Platformą, rezervacijos negalima vykdyti ją apeinant. Tai taikoma abiem pusėms.",
        "Kas apeina Platformą, praranda jos apsaugą: mokėjimai neapsaugoti, mūsų atšaukimo ir grąžinimo politikos netaikomos, o ginčo atveju negalime tarpininkauti.",
        "Pažeidimai gali lemti paskyros blokavimą. Iš teikėjų galime papildomai reikalauti negauto paslaugos mokesčio.",
      ],
    },
    {
      id: "melden",
      heading: "5. Pranešimas",
      paragraphs: [
        "Jei iš Jūsų vietoje reikalaujama sumos, kurios skelbime nebuvo, jos nemokėkite ir praneškite mums kontaktiniais keliais skiltyje [Skundai ir ginčų sprendimas](https://mybestdays.dk/rechtliches/beschwerden). Jei jau sumokėjote, padedame ją susigrąžinti.",
      ],
    },
  ],
};
