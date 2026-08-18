import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Digitális szolgáltatásokról szóló jogszabály",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "A myBestDays a digitális szolgáltatások egységes piacáról szóló (EU) 2022/2065 rendelet (digitális szolgáltatásokról szóló jogszabály, DSA) értelmében vett közvetítő szolgáltatás és online platform. Ez az oldal összefoglalja a rendelet által megkövetelt adatokat és eljárásokat.",
    "A myBestDays nem minősül a rendelet 33. cikke szerinti óriásplatformnak. Az azokra vonatkozó további kötelezettségek — a rendszerszintű kockázatok felmérése, független audit, hirdetési adattár és a havi felhasználószám ott előírt eljárás szerinti közzététele — ezért ránk nem vonatkoznak.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Kapcsolattartó pontok (11. és 12. cikk)",
      paragraphs: [
        `Egyablakos kapcsolattartó pont a tagállamok hatóságai, a Bizottság és a Digitális Szolgáltatások Európai Testülete számára: ${ANBIETER.email}, postai úton ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dánia.`,
        `Egyablakos kapcsolattartó pont a felhasználók számára: ${ANBIETER.email}. Ott közvetlenül, automatizált előszűrés nélkül ér el minket.`,
        "Mindkét kapcsolattartó ponttal német, dán és angol nyelven lehet kommunikálni.",
        "A 13. cikk szerinti uniós jogi képviselőt nem kell kijelölni: az üzemeltető Dániában, tehát az Unióban telepedett le.",
        `Illetékes digitális szolgáltatási koordinátor a 49. cikk szerint: ${DSA_KOORDINATOR.name}, Dánia ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Jogellenes tartalom bejelentése (16. cikk)",
      paragraphs: [
        "Bárki bejelenthet nekünk olyan tartalmat, amelyet jogellenesnek tart. Használja ehhez a minden hirdetésnél, értékelésnél és üzenetnél elérhető bejelentő funkciót, vagy a felhasználói kapcsolattartó pontot.",
        "Ahhoz, hogy egy bejelentést részletes jogi vizsgálat nélkül meg tudjunk ítélni, annak tartalmaznia kell:",
      ],
      list: [
        "kellően megalapozott magyarázatot arról, miért jogellenes a tartalom;",
        "a pontos elektronikus lelőhelyet, különösen az URL-címet;",
        "a bejelentő nevét és e-mail-címét — kivéve a gyermekek szexuális önrendelkezése elleni bűncselekményekre vonatkozó bejelentéseket, ahol ez az adat önkéntes;",
        "nyilatkozatot arról, hogy az adatok legjobb tudomás szerint helyesek és teljesek.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Hogyan dolgozzuk fel a bejelentéseket",
      paragraphs: [
        "A beérkezést haladéktalanul visszaigazoljuk, és időben, gondosan, önkénymentesen és tárgyilagosan döntünk.",
        "Ha egy bejelentés tartalmazza a 2. szakaszban felsorolt adatokat, az megalapozza a rendelet 6. cikke szerinti tudomásunkat.",
        "Döntésünkről tájékoztatjuk a bejelentő személyt, és felhívjuk a figyelmét a jogorvoslatokra.",
        "Automatizált feldolgozás esetén ezt közöljük.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Az intézkedések indokolása (17. cikk)",
      paragraphs: [
        "Ha egy tartalom láthatóságát korlátozzuk, azt eltávolítjuk, a hozzáférést letiltjuk, fizetéseket felfüggesztünk, a szolgáltatás nyújtását vagy a fiókot letiltjuk, az érintett személy világos és konkrét indokolást kap.",
        "Az indokolás megnevezi az intézkedés jellegét és terjedelmét, területi és időbeli hatályát, a döntés tényeit és körülményeit, azt, hogy közreműködött-e automatizált feldolgozás, a jogalapot vagy a megsértett szerződéses rendelkezést és a rendelkezésre álló jogorvoslatokat.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Bűncselekmény gyanúja (18. cikk)",
      paragraphs: [
        "Ha olyan bűncselekményre utaló jelek merülnek fel, amely valamely személy életét vagy biztonságát veszélyezteti, haladéktalanul értesítjük az illetékes bűnüldöző vagy igazságügyi hatóságokat.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Belső panaszkezelési eljárás (20. cikk)",
      paragraphs: [
        "A 4. szakasz szerinti minden intézkedéssel és egy bejelentés elutasításával szemben hat hónapon belül díjmentesen panasz nyújtható be.",
        "A panaszokat időben, megkülönböztetésmentesen és gondosan dolgozzuk fel — szakképzett személyek felügyelete mellett, nem kizárólag automatizált eszközökkel.",
        "Ha egy panasz megalapozottnak bizonyul, visszavonjuk az intézkedést. Az utat a [Panaszok és vitarendezés](https://mybestdays.dk/rechtliches/beschwerden) írja le.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Peren kívüli vitarendezés (21. cikk)",
      paragraphs: [
        "A 4. szakasz szerinti intézkedésekkel kapcsolatos vitákban a felhasználók az illetékes digitális szolgáltatási koordinátor által tanúsított peren kívüli vitarendezési testülethez fordulhatnak. A tanúsított testületek jegyzékét az Európai Bizottság vezeti.",
        "E testületek döntései ránk nem kötelezőek; független szolgáltatók eljárásaiban való részvételre nem vagyunk kötelesek. A bírósági út érintetlen marad.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Megbízható bejelentők (22. cikk)",
      paragraphs: [
        "Azokat a bejelentéseket, amelyeket megbízható bejelentőként elismert szervezet nyújt be a szakterületén, elsőbbséggel dolgozzuk fel.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Visszaélés elleni intézkedések (23. cikk)",
      paragraphs: [
        "Azokat a fiókokat, amelyeken keresztül gyakran nyilvánvalóan jogellenes tartalmat tesznek közzé, előzetes figyelmeztetés után ésszerű időtartamra letiltjuk.",
        "A bejelentések és panaszok feldolgozását felfüggesztjük azon személyek esetében, akik gyakran nyilvánvalóan megalapozatlan bejelentéseket vagy panaszokat nyújtanak be — szintén előzetes figyelmeztetés után.",
        "Mindig az egyedi esetet vizsgáljuk: az érintett esetek számát, arányát és súlyát, valamint a szándékot.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Átláthatósági jelentések (15. és 24. cikk)",
      paragraphs: [
        "Évente jelentést teszünk közzé a tartalommoderálásról: a hatósági határozatok száma, a bejelentések száma és típusa, a meghozott intézkedések, a panaszok száma és kimenetele, az automatizált eljárások alkalmazására vonatkozó adatok, valamint a peren kívüli testületek előtti viták száma.",
        `A mikro- és kisvállalkozások a rendelet 19. cikke szerint e kötelezettségek egy része alól mentesülnek. Amíg a mentesség fennáll, az adatokat kérésre a ${ANBIETER.email} címen bocsátjuk rendelkezésre; amint az első jelentés megjelenik, itt hivatkozunk rá.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. A kereskedők nyomon követhetősége (30—32. cikk)",
      paragraphs: [
        "Azok a szolgáltatók, akik a Platformon üzletszerűen járnak el, csak akkor kínálhatnak, ha megadták nekünk a nevet, címet, telefonszámot, e-mail-címet, nyilvántartási adatokat, közösségi adószámot és fizetési számlát, és adataik hihetők.",
        "Ezeket az adatokat a hirdetésben megjelenítjük, amennyiben a rendelet így rendelkezik.",
        "Ha tudomást szerzünk arról, hogy egy hirdetés jogellenes terméket vagy jogellenes szolgáltatást érintett, tájékoztatjuk az érintett vendégeket, amennyiben rendelkezünk elérhetőségükkel.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Ajánlórendszerek (27. cikk)",
      paragraphs: [
        "A találati sorrend és az ajánlások fő paramétereit, valamint azok befolyásolásának lehetőségét az [Árak, rangsorolás és ajánlások](https://mybestdays.dk/rechtliches/preisangaben) írja le.",
      ],
    },
    {
      id: "werbung",
      heading: "13. Reklám (26. cikk)",
      paragraphs: [
        "Jelenleg nem jelenítünk meg harmadik felek fizetett hirdetéseit, és nem alkalmazunk fizetett elhelyezéseket a találatok között.",
        "Ha reklámot vezetünk be, azt egyértelműen megjelöljük, megnevezzük a hirdetőt és a megjelenítés fő paramétereit. Az (EU) 2016/679 rendelet 9. cikke szerinti különleges személyesadat-kategóriákon alapuló reklámot és a kiskorúaknak profilalkotáson alapuló reklámot kizárjuk.",
      ],
    },
  ],
};
