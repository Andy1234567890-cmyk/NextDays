import type { LegalDoc } from "../types";

// Slowakische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. § 5 Absatz 1–2 folgt Stripes offiziellem Empfehlungstext
// (Stripe Connected Account Agreement) — Wortlaut sinngemäß, URLs nicht verändern.
export const agb: LegalDoc = {
  title: "Všeobecné obchodné podmienky (VOP) pre agentúry a prenajímateľov",
  stand: "Stav ku dňu: 26. júla 2026",
  intro: [
    "Tieto všeobecné obchodné podmienky (ďalej len „VOP“) upravujú používanie softvérovej platformy myNextDays (ďalej len „platforma“) agentúrami, prenajímateľmi, správcami nehnuteľností a inými podnikateľskými používateľmi (ďalej len „používateľ“).",
    "Poskytovateľom platformy je [úplné obchodné meno, právna forma, adresa a registrové údaje prevádzkovateľa — doplniť pred zverejnením] (ďalej len „myNextDays“ alebo „my“).",
    "Platforma je určená výlučne podnikateľom v zmysle § 14 nemeckého občianskeho zákonníka (BGB), resp. zodpovedajúcich predpisov príslušného členského štátu EÚ. Nie je určená spotrebiteľom.",
  ],
  sections: [
    {
      heading: "§ 1 Rozsah pôsobnosti",
      paragraphs: [
        "Tieto VOP sa vzťahujú na všetky zmluvy o používaní platformy uzavreté medzi myNextDays a používateľom, ako aj na všetky služby a moduly poskytované jej prostredníctvom.",
        "Odchylné, rozporné alebo doplňujúce obchodné podmienky používateľa sa stávajú súčasťou zmluvy len vtedy, ak myNextDays s ich platnosťou výslovne súhlasila v textovej forme.",
      ],
    },
    {
      heading: "§ 2 Predmet zmluvy a služby",
      paragraphs: [
        "myNextDays poskytuje používateľovi cloudový softvér na správu rekreačných ubytovaní a ubytovacích zariadení. Rozsah funkcií vyplýva z aktuálneho opisu služieb a zahŕňa najmä:",
      ],
      list: [
        "správu objektov, kalendárov obsadenosti a rezervácií (property management systém),",
        "napojenie na rezervačné kanály tretích strán (napr. Booking.com, Airbnb) prostredníctvom channel managera,",
        "zverejňovanie ponúk prostredníctvom vlastného rezervačného kanála platformy myNextDays,",
        "tvorbu vlastných webových stránok pomocou integrovaného page buildera,",
        "účtovné, zúčtovacie a analytické funkcie vrátane vyúčtovaní pre vlastníkov,",
        "komunikáciu s hosťami a prijímanie platieb prostredníctvom integrovaného spracovania platieb (§ 5).",
      ],
    },
    {
      heading: "§ 3 Registrácia, účet a údaje používateľa",
      paragraphs: [
        "Používanie platformy vyžaduje registráciu účtu. Používateľ je povinný pri registrácii a počas celej doby trvania zmluvy uvádzať správne, aktuálne a úplné údaje o svojej osobe a o svojom podniku a pri zmenách ich bezodkladne aktualizovať.",
        "Prístupové údaje je potrebné uchovávať v tajnosti a chrániť pred prístupom tretích osôb. Používateľ je povinný bezodkladne informovať myNextDays, ak existujú náznaky zneužitia jeho účtu.",
        "Účet je neprenosný. Používateľ zabezpečí, aby všetky osoby, ktoré účet používajú v jeho mene, dodržiavali tieto VOP.",
      ],
    },
    {
      heading: "§ 4 Úloha myNextDays pri rezerváciách",
      paragraphs: [
        "Zmluvy o ubytovaní týkajúce sa ubytovaní ponúkaných na platforme, prostredníctvom napojených kanálov tretích strán alebo na vlastnej webovej stránke používateľa sa uzatvárajú výlučne medzi používateľom (resp. vlastníkom, ktorého používateľ zastupuje) a príslušným hosťom. myNextDays sa nestáva zmluvnou stranou zmluvy o ubytovaní.",
        "Za správnosť a zákonnosť obsahu ponúk (opisy, fotografie, ceny, dostupnosť, dane a poplatky) zodpovedá výlučne používateľ.",
      ],
    },
    {
      heading: "§ 5 Spracovanie platieb spoločnosťou Stripe",
      paragraphs: [
        "Služby spracovania platieb pre agentúry a prenajímateľov na myNextDays poskytuje Stripe a riadia sa zmluvou [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), ktorá zahŕňa podmienky poskytovania služieb Stripe (spolu ďalej len „rámcová zmluva Stripe“). Súhlasom s týmito VOP alebo pokračovaním v činnosti agentúry alebo prenajímateľa na myNextDays sa používateľ zaväzuje dodržiavať rámcovú zmluvu Stripe, ktorú môže Stripe priebežne meniť.",
        "Podmienkou toho, aby myNextDays umožnila služby spracovania platieb prostredníctvom Stripe, je, že používateľ poskytne myNextDays správne a úplné informácie o sebe a o svojom podniku. Používateľ oprávňuje myNextDays odovzdávať spoločnosti Stripe tieto informácie, ako aj transakčné údaje súvisiace s používaním služieb spracovania platieb poskytovaných spoločnosťou Stripe.",
        "Pre právny vzťah so spoločnosťou Stripe je rozhodujúce odkazované anglické znenie zmluvy v jeho aktuálne platnej verzii. Zmluvným partnerom používateľov v Európskom hospodárskom priestore je spoločnosť Stripe uvedená v rámcovej zmluve Stripe (v súčasnosti Stripe Payments Europe, Limited, Írsko). Stripe spracúva osobné údaje v súlade so [zásadami ochrany osobných údajov spoločnosti Stripe](https://stripe.com/privacy).",
        "Na splnenie zákonných povinností identifikácie a preverovania (okrem iného prevencia legalizácie príjmov z trestnej činnosti, zásada „poznaj svojho klienta“) môžu myNextDays a Stripe kedykoľvek požadovať ďalšie údaje a doklady, najmä doklady totožnosti, údaje o konečných užívateľoch výhod a o bankovom spojení. Ak požadované údaje alebo doklady nebudú poskytnuté v stanovenej lehote, môže byť prijímanie platieb alebo vyplácanie prostriedkov úplne alebo čiastočne pozastavené, kým nebudú údaje kompletné.",
      ],
    },
    {
      heading: "§ 6 Výplaty, spätné zúčtovania a záporné zostatky",
      paragraphs: [
        "Spôsob úhrady sa riadi rezervačným kanálom. Pri rezerváciách uskutočnených prostredníctvom vlastného rezervačného systému Používateľa a pri rezerváciách prostredníctvom pripojených distribučných portálov sa platby hostí prijímajú priamo na platobný účet Používateľa; v týchto prípadoch je Používateľ voči hosťovi príjemcom platby a zmluvnou stranou ubytovacej služby (§ 4) a myNextDays sa v žiadnom okamihu nestáva držiteľom týchto prostriedkov. Z takýchto rezervácií myNextDays neúčtuje žiadny percentuálny rezervačný poplatok; provízia za rezervácie prostredníctvom pripojených distribučných portálov sa uvádza samostatne a fakturuje sa dodatočne.",
        "Pri rezerváciách uskutočnených prostredníctvom rezervačného portálu myNextDays je platba spracovaná prostredníctvom myNextDays. myNextDays si pritom ponecháva sprostredkovateľskú províziu uvedenú v aktuálne platnom cenníku vrátane nákladov na spracovanie platby a zvyšnú sumu poukazuje Používateľovi podľa nasledujúcich odsekov. Odmena za používanie softvéru (§ 7) tým nie je dotknutá.",
        "Výplaty sa uskutočňujú na bankový účet uvedený používateľom. myNextDays môže z dôvodov riadenia rizika upraviť frekvenciu výplat, najmä pri nových účtoch, neobvyklých transakčných vzorcoch alebo prebiehajúcich kontrolách.",
        "Vrátenie platieb hosťom nesie ekonomicky Používateľ. Spätné zúčtovania a z nich vyplývajúce poplatky nesie Používateľ pri rezerváciách uskutočnených prostredníctvom vlastného rezervačného systému a prostredníctvom pripojených distribučných portálov, keďže Používateľ je v týchto prípadoch príjemcom platby; pri rezerváciách uskutočnených prostredníctvom rezervačného portálu myNextDays nesie riziko spätného zúčtovania myNextDays, ibaže je spôsobené porušením povinností Používateľa (najmä neposkytnutím alebo podstatnou odchýlkou ubytovacej služby). myNextDays je oprávnená započítať sumy na ťarchu Používateľa proti budúcim výplatám.",
        "Ak na platobnom účte používateľa vznikne záporný zostatok, používateľ je povinný ho bezodkladne vyrovnať. Používateľ oprávňuje myNextDays a Stripe inkasovať záporné zostatky z uvedeného bankového účtu, pokiaľ je to právne prípustné.",
      ],
    },
    {
      heading: "§ 7 Odplaty a vyúčtovanie",
      paragraphs: [
        "Odplaty za používanie platformy vyplývajú z cenníka dohodnutého pri uzavretí zmluvy, resp. z individuálnej ponuky. Všetky ceny sa rozumejú bez príslušných zákonných daní a v mene uvedenej v zmluve.",
        "Odplaty závislé od transakcií (napr. poplatky za platby alebo kanály) môžu byť zadržané alebo započítané priamo pri spracovaní príslušnej transakcie.",
        "Ak sa používateľ dostane do omeškania s platbami, môže myNextDays po predchádzajúcom upozornení zablokovať prístup k platforme, kým nebudú neuhradené pohľadávky vyrovnané.",
      ],
    },
    {
      heading: "§ 8 Povinnosti používateľa; vlastné právne texty",
      paragraphs: [
        "Používateľ zabezpečí, aby jeho ponuky, obsah a obchodné praktiky boli v súlade s príslušnými platnými právnymi predpismi, najmä s predpismi o ubytovaní, ohlasovacej povinnosti, daniach a ochrane spotrebiteľa v mieste ubytovania. Potrebné povolenia, registrácie a licencie si používateľ zabezpečuje na vlastnú zodpovednosť.",
        "Za webové stránky, ktoré používateľ prevádzkuje prostredníctvom page buildera, ako aj za svoje ponuky na platforme zodpovedá sám používateľ; patria sem najmä vlastné VOP pre hostí, vlastné povinné identifikačné údaje (impressum) a vlastné informácie o ochrane osobných údajov.",
        "Zakázané je najmä: zverejňovanie nesprávnych alebo zavádzajúcich ponúk, realizácia fiktívnych obchodov alebo podvodných transakcií, obchádzanie spracovania platieb podľa § 5 pri rezerváciách uzavretých prostredníctvom platformy, ako aj akékoľvek používanie, ktoré narúša bezpečnosť alebo dostupnosť platformy.",
      ],
    },
    {
      heading: "§ 9 Rezervačné kanály tretích strán",
      paragraphs: [
        "Pri napojení kanálov tretích strán (napr. Booking.com, Airbnb) platia navyše podmienky príslušného prevádzkovateľa kanála. Zmluvy, ktoré sú na to potrebné, uzatvára používateľ s prevádzkovateľom kanála sám.",
        "myNextDays zabezpečuje technickú synchronizáciu dostupnosti, cien a rezervačných údajov, nemá však žiadny vplyv na obsah, provízie ani rozhodnutia prevádzkovateľov kanálov a nezodpovedá za ich dostupnosť.",
      ],
    },
    {
      heading: "§ 10 Dostupnosť a ďalší vývoj",
      paragraphs: [
        "myNextDays poskytuje služby so starostlivosťou riadneho obchodníka a usiluje sa o vysokú dostupnosť platformy. Údržbové okná, ďalší vývoj a okolnosti mimo sféry vplyvu myNextDays (napr. výpadky u tretích poskytovateľov) môžu dostupnosť dočasne obmedziť.",
        "myNextDays smie platformu ďalej rozvíjať a meniť jej funkcie, pokiaľ tým nie je ohrozený účel zmluvy a zmena je pre používateľa primeraná.",
      ],
    },
    {
      heading: "§ 11 Údaje a ochrana osobných údajov",
      paragraphs: [
        "Pokiaľ myNextDays pri poskytovaní platformy spracúva osobné údaje v mene používateľa (najmä údaje hostí), uzatvoria zmluvné strany zmluvu o spracúvaní osobných údajov podľa čl. 28 všeobecného nariadenia o ochrane údajov (GDPR).",
        "Používateľ zostáva zodpovedný za prípustnosť získavania a spracúvania ním vložených údajov z hľadiska ochrany osobných údajov. Podrobnosti o spracúvaní údajov spoločnosťou myNextDays vyplývajú z informácií o ochrane osobných údajov platformy; na spracúvanie údajov spoločnosťou Stripe sa vzťahuje § 5.",
      ],
    },
    {
      heading: "§ 12 Duševné vlastníctvo",
      paragraphs: [
        "Všetky práva k platforme, jej softvéru a jej obsahu (s výnimkou obsahu vloženého používateľom) patria myNextDays, resp. jej poskytovateľom licencií. Používateľ získava na dobu trvania zmluvy nevýhradné, neprenosné právo používať platformu v zmluvne dohodnutom rozsahu.",
        "K obsahu, ktorý používateľ vložil, udeľuje používateľ myNextDays nevýhradné užívacie práva potrebné na prevádzku platformy (najmä na ukladanie, rozmnožovanie, zobrazovanie a prenos do napojených kanálov).",
      ],
    },
    {
      heading: "§ 13 Zodpovednosť",
      paragraphs: [
        "myNextDays zodpovedá neobmedzene za úmysel a hrubú nedbanlivosť, ako aj za škody vzniknuté ujmou na živote, tele alebo zdraví.",
        "Pri ľahkej nedbanlivosti zodpovedá myNextDays len za porušenie podstatných zmluvných povinností (kardinálnych povinností), a to v rozsahu obmedzenom na predvídateľnú škodu typickú pre daný typ zmluvy. Zodpovednosť podľa právnych predpisov o zodpovednosti za chybné výrobky, ako aj z prevzatých záruk zostáva nedotknutá.",
        "Za stratu údajov zodpovedá myNextDays len v rozsahu, v akom by škoda vznikla aj pri riadnom a pravidelnom zálohovaní údajov používateľom, pokiaľ zálohovanie údajov nie je zmluvnou povinnosťou myNextDays.",
      ],
    },
    {
      heading: "§ 14 Doba trvania, výpoveď a zablokovanie",
      paragraphs: [
        "Doba trvania zmluvy a výpovedné lehoty vyplývajú z príslušnej zmluvy. Právo na mimoriadnu výpoveď zo závažného dôvodu zostáva nedotknuté.",
        "myNextDays môže dočasne zablokovať prístup k platforme alebo jednotlivé funkcie (vrátane prijímania platieb a výplat), ak existujú konkrétne náznaky porušenia týchto VOP, podvodu alebo zneužitia, alebo ak je na to myNextDays povinná zo zákona alebo na základe pokynu poskytovateľa platobných služieb. Používateľ bude o zablokovaní informovaný, pokiaľ je to právne prípustné.",
        "Po skončení zmluvy myNextDays na požiadanie sprístupní používateľovi jeho údaje na export v bežnom formáte do 30 dní; potom budú údaje vymazané, pokiaľ tomu nebránia zákonné povinnosti uchovávania.",
      ],
    },
    {
      heading: "§ 15 Zmeny týchto VOP",
      paragraphs: [
        "myNextDays môže tieto VOP zmeniť s účinnosťou do budúcnosti, pokiaľ je to potrebné zo závažných dôvodov (najmä pri zmenách právnych predpisov, zmenách judikatúry alebo požiadavkách poskytovateľov platobných služieb) a používateľ tým nie je neprimerane znevýhodnený.",
        "Zmeny budú používateľovi oznámené v textovej forme najmenej šesť týždňov pred nadobudnutím ich účinnosti. Ak používateľ v lehote uvedenej v oznámení nevznesie námietku alebo bude platformu po nadobudnutí účinnosti naďalej používať, považujú sa zmenené VOP za prijaté; na tento následok bude v oznámení osobitne upozornený.",
      ],
    },
    {
      heading: "§ 16 Záverečné ustanovenia",
      paragraphs: [
        "Uplatňuje sa právo štátu, v ktorom má poskytovateľ platformy svoje sídlo, s vylúčením Dohovoru OSN o zmluvách o medzinárodnej kúpe tovaru. Kogentné predpisy štátu, v ktorom má používateľ svoje sídlo, zostávajú nedotknuté.",
        "Výlučným miestom súdnej príslušnosti pre všetky spory vyplývajúce z tejto zmluvy alebo v súvislosti s ňou je — pokiaľ je to právne prípustné — sídlo poskytovateľa platformy.",
        "Ak by jednotlivé ustanovenia týchto VOP boli alebo sa stali neplatnými, platnosť ostatných ustanovení tým zostáva nedotknutá.",
      ],
    },
  ],
};
