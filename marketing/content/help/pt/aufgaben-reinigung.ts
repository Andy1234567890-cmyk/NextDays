import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Tarefas e limpeza",
  description: "Organizar planos de limpeza e tarefas da equipa.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Operação",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Criar tarefas",
          excerpt: "Como criar uma nova tarefa para um imóvel ou um período.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "As tarefas reúnem tudo o que é preciso resolver em torno de um imóvel — desde a limpeza após o check-out até trabalhos de manutenção ou pedidos de hóspedes. Cada tarefa está ligada exatamente a um imóvel e pode ser atribuída a um membro da equipa.",
            },
            { type: "h2", text: "Criar uma nova tarefa" },
            {
              type: "steps",
              items: [
                "Abra a área “Tarefas” no menu principal.",
                "Clique em “Nova tarefa”.",
                "Selecione o imóvel em causa.",
                "Indique um título e, opcionalmente, uma descrição.",
                "Defina a data e a hora de vencimento.",
                "Guarde a tarefa.",
              ],
            },
            { type: "h2", text: "Tipos de tarefa" },
            {
              type: "p",
              text: "Além das tarefas livres, existem tarefas geradas pelo sistema, como as limpezas agendadas automaticamente após um check-out. Estas já estão ligadas ao imóvel e à janela temporal correta, faltando apenas atribuí-las a um membro da equipa.",
            },
            {
              type: "ul",
              items: [
                "Tarefa manual: criada livremente, por exemplo manutenção ou pedido especial.",
                "Tarefa automática de limpeza: derivada da data de check-out.",
                "Tarefa recorrente: para verificações ou inspeções regulares.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Detalhes sobre o agendamento automático em [Planos de limpeza](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Use títulos precisos — na vista móvel, os membros da equipa muitas vezes só veem, num relance, o título e o imóvel.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Planos de limpeza",
          excerpt: "Agendar limpezas automaticamente após o check-out.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Um plano de limpeza garante que, após cada check-out, é criada automaticamente uma tarefa de limpeza para o imóvel em causa — sem que tenha de acompanhar cada reserva individualmente. Isso reduz entregas esquecidas e garante um processo fiável entre duas estadias.",
            },
            { type: "h2", text: "Ativar o agendamento automático" },
            {
              type: "steps",
              items: [
                "Abra o imóvel e mude para o separador “Limpeza”.",
                "Ative “Agendar limpeza automaticamente após o check-out”.",
                "Defina quanto tempo após o check-out é reservado para a limpeza.",
                "Opcionalmente, defina uma equipa ou um funcionário de limpeza padrão.",
                "Guarde a configuração.",
              ],
            },
            { type: "h2", text: "Interação com o calendário" },
            {
              type: "p",
              text: "Assim que uma reserva é cancelada ou alterada, a tarefa de limpeza associada ajusta-se automaticamente à nova data de check-out. Assim, o plano de limpeza mantém-se sempre sincronizado com a ocupação real.",
            },
            {
              type: "ul",
              items: [
                "A limpeza é criada automaticamente em cada check-out com um plano ativo.",
                "Se a reserva for alterada, a tarefa de limpeza acompanha a alteração.",
                "Se o hóspede cancelar a estadia, a tarefa de limpeza é removida.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Sem um plano de limpeza ativado não são criadas tarefas automáticas — nesse caso, crie as limpezas manualmente em [Criar tarefas](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Atribuir tarefas",
          excerpt: "Atribuir tarefas de forma direcionada a funcionários de limpeza ou membros da equipa.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Para que uma tarefa seja concluída, atribua-a a um membro concreto da equipa — por exemplo um funcionário de limpeza ou um colaborador responsável pela manutenção. Por norma, apenas a pessoa atribuída vê a tarefa na sua própria visão geral.",
            },
            { type: "h2", text: "Atribuir uma tarefa manualmente" },
            {
              type: "steps",
              items: [
                "Abra a tarefa na lista “Tarefas”.",
                "Clique em “Atribuir”.",
                "Selecione na lista o membro da equipa responsável.",
                "Confirme a atribuição.",
              ],
            },
            { type: "h2", text: "Atribuição por imóvel" },
            {
              type: "p",
              text: "Se um funcionário de limpeza já estiver fixamente associado a um imóvel, pode também definir que as tarefas desse imóvel sejam atribuídas automaticamente a essa pessoa. Isto poupa cliques em limpezas recorrentes e reduz perguntas adicionais.",
            },
            {
              type: "ul",
              items: [
                "Atribuição manual: escolhe a pessoa em cada tarefa individualmente.",
                "Associação fixa ao imóvel: novas tarefas para este imóvel vão automaticamente para a pessoa definida.",
                "Uma tarefa tem sempre exatamente uma pessoa responsável.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Funcionários de limpeza e colaboradores veem exclusivamente as suas próprias tarefas atribuídas, sem dados financeiros ou de vendas do imóvel.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Acompanhar o estado das tarefas",
          excerpt: "Acompanhar em tempo real o estado de processamento das tarefas.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Cada tarefa passa por um estado claro — de pendente, a em processamento, até concluída. Assim, sabe sempre se uma limpeza ou manutenção fica pronta a tempo do próximo check-in.",
            },
            { type: "h2", text: "Visão geral dos estados" },
            {
              type: "ul",
              items: [
                "Pendente: a tarefa foi criada, mas ainda não foi iniciada.",
                "Em processamento: a pessoa atribuída já iniciou a tarefa.",
                "Concluída: a tarefa está terminada e confirmada.",
              ],
            },
            { type: "h2", text: "Atualizar o estado" },
            {
              type: "steps",
              items: [
                "Abra a tarefa a partir da lista “Tarefas”.",
                "Selecione o estado correspondente, por exemplo “Em processamento” ou “Concluída”.",
                "Se necessário, adicione uma nota curta, por exemplo sobre alguma anomalia no imóvel.",
                "Guarde a alteração.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "As alterações de estado aparecem de imediato na lista de tarefas partilhada — não é necessário recarregar manualmente.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Se uma limpeza ainda estiver pendente pouco antes do próximo check-in, verifique primeiro a atribuição antes de contactar o hóspede.",
            },
          ],
        },
      ],
    },
  ],
};
