// Slowakische Übersetzung von ./de.ts (Vereinbarung zur Auftragsverarbeitung).
//
// Inhaltliche Änderungen gehören ZUERST in ./de.ts und werden von dort in alle
// Sprachfassungen übernommen — hier wird nur übersetzt, nie ergänzt.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Zmluva o spracúvaní osobných údajov",
  metaDescription:
    "Spracúvanie osobných údajov podľa článku 28 GDPR medzi myNextDays ApS a podnikmi, ktoré používajú platformu: predmet, pokyny, bezpečnosť, ďalší sprostredkovatelia.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Táto zmluva (ďalej len „zmluva o spracúvaní“) platí medzi podnikom, ktorý používa platformu myNextDays (ďalej len „prevádzkovateľ“), a spoločnosťou ${ANBIETER.firma} (ďalej len „sprostredkovateľ“ alebo „my“) a konkretizuje povinnosti podľa článku 28 nariadenia (EÚ) 2016/679 (GDPR).`,
    `Je zahrnutá prostredníctvom [Všeobecných obchodných podmienok](${AGB_URL}) a platí po celú dobu používania platformy. Má prednosť pred VOP, pokiaľ ide o spracúvanie osobných údajov v mene prevádzkovateľa.`,
    "Doplňujúco platia [Zásady ochrany osobných údajov](/datenschutz) pre údaje, ktoré spracúvame ako samostatný prevádzkovateľ — najmä údaje o účte a o obchodnom vzťahu.",
  ],
  sections: [
    {
      heading: "Predmet a rozdelenie úloh",
      unterpunkte: [
        {
          paragraphs: [
            "Predmetom je spracúvanie osobných údajov, ktoré prevádzkovateľ vkladá do platformy alebo prostredníctvom nej získava, aby sme mohli poskytovať zmluvne dohodnuté služby: správu objektov, rezervácií a obsadenosti, komunikáciu s hosťami, spracovanie platieb, účtovníctvo a vyúčtovanie pre vlastníkov, napojenie na rezervačné portály, tvorbu webových stránok, ako aj správu úloh a tímu.",
          ],
        },
        {
          paragraphs: [
            "O účeloch a prostriedkoch tohto spracúvania rozhoduje prevádzkovateľ. Údaje spracúvame výlučne na základe jeho zdokumentovaných pokynov a nie na vlastné účely.",
          ],
        },
        {
          paragraphs: [
            "Pri údajoch o účte, o vyúčtovaní našich vlastných služieb, o bezpečnosti systému a o zákonnom uchovávaní sme prevádzkovateľom my sami. Toto spracúvanie nie je predmetom tejto zmluvy o spracúvaní.",
          ],
        },
      ],
    },
    {
      heading: "Povaha, rozsah a účel spracúvania",
      paragraphs: [
        "Spracúva sa získavaním, uchovávaním, zobrazovaním, zmenou, prenosom príjemcom, ktorých si zvolil prevádzkovateľ (napr. rezervačné portály, poskytovatelia platobných služieb), obmedzením a vymazaním — v automatizovanej podobe v platforme.",
        "Miestom spracúvania je Európska únia; výnimky sú vyčerpávajúco uvedené v oddiele 8.",
      ],
    },
    {
      heading: "Kategórie dotknutých osôb",
      list: [
        "Hostia a osoby, ktoré rezervujú, vrátane spolucestujúcich",
        "Záujemcovia, ktorí zasielajú dopyty alebo správy",
        "Vlastníci spravovaných objektov",
        "Zamestnanci prevádzkovateľa (tím, úklid, servis, recepcia)",
        "Kontaktné osoby partnerov a dodávateľov prevádzkovateľa",
      ],
    },
    {
      heading: "Kategórie osobných údajov",
      list: [
        "Základné údaje: meno, adresa, dátum narodenia, ak sa zaznamenáva, štátna príslušnosť, ak sa zaznamenáva na účely ohlasovacej povinnosti",
        "Kontaktné údaje: e-mailová adresa, telefónne číslo",
        "Údaje o rezervácii: obdobie, objekt, počet cestujúcich, ceny, doplnkové služby, zrušenia",
        "Platobné údaje: suma, mena, spôsob platby, stav platby, referencie (úplné údaje o platobnej karte sa do našich systémov nedostanú)",
        "Komunikačné údaje: správy, poznámky, hodnotenia",
        "Prístupové a používateľské údaje zamestnancov: rola, oprávnenia, čas prihlásenia, zariadenie a IP adresa prihlásenia",
        "Osobitné kategórie podľa článku 9 GDPR nie sú predmetom zmluvy; prevádzkovateľ takéto údaje nevkladá do polí s voľným textom.",
      ],
    },
    {
      heading: "Pokyny",
      unterpunkte: [
        {
          paragraphs: [
            "Pokyny udeľuje prevádzkovateľ používaním a konfiguráciou platformy, ako aj v textovej forme na našu kontaktnú adresu. Ústne pokyny potvrdzujeme v textovej forme.",
          ],
        },
        {
          paragraphs: [
            "Ak považujeme pokyn za nezákonný, bezodkladne to oznámime a jeho vykonanie môžeme pozastaviť, kým ho prevádzkovateľ nepotvrdí alebo nezmení.",
          ],
        },
        {
          paragraphs: [
            "Ak sme na spracúvanie povinní podľa zákona (napríklad voči orgánom), informujeme prevádzkovateľa vopred, pokiaľ nám to právo dovoľuje.",
          ],
        },
        {
          titel: "Prepojenie vlastných služieb prevádzkovateľa",
          paragraphs: [
            "Prevádzkovateľ môže svoj účet prostredníctvom rozhrania prepojiť so službou, ktorú si sám vybral a s ktorou uzavrel vlastnú zmluvu — napríklad s asistentom s umelou inteligenciou. Ak takéto prepojenie udelí, je to jeho výslovný pokyn podľa článku 28 odseku 3 písmena a) GDPR vydať sprístupnené údaje tejto službe. Výslovne zahŕňa aj s tým spojený prenos do tretej krajiny, ak má služba sídlo mimo Európskej únie.",
            "Stručne povedané: o takomto prepojení rozhoduje výlučne prevádzkovateľ a za prepojenú službu je zodpovedný on sám.",
            "Udeliť ho môže len účet s oprávnením spravovať externé prepojenia. Toto oprávnenie je vyhradené role „Administrátor“; účty s obmedzenými právami — vrátane roly „Spoluadministrátor“ — prepojenie udeliť nemôžu. Zaznamenávame, kto ho kedy a pre ktorú službu udelil, ktoré druhy údajov boli sprístupnené a ktoré načítania sa uskutočnili; tento záznam je prevádzkovateľovi k dispozícii v rozhraní pod „Účet → Prepojenia“, aby mohol splniť svoju povinnosť zodpovednosti a odpovedať na žiadosti o prístup.",
            "Prepojená služba nie je naším ďalším sprostredkovateľom: nepoverujeme ju, nevyberáme ju ani jej nedávame pokyny. Údaje spracúva na základe zmluvy, ktorú s ňou uzavrel sám prevádzkovateľ. Za toto spracúvanie, za jeho právny základ a za garancie prenosu do tretej krajiny je preto zodpovedný prevádzkovateľ; nie je predmetom tejto zmluvy o spracúvaní.",
            "Polia s voľným textom — poznámky k rezervácii a obsah správ hostí — sú z takéhoto prepojenia štandardne vyňaté. Môžu obsahovať osobitné kategórie osobných údajov podľa článku 9 GDPR, napríklad údaje o zdraví. Prevádzkovateľ ich musí pri udelení sprístupniť osobitne; bez tohto sprístupnenia sa neprenášajú.",
            "Prevádzkovateľ môže udelené prepojenie kedykoľvek v rozhraní odpojiť. Obnovovacie tokeny sa pritom vymažú a pri každom ďalšom načítaní sa overuje, či súhlas ešte trvá — odpojená služba preto nemôže okamžite už nič čítať, nie až po uplynutí platnosti jej prístupového tokenu.",
          ],
        },
      ],
    },
    {
      heading: "Mlčanlivosť",
      paragraphs: [
        "Všetky osoby, ktoré môžu mať v súlade so zmluvou prístup k údajom, sú povinné zachovávať mlčanlivosť a sú pravidelne poučované o ochrane osobných údajov. Prístup je obmedzený na rozsah potrebný na príslušnú úlohu.",
        "Naši zamestnanci pristupujú k údajom zákazníkov len na odstránenie chýb, na žiadosť podpory alebo na splnenie zákonných povinností.",
      ],
    },
    {
      heading: "Bezpečnosť spracúvania",
      paragraphs: [
        "Prijímame technické a organizačné opatrenia požadované podľa článku 32 GDPR. Zavedené sú najmä:",
      ],
      list: [
        "Šifrovanie prenosu (TLS) pre všetky spojenia, bezpečnostné HTTP hlavičky vrátane striktnej Content-Security-Policy",
        "Oddelenie mandantov priamo v databáze: pravidlá prístupu na úrovni riadkov (Row Level Security) a odobrané práva k tabuľkám pre citlivé údaje, takže prístup mimo vlastného podniku je vylúčený aj priamou cestou do databázy",
        "Oprávnenia podľa rol s oddelením údajov: servisní a úklidoví pracovníci nedostávajú finančné a obchodné údaje, vlastníci len svoje vlastné objekty; údaje hostí sa pre neoprávnené roly maskujú",
        "Dvojfaktorové overenie (TOTP) dostupné pre účty; opakované prihlásenie pri zmenách kritických z hľadiska bezpečnosti",
        "Protokol prihlásení so zariadením, časom a IP adresou, prístupný prevádzkovateľovi",
        "Prepojenia s externými službami môže udeliť len účet s rolou „Administrátor“; každé načítanie prostredníctvom takéhoto prepojenia sa protokoluje (nástroj, čas, rozsah — bez samotného obsahu) a je pre prevádzkovateľa prístupné. Odpojené prepojenie stráca prístup okamžite: pri každom načítaní sa overuje, či súhlas ešte trvá",
        "Obmedzenie frekvencie požiadaviek proti automatizovaným útokom, overovanie podpisov prichádzajúcich Webhook volaní",
        "Šifrované záložné kópie uložené mimo produkčného systému s pravidelným testom obnovy",
        "Oddelené prostredia pre vývoj a prevádzku; zmeny v databáze výlučne prostredníctvom verzionovaných migrácií",
      ],
    },
    {
      heading: "Ďalší sprostredkovatelia",
      paragraphs: [
        "Prevádzkovateľ schvaľuje zapojenie nasledujúcich ďalších sprostredkovateľov. S každým z nich existujú zmluvy podľa článku 28 odseku 4 GDPR s povinnosťami, ktoré zodpovedajú tejto zmluve o spracúvaní.",
      ],
      list: [
        "Hetzner Online GmbH, Nemecko (servery, databáza, médiá, mailový server; dátové centrum Helsinki, Finsko)",
        "Stripe Payments Europe, Limited, Írsko (platby, výplaty, zákonné overenie totožnosti)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxembursko (platby, ak ich prevádzkovateľ aktivuje)",
        "Channex.io Ltd, Spojené kráľovstvo (napojenie na rezervačné portály, ak je aktivované)",
        "Meta Platforms Ireland Limited, Írsko (správy WhatsApp, ak je aktivované)",
        "Google Ireland Limited, Írsko (preklad obsahu; prihlásenie pomocou Google, ak sa používa)",
        "Groq, Inc., USA (návrhy odpovedí v doručenej pošte, ak je aktivované)",
        "Cloudflare, Inc., USA (správa DNS záznamov pre vlastné domény, ak sa používa)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Zmenu alebo doplnenie oznámime najmenej 30 dní vopred. Prevádzkovateľ môže v tejto lehote vzniesť námietku z vážneho dôvodu súvisiaceho s ochranou osobných údajov; ak námietka nie je odstránená, môže vypovedať dotknutú časť služby alebo celú zmluvu.",
          ],
        },
        {
          paragraphs: [
            "Služby, ktoré si prevádzkovateľ sám dohodne s tretej stranou, nie sú spracúvaním prostredníctvom ďalšieho sprostredkovateľa, ale prenosom, ktorý inicioval on. To platí pre rezervačný portál, s ktorým má vlastnú zmluvu, rovnako ako pre asistenta s umelou inteligenciou alebo iný program, ktorý prostredníctvom rozhrania prepojí so svojím účtom (pozri oddiel „Pokyny“).",
            "Rozhodujúce pritom nie je, cez čie systémy údaje tečú, ale kto službu privoláva: spracúvanie prostredníctvom ďalšieho sprostredkovateľa vzniká, keď MY poveríme ďalšieho dodávateľa, aby sme poskytli našu službu. Ak si službu vyberie prevádzkovateľ sám a zmluvu s ňou uzavrie on, spracúva táto služba pre prevádzkovateľa — nie pre nás. Toto rozlíšenie zodpovedá zmluvnej praxi porovnateľných poskytovateľov pri službách tretích strán prepojených zákazníkom.",
          ],
        },
      ],
    },
    {
      heading: "Prenos do tretích krajín",
      paragraphs: [
        "Prenosy príjemcom mimo EÚ sa obmedzujú na služby uvedené vyššie so sídlom v USA, resp. v Spojenom kráľovstve. Základom sú štandardné zmluvné klauzuly Európskej komisie podľa článku 46 odseku 2 písmena c) GDPR alebo platné rozhodnutie o primeranosti; uplatňujú sa doplňujúce ochranné opatrenia (šifrovanie, minimalizácia údajov).",
      ],
    },
    {
      heading: "Podpora prevádzkovateľa",
      unterpunkte: [
        {
          paragraphs: [
            "Prevádzkovateľa podporujeme pri odpovedaní na žiadosti dotknutých osôb (články 15 až 22 GDPR). Platforma na to poskytuje prístup k údajom, ich opravu, export a vymazanie priamo v rozhraní. Ak sa dotknuté osoby obrátia priamo na nás, odkážeme ich na prevádzkovateľa a informujeme ho.",
          ],
        },
        {
          paragraphs: [
            "Ďalej podporujeme pri posúdeniach vplyvu na ochranu údajov, pri plnení povinností podľa článkov 32 až 36 GDPR a pri žiadostiach dozorných orgánov.",
          ],
        },
      ],
    },
    {
      heading: "Porušenia ochrany osobných údajov",
      paragraphs: [
        "Ak sa dozvieme o porušení ochrany osobných údajov, ktoré sa týka údajov prevádzkovateľa, informujeme ho o tom bezodkladne, najneskôr do 48 hodín od zistenia, v textovej forme.",
        "Oznámenie obsahuje, pokiaľ je to známe, povahu a čas incidentu, dotknuté kategórie údajov a skupiny osôb, pravdepodobné dôsledky a prijaté aj navrhované opatrenia. Prevádzkovateľa podporujeme pri jeho povinnostiach ohlasovania a oznamovania podľa článkov 33 a 34 GDPR.",
      ],
    },
    {
      heading: "Doklady a kontroly",
      unterpunkte: [
        {
          paragraphs: [
            "Dodržiavanie tejto zmluvy o spracúvaní preukazujeme na požiadanie, najmä poskytnutím informácií o prijatých opatreniach a o zapojených ďalších sprostredkovateľoch.",
          ],
        },
        {
          paragraphs: [
            "Prevádzkovateľ môže vykonať kontroly v potrebnom rozsahu alebo ich dať vykonať nezávislým audítorom, ktorý s nami nie je v konkurenčnom vzťahu. Kontroly sa uskutočňujú po ohlásení v primeranej lehote, počas obvyklých pracovných hodín a bez narušenia prevádzky. Náklady na preverenie, ktoré presahuje poskytnutie informácií, nesie prevádzkovateľ, ak preverenie nie je vyvolané incidentom spôsobeným nami.",
          ],
        },
      ],
    },
    {
      heading: "Vymazanie a vrátenie",
      paragraphs: [
        "Po ukončení zmluvy poskytneme údaje prevádzkovateľa na požiadanie do 30 dní na export v bežnom, strojovo čitateľnom formáte. Následne údaje vrátane kópií vymažeme.",
        "Vyňaté sú údaje, pri ktorých existuje zákonná povinnosť uchovávania (najmä fakturačné a účtovné údaje); tie sa zablokujú a po uplynutí lehoty vymažú. Záložné kópie sa prepíšu v rámci pravidelného rotačného cyklu.",
      ],
    },
    {
      heading: "Zodpovednosť a poradie platnosti",
      paragraphs: [
        "Platí článok 82 GDPR. Vo vzťahu medzi stranami platia okrem toho pravidlá zodpovednosti podľa VOP, pokiaľ nie sú v rozpore s GDPR.",
        "Ak si VOP a táto zmluva o spracúvaní pri spracúvaní v mene prevádzkovateľa protirečia, platí táto zmluva o spracúvaní. Ak sa niektoré ustanovenie stane neúčinným, ostatný obsah zostáva účinný; strany ho nahradia prípustnou úpravou s rovnakým účelom.",
      ],
    },
    {
      heading: "Zmeny tejto zmluvy",
      paragraphs: [
        "Túto zmluvu o spracúvaní môžeme upraviť, pokiaľ je to potrebné z dôvodu zmien právnych predpisov, požiadaviek dozorných orgánov, pokynov poskytovateľov platobných služieb alebo technického rozvoja a prevádzkovateľ tým nie je znevýhodnený.",
        "Zmeny oznámime v textovej forme najmenej 30 dní pred nadobudnutím účinnosti. Ak prevádzkovateľ v tejto lehote nevznesie námietku, považujú sa za prijaté; na tento následok sa v oznámení upozorňuje. V prípade námietky môže každá strana zmluvu vypovedať k dátumu nadobudnutia účinnosti.",
      ],
    },
    {
      heading: "Kontakt",
      paragraphs: [
        `Žiadosti k tejto zmluve, pokyny a oznámenia zasielajte na [${ANBIETER.email}](mailto:${ANBIETER.email}) alebo na adresu ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
