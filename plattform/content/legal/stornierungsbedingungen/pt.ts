import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Condições de cancelamento",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "Cada fornecedor escolhe uma condição de cancelamento para o seu alojamento. Qual se aplica consta do anúncio e da sua confirmação de reserva. A presente página descreve as condições que disponibilizamos aos fornecedores.",
  ],
  sections: [
    {
      id: "modelle",
      heading: "1. As condições de cancelamento em resumo",
      paragraphs: [
        "Prevalece sempre a condição indicada no anúncio. Os prazos reportam-se ao início do dia de chegada na hora local do alojamento.",
      ],
      list: [
        "Flexível — cancelamento gratuito até 24 horas antes da chegada. Depois é cobrada a primeira noite e as restantes são reembolsadas.",
        "Moderada — cancelamento gratuito até 5 dias antes da chegada. Depois são cobrados 50 % do preço da estada.",
        "Rigorosa — cancelamento gratuito até 14 dias antes da chegada, desde que a reserva tenha sido feita pelo menos 14 dias antes. Depois são cobrados 50 % até 7 dias antes da chegada e, a partir daí, a totalidade do preço.",
        "Não reembolsável — sem cancelamento gratuito. O preço é em regra mais baixo; alertamos especialmente para a ausência de reembolso antes da reserva.",
      ],
    },
    {
      id: "was-erstattet-wird",
      heading: "2. O que é reembolsado em qualquer caso",
      paragraphs: [
        "Independentemente da condição escolhida, em qualquer cancelamento reembolsamos:",
      ],
      list: [
        "a taxa turística e demais tributos de mero trânsito, na medida em que tenham sido liquidados através da plataforma e a dormida não se realize;",
        "integralmente uma caução cobrada através da plataforma;",
        "os serviços adicionais não prestados.",
      ],
    },
    {
      id: "stornierung-durch-anbieter",
      heading: "3. Cancelamento pelo fornecedor",
      paragraphs: [
        "Se o fornecedor cancelar, recebe integralmente o montante pago através da plataforma — independentemente da condição de cancelamento escolhida.",
        "Ajudamo-lo ainda a encontrar um alojamento comparável; ver [Política de realojamento e reembolso](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "widerruf",
      heading: "4. Inexistência de direito legal de livre resolução",
      paragraphs: [
        "Nas prestações de alojamento reservadas por um período determinado não existe, em regra, direito legal de livre resolução nos termos do artigo 16.º, alínea l), da Diretiva 2011/83/UE. As condições de cancelamento aqui descritas são, por isso, um compromisso contratual e não a concretização de um direito de livre resolução.",
        "Os direitos legais imperativos, em especial os direitos por defeitos do alojamento, não são afetados.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Alteração em vez de cancelamento",
      paragraphs: [
        "Se pretender alterar o período ou o número de viajantes, solicite a alteração a partir da sua reserva. O fornecedor tem de concordar; até lá mantém-se a reserva original.",
        "Se a alteração conduzir a um preço superior, a diferença torna-se exigível. Se conduzir a um preço inferior, reembolsamos a diferença na medida em que a condição de cancelamento aplicável o permita para a parte que deixa de existir.",
      ],
    },
    {
      id: "wie",
      heading: "6. Como cancelar",
      paragraphs: [
        "Cancele a partir da sua conta, em «Reservas». Para o prazo é determinante o momento em que o cancelamento nos chega.",
        "Recebe uma confirmação de cancelamento com o montante do reembolso. Quanto ao pagamento, ver as [Condições de pagamento](https://mybestdays.dk/rechtliches/zahlungsbedingungen#rueckerstattungen).",
      ],
    },
  ],
};
