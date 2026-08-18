import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Nařízení o digitálních službách",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "myBestDays je zprostředkovatelská služba a online platforma ve smyslu nařízení (EU) 2022/2065 o jednotném trhu digitálních služeb (akt o digitálních službách, DSA). Tato stránka shrnuje údaje a postupy, které uvedené nařízení vyžaduje.",
    "myBestDays není velmi velká online platforma ve smyslu článku 33 nařízení. Dodatečné povinnosti, které z toho plynou — posuzování systémových rizik, nezávislý audit, archiv reklam a zveřejňování měsíčního počtu uživatelů tam stanoveným postupem — se na nás proto nevztahují.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Kontaktní místa (články 11 a 12)",
      paragraphs: [
        `Jednotné kontaktní místo pro orgány členských států, Komisi a Evropský sbor pro digitální služby: ${ANBIETER.email}, poštou ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dánsko.`,
        `Jednotné kontaktní místo pro uživatele: ${ANBIETER.email}. Spojíte se s námi přímo, bez automatizovaného mezistupně.`,
        "S oběma kontaktními místy lze komunikovat v němčině, dánštině a angličtině.",
        "Právního zástupce v Unii podle článku 13 není třeba jmenovat: provozovatel je usazen v Dánsku, tedy v Unii.",
        `Příslušný koordinátor digitálních služeb podle článku 49: ${DSA_KOORDINATOR.name}, Dánsko ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Oznámení protiprávního obsahu (článek 16)",
      paragraphs: [
        "Kdokoli nám může oznámit obsah, který považuje za protiprávní. Použijte oznamovací funkci dostupnou u každého inzerátu, hodnocení a zprávy, nebo kontaktní místo pro uživatele.",
        "Abychom mohli oznámení posoudit bez podrobného právního rozboru, mělo by obsahovat:",
      ],
      list: [
        "dostatečně odůvodněné vysvětlení, proč je obsah protiprávní;",
        "přesné elektronické umístění, zejména URL adresu;",
        "jméno a e-mailovou adresu oznamovatele — s výjimkou oznámení týkajících se trestných činů proti pohlavní svobodě dětí, kde je tento údaj dobrovolný;",
        "prohlášení, že údaje jsou podle nejlepšího vědomí správné a úplné.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Jak oznámení vyřizujeme",
      paragraphs: [
        "Přijetí neprodleně potvrdíme a rozhodneme včas, pečlivě, nesvévolně a objektivně.",
        "Obsahuje-li oznámení údaje podle oddílu 2, zakládá naši vědomost ve smyslu článku 6 nařízení.",
        "O svém rozhodnutí oznamovatele vyrozumíme a poučíme jej o opravných prostředcích.",
        "Probíhá-li vyřízení automatizovaně, sdělíme to.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Odůvodnění opatření (článek 17)",
      paragraphs: [
        "Omezíme-li viditelnost obsahu, odstraníme jej, znemožníme k němu přístup, pozastavíme platby, poskytování služby nebo účet, obdrží dotčená osoba jasné a konkrétní odůvodnění.",
        "Odůvodnění uvádí povahu a rozsah opatření, jeho územní a časovou působnost, skutečnosti a okolnosti rozhodnutí, zda se podílelo automatizované zpracování, právní základ nebo porušené smluvní ustanovení a dostupné opravné prostředky.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Podezření na trestný čin (článek 18)",
      paragraphs: [
        "Existují-li poznatky nasvědčující trestnému činu ohrožujícímu život nebo bezpečnost osoby, neprodleně vyrozumíme příslušné orgány činné v trestním řízení nebo justiční orgány.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Interní vyřizování stížností (článek 20)",
      paragraphs: [
        "Proti každému opatření podle oddílu 4 a proti zamítnutí oznámení lze do šesti měsíců bezplatně podat stížnost.",
        "Stížnosti vyřizujeme včas, nediskriminačně a pečlivě — pod dohledem kvalifikovaných osob a nikoli výhradně automatizovanými prostředky.",
        "Ukáže-li se stížnost jako důvodná, opatření zrušíme. Postup popisuje [Stížnosti a řešení sporů](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Mimosoudní řešení sporů (článek 21)",
      paragraphs: [
        "Ve sporech o opatření podle oddílu 4 se uživatelé mohou obrátit na orgán pro mimosoudní řešení sporů certifikovaný příslušným koordinátorem digitálních služeb. Seznam certifikovaných orgánů vede Evropská komise.",
        "Rozhodnutí těchto orgánů pro nás nejsou závazná; k účasti v řízeních nezávislých poskytovatelů nejsme povinni. Soudní cesta zůstává nedotčena.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Důvěryhodní oznamovatelé (článek 22)",
      paragraphs: [
        "Oznámení podaná subjektem uznaným jako důvěryhodný oznamovatel v jeho oboru působnosti vyřizujeme přednostně.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Opatření proti zneužívání (článek 23)",
      paragraphs: [
        "Účty, přes které je často poskytován zjevně protiprávní obsah, po předchozím upozornění na přiměřenou dobu pozastavíme.",
        "Vyřizování oznámení a stížností pozastavíme osobám, které často podávají zjevně nedůvodná oznámení nebo stížnosti — rovněž po předchozím upozornění.",
        "Vždy přitom posuzujeme jednotlivý případ: počet, podíl a závažnost dotčených jednání i úmysl.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Zprávy o transparentnosti (články 15 a 24)",
      paragraphs: [
        "Každoročně zveřejňujeme zprávu o moderování obsahu: počet příkazů orgánů, počet a druh oznámení, přijatá opatření, počet stížností a jejich výsledek, údaje o využití automatizovaných postupů a počet sporů před mimosoudními orgány.",
        `Mikropodniky a malé podniky jsou podle článku 19 nařízení od části těchto povinností osvobozeny. Dokud osvobození platí, poskytneme údaje na vyžádání na adrese ${ANBIETER.email}; jakmile bude první zpráva zveřejněna, bude zde uveden odkaz.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Sledovatelnost obchodníků (články 30 až 32)",
      paragraphs: [
        "Poskytovatelé, kteří na platformě jednají v rámci své podnikatelské činnosti, mohou nabízet teprve poté, co nám sdělili jméno, adresu, telefonní číslo, e-mailovou adresu, údaje z rejstříku, daňové identifikační číslo pro DPH a platební účet a jejich údaje jsou věrohodné.",
        "Tyto údaje zobrazujeme u inzerátu v rozsahu, v jakém to nařízení stanoví.",
        "Dozvíme-li se, že se inzerát týkal protiprávního výrobku nebo protiprávní služby, informujeme dotčené hosty, máme-li jejich kontaktní údaje.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Doporučovací systémy (článek 27)",
      paragraphs: [
        "Hlavní parametry pořadí výsledků vyhledávání a doporučení i možnost je ovlivnit jsou popsány v části [Ceny, pořadí a doporučení](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Reklama (článek 26)",
      paragraphs: [
        "V současnosti nezobrazujeme placenou reklamu třetích osob ani placené umístění ve výsledcích vyhledávání.",
        "Zavedeme-li reklamu, zřetelně ji označíme a uvedeme zadavatele i hlavní parametry jejího zacílení. Reklamu založenou na zvláštních kategoriích osobních údajů podle článku 9 nařízení (EU) 2016/679 a reklamu cílenou na nezletilé na základě profilování vylučujeme.",
      ],
    },
  ],
};
