// Tschechische Übersetzung von `de.ts`.
//
// Inhaltliche Änderungen gehören ZUERST in `de.ts` und werden von dort
// nachgezogen — hier wird ausschließlich übersetzt, nie fachlich geändert.
// Struktur (Abschnitte, Reihenfolge, Anzahl der Absätze) ist mit `de.ts`
// deckungsgleich zu halten.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Zásady ochrany osobních údajů",
  metaDescription:
    "Jak myNextDays zpracovává osobní údaje: účely, právní základy, příjemci, doba uchování a vaše práva podle GDPR.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Tyto zásady popisují, jak společnost ${ANBIETER.firma} zpracovává osobní údaje — při návštěvě těchto webových stránek, při užívání platformy myNextDays (dashboard, tržiště a mobilní aplikace) a v rámci obchodního vztahu s našimi zákazníky.`,
    "Neprodáváme data a nevytváříme profily, které by vás identifikovaly jako osobu. Na tomto webu měříme – pouze s vaším souhlasem – dosah našich stránek a úspěšnost naší reklamy; obě kategorie lze jednotlivě odhlásit (viz sekce Měření dosahu a Reklama a měření úspěšnosti). Pro marketingové účely zpracováváme údaje pouze tam, kde jste k tomu dali výslovný souhlas – konkrétně pro náš newsletter (viz sekce Komunikace), který můžete kdykoli odhlásit jedním kliknutím.",
  ],
  sections: [
    {
      heading: "Správce",
      paragraphs: ["Správcem zpracování popsaných v těchto zásadách je:"],
      zeilen: [
        {
          label: "Společnost",
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
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Oblast působnosti a role",
      unterpunkte: [
        {
          paragraphs: [
            "Pro návštěvu těchto webových stránek, pro váš zákaznický účet a pro plnění našeho obchodního vztahu jsme správcem ve smyslu čl. 4 bodu 7 GDPR.",
          ],
        },
        {
          paragraphs: [
            "U údajů, které naši zákazníci (pronajímatelé, hotely, agentury) zpracovávají v platformě o svých hostech, vlastnících a zaměstnancích, jsou správci tito zákazníci a my jsme zpracovatelem podle čl. 28 GDPR. Podrobnosti jsou uvedeny ve [smlouvě o zpracování osobních údajů](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Rezervujete-li si jako host ubytování prostřednictvím našeho tržiště, zpracováváme vaše rezervační a kontaktní údaje jak vlastním jménem (provoz tržiště, zpracování platby), tak pro hostitelský podnik. Vaše smlouva o ubytování vzniká výhradně s tímto podnikem; vedle toho platí jeho informace o ochraně osobních údajů.",
          ],
        },
      ],
    },
    {
      heading: "Návštěva těchto webových stránek",
      unterpunkte: [
        {
          titel: "Protokoly serveru",
          paragraphs: [
            "Při každém vyvolání předává váš prohlížeč technicky nezbytné údaje, které náš webový server protokoluje: IP adresu, datum a čas, vyvolanou adresu, objem přenesených dat, stavový kód, referrer a identifikaci prohlížeče. Účelem je poskytnutí stránky a dále rozpoznávání a odvracení útoků a poruch. Právním základem je čl. 6 odst. 1 písm. f) GDPR; naším oprávněným zájmem je bezpečný a stabilní provoz. Protokoly uchováváme pouze tak dlouho, jak je to nezbytné pro provoz a bezpečnost, a nespojujeme je s jinými údaji.",
          ],
        },
        {
          titel: "Fonty",
          paragraphs: [
            "Použité fonty jsou vloženy lokálně na našem serveru. Nedochází k žádnému spojení s Google Fonts ani s jinou službou pro fonty.",
          ],
        },
        {
          titel: "Ikony",
          paragraphs: [
            "Ikony těchto webových stránek jsou stejně jako fonty uloženy u nás: jsou do stránky vkládány na našem serveru a nejsou dodatečně načítány z žádné služby pro ikony. Nedochází přitom k žádnému spojení s třetí stranou a vaše IP adresa není nikomu předávána.",
          ],
        },
        {
          titel: "Ochrana kontaktního formuláře proti spamu (reCAPTCHA)",
          paragraphs: [
            "Náš kontaktní formulář je proti automatizovaným masovým zprávám chráněn službou reCAPTCHA Enterprise společnosti Google Ireland Limited. Pouze pokud s tím vyslovíte souhlas, načte váš prohlížeč při vyplňování formuláře skript z www.google.com; přitom jsou společnosti Google předány vaše IP adresa a údaje o vaší interakci s formulářem a tam vyhodnoceny s cílem odlišit člověka od skriptu. Právním základem je čl. 6 odst. 1 písm. a) GDPR (souhlas); doplňkově platí [zásady ochrany osobních údajů společnosti Google](https://policies.google.com/privacy).",
            "Bez vašeho souhlasu se z Google nic nenačte a nebudou tam proudit žádná data; formulář pak nepřijmeme, ale vždy nám můžete napsat e-mail. Pokud souhlas udělíte, reCAPTCHA nastaví vlastní soubor cookie (_GRECAPTCHA, doba platnosti stanovena společností Google, až šest měsíců), který se používá k hodnocení rizik. Svůj souhlas můžete kdykoli změnit nebo odvolat pomocí ikony souboru cookie vlevo dole na každé stránce; soubor cookie pak bude smazán.",
          ],
        },
        {
          titel: "Měření dosahu (Google Analytics)",
          paragraphs: [
            "Na tomto webu měříme pomocí Google Analytics 4 od Google Ireland Limited, jak jsou naše stránky používány – které stránky jsou navštěvovány, odkud návštěvníci přicházejí a v jakém bodě odcházejí. Účelem je výhradně zlepšení nabídky a nalezitelnosti.",
            "Načítání probíhá výhradně s vaším souhlasem. Pokud jej udělíte, váš prohlížeč načte skript z www.googletagmanager.com a uloží dva soubory cookie („_ga“ a „_ga_<ID>“, platnost až dva roky) s náhodně vygenerovaným ID; přenášeny jsou toto ID, navštívené stránky, zdroj odkazu, přibližná poloha na úrovni země nebo regionu, zařízení a prohlížeč a vaše IP adresa, kterou Google před každým uložením zkrátí. Právním základem je čl. 6 odst. 1 písm. a GDPR (souhlas).",
            "Vyhodnocení jsme výslovně omezili: Signály Google a personalizace reklamy jsou vypnuty. Nevznikají proto žádné profily napříč zařízeními a žádné cílové skupiny pro reklamu a nepředáváme žádné údaje o používání reklamním sítím. Sloučení s vaším zákaznickým účtem neprobíhá.",
            "Google zpracovává data jako náš zpracovatel na základě smlouvy podle čl. 28 GDPR (Google Ads Data Processing Terms). Zkrácení vaší IP adresy probíhá na serverech v EU, než jsou data přenesena do USA; přenášen je tedy pseudonymní datový soubor. Základem přenosu je rozhodnutí Evropské komise o odpovídající ochraně v rámci EU-US Data Privacy Framework (čl. 45 GDPR), pod kterým je Google LLC certifikován; Google navíc zahrnul standardní smluvní doložky Evropské komise (čl. 46 GDPR). Výslovně upozorňujeme, že americké úřady mohou podle § 702 FISA přistupovat k datům certifikovaných společností a zbytkové riziko proto nelze zcela vyloučit. Dále platí [zásady ochrany osobních údajů společnosti Google](https://policies.google.com/privacy).",
            "Doba uložení: Údaje o událostech a uživatelích jsou v naší vlastnosti automaticky smazány po 14 měsících; agregovaná data zpráv bez vztahu k jednotlivým návštěvníkům zůstávají zachována. Váš souhlas samotný vyprší po šesti měsících.",
            "Bez vašeho souhlasu se nic nenačte, žádný soubor cookie se nenastaví a žádná data nebudou proudit do Google. Svůj souhlas můžete kdykoli odvolat pomocí ikony cookie vlevo dole na každé stránce; měření pak okamžitě skončí a uvedené soubory cookie budou smazány. Po šesti měsících se zeptáme znovu.",
          ],
        },
        {
          titel: "Reklama a měření úspěšnosti",
          paragraphs: [
            "S vaším souhlasem používáme marketingové soubory cookie k měření úspěšnosti naší reklamy a k zobrazování relevantních reklam na jiných platformách. Zapojeny jsou společnosti Meta Platforms Ireland (Meta-Pixel, cookie _fbp), LinkedIn Ireland (Insight-Tag, soubory cookie li_gc a bcookie) a Google Ireland Limited (Google Ads, cookie _gcl_au). Právním základem je čl. 6 odst. 1 písm. a GDPR. Bez vašeho souhlasu nebudou načteny žádné z těchto skriptů a nebudou nastaveny žádné soubory cookie; v případě odvolání je smažeme. Podrobnosti o každém souboru cookie naleznete v [Zásadách používání souborů cookie](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Zákaznický účet a užívání platformy",
      paragraphs: [
        "Pro registraci a provoz účtu zpracováváme údaje, které zadáte vy nebo váš podnik: jméno, obchodní firmu a právní formu, adresu, e-mailovou adresu, telefonní číslo, roli a oprávnění, registrační údaje (např. číslo v obchodním registru nebo daňové identifikační číslo), bankovní spojení pro výplaty a dále obsah, který je v účtu vytvořen.",
        "Pro zabezpečení přístupu zpracováváme navíc protokoly přihlášení (čas, IP adresu, zařízení a prohlížeč přihlášení) a — je-li aktivováno — údaje dvoufaktorového ověření.",
        "Přihlášení pomocí Google: místo e-mailu a hesla se můžete přihlásit také pomocí účtu Google. Zvolíte-li tuto cestu, obdržíme od společnosti Google Ireland Limited výhradně vaši e-mailovou adresu, vaše jméno, váš profilový obrázek a identifikátor vašeho účtu Google (oblasti „openid“, „email“, „profile“) — výslovně žádný přístup k vašim e-mailům, kontaktům, souborům ani kalendářům. Vaše heslo ke Google se nedozvíme. Google zpracovává samotný přihlašovací proces jako samostatný správce; platí [zásady ochrany osobních údajů společnosti Google](https://policies.google.com/privacy). Právním základem je čl. 6 odst. 1 písm. b) GDPR, neboť přihlášení slouží plnění smlouvy; volba této cesty přihlášení je dobrovolná a lze ji kdykoli nahradit přihlášením e-mailem a heslem.",
        "Právním základem je čl. 6 odst. 1 písm. b) GDPR (plnění smlouvy o užívání, viz [VOP](" +
          AGB_URL +
          ")), pro zabezpečení přístupu čl. 6 odst. 1 písm. f) GDPR a pro uchovávání podle daňových a obchodněprávních předpisů čl. 6 odst. 1 písm. c) GDPR.",
      ],
    },
    {
      heading: "Rezervace, údaje hostů a údaje o objektech",
      paragraphs: [
        "Prostřednictvím platformy se zpracovávají rezervace, údaje hostů, zprávy, úkoly a vyúčtování. Patří k nim zejména jméno a kontaktní údaje hosta, příjezd a odjezd, počet cestujících, ceny a stav platby, historie zpráv a — pokud je podnik zaznamenává — ohlašovací údaje a zvláštní přání.",
        "Toto zpracování probíhá z pověření a podle pokynů příslušného podniku. Tyto údaje nepoužíváme pro vlastní účely, ani pro reklamu, ani pro trénování modelů umělé inteligence.",
        "V rámci jednoho podniku jsou údaje oddělené podle rolí: úklidové a servisní pracovní síly nevidí finanční a obchodní údaje, vlastníci pouze své vlastní objekty. Mezi různými podniky jsou údaje technicky oddělené (pravidla přístupu vázaná na jednotlivé nájemce přímo v databázi).",
      ],
    },
    {
      heading: "Zpracování platby",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Platby kartou a výplaty probíhají prostřednictvím společnosti Stripe Payments Europe, Limited, Irsko. Přitom jsou společnosti Stripe předávány údaje potřebné k platbě (částka, měna, platební prostředek, jméno, e-mailová adresa, referenční číslo rezervace) a u účtů našich zákazníků zákonem předepsané identifikační údaje (majitel, skuteční majitelé, údaje z průkazu totožnosti, bankovní spojení). Úplné údaje o platební kartě se do našich systémů nedostanou. Právními základy jsou čl. 6 odst. 1 písm. b) GDPR a pro identifikační povinnosti a povinnosti v oblasti předcházení praní špinavých peněz čl. 6 odst. 1 písm. c) GDPR. Podrobnosti upravují [zásady ochrany osobních údajů společnosti Stripe](https://stripe.com/privacy).",
            "Platební odkazy na doplňkové služby: vyúčtuje-li podnik svému hostovi doplňkovou službu (např. úklid nebo prádlo) prostřednictvím platebního odkazu, vede tento odkaz na platební stránku provozovanou společností Stripe. Předáváme za tím účelem společnosti Stripe označení služby, částku, měnu a interní odkaz na rezervaci a podnik; logo podniku se přenáší do jeho účtu Stripe, aby stránka nesla jeho značku. Na samotné platební stránce shromažďuje Stripe platební údaje a údaje o zařízení hosta ve vlastní odpovědnosti. K nám se zpět dostane pouze stav platby, částka, zadržené částky a identifikátory platby — žádné údaje o platební kartě.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Nabízí-li podnik PayPal jako způsob platby, jsou platební údaje předávány společnosti PayPal (Europe) S.à r.l. et Cie, S.C.A., Lucembursko. Platí [zásady ochrany osobních údajů společnosti PayPal](https://www.paypal.com/de/webapps/mpp/ua/privacy-full).",
          ],
        },
      ],
    },
    {
      heading: "Distribuční kanály a portály",
      paragraphs: [
        "Prodává-li podnik své objekty prostřednictvím portálů jako Booking.com, Airbnb nebo Expedia, jsou dostupnosti, ceny, restrikce a rezervační údaje vyměňovány s příslušným portálem prostřednictvím našeho dodavatele napojení Channex.io Ltd, Spojené království. Z tohoto směru dostáváme rezervační údaje a údaje hostů z portálu.",
        "Pro příslušný portál platí jeho vlastní pravidla ochrany osobních údajů; v tomto rozsahu je portál samostatným správcem. Právním základem předání je čl. 6 odst. 1 písm. b) GDPR ve spojení s pověřením podniku.",
      ],
    },
    {
      heading: "Komunikace",
      unterpunkte: [
        {
          titel: "E-mail",
          paragraphs: [
            "E-maily v rámci užívání (potvrzení rezervací, systémové zprávy, podpora, potvrzovací a pozvací odkazy) odesíláme a přijímáme prostřednictvím vlastního mailového serveru, který sami provozujeme. Pro tyto zprávy není zapojena žádná externí služba pro rozesílání.",
          ],
        },
        {
          titel: "Newsletter a předregistrace",
          paragraphs: [
            "Na našich webových stránkách se můžete zapsat k odběru novinek o myNextDays (předregistrace/newsletter). Zpracovávána je při tom vaše e-mailová adresa, jazyk a místo, na kterém jste se zapsali.",
            "Přihlášení probíhá metodou double opt-in: po zapsání obdržíte e-mail s potvrzovacím odkazem; přihlášení je účinné teprve kliknutím na něj. K prokázání souhlasu ukládáme čas přihlášení a potvrzení, přitom použitou IP adresu, identifikaci prohlížeče a znění, s nímž jste vyjádřili souhlas. Tyto údaje slouží výhradně k prokázání podle čl. 7 odst. 1 GDPR a nejsou vyhodnocovány pro reklamu.",
            "Právním základem je váš souhlas podle čl. 6 odst. 1 písm. a) GDPR; uchování dokladu opíráme o čl. 6 odst. 1 písm. c) ve spojení s čl. 7 odst. 1 GDPR. Souhlas můžete kdykoli s účinností do budoucna odvolat — prostřednictvím odhlašovacího odkazu v každém e-mailu s newsletterem nebo bez zvláštní formy e-mailem k nám. Odvolání nemá vliv na zákonnost zpracování provedeného do té doby.",
            "Pro správu a rozesílání newsletteru využíváme jako zpracovatele Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Francie; německá pobočka: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin). Předávána je vaše e-mailová adresa a uvedené doplňující údaje (jazyk, zdroj). Údaje jsou zpracovávány na serverech v Evropské unii (Francie a Německo); se společností Brevo je uzavřena smlouva o zpracování osobních údajů podle čl. 28 GDPR. Platí [zásady ochrany osobních údajů společnosti Brevo](https://www.brevo.com/legal/privacypolicy/).",
            "Odesíláme-li newsletter, měří Brevo z našeho pověření, zda byla zpráva otevřena a zda došlo ke kliknutí na obsažené odkazy. Toto měření nám pomáhá přizpůsobit obsah a frekvenci; je součástí souhlasu a končí vaším odhlášením. Ke spojování s jinými zdroji údajů ani k profilování nedochází.",
            "Dokud potvrzení chybí, není na vaši adresu nic zasíláno ani není předávána společnosti Brevo; nepotvrzený zápis propadá po sedmi dnech. Po odhlášení adresu pro rozesílání zablokujeme a doklad o souhlasu a odhlášení uchováváme tak dlouho, dokud z něj mohou být uplatňovány nároky; na vyžádání jej zcela vymažeme.",
          ],
        },
        {
          titel: "Zprávy v platformě",
          paragraphs: [
            "Zprávy mezi hostem a podnikem jsou ukládány v platformě, aby obě strany mohly nahlížet do jejich historie. Zablokuje-li podnik hosta, je komunikační kanál uzavřen; existující zprávy zůstávají zachovány pro dohledatelnost.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Využívá-li podnik napojení na WhatsApp, jsou obsahy zpráv a telefonní čísla zúčastněných předávány prostřednictvím WhatsApp Business Platform společnosti Meta Platforms Ireland Limited. O využití této funkce rozhoduje podnik; bez aktivace nedochází k žádnému předávání.",
          ],
        },
      ],
    },
    {
      heading: "Automatizované funkce a umělá inteligence",
      paragraphs: [
        "Pro zde popsané funkce platí vedle GDPR nařízení (EU) 2024/1689 (nařízení o umělé inteligenci, „AI Act“), jehož transparenční povinnosti podle čl. 50 jsou použitelné od 2. srpna 2026.",
      ],
      unterpunkte: [
        {
          titel: "Návrhy odpovědí",
          paragraphs: [
            "Pro návrhy odpovědí ve schránce zpráv využíváme — je-li tato funkce pro podnik aktivována — nabídku jazykových modelů společnosti Groq, Inc., USA. Přitom je této službě předán příslušný kontext zprávy. Návrhy nejsou odesílány automaticky; o odeslání vždy rozhoduje člověk. K automatizovanému rozhodování s právními účinky ve smyslu čl. 22 GDPR nedochází.",
            "Nejde tedy o systém umělé inteligence, který ve smyslu čl. 50 odst. 1 nařízení o umělé inteligenci přímo interaguje s fyzickými osobami: tato povinnost předpokládá PŘÍMOU interakci, při níž umělá inteligence komunikuje s osobou sama, a nikoli prostřednictvím lidského prostředníka. Zde funkce navrhne podniku text, který zaměstnanec zkontroluje, může jej změnit a sám jej odešle — zaměstnanec je tímto prostředníkem, host komunikuje s podnikem, a nikoli s chatbotem. Automaticky odpovídající asistent není v provozu. Podle našeho zařazení nesplňuje tato funkce ani žádnou ze skutkových podstat pro vysoce rizikovou umělou inteligenci podle přílohy III nařízení o umělé inteligenci.",
            "Zprávy hostům nejsou navíc „textem o otázkách veřejného zájmu“ ve smyslu čl. 50 odst. 4 nařízení o umělé inteligenci: nejsou zveřejňovány, nýbrž zasílány individuálně určité osobě, a týkají se organizace pobytu. Nezávisle na tom zde nastupuje lidská kontrola odesílajícím zaměstnancem.",
            "Bude-li v budoucnu nabízena funkce, která hostům odpovídá samostatně — bez lidského schválení —, bude host na začátku dialogu viditelně upozorněn na to, že píše se systémem umělé inteligence. Bez tohoto upozornění taková funkce poskytována nebude.",
          ],
        },
        {
          titel: "Role podle nařízení o umělé inteligenci",
          paragraphs: [
            "U funkcí umělé inteligence zabudovaných do produktu jsme provozovatelem (subjektem zavádějícím systém AI) ve smyslu čl. 3 bodu 4 nařízení o umělé inteligenci; poskytovateli základních jazykových modelů jsou příslušní poskytovatelé modelů. Využívá-li podnik tyto funkce v rámci své profesní činnosti, je za ně sám provozovatelem a dopadá na něj povinnost gramotnosti v oblasti umělé inteligence podle čl. 4 nařízení o umělé inteligenci, která platí od 2. února 2025 nezávisle na velikosti podniku. Od 27. července 2026 platí ve znění nařízení (EU) 2026/1744: poskytovatelé a provozovatelé přijímají opatření na podporu rozvoje gramotnosti svého personálu v oblasti umělé inteligence; určitá úroveň přitom výslovně zaručena být nemusí. Podporujeme prostřednictvím upozornění v aplikaci a v našem centru nápovědy; školení vlastních zaměstnanců zůstává úkolem podniku.",
            "Spojí-li podnik svůj účet s vlastním asistentem umělé inteligence (viz následující bod), je i za to provozovatelem ve smyslu nařízení o umělé inteligenci — rozhoduje o jeho použití a formuluje dotazy. Samotné rozhraní není systémem umělé inteligence: čte údaje z databáze a vydává je, aniž by činilo jakákoli odvození; bod 12 odůvodnění nařízení o umělé inteligenci takové systémy od umělé inteligence výslovně odlišuje.",
          ],
        },
        {
          titel: "Spojení s vlastním asistentem umělé inteligence",
          paragraphs: [
            "Podnik může svůj účet prostřednictvím rozhraní spojit s asistentem umělé inteligence, kterého si sám vybral a s nímž má vlastní smlouvu — například s Claude od Anthropic PBC, USA. Je-li takové spojení uděleno, může asistent na dotaz podniku načítat pro čtení: obsazenost, dostupnost a denní ceny; rezervace se jménem hosta, dobou pobytu, objektem, rezervačním kanálem, stavem a dále částkou a měnou, pokud role dotazujícího účtu smí částky vidět; a přehled konverzací ve schránce. Bez uděleného spojení nedochází k žádnému předávání.",
            "Předávány nejsou e-mailová adresa a telefonní číslo hostů, údaje o platebních kartách, bankovní spojení a platební doklady, přístupové kódy ani dokumentace objektů. Poznámky k rezervaci a obsah zpráv hostů jsou standardně vyloučeny, protože mohou obsahovat údaje o zdravotním stavu nebo jiné zvláštní kategorie podle čl. 9 GDPR; podnik je musí při udělení spojení výslovně a zvlášť uvolnit.",
            "Spojení může udělit pouze účet s rolí „administrátor“, nikoli každý účet s přístupem. Každé načtení je protokolováno a podnik do něj může nahlížet v části „Účet → Spojení“; tam může spojení kdykoli přerušit, čímž přístup okamžitě končí.",
            "Právně je toto předání pokynem podniku vůči nám (čl. 28 odst. 3 písm. a) GDPR). Poskytovatel asistenta není naším dalším zpracovatelem — nepověřujeme jej ani mu nedáváme pokyny; údaje zpracovává na základě smlouvy, kterou s ním podnik sám uzavřel. Za právní základ tohoto zpracování, za informování svých hostů a za záruky předání do třetí země proto odpovídá podnik.",
          ],
        },
        {
          titel: "Překlady",
          paragraphs: [
            "Texty objektů a obsahové texty mohou být překládány prostřednictvím Cloud Translation API společnosti Google Ireland Limited. Předávány jsou přitom texty, které mají být přeloženy; osobní údaje pouze v rozsahu, v jakém jsou v těchto textech obsaženy.",
          ],
        },
        {
          titel: "Cenová doporučení",
          paragraphs: [
            "Pro cenová doporučení přistupujeme k tržním, meteorologickým a kurzovým údajům z externích zdrojů. Tyto dotazy neobsahují žádné osobní údaje, nýbrž pouze místo, období a vlastnosti objektu.",
          ],
        },
      ],
    },
    {
      heading: "Webové stránky a domény našich zákazníků",
      paragraphs: [
        "Vytvoří-li podnik prostřednictvím page builderu vlastní webové stránky s vlastní doménou, spravujeme potřebné záznamy DNS prostřednictvím společnosti Cloudflare, Inc. Přitom jsou předávány údaje o doméně a konfiguraci; údaje návštěvníků zákaznických webových stránek zpracováváme způsobem popsaným v těchto zásadách.",
        "Za obsah, údaje o provozovateli (impresum) a informace o ochraně osobních údajů zákaznických webových stránek odpovídá příslušný podnik.",
      ],
    },
    {
      heading: "Hosting a ukládání",
      paragraphs: [
        "Platforma, databáze, média a mailový server běží na serverech společnosti Hetzner Online GmbH, Německo, v datovém centru Helsinki (Finsko) — tedy v Evropské unii. Se společností Hetzner je uzavřena smlouva o zpracování osobních údajů.",
        "Záložní kopie jsou vytvářeny zašifrovaně a zašifrovaně uchovávány u poskytovatele úložiště v EU.",
      ],
    },
    {
      heading: "Přehled příjemců",
      paragraphs: [
        "Kromě uvedených dodavatelů předáváme osobní údaje pouze tehdy, jsme-li k tomu povinni ze zákona (např. daňové orgány, orgány činné v trestním řízení), nebo pokud to požadujete vy či odpovědný podnik.",
      ],
      list: [
        "Hetzner Online GmbH (Německo/Finsko) — hosting, databáze, média, mailový server",
        "Stripe Payments Europe, Limited (Irsko) — platby, výplaty, ověření totožnosti",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Lucembursko) — platby, je-li aktivováno",
        "Channex.io Ltd (Spojené království) — napojení na rezervační portály",
        "Meta Platforms Ireland Limited (Irsko) — zprávy WhatsApp, je-li aktivováno",
        "Sendinblue SAS / Brevo (Francie, Německo) — správa a rozesílání newsletteru, pouze při souhlasu",
        "Google Ireland Limited (Irsko) — překlady; ochrana kontaktního formuláře proti spamu (reCAPTCHA Enterprise), pouze při souhlasu; přihlášení pomocí Google, je-li využito; Měření dosahu (Google Analytics 4), pouze se souhlasem",
        "Groq, Inc. (USA) — návrhy odpovědí, je-li aktivováno",
        "Cloudflare, Inc. (USA) — správa DNS pro zákaznické domény",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "V tomto seznamu nejsou služby, které si podnik sám sjedná s třetí stranou a prostřednictvím rozhraní spojí se svým účtem — například asistent umělé inteligence jako Claude od Anthropic PBC, USA. Nejde o dodavatele pověřené námi, nýbrž o příjemce na pokyn příslušného podniku; bez jeho spojení tam neproudí žádné údaje. Anthropic není podle oficiálního seznamu účastníků amerického ministerstva obchodu certifikován v rámci EU-US Data Privacy Framework; předání se proto opírá o standardní smluvní klauzule o ochraně osobních údajů, za které odpovídá příslušný podnik jako správce.",
          ],
        },
      ],
    },
    {
      heading: "Předávání do třetích zemí",
      paragraphs: [
        "Zpracování probíhá zásadně v Evropské unii. U výše uvedených služeb se sídlem mimo EU může docházet k předání do třetí země.",
        "U společností Groq, Inc. a Cloudflare, Inc. (USA) opíráme předání o standardní smluvní klauzule Evropské komise o ochraně osobních údajů podle čl. 46 odst. 2 písm. c) GDPR, pokud se příjemce nemůže dovolávat rozhodnutí o odpovídající ochraně (EU-US Data Privacy Framework).",
        "Smluvním partnerem pro zpracování platby je Stripe Payments Europe, Limited (Irsko). Pokud Stripe přitom využívá společnost Stripe, LLC (USA), je tato certifikována v rámci EU-US Data Privacy Framework; předání se v tomto rozsahu opírá o rozhodnutí Evropské komise o odpovídající ochraně podle čl. 45 GDPR. Doplňkově platí standardní smluvní klauzule o ochraně osobních údajů ze [smlouvy o zpracování osobních údajů se společností Stripe](https://stripe.com/legal/dpa).",
        "Pro Channex.io Ltd (Spojené království) platí rozhodnutí Evropské komise o odpovídající ochraně pro Spojené království; zanikne-li toto rozhodnutí, nastupují standardní smluvní klauzule o ochraně osobních údajů.",
      ],
    },
    {
      heading: "Přístup orgánů třetích států (US CLOUD Act)",
      paragraphs: [
        "Poskytovatelé, kteří podléhají americké právní jurisdikci, mohou být podle amerického CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018) povinni vydat údaje americkým orgánům — a to i tehdy, když tyto údaje leží na serverech v Evropské unii. Takový přístup může být v rozporu s GDPR a poskytovateli může být právně zapovězeno nás nebo vás o něm informovat. Toto riziko nevylučuje ani rozhodnutí o odpovídající ochraně k EU-US Data Privacy Framework, ani standardní smluvní klauzule o ochraně osobních údajů.",
        "Toto riziko omezujeme tím, že nosné systémy — platforma, databáze, média, mailový server a záložní kopie — jsou provozovány u evropských poskytovatelů v Evropské unii, kde se americká právní jurisdikce neuplatňuje.",
      ],
      unterpunkte: [
        {
          titel: "Dotčené služby",
          paragraphs: [
            "Americká právní jurisdikce přichází v úvahu výhradně u následujících, jasně vymezených doplňkových služeb:",
          ],
          list: [
            "Groq, Inc. (USA) — návrhy odpovědí ve schránce zpráv, pouze pokud podnik tuto funkci aktivuje. Předáván je příslušný kontext zprávy.",
            "Cloudflare, Inc. (USA) — správa DNS pro zákaznické domény. Předávány jsou údaje o doméně a konfiguraci, žádné údaje hostů.",
            "Google LLC (USA) – při přihlášení přes Google, při překladech a při měření dosahu (Google Analytics 4, pouze se souhlasem); smluvním partnerem je vždy Google Ireland Limited, přístup mateřské společnosti z USA však není vyloučen.",
          ],
        },
        {
          titel: "Odvratitelnost",
          paragraphs: [
            "Užívání platformy je bez těchto služeb možné: návrhy odpovědí lze vypnout, správa DNS se týká pouze zákazníků s vlastní doménou a přihlášení pomocí Google je dobrovolnou alternativou k přihlášení e-mailem a heslem.",
          ],
        },
        {
          titel: "Odlišení od evropského práva",
          paragraphs: [
            "CLOUD Act je americké právo, nikoli právo Evropské unie. Je třeba jej odlišovat od EU Data Act (nařízení (EU) 2023/2854), který upravuje změnu poskytovatele a přenositelnost u služeb zpracování dat, a dále od Cloud and AI Development Act, který se ke stavu těchto zásad nachází v evropském legislativním procesu.",
          ],
        },
      ],
    },
    {
      heading: "Doba uchování",
      list: [
        "Údaje o účtu: po dobu trvání obchodního vztahu; poté vymazání, pokud neexistuje povinnost uchování.",
        "Rezervační, fakturační a platební údaje: podle dánského zákona o účetnictví pět let po skončení účetního období, k němuž se vztahují; u zákazníků se sídlem v Německu mohou platit delší obchodněprávní a daňové lhůty.",
        "Zprávy a údaje hostů v platformě: podle pokynů odpovědného podniku, nejdéle do vymazání tímto podnikem, resp. do ukončení smlouvy.",
        "Newsletter: do odvolání souhlasu; nepotvrzená přihlášení propadají po sedmi dnech. Doklad o souhlasu a odhlášení zůstává nad tento rámec zachován tak dlouho, dokud je jako doklad potřebný.",
        "Protokoly přihlášení a bezpečnostní události: krátkodobě pro rozpoznávání útoků.",
        "Protokoly serveru: pouze tak dlouho, jak je to nezbytné pro provoz a bezpečnost.",
        "Záložní kopie: rotačně, dokud nejsou nahrazeny novějšími zálohami.",
      ],
    },
    {
      heading: "Vaše práva",
      paragraphs: [
        "Máte právo na přístup k údajům (čl. 15), na opravu (čl. 16), na výmaz (čl. 17), na omezení zpracování (čl. 18), na přenositelnost údajů (čl. 20) a právo vznést námitku proti zpracování na základě oprávněných zájmů (čl. 21 GDPR). Udělený souhlas můžete kdykoli s účinností do budoucna odvolat.",
        `Obraťte se za tím účelem na [${ANBIETER.email}](mailto:${ANBIETER.email}). Týkají-li se vaše údaje užívání platformy určitým podnikem, předáme váš dotaz odpovědnému podniku nebo jej podpoříme při jeho vyřízení.`,
        `Kromě toho můžete podat stížnost u dozorového úřadu pro ochranu osobních údajů — pro nás je příslušný ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Můžete se také obrátit na dozorový úřad v místě svého bydliště.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Ein Abschnitt „Ihre Rechte", der die
      // Löschung nur als DSGVO-Artikel erwähnt, genügt der Prüfung nicht —
      // gefordert ist der konkrete, benannte Weg.
      heading: "Vymazání účtu a údajů z aplikace",
      paragraphs: [
        "O vymazání svého účtu můžete kdykoli sami požádat — v aplikaci v části ‚Profil → Účet‘ nebo prostřednictvím našeho formuláře na webu:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "Cesta na webu funguje záměrně i tehdy, když už aplikaci nemáte nainstalovanou nebo se nemůžete přihlásit. Na ochranu před zneužitím to probíhá ve dvou krocích: zadáte e-mailovou adresu svého účtu a přesně na tuto adresu obdržíte potvrzovací odkaz. Žádost je platná teprve jeho vyvoláním — samotná zadaná adresa nemá žádný účinek. Žádost zpracujeme do 30 dnů a odpovíme e-mailem.",
        "Spolu s účtem vymažeme vaše přihlašovací údaje, váš profil, vaše údaje o objektech a kalendáři a vaše zprávy. Vymazány nejsou dokumenty, u nichž existuje zákonná povinnost uchování — zejména faktury a rezervační doklady vyúčtovaných období (účetní povinnost podle dánského práva, zpravidla pět let). Tyto dokumenty jsou po dobu trvání lhůty zablokovány, tedy uchovávány výhradně ke splnění této povinnosti, a poté vymazány.",
      ],
    },
    {
      heading: "Bezpečnost zpracování",
      paragraphs: [
        "Zpracování zajišťujeme technickými a organizačními opatřeními podle čl. 32 GDPR, zejména: průběžným šifrováním přenosu (TLS), pravidly přístupu vázanými na jednotlivé nájemce přímo v databázi, oprávněními podle rolí s oddělením finančních a servisních údajů, volitelným dvoufaktorovým ověřením, omezením počtu pokusů o přihlášení, zašifrovanými záložními kopiemi s pravidelným testem obnovy a dále protokolováním bezpečnostně relevantních událostí.",
      ],
    },
    {
      heading: "Povinnost poskytnutí údajů",
      paragraphs: [
        "Údaje, které potřebujeme pro uzavření smlouvy, vyúčtování a zákonné povinnosti, jsou nezbytné — bez nich nemůžeme platformu poskytovat. Všechny další údaje jsou dobrovolné.",
      ],
    },
    {
      heading: "Změny těchto zásad",
      paragraphs: [
        "Tyto zásady upravujeme, změní-li se zpracování, využívaní dodavatelé nebo právní úprava. Platí vždy zde zveřejněné znění; datum uvedené výše udává stav.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default datenschutz;
