import type { LegalDoc } from "../types";

// Litauische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. § 5 Absatz 1–2 folgt Stripes offiziellem Empfehlungstext
// (recommended disclosure language) — Sinn und URLs nicht verändern.
export const agb: LegalDoc = {
  title: "Bendrosios sąlygos agentūroms ir nuomotojams",
  stand: "Redakcija: 2026 m. liepos 3 d.",
  intro: [
    "Šios bendrosios sąlygos (toliau — „Sąlygos“) reglamentuoja, kaip agentūros, nuomotojai, būstų administratoriai ir kiti verslo naudotojai (toliau — „Naudotojas“) naudojasi programinės įrangos platforma myNextDays (toliau — „Platforma“).",
    "Platformos teikėja yra [visas operatoriaus įmonės pavadinimas, teisinė forma, adresas ir registro duomenys — papildyti prieš paskelbiant] (toliau — „myNextDays“ arba „mes“).",
    "Platforma skirta išimtinai verslininkams, kaip apibrėžta Vokietijos civilinio kodekso (BGB) 14 straipsnyje arba atitinkamose konkrečios ES valstybės narės nuostatose. Ji nėra skirta vartotojams.",
  ],
  sections: [
    {
      heading: "§ 1 Taikymo sritis",
      paragraphs: [
        "Šios Sąlygos taikomos visoms myNextDays ir Naudotojo sutartims dėl naudojimosi Platforma bei visoms per ją teikiamoms paslaugoms ir moduliams.",
        "Nukrypstančios, prieštaraujančios ar papildančios Naudotojo sąlygos tampa sutarties dalimi tik tuo atveju, jei myNextDays tekstine forma aiškiai sutiko su jų taikymu.",
      ],
    },
    {
      heading: "§ 2 Sutarties dalykas ir paslaugos",
      paragraphs: [
        "myNextDays suteikia Naudotojui debesijos programinę įrangą atostogų būstams ir apgyvendinimo įstaigoms valdyti. Funkcijų apimtis nustatoma pagal atitinkamu metu galiojantį paslaugų aprašymą ir visų pirma apima:",
      ],
      list: [
        "objektų, užimtumo kalendorių ir rezervacijų valdymą (objektų valdymo sistema),",
        "prijungimą prie trečiųjų šalių užsakymo kanalų (pvz., Booking.com, Airbnb) per kanalų tvarkytuvą,",
        "pasiūlymų skelbimą per pačios Platformos užsakymo kanalą myNextDays,",
        "nuosavų interneto svetainių kūrimą naudojant integruotą puslapių kūrimo įrankį,",
        "apskaitos, atsiskaitymo ir ataskaitų funkcijas, įskaitant ataskaitas savininkams,",
        "bendravimą su svečiais ir mokėjimų priėmimą per integruotą mokėjimų apdorojimą (§ 5).",
      ],
    },
    {
      heading: "§ 3 Registracija, paskyra ir Naudotojo duomenys",
      paragraphs: [
        "Norint naudotis Platforma, būtina užregistruoti paskyrą. Naudotojas privalo registruodamasis ir per visą sutarties galiojimo laikotarpį pateikti teisingus, aktualius ir išsamius duomenis apie save ir savo įmonę, o jiems pasikeitus — nedelsdamas juos atnaujinti.",
        "Prisijungimo duomenys turi būti laikomi paslaptyje ir saugomi nuo trečiųjų asmenų prieigos. Naudotojas privalo nedelsdamas informuoti myNextDays, jei yra požymių, kad jo paskyra naudojamasi piktnaudžiaujant.",
        "Paskyra neperleidžiama. Naudotojas užtikrina, kad visi asmenys, kurie naudojasi paskyra jo vardu, laikytųsi šių Sąlygų.",
      ],
    },
    {
      heading: "§ 4 myNextDays vaidmuo sudarant užsakymus",
      paragraphs: [
        "Apgyvendinimo sutartys dėl būstų, siūlomų Platformoje, per prijungtus trečiųjų šalių kanalus arba Naudotojo interneto svetainėje, sudaromos išimtinai tarp Naudotojo (arba jo atstovaujamo savininko) ir atitinkamo svečio. myNextDays netampa apgyvendinimo sutarties šalimi.",
        "Už pasiūlymų turinio (aprašymų, nuotraukų, kainų, prieinamumo, mokesčių ir rinkliavų) teisingumą ir teisėtumą atsako tik Naudotojas.",
      ],
    },
    {
      heading: "§ 5 Mokėjimų apdorojimas per Stripe",
      paragraphs: [
        "Mokėjimų apdorojimo paslaugas agentūroms ir nuomotojams platformoje myNextDays teikia Stripe; joms taikoma sutartis [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), apimanti Stripe paslaugų teikimo sąlygas (toliau kartu — „Stripe paslaugų sutartis“). Sutikdamas su šiomis Sąlygomis arba toliau vykdydamas agentūros ar nuomotojo veiklą platformoje myNextDays, Naudotojas sutinka būti saistomas Stripe paslaugų sutarties, kurią Stripe gali kartkartėmis keisti.",
        "Sąlyga, kad myNextDays galėtų sudaryti galimybę naudotis mokėjimų apdorojimo paslaugomis per Stripe, yra tai, kad Naudotojas pateiktų myNextDays teisingą ir išsamią informaciją apie save ir savo įmonę. Naudotojas įgalioja myNextDays perduoti Stripe šią informaciją ir operacijų duomenis, susijusius su naudojimusi Stripe teikiamomis mokėjimų apdorojimo paslaugomis.",
        "Teisiniams santykiams su Stripe lemiamą reikšmę turi nuorodoje pateiktas sutarties tekstas anglų kalba atitinkamu metu galiojančia redakcija. Naudotojų Europos ekonominėje erdvėje sutarties šalis yra Stripe paslaugų sutartyje nurodyta Stripe bendrovė (šiuo metu — Stripe Payments Europe, Limited, Airija). Stripe tvarko asmens duomenis pagal [Stripe privatumo politiką](https://stripe.com/privacy).",
        "Vykdydamos teisės aktuose nustatytas tapatybės nustatymo ir patikros pareigas (be kita ko, pinigų plovimo prevencijos ir principo „pažink savo klientą“ reikalavimus), myNextDays ir Stripe gali bet kada pareikalauti papildomos informacijos ir dokumentų, visų pirma tapatybės dokumentų, duomenų apie tikruosius naudos gavėjus ir banko sąskaitos rekvizitų. Jei prašoma informacija ar dokumentai nepateikiami per nustatytą terminą, mokėjimų priėmimas arba išmokos gali būti visiškai ar iš dalies sustabdyti, kol bus pateikta visa informacija.",
      ],
    },
    {
      heading: "§ 6 Išmokos, mokėjimų užginčijimai ir neigiami likučiai",
      paragraphs: [
        "Išmokos pervedamos į Naudotojo nurodytą banko sąskaitą. myNextDays gali dėl rizikos priežasčių koreguoti išmokų periodiškumą, ypač naujų paskyrų, neįprastų operacijų modelių ar vykstančių patikrinimų atveju.",
        "Mokėjimų užginčijimus (angl. chargebacks), pinigų grąžinimus ir dėl to atsirandančius mokesčius, susijusius su Naudotojo užsakymais, padengia Naudotojas. myNextDays turi teisę atitinkamas sumas įskaityti į būsimas išmokas.",
        "Jei Naudotojo mokėjimų sąskaitoje susidaro neigiamas likutis, Naudotojas privalo jį nedelsdamas padengti. Naudotojas įgalioja myNextDays ir Stripe nurašyti neigiamus likučius iš nurodytos banko sąskaitos, kiek tai teisiškai leidžiama.",
      ],
    },
    {
      heading: "§ 7 Užmokesčiai ir atsiskaitymas",
      paragraphs: [
        "Užmokesčiai už naudojimąsi Platforma nustatomi pagal sutarties sudarymo metu sutartą kainoraštį arba individualų pasiūlymą. Visos kainos nurodomos be atitinkamų teisės aktuose numatytų mokesčių ir sutartyje nurodyta valiuta.",
        "Nuo operacijų priklausantys užmokesčiai (pvz., mokėjimo ar kanalų mokesčiai) gali būti išskaičiuojami arba įskaitomi tiesiogiai apdorojant atitinkamą operaciją.",
        "Jei Naudotojas vėluoja atsiskaityti, myNextDays gali, iš anksto įspėjusi, užblokuoti prieigą prie Platformos, kol bus padengti neapmokėti reikalavimai.",
      ],
    },
    {
      heading: "§ 8 Naudotojo pareigos; nuosavi teisiniai tekstai",
      paragraphs: [
        "Naudotojas užtikrina, kad jo pasiūlymai, turinys ir verslo praktika atitiktų taikytinus teisės aktus, visų pirma apgyvendinimo, registravimo, mokesčių ir vartotojų apsaugos teisę būsto buvimo vietoje. Reikalingus leidimus, registracijas ir licencijas Naudotojas užsitikrina savo atsakomybe.",
        "Už interneto svetaines, kurias Naudotojas valdo naudodamas puslapių kūrimo įrankį, ir už savo pasiūlymus Platformoje atsako pats Naudotojas; tai visų pirma apima jo paties svečiams skirtas bendrąsias sąlygas, jo paties teisinę informaciją (impresumą) ir jo paties duomenų apsaugos informaciją.",
        "Visų pirma draudžiama: skelbti neteisingus ar klaidinančius pasiūlymus, vykdyti fiktyvius sandorius ar sukčiavimo operacijas, apeiti § 5 numatytą mokėjimų apdorojimą užsakymams, sudarytiems per Platformą, taip pat bet koks naudojimas, kenkiantis Platformos saugumui ar prieinamumui.",
      ],
    },
    {
      heading: "§ 9 Trečiųjų šalių užsakymo kanalai",
      paragraphs: [
        "Prijungiant trečiųjų šalių kanalus (pvz., Booking.com, Airbnb), papildomai taikomos atitinkamo kanalo operatoriaus sąlygos. Tam reikalingas sutartis su kanalo operatoriumi Naudotojas sudaro pats.",
        "myNextDays atlieka techninę prieinamumo, kainų ir užsakymų duomenų sinchronizaciją, tačiau neturi įtakos kanalų operatorių turiniui, komisiniams ar sprendimams ir neatsako už jų prieinamumą.",
      ],
    },
    {
      heading: "§ 10 Prieinamumas ir tobulinimas",
      paragraphs: [
        "myNextDays teikia paslaugas rūpestingo verslininko atidumu ir siekia aukšto Platformos prieinamumo. Techninės priežiūros langai, tobulinimo darbai ir nuo myNextDays nepriklausančios aplinkybės (pvz., trečiųjų šalių teikėjų sutrikimai) gali laikinai apriboti prieinamumą.",
        "myNextDays gali tobulinti Platformą ir keisti funkcijas, jei dėl to nekyla grėsmė sutarties tikslui ir pakeitimas Naudotojui yra priimtinas.",
      ],
    },
    {
      heading: "§ 11 Duomenys ir duomenų apsauga",
      paragraphs: [
        "Jei myNextDays, teikdama Platformą, tvarko asmens duomenis Naudotojo pavedimu (visų pirma svečių duomenis), šalys sudaro duomenų tvarkymo sutartį pagal BDAR 28 straipsnį.",
        "Naudotojas lieka atsakingas už jo pateikiamų duomenų rinkimo ir tvarkymo teisėtumą duomenų apsaugos požiūriu. Išsami informacija apie myNextDays vykdomą duomenų tvarkymą pateikiama Platformos duomenų apsaugos informacijoje; Stripe vykdomam duomenų tvarkymui taikomas § 5.",
      ],
    },
    {
      heading: "§ 12 Intelektinė nuosavybė",
      paragraphs: [
        "Visos teisės į Platformą, jos programinę įrangą ir turinį (išskyrus Naudotojo pateiktą turinį) priklauso myNextDays arba jos licencijų davėjams. Sutarties galiojimo laikotarpiui Naudotojas įgyja paprastą, neperleidžiamą teisę naudotis Platforma sutartyje sutarta apimtimi.",
        "Naudotojas suteikia myNextDays paprastas naudojimo teises į savo pateiktą turinį, kiek tai būtina Platformai eksploatuoti (visų pirma saugoti, atgaminti, rodyti ir perduoti prijungtiems kanalams).",
      ],
    },
    {
      heading: "§ 13 Atsakomybė",
      paragraphs: [
        "myNextDays neribotai atsako už tyčią ir didelį neatsargumą, taip pat už žalą, atsiradusią dėl gyvybės atėmimo, kūno sužalojimo ar sveikatos sutrikdymo.",
        "Paprasto neatsargumo atveju myNextDays atsako tik už esminių sutartinių pareigų (kardinaliųjų pareigų) pažeidimą, apsiribojant sutarčiai tipiška, numatoma žala. Atsakomybė pagal atsakomybės už gaminius teisės aktus ir pagal prisiimtas garantijas lieka nepakitusi.",
        "Už duomenų praradimą myNextDays atsako tik tiek, kiek žala būtų atsiradusi ir tuo atveju, jei Naudotojas būtų tinkamai ir reguliariai daręs atsargines duomenų kopijas, nebent atsarginių kopijų darymas pagal sutartį tenka myNextDays.",
      ],
    },
    {
      heading: "§ 14 Galiojimo terminas, nutraukimas ir blokavimas",
      paragraphs: [
        "Galiojimo terminas ir įspėjimo apie nutraukimą terminai nustatomi atitinkamoje sutartyje. Teisė nutraukti sutartį nepaprastąja tvarka dėl svarbios priežasties lieka nepakitusi.",
        "myNextDays gali laikinai užblokuoti prieigą prie Platformos arba atskirų funkcijų (įskaitant mokėjimų priėmimą ir išmokas), jei yra konkrečių požymių, kad pažeidžiamos šios Sąlygos, vykdomas sukčiavimas arba piktnaudžiaujama naudojimusi, arba jei myNextDays tai daryti privalo pagal teisės aktus ar mokėjimo paslaugų teikėjo nurodymą. Naudotojas apie blokavimą informuojamas, kiek tai teisiškai leidžiama.",
        "Pasibaigus sutarčiai, myNextDays Naudotojo prašymu per 30 dienų pateikia jo duomenis eksportuoti įprastu formatu; po to duomenys ištrinami, jei tam neprieštarauja teisės aktuose nustatytos saugojimo pareigos.",
      ],
    },
    {
      heading: "§ 15 Šių Sąlygų pakeitimai",
      paragraphs: [
        "myNextDays gali keisti šias Sąlygas ateičiai, jei tai būtina dėl svarių priežasčių (visų pirma teisės aktų pakeitimų, teismų praktikos pokyčių ar mokėjimo paslaugų teikėjų reikalavimų) ir dėl to Naudotojas nėra nepagrįstai nuskriaudžiamas.",
        "Apie pakeitimus Naudotojui pranešama tekstine forma likus ne mažiau kaip šešioms savaitėms iki jų įsigaliojimo. Jei Naudotojas per pranešimo laikotarpį nepareiškia prieštaravimo arba po įsigaliojimo toliau naudojasi Platforma, pakeistos Sąlygos laikomos priimtomis; į šią pasekmę pranešime atskirai atkreipiamas dėmesys.",
      ],
    },
    {
      heading: "§ 16 Baigiamosios nuostatos",
      paragraphs: [
        "Taikoma valstybės, kurioje teikėja turi registruotą buveinę, teisė, netaikant Jungtinių Tautų konvencijos dėl tarptautinio prekių pirkimo–pardavimo sutarčių. Imperatyvios valstybės, kurioje Naudotojas turi buveinę, nuostatos lieka nepakitusios.",
        "Išimtinė teismingumo vieta visiems ginčams, kylantiems iš šios sutarties ar su ja susijusiems, — kiek tai teisiškai leidžiama — yra teikėjos buveinė.",
        "Jei atskiros šių Sąlygų nuostatos yra ar taptų negaliojančios, kitų nuostatų galiojimui tai įtakos neturi.",
      ],
    },
  ],
};
