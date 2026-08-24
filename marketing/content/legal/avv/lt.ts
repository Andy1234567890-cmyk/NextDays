// Litauische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `./de.ts` — inhaltliche Änderungen gehören ZUERST dorthin
// (dort stehen auch die Belege für die technischen und organisatorischen
// Maßnahmen und die Liste der Unterauftragsverarbeiter) und werden von da
// in alle Sprachfassungen übernommen.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Duomenų tvarkymo sutartis",
  metaDescription:
    "Duomenų tvarkymas pagal BDAR 28 straipsnį tarp myNextDays ApS ir platforma besinaudojančių įmonių: dalykas, nurodymai, saugumas, pagalbiniai duomenų tvarkytojai.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Ši sutartis (toliau — „DTS“) taikoma tarp įmonės, kuri naudojasi platforma myNextDays (toliau — „duomenų valdytojas“), ir ${ANBIETER.firma} (toliau — „duomenų tvarkytojas“ arba „mes“) ir sukonkretina pareigas, nustatytas Reglamento (ES) 2016/679 (BDAR) 28 straipsnyje.`,
    `Ji įtraukiama [Bendrosiomis sąlygomis](${AGB_URL}) ir taikoma visą naudojimosi platforma laiką. Ji turi viršenybę prieš Bendrąsias sąlygas, kiek tai susiję su asmens duomenų tvarkymu duomenų valdytojo pavedimu.`,
    "Papildomai [Privatumo politika](/datenschutz) taikoma duomenims, kuriuos tvarkome kaip savarankiškas duomenų valdytojas — visų pirma paskyros ir verslo santykių duomenims.",
  ],
  sections: [
    {
      heading: "Sutarties dalykas ir vaidmenų paskirstymas",
      unterpunkte: [
        {
          paragraphs: [
            "Sutarties dalykas — asmens duomenų, kuriuos duomenų valdytojas įkelia į platformą arba per ją surenka, tvarkymas, kad galėtume teikti sutartyje sutartas paslaugas: objektų, rezervacijų ir užimtumo valdymą, bendravimą su svečiais, mokėjimų apdorojimą, apskaitą ir ataskaitas savininkams, prijungimą prie užsakymo portalų, interneto svetainių kūrimo įrankį bei užduočių ir komandos valdymą.",
          ],
        },
        {
          paragraphs: [
            "Duomenų valdytojas sprendžia dėl šio duomenų tvarkymo tikslų ir priemonių. Duomenis tvarkome išimtinai pagal jo dokumentuotus nurodymus ir ne savo tikslais.",
          ],
        },
        {
          paragraphs: [
            "Paskyros duomenų, savo paslaugų atsiskaitymo, sistemos saugumo ir teisės aktuose nustatyto saugojimo atžvilgiu duomenų valdytojai esame mes patys. Šis duomenų tvarkymas nėra šios DTS dalykas.",
          ],
        },
      ],
    },
    {
      heading: "Duomenų tvarkymo pobūdis, apimtis ir tikslas",
      paragraphs: [
        "Duomenys tvarkomi juos renkant, saugant, rodant, keičiant, perduodant duomenų valdytojo pasirinktiems gavėjams (pvz., užsakymo portalams, mokėjimo paslaugų teikėjams), apribojant ir ištrinant — automatizuotu būdu platformoje.",
        "Duomenų tvarkymo vieta yra Europos Sąjunga; išimtys baigtiniu sąrašu nurodytos 8 skirsnyje.",
      ],
    },
    {
      heading: "Duomenų subjektų kategorijos",
      list: [
        "Svečiai ir rezervuojantys asmenys, įskaitant kartu keliaujančius",
        "Interesantai, teikiantys užklausas arba siunčiantys žinutes",
        "Administruojamų objektų savininkai",
        "Duomenų valdytojo darbuotojai (komanda, valymas, aptarnavimas, registratūra)",
        "Duomenų valdytojo partnerių ir paslaugų teikėjų kontaktiniai asmenys",
      ],
    },
    {
      heading: "Asmens duomenų kategorijos",
      list: [
        "Pagrindiniai duomenys: vardas ir pavardė, adresas, gimimo data, jei ji renkama, pilietybė, jei ji renkama dėl registravimo pareigos",
        "Kontaktiniai duomenys: el. pašto adresas, telefono numeris",
        "Užsakymo duomenys: laikotarpis, objektas, keliautojų skaičius, kainos, papildomos paslaugos, atšaukimai",
        "Mokėjimo duomenys: suma, valiuta, mokėjimo būdas, mokėjimo statusas, nuorodos (visi mokėjimo kortelės duomenys mūsų sistemų nepasiekia)",
        "Komunikacijos duomenys: žinutės, pastabos, atsiliepimai",
        "Darbuotojų prieigos ir naudojimo duomenys: vaidmuo, teisės, prisijungimo laikas, prisijungimo įrenginys ir IP adresas",
        "Specialių kategorijų duomenys pagal BDAR 9 straipsnį nėra pavedimo dalykas; duomenų valdytojas tokių duomenų į laisvo teksto laukus neįrašo.",
      ],
    },
    {
      heading: "Nurodymai",
      unterpunkte: [
        {
          paragraphs: [
            "Nurodymus duomenų valdytojas teikia naudodamasis platforma ir ją konfigūruodamas, taip pat tekstine forma mūsų kontaktiniu adresu. Žodinius nurodymus patvirtiname tekstine forma.",
          ],
        },
        {
          paragraphs: [
            "Jei manome, kad nurodymas yra neteisėtas, apie tai nedelsdami informuojame ir galime sustabdyti jo vykdymą, kol duomenų valdytojas jį patvirtins arba pakeis.",
          ],
        },
        {
          paragraphs: [
            "Jei duomenis tvarkyti privalome pagal teisės aktus (pavyzdžiui, institucijų atžvilgiu), duomenų valdytoją informuojame iš anksto, kiek tai mums teisiškai leidžiama.",
          ],
        },
        {
          titel: "Duomenų valdytojo savų paslaugų prijungimas",
          paragraphs: [
            "Duomenų valdytojas gali per sąsają prijungti savo paskyrą prie paslaugos, kurią jis pats pasirinko ir su kuria sudarė atskirą sutartį — pavyzdžiui, prie DI asistento. Suteikdamas tokį prijungimą, jis pateikia aiškų nurodymą pagal BDAR 28 straipsnio 3 dalies a punktą atskleistus duomenis perduoti tai paslaugai. Šis nurodymas aiškiai apima ir su tuo susijusį duomenų perdavimą į trečiąją valstybę, jei paslaugos buveinė yra už Europos Sąjungos ribų.",
            "Trumpai tariant: dėl tokio prijungimo sprendžia tik duomenų valdytojas, ir už prijungtą paslaugą atsako jis pats.",
            "Prijungimą gali suteikti tik paskyra, turinti teisę valdyti išorinius ryšius. Ši teisė skirta tik vaidmeniui „Administratorius“; paskyros su apribotomis teisėmis — taip pat ir vaidmuo „Bendraadministratorius“ — prijungimo suteikti negali. Registruojame, kas, kada ir kuriai paslaugai jį suteikė, kokios duomenų rūšys buvo atskleistos ir kokie duomenų gavimai buvo atlikti; šis įrašas duomenų valdytojui pateikiamas naudotojo sąsajoje skirsnyje „Paskyra → Ryšiai“, kad jis galėtų įvykdyti savo atskaitomybės pareigą ir atsakyti į prašymus leisti susipažinti su duomenimis.",
            "Prijungta paslauga nėra mūsų pagalbinis duomenų tvarkytojas: mes jos nepasitelkiame pavedimo pagrindu, jos nepasirenkame ir jai neteikiame nurodymų. Ji tvarko duomenis remdamasi sutartimi, kurią duomenų valdytojas su ja sudarė pats. Todėl už šį duomenų tvarkymą, jo teisinį pagrindą ir perdavimo į trečiąją valstybę garantijas atsako duomenų valdytojas; tai nėra šios DTS dalykas.",
            "Laisvo teksto laukai — rezervacijų pastabos ir svečių žinučių turinys — pagal numatytuosius nustatymus į tokį prijungimą neįtraukiami. Juose gali būti specialių kategorijų asmens duomenų pagal BDAR 9 straipsnį, pavyzdžiui, duomenų apie sveikatą. Duomenų valdytojas turi juos atskirai atskleisti suteikdamas prijungimą; be šio atskleidimo jie neperduodami.",
            "Duomenų valdytojas gali bet kada naudotojo sąsajoje atjungti suteiktą prijungimą. Tuo metu atnaujinimo prieigos raktai ištrinami, o kiekvieno tolesnio duomenų gavimo metu tikrinama, ar sutikimas dar galioja — todėl atjungta paslauga nedelsiant nebegali nieko nuskaityti, ne tik pasibaigus jos prieigos rakto galiojimui.",
          ],
        },
      ],
    },
    {
      heading: "Konfidencialumas",
      paragraphs: [
        "Visi asmenys, kurie pagal pavedimą gali turėti prieigą prie duomenų, yra įpareigoti saugoti konfidencialumą ir reguliariai mokomi duomenų apsaugos klausimais. Prieiga apribota tiek, kiek reikia atitinkamai užduočiai.",
        "Mūsų darbuotojai prie klientų duomenų prieina tik siekdami pašalinti klaidas, gavę pagalbos užklausą arba vykdydami teisės aktuose nustatytas pareigas.",
      ],
    },
    {
      heading: "Duomenų tvarkymo saugumas",
      paragraphs: [
        "Įgyvendiname technines ir organizacines priemones, kurių reikalauja BDAR 32 straipsnis. Visų pirma įgyvendinta:",
      ],
      list: [
        "Perdavimo šifravimas (TLS) visiems ryšiams, HTTP saugumo antraštės, įskaitant griežtą Content-Security-Policy",
        "Įmonių duomenų atskyrimas tiesiogiai duomenų bazėje: eilučių lygmens prieigos taisyklės (Row Level Security) ir atimtos lentelių teisės neskelbtiniems duomenims, todėl prieiga už savo įmonės ribų neįmanoma net ir tiesioginiu duomenų bazės keliu",
        "Vaidmenimis pagrįstos teisės su duomenų atskyrimu: aptarnavimo ir valymo darbuotojai negauna finansinių ir pardavimo duomenų, savininkai — tik savo objektus; svečių duomenys neįgaliotiems vaidmenims užmaskuojami",
        "Paskyroms galimas dviejų faktorių autentiškumo patvirtinimas (TOTP); pakartotinis prisijungimas atliekant saugumui svarbius pakeitimus",
        "Prisijungimų registras su įrenginiu, laiku ir IP adresu, kurį duomenų valdytojas gali peržiūrėti",
        "Ryšius su išorinėmis paslaugomis gali suteikti tik paskyra, turinti vaidmenį „Administratorius“; kiekvienas duomenų gavimas per tokį ryšį registruojamas (įrankis, laikas, apimtis — be paties turinio) ir duomenų valdytojui yra peržiūrimas. Atjungtas ryšys prieigą praranda nedelsiant: kiekvieno gavimo metu tikrinama, ar sutikimas dar galioja",
        "Užklausų dažnumo ribojimas prieš automatizuotas atakas, gaunamų Webhook iškvietimų parašų tikrinimas",
        "Šifruotos, už produkcinės sistemos ribų laikomos atsarginės kopijos su reguliariu atkūrimo testu",
        "Atskiros kūrimo ir eksploatavimo aplinkos; duomenų bazės pakeitimai atliekami tik per versijuotas migracijas",
      ],
    },
    {
      heading: "Pagalbiniai duomenų tvarkytojai",
      paragraphs: [
        "Duomenų valdytojas patvirtina toliau nurodytų pagalbinių duomenų tvarkytojų pasitelkimą. Su kiekvienu iš jų sudarytos sutartys pagal BDAR 28 straipsnio 4 dalį su pareigomis, atitinkančiomis šią DTS.",
      ],
      list: [
        "Hetzner Online GmbH, Vokietija (serveriai, duomenų bazė, medijos failai, pašto serveris; duomenų centras Helsinkyje, Suomijoje)",
        "Stripe Payments Europe, Limited, Airija (mokėjimai, išmokos, teisės aktuose nustatytas tapatybės patikrinimas)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Liuksemburgas (mokėjimai, jei duomenų valdytojas juos aktyvuoja)",
        "Channex.io Ltd, Jungtinė Karalystė (prijungimas prie užsakymo portalų, jei aktyvuota)",
        "Meta Platforms Ireland Limited, Airija (WhatsApp žinutės, jei aktyvuota)",
        "Google Ireland Limited, Airija (turinio vertimas; prisijungimas su Google, jei naudojama)",
        "Groq, Inc., JAV (atsakymų pasiūlymai gautuosiuose, jei aktyvuota)",
        "Cloudflare, Inc., JAV (savų domenų DNS įrašų valdymas, jei naudojama)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Apie pakeitimą ar papildymą informuojame ne vėliau kaip prieš 30 dienų. Duomenų valdytojas per šį terminą gali pareikšti nesutikimą dėl svarios su duomenų apsauga susijusios priežasties; jei nesutikimas nepašalinamas, jis gali nutraukti atitinkamą paslaugos dalį arba sutartį.",
          ],
        },
        {
          paragraphs: [
            "Paslaugos, dėl kurių duomenų valdytojas susitaria pats su trečiąja šalimi, nėra pagalbinis duomenų tvarkymas, o jo inicijuotas duomenų perdavimas. Tai taikoma užsakymo portalui, su kuriuo jis turi atskirą sutartį, taip pat DI asistentui ar kitai programai, kurią jis per sąsają prijungia prie savo paskyros (žr. skirsnį „Nurodymai“).",
            "Šiuo atveju svarbu ne tai, per kieno sistemas duomenys teka, o tai, kas paslaugą pasitelkia: pagalbinis duomenų tvarkymas atsiranda, kai MES pasitelkiame kitą paslaugų teikėją savo paslaugai teikti. Jei duomenų valdytojas paslaugą pasirenka pats ir su ja sudaro sutartį, ta paslauga duomenis tvarko duomenų valdytojui, ne mums. Šis atskyrimas atitinka panašių teikėjų sutartinę praktiką dėl kliento prijungtų trečiųjų šalių paslaugų.",
          ],
        },
      ],
    },
    {
      heading: "Duomenų perdavimas į trečiąsias valstybes",
      paragraphs: [
        "Duomenų perdavimas gavėjams už ES ribų apima tik pirmiau nurodytas paslaugas, kurių buveinė yra JAV arba Jungtinėje Karalystėje. Pagrindas — Europos Komisijos standartinės sutarčių sąlygos pagal BDAR 46 straipsnio 2 dalies c punktą arba galiojantis sprendimas dėl tinkamumo; taikomos papildomos apsaugos priemonės (šifravimas, duomenų kiekio mažinimas).",
      ],
    },
    {
      heading: "Pagalba duomenų valdytojui",
      unterpunkte: [
        {
          paragraphs: [
            "Padedame duomenų valdytojui atsakyti į duomenų subjektų prašymus (BDAR 15–22 straipsniai). Platforma tam tiesiogiai naudotojo sąsajoje siūlo duomenų peržiūrą, ištaisymą, eksportą ir ištrynimą. Jei duomenų subjektai kreipiasi tiesiogiai į mus, nukreipiame juos į duomenų valdytoją ir jį informuojame.",
          ],
        },
        {
          paragraphs: [
            "Be to, padedame atlikti duomenų apsaugos poveikio vertinimus, vykdyti BDAR 32–36 straipsniuose nustatytas pareigas ir atsakyti į priežiūros institucijų užklausas.",
          ],
        },
      ],
    },
    {
      heading: "Asmens duomenų saugumo pažeidimai",
      paragraphs: [
        "Jei sužinome apie asmens duomenų saugumo pažeidimą, susijusį su duomenų valdytojo duomenimis, nedelsdami, ne vėliau kaip per 48 valandas nuo sužinojimo, jį informuojame tekstine forma.",
        "Pranešime, kiek žinoma, nurodomas incidento pobūdis ir laikas, susijusios duomenų kategorijos ir asmenų grupės, tikėtinos pasekmės bei priemonės, kurių buvo imtasi ir kurios yra siūlomos. Padedame duomenų valdytojui vykdyti jo pranešimo ir informavimo pareigas pagal BDAR 33 ir 34 straipsnius.",
      ],
    },
    {
      heading: "Įrodymai ir patikros",
      unterpunkte: [
        {
          paragraphs: [
            "Šios DTS laikymąsi paprašius įrodome, visų pirma pateikdami informaciją apie priemones, kurių buvo imtasi, ir apie pasitelktus pagalbinius duomenų tvarkytojus.",
          ],
        },
        {
          paragraphs: [
            "Duomenų valdytojas gali atlikti patikras reikiama apimtimi arba pavesti jas atlikti nepriklausomam, su mumis nekonkuruojančiam auditoriui. Patikros atliekamos apie jas pranešus per pagrįstą terminą, įprastu darbo laiku ir netrikdant veiklos. Patikros, viršijančios informacijos pateikimą, sąnaudas dengia duomenų valdytojas, nebent patikrą lėmė mūsų sukeltas incidentas.",
          ],
        },
      ],
    },
    {
      heading: "Duomenų ištrynimas ir grąžinimas",
      paragraphs: [
        "Pasibaigus sutarčiai, duomenų valdytojo duomenis jo prašymu per 30 dienų pateikiame eksportuoti įprastu, kompiuterio skaitomu formatu. Po to duomenis, įskaitant kopijas, ištriname.",
        "Išimtis — duomenys, kuriems taikoma teisės aktuose nustatyta saugojimo pareiga (visų pirma sąskaitų ir apskaitos duomenys); jie užblokuojami ir pasibaigus terminui ištrinami. Atsarginės kopijos perrašomos pagal įprastą rotacijos ciklą.",
      ],
    },
    {
      heading: "Atsakomybė ir nuostatų viršenybė",
      paragraphs: [
        "Taikomas BDAR 82 straipsnis. Šalių tarpusavio santykiuose papildomai taikomos Bendrųjų sąlygų atsakomybės nuostatos, kiek jos neprieštarauja BDAR.",
        "Jei Bendrosios sąlygos ir ši DTS dėl duomenų tvarkymo pavedimu prieštarauja viena kitai, taikoma ši DTS. Jei kuri nors nuostata taptų negaliojanti, likęs turinys lieka galioti; šalys ją pakeičia leistina to paties tikslo nuostata.",
      ],
    },
    {
      heading: "Šios sutarties pakeitimai",
      paragraphs: [
        "Šią DTS galime keisti tiek, kiek to reikia dėl teisės aktų pakeitimų, priežiūros institucijų reikalavimų, mokėjimo paslaugų teikėjų nurodymų ar techninės pažangos ir kiek dėl to duomenų valdytojo padėtis nepablogėja.",
        "Apie pakeitimus pranešame tekstine forma ne vėliau kaip prieš 30 dienų iki jų įsigaliojimo. Jei duomenų valdytojas per šį terminą nepareiškia nesutikimo, pakeitimai laikomi priimtais; į šią pasekmę pranešime atkreipiamas dėmesys. Pareiškus nesutikimą, kiekviena šalis gali nutraukti sutartį nuo įsigaliojimo dienos.",
      ],
    },
    {
      heading: "Kontaktai",
      paragraphs: [
        `Užklausas dėl šios sutarties, nurodymus ir pranešimus siųskite adresu [${ANBIETER.email}](mailto:${ANBIETER.email}) arba ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default avv;
