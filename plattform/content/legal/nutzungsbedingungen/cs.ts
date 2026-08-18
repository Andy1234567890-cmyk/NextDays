import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Podmínky použití pro hosty",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "Tyto podmínky použití upravují užívání rezervačního portálu myBestDays (dále jen „platforma“) cestujícími a osobami provádějícími rezervaci (dále jen „host“ nebo „vy“).",
    `Platformu provozuje ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dánsko, CVR č. ${ANBIETER.cvr} (dále jen „myBestDays“ nebo „my“). myBestDays je ochranná známka této společnosti, nikoli samostatná právnická osoba. Úplné údaje o poskytovateli najdete v [Právních informacích](https://mybestdays.dk/rechtliches/impressum).`,
    "Používáním platformy tyto podmínky přijímáte. Přečtěte si je prosím pozorně.",
  ],
  summary: {
    heading: "Shrnutí těchto podmínek",
    paragraphs: [
      "myBestDays je tržiště. Poskytujeme platformu, na níž poskytovatelé nabízejí své ubytování — samotné ubytování neposkytujeme my. Smlouva o ubytování vzniká mezi vámi a poskytovatelem, nikoli s námi.",
      "To, co vidíte v inzerátu, pochází od poskytovatele: popis, fotografie, vybavení, cena, storno podmínky a domovní řád. Inzeráty kontrolujeme, ale nemůžeme ručit za každý údaj poskytovatele.",
      "Cena, kterou vidíte při dokončení rezervace, je celková cena za rezervované služby. Částky splatné až na místě (například pobytový poplatek nebo kauce) uvádíme předem zvlášť.",
      "Pokud se něco nezdaří, obraťte se nejprve na nás. Oddíl A15 popisuje, jak podat stížnost a jaké cesty vám poté zůstávají otevřené.",
      "Toto shrnutí podmínky vysvětluje, ale nenahrazuje je. Rozhodující je úplné znění.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Všechny rezervace přes myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Definice",
          paragraphs: [
            "Pojmy použité v těchto podmínkách jsou vysvětleny ve slovníčku na konci tohoto dokumentu. Nejdůležitější jsou:",
          ],
          list: [
            "„Platforma“ — internetové stránky, mobilní aplikace a všechny další přístupy, jejichž prostřednictvím myBestDays zobrazuje ubytování a zprostředkovává rezervace.",
            "„Poskytovatel“ — fyzická nebo právnická osoba, která nabízí ubytování prostřednictvím platformy (hostitel, pronajímatel, agentura, hotelový nebo ubytovací provoz).",
            "„Ubytování“ — ubytovací služba nabízená poskytovatelem, tedy rekreační objekt nebo jednotka určitého typu pokoje či objektu.",
            "„Rezervace“ — rezervace ubytování na určité období uzavřená prostřednictvím platformy.",
            "„Celková cena“ — částka zobrazená při dokončení rezervace včetně všech daní, poplatků a příplatků vyúčtovaných prostřednictvím platformy.",
            "„Náklady na místě“ — částky, které se nevyúčtovávají prostřednictvím platformy, ale jsou splatné poskytovateli (například pobytový poplatek, kauce, závěrečný úklid dle volby poskytovatele).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. O těchto podmínkách",
          paragraphs: [
            "Tyto podmínky platí pro jakékoli užívání platformy bez ohledu na to, zda si založíte účet a zda dojde k rezervaci.",
            "Oddíl A platí pro všechny rezervace. Oddíl B obsahuje doplňující pravidla pro ubytování. V případě rozporu má přednost oddíl B.",
            "Na samotnou ubytovací službu se dále vztahují podmínky příslušného poskytovatele (zejména domovní řád a storno podmínky) uvedené v inzerátu. Tyto podmínky poskytovatele platí vedle našich; nemohou vyloučit naše podmínky, pokud jde o váš vztah k nám.",
            "Tyto podmínky jsou k dispozici ve všech 24 úředních jazycích Evropské unie. Při rozdílech mezi jazykovými verzemi je rozhodující německé znění, nestanoví-li kogentní právo státu vašeho bydliště jinak.",
            "Kogentní spotřebitelská práva podle práva státu vašeho bydliště nejsou těmito podmínkami dotčena.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. O myBestDays",
          paragraphs: [
            "myBestDays je online tržiště pro rekreační ubytování a ubytovací provozy. Provozujeme platformu, na níž poskytovatelé prezentují své ubytování a hosté je mohou rezervovat.",
            "Jsme zprostředkovatel, nikoli ubytovatel. Nevlastníme, neprovozujeme, nespravujeme ani nekontrolujeme žádné z ubytování nabízených na platformě a nejsme smluvní stranou smlouvy o ubytování.",
            "myBestDays je zprostředkovatelskou službou ve smyslu nařízení (EU) 2022/2065 o digitálních službách. Naše údaje a postupy podle tohoto nařízení najdete pod [Nařízení o digitálních službách](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays není pořadatelem zájezdů. Nesestavujeme souborné služby pro cesty ve smyslu směrnice (EU) 2015/2302; ke spojeným cestovním službám viz A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Naše platforma",
          paragraphs: [
            "Obsah inzerátu — popis, fotografie, vybavení, limity obsazenosti, ceny, dostupnost, storno podmínky a domovní řád — pochází od příslušného poskytovatele. Ten odpovídá za jeho správnost a úplnost.",
            "Inzeráty kontrolujeme před zveřejněním a průběžně z hlediska zjevných porušení našich [Pravidel pro vhodný obsah](https://mybestdays.dk/rechtliches/inhaltsrichtlinien). Povinnost obecného dohledu nad veškerým obsahem neexistuje a podle článku 8 nařízení (EU) 2022/2065 by ani nebyla přípustná.",
            "Jak řadíme výsledky vyhledávání a které faktory pořadí určují, vysvětlujeme v [Ceny, řazení a doporučení](https://mybestdays.dk/rechtliches/preisangaben).",
            "Usilujeme o trvale dostupnou platformu, nedlužíme však nepřetržitou dostupnost. Údržba, poruchy a úpravy jsou možné.",
            "Překlady obsahu poskytovatelů mohou být strojové. Rozhodující je původní znění vložené poskytovatelem.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Naše hodnoty",
          paragraphs: [
            "Od hostů a poskytovatelů očekáváme uctivé jednání. Diskriminace z důvodu původu, barvy pleti, náboženství, světového názoru, pohlaví, genderové identity, sexuální orientace, zdravotního postižení, věku nebo srovnatelných znaků není na platformě tolerována — viz [Zásady nediskriminace](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Na chování během pobytu se vztahují [Základní pravidla pro hosty](https://mybestdays.dk/rechtliches/grundregeln-gaeste) a na poskytovatele [Kodex chování poskytovatelů](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Váš účet a užívání platformy",
          paragraphs: [
            "Pro rezervaci si můžete založit účet. Odpovídáte za důvěrnost svých přihlašovacích údajů a neprodleně nás uvědomíte, pokud máte podezření na neoprávněné použití.",
            "Platformu smíte užívat pouze tehdy, jste-li svéprávní a můžete-li platně uzavírat smlouvy.",
            "Vaše údaje při registraci a rezervaci musí být správné a úplné — zejména jméno, kontaktní údaje a počet cestujících. Poskytovatel tyto údaje potřebuje k poskytnutí ubytování a splnění svých ohlašovacích povinností.",
            "Zakázáno je zejména:",
          ],
          list: [
            "fiktivní rezervace, podvodné platby nebo použití cizích platebních prostředků bez oprávnění;",
            "automatizované vytěžování platformy (scraping, prohledávací roboti) nad rámec toho, co povoluje náš soubor robots.txt;",
            "jednání, které narušuje nebo přetěžuje platformu či její infrastrukturu anebo obchází její bezpečnostní opatření;",
            "vkládání protiprávního, urážlivého nebo zavádějícího obsahu do hodnocení, zpráv nebo údajů profilu;",
            "pokus vyřídit rezervaci mimo platformu poté, co kontakt vznikl jejím prostřednictvím — viz [Poplatky mimo platformu](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Ceny",
          paragraphs: [
            "Všechny ceny se zobrazují jako celková cena včetně daní a všech poplatků vyúčtovaných prostřednictvím platformy, jakmile jsou známy údaje o cestě (období a počet cestujících). Je-li některá složka splatná až na místě, uvádíme ji zvlášť před dokončením rezervace.",
            "Ceny se zobrazují v měně inzerátu. Je-li částka zobrazena navíc v jiné měně, jde o nezávazný orientační přepočet; vyúčtování probíhá v měně inzerátu, není-li při platbě uvedeno jinak.",
            "Ceny se mohou měnit až do dokončení rezervace, například proto, že je poskytovatel upraví nebo se změní dostupnost. Rozhodující je cena, která se vám zobrazí bezprostředně před závaznou rezervací a která je uvedena v potvrzení rezervace.",
            "Zjevné chyby v ceně (například částka chybná o řád) nezavazují nás ani poskytovatele. Zjistíme-li takovou chybu, neprodleně vás informujeme; rezervaci pak můžete bezplatně zrušit.",
            "Jak se skládají servisní poplatky, uvádíme v [Servisních poplatcích](https://mybestdays.dk/rechtliches/servicegebuehren). K daním a poplatkům viz [Daňové zásady](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Platba",
          paragraphs: [
            "Platby prostřednictvím platformy zpracovává poskytovatel platebních služeb Stripe. Platební údaje (například údaje o kartě) shromažďuje a zpracovává přímo Stripe; myBestDays neuchovává úplné údaje o kartách.",
            "Kdy je která částka splatná — záloha, doplatek nebo platba na místě — závisí na inzerátu a zobrazuje se před dokončením rezervace. Podrobnosti upravují [Platební podmínky](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Je-li v inzerátu uvedena kauce, může být předautorizována nebo stržena a v případě škody zcela či zčásti zadržena; rozhodující jsou údaje v inzerátu.",
            "Selže-li platba nebo je-li zpětně stržena, může být rezervace zrušena. Poskytovatel může nadále požadovat částky vzniklé podle svých storno podmínek.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Zásady",
          paragraphs: [
            "Vedle těchto podmínek platí následující zásady, které jsou součástí smlouvy mezi vámi a námi:",
          ],
          list: [
            "[Pravidla pro vhodný obsah](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Zásady hodnocení](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Zásady nediskriminace](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Základní pravidla pro hosty](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Storno podmínky](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Zásady přeubytování a vrácení peněz](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Zásady při závažných narušeních](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Zásady autorského práva](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Ochrana osobních údajů a cookies",
          paragraphs: [
            "Jak zpracováváme osobní údaje, uvádí [Zásady ochrany osobních údajů](https://mybestdays.dk/rechtliches/datenschutz). Které cookies a podobné technologie používáme, uvádí [Zásady používání cookies](https://mybestdays.dk/rechtliches/cookies).",
            "Pro rezervaci předáváme poskytovateli údaje, které potřebuje k poskytnutí ubytovací služby. Poskytovatel je v tomto rozsahu samostatným správcem; vztahují se na něj [Standardy ochrany osobních údajů pro hostitele](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Přístupnost",
          paragraphs: [
            "Stav přístupnosti platformy a způsob hlášení překážek popisuje [Prohlášení o přístupnosti](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Údaje o přístupnosti ubytování pocházejí od poskytovatele. Jste-li odkázáni na určité vlastnosti, vyjasněte je s poskytovatelem prostřednictvím zpráv před rezervací.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Hodnocení a obsah vytvářený uživateli",
          paragraphs: [
            "Po pobytu můžete napsat hodnocení. Hodnocení může podat pouze ten, kdo rezervoval prostřednictvím platformy a zahájil pobyt nebo jej zahájit mohl — tím zajišťujeme, že zveřejněná hodnocení pocházejí od skutečných hostů.",
            "Za hodnocení neplatíme, jejich obsah neměníme a hodnocení nepotlačujeme jen proto, že je záporné. Podrobnosti a důvody, pro které hodnocení odstraníme, uvádějí [Zásady hodnocení](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "Za obsah, který vkládáte — hodnocení, fotografie, zprávy, údaje profilu — nadále odpovídáte. Udělujete nám nevýhradní, místně i časově neomezené, bezúplatné právo tento obsah rozmnožovat, zpracovávat (například ořezávat, překládat) a zpřístupňovat veřejnosti v rámci provozu a propagace platformy. Svůj obsah můžete smazat; již uskutečněná užití v již zveřejněných souborech tím nejsou dotčena.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Zprávy a komunikace s poskytovatelem",
          paragraphs: [
            "Zprávy mezi vámi a poskytovatelem probíhají přes platformu. Zpravodajskou funkci poskytujeme, nejsme však odesílatelem ani příjemcem obsahu.",
            "Zprávy smíme automatizovaně kontrolovat z hlediska porušení těchto podmínek (například kontaktní údaje k obcházení platformy, podvodné vzorce, protiprávní obsah) a dotčené zprávy zadržet nebo odstranit. O odstranění vás informujeme s odůvodněním podle A17.",
            "Zprávy o vaší rezervaci (potvrzení, změny, informace k příjezdu) zasíláme na uvedenou e-mailovou adresu. Tyto zprávy jsou smluvní komunikací a nelze je odhlásit, dokud rezervace trvá. Reklamní zprávy dostáváte pouze tehdy, pokud jste udělili souhlas nebo to právo bez souhlasu umožňuje; kdykoli můžete vznést námitku.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Práva duševního vlastnictví",
          paragraphs: [
            "Platforma, její podoba, software, databáze, texty a ochranné známky jsou chráněny. Získáváte nevýhradní, nepřevoditelné právo užívat platformu k vyhledávání a rezervaci ubytování — nic více.",
            "Užívání našich ochranných známek a log upravují [Pravidla pro ochranné známky](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Domníváte-li se, že obsah na platformě porušuje vaše autorské právo, postupujte podle [Zásad autorského práva](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Co dělat, když se něco nezdaří",
          paragraphs: [
            "Týká-li se problém samotného ubytování, obraťte se nejprve na poskytovatele — prostřednictvím zpráv nebo na místě. Mnoho problémů se tak vyřeší nejrychleji.",
            "Nepostoupíte-li s poskytovatelem dál nebo týká-li se problém platformy, platby či vyřízení rezervace, obraťte se na nás. Jak nás zastihnete a jak vyřizujeme stížnosti, uvádí [Stížnosti a řešení sporů](https://mybestdays.dk/rechtliches/beschwerden).",
            "Mějte přitom po ruce: číslo rezervace, e-mailovou adresu rezervace, stručný popis problému s vaším přáním, jak máme pomoci, a příslušné doklady (fotografie, zprávy, účtenky).",
            "Není-li ubytování při příjezdu k dispozici nebo se podstatně liší od inzerátu, uplatní se [Zásady přeubytování a vrácení peněz](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Platforma Evropské komise pro řešení sporů online (platforma ODR) byla zrušena nařízením (EU) 2024/3228 a ukončila činnost; jako cesta již není k dispozici. Které orgány ji nahrazují, uvádí [Stížnosti a řešení sporů](https://mybestdays.dk/rechtliches/beschwerden).",
            "Přijali-li jsme opatření vůči vašemu obsahu nebo účtu, můžete vedle našeho interního stížnostního postupu využít subjekt mimosoudního řešení sporů certifikovaný podle článku 21 nařízení (EU) 2022/2065. Jeho rozhodnutí nás nezavazují.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Opatření proti nevhodnému chování",
          paragraphs: [
            "Porušíte-li tyto podmínky nebo některé ze zásad uvedených v A9, můžeme — odstupňovaně podle závažnosti, četnosti a dopadu porušení — odstranit obsah nebo omezit jeho viditelnost, zablokovat funkce, zrušit rezervace nebo dočasně či trvale zablokovat váš účet.",
            "Před opatřením posuzujeme jednotlivý případ. U zjevně protiprávního obsahu, při ohrožení osob nebo při podvodu můžeme jednat okamžitě.",
            "Každé opatření vám odůvodníme a uvedeme cestu ke stížnosti — viz A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Hlášení protiprávního obsahu a odůvodnění opatření",
          paragraphs: [
            "Kdokoli nám může nahlásit obsah, který považuje za protiprávní. Postup hlášení podle článku 16 nařízení (EU) 2022/2065, naše kontaktní místa a nakládání s hlášeními jsou popsány pod [Nařízení o digitálních službách](https://mybestdays.dk/rechtliches/dsa).",
            "Přijmeme-li opatření vůči obsahu, který jste vložili, nebo vůči vašemu účtu, obdržíte odůvodnění s uvedením důvodu, skutkového základu, právního základu nebo porušeného smluvního ustanovení a možností stížnosti.",
            "Proti každému opatření můžete do šesti měsíců bezplatně podat stížnost. Stížnosti vyřizují lidé, nikoli výhradně automatizované systémy.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Omezení odpovědnosti",
          paragraphs: [
            "Odpovídáme neomezeně za úmysl a hrubou nedbalost, za škody z újmy na životě, těle nebo zdraví a v rozsahu námi převzaté záruky. Nároky podle práva odpovědnosti za výrobek nejsou dotčeny.",
            "Ve zbytku je naše odpovědnost omezena na předvídatelnou škodu typicky vznikající z porušení povinností, na jejichž splnění se můžete spolehnout — a to pouze v rozsahu, v jakém rozhodné právo takové omezení připouští.",
            "Neodpovídáme za poskytnutí samotné ubytovací služby ani za chování poskytovatelů či jiných hostů. Smluvním partnerem ubytovací služby je poskytovatel.",
            "Neodpovídáme za správnost údajů vložených poskytovateli, pokud jsme je neznali a znát nemuseli. Dozvíme-li se o protiprávním údaji, jednáme neprodleně.",
            "Další odpovědnost je vyloučena. Kogentní zákonné nároky, zejména spotřebitelská práva, nejsou dotčeny.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Rozhodné právo a příslušnost soudů",
          paragraphs: [
            "Použije se dánské právo — provozovatel je usazen v Dánsku — s vyloučením Úmluvy OSN o smlouvách o mezinárodní koupi zboží. Kogentní předpisy na ochranu spotřebitele státu, v němž máte obvyklé bydliště, zůstávají podle článku 6 nařízení (ES) č. 593/2008 (Řím I) nedotčeny.",
            "Jako spotřebitel nás můžete žalovat u soudu svého bydliště nebo u soudu našeho sídla v Dánsku; my vás můžeme žalovat pouze u soudu vašeho bydliště (články 17 až 19 nařízení (EU) č. 1215/2012).",
            "Na smlouvu o ubytování se zpravidla použije právo státu, v němž se ubytování nachází; pro žaloby z nájmu nemovitosti jsou výlučně příslušné soudy tohoto státu.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Spojené cestovní služby",
          paragraphs: [
            "myBestDays zprostředkovává výhradně ubytovací služby. Nenabízíme lety, pronájem vozidel, přepravní služby, výlety ani atrakce a nesestavujeme souborné služby pro cesty ve smyslu směrnice (EU) 2015/2302.",
            "Pokud bychom v budoucnu zprostředkovávali další cestovní služby, informovali bychom vás před rezervací zákonem předepsaným standardním formulářem o tom, zda vzniká souborná služba pro cesty nebo spojená cestovní služba a jaká práva z toho pro vás plynou.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Trvání, blokace a ukončení",
          paragraphs: [
            "Smlouva o užívání platformy se uzavírá na dobu neurčitou. Svůj účet můžete kdykoli bez udání důvodu smazat; stávající rezervace tím nejsou dotčeny a vyřizují se podle podmínek příslušného poskytovatele.",
            "Smlouvu o užívání můžeme vypovědět s výpovědní dobou 14 dnů. Při závažném porušení těchto podmínek můžeme vypovědět bez výpovědní doby a účet zablokovat.",
            "Po ukončení vaše údaje vymažeme, nebrání-li tomu zákonná povinnost uchovávání nebo oprávněný zájem na jejich uchování; podrobnosti upravují [Zásady ochrany osobních údajů](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Změnová doložka",
          paragraphs: [
            "Tyto podmínky můžeme změnit, existuje-li k tomu věcný důvod — například změna právního stavu, judikatura nejvyšších soudů, nové nebo zrušené funkce platformy či doplnění mezer v úpravě.",
            "Změny oznamujeme nejméně 30 dnů před nabytím účinnosti v textové podobě. Nevznesete-li námitku do nabytí účinnosti, považují se změněné podmínky za přijaté; na tento následek v oznámení zvlášť upozorňujeme. Vznesete-li námitku, můžeme smlouvu o užívání vypovědět ke dni nabytí účinnosti.",
            "Na již uzavřené rezervace se použijí podmínky ve znění účinném v době rezervace.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Ubytování",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Rozsah tohoto oddílu",
          paragraphs: [
            "Tento oddíl platí pro rezervaci ubytování prostřednictvím platformy — rekreačních objektů i pokojů a jednotek ubytovacích provozů.",
            "Doplňuje oddíl A. V případě rozporu má přednost tento oddíl B.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Smluvní vztah",
          paragraphs: [
            "Smlouva o ubytování vzniká výhradně mezi vámi a poskytovatelem. myBestDays není smluvní stranou.",
            "Zobrazení ubytování na platformě je výzvou, abyste podali rezervační nabídku. Kliknutím na tlačítko rezervace zavazující k platbě podáváte závaznou nabídku.",
            "Smlouva vzniká potvrzením rezervace. Potvrzení rezervace zasíláme na vámi uvedenou e-mailovou adresu; uvádí poskytovatele, rezervovanou službu, období, celkovou cenu a storno podmínky.",
            "U ubytování s rezervací na dotaz vzniká smlouva až přijetím poskytovatelem. Do té doby může být váš platební prostředek předautorizován, nikoli však zatížen.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Co děláme my",
          paragraphs: [
            "Poskytujeme platformu, zobrazujeme inzeráty poskytovatelů, přijímáme vaši rezervaci, předáváme ji poskytovateli a zasíláme vám potvrzení rezervace.",
            "Zpracováváme platbu, pokud inzerát počítá s platbou přes platformu, a poskytujeme funkci zpráv mezi vámi a poskytovatelem.",
            "Ubytování neposkytujeme, neprovozujeme a neručíme za jeho stav. Nejsme vaším pořadatelem zájezdu.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Co musíte udělat vy",
          paragraphs: [
            "Před rezervací si prostudujte celý inzerát: vybavení, limit obsazenosti, časy příjezdu a odjezdu, domovní řád, storno podmínky a náklady splatné až na místě.",
            "Dodržte maximální obsazenost uvedenou v inzerátu. Dorazí-li více osob, než bylo rezervováno, může poskytovatel odmítnout ubytování nebo požadovat příplatek.",
            "Dodržujte domovní řád poskytovatele a [Základní pravidla pro hosty](https://mybestdays.dk/rechtliches/grundregeln-gaeste). S ubytováním zacházíte šetrně a odpovídáte za škody, které způsobíte vy nebo vaši spolucestující.",
            "Potřebuje-li poskytovatel nebo úřad údaje k přihlášení (například přihlašovací lístek, údaje z dokladu totožnosti, prohlášení k pobytovému poplatku), poskytněte je včas.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Ceny a platba",
          paragraphs: [
            "Celková cena zahrnuje cenu za ubytování na rezervované období a příplatky a poplatky uvedené v inzerátu, které se vyúčtovávají přes platformu.",
            "Na místě mohou vzniknout další částky — zejména pobytový poplatek nebo místní poplatky, kauce a doplňkové služby, které si objednáte až na místě. Tyto uvádíme jako náklady na místě před dokončením rezervace, pokud je poskytovatel uvedl.",
            "Počítá-li inzerát se zálohou, je doplatek splatný v termínu uvedeném v inzerátu. Nebude-li doplatek uhrazen, může poskytovatel podle svých storno podmínek od smlouvy odstoupit.",
            "Platby poskytovateli mimo platformu nepřijímáme a nemůžeme je dohledat; nespadají do našeho zpracování plateb — viz [Poplatky mimo platformu](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Změny, zrušení a vrácení peněz",
          paragraphs: [
            "Zda a za jakých podmínek lze rezervaci bezplatně zrušit nebo změnit, se řídí storno podmínkami poskytovatele uvedenými v inzerátu. Podmínky, které poskytovatelům nabízíme, jsou popsány pod [Storno podmínky](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "U ubytovacích služeb rezervovaných na určité období zpravidla neexistuje zákonné právo na odstoupení podle čl. 16 písm. l) směrnice 2011/83/EU ani podle odpovídajících vnitrostátních předpisů. Kogentní zákonná práva nejsou dotčena.",
            "Zruší-li poskytovatel, vracíme částku uhrazenou přes platformu v plné výši. Navíc se uplatní [Zásady přeubytování a vrácení peněz](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Zabrání-li cestě nebo pobytu událost mimo kontrolu obou stran, uplatní se [Zásady při závažných narušeních](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "Vrácení peněz probíhá na platební prostředek použitý k platbě, není-li dohodnuto jinak.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Co byste měli dále vědět",
          paragraphs: [
            "Poskytovatelé mohou být soukromí hostitelé nebo podnikatelé. Zda poskytovatel vystupuje jako podnikatel, uvádíme v inzerátu. Nejde-li o podnikatele, spotřebitelské předpisy Unie se na smlouvu o ubytování nevztahují — na tuto skutečnost vás v inzerátu upozorňujeme.",
            "Údaje o poloze, okolí, vzdálenostech a hodnoceních třetích osob slouží k orientaci. Závazné jsou údaje o samotné rezervované službě.",
            "V oblastech s registrační povinností pro krátkodobý pronájem uvádíme v inzerátu registrační číslo poskytnuté poskytovatelem; viz [Krátkodobý pronájem](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Je-li u jednoho typu objektu nebo pokoje více shodných jednotek, rezervujete jednu jednotku tohoto typu. Kterou konkrétní jednotku obdržíte, určuje poskytovatel.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Slovníček",
      paragraphs: [
        "Následující pojmy mají v těchto podmínkách zde uvedený význam.",
      ],
      definitions: [
        {
          term: "Poskytovatel",
          description:
            "Fyzická nebo právnická osoba, která nabízí ubytování prostřednictvím platformy a stává se smluvní stranou smlouvy o ubytování.",
        },
        {
          term: "Rezervace na dotaz",
          description:
            "Rezervace, která vzniká až výslovným přijetím ze strany poskytovatele, na rozdíl od okamžité rezervace.",
        },
        {
          term: "Potvrzení rezervace",
          description:
            "Zpráva, kterou vám potvrzujeme uzavření smlouvy o ubytování; obsahuje poskytovatele, službu, období, celkovou cenu a storno podmínky.",
        },
        {
          term: "Jednotka",
          description:
            "Konkrétní rezervovatelný objekt v rámci typu objektu nebo pokoje. Prodává se jednotka, popisuje a oceňuje se typ.",
        },
        {
          term: "Celková cena",
          description:
            "Částka zobrazená při dokončení rezervace včetně všech daní a všech poplatků vyúčtovaných přes platformu.",
        },
        {
          term: "Maximální obsazenost",
          description:
            "Nejvyšší přípustný počet osob, které smějí v ubytování přenocovat, jak je uveden v inzerátu.",
        },
        {
          term: "Kauce",
          description:
            "Částka požadovaná poskytovatelem jako jistota pro případ škody, která se předautorizuje nebo strhne a po pobytu uvolní či započte.",
        },
        {
          term: "Pobytový poplatek",
          description:
            "Místní poplatek za přenocování, který se podle obce vybírá na místě nebo prostřednictvím poskytovatele; není plněním myBestDays.",
        },
        {
          term: "Platforma",
          description:
            "Internetové stránky, mobilní aplikace a všechny další přístupy, jejichž prostřednictvím myBestDays zobrazuje ubytování a zprostředkovává rezervace.",
        },
        {
          term: "Servisní poplatek",
          description:
            "Odměna za zprostředkovatelskou službu myBestDays. Kdo jej nese a jak se uvádí, je popsáno v Servisních poplatcích.",
        },
        {
          term: "Storno podmínky",
          description:
            "Poskytovatelem zvolená pravidla o tom, do kdy a za jakých nákladů lze rezervaci zrušit nebo změnit.",
        },
        {
          term: "Ubytování",
          description:
            "Ubytovací služba nabízená poskytovatelem — rekreační objekt nebo jednotka určitého typu pokoje či objektu.",
        },
        {
          term: "Náklady na místě",
          description:
            "Částky, které se nevyúčtovávají přes platformu, ale jsou splatné poskytovateli, například pobytový poplatek, kauce nebo doplňkové služby objednané na místě.",
        },
      ],
    },
  ],
};
