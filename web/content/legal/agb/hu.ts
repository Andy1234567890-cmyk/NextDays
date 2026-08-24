import type { LegalDoc } from "../types";

// Ungarische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. § 5 Absatz 1–2 entspricht Stripes vorgeschriebener Klausel
// (Stripe Connected Account Agreement) — URLs nicht verändern.
export const agb: LegalDoc = {
  title: "Általános Szerződési Feltételek (ÁSZF) ügynökségek és szállásadók részére",
  stand: "Utolsó frissítés: 2026. augusztus 13.",
  intro: [
    "Jelen Általános Szerződési Feltételek (a továbbiakban: „ÁSZF”) a myNextDays szoftverplatform (a továbbiakban: „Platform”) ügynökségek, szállásadók, ingatlankezelők és egyéb üzleti felhasználók (a továbbiakban: „Felhasználó”) általi használatát szabályozzák.",
    "A Platform szolgáltatója: myNextDays ApS, dán jog szerinti korlátolt felelősségű társaság (anpartsselskab), Hirtshalsvej 21, 9881 Bindslev, Dánia, a dán Központi Cégnyilvántartásban (CVR) CVR-szám 46615182 alatt bejegyezve (a továbbiakban: „myNextDays” vagy „mi”).",
    "A Platform kizárólag a német Polgári Törvénykönyv (BGB) 14. §-a, illetve az érintett EU-tagállam megfelelő rendelkezései értelmében vett vállalkozásoknak szól. Nem fogyasztók részére készült.",
  ],
  sections: [
    {
      heading: "§ 1 Hatály",
      paragraphs: [
        "Jelen ÁSZF a myNextDays és a Felhasználó között a Platform használatára vonatkozó valamennyi szerződésre, valamint az azon keresztül nyújtott összes szolgáltatásra és modulra alkalmazandó.",
        "A Felhasználó eltérő, ellentétes vagy kiegészítő szerződési feltételei csak akkor válnak a szerződés részévé, ha alkalmazásukhoz a myNextDays kifejezetten, szöveges formában hozzájárult.",
      ],
    },
    {
      heading: "§ 2 A szerződés tárgya és a szolgáltatások",
      paragraphs: [
        "A myNextDays felhőalapú szoftvert bocsát a Felhasználó rendelkezésére üdülőszállások és szálláshely-szolgáltató vállalkozások kezeléséhez. A funkciók köre a mindenkor aktuális szolgáltatásleírásból következik, és különösen az alábbiakat foglalja magában:",
      ],
      list: [
        "ingatlanok, foglaltsági naptárak és foglalások kezelése (property management rendszer),",
        "kapcsolódás harmadik felek foglalási csatornáihoz (pl. Booking.com, Airbnb) channel manageren keresztül,",
        "ajánlatok közzététele a Platform saját myNextDays foglalási csatornáján,",
        "saját weboldalak készítése az integrált oldalszerkesztővel (page builder),",
        "könyvelési, elszámolási és kimutatási funkciók, ideértve a tulajdonosi elszámolásokat is,",
        "kommunikáció a vendégekkel, valamint fizetések elfogadása az integrált fizetésfeldolgozáson keresztül (§ 5).",
      ],
    },
    {
      heading: "§ 3 Regisztráció, fiók és a Felhasználó adatai",
      paragraphs: [
        "A Platform használatának feltétele egy fiók regisztrálása. A Felhasználó köteles a regisztráció során és a szerződés teljes időtartama alatt helytálló, aktuális és teljes körű adatokat megadni magáról és vállalkozásáról, és azokat változás esetén haladéktalanul frissíteni.",
        "A belépési adatokat titokban kell tartani, és védeni kell azokat harmadik személyek hozzáférésétől. A Felhasználó köteles haladéktalanul tájékoztatni a myNextDays-t, ha fiókjának visszaélésszerű használatára utaló jelek merülnek fel.",
        "A fiók nem átruházható. A Felhasználó biztosítja, hogy minden személy, aki a fiókot az ő nevében használja, betartja a jelen ÁSZF-et.",
      ],
    },
    {
      heading: "§ 4 A myNextDays szerepe a foglalásoknál",
      paragraphs: [
        "A Platformon, a kapcsolt harmadik fél csatornákon vagy a Felhasználó saját weboldalán kínált szállásokra vonatkozó szálláshely-szolgáltatási szerződések kizárólag a Felhasználó (illetve az általa képviselt tulajdonos) és az adott vendég között jönnek létre. A myNextDays nem válik a szálláshely-szolgáltatási szerződés szerződő felévé.",
        "Az ajánlati tartalmak (leírások, fotók, árak, elérhetőségek, adók és díjak) helytállóságáért és jogszerűségéért kizárólag a Felhasználó felel.",
      ],
    },
    {
      heading: "§ 5 Fizetésfeldolgozás a Stripe által",
      paragraphs: [
        "A myNextDays platformon az ügynökségek és szállásadók részére nyújtott fizetésfeldolgozási szolgáltatásokat a Stripe nyújtja, és azokra a [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full) vonatkozik, amely magában foglalja a Stripe felhasználási feltételeit (együttesen: a „Stripe-keretszerződés”). A jelen ÁSZF elfogadásával, vagy azzal, hogy a Felhasználó a myNextDays platformon ügynökségként vagy szállásadóként tovább folytatja tevékenységét, a Felhasználó magára nézve kötelezőnek ismeri el a Stripe-keretszerződést, amelyet a Stripe időről időre módosíthat.",
        "Annak feltétele, hogy a myNextDays a Stripe-on keresztül fizetésfeldolgozási szolgáltatásokat tegyen elérhetővé, hogy a Felhasználó helytálló és teljes körű információkat bocsásson a myNextDays rendelkezésére magáról és vállalkozásáról. A Felhasználó felhatalmazza a myNextDays-t arra, hogy ezeket az információkat, valamint a Stripe által nyújtott fizetésfeldolgozási szolgáltatások használatával összefüggő tranzakciós adatokat továbbítsa a Stripe részére.",
        "A Stripe-pal fennálló jogviszonyra a hivatkozott angol nyelvű szerződésszöveg mindenkor hatályos változata az irányadó. Az Európai Gazdasági Térségben letelepedett felhasználók szerződő partnere a Stripe-keretszerződésben megnevezett Stripe-társaság (jelenleg a Stripe Payments Europe, Limited, Írország). A Stripe a személyes adatokat a [Stripe adatvédelmi nyilatkozata](https://stripe.com/privacy) szerint kezeli.",
        "A jogszabályi azonosítási és ellenőrzési kötelezettségek teljesítése érdekében (többek között pénzmosás megelőzése, „Know Your Customer”) a myNextDays és a Stripe bármikor további adatokat és igazolásokat kérhet, különösen személyazonosító okmányokat, a tényleges tulajdonosokra és a bankszámlára vonatkozó adatokat. Ha a kért adatokat vagy igazolásokat a Felhasználó a kitűzött határidőn belül nem bocsátja rendelkezésre, a fizetések elfogadása vagy a kifizetések részben vagy egészben felfüggeszthetők mindaddig, amíg az adatok hiánytalanul rendelkezésre nem állnak.",
      ],
    },
    {
      heading: "§ 6 Kifizetések, visszaterhelések és negatív egyenlegek",
      paragraphs: [
        "A fizetési út a foglalási csatornától függ. A Felhasználó saját foglalási felületén keresztül létrejött foglalások, valamint a csatlakoztatott értékesítési portálokon keresztüli foglalások esetén a vendégek fizetései közvetlenül a Felhasználó fizetési számlájára érkeznek; ezekben az esetekben a Felhasználó a vendéggel szemben a kifizetés jogosultja és a szálláshely-szolgáltatás szerződő fele (§ 4), és a myNextDays semmikor nem válik e pénzeszközök birtokosává. Az ilyen foglalásokra a myNextDays nem számít fel százalékos foglalási díjat; a csatlakoztatott értékesítési portálokon keresztüli foglalások jutaléka külön kerül feltüntetésre és utólag kerül kiszámlázásra.",
        "A myNextDays foglalási portálon keresztül létrejött foglalások esetén a fizetés a myNextDays útján történik. A myNextDays ennek során visszatartja a mindenkor hatályos árlistában feltüntetett közvetítői jutalékot, ideértve a fizetés lebonyolításának költségeit is, és a fennmaradó összeget az alábbi bekezdések szerint továbbítja a Felhasználónak. A szoftver használatáért járó díj (§ 7) ezáltal nem érintett.",
        "A kifizetések a Felhasználó által megadott bankszámlára történnek. A myNextDays kockázati okokból módosíthatja a kifizetési ütemezést, különösen új fiókok, szokatlan tranzakciós minták vagy folyamatban lévő ellenőrzések esetén.",
        "A vendégeknek nyújtott visszatérítéseket gazdaságilag a Felhasználó viseli. A visszaterheléseket és az ezekből eredő díjakat a Felhasználó viseli a saját foglalási felületén és a csatlakoztatott értékesítési portálokon keresztül létrejött foglalások esetén, mivel ezekben az esetekben a Felhasználó a kifizetés jogosultja; a myNextDays foglalási portálon keresztül létrejött foglalások esetén a visszaterhelési kockázatot a myNextDays viseli, kivéve, ha az a Felhasználó kötelezettségszegésére vezethető vissza (különösen a szálláshely-szolgáltatás elmaradása vagy lényeges eltérése). A myNextDays jogosult a Felhasználót terhelő összegeket a jövőbeli kifizetésekbe beszámítani.",
        "Ha a Felhasználó fizetési számláján negatív egyenleg keletkezik, azt a Felhasználó köteles haladéktalanul kiegyenlíteni. A Felhasználó felhatalmazza a myNextDays-t és a Stripe-ot arra, hogy a negatív egyenlegeket a megadott bankszámláról beszedjék, amennyiben ez jogilag megengedett.",
      ],
    },
    {
      heading: "§ 7 Díjak és elszámolás",
      paragraphs: [
        "A Platform használatáért fizetendő díjak a szerződéskötéskor elfogadott árlistából, illetve az egyedi ajánlatból következnek. Valamennyi ár a mindenkor irányadó törvényes adók nélkül értendő, és a szerződésben megjelölt pénznemben kerül feltüntetésre.",
        "A tranzakciófüggő díjak (pl. fizetési vagy csatornadíjak) az adott tranzakció feldolgozásakor közvetlenül visszatarthatók vagy beszámíthatók.",
        "Ha a Felhasználó fizetési késedelembe esik, a myNextDays előzetes értesítést követően a fennálló követelések kiegyenlítéséig felfüggesztheti a Platformhoz való hozzáférést.",
      ],
    },
    {
      heading: "§ 8 A Felhasználó kötelezettségei; saját jogi dokumentumok",
      paragraphs: [
        "A Felhasználó biztosítja, hogy ajánlatai, tartalmai és üzleti gyakorlata megfelelnek a mindenkor alkalmazandó jogszabályoknak, különösen a szállás helyén irányadó szálláshely-szolgáltatási, bejelentési, adó- és fogyasztóvédelmi jognak. A szükséges engedélyeket, nyilvántartásba vételeket és licenceket a Felhasználó saját felelősségére szerzi be és tartja fenn.",
        "Az oldalszerkesztővel üzemeltetett weboldalaiért, valamint a Platformon közzétett ajánlataiért a Felhasználó maga felel; ide tartoznak különösen a saját vendég-ÁSZF, a saját impresszum és a saját adatvédelmi tájékoztató.",
        "Különösen tilos: valótlan vagy megtévesztő ajánlatok közzététele, színlelt ügyletek vagy csalárd tranzakciók lebonyolítása, a Platformon létrejött foglalások esetében a § 5 szerinti fizetésfeldolgozás megkerülése, valamint minden olyan használat, amely a Platform biztonságát vagy rendelkezésre állását veszélyezteti.",
      ],
    },
    {
      heading: "§ 9 Harmadik felek foglalási csatornái",
      paragraphs: [
        "Harmadik fél csatornák (pl. Booking.com, Airbnb) csatlakoztatása esetén kiegészítően az adott csatornaüzemeltető feltételei is alkalmazandók. Az ehhez szükséges szerződéseket a Felhasználó maga köti meg a csatornaüzemeltetővel.",
        "A myNextDays elvégzi az elérhetőségek, az árak és a foglalási adatok technikai szinkronizálását, azonban nincs befolyása a csatornaüzemeltetők tartalmaira, jutalékaira vagy döntéseire, és nem felel azok rendelkezésre állásáért.",
      ],
    },
    {
      heading: "§ 10 Rendelkezésre állás és továbbfejlesztés",
      paragraphs: [
        "A myNextDays a szolgáltatásokat a gondos kereskedőtől elvárható gondossággal nyújtja, és a Platform magas szintű rendelkezésre állására törekszik. Karbantartási ablakok, továbbfejlesztések és a myNextDays befolyásán kívül eső körülmények (pl. harmadik fél szolgáltatóknál fellépő üzemzavarok) átmenetileg korlátozhatják a rendelkezésre állást.",
        "A myNextDays jogosult a Platformot továbbfejleszteni és a funkciókat módosítani, amennyiben ez a szerződés célját nem veszélyezteti, és a módosítás a Felhasználó számára észszerűen elvárható.",
      ],
    },
    {
      heading: "§ 11 Adatok és adatvédelem",
      paragraphs: [
        "Amennyiben a myNextDays a Platform biztosítása során a Felhasználó megbízásából személyes adatokat kezel (különösen vendégadatokat), a felek a GDPR 28. cikke szerinti adatfeldolgozási megállapodást kötnek.",
        "Az általa bevitt adatok gyűjtésének és kezelésének adatvédelmi jogszerűségéért továbbra is a Felhasználó felel. A myNextDays általi adatkezelés részleteit a Platform adatvédelmi tájékoztatója tartalmazza; a Stripe általi adatkezelésre a § 5 alkalmazandó.",
      ],
    },
    {
      heading: "§ 12 A mesterséges intelligencia alkalmazása",
      paragraphs: [
        "A myNextDays egyes funkciókban mesterséges intelligenciát alkalmazó rendszereket használ, különösen árajánlásokhoz (Dynamic Pricing), az üzenetek beérkező postafiókjában megjelenő válaszjavaslatokhoz, valamint a támogatás során nyújtott segítséghez. Ezek a funkciók javaslatokat állítanak elő; a felhasználásukról szóló döntés és az azért való felelősség a Felhasználót terheli. Az árajánlások nem helyettesítik a saját kereskedelmi mérlegelést.",
        "Ha a vendégek közvetlenül kapcsolatba lépnek egy mesterséges intelligenciát alkalmazó rendszerrel, erről tájékoztatást kapnak (az (EU) 2024/1689 rendelet — „mesterséges intelligenciáról szóló rendelet” — 50. cikk (1) bekezdése). Azokat a szövegeket, amelyeket mesterséges intelligenciát alkalmazó rendszer állított elő vagy lényegesen módosított, és amelyeket a Felhasználó továbbad a vendégeknek, a Felhasználó köteles ekként megjelölni, amennyiben erre jogszabályi kötelezettség terheli.",
        "A myNextDays nem üzemeltet olyan, mesterséges intelligenciát alkalmazó rendszereket, amelyek a mesterséges intelligenciáról szóló rendelet III. melléklete szerint nagy kockázatú rendszernek minősülnek, és nem alkalmaz a mesterséges intelligenciáról szóló rendelet 5. cikke szerint tiltott gyakorlatokat. A Felhasználó által bevitt adatokat és vendégeinek adatait külön megbízás nélkül nem használják fel modellek betanításához.",
        "A Felhasználó nem használhatja a mesterséges intelligenciát alkalmazó funkciókat arra, hogy a vendégekben az emberi kommunikáció látszatát keltse ott, ahol tájékoztatási kötelezettség áll fenn, sem arra, hogy saját vizsgálat nélkül jogilag kötelező érvényű nyilatkozatokat tegyen.",
        "Ha a Felhasználó a fiókját az erre szolgáló interfészen keresztül összekapcsolja egy saját, mesterséges intelligencián alapuló asszisztenssel (például az Anthropic Claude nevű szolgáltatásával), a következők érvényesek: a Felhasználó maga köti meg az e szolgáltatásra vonatkozó szerződést, és ő felel annak alkalmazásáért. Az összekapcsolás a myNextDays felé adott utasításának minősül arra, hogy az engedélyezett adatokat oda kiadja — beleértve a harmadik országba történő továbbítást is, ha a szolgáltató az Európai Unión kívül található. A Felhasználó biztosítja, hogy ehhez jogalappal rendelkezik, hogy saját adatvédelmi tájékoztatója megjelöli a címzettet, és hogy a továbbításhoz szükséges garanciák fennállnak.",
        "Ilyen összekapcsoláshoz a Felhasználó olyan hozzáférést vesz igénybe, amelyre a szolgáltató adatfeldolgozást vállal, és amelynél kizárja az adatok modellek betanítására való felhasználását — a Claude esetében ezek az üzleti hozzáférések (Team, Enterprise vagy API). A magáncélú használatra szánt hozzáférések ezt rendszerint nem teljesítik; ezért vendégadatokhoz nem alkalmasak. A myNextDays nem tudja felismerni, hogy a Felhasználó melyik hozzáférést használja, és erre a hozzájárulási párbeszédpanelben felhívja a figyelmet.",
        "A Felhasználó ennek során figyelembe veszi, hogy azok a tartalmak, amelyeket a felületről kézzel másol be az asszisztens beviteli mezőjébe, rendszerint nem tartoznak a szolgáltató szerződéses korlátozásai alá — eltérően az interfészen keresztül lekért adatoktól.",
        "A foglalási portálról származó adatokat a Felhasználó az interfészen keresztül is kizárólag az adott foglalás lebonyolítására és kezelésére használja — nem személyek értékelésére, profilalkotásra vagy reklámcélokra. A portálok ezt a célhoz kötöttséget saját feltételeikben írják elő.",
      ],
    },
    {
      heading: "§ 13 Panaszok és közvetítés",
      paragraphs: [
        "A myNextDays az üzleti felhasználók számára ingyenes belső panaszkezelést tart fenn (az (EU) 2019/1150 rendelet — „P2B-rendelet” — 11. cikke). A panaszok — különösen a jelen ÁSZF állított megsértésére, a jelentős kihatású műszaki problémákra vagy a myNextDays Felhasználóval szemben tett intézkedéseire vonatkozóan — formai kötöttség nélkül benyújthatók az info@mynextdays.dk címre vagy az alkalmazásban elérhető támogatáson keresztül. A beérkezést visszaigazolják; az ügyintézés gyorsan és észszerű határidőn belül történik, egyszerű megítélésű esetekben rendszerint 14 napon belül. Az eredményt a Felhasználóval világos nyelven közlik.",
        "Ha a panaszeljárásban nem jön létre megegyezés, a myNextDays kész arra, hogy a Felhasználóval együtt bírósági eljáráson kívül a következő közvetítőkhöz forduljon (a P2B-rendelet 12. cikke): (1) WIPO Arbitration and Mediation Center, 34 chemin des Colombettes, 1211 Genf 20, Svájc — az eljárások távolról és több nyelven is lefolytathatók; (2) Voldgiftsinstituttet — Danish Institute of Arbitration, Kronprinsessegade 28, 1306 Koppenhága K, Dánia — a szolgáltató székhelye szerinti állam.",
        "A megnevezés nem kötelezi a Felhasználót közvetítői eljárás lefolytatására; a bírósághoz fordulás joga érintetlen marad. A közvetítés észszerű költségeihez a myNextDays hozzájárul; a megosztás az adott közvetítő szabályzata és az egyedi eset körülményei szerint alakul.",
        "A myNextDays évente közzéteszi a panaszok számára, az ügyintézési időre és a megtett intézkedésekre vonatkozó adatokat.",
      ],
    },
    {
      heading: "§ 14 Szellemi tulajdon",
      paragraphs: [
        "A Platformhoz, annak szoftveréhez és tartalmaihoz fűződő valamennyi jog (a Felhasználó által feltöltött tartalmak kivételével) a myNextDays-t, illetve annak licencadóit illeti. A Felhasználó a szerződés időtartamára egyszerű, át nem ruházható jogot kap a Platform szerződésben meghatározott terjedelmű használatára.",
        "A Felhasználó az általa feltöltött tartalmakon a Platform üzemeltetéséhez szükséges egyszerű felhasználási jogokat engedi át a myNextDays részére (különösen a tárolás, a többszörözés, a megjelenítés és a kapcsolt csatornák részére történő továbbítás céljából).",
      ],
    },
    {
      heading: "§ 15 Felelősség",
      paragraphs: [
        "A myNextDays korlátlanul felel szándékosság és súlyos gondatlanság esetén, valamint az élet, a testi épség vagy az egészség megsértéséből eredő károkért.",
        "Enyhe gondatlanság esetén a myNextDays csak a lényeges szerződéses kötelezettségek (kardinális kötelezettségek) megszegéséért felel, a szerződésre jellemző, előre látható kár mértékéig. A termékfelelősségi jogszabályok szerinti, valamint a vállalt garanciákból eredő felelősség érintetlen marad.",
        "Adatvesztésért a myNextDays csak olyan mértékben felel, amilyen mértékben a kár a Felhasználó általi szabályszerű, rendszeres adatmentés esetén is bekövetkezett volna, kivéve, ha az adatmentés a szerződés alapján a myNextDays feladata.",
      ],
    },
    {
      heading: "§ 16 Időtartam, felmondás és felfüggesztés",
      paragraphs: [
        "Az időtartam és a felmondási határidők az adott szerződésből következnek. A fontos okból történő rendkívüli felmondás joga érintetlen marad.",
        "A myNextDays átmenetileg felfüggesztheti a Platformhoz vagy egyes funkciókhoz való hozzáférést (ideértve a fizetések elfogadását és a kifizetéseket is), ha konkrét jelek utalnak a jelen ÁSZF megsértésére, csalásra vagy visszaélésszerű használatra, vagy ha a myNextDays erre jogszabály vagy valamely pénzforgalmi szolgáltató rendelkezése alapján köteles. A Felhasználó a felfüggesztésről tájékoztatást kap, amennyiben ez jogilag megengedett.",
        "A szerződés megszűnését követően a myNextDays a Felhasználó kérésére 30 napon belül, elterjedt formátumban exportálásra rendelkezésre bocsátja a Felhasználó adatait; ezt követően az adatok törlésre kerülnek, amennyiben ezt jogszabályi megőrzési kötelezettségek nem zárják ki.",
      ],
    },
    {
      heading: "§ 17 A jelen ÁSZF módosítása",
      paragraphs: [
        "A myNextDays a jövőre nézve módosíthatja a jelen ÁSZF-et, amennyiben ez alapos okból szükséges (különösen jogszabályváltozások, a bírói gyakorlat változásai vagy a pénzforgalmi szolgáltatók követelményei miatt), és a Felhasználót ezáltal nem éri méltánytalan hátrány.",
        "A módosításokról a Felhasználó legalább hat héttel a hatálybalépésük előtt szöveges formában értesítést kap. Ha a Felhasználó az értesítési határidőn belül nem emel kifogást, vagy a hatálybalépést követően tovább használja a Platformot, a módosított ÁSZF elfogadottnak minősül; erre a jogkövetkezményre az értesítés külön felhívja a figyelmet.",
      ],
    },
    {
      heading: "§ 18 Záró rendelkezések",
      paragraphs: [
        "A szolgáltató székhelye szerinti állam joga alkalmazandó, az áruk nemzetközi adásvételi szerződéseiről szóló ENSZ-egyezmény kizárásával. A Felhasználó székhelye szerinti állam kógens rendelkezései érintetlenek maradnak.",
        "A jelen szerződésből eredő vagy azzal összefüggő valamennyi jogvita kizárólagos illetékességi helye — amennyiben ez jogilag megengedett — a szolgáltató székhelye.",
        "Ha a jelen ÁSZF egyes rendelkezései érvénytelenek lennének vagy azzá válnának, ez a többi rendelkezés érvényességét nem érinti.",
      ],
    },
  ],
};
