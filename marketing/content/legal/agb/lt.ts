// KOPIE aus web/content/legal/agb/lt.ts — bewusst dupliziert, weil die
// Apps isoliert gebaut werden (ADR-0016): der Docker-Kontext dieser App
// enthält web/ nicht. Inhaltliche Änderungen IMMER in beiden Dateien.
// Zusätzlich zur web-Fassung: slug/metaDescription/numbered/toc für den
// Renderer dieser App.
import type { LegalDoc } from "../types";

// Litauische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. § 5 Absatz 1–2 folgt Stripes offiziellem Empfehlungstext
// (recommended disclosure language) — Sinn und URLs nicht verändern.
export const agb: LegalDoc = {
  slug: "agb",
  metaDescription:
    "Bendrosios myNextDays platformos naudojimo sąlygos agentūroms ir nuomotojams.",
  numbered: false,
  toc: true,
  title: "Bendrosios sąlygos agentūroms ir nuomotojams",
  stand: "Redakcija: 2026 m. rugsėjo 11 d.",
  intro: [
    "Šios bendrosios sąlygos (toliau — „Sąlygos“) reglamentuoja, kaip agentūros, nuomotojai, būstų administratoriai ir kiti verslo naudotojai (toliau — „Naudotojas“) naudojasi programinės įrangos platforma myNextDays (toliau — „Platforma“).",
    "Platformos teikėja yra myNextDays ApS, pagal Danijos teisę įsteigta uždaroji akcinė bendrovė (anpartsselskab), Hirtshalsvej 21, 9881 Bindslev, Danija, įregistruota Danijos centriniame įmonių registre (CVR) CVR Nr. 46615182 (toliau — „myNextDays“ arba „mes“).",
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
      "Kiekvienas vartotojo platformoje sukurtas objektas tuo pat metu įtraukiamas į platformos nuosavą prekyvietę myBestDays (privalomas kanalas). Vartotojas negali atskirai atsisakyti šio kanalo; tačiau jis gali bet kuriuo metu pašalinti objektą iš pardavimo visuose kanaluose vienu metu, naudodamas funkciją „Pristabdyti pardavimą“, arba jį ištrinti. Objektas tampa matomas myBestDays tik tada, kai vartotojas jį paskelbia ir myNextDays patvirtina skelbimą; myNextDays gali atsisakyti patvirtinti arba atšaukti patvirtinimą dėl pagrįstos priežasties. Už užsakymus per myBestDays taikomas mokestis pagal § 7.",
      ],
      list: [
        "objektų, užimtumo kalendorių ir rezervacijų valdymą (objektų valdymo sistema),",
        "prijungimą prie trečiųjų šalių užsakymo kanalų (pvz., Booking.com, Airbnb) per kanalų tvarkytuvą,",
        "Pasiūlymų paskelbimas per platformos nuosavą prekyvietę myBestDays (privalomas kanalas, žr. 2 dalį),",
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
        "Mokėjimo kelias priklauso nuo rezervavimo kanalo. Rezervacijų, atliktų per paties Naudotojo rezervavimo sistemą, ir rezervacijų per prijungtus platinimo portalus atveju svečių mokėjimai gaunami tiesiai į Naudotojo mokėjimo sąskaitą; tokiais atvejais Naudotojas svečio atžvilgiu yra mokėjimo gavėjas ir apgyvendinimo paslaugos sutarties šalis (§ 4), o myNextDays niekada netampa šių lėšų turėtoju. Už tokias rezervacijas myNextDays netaiko procentinio rezervacijos mokesčio; komisinis mokestis už rezervacijas per prijungtus platinimo portalus nurodomas atskirai ir sąskaita pateikiama vėliau.",
        "Rezervacijų, atliktų per myNextDays rezervavimo portalą, atveju mokėjimas apdorojamas per myNextDays. myNextDays tokiu atveju pasilieka galiojančiame kainoraštyje nurodytą tarpininkavimo komisinį mokestį kartu su mokėjimo apdorojimo išlaidomis ir likusią sumą perveda Naudotojui pagal toliau nurodytas dalis. Atlyginimas už programinės įrangos naudojimą (§ 7) lieka nepakitęs.",
        "Išmokos pervedamos į Naudotojo nurodytą banko sąskaitą. myNextDays gali dėl rizikos priežasčių koreguoti išmokų periodiškumą, ypač naujų paskyrų, neįprastų operacijų modelių ar vykstančių patikrinimų atveju.",
        "Grąžinimus svečiams ekonomiškai padengia Naudotojas. Mokėjimų užginčijimus ir dėl jų atsirandančius mokesčius padengia Naudotojas rezervacijų, atliktų per jo paties rezervavimo sistemą ir per prijungtus platinimo portalus, atveju, nes tokiais atvejais Naudotojas yra mokėjimo gavėjas; rezervacijų, atliktų per myNextDays rezervavimo portalą, atveju užginčijimo riziką prisiima myNextDays, nebent ji kyla dėl Naudotojo pareigų pažeidimo (visų pirma apgyvendinimo paslaugos nesuteikimo ar esminio nukrypimo). myNextDays turi teisę įskaityti Naudotojo dengiamas sumas į būsimas išmokas.",
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
      heading: "§ 12 Dirbtinio intelekto naudojimas",
      paragraphs: [
        "myNextDays atskirose funkcijose naudoja dirbtinio intelekto sistemas, visų pirma kainų rekomendacijoms (dinaminiam kainų nustatymui), atsakymų pasiūlymams pranešimų gautuosiuose ir pagalbai teikiant klientų aptarnavimą. Šios funkcijos parengia pasiūlymus; sprendimas juos naudoti ir atsakomybė už tai tenka Naudotojui. Kainų rekomendacijos nepakeičia paties Naudotojo komercinio įvertinimo.",
                "Platformoje jokia dirbtinio intelekto sistema automatiškai neatsako svečiams ar vartotojui: kiekvienas dirbtinio intelekto sukurtas pranešimas pateikiamas žmogui peržiūrėti, kuris gali jį pakeisti ir išsiųsti arba ne. Vartotojo palaikymą teikia žmonės. Nuo to skiriasi mūsų svetainės produktų konsultantas: jis nedelsiant ir be žmogaus patvirtinimo atsako į suinteresuotų šalių klausimus apie paslaugų apimtį, nėra platformos dalis ir nėra šios sutarties objektas. Šio konsultanto teikiama informacija nesukuria savybės patvirtinimo ir nėra viršesnė už šių sąlygų ir galiojančio paslaugų aprašymo nuostatas; svarbiausia yra § 2. Išsami informacija apie duomenų tvarkymą pateikiama mūsų privatumo politikoje.",
        "Jei fizinis asmuo tiesiogiai bendrauja su dirbtinio intelekto sistema, jam tai atskleidžiama (Reglamento (ES) 2024/1689 – „DI reglamentas“ 50 straipsnio 1 dalis); mūsų svetainės produktų konsultanto atveju tai vyksta dialogo pradžioje. Tekstus, kuriuos dirbtinio intelekto sistema sukūrė arba iš esmės pakeitė ir kuriuos vartotojas perduoda svečiams, vartotojas turi pažymėti, jei jam taikoma teisinė pareiga tai padaryti.",
        "myNextDays neeksploatuoja dirbtinio intelekto sistemų, kurios pagal Dirbtinio intelekto akto III priedą laikomos didelės rizikos sistemomis, ir netaiko praktikos, kuri pagal Dirbtinio intelekto akto 5 straipsnį yra uždrausta. Naudotojo įvedami duomenys ir jo svečių duomenys be atskiro pavedimo modeliams mokyti nenaudojami.",
        "Naudotojas negali naudoti dirbtinio intelekto funkcijų tam, kad svečiams sukurtų žmogaus bendravimo įspūdį ten, kur egzistuoja atskleidimo pareiga, arba kad pateiktų teisiškai įpareigojančius pareiškimus pats jų nepatikrinęs.",
        "Jei Naudotojas per tam skirtą sąsają sujungia savo paskyrą su savo pasirinktu dirbtinio intelekto asistentu (pavyzdžiui, Anthropic sukurtu Claude), taikoma tai, kas nurodyta toliau. Sutartį dėl tokios paslaugos Naudotojas sudaro pats ir yra atsakingas už jos naudojimą. Sujungimas yra jo nurodymas myNextDays perduoti ten jo atvertus duomenis — įskaitant perdavimą į trečiąją valstybę, jei teikėjo buveinė yra už Europos Sąjungos ribų. Naudotojas užtikrina, kad tam turi teisinį pagrindą, kad jo paties duomenų apsaugos informacijoje nurodytas gavėjas ir kad yra pateiktos reikalingos perdavimo garantijos.",
        "Tokiam sujungimui Naudotojas naudoja tokį prieigos būdą, kuriam teikėjas siūlo duomenų tvarkymą pagal pavedimą ir kuriam netaikomas duomenų naudojimas modeliams mokyti — Claude atveju tai yra verslo klientams skirti prieigos būdai (Team, Enterprise arba API). Privačiam naudojimui skirti prieigos būdai šių reikalavimų paprastai neatitinka; todėl svečių duomenims jie netinka. myNextDays negali atpažinti, kurį prieigos būdą Naudotojas naudoja, ir į tai atkreipia dėmesį sutikimo dialogo lange.",
        "Naudotojas atsižvelgia į tai, kad turiniui, kurį jis iš naudotojo sąsajos ranka nukopijuoja į asistento įvesties laukelį, teikėjo sutartiniai apribojimai paprastai netaikomi — kitaip nei duomenims, gaunamiems per sąsają.",
        "Duomenis, gaunamus iš užsakymo portalo, Naudotojas ir per sąsają naudoja tik atitinkamai rezervacijai vykdyti ir svečiams aptarnauti — ne asmenims vertinti, profiliams sudaryti ar reklamai. Šią naudojimo tikslo ribą portalai nustato savo pačių sąlygose.",
      ],
    },
    {
      heading: "§ 13 Skundai ir mediacija",
      paragraphs: [
        "myNextDays verslo naudotojams teikia nemokamą vidinę skundų nagrinėjimo sistemą (Reglamento (ES) 2019/1150 — „P2B reglamento“ 11 straipsnis). Skundus — visų pirma dėl tariamų šių Sąlygų pažeidimų, dėl techninių problemų, turinčių reikšmingą įtaką, arba dėl myNextDays taikomų priemonių Naudotojo atžvilgiu — galima laisva forma pateikti adresu info@mynextdays.dk arba per programoje esantį pagalbos kanalą. Gavimas patvirtinamas; skundas nagrinėjamas nedelsiant ir per pagrįstą terminą, o nesudėtingais atvejais paprastai per 14 dienų. Rezultatas Naudotojui pranešamas aiškia kalba.",
        "Jei nagrinėjant skundą susitarti nepavyksta, myNextDays yra pasirengusi kartu su Naudotoju neteismine tvarka kreiptis į šiuos mediatorius (P2B reglamento 12 straipsnis): (1) WIPO Arbitration and Mediation Center, 34 chemin des Colombettes, 1211 Ženeva 20, Šveicarija — procedūros galimos ir nuotoliniu būdu bei keliomis kalbomis; (2) Voldgiftsinstituttet — Danish Institute of Arbitration, Kronprinsessegade 28, 1306 Kopenhaga K, Danija — teikėjos buveinės valstybė.",
        "Šis nurodymas neįpareigoja Naudotojo vykdyti mediacijos procedūros; teisė kreiptis į teismą lieka nepakitusi. Prie pagrįstų mediacijos išlaidų myNextDays prisideda; jų paskirstymas nustatomas pagal atitinkamo mediatoriaus taisykles ir konkretaus atvejo aplinkybes.",
        "myNextDays kasmet skelbia informaciją apie gautų skundų skaičių, jų nagrinėjimo trukmę ir taikytas priemones.",
      ],
    },
    {
      heading: "§ 14 Intelektinė nuosavybė",
      paragraphs: [
        "Visos teisės į Platformą, jos programinę įrangą ir turinį (išskyrus Naudotojo pateiktą turinį) priklauso myNextDays arba jos licencijų davėjams. Sutarties galiojimo laikotarpiui Naudotojas įgyja paprastą, neperleidžiamą teisę naudotis Platforma sutartyje sutarta apimtimi.",
        "Naudotojas suteikia myNextDays paprastas naudojimo teises į savo pateiktą turinį, kiek tai būtina Platformai eksploatuoti (visų pirma saugoti, atgaminti, rodyti ir perduoti prijungtiems kanalams).",
      ],
    },
    {
      heading: "§ 15 Atsakomybė",
      paragraphs: [
        "myNextDays neribotai atsako už tyčią ir didelį neatsargumą, taip pat už žalą, atsiradusią dėl gyvybės atėmimo, kūno sužalojimo ar sveikatos sutrikdymo.",
        "Paprasto neatsargumo atveju myNextDays atsako tik už esminių sutartinių pareigų (kardinaliųjų pareigų) pažeidimą, apsiribojant sutarčiai tipiška, numatoma žala. Atsakomybė pagal atsakomybės už gaminius teisės aktus ir pagal prisiimtas garantijas lieka nepakitusi.",
        "Už duomenų praradimą myNextDays atsako tik tiek, kiek žala būtų atsiradusi ir tuo atveju, jei Naudotojas būtų tinkamai ir reguliariai daręs atsargines duomenų kopijas, nebent atsarginių kopijų darymas pagal sutartį tenka myNextDays.",
      ],
    },
    {
      heading: "§ 16 Galiojimo terminas, nutraukimas ir blokavimas",
      paragraphs: [
        "Galiojimo terminas ir įspėjimo apie nutraukimą terminai nustatomi atitinkamoje sutartyje. Teisė nutraukti sutartį nepaprastąja tvarka dėl svarbios priežasties lieka nepakitusi.",
        "myNextDays gali laikinai užblokuoti prieigą prie Platformos arba atskirų funkcijų (įskaitant mokėjimų priėmimą ir išmokas), jei yra konkrečių požymių, kad pažeidžiamos šios Sąlygos, vykdomas sukčiavimas arba piktnaudžiaujama naudojimusi, arba jei myNextDays tai daryti privalo pagal teisės aktus ar mokėjimo paslaugų teikėjo nurodymą. Naudotojas apie blokavimą informuojamas, kiek tai teisiškai leidžiama.",
        "Pasibaigus sutarčiai, myNextDays Naudotojo prašymu per 30 dienų pateikia jo duomenis eksportuoti įprastu formatu; po to duomenys ištrinami, jei tam neprieštarauja teisės aktuose nustatytos saugojimo pareigos.",
      ],
    },
    {
      heading: "§ 17 Šių Sąlygų pakeitimai",
      paragraphs: [
        "myNextDays gali keisti šias Sąlygas ateičiai, jei tai būtina dėl svarių priežasčių (visų pirma teisės aktų pakeitimų, teismų praktikos pokyčių ar mokėjimo paslaugų teikėjų reikalavimų) ir dėl to Naudotojas nėra nepagrįstai nuskriaudžiamas.",
        "Apie pakeitimus Naudotojui pranešama tekstine forma likus ne mažiau kaip šešioms savaitėms iki jų įsigaliojimo. Jei Naudotojas per pranešimo laikotarpį nepareiškia prieštaravimo arba po įsigaliojimo toliau naudojasi Platforma, pakeistos Sąlygos laikomos priimtomis; į šią pasekmę pranešime atskirai atkreipiamas dėmesys.",
      ],
    },
    {
      heading: "§ 18 Baigiamosios nuostatos",
      paragraphs: [
        "Taikoma valstybės, kurioje teikėja turi registruotą buveinę, teisė, netaikant Jungtinių Tautų konvencijos dėl tarptautinio prekių pirkimo–pardavimo sutarčių. Imperatyvios valstybės, kurioje Naudotojas turi buveinę, nuostatos lieka nepakitusios.",
        "Išimtinė teismingumo vieta visiems ginčams, kylantiems iš šios sutarties ar su ja susijusiems, — kiek tai teisiškai leidžiama — yra teikėjos buveinė.",
        "Jei atskiros šių Sąlygų nuostatos yra ar taptų negaliojančios, kitų nuostatų galiojimui tai įtakos neturi.",
      ],
    },
  ],
};
