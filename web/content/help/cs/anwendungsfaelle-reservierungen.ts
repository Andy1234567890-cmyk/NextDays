import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Rezervace a kalendář",
  description: "Udržte si přehled nad rezervacemi a kalendářem.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Rezervace a kalendář",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Spolehlivé předcházení přebookování",
          excerpt: "Jak zajistíte, aby objekt nikdy nebyl rezervován dvakrát.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace",
            },
            {
              type: "p",
              text: "Objekt se prodává současně přes několik kanálů — portály jako Booking, Airbnb a další, vlastní platformu i aplikaci. Přebookování vzniká, když se dostupnost na jednom kanálu nezablokuje včas poté, co proběhla rezervace na jiném kanálu.",
            },
            {
              type: "steps",
              items: [
                "V obsazenostním kalendáři zkontrolujte, že každý objekt je přesně jeden řádek s jednou rezervovatelnou jednotkou — žádná společná kapacita více pokojů.",
                "Nové rezervace zadávejte výhradně přes obsazenostní kalendář nebo napojené kanály, nikdy ručním popisováním jednotlivých dní.",
                "Po každé rezervaci zkontrolujte, že se rezervované noci v kalendáři okamžitě zobrazí jako obsazené.",
                "Při technických problémech nebo údržbě ihned použijte Stop-Sell, místo abyste den nechali otevřený.",
                "Při nejasnostech zkontrolujte časovou osu příslušné rezervace, abyste pochopili časový průběh.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Nikdy neměňte noci ani blokace ručně mimo obsazenostní kalendář — jen tak zůstane zajištěno, že všechny kanály vidí stejný stav dostupnosti a nevznikne mezera pro dvojitou rezervaci.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Přesun rezervace do jiného objektu",
          excerpt: "Jak čistě přesunout stávající rezervaci na jiný objekt.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace",
            },
            {
              type: "p",
              text: "Někdy musí host přejít z jednoho objektu do jiného, například kvůli technické poruše nebo na přání hosta. Při přesunu se dosavadní noci v kalendáři automaticky uvolní a v cílovém objektu se znovu obsadí.",
            },
            {
              type: "steps",
              items: [
                "Otevřete danou rezervaci v časové ose rezervace.",
                "V nabídce akcí vyberte „Změnit objekt“, resp. „Přesunout“.",
                "Vyberte cílový objekt a zkontrolujte jeho dostupnost ve zvoleném období.",
                "Potvrďte přesun.",
                "Poté v obsazenostním kalendáři zkontrolujte, že se staré noci v původním objektu opět zobrazují jako dostupné.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Uvolnění starých nocí zajišťuje systém automaticky — původní období nemusíte sami ručně otevírat. Informujte hosta o změně objektu, zejména pokud se liší vybavení nebo přístup.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Vytvoření dlouhodobé rezervace",
          excerpt: "Jak správně vytvořit rezervaci na delší období.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace",
            },
            {
              type: "p",
              text: "Pro dlouhodobé hosty — například na několik týdnů nebo měsíců — vytvoříte rezervaci jako obvykle, ale navíc dbáte na minimální délku pobytu, platební pravidla a viditelnost objektu na kanálech po celé dané období.",
            },
            {
              type: "steps",
              items: [
                "Otevřete obsazenostní kalendář požadovaného objektu a označte celé období.",
                "Vytvořte rezervaci s údaji hosta a plánovaným datem příjezdu a odjezdu.",
                "V případě potřeby nastavte platební pravidlo se zálohou a doplatkem, místo aby byla celá částka splatná okamžitě.",
                "Zkontrolujte, že dlouhému období neodporuje žádné pravidlo minimální nebo maximální délky pobytu.",
                "Uložte rezervaci a zkontrolujte, že se celé období v kalendáři správně zobrazuje jako obsazené.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Při velmi dlouhých pobytech se doporučuje doplatek rozdělit do více částek místo jedné velké splatnosti — platební riziko tak zůstane přehledné. Podrobnosti v článku [Automatizace doplatku](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
