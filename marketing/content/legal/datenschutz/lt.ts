// Litauische Fassung der Datenschutzerklärung. Quelle ist
// `content/legal/datenschutz/de.ts` — inhaltliche Änderungen gehören ZUERST
// dorthin und werden von dort hier nachgezogen. Struktur (Abschnitte, Absätze,
// Listen) muss deckungsgleich mit `de.ts` bleiben.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Privatumo pranešimas",
  metaDescription:
    "Kaip myNextDays tvarko asmens duomenis: tikslai, teisiniai pagrindai, gavėjai, saugojimo terminai ir jūsų teisės pagal BDAR.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Šiame pranešime aprašoma, kaip ${ANBIETER.firma} tvarko asmens duomenis — apsilankius šioje interneto svetainėje, naudojantis platforma myNextDays (valdymo skydu, prekyvieta ir mobiliąja programėle) ir vykdant verslo santykius su savo klientais.`,
    "Mes neparduodame duomenų ir nekuriame profilių, kurie identifikuotų jus kaip asmenį. Šioje svetainėje mes – tik su jūsų sutikimu – matuojame mūsų puslapių pasiekiamumą ir mūsų reklamos sėkmę; abi kategorijos gali būti atskirai atšaukiamos (žr. skyrius „Pasiekiamumo matavimas“ ir „Reklama ir sėkmės matavimas“). Reklamai duomenis tvarkome tik ten, kur davėte aiškų sutikimą – būtent mūsų naujienlaiškiui (žr. skyrių „Komunikacija“), kurio prenumeratos galite bet kada atsisakyti vienu paspaudimu.",
  ],
  sections: [
    {
      heading: "Duomenų valdytojas",
      paragraphs: ["Už šiame pranešime aprašytą duomenų tvarkymą atsako:"],
      zeilen: [
        {
          label: "Įmonė",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Adresas",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "El. paštas",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefonas",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Taikymo sritis ir vaidmenys",
      unterpunkte: [
        {
          paragraphs: [
            "Apsilankymo šioje interneto svetainėje, jūsų kliento paskyros ir mūsų verslo santykių vykdymo atžvilgiu esame duomenų valdytojas, kaip nurodyta BDAR 4 straipsnio 7 punkte.",
          ],
        },
        {
          paragraphs: [
            "Duomenų, kuriuos mūsų klientai (nuomotojai, viešbučiai, agentūros) platformoje tvarko apie savo svečius, savininkus ir darbuotojus, atžvilgiu duomenų valdytojai yra klientai, o mes esame duomenų tvarkytojas pagal BDAR 28 straipsnį. Išsamios nuostatos išdėstytos [duomenų tvarkymo sutartyje](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Jeigu kaip svečias rezervuojate apgyvendinimą per mūsų prekyvietę, jūsų rezervacijos ir kontaktinius duomenis tvarkome tiek savo vardu (prekyvietės veikimas, mokėjimų vykdymas), tiek apgyvendinimą teikiančio verslo naudai. Apgyvendinimo sutartis sudaroma išimtinai su tuo verslu; papildomai taikomi jo privatumo pranešimai.",
          ],
        },
      ],
    },
    {
      heading: "Apsilankymas šioje interneto svetainėje",
      unterpunkte: [
        {
          titel: "Serverio žurnalo failai",
          paragraphs: [
            "Kiekvieno apsilankymo metu jūsų naršyklė perduoda techniškai būtinus duomenis, kuriuos užregistruoja mūsų interneto serveris: IP adresą, datą ir laiką, iškviestą adresą, perduotų duomenų kiekį, būsenos kodą, nukreipiantį adresą ir naršyklės identifikatorių. Tikslas — pateikti svetainę bei atpažinti ir atremti atakas ir trikdžius. Teisinis pagrindas yra BDAR 6 straipsnio 1 dalies f punktas; mūsų teisėtas interesas yra saugus ir stabilus veikimas. Žurnalai saugomi tik tiek laiko, kiek to reikia veikimui ir saugumui, ir nėra sujungiami su kitais duomenimis.",
          ],
        },
        {
          titel: "Šriftai",
          paragraphs: [
            "Naudojami šriftai įdiegti lokaliai mūsų serveryje. Jokio ryšio su Google Fonts ar kita šriftų paslauga nesudaroma.",
          ],
        },
        {
          titel: "Piktogramos",
          paragraphs: [
            "Šios interneto svetainės piktogramos, kaip ir šriftai, yra pas mus: jos į puslapį įterpiamos mūsų serveryje ir nėra papildomai įkeliamos iš piktogramų paslaugos. Jokio ryšio su trečiuoju asmeniu tuo metu nesudaroma, o jūsų IP adresas niekam neperduodamas.",
          ],
        },
        {
          titel: "Kontaktų formos apsauga nuo šiukšlių (reCAPTCHA)",
          paragraphs: [
            "Mūsų kontaktų forma nuo automatizuotų masinių užklausų apsaugota Google Ireland Limited paslauga reCAPTCHA Enterprise. Tik jums su tuo sutikus, jūsų naršyklė užpildant formą įkelia scenarijų iš www.google.com; tuo metu jūsų IP adresas ir duomenys apie jūsų veiksmus formoje perduodami Google ir tenai įvertinami, kad būtų atskirtas žmogus nuo scenarijaus. Teisinis pagrindas yra BDAR 6 straipsnio 1 dalies a punktas (sutikimas); papildomai taikomas [Google privatumo pranešimas](https://policies.google.com/privacy).",
            "Be jūsų sutikimo niekas nebus įkelta iš „Google“ ir jokie duomenys ten nebus perduoti; tokiu atveju formos nepriimsime, tačiau visada galite mums parašyti el. laišką. Jei sutiksite, „reCAPTCHA“ nustatys savo slapuką („_GRECAPTCHA“, kurio galiojimo laiką nustato „Google“, iki šešių mėnesių), kuris naudojamas rizikos vertinimui. Savo sutikimą galite bet kada pakeisti arba atšaukti naudodami slapukų piktogramą, esančią kiekvieno puslapio apačioje kairėje; slapukas tuomet bus ištrintas.",
          ],
        },
        {
          titel: "Pasiekiamumo matavimas („Google Analytics“)",
          paragraphs: [
            "Šioje svetainėje, naudodami „Google Analytics 4“ iš „Google Ireland Limited“, matuojame, kaip naudojami mūsų puslapiai – kurie puslapiai peržiūrimi, iš kur ateina lankytojai ir kurioje vietoje jie išeina. Tikslas yra tik pagerinti pasiūlymą ir aptinkamumą.",
            "Įkeliama tik su jūsų sutikimu. Jei sutinkate, jūsų naršyklė įkelia scenarijų iš www.googletagmanager.com ir išsaugo du slapukus („_ga“ ir „_ga_<ID>“, galiojimo laikas iki dvejų metų) su atsitiktinai sugeneruotu identifikatoriumi; perduodami šis identifikatorius, peržiūrėti puslapiai, nukreipimo šaltinis, apytikslė vieta šalies ar regiono lygiu, įrenginys ir naršyklė, taip pat jūsų IP adresas, kurį „Google“ sutrumpina prieš kiekvieną išsaugojimą. Teisinis pagrindas yra BDAR 6 str. 1 d. a punktas (sutikimas).",
            "Mes aiškiai apribojome vertinimą: „Google“ signalai ir reklamos personalizavimas yra išjungti. Todėl nekuriama jokių tarpusavyje susijusių profilių ir jokių tikslinių grupių reklamai, ir mes neperduodame naudojimo duomenų reklamos tinklams. Su jūsų kliento paskyra sujungimas nevyksta.",
            "„Google“ tvarko duomenis kaip mūsų duomenų tvarkytojas, remdamasi sutartimi pagal BDAR 28 str. („Google Ads“ duomenų tvarkymo sąlygos). Jūsų IP adreso sutrumpinimas vyksta serveriuose ES, prieš perduodant duomenis į JAV; taigi perduodamas pseudoniminis duomenų rinkinys. Perdavimo pagrindas yra ES Komisijos sprendimas dėl ES ir JAV duomenų privatumo sistemos (BDAR 45 str.), pagal kurį „Google LLC“ yra sertifikuota; be to, „Google“ įtraukė ES Komisijos standartines sutarčių sąlygas (BDAR 46 str.). Mes aiškiai atkreipiame dėmesį, kad JAV institucijos pagal FISA 702 skirsnį taip pat gali pasiekti sertifikuotų įmonių duomenis, todėl likutinės rizikos negalima visiškai atmesti. Papildomai galioja [„Google“ privatumo politika](https://policies.google.com/privacy).",
            "Saugojimo trukmė: įvykių ir vartotojų duomenys mūsų nuosavybėje automatiškai ištrinami po 14 mėnesių; apibendrinti ataskaitų duomenys, nesusiję su atskirais lankytojais, išlieka ilgiau. Jūsų sutikimas pats baigiasi po šešių mėnesių.",
            "Be jūsų sutikimo niekas neįkeliama, jokie slapukai nenustatomi ir jokie duomenys neperduodami „Google“. Jūs galite bet kada atšaukti savo sutikimą, paspaudę slapuko piktogramą apatiniame kairiajame kiekvieno puslapio kampe; matavimas tada iškart nutraukiamas ir minėti slapukai ištrinami. Po šešių mėnesių mes vėl paklausime.",
          ],
        },
        {
          titel: "Reklama ir našumo matavimas",
          paragraphs: [
            "Jums sutikus, naudojame rinkodaros slapukus, kad įvertintume savo reklamos sėkmę ir rodytume jums tinkamus skelbimus kitose platformose. Dalyvauja „Meta Platforms Ireland“ („Meta-Pixel“, slapukas _fbp), „LinkedIn Ireland“ („Insight-Tag“, slapukai li_gc ir bcookie) ir „Google Ireland Limited“ („Google Ads“, slapukas _gcl_au). Teisinis pagrindas yra BDAR 6 str. 1 d. a punktas. Be jūsų sutikimo joks scenarijus nebus įkeltas ir joks slapukas nebus nustatytas; atšaukus, juos ištrinsime. Išsami informacija apie kiekvieną slapuką pateikiama [Slapukų politikoje](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Kliento paskyra ir platformos naudojimas",
      paragraphs: [
        "Registruodami ir administruodami paskyrą tvarkome duomenis, kuriuos įvedate jūs arba jūsų verslas: vardą ir pavardę, įmonės pavadinimą ir teisinę formą, adresą, el. pašto adresą, telefono numerį, vaidmenį ir prieigos teises, registro duomenis (pvz., įmonių registro arba PVM mokėtojo kodą), banko sąskaitą išmokoms, taip pat paskyroje sukuriamą turinį.",
        "Prieigai apsaugoti papildomai tvarkome prisijungimo žurnalus (prisijungimo laiką, IP adresą, įrenginį ir naršyklę) ir — jei ji įjungta — dviejų faktorių autentifikavimo duomenis.",
        "Prisijungimas su Google: vietoje el. pašto adreso ir slaptažodžio galite prisijungti ir su Google paskyra. Pasirinkę šį būdą, iš Google Ireland Limited gauname tik jūsų el. pašto adresą, vardą ir pavardę, profilio nuotrauką ir jūsų Google paskyros identifikatorių (sritys „openid“, „email“, „profile“) — aiškiai jokios prieigos prie jūsų el. laiškų, kontaktų, failų ar kalendorių. Jūsų Google slaptažodžio nesužinome. Prisijungimo procesą Google tvarko kaip savarankiškas duomenų valdytojas; taikomas [Google privatumo pranešimas](https://policies.google.com/privacy). Teisinis pagrindas yra BDAR 6 straipsnio 1 dalies b punktas, nes prisijungimas reikalingas sutarčiai vykdyti; šio prisijungimo būdo pasirinkimas yra savanoriškas ir bet kada gali būti pakeistas prisijungimu su el. pašto adresu ir slaptažodžiu.",
        "Teisinis pagrindas yra BDAR 6 straipsnio 1 dalies b punktas (naudojimo sutarties vykdymas, žr. [naudojimo sąlygas](" +
          AGB_URL +
          ")), prieigos apsaugai — BDAR 6 straipsnio 1 dalies f punktas, o mokesčių ir komercinės teisės nustatytam saugojimui — BDAR 6 straipsnio 1 dalies c punktas.",
      ],
    },
    {
      heading: "Rezervacijos, svečių ir objektų duomenys",
      paragraphs: [
        "Platformoje tvarkomos rezervacijos, svečių duomenys, pranešimai, užduotys ir atsiskaitymai. Prie jų visų pirma priskiriami svečio vardas, pavardė ir kontaktiniai duomenys, atvykimo ir išvykimo datos, keliaujančiųjų skaičius, kainos ir mokėjimo būsena, susirašinėjimo istorija, taip pat — jeigu verslas juos surenka — registracijos duomenys ir specialūs pageidavimai.",
        "Šis duomenų tvarkymas atliekamas atitinkamo verslo pavedimu ir pagal jo nurodymus. Šių duomenų nenaudojame savo tikslais, reklamai ar dirbtinio intelekto modeliams mokyti.",
        "Verslo viduje duomenys atskirti pagal vaidmenis: valymo ir aptarnavimo darbuotojai nemato finansinių ir pardavimo duomenų, savininkai — tik savo objektus. Skirtingų verslų duomenys techniškai atskirti (kliento lygmens prieigos taisyklės pačioje duomenų bazėje).",
      ],
    },
    {
      heading: "Mokėjimų vykdymas",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Mokėjimai kortele ir išmokos vykdomi per Stripe Payments Europe, Limited, Airija. Stripe perduodami mokėjimui būtini duomenys (suma, valiuta, mokėjimo priemonė, vardas ir pavardė, el. pašto adresas, rezervacijos numeris), o mūsų klientų paskyrų atveju — teisės aktų reikalaujami identifikavimo duomenys (savininkas, tikrieji savininkai, asmens dokumento duomenys, banko sąskaita). Visi kortelės duomenys mūsų sistemų nepasiekia. Teisiniai pagrindai yra BDAR 6 straipsnio 1 dalies b punktas ir, identifikavimo bei pinigų plovimo prevencijos pareigų atžvilgiu, BDAR 6 straipsnio 1 dalies c punktas. Išsamias nuostatas nustato [Stripe privatumo pranešimas](https://stripe.com/privacy).",
            "Mokėjimo nuorodos papildomoms paslaugoms: jeigu verslas savo svečiui už papildomą paslaugą (pvz., valymą ar skalbimą) pateikia sąskaitą per mokėjimo nuorodą, ši nuoroda nuvda į Stripe valdomą mokėjimo puslapį. Tam Stripe perduodame paslaugos pavadinimą, sumą, valiutą ir vidinę nuorodą į rezervaciją bei verslą; verslo logotipas perduodamas į jo Stripe paskyrą, kad puslapis rodytų jo prekės ženklą. Pačiame mokėjimo puslapyje svečio mokėjimo ir įrenginio duomenis Stripe renka savo atsakomybe. Mums grąžinama tik mokėjimo būsena, suma, išskaičiuotos sumos ir mokėjimo identifikatoriai — jokių kortelės duomenų.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Jeigu verslas siūlo PayPal kaip mokėjimo būdą, mokėjimo duomenys perduodami PayPal (Europe) S.à r.l. et Cie, S.C.A., Liuksemburgas. Taikomas [PayPal privatumo pranešimas](https://www.paypal.com/de/webapps/mpp/ua/privacy-full).",
          ],
        },
      ],
    },
    {
      heading: "Pardavimo kanalai ir portalai",
      paragraphs: [
        "Kai verslas savo objektus pardavinėja per portalus, tokius kaip Booking.com, Airbnb ar Expedia, laisvos vietos, kainos, apribojimai ir rezervacijų duomenys su atitinkamu portalu apsikeičiami per mūsų sąsajų paslaugų teikėją Channex.io Ltd, Jungtinė Karalystė. Iš šios pusės gauname portalo rezervacijų ir svečių duomenis.",
        "Atitinkamam portalui taikomos jo pačios duomenų apsaugos nuostatos; tiek, kiek tai susiję, portalas yra savarankiškai atsakingas. Perdavimo teisinis pagrindas yra BDAR 6 straipsnio 1 dalies b punktas kartu su verslo pavedimu.",
      ],
    },
    {
      heading: "Komunikacija",
      unterpunkte: [
        {
          titel: "El. paštas",
          paragraphs: [
            "El. laiškus, susijusius su naudojimu (rezervacijų patvirtinimus, sistemos pranešimus, pagalbos susirašinėjimą, patvirtinimo ir pakvietimo nuorodas), siunčiame ir gauname per savo pačių administruojamą pašto serverį. Šiems pranešimams jokia išorinė siuntimo paslauga nenaudojama.",
          ],
        },
        {
          titel: "Naujienlaiškis ir išankstinė registracija",
          paragraphs: [
            "Mūsų interneto svetainėje galite užsiregistruoti myNextDays naujienoms (išankstinė registracija / naujienlaiškis). Tvarkomi jūsų el. pašto adresas, kalba ir vieta, kurioje užsiregistravote.",
            "Registracija vyksta dvigubo sutikimo (double opt-in) būdu: užsiregistravę gaunate el. laišką su patvirtinimo nuoroda; registracija įsigalioja tik ją paspaudus. Sutikimui pagrįsti saugome registracijos ir patvirtinimo laiką, tuo metu naudotą IP adresą, naršyklės identifikatorių ir tekstą, kuriam sutikote. Šie duomenys naudojami išimtinai įrodymui pagal BDAR 7 straipsnio 1 dalį ir nėra analizuojami reklamos tikslais.",
            "Teisinis pagrindas yra jūsų sutikimas pagal BDAR 6 straipsnio 1 dalies a punktą; įrodymo saugojimą grindžiame BDAR 6 straipsnio 1 dalies c punktu kartu su 7 straipsnio 1 dalimi. Sutikimą galite bet kada atšaukti, ir tai galios į priekį — per atsisakymo nuorodą kiekviename naujienlaiškyje arba laisva forma el. paštu mums. Atšaukimas neturi įtakos iki tol atlikto duomenų tvarkymo teisėtumui.",
            "Naujienlaiškių administravimui ir siuntimui kaip duomenų tvarkytoją naudojame Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Prancūzija; Vokietijos filialas: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin). Perduodami jūsų el. pašto adresas ir minėti papildomi duomenys (kalba, šaltinis). Duomenys tvarkomi serveriuose Europos Sąjungoje (Prancūzijoje ir Vokietijoje); su Brevo sudaryta duomenų tvarkymo sutartis pagal BDAR 28 straipsnį. Taikomas [Brevo privatumo pranešimas](https://www.brevo.com/legal/privacypolicy/).",
            "Kai išsiunčiame naujienlaiškį, Brevo mūsų pavedimu matuoja, ar pranešimas buvo atidarytas ir ar buvo paspaustos jame esančios nuorodos. Šis matavimas padeda pritaikyti turinį ir siuntimo dažnumą; jis yra sutikimo dalis ir pasibaigia jums atsisakius naujienlaiškio. Duomenys nesujungiami su kitais duomenų šaltiniais ir profiliai nekuriami.",
            "Kol patvirtinimo nėra, jūsų adresu nerašome ir jo Brevo neperduodame; nepatvirtintas įrašas negalioja po septynių dienų. Atsisakius naujienlaiškio adresą užblokuojame siuntimui, o sutikimo ir atsisakymo įrodymą saugome tol, kol iš jo gali būti keliami reikalavimai; jums pareikalavus, jį ištriname visiškai.",
          ],
        },
        {
          titel: "Pranešimai platformoje",
          paragraphs: [
            "Svečio ir verslo susirašinėjimas saugomas platformoje, kad abi pusės galėtų matyti istoriją. Jei verslas užblokuoja svečią, pranešimų kanalas užrakinamas; esami pranešimai išsaugomi atsekamumo tikslais.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Jeigu verslas naudoja WhatsApp sąsają, pranešimų turinys ir dalyvių telefono numeriai perduodami per Meta Platforms Ireland Limited valdomą WhatsApp Business Platform. Dėl šios funkcijos naudojimo sprendžia verslas; be jos aktyvavimo jokio perdavimo nevyksta.",
          ],
        },
      ],
    },
    {
      heading: "Automatizuotos funkcijos ir dirbtinis intelektas",
      paragraphs: [
        "Čia aprašytoms funkcijoms be BDAR taikomas ir Reglamentas (ES) 2024/1689 (Dirbtinio intelekto reglamentas, „AI Act“), kurio 50 straipsnyje nustatyti skaidrumo reikalavimai taikomi nuo 2026 m. rugpjūčio 2 d.",
      ],
      unterpunkte: [
        {
          titel: "Atsakymų pasiūlymai",
          paragraphs: [
            "Atsakymų pasiūlymams pranešimų gautuosiuose naudojame — jeigu ši funkcija verslui įjungta — Groq, Inc., JAV, kalbos modelių paslaugą. Šiuo tikslu paslaugai perduodamas atitinkamas pranešimo kontekstas. Pasiūlymai nėra išsiunčiami automatiškai; dėl išsiuntimo visada sprendžia žmogus. Automatizuotas sprendimų priėmimas, turintis teisinių pasekmių, kaip nurodyta BDAR 22 straipsnyje, nevyksta.",
            "Taigi tai nėra DI sistema, kuri, kaip nurodyta Dirbtinio intelekto reglamento 50 straipsnio 1 dalyje, tiesiogiai sąveikauja su fiziniais asmenimis: ši pareiga reiškia TIESIOGINĘ sąveiką, kai DI pats komunikuoja su asmeniu, o ne per žmogų tarpininką. Čia funkcija pasiūlo verslui tekstą, kurį darbuotojas patikrina, gali pakeisti ir išsiunčia pats — darbuotojas ir yra tas tarpininkas, o svečias susirašinėja su verslu, ne su pokalbių robotu. Automatiškai atsakančio asistento nenaudojame. Mūsų vertinimu, funkcija taip pat neatitinka nė vieno Dirbtinio intelekto reglamento III priede nurodyto didelės rizikos DI atvejo.",
            "Be to, pranešimai svečiams nėra „tekstas visuomenei aktualiais klausimais“, kaip nurodyta Dirbtinio intelekto reglamento 50 straipsnio 4 dalyje: jie nėra skelbiami, o siunčiami individualiai konkrečiam asmeniui ir susiję su apsistojimo organizavimu. Nepaisant to, čia taikoma išsiunčiančio darbuotojo atliekama žmogaus patikra.",
            "Jeigu ateityje būtų pasiūlyta funkcija, kuri savarankiškai — be žmogaus patvirtinimo — atsakytų svečiams, svečias pokalbio pradžioje būtų matomai informuotas, kad rašosi su DI sistema. Be tokio pranešimo tokia funkcija nebus teikiama.",
          ],
        },
        {
          titel: "Vaidmenys pagal Dirbtinio intelekto reglamentą",
          paragraphs: [
            "Produkte integruotų DI funkcijų atžvilgiu esame diegėjas, kaip nurodyta Dirbtinio intelekto reglamento 3 straipsnio 4 punkte; pagrindinių kalbos modelių tiekėjai yra atitinkami modelių teikėjai. Jeigu verslas šias funkcijas naudoja savo profesinėje veikloje, jis savo ruožtu yra diegėjas, ir jam taikoma DI srities išprusimo pareiga pagal Dirbtinio intelekto reglamento 4 straipsnį, kuri nuo 2025 m. vasario 2 d. galioja nepriklausomai nuo įmonės dydžio. Nuo 2026 m. liepos 27 d. ji galioja Reglamentu (ES) 2026/1744 nustatyta redakcija: tiekėjai ir diegėjai imasi priemonių savo darbuotojų DI srities išprusimui ugdyti; tam tikras lygis aiškiai neturi būti garantuojamas. Mes padedame pateikdami nurodymus programoje ir savo pagalbos centre; savo darbuotojų mokymas lieka verslo užduotis.",
            "Jeigu verslas susieja savo paskyrą su savo pasirinktu DI asistentu (žr. tolesnį punktą), jis ir dėl to yra diegėjas, kaip nurodyta Dirbtinio intelekto reglamente — jis sprendžia dėl naudojimo ir formuluoja užklausas. Pati sąsaja nėra DI sistema: ji nuskaito duomenis iš duomenų bazės ir juos pateikia, nedarydama jokių išvadų; Dirbtinio intelekto reglamento 12 konstatuojamojoje dalyje tokios sistemos aiškiai atskiriamos nuo DI.",
          ],
        },
        {
          titel: "Susiejimas su savo pasirinktu DI asistentu",
          paragraphs: [
            "Verslas gali per sąsają susieti savo paskyrą su DI asistentu, kurį jis pats pasirinko ir su kuriuo yra sudaręs savo sutartį — pavyzdžiui, Claude iš Anthropic PBC, JAV. Kai toks susiejimas suteiktas, asistentas verslo užklausa gali nuskaityti: užimtumą, laisvas vietas ir dienos kainas; rezervacijas su svečio vardu, apsistojimo laikotarpiu, objektu, rezervacijos kanalu, būsena, taip pat suma ir valiuta, jeigu užklausą teikiančios paskyros vaidmuo turi teisę matyti sumas; ir pokalbių apžvalgą gautuosiuose. Be suteikto susiejimo jokio perdavimo nevyksta.",
            "Neperduodami svečių el. pašto adresai ir telefono numeriai, kortelių duomenys, banko sąskaitos ir mokėjimo dokumentai, prieigos kodai bei objektų dosjė. Rezervacijų pastabos ir svečių pranešimų turinys pagal numatytuosius nustatymus neperduodami, nes juose gali būti duomenų apie sveikatą ar kitų specialių kategorijų duomenų pagal BDAR 9 straipsnį; suteikdamas susiejimą verslas turi juos aiškiai ir atskirai leisti.",
            "Susiejimą gali suteikti tik paskyra, turinti „administratoriaus“ vaidmenį, o ne kiekviena paskyra, turinti prieigą. Kiekviena užklausa registruojama ir verslui matoma skyriuje „Paskyra → Susiejimai“; ten jis gali bet kada susiejimą nutraukti, ir prieiga tuo pačiu momentu pasibaigia.",
            "Teisiškai šis perdavimas yra verslo nurodymas mums (BDAR 28 straipsnio 3 dalies a punktas). Asistento teikėjas nėra mūsų pasitelktas pagalbinis duomenų tvarkytojas — mes jo neįtraukiame ir jam neduodame nurodymų; jis tvarko duomenis remdamasis sutartimi, kurią verslas su juo sudarė pats. Todėl už šio duomenų tvarkymo teisinį pagrindą, už savo svečių informavimą ir už perdavimo į trečiąją valstybę garantijas atsako verslas.",
          ],
        },
        {
          titel: "Vertimai",
          paragraphs: [
            "Objektų ir turinio tekstai gali būti verčiami per Google Ireland Limited Cloud Translation API. Perduodami verčiami tekstai; asmens duomenys — tik tiek, kiek jų yra tuose tekstuose.",
          ],
        },
        {
          titel: "Kainų rekomendacijos",
          paragraphs: [
            "Kainų rekomendacijoms naudojame išorinių šaltinių rinkos, oro ir valiutų kursų duomenis. Šiose užklausose asmens duomenų nėra — tik vieta, laikotarpis ir objekto ypatybės.",
          ],
        },
      ],
    },
    {
      heading: "Mūsų klientų interneto svetainės ir domenai",
      paragraphs: [
        "Jeigu verslas per svetainių kūrimo priemonę sukuria savo interneto svetainę su savo domenu, tam būtinus DNS įrašus administruojame per Cloudflare, Inc. Perduodami domeno ir konfigūracijos duomenys; kliento svetainės lankytojų duomenis tvarkome taip, kaip aprašyta šiame pranešime.",
        "Už kliento svetainės turinį, teisinę informaciją ir privatumo pranešimus atsako atitinkamas verslas.",
      ],
    },
    {
      heading: "Prieglobos paslaugos ir duomenų saugojimas",
      paragraphs: [
        "Platforma, duomenų bazė, medijos failai ir pašto serveris veikia Hetzner Online GmbH, Vokietija, serveriuose Helsinkio duomenų centre (Suomijoje) — taigi Europos Sąjungos teritorijoje. Su Hetzner sudaryta duomenų tvarkymo sutartis.",
        "Atsarginės kopijos kuriamos užšifruotos ir užšifruotos saugomos pas saugojimo paslaugų teikėją ES teritorijoje.",
      ],
    },
    {
      heading: "Duomenų gavėjų apžvalga",
      paragraphs: [
        "Išskyrus nurodytus paslaugų teikėjus, asmens duomenis atskleidžiame tik tada, kai esame teisiškai įpareigoti (pvz., mokesčių administratoriui, teisėsaugai) arba kai to reikalaujate jūs ar atsakingas verslas.",
      ],
      list: [
        "Hetzner Online GmbH (Vokietija / Suomija) — prieglobos paslaugos, duomenų bazė, medijos failai, pašto serveris",
        "Stripe Payments Europe, Limited (Airija) — mokėjimai, išmokos, tapatybės patikra",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Liuksemburgas) — mokėjimai, jeigu įjungta",
        "Channex.io Ltd (Jungtinė Karalystė) — sąsaja su rezervacijų portalais",
        "Meta Platforms Ireland Limited (Airija) — WhatsApp pranešimai, jeigu įjungta",
        "Sendinblue SAS / Brevo (Prancūzija, Vokietija) — naujienlaiškių administravimas ir siuntimas, tik esant sutikimui",
        "Google Ireland Limited (Airija) — vertimai; kontaktų formos apsauga nuo šiukšlių (reCAPTCHA Enterprise), tik esant sutikimui; prisijungimas su Google, jeigu naudojamas; Pasiekiamumo matavimas („Google Analytics 4“), tik su sutikimu",
        "Groq, Inc. (JAV) — atsakymų pasiūlymai, jeigu įjungti",
        "Cloudflare, Inc. (JAV) — klientų domenų DNS administravimas",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Šiame sąraše nėra paslaugų, dėl kurių verslas susitaria su trečiuoju asmeniu pats ir kurias per sąsają susieja su savo paskyra — pavyzdžiui, DI asistento, tokio kaip Claude iš Anthropic PBC, JAV. Tai nėra mūsų pasitelkti paslaugų teikėjai, o gavėjai pagal atitinkamo verslo nurodymą; be jo susiejimo jokie duomenys tenai nepatenka. Pagal oficialų JAV Prekybos departamento dalyvių sąrašą Anthropic nėra sertifikuota pagal ES ir JAV duomenų privatumo sistemą (EU-US Data Privacy Framework); todėl perdavimas grindžiamas standartinėmis sutarčių sąlygomis, už kurias kaip duomenų valdytojas atsako atitinkamas verslas.",
          ],
        },
      ],
    },
    {
      heading: "Duomenų perdavimas į trečiąsias valstybes",
      paragraphs: [
        "Duomenys iš esmės tvarkomi Europos Sąjungos teritorijoje. Naudojant pirmiau nurodytas paslaugas, kurių teikėjai įsteigti už ES ribų, duomenys gali būti perduodami į trečiąją valstybę.",
        "Groq, Inc. ir Cloudflare, Inc. (JAV) atveju perdavimą grindžiame Europos Komisijos standartinėmis sutarčių sąlygomis pagal BDAR 46 straipsnio 2 dalies c punktą, jeigu gavėjas negali remtis tinkamumo sprendimu (EU-US Data Privacy Framework).",
        "Mokėjimų vykdymo sutarties partneris yra Stripe Payments Europe, Limited (Airija). Kiek Stripe tuo tikslu pasitelkia Stripe, LLC (JAV), ši yra sertifikuota pagal ES ir JAV duomenų privatumo sistemą (EU-US Data Privacy Framework); tiek, kiek tai susiję, perdavimas grindžiamas Europos Komisijos tinkamumo sprendimu pagal BDAR 45 straipsnį. Papildomai taikomos standartinės sutarčių sąlygos iš [Stripe duomenų tvarkymo sutarties](https://stripe.com/legal/dpa).",
        "Channex.io Ltd (Jungtinė Karalystė) atveju taikomas Europos Komisijos tinkamumo sprendimas dėl Jungtinės Karalystės; jam nebegaliojant, taikomos standartinės sutarčių sąlygos.",
      ],
    },
    {
      heading: "Trečiųjų valstybių institucijų prieiga (JAV CLOUD Act)",
      paragraphs: [
        "Paslaugų teikėjai, kuriems taikoma JAV jurisdikcija, pagal JAV CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018) gali būti įpareigoti pateikti duomenis JAV institucijoms — taip pat ir tada, kai tie duomenys yra serveriuose Europos Sąjungos teritorijoje. Tokia prieiga gali prieštarauti BDAR, o paslaugų teikėjui teisiškai gali būti neleista mums ar jums apie tai pranešti. Nei tinkamumo sprendimas dėl ES ir JAV duomenų privatumo sistemos, nei standartinės sutarčių sąlygos šios rizikos nepašalina.",
        "Šią riziką ribojame tuo, kad pagrindinės sistemos — platforma, duomenų bazė, medijos failai, pašto serveris ir atsarginės kopijos — veikia pas Europos paslaugų teikėjus Europos Sąjungos teritorijoje, kur JAV jurisdikcija netaikoma.",
      ],
      unterpunkte: [
        {
          titel: "Susijusios paslaugos",
          paragraphs: [
            "JAV jurisdikcija gali būti taikoma tik šioms aiškiai apibrėžtoms papildomoms paslaugoms:",
          ],
          list: [
            "Groq, Inc. (JAV) — atsakymų pasiūlymai pranešimų gautuosiuose, tik jeigu verslas šią funkciją įjungia. Perduodamas atitinkamas pranešimo kontekstas.",
            "Cloudflare, Inc. (JAV) — klientų domenų DNS administravimas. Perduodami domeno ir konfigūracijos duomenys, jokių svečių duomenų.",
            "„Google LLC“ (JAV) – prisijungiant su „Google“, verčiant ir matuojant pasiekiamumą („Google Analytics 4“, tik su sutikimu); sutarties partneris yra „Google Ireland Limited“, tačiau JAV patronuojančiosios įmonės prieiga neatmetama.",
          ],
        },
        {
          titel: "Galimybė išvengti",
          paragraphs: [
            "Platformą galima naudoti ir be šių paslaugų: atsakymų pasiūlymus galima išjungti, DNS administravimas aktualus tik klientams, turintiems savo domeną, o prisijungimas su Google yra savanoriška alternatyva prisijungimui su el. pašto adresu ir slaptažodžiu.",
          ],
        },
        {
          titel: "Atskyrimas nuo Europos Sąjungos teisės",
          paragraphs: [
            "CLOUD Act yra JAV teisė, ne Europos Sąjungos teisė. Jį reikia atskirti nuo EU Data Act (Reglamentas (ES) 2023/2854), kuriuo reglamentuojamas duomenų tvarkymo paslaugų keitimas ir duomenų perkeliamumas, taip pat nuo Cloud and AI Development Act, kuris šio pranešimo parengimo momentu yra Europos teisės aktų leidybos procese.",
          ],
        },
      ],
    },
    {
      heading: "Duomenų saugojimo terminai",
      list: [
        "Paskyros duomenys: verslo santykių trukmę; vėliau ištrinami, jeigu nėra saugojimo pareigos.",
        "Rezervacijų, sąskaitų ir mokėjimų duomenys: pagal Danijos buhalterinės apskaitos įstatymą penkerius metus po finansinių metų, kuriems jie priskiriami, pabaigos; klientams, įsteigtiems Vokietijoje, gali būti taikomi ilgesni komercinės ir mokesčių teisės terminai.",
        "Pranešimai ir svečių duomenys platformoje: pagal atsakingo verslo nurodymus, ne ilgiau nei iki jo atlikto ištrynimo arba iki sutarties pabaigos.",
        "Naujienlaiškis: iki sutikimo atšaukimo; nepatvirtintos registracijos negalioja po septynių dienų. Sutikimo ir atsisakymo įrodymas saugomas ir toliau, kol jo reikia kaip įrodymo.",
        "Prisijungimo žurnalai ir saugumo įvykiai: trumpą laiką, atakoms atpažinti.",
        "Serverio žurnalo failai: tik tiek laiko, kiek to reikia veikimui ir saugumui.",
        "Atsarginės kopijos: rotacijos principu, kol pakeičiamos naujesnėmis kopijomis.",
      ],
    },
    {
      heading: "Jūsų teisės",
      paragraphs: [
        "Turite teisę susipažinti su duomenimis (15 straipsnis), reikalauti juos ištaisyti (16 straipsnis), ištrinti (17 straipsnis), apriboti jų tvarkymą (18 straipsnis), teisę į duomenų perkeliamumą (20 straipsnis) ir teisę nesutikti su duomenų tvarkymu, grindžiamu teisėtais interesais (BDAR 21 straipsnis). Duotą sutikimą galite bet kada atšaukti, ir tai galios į priekį.",
        `Tuo tikslu kreipkitės adresu [${ANBIETER.email}](mailto:${ANBIETER.email}). Jeigu jūsų duomenys susiję su tuo, kaip platformą naudoja verslas, jūsų užklausą perduosime atsakingam verslui arba padėsime jam į ją atsakyti.`,
        `Taip pat galite pateikti skundą duomenų apsaugos priežiūros institucijai — mūsų atžvilgiu kompetentinga yra ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Taip pat galite kreiptis į savo gyvenamosios vietos priežiūros instituciją.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Ein Abschnitt „Ihre Rechte", der die
      // Löschung nur als DSGVO-Artikel erwähnt, genügt der Prüfung nicht.
      heading: "Paskyros ir programėlės duomenų ištrynimas",
      paragraphs: [
        "Savo paskyros ištrynimo galite bet kada paprašyti patys — programėlėje skyriuje ‚Profilis → Paskyra‘ arba per mūsų formą internete:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "Būdas internete sąmoningai veikia ir tada, kai programėlės nebeturite įdiegtos arba nebegalite prisijungti. Siekiant apsisaugoti nuo netinkamo naudojimo, tai vyksta dviem žingsniais: įvedate savo paskyros el. pašto adresą ir būtent tuo adresu gaunate patvirtinimo nuorodą. Prašymas tampa galiojantis tik ją atvėrus — vien įvestas adresas nieko nesukelia. Prašymą išnagrinėjame per 30 dienų ir atsakome el. paštu.",
        "Kartu su paskyra ištriname jūsų prisijungimo duomenis, profilį, objektų ir kalendoriaus duomenis bei jūsų pranešimus. Neištrinami dokumentai, kuriems taikoma teisės aktų nustatyta saugojimo pareiga — visų pirma apskaitytų laikotarpių sąskaitos ir rezervacijų dokumentai (buhalterinės apskaitos pareiga pagal Danijos teisę, paprastai penkerius metus). Šie dokumentai visą terminą blokuojami, t. y. saugomi išimtinai šiai pareigai įvykdyti, ir po to ištrinami.",
      ],
    },
    {
      heading: "Duomenų tvarkymo saugumas",
      paragraphs: [
        "Duomenų tvarkymą apsaugome techninėmis ir organizacinėmis priemonėmis pagal BDAR 32 straipsnį, visų pirma: nuolatiniu duomenų perdavimo šifravimu (TLS), kliento lygmens prieigos taisyklėmis pačioje duomenų bazėje, vaidmenimis grindžiamomis prieigos teisėmis atskiriant finansinius ir aptarnavimo duomenis, pasirenkamu dviejų faktorių autentifikavimu, prisijungimo bandymų ribojimu, užšifruotomis atsarginėmis kopijomis su reguliariu atkūrimo bandymu, taip pat saugumui svarbių įvykių registravimu.",
      ],
    },
    {
      heading: "Pareiga pateikti duomenis",
      paragraphs: [
        "Duomenys, kurių mums reikia sutarčiai sudaryti, atsiskaityti ir teisės aktų nustatytoms pareigoms įvykdyti, yra būtini — be jų platformos teikti negalime. Visi kiti duomenys teikiami savanoriškai.",
      ],
    },
    {
      heading: "Šio pranešimo pakeitimai",
      paragraphs: [
        "Šį pranešimą pritaikome, kai pasikeičia duomenų tvarkymas, pasitelkti paslaugų teikėjai arba teisinė padėtis. Kiekvienu atveju galioja čia paskelbta redakcija; data viršuje rodo jos parengimo momentą.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so.
export default datenschutz;
