import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Lejepriser",
  description: "Sæt lejepriserne optimalt.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Lejepriser",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Optimér priserne til højsæsonen",
          excerpt: "Sådan hæver du dine priser målrettet i perioder med stor efterspørgsel.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt",
            },
            {
              type: "p",
              text: "I højsæsonen stiger efterspørgslen markant, mens din grundpris følger de samme værdier som resten af året. Uden en sæsonmæssig tilpasning går du glip af omsætning i årets stærkeste periode — tilpasningen sker via boligens rateplan, ikke ved manuelt at overskrive enkelte dage.",
            },
            {
              type: "steps",
              items: [
                "Åbn rateplanen for den pågældende bolig, og opret en sæsonregel for den ønskede periode.",
                "Angiv tillægget som en procentsats eller et fast beløb oven på grundprisen — rateplanen overtager automatisk boligens valuta.",
                "Kontrollér i kalenderen, at den nye pris for højsæson-perioden vises korrekt, før du aktiverer den.",
                "Kontrollér minimumsopholdet for højsæsonen — ofte giver det mening med et længere minimumsophold for at holde belægningen forudsigelig.",
                "Følg bookingniveauet de første dage efter aktivering, og juster tillægget efter behov.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "En sæsonregel virker på tværs af kanaler — på portaler, Platform og hjemmeside samtidig. Du kan læse mere om opsætning af regler under [Rateplaner](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Fremme længere ophold med rabat",
          excerpt: "Sådan belønner du gæster med længere opholdstid og reducerer skifte-arbejdet.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt",
            },
            {
              type: "p",
              text: "Korte ophold betyder flere ankomster og afrejser, mere rengøring og større risiko for tomgang mellem reservationer. En trinvis opholdsrabat gør længere bookinger mere attraktive for gæster og reducerer denne belastning mærkbart.",
            },
            {
              type: "steps",
              items: [
                "Åbn boligens rateplan, og opret en opholdsrabat.",
                "Definér mindst ét trin, for eksempel fra 7 nætter eller fra 28 nætter, med den tilhørende rabatsats.",
                "Kontrollér, at trinene ikke overlapper, og at rabatten kun gælder fra den pågældende minimumsvarighed.",
                "Test en eksempelbooking i kalenderen på tværs af rabatgrænsen for at bekræfte, at den anvendes korrekt.",
                "Aktivér rabatten, og følg dens effekt på den gennemsnitlige opholdstid og belægning.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Opholdsrabatter kan kombineres med sæsonregler — rateplanen beregner begge tilpasninger samlet. Læs mere under [Rateplaner](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
