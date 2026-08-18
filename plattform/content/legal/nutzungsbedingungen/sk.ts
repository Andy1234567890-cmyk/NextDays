import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Podmienky používania pre hostí",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "Tieto podmienky používania upravujú používanie rezervačného portálu myBestDays (ďalej len „Platforma“) cestujúcimi a osobami, ktoré vykonávajú rezervácie (ďalej len „Hosť“ alebo „Vy“).",
    `Prevádzkovateľom Platformy je ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dánsko, CVR č. ${ANBIETER.cvr} (ďalej len „myBestDays“ alebo „my“). myBestDays je ochranná známka tejto spoločnosti, nie samostatná právnická osoba. Úplné údaje o poskytovateľovi nájdete v [Právnych informáciách](https://mybestdays.dk/rechtliches/impressum).`,
    "Používaním Platformy vyjadrujete súhlas s týmito podmienkami. Prosíme, prečítajte si ich pozorne.",
  ],
  summary: {
    heading: "Zhrnutie týchto podmienok",
    paragraphs: [
      "myBestDays je trhovisko. Poskytujeme Platformu, na ktorej poskytovatelia ponúkajú svoje ubytovania — samotné ubytovanie neposkytujeme my. Zmluva o ubytovaní vzniká medzi Vami a poskytovateľom, nie s nami.",
      "To, čo vidíte v inzeráte, pochádza od poskytovateľa: opis, obrázky, vybavenie, cena, storno podmienky a domový poriadok. Inzeráty kontrolujeme, ale nemôžeme ručiť za každý údaj poskytovateľa.",
      "Cena, ktorú vidíte pri dokončení rezervácie, je celková cena za rezervované služby. Dodatočné sumy splatné až na mieste (napríklad kúpeľný poplatok alebo zábezpeka) uvádzame vopred samostatne.",
      "Ak sa niečo pokazí, obráťte sa najprv na nás. Oddiel A15 opisuje, ako podať sťažnosť a aké cesty sa Vám potom otvárajú.",
      "Toto zhrnutie vysvetľuje podmienky, ale nenahrádza ich. Rozhodujúci je úplný text.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Všetky rezervácie cez myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Vymedzenie pojmov",
          paragraphs: [
            "Pojmy použité v týchto podmienkach sú vysvetlené v slovníku na konci dokumentu. Najdôležitejšie sú:",
          ],
          list: [
            "„Platforma“ — webová stránka, mobilné aplikácie a všetky ostatné prístupové body, prostredníctvom ktorých myBestDays zobrazuje ubytovania a sprostredkúva rezervácie.",
            "„Poskytovateľ“ — fyzická alebo právnická osoba, ktorá ponúka ubytovanie prostredníctvom Platformy (hostiteľ, prenajímateľ, agentúra, hotelové alebo ubytovacie zariadenie).",
            "„Ubytovanie“ — ubytovacia služba ponúkaná poskytovateľom, teda rekreačný objekt alebo jednotka určitého typu izby či objektu.",
            "„Rezervácia“ — rezervácia ubytovania na určité obdobie uzavretá prostredníctvom Platformy.",
            "„Celková cena“ — suma uvedená pri dokončení rezervácie vrátane všetkých daní, poplatkov a príplatkov účtovaných cez Platformu.",
            "„Náklady na mieste“ — sumy, ktoré sa neúčtujú cez Platformu, ale stávajú sa splatnými voči poskytovateľovi (napr. kúpeľný poplatok, zábezpeka, záverečné upratovanie podľa voľby poskytovateľa).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. O týchto podmienkach",
          paragraphs: [
            "Tieto podmienky platia pre každé používanie Platformy, bez ohľadu na to, či si vytvoríte účet a či dôjde k rezervácii.",
            "Oddiel A platí pre všetky rezervácie. Oddiel B obsahuje doplňujúce pravidlá pre ubytovania. Pri rozpore má prednosť oddiel B.",
            "Pre samotnú ubytovaciu službu platia doplnkovo podmienky príslušného poskytovateľa (najmä domový poriadok a storno podmienky) uvedené v inzeráte. Tieto podmienky poskytovateľa pristupujú k našim; nemôžu sa od našich podmienok odchýliť, pokiaľ ide o Váš vzťah k nám.",
            "Tieto podmienky sú dostupné vo všetkých 24 úradných jazykoch Európskej únie. Pri odchýlkach medzi jazykovými verziami je rozhodujúca nemecká verzia, pokiaľ kogentné predpisy štátu Vášho bydliska neustanovujú inak.",
            "Kogentné spotrebiteľské práva podľa práva štátu Vášho bydliska nie sú týmito podmienkami dotknuté.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. O myBestDays",
          paragraphs: [
            "myBestDays je online trhovisko pre rekreačné ubytovania a ubytovacie zariadenia. Prevádzkujeme Platformu, na ktorej poskytovatelia prezentujú svoje ubytovania a hostia si ich môžu rezervovať.",
            "Sme sprostredkovateľ, nie ubytovateľ. Nevlastníme, neprevádzkujeme, nespravujeme ani nekontrolujeme žiadne z ubytovaní ponúkaných na Platforme a nie sme zmluvnou stranou zmluvy o ubytovaní.",
            "myBestDays je sprostredkovateľská služba v zmysle nariadenia (EÚ) 2022/2065 o digitálnych službách. Naše údaje a postupy podľa tohto nariadenia nájdete v časti [Akt o digitálnych službách](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays nie je cestovná kancelária. Nezostavujeme balíky cestovných služieb v zmysle smernice (EÚ) 2015/2302; k spojeným cestovným službám pozri A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Naša Platforma",
          paragraphs: [
            "Obsah inzerátu — opis, fotografie, vybavenie, limity obsadenosti, ceny, dostupnosť, storno podmienky a domový poriadok — pochádza od príslušného poskytovateľa. Poskytovateľ zodpovedá za jeho správnosť a úplnosť.",
            "Inzeráty kontrolujeme pred zverejnením a priebežne na zjavné porušenia našich [Pravidiel pre vhodný obsah](https://mybestdays.dk/rechtliches/inhaltsrichtlinien). Povinnosť všeobecného monitorovania všetkého obsahu neexistuje a podľa článku 8 nariadenia (EÚ) 2022/2065 by ani nebola prípustná.",
            "Ako zoraďujeme výsledky vyhľadávania a ktoré znaky určujú poradie, vysvetľujeme v [Informáciách o cenách, poradí a odporúčaniach](https://mybestdays.dk/rechtliches/preisangaben).",
            "Usilujeme sa o nepretržite dostupnú Platformu, nedlžíme však neprerušovanú dostupnosť. Údržba, poruchy a úpravy sú možné.",
            "Preklady obsahu poskytovateľov môžu byť strojové. Rozhodujúca je pôvodná verzia vložená poskytovateľom.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Naše hodnoty",
          paragraphs: [
            "Od hostí a poskytovateľov očakávame úctivé zaobchádzanie. Diskriminácia z dôvodu pôvodu, farby pleti, náboženstva, presvedčenia, pohlavia, rodovej identity, sexuálnej orientácie, zdravotného postihnutia, veku alebo podobných znakov sa na Platforme netoleruje — pozri [Antidiskriminačné zásady](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Na správanie počas pobytu sa vzťahujú [Základné pravidlá pre hostí](https://mybestdays.dk/rechtliches/grundregeln-gaeste), na poskytovateľov [Kódex správania poskytovateľov](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Váš účet a používanie Platformy",
          paragraphs: [
            "Na rezerváciu si môžete vytvoriť účet. Zodpovedáte za dôvernosť svojich prístupových údajov a bezodkladne nás informujete, ak máte podozrenie na neoprávnené použitie.",
            "Platformu smiete používať, len ak ste spôsobilí na právne úkony a môžete platne uzatvárať zmluvy.",
            "Vaše údaje pri registrácii a rezervácii musia byť správne a úplné — najmä meno, kontaktné údaje a počet cestujúcich. Poskytovateľ tieto údaje potrebuje na poskytnutie ubytovania a na splnenie svojich ohlasovacích povinností.",
            "Nie je dovolené najmä:",
          ],
          list: [
            "fiktívne rezervácie, podvodné platby alebo použitie cudzích platobných prostriedkov bez oprávnenia;",
            "automatizované vyťažovanie Platformy (scraping, crawler) nad rámec toho, čo povoľuje náš súbor robots.txt;",
            "opatrenia, ktoré narúšajú alebo preťažujú Platformu alebo jej infraštruktúru alebo obchádzajú ich bezpečnostné opatrenia;",
            "vkladanie protiprávneho, urážlivého alebo zavádzajúceho obsahu do hodnotení, správ alebo údajov profilu;",
            "pokus o vybavenie rezervácie mimo Platformy po tom, čo kontakt vznikol cez Platformu — pozri [Poplatky mimo platformy](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Ceny",
          paragraphs: [
            "Všetky ceny sa zobrazujú ako celková cena vrátane daní a všetkých poplatkov účtovaných cez Platformu, akonáhle sú známe údaje o ceste (obdobie a počet cestujúcich). Ak niektorá zložka vzniká až na mieste, uvedieme ju samostatne pred dokončením rezervácie.",
            "Ceny sa zobrazujú v mene inzerátu. Ak sa Vám suma zobrazí aj v inej mene, ide o nezáväzný prepočet na orientáciu; účtuje sa v mene inzerátu, pokiaľ sa pri platbe neuvádza inak.",
            "Ceny sa môžu do dokončenia rezervácie zmeniť, napríklad preto, že ich poskytovateľ upraví alebo sa zmení dostupnosť. Rozhodujúca je cena, ktorá sa Vám zobrazí bezprostredne pred záväznou rezerváciou a ktorá je uvedená v potvrdení rezervácie.",
            "Zjavné cenové chyby (napr. suma nesprávna o rády) nezaväzujú ani nás, ani poskytovateľa. Ak takú chybu zistíme, bezodkladne Vás informujeme; rezerváciu potom môžete bezplatne zrušiť.",
            "Ako sa skladajú servisné poplatky, uvádzajú [Informácie o servisných poplatkoch](https://mybestdays.dk/rechtliches/servicegebuehren). K daniam a poplatkom pozri [Daňové zásady](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Platba",
          paragraphs: [
            "Platby cez Platformu spracúva poskytovateľ platobných služieb Stripe. Platobné údaje (napr. údaje o karte) zbiera a spracúva priamo Stripe; myBestDays neukladá úplné údaje o kartách.",
            "Kedy je splatná ktorá suma — záloha, doplatok alebo platba na mieste — závisí od inzerátu a je uvedené pred dokončením rezervácie. Podrobnosti upravujú [Platobné podmienky](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Ak inzerát uvádza zábezpeku, môže byť predautorizovaná alebo inkasovaná a v prípade škody úplne alebo čiastočne zadržaná; rozhodujúce sú údaje v inzeráte.",
            "Ak platba zlyhá alebo je stornovaná, rezervácia môže byť zrušená. Poskytovateľ môže naďalej požadovať sumy vzniknuté podľa jeho storno podmienok.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Zásady",
          paragraphs: [
            "Popri týchto podmienkach platia nasledujúce zásady, ktoré sú súčasťou zmluvy medzi Vami a nami:",
          ],
          list: [
            "[Pravidlá pre vhodný obsah](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Zásady hodnotení](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Antidiskriminačné zásady](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Základné pravidlá pre hostí](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Storno podmienky](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Zásady zmeny rezervácie a vrátenia peňazí](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Zásady pri závažných narušeniach](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Zásady autorského práva](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Ochrana údajov a súbory cookie",
          paragraphs: [
            "Ako spracúvame osobné údaje, uvádzajú [Zásady ochrany osobných údajov](https://mybestdays.dk/rechtliches/datenschutz). Aké súbory cookie a podobné technológie používame, uvádzajú [Zásady používania súborov cookie](https://mybestdays.dk/rechtliches/cookies).",
            "Pre rezerváciu odovzdávame poskytovateľovi údaje, ktoré potrebuje na poskytnutie ubytovacej služby. Poskytovateľ je za ne samostatným prevádzkovateľom; vzťahujú sa naň [Štandardy ochrany údajov pre hostiteľov](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Prístupnosť",
          paragraphs: [
            "Stav prístupnosti Platformy a spôsob nahlasovania bariér opisuje [Vyhlásenie o prístupnosti](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Údaje o prístupnosti ubytovania pochádzajú od poskytovateľa. Ak ste odkázaní na určité vlastnosti, vyjasnite si ich pred rezerváciou s poskytovateľom cez funkciu správ.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Hodnotenia a používateľský obsah",
          paragraphs: [
            "Po pobyte môžete zanechať hodnotenie. Hodnotenie smie zanechať len ten, kto rezervoval cez Platformu a pobyt nastúpil alebo mohol nastúpiť — tým zabezpečujeme, že zverejnené hodnotenia pochádzajú od skutočných hostí.",
            "Za hodnotenia neplatíme, ich obsah nemeníme a hodnotenie nepotláčame len preto, že je negatívne. Podrobnosti a dôvody, pre ktoré hodnotenie odstránime, uvádzajú [Zásady hodnotení](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "Za obsah, ktorý vkladáte — hodnotenia, fotografie, správy, údaje profilu — zostávate zodpovední. Udeľujete nám nevýhradné, územne a časovo neobmedzené, bezodplatné právo tento obsah v rámci prevádzky a propagácie Platformy rozmnožovať, spracúvať (napr. orezanie, preklad) a sprístupňovať verejnosti. Svoj obsah môžete vymazať; už uskutočnené použitia v už zverejnených zostavách tým nie sú dotknuté.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Správy a komunikácia s poskytovateľom",
          paragraphs: [
            "Správy medzi Vami a poskytovateľom prebiehajú cez Platformu. Poskytujeme funkciu správ, nie sme však odosielateľom ani príjemcom obsahu.",
            "Sme oprávnení automatizovane kontrolovať správy na porušenia týchto podmienok (napr. kontaktné údaje na obídenie Platformy, vzorce podvodu, protiprávny obsah) a dotknuté správy zadržať alebo odstrániť. O odstránení Vás informujeme s odôvodnením podľa A17.",
            "Správy k Vašej rezervácii (potvrdenie, zmeny, informácie o príchode) posielame na uvedenú e-mailovú adresu. Tieto správy sú zmluvnou komunikáciou a nemožno ich odhlásiť, pokiaľ rezervácia trvá. Reklamné správy dostávate len v rozsahu, v akom ste udelili súhlas alebo to právo umožňuje bez súhlasu; kedykoľvek môžete namietať.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Práva duševného vlastníctva",
          paragraphs: [
            "Platforma, jej dizajn, softvér, databázy, texty a ochranné známky sú chránené. Získavate nevýhradné, neprevoditeľné právo používať Platformu na vyhľadávanie a rezerváciu ubytovaní — nič viac.",
            "Používanie našich ochranných známok a log upravujú [Pravidlá pre ochranné známky](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Ak sa domnievate, že obsah na Platforme porušuje Vaše autorské právo, postupujte podľa [Zásad autorského práva](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Čo robiť, ak sa niečo pokazí",
          paragraphs: [
            "Ak sa problém týka samotného ubytovania, obráťte sa najprv na poskytovateľa — cez funkciu správ alebo na mieste. Mnohé problémy sa tak vyriešia najrýchlejšie.",
            "Ak s poskytovateľom nepokročíte alebo sa problém týka Platformy, platby či vybavenia rezervácie, obráťte sa na nás. Ako nás zastihnete a ako vybavujeme sťažnosti, uvádza časť [Sťažnosti a riešenie sporov](https://mybestdays.dk/rechtliches/beschwerden).",
            "Pripravte si: číslo rezervácie, e-mailovú adresu rezervácie, krátky opis problému s Vaším želaním, ako máme pomôcť, a príslušné doklady (fotografie, správy, potvrdenky).",
            "Ak ubytovanie pri príchode nie je k dispozícii alebo sa podstatne odchyľuje od inzerátu, uplatnia sa [Zásady zmeny rezervácie a vrátenia peňazí](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Platforma Európskej komisie na riešenie sporov online bola zrušená nariadením (EÚ) 2024/3228 a ukončila činnosť; ako cesta už nie je k dispozícii. Ktoré orgány ju nahrádzajú, uvádza časť [Sťažnosti a riešenie sporov](https://mybestdays.dk/rechtliches/beschwerden).",
            "Ak sme prijali opatrenie voči Vášmu obsahu alebo účtu, popri našom internom konaní o sťažnostiach sa môžete obrátiť aj na orgán mimosúdneho riešenia sporov certifikovaný podľa článku 21 nariadenia (EÚ) 2022/2065. Jeho rozhodnutia pre nás nie sú záväzné.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Opatrenia proti nevhodnému správaniu",
          paragraphs: [
            "Ak porušíte tieto podmienky alebo niektoré zo zásad uvedených v A9, môžeme — odstupňovane podľa závažnosti, početnosti a dopadu porušenia — odstrániť obsah alebo obmedziť jeho viditeľnosť, zablokovať funkcie, zrušiť rezervácie alebo dočasne či trvalo zablokovať Váš účet.",
            "Pred opatrením posúdime jednotlivý prípad. Pri zjavne protiprávnom obsahu, pri ohrození osôb alebo pri podvode môžeme konať okamžite.",
            "Každé opatrenie Vám odôvodníme a poučíme Vás o ceste sťažnosti — pozri A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Nahlásenie protiprávneho obsahu a odôvodnenie opatrení",
          paragraphs: [
            "Ktokoľvek nám môže nahlásiť obsah, ktorý považuje za protiprávny. Postup nahlasovania podľa článku 16 nariadenia (EÚ) 2022/2065, naše kontaktné miesta a zaobchádzanie s hláseniami sú opísané v časti [Akt o digitálnych službách](https://mybestdays.dk/rechtliches/dsa).",
            "Ak prijmeme opatrenie voči Vami vloženému obsahu alebo voči Vášmu účtu, dostanete odôvodnenie s uvedením dôvodu, skutkového základu, právneho základu alebo porušeného zmluvného ustanovenia, ako aj možností sťažnosti.",
            "Proti každému opatreniu môžete do šiestich mesiacov bezplatne podať sťažnosť. Sťažnosti spracúvajú ľudia, nie výlučne automatizované systémy.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Obmedzenie zodpovednosti",
          paragraphs: [
            "Zodpovedáme neobmedzene za úmysel a hrubú nedbanlivosť, za škody z porušenia života, tela alebo zdravia, ako aj v rozsahu nami prevzatej záruky. Nároky podľa práva zodpovednosti za výrobok nie sú dotknuté.",
            "Inak je naša zodpovednosť obmedzená na predvídateľnú škodu, ktorá typicky vzniká z porušenia povinností, na ktorých splnenie sa smiete spoľahnúť — a len v rozsahu, v akom rozhodné právo takéto obmedzenie pripúšťa.",
            "Nezodpovedáme za samotné poskytnutie ubytovacej služby ani za správanie poskytovateľov či iných hostí. Zmluvným partnerom ubytovacej služby je poskytovateľ.",
            "Nezodpovedáme za správnosť údajov vložených poskytovateľmi, pokiaľ sme ich nepoznali a ani poznať nemuseli. Len čo sa o protiprávnom údaji dozvieme, konáme bezodkladne.",
            "Ďalšia zodpovednosť je vylúčená. Kogentné zákonné nároky, najmä spotrebiteľské práva, nie sú dotknuté.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Rozhodné právo a príslušnosť súdov",
          paragraphs: [
            "Platí dánske právo — sídlo prevádzkovateľa je v Dánsku — s vylúčením Dohovoru OSN o zmluvách o medzinárodnej kúpe tovaru. Kogentné spotrebiteľské predpisy štátu, v ktorom máte obvyklý pobyt, nie sú podľa článku 6 nariadenia (ES) č. 593/2008 (Rím I) dotknuté.",
            "Ako spotrebiteľ nás môžete žalovať na súde svojho bydliska alebo v našom sídle v Dánsku; my Vás môžeme žalovať len na súde Vášho bydliska (články 17 až 19 nariadenia (EÚ) č. 1215/2012).",
            "Pre zmluvu o ubytovaní spravidla platí právo štátu, v ktorom sa ubytovanie nachádza; pre žaloby z nájmu nehnuteľnosti sú výlučne príslušné jeho súdy.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Spojené cestovné služby",
          paragraphs: [
            "myBestDays sprostredkúva výlučne ubytovacie služby. Neponúkame lety, prenájom áut, prepravné služby, výlety ani atrakcie a nezostavujeme balíky cestovných služieb v zmysle smernice (EÚ) 2015/2302.",
            "Ak by sme v budúcnosti sprostredkovali ďalšie cestovné služby, pred rezerváciou Vás zákonom predpísaným štandardným formulárom upozorníme na to, či vzniká balík cestovných služieb alebo spojená cestovná služba a aké práva Vám z toho vyplývajú.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Trvanie, blokovanie a ukončenie",
          paragraphs: [
            "Zmluva o používaní Platformy je uzatvorená na neurčitý čas. Svoj účet môžete kedykoľvek bez uvedenia dôvodu vymazať; existujúce rezervácie tým nie sú dotknuté a vybavia sa podľa podmienok príslušného poskytovateľa.",
            "Zmluvu o používaní môžeme vypovedať s lehotou 14 dní. Pri závažnom porušení týchto podmienok môžeme vypovedať bez výpovednej lehoty a zablokovať účet.",
            "Po ukončení Vaše údaje vymažeme, pokiaľ tomu nebráni zákonná povinnosť uchovávania alebo oprávnený záujem na uchovávaní; podrobnosti upravujú [Zásady ochrany osobných údajov](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Doložka o zmenách",
          paragraphs: [
            "Tieto podmienky môžeme zmeniť, ak na to existuje vecný dôvod — napríklad zmenená právna úprava, judikatúra najvyšších súdov, nové alebo zaniknuté funkcie Platformy alebo odstránenie medzier v úprave.",
            "Zmeny oznámime v textovej podobe najmenej 30 dní pred nadobudnutím účinnosti. Ak do nadobudnutia účinnosti nenamietnete, zmenené podmienky sa považujú za prijaté; na tento účinok Vás v oznámení osobitne upozorníme. Ak namietnete, môžeme zmluvu o používaní vypovedať k dátumu nadobudnutia účinnosti.",
            "Na už uzavreté rezervácie sa vzťahujú podmienky v znení platnom v čase rezervácie.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Ubytovania",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Rozsah tohto oddielu",
          paragraphs: [
            "Tento oddiel platí pre rezerváciu ubytovaní cez Platformu — rekreačných objektov rovnako ako izieb a jednotiek ubytovacích zariadení.",
            "Dopĺňa oddiel A. Pri rozporoch má prednosť tento oddiel B.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Zmluvný vzťah",
          paragraphs: [
            "Zmluva o ubytovaní vzniká výlučne medzi Vami a poskytovateľom. myBestDays nie je zmluvnou stranou.",
            "Prezentácia ubytovania na Platforme je výzvou, aby ste predložili rezervačnú ponuku. Kliknutím na tlačidlo rezervácie s povinnosťou platby predkladáte záväznú ponuku.",
            "Zmluva vzniká, keď je rezervácia potvrdená. Potvrdenie rezervácie posielame na Vami uvedenú e-mailovú adresu; uvádza poskytovateľa, rezervovanú službu, obdobie, celkovú cenu a storno podmienky.",
            "Pri ubytovaniach s rezerváciou na dopyt vzniká zmluva až prijatím zo strany poskytovateľa. Dovtedy môže byť Váš platobný prostriedok predautorizovaný, nie však zaťažený.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Čo robíme my",
          paragraphs: [
            "Poskytujeme Platformu, zobrazujeme inzeráty poskytovateľov, prijímame Vašu rezerváciu, postupujeme ju poskytovateľovi a odosielame Vám potvrdenie rezervácie.",
            "Vybavujeme platbu, pokiaľ inzerát predpokladá platbu cez Platformu, a poskytujeme funkciu správ medzi Vami a poskytovateľom.",
            "Ubytovanie neposkytujeme, neprevádzkujeme ho a nepreberáme záruku za jeho stav. Nie sme Vašou cestovnou kanceláriou.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Čo musíte urobiť Vy",
          paragraphs: [
            "Pred rezerváciou si preštudujte celý inzerát: vybavenie, limit obsadenosti, časy príchodu a odchodu, domový poriadok, storno podmienky a náklady vznikajúce až na mieste.",
            "Dodržte maximálnu obsadenosť uvedenú v inzeráte. Ak pricestuje viac osôb, než bolo rezervovaných, poskytovateľ môže odmietnuť ubytovanie alebo požadovať príplatok.",
            "Dodržiavajte domový poriadok poskytovateľa a [Základné pravidlá pre hostí](https://mybestdays.dk/rechtliches/grundregeln-gaeste). S ubytovaním zaobchádzate starostlivo a zodpovedáte za škody, ktoré spôsobíte Vy alebo Vaši spolucestujúci.",
            "Ak poskytovateľ alebo orgán potrebuje údaje na prihlásenie (napr. prihlasovací lístok, údaje z dokladu totožnosti, vyhlásenie o kúpeľnom poplatku), poskytnete ich včas.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Ceny a platba",
          paragraphs: [
            "Celková cena zahŕňa cenu za nocľah na rezervované obdobie a príplatky a poplatky uvedené v inzeráte, ktoré sa účtujú cez Platformu.",
            "Na mieste môžu vzniknúť dodatočné sumy — najmä kúpeľný poplatok alebo miestne poplatky, zábezpeka, ako aj doplnkové služby, ktoré si objednáte až na mieste. Tie uvádzame pred dokončením rezervácie ako náklady na mieste, pokiaľ ich poskytovateľ uviedol.",
            "Ak inzerát predpokladá zálohu, zvyšok je splatný v čase uvedenom v inzeráte. Ak doplatok nepríde, poskytovateľ môže podľa svojich storno podmienok od zmluvy odstúpiť.",
            "Platby poskytovateľovi mimo Platformy neprijímame a nemôžeme ich sledovať; nepatria pod naše vybavovanie platieb — pozri [Poplatky mimo platformy](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Zmeny, zrušenia a vrátenie peňazí",
          paragraphs: [
            "Či a za akých podmienok možno rezerváciu bezplatne zrušiť alebo zmeniť, sa riadi storno podmienkami poskytovateľa uvedenými v inzeráte. Podmienky, ktoré poskytovateľom ponúkame na výber, opisujú [Storno podmienky](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "Pri ubytovacích službách rezervovaných na určité obdobie spravidla neexistuje zákonné právo na odstúpenie podľa článku 16 písm. l) smernice 2011/83/EÚ, resp. zodpovedajúcich vnútroštátnych predpisov. Kogentné zákonné práva nie sú dotknuté.",
            "Ak zruší poskytovateľ, vrátime v plnom rozsahu sumu zaplatenú cez Platformu. Navyše sa uplatnia [Zásady zmeny rezervácie a vrátenia peňazí](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Ak udalosť mimo kontroly oboch strán znemožní cestu alebo pobyt, platia [Zásady pri závažných narušeniach](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "Vrátenie peňazí sa vykonáva na platobný prostriedok použitý na platbu, pokiaľ nie je dohodnuté inak.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Čo ešte musíte vedieť",
          paragraphs: [
            "Poskytovatelia môžu byť súkromní hostitelia alebo podnikatelia. Či poskytovateľ vystupuje ako podnikateľ, uvádzame v inzeráte. Ak nejde o podnikateľa, spotrebiteľské predpisy Únie sa na zmluvu o ubytovaní nevzťahujú — na túto okolnosť Vás v inzeráte upozorníme.",
            "Údaje o polohe, okolí, vzdialenostiach a hodnotenia tretích strán slúžia na orientáciu. Záväzné sú údaje o samotnej rezervovanej službe.",
            "V oblastiach s registračnou povinnosťou pre krátkodobý prenájom uvádzame v inzeráte registračné číslo poskytnuté poskytovateľom; pozri [Krátkodobý prenájom](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Pri viacerých identických jednotkách typu objektu alebo izby rezervujete jednu jednotku tohto typu. Ktorú konkrétnu jednotku dostanete, určuje poskytovateľ.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Slovník",
      paragraphs: [
        "Nasledujúce pojmy majú v týchto podmienkach tu uvedený význam.",
      ],
      definitions: [
        {
          term: "Poskytovateľ",
          description:
            "Fyzická alebo právnická osoba, ktorá ponúka ubytovanie cez Platformu a stáva sa zmluvnou stranou zmluvy o ubytovaní.",
        },
        {
          term: "Rezervácia na dopyt",
          description:
            "Rezervácia, ktorá vzniká až po výslovnom prijatí poskytovateľom, na rozdiel od okamžitej rezervácie.",
        },
        {
          term: "Potvrdenie rezervácie",
          description:
            "Správa, ktorou Vám potvrdzujeme uzavretie zmluvy o ubytovaní; obsahuje poskytovateľa, službu, obdobie, celkovú cenu a storno podmienky.",
        },
        {
          term: "Jednotka",
          description:
            "Konkrétny rezervovateľný objekt pod typom objektu alebo izby. Predáva sa jednotka, opisuje a oceňuje sa typ.",
        },
        {
          term: "Celková cena",
          description:
            "Suma uvedená pri dokončení rezervácie vrátane všetkých daní a všetkých poplatkov účtovaných cez Platformu.",
        },
        {
          term: "Maximálna obsadenosť",
          description:
            "Najvyšší prípustný počet osôb, ktoré môžu v ubytovaní prenocovať, uvedený v inzeráte.",
        },
        {
          term: "Zábezpeka",
          description:
            "Suma, ktorú poskytovateľ požaduje ako zábezpeku za škody a ktorá sa predautorizuje alebo inkasuje a po pobyte uvoľní alebo započíta.",
        },
        {
          term: "Kúpeľný poplatok",
          description:
            "Miestny poplatok za prenocovania, ktorý sa podľa obce vyberá na mieste alebo cez poskytovateľa; nie je službou myBestDays.",
        },
        {
          term: "Platforma",
          description:
            "Webová stránka, mobilné aplikácie a všetky ostatné prístupové body, prostredníctvom ktorých myBestDays zobrazuje ubytovania a sprostredkúva rezervácie.",
        },
        {
          term: "Servisný poplatok",
          description:
            "Odplata za sprostredkovateľskú službu myBestDays. Kto ju znáša a ako sa uvádza, je uvedené v informáciách o servisných poplatkoch.",
        },
        {
          term: "Storno podmienky",
          description:
            "Pravidlá zvolené poskytovateľom o tom, dokedy a s akými nákladmi možno rezerváciu zrušiť alebo zmeniť.",
        },
        {
          term: "Ubytovanie",
          description:
            "Ubytovacia služba ponúkaná poskytovateľom — rekreačný objekt alebo jednotka typu izby či objektu.",
        },
        {
          term: "Náklady na mieste",
          description:
            "Sumy, ktoré sa neúčtujú cez Platformu, ale stávajú sa splatnými voči poskytovateľovi, napríklad kúpeľný poplatok, zábezpeka alebo doplnkové služby objednané na mieste.",
        },
      ],
    },
  ],
};
