// Slowakische Fassung der Datenschutzerklärung.
//
// Referenz ist content/legal/datenschutz/de.ts — INHALTLICHE Änderungen gehören
// ZUERST dorthin und werden von dort in alle Sprachfassungen nachgezogen. Diese
// Datei hat dieselbe Struktur wie de.ts (20 Abschnitte, gleiche Absatzzahlen);
// Firmen-, Register-, Dienstleister- und Rechtsakt-Bezeichnungen bleiben
// unübersetzt.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Zásady ochrany osobných údajov",
  metaDescription:
    "Ako myNextDays spracúva osobné údaje: účely, právne základy, príjemcovia, doby uchovávania a vaše práva podľa GDPR.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Tieto zásady opisujú, ako ${ANBIETER.firma} spracúva osobné údaje — pri návšteve tejto webovej stránky, pri používaní platformy myNextDays (nástenka, trhovisko a mobilná aplikácia) a v rámci obchodného vzťahu s našimi zákazníkmi.`,
    "Nepredávame údaje a nevytvárame profily, ktoré by vás identifikovali ako osobu. Na tejto webovej stránke meriame – len s vaším súhlasom – dosah našich stránok a úspešnosť našej reklamy; obe kategórie sú jednotlivo voliteľné (pozri časti Meranie dosahu a Reklama a meranie úspešnosti). Údaje na marketingové účely spracúvame výlučne vtedy, ak ste s tým výslovne súhlasili – konkrétne pre náš newsletter (pozri časť Komunikácia), ktorého odber môžete kedykoľvek zrušiť jediným kliknutím.",
  ],
  sections: [
    {
      heading: "Prevádzkovateľ",
      paragraphs: [
        "Za spracovateľské operácie opísané v týchto zásadách zodpovedá:",
      ],
      zeilen: [
        {
          label: "Spoločnosť",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Adresa",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefón",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Rozsah pôsobnosti a úlohy",
      unterpunkte: [
        {
          paragraphs: [
            "V súvislosti s návštevou tejto webovej stránky, s vaším zákazníckym kontom a s realizáciou nášho obchodného vzťahu sme prevádzkovateľom v zmysle čl. 4 bodu 7 GDPR.",
          ],
        },
        {
          paragraphs: [
            "V súvislosti s údajmi, ktoré naši zákazníci (prenajímatelia, hotely, agentúry) spracúvajú na platforme o svojich hosťoch, vlastníkoch a zamestnancoch, sú prevádzkovateľmi zákazníci a my sme sprostredkovateľom podľa čl. 28 GDPR. Podrobnosti sú uvedené v [zmluve o spracúvaní osobných údajov](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Ak si ako hosť rezervujete ubytovanie prostredníctvom nášho trhoviska, spracúvame vaše rezervačné a kontaktné údaje tak vo vlastnom mene (prevádzka trhoviska, spracovanie platieb), ako aj pre hosťujúcu prevádzku. Vaša zmluva o ubytovaní vzniká výlučne s prevádzkou; popri tom platia jej vlastné informácie o ochrane údajov.",
          ],
        },
      ],
    },
    {
      heading: "Návšteva tejto webovej stránky",
      unterpunkte: [
        {
          titel: "Serverové protokolové súbory",
          paragraphs: [
            "Pri každom vyvolaní odosiela váš prehliadač technicky nevyhnutné údaje, ktoré náš webový server zaznamenáva: IP adresu, dátum a čas, vyvolanú adresu, objem prenesených údajov, kód stavu, odkazujúcu stránku a identifikáciu prehliadača. Účelom je poskytnutie stránky, ako aj rozpoznávanie a odvrátenie útokov a poruch. Právnym základom je čl. 6 ods. 1 písm. f) GDPR; naším oprávneným záujmom je bezpečná a stabilná prevádzka. Protokoly sa uchovávajú len tak dlho, ako je to potrebné na prevádzku a bezpečnosť, a nespájajú sa s inými údajmi.",
          ],
        },
        {
          titel: "Písma",
          paragraphs: [
            "Použité písma sú vložené lokálne na našom serveri. Nedochádza k žiadnemu spojeniu so službou Google Fonts ani s inou službou písiem.",
          ],
        },
        {
          titel: "Ikony",
          paragraphs: [
            "Ikony tejto webovej stránky sú, rovnako ako písma, u nás: vkladajú sa do stránky na našom serveri a nedoťahujú sa zo služby ikon. Nedochádza pritom k žiadnemu spojeniu s tretou stranou a vaša IP adresa sa nikomu neposkytuje.",
          ],
        },
        {
          titel: "Ochrana kontaktného formulára pred spamom (reCAPTCHA)",
          paragraphs: [
            "Náš kontaktný formulár je chránený pred automatizovanými masovými správami pomocou reCAPTCHA Enterprise od spoločnosti Google Ireland Limited. Len ak s tým súhlasíte, načíta váš prehliadač pri vyplňovaní formulára skript z www.google.com; pritom sa spoločnosti Google poskytne vaša IP adresa a údaje o vašej interakcii s formulárom a tam sa vyhodnotia, aby sa odlíšil človek od skriptu. Právnym základom je čl. 6 ods. 1 písm. a) GDPR (súhlas); dopĺňajúco platia [zásady ochrany osobných údajov spoločnosti Google](https://policies.google.com/privacy).",
            "Bez vášho súhlasu sa nič nenačíta zo služby Google a nebudú tam prúdiť žiadne údaje; formulár potom neprijmeme, ale vždy nám môžete napísať e-mail. Ak súhlas udelíte, reCAPTCHA nastaví vlastnú súbor cookie (_GRECAPTCHA, doba platnosti určená spoločnosťou Google, až šesť mesiacov), ktorý slúži na posúdenie rizika. Svoj súhlas môžete kedykoľvek zmeniť alebo odvolať prostredníctvom ikony súboru cookie vľavo dole na každej stránke; súbor cookie sa potom vymaže.",
          ],
        },
        {
          titel: "Meranie dosahu (Google Analytics)",
          paragraphs: [
            "Na tejto webovej stránke meriame pomocou Google Analytics 4 od spoločnosti Google Ireland Limited, ako sa používajú naše stránky – ktoré stránky sa navštevujú, odkiaľ prichádzajú návštevníci a v ktorom bode odchádzajú. Účelom je výhradne zlepšenie ponuky a nájditeľnosti.",
            "Načítanie prebieha výhradne s vaším súhlasom. Ak ho udelíte, váš prehliadač načíta skript z www.googletagmanager.com a uloží dva súbory cookie („_ga“ a „_ga_<ID>“, platnosť až dva roky) s náhodne vygenerovaným identifikátorom; prenášajú sa tento identifikátor, navštívené stránky, zdroj odkazu, približná poloha na úrovni krajiny alebo regiónu, zariadenie a prehliadač, ako aj vaša IP adresa, ktorú Google pred každým uložením skráti. Právnym základom je čl. 6 ods. 1 písm. a GDPR (súhlas).",
            "Vyhodnotenie sme výslovne obmedzili: Signály Google a personalizácia reklamy sú vypnuté. Preto nevznikajú žiadne profily naprieč zariadeniami a žiadne cieľové skupiny pre reklamu, a neposkytujeme žiadne údaje o používaní reklamným sieťam. Spojenie s vaším zákazníckym účtom sa neuskutočňuje.",
            "Google spracúva údaje ako náš sprostredkovateľ na základe zmluvy podľa čl. 28 GDPR (Google Ads Data Processing Terms). Skrátenie vašej IP adresy sa uskutočňuje na serveroch v EÚ predtým, ako sa údaje prenesú do USA; prenáša sa teda pseudonymný súbor údajov. Základom prenosu je rozhodnutie Európskej komisie o primeranosti pre rámec ochrany osobných údajov EÚ-USA (čl. 45 GDPR), podľa ktorého je spoločnosť Google LLC certifikovaná; okrem toho Google zahrnul štandardné zmluvné doložky Európskej komisie (čl. 46 GDPR). Výslovne upozorňujeme, že americké úrady môžu podľa § 702 FISA pristupovať aj k údajom certifikovaných spoločností a zvyškové riziko preto nemožno úplne vylúčiť. Okrem toho platí [zásada ochrany osobných údajov spoločnosti Google](https://policies.google.com/privacy).",
            "Doba uchovávania: Údaje súvisiace s udalosťami a používateľmi sa v našej službe automaticky vymažú po 14 mesiacoch; agregované údaje správ bez odkazu na jednotlivých návštevníkov zostávajú zachované aj po tomto období. Váš súhlas samotný vyprší po šiestich mesiacoch.",
            "Bez vášho súhlasu sa nič nenačíta, nenastaví sa žiadny súbor cookie a žiadne údaje neprúdia do spoločnosti Google. Svoj súhlas môžete kedykoľvek odvolať prostredníctvom ikony súboru cookie vľavo dole na každej stránke; meranie sa potom okamžite ukončí a uvedené súbory cookie sa vymažú. Po šiestich mesiacoch sa vás opýtame znova.",
          ],
        },
        {
          titel: "Reklama a meranie úspešnosti",
          paragraphs: [
            "S vaším súhlasom používame marketingové súbory cookie na meranie úspešnosti našej reklamy a zobrazovanie relevantných reklám na iných platformách. Zúčastnené sú Meta Platforms Ireland (Meta-Pixel, cookie _fbp), LinkedIn Ireland (Insight-Tag, cookies li_gc a bcookie) a Google Ireland Limited (Google Ads, cookie _gcl_au). Právnym základom je čl. 6 ods. 1 písm. a GDPR. Bez vášho súhlasu sa žiadny z týchto skriptov nenačíta a žiadny súbor cookie sa nenastaví; v prípade odvolania súhlasu ich vymažeme. Podrobnosti o každom súbore cookie nájdete v [Zásadách používania súborov cookie](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Zákaznícke konto a používanie platformy",
      paragraphs: [
        "Na registráciu a vedenie konta spracúvame údaje, ktoré zadáte vy alebo vaša prevádzka: meno, obchodné meno a právnu formu, adresu, e-mailovú adresu, telefónne číslo, úlohu a oprávnenia, registrové údaje (napr. číslo v obchodnom registri alebo IČ DPH), bankové spojenie na výplaty, ako aj obsahy vytvorené v konte.",
        "Na zabezpečenie prístupu spracúvame okrem toho prihlasovacie protokoly (čas, IP adresu, zariadenie a prehliadač použité pri prihlásení) a — ak je aktivované — údaje dvojfaktorového overenia.",
        "Prihlásenie pomocou Google: namiesto e-mailu a hesla sa môžete prihlásiť aj kontom Google. Ak si zvolíte túto cestu, dostaneme od spoločnosti Google Ireland Limited výlučne vašu e-mailovú adresu, vaše meno, váš profilový obrázok a identifikátor vášho konta Google (rozsahy „openid“, „email“, „profile“) — výslovne žiadny prístup k vašim e-mailom, kontaktom, súborom ani kalendáru. Vaše heslo ku kontu Google sa nedozvieme. Google spracúva prihlasovací proces ako samostatný prevádzkovateľ; platia [zásady ochrany osobných údajov spoločnosti Google](https://policies.google.com/privacy). Právnym základom je čl. 6 ods. 1 písm. b) GDPR, keďže prihlásenie slúži plneniu zmluvy; voľba tejto prihlasovacej cesty je dobrovoľná a kedykoľvek ju možno nahradiť prihlásením pomocou e-mailu a hesla.",
        "Právnym základom je čl. 6 ods. 1 písm. b) GDPR (plnenie zmluvy o používaní, pozri [všeobecné obchodné podmienky](" +
          AGB_URL +
          ")), pri zabezpečení prístupu čl. 6 ods. 1 písm. f) GDPR a pri uchovávaní podľa daňového a obchodného práva čl. 6 ods. 1 písm. c) GDPR.",
      ],
    },
    {
      heading: "Rezervácie, údaje hostí a údaje objektov",
      paragraphs: [
        "Prostredníctvom platformy sa spracúvajú rezervácie, údaje hostí, správy, úlohy a vyúčtovania. Patria k nim najmä meno a kontaktné údaje hosťa, príchod a odchod, počet cestujúcich, ceny a stav platby, história správ, ako aj — ak ich prevádzka zaznamenáva — ohlasovacie údaje a osobitné požiadavky.",
        "Toto spracúvanie sa uskutočňuje na pokyn a podľa príkazov príslušnej prevádzky. Tieto údaje nepoužívame na vlastné účely, ani na reklamu, ani na trénovanie modelov umelej inteligencie.",
        "V rámci jednej prevádzky sú údaje rozdelené podľa úloh: pracovníci upratovania a servisu nevidia finančné a obchodné údaje, vlastníci len svoje vlastné objekty. Medzi rôznymi prevádzkami sú údaje technicky oddelené (pravidlá prístupu vzťahujúce sa na nájomcu priamo v databáze).",
      ],
    },
    {
      heading: "Spracovanie platieb",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Platby kartou a výplaty prebiehajú prostredníctvom Stripe Payments Europe, Limited, Írsko. Spoločnosti Stripe sa pritom poskytujú údaje potrebné na platbu (suma, mena, platobný prostriedok, meno, e-mailová adresa, referencia rezervácie) a v prípade kont našich zákazníkov zákonom predpísané identifikačné údaje (majiteľ, koneční užívatelia výhod, údaje z dokladu totožnosti, bankové spojenie). Úplné údaje o karte sa do našich systémov nedostanú. Právnymi základmi sú čl. 6 ods. 1 písm. b) GDPR a v prípade identifikačných povinností a povinností v oblasti boja proti praniu špinavých peňazí čl. 6 ods. 1 písm. c) GDPR. Podrobnosti upravujú [zásady ochrany osobných údajov spoločnosti Stripe](https://stripe.com/privacy).",
            "Platobné odkazy na doplnkové služby: ak prevádzka vyúčtuje svojmu hosťovi doplnkovú službu (napr. upratovanie alebo pranie) prostredníctvom platobného odkazu, tento odkaz vedie na platobnú stránku prevádzkovanú spoločnosťou Stripe. Spoločnosti Stripe na to poskytneme označenie služby, sumu, menu a internú referenciu na rezerváciu a prevádzku; logo prevádzky sa prenesie do jej konta Stripe, aby stránka zobrazovala jej značku. Na samotnej platobnej stránke zhromažďuje Stripe platobné údaje a údaje o zariadení hosťa vo vlastnej zodpovednosti. K nám sa vracia len stav platby, suma, zadržané sumy a identifikátory platby — žiadne údaje o karte.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Ak prevádzka ponúka PayPal ako spôsob platby, platobné údaje sa poskytujú spoločnosti PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxembursko. Platia [zásady ochrany osobných údajov spoločnosti PayPal](https://www.paypal.com/de/webapps/mpp/ua/privacy-full).",
          ],
        },
      ],
    },
    {
      heading: "Distribučné kanály a portály",
      paragraphs: [
        "Ak prevádzka predáva svoje objekty prostredníctvom portálov ako Booking.com, Airbnb alebo Expedia, vymieňajú sa dostupnosti, ceny, restrikcie a rezervačné údaje s príslušným portálom prostredníctvom nášho poskytovateľa prepojenia Channex.io Ltd, Spojené kráľovstvo. Z tohto smeru dostávame rezervačné údaje a údaje hostí z portálu.",
        "Pre príslušný portál platia jeho vlastné ustanovenia o ochrane údajov; v tomto rozsahu je portál samostatným prevádzkovateľom. Právnym základom poskytnutia je čl. 6 ods. 1 písm. b) GDPR v spojení s pokynom prevádzky.",
      ],
    },
    {
      heading: "Komunikácia",
      unterpunkte: [
        {
          titel: "E-mail",
          paragraphs: [
            "E-maily v rámci používania (potvrdenia rezervácií, systémové správy, podpora, potvrdzovacie a pozývacie odkazy) posielame a prijímame prostredníctvom vlastného mailového servera, ktorý prevádzkujeme sami. Pre tieto správy nie je zapojená žiadna externá odosielacia služba.",
          ],
        },
        {
          titel: "Newsletter a predregistrácia",
          paragraphs: [
            "Na našej webovej stránke sa môžete zapísať na novinky o myNextDays (predregistrácia/newsletter). Spracúvajú sa pritom vaša e-mailová adresa, jazyk a miesto, na ktorom ste sa zapísali.",
            "Prihlásenie prebieha postupom double opt-in: po zapísaní dostanete e-mail s potvrdzovacím odkazom; prihlásenie je účinné až po kliknutí na tento odkaz. Na preukázanie súhlasu uchovávame čas prihlásenia a potvrdenia, použitú IP adresu, identifikáciu prehliadača, ako aj text, s ktorým ste súhlasili. Tieto údaje slúžia výlučne na preukázanie podľa čl. 7 ods. 1 GDPR a nevyhodnocujú sa na reklamné účely.",
            "Právnym základom je váš súhlas podľa čl. 6 ods. 1 písm. a) GDPR; uchovávanie dôkazu opierame o čl. 6 ods. 1 písm. c) v spojení s čl. 7 ods. 1 GDPR. Súhlas môžete kedykoľvek odvolať s účinnosťou do budúcnosti — prostredníctvom odhlasovacieho odkazu v každom e-maile newslettera alebo bez formalít e-mailom zaslaným nám. Odvolanie sa nedotýka zákonnosti spracúvania vykonaného do tohto okamihu.",
            "Na správu a odosielanie newsletterov využívame ako sprostredkovateľa Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Francúzsko; nemecká pobočka: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin). Poskytujú sa vaša e-mailová adresa a uvedené doplňujúce údaje (jazyk, zdroj). Údaje sa spracúvajú na serveroch v Európskej únii (Francúzsko a Nemecko); so spoločnosťou Brevo je uzavretá zmluva o spracúvaní osobných údajov podľa čl. 28 GDPR. Platia [zásady ochrany osobných údajov spoločnosti Brevo](https://www.brevo.com/legal/privacypolicy/).",
            "Keď posielame newsletter, Brevo pre nás meria, či bola správa otvorená a či sa kliklo na odkazy v nej obsiahnuté. Toto meranie nám pomáha prispôsobovať obsah a frekvenciu; je súčasťou súhlasu a končí vaším odhlásením. K spájaniu s inými zdrojmi údajov ani k profilovaniu nedochádza.",
            "Kým potvrdenie chýba, na vašu adresu neposielame nič a neposkytujeme ju spoločnosti Brevo; nepotvrdený zápis stráca platnosť po siedmich dňoch. Po odhlásení adresu zablokujeme pre odosielanie a dôkaz o súhlase a odhlásení uchovávame tak dlho, ako z neho možno uplatňovať nároky; na požiadanie ho úplne vymažeme.",
          ],
        },
        {
          titel: "Správy na platforme",
          paragraphs: [
            "Správy medzi hosťom a prevádzkou sa uchovávajú na platforme, aby obe strany mohli nahliadať do histórie. Ak prevádzka zablokuje hosťa, kanál správ sa uzavrie; existujúce správy zostávajú zachované pre možnosť spätného overenia.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Ak prevádzka používa prepojenie s WhatsApp, obsahy správ a telefónne čísla zúčastnených sa poskytujú prostredníctvom WhatsApp Business Platform spoločnosti Meta Platforms Ireland Limited. O používaní tejto funkcie rozhoduje prevádzka; bez aktivácie nedochádza k žiadnemu poskytnutiu.",
          ],
        },
      ],
    },
    {
      heading: "Automatizované funkcie a umelá inteligencia",
      paragraphs: [
        "Na funkcie opísané v tejto časti sa popri GDPR vzťahuje nariadenie (EÚ) 2024/1689 (akt o umelej inteligencii, „AI Act“), ktorého povinnosti transparentnosti podľa čl. 50 sa uplatňujú od 2. augusta 2026.",
      ],
      unterpunkte: [
        {
          titel: "Návrhy odpovedí",
          paragraphs: [
            "Na návrhy odpovedí v doručenej pošte správ používame — ak je funkcia pre prevádzku aktivovaná — ponuku jazykových modelov spoločnosti Groq, Inc., USA. Príslušný kontext správy sa pritom poskytne tejto službe. Návrhy sa neodosielajú automaticky; o odoslaní rozhoduje vždy človek. K automatizovanému rozhodovaniu s právnym účinkom v zmysle čl. 22 GDPR nedochádza.",
            "Nejde teda o systém umelej inteligencie, ktorý v zmysle čl. 50 ods. 1 aktu o umelej inteligencii priamo interaguje s fyzickými osobami: povinnosť predpokladá PRIAMU interakciu, pri ktorej umelá inteligencia sama komunikuje s osobou a nie prostredníctvom ľudského prostredníka. Tu funkcia navrhne prevádzke text, ktorý zamestnanec skontroluje, môže zmeniť a sám odošle — zamestnanec je týmto prostredníkom, hosť si dopisuje s prevádzkou a nie s chatbotom. Automaticky odpovedajúci asistent nie je v prevádzke. Podľa nášho posúdenia funkcia nenaplňuje ani žiadnu zo skutkových podstát vysokorizikovej umelej inteligencie podľa prílohy III k aktu o umelej inteligencii.",
            "Správy hosťom navyše nie sú „textom o veciach verejného záujmu“ v zmysle čl. 50 ods. 4 aktu o umelej inteligencii: nezverejňujú sa, ale posielajú sa individuálne určitej osobe a týkajú sa priebehu pobytu. Nezávisle od toho tu platí ľudská kontrola zo strany odosielajúceho zamestnanca.",
            "Ak by sa v budúcnosti ponúkala funkcia, ktorá samostatne — bez ľudského schválenia — odpovedá hosťom, hosť bude na začiatku dialógu viditeľne upozornený, že píše so systémom umelej inteligencie. Bez tohto upozornenia sa takáto funkcia neposkytne.",
          ],
        },
        {
          titel: "Produktový poradca na tejto webovej stránke",
          paragraphs: [
            "Na tejto webovej stránke odpovedá produktový poradca s podporou AI na otázky týkajúce sa nášho softvéru. Využíva výhradne verejne dostupné obsahy tejto webovej stránky (články pomoci, popisy funkcií, často kladené otázky, právne texty) a aktuálne ceny z našej fakturácie. Zákaznícke údaje, rezervácie ani údaje hostí mu nie sú k dispozícii.",
            "Na rozdiel od návrhov odpovedí v doručenej pošte, tento poradca odpovedá OKAMŽITE a bez ľudského schválenia. Je to teda systém AI v zmysle čl. 50 ods. 1 nariadenia o AI, ktorý priamo interaguje s fyzickými osobami. Preto budete na začiatku dialógu viditeľne upozornení, že odpovede pochádzajú od asistenta AI a môžu obsahovať chyby.",
            "Spracováva sa vaša otázka a zvolený jazyk. Oboje sa prenáša na zodpovedanie do Google Cloud (Vertex AI) v regióne europe-west4 (Holandsko); spracovanie mimo EÚ sa neuskutočňuje. Otázky trvalo neukladáme a nepoužívame ich na trénovanie modelov AI. Právnym základom je náš oprávnený záujem o rýchle poskytovanie informácií pre záujemcov (čl. 6 ods. 1 písm. f GDPR).",
            "Ak poradca nedokáže odpovedať na otázku z dostupných obsahov, ponúkne presmerovanie na našu podporu. Až potom – a len ak vyplníte formulár – zhromažďujeme meno, e-mailovú adresu a voliteľne vaše telefónne číslo; tieto údaje spracovávame podľa pravidiel v sekcii „Komunikácia“.",
          ],
        },
        {
          titel: "Úlohy podľa aktu o umelej inteligencii",
          paragraphs: [
            "V súvislosti s funkciami umelej inteligencie zabudovanými do produktu sme nasadzujúcim subjektom v zmysle čl. 3 bodu 4 aktu o umelej inteligencii; poskytovateľmi jazykových modelov, ktoré sú ich základom, sú príslušní poskytovatelia modelov. Ak prevádzka používa tieto funkcie v rámci svojej profesijnej činnosti, je za ne sama nasadzujúcim subjektom a vzťahuje sa na ňu povinnosť gramotnosti v oblasti umelej inteligencie podľa čl. 4 aktu o umelej inteligencii, ktorá platí od 2. februára 2025 nezávisle od veľkosti podniku. Od 27. júla 2026 platí v znení nariadenia (EÚ) 2026/1744: poskytovatelia a nasadzujúce subjekty prijímajú opatrenia na podporu rozvoja gramotnosti svojho personálu v oblasti umelej inteligencie; určitá úroveň sa pritom výslovne garantovať nemusí. Podporujeme upozorneniami v aplikácii a v našom centre pomoci; školenie vlastných zamestnancov zostáva úlohou prevádzky.",
            "Ak prevádzka prepojí svoje konto s vlastným asistentom umelej inteligencie (pozri nasledujúci bod), je aj v tomto smere nasadzujúcim subjektom v zmysle aktu o umelej inteligencii — rozhoduje o použití a formuluje dopyty. Samotné rozhranie nie je systémom umelej inteligencie: číta údaje z databázy a vydáva ich bez toho, aby vyvodzovalo závery; odôvodnenie 12 aktu o umelej inteligencii takéto systémy výslovne odlišuje od umelej inteligencie.",
          ],
        },
        {
          titel: "Prepojenie s vlastným asistentom umelej inteligencie",
          paragraphs: [
            "Prevádzka môže svoje konto prostredníctvom rozhrania prepojiť s asistentom umelej inteligencie, ktorého si sama vybrala a s ktorým má vlastnú zmluvu — napríklad Claude od spoločnosti Anthropic PBC, USA. Ak je takéto prepojenie udelené, môže asistent na dopyt prevádzky čítať: obsadenosť, dostupnosť a denné ceny; rezervácie s menom hosťa, obdobím pobytu, objektom, rezervačným kanálom, stavom, ako aj sumou a menou, pokiaľ úloha dopytujúceho konta smie vidieť sumy; a prehľad konverzácií v doručenej pošte. Bez udeleného prepojenia nedochádza k žiadnemu poskytnutiu.",
            "Neposkytujú sa pritom e-mailová adresa a telefónne číslo hostí, údaje o karte, bankové spojenia a platobné doklady, prístupové kódy a dokumentácia objektov. Poznámky k rezervácii a obsah správ hostí sú štandardne vyňaté, pretože môžu obsahovať údaje o zdraví alebo iné osobitné kategórie podľa čl. 9 GDPR; prevádzka ich musí pri udeľovaní prepojenia výslovne a osobitne uvoľniť.",
            "Prepojenie môže udeliť len konto s úlohou „administrátor“, nie každé konto s prístupom. Každé vyvolanie sa protokoluje a prevádzka doň môže nahliadnuť v časti „Konto → Prepojenia“; prepojenie tam môže kedykoľvek prerušiť a prístup tým okamžite končí.",
            "Právne je toto poskytnutie pokynom prevádzky adresovaným nám (čl. 28 ods. 3 písm. a) GDPR). Poskytovateľ asistenta nie je naším subdodávateľským sprostredkovateľom — nedávame mu pokyny ani ho nepoverujeme; údaje spracúva na základe zmluvy, ktorú s ním prevádzka uzavrela sama. Za právny základ tohto spracúvania, za informovanie svojich hostí a za záruky prenosu do tretej krajiny preto zodpovedá prevádzka.",
          ],
        },
        {
          titel: "Preklady",
          paragraphs: [
            "Texty objektov a obsahové texty možno prekladať prostredníctvom Cloud Translation API spoločnosti Google Ireland Limited. Poskytujú sa pritom texty, ktoré sa majú preložiť; osobné údaje len v rozsahu, v akom sú v týchto textoch obsiahnuté.",
          ],
        },
        {
          titel: "Odporúčania cien",
          paragraphs: [
            "Na odporúčania cien pristupujeme k trhovým, meteorologickým a kurzovým údajom externých zdrojov. Tieto dopyty neobsahujú osobné údaje, ale len miesto, obdobie a znaky objektu.",
          ],
        },
      ],
    },
    {
      heading: "Webové stránky a domény našich zákazníkov",
      paragraphs: [
        "Ak si prevádzka vytvorí prostredníctvom stavebnice vlastnú webovú stránku s vlastnou doménou, spravujeme potrebné záznamy DNS prostredníctvom Cloudflare, Inc. Poskytujú sa pritom údaje o doméne a konfigurácii; údaje návštevníkov zákazníckej webovej stránky spracúvame tak, ako je opísané v týchto zásadách.",
        "Za obsahy, tiráž a informácie o ochrane údajov na zákazníckej webovej stránke zodpovedá príslušná prevádzka.",
      ],
    },
    {
      heading: "Partnerský program",
      paragraphs: [
        "Prevádzkujeme partnerský program, prostredníctvom ktorého partneri (influenceri, konzultanti, agentúry, zákazníci) odporúčajú podniky myNextDays a za to dostávajú províziu. Pritom spracúvame údaje partnerov a – v malom rozsahu – odporúčaných podnikov.",
      ],
      unterpunkte: [
        {
          titel: "Údaje partnerov",
          paragraphs: [
            "Pri prihláške spracúvame meno, firmu, právnu formu, krajinu, e-mailovú adresu, jazyk, účty sociálnych médií (platforma, adresa, handle, samostatne uvedený dosah), identifikačné číslo pre DPH (kontrola prostredníctvom systému EÚ VIES), údaje o výplate (IBAN, adresa Wise alebo PayPal), ako aj súhlas s podmienkami účasti s verziou a časom. Právnym základom je plnenie partnerskej zmluvy (čl. 6 ods. 1 písm. b GDPR); pre dobropisy a uchovávanie platia daňové a obchodné povinnosti (čl. 6 ods. 1 písm. c GDPR).",
            "Ak partner vedie tím, vidí od svojich tímových partnerov meno alebo firmu, hodnosť, počet platiacich zákazníkov a z toho vyplývajúcu tímovú províziu. Správy medzi sponzorom a tímovým partnerom sa ukladajú na platforme, aby obaja videli históriu.",
          ],
        },
        {
          titel: "Kliknutia na partnerské odkazy",
          paragraphs: [
            "Ak návštevník otvorí partnerský odkaz (mynextdays.com/p/CODE), uložíme kód, čas, otvorenú stránku, odkazujúcu stránku a prípadné parametre kampane, ako aj IP adresu a identifikáciu prehliadača výlučne ako skrátené kontrolné súčty (hash) – na detekciu zneužitia (hromadenie), nie na opätovné rozpoznanie. Sledovací súbor cookie sa nenastavuje. Údaje o kliknutiach vymažeme po 90 dňoch. Právnym základom je náš oprávnený záujem na zabezpečení programu proti podvodom (čl. 6 ods. 1 písm. f GDPR).",
          ],
        },
        {
          titel: "Prepojené účty sociálnych médií a príspevky",
          paragraphs: [
            "Partneri môžu dobrovoľne prepojiť svoje účty na YouTube (Google), Instagram a Facebook (Meta), ako aj TikTok s partnerským panelom. Pritom udelia príslušnej platforme povolenie na čítanie (OAuth); nič do týchto účtov nepíšeme. Ukladáme identifikátor a názov účtu, šifrovaný prístupový token, čas prepojenia a denne jednu metrickú hodnotu pre každý účet: počet sledovateľov alebo odberateľov, zobrazenia za posledných 28 dní, mieru interakcie a počet príspevkov, vždy s časom odpovede platformy. Pre príspevky, ktoré partner vytvorí v paneli (názov, platforma, adresa, dátum zverejnenia), dodatočne ukladáme zobrazenia, lajky, komentáre, zdieľania a uloženia z platformy.",
            "Účelom je overenie dosahu uvedeného partnerom a priradenie kliknutí a zákazníkov k jednotlivým príspevkom; neoverené údaje majú pri schvaľovaní nižšiu váhu. Náznaky nezrovnalostí (napríklad skok v počte sledovateľov bez zodpovedajúcich zobrazení) slúžia výlučne na manuálnu kontrolu nami a nevedú k žiadnemu automatizovanému rozhodnutiu. Právnym základom je súhlas partnera (čl. 6 ods. 1 písm. a GDPR), ktorý udeľuje pripojením a môže ho kedykoľvek odvolať na hlavnom paneli pod „Odpojiť“. Pri odpojení okamžite vymažeme prístupový token, uložené namerané hodnoty zostanú ako história a budú vymazané spolu s partnerským účtom. Používame výlučne oficiálne rozhrania platforiem; pre spracovanie spoločnosťami Google, Meta a TikTok platia ich vlastné zásady ochrany osobných údajov.",
          ],
        },
        {
          titel: "Odporúčané prevádzky",
          paragraphs: [
            "Ak sa prevádzka zaregistruje pomocou partnerského kódu, uložíme priradenie prevádzky k partnerovi, ako aj čas, spôsob (odkaz alebo kód) a stav. Partner vidí prevádzku výlučne pseudonymne (poradové číslo, krajina, stav, sumy) – nikdy nie meno, e-mailovú adresu alebo údaje o rezervácii. Iba ak prevádzka pri registrácii výslovne súhlasí, môže ju partner kontaktovať prostredníctvom platformy. Pre vyúčtovanie provízií spracúvame čisté sumy predplatného z uhradených faktúr prevádzky; právnym základom je plnenie partnerskej zmluvy a zmluvy o používaní (čl. 6 ods. 1 písm. b GDPR).",
          ],
        },
      ],
    },
    {
      heading: "Hosting a ukladanie",
      paragraphs: [
        "Platforma, databáza, médiá a mailový server bežia na serveroch spoločnosti Hetzner Online GmbH, Nemecko, v dátovom centre Helsinki (Finsko) — teda v rámci Európskej únie. So spoločnosťou Hetzner je uzavretá zmluva o spracúvaní osobných údajov.",
        "Záložné kópie sa vytvárajú zašifrované a zašifrované sa uchovávajú u poskytovateľa úložného priestoru v EÚ.",
      ],
    },
    {
      heading: "Príjemcovia v prehľade",
      paragraphs: [
        "Okrem uvedených poskytovateľov služieb poskytujeme osobné údaje ďalej len vtedy, ak sme na to zo zákona povinní (napr. daňové orgány, orgány činné v trestnom konaní), alebo ak to požadujete vy, resp. zodpovedná prevádzka.",
      ],
      list: [
        "Hetzner Online GmbH (Nemecko/Finsko) — hosting, databáza, médiá, mailový server",
        "Stripe Payments Europe, Limited (Írsko) — platby, výplaty, overenie totožnosti",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxembursko) — platby, ak je aktivovaný",
        "Channex.io Ltd (Spojené kráľovstvo) — prepojenie s rezervačnými portálmi",
        "Meta Platforms Ireland Limited (Írsko) — správy WhatsApp, ak sú aktivované",
        "Sendinblue SAS / Brevo (Francúzsko, Nemecko) — správa a odosielanie newslettera, len pri súhlase",
        "Google Ireland Limited (Írsko) — preklady; ochrana kontaktného formulára pred spamom (reCAPTCHA Enterprise), len pri súhlase; prihlásenie pomocou Google, ak sa používa; Meranie dosahu (Google Analytics 4), len so súhlasom",
        "Groq, Inc. (USA) — návrhy odpovedí, ak sú aktivované",
        "Cloudflare, Inc. (USA) — správa DNS pre zákaznícke domény",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "V tomto zozname nie sú služby, ktoré si prevádzka sama dohodne s tretou stranou a prostredníctvom rozhrania prepojí so svojím kontom — napríklad asistent umelej inteligencie ako Claude od spoločnosti Anthropic PBC, USA. Nie sú to poskytovatelia služieb, ktorých sme poverili my, ale príjemcovia na pokyn príslušnej prevádzky; bez jej prepojenia tam netečú žiadne údaje. Anthropic nie je podľa oficiálneho zoznamu účastníkov Ministerstva obchodu USA certifikovaná v rámci EU-US Data Privacy Framework; prenos sa preto opiera o štandardné zmluvné klauzuly, za ktoré zodpovedá príslušná prevádzka ako prevádzkovateľ.",
          ],
        },
      ],
    },
    {
      heading: "Prenos do tretích krajín",
      paragraphs: [
        "Spracúvanie sa v zásade uskutočňuje v rámci EÚ. Pri vyššie uvedených službách so sídlom mimo EÚ môže dôjsť k prenosu do tretej krajiny.",
        "Pri Groq, Inc. a Cloudflare, Inc. (USA) opierame prenos o štandardné zmluvné klauzuly Európskej komisie podľa čl. 46 ods. 2 písm. c) GDPR, pokiaľ sa príjemca nemôže odvolávať na rozhodnutie o primeranosti (EU-US Data Privacy Framework).",
        "Zmluvným partnerom pri spracovaní platieb je Stripe Payments Europe, Limited (Írsko). Pokiaľ Stripe pritom využíva Stripe, LLC (USA), je táto certifikovaná v rámci EU-US Data Privacy Framework; prenos sa v tomto rozsahu opiera o rozhodnutie Európskej komisie o primeranosti podľa čl. 45 GDPR. Dopĺňajúco platia štandardné zmluvné klauzuly zo [zmluvy o spracúvaní osobných údajov spoločnosti Stripe](https://stripe.com/legal/dpa).",
        "Pri Channex.io Ltd (Spojené kráľovstvo) platí rozhodnutie Európskej komisie o primeranosti pre Spojené kráľovstvo; ak zanikne, uplatnia sa štandardné zmluvné klauzuly.",
      ],
    },
    {
      heading: "Prístup orgánov tretích štátov (US CLOUD Act)",
      paragraphs: [
        "Poskytovatelia podliehajúci jurisdikcii Spojených štátov môžu byť podľa amerického zákona CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018) povinní vydať údaje orgánom USA — a to aj vtedy, keď sa tieto údaje nachádzajú na serveroch v Európskej únii. Takýto prístup môže byť v rozpore s GDPR a poskytovateľovi môže byť právne zabránené informovať o ňom nás alebo vás. Ani rozhodnutie o primeranosti k EU-US Data Privacy Framework, ani štandardné zmluvné klauzuly toto riziko nevylučujú.",
        "Toto riziko obmedzujeme tým, že nosné systémy — platforma, databáza, médiá, mailový server a záložné kópie — sú prevádzkované u európskych poskytovateľov v rámci EÚ, kde jurisdikcia USA neplatí.",
      ],
      unterpunkte: [
        {
          titel: "Dotknuté služby",
          paragraphs: [
            "Jurisdikcia USA prichádza do úvahy výlučne pri týchto jasne vymedzených doplnkových službách:",
          ],
          list: [
            "Groq, Inc. (USA) — návrhy odpovedí v doručenej pošte správ, len ak prevádzka funkciu aktivuje. Poskytuje sa príslušný kontext správy.",
            "Cloudflare, Inc. (USA) — správa DNS pre zákaznícke domény. Poskytujú sa údaje o doméne a konfigurácii, žiadne údaje hostí.",
            "Google LLC (USA) — pri prihlásení cez Google, pri prekladoch a pri meraní dosahu (Google Analytics 4, len so súhlasom); zmluvným partnerom je vždy Google Ireland Limited, prístup materskej spoločnosti v USA však nie je vylúčený.",
          ],
        },
        {
          titel: "Možnosť vyhnutia sa",
          paragraphs: [
            "Používanie platformy je možné aj bez týchto služieb: návrhy odpovedí sa dajú vypnúť, správa DNS sa týka len zákazníkov s vlastnou doménou a prihlásenie pomocou Google je dobrovoľnou alternatívou k prihláseniu pomocou e-mailu a hesla.",
          ],
        },
        {
          titel: "Odlíšenie od európskeho práva",
          paragraphs: [
            "CLOUD Act je americké právo, nie právo Európskej únie. Treba ho odlišovať od EU Data Act (nariadenie (EÚ) 2023/2854), ktoré upravuje zmenu poskytovateľa a prenosnosť pri službách spracúvania údajov, ako aj od Cloud and AI Development Act, ktorý sa ku dňu vyhotovenia týchto zásad nachádza v európskom legislatívnom procese.",
          ],
        },
      ],
    },
    {
      heading: "Doba uchovávania",
      list: [
        "Údaje konta: po dobu trvania obchodného vzťahu; potom vymazanie, ak neexistuje povinnosť uchovávania.",
        "Rezervačné, fakturačné a platobné údaje: podľa dánskeho zákona o účtovníctve päť rokov od konca účtovného obdobia, ku ktorému sa majú priradiť; u zákazníkov so sídlom v Nemecku môžu platiť dlhšie lehoty podľa obchodného a daňového práva.",
        "Správy a údaje hostí na platforme: podľa pokynov zodpovednej prevádzky, najdlhšie do ich vymazania touto prevádzkou, resp. do ukončenia zmluvy.",
        "Newsletter: do odvolania súhlasu; nepotvrdené prihlásenia stratia platnosť po siedmich dňoch. Dôkaz o súhlase a odhlásení zostáva nad tento rámec zachovaný tak dlho, ako je potrebný ako dôkaz.",
        "Prihlasovacie protokoly a bezpečnostné udalosti: krátkodobo na rozpoznávanie útokov.",
        "Serverové protokolové súbory: len tak dlho, ako je to potrebné na prevádzku a bezpečnosť.",
        "Záložné kópie: rotujúco, kým ich nenahradia novšie záložné kópie.",
      ],
    },
    {
      heading: "Vaše práva",
      paragraphs: [
        "Máte právo na prístup (čl. 15), na opravu (čl. 16), na vymazanie (čl. 17), na obmedzenie spracúvania (čl. 18), na prenosnosť údajov (čl. 20) a na vznesenie námietky proti spracúvaniu na základe oprávnených záujmov (čl. 21 GDPR). Udelený súhlas môžete kedykoľvek odvolať s účinnosťou do budúcnosti.",
        `Obráťte sa na tento účel na [${ANBIETER.email}](mailto:${ANBIETER.email}). Ak sa vaše údaje týkajú používania platformy prevádzkou, postúpime vašu žiadosť zodpovednej prevádzke alebo ju podporíme pri jej vybavení.`,
        `Okrem toho môžete podať sťažnosť dozornému orgánu pre ochranu údajov — pre nás je príslušný ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Môžete sa obrátiť aj na dozorný orgán vo svojom mieste pobytu.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Nicht mit „Ihre Rechte" zusammenlegen.
      heading: "Vymazanie konta a údajov z aplikácie",
      paragraphs: [
        "O vymazanie svojho konta môžete kedykoľvek požiadať sami — v aplikácii v časti „Profil → Konto“ alebo prostredníctvom nášho formulára na webe:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "Cesta na webe funguje zámerne aj vtedy, keď už aplikáciu nemáte nainštalovanú alebo sa už nemôžete prihlásiť. Na ochranu pred zneužitím sa to deje v dvoch krokoch: zadáte e-mailovú adresu svojho konta a presne na túto adresu dostanete potvrdzovací odkaz. Žiadosť je platná až po jeho vyvolaní — samotná zadaná adresa nemá žiadny účinok. Žiadosť vybavíme do 30 dní a odpovieme e-mailom.",
        "S kontom vymažeme vaše prístupové údaje, váš profil, vaše údaje o objektoch a kalendári, ako aj vaše správy. Nevymazané zostanú doklady, na ktoré sa vzťahuje zákonná povinnosť uchovávania — najmä faktúry a rezervačné doklady zúčtovaných období (povinnosť vedenia účtovníctva podľa dánskeho práva, zvyčajne päť rokov). Tieto doklady sa na dobu lehoty zablokujú, teda uchovávajú výlučne na splnenie tejto povinnosti, a potom sa vymažú.",
      ],
    },
    {
      heading: "Bezpečnosť spracúvania",
      paragraphs: [
        "Spracúvanie zabezpečujeme technickými a organizačnými opatreniami podľa čl. 32 GDPR, najmä: priebežným šifrovaním prenosu (TLS), pravidlami prístupu vzťahujúcimi sa na nájomcu priamo v databáze, oprávneniami založenými na úlohách s oddelením finančných a servisných údajov, voliteľným dvojfaktorovým overením, obmedzením počtu prihlasovacích pokusov, zašifrovanými záložnými kópiami s pravidelným testom obnovy, ako aj protokolovaním bezpečnostne relevantných udalostí.",
      ],
    },
    {
      heading: "Povinnosť poskytnutia údajov",
      paragraphs: [
        "Údaje, ktoré potrebujeme na uzavretie zmluvy, vyúčtovanie a zákonné povinnosti, sú nevyhnutné — bez nich nemôžeme platformu poskytnúť. Všetky ostatné údaje sú dobrovoľné.",
      ],
    },
    {
      heading: "Zmeny týchto zásad",
      paragraphs: [
        "Tieto zásady prispôsobujeme, keď sa zmení spracúvanie, využívaní poskytovatelia služieb alebo právny stav. Platí vždy verzia zverejnená tu; dátum uvedený vyššie udáva stav.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte Export
// bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default datenschutz;
