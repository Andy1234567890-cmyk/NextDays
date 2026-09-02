import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Programa de Parceiros",
  description: "Recomende estabelecimentos, construa uma equipa e ganhe com as receitas de subscrição.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Como funciona",
      articles: [
        {
          slug: "ueberblick",
          title: "Visão geral do Programa de Parceiros",
          excerpt: "Quem pode participar, como a comissão é gerada e o que pode ver.",
          updated: "Atualizado: setembro de 2026",
          body: [
            {
              type: "p",
              text: "Como parceiro, recomenda o myNextDays a proprietários, agências e hotéis. Se um estabelecimento se registar com o seu código ou através do seu link e pagar as suas faturas de subscrição, receberá uma parte da receita líquida da subscrição durante doze meses. A escala por clientes pagantes está disponível em tempo real na página do programa.",
            },
            { type: "h2", text: "Quem pode ser parceiro" },
            {
              type: "ul",
              items: [
                "Pessoas e empresas na UE, Suíça ou Reino Unido com um canal genuíno para anfitriões: influenciadores, consultores, agências, escritórios de contabilidade, associações.",
                "Também os próprios clientes myNextDays — uma subscrição não é um requisito.",
                "Obrigatório na candidatura: pelo menos uma conta de rede social (Instagram, TikTok, YouTube, Facebook, LinkedIn…) com endereço, identificador e alcance. Site ou newsletter são bem-vindos como extras.",
              ],
            },
            { type: "h2", text: "Como um estabelecimento é atribuído a si" },
            {
              type: "steps",
              items: [
                "Partilhe o seu link (mynextdays.com/p/SEU-CÓDIGO) ou o seu código.",
                "O estabelecimento vê o código no campo \"Recomendado por\" durante o registo e confirma-o ao enviar — sem cookie.",
                "O período de doze meses começa com a primeira fatura de subscrição paga.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Verá os seus clientes de forma pseudónima (Cliente #1, #2…) com país, estado e valores — nunca nome ou e-mail. Um estabelecimento é atribuído a apenas um parceiro; o primeiro ganha.",
            },
            { type: "h2", text: "O que encontra no painel de controlo" },
            {
              type: "ul",
              items: [
                "Visão geral: classificação, cliques, estabelecimentos registados e pagantes, comissões em aberto, a pagar e pagas.",
                "Comissões: cada fatura de subscrição paga como uma linha com base, taxa, valor e estado.",
                "Pagamentos: mensalmente por moeda a partir do valor mínimo, com crédito (auto-faturação) como comprovativo.",
                "Links e material: os seus códigos, material promocional e a identificação obrigatória por país.",
                "Mensagens: o contacto direto com a equipa de parceiros.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Construir uma equipa: a comissão de equipa",
          excerpt: "Recrute parceiros que se juntem com o seu código — e ganhe com as receitas dos clientes deles.",
          updated: "Atualizado: setembro de 2026",
          body: [
            {
              type: "p",
              text: "Pode trazer outros parceiros para a sua equipa. Se alguém se candidatar através do seu link de equipa (mynextdays.com/p/SEU-CÓDIGO?team=1) e inserir visivelmente o seu código na candidatura, após aprovação, fará parte da sua equipa. Receberá uma comissão de equipa sobre a receita líquida de subscrição dos clientes dos seus parceiros de equipa.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "A taxa de equipa é determinada pela SUA classificação no momento do pagamento — não pelo tamanho da sua equipa. As taxas estão na página do programa.",
                "A sua classificação é gerada apenas pelos seus próprios clientes pagantes. Os clientes da equipa não contam para a classificação.",
                "Apenas um nível: os seus parceiros de equipa não constroem a sua própria equipa sob si.",
                "Sem taxa de participação, sem dinheiro para recrutar um parceiro. A comissão de equipa é gerada exclusivamente a partir da receita de subscrição paga.",
                "Doze meses a partir da primeira fatura paga do respetivo cliente da equipa, janela de reembolso de 30 dias, estorno em caso de reembolso ou chargeback — tal como na sua própria comissão.",
                "A provisão da equipe só é gerada quando você e seu parceiro de equipe são liberados; caso contrário, ela é suspensa.",
              ],
            },
            { type: "h2", text: "A avaliação da equipe" },
            {
              type: "p",
              text: "Em \"Equipe\", você verá cada parceiro de equipe com sua classificação, clientes pagantes, receita de assinatura de seus clientes (30 dias e total) e sua provisão de equipe resultante — aberta, pagável, paga — bem como o histórico dos últimos doze meses. Você não verá os detalhes dos clientes de seus parceiros de equipe; eles pertencem a eles.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Através de \"Equipe\", você pode entrar em contato diretamente com seus parceiros de equipe por mensagem — e seu patrocinador com você.",
            },
            {
              type: "note",
              variant: "warn",
              text: "O mesmo domínio de e-mail ou a mesma conta bancária entre patrocinador e parceiro de equipe serão marcados e verificados pela equipe de parceiros antes que a provisão da equipe seja paga.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Pagamento, crédito e impostos",
          excerpt: "Quando a provisão se torna pagável, como o crédito é emitido e o que se aplica em termos fiscais.",
          updated: "Status: setembro de 2026",
          body: [
            {
              type: "steps",
              items: [
                "Uma linha de provisão é criada com a fatura de assinatura paga e fica \"aberta\" por 30 dias (janela de reembolso).",
                "Depois disso, ela é pagável. No primeiro dia do mês, agrupamos todas as linhas pagáveis por moeda.",
                "Se o total exceder o valor mínimo da sua moeda, um pagamento com crédito (auto-faturamento) será gerado. Você não precisa emitir uma fatura.",
                "Após a transferência, o pagamento aparece como \"Pago\" com referência no painel.",
              ],
            },
            {
              type: "ul",
              items: [
                "Empresas: O crédito contém a menção de \"reverse charge\"; o pré-requisito é um número de IVA confirmado (verificação VIES).",
                "Pessoas físicas: O crédito não mostra IVA; a provisão deve ser tributada por conta própria.",
                "Pagamento via SEPA, Wise ou PayPal — você insere os dados no perfil; as alterações exigem sua senha.",
                "Sem conversão: a provisão em DKK é paga em DKK, a provisão em EUR em EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A publicidade deve ser reconhecível como publicidade — no início da postagem, no idioma da postagem. As frases comprovadas por país podem ser encontradas em \"Links e Material\". Violações podem levar ao bloqueio.",
            },
          ],
        },
      ],
    },
  ],
};
