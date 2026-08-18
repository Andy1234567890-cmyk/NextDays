import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Taxas de serviço",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "A myBestDays financia-se através de uma taxa de serviço sobre as reservas intermediadas. A presente página explica quem a paga, como é calculada e onde é indicada.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Quem paga a taxa de serviço",
      paragraphs: [
        "A taxa de serviço é suportada pelo fornecedor. É retida sobre o valor da reserva e reduz o pagamento que lhe é devido; o hóspede não a paga adicionalmente.",
        "Se, excecionalmente, for devida uma taxa de serviço pelo hóspede numa reserva, indicamo-la como rubrica autónoma do preço total antes da conclusão da reserva. Sem essa indicação o hóspede não suporta qualquer taxa.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Como é calculada",
      paragraphs: [
        "A taxa de serviço corresponde a uma percentagem do valor da reserva liquidado através da plataforma. A percentagem aplicável às suas reservas consta da sua conta de anfitrião e do acordo que aceitou no registo.",
        "A base de cálculo é o preço da estada acrescido dos suplementos liquidados através da plataforma. Não se incluem as rubricas de mero trânsito que não constituam contraprestação do fornecedor — em especial a taxa turística e a caução.",
        "A taxa de serviço é calculada e indicada na moeda do anúncio.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. IVA",
      paragraphs: [
        "Sobre a taxa de serviço incide IVA na medida em que seja legalmente devido. Se é discriminado ou se se aplica a autoliquidação depende da sede e do estatuto do fornecedor.",
        "Emitimos ao fornecedor um acerto da taxa de serviço, consultável na sua conta.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Cancelamento e reembolso",
      paragraphs: [
        "Se uma reserva for integralmente reembolsada, reembolsamos a taxa de serviço proporcionalmente ao valor da reserva reembolsado.",
        "Se o fornecedor cancelar sem motivo relevante, a taxa de serviço não caduca automaticamente; reservamo-nos o direito de exigir os custos decorrentes do cancelamento.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Alteração da taxa de serviço",
      paragraphs: [
        "Anunciamos aos fornecedores qualquer alteração da percentagem com, pelo menos, 30 dias de antecedência relativamente à sua entrada em vigor, em suporte duradouro; tal corresponde ao artigo 3.º, n.º 2, do Regulamento (UE) 2019/1150.",
        "Às reservas já confirmadas aplica-se a percentagem em vigor no momento da reserva.",
      ],
    },
  ],
};
