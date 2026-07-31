import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Platforma (trhovisko)",
  description: "Predaj na trhovisku myBestDays.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Trhovisko",
      articles: [
        {
          slug: "der-marktplatz",
          title: "Trhovisko myBestDays",
          excerpt: "Globálne trhovisko myBestDays je vlastný rezervačný kanál popri portáloch a webovej stránke.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Trhovisko myBestDays (/plattform) je globálny rezervačný kanál samotného myBestDays — porovnateľný s Booking alebo Airbnb, no je súčasťou tej istej platformy. Hostia tam prehľadávajú objekty všetkých pripojených prevádzok a rezervujú priamo.",
            },
            { type: "h2", text: "Nie „priamo“, ale rovnocenný kanál" },
            {
              type: "p",
              text: "Trhovisko nenahrádza priamu rezerváciu cez vašu vlastnú webovú stránku. Je to samostatná, tretia predajná cesta s vlastnou osou viditeľnosti, vlastnou základňou hostí a vlastnou províziou — presne ako portál, len ho prevádzkuje samotný myBestDays.",
            },
            { type: "h2", text: "Ako sa objekty dostanú na trhovisko" },
            {
              type: "ul",
              items: [
                "Objekt musí byť aktívny (status objektu umožňuje predaj).",
                "Musí byť zapnutá viditeľnosť na trhovisku — oddelene od portálov a webovej stránky.",
                "Pre požadované obdobie musí existovať dostupnosť v kalendári.",
              ],
            },
            { type: "h2", text: "Rezervácie z trhoviska" },
            {
              type: "p",
              text: "Rezervácia z trhoviska okamžite zablokuje príslušné noci na všetkých ostatných kanáloch — rovnako ako rezervácia z portálu alebo webovej stránky. Objaví sa vo vašom kalendári a v rezerváciách ako každá iná rezervácia, označená kanálom „Platforma“.",
            },
            {
              type: "note",
              variant: "info",
              text: "Stop-Sell a neaktívny status objektu pôsobia naprieč kanálmi a blokujú aj trhovisko — bez ohľadu na prepínač viditeľnosti trhoviska.",
            },
            {
              type: "p",
              text: "Ako aktivovať objekt pre trhovisko, si prečítajte v [Zaradenie objektu na trhovisko](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Zaradenie objektu na trhovisko",
          excerpt: "Viditeľnosť na trhovisku je vlastný prepínač, oddelený od portálov a webovej stránky.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Viditeľnosť na trhovisku riadite pomocou vlastného prepínača pri objekte — nezávisle od toho, či je ten istý objekt viditeľný aj na portáloch alebo vašej webovej stránke.",
            },
            { type: "h2", text: "Ako zaradiť objekt" },
            {
              type: "steps",
              items: [
                "Otvorte objekt v sekcii Objekty.",
                "Prepnite na záložku Viditeľnosť.",
                "Aktivujte prepínač Trhovisko platformy.",
                "Skontrolujte, že je status objektu aktívny a existuje dostupnosť v kalendári.",
              ],
            },
            { type: "h2", text: "Predpoklad: úplný profil" },
            {
              type: "p",
              text: "Trhovisko zobrazuje len objekty s úplnými údajmi — musia byť uložené titulná fotografia, popis, vybavenie a základná cena. Ak chýbajú povinné údaje, objekt zostáva napriek aktivovanému prepínaču neviditeľný.",
            },
            {
              type: "ul",
              items: [
                "Minimálne jedna titulná fotografia a popis",
                "Vlastnosti vybavenia zo zoznamu kategórie",
                "Obsadenosť a základná cena v uloženej mene objektu",
                "Dostupnosť v kalendári pre požadované obdobie",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Kliknutím na Zverejniť myNextDays zvyčajne spoločne aktivuje trhovisko, portály a webovú stránku — prepínač trhoviska môžete potom kedykoľvek jednotlivo znova vypnúť.",
            },
            { type: "h2", text: "Opätovné odstránenie viditeľnosti" },
            {
              type: "p",
              text: "Ak deaktivujete prepínač Trhovisko platformy, objekt zmizne z vyhľadávania na trhovisku. Už potvrdené rezervácie tým zostávajú nedotknuté a pokračujú ako obvykle, pozri [Provízia z trhoviska](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Provízia z trhoviska",
          excerpt: "Za každú rezerváciu sprostredkovanú cez trhovisko sa účtuje provízia uložená vo vašom tarife.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Rovnako ako pri každom rezervačnom portáli sa aj za rezervácie uskutočnené cez trhovisko myBestDays účtuje provízia. Počíta sa za jednotlivú rezerváciu a je nezávislá od prípadných provízií za portály.",
            },
            { type: "h2", text: "Ako sa provízia počíta" },
            {
              type: "p",
              text: "Výška sa riadi províziou uloženou vo vašom tarife. Aktuálnu sadzbu nájdete kedykoľvek v sekcii Konto v oblasti Vyúčtovanie — tam sa neuvádza žiadna paušálna hodnota, ale skutočná sadzba platná pre váš tarif.",
            },
            { type: "h2", text: "Kde uvidíte províziu" },
            {
              type: "steps",
              items: [
                "V menu otvorte Konto.",
                "Prepnite na oblasť Vyúčtovanie.",
                "Otvorte rezerváciu z trhoviska, aby ste videli tržbu a províziu do podrobností.",
                "Skontrolujte prehľad provízií za aktuálne zúčtovacie obdobie.",
              ],
            },
            { type: "h2", text: "Rozdiel oproti províziám za portály" },
            {
              type: "ul",
              items: [
                "Provízia z trhoviska platí výhradne pre rezervácie cez trhovisko myBestDays.",
                "Rezervácie z portálov (Booking, Airbnb a ďalšie) podliehajú podmienkam príslušného portálu.",
                "Rezervácie z webovej stránky podliehajú podmienkam uloženým pre váš tarif bez provízie z trhoviska.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Provízia sa automaticky určuje z vášho tarifu. Chýbajúci alebo nejasný tarif vedie k jasnej chybovej správe namiesto odhadovanej hodnoty.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Profil hosťa a hodnotenia",
          excerpt: "Hostia z trhoviska majú profil s históriou rezervácií a môžu zanechávať hodnotenia.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Hostia, ktorí rezervujú cez trhovisko myBestDays, si vytvárajú vlastný profil hosťa. V ňom sa zhromažďujú ich rezervácie, správy s prevádzkami a udelené hodnotenia — podobne ako pri portálovom konte hosťa.",
            },
            { type: "h2", text: "Čo vidíte ako prevádzka" },
            {
              type: "p",
              text: "V podrobnostiach rezervácie z trhoviska nájdete profil hosťa s doterajšími pobytmi vo vašej prevádzke a, ak to hosť povolil, verejne viditeľnými hodnoteniami iných ubytovaní.",
            },
            { type: "h2", text: "Hodnotenia po pobyte" },
            {
              type: "steps",
              items: [
                "Po check-oute dostane hosť výzvu na hodnotenie.",
                "Hodnotenie sa po krátkej kontrole objaví na stránke objektu na trhovisku.",
                "Ako prevádzka môžete na každé hodnotenie verejne odpovedať.",
                "Neobjektívne alebo zneužívajúce hodnotenia môžete cez Nahlásiť predložiť na preskúmanie.",
              ],
            },
            {
              type: "ul",
              items: [
                "Hodnotenia sú viazané na skutočnú rezerváciu — žiadne hodnotenie bez pobytu.",
                "Hosť hodnotí čistotu, komunikáciu, polohu a pomer ceny a kvality.",
                "Vaša odpoveď je viditeľná pre všetkých návštevníkov trhoviska.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Dobré hodnotenia priamo ovplyvňujú umiestnenie vášho objektu vo vyhľadávaní na trhovisku — na kritiku reagujte včas a vecne.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Blokované osoby",
          excerpt: "Prevádzka môže zablokovať hosťa, čím sa zabráni správam a rezerváciám.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Ak nastanú problémy s hosťom, môžete ho ako prevádzka zablokovať. Zablokovaná osoba vám už nemôže posielať správy ani vytvárať novú rezerváciu vo vašej prevádzke.",
            },
            { type: "h2", text: "Zablokovanie osoby" },
            {
              type: "steps",
              items: [
                "Otvorte históriu správ alebo rezerváciu s príslušným hosťom.",
                "Kliknite na Zablokovať hosťa.",
                "Potvrďte dialóg — blokovanie platí okamžite.",
                "Zablokovaná osoba sa následne objaví v sekcii Konto pod Blokované osoby.",
              ],
            },
            { type: "h2", text: "Čo blokovanie spôsobí" },
            {
              type: "ul",
              items: [
                "Hosť už nemôže posielať nové správy vašej prevádzke.",
                "Hosť už nemôže vytvárať novú rezerváciu vo vašej prevádzke.",
                "Prebiehajúca rezervácia s už potvrdeným príchodom v nasledujúcich dvoch týždňoch zostáva blokovaním nedotknutá, aby sa pobyt mohol riadne vybaviť.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Blokovanie platí výhradne pre vašu prevádzku. Iné prevádzky na trhovisku blokovanie nevidia a nie sú ním dotknuté.",
            },
            { type: "h2", text: "Opätovné zrušenie blokovania" },
            {
              type: "p",
              text: "Otvorte Konto a tam Blokované osoby. Vyberte záznam a kliknite na Zrušiť blokovanie — hosť potom môže opäť posielať správy a rezervovať.",
            },
          ],
        },
      ],
    },
  ],
};
