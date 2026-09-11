import type { LegalDoc } from "../types";

// Tschechische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. § 5 Absatz 1–2 folgt Stripes offiziellem Empfehlungstext
// (Stripe Connected Account Agreement) — Wortlaut sinngemäß, URLs nicht verändern.
export const agb: LegalDoc = {
  title: "Všeobecné obchodní podmínky (VOP) pro agentury a pronajímatele",
  stand: "Stav ke dni: 11. září 2026",
  intro: [
    "Tyto všeobecné obchodní podmínky (dále jen „VOP“) upravují užívání softwarové platformy myNextDays (dále jen „platforma“) agenturami, pronajímateli, správci nemovitostí a dalšími podnikatelskými uživateli (dále jen „uživatel“).",
    "Provozovatelem platformy je myNextDays ApS, společnost s ručením omezeným (anpartsselskab) podle dánského práva, Hirtshalsvej 21, 9881 Bindslev, Dánsko, zapsaná v dánském Centrálním registru podniků (CVR) pod CVR č. 46615182 (dále jen „myNextDays“ nebo „my“).",
    "Platforma je určena výhradně podnikatelům ve smyslu § 14 německého občanského zákoníku (BGB), resp. odpovídajících předpisů příslušného členského státu EU. Není určena spotřebitelům.",
  ],
  sections: [
    {
      heading: "§ 1 Oblast působnosti",
      paragraphs: [
        "Tyto VOP se vztahují na veškeré smlouvy o užívání platformy uzavřené mezi myNextDays a uživatelem, jakož i na všechny služby a moduly poskytované jejím prostřednictvím.",
        "Odchylné, rozporné nebo doplňující obchodní podmínky uživatele se stávají součástí smlouvy pouze tehdy, pokud myNextDays s jejich platností výslovně souhlasila v textové podobě.",
      ],
    },
    {
      heading: "§ 2 Předmět smlouvy a služby",
      paragraphs: [
        "myNextDays poskytuje uživateli cloudový software pro správu rekreačních ubytování a ubytovacích zařízení. Rozsah funkcí vyplývá z aktuálně platného popisu služeb a zahrnuje zejména:",
      "Každá nemovitost vytvořená uživatelem na platformě je zároveň uvedena na vlastním tržišti platformy myBestDays (povinný kanál). Uživatel nemůže tento kanál individuálně odhlásit; může však nemovitost kdykoli stáhnout z prodeje na všech kanálech současně pomocí funkce „Pozastavit prodej“ nebo ji smazat. Nemovitost se stane viditelnou na myBestDays až poté, co ji uživatel zveřejní a myNextDays inzerát schválí; myNextDays může schválení odmítnout nebo zrušit z věcného důvodu. Pro rezervace přes myBestDays platí poplatek dle § 7.",
      ],
      list: [
        "správu objektů, kalendářů obsazenosti a rezervací (property management system),",
        "napojení na rezervační kanály třetích stran (např. Booking.com, Airbnb) prostřednictvím channel manageru,",
        "Zveřejňování nabídek prostřednictvím vlastního tržiště platformy myBestDays (povinný kanál, viz odstavec 2),",
        "tvorbu vlastních webových stránek pomocí integrovaného page builderu,",
        "účetní, zúčtovací a analytické funkce včetně vyúčtování pro vlastníky,",
        "komunikaci s hosty a přijímání plateb prostřednictvím integrovaného zpracování plateb (§ 5).",
      ],
    },
    {
      heading: "§ 3 Registrace, účet a údaje uživatele",
      paragraphs: [
        "Užívání platformy vyžaduje registraci účtu. Uživatel je povinen při registraci a po celou dobu trvání smlouvy uvádět správné, aktuální a úplné údaje o své osobě a svém podniku a při jejich změně je neprodleně aktualizovat.",
        "Přístupové údaje je nutno uchovávat v tajnosti a chránit před přístupem třetích osob. Uživatel je povinen myNextDays neprodleně informovat, existují-li náznaky zneužití jeho účtu.",
        "Účet je nepřenosný. Uživatel zajistí, aby všechny osoby, které účet jeho jménem používají, dodržovaly tyto VOP.",
      ],
    },
    {
      heading: "§ 4 Role myNextDays při rezervacích",
      paragraphs: [
        "Smlouvy o ubytování týkající se ubytování nabízeného na platformě, prostřednictvím napojených kanálů třetích stran nebo na vlastních webových stránkách uživatele se uzavírají výhradně mezi uživatelem (resp. vlastníkem, kterého uživatel zastupuje) a příslušným hostem. myNextDays se nestává smluvní stranou smlouvy o ubytování.",
        "Za správnost a zákonnost obsahu nabídek (popisy, fotografie, ceny, dostupnost, daně a poplatky) odpovídá výhradně uživatel.",
      ],
    },
    {
      heading: "§ 5 Zpracování plateb prostřednictvím Stripe",
      paragraphs: [
        "Služby zpracování plateb pro agentury a pronajímatele na myNextDays poskytuje Stripe a řídí se smlouvou [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), která zahrnuje podmínky poskytování služeb Stripe (společně dále jen „smlouva o službách Stripe“). Souhlasem s těmito VOP nebo pokračováním v činnosti jako agentura či pronajímatel na myNextDays uživatel souhlasí s tím, že je vázán smlouvou o službách Stripe, kterou může Stripe čas od času měnit.",
        "Podmínkou toho, aby myNextDays umožňovala služby zpracování plateb prostřednictvím Stripe, je, že uživatel poskytne myNextDays správné a úplné informace o sobě a svém podniku. Uživatel zmocňuje myNextDays k tomu, aby tyto informace a transakční údaje související s užíváním služeb zpracování plateb poskytovaných společností Stripe předávala společnosti Stripe.",
        "Pro právní vztah se společností Stripe je rozhodné odkazované anglické znění smlouvy v jeho aktuálně platné verzi. Smluvním partnerem pro uživatele v Evropském hospodářském prostoru je společnost Stripe uvedená ve smlouvě o službách Stripe (v současnosti Stripe Payments Europe, Limited, Irsko). Stripe zpracovává osobní údaje v souladu se [zásadami ochrany osobních údajů společnosti Stripe](https://stripe.com/privacy).",
        "Za účelem splnění zákonných identifikačních a ověřovacích povinností (mj. prevence praní špinavých peněz, „Know Your Customer“) mohou myNextDays a Stripe kdykoli požadovat další údaje a doklady, zejména doklady totožnosti, údaje o skutečných majitelích a o bankovním spojení. Nebudou-li požadované údaje nebo doklady poskytnuty ve stanovené lhůtě, může být přijímání plateb nebo vyplácení zcela či zčásti pozastaveno, dokud nebudou údaje úplné.",
      ],
    },
    {
      heading: "§ 6 Výplaty, zpětná zúčtování a záporné zůstatky",
      paragraphs: [
        "Způsob úhrady se řídí rezervačním kanálem. U rezervací uskutečněných prostřednictvím vlastního rezervačního systému Uživatele a u rezervací prostřednictvím připojených distribučních portálů jsou platby hostů přijímány přímo na platební účet Uživatele; v těchto případech je Uživatel vůči hostovi příjemcem platby a smluvní stranou ubytovací služby (§ 4) a myNextDays se v žádném okamžiku nestává držitelem těchto prostředků. Z takových rezervací myNextDays neúčtuje žádný procentní rezervační poplatek; provize za rezervace prostřednictvím připojených distribučních portálů se uvádí samostatně a fakturuje se dodatečně.",
        "U rezervací uskutečněných prostřednictvím rezervačního portálu myNextDays je platba zpracována prostřednictvím myNextDays. myNextDays si přitom ponechává zprostředkovatelskou provizi uvedenou v aktuálně platném ceníku včetně nákladů na zpracování platby a zbývající částku poukazuje Uživateli podle níže uvedených odstavců. Odměna za užívání softwaru (§ 7) tím není dotčena.",
        "Výplaty se provádějí na bankovní účet uvedený uživatelem. myNextDays může frekvenci výplat z důvodů řízení rizik upravit, zejména u nových účtů, nápadných transakčních vzorců nebo probíhajících prověrek.",
        "Vrácení plateb hostům nese ekonomicky Uživatel. Zpětná zúčtování a z nich vyplývající poplatky nese Uživatel u rezervací uskutečněných prostřednictvím vlastního rezervačního systému a prostřednictvím připojených distribučních portálů, neboť Uživatel je v těchto případech příjemcem platby; u rezervací uskutečněných prostřednictvím rezervačního portálu myNextDays nese riziko zpětného zúčtování myNextDays, ledaže je způsobeno porušením povinností Uživatele (zejména neposkytnutím nebo podstatnou odchylkou ubytovací služby). myNextDays je oprávněna započíst částky k tíži Uživatele proti budoucím výplatám.",
        "Vznikne-li na platebním účtu uživatele záporný zůstatek, je uživatel povinen jej neprodleně vyrovnat. Uživatel zmocňuje myNextDays a Stripe k inkasu záporných zůstatků z uvedeného bankovního účtu, pokud je to právně přípustné.",
      ],
    },
    {
      heading: "§ 7 Odměny a vyúčtování",
      paragraphs: [
        "Odměny za užívání platformy vyplývají z ceníku sjednaného při uzavření smlouvy, resp. z individuální nabídky. Všechny ceny se rozumí bez příslušných zákonných daní a v měně uvedené ve smlouvě.",
        "Odměny závislé na transakcích (např. poplatky za platby nebo za kanály) mohou být sraženy nebo započteny přímo při zpracování příslušné transakce.",
        "Dostane-li se uživatel do prodlení s platbami, může myNextDays po předchozím upozornění zablokovat přístup k platformě až do vyrovnání dlužných pohledávek.",
      ],
    },
    {
      heading: "§ 8 Povinnosti uživatele; vlastní právní texty",
      paragraphs: [
        "Uživatel zajistí, aby jeho nabídky, obsah a obchodní praktiky odpovídaly příslušným platným právním předpisům, zejména předpisům o ubytování, ohlašovacím, daňovým a spotřebitelskoprávním předpisům v místě ubytování. Potřebná povolení, registrace a licence si uživatel obstarává na vlastní odpovědnost.",
        "Za webové stránky, které uživatel provozuje prostřednictvím page builderu, jakož i za své nabídky na platformě odpovídá uživatel sám; to zahrnuje zejména vlastní obchodní podmínky pro hosty, vlastní údaje o provozovateli (impresum) a vlastní informace o ochraně osobních údajů.",
        "Zakázáno je zejména: zveřejňování nesprávných nebo klamavých nabídek, provádění fiktivních obchodů nebo podvodných transakcí, obcházení zpracování plateb podle § 5 u rezervací uzavřených prostřednictvím platformy, jakož i jakékoli užívání, které narušuje bezpečnost nebo dostupnost platformy.",
      ],
    },
    {
      heading: "§ 9 Rezervační kanály třetích stran",
      paragraphs: [
        "Při napojení kanálů třetích stran (např. Booking.com, Airbnb) platí navíc podmínky příslušného provozovatele kanálu. Smlouvy k tomu potřebné uzavírá uživatel s provozovatelem kanálu sám.",
        "myNextDays zajišťuje technickou synchronizaci dostupnosti, cen a rezervačních dat, nemá však žádný vliv na obsah, provize ani rozhodnutí provozovatelů kanálů a neodpovídá za jejich dostupnost.",
      ],
    },
    {
      heading: "§ 10 Dostupnost a další vývoj",
      paragraphs: [
        "myNextDays poskytuje služby s péčí řádného hospodáře a usiluje o vysokou dostupnost platformy. Okna údržby, další vývoj a okolnosti mimo sféru vlivu myNextDays (např. výpadky u poskytovatelů třetích stran) mohou dostupnost dočasně omezit.",
        "myNextDays smí platformu dále rozvíjet a měnit funkce, pokud tím není ohrožen účel smlouvy a změna je pro uživatele přiměřená.",
      ],
    },
    {
      heading: "§ 11 Data a ochrana osobních údajů",
      paragraphs: [
        "Pokud myNextDays při poskytování platformy zpracovává osobní údaje z pověření uživatele (zejména údaje hostů), uzavřou smluvní strany smlouvu o zpracování osobních údajů podle čl. 28 GDPR.",
        "Uživatel zůstává odpovědný za přípustnost shromažďování a zpracování jím vložených dat z hlediska ochrany osobních údajů. Podrobnosti o zpracování údajů společností myNextDays vyplývají z informací o ochraně osobních údajů platformy; pro zpracování údajů společností Stripe platí § 5.",
      ],
    },
    {
      heading: "§ 12 Využití umělé inteligence",
      paragraphs: [
        "myNextDays v jednotlivých funkcích využívá systémy umělé inteligence, zejména pro cenová doporučení (dynamic pricing), pro návrhy odpovědí v doručené poště zpráv a pro podporu v rámci zákaznické podpory. Tyto funkce vytvářejí návrhy; rozhodnutí o jejich použití a odpovědnost za ně nese uživatel. Cenová doporučení nenahrazují vlastní obchodní posouzení.",
                "V rámci platformy žádný systém umělé inteligence neodpovídá automaticky hostům ani uživateli: Každá zpráva vygenerovaná umělou inteligencí je předložena člověku ke kontrole, který ji může, ale nemusí změnit a odeslat. Podpora uživatelů je poskytována lidmi. Odlišný je produktový poradce na našich webových stránkách: Ten odpovídá na dotazy zájemců o rozsah služeb okamžitě a bez lidského schválení, není součástí platformy a není předmětem této smlouvy. Informace poskytnuté tímto poradcem nezakládají záruku vlastnosti a nepřevažují nad ustanoveními těchto VOP a aktuálního popisu služeb; rozhodující je § 2. Podrobnosti o zpracování dat naleznete v našich zásadách ochrany osobních údajů.",
        "Pokud fyzická osoba přímo komunikuje se systémem umělé inteligence, je jí to sděleno (článek 50 odstavec 1 nařízení (EU) 2024/1689 – „Nařízení o umělé inteligenci“); u produktového poradce na našich webových stránkách se tak děje na začátku dialogu. Texty, které systém umělé inteligence vytvořil nebo podstatně změnil a které uživatel předává hostům, musí uživatel označit, pokud mu to ukládá zákonná povinnost.",
        "myNextDays neprovozuje systémy umělé inteligence, které se podle přílohy III aktu o umělé inteligenci považují za vysoce rizikové, ani praktiky zakázané podle čl. 5 aktu o umělé inteligenci. Vstupy uživatele a údaje jeho hostů se bez zvláštního pokynu nepoužívají k trénování modelů.",
        "Uživatel nesmí funkce umělé inteligence používat k tomu, aby u hostů vyvolával dojem lidské komunikace tam, kde existuje povinnost informovat, ani k tomu, aby činil právně závazná prohlášení bez vlastního posouzení.",
        "Pokud uživatel propojí svůj účet prostřednictvím k tomu určeného rozhraní s vlastním asistentem umělé inteligence (například Claude od Anthropic), platí následující: uživatel uzavírá smlouvu o této službě sám a je odpovědný za její využití. Propojení je jeho pokynem myNextDays, aby tam uvolněné údaje vydala — včetně přenosu do třetí země, má-li poskytovatel sídlo mimo Evropskou unii. Uživatel zajistí, že k tomu má právní základ, že jeho vlastní informace o ochraně osobních údajů uvádějí příjemce a že jsou dány potřebné záruky pro přenos.",
        "Pro takové propojení uživatel použije přístup, pro nějž poskytovatel nabízí zpracování osobních údajů z pověření a vylučuje použití údajů k trénování modelů — u Claude jsou to přístupy pro firemní zákazníky (Team, Enterprise nebo API). Přístupy pro soukromé použití to zpravidla nesplňují; pro údaje hostů jsou proto nevhodné. myNextDays nemůže rozpoznat, který přístup uživatel používá, a upozorňuje na to v dialogu se souhlasem.",
        "Uživatel přitom bere na vědomí, že obsah, který z uživatelského prostředí ručně zkopíruje do vstupního pole asistenta, zpravidla nepodléhá smluvním omezením poskytovatele — na rozdíl od údajů získaných prostřednictvím rozhraní.",
        "Údaje, které pocházejí z rezervačního portálu, používá uživatel i prostřednictvím rozhraní pouze k vyřízení a obsluze příslušné rezervace — nikoli k hodnocení osob, k profilování nebo k reklamě. Portály toto účelové omezení stanoví ve svých vlastních podmínkách.",
      ],
    },
    {
      heading: "§ 13 Stížnosti a mediace",
      paragraphs: [
        "myNextDays vede pro podnikatelské uživatele bezplatný interní systém řešení stížností (čl. 11 nařízení (EU) 2019/1150 — „nařízení P2B“). Stížnosti — zejména na tvrzená porušení těchto VOP, na technické problémy s významným dopadem nebo na opatření myNextDays vůči uživateli — lze podat bez zvláštní formy na info@mynextdays.dk nebo prostřednictvím podpory v aplikaci. Přijetí je potvrzeno; vyřízení probíhá bez zbytečného odkladu a v přiměřené lhůtě, u jednoduše položených případů zpravidla do 14 dnů. Výsledek je uživateli sdělen jasným jazykem.",
        "Nedojde-li ve stížnostním řízení k dohodě, je myNextDays připravena obrátit se s uživatelem mimosoudně na tyto mediátory (čl. 12 nařízení P2B): (1) WIPO Arbitration and Mediation Center, 34 chemin des Colombettes, 1211 Ženeva 20, Švýcarsko — řízení i na dálku a vícejazyčně; (2) Voldgiftsinstituttet — Danish Institute of Arbitration, Kronprinsessegade 28, 1306 Kodaň K, Dánsko — stát sídla poskytovatele.",
        "Uvedení mediátorů uživatele nezavazuje k provedení mediačního řízení; právo obrátit se na soud zůstává nedotčeno. Na přiměřených nákladech mediace se myNextDays podílí; jejich rozdělení se řídí pravidly příslušného mediátora a okolnostmi jednotlivého případu.",
        "myNextDays každoročně zveřejňuje údaje o počtu stížností, o době jejich vyřizování a o přijatých opatřeních.",
      ],
    },
    {
      heading: "§ 14 Duševní vlastnictví",
      paragraphs: [
        "Veškerá práva k platformě, jejímu softwaru a jejímu obsahu (s výjimkou obsahu vloženého uživatelem) náleží myNextDays, resp. jejím poskytovatelům licencí. Uživatel získává na dobu trvání smlouvy nevýhradní, nepřenosné právo užívat platformu ve smluvně sjednaném rozsahu.",
        "K obsahu vloženému uživatelem poskytuje uživatel myNextDays nevýhradní užívací práva nezbytná pro provoz platformy (zejména k ukládání, rozmnožování, zobrazování a přenosu do napojených kanálů).",
      ],
    },
    {
      heading: "§ 15 Odpovědnost",
      paragraphs: [
        "myNextDays odpovídá neomezeně za úmysl a hrubou nedbalost, jakož i za škody způsobené újmou na životě, těle nebo zdraví.",
        "V případě prosté nedbalosti odpovídá myNextDays pouze za porušení podstatných smluvních povinností (kardinálních povinností), a to v rozsahu omezeném na předvídatelnou škodu typickou pro daný typ smlouvy. Odpovědnost podle zákona o odpovědnosti za vady výrobku a z převzatých záruk zůstává nedotčena.",
        "Za ztrátu dat odpovídá myNextDays pouze v rozsahu, v jakém by škoda vznikla i při řádném a pravidelném zálohování dat uživatelem, ledaže zálohování dat smluvně přísluší myNextDays.",
      ],
    },
    {
      heading: "§ 16 Doba trvání, výpověď a zablokování",
      paragraphs: [
        "Doba trvání a výpovědní lhůty vyplývají z příslušné smlouvy. Právo na mimořádnou výpověď ze závažného důvodu zůstává nedotčeno.",
        "myNextDays může dočasně zablokovat přístup k platformě nebo jednotlivé funkce (včetně přijímání plateb a výplat), existují-li konkrétní náznaky porušení těchto VOP, podvodu nebo zneužití, nebo je-li k tomu myNextDays povinna ze zákona či na základě pokynu poskytovatele platebních služeb. O zablokování bude uživatel informován, pokud je to právně přípustné.",
        "Po skončení smlouvy poskytne myNextDays uživateli na jeho žádost jeho data k exportu v běžném formátu do 30 dnů; poté budou data smazána, pokud tomu nebrání zákonné povinnosti uchovávání.",
      ],
    },
    {
      heading: "§ 17 Změny těchto VOP",
      paragraphs: [
        "myNextDays může tyto VOP měnit s účinností do budoucna, pokud je to nezbytné ze závažných důvodů (zejména kvůli změnám právních předpisů, změnám judikatury nebo požadavkům poskytovatelů platebních služeb) a uživatel tím není nepřiměřeně znevýhodněn.",
        "Změny budou uživateli oznámeny v textové podobě nejméně šest týdnů před nabytím účinnosti. Nevznese-li uživatel v oznámené lhůtě námitku nebo bude-li platformu po nabytí účinnosti nadále užívat, považují se změněné VOP za přijaté; na tento následek bude v oznámení zvlášť upozorněno.",
      ],
    },
    {
      heading: "§ 18 Závěrečná ustanovení",
      paragraphs: [
        "Použije se právo státu, v němž má provozovatel své sídlo, s vyloučením Úmluvy OSN o smlouvách o mezinárodní koupi zboží. Kogentní předpisy státu, v němž má uživatel své sídlo, zůstávají nedotčeny.",
        "Výlučně místně příslušným soudem pro všechny spory vyplývající z této smlouvy nebo vzniklé v souvislosti s ní je — pokud je to právně přípustné — soud v sídle provozovatele.",
        "Budou-li jednotlivá ustanovení těchto VOP neplatná nebo se neplatnými stanou, není tím dotčena platnost ostatních ustanovení.",
      ],
    },
  ],
};
