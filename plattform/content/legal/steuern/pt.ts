import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Política fiscal",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "A presente página explica que impostos e tributos podem surgir numa reserva através da myBestDays, quem é o devedor e que deveres de comunicação nos incumbem enquanto operador de plataforma.",
    "Não constitui aconselhamento fiscal. Para a sua situação fiscal concreta dirija-se a um consultor fiscal.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. O que respeita aos hóspedes",
      paragraphs: [
        "O preço total apresentado inclui os impostos liquidados através da plataforma — em especial o IVA sobre a prestação de alojamento, na medida em que o fornecedor o deva.",
        "Os tributos locais como taxa turística, imposto de dormida ou taxa de turismo são, consoante o município, liquidados através da plataforma ou cobrados no local. Indicamos qual o caso aplicável antes da conclusão da reserva.",
        "A fatura da prestação de alojamento é emitida pelo fornecedor; é ele o profissional que presta o serviço. Se necessitar de fatura com IVA discriminado, solicite-a ao fornecedor.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. O que respeita aos fornecedores",
      paragraphs: [
        "Os fornecedores são responsáveis pelo correto tratamento fiscal dos seus rendimentos — imposto sobre o rendimento das pessoas singulares ou coletivas, IVA e tributos locais.",
        "Se um arrendamento está sujeito a IVA e a que taxa resulta do direito do Estado em que o alojamento se situa (lugar da prestação nos imóveis).",
        "Os fornecedores inscrevem no imóvel os tributos aplicáveis ao seu alojamento, para que sejam corretamente indicados no anúncio.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Comunicação às autoridades fiscais (DAC7)",
      paragraphs: [
        "Enquanto operador de uma plataforma digital estamos obrigados, nos termos da Diretiva (UE) 2021/514 («DAC7») e das disposições nacionais de transposição, a comunicar anualmente à autoridade fiscal competente dados sobre os fornecedores sujeitos a comunicação e sobre as contrapartidas obtidas através da plataforma.",
        "São comunicados, em especial, nome, morada, número de identificação fiscal, data de nascimento ou número de registo, dados da conta de pagamento, morada do alojamento, bem como as contrapartidas pagas por trimestre e as taxas retidas.",
        "Os fornecedores recebem cópia dos dados comunicados que lhes respeitam.",
        "Se um fornecedor não facultar os dados necessários à comunicação apesar de duas interpelações, ficamos obrigados a reter os pagamentos e a bloquear a conta.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Retenções",
      paragraphs: [
        "Se o direito de um Estado nos obrigar a reter e entregar imposto sobre um pagamento, fazemo-lo e indicamos a retenção no acerto.",
      ],
    },
  ],
};
