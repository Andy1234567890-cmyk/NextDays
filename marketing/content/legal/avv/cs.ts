// Tschechische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin
// (dort stehen auch die Belege für die technischen und organisatorischen
// Maßnahmen und die Liste der Unterauftragsverarbeiter).
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Smlouva o zpracování osobních údajů",
  metaDescription:
    "Zpracování osobních údajů podle čl. 28 GDPR mezi myNextDays ApS a provozy, které používají platformu: předmět, pokyny, bezpečnost, další zpracovatelé.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Tato smlouva (dále jen „smlouva o zpracování“) platí mezi provozem, který používá platformu myNextDays (dále jen „správce“), a společností ${ANBIETER.firma} (dále jen „zpracovatel“ nebo „my“) a konkretizuje povinnosti podle čl. 28 nařízení (EU) 2016/679 (GDPR).`,
    `Je začleněna prostřednictvím [obchodních podmínek](${AGB_URL}) a platí po celou dobu užívání platformy. Má přednost před obchodními podmínkami, pokud jde o zpracování osobních údajů pro správce.`,
    "Doplňkově platí [zásady ochrany osobních údajů](/datenschutz) pro údaje, které zpracováváme jako samostatný správce — zejména údaje účtu a obchodního vztahu.",
  ],
  sections: [
    {
      heading: "Předmět a rozdělení rolí",
      unterpunkte: [
        {
          paragraphs: [
            "Předmětem je zpracování osobních údajů, které správce do platformy vkládá nebo jejím prostřednictvím shromažďuje, abychom mohli poskytovat smluvně sjednané služby: správa objektů, rezervací a obsazenosti, komunikace s hosty, zpracování platebního provozu, účetnictví a vyúčtování vlastníkům, propojení s rezervačními portály, stavebnice webových stránek a správa úkolů a týmu.",
          ],
        },
        {
          paragraphs: [
            "Správce rozhoduje o účelech a prostředcích tohoto zpracování. Údaje zpracováváme výhradně na základě jeho zdokumentovaných pokynů a nikoli pro vlastní účely.",
          ],
        },
        {
          paragraphs: [
            "U údajů účtu, vyúčtování našich vlastních služeb, bezpečnosti systému a zákonné archivace jsme správcem my sami. Toto zpracování není předmětem této smlouvy o zpracování.",
          ],
        },
      ],
    },
    {
      heading: "Povaha, rozsah a účel zpracování",
      paragraphs: [
        "Zpracování probíhá shromažďováním, uložením, zobrazením, změnou, předáním příjemcům zvoleným správcem (např. rezervační portály, poskytovatelé platebních služeb), omezením a výmazem — automatizovaně v platformě.",
        "Místem zpracování je Evropská unie; výjimky jsou vyčerpávajícím způsobem uvedeny v oddílu 8.",
      ],
    },
    {
      heading: "Kategorie subjektů údajů",
      list: [
        "Hosté a osoby provádějící rezervaci, včetně spolucestujících",
        "Zájemci, kteří podávají poptávky nebo posílají zprávy",
        "Vlastníci spravovaných objektů",
        "Zaměstnanci správce (tým, úklid, servis, recepce)",
        "Kontaktní osoby partnerů a dodavatelů správce",
      ],
    },
    {
      heading: "Kategorie osobních údajů",
      list: [
        "Základní údaje: jméno, adresa, datum narození, pokud je zaznamenáno, státní příslušnost, pokud je zaznamenána pro ohlašovací povinnost",
        "Kontaktní údaje: e-mailová adresa, telefonní číslo",
        "Údaje o rezervaci: období, objekt, počet cestujících, ceny, doplňkové služby, zrušení",
        "Platební údaje: částka, měna, způsob platby, stav platby, referenční údaje (úplné údaje o kartě se do našich systémů nedostanou)",
        "Komunikační údaje: zprávy, poznámky, hodnocení",
        "Přístupové a užívací údaje zaměstnanců: role, oprávnění, čas přihlášení, zařízení a IP adresa přihlášení",
        "Zvláštní kategorie podle čl. 9 GDPR nejsou předmětem zakázky; správce takové údaje do polí s volným textem nevkládá.",
      ],
    },
    {
      heading: "Pokyny",
      unterpunkte: [
        {
          paragraphs: [
            "Pokyny uděluje správce užíváním a konfigurací platformy a dále textovou formou na naši kontaktní adresu. Ústní pokyny potvrzujeme textovou formou.",
          ],
        },
        {
          paragraphs: [
            "Považujeme-li pokyn za protiprávní, neprodleně to oznámíme a jeho provedení můžeme pozastavit, dokud jej správce nepotvrdí nebo nezmění.",
          ],
        },
        {
          paragraphs: [
            "Jsme-li ke zpracování povinni ze zákona (například vůči úřadům), informujeme správce předem, pokud nám to právní předpisy dovolují.",
          ],
        },
        {
          titel: "Propojení vlastních služeb správce",
          paragraphs: [
            "Správce může svůj účet prostřednictvím rozhraní propojit se službou, kterou si sám vybral a s níž uzavřel vlastní smlouvu — například s asistentem s umělou inteligencí. Udělí-li takové propojení, je to jeho výslovný pokyn podle čl. 28 odst. 3 písm. a) GDPR vydat uvolněné údaje této službě. Zahrnuje výslovně i s tím spojené předání do třetí země, má-li služba sídlo mimo Evropskou unii.",
            "Krátce řečeno: o takovém propojení rozhoduje výhradně správce a za propojenou službu odpovídá sám.",
            "Udělit je může pouze účet s oprávněním spravovat externí propojení. Toto oprávnění je vyhrazeno roli „administrátor“; účty s omezenými právy — také role „spoluadministrátor“ — propojení udělit nemohou. Zaznamenáváme, kdo je kdy a pro kterou službu udělil, které druhy údajů byly uvolněny a jaká načtení proběhla; tento záznam je správci k dispozici v rozhraní pod položkou „Účet → Propojení“, aby mohl plnit svou povinnost odpovědnosti a odpovídat na žádosti o informace.",
            "Propojená služba není naším dalším zpracovatelem: nezadáváme jí zakázku, nevybíráme ji ani jí nedáváme pokyny. Údaje zpracovává na základě smlouvy, kterou s ní uzavřel sám správce. Za toto zpracování, za jeho právní základ a za záruky předání do třetí země proto odpovídá správce; není předmětem této smlouvy o zpracování.",
            "Pole s volným textem — poznámky k rezervaci a obsah zpráv hostů — jsou z takového propojení standardně vyňata. Mohou obsahovat zvláštní kategorie osobních údajů podle čl. 9 GDPR, například údaje o zdravotním stavu. Správce je musí při udělení uvolnit zvlášť; bez tohoto uvolnění se nepředávají.",
            "Správce může udělené propojení kdykoli v rozhraní odpojit. Obnovovací tokeny se přitom vymažou a při každém dalším načtení se kontroluje, zda souhlas nadále trvá — odpojená služba proto nemůže okamžitě nic číst, nikoli teprve po vypršení svého přístupového tokenu.",
          ],
        },
      ],
    },
    {
      heading: "Mlčenlivost",
      paragraphs: [
        "Všechny osoby, které mohou v souladu se zakázkou mít přístup k údajům, jsou povinny zachovávat mlčenlivost a jsou pravidelně poučovány o ochraně osobních údajů. Přístup je omezen na míru nezbytnou pro příslušný úkol.",
        "Přístup našich zaměstnanců k údajům zákazníků probíhá pouze za účelem odstranění chyb, na žádost podpory nebo za účelem plnění zákonných povinností.",
      ],
    },
    {
      heading: "Bezpečnost zpracování",
      paragraphs: [
        "Přijímáme technická a organizační opatření vyžadovaná podle čl. 32 GDPR. Zavedena jsou zejména:",
      ],
      list: [
        "Šifrování přenosu (TLS) pro všechna připojení, bezpečnostní hlavičky HTTP včetně striktní Content-Security-Policy",
        "Oddělení zákazníků přímo v databázi: přístupová pravidla na úrovni řádků (Row Level Security) a odebraná oprávnění k tabulkám u citlivých údajů, takže přístup mimo vlastní provoz je vyloučen i přímou databázovou cestou",
        "Oprávnění podle rolí s oddělením dat: servisní a úklidové síly nedostávají finanční a obchodní údaje, vlastníci pouze své vlastní objekty; údaje hostů jsou pro neoprávněné role maskovány",
        "Dvoufaktorové ověření (TOTP) dostupné pro účty; opětovné přihlášení při změnách kritických pro bezpečnost",
        "Protokol přihlášení se zařízením, časem a IP adresou, do něhož může správce nahlížet",
        "Propojení s externími službami může udělit pouze účet s rolí „administrátor“; každé načtení prostřednictvím takového propojení je protokolováno (nástroj, čas, rozsah — bez samotného obsahu) a správce do něj může nahlížet. Odpojené propojení pozbývá přístup okamžitě: při každém načtení se kontroluje, zda souhlas nadále trvá",
        "Omezení frekvence dotazů proti automatizovaným útokům, kontrola podpisů příchozích volání webhooku",
        "Šifrované záložní kopie uložené mimo produkční systém s pravidelným testem obnovy",
        "Oddělená prostředí pro vývoj a provoz; změny v databázi výhradně prostřednictvím verzovaných migrací",
      ],
    },
    {
      heading: "Další zpracovatelé",
      paragraphs: [
        "Správce schvaluje využití následujících dalších zpracovatelů. S každým z nich existují smlouvy podle čl. 28 odst. 4 GDPR s povinnostmi odpovídajícími této smlouvě o zpracování.",
      ],
      list: [
        "Hetzner Online GmbH, Německo (servery, databáze, média, mailový server; datové centrum Helsinky, Finsko)",
        "Stripe Payments Europe, Limited, Irsko (platby, výplaty, zákonné ověření totožnosti)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Lucembursko (platby, pokud je správce aktivuje)",
        "Channex.io Ltd, Spojené království (propojení s rezervačními portály, pokud je aktivováno)",
        "Meta Platforms Ireland Limited, Irsko (zprávy WhatsApp, pokud jsou aktivovány)",
        "Google Ireland Limited, Irsko (překlad obsahu; přihlášení pomocí Google, pokud je využíváno)",
        "Groq, Inc., USA (návrhy odpovědí v doručené poště, pokud jsou aktivovány)",
        "Cloudflare, Inc., USA (správa záznamů DNS pro vlastní domény, pokud je využívána)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Změnu nebo doplnění oznámíme nejméně 30 dní předem. Správce může v této lhůtě vznést námitku z důležitého důvodu týkajícího se ochrany osobních údajů; nebude-li námitka vypořádána, může vypovědět dotčenou část služby nebo smlouvu.",
          ],
        },
        {
          paragraphs: [
            "Služby, které si správce sám sjedná s třetí stranou, nejsou dalším zpracováním, nýbrž předáním, které vyvolal on sám. To platí pro rezervační portál, s nímž má vlastní smlouvu, stejně jako pro asistenta s umělou inteligencí nebo jiný program, který prostřednictvím rozhraní propojí se svým účtem (viz oddíl „Pokyny“).",
            "Rozhodující není, přes čí systémy údaje protékají, nýbrž kdo službu přibírá: další zpracování vzniká tehdy, když MY zadáme zakázku dalšímu dodavateli, abychom poskytli svou službu. Vybere-li si správce službu sám a uzavře s ní smlouvu, zpracovává tato služba pro správce — nikoli pro nás. Toto rozlišení odpovídá smluvní praxi srovnatelných poskytovatelů u služeb třetích stran propojených zákazníkem.",
          ],
        },
      ],
    },
    {
      heading: "Předávání do třetích zemí",
      paragraphs: [
        "Předávání příjemcům mimo EU se omezuje na výše uvedené služby se sídlem v USA, resp. ve Spojeném království. Základem jsou standardní smluvní klauzule o ochraně osobních údajů Evropské komise podle čl. 46 odst. 2 písm. c) GDPR nebo platné rozhodnutí o odpovídající ochraně; uplatňují se doplňková ochranná opatření (šifrování, minimalizace údajů).",
      ],
    },
    {
      heading: "Podpora správce",
      unterpunkte: [
        {
          paragraphs: [
            "Podporujeme správce při odpovídání na žádosti subjektů údajů (čl. 15 až 22 GDPR). Platforma k tomu nabízí přístup k údajům, jejich opravu, export a výmaz přímo v rozhraní. Obrátí-li se subjekty údajů přímo na nás, odkážeme je na správce a informujeme jej.",
          ],
        },
        {
          paragraphs: [
            "Podporujeme dále při posouzení vlivu na ochranu osobních údajů, při dodržování povinností podle čl. 32 až 36 GDPR a při dotazech dozorových úřadů.",
          ],
        },
      ],
    },
    {
      heading: "Porušení zabezpečení osobních údajů",
      paragraphs: [
        "Dozvíme-li se o porušení zabezpečení osobních údajů, které se týká údajů správce, informujeme jej neprodleně, nejpozději do 48 hodin od zjištění, textovou formou.",
        "Oznámení obsahuje, pokud je to známo, povahu a čas incidentu, dotčené kategorie údajů a skupiny osob, pravděpodobné důsledky a přijatá i navrhovaná opatření. Podporujeme správce při jeho ohlašovacích a oznamovacích povinnostech podle čl. 33 a 34 GDPR.",
      ],
    },
    {
      heading: "Doklady a kontroly",
      unterpunkte: [
        {
          paragraphs: [
            "Dodržování této smlouvy o zpracování na požádání prokazujeme, zejména informací o přijatých opatřeních a o využívaných dalších zpracovatelích.",
          ],
        },
        {
          paragraphs: [
            "Správce může provádět kontroly v nezbytném rozsahu nebo je nechat provést nezávislým auditorem, který s námi není v soutěžním vztahu. Kontroly se provádějí po oznámení s přiměřenou lhůtou, během běžné pracovní doby a bez narušení provozu. Náklady kontroly, která přesahuje poskytnutí informací, nese správce, pokud kontrola není vyvolána incidentem, který jsme způsobili my.",
          ],
        },
      ],
    },
    {
      heading: "Výmaz a vrácení",
      paragraphs: [
        "Po ukončení smlouvy zpřístupníme na vyžádání údaje správce k exportu do 30 dnů v běžném, strojově čitelném formátu. Poté údaje včetně kopií vymažeme.",
        "Vyňaty jsou údaje, u nichž existuje zákonná povinnost uchovávání (zejména fakturační a účetní údaje); ty se zablokují a po uplynutí lhůty vymažou. Záložní kopie se přepisují v rámci běžného rotačního cyklu.",
      ],
    },
    {
      heading: "Odpovědnost a pořadí přednosti",
      paragraphs: [
        "Platí čl. 82 GDPR. Ve vztahu mezi stranami platí vedle toho pravidla odpovědnosti obchodních podmínek, pokud nejsou v rozporu s GDPR.",
        "Jsou-li obchodní podmínky a tato smlouva o zpracování ve vzájemném rozporu, jde-li o zpracování pro správce, platí tato smlouva o zpracování. Stane-li se některé ustanovení neplatným, zbývající obsah zůstává v platnosti; strany je nahradí přípustnou úpravou se stejným účelem.",
      ],
    },
    {
      heading: "Změny této smlouvy",
      paragraphs: [
        "Tuto smlouvu o zpracování můžeme upravit, pokud je to nezbytné z důvodu změn právních předpisů, požadavků dozorových úřadů, požadavků poskytovatelů platebních služeb nebo technického vývoje a pokud tím správce není v horším postavení.",
        "Změny oznámíme textovou formou nejméně 30 dní před nabytím účinnosti. Nevznese-li správce v této lhůtě námitku, považují se za přijaté; na tento důsledek se v oznámení upozorňuje. V případě námitky může každá strana smlouvu vypovědět k okamžiku nabytí účinnosti.",
      ],
    },
    {
      heading: "Kontakt",
      paragraphs: [
        `Dotazy k této smlouvě, pokyny a hlášení zasílejte na [${ANBIETER.email}](mailto:${ANBIETER.email}) nebo na adresu ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
