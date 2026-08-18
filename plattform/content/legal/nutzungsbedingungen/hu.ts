import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Felhasználási feltételek vendégeknek",
  stand: "Frissítve: 2026. augusztus 18.",
  intro: [
    "A jelen felhasználási feltételek a myBestDays foglalási portál (a továbbiakban: „Platform”) utazók és foglalók (a továbbiakban: „Vendég” vagy „Ön”) általi használatát szabályozzák.",
    `A Platform üzemeltetője a ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dánia, CVR-szám ${ANBIETER.cvr} (a továbbiakban: „myBestDays” vagy „mi”). A myBestDays e társaság védjegye, nem önálló jogi személy. A szolgáltató teljes adatai az [Impresszumban](https://mybestdays.dk/rechtliches/impressum) találhatók.`,
    "A Platform használatával elfogadja a jelen feltételeket. Kérjük, figyelmesen olvassa el őket.",
  ],
  summary: {
    heading: "A jelen feltételek összefoglalása",
    paragraphs: [
      "A myBestDays piactér. Mi biztosítjuk a Platformot, amelyen a szolgáltatók a szálláshelyeiket kínálják — magát a szállást nem mi nyújtjuk. A szállásszerződés Ön és a szolgáltató között jön létre, nem velünk.",
      "Amit a hirdetésben lát, a szolgáltatótól származik: leírás, képek, felszereltség, ár, lemondási feltételek és házirend. A hirdetéseket ellenőrizzük, de nem tudunk minden szolgáltatói adatért helytállni.",
      "A foglalás lezárásakor látott ár a foglalt szolgáltatások teljes ára. A csak a helyszínen fizetendő további összegeket (például idegenforgalmi adó vagy kaució) előzetesen külön feltüntetjük.",
      "Ha valami félresikerül, először hozzánk forduljon. Az A15. szakasz leírja, hogyan nyújthat be panaszt, és ezt követően milyen utak állnak nyitva Ön előtt.",
      "Ez az összefoglaló magyarázza a feltételeket, de nem helyettesíti azokat. Az irányadó a teljes szöveg.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Minden myBestDays-en keresztüli foglalás",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Fogalommeghatározások",
          paragraphs: [
            "A jelen feltételekben használt fogalmakat a dokumentum végén található szójegyzék magyarázza. A legfontosabbak:",
          ],
          list: [
            "„Platform” — a weboldal, a mobilalkalmazások és minden egyéb hozzáférési pont, amelyen keresztül a myBestDays szálláshelyeket jelenít meg és foglalásokat közvetít.",
            "„Szolgáltató” — az a természetes vagy jogi személy, aki szálláshelyet kínál a Platformon (házigazda, bérbeadó, ügynökség, szálloda vagy szálláshely-szolgáltató vállalkozás).",
            "„Szálláshely” — a szolgáltató által kínált szállásszolgáltatás, azaz egy nyaralóingatlan vagy egy szoba- vagy objektumtípus egy egysége.",
            "„Foglalás” — egy szálláshely meghatározott időszakra a Platformon keresztül megkötött lefoglalása.",
            "„Teljes ár” — a foglalás lezárásakor feltüntetett összeg, beleértve minden adót, díjat és felárat, amelyet a Platformon keresztül számolunk el.",
            "„Helyszíni költségek” — olyan összegek, amelyeket nem a Platformon keresztül számolunk el, hanem a szolgáltatóval szemben válnak esedékessé (pl. idegenforgalmi adó, kaució, a szolgáltató választása szerinti végtakarítás).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. A jelen feltételekről",
          paragraphs: [
            "A jelen feltételek a Platform minden használatára vonatkoznak, függetlenül attól, hogy létrehoz-e fiókot, és hogy létrejön-e foglalás.",
            "Az A. szakasz minden foglalásra vonatkozik. A B. szakasz a szálláshelyekre vonatkozó kiegészítő szabályokat tartalmazza. Ellentmondás esetén a B. szakasz az irányadó.",
            "Magára a szállásszolgáltatásra kiegészítőleg az adott szolgáltató feltételei (különösen a házirend és a lemondási feltételek) irányadók, amelyeket a hirdetés tartalmaz. A szolgáltató e feltételei a mi feltételeink mellé lépnek; azoktól az Ön és köztünk fennálló viszony tekintetében nem térhetnek el.",
            "A jelen feltételek az Európai Unió mind a 24 hivatalos nyelvén elérhetők. A nyelvi változatok közötti eltérés esetén a német változat az irányadó, amennyiben az Ön lakóhelye szerinti állam kógens rendelkezései másként nem rendelkeznek.",
            "Az Ön lakóhelye szerinti állam joga szerinti kógens fogyasztói jogokat a jelen feltételek nem érintik.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. A myBestDays-ről",
          paragraphs: [
            "A myBestDays online piactér nyaralószállások és szálláshely-szolgáltató vállalkozások számára. Mi üzemeltetjük a Platformot, amelyen a szolgáltatók bemutatják szálláshelyeiket, a vendégek pedig lefoglalhatják azokat.",
            "Közvetítők vagyunk, nem szállásadók. A Platformon kínált szálláshelyek egyikét sem birtokoljuk, üzemeltetjük, kezeljük vagy ellenőrizzük, és nem vagyunk a szállásszerződés szerződő fele.",
            "A myBestDays a digitális szolgáltatásokról szóló (EU) 2022/2065 rendelet értelmében vett közvetítő szolgáltatás. Az e rendelet szerinti adataink és eljárásaink a [Digitális szolgáltatásokról szóló jogszabály](https://mybestdays.dk/rechtliches/dsa) alatt találhatók.",
            "A myBestDays nem utazásszervező. Nem állítunk össze az (EU) 2015/2302 irányelv értelmében vett utazási csomagokat; az utazási szolgáltatásegyüttesekhez lásd az A20. pontot.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. A Platformunk",
          paragraphs: [
            "Egy hirdetés tartalma — leírás, fényképek, felszereltség, férőhelykorlátok, árak, elérhetőségek, lemondási feltételek és házirend — az adott szolgáltatótól származik. A szolgáltató felel annak helyességéért és teljességéért.",
            "A hirdetéseket a közzététel előtt és folyamatosan ellenőrizzük a [Megfelelő tartalomra vonatkozó szabályok](https://mybestdays.dk/rechtliches/inhaltsrichtlinien) nyilvánvaló megsértése tekintetében. Az összes tartalom általános nyomon követésére vonatkozó kötelezettség nem áll fenn, és az (EU) 2022/2065 rendelet 8. cikke szerint nem is lenne megengedett.",
            "Hogy hogyan rendezzük a találatokat és mely jellemzők határozzák meg a sorrendet, azt az [Árakra, rangsorolásra és ajánlásokra vonatkozó tájékoztatóban](https://mybestdays.dk/rechtliches/preisangaben) magyarázzuk el.",
            "Törekszünk a folyamatosan elérhető Platformra, de nem tartozunk megszakítás nélküli rendelkezésre állással. Karbantartás, üzemzavarok és módosítások lehetségesek.",
            "A szolgáltatói tartalmak fordításai gépi úton is készülhetnek. Az irányadó a szolgáltató által feltöltött eredeti változat.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Értékeink",
          paragraphs: [
            "A vendégektől és a szolgáltatóktól tiszteletteljes bánásmódot várunk el. A származás, bőrszín, vallás, világnézet, nem, nemi identitás, szexuális irányultság, fogyatékosság, életkor vagy hasonló jellemzők miatti megkülönböztetést a Platformon nem tűrjük el — lásd a [Diszkriminációellenes szabályzatot](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "A tartózkodás alatti magatartásra az [Alapszabályok vendégeknek](https://mybestdays.dk/rechtliches/grundregeln-gaeste), a szolgáltatókra a [Szolgáltatói magatartási kódex](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter) vonatkozik.",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Az Ön fiókja és a Platform használata",
          paragraphs: [
            "Foglaláshoz létrehozhat fiókot. Ön felel a hozzáférési adatai bizalmas kezeléséért, és haladéktalanul értesít minket, ha jogosulatlan használatot gyanít.",
            "A Platformot csak akkor használhatja, ha cselekvőképes és érvényesen köthet szerződéseket.",
            "A regisztrációkor és a foglaláskor megadott adatainak helyesnek és teljesnek kell lenniük — különösen a név, az elérhetőségek és az utazók száma. A szolgáltatónak szüksége van ezekre az adatokra a szálláshely biztosításához és a bejelentési kötelezettségei teljesítéséhez.",
            "Nem megengedett különösen:",
          ],
          list: [
            "a látszatfoglalás, a csalárd fizetés vagy más fizetési eszközének jogosulatlan használata;",
            "a Platform automatizált kiolvasása (scraping, crawler) a robots.txt fájlunk által megengedetten túl;",
            "olyan intézkedés, amely a Platformot vagy az annak alapját képező infrastruktúrát zavarja, túlterheli vagy azok biztonsági intézkedéseit megkerüli;",
            "jogellenes, sértő vagy megtévesztő tartalom közzététele értékelésekben, üzenetekben vagy profiladatokban;",
            "a foglalás Platformon kívüli lebonyolítására tett kísérlet, miután a kapcsolat a Platformon keresztül jött létre — lásd a [Platformon kívüli díjakat](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Árak",
          paragraphs: [
            "Minden árat teljes árként jelenítünk meg, az adókkal és a Platformon keresztül elszámolt valamennyi díjjal együtt, amint az utazási adatok (időszak és utazók száma) rögzültek. Ha egy elem csak a helyszínen esedékes, azt a foglalás lezárása előtt külön feltüntetjük.",
            "Az árakat a hirdetés pénznemében jelenítjük meg. Ha egy összeget kiegészítésképpen más pénznemben is látnak, az nem kötelező érvényű, tájékoztató jellegű átváltás; az elszámolás a hirdetés pénznemében történik, kivéve ha a fizetési folyamat során más szerepel.",
            "Az árak a foglalás lezárásáig változhatnak, például mert a szolgáltató módosítja azokat, vagy változik az elérhetőség. Irányadó az az ár, amelyet közvetlenül a kötelező érvényű foglalás előtt megjelenítünk, és amely a foglalási visszaigazolásban szerepel.",
            "A nyilvánvaló árhibák (pl. nagyságrendekkel téves összeg) sem minket, sem a szolgáltatót nem kötelezik. Ha ilyen hibát észlelünk, haladéktalanul tájékoztatjuk Önt; a foglalást ekkor díjmentesen lemondhatja.",
            "A szolgáltatási díjak összetételét a [Szolgáltatási díjakra vonatkozó tájékoztató](https://mybestdays.dk/rechtliches/servicegebuehren) tartalmazza. Az adókhoz és illetékekhez lásd az [Adózási szabályzatot](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Fizetés",
          paragraphs: [
            "A Platformon keresztüli fizetéseket a Stripe pénzforgalmi szolgáltató bonyolítja. A fizetési adatokat (pl. kártyaadatok) közvetlenül a Stripe gyűjti és kezeli; a myBestDays nem tárol teljes kártyaadatokat.",
            "Hogy mikor melyik összeg válik esedékessé — előleg, hátralék vagy helyszíni fizetés — a hirdetéstől függ, és a foglalás lezárása előtt fel van tüntetve. A részleteket a [Fizetési feltételek](https://mybestdays.dk/rechtliches/zahlungsbedingungen) szabályozzák.",
            "Amennyiben a hirdetés kauciót tüntet fel, az előzetesen engedélyezhető vagy beszedhető, és kár esetén egészben vagy részben visszatartható; irányadók a hirdetés adatai.",
            "Ha egy fizetés meghiúsul vagy visszaterhelik, a foglalás lemondható. A szolgáltató a lemondási feltételei szerint keletkezett összegeket továbbra is követelheti.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Szabályzatok",
          paragraphs: [
            "A jelen feltételeken túl az alábbi szabályzatok alkalmazandók, amelyek az Ön és köztünk létrejött szerződés részét képezik:",
          ],
          list: [
            "[Megfelelő tartalomra vonatkozó szabályok](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Értékelési szabályzat](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Diszkriminációellenes szabályzat](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Alapszabályok vendégeknek](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Lemondási feltételek](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Átfoglalási és visszatérítési szabályzat](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Súlyos zavarokra vonatkozó szabályzat](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Szerzői jogi szabályzat](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Adatvédelem és sütik",
          paragraphs: [
            "Hogy hogyan kezeljük a személyes adatokat, azt az [Adatvédelmi tájékoztató](https://mybestdays.dk/rechtliches/datenschutz) tartalmazza. Hogy mely sütiket és hasonló technológiákat alkalmazunk, azt a [Sütiszabályzat](https://mybestdays.dk/rechtliches/cookies) tartalmazza.",
            "Foglaláshoz továbbítjuk a szolgáltatónak azokat az adatokat, amelyekre a szállásszolgáltatás nyújtásához szüksége van. A szolgáltató ezekért önálló adatkezelő; rá a [Házigazdákra vonatkozó adatvédelmi előírások](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber) vonatkoznak.",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Akadálymentesség",
          paragraphs: [
            "A Platform akadálymentességének állapotát és az akadályok bejelentésének módját az [Akadálymentesítési nyilatkozat](https://mybestdays.dk/rechtliches/barrierefreiheit) írja le.",
            "Egy szálláshely akadálymentességére vonatkozó adatok a szolgáltatótól származnak. Ha bizonyos jellemzőkre van szüksége, tisztázza azokat a foglalás előtt az üzenetküldő funkción keresztül a szolgáltatóval.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Értékelések és felhasználói tartalom",
          paragraphs: [
            "A tartózkodás után értékelést adhat le. Értékelést csak az adhat le, aki a Platformon keresztül foglalt, és a tartózkodását megkezdte vagy megkezdhette volna — így biztosítjuk, hogy a közzétett értékelések valós vendégektől származzanak.",
            "Nem fizetünk értékelésekért, nem módosítjuk azok tartalmát, és nem nyomunk el értékelést pusztán azért, mert negatív. A részleteket és azokat az okokat, amelyek miatt egy értékelést eltávolítunk, az [Értékelési szabályzat](https://mybestdays.dk/rechtliches/bewertungsrichtlinien) tartalmazza.",
            "Az Ön által feltöltött tartalmakért — értékelések, fényképek, üzenetek, profiladatok — Ön marad a felelős. Nem kizárólagos, területileg és időben korlátlan, díjmentes jogot enged nekünk arra, hogy e tartalmakat a Platform üzemeltetése és népszerűsítése keretében többszörözzük, átdolgozzuk (pl. vágás, fordítás) és nyilvánossághoz közvetítsük. Tartalmait törölheti; a már közzétett összeállításokban megvalósult felhasználásokat ez nem érinti.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Üzenetek és kommunikáció a szolgáltatóval",
          paragraphs: [
            "Az Ön és a szolgáltató közötti üzenetek a Platformon keresztül zajlanak. Mi biztosítjuk az üzenetküldő funkciót, de nem vagyunk a tartalom küldői vagy címzettjei.",
            "Jogosultak vagyunk az üzeneteket automatizált módon ellenőrizni a jelen feltételek megsértése tekintetében (pl. a Platform megkerülésére szolgáló elérhetőségek, csalási minták, jogellenes tartalom), és az érintett üzeneteket visszatartani vagy eltávolítani. Az eltávolításról az A17. pont szerinti indokolással tájékoztatjuk Önt.",
            "A foglalásával kapcsolatos üzeneteket (visszaigazolás, változások, érkezési tájékoztató) a megadott e-mail-címre küldjük. Ezek az üzenetek szerződéses kommunikációnak minősülnek, és a foglalás fennállása alatt nem mondhatók le. Reklámüzeneteket csak annyiban kap, amennyiben hozzájárult, vagy a jog azt hozzájárulás nélkül megengedi; bármikor tiltakozhat ellenük.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Szellemi tulajdonjogok",
          paragraphs: [
            "A Platform, annak kialakítása, szoftvere, adatbázisai, szövegei és védjegyei védettek. Nem kizárólagos, át nem ruházható jogot kap arra, hogy a Platformot szálláshelyek keresésére és foglalására használja — ennél többet nem.",
            "Védjegyeink és logóink használatát a [Védjegyekre vonatkozó szabályok](https://mybestdays.dk/rechtliches/markenzeichen) szabályozzák.",
            "Ha úgy véli, hogy a Platformon lévő tartalom sérti a szerzői jogát, kövesse a [Szerzői jogi szabályzatot](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Mi a teendő, ha valami félresikerül",
          paragraphs: [
            "Ha a probléma magát a szálláshelyet érinti, először a szolgáltatóhoz forduljon — az üzenetküldő funkción keresztül vagy a helyszínen. Sok probléma így oldható meg a leggyorsabban.",
            "Ha a szolgáltatóval nem jut előre, vagy a probléma a Platformot, a fizetést vagy a foglalás lebonyolítását érinti, forduljon hozzánk. Hogy hogyan érhet el minket, és hogyan kezeljük a panaszokat, azt a [Panaszok és vitarendezés](https://mybestdays.dk/rechtliches/beschwerden) tartalmazza.",
            "Készítse elő: a foglalási számát, a foglaláshoz használt e-mail-címet, a probléma rövid leírását azzal, hogyan segítsünk, valamint a hozzá tartozó bizonyítékokat (fényképek, üzenetek, nyugták).",
            "Ha a szálláshely érkezéskor nem áll rendelkezésre, vagy lényegesen eltér a hirdetéstől, az [Átfoglalási és visszatérítési szabályzat](https://mybestdays.dk/rechtliches/rueckerstattung) alkalmazandó.",
            "Az Európai Bizottság online vitarendezési platformját az (EU) 2024/3228 rendelet hatályon kívül helyezte, és az beszüntette működését; útként már nem áll rendelkezésre. Hogy mely szervek lépnek a helyébe, azt a [Panaszok és vitarendezés](https://mybestdays.dk/rechtliches/beschwerden) tartalmazza.",
            "Ha intézkedést hoztunk az Ön tartalma vagy fiókja ellen, a belső panaszkezelési eljárásunkon túl az (EU) 2022/2065 rendelet 21. cikke szerint tanúsított peren kívüli vitarendezési testülethez is fordulhat. Annak döntései ránk nem kötelezőek.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Intézkedések a nem megfelelő magatartás ellen",
          paragraphs: [
            "Ha megsérti a jelen feltételeket vagy az A9. pontban felsorolt szabályzatok valamelyikét, a jogsértés súlyához, gyakoriságához és hatásához mérten fokozatosan eltávolíthatunk tartalmat vagy korlátozhatjuk annak láthatóságát, letilthatunk funkciókat, lemondhatunk foglalásokat, illetve ideiglenesen vagy véglegesen letilthatjuk a fiókját.",
            "Intézkedés előtt megvizsgáljuk az egyedi esetet. Nyilvánvalóan jogellenes tartalom, személyek veszélyeztetése vagy csalás esetén azonnal eljárhatunk.",
            "Minden intézkedést megindokolunk, és felhívjuk a figyelmét a panasz útjára — lásd az A17. pontot.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Jogellenes tartalom bejelentése és az intézkedések indokolása",
          paragraphs: [
            "Bárki bejelenthet nekünk olyan tartalmat, amelyet jogellenesnek tart. Az (EU) 2022/2065 rendelet 16. cikke szerinti bejelentési eljárást, kapcsolattartó pontjainkat és a bejelentések kezelését a [Digitális szolgáltatásokról szóló jogszabály](https://mybestdays.dk/rechtliches/dsa) írja le.",
            "Ha intézkedést hozunk az Ön által feltöltött tartalom vagy a fiókja ellen, indokolást kap, amely megjelöli az okot, a ténybeli alapot, a jogalapot vagy a megsértett szerződéses rendelkezést, valamint a panasz lehetőségeit.",
            "Minden intézkedéssel szemben hat hónapon belül díjmentesen panaszt nyújthat be. A panaszokat emberek dolgozzák fel, nem kizárólag automatizált módon.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Felelősségkorlátozás",
          paragraphs: [
            "Korlátlanul felelünk szándékosságért és súlyos gondatlanságért, az élet, testi épség vagy egészség megsértéséből eredő károkért, valamint az általunk vállalt garancia keretében. A termékfelelősségi jog szerinti igényeket ez nem érinti.",
            "Egyebekben felelősségünk arra az előre látható kárra korlátozódik, amely jellemzően azon kötelezettségek megsértéséből ered, amelyek teljesítésében Ön bízhat — és csak annyiban, amennyiben az alkalmazandó jog ilyen korlátozást megenged.",
            "Nem felelünk magáért a szállásszolgáltatás nyújtásáért, sem a szolgáltatók vagy más vendégek magatartásáért. A szállásszolgáltatás szerződéses partnere a szolgáltató.",
            "Nem felelünk a szolgáltatók által feltöltött adatok helyességéért, amennyiben azokat nem ismertük és nem is kellett ismernünk. Amint jogellenes adatról tudomást szerzünk, haladéktalanul eljárunk.",
            "Minden további felelősség kizárt. A kógens törvényi igényeket, különösen a fogyasztói jogokat, ez nem érinti.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Alkalmazandó jog és illetékesség",
          paragraphs: [
            "A dán jog alkalmazandó — az üzemeltető székhelye Dániában van — az áruk nemzetközi adásvételi szerződéseiről szóló ENSZ-egyezmény kizárásával. Annak az államnak a kógens fogyasztóvédelmi rendelkezéseit, amelyben szokásos tartózkodási helye van, az 593/2008/EK rendelet (Róma I.) 6. cikke szerint ez nem érinti.",
            "Fogyasztóként a lakóhelye szerinti bíróság előtt vagy a dániai székhelyünkön perelhet minket; mi Önt csak a lakóhelye szerinti bíróság előtt perelhetjük (az 1215/2012/EU rendelet 17—19. cikke).",
            "A szállásszerződésre rendszerint annak az államnak a joga alkalmazandó, amelyben a szálláshely található; ingatlan bérletéből eredő keresetekre annak bíróságai kizárólagosan illetékesek.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Utazási szolgáltatásegyüttesek",
          paragraphs: [
            "A myBestDays kizárólag szállásszolgáltatásokat közvetít. Nem kínálunk repülőjegyet, bérautót, személyszállítási szolgáltatást, kirándulásokat vagy látványosságokat, és nem állítunk össze az (EU) 2015/2302 irányelv értelmében vett utazási csomagokat.",
            "Ha a jövőben további utazási szolgáltatásokat is közvetítünk, a foglalás előtt a jogszabályban előírt formanyomtatvánnyal tájékoztatjuk Önt arról, hogy utazási csomag vagy utazási szolgáltatásegyüttes jön-e létre, és abból milyen jogok illetik meg.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Időtartam, letiltás és felmondás",
          paragraphs: [
            "A Platform használatára vonatkozó szerződés határozatlan időre szól. Fiókját bármikor, indokolás nélkül törölheti; a fennálló foglalásokat ez nem érinti, azok az adott szolgáltató feltételei szerint bonyolódnak le.",
            "A használati szerződést 14 napos határidővel felmondhatjuk. A jelen feltételek súlyos megsértése esetén azonnali hatállyal felmondhatunk és letilthatjuk a fiókot.",
            "A megszűnést követően töröljük adatait, amennyiben nem áll fenn törvényi megőrzési kötelezettség vagy a megőrzéshez fűződő jogos érdek; a részleteket az [Adatvédelmi tájékoztató](https://mybestdays.dk/rechtliches/datenschutz) szabályozza.",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Módosítási záradék",
          paragraphs: [
            "A jelen feltételeket módosíthatjuk, ha ennek tárgyilagos oka van — például megváltozott jogi helyzet, legfelsőbb bírósági gyakorlat, a Platform új vagy megszűnő funkciói, illetve szabályozási hézagok megszüntetése.",
            "A módosításokat a hatálybalépés előtt legalább 30 nappal szöveges formában bejelentjük. Ha a hatálybalépésig nem tiltakozik, a módosított feltételeket elfogadottnak tekintjük; erre a joghatásra a bejelentésben külön felhívjuk a figyelmét. Ha tiltakozik, a használati szerződést a hatálybalépés időpontjára felmondhatjuk.",
            "A már megkötött foglalásokra a foglalás időpontjában hatályos változat irányadó.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Szálláshelyek",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. E szakasz hatálya",
          paragraphs: [
            "E szakasz a Platformon keresztüli szálláshelyfoglalásra vonatkozik — nyaralóingatlanokra éppúgy, mint szálláshely-szolgáltató vállalkozások szobáira és egységeire.",
            "Kiegészíti az A. szakaszt. Ellentmondás esetén a jelen B. szakasz az irányadó.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Szerződéses jogviszony",
          paragraphs: [
            "A szállásszerződés kizárólag Ön és a szolgáltató között jön létre. A myBestDays nem szerződő fél.",
            "Egy szálláshely bemutatása a Platformon felhívás Önhöz, hogy foglalási ajánlatot tegyen. A fizetési kötelezettséggel járó foglalási gombra kattintással kötelező érvényű ajánlatot tesz.",
            "A szerződés akkor jön létre, amikor a foglalást visszaigazolják. A foglalási visszaigazolást az Ön által megadott e-mail-címre küldjük; az megnevezi a szolgáltatót, a foglalt szolgáltatást, az időszakot, a teljes árat és a lemondási feltételeket.",
            "Kérésre foglalható szálláshelyeknél a szerződés csak a szolgáltató elfogadásával jön létre. Addig a fizetési eszköze előzetesen engedélyezhető, de nem terhelhető meg.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Amit mi teszünk",
          paragraphs: [
            "Biztosítjuk a Platformot, megjelenítjük a szolgáltatók hirdetéseit, fogadjuk a foglalását, továbbítjuk azt a szolgáltatónak, és megküldjük Önnek a foglalási visszaigazolást.",
            "Lebonyolítjuk a fizetést, amennyiben a hirdetés a Platformon keresztüli fizetést irányoz elő, és biztosítjuk az üzenetküldő funkciót Ön és a szolgáltató között.",
            "A szálláshelyet nem mi biztosítjuk, nem mi üzemeltetjük, és nem vállalunk szavatosságot annak állapotáért. Nem vagyunk az Ön utazásszervezője.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Amit Önnek tennie kell",
          paragraphs: [
            "A foglalás előtt teljes egészében nézze át a hirdetést: felszereltség, férőhelykorlát, érkezési és távozási időpontok, házirend, lemondási feltételek és a csak a helyszínen felmerülő költségek.",
            "Tartsa be a hirdetésben feltüntetett maximális férőhelyszámot. Ha a foglaltnál több személy érkezik, a szolgáltató megtagadhatja a fogadást vagy felárat kérhet.",
            "Tartsa be a szolgáltató házirendjét és az [Alapszabályokat vendégeknek](https://mybestdays.dk/rechtliches/grundregeln-gaeste). A szálláshelyet gondosan kezeli, és felel az Ön vagy útitársai által okozott károkért.",
            "Ha a szolgáltatónak vagy egy hatóságnak a bejelentkezéshez adatokra van szüksége (pl. bejelentőlap, személyazonosító adatok, idegenforgalmiadó-nyilatkozat), azokat időben rendelkezésre bocsátja.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Árak és fizetés",
          paragraphs: [
            "A teljes ár magában foglalja a foglalt időszakra vonatkozó szállásdíjat és a hirdetésben feltüntetett, a Platformon keresztül elszámolt felárakat és díjakat.",
            "A helyszínen további összegek merülhetnek fel — különösen idegenforgalmi adó vagy helyi illetékek, kaució, valamint a csak a helyszínen igénybe vett kiegészítő szolgáltatások. Ezeket a foglalás lezárása előtt helyszíni költségként tüntetjük fel, amennyiben a szolgáltató megadta őket.",
            "Ha a hirdetés előleget irányoz elő, a fennmaradó összeg a hirdetésben megjelölt időpontban válik esedékessé. Ha a hátralék nem érkezik meg, a szolgáltató a lemondási feltételei szerint elállhat a szerződéstől.",
            "A szolgáltatónak a Platformon kívül teljesített fizetéseket nem fogadjuk el, és nem tudjuk nyomon követni; azok nem tartoznak a fizetéslebonyolításunk alá — lásd a [Platformon kívüli díjakat](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Módosítások, lemondások és visszatérítések",
          paragraphs: [
            "Hogy egy foglalás díjmentesen lemondható vagy módosítható-e és milyen feltételekkel, az a hirdetésben feltüntetett, a szolgáltató által választott lemondási feltételektől függ. Azokat a feltételeket, amelyeket a szolgáltatók választására bocsátunk, a [Lemondási feltételek](https://mybestdays.dk/rechtliches/stornierungsbedingungen) írják le.",
            "Meghatározott időszakra foglalt szállásszolgáltatások esetén a 2011/83/EU irányelv 16. cikkének l) pontja, illetve a megfelelő nemzeti rendelkezések szerint rendszerint nem áll fenn törvényi elállási jog. A kógens törvényi jogokat ez nem érinti.",
            "Ha a szolgáltató mond le, a Platformon keresztül fizetett összeget teljes egészében visszatérítjük. Ezen felül az [Átfoglalási és visszatérítési szabályzat](https://mybestdays.dk/rechtliches/rueckerstattung) alkalmazandó.",
            "Ha mindkét fél befolyásán kívül eső esemény akadályozza meg az utazást vagy a tartózkodást, a [Súlyos zavarokra vonatkozó szabályzat](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen) alkalmazandó.",
            "A visszatérítések a fizetéshez használt fizetési eszközre történnek, kivéve ha más megállapodás született.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Amit ezen kívül tudnia kell",
          paragraphs: [
            "A szolgáltatók lehetnek magánházigazdák vagy vállalkozók. Hogy egy szolgáltató vállalkozóként jár-e el, azt a hirdetésben feltüntetjük. Ha nem vállalkozóról van szó, az uniós fogyasztóvédelmi rendelkezések a szállásszerződésre nem alkalmazandók — erre a körülményre a hirdetésben felhívjuk a figyelmét.",
            "A fekvésre, környezetre, távolságokra és harmadik felek értékeléseire vonatkozó adatok tájékoztató jellegűek. Kötelezőek a magára a foglalt szolgáltatásra vonatkozó adatok.",
            "A rövid távú bérbeadás nyilvántartásba vételi kötelezettségével érintett területeken a hirdetésben feltüntetjük a szolgáltató által megadott nyilvántartási számot; lásd a [Rövid távú bérbeadást](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Egy objektum- vagy szobatípus több azonos egysége esetén e típus egy egységét foglalja le. Hogy melyik konkrét egységet kapja, azt a szolgáltató határozza meg.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Szójegyzék",
      paragraphs: [
        "Az alábbi fogalmak a jelen feltételekben az itt megadott jelentéssel bírnak.",
      ],
      definitions: [
        {
          term: "Szolgáltató",
          description:
            "Az a természetes vagy jogi személy, aki szálláshelyet kínál a Platformon, és a szállásszerződés szerződő felévé válik.",
        },
        {
          term: "Kérésre foglalás",
          description:
            "Olyan foglalás, amely csak a szolgáltató kifejezett elfogadásával jön létre, szemben az azonnali foglalással.",
        },
        {
          term: "Foglalási visszaigazolás",
          description:
            "Az az üzenet, amellyel visszaigazoljuk Önnek a szállásszerződés létrejöttét; tartalmazza a szolgáltatót, a szolgáltatást, az időszakot, a teljes árat és a lemondási feltételeket.",
        },
        {
          term: "Egység",
          description:
            "Egy objektum- vagy szobatípus alatti konkrét, foglalható objektum. Az egységet értékesítjük, a típust írjuk le és árazzuk.",
        },
        {
          term: "Teljes ár",
          description:
            "A foglalás lezárásakor feltüntetett összeg, beleértve minden adót és a Platformon keresztül elszámolt valamennyi díjat.",
        },
        {
          term: "Maximális férőhelyszám",
          description:
            "A hirdetésben feltüntetett legnagyobb megengedett létszám, amely a szálláshelyen éjszakázhat.",
        },
        {
          term: "Kaució",
          description:
            "A szolgáltató által károk fedezetéül kért összeg, amelyet előzetesen engedélyeznek vagy beszednek, és a tartózkodás után felszabadítanak vagy beszámítanak.",
        },
        {
          term: "Idegenforgalmi adó",
          description:
            "Az éjszakázás után fizetendő helyi illeték, amelyet településtől függően a helyszínen vagy a szolgáltatón keresztül szednek be; ez nem a myBestDays szolgáltatása.",
        },
        {
          term: "Platform",
          description:
            "A weboldal, a mobilalkalmazások és minden egyéb hozzáférési pont, amelyen keresztül a myBestDays szálláshelyeket jelenít meg és foglalásokat közvetít.",
        },
        {
          term: "Szolgáltatási díj",
          description:
            "A myBestDays közvetítői szolgáltatásának ellenértéke. Hogy ki viseli és hogyan tüntetjük fel, azt a szolgáltatási díjakra vonatkozó tájékoztató tartalmazza.",
        },
        {
          term: "Lemondási feltételek",
          description:
            "A szolgáltató által választott szabályok arról, hogy meddig és milyen költséggel mondható le vagy módosítható egy foglalás.",
        },
        {
          term: "Szálláshely",
          description:
            "A szolgáltató által kínált szállásszolgáltatás — egy nyaralóingatlan vagy egy szoba- vagy objektumtípus egy egysége.",
        },
        {
          term: "Helyszíni költségek",
          description:
            "Olyan összegek, amelyeket nem a Platformon keresztül számolunk el, hanem a szolgáltatóval szemben válnak esedékessé, például idegenforgalmi adó, kaució vagy a helyszínen igénybe vett kiegészítő szolgáltatások.",
        },
      ],
    },
  ],
};
