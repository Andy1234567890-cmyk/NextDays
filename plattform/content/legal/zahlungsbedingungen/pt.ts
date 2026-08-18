import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Condições de pagamento",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "As presentes condições de pagamento regulam o processamento dos pagamentos relativos a uma reserva através da myBestDays. Complementam as [Condições de utilização para hóspedes](https://mybestdays.dk/rechtliches/nutzungsbedingungen); em caso de contradição em matéria de pagamentos prevalecem as presentes condições.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. O nosso papel no pagamento",
      paragraphs: [
        "A myBestDays processa pagamentos por conta do fornecedor. Não somos instituição de pagamento nem instituição de moeda eletrónica; o serviço de pagamento é prestado pelo nosso prestador de serviços de pagamento.",
        "Os pagamentos através da plataforma são processados pela Stripe (Stripe Payments Europe, Limited). Os dados de cartão e demais dados de pagamento são recolhidos e tratados diretamente pela Stripe. A myBestDays não conserva dados completos de cartões.",
        "Se pagar através da plataforma, a sua obrigação de pagamento perante o fornecedor considera-se cumprida no montante pago logo que o pagamento seja autorizado e cobrado com êxito pelo nosso prestador de serviços de pagamento.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Métodos de pagamento",
      paragraphs: [
        "Os métodos de pagamento disponíveis dependem do anúncio, do país do fornecedor e do seu país. Os métodos disponíveis são apresentados antes da conclusão da reserva.",
        "Para determinados métodos é exigida autenticação forte do cliente nos termos da Diretiva (UE) 2015/2366. Sem autenticação bem-sucedida o pagamento não pode ser executado.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Vencimento, sinal e remanescente",
      paragraphs: [
        "O momento de vencimento de cada montante é determinado pelo fornecedor no anúncio. São habituais três modelos: pagamento integral na reserva, sinal na reserva com remanescente antes da chegada, ou pagamento no local ao fornecedor.",
        "O modelo aplicável à sua reserva e as datas de vencimento são apresentados antes da conclusão da reserva e repetidos na confirmação.",
        "Antes do vencimento do remanescente enviamos um lembrete para o endereço de correio eletrónico indicado. Na falta de pagamento, o fornecedor pode resolver o contrato nos termos das suas condições de cancelamento.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Moeda",
      paragraphs: [
        "A liquidação é feita na moeda do anúncio. Essa moeda é indicada em cada preço e no processo de pagamento.",
        "Se um montante for adicionalmente apresentado noutra moeda, trata-se de uma conversão indicativa sem caráter vinculativo.",
        "Se o seu prestador de serviços de pagamento converter para outra moeda ou cobrar comissão de operação estrangeira, esses custos ficam a seu cargo. Não fazem parte do preço total e não são por nós fixados nem cobrados.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Caução",
      paragraphs: [
        "Se o anúncio previr uma caução, o seu montante é indicado antes da conclusão da reserva.",
        "Consoante o anúncio, a caução é pré-autorizada no seu meio de pagamento (o montante é reservado mas não debitado) ou cobrada. Uma pré-autorização pode reduzir temporariamente o plafond disponível do seu cartão.",
        "Após a estada, a pré-autorização é libertada ou a caução cobrada é reembolsada, salvo se o fornecedor invocar um dano. Nesse caso deve prová-lo; a procedência do pedido decide-se na relação entre si e o fornecedor.",
        "Se o fornecedor exigir a caução no local, trata-se de uma rubrica de custos no local e não é processada através da plataforma.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Reembolsos",
      paragraphs: [
        "Os reembolsos são efetuados no meio de pagamento utilizado, salvo acordo em contrário ou impossibilidade técnica.",
        "Iniciamos o reembolso sem demora logo que o seu fundamento esteja apurado. O tempo até o crédito surgir na sua conta ou no seu cartão é determinado pelo seu prestador de serviços de pagamento; são habituais cinco a dez dias úteis bancários.",
        "Se e em que medida existe direito a reembolso resulta das [Condições de cancelamento](https://mybestdays.dk/rechtliches/stornierungsbedingungen) e da [Política de realojamento e reembolso](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Pagamentos falhados e estornos",
      paragraphs: [
        "Se um pagamento falhar, informamo-lo e damos-lhe a possibilidade de indicar outro meio de pagamento. Na falta de pagamento, a reserva pode ser cancelada.",
        "Se estornar um pagamento já executado sem que exista direito a reembolso, o fornecedor pode continuar a exigir o montante. Os custos que nos advenham de um estorno injustificado podem ser-lhe faturados.",
        "Se considerarmos um pagamento fraudulento, podemos retê-lo ou cancelar a reserva. Informá-lo-emos e fundamentaremos a decisão.",
      ],
    },
    {
      id: "belege",
      heading: "8. Comprovativos e acertos",
      paragraphs: [
        "Para os montantes pagos através da plataforma disponibilizamos um comprovativo que pode consultar na sua conta, em «Reservas».",
        "A fatura do serviço de alojamento é emitida pelo fornecedor; é ele o profissional que presta o serviço. Quanto a impostos, ver a [Política fiscal](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Alteração das presentes condições de pagamento",
      paragraphs: [
        "Às alterações das presentes condições de pagamento aplica-se a secção A22 das [Condições de utilização](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen).",
      ],
    },
  ],
};
