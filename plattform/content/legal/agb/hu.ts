import type { LegalDoc } from "../types";

// Ungarische Fassung der Gast-AGB. Quelle ist content/legal/agb/de.ts —
// Änderungen immer zuerst dort.
export const agb: LegalDoc = {
  title: "Felhasználási feltételek vendégek részére (ÁSZF)",
  stand: "Utolsó frissítés: 2026. július 3.",
  intro: [
    "Jelen felhasználási feltételek a myNextDays foglalási portál (a továbbiakban: „Platform”) utazók és foglalók (a továbbiakban: „Vendég”) általi használatát szabályozzák.",
    "A Platform üzemeltetője: [az üzemeltető teljes cégneve, cégformája, címe és cégjegyzékadatai — közzététel előtt kiegészítendő] (a továbbiakban: „myNextDays” vagy „mi”).",
  ],
  sections: [
    {
      heading: "§ 1 Hatály",
      paragraphs: [
        "Jelen feltételek a Platform használatára vonatkoznak, különösen a szálláskeresésre és a szálláshely-szolgáltatások Platformon keresztüli foglalására.",
        "Magára a szálláshely-szolgáltatásra kiegészítően az adott Szolgáltató ajánlatban feltüntetett feltételei (pl. házirend, lemondási feltételek) alkalmazandók.",
      ],
    },
    {
      heading: "§ 2 A myNextDays szerepe; a szerződés létrejötte",
      paragraphs: [
        "A myNextDays az adott szolgáltatók (ügynökségek, szállásadók vagy tulajdonosok, a továbbiakban: „Szolgáltató”) által kínált szálláshely-szolgáltatásokat közvetíti. A szállásra vonatkozó szerződés kizárólag a Vendég és az adott Szolgáltató között jön létre. A myNextDays nem válik a szálláshely-szolgáltatási szerződés szerződő felévé.",
        "Az adott Szolgáltató az ajánlatban és a foglalási visszaigazolásban kerül megnevezésre.",
      ],
    },
    {
      heading: "§ 3 Foglalás és foglalási visszaigazolás",
      paragraphs: [
        "A szállások Platformon történő megjelenítése felhívás foglalási ajánlat megtételére. A foglalási folyamat befejezésével (a fizetési kötelezettséggel járó foglalási gombra kattintva) a Vendég kötelező erejű ajánlatot tesz a Szolgáltatóval kötendő szálláshely-szolgáltatási szerződés megkötésére.",
        "A szerződés a foglalás visszaigazolásával jön létre. A foglalási visszaigazolást a Vendég a megadott e-mail-címre kapja meg.",
        "A Vendég köteles a foglalás során helytálló és teljes körű adatokat megadni (különösen a nevét, elérhetőségeit és az utazók számát).",
      ],
    },
    {
      heading: "§ 4 Árak és fizetés",
      paragraphs: [
        "Az ajánlatban a foglalás időpontjában feltüntetett árak érvényesek, az ott feltüntetett adókkal, díjakkal és többletköltségekkel együtt. Az árak az ajánlatban megjelölt pénznemben jelennek meg. A helyszínen további helyi díjak (pl. idegenforgalmi adó) merülhetnek fel, amennyiben ezt az ajánlat feltünteti.",
        "A fizetés a Stripe pénzforgalmi szolgáltatón keresztül történik. A fizetési adatokat (pl. kártyaadatok) közvetlenül a Stripe gyűjti és kezeli; a myNextDays nem tárol teljes kártyaadatokat. A Stripe a személyes adatokat a [Stripe adatvédelmi nyilatkozata](https://stripe.com/privacy) szerint kezeli.",
        "Amennyiben az ajánlat kauciót tüntet fel, az a foglaláskor vagy az érkezéskor előzetesen zárolható, és kár esetén részben vagy egészben visszatartható; az ajánlatban szereplő adatok az irányadók.",
      ],
    },
    {
      heading: "§ 5 Lemondás, átfoglalás és elállás",
      paragraphs: [
        "Azt, hogy a foglalás díjmentesen lemondható vagy módosítható-e, és ha igen, milyen feltételekkel, a Szolgáltató ajánlatban feltüntetett lemondási feltételei határozzák meg.",
        "A meghatározott időszakra foglalt szálláshely-szolgáltatások esetében az EU fogyasztói jogokról szóló irányelve 16. cikkének l) pontja, illetve a megfelelő nemzeti rendelkezések alapján főszabály szerint nem áll fenn törvényes elállási jog. A Vendég kógens törvényes jogai érintetlenek maradnak.",
      ],
    },
    {
      heading: "§ 6 A Vendég kötelezettségei",
      paragraphs: [
        "A Vendég a szállást a szerződésnek megfelelően használja, betartja az ajánlatban feltüntetett legmagasabb vendéglétszámot, és tiszteletben tartja a Szolgáltató házirendjét.",
        "A Platformot tilos visszaélésszerűen használni, különösen színlelt foglalásokra, csalárd fizetésekre vagy jogsértő tartalmak közzétételére (pl. értékelésekben vagy üzenetekben).",
      ],
    },
    {
      heading: "§ 7 A myNextDays felelőssége",
      paragraphs: [
        "A szálláshely-szolgáltatás nyújtásáért kizárólag a Szolgáltató felel. A myNextDays nem felel a Szolgáltatók által közzétett ajánlati tartalmak helytállóságáért, a közvetítést és a fizetésfeldolgozást azonban a gondos kereskedőtől elvárható gondossággal végzi.",
        "A myNextDays korlátlanul felel szándékosság és súlyos gondatlanság esetén, valamint az élet, a testi épség vagy az egészség megsértéséből eredő károkért. Enyhe gondatlanság esetén a myNextDays csak a lényeges szerződéses kötelezettségek (kardinális kötelezettségek) megszegéséért felel, a szerződésre jellemző, előre látható kár mértékéig. A kógens törvényes felelősségi szabályok érintetlenek maradnak.",
      ],
    },
    {
      heading: "§ 8 Adatvédelem",
      paragraphs: [
        "A myNextDays a Vendég személyes adatait a közvetítés és a foglalás lebonyolítása céljából kezeli. A foglalási adatok az adott Szolgáltató részére kerülnek továbbításra, amennyiben ez a szálláshely-szolgáltatási szerződés teljesítéséhez szükséges. A fizetésfeldolgozásra a § 4 alkalmazandó.",
        "A részleteket a Platform adatvédelmi tájékoztatója tartalmazza.",
      ],
    },
    {
      heading: "§ 9 Panaszok és vitarendezés",
      paragraphs: [
        "A szállással kapcsolatos kifogásokkal a Vendég először a Szolgáltatóhoz fordul; a foglalással vagy a fizetéssel kapcsolatos kérdésekben a myNextDays ügyfélszolgálata segít a Platformon megadott elérhetőségeken.",
        "A myNextDays nem köteles és nem hajlandó fogyasztói békéltető testület előtti vitarendezési eljárásban részt venni, amennyiben erre jogszabályi kötelezettség nem áll fenn.",
      ],
    },
    {
      heading: "§ 10 A jelen feltételek módosítása",
      paragraphs: [
        "A myNextDays a jövőre nézve módosíthatja a jelen feltételeket, amennyiben ez alapos okból szükséges (különösen jogszabályváltozások vagy a bírói gyakorlat változásai miatt), és a Vendéget ezáltal nem éri méltánytalan hátrány. A már megkötött foglalásokra a foglaláskor hatályos változat alkalmazandó.",
      ],
    },
    {
      heading: "§ 11 Záró rendelkezések",
      paragraphs: [
        "Az üzemeltető székhelye szerinti állam joga alkalmazandó, az áruk nemzetközi adásvételi szerződéseiről szóló ENSZ-egyezmény kizárásával. Ha a Vendég fogyasztó, a szokásos tartózkodási helye szerinti állam kógens fogyasztóvédelmi rendelkezései érintetlenek maradnak.",
        "Ha a jelen feltételek egyes rendelkezései érvénytelenek lennének vagy azzá válnának, ez a többi rendelkezés érvényességét nem érinti.",
      ],
    },
  ],
};
