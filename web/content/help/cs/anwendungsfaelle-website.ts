import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Webová stránka",
  description: "Optimální využití vaší webové stránky.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Webová stránka",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Spuštění vaší webové stránky",
          excerpt: "Jak zveřejnit vlastní webovou stránku jako samostatný prodejní kanál.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace",
            },
            {
              type: "p",
              text: "Vaše webová stránka je samostatný prodejní kanál vedle portálů a platformy. Stránky vytváříte v editoru, ale teprve zveřejněním se web stane viditelným pro hosty a vaše objekty se na něm zobrazí jako rezervovatelné.",
            },
            {
              type: "steps",
              items: [
                "Otevřete editor webových stránek a zkontrolujte, že jsou všechny požadované stránky vyplněné obsahem.",
                "V záložce objektu vyberte pro každý objekt, zda má být na webu viditelný — tato viditelnost je nezávislá na portálech a platformě.",
                "Než web spustíte naostro, zkontrolujte náhled v počítačovém i mobilním zobrazení.",
                "Klikněte na „Zveřejnit“, abyste web zpřístupnili hostům.",
                "Po zveřejnění zkontrolujte veřejnou URL adresu a otestujte vzorovou rezervaci přes web.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Viditelnost objektu na webu je samostatná osa — objekt může být aktivní na portálech, ale na webu skrytý, a naopak. Podrobnosti v článku [Propojení domény](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Nastavení vlastní domény",
          excerpt: "Jak propojit vlastní doménu s vaším webem myNextDays.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace",
            },
            {
              type: "p",
              text: "Vlastní doména jako www.vas-podnik.cz působí profesionálněji než standardní adresa a posiluje vaši značku vůči hostům, kteří chtějí rezervovat přímo u vás.",
            },
            {
              type: "steps",
              items: [
                "V editoru webových stránek otevřete sekci „Doména“ a zadejte požadovanou vlastní doménu.",
                "U poskytovatele své domény nastavte zobrazené DNS záznamy (zpravidla CNAME nebo A záznam).",
                "Počkejte, až se doména zobrazí jako propojená a SSL certifikát jako aktivní — to může podle poskytovatele trvat několik hodin.",
                "Otestujte přístup na vlastní doménu v anonymním okně prohlížeče, abyste vyloučili staré uložené záznamy v mezipaměti.",
                "Zkontrolujte, že staré standardní adresy nadále přesměrovávají na novou doménu, aby existující odkazy nevedly do prázdna.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Měňte DNS záznamy pouze podle zobrazeného návodu — nesprávné hodnoty mohou narušit stávající e-mailové nastavení vaší domény. V případě pochybností to nejprve ověřte u poskytovatele domény, než přepíšete existující záznamy.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Zvýšení počtu přímých rezervací",
          excerpt: "Jak nasměrovat více hostů na vlastní web místo na portály.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace",
            },
            {
              type: "p",
              text: "Rezervace přes vlastní web jsou pro váš provoz zpravidla levnější než přes portály, protože zde neplatíte provizi portálu. Několika cílenými opatřeními zvýšíte podíl přímých rezervací přes váš web jako samostatný kanál.",
            },
            {
              type: "steps",
              items: [
                "Zajistěte, aby všechny rezervovatelné objekty byly na webu viditelné a měly aktuální fotografie a popisy.",
                "Nastavte výhodu výhradní pro web, například mírnou slevu oproti portálům.",
                "Odkazujte na vlastní doménu v potvrzeních rezervací a v komunikaci s hosty, kteří již jednou rezervovali.",
                "Pravidelně kontrolujte statistiku rezervací, abyste sledovali podíl webu na všech rezervacích v čase.",
                "Optimalizujte dobu načítání a mobilní zobrazení webu, protože většina hostů rezervuje přes smartphone.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Výhoda výhradní pro web funguje jen tehdy, pokud hosté web vůbec najdou — aktivně na něj odkazujte, místo abyste se spoléhali jen na portály. Ke zveřejnění viz [Spuštění vaší webové stránky](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
