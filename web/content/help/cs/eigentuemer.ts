import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Vlastníci a vyúčtování",
  description: "Vlastnické účty, vyúčtování a provize.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Vlastníci",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Založení vlastníka",
          excerpt: "Jak založit nový vlastnický účet v myNextDays.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Vlastníci jsou samostatné účty v myNextDays, přes které spravujete objekty patřící konkrétní osobě nebo společnosti. Vlastnický účet získá omezený náhled pouze pro čtení do vlastních objektů, aniž by mohl sám měnit nastavení provozu.",
            },
            { type: "h2", text: "Založení nového vlastnického účtu" },
            {
              type: "steps",
              items: [
                "Otevřete oblast „Vlastníci“ v hlavní nabídce.",
                "Klikněte na „Založit nového vlastníka“.",
                "Zadejte jméno, e-mailovou adresu a kontaktní údaje.",
                "V případě potřeby uveďte fakturační adresu pro vyúčtování.",
                "Účet uložte.",
              ],
            },
            { type: "h2", text: "Nastavení přístupu" },
            {
              type: "p",
              text: "Po založení můžete vlastníkovi odeslat pozvánku k vlastnímu přístupu. Vlastník se poté přihlásí vlastními přihlašovacími údaji a vidí výhradně jemu přiřazené objekty.",
            },
            {
              type: "ul",
              items: [
                "Vlastnický účet může zahrnovat více objektů.",
                "Každý objekt patří přesně jednomu vlastníkovi.",
                "Kontaktní údaje a fakturační adresu lze kdykoli dodatečně upravit.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jak přiřadit existující objekt vlastníkovi, se dozvíte v článku [Přiřazení objektu vlastníkovi](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Přiřazení objektu vlastníkovi",
          excerpt: "Každý objekt patří přesně jednomu vlastníkovi — takto nastavíte přiřazení.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "V myNextDays patří každý objekt přesně jednomu vlastníkovi. Vícenásobné přiřazení není možné — pokud má objekt patřit jinému vlastníkovi, nejprve zrušte stávající přiřazení a teprve poté nastavte nové.",
            },
            { type: "h2", text: "Provedení přiřazení" },
            {
              type: "steps",
              items: [
                "Otevřete objekt v sekci „Objekty“.",
                "Přepněte na záložku „Vlastník“.",
                "Vyberte příslušného vlastníka ze seznamu.",
                "Přiřazení potvrďte.",
                "Uložte změnu u objektu.",
              ],
            },
            { type: "h2", text: "Změna vlastníka" },
            {
              type: "p",
              text: "Pokud se vlastník objektu změní, například kvůli prodeji, nahraďte stávající přiřazení novým. Již vytvořená vyúčtování za minulá období zůstávají přiřazena původnímu vlastníkovi.",
            },
            {
              type: "ul",
              items: [
                "Objekt může být v daném okamžiku přiřazen pouze jednomu vlastníkovi.",
                "Bez přiřazení se objekt nezobrazí v žádném vlastnickém přístupu.",
                "Minulá vyúčtování zůstávají zachována u původního vlastníka.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Vícenásobné přiřazení objektu více vlastníkům je vyloučeno — systém druhé souběžné přiřazení nepovolí.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Vyúčtování vlastníka (výpis)",
          excerpt: "Jak vytvořit výpis s příjmy sníženými o provizi pro vlastníka.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Vyúčtování vlastníka, nazývané také výpis, shrnuje za zvolené období všechny příjmy z přiřazených objektů a odečítá vaši dohodnutou provizi. Výsledkem je částka, kterou vlastníkovi vyplatíte.",
            },
            { type: "h2", text: "Vytvoření výpisu" },
            {
              type: "steps",
              items: [
                "Otevřete oblast „Vlastníci“ a vyberte požadovaného vlastníka.",
                "Přepněte na záložku „Vyúčtování“.",
                "Vyberte období vyúčtování.",
                "Zkontrolujte uvedené rezervace a příjmy za jednotlivé objekty.",
                "Nechte vytvořit výpis se sníženou provizí.",
              ],
            },
            { type: "h2", text: "Struktura výpisu" },
            {
              type: "p",
              text: "Výpis uvádí za jednotlivé objekty hrubé příjmy z rezervací, z nich odečtenou provizi a výsledný vyplácený obnos. Vedlejší náklady, jako je úklid nebo poplatky, mohou být podle dohody vykázány samostatně.",
            },
            {
              type: "ul",
              items: [
                "Hrubé příjmy: součet všech rezervací za dané období u objektu.",
                "Provize: váš dohodnutý podíl, odečítá se z příjmů.",
                "Vyplácený obnos: příjmy snížené o provizi a případně další položky.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Částky ve výpisu jsou vždy uváděny v měně objektu — neexistuje žádná paušální výchozí měna.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Vytvářejte výpisy pravidelně ke stejnému datu, aby vlastníci měli spolehlivý rytmus svých výplat.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Přístup vlastníka",
          excerpt: "Co vlastníci vidí ve svém přístupu pouze pro čtení.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Přístup vlastníka je samostatné přihlášení do myNextDays pouze pro čtení. Vlastníci v něm vidí výhradně jim přiřazené objekty a k nim náležející obsazenost a vyúčtování — bez možnosti sami měnit nastavení.",
            },
            { type: "h2", text: "Co vlastníci vidí" },
            {
              type: "ul",
              items: [
                "Kalendář obsazenosti svých vlastních objektů.",
                "Vytvořené výpisy s příjmy a odečtenou provizí.",
                "Základní údaje svých objektů, například vybavení a popis.",
              ],
            },
            { type: "h2", text: "Aktivace přístupu" },
            {
              type: "steps",
              items: [
                "Otevřete vlastníka v sekci „Vlastníci“.",
                "Klikněte na „Pozvat k přístupu“.",
                "Vlastník obdrží e-mail k nastavení vlastního hesla.",
                "Po přihlášení vlastník automaticky vidí pouze jemu přiřazené objekty.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Přístup vlastníka je striktně pouze pro čtení: ceny, dostupnost nebo údaje o objektu může měnit pouze vy jako provozovatel, nikoli sám vlastník.",
            },
            {
              type: "note",
              variant: "info",
              text: "Více o přiřazování objektů najdete v článku [Přiřazení objektu vlastníkovi](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
