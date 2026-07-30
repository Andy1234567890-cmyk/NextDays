import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Reservas e marcações",
  description: "Gerir, alterar e cancelar reservas.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Reservas",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Registar uma reserva manualmente",
          excerpt:
            "Como registar diretamente no myNextDays uma reserva recebida por telefone ou por e-mail.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Quando registar manualmente" },
            {
              type: "p",
              text: "Nem todas as reservas chegam através de um portal ou da sua própria plataforma — pedidos por telefone, e-mail ou presenciais têm de ser criados por si, para que o imóvel fique corretamente bloqueado no myNextDays e não surja uma ocupação duplicada.",
            },
            {
              type: "steps",
              items: [
                "Abra Reservas e clique em “Nova reserva”.",
                "Escolha o imóvel — cada imóvel no myNextDays é uma única unidade reservável, ou seja, um determinado quarto ou alojamento de férias.",
                "Defina a chegada, a partida e o número de hóspedes.",
                "Registe os dados do hóspede (nome, contacto, morada para a fatura, se aplicável).",
                "Verifique o preço sugerido e ajuste-o se necessário.",
                "Guarde a reserva — as noites são bloqueadas de imediato no calendário.",
              ],
            },
            { type: "h2", text: "Pagamento e confirmação" },
            {
              type: "p",
              text: "Depois de guardar, aplicam-se as mesmas regras de pagamento que numa reserva online. Se houver um fornecedor de pagamento ligado, pode enviar diretamente um link de pagamento ao hóspede ou marcar manualmente o pagamento como recebido.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Registe logo pedidos especiais (chegada antecipada, camas extra) nas notas — a equipa vê-os na linha do tempo da reserva.",
            },
            { type: "h2", text: "Depois de criar" },
            {
              type: "p",
              text: "A nova reserva aparece de imediato na [linha do tempo da reserva](/hilfe/reservierungen/buchungs-zeitleiste), com todos os passos seguintes — mensagens, tarefas e pagamentos — reunidos num só lugar.",
            },
            {
              type: "ul",
              items: [
                "O calendário e os portais são sincronizados automaticamente assim que guarda.",
                "O hóspede recebe, se aplicável, uma mensagem de confirmação automática.",
                "As alterações de datas registam-se através de “Mudar reserva”.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "A linha do tempo da reserva",
          excerpt:
            "A linha do tempo da reserva reúne todo o processo de uma reserva num só lugar.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "O que a linha do tempo mostra" },
            {
              type: "p",
              text: "Cada reserva tem a sua própria linha do tempo, que representa cronologicamente todo o processo — desde o pedido de reserva ou a importação de portal até ao check-out. Assim, vê num relance o que já aconteceu e o que vem a seguir.",
            },
            {
              type: "ul",
              items: [
                "Mensagens com o hóspede",
                "Tarefas, por exemplo limpeza ou preparação",
                "Pagamentos e faturas",
                "Complementos e serviços adicionais reservados",
                "Alterações (mudança de data) e cancelamentos",
              ],
            },
            { type: "h2", text: "Usar a linha do tempo no dia a dia" },
            {
              type: "steps",
              items: [
                "Abra Reservas e selecione a reserva pretendida.",
                "Mude para o separador “Linha do tempo”.",
                "Percorra cronologicamente todos os eventos.",
                "Use as ações rápidas para enviar diretamente uma mensagem ou criar uma tarefa.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Se uma reserva for alterada ou cancelada, este passo também aparece na linha do tempo — incluindo as noites libertadas no calendário.",
            },
            { type: "h2", text: "Por que isto é importante" },
            {
              type: "p",
              text: "Como a equipa, os proprietários e o suporte veem a mesma linha do tempo, não surgem lacunas de informação entre mensagens, tarefas e pagamentos. Detalhes sobre reembolsos em [Reembolsos](/hilfe/zahlungen/rueckerstattungen), sobre serviços adicionais em [Complementos e serviços adicionais](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Mudar uma reserva",
          excerpt:
            "Como mudar uma reserva existente para um novo período, sem baralhar o calendário.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Verificar antes de mudar" },
            {
              type: "p",
              text: "Antes de mudar uma reserva, verifique a disponibilidade no novo período para o imóvel reservado. O myNextDays só liberta as noites originalmente reservadas assim que o novo período estiver confirmado — assim não surge nenhuma lacuna em que o imóvel apareça, por engano, como livre ou duplamente ocupado.",
            },
            {
              type: "steps",
              items: [
                "Abra a reserva em Reservas.",
                "Escolha “Mudar” e indique o novo período.",
                "Verifique a disponibilidade apresentada para as novas datas.",
                "Confirme a mudança.",
                "Verifique se o preço se altera com o novo número de noites e ajuste-o se necessário.",
              ],
            },
            { type: "h2", text: "O que acontece automaticamente" },
            {
              type: "p",
              text: "Depois da confirmação, as noites antigas são corretamente libertadas no calendário e as novas noites ficam bloqueadas, os portais ligados são atualizados. O processo fica registado na linha do tempo da reserva.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Se a reserva tiver sido recebida através de um portal, uma mudança pode estar sujeita a regras próprias nesse portal — verifique as políticas do portal antes de fazer alterações significativas.",
            },
            { type: "h2", text: "Diferenças de pagamento" },
            {
              type: "p",
              text: "Se o preço se alterar devido à mudança, ajuste as regras de pagamento em conformidade — ver [Regras de pagamento](/hilfe/zahlungen/zahlungsregeln). Mais sobre o processo completo de uma reserva em [A linha do tempo da reserva](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Cancelamento e reembolso",
          excerpt:
            "Como cancelar corretamente uma reserva e, se necessário, iniciar um reembolso.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Cancelar uma reserva" },
            {
              type: "p",
              text: "Um cancelamento liberta de imediato o imóvel para o período reservado — tanto no seu calendário como em todos os portais ligados. Antes de cancelar, verifique quais as condições de cancelamento aplicáveis a esta reserva.",
            },
            {
              type: "steps",
              items: [
                "Abra a reserva em Reservas.",
                "Escolha “Cancelar” e indique um motivo.",
                "Verifique o valor de reembolso sugerido.",
                "Confirme o cancelamento.",
              ],
            },
            { type: "h2", text: "Iniciar um reembolso" },
            {
              type: "p",
              text: "Se o pagamento tiver sido processado através de um fornecedor de pagamento ligado, pode iniciar o reembolso diretamente a partir da reserva. O valor é apresentado na moeda registada para esse imóvel. Detalhes sobre o processo em [Reembolsos](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Reembolso total ou parcial possível",
                "O processo aparece na linha do tempo da reserva",
                "Em reservas de portal, aplicam-se adicionalmente as regras do respetivo portal",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Um cancelamento não pode ser desfeito. Verifique cuidadosamente o período e o hóspede antes de confirmar.",
            },
            { type: "h2", text: "Depois do cancelamento" },
            {
              type: "p",
              text: "O imóvel passa a estar novamente reservável de imediato, e as tarefas em aberto relacionadas com a reserva — como a preparação — são automaticamente marcadas como já não necessárias. Todo o processo mantém-se rastreável na [linha do tempo da reserva](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Check-in e check-out",
          excerpt: "Como documentar a chegada e a partida de um hóspede no myNextDays.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Registar o check-in" },
            {
              type: "p",
              text: "O check-in assinala o início da estadia e é especialmente útil em check-in autónomo ou na entrega de chaves pela equipa, para manter atualizado o estado de cada reserva.",
            },
            {
              type: "steps",
              items: [
                "Abra a reserva em Reservas.",
                "Escolha “Check-in” no dia de chegada.",
                "Se necessário, registe uma nota, por exemplo a hora ou alguma particularidade.",
              ],
            },
            { type: "h2", text: "Check-out e entrega" },
            {
              type: "p",
              text: "No check-out, marca a estadia como concluída. Isto desencadeia em muitos casos automaticamente uma tarefa de limpeza para o imóvel, para que fique preparado para a próxima reserva.",
            },
            {
              type: "ul",
              items: [
                "O check-in e o check-out fazem parte da linha do tempo da reserva",
                "Os horários podem ser definidos por imóvel nas configurações do imóvel",
                "Em acesso móvel, a equipa pode registar o check-in e o check-out diretamente no local",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Um check-out não registado não bloqueia automaticamente as tarefas seguintes — verifique regularmente os estados em atraso em Reservas.",
            },
            { type: "h2", text: "Relação com as tarefas" },
            {
              type: "p",
              text: "O check-in e o check-out estão intimamente ligados às tarefas e à linha do tempo. Mais sobre o processo completo em [A linha do tempo da reserva](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Complementos e serviços adicionais",
          excerpt:
            "Como oferecer aos hóspedes serviços adicionais reserváveis, como pequeno-almoço ou transfer, e registá-los na reserva.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "O que são os complementos" },
            {
              type: "p",
              text: "Os complementos são serviços adicionais opcionais a uma reserva — por exemplo pequeno-almoço, chegada antecipada, transfer ou late checkout. São registados por imóvel e podem ser adicionados à reserva pelo próprio hóspede ou pela sua equipa.",
            },
            {
              type: "steps",
              items: [
                "Abra o imóvel e crie em “Complementos” os serviços adicionais pretendidos, com preço.",
                "Abra uma reserva existente em Reservas.",
                "Escolha “Adicionar complemento” e selecione o serviço pretendido.",
                "Confirme a quantidade e o momento do serviço.",
              ],
            },
            { type: "h2", text: "Faturação" },
            {
              type: "p",
              text: "Os complementos são faturados na moeda do respetivo imóvel e aparecem como uma linha própria na fatura. Os complementos já pagos podem ser reembolsados proporcionalmente em caso de cancelamento.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Registe os complementos mais populares uma vez, de forma centralizada, no imóvel — assim podem ser adicionados em cada nova reserva com poucos cliques.",
            },
            { type: "h2", text: "Visibilidade para o hóspede" },
            {
              type: "p",
              text: "Se a plataforma ou o próprio site estiverem ativos, os hóspedes podem muitas vezes já selecionar os complementos adequados durante a própria reserva. Cada adição aparece depois na [linha do tempo da reserva](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Os complementos podem ser nomeados e ter preço definido individualmente por imóvel",
                "É possível adicioná-los posteriormente a qualquer momento através da reserva",
                "Os complementos cancelados são reembolsados proporcionalmente",
              ],
            },
          ],
        },
      ],
    },
  ],
};
