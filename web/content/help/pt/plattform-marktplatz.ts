import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Plataforma (mercado)",
  description: "Vender no mercado myNextDays.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Mercado",
      articles: [
        {
          slug: "der-marktplatz",
          title: "O mercado myNextDays",
          excerpt: "O mercado global myNextDays é um canal de reserva próprio, ao lado dos portais e do site.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "O mercado myNextDays (/plattform) é o canal de reserva global do próprio myNextDays — comparável ao Booking ou ao Airbnb, mas fazendo parte da mesma plataforma. Os hóspedes pesquisam ali imóveis de todos os negócios associados e reservam diretamente.",
            },
            { type: "h2", text: "Não é “direto”, mas sim um canal ao mesmo nível" },
            {
              type: "p",
              text: "O mercado não substitui uma reserva direta através do seu próprio site. É um terceiro canal de vendas independente, com o seu próprio eixo de visibilidade, a sua própria base de hóspedes e a sua própria comissão — exatamente como um portal, apenas operado pelo próprio myNextDays.",
            },
            { type: "h2", text: "Como os imóveis chegam ao mercado" },
            {
              type: "ul",
              items: [
                "O imóvel tem de estar ativo (o estado do imóvel permite a venda).",
                "A visibilidade no mercado tem de estar ativada — separadamente dos portais e do site.",
                "Tem de existir disponibilidade no calendário para o período pretendido.",
              ],
            },
            { type: "h2", text: "Reservas provenientes do mercado" },
            {
              type: "p",
              text: "Uma reserva no mercado bloqueia de imediato as noites correspondentes em todos os outros canais — tal como uma reserva de portal ou de site. Aparece no seu calendário e nas reservas como qualquer outra reserva, assinalada com o canal “Plataforma”.",
            },
            {
              type: "note",
              variant: "info",
              text: "O bloqueio de vendas e um estado de imóvel inativo aplicam-se de forma transversal aos canais e também bloqueiam o mercado — independentemente do interruptor de visibilidade do mercado.",
            },
            {
              type: "p",
              text: "Como ativar um imóvel para o mercado, veja em [Listar um imóvel no mercado](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Listar um imóvel no mercado",
          excerpt: "A visibilidade no mercado é um interruptor próprio, separado dos portais e do site.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Controla a visibilidade no mercado através de um interruptor próprio no imóvel — independentemente de o mesmo imóvel também estar visível nos portais ou no seu site.",
            },
            { type: "h2", text: "Como listar um imóvel" },
            {
              type: "steps",
              items: [
                "Abra o imóvel em Imóveis.",
                "Mude para o separador Visibilidade.",
                "Ative o interruptor Mercado da plataforma.",
                "Verifique se o estado do imóvel está ativo e se existe disponibilidade no calendário.",
              ],
            },
            { type: "h2", text: "Requisito: perfil completo" },
            {
              type: "p",
              text: "O mercado só apresenta imóveis com dados completos — foto de capa, descrição, equipamento e preço base têm de estar registados. Se faltarem informações obrigatórias, o imóvel permanece invisível mesmo com o interruptor ativado.",
            },
            {
              type: "ul",
              items: [
                "Pelo menos uma foto de capa e uma descrição",
                "Características de equipamento da lista de categorias",
                "Ocupação e preço base na moeda registada do imóvel",
                "Disponibilidade no calendário para o período pretendido",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Ao clicar em Publicar, o myNextDays normalmente ativa em conjunto o mercado, os portais e o site — pode voltar a desativar o interruptor do mercado individualmente a qualquer momento depois disso.",
            },
            { type: "h2", text: "Remover a visibilidade" },
            {
              type: "p",
              text: "Se desativar o interruptor Mercado da plataforma, o imóvel desaparece da pesquisa do mercado. As reservas já confirmadas não são afetadas e continuam a decorrer normalmente, ver [Comissão do mercado](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Comissão do mercado",
          excerpt: "Para cada reserva mediada através do mercado é cobrada a comissão definida no plano.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Tal como em qualquer portal de reservas, é cobrada uma comissão para as reservas concretizadas através do mercado myNextDays. É calculada por reserva e é independente de eventuais comissões dos portais.",
            },
            { type: "h2", text: "Como a comissão é calculada" },
            {
              type: "p",
              text: "O valor rege-se pela comissão definida no plano do seu negócio. Pode consultar a taxa atual a qualquer momento em Conta, na área Faturação — não é assumido nenhum valor genérico, mas sim apresentada a taxa efetivamente aplicável ao seu plano.",
            },
            { type: "h2", text: "Onde consultar a comissão" },
            {
              type: "steps",
              items: [
                "Abra Conta no menu.",
                "Mude para a área Faturação.",
                "Abra uma reserva do mercado para ver a receita e a comissão em detalhe.",
                "Verifique a visão geral das comissões do período de faturação em curso.",
              ],
            },
            { type: "h2", text: "Distinção face às comissões de portal" },
            {
              type: "ul",
              items: [
                "A comissão do mercado aplica-se exclusivamente a reservas feitas através do mercado myNextDays.",
                "As reservas de portal (Booking, Airbnb e outros) estão sujeitas às condições do respetivo portal.",
                "As reservas do site estão sujeitas às condições definidas no seu plano, sem comissão de mercado.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A comissão é determinada automaticamente a partir do seu plano. Um plano em falta ou pouco claro resulta numa mensagem de erro clara, em vez de um valor estimado.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Perfil de hóspede e avaliações",
          excerpt: "Os hóspedes do mercado têm um perfil com histórico de reservas e podem deixar avaliações.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Os hóspedes que reservam através do mercado myNextDays criam um perfil de hóspede próprio. Nele reúnem-se as suas reservas, mensagens com negócios e avaliações feitas — de forma semelhante a uma conta de hóspede num portal.",
            },
            { type: "h2", text: "O que vê como negócio" },
            {
              type: "p",
              text: "Nos detalhes de uma reserva do mercado encontra o perfil do hóspede com as estadias anteriores no seu negócio e, caso o hóspede o tenha permitido, avaliações publicamente visíveis sobre outros alojamentos.",
            },
            { type: "h2", text: "Avaliações após a estadia" },
            {
              type: "steps",
              items: [
                "Após o check-out, o hóspede recebe um pedido para avaliar.",
                "A avaliação aparece na página do imóvel no mercado após uma breve verificação.",
                "Pode, como negócio, responder publicamente a cada avaliação.",
                "Pode submeter avaliações incorretas ou abusivas para verificação através de Denunciar.",
              ],
            },
            {
              type: "ul",
              items: [
                "As avaliações estão associadas a uma reserva real — sem estadia, não há avaliação.",
                "O hóspede avalia limpeza, comunicação, localização e relação qualidade-preço.",
                "A sua resposta é visível para todos os visitantes do mercado.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Boas avaliações têm impacto direto na posição do seu imóvel na pesquisa do mercado — reaja de forma célere e objetiva às críticas.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Pessoas bloqueadas",
          excerpt: "Um negócio pode bloquear um hóspede, impedindo mensagens e reservas.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Se surgirem problemas com um hóspede, pode bloqueá-lo enquanto negócio. Uma pessoa bloqueada deixa de conseguir enviar-lhe mensagens e de criar novas reservas no seu negócio.",
            },
            { type: "h2", text: "Bloquear uma pessoa" },
            {
              type: "steps",
              items: [
                "Abra o histórico de mensagens ou a reserva com o hóspede em causa.",
                "Clique em Bloquear hóspede.",
                "Confirme a caixa de diálogo — o bloqueio aplica-se de imediato.",
                "A pessoa bloqueada passa a aparecer em Conta, em Pessoas bloqueadas.",
              ],
            },
            { type: "h2", text: "O que o bloqueio provoca" },
            {
              type: "ul",
              items: [
                "O hóspede deixa de conseguir enviar novas mensagens ao seu negócio.",
                "O hóspede deixa de conseguir criar uma nova reserva no seu negócio.",
                "Uma reserva em curso com uma chegada já confirmada nas próximas duas semanas não é afetada pelo bloqueio, para que a estadia possa decorrer de forma organizada.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "O bloqueio aplica-se exclusivamente ao seu negócio. Outros negócios no mercado não veem o bloqueio e não são afetados por ele.",
            },
            { type: "h2", text: "Remover o bloqueio" },
            {
              type: "p",
              text: "Abra Conta e, aí, Pessoas bloqueadas. Selecione a entrada e clique em Remover bloqueio — o hóspede pode então voltar a enviar mensagens e a reservar.",
            },
          ],
        },
      ],
    },
  ],
};
