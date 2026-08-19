import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Proprietários e faturação",
  description: "Contas de proprietários, faturação e comissões.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Proprietários",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Criar um proprietário",
          excerpt: "Como criar uma nova conta de proprietário no myNextDays.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Os proprietários são contas próprias no myNextDays, através das quais gere imóveis que pertencem a uma determinada pessoa ou sociedade. Uma conta de proprietário recebe um acesso limitado, apenas de leitura, aos seus próprios imóveis, sem poder fazer alterações à operação.",
            },
            { type: "h2", text: "Criar uma nova conta de proprietário" },
            {
              type: "steps",
              items: [
                "Abra a área “Proprietários” no menu principal.",
                "Clique em “Criar novo proprietário”.",
                "Indique nome, endereço de e-mail e dados de contacto.",
                "Se necessário, registe a morada de faturação para a faturação.",
                "Guarde a conta.",
              ],
            },
            { type: "h2", text: "Configurar o acesso" },
            {
              type: "p",
              text: "Depois de criada a conta, pode enviar ao proprietário um convite para o seu próprio acesso. O proprietário inicia sessão então com credenciais próprias e vê exclusivamente os imóveis que lhe estão associados.",
            },
            {
              type: "ul",
              items: [
                "Uma conta de proprietário pode incluir vários imóveis.",
                "Cada imóvel pertence exatamente a um proprietário.",
                "Os dados de contacto e a morada de faturação podem ser ajustados posteriormente a qualquer momento.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Como associar um imóvel existente a um proprietário, veja em [Associar um imóvel a um proprietário](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Associar um imóvel a um proprietário",
          excerpt: "Cada imóvel pertence exatamente a um proprietário — assim configura a associação.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "No myNextDays, cada imóvel pertence exatamente a um proprietário. Não está prevista uma associação múltipla — se um imóvel deve passar a pertencer a outro proprietário, desfaça primeiro a associação existente antes de definir uma nova.",
            },
            { type: "h2", text: "Realizar a associação" },
            {
              type: "steps",
              items: [
                "Abra o imóvel em “Imóveis”.",
                "Mude para o separador “Proprietário”.",
                "Selecione na lista o proprietário responsável.",
                "Confirme a associação.",
                "Guarde a alteração no imóvel.",
              ],
            },
            { type: "h2", text: "Mudança de proprietário" },
            {
              type: "p",
              text: "Se o proprietário de um imóvel mudar, por exemplo devido a uma venda, substitua a associação existente pela nova. As faturações já criadas para períodos passados mantêm-se associadas ao proprietário original.",
            },
            {
              type: "ul",
              items: [
                "Um imóvel só pode estar associado a um proprietário em cada momento.",
                "Sem associação, o imóvel não aparece em nenhum acesso de proprietário.",
                "As faturações passadas mantêm-se junto do proprietário original.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Uma associação múltipla de um imóvel a vários proprietários está excluída — o sistema não permite uma segunda associação em simultâneo.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Faturação do proprietário (extrato)",
          excerpt: "Como criar um extrato com as receitas menos a comissão para um proprietário.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "A faturação do proprietário, também chamada extrato, reúne para um período selecionado todas as receitas dos imóveis associados e deduz a comissão acordada. O resultado é o valor que paga ao proprietário.",
            },
            { type: "h2", text: "Criar o extrato" },
            {
              type: "steps",
              items: [
                "Abra a área “Proprietários” e selecione o proprietário pretendido.",
                "Mude para o separador “Faturação”.",
                "Selecione o período de faturação.",
                "Verifique as reservas e receitas listadas por imóvel.",
                "Gere o extrato com a comissão já deduzida.",
              ],
            },
            { type: "h2", text: "Estrutura do extrato" },
            {
              type: "p",
              text: "Um extrato apresenta, por imóvel, as receitas brutas das reservas, a comissão deduzida e o valor de pagamento resultante. Consoante o acordo, custos adicionais como limpeza ou taxas podem ser apresentados em separado.",
            },
            {
              type: "ul",
              items: [
                "Receitas brutas: soma de todas as reservas no período, por imóvel.",
                "Comissão: a sua parte acordada, deduzida das receitas.",
                "Valor de pagamento: receitas menos comissão e, se aplicável, outros itens.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Os valores no extrato são sempre apresentados na moeda do imóvel — não existe um valor de moeda genérico por defeito.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Crie os extratos regularmente na mesma data de referência, para que os proprietários tenham um ritmo fiável para os seus pagamentos.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Acesso do proprietário",
          excerpt: "O que os proprietários conseguem ver no seu acesso apenas de leitura.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "O acesso do proprietário é um login próprio, apenas de leitura, para o myNextDays. Nele, os proprietários veem exclusivamente os imóveis que lhes estão associados, bem como as respetivas ocupações e faturações — sem possibilidade de alterar configurações por conta própria.",
            },
            { type: "h2", text: "O que os proprietários veem" },
            {
              type: "ul",
              items: [
                "Calendário de ocupação dos seus próprios imóveis.",
                "Extratos criados, com receitas e comissão deduzida.",
                "Dados básicos dos seus imóveis, como equipamento e descrição.",
              ],
            },
            { type: "h2", text: "Ativar o acesso" },
            {
              type: "steps",
              items: [
                "Abra o proprietário em “Proprietários”.",
                "Clique em “Convidar para acesso”.",
                "O proprietário recebe um e-mail para configurar a própria palavra-passe.",
                "Após iniciar sessão, o proprietário vê automaticamente apenas os imóveis que lhe estão associados.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "O acesso do proprietário é estritamente apenas de leitura: preços, disponibilidades ou dados do imóvel só podem ser alterados por si, enquanto operador, e não pelo próprio proprietário.",
            },
            {
              type: "note",
              variant: "info",
              text: "Mais sobre a associação de imóveis em [Associar um imóvel a um proprietário](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
