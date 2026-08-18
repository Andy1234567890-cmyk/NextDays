import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Prieinamumo deklaracija",
  stand: "Atnaujinta: 2026 m. rugpjūčio 18 d.",
  intro: [
    "myBestDays turi būti tinkamas naudoti visiems. Ši deklaracija aprašo Platformos prieinamumo būklę, žinomus apribojimus ir kelią kliūtims pranešti.",
    "Ji susijusi su Direktyvos (ES) 2019/882 dėl gaminių ir paslaugų prieinamumo reikalavimų, kuri nuo 2025 m. birželio 28 d. taikoma elektroninės prekybos paslaugoms, reikalavimais.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Prieinamumo būklė",
      paragraphs: [
        "Vadovaujamės darniuoju standartu EN 301 549 ir jo pagrindu esančiomis Žiniatinklio turinio prieinamumo gairėmis (WCAG) 2.1 AA atitikties lygiu.",
        "Įgyvendinta be kita ko: nuoseklus valdymas klaviatūra, matomas fokusas, semantinė antraščių struktūra, etiketės prie visų formos laukų, tekstinės alternatyvos valdymo elementams, pakankamas spalvų kontrastas, teksto keitimo galimybė neprarandant turinio bei atvaizdavimas, prisitaikantis prie ekrano dydžio.",
        "Teisiniai tekstai prieinami visomis 24 oficialiosiomis Sąjungos kalbomis ir turi teisingą kalbos žymėjimą, kad ekrano skaitytuvai juos teisingai perskaitytų.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Žinomi apribojimai",
      paragraphs: ["Šiuo metu neprieinami visų pirma:"],
      list: [
        "Skelbimų nuotraukos ir aprašymai pateikiami teikėjų; tekstinių nuotraukų alternatyvų gali trūkti arba jos gali būti nepakankamos. Raginame teikėjus jas papildyti.",
        "Įterpti trečiųjų šalių žemėlapiai klaviatūra valdomi tik ribotai. Visi vietos duomenys papildomai prieinami kaip tekstas.",
        "Teikėjų įkelti dokumentai (pavyzdžiui, vidaus taisyklės PDF formatu) nėra nuosekliai pažymėti prieinamu būdu.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Apgyvendinimo vietų prieinamumas",
      paragraphs: [
        "Ši deklaracija susijusi su Platforma, o ne su apgyvendinimo vietomis. Duomenis apie apgyvendinimo vietos statybinį prieinamumą pateikia teikėjas.",
        "Jei priklausote nuo tam tikrų savybių – įėjimas be laiptelių, durų plotis, dušas grindų lygyje, liftas –, išsiaiškinkite jas prieš rezervaciją su teikėju per žinučių funkciją. Neteisingi prieinamumo duomenys yra mūsų taisyklių pažeidimas ir apie juos galima pranešti.",
      ],
    },
    {
      id: "melden",
      heading: "4. Pranešimas apie kliūtis",
      paragraphs: [
        `Susidūrę su kliūtimi, praneškite mums adresu ${ANBIETER.email} arba kontaktiniais keliais skiltyje [Skundai ir ginčų sprendimas](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Prašome aprašyti, kuris puslapis susijęs, ką norėjote padaryti ir kokias pagalbines priemones naudojate. Gavimą patvirtiname ir pranešame, kaip ir iki kada kliūtį pašalinsime.",
        "Jei informacijos Jums reikia prieinamu formatu, ją pateikiame paprašius.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Vykdymo procedūra",
      paragraphs: [
        "Jei mūsų atsakymu nesate patenkinti, galite kreiptis į instituciją, kompetentingą vykdyti rinkos priežiūrą pagal Direktyvą (ES) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (anksčiau Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Danija",
        "Telefonas: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
