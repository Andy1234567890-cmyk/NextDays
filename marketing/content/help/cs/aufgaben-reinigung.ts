import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Úkoly a úklid",
  description: "Organizujte úklidové plány a týmové úkoly.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Provoz",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Vytváření úkolů",
          excerpt: "Jak vytvořit nový úkol pro objekt nebo období.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Úkoly sdružují vše, co je potřeba kolem objektu vyřídit — od úklidu po odjezdu hosta až po údržbové práce nebo požadavky hostů. Každý úkol je vázán přesně na jeden objekt a lze jej přiřadit členovi týmu.",
            },
            { type: "h2", text: "Vytvoření nového úkolu" },
            {
              type: "steps",
              items: [
                "Otevřete sekci „Úkoly“ v hlavním menu.",
                "Klikněte na „Nový úkol“.",
                "Vyberte dotčený objekt.",
                "Zadejte název a volitelně popis.",
                "Nastavte datum a čas splnění.",
                "Uložte úkol.",
              ],
            },
            { type: "h2", text: "Typy úkolů" },
            {
              type: "p",
              text: "Kromě volných úkolů existují úkoly generované systémem, například automaticky naplánovaný úklid po odjezdu hosta. Ty jsou již propojeny s objektem a vhodným časovým oknem a stačí je jen přiřadit členovi týmu.",
            },
            {
              type: "ul",
              items: [
                "Ruční úkol: volně zadaný, např. údržba nebo zvláštní přání.",
                "Automatický úklidový úkol: odvozený z data odjezdu.",
                "Opakující se úkol: pro pravidelné kontroly nebo inspekce.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Podrobnosti k automatickému plánování najdete v článku [Úklidové plány](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Zadávejte přesné názvy — členové týmu v mobilním zobrazení často vidí na první pohled jen název a objekt.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Úklidové plány",
          excerpt: "Nechte si automaticky naplánovat úklid po odjezdu hosta.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Úklidový plán zajistí, že po každém odjezdu hosta automaticky vznikne úklidový úkol pro dotčený objekt — aniž byste museli každou rezervaci sledovat jednotlivě. To snižuje počet zapomenutých předání a zajišťuje spolehlivý průběh mezi dvěma pobyty.",
            },
            { type: "h2", text: "Aktivace automatického plánování" },
            {
              type: "steps",
              items: [
                "Otevřete objekt a přepněte se do záložky „Úklid“.",
                "Aktivujte „Automaticky plánovat úklid po odjezdu“.",
                "Nastavte, kolik času po odjezdu se na úklid vyhradí.",
                "Volitelně určete výchozí tým nebo výchozí úklidovou sílu.",
                "Uložte nastavení.",
              ],
            },
            { type: "h2", text: "Souhra s kalendářem" },
            {
              type: "p",
              text: "Jakmile je rezervace zrušena nebo přesunuta, příslušný úklidový úkol se automaticky přizpůsobí novému datu odjezdu. Úklidový plán tak zůstává vždy synchronní se skutečným stavem obsazenosti.",
            },
            {
              type: "ul",
              items: [
                "Úklid vzniká automaticky při každém odjezdu s aktivním plánem.",
                "Přesune-li se rezervace, přesune se s ní i úklidový úkol.",
                "Zruší-li host pobyt, úklidový úkol se odstraní.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez aktivovaného úklidového plánu nevznikají žádné automatické úkoly — úklid pak vytvořte ručně v sekci [Vytváření úkolů](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Přiřazování úkolů",
          excerpt: "Cíleně přidělte úkoly úklidovým silám nebo členům týmu.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Aby byl úkol splněn, přiřadíte jej konkrétnímu členovi týmu — například úklidové síle nebo zaměstnanci odpovědnému za údržbu. Standardně úkol vidí ve své vlastní přehledu jen přiřazená osoba.",
            },
            { type: "h2", text: "Ruční přiřazení úkolu" },
            {
              type: "steps",
              items: [
                "Otevřete úkol v seznamu „Úkoly“.",
                "Klikněte na „Přiřadit“.",
                "Vyberte příslušného člena týmu ze seznamu.",
                "Potvrďte přiřazení.",
              ],
            },
            { type: "h2", text: "Přiřazení podle objektu" },
            {
              type: "p",
              text: "Je-li úklidové síle již pevně přiřazen objekt, můžete nechat úkoly pro tento objekt automaticky přiřazovat téže osobě. To u opakujících se úklidů šetří kliknutí a snižuje počet dotazů.",
            },
            {
              type: "ul",
              items: [
                "Ruční přiřazení: osobu si pro každý úkol vyberete sami.",
                "Pevné přiřazení k objektu: nové úkoly pro tento objekt jdou automaticky uložené osobě.",
                "Úkol má vždy přesně jednu odpovědnou osobu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Úklidové síly a zaměstnanci vidí výhradně své vlastní přiřazené úkoly, žádné finanční nebo obchodní údaje objektu.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Sledování stavu úkolů",
          excerpt: "Mějte v reálném čase přehled o stavu zpracování úkolů.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Každý úkol prochází jasným stavem — od otevřeného přes rozpracovaný až po dokončený. Máte tak vždy přehled, zda bude úklid nebo údržba hotová včas před příštím check-inem.",
            },
            { type: "h2", text: "Přehled stavů" },
            {
              type: "ul",
              items: [
                "Otevřený: úkol je vytvořen, ale ještě nezahájen.",
                "Rozpracovaný: přiřazená osoba úkol zahájila.",
                "Dokončený: úkol je splněn a potvrzen.",
              ],
            },
            { type: "h2", text: "Aktualizace stavu" },
            {
              type: "steps",
              items: [
                "Otevřete úkol ze seznamu „Úkoly“.",
                "Vyberte příslušný stav, např. „Rozpracovaný“ nebo „Dokončený“.",
                "V případě potřeby doplňte krátkou poznámku, například k nápadnostem v objektu.",
                "Uložte změnu.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Změny stavu se okamžitě zobrazí ve sdíleném seznamu úkolů — ruční obnovení není potřeba.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Je-li úklid krátce před dalším check-inem stále otevřený, nejprve zkontrolujte přiřazení, než kontaktujete hosta.",
            },
          ],
        },
      ],
    },
  ],
};
