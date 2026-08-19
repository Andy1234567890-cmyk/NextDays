import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Preços de aluguer",
  description: "Definir os preços de aluguer de forma ideal.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Preços de aluguer",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Otimizar os preços para a época alta",
          excerpt: "Como aumentar de forma direcionada os seus preços para períodos de grande procura.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial",
            },
            {
              type: "p",
              text: "Na época alta a procura aumenta claramente, enquanto o seu preço base mantém os mesmos valores que no resto do ano. Sem um ajuste sazonal, perde receita precisamente na época mais forte do ano — o ajuste é feito através do plano de tarifas do imóvel, e não substituindo manualmente dias individuais.",
            },
            {
              type: "steps",
              items: [
                "Abra o plano de tarifas do imóvel em causa e crie uma regra sazonal para o período pretendido.",
                "Defina o acréscimo como percentagem ou valor fixo acima do preço base — o plano de tarifas assume automaticamente a moeda do imóvel.",
                "Verifique no calendário se o novo preço é apresentado corretamente para o período de época alta antes de o ativar.",
                "Verifique a estadia mínima para a época alta — muitas vezes uma duração mínima de reserva mais elevada ajuda a manter a ocupação previsível.",
                "Após a ativação, acompanhe a situação das reservas nos primeiros dias e ajuste o acréscimo se necessário.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Uma regra sazonal aplica-se de forma transversal aos canais, nos portais, na plataforma e no site. Detalhes sobre a criação de regras em [Planos de tarifas](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Incentivar estadias mais longas com desconto",
          excerpt: "Como recompensar hóspedes com estadias mais longas e reduzir o esforço de troca.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial",
            },
            {
              type: "p",
              text: "Estadias curtas significam mais chegadas e partidas, mais limpezas e mais risco de vazio entre reservas. Um desconto escalonado por duração de estadia torna as reservas mais longas mais atrativas para os hóspedes e reduz esse esforço de forma notável.",
            },
            {
              type: "steps",
              items: [
                "Abra o plano de tarifas do imóvel e crie um desconto por duração de estadia.",
                "Defina pelo menos um escalão, por exemplo a partir de 7 noites ou a partir de 28 noites, com a respetiva taxa de desconto.",
                "Verifique se os escalões não se sobrepõem e se o desconto só se aplica a partir da respetiva duração mínima.",
                "Teste no calendário uma reserva de exemplo que ultrapasse o limite do desconto, para confirmar a aplicação correta.",
                "Ative o desconto e acompanhe o impacto na duração média de estadia e na ocupação.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Os descontos por duração de estadia podem ser combinados com regras sazonais — o plano de tarifas calcula ambos os ajustes em conjunto. Mais sobre isto em [Planos de tarifas](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
