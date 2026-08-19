import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Pagamentos",
  description: "Processar pagamentos corretamente.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Pagamentos",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Configurar um sinal",
          excerpt: "Como cobrar na reserva apenas uma parte do valor em vez do valor total.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial",
            },
            {
              type: "p",
              text: "Em vez de cobrar de imediato o valor total da reserva, pode definir um sinal como regra de pagamento. O hóspede paga na reserva apenas uma parte do valor via Stripe ou PayPal, e o restante mais tarde através de um pagamento final.",
            },
            {
              type: "steps",
              items: [
                "Abra no imóvel a área “Regras de pagamento”.",
                "Crie uma nova regra do tipo “Sinal”.",
                "Defina o valor do sinal como percentagem ou valor fixo do total.",
                "Defina quando o sinal é devido, normalmente logo no momento da reserva.",
                "Guarde a regra e verifique-a com uma reserva de teste.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "O sinal é processado através do fornecedor de pagamento associado ao imóvel. Configure o valor correspondente ao valor restante em [Automatizar o pagamento final](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Automatizar o pagamento final",
          excerpt: "Como o valor restante em aberto é cobrado automaticamente antes da chegada.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial",
            },
            {
              type: "p",
              text: "Depois de um sinal, fica um valor restante em aberto. Em vez de o acompanhar manualmente, configure uma regra de pagamento que cobra automaticamente o pagamento final numa data fixa antes da chegada, via Stripe ou PayPal.",
            },
            {
              type: "steps",
              items: [
                "Abra no imóvel a área “Regras de pagamento”.",
                "Crie uma nova regra do tipo “Pagamento final”, desde que já exista uma regra de sinal.",
                "Defina quantos dias antes da chegada o pagamento final é devido.",
                "Ative a cobrança automática, para que o fornecedor de pagamento associado debite o valor de forma autónoma.",
                "Verifique depois o estado do pagamento final na linha do tempo da respetiva reserva.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Se a cobrança automática falhar, por exemplo devido a um cartão expirado, a reserva não é cancelada automaticamente. Verifique atempadamente pagamentos finais falhados e contacte diretamente o hóspede.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Efetuar um reembolso",
          excerpt: "Como reembolsar um hóspede, total ou parcialmente, de um valor pago.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial",
            },
            {
              type: "p",
              text: "Em caso de cancelamento ou reclamação, pode reembolsar um hóspede, total ou parcialmente, do valor pago. O reembolso é processado através do mesmo fornecedor de pagamento usado originalmente — Stripe ou PayPal.",
            },
            {
              type: "steps",
              items: [
                "Abra a reserva em causa na linha do tempo da reserva.",
                "Na área “Pagamentos”, selecione o pagamento original que deve ser reembolsado.",
                "Escolha entre reembolso total ou parcial.",
                "No caso de um reembolso parcial, indique o valor pretendido.",
                "Confirme o reembolso e verifique o estado de pagamento atualizado na linha do tempo.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Um reembolso não altera automaticamente o estado da reserva nem as noites de calendário ocupadas. Em caso de cancelamento, verifique também se as noites em causa precisam de ser libertadas novamente no mapa de ocupação.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Gerir uma caução",
          excerpt: "Como configurar uma caução e libertá-la novamente após a estadia.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial",
            },
            {
              type: "p",
              text: "Uma caução protege-o contra danos durante a estadia. É configurada como uma regra de pagamento própria e, através do Stripe ou do PayPal, é pré-autorizada ou cobrada, consoante a configuração do imóvel.",
            },
            {
              type: "steps",
              items: [
                "Abra no imóvel a área “Regras de pagamento” e crie uma regra do tipo “Caução”.",
                "Defina o valor da caução e o momento da autorização, normalmente pouco antes da chegada.",
                "Após o check-out, verifique o estado do imóvel.",
                "Se o estado estiver correto, liberte a caução totalmente através da reserva.",
                "Em caso de dano, reembolse apenas a parte que não é necessária e documente o motivo da retenção.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Uma caução autorizada mas não cobrada expira automaticamente após um determinado prazo, consoante o fornecedor de pagamento. Liberte a caução pouco depois do check-out ou cobre atempadamente o valor necessário.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Corrigir uma fatura",
          excerpt: "Como corrigir posteriormente uma fatura já emitida.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial",
            },
            {
              type: "p",
              text: "Se uma fatura já emitida contiver um erro, por exemplo na morada de faturação ou numa linha, corrija-a através da reserva, em vez de simplesmente eliminar a fatura original.",
            },
            {
              type: "steps",
              items: [
                "Abra a reserva em causa na linha do tempo da reserva e mude para a área “Faturas”.",
                "Selecione a fatura com o erro.",
                "Crie uma correção ou nota de crédito relativa à fatura original.",
                "Depois, crie uma nova fatura corrigida com os dados corretos.",
                "Envie novamente a fatura corrigida ao hóspede ou à morada de faturação.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Por razões de rastreabilidade, uma fatura já enviada não deve ser substituída diretamente. A correção através de uma nota de crédito mantém o documento original e torna a alteração rastreável.",
            },
          ],
        },
      ],
    },
  ],
};
