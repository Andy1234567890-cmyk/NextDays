// Partner-AGB — Ungarisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "A myNextDays partnerprogramjának részvételi feltételei: Hozzárendelés, jutalékalap, szint, csapatjutalék, tilalmak, megjelölés, kifizetés.",
  numbered: false,
  toc: true,
  title: "Partnerprogram részvételi feltételei (Partner ÁSZF) — Tervezet",
  standIso: "2026-09-02",
  intro: [
    "TERVEZET — Ezek a feltételek a myNextDays munkadokumentumai, és még nem ellenőrizte ügyvéd. Az ellenőrzött változat közzétételéig a program leírásaként, nem pedig végleges szerződésszövegként érvényesek. Az ellenőrzött változat új verziószámmal ezen a címen kerül közzétételre; a partnereket a következő bejelentkezéskor ismételt hozzájárulásra kérik.",
    `Ezek a részvételi feltételek szabályozzák a ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-szám: ${ANBIETER.cvr} (a továbbiakban: „myNextDays” vagy „mi”) partnerprogramjában (affiliate programjában) való részvételt a partnerek (a továbbiakban: „Partner”) részéről.`,
    "A partnerprogram az EU-ban, Svájcban vagy az Egyesült Királyságban székhellyel rendelkező magánszemélyeknek és vállalatoknak szól, akik vállalkozásokat (szállásadókat, ügynökségeket, szállodákat) ajánlanak a myNextDays-en.",
  ],
  sections: [
    {
      heading: "§ 1 Részvétel és jóváhagyás",
      paragraphs: [
        "A részvételhez a partner-irányítópulton keresztül történő jelentkezés szükséges. Kötelező adatok: név vagy cégnév, jogi forma, ország, legalább egy közösségi média fiók címmel, felhasználónévvel és eléréssel, valamint vállalatok esetén az adószám.",
        "A myNextDays minden jelentkezést személyesen ellenőriz, és szabadon dönt a jóváhagyásról. A felvételre nincs jogi igény. A részvétel ingyenes; a myNextDays előfizetés nem feltétel.",
        "A Partner naprakészen tartja adatait, különösen a csatornákat, a jogi formát, az adó- és kifizetési adatokat.",
        "A megadott elérés kezdetben önbevallás. A Partner önkéntesen összekapcsolhatja YouTube, Instagram, Facebook és TikTok fiókjait; ekkor a követők és a megtekintések a platformról kerülnek beolvasásra és ellenőrzöttként jelennek meg. A nem ellenőrzött elérés a jóváhagyáskor és a későbbi ellenőrzéseknél kisebb súllyal esik latba. Az összekapcsolás bármikor megszüntethető az irányítópulton; a feldolgozás részletei az adatvédelmi nyilatkozatban találhatók.",
      ],
    },
    {
      heading: "§ 2 Vállalkozások hozzárendelése (Attribution)",
      paragraphs: [
        "Egy vállalkozás akkor kerül hozzárendelésre a Partnerhez, ha a Partner ajánlókódjával regisztrál. A kód a regisztráció során láthatóan megjelenik a vállalkozás számára, és az elküldéssel megerősítésre kerül. Követő sütik nem kerülnek elhelyezésre.",
        "Egy vállalkozás pontosan egy Partnerhez kerül hozzárendelésre; a regisztrációkor megerősített kód az irányadó. Későbbi átrendezésre csak a myNextDays által, bizonyított hiba esetén kerül sor.",
        "Nem kerülnek hozzárendelésre a Partner saját vállalkozásai, annak tulajdonosai, alkalmazottai vagy rokonai, valamint olyan vállalkozások, amelyek már a myNextDays ügyfelei, vagy azok voltak.",
      ],
    },
    {
      heading: "§ 3 Jutalék saját ügyfelekre",
      paragraphs: [
        "A jutalék alapja a hozzárendelt vállalkozás nettó előfizetési bevétele (alaptarifa és modulok) a kifizetett számlákból — áfa, portáljutalékok, kiegészítő szolgáltatások, utólagos elszámolások és egyéb átmenő tételek nélkül.",
        "A jutalék mértéke a partner fizetéskori rangjától függ. A rangok és mértékek a programoldalon vannak közzétéve. A rang a partner struktúrájában lévő fizető ügyfelek számán alapul: saját fizető ügyfelei és csapatpartnerei fizető ügyfelei (§ 4), minden ügyfél egyszer. A rangot havonta, a fordulónapon állapítják meg; az előrelépés azonnal érvényes, a visszaminősítés csak akkor, ha a szám két egymást követő fordulónapon a küszöb alatt volt.",
        "Ha a partner először éri el a „Fejlődő” rangot vagy annál magasabbat, egyszeri alkalommal megkapja az adott ranghoz a programoldalon feltüntetett előrelépési bónuszt (jelenleg 50,00 EUR rangonként, minden partner számára euróban). Minden rang csak egyszer kerül kifizetésre, visszaminősítés és újbóli előrelépés esetén is. A bónusz a 7. § szerinti visszatérítési időszak hatálya alá tartozik.",
        "A jutalék minden vállalkozás esetében az első fizetős előfizetési számlájától számított tizenkét hónapig jár; a partneren keresztül közvetített ingyenes próbaidőszak és egy ingyenes hónap nem számít bele. Ha az előfizetés korábban megszűnik, a jutalék az utolsó kifizetett számlával ér véget.",
        "Az „Elit Partner” rangtól kezdődően a partner további szuperjutalékot kap a programoldalon feltüntetett összegben (jelenleg 2,5%) a struktúrájában lévő összes ügyfél – saját ügyfelei és csapatpartnerei ügyfelei – nettó előfizetési forgalma után, a tizenkét hónapos korlát nélkül, mindaddig, amíg az adott ügyfél fizető előfizetéssel rendelkezik, és a partner a fizetés időpontjában rendelkezik a ranggal. Ez a jutalék a 2. bekezdés és a 4. § szerinti jutalék mellett keletkezik.",
        "A myBestDays-en keresztül érkező és kifizetett, a partnerhez vagy valamelyik csapatpartneréhez rendelt vállalkozás minden foglalása után a partner a programoldalon feltüntetett összegű (jelenleg 0,5%) foglalási részesedést kap a vendég által fizetett foglalási összegből a foglalás pénznemében, időbeli korlát nélkül, amíg a hozzárendelés fennáll. A kauciók nem minősülnek foglalási összegnek. A vendégnek történő visszatérítések arányosan csökkentik a részesedést (§ 7).",
      ],
    },
    {
      heading: "§ 4 Csapatjutalék",
      paragraphs: [
        "Az „Emelkedő” rangtól kezdve a partner csapatpartnereket vezethet. Ha egy másik partner a partner csapatlinkjén keresztül jelentkezik, és jelentkezésében láthatóan megerősíti annak kódját, akkor jóváhagyása után a partner (a továbbiakban: „Szponzor”) csapatához kerül. Ha a Szponzor a jelentkezés időpontjában nem rendelkezik a ranggal, a jelentkezés érvényes marad, de csapat-hozzárendelés nem jön létre.",
        "A Szponzor a csapatpartnerei ügyfeleinek nettó előfizetési forgalma után csapatjutalékot kap, amelynek összege a saját jutalékrájának és a csapatpartner jutalékrájának különbsége, mindkettő a fizetéskori rang alapján. Ha mindketten azonos rangban vannak, vagy a csapatpartner magasabb rangban van, akkor nem keletkezik csapatjutalék. A csapatpartner jutaléka és a Szponzor csapatjutaléka együtt soha nem haladja meg a skála legmagasabb mértékét (jelenleg 30%).",
        "A csapatjutalék pontosan egy szint mély: a csapattagok nem kapnak csapatjutalékot az általuk toborzott partnerek után. Partner toborzásáért díjazás nem jár; részvételi díj nem kerül felszámításra. A csapatjutalék kizárólag a fizetett előfizetési bevételből származik.",
        "A csapatjutalék minden csapatügyfél esetében az első fizetett számlájától számított tizenkét hónapig érvényes, ugyanazon visszatérítési időszak hatálya alá tartozik, és visszatérítés vagy visszaterhelés esetén arányosan visszavonásra kerül (§ 7). Csak addig jár, amíg a szponzor és a csapattag jóváhagyott; ellenkező esetben a tisztázásig felfüggesztésre kerül.",
        "A csapat-hozzárendelés egyszeri. Változtatás csak a myNextDays által, dokumentált indokkal történik.",
      ],
    },
    {
      heading: "§ 5 A partner kötelezettségei és megjelölése",
      paragraphs: [
        "A partner minden ajánlást a linkjével vagy kódjával reklámként jelöl meg – a bejegyzés elején, a bejegyzés nyelvén, az országa előírásainak megfelelően (Németországban többek között az UWG 5a. § (4) bekezdése, Dániában a markedsføringsloven 6. § (4) bekezdése). Az egyes országokra vonatkozó szövegezéseket a myNextDays a partner-irányítópulton teszi közzé.",
        "A partner a myNextDays-ről csak olyan információkat közöl, amelyek megfelelnek a közzétett szolgáltatásleírásoknak, és nem tesz ígéreteket a myNextDays nevében. Különösen tilosak a siker- és garanciaígéretek (például „garantált teljes kihasználtság három nap alatt”), valamint a bevételekre vonatkozó kijelentések, amelyek nem a közzétett szolgáltatásleírásokból következnek.",
        "Minden videót és bejegyzést, amely a myNextDays-t említi vagy a partner linkjét tartalmazza, a közzététel előtt fájlként be kell nyújtani a partner-irányítópulton ellenőrzésre. A partner linkje csak a myNextDays írásbeli jóváhagyása után jön létre; jóváhagyás nélküli közzététel tilos. A myNextDays visszavonhatja a jóváhagyást; a már keletkezett jutalékok érintetlenek maradnak.",
        "Logók, képernyőfelvételek, B-Roll, átfedések és képernyőképek esetén a partner kizárólag a myNextDays által biztosított reklámanyagot használja. Saját, nem ellenőrzött szoftverfelvételek nem engedélyezettek.",
      ],
    },
    {
      heading: "§ 6 Tiltott gyakorlatok",
      paragraphs: ["Különösen tilosak:"],
      list: [
        "Márka-licitálás: fizetett hirdetések a „myNextDays” márkára, írásmód-variációkra és kombinációkra (pl. „myNextDays árak”) keresőmotorokban és hálózatokban;",
        "Cookie-dropping, rejtett átirányítások, iFrame-ek, a partner linkjének automatikus meghívása vagy a hozzárendelés egyéb technikai manipulációja;",
        "Önreklámozás: saját vállalkozások, tulajdonosok, alkalmazottak vagy rokonok regisztrálása saját kódjukon vagy csapattag kódján keresztül;",
        "Vásárolt elérés (vásárolt követők, kattintásfarmok, bot-forgalom), valamint ösztönzők a vállalkozások számára a regisztrációért (visszatérítések, ajándékok, nyereményjátékok);",
        "Toborzási ígéretek: partnerek toborzása olyan jövedelemígéretekkel, amelyek nem fizetett előfizetési bevételből származnak, vagy a program jövedelemforrásként való bemutatása további partnerek toborzásával;",
        "Spam, jogosulatlan direkt marketing, valamint idegen márkák vagy tartalmak jogosulatlan felhasználása.",
      ],
    },
    {
      heading: "7. § Visszatérítési időszak, visszavonás, visszatartás",
      paragraphs: [
        "Minden jutalék sor 30 napig nyitva áll (visszatérítési időszak) a keletkezésétől számítva, és ezt követően kifizethető. Amennyiben egy alapul szolgáló számla egészben vagy részben visszatérítésre kerül, vagy visszaterhelésre kerül (chargeback), a jutalék – beleértve az azon alapuló csapatjutalékot is – arányosan visszavonásra kerül, még a kifizetés után is, a jövőbeli jutalékokkal való elszámolás útján.",
        "A 2. §, 5. § vagy 6. § megsértésének gyanúja esetén a myNextDays a tisztázásig visszatarthatja a hozzárendeléseket és a jutalékokat. Amennyiben a jogsértés megerősítést nyer, az érintett jutalékok elévülnek.",
      ],
    },
    {
      heading: "8. § Kifizetés és jóváírás",
      paragraphs: [
        "A kifizethető jutalékok havonta, pénznemenként csoportosítva kerülnek kifizetésre, amint elérik a programoldalon vagy a műszerfalon feltüntetett minimális összeget az adott pénznemben. A pénznemek közötti átváltás nem történik meg.",
        "Az elszámolás jóváírási eljárással történik (önszámlázás, momsloven 52a. §): a myNextDays minden kifizetésről jóváírást állít ki; a Partner nem állít ki számlát. A Partner hozzájárul a jóváírási eljáráshoz.",
        "Vállalkozók a jóváírást a szolgáltatás igénybevevőjének adófizetési kötelezettségére (fordított adózás) vonatkozó utalással kapják meg; ennek előfeltétele egy érvényes, megerősített adószám. Magánszemélyek a jóváírást áfa nélkül kapják meg, és a jutalékot maguk adózzák le.",
        "A kifizetés SEPA átutalással, Wise-on vagy PayPal-on keresztül történik a Partner által a műszerfalon megadott adatokra.",
      ],
    },
    {
      heading: "9. § Adatok és betekintés",
      paragraphs: [
        "A Partner pszeudonim módon (szám, ország, státusz, összegek) látja a hozzárendelt vállalkozásokat. A vállalkozások neve, e-mail címe vagy foglalási adatai nem kerülnek nyilvánosságra. Egy szponzor a csapatpartnereitől látja a nevet vagy céget, a rangot, a fizető ügyfelek számát és az ebből eredő csapatjutalékot, de nem látja az ügyféladatokat.",
        "A kapcsolt fiókok és a létrehozott bejegyzések tekintetében a myNextDays látja a követőket, megtekintéseket, interakciókat, valamint a kattintásokat és ügyfeleket bejegyzésenként. A feltűnő jelenségek (például követőugrás megfelelő megtekintések nélkül, vagy jelentős eltérés az önbevallás és az ellenőrzött érték között) a 6. § és 10. § szerinti személyes ellenőrzés jelzései, nem automatikus zárolás.",
        "A személyes adatok Partnerprogramban történő feldolgozását az adatvédelmi nyilatkozat írja le.",
      ],
    },
    {
      heading: "10. § Futamidő, zárolás és felmondás",
      paragraphs: [
        "A részvétel határozatlan idejű, és mindkét fél bármikor felmondhatja írásban. A már keletkezett, kifizethető jutalékok a 8. § szerint kerülnek kifizetésre; a felmondás után új jutalékok nem keletkeznek.",
        "A myNextDays jogosult a Partnert zárolni, amennyiben megsérti ezeket a feltételeket. A zárolás ideje alatt a jutalékok visszatartásra kerülnek; megerősített jogsértés esetén elévülnek.",
      ],
    },
    {
      heading: "11. § Módosítások",
      paragraphs: [
        "A myNextDays a jövőre nézve módosíthatja ezeket a feltételeket és a szinteket. A módosításokat a partneri irányítópulton és ezen az oldalon verziószámmal együtt közzéteszik; lényeges változások esetén a partnertől újbóli hozzájárulást kérnek. A már keletkezett jutalékok érintetlenek maradnak.",
      ],
    },
    {
      heading: "12. § Alkalmazandó jog",
      paragraphs: [
        "Dán jog alkalmazandó, kivéve a kollíziós jogot. Azon állam kötelező fogyasztóvédelmi rendelkezései, ahol egy magánpartner szokásos tartózkodási hellyel rendelkezik, érintetlenek maradnak.",
      ],
    },
  ],
};
