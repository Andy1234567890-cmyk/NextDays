import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Skaitmeninių paslaugų aktas",
  stand: "Atnaujinta: 2026 m. rugpjūčio 18 d.",
  intro: [
    "myBestDays yra tarpininkavimo paslauga ir elektroninė platforma, kaip apibrėžta Reglamente (ES) 2022/2065 dėl bendrosios skaitmeninių paslaugų rinkos (Skaitmeninių paslaugų aktas, DSA). Šiame puslapyje sutelkti duomenys ir procedūros, kurių reikalauja šis reglamentas.",
    "myBestDays nėra labai didelė elektroninė platforma, kaip apibrėžta reglamento 33 straipsnyje. Todėl mums netaikomos papildomos pareigos – sisteminės rizikos nustatymas, nepriklausomas auditas, reklamos archyvas ir mėnesinio naudotojų skaičiaus skelbimas ten numatyta tvarka.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Kontaktiniai punktai (11 ir 12 straipsniai)",
      paragraphs: [
        `Bendras kontaktinis punktas valstybių narių institucijoms, Komisijai ir Europos skaitmeninių paslaugų valdybai: ${ANBIETER.email}, paštu ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danija.`,
        `Bendras kontaktinis punktas naudotojams: ${ANBIETER.email}. Ten mus pasiekiate tiesiogiai, be automatizuoto tarpinio etapo.`,
        "Su abiem kontaktiniais punktais galima bendrauti vokiečių, danų ir anglų kalbomis.",
        "Teisinio atstovo Sąjungoje pagal 13 straipsnį skirti nereikia: operatorius įsteigtas Danijoje, taigi Sąjungoje.",
        `Kompetentingas skaitmeninių paslaugų koordinatorius pagal 49 straipsnį: ${DSA_KOORDINATOR.name}, Danija ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Pranešimas apie neteisėtą turinį (16 straipsnis)",
      paragraphs: [
        "Kiekvienas asmuo gali mums pranešti apie turinį, kurį laiko neteisėtu. Naudokite tam pranešimo funkciją, prieinamą prie kiekvieno skelbimo, kiekvieno atsiliepimo ir kiekvienos žinutės, arba kontaktinį punktą naudotojams.",
        "Kad pranešimą galėtume įvertinti be išsamios teisinės analizės, jame turėtų būti:",
      ],
      list: [
        "pakankamai pagrįstas paaiškinimas, kodėl turinys neteisėtas;",
        "tiksli elektroninė vieta, visų pirma URL adresas;",
        "pranešančio asmens vardas ir el. pašto adresas – išskyrus pranešimus dėl nusikalstamų veikų vaikų lytinei laisvei, kur šis duomuo yra savanoriškas;",
        "pareiškimas, kad duomenys, kiek žinoma, yra teisingi ir išsamūs.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Kaip nagrinėjame pranešimus",
      paragraphs: [
        "Gavimą nedelsdami patvirtiname ir sprendžiame laiku, rūpestingai, be savivalės ir objektyviai.",
        "Jei pranešime pateikti 2 skirsnio duomenys, jis pagrindžia mūsų žinojimą, kaip apibrėžta reglamento 6 straipsnyje.",
        "Apie savo sprendimą informuojame pranešusį asmenį ir nurodome teisių gynimo priemones.",
        "Esant automatizuotam nagrinėjimui apie tai pranešame.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Priemonių pagrindimas (17 straipsnis)",
      paragraphs: [
        "Jei apribojame turinio matomumą, jį pašaliname, blokuojame prieigą prie jo, sustabdome mokėjimus, paslaugos teikimą ar paskyrą, nukentėjęs asmuo gauna aiškų ir konkretų pagrindimą.",
        "Pagrindime nurodoma priemonės pobūdis ir apimtis, jos teritorinė ir laiko galiojimo sritis, sprendimo faktai ir aplinkybės, ar dalyvavo automatizuotas tvarkymas, teisinis pagrindas ar pažeista sutarties nuostata bei prieinamos teisių gynimo priemonės.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Įtarimas dėl nusikalstamos veikos (18 straipsnis)",
      paragraphs: [
        "Esant požymių dėl nusikalstamos veikos, keliančios pavojų asmens gyvybei ar saugumui, nedelsdami informuojame kompetentingas teisėsaugos ar teismines institucijas.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Vidinė skundų nagrinėjimo procedūra (20 straipsnis)",
      paragraphs: [
        "Dėl kiekvienos 4 skirsnyje nurodytos priemonės ir dėl pranešimo atmetimo per šešis mėnesius galima nemokamai pateikti skundą.",
        "Skundus nagrinėjame laiku, nediskriminuodami ir rūpestingai – prižiūrint kvalifikuotiems asmenims, o ne vien automatizuotomis priemonėmis.",
        "Jei skundas pasirodo pagrįstas, priemonę atšaukiame. Kelią aprašo skiltis [Skundai ir ginčų sprendimas](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Neteisminis ginčų sprendimas (21 straipsnis)",
      paragraphs: [
        "Dėl ginčų dėl 4 skirsnyje nurodytų priemonių naudotojai gali kreiptis į neteisminio ginčų sprendimo instituciją, sertifikuotą kompetentingo skaitmeninių paslaugų koordinatoriaus. Sertifikuotų institucijų sąrašą tvarko Europos Komisija.",
        "Šių institucijų sprendimai mums neprivalomi; dalyvauti nepriklausomų teikėjų procedūrose neprivalome. Kelias į teismus lieka nepaliestas.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Patikimi pranešėjai (22 straipsnis)",
      paragraphs: [
        "Pranešimus, pateiktus subjekto, pripažinto patikimu pranešėju savo kompetencijos srityje, nagrinėjame pirmumo tvarka.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Priemonės prieš piktnaudžiavimą (23 straipsnis)",
      paragraphs: [
        "Paskyras, per kurias dažnai teikiamas akivaizdžiai neteisėtas turinys, po išankstinio įspėjimo protingam laikui blokuojame.",
        "Pranešimų ir skundų nagrinėjimą sustabdome asmenims, kurie dažnai teikia akivaizdžiai nepagrįstus pranešimus ar skundus – taip pat po išankstinio įspėjimo.",
        "Visada vertiname konkretų atvejį: atitinkamų veiksmų skaičių, dalį ir sunkumą bei ketinimą.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Skaidrumo ataskaitos (15 ir 24 straipsniai)",
      paragraphs: [
        "Kasmet skelbiame ataskaitą apie turinio moderavimą: institucijų nurodymų skaičių, pranešimų skaičių ir rūšį, taikytas priemones, skundų skaičių ir jų baigtį, duomenis apie automatizuotų procedūrų naudojimą ir ginčų neteisminėse institucijose skaičių.",
        `Labai mažos ir mažos įmonės pagal reglamento 19 straipsnį atleidžiamos nuo dalies šių pareigų. Kol atleidimas galioja, duomenis pateikiame paprašius adresu ${ANBIETER.email}; paskelbus pirmą ataskaitą, čia bus pateikta nuoroda.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Prekiautojų atsekamumas (30–32 straipsniai)",
      paragraphs: [
        "Teikėjai, kurie Platformoje veikia verslo tikslais, gali siūlyti tik po to, kai mums pateikė vardą, adresą, telefono numerį, el. pašto adresą, registro duomenis, PVM mokėtojo kodą ir mokėjimo sąskaitą, o jų duomenys yra patikimi.",
        "Šiuos duomenis rodome skelbime tiek, kiek numato reglamentas.",
        "Sužinoję, kad skelbimas buvo susijęs su neteisėtu produktu ar neteisėta paslauga, informuojame nukentėjusius svečius, jei turime jų kontaktinius duomenis.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Rekomendavimo sistemos (27 straipsnis)",
      paragraphs: [
        "Pagrindiniai paieškos rezultatų eiliškumo ir rekomendacijų parametrai bei galimybė juos paveikti aprašyti skiltyje [Kainos, reitingavimas ir rekomendacijos](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Reklama (26 straipsnis)",
      paragraphs: [
        "Šiuo metu nerodome trečiųjų šalių mokamos reklamos ir mokamų išdėstymų paieškos rezultatuose.",
        "Įvedę reklamą, ją aiškiai pažymėsime, nurodysime reklamuotoją ir pagrindinius rodymo parametrus. Reklamą, pagrįstą specialių kategorijų asmens duomenimis pagal Reglamento (ES) 2016/679 9 straipsnį, ir reklamą nepilnamečiams, pagrįstą profiliavimu, atmetame.",
      ],
    },
  ],
};
