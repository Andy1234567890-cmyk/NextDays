import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Standardy ochrany osobních údajů pro hostitele",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "Nabízíte-li prostřednictvím myBestDays, obdržíte osobní údaje svých hostů. Za jejich zpracování jste samostatným správcem ve smyslu nařízení (EU) 2016/679 (GDPR). Tyto standardy popisují, co od vás očekáváme.",
  ],
  sections: [
    {
      id: "zweckbindung",
      heading: "1. Účelové omezení",
      paragraphs: [
        "Údaje hostů používáte výhradně k provedení rezervace, ke komunikaci s hostem a ke splnění svých zákonných povinností (například přihlašovací lístek, pobytový poplatek, daňové a archivační povinnosti).",
        "Jakékoli další využití — zejména reklama, newslettery, předání třetím osobám, zařazení do vlastní databáze hostů pro pozdější přímé rezervace — vyžaduje vlastní právní základ, zpravidla souhlas hosta.",
        "Údaje hostů nepoužíváte k tomu, abyste hosta přiměli rezervovat mimo platformu.",
      ],
    },
    {
      id: "datensparsamkeit",
      heading: "2. Minimalizace údajů",
      paragraphs: [
        "Shromažďujete pouze údaje, které skutečně potřebujete. Kopie dokladů totožnosti vyžadujete jen tehdy, pokud to vyžaduje právní předpis, a uchováváte je jen po dobu, kterou předpis stanoví.",
        "Platební údaje nepožadujete. Platby probíhají přes platformu.",
      ],
    },
    {
      id: "sicherheit",
      heading: "3. Bezpečnost",
      paragraphs: [
        "Údaje hostů chráníte přiměřenými technickými a organizačními opatřeními — přístup jen pro osoby, které údaje potřebují, chráněná zařízení, šifrovaný přenos.",
        "Využíváte-li zaměstnance, úklidový personál nebo spoluhostitele, zavážete je k mlčenlivosti a poskytnete jim jen údaje potřebné k jejich úkolu.",
      ],
    },
    {
      id: "loeschung",
      heading: "4. Uchovávání a výmaz",
      paragraphs: [
        "Údaje hostů vymažete, jakmile účel odpadne a nepřetrvává povinnost uchovávání.",
        "Přihlašovací lístky a daňově relevantní doklady uchováváte tak dlouho, jak to předepisuje právo vaší země — ne déle.",
      ],
    },
    {
      id: "rechte",
      heading: "5. Práva hostů",
      paragraphs: [
        "Obrátí-li se na vás host s žádostí o přístup, opravu, výmaz nebo s námitkou, vyřídíte ji ve lhůtě. Týká-li se údajů, které máme my, odkážete ho na nás.",
        "Své hosty informujete o tom, jak jejich údaje zpracováváte, pokud jdete nad rámec provedení rezervace.",
      ],
    },
    {
      id: "vorfall",
      heading: "6. Porušení zabezpečení údajů",
      paragraphs: [
        "Dojde-li k porušení zabezpečení údajů hostů, neprodleně informujete příslušný dozorový úřad a, je-li to nutné, dotčené hosty.",
        "Týká-li se porušení údajů, které jste obdrželi přes platformu, informujete navíc nás, abychom mohli posoudit vlastní povinnosti.",
      ],
    },
    {
      id: "kameras",
      heading: "7. Kamery a záznamová zařízení",
      paragraphs: [
        "Ve vnitřních prostorách s oprávněným očekáváním soukromí — ložnice, koupelny — nejsou kamery a mikrofony přípustné, ani vypnuté.",
        "Všechna ostatní kamerová zařízení, pohybová čidla se záznamem, zvonky s kamerou a zvukové senzory uvádíte v inzerátu s uvedením umístění a toho, co se zaznamenává.",
      ],
    },
    {
      id: "folgen",
      heading: "8. Následky porušení",
      paragraphs: [
        "Porušení těchto standardů posuzujeme jako porušení [Doplňujících podmínek pro hostitele](https://mybestdays.dk/rechtliches/gastgeber-bedingungen) a můžeme přijmout opatření až po zablokování účtu.",
      ],
    },
  ],
};
