import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Mensagens e hóspedes",
  description: "Caixa de entrada, modelos e comunicação com hóspedes.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Comunicação",
      articles: [
        {
          slug: "posteingang",
          title: "A caixa de entrada da plataforma",
          excerpt: "Todas as mensagens de hóspedes dos seus imóveis reúnem-se centralmente na caixa de entrada da plataforma.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Uma caixa de entrada para todos os imóveis" },
            {
              type: "p",
              text: "A caixa de entrada da plataforma reúne todas as mensagens dos seus hóspedes num só lugar — independentemente do imóvel ou do período a que a conversa diz respeito. Pode abri-la em /nachrichten e vê cada conversa como uma linha própria.",
            },
            { type: "h2", text: "Estrutura da caixa de entrada" },
            {
              type: "ul",
              items: [
                "Coluna esquerda: lista de todas as conversas, as mais recentes primeiro",
                "Coluna do meio: o histórico de mensagens ativo com o hóspede",
                "Coluna direita: contexto da reserva — período, imóvel, dados do hóspede",
              ],
            },
            { type: "h2", text: "Responder a uma mensagem" },
            {
              type: "steps",
              items: [
                "Abra /nachrichten e selecione a conversa pretendida",
                "Escreva a sua resposta no campo de texto ou use uma resposta rápida",
                "Envie a mensagem — o hóspede recebe-a pela mesma via através da qual escreveu",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A caixa de entrada da plataforma mostra exclusivamente a comunicação direta entre si e os seus hóspedes no myNextDays — as mensagens dos portais continuam a ser tratadas lá.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Respostas rápidas",
          excerpt: "Modelos para perguntas frequentes poupam tempo no contacto com os hóspedes.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "O que são as respostas rápidas" },
            {
              type: "p",
              text: "As respostas rápidas são blocos de texto pré-formulados para perguntas recorrentes — por exemplo sobre a chegada, a palavra-passe do Wi-Fi ou o estacionamento. Em vez de escrever cada resposta de novo, insere o modelo adequado com um clique na [caixa de entrada da plataforma](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Criar uma resposta rápida" },
            {
              type: "steps",
              items: [
                "Abra /nachrichten e clique em “Gerir respostas rápidas”",
                "Clique em “Novo modelo” e indique um título, por exemplo “Informações de check-in”",
                "Escreva o texto da resposta; marcadores como nome do hóspede ou data de chegada são preenchidos automaticamente ao enviar",
                "Guarde o modelo — fica disponível de imediato em todas as conversas",
              ],
            },
            { type: "h2", text: "Usar as respostas rápidas no dia a dia" },
            {
              type: "p",
              text: "Na janela de mensagens, abre a lista de modelos através do ícone de raio, escolhe a resposta adequada e, se necessário, ajusta-a individualmente antes de a enviar.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Crie modelos para as cinco a dez perguntas mais frequentes — na prática, isso cobre a maior parte das mensagens recebidas.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Mensagens automáticas",
          excerpt: "Confirmações, informações de check-in e lembretes podem ser enviados automaticamente aos hóspedes.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Automatizar mensagens recorrentes" },
            {
              type: "p",
              text: "Em vez de enviar manualmente confirmações de reserva, avisos de check-in ou mensagens de agradecimento, configura-os uma vez como regra — o myNextDays envia-os depois automaticamente no momento certo, antes, durante ou depois da estadia.",
            },
            { type: "h2", text: "Gatilhos típicos para mensagens automáticas" },
            {
              type: "ul",
              items: [
                "Logo após a reserva — confirmação com os dados mais importantes",
                "Poucos dias antes da chegada — informações de check-in e código de acesso",
                "No dia da partida — agradecimento e pedido de avaliação",
              ],
            },
            { type: "h2", text: "Configurar uma mensagem automática" },
            {
              type: "steps",
              items: [
                "Abra /nachrichten, secção “Mensagens automáticas”",
                "Escolha o gatilho, por exemplo “X dias antes da chegada”",
                "Registe o texto — marcadores como nome do hóspede, imóvel ou data de chegada são preenchidos automaticamente",
                "Ative a regra; aplica-se a todos os imóveis, salvo restrição diferente",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "As mensagens automáticas aparecem normalmente na [caixa de entrada da plataforma](/hilfe/nachrichten/posteingang) e podem ser consultadas ali a qualquer momento posteriormente.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Bloquear mensagens",
          excerpt: "Pode bloquear uma pessoa diretamente a partir do histórico de mensagens, impedindo novos contactos.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Quando um bloqueio faz sentido" },
            {
              type: "p",
              text: "Em caso de mensagens ofensivas, assédio ou comportamento repetidamente inadequado, pode bloquear uma pessoa diretamente a partir da conversa. Uma pessoa bloqueada deixa de conseguir enviar-lhe novas mensagens e de criar novas reservas consigo.",
            },
            { type: "h2", text: "Bloquear uma pessoa a partir da conversa" },
            {
              type: "steps",
              items: [
                "Abra a conversa em causa na [caixa de entrada da plataforma](/hilfe/nachrichten/posteingang)",
                "Clique no menu, no topo da conversa, e selecione “Bloquear pessoa”",
                "Confirme a operação — o bloqueio aplica-se de imediato",
              ],
            },
            { type: "h2", text: "O que o bloqueio significa — e o que não significa" },
            {
              type: "ul",
              items: [
                "As novas mensagens da pessoa bloqueada deixam de ser entregues",
                "Os novos pedidos de reserva da pessoa são recusados",
                "Se estiver a decorrer atualmente uma reserva dessa pessoa, a comunicação mantém-se excecionalmente possível durante a estadia",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Um bloqueio pode ser revertido a qualquer momento na visão geral “Pessoas bloqueadas” na conta. Antes de bloquear, verifique se já existe uma reserva em curso.",
            },
          ],
        },
      ],
    },
  ],
};
