import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zásady ochrany osobných údajov",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "Tieto zásady opisujú, ktoré osobné údaje myBestDays spracúva, na aké účely, na akom právnom základe a aké práva máte. Platia pre webovú stránku, mobilné aplikácie a všetky ostatné prístupy k Platforme.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Prevádzkovateľ a zodpovedná osoba",
      paragraphs: [
        `Prevádzkovateľom v zmysle nariadenia (EÚ) 2016/679 (GDPR) je ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dánsko, CVR č. ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Úplné údaje o poskytovateľovi sú uvedené v [Právnych informáciách](https://mybestdays.dk/rechtliches/impressum).`,
        "Zodpovedná osoba nebola určená; podmienky článku 37 GDPR nie sú splnené. Otázky k ochrane údajov smerujte na uvedenú e-mailovú adresu.",
        "Poskytovatelia, u ktorých rezervujete, sú za údaje, ktoré od nás dostanú, samostatnými prevádzkovateľmi. Vzťahujú sa na nich [Štandardy ochrany údajov pre hostiteľov](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Ktoré údaje spracúvame",
      paragraphs: ["Podľa toho, ako Platformu používate, spracúvame:"],
      list: [
        "základné údaje — meno, e-mailová adresa, telefónne číslo, jazyk a mena, heslo v šifrovanej podobe;",
        "údaje o rezervácii — rezervované ubytovanie, obdobie, počet a mená cestujúcich, osobitné želania, stav rezervácie;",
        "platobné údaje — suma, mena, stav platby, posledné číslice platobného prostriedku a identifikátor transakcie nášho poskytovateľa platobných služieb. Úplné údaje o kartách sa k nám nedostávajú;",
        "komunikačné údaje — správy medzi Vami a poskytovateľom, otázky na náš zákaznícky servis, sťažnosti;",
        "obsahové údaje — hodnotenia, fotografie, zoznamy želaní;",
        "údaje o používaní — navštívené stránky, vyhľadávacie dopyty, čas prístupu;",
        "technické údaje — IP adresa, identifikátory prehliadača a zariadenia, operačný systém, odkazujúca stránka.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Účely a právne základy",
      paragraphs: [
        "Poskytovanie Platformy, účet, vyhľadávanie, rezervácia, spracovanie platieb a komunikácia s poskytovateľom — čl. 6 ods. 1 písm. b) GDPR (zmluva alebo predzmluvné opatrenia).",
        "Zákaznícky servis, vybavovanie sťažností a riešenie sporov — čl. 6 ods. 1 písm. b) a f) GDPR.",
        "Odhaľovanie a predchádzanie podvodom, zneužitiam a bezpečnostným incidentom, presadzovanie našich podmienok — čl. 6 ods. 1 písm. f) GDPR (oprávnený záujem na bezpečnom trhovisku).",
        "Hodnotenia a ich zverejňovanie — čl. 6 ods. 1 písm. b) a f) GDPR.",
        "Plnenie právnych povinností, najmä obchodných a daňových povinností uchovávania, ohlasovacích povinností podľa smernice (EÚ) 2021/514 (DAC7) a povinností podľa nariadenia (EÚ) 2022/2065 — čl. 6 ods. 1 písm. c) GDPR.",
        "Zlepšovanie Platformy analýzou agregovaných údajov o používaní — čl. 6 ods. 1 písm. f) GDPR.",
        "Reklamné e-maily a nie nevyhnutné súbory cookie — čl. 6 ods. 1 písm. a) GDPR (súhlas), ktorý môžete kedykoľvek odvolať s účinnosťou do budúcnosti.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Príjemcovia",
      paragraphs: [
        "Poskytovatelia dostávajú údaje, ktoré potrebujú na vykonanie Vašej rezervácie a na splnenie svojich právnych povinností — najmä meno, kontaktné údaje, obdobie, počet cestujúcich a Vaše správy im určené.",
        "Náš poskytovateľ platobných služieb Stripe spracúva platobné údaje ako samostatný prevádzkovateľ; dodatočne platia [Zásady ochrany osobných údajov Stripe](https://stripe.com/privacy).",
        "Poskytovatelia služieb, ktorí pre nás zabezpečujú hosting, prevádzku databáz, rozosielanie e-mailov, diagnostiku chýb a nástroje zákazníckeho servisu, spracúvajú údaje výlučne podľa našich pokynov na základe zmluvy podľa článku 28 GDPR.",
        "Orgány a súdy dostávajú údaje len v rozsahu, v akom sme povinní; pozri [Zásady pre žiadosti orgánov a orgánov činných v trestnom konaní](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Daňové orgány dostávajú údaje o poskytovateľoch oznamované podľa DAC7.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Prenos do tretích krajín",
      paragraphs: [
        "Naše servery aj servery našich sprostredkovateľov sa nachádzajú v Európskej únii.",
        "Ak v jednotlivých prípadoch dochádza k spracúvaniu mimo Európskeho hospodárskeho priestoru, deje sa tak len na základe rozhodnutia Európskej komisie o primeranosti alebo štandardných zmluvných doložiek podľa čl. 46 ods. 2 písm. c) GDPR spolu s doplňujúcimi zárukami.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Doby uchovávania",
      paragraphs: [
        "Údaje účtu uchovávame, kým Váš účet trvá, a potom ich mažeme, pokiaľ tomu nebráni povinnosť uchovávania.",
        "Údaje o rezervácii a platbe podliehajú obchodným a daňovým lehotám uchovávania; podľa dánskeho účtovného práva sú to spravidla päť rokov od konca účtovného obdobia, ktorého sa údaje týkajú.",
        "Správy k rezervácii uchovávame až tri roky po skončení pobytu, aby bolo možné objasniť spory.",
        "Hodnotenia zostávajú po vymazaní Vášho účtu v anonymizovanej podobe, pretože tvoria súčasť hodnotiaceho základu ubytovania.",
        "Údaje o prípadoch podvodu a zneužitia uchovávame tak dlho, ako je potrebné na odvrátenie ďalších porušení, najdlhšie však tri roky od posledného prípadu.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Vaše práva",
      paragraphs: ["Podľa GDPR máte tieto práva:"],
      list: [
        "prístup k údajom o Vás uloženým (článok 15);",
        "opravu nesprávnych údajov (článok 16);",
        "vymazanie (článok 17), pokiaľ tomu nebráni povinnosť uchovávania;",
        "obmedzenie spracúvania (článok 18);",
        "prenosnosť údajov (článok 20);",
        "námietku proti spracúvaniu založenému na oprávnených záujmoch (článok 21), najmä proti priamemu marketingu;",
        "odvolanie udeleného súhlasu s účinnosťou do budúcnosti (čl. 7 ods. 3);",
        `sťažnosť na dozornom orgáne (článok 77) — príslušný je orgán Vášho bydliska, pracoviska alebo miesta údajného porušenia. V sídle prevádzkovateľa je to ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Dánsko, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Ako svoje práva uplatníte",
      paragraphs: [
        `Mnohé údaje môžete zobraziť, zmeniť alebo vymazať priamo vo svojom účte. Vo všetkom ostatnom sa obráťte na ${ANBIETER.email}.`,
        "Odpovedáme bezodkladne, najneskôr do jedného mesiaca. Ak lehotu nemôžeme dodržať, oznámime Vám to s odôvodnením.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Automatizované rozhodnutia",
      paragraphs: [
        "Používame automatizované postupy na odhaľovanie podvodov, zneužití a protiprávneho obsahu. Ak takýto postup vedie k opatreniu voči Vášmu účtu alebo obsahu, odôvodníme ho a môžete požiadať o preskúmanie človekom.",
        "Rozhodnutie založené výlučne na automatizovanom spracúvaní s právnymi účinkami v zmysle článku 22 GDPR neprijímame.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Povinnosť poskytnúť údaje",
      paragraphs: [
        "Údaje potrebné na rezerváciu musíte poskytnúť; bez nich nemožno uzavrieť zmluvu ani poskytnúť ubytovanie. Všetky ostatné údaje sú dobrovoľné.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Zmeny týchto zásad",
      paragraphs: [
        "Tieto zásady upravujeme, ak sa zmení spracúvanie alebo právny stav. Aktuálne platné znenie je dostupné tu; dátum aktualizácie je uvedený vyššie.",
      ],
    },
  ],
};
