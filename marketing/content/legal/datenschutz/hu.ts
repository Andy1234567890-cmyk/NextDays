// Ungarische Übersetzung von `de.ts`.
//
// Inhaltliche Änderungen gehören ZUERST in `de.ts` (dort stehen auch die
// Belege zu den Empfängern) und werden von dort nachgezogen — nie nur hier.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Adatvédelmi nyilatkozat",
  metaDescription:
    "Hogyan kezeli a myNextDays a személyes adatokat: célok, jogalapok, címzettek, tárolási idő és az Ön GDPR szerinti jogai.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Jelen nyilatkozat azt ismerteti, hogyan kezeli a ${ANBIETER.firma} a személyes adatokat — a jelen weboldal meglátogatásakor, a myNextDays platform (irányítópult, piactér és mobilalkalmazás) használatakor, valamint az ügyfeleinkkel fennálló üzleti kapcsolat keretében.`,
    "Ennek alapja az (EU) 2016/679 rendelet (GDPR), valamint a dán adatvédelmi törvény (databeskyttelsesloven). Nem adunk el adatokat, nem készítünk profilokat, és weboldalainkon nem alkalmazunk elemző, nyomkövető vagy reklámszolgáltatásokat. Reklámcélból kizárólag ott kezelünk adatokat, ahol Ön ehhez kifejezetten hozzájárult — nevezetesen a hírlevelünkhöz (lásd a Kommunikáció szakaszt), amelyről bármikor, egyetlen kattintással leiratkozhat.",
  ],
  sections: [
    {
      heading: "Adatkezelő",
      paragraphs: [
        "A jelen nyilatkozatban ismertetett adatkezelésekért felelős adatkezelő:",
      ],
      zeilen: [
        {
          label: "Vállalkozás",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Cím",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Hatály és szerepek",
      unterpunkte: [
        {
          paragraphs: [
            "A jelen weboldal meglátogatása, az Ön ügyfélfiókja és az üzleti kapcsolatunk lebonyolítása tekintetében mi vagyunk az adatkezelő a GDPR 4. cikk 7. pontja értelmében.",
          ],
        },
        {
          paragraphs: [
            "Azon adatok tekintetében, amelyeket ügyfeleink (bérbeadók, szállodák, ügynökségek) a Platformon a vendégeikről, tulajdonosaikról és munkavállalóikról kezelnek, az ügyfelek az adatkezelők, mi pedig a GDPR 28. cikke szerinti adatfeldolgozók. A részleteket az [adatfeldolgozási megállapodás](/auftragsverarbeitung) tartalmazza.",
          ],
        },
        {
          paragraphs: [
            "Ha Ön vendégként a piacterünkön keresztül szállást foglal, a foglalási és kapcsolattartási adatait egyrészt a saját nevünkben (a piactér üzemeltetése, a fizetés lebonyolítása), másrészt a szállást nyújtó vállalkozás javára kezeljük. Az Ön szálláshely-szolgáltatási szerződése kizárólag a vállalkozással jön létre; annak adatvédelmi tájékoztatója emellett alkalmazandó.",
          ],
        },
      ],
    },
    {
      heading: "A jelen weboldal meglátogatása",
      unterpunkte: [
        {
          titel: "Szervernaplók",
          paragraphs: [
            "Minden megnyitáskor a böngészője műszakilag szükséges adatokat továbbít, amelyeket a webszerverünk naplóz: IP-cím, dátum és időpont, a megnyitott cím, az átvitt adatmennyiség, státuszkód, hivatkozó oldal (referrer) és böngészőazonosító. A cél az oldal biztosítása, valamint a támadások és üzemzavarok felismerése és elhárítása. A jogalap a GDPR 6. cikk (1) bekezdés f) pontja; a jogos érdekünk a biztonságos és stabil üzemeltetés. A naplókat csak addig őrizzük meg, ameddig ez az üzemeltetéshez és a biztonsághoz szükséges, és nem kapcsoljuk össze más adatokkal.",
          ],
        },
        {
          titel: "Betűtípusok",
          paragraphs: [
            "Az alkalmazott betűtípusok helyben, a saját szerverünkön vannak beágyazva. Nem jön létre kapcsolat a Google Fonts vagy más betűtípus-szolgáltatás felé.",
          ],
        },
        {
          titel: "Ikonok",
          paragraphs: [
            "A jelen weboldal ikonjai a betűtípusokhoz hasonlóan nálunk vannak: a szerverünkön kerülnek beépítésre az oldalba, és nem egy ikonszolgáltatásból töltődnek be utólag. Ennek során nem jön létre kapcsolat harmadik féllel, és az Ön IP-címe senkinek nem kerül továbbításra.",
          ],
        },
        {
          titel: "A kapcsolatfelvételi űrlap spamvédelme (reCAPTCHA)",
          paragraphs: [
            "A kapcsolatfelvételi űrlapunkat a Google Ireland Limited reCAPTCHA Enterprise szolgáltatása védi az automatizált, nagy számban érkező megkeresések ellen. A böngészője csak akkor tölt be az űrlap kitöltésekor egy szkriptet a www.google.com címről, ha Ön ehhez hozzájárul; ennek során az Ön IP-címe és az űrlappal való interakciójára vonatkozó adatok továbbításra kerülnek a Google-hoz, és ott kiértékelik őket annak érdekében, hogy elkülönítsék az embert a szkripttől. A jogalap a GDPR 6. cikk (1) bekezdés a) pontja (hozzájárulás); ezt kiegészítően a [Google adatvédelmi nyilatkozata](https://policies.google.com/privacy) alkalmazandó.",
            "Az Ön hozzájárulása nélkül a Google-tól semmi nem töltődik be, és oda nem folynak adatok; az űrlapot ilyenkor nem fogadjuk el, de bármikor írhat nekünk e-mailt. A hozzájárulását a [süti-irányelvben](/cookie-richtlinie) módosíthatja vagy visszavonhatja.",
          ],
        },
        {
          titel: "Nincs elemzés, nincs reklám",
          paragraphs: [
            "Nem alkalmazunk elemző, nyomkövető vagy reklámszolgáltatásokat (nincs Google Analytics, nincsenek pixelek, nincsenek reklámhálózatok), és nem készítünk profilokat. Hogy a Platform műszakilag mely sütikre szorul, a [süti-irányelvben](/cookie-richtlinie) olvasható.",
          ],
        },
      ],
    },
    {
      heading: "Ügyfélfiók és a Platform használata",
      paragraphs: [
        "A fiók regisztrálásához és üzemeltetéséhez azokat az adatokat kezeljük, amelyeket Ön vagy a vállalkozása megad: név, cégnév és társasági forma, cím, e-mail-cím, telefonszám, szerepkör és jogosultságok, nyilvántartási adatok (pl. cégjegyzék- vagy adószám), a kifizetésekhez szükséges bankszámlaadatok, valamint a fiókban létrehozott tartalmak.",
        "A hozzáférés védelme érdekében ezen túl bejelentkezési naplókat (a bejelentkezés időpontja, IP-címe, eszköze és böngészője) és — ha aktiválva van — a kétfaktoros hitelesítés adatait is kezeljük.",
        "Bejelentkezés Google-fiókkal: e-mail-cím és jelszó helyett Google-fiókkal is bejelentkezhet. Ha ezt az utat választja, a Google Ireland Limited kizárólag az Ön e-mail-címét, nevét, profilképét és a Google-fiókjának egy azonosítóját adja át nekünk („openid”, „email”, „profile” hatókörök) — kifejezetten nem kapunk hozzáférést az e-mailjeihez, névjegyeihez, fájljaihoz vagy naptárához. Az Ön Google-jelszavát nem ismerjük meg. A Google a bejelentkezési műveletet ennek során önálló adatkezelőként végzi; erre a [Google adatvédelmi nyilatkozata](https://policies.google.com/privacy) alkalmazandó. A jogalap a GDPR 6. cikk (1) bekezdés b) pontja, mivel a bejelentkezés a szerződés teljesítését szolgálja; ennek a bejelentkezési útnak a választása önkéntes, és bármikor felváltható az e-mail-címmel és jelszóval történő bejelentkezéssel.",
        "A jogalap a GDPR 6. cikk (1) bekezdés b) pontja (a felhasználási szerződés teljesítése, lásd az [ÁSZF-et](" +
          AGB_URL +
          ")), a hozzáférés védelme tekintetében a GDPR 6. cikk (1) bekezdés f) pontja, az adó- és kereskedelmi jogi megőrzés tekintetében pedig a GDPR 6. cikk (1) bekezdés c) pontja.",
      ],
    },
    {
      heading: "Foglalások, vendég- és ingatlanadatok",
      paragraphs: [
        "A Platformon rezervációk, vendégadatok, üzenetek, feladatok és elszámolások kezelése történik. Ide tartozik különösen a vendég neve és kapcsolattartási adatai, az érkezés és az elutazás, az utazók száma, az árak és a fizetési állapot, az üzenetváltások előzményei, valamint — amennyiben a vállalkozás rögzíti — a bejelentőlap-adatok és a különleges kérések.",
        "Ez az adatkezelés az adott vállalkozás megbízásából és utasítása szerint történik. Ezeket az adatokat nem használjuk saját célra, nem használjuk reklámra és nem használjuk MI-modellek betanítására.",
        "Egy vállalkozáson belül az adatok szerepkörök szerint el vannak választva: a takarító és a szolgáltató munkatársak nem látnak pénzügyi és értékesítési adatokat, a tulajdonosok pedig csak a saját ingatlanaikat. A különböző vállalkozások adatai műszakilag el vannak választva (bérlőspecifikus hozzáférési szabályok az adatbázisban).",
      ],
    },
    {
      heading: "A fizetés lebonyolítása",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "A kártyás fizetések és a kifizetések a Stripe Payments Europe, Limited (Írország) útján zajlanak. Ennek során a fizetéshez szükséges adatok (összeg, valuta, fizetési mód, név, e-mail-cím, foglalási hivatkozás), az ügyfeleink fiókjai esetében pedig a jogszabályban előírt azonosítási adatok (a fiók birtokosa, tényleges tulajdonosok, okmányadatok, bankszámlaadatok) továbbításra kerülnek a Stripe felé. Teljes kártyaadatok nem érkeznek a rendszereinkbe. A jogalap a GDPR 6. cikk (1) bekezdés b) pontja, az azonosítási és a pénzmosás elleni kötelezettségek tekintetében pedig a GDPR 6. cikk (1) bekezdés c) pontja. A részleteket a [Stripe adatvédelmi nyilatkozata](https://stripe.com/privacy) szabályozza.",
            "Fizetési linkek kiegészítő szolgáltatásokhoz: ha egy vállalkozás kiegészítő szolgáltatást (pl. takarítást vagy mosást) fizetési linken keresztül számláz ki a vendégének, ez a link egy Stripe által üzemeltetett fizetési oldalra vezet. Ehhez a szolgáltatás megnevezését, az összeget, a valutát, valamint a foglalásra és a vállalkozásra vonatkozó belső hivatkozást továbbítjuk a Stripe felé; a vállalkozás céglogója az ő Stripe-fiókjába kerül átvitelre, hogy az oldal az ő márkáját jelenítse meg. Magán a fizetési oldalon a Stripe a saját adatkezelői felelősségében gyűjti a vendég fizetési és eszközadatait. Hozzánk csak a fizetési állapot, az összeg, a visszatartott összegek és a fizetés azonosítói kerülnek vissza — kártyaadatok nem.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Amennyiben a vállalkozás a PayPal-t fizetési módként kínálja, a fizetési adatok a PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxemburg) részére kerülnek továbbításra. Erre a [PayPal adatvédelmi nyilatkozata](https://www.paypal.com/de/webapps/mpp/ua/privacy-full) alkalmazandó.",
          ],
        },
      ],
    },
    {
      heading: "Értékesítési csatornák és portálok",
      paragraphs: [
        "Ha egy vállalkozás az ingatlanait olyan portálokon értékesíti, mint a Booking.com, az Airbnb vagy az Expedia, az elérhetőségek, az árak, a korlátozások és a foglalási adatok a csatlakoztatást biztosító szolgáltatónkon, a Channex.io Ltd (Egyesült Királyság) útján kerülnek kicserélésre az adott portállal. Ebből az irányból kapjuk meg a portál foglalási és vendégadatait.",
        "Az adott portálra annak saját adatvédelmi rendelkezései alkalmazandók; ennyiben a portál önállóan felelős. A továbbítás jogalapja a GDPR 6. cikk (1) bekezdés b) pontja, összefüggésben a vállalkozás megbízásával.",
      ],
    },
    {
      heading: "Kommunikáció",
      unterpunkte: [
        {
          titel: "E-mail",
          paragraphs: [
            "A használat keretében küldött e-maileket (foglalási visszaigazolások, rendszerüzenetek, támogatás, megerősítő és meghívó linkek) egy saját, általunk üzemeltetett levelezőszerveren keresztül küldjük és fogadjuk. Ezekhez az üzenetekhez nincs bekapcsolva külső küldőszolgáltatás.",
          ],
        },
        {
          titel: "Hírlevél és előregisztráció",
          paragraphs: [
            "A weboldalunkon feliratkozhat a myNextDays-szel kapcsolatos hírekre (előregisztráció/hírlevél). Ennek során az Ön e-mail-címét, a nyelvét és azt a helyet kezeljük, ahol feliratkozott.",
            "A feliratkozás dupla megerősítéses (double opt-in) eljárásban zajlik: a feliratkozás után egy e-mailt kap megerősítő linkkel; a feliratkozás csak az arra való kattintással lesz hatályos. A hozzájárulás igazolása céljából eltároljuk a feliratkozás és a megerősítés időpontját, az ennek során használt IP-címet, a böngészőazonosítót, valamint annak a szövegnek a szó szerinti tartalmát, amelyhez hozzájárult. Ezek az adatok kizárólag a GDPR 7. cikk (1) bekezdése szerinti igazolást szolgálják, és reklámcélból nem kerülnek kiértékelésre.",
            "A jogalap az Ön GDPR 6. cikk (1) bekezdés a) pontja szerinti hozzájárulása; az igazolás tárolását a GDPR 6. cikk (1) bekezdés c) pontjára, összefüggésben a GDPR 7. cikk (1) bekezdésével alapozzuk. A hozzájárulást bármikor, a jövőre nézve visszavonhatja — a minden hírlevél-e-mailben található leiratkozási linken vagy formai kötöttség nélkül, nekünk küldött e-mailben. A visszavonás nem érinti az addig végzett adatkezelés jogszerűségét.",
            "A hírlevelek kezeléséhez és kiküldéséhez a Brevo-t (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Franciaország; német fióktelep: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin) alkalmazzuk adatfeldolgozóként. Továbbításra kerül az Ön e-mail-címe és a megnevezett kiegészítő adatok (nyelv, forrás). Az adatok kezelése az Európai Unión belüli szervereken (Franciaország és Németország) történik; a Brevo-val a GDPR 28. cikke szerinti adatfeldolgozási megállapodás áll fenn. Erre a [Brevo adatvédelmi nyilatkozata](https://www.brevo.com/legal/privacypolicy/) alkalmazandó.",
            "Ha hírlevelet küldünk, a Brevo a megbízásunkból megméri, hogy az üzenetet megnyitották-e, és hogy a benne szereplő linkekre rákattintottak-e. Ez a mérés segít nekünk a tartalom és a gyakoriság alakításában; része a hozzájárulásnak, és az Ön leiratkozásával véget ér. Más adatforrásokkal való összekapcsolás vagy profilalkotás nem történik.",
            "Amíg a megerősítés hiányzik, a címére nem küldünk levelet, és azt nem továbbítjuk a Brevo felé; a nem megerősített bejegyzés hét nap után érvényét veszti. Leiratkozás után a címet letiltjuk a küldésből, a hozzájárulás és a leiratkozás igazolását pedig addig őrizzük meg, ameddig abból igények érvényesíthetők; kérésre teljesen töröljük.",
          ],
        },
        {
          titel: "Üzenetek a Platformon",
          paragraphs: [
            "A vendég és a vállalkozás közötti üzenetek a Platformon tárolásra kerülnek, hogy mindkét fél láthassa az előzményeket. Ha egy vállalkozás letilt egy vendéget, az üzenetcsatorna zárolásra kerül; a meglévő üzenetek a nyomon követhetőség érdekében megmaradnak.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Ha egy vállalkozás használja a WhatsApp-csatlakozást, az üzenetek tartalma és a résztvevők telefonszámai a Meta Platforms Ireland Limited WhatsApp Business Platform szolgáltatásán keresztül kerülnek továbbításra. E funkció használatáról a vállalkozás dönt; aktiválás nélkül nem történik továbbítás.",
          ],
        },
      ],
    },
    {
      heading: "Automatizált funkciók és mesterséges intelligencia",
      paragraphs: [
        "Az itt ismertetett funkciókra a GDPR mellett az (EU) 2024/1689 rendelet (MI-rendelet, „AI Act”) is alkalmazandó, amelynek 50. cikke szerinti átláthatósági kötelezettségei 2026. augusztus 2. óta alkalmazandók.",
      ],
      unterpunkte: [
        {
          titel: "Válaszjavaslatok",
          paragraphs: [
            "Az üzenetek beérkező mappájában megjelenő válaszjavaslatokhoz — amennyiben a funkció a vállalkozás számára aktiválva van — a Groq, Inc. (USA) nyelvimodell-szolgáltatását alkalmazzuk. Ennek során az adott üzenetkontextus továbbításra kerül a szolgáltatáshoz. A javaslatok nem kerülnek automatikusan elküldésre; az elküldésről mindig ember dönt. A GDPR 22. cikke értelmében vett, joghatással járó automatizált döntéshozatal nem történik.",
            "Ez tehát nem olyan MI-rendszer, amely az MI-rendelet 50. cikk (1) bekezdése értelmében közvetlenül természetes személyekkel lép interakcióba: a kötelezettség KÖZVETLEN interakciót feltételez, amelyben maga az MI kommunikál a személlyel, és nem emberi közvetítőn keresztül. Itt a funkció olyan szöveget javasol a vállalkozásnak, amelyet egy munkatárs ellenőriz, módosíthat és maga küld el — ez a munkatárs a közvetítő, a vendég a vállalkozással és nem egy chatbottal levelez. Automatikusan válaszoló asszisztens nincs használatban. A megítélésünk szerint a funkció az MI-rendelet III. melléklete szerinti nagy kockázatú MI egyik tényállását sem teljesíti.",
            "A vendégekhez küldött üzenetek továbbá nem minősülnek az MI-rendelet 50. cikk (4) bekezdése értelmében vett „közérdekű kérdésekről szóló szövegnek”: nem kerülnek közzétételre, hanem egyénileg, egy meghatározott személynek kerülnek elküldésre, és egy tartózkodás lebonyolítására vonatkoznak. Ettől függetlenül itt érvényesül az elküldő munkatárs emberi ellenőrzése.",
            "Ha a jövőben olyan funkciót ajánlanánk, amely önállóan — emberi jóváhagyás nélkül — válaszol a vendégeknek, a vendéget a párbeszéd elején látható módon tájékoztatjuk arról, hogy MI-rendszerrel levelez. E tájékoztatás nélkül ilyen funkciót nem biztosítunk.",
          ],
        },
        {
          titel: "Szerepek az MI-rendelet szerint",
          paragraphs: [
            "A termékbe beépített MI-funkciók tekintetében mi az MI-rendelet 3. cikk 4. pontja értelmében vett alkalmazók vagyunk; az alapul szolgáló nyelvi modellek szolgáltatói az adott modellszolgáltatók. Ha egy vállalkozás e funkciókat a szakmai tevékenysége keretében használja, ő maga is alkalmazónak minősül, és őt terheli az MI-rendelet 4. cikke szerinti MI-jártassági kötelezettség, amely 2025. február 2. óta a vállalkozás méretétől függetlenül alkalmazandó. 2026. július 27. óta ez az (EU) 2026/1744 rendelet szerinti szövegváltozatban alkalmazandó: a szolgáltatók és az alkalmazók intézkedéseket tesznek a személyzetük MI-jártasságának fejlesztése érdekében; meghatározott szintet ennek során kifejezetten nem kell garantálni. Mi az alkalmazásban és a súgóközpontunkban elhelyezett tájékoztatással támogatjuk ezt; a saját munkavállalók képzése továbbra is a vállalkozás feladata.",
            "Ha egy vállalkozás a fiókját saját MI-asszisztenssel kapcsolja össze (lásd a következő pontot), ennek tekintetében is ő az MI-rendelet szerinti alkalmazó — ő dönt az alkalmazásról, és ő fogalmazza meg a kéréseket. Maga a csatlakozási felület nem MI-rendszer: adatokat olvas ki az adatbázisból és adja vissza őket, következtetések levonása nélkül; az MI-rendelet (12) preambulumbekezdése az ilyen rendszereket kifejezetten elhatárolja az MI-től.",
          ],
        },
        {
          titel: "Összekapcsolás saját MI-asszisztenssel",
          paragraphs: [
            "Egy vállalkozás a fiókját egy csatlakozási felületen keresztül összekapcsolhatja olyan MI-asszisztenssel, amelyet ő maga választott, és amellyel saját szerződése van — például a Claude az Anthropic PBC-től (USA). Ha ilyen összekapcsolás megadásra került, az asszisztens a vállalkozás kérésére olvasási hozzáféréssel lekérheti: a foglaltságot, az elérhetőséget és a napi árakat; a foglalásokat a vendég nevével, a tartózkodás időszakával, az ingatlannal, a foglalási csatornával, az állapottal, valamint az összeggel és a valutával, amennyiben a lekérdező fiók szerepköre láthat összegeket; továbbá a beérkező mappában lévő beszélgetések áttekintését. Megadott összekapcsolás nélkül nem történik továbbítás.",
            "Nem kerül továbbításra a vendégek e-mail-címe és telefonszáma, a kártyaadatok, a bankszámlaadatok és a fizetési bizonylatok, a belépőkódok, valamint az ingatlandossziék. A foglalási jegyzetek és a vendégüzenetek tartalma alapértelmezetten ki van zárva, mert egészségre vonatkozó adatokat vagy a GDPR 9. cikke szerinti más különleges kategóriákat tartalmazhatnak; a vállalkozásnak ezeket az összekapcsolás megadásakor kifejezetten és külön kell engedélyeznie.",
            "Az összekapcsolást csak „Adminisztrátor” szerepkörű fiók adhatja meg, nem minden hozzáféréssel rendelkező fiók. Minden lekérés naplózásra kerül, és a vállalkozás számára a „Fiók → Kapcsolatok” menüpontban megtekinthető; az összekapcsolást ott bármikor megszüntetheti, és a hozzáférés ezzel azonnal véget ér.",
            "Jogi értelemben ez a továbbítás a vállalkozás nekünk adott utasítása (a GDPR 28. cikk (3) bekezdés a) pontja). Az asszisztens szolgáltatója nem a mi további adatfeldolgozónk — nem mi bízzuk meg és nem mi utasítjuk; az adatokat annak a szerződésnek az alapján kezeli, amelyet a vállalkozás maga kötött vele. Ezen adatkezelés jogalapjáért, a vendégei tájékoztatásáért és a harmadik országba történő továbbítás garanciáiért ezért a vállalkozás felel.",
          ],
        },
        {
          titel: "Fordítások",
          paragraphs: [
            "Az ingatlan- és tartalomszövegek a Google Ireland Limited Cloud Translation API-ján keresztül lefordíthatók. Ennek során a lefordítandó szövegek kerülnek továbbításra; személyes adatok csak annyiban, amennyiben e szövegekben szerepelnek.",
          ],
        },
        {
          titel: "Árajánlások",
          paragraphs: [
            "Az árajánlásokhoz külső források piaci, időjárási és árfolyamadataira támaszkodunk. Ezek a lekérdezések nem tartalmaznak személyes adatokat, csupán helyet, időszakot és ingatlanjellemzőket.",
          ],
        },
      ],
    },
    {
      heading: "Ügyfeleink weboldalai és domainjei",
      paragraphs: [
        "Ha egy vállalkozás az oldalszerkesztővel saját domainen működő weboldalt készít, az ehhez szükséges DNS-bejegyzéseket a Cloudflare, Inc. útján kezeljük. Ennek során domain- és konfigurációs adatok kerülnek továbbításra; az ügyfél weboldalának látogatói adatait a jelen nyilatkozatban leírtak szerint kezeljük.",
        "Az ügyfél weboldalának tartalmáért, impresszumáért és adatvédelmi tájékoztatójáért az adott vállalkozás felel.",
      ],
    },
    {
      heading: "Hosting és tárolás",
      paragraphs: [
        "A Platform, az adatbázis, a médiafájlok és a levelezőszerver a Hetzner Online GmbH (Németország) szerverein, a helsinki (Finnország) adatközpontban futnak — tehát az Európai Unión belül. A Hetznerrel adatfeldolgozási megállapodás áll fenn.",
        "A biztonsági mentések titkosítva készülnek, és titkosítva, egy EU-n belüli tárolószolgáltatónál kerülnek megőrzésre.",
      ],
    },
    {
      heading: "A címzettek áttekintése",
      paragraphs: [
        "A megnevezett szolgáltatókon kívül személyes adatokat csak akkor adunk tovább, ha erre jogszabály kötelez minket (pl. adóhatóság, bűnüldözés), vagy ha Ön, illetve a felelős vállalkozás ezt kéri.",
      ],
      list: [
        "Hetzner Online GmbH (Németország/Finnország) — hosting, adatbázis, médiafájlok, levelezőszerver",
        "Stripe Payments Europe, Limited (Írország) — fizetések, kifizetések, személyazonosság-ellenőrzés",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxemburg) — fizetések, ha aktiválva van",
        "Channex.io Ltd (Egyesült Királyság) — csatlakozás a foglalási portálokhoz",
        "Meta Platforms Ireland Limited (Írország) — WhatsApp-üzenetek, ha aktiválva van",
        "Sendinblue SAS / Brevo (Franciaország, Németország) — a hírlevél kezelése és kiküldése, csak hozzájárulás esetén",
        "Google Ireland Limited (Írország) — fordítások; a kapcsolatfelvételi űrlap spamvédelme (reCAPTCHA Enterprise), csak hozzájárulás esetén; bejelentkezés Google-fiókkal, ha használják",
        "Groq, Inc. (USA) — válaszjavaslatok, ha aktiválva van",
        "Cloudflare, Inc. (USA) — DNS-kezelés az ügyfelek domainjeihez",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Nem szerepelnek ezen a listán azok a szolgáltatások, amelyekről egy vállalkozás maga állapodik meg egy harmadik féllel, és amelyeket a csatlakozási felületen keresztül összekapcsol a fiókjával — például egy MI-asszisztens, mint a Claude az Anthropic PBC-től (USA). Ezek nem az általunk megbízott szolgáltatók, hanem az adott vállalkozás utasítása alapján eljáró címzettek; az ő összekapcsolása nélkül nem folynak oda adatok. Az Anthropic az Egyesült Államok Kereskedelmi Minisztériumának hivatalos résztvevői listája szerint nem rendelkezik az EU-US Data Privacy Framework szerinti tanúsítással; a továbbítás ezért az általános adatvédelmi szerződési klauzulákon alapul, amelyekért adatkezelőként az adott vállalkozásnak kell felelnie.",
          ],
        },
      ],
    },
    {
      heading: "Továbbítás harmadik országokba",
      paragraphs: [
        "Az adatkezelés alapvetően az EU-n belül történik. A fent megnevezett, EU-n kívüli székhelyű szolgáltatások esetében harmadik országba történő továbbításra kerülhet sor.",
        "A Groq, Inc. és a Cloudflare, Inc. (USA) esetében a továbbítást az Európai Bizottság általános adatvédelmi szerződési klauzuláira alapozzuk a GDPR 46. cikk (2) bekezdés c) pontja szerint, amennyiben a címzett nem hivatkozhat megfelelőségi határozatra (EU-US Data Privacy Framework).",
        "A fizetés lebonyolításának szerződő partnere a Stripe Payments Europe, Limited (Írország). Amennyiben a Stripe ennek során a Stripe, LLC (USA) szolgáltatásait veszi igénybe, ez utóbbi az EU-US Data Privacy Framework szerinti tanúsítással rendelkezik; a továbbítás ennyiben az Európai Bizottság GDPR 45. cikke szerinti megfelelőségi határozatán alapul. Ezt kiegészítően a [Stripe adatfeldolgozási megállapodásából](https://stripe.com/legal/dpa) származó általános adatvédelmi szerződési klauzulák alkalmazandók.",
        "A Channex.io Ltd (Egyesült Királyság) esetében az Európai Bizottság Egyesült Királyságra vonatkozó megfelelőségi határozata alkalmazandó; ha ez megszűnik, az általános adatvédelmi szerződési klauzulák lépnek életbe.",
      ],
    },
    {
      heading: "Harmadik államok hatósági hozzáférése (US CLOUD Act)",
      paragraphs: [
        "Azok a szolgáltatók, amelyek amerikai jogi fennhatóság alá tartoznak, az amerikai CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018) alapján kötelezhetők arra, hogy adatokat adjanak ki amerikai hatóságoknak — akkor is, ha ezek az adatok az Európai Unión belüli szervereken vannak. Az ilyen hozzáférés ellentétben állhat a GDPR-ral, és a szolgáltatót jogilag megakadályozhatják abban, hogy minket vagy Önt erről tájékoztassa. Sem az EU-US Data Privacy Framework szerinti megfelelőségi határozat, sem az általános adatvédelmi szerződési klauzulák nem zárják ki ezt a kockázatot.",
        "Ezt a kockázatot azzal korlátozzuk, hogy a hordozó rendszereket — a Platformot, az adatbázist, a médiafájlokat, a levelezőszervert és a biztonsági mentéseket — európai szolgáltatóknál, az EU-n belül üzemeltetjük, ahol nem érvényesül amerikai jogi fennhatóság.",
      ],
      unterpunkte: [
        {
          titel: "Érintett szolgáltatások",
          paragraphs: [
            "Amerikai jogi fennhatóság kizárólag a következő, világosan elhatárolt kiegészítő szolgáltatások esetében jöhet szóba:",
          ],
          list: [
            "Groq, Inc. (USA) — válaszjavaslatok az üzenetek beérkező mappájában, csak akkor, ha a vállalkozás aktiválja a funkciót. Az adott üzenetkontextus kerül továbbításra.",
            "Cloudflare, Inc. (USA) — DNS-kezelés az ügyfelek domainjeihez. Domain- és konfigurációs adatok kerülnek továbbításra, vendégadatok nem.",
            "Google LLC (USA) — csak a Google-fiókkal történő bejelentkezésnél és a fordításoknál; a szerződő partner mindkét esetben a Google Ireland Limited, az amerikai anyavállalat hozzáférése azonban ennek ellenére nem kizárt.",
          ],
        },
        {
          titel: "Elkerülhetőség",
          paragraphs: [
            "A Platform e szolgáltatások nélkül is használható: a válaszjavaslatok kikapcsolhatók, a DNS-kezelés csak a saját domainnel rendelkező ügyfeleket érinti, a Google-fiókkal történő bejelentkezés pedig önkéntes alternatíva az e-mail-címmel és jelszóval történő bejelentkezéshez.",
          ],
        },
        {
          titel: "Elhatárolás az európai jogtól",
          paragraphs: [
            "A CLOUD Act amerikai jog, nem az Európai Unió joga. El kell határolni az EU Data Acttől ((EU) 2023/2854 rendelet), amely az adatkezelési szolgáltatások közötti váltást és a portabilitást szabályozza, valamint a Cloud and AI Development Acttől, amely a jelen nyilatkozat állapota szerint az európai jogalkotási eljárásban van.",
          ],
        },
      ],
    },
    {
      heading: "Tárolási idő",
      list: [
        "Fiókadatok: az üzleti kapcsolat időtartamára; azt követően törlés, amennyiben nem áll fenn megőrzési kötelezettség.",
        "Foglalási, számlázási és fizetési adatok: a dán számviteli törvény szerint annak az üzleti évnek a végétől számított öt évig, amelyhez hozzárendelhetők; a Németországban székhellyel rendelkező ügyfelek esetében hosszabb kereskedelmi és adójogi határidők is érvényesülhetnek.",
        "Üzenetek és vendégadatok a Platformon: a felelős vállalkozás utasítása szerint, legkésőbb az általa történő törlésig, illetve a szerződés megszűnéséig.",
        "Hírlevél: a hozzájárulás visszavonásáig; a meg nem erősített feliratkozások hét nap után érvényüket vesztik. A hozzájárulás és a leiratkozás igazolása ezen túl is megmarad, ameddig igazolásként szükség van rá.",
        "Bejelentkezési naplók és biztonsági események: rövid ideig, a támadások felismerése céljából.",
        "Szervernaplók: csak addig, ameddig az üzemeltetéshez és a biztonsághoz szükséges.",
        "Biztonsági mentések: rotálva, amíg újabb mentések fel nem váltják őket.",
      ],
    },
    {
      heading: "Az Ön jogai",
      paragraphs: [
        "Önt megilleti a hozzáférés joga (15. cikk), a helyesbítéshez (16. cikk), a törléshez (17. cikk), az adatkezelés korlátozásához (18. cikk) és az adathordozhatósághoz (20. cikk) való jog, valamint a jogos érdeken alapuló adatkezelések elleni tiltakozás joga (a GDPR 21. cikke). A megadott hozzájárulást bármikor, a jövőre nézve visszavonhatja.",
        `Ehhez forduljon a következő címhez: [${ANBIETER.email}](mailto:${ANBIETER.email}). Ha az Ön adatai a Platform valamely vállalkozás általi használatát érintik, a kérését továbbítjuk a felelős vállalkozásnak, vagy támogatjuk őt a megválaszolásában.`,
        `Ezen túl panaszt tehet egy adatvédelmi felügyeleti hatóságnál — a ránk illetékes hatóság a ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). A lakóhelye szerinti felügyeleti hatósághoz is fordulhat.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular — gefordert ist der konkrete,
      // benannte Weg, nicht nur der DSGVO-Artikel.
      heading: "A fiók és az alkalmazásadatok törlése",
      paragraphs: [
        "A fiókja törlését bármikor maga kérheti — az alkalmazásban a ‚Profil → Fiók’ menüpontban vagy a weben elérhető űrlapunkon:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "A weben elérhető út tudatosan akkor is működik, ha az alkalmazást már nem tartja telepítve, vagy már nem tud bejelentkezni. A visszaélés elleni védelem érdekében ez két lépésben történik: beírja a fiókja e-mail-címét, és pontosan erre a címre kap egy megerősítő linket. A kérelmet csak ennek megnyitása érvényesíti — egy beírt cím önmagában nem eredményez semmit. A kérelmet 30 napon belül feldolgozzuk, és e-mailben válaszolunk.",
        "A fiókkal együtt töröljük a belépési adatait, a profilját, az ingatlan- és naptáradatait, valamint az üzeneteit. Nem töröljük azokat a dokumentumokat, amelyekre jogszabályi megőrzési kötelezettség áll fenn — különösen az elszámolt időszakok számláit és foglalási bizonylatait (könyvvezetési kötelezettség a dán jog szerint, általában öt év). Ezeket a dokumentumokat a határidő idejére zároljuk, azaz kizárólag e kötelezettség teljesítése céljából őrizzük meg, majd töröljük.",
      ],
    },
    {
      heading: "Az adatkezelés biztonsága",
      paragraphs: [
        "Az adatkezelést a GDPR 32. cikke szerinti technikai és szervezési intézkedésekkel védjük, különösen: folyamatos átviteli titkosítással (TLS), közvetlenül az adatbázisban érvényesülő bérlőspecifikus hozzáférési szabályokkal, szerepkör-alapú jogosultságokkal a pénzügyi és a szolgáltatási adatok szétválasztásával, opcionális kétfaktoros hitelesítéssel, a bejelentkezési kísérletek korlátozásával, rendszeres visszaállítási teszttel ellenőrzött titkosított biztonsági mentésekkel, valamint a biztonsági szempontból releváns események naplózásával.",
      ],
    },
    {
      heading: "Az adatszolgáltatás kötelező jellege",
      paragraphs: [
        "Azok az adatok, amelyekre a szerződéskötéshez, az elszámoláshoz és a jogszabályi kötelezettségekhez szükségünk van, kötelezőek — ezek nélkül nem tudjuk biztosítani a Platformot. Minden további adat megadása önkéntes.",
      ],
    },
    {
      heading: "A jelen nyilatkozat módosításai",
      paragraphs: [
        "A jelen nyilatkozatot módosítjuk, ha az adatkezelés, az igénybe vett szolgáltatók vagy a jogi helyzet megváltozik. Mindenkor az itt közzétett változat érvényes; a fenti dátum jelzi az állapotot.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so.
export default datenschutz;
