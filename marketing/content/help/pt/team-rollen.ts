import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Equipa e permissões",
  description: "Colaboradores, perfis e direitos de acesso.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Acesso",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Convidar colaboradores",
          excerpt: "Como convidar novos colaboradores para a sua conta myNextDays.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Pode convidar quantos colaboradores quiser para o seu negócio — por exemplo para receção, limpeza ou administração. Cada convite está associado a um endereço de e-mail e atribui de imediato um perfil fixo, que determina o acesso na web e na app myNextDays.",
            },
            { type: "h2", text: "Enviar o convite" },
            {
              type: "steps",
              items: [
                "Abra “Conta” e mude para a área “Equipa”.",
                "Clique em “Convidar colaborador”.",
                "Indique o endereço de e-mail da pessoa.",
                "Escolha o perfil adequado, por exemplo Colaborador ou Limpeza.",
                "Confirme o convite.",
              ],
            },
            { type: "h2", text: "O que acontece a seguir" },
            {
              type: "p",
              text: "A pessoa convidada recebe um e-mail com um link para definir a sua própria palavra-passe e iniciar sessão. O início de sessão aplica-se igualmente ao painel web e à app myNextDays — não existe uma conta separada por frontend.",
            },
            {
              type: "ul",
              items: [
                "Um convite é válido até ser aceite ou retirado.",
                "Os convites pendentes veem-se na área “Equipa” com o estado “Pendente”.",
                "O perfil pode ser ajustado posteriormente a qualquer momento.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Que áreas cada perfil pode ver, veja em [Perfis e permissões](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Atribua desde o início o perfil mais restrito adequado — os direitos podem sempre ser alargados mais tarde.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Perfis e permissões",
          excerpt: "Os cinco perfis do myNextDays e o que cada um pode fazer.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "O myNextDays distingue cinco perfis: Administrador, Coadministrador, Colaborador, Limpeza e Proprietário. Cada perfil determina que áreas são visíveis no painel web e na app myNextDays — os direitos são aplicados no servidor, não apenas ocultados na interface.",
            },
            { type: "h2", text: "Os perfis numa visão geral" },
            {
              type: "ul",
              items: [
                "Administrador: acesso total a todas as áreas, incluindo finanças, vendas e gestão da equipa.",
                "Coadministrador: acesso quase total, como o Administrador, para o segundo nível de direção do negócio.",
                "Colaborador: acesso operacional a reservas, calendário e tarefas, sem visibilidade financeira ou de vendas.",
                "Limpeza: acesso exclusivo às tarefas de limpeza atribuídas e aos detalhes do imóvel, sem visibilidade financeira ou de vendas.",
                "Proprietário: acesso apenas de leitura aos seus próprios imóveis, sem gestão de imóveis alheios.",
              ],
            },
            { type: "h2", text: "Atribuir ou alterar um perfil" },
            {
              type: "steps",
              items: [
                "Abra “Conta” → “Equipa”.",
                "Selecione o colaborador em causa na lista.",
                "Clique em “Alterar perfil”.",
                "Escolha o novo perfil e confirme.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Colaborador e Limpeza nunca veem preços, receitas ou canais de reserva — esta exclusão aplica-se no servidor e não pode ser contornada através da interface.",
            },
            {
              type: "note",
              variant: "info",
              text: "Uma visão geral por perfil está disponível em [O que cada perfil vê](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "O que cada perfil vê",
          excerpt: "Áreas e vistas concretas por perfil, na web e na app.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Além dos direitos gerais descritos em [Perfis e permissões](/hilfe/team-rollen/rollen-berechtigungen), um olhar concreto sobre cada área ajuda a definir as expectativas corretas ao integrar novos colaboradores.",
            },
            { type: "h2", text: "Calendário e reservas" },
            {
              type: "p",
              text: "Administrador, Coadministrador e Colaborador veem o mapa de ocupação completo, com dados dos hóspedes e tarefas. A Limpeza vê apenas os agendamentos que lhe estão atribuídos, com a morada do imóvel e a lista de verificação, mas sem nomes de hóspedes nem preços. Os proprietários veem o calendário de ocupação apenas dos seus próprios imóveis, em modo de leitura.",
            },
            { type: "h2", text: "Finanças e vendas" },
            {
              type: "ul",
              items: [
                "Receitas, comissões e faturas: apenas Administrador e Coadministrador.",
                "Portais (ligação a OTA) e visibilidade na plataforma: apenas Administrador e Coadministrador.",
                "Colaborador e Limpeza: sem acesso a áreas financeiras ou de vendas, mesmo em páginas de detalhe.",
              ],
            },
            { type: "h2", text: "Equipa e configurações" },
            {
              type: "p",
              text: "A gestão de colaboradores, perfis e configurações da conta fica reservada ao Administrador e ao Coadministrador. Os proprietários e os perfis operacionais nem chegam a ver esta área na app myNextDays nem no painel web.",
            },
            {
              type: "note",
              variant: "info",
              text: "Esta divisão é idêntica no painel web e na app myNextDays, uma vez que ambos os frontends consultam o mesmo perfil da sua conta.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Teste novos perfis brevemente junto com o colaborador, depois do convite, para evitar mal-entendidos sobre as áreas visíveis.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Revogar o acesso",
          excerpt: "Remover o acesso de um colaborador de forma imediata e completa.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Se um colaborador deixar o seu negócio ou a colaboração mudar, remova o acesso diretamente na conta. A revogação aplica-se no servidor e é imediata — não apenas depois de terminar uma sessão em curso.",
            },
            { type: "h2", text: "Remover o acesso" },
            {
              type: "steps",
              items: [
                "Abra “Conta” → “Equipa”.",
                "Selecione o colaborador em causa.",
                "Clique em “Revogar acesso”.",
                "Confirme a operação.",
              ],
            },
            { type: "h2", text: "Impacto nas sessões em curso" },
            {
              type: "p",
              text: "Depois da revogação, a pessoa deixa de conseguir iniciar sessão, tanto no painel web como na app myNextDays. As tarefas ou agendamentos de limpeza já atribuídos devem ser reatribuídos previamente a outro colaborador, para que nada fique por tratar.",
            },
            {
              type: "ul",
              items: [
                "Reatribua as tarefas em aberto antes de revogar o acesso.",
                "O acesso pode ser restabelecido mais tarde através de um novo convite.",
                "A revogação afeta apenas este negócio, não outras contas da pessoa.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Revogue o acesso rapidamente assim que uma colaboração termina — contas de colaboradores em aberto representam, caso contrário, um risco de segurança desnecessário.",
            },
          ],
        },
      ],
    },
  ],
};
