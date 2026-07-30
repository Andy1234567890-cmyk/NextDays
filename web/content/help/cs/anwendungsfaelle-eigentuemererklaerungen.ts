import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Vyúčtování vlastníků",
  description: "Vytváření vyúčtování pro vlastníky.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Vyúčtování vlastníků",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Vytvoření vyúčtování pro vlastníka",
          excerpt: "Jak pro vlastníka vytvořit přehledné vyúčtování za jeho období.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace",
            },
            {
              type: "p",
              text: "Pokud spravujete objekty pro vlastníky, ti pravidelně potřebují srozumitelný přehled příjmů, odečtené provize a výplaty za své objekty za určité období — vyúčtování vlastníka tyto údaje automaticky shrne.",
            },
            {
              type: "steps",
              items: [
                "V účtu otevřete oblast Vlastníci a vyberte příslušného vlastníka.",
                "Vyberte zúčtovací období, za které se má vyúčtování vytvořit.",
                "Zkontrolujte, že jsou všechny objekty tohoto vlastníka správně přiřazeny, protože do vyúčtování vstupují jen přiřazené objekty.",
                "Nechte vyúčtování vytvořit a zkontrolujte úplnost uvedených rezervací.",
                "Zpřístupněte vyúčtování vlastníkovi přes jeho přístup, nebo ho exportujte jako dokument.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vyúčtování zobrazuje každou rezervaci s částkou v příslušné měně objektu — neexistuje žádné paušální označení měny, protože jednotlivé objekty mohou mít i různé měny. Více o přiřazování v článku [Přiřazení objektu vlastníkovi](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Vyúčtování provize s vlastníkem",
          excerpt: "Jak zajistíte, aby se vaše provize správně počítala z příjmů vlastníka.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace",
            },
            {
              type: "p",
              text: "Vaše provize za správu objektu je uložena v tarifu vlastníka a při každém vyúčtování se automaticky odečítá z hrubých příjmů. Aby vyúčtování sedělo, musí být sazba provize správně nastavena ještě před první rezervací v daném období.",
            },
            {
              type: "steps",
              items: [
                "V účtu otevřete tarif příslušného vlastníka a zkontrolujte uloženou sazbu provize.",
                "V případě potřeby sazbu upravte ještě před tím, než v nadcházejícím zúčtovacím období přibudou nové rezervace.",
                "Vytvořte vyúčtování vlastníka za dané období a zkontrolujte, že je provize u jednotlivých rezervací správně vykázána.",
                "Ověřte věrohodnost součtu hrubých příjmů, odečtené provize a čisté výplaty.",
                "Případné odchylky vyjasněte přímo s vlastníkem před schválením vyúčtování, místo abyste vyúčtování dodatečně měnili.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dodatečná změna sazby provize se projeví jen na budoucích obdobích, nikoli zpětně na již vytvořených vyúčtováních. Sazbu proto zkontrolujte včas před začátkem nového zúčtovacího období — viz také [Vyúčtování vlastníka (výpis)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
