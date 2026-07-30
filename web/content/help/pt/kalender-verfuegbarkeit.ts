import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Calendário e disponibilidade",
  description: "Mapa de ocupação, bloqueio de vendas e estadia mínima.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Calendário",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Ler o mapa de ocupação",
          excerpt: "Como ler corretamente reservas, disponibilidade e preços no mapa de ocupação.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "O mapa de ocupação mostra-lhe, num relance, que noites estão reservadas, disponíveis ou bloqueadas. Em alojamentos de férias vê uma linha por imóvel; em hotéis, uma vista aninhada com uma linha por categoria de quarto e plano de tarifas.",
            },
            { type: "h2", text: "Estrutura da vista" },
            {
              type: "steps",
              items: [
                "Abra o calendário através do item de menu “Mapa de ocupação”.",
                "Escolha em cima o período que pretende consultar.",
                "Se necessário, filtre por imóveis ou categorias de quarto individuais.",
                "Clique num dia para abrir os detalhes de preço e disponibilidade.",
                "Clique num período ocupado para abrir a reserva correspondente.",
              ],
            },
            { type: "h2", text: "Cores e símbolos" },
            {
              type: "ul",
              items: [
                "Ocupado: o período está reservado por uma reserva.",
                "Disponível: o dia pode ser reservado em todos os canais ativos.",
                "Bloqueado: o dia não pode ser reservado devido a bloqueio de vendas ou a um bloqueio manual.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Cada linha no mapa de ocupação representa exatamente uma unidade reservável — um quarto ou um alojamento de férias. Não existe uma linha-contentor para vários quartos em simultâneo.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Mais sobre como abrir e fechar dias individuais de forma direcionada em [Definir disponibilidade](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Definir disponibilidade",
          excerpt: "Abrir e fechar de forma direcionada dias ou períodos individuais.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "A disponibilidade determina se um imóvel pode ser reservado num determinado dia. Pode abrir ou fechar dias individuais ou períodos inteiros diretamente no mapa de ocupação.",
            },
            { type: "h2", text: "Editar um período" },
            {
              type: "steps",
              items: [
                "Abra o mapa de ocupação do imóvel pretendido.",
                "Marque o período pretendido clicando e arrastando.",
                "No menu de ações, selecione “Alterar disponibilidade”.",
                "Confirme se o período deve ser aberto ou fechado.",
                "Guarde a alteração.",
              ],
            },
            { type: "h2", text: "Impacto nos canais" },
            {
              type: "p",
              text: "Uma alteração de disponibilidade afeta todos os canais de vendas em que o imóvel está visível: portais como Booking, Airbnb e outros, a plataforma própria e a app. A transmissão aos portais é feita automaticamente em segundo plano.",
            },
            {
              type: "ul",
              items: [
                "Abrir: o dia torna-se reservável em todos os canais ativos.",
                "Fechar: o dia deixa de estar disponível para reserva, mas continua visível no calendário.",
                "As reservas já existentes não são afetadas por uma alteração de disponibilidade.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Não feche um período com a intenção de o bloquear por completo e de forma permanente para venda — para isso, a função correta é o bloqueio de vendas, ver [Bloqueio de vendas](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Bloqueio de vendas",
          excerpt: "O bloqueio de vendas bloqueia de imediato um dia em todos os canais de vendas ao mesmo tempo.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "O bloqueio de vendas é a forma mais rápida de retirar por completo um único dia da venda. Ao contrário de uma simples alteração de disponibilidade, o bloqueio de vendas atua de forma rígida e imediata em todos os canais ao mesmo tempo — nos portais, na plataforma própria e na app.",
            },
            { type: "h2", text: "Definir o bloqueio de vendas" },
            {
              type: "steps",
              items: [
                "Abra o mapa de ocupação do imóvel em causa.",
                "Selecione o dia ou o período pretendido.",
                "No menu de ações, clique em “Ativar bloqueio de vendas”.",
                "Confirme o bloqueio.",
              ],
            },
            { type: "h2", text: "Quando o bloqueio de vendas faz sentido" },
            {
              type: "ul",
              items: [
                "Trabalhos de manutenção de curto prazo ou problemas técnicos no imóvel.",
                "Um caso especial em que não quer, imediatamente e sem exceção, nenhuma nova reserva.",
                "Um bloqueio de emergência rápido, transversal a toda a plataforma, sem ter de tratar cada canal individualmente.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "O bloqueio de vendas não conhece exceções por canal: se um dia estiver bloqueado, nenhum hóspede pode reservar por nenhum canal, nem mesmo pela receção ou por um pedido direto.",
            },
            {
              type: "note",
              variant: "info",
              text: "Para uso próprio permanente ou manutenção planeada, é mais adequado o [Bloqueio manual](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung).",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Estadia mínima e máxima",
          excerpt: "Durante quanto tempo, no mínimo ou no máximo, os hóspedes podem reservar.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Com a estadia mínima e máxima define quantas noites um hóspede pode reservar, no mínimo ou no máximo, para um dia de chegada. Isto ajuda a evitar reservas curtas que deixam lacunas, ou a posicionar o seu imóvel de forma direcionada para estadias mais longas.",
            },
            { type: "h2", text: "Configurar a regra" },
            {
              type: "steps",
              items: [
                "Abra no imóvel o mapa de ocupação ou o separador “Preços”.",
                "Selecione o período em causa.",
                "Em “Estadia mínima”, indique o número mínimo de noites.",
                "Opcionalmente, indique em “Estadia máxima” um número máximo de noites.",
                "Guarde a regra.",
              ],
            },
            { type: "h2", text: "Casos de uso típicos" },
            {
              type: "ul",
              items: [
                "Época alta: estadia mínima mais elevada, para concentrar os dias de troca.",
                "Época baixa: estadia mínima mais baixa, para permitir mais reservas.",
                "Estadia máxima: útil quando um imóvel precisa de ficar livre depois para manutenção ou outro uso.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A regra aplica-se ao dia de chegada: um hóspede não pode chegar num dia com estadia mínima de três noites para ficar apenas duas, mesmo que os dias individuais estejam disponíveis.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Combine estadias mínimas mais longas com [Descontos por duração de estadia](/hilfe/preise-raten/aufenthaltsrabatte), para aumentar o incentivo para os hóspedes.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Bloqueio manual",
          excerpt: "Reservar de forma direcionada períodos para uso próprio ou manutenção.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Um bloqueio manual reserva um período no calendário sem que exista uma reserva real de um hóspede — por exemplo para uso próprio, trabalhos de manutenção planeados ou obras de renovação. O período é apresentado no mapa de ocupação como uma reserva, mas é claramente identificável como bloqueio.",
            },
            { type: "h2", text: "Criar um bloqueio" },
            {
              type: "steps",
              items: [
                "Abra o mapa de ocupação do imóvel em causa.",
                "Marque o período pretendido.",
                "No menu de ações, selecione “Bloquear manualmente”.",
                "Indique um motivo, por exemplo “Uso próprio” ou “Manutenção”.",
                "Guarde o bloqueio.",
              ],
            },
            { type: "h2", text: "Diferença em relação ao bloqueio de vendas" },
            {
              type: "p",
              text: "Um bloqueio manual reserva concretamente um período para um propósito determinado e documentado, podendo ser libertado mais tarde. Para um bloqueio de emergência imediato, transversal a toda a plataforma e sem período documentado, o adequado é antes o bloqueio de vendas.",
            },
            {
              type: "ul",
              items: [
                "Bloqueio manual: planeado, com motivo, para uso próprio ou manutenção.",
                "Pode ser libertado a qualquer momento, assim que o período deixar de ser necessário.",
                "As noites bloqueadas não contam como reserva de hóspede e não aparecem na visão geral de receitas.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Elimine um bloqueio manual assim que o motivo deixar de existir — caso contrário, o imóvel permanece desnecessariamente bloqueado em todos os canais.",
            },
            {
              type: "note",
              variant: "info",
              text: "Para um bloqueio imediato sem período planeado, use o [Bloqueio de vendas](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
