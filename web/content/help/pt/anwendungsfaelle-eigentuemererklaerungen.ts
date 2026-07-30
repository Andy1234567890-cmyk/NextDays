import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Extratos de proprietários",
  description: "Criar extratos de proprietários.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Extratos de proprietários",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Gerar um extrato de proprietário",
          excerpt: "Como criar para um proprietário um extrato claro do seu período.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial",
            },
            {
              type: "p",
              text: "Se gere imóveis para proprietários, estes precisam regularmente de uma visão compreensível das receitas, da comissão deduzida e do pagamento dos seus imóveis para um determinado período — o extrato do proprietário reúne automaticamente esses dados.",
            },
            {
              type: "steps",
              items: [
                "Abra a área Proprietários na conta e selecione o proprietário em causa.",
                "Escolha o período de faturação para o qual o extrato deve ser criado.",
                "Verifique se todos os imóveis desse proprietário estão corretamente associados, pois só os imóveis associados entram no extrato.",
                "Gere o extrato e verifique se as reservas apresentadas estão completas.",
                "Disponibilize o extrato ao proprietário através do acesso de proprietário ou exporte-o como documento.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "O extrato mostra cada reserva com o valor na respetiva moeda do imóvel — não existe uma indicação de moeda genérica, uma vez que vários imóveis também podem ter moedas diferentes. Mais sobre a associação em [Associar um imóvel a um proprietário](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Faturar a comissão com o proprietário",
          excerpt: "Como garantir que a sua comissão é calculada corretamente a partir das receitas do proprietário.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial",
            },
            {
              type: "p",
              text: "A sua comissão pela gestão de um imóvel está definida no plano do proprietário e é deduzida automaticamente das receitas brutas em cada extrato. Para que a faturação esteja correta, a taxa de comissão tem de estar definida corretamente antes da primeira reserva do período.",
            },
            {
              type: "steps",
              items: [
                "Abra na conta o plano do proprietário em causa e verifique a taxa de comissão definida.",
                "Ajuste a taxa se necessário, antes de entrarem novas reservas no próximo período de faturação.",
                "Gere o extrato do proprietário para o período e verifique se a comissão é apresentada corretamente por reserva.",
                "Verifique a plausibilidade da soma das receitas brutas, da comissão deduzida e do pagamento líquido.",
                "Esclareça divergências diretamente com o proprietário antes de aprovar o extrato, em vez de o alterar posteriormente.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Uma alteração posterior da taxa de comissão aplica-se apenas a períodos futuros, não retroativamente a extratos já gerados. Por isso, verifique a taxa atempadamente antes do início de um novo período de faturação — ver também [Faturação do proprietário (extrato)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
