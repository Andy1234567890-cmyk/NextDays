import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Teisinė informacija",
  stand: "Atnaujinta: 2026 m. rugpjūčio 18 d.",
  intro: [
    `Prekyvietės myBestDays teikėjo duomenys. Operatorius yra ${ANBIETER.firma}; myBestDays yra šios bendrovės prekės ženklas, o ne savarankiškas juridinis asmuo.`,
    "Privalomi duomenys pagal Danijos elektroninės prekybos įstatymo 7 skirsnį, kuriuo perkeliamas Direktyvos 2000/31/EB 5 straipsnis, ir pagal Reglamento (ES) 2022/2065 11 bei 12 straipsnius.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Platformos operatorius",
      paragraphs: [
        `${ANBIETER.firma} – ribotos atsakomybės bendrovė (anpartsselskab, ApS) pagal Danijos teisę`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Danija`,
        `Teisinis atstovavimas: ${ANBIETER.direktion.join(" ir ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Kontaktai",
      paragraphs: [
        `El. paštas: ${ANBIETER.email}`,
        `Telefonas: ${ANBIETER.telefon}`,
        "Klausimais dėl esamos rezervacijos naudokite žinučių funkciją savo paskyroje – tada rezervacija ir istorija mums jau prieinamos; žr. [Skundai ir ginčų sprendimas](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Registras ir PVM",
      paragraphs: [
        `CVR Nr. ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Danija.`,
        ...(ANBIETER.ustId
          ? [`PVM mokėtojo kodas: ${ANBIETER.ustId}.`]
          : [
              "PVM mokėtojo kodo šiuo metu nėra; elektroninės prekybos įstatymo 7 skirsnis reikalauja jį nurodyti tik esant registracijai PVM mokėtoju.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Kontaktiniai punktai pagal Reglamentą (ES) 2022/2065",
      paragraphs: [
        `Bendras kontaktinis punktas institucijoms pagal 11 straipsnį ir naudotojams pagal 12 straipsnį: ${ANBIETER.email}, paštu pirmiau nurodytu adresu.`,
        "Bendravimo kalbos yra vokiečių, danų ir anglų.",
        "Procedūros pagal šį reglamentą – pranešimas apie neteisėtą turinį, priemonių pagrindimas, skundų nagrinėjimas – aprašytos skiltyje [Skaitmeninių paslaugų aktas](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Kompetentingos institucijos",
      paragraphs: [
        `Skaitmeninių paslaugų koordinatorius pagal Reglamento (ES) 2022/2065 49 straipsnį: ${DSA_KOORDINATOR.name}, Danija ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Duomenų apsaugos priežiūros institucija: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Danija, ${AUFSICHTSBEHOERDE.email}.`,
        "Tarpininkavimui apgyvendinimo paslaugoms Danijoje specialaus leidimo nereikia; todėl sektorinės priežiūros institucijos nėra.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Vartotojų ginčų sprendimas",
      paragraphs: [
        "Europos Komisijos elektroninio ginčų sprendimo platforma buvo panaikinta Reglamentu (ES) 2024/3228 ir nutraukė veiklą.",
        "Neprivalome ir nesame pasirengę dalyvauti ginčų sprendimo procedūroje vartotojų ginčų alternatyvaus sprendimo institucijoje.",
        `Nepriklausomai nuo to, kaip vartotojas galite kreiptis į kompetentingą Danijos instituciją: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Danija ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Jei gyvenate kitoje valstybėje narėje, Jums padeda Jūsų šalies Europos vartotojų centras.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Pastabos dėl turinio ir nuorodų",
      paragraphs: [
        "Skelbimų turinį pateikia atitinkami teikėjai. myBestDays jo nepasisavina; žr. [Naudojimosi sąlygų](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform) A4 skirsnį.",
        "Už susietų trečiųjų šalių svetainių turinį atsako jų operatorius. Sužinoję apie teisės pažeidimą, nuorodą nedelsdami pašaliname.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Autorių teisės",
      paragraphs: [
        `Šioje Platformoje paskelbtas savas turinys, tekstai, grafika ir prekių ženklai saugomi autorių ir prekių ženklų teisės. Naudojimas, viršijantis teisės aktų leidžiamus atvejus, reikalauja išankstinio rašytinio ${ANBIETER.firma} sutikimo; prekių ženklams taikomos [Prekių ženklų taisyklės](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Taikytina teisė",
      paragraphs: [
        `${ANBIETER.firma} buveinė yra Danijoje ir bendrovė įsteigta tik ten. Todėl šiam internetiniam pasiūlymui taikoma Danijos teisė – taip pat ir versijai lietuvių kalba (kilmės šalies principas pagal Direktyvos 2000/31/EB 3 straipsnį). Imperatyvios Jūsų gyvenamosios valstybės vartotojų apsaugos nuostatos lieka nepaliestos.`,
      ],
    },
  ],
};
