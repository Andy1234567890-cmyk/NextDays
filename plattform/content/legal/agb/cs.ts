import type { LegalDoc } from "../types";

// Tschechische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. Zielgruppe sind Verbraucher (Gäste).
export const agb: LegalDoc = {
  title: "Podmínky užívání pro hosty (VOP)",
  stand: "Stav ke dni: 3. července 2026",
  intro: [
    "Tyto podmínky užívání upravují užívání rezervačního portálu myNextDays (dále jen „platforma“) cestujícími a objednateli (dále jen „host“).",
    "Provozovatelem platformy je [úplný název společnosti, právní forma, adresa a údaje o zápisu provozovatele do rejstříku — doplnit před zveřejněním] (dále jen „myNextDays“ nebo „my“).",
  ],
  sections: [
    {
      heading: "§ 1 Oblast působnosti",
      paragraphs: [
        "Tyto podmínky se vztahují na užívání platformy, zejména na vyhledávání ubytování a rezervaci ubytovacích služeb prostřednictvím platformy.",
        "Pro samotnou ubytovací službu platí doplňkově podmínky příslušného poskytovatele (např. domovní řád, storno podmínky), které jsou uvedeny v nabídce.",
      ],
    },
    {
      heading: "§ 2 Role myNextDays; uzavření smlouvy",
      paragraphs: [
        "myNextDays zprostředkovává ubytovací služby, které nabízejí příslušní poskytovatelé (agentury, pronajímatelé nebo vlastníci, dále jen „poskytovatel“). Smlouva o ubytování se uzavírá výhradně mezi hostem a příslušným poskytovatelem. myNextDays se nestává smluvní stranou smlouvy o ubytování.",
        "Příslušný poskytovatel je uveden v nabídce a v potvrzení rezervace.",
      ],
    },
    {
      heading: "§ 3 Rezervace a potvrzení rezervace",
      paragraphs: [
        "Prezentace ubytování na platformě je výzvou k podání rezervační nabídky. Dokončením rezervačního procesu (kliknutím na rezervační tlačítko zavazující k platbě) činí host závaznou nabídku na uzavření smlouvy o ubytování s poskytovatelem.",
        "Smlouva je uzavřena okamžikem potvrzení rezervace. Potvrzení rezervace je hostovi zasláno na uvedenou e-mailovou adresu.",
        "Host je povinen při rezervaci uvést správné a úplné údaje (zejména jméno, kontaktní údaje a počet cestujících).",
      ],
    },
    {
      heading: "§ 4 Ceny a platba",
      paragraphs: [
        "Platí ceny uvedené v nabídce v okamžiku rezervace včetně tam uvedených daní, poplatků a dodatečných nákladů. Ceny se zobrazují v měně uvedené v nabídce. Na místě mohou být účtovány další místní poplatky (např. pobytový poplatek), pokud je to uvedeno v nabídce.",
        "Platba je zpracovávána prostřednictvím poskytovatele platebních služeb Stripe. Platební údaje (např. údaje o platební kartě) shromažďuje a zpracovává přímo Stripe; myNextDays neukládá úplné údaje o platebních kartách. Stripe zpracovává osobní údaje v souladu se [zásadami ochrany osobních údajů společnosti Stripe](https://stripe.com/privacy).",
        "Je-li v nabídce uvedena kauce, může být při rezervaci nebo při příjezdu předautorizována a v případě škody zcela nebo zčásti zadržena; rozhodující jsou údaje uvedené v nabídce.",
      ],
    },
    {
      heading: "§ 5 Storno, změna rezervace a odstoupení od smlouvy",
      paragraphs: [
        "Zda a za jakých podmínek lze rezervaci bezplatně stornovat nebo změnit, se řídí storno podmínkami poskytovatele uvedenými v nabídce.",
        "U ubytovacích služeb rezervovaných na určité období zpravidla neexistuje zákonné právo na odstoupení od smlouvy podle čl. 16 písm. l) směrnice EU o právech spotřebitelů, resp. odpovídajících vnitrostátních předpisů. Kogentní zákonná práva hosta zůstávají nedotčena.",
      ],
    },
    {
      heading: "§ 6 Povinnosti hosta",
      paragraphs: [
        "Host užívá ubytování v souladu se smlouvou, dodržuje maximální obsazenost uvedenou v nabídce a řídí se domovním řádem poskytovatele.",
        "Platformu není dovoleno zneužívat, zejména ne k fiktivním rezervacím, podvodným platbám nebo vkládání protiprávního obsahu (např. v recenzích nebo zprávách).",
      ],
    },
    {
      heading: "§ 7 Odpovědnost myNextDays",
      paragraphs: [
        "Za poskytnutí ubytovací služby odpovídá výhradně poskytovatel. myNextDays neodpovídá za správnost obsahu nabídek vloženého poskytovateli, zprostředkování a zpracování plateb však provádí s péčí řádného hospodáře.",
        "myNextDays odpovídá neomezeně za úmysl a hrubou nedbalost, jakož i za škody způsobené újmou na životě, těle nebo zdraví. V případě prosté nedbalosti odpovídá myNextDays pouze za porušení podstatných smluvních povinností (kardinálních povinností), a to v rozsahu omezeném na předvídatelnou škodu typickou pro daný typ smlouvy. Kogentní zákonná pravidla odpovědnosti zůstávají nedotčena.",
      ],
    },
    {
      heading: "§ 8 Ochrana osobních údajů",
      paragraphs: [
        "myNextDays zpracovává osobní údaje hosta za účelem provedení zprostředkování a rezervace. Rezervační údaje jsou předávány příslušnému poskytovateli v rozsahu nezbytném pro plnění smlouvy o ubytování. Pro zpracování plateb platí § 4.",
        "Podrobnosti vyplývají z informací o ochraně osobních údajů platformy.",
      ],
    },
    {
      heading: "§ 9 Stížnosti a řešení sporů",
      paragraphs: [
        "Reklamace týkající se ubytování směřuje host nejprve na poskytovatele; s dotazy k rezervaci nebo platbě pomůže podpora myNextDays prostřednictvím kontaktních kanálů uvedených na platformě.",
        "myNextDays není povinna ani ochotna účastnit se řízení o řešení sporů před subjektem mimosoudního řešení spotřebitelských sporů, ledaže taková povinnost vyplývá ze zákona.",
      ],
    },
    {
      heading: "§ 10 Změny těchto podmínek",
      paragraphs: [
        "myNextDays může tyto podmínky měnit s účinností do budoucna, pokud je to nezbytné ze závažných důvodů (zejména kvůli změnám právních předpisů nebo změnám judikatury) a host tím není nepřiměřeně znevýhodněn. Pro již uzavřené rezervace platí znění účinné v okamžiku rezervace.",
      ],
    },
    {
      heading: "§ 11 Závěrečná ustanovení",
      paragraphs: [
        "Použije se právo státu, v němž má provozovatel své sídlo, s vyloučením Úmluvy OSN o smlouvách o mezinárodní koupi zboží. Je-li host spotřebitelem, zůstávají nedotčeny kogentní předpisy na ochranu spotřebitele státu, v němž má host své obvyklé bydliště.",
        "Budou-li jednotlivá ustanovení těchto podmínek neplatná nebo se neplatnými stanou, není tím dotčena platnost ostatních ustanovení.",
      ],
    },
  ],
};
