import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Ceny nájmu",
  description: "Optimální nastavení cen nájmu.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Ceny nájmu",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Optimalizace cen pro hlavní sezónu",
          excerpt: "Jak cíleně zvýšit ceny pro období se silnou poptávkou.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace",
            },
            {
              type: "p",
              text: "V hlavní sezóně poptávka výrazně roste, zatímco vaše základní cena zůstává stejná jako po zbytek roku. Bez sezónní úpravy přicházíte v nejsilnějším období roku o tržby — úprava se provádí přes cenový plán objektu, ne ručním přepisováním jednotlivých dnů.",
            },
            {
              type: "steps",
              items: [
                "Otevřete cenový plán daného objektu a vytvořte sezónní pravidlo pro požadované období.",
                "Nastavte přirážku jako procentní hodnotu nebo pevnou částku nad základní cenou — cenový plán automaticky převezme měnu objektu.",
                "V kalendáři zkontrolujte, že se nová cena pro období hlavní sezóny zobrazuje správně, než ji aktivujete.",
                "Zkontrolujte minimální délku pobytu pro hlavní sezónu — často je smysluplná vyšší minimální doba rezervace, aby byla obsazenost lépe plánovatelná.",
                "Po aktivaci sledujte stav rezervací během prvních dní a v případě potřeby přirážku upravte.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Sezónní pravidlo působí napříč kanály stejně na portálech, platformě i webu. Podrobnosti k nastavení pravidel najdete v článku [Cenové plány](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Podpora delších pobytů pomocí slevy",
          excerpt: "Jak odměnit hosty za delší pobyt a snížit náročnost střídání hostů.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace",
            },
            {
              type: "p",
              text: "Krátké pobyty znamenají více příjezdů a odjezdů, více úklidů a vyšší riziko neobsazenosti mezi rezervacemi. Odstupňovaná sleva za délku pobytu činí delší rezervace pro hosty atraktivnější a citelně snižuje tuto zátěž.",
            },
            {
              type: "steps",
              items: [
                "Otevřete cenový plán objektu a vytvořte slevu za délku pobytu.",
                "Definujte alespoň jeden stupeň, například od 7 nocí nebo od 28 nocí, s příslušnou výší slevy.",
                "Zkontrolujte, že se jednotlivé stupně nepřekrývají a sleva platí až od příslušné minimální délky pobytu.",
                "V kalendáři otestujte vzorovou rezervaci přesahující hranici slevy, abyste potvrdili její správné uplatnění.",
                "Aktivujte slevu a sledujte její dopad na průměrnou délku pobytu a obsazenost.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Slevy za délku pobytu lze kombinovat se sezónními pravidly — cenový plán obě úpravy vypočítá společně. Více k tomu v článku [Cenové plány](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
