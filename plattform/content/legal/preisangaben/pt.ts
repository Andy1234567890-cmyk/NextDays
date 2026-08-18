import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Preços, ordenação e recomendações",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "A presente página explica como são apresentados os preços na myBestDays, o que determina a ordem dos resultados de pesquisa e como surgem as recomendações. Cumpre os deveres de transparência decorrentes do artigo 6.º-A da Diretiva 2005/29/CE, do artigo 5.º do Regulamento (UE) 2019/1150 e do artigo 27.º do Regulamento (UE) 2022/2065.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Como são apresentados os preços",
      paragraphs: [
        "Logo que o período e o número de viajantes estejam definidos, apresentamos o preço total de toda a estada, incluindo impostos e todas as taxas liquidadas através da plataforma.",
        "Enquanto não estiver escolhido um período, apresentamos um preço por noite a título indicativo e assinalamo-lo como tal.",
        "Os custos devidos apenas no local são indicados separadamente antes da conclusão da reserva. Não integram o preço total, mas são visíveis antes da reserva.",
        "Quando apresentamos um preço de comparação riscado, trata-se do preço mais baixo praticado pelo fornecedor para o mesmo serviço nos 30 dias anteriores à redução (artigo 6.º-A da Diretiva 98/6/CE).",
        "Os preços são iguais para todos os hóspedes. Não adaptamos o preço à sua pessoa, ao seu dispositivo ou ao seu histórico de pesquisa.",
      ],
    },
    {
      id: "ranking",
      heading: "2. O que determina a ordem dos resultados de pesquisa",
      paragraphs: [
        "Na ordenação predefinida, os seguintes fatores determinam a ordem, por importância decrescente:",
      ],
      list: [
        "a correspondência com a sua pesquisa — disponibilidade no período procurado, capacidade para o número de viajantes, localização na área procurada e filtros aplicados;",
        "a integralidade e a qualidade do anúncio — descrição, fotografias, dados de equipamento mantidos;",
        "as avaliações — classificação global e número de avaliações;",
        "a fiabilidade do fornecedor — tempo de resposta, taxa de aceitação e cancelamentos da sua parte;",
        "a atualidade de preços e disponibilidade;",
        "a relação qualidade-preço face a anúncios semelhantes na mesma área.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Colocação paga",
      paragraphs: [
        "Um fornecedor não pode comprar uma posição melhor na ordenação predefinida. O valor da taxa de serviço não influencia a ordem.",
        "Se no futuro passarmos a oferecer colocações pagas, identificá-las-emos inequivocamente como publicidade e separá-las-emos visivelmente dos restantes resultados.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Alterar a ordenação",
      paragraphs: [
        "Pode alterar a ordenação a qualquer momento, por exemplo por preço ou por avaliação. A ordenação ativa é indicada por cima da lista de resultados.",
        "Dispõe de, pelo menos, uma ordenação que não assenta em definição de perfis na aceção do artigo 4.º, ponto 4, do Regulamento (UE) 2016/679.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Recomendações",
      paragraphs: [
        "Quando lhe apresentamos sugestões («pode interessar-lhe», «alojamentos semelhantes»), estas assentam na pesquisa atual, em anúncios consultados anteriormente e em características de alojamentos semelhantes.",
        "Pode desativar as recomendações personalizadas na sua conta. Verá então sugestões baseadas exclusivamente na pesquisa atual.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. As avaliações na ordenação",
      paragraphs: [
        "Como surgem e são verificadas as avaliações consta da [Política de avaliações](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). As avaliações influem na ordem, mas não ponderamos mais determinadas avaliações nem suprimimos as negativas.",
      ],
    },
  ],
};
