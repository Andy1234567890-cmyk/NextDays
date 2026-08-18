import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Política de não discriminação",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "myBestDays está aberta a todos. Quem reserva ou oferece através da plataforma não pode tratar ninguém de forma menos favorável em razão de características pessoais.",
    "A presente política faz parte das [Condições de utilização](https://mybestdays.dk/rechtliches/nutzungsbedingungen) e aplica-se tanto a hóspedes como a fornecedores.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Princípio",
      paragraphs: [
        "Na myBestDays não é admissível desfavorecer uma pessoa em razão da origem, cor da pele, nacionalidade, pertença étnica, religião ou convicções, sexo, identidade de género, orientação sexual, deficiência, idade ou estado civil.",
        "Tal vale para a aceitação ou recusa de reservas, para preços e condições, para o trato durante a estada e para a comunicação através da plataforma.",
        "Aplica-se ainda o artigo 20.º do Regulamento (UE) 2018/302: os fornecedores não podem restringir o acesso à sua oferta em razão da nacionalidade, do local de residência ou do local de estabelecimento de um hóspede na União.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. O que isto significa para os fornecedores",
      paragraphs: ["Enquanto fornecedor não pode, em especial:"],
      list: [
        "recusar um pedido de reserva em razão de alguma das características indicadas;",
        "exigir preços, cauções ou condições diferentes a hóspedes por apresentarem uma dessas características;",
        "declarar no anúncio ou em mensagens que determinados grupos de pessoas são indesejados;",
        "recusar cães de assistência ou cães-guia, ainda que as suas regras da casa excluam animais;",
        "tratar de forma diferente um hóspede em razão da sua residência noutro Estado-Membro da União.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. O que continua a ser permitido",
      paragraphs: [
        "Pode fixar a ocupação máxima, uma idade mínima para quem efetua a reserva principal e regras da casa objetivas (por exemplo, proibição de fumar ou horas de silêncio), desde que se apliquem de igual modo a todos os hóspedes.",
        "Se habitar o alojamento e partilhar espaços com o hóspede, pode indicá-lo claramente no anúncio; as características da secção 1 não justificam, ainda assim, uma recusa.",
        "Pode recusar uma reserva quando existam indícios concretos de violação das regras da casa ou de fraude. O motivo tem de respeitar ao comportamento, não à pessoa.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Acessibilidade",
      paragraphs: [
        "As indicações sobre a acessibilidade de um alojamento têm de corresponder à realidade. Descrever como acessível um alojamento que o não é constitui igualmente violação das [Regras sobre conteúdos adequados](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
        "Quando uma adaptação seja possível sem esforço desproporcionado, esperamos que os fornecedores a realizem.",
      ],
    },
    {
      id: "melden",
      heading: "5. Comunicar discriminação",
      paragraphs: [
        "Se sofreu ou observou discriminação, comunique-nos através da função de comunicação ou das vias de contacto indicadas em [Reclamações e resolução de litígios](https://mybestdays.dk/rechtliches/beschwerden).",
        "Analisamos cada comunicação. Confirmada uma violação, adotamos medidas até ao bloqueio permanente da conta. Se por esse motivo lhe foi recusada uma reserva, ajudamo-lo a encontrar um alojamento comparável.",
      ],
    },
  ],
};
