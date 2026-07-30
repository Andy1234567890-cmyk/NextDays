import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Hyrespriser",
  description: "Fastställ hyrespriser optimalt.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Hyrespriser",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Optimera priser för högsäsongen",
          excerpt: "Så höjer du dina priser målinriktat för perioder med stark efterfrågan.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge",
            },
            {
              type: "p",
              text: "Under högsäsongen ökar efterfrågan betydligt, medan ditt grundpris ligger på samma nivå som under resten av året. Utan säsongsanpassning går du miste om intäkter under årets starkaste period — anpassningen görs via objektets rateplan, inte genom att manuellt skriva över enskilda dagar.",
            },
            {
              type: "steps",
              items: [
                "Öppna rateplanen för det berörda objektet och skapa en säsongsregel för önskad period.",
                "Ange tillägget som en procentsats eller ett fast belopp över grundpriset — rateplanen använder automatiskt objektets valuta.",
                "Kontrollera i kalendern att det nya priset visas korrekt för högsäsongsperioden innan du aktiverar det.",
                "Kontrollera minsta vistelse för högsäsongen — ofta är en högre minsta bokningslängd lämplig för att hålla beläggningen planerbar.",
                "Följ upp bokningsläget under de första dagarna efter aktiveringen och justera tillägget vid behov.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "En säsongsregel gäller kanalövergripande på portaler, plattformen och webbplatsen likvärdigt. Detaljer om hur reglerna byggs upp hittar du under [Rateplaner](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Främja längre vistelser med rabatt",
          excerpt: "Så belönar du gäster med längre vistelselängd och minskar bytesarbetet.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge",
            },
            {
              type: "p",
              text: "Korta vistelser innebär fler ankomster och avresor, fler städningar och större risk för tomma perioder mellan bokningar. En stegvis vistelserabatt gör längre bokningar mer attraktiva för gäster och minskar detta arbete märkbart.",
            },
            {
              type: "steps",
              items: [
                "Öppna objektets rateplan och skapa en vistelserabatt.",
                "Definiera minst en nivå, till exempel från 7 nätter eller från 28 nätter, med respektive rabattsats.",
                "Kontrollera att nivåerna inte överlappar och att rabatten bara gäller från respektive minsta vistelselängd.",
                "Testa en exempelbokning över rabattgränsen i kalendern för att bekräfta att den tillämpas korrekt.",
                "Aktivera rabatten och följ upp hur den påverkar genomsnittlig vistelselängd och beläggning.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vistelserabatter kan kombineras med säsongsregler — rateplanen beräknar båda anpassningarna tillsammans. Mer om det under [Rateplaner](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
