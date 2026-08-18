import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zásady nediskriminace",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "myBestDays je otevřená všem. Kdo prostřednictvím platformy rezervuje nebo nabízí, nesmí nikoho znevýhodňovat z důvodu osobních vlastností.",
    "Tyto zásady jsou součástí [Podmínek použití](https://mybestdays.dk/rechtliches/nutzungsbedingungen) a platí pro hosty i poskytovatele.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Zásada",
      paragraphs: [
        "Na myBestDays je nepřípustné znevýhodňovat osobu z důvodu původu, barvy pleti, státní příslušnosti, etnické příslušnosti, náboženství či světového názoru, pohlaví, genderové identity, sexuální orientace, zdravotního postižení, věku nebo rodinného stavu.",
        "To platí pro přijetí či odmítnutí rezervací, pro ceny a podmínky, pro jednání během pobytu a pro komunikaci přes platformu.",
        "Navíc platí článek 20 nařízení (EU) 2018/302: poskytovatelé nesmějí omezovat přístup ke své nabídce z důvodu státní příslušnosti, bydliště nebo místa usazení hosta v Unii.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. Co to znamená pro poskytovatele",
      paragraphs: ["Jako poskytovatel nesmíte zejména:"],
      list: [
        "odmítnout rezervační poptávku z důvodu některé z uvedených vlastností;",
        "požadovat od hostů odlišné ceny, kauce nebo podmínky proto, že splňují některou z těchto vlastností;",
        "v inzerátu nebo ve zprávách uvádět, že určité skupiny osob jsou nežádoucí;",
        "odmítat asistenční nebo vodicí psy, i když váš domovní řád zvířata vylučuje;",
        "zacházet s hostem odlišně z důvodu jeho bydliště v jiném členském státě Unie.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. Co zůstává dovoleno",
      paragraphs: [
        "Můžete stanovit maximální obsazenost, minimální věk hlavního objednatele a věcná pravidla domovního řádu (například zákaz kouření nebo doby nočního klidu), pokud platí stejně pro všechny hosty.",
        "Bydlíte-li v ubytování sami a sdílíte prostory s hostem, můžete to v inzerátu jasně uvést; vlastnosti podle oddílu 1 přesto odmítnutí neospravedlňují.",
        "Rezervaci můžete odmítnout, existují-li konkrétní indicie porušení domovního řádu nebo podvodu. Důvod se musí vztahovat k jednání, nikoli k osobě.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Přístupnost",
      paragraphs: [
        "Údaje o přístupnosti ubytování musí odpovídat skutečnosti. Popsat jako bezbariérové ubytování, které takové není, je zároveň porušením [Pravidel pro vhodný obsah](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
        "Je-li úprava možná bez nepřiměřených nákladů, očekáváme, že ji poskytovatelé provedou.",
      ],
    },
    {
      id: "melden",
      heading: "5. Nahlásit diskriminaci",
      paragraphs: [
        "Zažili-li jste nebo pozorovali diskriminaci, nahlaste nám ji funkcí hlášení nebo kontaktními cestami uvedenými pod [Stížnosti a řešení sporů](https://mybestdays.dk/rechtliches/beschwerden).",
        "Každé hlášení prověříme. Potvrdí-li se porušení, přijmeme opatření až po trvalé zablokování účtu. Byla-li vám z tohoto důvodu rezervace odepřena, pomůžeme vám najít srovnatelné ubytování.",
      ],
    },
  ],
};
