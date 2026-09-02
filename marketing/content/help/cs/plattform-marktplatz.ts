import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Platforma (marketplace)",
  description: "Prodávejte na marketplace myBestDays.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Marketplace",
      articles: [
        {
          slug: "der-marktplatz",
          title: "Marketplace myBestDays",
          excerpt: "Globální marketplace myBestDays je samostatný rezervační kanál vedle portálů a webu.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Marketplace myBestDays (/plattform) je globální rezervační kanál samotného myBestDays — srovnatelný s Booking nebo Airbnb, přesto je součástí téže platformy. Hosté zde procházejí objekty všech napojených provozů a rezervují přímo.",
            },
            { type: "h2", text: "Ne „přímý“ prodej, ale rovnocenný kanál" },
            {
              type: "p",
              text: "Marketplace nenahrazuje přímou rezervaci přes váš vlastní web. Je to samostatná, třetí prodejní cesta s vlastní osou viditelnosti, vlastní hostovskou základnou a vlastní provizí — přesně jako portál, jen provozovaná samotným myBestDays.",
            },
            { type: "h2", text: "Jak se objekty dostanou na marketplace" },
            {
              type: "ul",
              items: [
                "Objekt musí být aktivní (stav objektu umožňuje prodej).",
                "Viditelnost na marketplace musí být zapnutá — odděleně od portálů a webu.",
                "Pro požadovaný termín musí být v kalendáři dostupnost.",
              ],
            },
            { type: "h2", text: "Rezervace z marketplace" },
            {
              type: "p",
              text: "Rezervace z marketplace okamžitě zablokuje příslušné noci na všech ostatních kanálech — stejně jako rezervace z portálu nebo webu. V kalendáři i v rezervacích se zobrazí jako každá jiná rezervace, označená kanálem „Platforma“.",
            },
            {
              type: "note",
              variant: "info",
              text: "Stop-Sell a neaktivní stav objektu působí napříč kanály a zablokují i marketplace — bez ohledu na přepínač viditelnosti marketplace.",
            },
            {
              type: "p",
              text: "Jak zpřístupnit objekt na marketplace, se dočtete v [Umístění objektu na marketplace](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Umístění objektu na marketplace",
          excerpt: "Viditelnost na marketplace je samostatný přepínač, oddělený od portálů a webu.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Viditelnost na marketplace řídíte pomocí vlastního přepínače u objektu — nezávisle na tom, zda je stejný objekt viditelný i na portálech nebo na vašem webu.",
            },
            { type: "h2", text: "Jak objekt umístit" },
            {
              type: "steps",
              items: [
                "Otevřete objekt v sekci Objekty.",
                "Přepněte na záložku Viditelnost.",
                "Zapněte přepínač Marketplace platformy.",
                "Zkontrolujte, že je stav objektu aktivní a existuje dostupnost v kalendáři.",
              ],
            },
            { type: "h2", text: "Podmínka: kompletní profil" },
            {
              type: "p",
              text: "Marketplace zobrazuje pouze objekty s kompletními údaji — musí být vyplněna hlavní fotografie, popis, vybavení a základní cena. Pokud povinné údaje chybí, zůstane objekt i přes zapnutý přepínač neviditelný.",
            },
            {
              type: "ul",
              items: [
                "Alespoň jedna hlavní fotografie a popis",
                "Vybavení ze seznamu kategorií",
                "Kapacita a základní cena v nastavené měně objektu",
                "Dostupnost v kalendáři pro požadovaný termín",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Kliknutím na Publikovat myNextDays společně odemkne portály a webové stránky. myBestDays je povinný kanál: Každá nemovitost je tam uvedena a objeví se, jakmile inzerát schválíme.",
            },
            { type: "h2", text: "Opětovné odebrání viditelnosti" },
            {
              type: "p",
              text: "myBestDays nelze individuálně zrušit. Pokud se nemovitost již nemá prodávat, použijte „Pozastavit prodej“ – tím se odstraní ze všech portálů, webových stránek a tržiště současně. Již potvrzené rezervace zůstávají nedotčeny a pokračují jako obvykle, viz [Provize z tržiště](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Provize marketplace",
          excerpt: "Za každou rezervaci zprostředkovanou přes marketplace se účtuje provize uvedená v tarifu.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Stejně jako u každého rezervačního portálu se i za rezervace vzniklé přes marketplace myBestDays účtuje provize. Počítá se za každou rezervaci a je nezávislá na případných provizích za portály.",
            },
            { type: "h2", text: "Jak se provize počítá" },
            {
              type: "p",
              text: "Výše se řídí provizí uvedenou v tarifu vašeho provozu. Aktuální sazbu najdete kdykoli v Konto v sekci Vyúčtování — nepředpokládá se žádná paušální hodnota, zobrazuje se skutečná sazba platná pro váš tarif.",
            },
            { type: "h2", text: "Kde provizi zjistíte" },
            {
              type: "steps",
              items: [
                "V menu otevřete Konto.",
                "Přepněte do sekce Vyúčtování.",
                "Otevřete rezervaci z marketplace, abyste viděli detail obratu a provize.",
                "Zkontrolujte přehled provizí za aktuální zúčtovací období.",
              ],
            },
            { type: "h2", text: "Odlišení od provizí portálů" },
            {
              type: "ul",
              items: [
                "Provize marketplace platí výhradně pro rezervace přes marketplace myBestDays.",
                "Rezervace z portálů (Booking, Airbnb a další) podléhají podmínkám daného portálu.",
                "Rezervace z webu podléhají podmínkám uvedeným ve vašem tarifu bez provize marketplace.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Provize se automaticky určuje z vašeho tarifu. Chybějící nebo nejasný tarif vede k jasnému chybovému hlášení, nikoli k odhadované hodnotě.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Profil hosta a recenze",
          excerpt: "Hosté z marketplace mají profil s historií rezervací a mohou zanechávat recenze.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Hosté, kteří rezervují přes marketplace myBestDays, si zakládají vlastní profil hosta. Shromažďují se v něm jejich rezervace, zprávy s provozy a odevzdané recenze — podobně jako u hostovského účtu na portálu.",
            },
            { type: "h2", text: "Co jako provoz vidíte" },
            {
              type: "p",
              text: "V detailu rezervace z marketplace najdete profil hosta s dosavadními pobyty u vašeho provozu a, pokud to host povolil, veřejně viditelnými recenzemi k dalším ubytováním.",
            },
            { type: "h2", text: "Recenze po pobytu" },
            {
              type: "steps",
              items: [
                "Po check-outu obdrží host výzvu k napsání recenze.",
                "Recenze se po krátké kontrole zobrazí na stránce objektu na marketplace.",
                "Jako provoz můžete na každou recenzi veřejně odpovědět.",
                "Nevěcné nebo zneužívající recenze můžete přes Nahlásit předat ke kontrole.",
              ],
            },
            {
              type: "ul",
              items: [
                "Recenze jsou vázané na skutečnou rezervaci — bez pobytu žádná recenze.",
                "Host hodnotí čistotu, komunikaci, polohu a poměr ceny a kvality.",
                "Vaše odpověď je viditelná pro všechny návštěvníky marketplace.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Dobré recenze se přímo projevují na umístění vašeho objektu ve vyhledávání na marketplace — na kritiku reagujte včas a věcně.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Blokované osoby",
          excerpt: "Provoz může hosta zablokovat, čímž se znemožní zprávy i rezervace.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Pokud s hostem nastanou problémy, můžete ho jako provoz zablokovat. Zablokovaná osoba vám již nemůže posílat zprávy ani zakládat u vašeho provozu novou rezervaci.",
            },
            { type: "h2", text: "Zablokování osoby" },
            {
              type: "steps",
              items: [
                "Otevřete historii zpráv nebo rezervaci s daným hostem.",
                "Klikněte na Zablokovat hosta.",
                "Potvrďte dialog — blokace platí okamžitě.",
                "Zablokovaná osoba se poté zobrazí v Konto v sekci Blokované osoby.",
              ],
            },
            { type: "h2", text: "Co blokace způsobí" },
            {
              type: "ul",
              items: [
                "Host už nemůže posílat vašemu provozu nové zprávy.",
                "Host už nemůže u vašeho provozu založit novou rezervaci.",
                "Probíhající rezervace s již potvrzeným příjezdem v následujících dvou týdnech blokací dotčena není, aby mohl být pobyt řádně dokončen.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Blokace platí výhradně pro váš provoz. Ostatní provozy na marketplace blokaci nevidí a nejsou jí dotčeny.",
            },
            { type: "h2", text: "Zrušení blokace" },
            {
              type: "p",
              text: "Otevřete Konto a v něm Blokované osoby. Vyberte záznam a klikněte na Zrušit blokaci — host pak může znovu posílat zprávy i rezervovat.",
            },
          ],
        },
      ],
    },
  ],
};
