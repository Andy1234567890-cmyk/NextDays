import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Privatumo politika",
  stand: "Atnaujinta: 2026 m. rugpjūčio 18 d.",
  intro: [
    "Ši politika aprašo, kokius asmens duomenis tvarko myBestDays, kokiais tikslais, kokiu teisiniu pagrindu ir kokias teises turite. Ji taikoma interneto svetainei, mobiliosioms programėlėms ir visoms kitoms prieigoms prie Platformos.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Duomenų valdytojas ir duomenų apsaugos pareigūnas",
      paragraphs: [
        `Duomenų valdytojas, kaip apibrėžta Reglamente (ES) 2016/679 (BDAR), yra ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danija, CVR Nr. ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Išsamūs teikėjo duomenys nurodyti [Teisinėje informacijoje](https://mybestdays.dk/rechtliches/impressum).`,
        "Duomenų apsaugos pareigūnas nepaskirtas; BDAR 37 straipsnio sąlygos netenkinamos. Klausimus dėl duomenų apsaugos siųskite pirmiau nurodytu el. pašto adresu.",
        "Teikėjai, pas kuriuos rezervuojate, yra savarankiški duomenų valdytojai duomenims, kuriuos gauna iš mūsų. Jiems taikomi [Duomenų apsaugos standartai šeimininkams](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Kokius duomenis tvarkome",
      paragraphs: ["Priklausomai nuo to, kaip naudojatės Platforma, tvarkome:"],
      list: [
        "pagrindinius duomenis – vardą, el. pašto adresą, telefono numerį, kalbą ir valiutą, slaptažodį šifruota forma;",
        "rezervacijos duomenis – rezervuotą apgyvendinimo vietą, laikotarpį, keliautojų skaičių ir vardus, specialius pageidavimus, rezervacijos būseną;",
        "mokėjimo duomenis – sumą, valiutą, mokėjimo būseną, paskutinius mokėjimo priemonės skaitmenis ir mūsų mokėjimo paslaugų teikėjo operacijos identifikatorių. Visi kortelės duomenys mūsų nepasiekia;",
        "komunikacijos duomenis – žinutes tarp Jūsų ir teikėjo, užklausas mūsų klientų aptarnavimui, skundus;",
        "turinio duomenis – atsiliepimus, nuotraukas, pageidavimų sąrašus;",
        "naudojimo duomenis – aplankytus puslapius, paieškos užklausas, prieigos laiką;",
        "techninius duomenis – IP adresą, naršyklės ir įrenginio identifikatorius, operacinę sistemą, nukreipiantį puslapį.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Tikslai ir teisiniai pagrindai",
      paragraphs: [
        "Platformos teikimas, paskyra, paieška, rezervavimas, mokėjimų vykdymas ir bendravimas su teikėju – BDAR 6 straipsnio 1 dalies b punktas (sutartis arba ikisutartiniai veiksmai).",
        "Klientų aptarnavimas, skundų nagrinėjimas ir ginčų sprendimas – BDAR 6 straipsnio 1 dalies b ir f punktai.",
        "Sukčiavimo, piktnaudžiavimo ir saugumo incidentų nustatymas ir prevencija, mūsų sąlygų vykdymas – BDAR 6 straipsnio 1 dalies f punktas (teisėtas interesas turėti saugią prekyvietę).",
        "Atsiliepimai ir jų paskelbimas – BDAR 6 straipsnio 1 dalies b ir f punktai.",
        "Teisinių pareigų vykdymas, visų pirma komercinių ir mokestinių saugojimo pareigų, deklaravimo pareigų pagal Direktyvą (ES) 2021/514 (DAC7) ir pareigų pagal Reglamentą (ES) 2022/2065 – BDAR 6 straipsnio 1 dalies c punktas.",
        "Platformos tobulinimas analizuojant apibendrintus naudojimo duomenis – BDAR 6 straipsnio 1 dalies f punktas.",
        "Reklaminiai el. laiškai ir nebūtinieji slapukai – BDAR 6 straipsnio 1 dalies a punktas (sutikimas), kurį galite bet kada atšaukti ateičiai.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Gavėjai",
      paragraphs: [
        "Teikėjai gauna duomenis, kurių jiems reikia Jūsų rezervacijai įvykdyti ir savo teisinėms pareigoms vykdyti – visų pirma vardą, kontaktinius duomenis, laikotarpį, keliautojų skaičių ir Jūsų jiems skirtas žinutes.",
        "Mūsų mokėjimo paslaugų teikėjas Stripe tvarko mokėjimo duomenis kaip savarankiškas duomenų valdytojas; papildomai taikoma [Stripe privatumo politika](https://stripe.com/privacy).",
        "Paslaugų teikėjai, kurie mums teikia prieglobos, duomenų bazių valdymo, el. laiškų siuntimo, klaidų diagnostikos ir klientų aptarnavimo įrankius, tvarko duomenis tik pagal mūsų nurodymus remdamiesi sutartimi pagal BDAR 28 straipsnį.",
        "Institucijos ir teismai gauna duomenis tik tiek, kiek esame įpareigoti; žr. [Politiką dėl institucijų ir teisėsaugos užklausų](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Mokesčių institucijos gauna pagal DAC7 praneštinus teikėjų duomenis.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Perdavimas į trečiąsias valstybes",
      paragraphs: [
        "Mūsų serveriai ir mūsų duomenų tvarkytojų serveriai yra Europos Sąjungoje.",
        "Jei atskirais atvejais duomenys tvarkomi už Europos ekonominės erdvės ribų, tai daroma tik remiantis Europos Komisijos sprendimu dėl tinkamumo arba standartinėmis sutarčių sąlygomis pagal BDAR 46 straipsnio 2 dalies c punktą kartu su papildomomis apsaugos priemonėmis.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Saugojimo terminai",
      paragraphs: [
        "Paskyros duomenis saugome tol, kol egzistuoja Jūsų paskyra, o po to juos ištriname, jei tam neprieštarauja saugojimo pareiga.",
        "Rezervacijos ir mokėjimo duomenims taikomi komerciniai ir mokestiniai saugojimo terminai; pagal Danijos apskaitos teisę tai paprastai penkeri metai nuo finansinių metų, su kuriais duomenys susiję, pabaigos.",
        "Žinutes dėl rezervacijos saugome iki trejų metų po viešnagės pabaigos, kad būtų galima išsiaiškinti ginčus.",
        "Atsiliepimai po Jūsų paskyros ištrynimo lieka nuasmeninta forma, nes yra apgyvendinimo vietos vertinimo pagrindo dalis.",
        "Duomenis apie sukčiavimo ir piktnaudžiavimo atvejus saugome tiek, kiek reikia tolesniems pažeidimams užkardyti, tačiau ne ilgiau kaip trejus metus nuo paskutinio atvejo.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Jūsų teisės",
      paragraphs: ["Pagal BDAR turite šias teises:"],
      list: [
        "susipažinti su apie Jus saugomais duomenimis (15 straipsnis);",
        "ištaisyti neteisingus duomenis (16 straipsnis);",
        "ištrinti (17 straipsnis), jei tam neprieštarauja saugojimo pareiga;",
        "apriboti tvarkymą (18 straipsnis);",
        "perkelti duomenis (20 straipsnis);",
        "nesutikti su tvarkymu, grindžiamu teisėtais interesais (21 straipsnis), visų pirma su tiesiogine rinkodara;",
        "atšaukti duotą sutikimą ateičiai (7 straipsnio 3 dalis);",
        `pateikti skundą priežiūros institucijai (77 straipsnis) – kompetentinga yra Jūsų gyvenamosios vietos, darbo vietos ar tariamo pažeidimo vietos institucija. Duomenų valdytojo buveinėje tai yra ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Danija, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Kaip įgyvendinate savo teises",
      paragraphs: [
        `Daugelį duomenų galite peržiūrėti, pakeisti ar ištrinti tiesiogiai savo paskyroje. Visais kitais klausimais kreipkitės adresu ${ANBIETER.email}.`,
        "Atsakome nedelsdami, ne vėliau kaip per vieną mėnesį. Jei termino laikytis negalime, pranešame Jums su pagrindimu.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Automatizuoti sprendimai",
      paragraphs: [
        "Naudojame automatizuotas procedūras sukčiavimui, piktnaudžiavimui ir neteisėtam turiniui nustatyti. Jei tokia procedūra lemia priemonę prieš Jūsų paskyrą ar turinį, ją pagrindžiame, o Jūs galite prašyti žmogaus atliekamos peržiūros.",
        "Sprendimo, grindžiamo vien automatizuotu tvarkymu su teisinėmis pasekmėmis, kaip apibrėžta BDAR 22 straipsnyje, nepriimame.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Pareiga pateikti duomenis",
      paragraphs: [
        "Rezervacijai reikalingus duomenis turite pateikti; be jų sutarties sudaryti ar apgyvendinimo vietos suteikti negalima. Visi kiti duomenys pateikiami savanoriškai.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Šios politikos pakeitimai",
      paragraphs: [
        "Šią politiką koreguojame, kai pasikeičia duomenų tvarkymas ar teisinė padėtis. Šiuo metu galiojanti redakcija prieinama čia; atnaujinimo data nurodyta viršuje.",
      ],
    },
  ],
};
