// Partner-AGB — Tschechisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "Podmínky účasti v partnerském programu myNextDays: atribuce, základ provize, úroveň, týmová provize, zákazy, označení, výplata.",
  numbered: false,
  toc: true,
  title: "Podmínky účasti v partnerském programu (Partnerské VOP) — Návrh",
  standIso: "2026-09-02",
  intro: [
    "NÁVRH — Tyto podmínky jsou pracovním stavem myNextDays a dosud nebyly právně prověřeny. Do schválení prověřené verze platí jako popis programu, nikoli jako konečný smluvní text. Prověřená verze bude zveřejněna na této adrese s novým číslem verze; partneři budou při příštím přihlášení požádáni o opětovný souhlas.",
    `Tyto podmínky účasti upravují účast v partnerském programu (affiliate programu) společnosti ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (dále jen „myNextDays“ nebo „my“) prostřednictvím partnerů (dále jen „Partner“).`,
    "Partnerský program je určen pro osoby a společnosti se sídlem v EU, Švýcarsku nebo Spojeném království, které doporučují provozovny (pronajímatele, agentury, hotely) na myNextDays.",
  ],
  sections: [
    {
      heading: "§ 1 Účast a schválení",
      paragraphs: [
        "Účast vyžaduje podání žádosti prostřednictvím partnerského panelu. Povinnými údaji jsou jméno nebo název společnosti, právní forma, země, minimálně jeden účet na sociálních médiích s adresou, handlem a dosahem a u společností identifikační číslo pro DPH.",
        "myNextDays posuzuje každou žádost osobně a o schválení rozhoduje volně. Neexistuje nárok na přijetí. Účast je bezplatná; předplatné myNextDays není podmínkou.",
        "Partner udržuje své údaje aktuální, zejména kanály, právní formu, daňové a výplatní údaje.",
        "Uvedený dosah je zpočátku vlastní prohlášení. Partner může dobrovolně propojit své účty na YouTube, Instagramu, Facebooku a TikToku; poté budou sledující a zhlédnutí načteny z platformy a označeny jako ověřené. Neověřený dosah bude při schválení a při pozdějších kontrolách vážen méně. Propojení lze kdykoli odpojit v panelu; podrobnosti o zpracování jsou uvedeny v zásadách ochrany osobních údajů.",
      ],
    },
    {
      heading: "§ 2 Přiřazení provozoven (Atribuce)",
      paragraphs: [
        "Provozovna je Partnerovi přiřazena, pokud se zaregistruje s doporučujícím kódem Partnera. Kód je provozovně viditelně zobrazen při registraci a potvrzen odesláním. Sledovací cookies nejsou nastaveny.",
        "Provozovna je přiřazena přesně jednomu Partnerovi; rozhodující je kód potvrzený při registraci. Pozdější přeřazení provede myNextDays pouze v případě prokázané chyby.",
        "Nejsou přiřazeny provozovny samotného Partnera, jeho společníků, zaměstnanců nebo příbuzných, ani provozovny, které již jsou nebo byly zákazníky myNextDays.",
      ],
    },
    {
      heading: "§ 3 Provize z vlastních zákazníků",
      paragraphs: [
        "Základem provize je čistý obrat z předplatného přiřazené provozovny (základní tarif a moduly) z uhrazených faktur — bez DPH, bez provizí portálu, doplňkových služeb, dodatečných výpočtů a jiných průběžných položek.",
        "Sazba provize se řídí hodností partnera v okamžiku platby. Hodnosti a sazby jsou zveřejněny na stránce programu. Hodnost se určuje podle počtu platících zákazníků ve struktuře partnera: jeho vlastní platící zákazníci a platící zákazníci jeho týmových partnerů (§ 4), každý zákazník jednou. Hodnost se stanovuje měsíčně k rozhodnému dni; povýšení platí okamžitě, snížení hodnosti až tehdy, když počet po dva po sobě jdoucí rozhodné dny klesl pod prahovou hodnotu.",
        "Pokud partner poprvé dosáhne hodnosti od „Aufsteiger“ (Stoupající), obdrží jednorázově bonus za povýšení, který je pro tuto hodnost uveden na stránce programu (aktuálně 50,00 EUR za hodnost, pro všechny partnery v eurech). Každá hodnost je odměněna pouze jednou, a to i po snížení hodnosti a opětovném povýšení. Bonus podléhá lhůtě pro vrácení peněz dle § 7.",
        "Provize vzniká za každý provoz po dobu dvanácti měsíců od jeho první faktury za placené předplatné; bezplatné zkušební období a bezplatný měsíc zprostředkované partnerem se nezapočítávají. Pokud předplatné skončí dříve, provize končí s poslední zaplacenou fakturou.",
        "Od hodnosti „Elite-Partner“ (Elitní partner) obdrží partner dodatečně superprovizi ve výši uvedené na stránce programu (aktuálně 2,5 %) z čistého obratu z předplatného všech zákazníků ve své struktuře – vlastní zákazníci a zákazníci jeho týmových partnerů – bez omezení dvanácti měsíců, dokud příslušný zákazník drží placené předplatné a partner má tuto hodnost v okamžiku platby. Vzniká vedle provize dle odstavce 2 a § 4.",
        "Za každou rezervaci provozu, která je přiřazena partnerovi nebo jednomu z jeho týmových partnerů a která je přijata a zaplacena prostřednictvím myBestDays, obdrží partner podíl z rezervace ve výši uvedené na stránce programu (aktuálně 0,5 %) z částky rezervace zaplacené hostem v měně rezervace, bez časového omezení, dokud přiřazení trvá. Kauce nejsou částkou rezervace. Vrácení peněz hostovi poměrně snižuje podíl (§ 7).",
      ],
    },
    {
      heading: "§ 4 Týmová provize",
      paragraphs: [
        "Od hodnosti „Aufsteiger“ (Stoupající) smí partner vést týmové partnery. Pokud se další partner přihlásí prostřednictvím týmového odkazu partnera a viditelně potvrdí jeho kód ve své žádosti, bude po jeho schválení přiřazen k týmu partnera (dále jen „Sponzor“). Pokud Sponzor nemá tuto hodnost v okamžiku podání žádosti, žádost zůstává platná, ale nevzniká týmové přiřazení.",
        "Sponzor obdrží z čistého obratu z předplatného zákazníků svých týmových partnerů týmovou provizi ve výši rozdílu mezi jeho vlastní sazbou provize a sazbou provize týmového partnera, vždy podle hodnosti v okamžiku platby. Pokud jsou oba ve stejné hodnosti nebo je týmový partner výše, nevzniká týmová provize. Provize týmového partnera a týmová provize Sponzora dohromady nikdy nepřekročí nejvyšší sazbu stupnice (aktuálně 30 %).",
        "Týmová provize se skládá přesně z jedné úrovně: Týmoví partneři neobdrží týmovou provizi za partnery, které sami získají. Za získání partnera se neplatí žádná odměna; účastnický poplatek se nevybírá. Týmová provize vzniká výhradně z placených příjmů z předplatného.",
        "Týmová provize běží pro každého týmového zákazníka dvanáct měsíců od jeho první placené faktury, podléhá stejnému období pro vrácení peněz a v případě vrácení peněz nebo zpětného zúčtování je poměrně odebrána (§ 7). Vzniká pouze tehdy, pokud jsou sponzor a týmový partner schváleni; jinak je pozastavena až do vyjasnění.",
        "Přiřazení k týmu je jednorázové. Změna se provádí pouze společností myNextDays s doloženým důvodem.",
      ],
    },
    {
      heading: "§ 5 Povinnosti partnera a označení",
      paragraphs: [
        "Partner označuje každé doporučení svým odkazem nebo kódem jako reklamu – na začátku příspěvku, v jazyce příspěvku, v souladu s předpisy své země (v Německu mimo jiné § 5a odst. 4 UWG, v Dánsku markedsføringsloven § 6 odst. 4). Znění pro jednotlivé země poskytuje myNextDays v partnerském panelu.",
        "Partner poskytuje o myNextDays pouze informace, které odpovídají zveřejněným popisům služeb, a nečiní žádné sliby jménem myNextDays. Zakázány jsou zejména sliby úspěchu a záruky (např. „zaručená plná obsazenost za tři dny“) a prohlášení o příjmech, které nevyplývají ze zveřejněných popisů služeb.",
        "Každé video a každý příspěvek, který zmiňuje myNextDays nebo obsahuje odkaz partnera, je před zveřejněním předložen jako soubor v partnerském panelu ke kontrole. Odkaz partnera vzniká až po písemném schválení společností myNextDays; zveřejnění bez schválení je zakázáno. myNextDays může schválení odvolat; již vzniklé provize zůstávají nedotčeny.",
        "Pro loga, snímky obrazovky, B-Roll, překryvy a snímky obrazovky používá partner výhradně reklamní materiály poskytnuté společností myNextDays. Vlastní, neověřené softwarové záznamy nejsou povoleny.",
      ],
    },
    {
      heading: "§ 6 Zakázané praktiky",
      paragraphs: ["Zakázány jsou zejména:"],
      list: [
        "Brand-Bidding: placené reklamy na značku „myNextDays“, varianty psaní a kombinace (např. „myNextDays ceny“) ve vyhledávačích a sítích;",
        "Cookie-Dropping, skryté přesměrování, iFrames, automatické volání partnerského odkazu nebo jiné technické manipulace s přiřazením;",
        "Vlastní reklama: registrace vlastních podniků, společníků, zaměstnanců nebo příbuzných prostřednictvím vlastního kódu nebo kódu týmového partnera;",
        "Koupený dosah (koupení sledující, klikací farmy, bot-traffic) a pobídky pro podniky k registraci (zpětné platby, dárky, soutěže);",
        "Sliby náboru: nábor partnerů s přísliby výdělku, které nepocházejí z placených příjmů z předplatného, nebo prezentace programu jako zdroje příjmů prostřednictvím náboru dalších partnerů;",
        "Spam, nepovolená přímá reklama a používání cizích značek nebo obsahu bez oprávnění.",
      ],
    },
    {
      heading: "§ 7 Lhůta pro vrácení peněz, storno, zadržení",
      paragraphs: [
        "Každá provizní položka je po svém vzniku otevřena po dobu 30 dnů (lhůta pro vrácení peněz) a poté je splatná. Pokud je podkladová faktura zcela nebo částečně vrácena nebo stornována (chargeback), provize – včetně související týmové provize – bude poměrně stornována, a to i po vyplacení, a to započtením s budoucími provizemi.",
        "V případě podezření na porušení § 2, § 5 nebo § 6 smí myNextDays pozastavit přiřazení a provize až do vyjasnění. Pokud se porušení potvrdí, dotčené provize zanikají.",
      ],
    },
    {
      heading: "§ 8 Vyplacení a dobropis",
      paragraphs: [
        "Splatné provize jsou měsíčně seskupovány podle měny a vypláceny, jakmile dosáhnou minimální částky v příslušné měně uvedené na stránce programu nebo v dashboardu. Převod mezi měnami se neprovádí.",
        "Vyúčtování probíhá formou dobropisu (samofakturace, momsloven § 52a): myNextDays vystaví dobropis za každou platbu; partner nevystavuje fakturu. Partner souhlasí s postupem dobropisu.",
        "Podnikatelé obdrží dobropis s upozorněním na daňovou povinnost příjemce služby (reverse charge); předpokladem je platné, potvrzené identifikační číslo pro DPH. Soukromé osoby obdrží dobropis bez DPH a provizi si zdaní samy.",
        "Vyplacení probíhá bankovním převodem SEPA, Wise nebo PayPal na údaje, které partner uložil v dashboardu.",
      ],
    },
    {
      heading: "§ 9 Data a náhled",
      paragraphs: [
        "Partner vidí přiřazené podniky pseudonymně (číslo, země, stav, částky). Jména, e-mailové adresy nebo údaje o rezervacích podniků nejsou zveřejňovány. Sponzor vidí u svých týmových partnerů jméno nebo firmu, hodnost, počet platících zákazníků a z toho vyplývající týmovou provizi, nikoli podrobnosti o zákaznících.",
        "U propojených účtů a vytvořených příspěvků myNextDays vidí sledující, zhlédnutí, interakce a kliknutí a zákazníky u každého příspěvku. Anomálie (například skok v počtu sledujících bez odpovídajících zhlédnutí nebo výrazná odchylka mezi vlastním prohlášením a ověřenou hodnotou) jsou indikátory pro osobní kontrolu podle § 6 a § 10, nikoli automatické zablokování.",
        "Zpracování osobních údajů v partnerském programu je popsáno v prohlášení o ochraně osobních údajů.",
      ],
    },
    {
      heading: "§ 10 Doba trvání, zablokování a výpověď",
      paragraphs: [
        "Účast je na dobu neurčitou a může být oběma stranami kdykoli ukončena v textové podobě. Již vzniklé, splatné provize budou vyplaceny podle § 8; po ukončení nevznikají žádné nové provize.",
        "myNextDays smí partnera zablokovat v případě porušení těchto podmínek. Během zablokování jsou provize pozastaveny; v případě potvrzeného porušení zanikají.",
      ],
    },
    {
      heading: "§ 11 Změny",
      paragraphs: [
        "myNextDays může tyto podmínky a stupnici s účinností do budoucna změnit. Změny budou zveřejněny na partnerském panelu a na této stránce s číslem verze; v případě podstatných změn bude partner požádán o opětovný souhlas. Již vzniklé provize zůstávají nedotčeny.",
      ],
    },
    {
      heading: "§ 12 Rozhodné právo",
      paragraphs: [
        "Použije se dánské právo s vyloučením kolizních norem. Povinná ustanovení o ochraně spotřebitele státu, ve kterém má soukromý partner obvyklé bydliště, zůstávají nedotčena.",
      ],
    },
  ],
};
