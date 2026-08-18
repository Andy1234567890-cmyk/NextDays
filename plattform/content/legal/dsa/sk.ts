import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Akt o digitálnych službách",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "myBestDays je sprostredkovateľská služba a online platforma v zmysle nariadenia (EÚ) 2022/2065 o jednotnom trhu digitálnych služieb (akt o digitálnych službách, DSA). Táto stránka sústreďuje údaje a postupy, ktoré toto nariadenie vyžaduje.",
    "myBestDays nie je veľmi veľká online platforma v zmysle článku 33 nariadenia. Dodatočné povinnosti, ktoré z toho vyplývajú — zisťovanie systémových rizík, nezávislý audit, archív reklám a zverejňovanie mesačného počtu používateľov tam stanoveným postupom — sa na nás preto nevzťahujú.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Kontaktné miesta (články 11 a 12)",
      paragraphs: [
        `Jednotné kontaktné miesto pre orgány členských štátov, Komisiu a Európsky výbor pre digitálne služby: ${ANBIETER.email}, poštou ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dánsko.`,
        `Jednotné kontaktné miesto pre používateľov: ${ANBIETER.email}. Spojíte sa s nami priamo, bez automatizovaného medzikroku.`,
        "S oboma kontaktnými miestami možno komunikovať v nemčine, dánčine a angličtine.",
        "Právneho zástupcu v Únii podľa článku 13 netreba určovať: prevádzkovateľ je usadený v Dánsku, teda v Únii.",
        `Príslušný koordinátor digitálnych služieb podľa článku 49: ${DSA_KOORDINATOR.name}, Dánsko ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Nahlásenie protiprávneho obsahu (článok 16)",
      paragraphs: [
        "Ktokoľvek nám môže nahlásiť obsah, ktorý považuje za protiprávny. Použite na to funkciu nahlásenia dostupnú pri každom inzeráte, hodnotení a správe, alebo kontaktné miesto pre používateľov.",
        "Aby sme mohli hlásenie posúdiť bez podrobného právneho rozboru, malo by obsahovať:",
      ],
      list: [
        "dostatočne odôvodnené vysvetlenie, prečo je obsah protiprávny;",
        "presné elektronické umiestnenie, najmä URL adresu;",
        "meno a e-mailovú adresu nahlasujúceho — okrem hlásení týkajúcich sa trestných činov proti pohlavnej slobode detí, kde je tento údaj dobrovoľný;",
        "vyhlásenie, že údaje sú podľa najlepšieho vedomia správne a úplné.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Ako hlásenia vybavujeme",
      paragraphs: [
        "Prijatie bezodkladne potvrdíme a rozhodneme včas, starostlivo, bez svojvôle a objektívne.",
        "Ak hlásenie obsahuje údaje podľa oddielu 2, zakladá našu vedomosť v zmysle článku 6 nariadenia.",
        "O našom rozhodnutí nahlasujúceho informujeme a poučíme ho o opravných prostriedkoch.",
        "Pri automatizovanom spracúvaní to oznámime.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Odôvodnenie opatrení (článok 17)",
      paragraphs: [
        "Ak obmedzíme viditeľnosť obsahu, odstránime ho, zablokujeme k nemu prístup, pozastavíme platby, poskytovanie služby alebo účet, dotknutá osoba dostane jasné a konkrétne odôvodnenie.",
        "Odôvodnenie uvádza povahu a rozsah opatrenia, jeho územnú a časovú pôsobnosť, skutočnosti a okolnosti rozhodnutia, či sa podieľalo automatizované spracúvanie, právny základ alebo porušené zmluvné ustanovenie a dostupné opravné prostriedky.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Podozrenie z trestného činu (článok 18)",
      paragraphs: [
        "Ak existujú indície trestného činu ohrozujúceho život alebo bezpečnosť osoby, bezodkladne informujeme príslušné orgány činné v trestnom konaní alebo justičné orgány.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Interné vybavovanie sťažností (článok 20)",
      paragraphs: [
        "Proti každému opatreniu podľa oddielu 4 a proti zamietnutiu hlásenia možno do šiestich mesiacov bezplatne podať sťažnosť.",
        "Sťažnosti vybavujeme včas, nediskriminačne a starostlivo — pod dohľadom kvalifikovaných osôb a nie výlučne automatizovanými prostriedkami.",
        "Ak sa sťažnosť ukáže ako dôvodná, opatrenie zrušíme. Cestu opisuje časť [Sťažnosti a riešenie sporov](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Mimosúdne riešenie sporov (článok 21)",
      paragraphs: [
        "V sporoch o opatreniach podľa oddielu 4 sa používatelia môžu obrátiť na orgán mimosúdneho riešenia sporov certifikovaný príslušným koordinátorom digitálnych služieb. Zoznam certifikovaných orgánov vedie Európska komisia.",
        "Rozhodnutia týchto orgánov pre nás nie sú záväzné; na účasť v konaniach nezávislých poskytovateľov nie sme povinní. Cesta k súdom zostáva nedotknutá.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Dôveryhodní nahlasovatelia (článok 22)",
      paragraphs: [
        "Hlásenia podané subjektom uznaným za dôveryhodného nahlasovateľa v jeho oblasti pôsobnosti vybavujeme prednostne.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Opatrenia proti zneužívaniu (článok 23)",
      paragraphs: [
        "Účty, cez ktoré sa často poskytuje zjavne protiprávny obsah, po predchádzajúcom upozornení na primeraný čas zablokujeme.",
        "Vybavovanie hlásení a sťažností pozastavíme osobám, ktoré často podávajú zjavne nedôvodné hlásenia alebo sťažnosti — takisto po predchádzajúcom upozornení.",
        "Vždy pritom posudzujeme jednotlivý prípad: počet, podiel a závažnosť dotknutých konaní, ako aj úmysel.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Správy o transparentnosti (články 15 a 24)",
      paragraphs: [
        "Každoročne zverejňujeme správu o moderovaní obsahu: počet príkazov orgánov, počet a druh hlásení, prijaté opatrenia, počet sťažností a ich výsledok, údaje o využívaní automatizovaných postupov a počet sporov pred mimosúdnymi orgánmi.",
        `Mikropodniky a malé podniky sú podľa článku 19 nariadenia od časti týchto povinností oslobodené. Kým oslobodenie platí, poskytneme údaje na požiadanie na adrese ${ANBIETER.email}; len čo bude prvá správa zverejnená, uvedieme tu na ňu odkaz.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Vysledovateľnosť obchodníkov (články 30 až 32)",
      paragraphs: [
        "Poskytovatelia, ktorí na Platforme konajú v rámci svojej podnikateľskej činnosti, môžu ponúkať až potom, čo nám oznámili meno, adresu, telefónne číslo, e-mailovú adresu, údaje z registra, identifikačné číslo pre DPH a platobný účet a ich údaje sú vierohodné.",
        "Tieto údaje zobrazujeme pri inzeráte v rozsahu, v akom to nariadenie ustanovuje.",
        "Ak sa dozvieme, že sa inzerát týkal protiprávneho výrobku alebo protiprávnej služby, informujeme dotknutých hostí, pokiaľ máme ich kontaktné údaje.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Odporúčacie systémy (článok 27)",
      paragraphs: [
        "Hlavné parametre poradia výsledkov vyhľadávania a odporúčaní, ako aj možnosť ich ovplyvniť, sú opísané v časti [Ceny, poradie a odporúčania](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Reklama (článok 26)",
      paragraphs: [
        "V súčasnosti nezobrazujeme platenú reklamu tretích strán ani platené umiestnenia vo výsledkoch vyhľadávania.",
        "Ak reklamu zavedieme, zreteľne ju označíme, uvedieme zadávateľa a hlavné parametre jej zobrazovania. Reklamu založenú na osobitných kategóriách osobných údajov podľa článku 9 nariadenia (EÚ) 2016/679 a reklamu cielenú na maloletých na základe profilovania vylučujeme.",
      ],
    },
  ],
};
