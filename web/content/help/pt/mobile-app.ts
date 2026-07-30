import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "App móvel",
  description: "A app myNextDays para usar em qualquer lugar.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "App",
      articles: [
        {
          slug: "die-app",
          title: "A app myNextDays",
          excerpt: "Uma conta, quatro experiências: hóspede, agência, proprietário e colaborador.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "A app myNextDays é a plataforma móvel para todo o seu negócio. Não é um produto separado, mas sim um frontend ao mesmo nível do seu painel web — ambos acedem à mesma conta e aos mesmos dados, apenas a interface está otimizada para uso em movimento.",
            },
            { type: "h2", text: "Quatro experiências numa app" },
            {
              type: "ul",
              items: [
                "Hóspede: ver reservas, comunicar com o negócio, consultar informações de check-in.",
                "Agência: gerir vários negócios e imóveis numa visão geral.",
                "Proprietário: acesso apenas de leitura aos próprios imóveis, ocupação e relatórios.",
                "Colaborador: calendário, tarefas e planos de limpeza para o dia a dia operacional.",
              ],
            },
            { type: "h2", text: "Que experiência vê" },
            {
              type: "p",
              text: "Depois de iniciar sessão, a app mostra automaticamente a experiência adequada ao seu perfil — o mesmo perfil que se aplica no painel web. Um colaborador com direitos limitados vê na app exatamente as mesmas restrições que no navegador, uma vez que a autorização é verificada no servidor.",
            },
            {
              type: "note",
              variant: "info",
              text: "Mais sobre perfis e o que cada um pode ver em [Perfis e permissões](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Não precisa de um registo separado para a app — basta iniciar sessão com as suas credenciais myNextDays existentes.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Instalar a app e iniciar sessão",
          excerpt: "Como descarregar a app myNextDays e iniciar sessão.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "A app myNextDays está disponível para iOS e Android. O início de sessão é feito com as mesmas credenciais do painel web — não é necessária uma conta separada nem um novo registo.",
            },
            { type: "h2", text: "Instalação" },
            {
              type: "steps",
              items: [
                "Abra a App Store (iOS) ou a Google Play (Android).",
                "Procure por “myNextDays”.",
                "Instale a app no seu smartphone ou tablet.",
                "Abra a app após a instalação.",
              ],
            },
            { type: "h2", text: "Início de sessão" },
            {
              type: "steps",
              items: [
                "Toque em “Iniciar sessão”.",
                "Introduza o seu endereço de e-mail e a sua palavra-passe.",
                "Confirme o pedido de dois fatores, caso aplicável.",
                "É encaminhado automaticamente para a experiência adequada ao seu perfil.",
              ],
            },
            {
              type: "ul",
              items: [
                "As credenciais são idênticas às do painel web.",
                "Se o seu acesso for revogado, o início de sessão na app também fica imediatamente bloqueado.",
                "Em caso de problemas com a palavra-passe, use “Esqueci-me da palavra-passe” diretamente na app.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Inicie sessão exclusivamente através da entrada oficial “myNextDays” na loja de aplicações; a app nunca pede credenciais fora do ecrã de início de sessão.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Gerir em movimento",
          excerpt: "Tratar reservas, mensagens e tarefas diretamente a partir do smartphone.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "A app myNextDays é especialmente indicada para a operação diária em movimento: vê as reservas atuais, responde a mensagens de hóspedes e trata tarefas sem precisar de estar sentado ao computador — as alterações aparecem em tempo real também no painel web.",
            },
            { type: "h2", text: "Reservas à vista" },
            {
              type: "p",
              text: "Na área “Reservas” vê chegadas e partidas, ocupação e estado por imóvel. Colaboradores e equipa de limpeza veem apenas as informações relevantes para eles, sem preços nem detalhes de vendas.",
            },
            { type: "h2", text: "Mensagens e tarefas" },
            {
              type: "steps",
              items: [
                "Abra a área “Mensagens” para responder diretamente aos pedidos dos hóspedes.",
                "Mude para “Tarefas” para ver as tarefas que lhe foram atribuídas.",
                "Toque numa tarefa para abrir os detalhes e concluí-la.",
                "Marque como concluídos os agendamentos de limpeza realizados diretamente no local.",
              ],
            },
            {
              type: "ul",
              items: [
                "As novas mensagens e tarefas aparecem em direto, sem atualização manual.",
                "As tarefas concluídas ficam imediatamente visíveis também no painel web.",
                "Os proprietários veem as reservas e os relatórios dos seus imóveis, mas apenas em modo de leitura.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "As notificações push informam-no sobre novas mensagens e tarefas atribuídas, assim que as autorizar nas definições do dispositivo.",
            },
          ],
        },
      ],
    },
  ],
};
