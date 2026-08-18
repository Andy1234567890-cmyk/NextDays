import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Skundai ir ginčų sprendimas",
  stand: "Atnaujinta: 2026 m. rugpjūčio 18 d.",
  intro: [
    "Šis puslapis aprašo, kaip pasiekti myBestDays, kaip nagrinėjame skundus ir kokie keliai Jums atviri, jei su mūsų sprendimu nesutinkate.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Kaip mus pasiekti",
      paragraphs: [
        "Greičiausiai mus pasieksite per pagalbos centrą ir jame nurodytus kontaktinius kelius. Dėl esamos rezervacijos naudokite žinučių funkciją savo paskyroje – tada rezervacija ir istorija mums jau prieinamos.",
        `Raštu mus pasieksite adresu ${ANBIETER.email} arba ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danija; telefonu ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Ką turėtų apimti Jūsų skundas",
      paragraphs: ["Kad galėtume greitai padėti, prašome nurodyti:"],
      list: [
        "savo rezervacijos numerį ir rezervacijai naudotą el. pašto adresą;",
        "trumpą problemos aprašymą;",
        "kokio sprendimo pageidaujate;",
        "susijusius įrodymus – nuotraukas, žinutes, kvitus, sąskaitos išrašus.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Kaip nagrinėjame",
      paragraphs: [
        "Kiekvienas skundas registruojamas ir gauna bylos numerį, pagal kurį galite sekti būseną.",
        "Gavimą nedelsdami patvirtiname ir iš esmės atsakome paprastai per septynias dienas. Prireikus ilgesnio nagrinėjimo pranešame Jums tarpinę būseną.",
        "Skundus, kuriuose asmenims kyla pavojus arba tuoj pat vyks atvykimas, nagrinėjame pirmumo tvarka.",
        "Savo sprendimą pagrindžiame ir nurodome pagrindą, kuriuo jis remiasi.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Skundas dėl mūsų priemonės",
      paragraphs: [
        "Jei pašalinome turinį, apribojome jo matomumą, atšaukėme rezervaciją ar blokavome paskyrą, dėl to galite per šešis mėnesius nemokamai pateikti skundą. Tai atitinka Reglamento (ES) 2022/2065 20 straipsnį.",
        "Skundą nagrinėja žmonės, ne vien automatizuotos procedūros. Jei jis pasirodo pagrįstas, priemonę atšaukiame.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Neteisminis ginčų sprendimas",
      paragraphs: [
        "Europos Komisijos elektroninio ginčų sprendimo platforma buvo panaikinta Reglamentu (ES) 2024/3228 ir nutraukė veiklą. Per ją skundų pateikti nebegalima.",
        "Neprivalome ir nesame pasirengę dalyvauti ginčų sprendimo procedūroje vartotojų ginčų alternatyvaus sprendimo institucijoje.",
        `Nepriklausomai nuo to, kaip vartotojas galite kreiptis į kompetentingą Danijos instituciją: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Danija ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Jei gyvenate kitoje valstybėje narėje, Jums padeda Jūsų šalies Europos vartotojų centras.`,
        "Jei ginčas susijęs su priemone, kurios ėmėmės prieš Jūsų turinį ar paskyrą, papildomai galite kreiptis į neteisminio ginčų sprendimo instituciją, sertifikuotą pagal Reglamento (ES) 2022/2065 21 straipsnį. Jos sprendimai mums neprivalomi ir dalyvauti tokiose procedūrose neprivalome.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Teisminis kelias",
      paragraphs: [
        "Kelias į teismus Jums atviras bet kada, taip pat ir be išankstinės skundų procedūros. Kokie teismai kompetentingi, nurodyta [Naudojimosi sąlygų](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand) A19 skirsnyje.",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Teikėjų skundai",
      paragraphs: [
        "Teikėjai ta pačia tvarka gali teikti skundus dėl šių sąlygų taikymo, dėl reitingavimo sprendimų ir dėl jų pasiūlymo apribojimų. Tai atitinka Reglamento (ES) 2019/1150 11 straipsnį.",
        "Apie tokių skundų skaičių, dalyką ir vidutinę nagrinėjimo trukmę atsiskaitome kasmet; ataskaita prieinama skiltyje [Skaitmeninių paslaugų aktas](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
