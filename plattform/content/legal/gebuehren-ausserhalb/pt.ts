import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Encargos fora da plataforma",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "A presente política regula que montantes um fornecedor pode exigir fora da plataforma e quais não pode. Protege os hóspedes de serem confrontados no local com exigências que não constavam do anúncio.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Princípio",
      paragraphs: [
        "Tudo o que seja devido pelo serviço reservado tem de constar do anúncio antes da conclusão da reserva — como componente do preço total ou como rubrica de custos no local.",
        "Um montante que não constava nem do preço total nem dos custos no local não é devido pelo hóspede.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. O que pode ser exigido no local",
      paragraphs: ["No local só podem ser exigidos:"],
      list: [
        "montantes expressamente indicados no anúncio como custos no local (por exemplo, limpeza final, pacote de roupa de cama, lugar de estacionamento);",
        "tributos locais como a taxa turística, na medida em que as regras locais imponham o seu pagamento no local;",
        "uma caução indicada no anúncio;",
        "serviços que o hóspede contrate voluntariamente apenas no local, a um preço previamente comunicado;",
        "a reparação de danos comprovados causados pelo hóspede.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. O que não pode ser exigido",
      paragraphs: ["Não é admissível, em especial:"],
      list: [
        "um acréscimo ao preço da estada após a conclusão da reserva;",
        "um encargo pelo facto de a reserva ter sido feita através da myBestDays;",
        "encargos de processamento, de reserva ou de utilização de cartão não indicados no anúncio;",
        "o convite a cancelar a reserva e a reservar de novo o mesmo alojamento fora da plataforma;",
        "o convite a pagar o preço ou parte dele por transferência, em numerário ou através de um serviço de pagamento fora da plataforma, quando o anúncio prevê pagamento através da plataforma.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Contornar a plataforma",
      paragraphs: [
        "Se o contacto entre hóspede e fornecedor se estabeleceu através da plataforma, a reserva não pode ser processada fora dela. Tal vale para ambas as partes.",
        "Quem contorna a plataforma perde a sua proteção: os pagamentos não estão salvaguardados, as nossas políticas de cancelamento e reembolso não se aplicam e não podemos mediar em caso de litígio.",
        "As violações podem conduzir ao bloqueio da conta. Perante os fornecedores podemos ainda exigir a taxa de serviço perdida.",
      ],
    },
    {
      id: "melden",
      heading: "5. Comunicar",
      paragraphs: [
        "Se lhe for exigido no local um montante que não constava do anúncio, não o pague e comunique-nos através das vias de contacto indicadas em [Reclamações e resolução de litígios](https://mybestdays.dk/rechtliches/beschwerden). Se já pagou, ajudamo-lo a reavê-lo.",
      ],
    },
  ],
};
