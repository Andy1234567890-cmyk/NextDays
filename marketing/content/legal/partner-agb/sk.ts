// Partner-AGB — Slowakisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "Podmienky účasti v partnerskom programe myNextDays: atribúcia, základ provízie, úroveň, provízia tímu, zákazy, označenie, výplata.",
  numbered: false,
  toc: true,
  title: "Podmienky účasti v partnerskom programe (VOP pre partnerov) — Návrh",
  standIso: "2026-09-02",
  intro: [
    "NÁVRH — Tieto podmienky sú pracovnou verziou myNextDays a zatiaľ neboli právne preskúmané. Až do schválenia preskúmanej verzie sa považujú za popis programu, nie za konečný zmluvný text. Preskúmaná verzia bude zverejnená na tejto adrese s novým číslom verzie; partneri budú pri ďalšom prihlásení požiadaní o opätovný súhlas.",
    `Tieto podmienky účasti upravujú účasť v partnerskom programe (affiliate program) spoločnosti ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (ďalej len „myNextDays“ alebo „my“) prostredníctvom partnerov (ďalej len „partner“).`,
    "Partnerský program je určený pre fyzické osoby a spoločnosti so sídlom v EÚ, Švajčiarsku alebo Spojenom kráľovstve, ktoré odporúčajú prevádzky (prenajímatelia, agentúry, hotely) na myNextDays.",
  ],
  sections: [
    {
      heading: "§ 1 Účasť a schválenie",
      paragraphs: [
        "Účasť si vyžaduje žiadosť prostredníctvom partnerského panelu. Povinnými údajmi sú meno alebo názov spoločnosti, právna forma, krajina, minimálne jeden účet na sociálnych médiách s adresou, handle a dosahom, ako aj pre spoločnosti identifikačné číslo pre DPH.",
        "myNextDays posudzuje každú žiadosť osobne a slobodne rozhoduje o schválení. Neexistuje nárok na prijatie. Účasť je bezplatná; predplatné myNextDays nie je podmienkou.",
        "Partner udržiava svoje údaje aktuálne, najmä kanály, právnu formu, daňové a výplatné údaje.",
        "Uvedený dosah je spočiatku vlastné vyhlásenie. Partner môže dobrovoľne prepojiť svoje účty na YouTube, Instagrame, Facebooku a TikToku; potom sa sledujúci a zobrazenia načítajú z platformy a označia sa ako overené. Neoverený dosah sa pri schvaľovaní a pri neskorších kontrolách zohľadňuje menej. Prepojenie je možné kedykoľvek odpojiť v paneli; podrobnosti o spracovaní sú uvedené v zásadách ochrany osobných údajov.",
      ],
    },
    {
      heading: "§ 2 Priradenie prevádzok (atribúcia)",
      paragraphs: [
        "Prevádzka sa priradí partnerovi, ak sa zaregistruje s odporúčacím kódom partnera. Kód sa prevádzke viditeľne zobrazí pri registrácii a potvrdí sa odoslaním. Sledovacie súbory cookie sa nenastavujú.",
        "Prevádzka sa priradí presne jednému partnerovi; rozhodujúci je kód potvrdený pri registrácii. Neskôr sa prevádzka preusporiada len spoločnosťou myNextDays v prípade preukázanej chyby.",
        "Nepriradia sa prevádzky samotného partnera, jeho spoločníkov, zamestnancov alebo príbuzných, ako aj prevádzky, ktoré už sú alebo boli zákazníkmi myNextDays.",
      ],
    },
    {
      heading: "§ 3 Provízia za vlastných zákazníkov",
      paragraphs: [
        "Základom provízie je čistý obrat z predplatného priradenej prevádzky (základný tarif a moduly) z uhradených faktúr — bez DPH, bez portálových provízií, doplnkových služieb, dodatočných výpočtov a iných prechodných položiek.",
        "Sadzba provízie sa riadi hodnosťou partnera v čase platby. Hodnosti a sadzby sú zverejnené na stránke programu. Hodnosť sa určuje podľa počtu platiacich zákazníkov v štruktúre partnera: jeho vlastných platiacich zákazníkov a platiacich zákazníkov jeho tímových partnerov (§ 4), každý zákazník raz. Hodnosť sa stanovuje mesačne k rozhodujúcemu dňu; povýšenie platí okamžite, zníženie hodnosti až vtedy, ak počet klesol pod prahovú hodnotu počas dvoch po sebe nasledujúcich rozhodujúcich dní.",
        "Ak partner prvýkrát dosiahne hodnosť od „Aufsteiger“ (Stúpajúci), dostane jednorazovo bonus za povýšenie uvedený pre túto hodnosť na stránke programu (v súčasnosti 50,00 EUR za hodnosť, pre všetkých partnerov v eurách). Každá hodnosť sa odmeňuje len raz, a to aj po znížení hodnosti a opätovnom povýšení. Bonus podlieha storno oknu podľa § 7.",
        "Provízia vzniká pre každú prevádzku na dvanásť mesiacov od jej prvej platenej faktúry za predplatné; bezplatné skúšobné obdobie sprostredkované partnerom a bezplatný mesiac sa nezapočítavajú. Ak sa predplatné skončí skôr, provízia sa skončí s poslednou zaplatenou faktúrou.",
        "Od hodnosti „Elite-Partner“ (Elitný partner) dostane partner dodatočne superprovíziu vo výške uvedenej na stránke programu (v súčasnosti 2,5 %) z čistého obratu z predplatného všetkých zákazníkov jeho štruktúry – vlastných zákazníkov a zákazníkov jeho tímových partnerov – bez obmedzenia dvanástich mesiacov, pokiaľ príslušný zákazník má platené predplatné a partner má túto hodnosť v čase platby. Vzniká popri provízii podľa odseku 2 a § 4.",
        "Od hodnosti „Elite-Partner“ (Elitný partner) dostane partner za každú rezerváciu prevádzky, ktorá je priradená jemu alebo jednému z jeho tímových partnerov, prijatú a zaplatenú cez myBestDays, podiel z rezervácie vo výške uvedenej na stránke programu (v súčasnosti 0,5 %) z čiastky rezervácie zaplatenej hosťom v mene rezervácie, bez časového obmedzenia, pokiaľ priradenie trvá a partner má túto hodnosť v čase platby rezervácie. Kaucie nie sú čiastkou rezervácie. Vrátenie peňazí hosťovi znižuje podiel pomerne (§ 7).",
      ],
    },
    {
      heading: "§ 4 Tímová provízia",
      paragraphs: [
        "Od hodnosti „Aufsteiger“ (Stúpajúci) môže partner viesť tímových partnerov. Ak sa ďalší partner uchádza o členstvo prostredníctvom tímového odkazu partnera a viditeľne potvrdí jeho kód vo svojej žiadosti, bude po jeho schválení priradený k tímu partnera (ďalej len „Sponzor“). Ak Sponzor nemá túto hodnosť v čase podania žiadosti, žiadosť zostáva platná, ale tímové priradenie nevzniká.",
        "Sponzor dostane z čistého obratu z predplatného zákazníkov svojich tímových partnerov tímovú províziu vo výške rozdielu medzi jeho vlastnou sadzbou provízie a sadzbou provízie tímového partnera, vždy podľa hodnosti v čase platby. Ak sú obaja v rovnakej hodnosti alebo tímový partner je vyššie, tímová provízia nevzniká. Provízia tímového partnera a tímová provízia Sponzora spolu nikdy neprekročia najvyššiu sadzbu stupnice (v súčasnosti 30 %).",
        "Tímová provízia existuje presne jednu úroveň hlboko: Tímoví partneri nedostávajú tímovú províziu za partnerov, ktorých sami získajú. Za získanie partnera sa neplatí žiadna odmena; neúčtuje sa žiadny účastnícky poplatok. Tímová provízia vzniká výlučne z platených príjmov z predplatného.",
        "Tímová provízia plynie pre každého tímového zákazníka dvanásť mesiacov od jeho prvej zaplatenej faktúry, podlieha rovnakému obdobiu pre vrátenie peňazí a v prípade vrátenia alebo stornovania sa pomerná časť stiahne (§ 7). Vzniká len dovtedy, kým sú sponzor a tímový partner schválení; inak sa pozastaví až do vyjasnenia.",
        "Priradenie tímu je jednorazové. Zmena sa uskutoční len spoločnosťou myNextDays s dokumentovaným dôvodom.",
      ],
    },
    {
      heading: "§ 5 Povinnosti partnera a označenie",
      paragraphs: [
        "Partner označí každé odporúčanie svojím odkazom alebo kódom ako reklamu – na začiatku príspevku, v jazyku príspevku, v súlade s požiadavkami svojej krajiny (v Nemecku okrem iného § 5a ods. 4 UWG, v Dánsku markedsføringsloven § 6 ods. 4). Znenia pre jednotlivé krajiny poskytuje myNextDays v partnerskom paneli.",
        "Partner poskytuje o myNextDays len informácie, ktoré zodpovedajú zverejneným popisom služieb, a neposkytuje žiadne prísľuby v mene myNextDays. Zakázané sú najmä prísľuby úspechu a záruky (napríklad „garantovaná plná obsadenosť za tri dni“) a vyhlásenia o príjmoch, ktoré nevyplývajú zo zverejnených popisov služieb.",
        "Každé video a každý príspevok, ktorý spomína myNextDays alebo obsahuje odkaz partnera, sa pred zverejnením predloží ako súbor v partnerskom paneli na kontrolu. Odkaz partnera vzniká až po písomnom schválení spoločnosťou myNextDays; zverejnenie bez schválenia je zakázané. myNextDays môže schválenie odvolať; už vzniknuté provízie zostávajú nedotknuté.",
        "Pre logá, snímky obrazovky, B-Roll, prekrytia a snímky obrazovky používa partner výlučne reklamný materiál poskytnutý spoločnosťou myNextDays. Vlastné, nekontrolované softvérové záznamy nie sú povolené.",
      ],
    },
    {
      heading: "§ 6 Zakázané praktiky",
      paragraphs: ["Zakázané sú najmä:"],
      list: [
        "Brand-Bidding: platené reklamy na značku „myNextDays“, varianty písania a kombinácie (napr. „myNextDays ceny“) vo vyhľadávačoch a sieťach;",
        "Cookie-Dropping, skryté presmerovania, iFrames, automatické volanie partnerského odkazu alebo iná technická manipulácia s priradením;",
        "Vlastná reklama: registrácia vlastných prevádzok, spoločníkov, zamestnancov alebo príbuzných prostredníctvom vlastného kódu alebo kódu tímového partnera;",
        "Kúpený dosah (kúpení sledovatelia, klikacie farmy, bot-traffic) a stimuly pre prevádzky na registráciu (spätné platby, darčeky, súťaže);",
        "Prísľuby náboru: nábor partnerov s prísľubmi zárobku, ktoré nepochádzajú z platených príjmov z predplatného, alebo prezentácia programu ako zdroja príjmov prostredníctvom náboru ďalších partnerov;",
        "Spam, neoprávnená priama reklama a používanie cudzích značiek alebo obsahu bez oprávnenia.",
      ],
    },
    {
      heading: "§ 7 Obdobie na vrátenie, stiahnutie, zadržanie",
      paragraphs: [
        "Každá provízna položka je po svojom vzniku otvorená 30 dní (obdobie na vrátenie) a potom je splatná. Ak je základná faktúra úplne alebo čiastočne vrátená alebo stornovaná (chargeback), provízia – vrátane tímovej provízie založenej na nej – sa pomerne stiahne, a to aj po vyplatení prostredníctvom započítania s budúcimi províziami.",
        "V prípade podozrenia z porušenia § 2, § 5 alebo § 6 môže myNextDays pozastaviť priradenia a provízie až do objasnenia. Ak sa porušenie potvrdí, dotknuté provízie zanikajú.",
      ],
    },
    {
      heading: "§ 8 Vyplatenie a dobropis",
      paragraphs: [
        "Splatné provízie sa mesačne zoskupujú podľa meny a vyplácajú sa, akonáhle dosiahnu minimálnu sumu príslušnej meny uvedenú na stránke programu alebo v dashboarde. Prepočet medzi menami sa nevykonáva.",
        "Vyúčtovanie sa vykonáva prostredníctvom dobropisu (samofakturácia, momsloven § 52a): myNextDays vystaví dobropis za každú platbu; partner nevystavuje faktúru. Partner súhlasí s postupom dobropisu.",
        "Podnikatelia dostanú dobropis s odkazom na prenesenie daňovej povinnosti na príjemcu služby (reverse charge); podmienkou je platné, potvrdené identifikačné číslo pre DPH. Súkromné osoby dostanú dobropis bez DPH a províziu si zdaňujú sami.",
        "Vyplatenie sa vykonáva prostredníctvom SEPA prevodu, Wise alebo PayPal na údaje, ktoré partner uložil v dashboarde.",
      ],
    },
    {
      heading: "§ 9 Údaje a nahliadnutie",
      paragraphs: [
        "Partner vidí priradené prevádzky pseudonymne (číslo, krajina, stav, sumy). Mená, e-mailové adresy alebo údaje o rezerváciách prevádzok sa nezverejňujú. Sponzor vidí od svojich tímových partnerov meno alebo firmu, hodnosť, počet platiacich zákazníkov a z toho vyplývajúcu tímovú províziu, nie však podrobnosti o zákazníkoch.",
        "Pre prepojené účty a vytvorené príspevky myNextDays vidí sledovateľov, zobrazenia, interakcie, ako aj kliknutia a zákazníkov pre každý príspevok. Nezrovnalosti (napríklad skok v počte sledovateľov bez zodpovedajúcich zobrazení alebo výrazná odchýlka medzi vlastným vyhlásením a overenou hodnotou) sú indikátormi pre osobné preskúmanie podľa § 6 a § 10, nie automatické zablokovanie.",
        "Spracovanie osobných údajov v partnerskom programe je popísané v zásadách ochrany osobných údajov.",
      ],
    },
    {
      heading: "§ 10 Trvanie, zablokovanie a výpoveď",
      paragraphs: [
        "Účasť je na dobu neurčitú a môže byť kedykoľvek ukončená oboma stranami v textovej forme. Už vzniknuté, splatné provízie sa vyplatia podľa § 8; po ukončení nevznikajú žiadne nové provízie.",
        "myNextDays môže partnera zablokovať v prípade porušenia týchto podmienok. Počas zablokovania sa provízie pozastavia; v prípade potvrdeného porušenia zanikajú.",
      ],
    },
    {
      heading: "§ 11 Zmeny",
      paragraphs: [
        "myNextDays môže tieto podmienky a stupnicu zmeniť s účinnosťou do budúcnosti. Zmeny budú zverejnené na partnerskom paneli a na tejto stránke s číslom verzie; v prípade podstatných zmien bude partner požiadaný o opätovný súhlas. Už vzniknuté provízie zostávajú nedotknuté.",
      ],
    },
    {
      heading: "§ 12 Rozhodné právo",
      paragraphs: [
        "Uplatňuje sa dánske právo s vylúčením kolíznych noriem. Povinné ustanovenia na ochranu spotrebiteľa štátu, v ktorom má súkromný partner svoje obvyklé bydlisko, zostávajú nedotknuté.",
      ],
    },
  ],
};
