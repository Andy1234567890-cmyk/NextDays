import type { LegalDoc } from "../types";

// Litauische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort.
export const agb: LegalDoc = {
  title: "Naudojimosi sąlygos svečiams",
  stand: "Redakcija: 2026 m. liepos 3 d.",
  intro: [
    "Šios naudojimosi sąlygos reglamentuoja, kaip keliautojai ir užsakovai (toliau — „Svečias“) naudojasi užsakymų portalu myNextDays (toliau — „Platforma“).",
    "Platformos valdytoja yra [visas operatoriaus įmonės pavadinimas, teisinė forma, adresas ir registro duomenys — papildyti prieš paskelbiant] (toliau — „myNextDays“ arba „mes“).",
  ],
  sections: [
    {
      heading: "§ 1 Taikymo sritis",
      paragraphs: [
        "Šios sąlygos taikomos naudojimuisi Platforma, visų pirma apgyvendinimo paieškai ir apgyvendinimo paslaugų užsakymui per Platformą.",
        "Pačiai apgyvendinimo paslaugai papildomai taikomos pasiūlyme nurodytos atitinkamo teikėjo sąlygos (pvz., namų taisyklės, atšaukimo sąlygos).",
      ],
    },
    {
      heading: "§ 2 myNextDays vaidmuo; sutarties sudarymas",
      paragraphs: [
        "myNextDays tarpininkauja teikiant apgyvendinimo paslaugas, kurias siūlo atitinkami teikėjai (agentūros, nuomotojai ar savininkai, toliau — „Teikėjas“). Sutartis dėl apgyvendinimo sudaroma išimtinai tarp Svečio ir atitinkamo Teikėjo. myNextDays netampa apgyvendinimo sutarties šalimi.",
        "Atitinkamas Teikėjas nurodomas pasiūlyme ir užsakymo patvirtinime.",
      ],
    },
    {
      heading: "§ 3 Užsakymas ir užsakymo patvirtinimas",
      paragraphs: [
        "Būstų pateikimas Platformoje yra kvietimas pateikti užsakymo pasiūlymą. Užbaigdamas užsakymo procesą (paspausdamas mokėti įpareigojantį užsakymo mygtuką), Svečias pateikia privalomą pasiūlymą sudaryti apgyvendinimo sutartį su Teikėju.",
        "Sutartis sudaroma, kai užsakymas patvirtinamas. Užsakymo patvirtinimas Svečiui išsiunčiamas nurodytu el. pašto adresu.",
        "Svečias privalo užsakydamas pateikti teisingus ir išsamius duomenis (visų pirma vardą ir pavardę, kontaktinius duomenis ir keliautojų skaičių).",
      ],
    },
    {
      heading: "§ 4 Kainos ir mokėjimas",
      paragraphs: [
        "Taikomos užsakymo metu pasiūlyme nurodytos kainos, įskaitant ten nurodytus mokesčius, rinkliavas ir papildomas išlaidas. Kainos rodomos pasiūlyme nurodyta valiuta. Vietoje gali būti taikomos papildomos vietinės rinkliavos (pvz., kurorto mokestis), jei tai nurodyta pasiūlyme.",
        "Mokėjimas apdorojamas per mokėjimo paslaugų teikėją Stripe. Mokėjimo duomenis (pvz., kortelės duomenis) tiesiogiai renka ir tvarko Stripe; myNextDays nesaugo visų kortelės duomenų. Stripe tvarko asmens duomenis pagal [Stripe privatumo politiką](https://stripe.com/privacy).",
        "Jei pasiūlyme nurodytas užstatas, jis gali būti iš anksto autorizuotas užsakymo ar atvykimo metu ir žalos atveju visiškai ar iš dalies negrąžintas; lemiamą reikšmę turi pasiūlyme pateikta informacija.",
      ],
    },
    {
      heading: "§ 5 Atšaukimas, užsakymo keitimas ir sutarties atsisakymas",
      paragraphs: [
        "Ar ir kokiomis sąlygomis užsakymą galima nemokamai atšaukti ar pakeisti, nustato pasiūlyme nurodytos Teikėjo atšaukimo sąlygos.",
        "Apgyvendinimo paslaugoms, užsakomoms konkrečiam laikotarpiui, pagal ES Vartotojų teisių direktyvos 16 straipsnio l punktą ir atitinkamas nacionalines nuostatas įstatyminė sutarties atsisakymo teisė paprastai netaikoma. Imperatyvios įstatyminės Svečio teisės lieka nepakitusios.",
      ],
    },
    {
      heading: "§ 6 Svečio pareigos",
      paragraphs: [
        "Svečias naudojasi būstu pagal sutartį, laikosi pasiūlyme nurodyto didžiausio leidžiamo asmenų skaičiaus ir Teikėjo namų taisyklių.",
        "Platforma negali būti naudojama piktnaudžiaujant, visų pirma fiktyviems užsakymams, sukčiavimo mokėjimams ar neteisėtam turiniui skelbti (pvz., atsiliepimuose ar žinutėse).",
      ],
    },
    {
      heading: "§ 7 myNextDays atsakomybė",
      paragraphs: [
        "Už apgyvendinimo paslaugos teikimą atsako tik Teikėjas. myNextDays neatsako už Teikėjų paskelbto pasiūlymų turinio teisingumą, tačiau tarpininkavimą ir mokėjimų apdorojimą vykdo rūpestingo verslininko atidumu.",
        "myNextDays neribotai atsako už tyčią ir didelį neatsargumą, taip pat už žalą, atsiradusią dėl gyvybės atėmimo, kūno sužalojimo ar sveikatos sutrikdymo. Paprasto neatsargumo atveju myNextDays atsako tik už esminių sutartinių pareigų (kardinaliųjų pareigų) pažeidimą, apsiribojant sutarčiai tipiška, numatoma žala. Imperatyvios įstatyminės atsakomybės taisyklės lieka nepakitusios.",
      ],
    },
    {
      heading: "§ 8 Duomenų apsauga",
      paragraphs: [
        "myNextDays tvarko Svečio asmens duomenis tarpininkavimui ir užsakymui vykdyti. Užsakymo duomenys perduodami atitinkamam Teikėjui tiek, kiek tai būtina apgyvendinimo sutarčiai vykdyti. Mokėjimų apdorojimui taikomas § 4.",
        "Išsami informacija pateikiama Platformos duomenų apsaugos informacijoje.",
      ],
    },
    {
      heading: "§ 9 Skundai ir ginčų sprendimas",
      paragraphs: [
        "Pretenzijas dėl būsto Svečias pirmiausia teikia Teikėjui; klausimais dėl užsakymo ar mokėjimo padeda myNextDays pagalbos tarnyba Platformoje nurodytais kontaktais.",
        "myNextDays neprivalo ir nėra pasirengusi dalyvauti ginčų sprendimo procedūrose vartotojų ginčų sprendimo institucijoje, jei tokios pareigos nenustato teisės aktai.",
      ],
    },
    {
      heading: "§ 10 Šių sąlygų pakeitimai",
      paragraphs: [
        "myNextDays gali keisti šias sąlygas ateičiai, jei tai būtina dėl svarių priežasčių (visų pirma teisės aktų pakeitimų ar teismų praktikos pokyčių) ir dėl to Svečias nėra nepagrįstai nuskriaudžiamas. Jau sudarytiems užsakymams taikoma užsakymo metu galiojusi redakcija.",
      ],
    },
    {
      heading: "§ 11 Baigiamosios nuostatos",
      paragraphs: [
        "Taikoma valstybės, kurioje valdytoja turi registruotą buveinę, teisė, netaikant Jungtinių Tautų konvencijos dėl tarptautinio prekių pirkimo–pardavimo sutarčių. Jei Svečias yra vartotojas, imperatyvios valstybės, kurioje jis turi įprastinę gyvenamąją vietą, vartotojų apsaugos nuostatos lieka nepakitusios.",
        "Jei atskiros šių sąlygų nuostatos yra ar taptų negaliojančios, kitų nuostatų galiojimui tai įtakos neturi.",
      ],
    },
  ],
};
