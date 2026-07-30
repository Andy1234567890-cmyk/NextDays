import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Pagamentos e faturas",
  description: "Fornecedores de pagamento, regras de pagamento e faturas.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Pagamentos",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Ligar um fornecedor de pagamento",
          excerpt:
            "Como ligar o Stripe ou o PayPal ao myNextDays, para processar pagamentos automaticamente.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Fornecedores disponíveis" },
            {
              type: "p",
              text: "O myNextDays processa pagamentos através de fornecedores de pagamento ligados. Atualmente são suportados o Stripe e o PayPal — pode ligar um ou ambos os fornecedores em simultâneo e usá-los consoante o imóvel ou a preferência do hóspede.",
            },
            {
              type: "steps",
              items: [
                "Abra Conta e mude para a secção “Pagamentos”.",
                "Escolha o fornecedor pretendido — Stripe ou PayPal.",
                "Siga o diálogo de ligação e inicie sessão no fornecedor ou crie uma nova conta.",
                "Confirme a ligação — o estado muda para “ligado”.",
              ],
            },
            { type: "h2", text: "O que acontece a seguir" },
            {
              type: "p",
              text: "Assim que um fornecedor está ligado, pode enviar links de pagamento, cobrar sinais e iniciar reembolsos diretamente a partir da reserva. Todos os valores são processados na moeda registada para o respetivo imóvel.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Sem um fornecedor ligado, só pode marcar pagamentos manualmente como recebidos — não é possível uma cobrança automática.",
            },
            { type: "h2", text: "Vários imóveis, um fornecedor" },
            {
              type: "p",
              text: "Uma ligação estabelecida uma vez aplica-se a toda a conta, para todos os seus imóveis. Como decorre em detalhe a cobrança define-se em [Regras de pagamento](/hilfe/zahlungen/zahlungsregeln). Os pagamentos a si são depois feitos através do respetivo fornecedor, ver [Pagamentos a receber](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "O Stripe é indicado para pagamentos com cartão e muitos métodos de pagamento locais",
                "O PayPal oferece aos hóspedes uma alternativa familiar",
                "Ambos os fornecedores podem ser desligados e ligados de novo de forma independente",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Regras de pagamento",
          excerpt: "Defina quando o sinal e o pagamento final de uma reserva são devidos.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Sinal e pagamento final" },
            {
              type: "p",
              text: "As regras de pagamento determinam como uma reserva é processada financeiramente — por exemplo um sinal na reserva e um pagamento final antes da chegada, ou o pagamento total de imediato. As regras aplicam-se por imóvel e podem ser ajustadas a qualquer momento.",
            },
            {
              type: "steps",
              items: [
                "Abra o imóvel e mude para a secção “Regras de pagamento”.",
                "Escolha se é cobrado um sinal e defina a percentagem.",
                "Defina quando o pagamento final é devido, por exemplo um determinado número de dias antes da chegada.",
                "Guarde as configurações.",
              ],
            },
            { type: "h2", text: "Cobrança automática" },
            {
              type: "p",
              text: "Se houver um fornecedor de pagamento ligado, o myNextDays cobra automaticamente o sinal e o pagamento final na data definida e informa previamente o hóspede por mensagem.",
            },
            {
              type: "note",
              variant: "info",
              text: "As regras de pagamento só se aplicam a reservas com um fornecedor de pagamento ligado. Sem fornecedor, marca os pagamentos manualmente na reserva.",
            },
            { type: "h2", text: "Diferenças por canal" },
            {
              type: "p",
              text: "Nos portais pode aplicar-se, em alternativa, o processamento de pagamentos próprio deles — verifique nesse caso as respetivas condições do portal. Para reservas através da sua própria plataforma ou site, aplicam-se sempre as regras que definiu aqui. Detalhes sobre a ligação ao fornecedor em [Ligar um fornecedor de pagamento](/hilfe/zahlungen/zahlungsanbieter-verbinden), sobre a emissão de faturas em [Criar faturas](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Sinal como valor fixo ou percentagem possível",
                "Prazo do pagamento final livremente definível",
                "As alterações aplicam-se apenas a novas reservas, não retroativamente",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Criar faturas",
          excerpt: "Como criar uma fatura para uma reserva com a morada de faturação correta.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Criar uma fatura" },
            {
              type: "p",
              text: "Para cada reserva pode ser criada uma fatura — para o próprio hóspede ou para uma empresa diferente, caso a reserva seja de natureza empresarial.",
            },
            {
              type: "steps",
              items: [
                "Abra a reserva em Reservas.",
                "Escolha “Criar fatura”.",
                "Verifique ou complete a morada de faturação.",
                "Verifique as linhas listadas — estadia, complementos, taxas.",
                "Crie a fatura e envie-a ao hóspede.",
              ],
            },
            { type: "h2", text: "Gerir a morada de faturação" },
            {
              type: "p",
              text: "Pode registar a morada de faturação diretamente na reserva ou pedir ao hóspede que a complete através da confirmação da reserva. Sem uma morada completa, em determinados países não é possível emitir uma fatura legalmente válida.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Em clientes empresariais, verifique especialmente o nome da empresa e a morada — correções posteriores exigem uma nota de crédito.",
            },
            { type: "h2", text: "Valores e moeda" },
            {
              type: "p",
              text: "Todas as linhas são apresentadas na moeda registada do imóvel. Os pagamentos já efetuados são registados na fatura como entradas de pagamento. Como surgem o sinal e o pagamento final, veja em [Regras de pagamento](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "As faturas podem ser transferidas em PDF",
                "As notas de crédito são sempre possíveis em caso de alterações",
                "Os complementos aparecem como linha própria",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Reembolsos",
          excerpt:
            "Como reembolsar total ou parcialmente um pagamento quando uma reserva é cancelada ou alterada.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Quando um reembolso é necessário" },
            {
              type: "p",
              text: "Um reembolso surge tipicamente num cancelamento, mas também pode ser necessário numa alteração posterior do preço ou num complemento cancelado.",
            },
            {
              type: "steps",
              items: [
                "Abra a reserva em causa em Reservas.",
                "Escolha “Reembolso” na área de pagamentos da reserva.",
                "Indique o valor a reembolsar — total ou parcial.",
                "Confirme o reembolso.",
              ],
            },
            { type: "h2", text: "Processo através do fornecedor de pagamento" },
            {
              type: "p",
              text: "O reembolso é executado através do fornecedor usado no pagamento — Stripe ou PayPal — e devolvido diretamente ao método de pagamento original do hóspede. O processo é registado automaticamente na linha do tempo da reserva.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Sem um fornecedor de pagamento ligado, não é possível iniciar um reembolso automaticamente — nesse caso, resolva a devolução diretamente com o hóspede.",
            },
            { type: "h2", text: "Impacto nas comissões" },
            {
              type: "p",
              text: "As comissões de mercado ou de portal já faturadas são ajustadas proporcionalmente num reembolso. Mais sobre isto em [Compreender as comissões](/hilfe/zahlungen/provisionen-verstehen). Detalhes sobre o próprio cancelamento em [Cancelamento e reembolso](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "É possível fazer reembolsos parciais por linha individual",
                "O estado de processamento está sempre visível na reserva",
                "Os reembolsos são feitos exclusivamente através do fornecedor originalmente usado",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Pagamentos a receber",
          excerpt:
            "Como recebe os valores das suas reservas através dos fornecedores de pagamento ligados.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Como funcionam os pagamentos a receber" },
            {
              type: "p",
              text: "Os pagamentos recebidos acumulam-se primeiro no fornecedor de pagamento ligado. A partir daí, o pagamento é feito para a sua conta bancária registada, de acordo com o ritmo habitual do fornecedor.",
            },
            {
              type: "steps",
              items: [
                "Abra Conta e mude para a secção “Pagamentos”.",
                "Verifique em “Pagamentos a receber” o estado do respetivo fornecedor.",
                "Se necessário, abra a vista detalhada do fornecedor para o histórico completo de pagamentos.",
              ],
            },
            { type: "h2", text: "O que é deduzido antes do pagamento" },
            {
              type: "p",
              text: "Antes do pagamento, são consideradas as comissões de mercado e de portal aplicáveis, bem como as taxas do fornecedor. O valor pago não corresponde, por isso, necessariamente ao valor original da reserva.",
            },
            {
              type: "note",
              variant: "info",
              text: "A estrutura exata das deduções é explicada em [Compreender as comissões](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Vários imóveis e proprietários" },
            {
              type: "p",
              text: "Se gerir imóveis para diferentes proprietários, os pagamentos são associados de acordo com as faturações de proprietário registadas. Em caso de divergências, verifique primeiro o estado das reservas subjacentes em Reservas.",
            },
            {
              type: "ul",
              items: [
                "O ritmo e o método de pagamento são determinados pelo respetivo fornecedor",
                "Os valores retidos, por exemplo em reembolsos em curso, estão assinalados",
                "O histórico completo está disponível para consulta diretamente junto do fornecedor",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Compreender as comissões",
          excerpt:
            "Uma visão geral de como se compõem as comissões de mercado e de portal, e onde são faturadas.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Dois tipos de comissões" },
            {
              type: "p",
              text: "Nas reservas através do myNextDays podem surgir dois tipos diferentes de comissões: a comissão de mercado, para reservas feitas através da própria plataforma, e as comissões de portal, para reservas recebidas através de portais ligados como o Booking ou o Airbnb. Ambas são independentes entre si e podem variar consoante a via de venda de uma reserva.",
            },
            {
              type: "ul",
              items: [
                "Comissão de mercado: aplica-se a reservas feitas através da plataforma myNextDays",
                "Comissão de portal: é calculada pelo respetivo portal, de acordo com as suas próprias condições",
                "As reservas diretas através do seu próprio site devem ser vistas de forma independente",
              ],
            },
            { type: "h2", text: "Onde as comissões são visíveis" },
            {
              type: "steps",
              items: [
                "Abra Conta e mude para a secção “Faturação”.",
                "Escolha o mês pretendido.",
                "Verifique a listagem por reserva, com a respetiva comissão.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "O canal por onde uma reserva entrou é visível diretamente na própria reserva — isso explica qual a comissão aplicada em cada caso.",
            },
            { type: "h2", text: "Relação com os pagamentos a receber" },
            {
              type: "p",
              text: "As comissões são deduzidas do valor da reserva antes do pagamento. Detalhes sobre o processo de pagamento em [Pagamentos a receber](/hilfe/zahlungen/auszahlungen). Num reembolso, a respetiva comissão é corrigida proporcionalmente — o processo completo de uma reserva é mostrado na [linha do tempo da reserva](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
