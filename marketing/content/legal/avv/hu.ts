// Ungarische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin
// (dort stehen auch die Belege für die technischen und organisatorischen
// Maßnahmen und die Liste der Unterauftragsverarbeiter) und werden von dort
// in alle Sprachfassungen übernommen.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Adatfeldolgozási megállapodás",
  metaDescription:
    "Adatfeldolgozás a GDPR 28. cikke szerint a myNextDays ApS és a platformot használó vállalkozások között: tárgy, utasítások, biztonság, további adatfeldolgozók.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Ez a megállapodás (a továbbiakban „Adatfeldolgozási megállapodás”) a myNextDays platformot használó vállalkozás (a továbbiakban „adatkezelő”) és a ${ANBIETER.firma} (a továbbiakban „adatfeldolgozó” vagy „mi”) között érvényes, és az (EU) 2016/679 rendelet (GDPR) 28. cikkéből eredő kötelezettségeket pontosítja.`,
    `A megállapodás az [Általános Szerződési Feltételek](${AGB_URL}) útján válik a szerződés részévé, és a platform használatának teljes időtartama alatt érvényes. A megbízásból történő személyes adatkezelés tekintetében megelőzi az Általános Szerződési Feltételeket.`,
    "Ezen túlmenően az [Adatvédelmi nyilatkozat](/datenschutz) érvényes azokra az adatokra, amelyeket önálló adatkezelőként kezelünk — különösen a fiók és az üzleti kapcsolat adataira.",
  ],
  sections: [
    {
      heading: "A megállapodás tárgya és a szerepek megosztása",
      unterpunkte: [
        {
          paragraphs: [
            "A megállapodás tárgya azoknak a személyes adatoknak a kezelése, amelyeket az adatkezelő a platformba bevisz vagy azon keresztül gyűjt, hogy a szerződésben megállapodott szolgáltatásokat nyújthassuk: szálláshelyek, foglalások és foglaltság kezelése, kommunikáció a vendégekkel, fizetések lebonyolítása, könyvelés és tulajdonosi elszámolás, csatlakozás a foglalási portálokhoz, weboldal-készítő, valamint feladat- és csapatkezelés.",
          ],
        },
        {
          paragraphs: [
            "Az adatkezelő dönt ennek az adatkezelésnek a céljairól és eszközeiről. Az adatokat kizárólag az ő dokumentált utasítására kezeljük, és nem saját célra.",
          ],
        },
        {
          paragraphs: [
            "A fiók adatai, a saját szolgáltatásaink elszámolása, a rendszer biztonsága és a törvényi megőrzés tekintetében mi magunk vagyunk az adatkezelő. Ez az adatkezelés nem tárgya ennek az Adatfeldolgozási megállapodásnak.",
          ],
        },
      ],
    },
    {
      heading: "Az adatkezelés jellege, terjedelme és célja",
      paragraphs: [
        "Az adatkezelés gyűjtés, tárolás, megjelenítés, módosítás, az adatkezelő által választott címzettek (például foglalási portálok, fizetési szolgáltatók) részére történő továbbítás, korlátozás és törlés útján történik — a platformon automatizált formában.",
        "Az adatkezelés helye az Európai Unió; a kivételeket a 8. szakasz kimerítően megnevezi.",
      ],
    },
    {
      heading: "Az érintettek kategóriái",
      list: [
        "Vendégek és foglalók, beleértve a velük utazókat",
        "Érdeklődők, akik megkeresést vagy üzenetet küldenek",
        "A kezelt szálláshelyek tulajdonosai",
        "Az adatkezelő munkatársai (csapat, takarítás, szerviz, recepció)",
        "Az adatkezelő partnereinek és szolgáltatóinak kapcsolattartói",
      ],
    },
    {
      heading: "A személyes adatok kategóriái",
      list: [
        "Törzsadatok: név, cím, születési dátum, ha rögzítésre kerül, állampolgárság, ha a bejelentési kötelezettség miatt rögzítésre kerül",
        "Kapcsolattartási adatok: e-mail-cím, telefonszám",
        "Foglalási adatok: időszak, szálláshely, utazók száma, árak, kiegészítő szolgáltatások, lemondások",
        "Fizetési adatok: összeg, pénznem, fizetési mód, fizetési állapot, hivatkozások (teljes kártyaadatok nem érkeznek a rendszereinkbe)",
        "Kommunikációs adatok: üzenetek, jegyzetek, értékelések",
        "A munkatársak hozzáférési és használati adatai: szerepkör, jogosultságok, bejelentkezés időpontja, a bejelentkezés eszköze és IP-címe",
        "A GDPR 9. cikke szerinti különös kategóriák nem tárgyai a megbízásnak; az adatkezelő ilyen adatokat nem visz be a szabad szöveges mezőkbe.",
      ],
    },
    {
      heading: "Utasítások",
      unterpunkte: [
        {
          paragraphs: [
            "Az adatkezelő a platform használatával és beállításával, valamint a kapcsolattartási címünkre szöveges formában küldött közléssel ad utasítást. A szóbeli utasításokat szöveges formában visszaigazoljuk.",
          ],
        },
        {
          paragraphs: [
            "Ha egy utasítást jogellenesnek tartunk, azt haladéktalanul jelezzük, és a végrehajtást felfüggeszthetjük, amíg az adatkezelő azt meg nem erősíti vagy meg nem változtatja.",
          ],
        },
        {
          paragraphs: [
            "Ha jogszabály kötelez minket az adatkezelésre (például hatóságok felé), erről az adatkezelőt előzetesen tájékoztatjuk, amennyiben ezt a jog számunkra megengedi.",
          ],
        },
        {
          titel: "Az adatkezelő saját szolgáltatásainak összekapcsolása",
          paragraphs: [
            "Az adatkezelő a fiókját egy csatolófelületen keresztül összekapcsolhatja olyan szolgáltatással, amelyet ő maga választott, és amellyel saját szerződést kötött — például egy mesterséges intelligencián alapuló asszisztenssel. Ha ilyen összekapcsolást engedélyez, az az ő kifejezett utasítása a GDPR 28. cikk (3) bekezdés a) pontja szerint arra, hogy a felszabadított adatokat ennek a szolgáltatásnak kiadjuk. Ez kifejezetten kiterjed az ezzel járó harmadik országba történő továbbításra is, ha a szolgáltatás székhelye az Európai Unión kívül van.",
            "Röviden: az ilyen összekapcsolásról egyedül az adatkezelő dönt, és az összekapcsolt szolgáltatásért ő maga felel.",
            "Az összekapcsolást csak olyan fiók engedélyezheti, amely a külső kapcsolatok kezelésére jogosult. Ez a jogosultság az „Adminisztrátor” szerepkör számára van fenntartva; a korlátozott jogokkal rendelkező fiókok — a „Társadminisztrátor” szerepkör is — nem engedélyezhetnek összekapcsolást. Rögzítjük, hogy ki, mikor és melyik szolgáltatás számára engedélyezte, milyen adatfajták lettek felszabadítva, és milyen lekérések történtek; ez a nyilvántartás a felületen a „Fiók → Kapcsolatok” menüpontban áll az adatkezelő rendelkezésére, hogy elszámoltathatósági kötelezettségét teljesíthesse és a tájékoztatás iránti kérelmeket megválaszolhassa.",
            "Az összekapcsolt szolgáltatás nem a mi további adatfeldolgozónk: nem adunk neki megbízást, nem mi választjuk ki, és nem adunk neki utasítást. Az adatokat annak a szerződésnek az alapján kezeli, amelyet az adatkezelő maga kötött vele. Ezért az adatkezelésért, annak jogalapjáért és a harmadik országba történő továbbítás garanciáiért az adatkezelő felel; ez nem tárgya ennek az Adatfeldolgozási megállapodásnak.",
            "A szabad szöveges mezők — a foglalási jegyzetek és a vendégüzenetek tartalma — az ilyen összekapcsolásból alapértelmezés szerint ki vannak zárva. Tartalmazhatnak a GDPR 9. cikke szerinti különös kategóriájú személyes adatokat, például egészségre vonatkozó adatokat. Az adatkezelőnek ezeket az engedélyezéskor külön kell felszabadítania; e felszabadítás nélkül nem kerülnek továbbításra.",
            "Az adatkezelő az engedélyezett összekapcsolást a felületen bármikor megszüntetheti. A megújítási tokenek ekkor törlődnek, és minden további lekérésnél ellenőrzésre kerül, hogy a hozzájárulás még fennáll-e — egy megszüntetett szolgáltatás ezért azonnal semmit sem tud már kiolvasni, nem csak a hozzáférési tokenje lejárta után.",
          ],
        },
      ],
    },
    {
      heading: "Titoktartás",
      paragraphs: [
        "Mindenki, aki a megbízásnak megfelelően hozzáférhet az adatokhoz, titoktartásra kötelezett, és rendszeres adatvédelmi oktatásban részesül. A hozzáférés az adott feladathoz szükséges mértékre korlátozott.",
        "Munkatársaink csak hibaelhárítás céljából, támogatási megkeresésre vagy jogszabályi kötelezettségek teljesítése érdekében férnek hozzá a vevői adatokhoz.",
      ],
    },
    {
      heading: "Az adatkezelés biztonsága",
      paragraphs: [
        "Megtesszük a GDPR 32. cikke szerint szükséges technikai és szervezési intézkedéseket. Különösen a következők vannak megvalósítva:",
      ],
      list: [
        "Átviteli titkosítás (TLS) minden kapcsolathoz, HTTP-biztonsági fejlécek, beleértve a szigorú Content-Security-Policy-t",
        "Bérlők szétválasztása közvetlenül az adatbázisban: soralapú hozzáférési szabályok (Row Level Security) és az érzékeny adatokra vonatkozó megvont tábla-jogosultságok, így a saját vállalkozáson kívüli hozzáférés közvetlen adatbázis-úton is kizárt",
        "Szerepkör-alapú jogosultságok adatszétválasztással: a szerviz- és takarítómunkatársak nem kapnak pénzügyi és értékesítési adatokat, a tulajdonosok csak a saját szálláshelyeiket; a vendégadatok a nem jogosult szerepkörök számára maszkolva vannak",
        "Kéttényezős hitelesítés (TOTP) elérhető a fiókokhoz; ismételt bejelentkezés a biztonsági szempontból kritikus változtatásoknál",
        "A bejelentkezések naplója eszközzel, időponttal és IP-címmel, az adatkezelő számára megtekinthetően",
        "Külső szolgáltatásokkal való összekapcsolást kizárólag „Adminisztrátor” szerepkörű fiók engedélyezhet; az ilyen összekapcsoláson keresztüli minden lekérés naplózásra kerül (eszköz, időpont, terjedelem — a tartalmak nélkül), és az adatkezelő számára megtekinthető. A megszüntetett összekapcsolás azonnal elveszíti a hozzáférést: minden lekérésnél ellenőrzésre kerül, hogy a hozzájárulás még fennáll-e",
        "A kérések gyakoriságának korlátozása az automatizált támadások ellen, a beérkező webhook-hívások aláírásainak ellenőrzése",
        "Titkosított, az üzemi rendszeren kívül tárolt biztonsági mentések rendszeres helyreállítási teszttel",
        "Elkülönített fejlesztési és üzemi környezet; az adatbázis módosítása kizárólag verziózott migrációkon keresztül",
      ],
    },
    {
      heading: "További adatfeldolgozók",
      paragraphs: [
        "Az adatkezelő jóváhagyja a következő további adatfeldolgozók igénybevételét. Mindegyikkel a GDPR 28. cikk (4) bekezdése szerinti szerződés van érvényben, olyan kötelezettségekkel, amelyek megfelelnek ennek az Adatfeldolgozási megállapodásnak.",
      ],
      list: [
        "Hetzner Online GmbH, Németország (szerver, adatbázis, médiaállományok, levelezőszerver; adatközpont Helsinki, Finnország)",
        "Stripe Payments Europe, Limited, Írország (fizetések, kifizetések, törvényi személyazonosság-ellenőrzés)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg (fizetések, amennyiben az adatkezelő aktiválja őket)",
        "Channex.io Ltd, Egyesült Királyság (csatlakozás a foglalási portálokhoz, amennyiben aktiválva van)",
        "Meta Platforms Ireland Limited, Írország (WhatsApp-üzenetek, amennyiben aktiválva van)",
        "Google Ireland Limited, Írország (tartalmak fordítása; bejelentkezés Google-fiókkal, amennyiben használatban van)",
        "Groq, Inc., USA (válaszjavaslatok a beérkező üzenetek között, amennyiben aktiválva van)",
        "Cloudflare, Inc., USA (a saját domainek DNS-bejegyzéseinek kezelése, amennyiben használatban van)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "A cserét vagy a bővítést legalább 30 nappal előre közöljük. Az adatkezelő ezen a határidőn belül fontos, adatvédelemmel összefüggő okból tiltakozhat; ha a tiltakozás nem kerül elhárításra, felmondhatja az érintett szolgáltatásrészt vagy a szerződést.",
          ],
        },
        {
          paragraphs: [
            "Azok a szolgáltatások, amelyekben az adatkezelő maga állapodik meg egy harmadik féllel, nem további adatfeldolgozást, hanem az általa kezdeményezett adattovábbítást jelentenek. Ez ugyanúgy érvényes arra a foglalási portálra, amellyel saját szerződése van, mint egy mesterséges intelligencián alapuló asszisztensre vagy más programra, amelyet a csatolófelületen keresztül a fiókjához kapcsol (lásd az „Utasítások” szakaszt).",
            "Ennél nem az a döntő, hogy kinek a rendszerein folynak át az adatok, hanem az, hogy ki vonja be a szolgáltatást: további adatfeldolgozás akkor keletkezik, ha MI adunk megbízást egy további szolgáltatónak, hogy a saját szolgáltatásunkat nyújthassuk. Ha az adatkezelő maga választja ki a szolgáltatást, és ő köt vele szerződést, akkor ez a szolgáltatás az adatkezelő számára kezel adatot — nem a mi számunkra. Ez a lehatárolás megfelel a hasonló szolgáltatók szerződési gyakorlatának a vevő által összekapcsolt harmadik felek szolgáltatásai tekintetében.",
          ],
        },
      ],
    },
    {
      heading: "Adattovábbítás harmadik országokba",
      paragraphs: [
        "Az Európai Unión kívüli címzettekhez történő továbbítás a fentiekben USA, illetve Egyesült Királyság székhellyel megnevezett szolgáltatásokra korlátozódik. Ennek alapja az Európai Bizottság általános adatvédelmi kikötései a GDPR 46. cikk (2) bekezdés c) pontja szerint, vagy hatályos megfelelőségi határozat; ezt kiegészítő védelmi intézkedések (titkosítás, adatminimalizálás) alkalmazása kíséri.",
      ],
    },
    {
      heading: "Az adatkezelő támogatása",
      unterpunkte: [
        {
          paragraphs: [
            "Támogatjuk az adatkezelőt az érintettek kérelmeinek megválaszolásában (GDPR 15–22. cikk). A platform ehhez a tájékoztatást, a helyesbítést, az exportot és az adatok törlését közvetlenül a felületen kínálja. Ha érintettek közvetlenül hozzánk fordulnak, az adatkezelőhöz irányítjuk őket, és tájékoztatjuk őt erről.",
          ],
        },
        {
          paragraphs: [
            "Támogatást nyújtunk továbbá az adatvédelmi hatásvizsgálatoknál, a GDPR 32–36. cikke szerinti kötelezettségek betartásánál és a felügyeleti hatóságok megkereséseinél.",
          ],
        },
      ],
    },
    {
      heading: "Személyes adatok védelmének megsértése",
      paragraphs: [
        "Ha tudomásunkra jut a személyes adatok védelmének olyan megsértése, amely az adatkezelő adatait érinti, haladéktalanul, legkésőbb a tudomásszerzéstől számított 48 órán belül szöveges formában tájékoztatjuk őt.",
        "A közlés tartalmazza — amennyiben ismert — az incidens jellegét és időpontját, az érintett adatkategóriákat és személyi köröket, a valószínűsíthető következményeket, valamint a megtett és a javasolt intézkedéseket. Támogatjuk az adatkezelőt a GDPR 33. és 34. cikke szerinti bejelentési és tájékoztatási kötelezettségeinek teljesítésében.",
      ],
    },
    {
      heading: "Igazolások és ellenőrzések",
      unterpunkte: [
        {
          paragraphs: [
            "Ennek az Adatfeldolgozási megállapodásnak a betartását kérésre igazoljuk, különösen a megtett intézkedésekről és az igénybe vett további adatfeldolgozókról adott tájékoztatással.",
          ],
        },
        {
          paragraphs: [
            "Az adatkezelő a szükséges mértékben ellenőrzéseket végezhet, vagy azokat velünk versenyben nem álló, független ellenőrrel végeztetheti. Az ellenőrzések előzetes, észszerű határidővel történő bejelentés után, a szokásos üzleti időben és az üzemmenet megzavarása nélkül zajlanak. A tájékoztatáson túlmutató vizsgálat ráfordítását az adatkezelő viseli, kivéve, ha a vizsgálatot általunk okozott incidens indokolja.",
          ],
        },
      ],
    },
    {
      heading: "Törlés és visszaadás",
      paragraphs: [
        "A szerződés megszűnése után az adatkezelő adatait kérésre 30 napon belül elterjedt, géppel olvasható formátumban exportálásra rendelkezésre bocsátjuk. Ezt követően az adatokat a másolatokkal együtt töröljük.",
        "Kivételt képeznek azok az adatok, amelyekre törvényi megőrzési kötelezettség áll fenn (különösen a számlázási és könyvelési adatok); ezeket zároljuk, és a határidő lejárta után töröljük. A biztonsági mentések a szokásos rotációs ciklussal felülíródnak.",
      ],
    },
    {
      heading: "Felelősség és sorrend",
      paragraphs: [
        "A GDPR 82. cikke érvényes. A felek egymás közötti viszonyában emellett az Általános Szerződési Feltételek felelősségi szabályai érvényesek, amennyiben nem ellentétesek a GDPR-ral.",
        "Ha az Általános Szerződési Feltételek és ez az Adatfeldolgozási megállapodás a megbízásból történő adatkezelés tekintetében egymásnak ellentmondanak, ez az Adatfeldolgozási megállapodás érvényes. Ha egy rendelkezés érvénytelenné válik, a többi tartalom érvényben marad; a felek azt ugyanazt a célt szolgáló, megengedett szabályozással helyettesítik.",
      ],
    },
    {
      heading: "A megállapodás módosítása",
      paragraphs: [
        "Ezt az Adatfeldolgozási megállapodást annyiban módosíthatjuk, amennyiben ezt jogszabályi változások, a felügyeleti hatóságok követelményei, a fizetési szolgáltatók előírásai vagy technikai továbbfejlesztések szükségessé teszik, és az adatkezelő ezáltal nem kerül hátrányosabb helyzetbe.",
        "A módosításokat a hatálybalépés előtt legalább 30 nappal szöveges formában bejelentjük. Ha az adatkezelő ezen a határidőn belül nem tiltakozik, azok elfogadottnak tekintendők; erre a következményre a bejelentésben felhívjuk a figyelmet. Tiltakozás esetén mindegyik fél felmondhatja a szerződést a hatálybalépés időpontjára.",
      ],
    },
    {
      heading: "Kapcsolat",
      paragraphs: [
        `Az ezzel a megállapodással kapcsolatos megkereséseket, utasításokat és bejelentéseket a [${ANBIETER.email}](mailto:${ANBIETER.email}) címre vagy a következő címre küldje: ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
