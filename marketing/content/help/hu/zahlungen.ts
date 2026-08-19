import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Fizetések és számlák",
  description: "Fizetési szolgáltatók, fizetési szabályok és számlák.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Fizetések",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Fizetési szolgáltató összekapcsolása",
          excerpt:
            "Így köti össze a Stripe-ot vagy a PayPalt a myNextDaysszel, hogy a fizetéseket automatikusan bonyolítsa le.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Elérhető szolgáltatók" },
            {
              type: "p",
              text: "A myNextDays a fizetéseket csatlakoztatott fizetési szolgáltatókon keresztül bonyolítja le. Jelenleg a Stripe és a PayPal támogatott — egyet vagy mindkét szolgáltatót egyszerre csatlakoztathatja, és objektumtól vagy vendégkívánságtól függően használhatja.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg a Fiók menüt, és váltson a „Fizetések” szakaszra.",
                "Válassza ki a kívánt szolgáltatót — Stripe vagy PayPal.",
                "Kövesse az összekapcsolási párbeszédablakot, és jelentkezzen be a szolgáltatónál, vagy hozzon létre új fiókot.",
                "Erősítse meg az összekapcsolást — az állapot „összekapcsolva” lesz.",
              ],
            },
            { type: "h2", text: "Mi történik ezután" },
            {
              type: "p",
              text: "Amint egy szolgáltató csatlakoztatva van, küldhet fizetési linkeket, beszedhet előlegeket, és közvetlenül a foglalásból indíthat visszatérítéseket. Minden összeg az adott objektumhoz rögzített devizában kerül feldolgozásra.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Csatlakoztatott szolgáltató nélkül a fizetéseket csak kézzel jelölheti meg beérkezettként — automatikus beszedés ekkor nem lehetséges.",
            },
            { type: "h2", text: "Több objektum, egy szolgáltató" },
            {
              type: "p",
              text: "Egy egyszer létrehozott kapcsolat fiókszinten érvényes minden objektumára. Hogy a beszedés részletesen hogyan zajlik, azt a [Fizetési szabályok](/hilfe/zahlungen/zahlungsregeln) alatt határozza meg. Az Önnek járó kifizetések ezután az adott szolgáltatón keresztül történnek, lásd [Kifizetések](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "A Stripe alkalmas kártyás fizetésekre és sok helyi fizetési módra",
                "A PayPal ismerős alternatívát kínál a vendégeknek",
                "Mindkét szolgáltató egymástól függetlenül leválasztható és újra csatlakoztatható",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Fizetési szabályok",
          excerpt: "Állítsa be, mikor esedékes egy foglalás előlege és fennmaradó összege.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Előleg és fennmaradó összeg" },
            {
              type: "p",
              text: "A fizetési szabályok határozzák meg, hogyan bonyolódik le pénzügyileg egy foglalás — például előleg a foglaláskor és fennmaradó összeg az érkezés előtt, vagy a teljes összeg azonnali fizetése. A szabályok objektumonként érvényesek, és bármikor módosíthatók.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az objektumot, és váltson a „Fizetési szabályok” szakaszra.",
                "Válassza ki, hogy kérnek-e előleget, és határozza meg az arányát.",
                "Adja meg, mikor esedékes a fennmaradó összeg, például meghatározott napszámmal az érkezés előtt.",
                "Mentse el a beállításokat.",
              ],
            },
            { type: "h2", text: "Automatikus beszedés" },
            {
              type: "p",
              text: "Ha egy fizetési szolgáltató csatlakoztatva van, a myNextDays automatikusan beszedi az előleget és a fennmaradó összeget a megadott időpontban, és előzetesen üzenetben tájékoztatja a vendéget.",
            },
            {
              type: "note",
              variant: "info",
              text: "A fizetési szabályok csak csatlakoztatott fizetési szolgáltatóval rendelkező foglalásoknál hatnak. Szolgáltató nélkül a fizetéseket kézzel jelöli meg a foglalásban.",
            },
            { type: "h2", text: "Csatornánkénti eltérések" },
            {
              type: "p",
              text: "A portálokon eltérően azok saját fizetési lebonyolítása lehet érvényes — ilyen esetben ellenőrizze az adott portál feltételeit. A saját platformon vagy weboldalon keresztüli foglalásoknál mindig az itt rögzített szabályok érvényesülnek. A szolgáltatói csatlakozás részleteiről bővebben: [Fizetési szolgáltató összekapcsolása](/hilfe/zahlungen/zahlungsanbieter-verbinden), a számlázásról: [Számlák létrehozása](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Az előleg fix összegként vagy százalékos értékként is beállítható",
                "A fennmaradó összeg határideje szabadon választható",
                "A módosítások csak új foglalásokra hatnak, visszamenőlegesen nem",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Számlák létrehozása",
          excerpt: "Így hoz létre egy foglaláshoz számlát helyes számlázási címmel.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Számla létrehozása" },
            {
              type: "p",
              text: "Minden foglaláshoz létrehozható számla — a vendég számára, vagy egy eltérő vállalkozás számára, amennyiben a foglalás üzleti célból történt.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg a foglalást a Foglalásoknál.",
                "Válassza a „Számla létrehozása” opciót.",
                "Ellenőrizze vagy egészítse ki a számlázási címet.",
                "Ellenőrizze a felsorolt tételeket — szállás, add-onok, díjak.",
                "Hozza létre a számlát, és küldje el a vendégnek.",
              ],
            },
            { type: "h2", text: "Számlázási cím karbantartása" },
            {
              type: "p",
              text: "A számlázási címet közvetlenül a foglalásban rögzítheti, vagy a foglalási visszaigazoláson keresztül utólag bekérheti a vendégtől. Teljes cím nélkül bizonyos országokban nem állítható ki jogilag érvényes számla.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Üzleti ügyfeleknél különösen ellenőrizze a cégnevet és a címet — az utólagos javítások helyesbítő számlát igényelnek.",
            },
            { type: "h2", text: "Összegek és deviza" },
            {
              type: "p",
              text: "Minden tétel az objektumhoz rögzített devizában jelenik meg. A már megtörtént fizetéseket a számla fizetési beérkezésként rögzíti. Hogy hogyan jön létre az előleg és a fennmaradó összeg, arról bővebben: [Fizetési szabályok](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "A számlák PDF-ként letölthetők",
                "Helyesbítő számlák módosítás esetén bármikor lehetségesek",
                "Az add-onok önálló tételként jelennek meg",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Visszatérítések",
          excerpt:
            "Így téríthet vissza teljesen vagy részlegesen egy fizetést, ha egy foglalást lemondanak vagy módosítanak.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Mikor szükséges visszatérítés" },
            {
              type: "p",
              text: "Egy visszatérítés jellemzően lemondás esetén merül fel, de szükséges lehet egy utólagos árigazítás vagy egy lemondott add-on esetén is.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg az érintett foglalást a Foglalásoknál.",
                "Válassza a „Visszatérítés” opciót a foglalás fizetési területén.",
                "Adja meg a visszatérítendő összeget — teljesen vagy részlegesen.",
                "Erősítse meg a visszatérítést.",
              ],
            },
            { type: "h2", text: "Lefolyás a fizetési szolgáltatón keresztül" },
            {
              type: "p",
              text: "A visszatérítés a fizetéshez használt szolgáltatón — Stripe vagy PayPal — keresztül történik, és közvetlenül a vendég eredeti fizetőeszközére kerül visszautalásra. A folyamat automatikusan rögzítésre kerül a foglalási idővonalon.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Csatlakoztatott fizetési szolgáltató nélkül egy visszatérítés nem indítható automatikusan — ilyen esetben a visszafizetést közvetlenül a vendéggel egyeztesse.",
            },
            { type: "h2", text: "Hatás a jutalékokra" },
            {
              type: "p",
              text: "A már elszámolt piactéri vagy portáljutalékok egy visszatérítés esetén arányosan kiigazításra kerülnek. Bővebben: [Jutalékok megértése](/hilfe/zahlungen/provisionen-verstehen). Magának a lemondásnak a részleteiről bővebben: [Lemondás és visszatérítés](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Részleges visszatérítés egyes tételekre is lehetséges",
                "A feldolgozási állapot bármikor látható a foglalásban",
                "A visszatérítések kizárólag az eredetileg használt szolgáltatón keresztül zajlanak",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Kifizetések",
          excerpt:
            "Így kapja meg foglalásai bevételét a csatlakoztatott fizetési szolgáltatóktól kifizetve.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Hogyan működnek a kifizetések" },
            {
              type: "p",
              text: "A beérkező fizetések először a csatlakoztatott fizetési szolgáltatónál gyűlnek össze. Onnan történik a kifizetés a rögzített bankszámlájára a szolgáltató szokásos ritmusa szerint.",
            },
            {
              type: "steps",
              items: [
                "Nyissa meg a Fiók menüt, és váltson a „Fizetések” szakaszra.",
                "Ellenőrizze a „Kifizetések” alatt az adott szolgáltató állapotát.",
                "Szükség esetén nyissa meg a szolgáltató részletes nézetét a teljes kifizetési előzményekhez.",
              ],
            },
            { type: "h2", text: "Mi kerül levonásra a kifizetés előtt" },
            {
              type: "p",
              text: "A kifizetés előtt figyelembe veszik a felmerülő piactéri és portáljutalékokat, valamint a szolgáltatói díjakat. A kifizetett összeg így nem feltétlenül egyezik az eredeti foglalási összeggel.",
            },
            {
              type: "note",
              variant: "info",
              text: "A levonások pontos felépítését a [Jutalékok megértése](/hilfe/zahlungen/provisionen-verstehen) magyarázza el.",
            },
            { type: "h2", text: "Több objektum és tulajdonos" },
            {
              type: "p",
              text: "Ha különböző tulajdonosok számára kezel objektumokat, a kifizetések a rögzített tulajdonosi elszámolásoknak megfelelően kerülnek hozzárendelésre. Eltérés esetén először ellenőrizze az érintett foglalások állapotát a Foglalásoknál.",
            },
            {
              type: "ul",
              items: [
                "A kifizetés ritmusát és módját az adott szolgáltató határozza meg",
                "A visszatartott összegek, például folyamatban lévő visszatérítéseknél, jelölve vannak",
                "A teljes előzmény közvetlenül a szolgáltatónál tekinthető meg",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Jutalékok megértése",
          excerpt:
            "Áttekintés arról, hogyan tevődnek össze a piactéri és portáljutalékok, és hol kerülnek elszámolásra.",
          updated: "Frissítve: 2026. július",
          body: [
            { type: "h2", text: "Kétféle jutalék" },
            {
              type: "p",
              text: "A myNextDaysen keresztüli foglalásoknál kétféle jutalék merülhet fel: a piactéri jutalék a saját platformon keresztüli foglalásokért, valamint a portáljutalékok a csatlakoztatott portálokon, mint a Booking vagy az Airbnb keresztül beérkező foglalásokért. Mindkettő egymástól független, és a foglalás értékesítési útjától függően eltérő lehet.",
            },
            {
              type: "ul",
              items: [
                "Piactéri jutalék: a myBestDays platformon keresztüli foglalásoknál merül fel",
                "Portáljutalék: az adott portál saját feltételei szerint kerül kiszámításra",
                "A saját weboldalán keresztüli közvetlen foglalások ettől függetlenül tekintendők",
              ],
            },
            { type: "h2", text: "Hol láthatók a jutalékok" },
            {
              type: "steps",
              items: [
                "Nyissa meg a Fiók menüt, és váltson az „Elszámolás” szakaszra.",
                "Válassza ki a kívánt hónapot.",
                "Ellenőrizze a foglalásonkénti kimutatást a hozzá tartozó jutalékkal.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Hogy egy foglalás melyik csatornán érkezett, közvetlenül magán a foglaláson látja — ez magyarázza, melyik jutalék került alkalmazásra.",
            },
            { type: "h2", text: "Kapcsolat a kifizetésekkel" },
            {
              type: "p",
              text: "A jutalékok a kifizetés előtt levonásra kerülnek a foglalási összegből. A kifizetési folyamat részleteiről bővebben: [Kifizetések](/hilfe/zahlungen/auszahlungen). Egy visszatérítés esetén a hozzá tartozó jutalék arányosan korrigálásra kerül — egy foglalás teljes lefolyását a [Foglalási idővonal](/hilfe/reservierungen/buchungs-zeitleiste) mutatja.",
            },
          ],
        },
      ],
    },
  ],
};
