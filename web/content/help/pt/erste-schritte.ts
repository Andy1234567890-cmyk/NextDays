import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Primeiros passos",
  description: "Configurar a conta e começar em poucos minutos.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Configuração",
      articles: [
        {
          slug: "willkommen",
          title: "Bem-vindo ao myNextDays",
          excerpt: "Uma visão geral do PMS, do gestor de canais, da plataforma e da app.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "O myNextDays é a sua plataforma central para alojamentos de férias e hotéis. Em vez de várias soluções isoladas, gere disponibilidade, preços, reservas e comunicação com hóspedes num só lugar — quer opere uma única casa de férias ou vários quartos de hotel.",
            },
            { type: "h2", text: "Os quatro pilares" },
            {
              type: "ul",
              items: [
                "PMS (sistema de gestão de imóveis): imóveis, calendário, preços, reservas, tarefas e pagamentos.",
                "Gestor de canais: ligação a portais como Booking, Airbnb e outros — um único registo, vários portais sincronizados.",
                "Mercado da plataforma: o próprio mercado myBestDays, um canal de reserva ao mesmo nível dos portais.",
                "App: a aplicação móvel para hóspedes, proprietários e colaboradores, com os mesmos dados que na web.",
              ],
            },
            { type: "h2", text: "Como os pilares funcionam em conjunto" },
            {
              type: "p",
              text: "Gere o imóvel, os preços e a disponibilidade uma única vez, de forma centralizada, no PMS. A partir daí, o myNextDays distribui automaticamente os dados por todos os canais ativos. Uma reserva — seja qual for o canal por onde entra — bloqueia de imediato as noites correspondentes em todo o lado, de modo que reservas duplicadas ficam excluídas.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Comece por configurar a conta e o negócio e só depois crie o seu primeiro imóvel — esta ordem poupa-lhe correções mais tarde.",
            },
            { type: "h2", text: "Próximos passos" },
            {
              type: "steps",
              items: [
                "Abra Conta no menu e complete os dados do seu negócio.",
                "Crie o seu primeiro imóvel em Imóveis.",
                "Verifique se o equipamento, as fotos e os preços estão completos.",
                "Clique em Publicar para tornar o imóvel visível em todos os canais.",
              ],
            },
            {
              type: "p",
              text: "Mais sobre cada passo em [Configurar a conta e o negócio](/hilfe/erste-schritte/konto-einrichten) e [Criar o seu primeiro imóvel](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Configurar a conta e o negócio",
          excerpt: "Registar corretamente os dados base, a morada de faturação e a moeda.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Antes de criar imóveis, configure o seu negócio na conta. Estes dados são necessários para faturas, portais e a faturação com o myNextDays, e por isso devem estar completos e corretos.",
            },
            { type: "h2", text: "Registar os dados base" },
            {
              type: "steps",
              items: [
                "Abra Conta no menu.",
                "Em Dados base, indique o nome da empresa ou o nome do empresário em nome individual, morada e dados de contacto.",
                "Registe a morada de faturação — ela aparece em todas as faturas emitidas.",
                "Escolha a sua moeda base. Esta aplica-se a todos os preços, até a alterar de forma específica por imóvel.",
              ],
            },
            { type: "h2", text: "Por que motivo a moeda é importante" },
            {
              type: "p",
              text: "A moeda não é adivinhada nem preenchida automaticamente: se estiver em falta, nenhum preço pode ser apresentado ou faturado corretamente. Por isso, o myNextDays exige uma escolha consciente na configuração, em vez de aplicar um valor padrão.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Se alterar a moeda de um imóvel posteriormente, todos os planos de preços associados são também alterados. Verifique os preços de novo depois disso.",
            },
            { type: "h2", text: "Morada de faturação e faturação" },
            {
              type: "p",
              text: "Em Faturação, na conta, vê as suas faturas em curso e a morada de faturação registada. Mantenha-a atualizada, sobretudo em caso de alteração da forma jurídica ou da morada, para que as faturas sejam emitidas corretamente.",
            },
            {
              type: "ul",
              items: [
                "Nome da empresa ou nome do empresário em nome individual",
                "Morada de faturação com país",
                "Número de identificação fiscal ou de IVA, se aplicável",
                "Moeda base para novos imóveis",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Criar o seu primeiro imóvel",
          excerpt: "Como criar, passo a passo, o seu primeiro imóvel reservável.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Um imóvel no myNextDays é sempre exatamente uma unidade reservável: ou um único quarto num hotel, ou um alojamento de férias completo. Se operar um hotel com vários quartos, crie um imóvel próprio para cada quarto.",
            },
            { type: "h2", text: "Criar o imóvel" },
            {
              type: "steps",
              items: [
                "Abra Imóveis no menu.",
                "Clique em Adicionar imóvel.",
                "Escolha o tipo de imóvel: categoria, tipo de propriedade e tipo de oferta.",
                "Complete morada, capacidade e preço base na moeda registada.",
                "Guarde o imóvel como rascunho para o completar mais tarde.",
              ],
            },
            { type: "h2", text: "O que ainda falta depois" },
            {
              type: "p",
              text: "Um imóvel recém-criado é inicialmente um rascunho e não está visível em nenhum canal. Complete equipamento, fotos, descrição e disponibilidade no calendário antes de o publicar — só um imóvel completo pode ser divulgado de forma fiável.",
            },
            {
              type: "ul",
              items: [
                "Selecionar as características de equipamento a partir da lista de categorias",
                "Registar pelo menos uma foto de capa e uma descrição",
                "Indicar corretamente a capacidade (adultos, crianças, camas)",
                "Verificar o preço base e a disponibilidade no calendário",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Se operar vários tipos de quarto, repita este processo para cada quarto individual — não existe um nível de edifício superior com quartos por baixo.",
            },
            {
              type: "p",
              text: "Com todos os campos obrigatórios preenchidos, pode publicar o imóvel — ver [Publicar um imóvel](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Publicar um imóvel",
          excerpt: "Um clique ativa em conjunto o mercado da plataforma, os portais e o site.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Publicar torna um imóvel visível e reservável. Normalmente, um único clique basta para ativar os três canais de vendas em simultâneo — mas pode sempre ajustar a visibilidade de cada canal individualmente.",
            },
            { type: "h2", text: "Como publicar" },
            {
              type: "steps",
              items: [
                "Abra o imóvel em Imóveis.",
                "No separador Visão geral, verifique se todas as informações obrigatórias estão marcadas a verde.",
                "Clique em Publicar.",
                "Confirme a caixa de diálogo — o mercado da plataforma, os portais e o site são ativados.",
              ],
            },
            { type: "h2", text: "Controlar os canais individualmente" },
            {
              type: "p",
              text: "Depois de publicar, encontra no separador Visibilidade três interruptores separados: Site, Mercado da plataforma e Portais. Se, por exemplo, quiser oferecer um imóvel apenas no seu próprio site, mas não através de portais, basta desativar o interruptor correspondente.",
            },
            {
              type: "ul",
              items: [
                "Site: visibilidade no seu próprio site myNextDays",
                "Mercado da plataforma: visibilidade no mercado global myBestDays",
                "Portais: visibilidade no Booking, Airbnb e outros",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Estes três interruptores são independentes do estado do imóvel (ativo/inativo). Um imóvel ativo pode, ainda assim, estar invisível em canais individuais.",
            },
            { type: "h2", text: "Bloquear um imóvel temporariamente" },
            {
              type: "p",
              text: "Se quiser bloquear apenas um dia em vez de todo o imóvel, use o bloqueio de vendas no calendário — isso bloqueia o dia em todos os canais ao mesmo tempo, independentemente dos interruptores de visibilidade.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Compreender os três canais de vendas",
          excerpt: "Portais, mercado da plataforma e app numa visão geral.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "O myNextDays divulga cada imóvel simultaneamente através de vários caminhos ao mesmo nível. Compreender como funcionam em conjunto ajuda-o a controlar de forma direcionada a visibilidade e os preços.",
            },
            { type: "h2", text: "Portais" },
            {
              type: "p",
              text: "Através do gestor de canais, liga o seu imóvel a grandes portais de reserva como Booking, Airbnb e outros. A disponibilidade e os preços são sincronizados automaticamente, para não ter de gerir manualmente vários calendários de portais.",
            },
            { type: "h2", text: "Mercado da plataforma" },
            {
              type: "p",
              text: "O mercado myBestDays é um canal de reserva próprio e global — comparável ao Booking ou ao Airbnb, mas fazendo parte da mesma plataforma. Não é um substituto de “reserva direta”, mas sim um canal ao mesmo nível, com o seu próprio eixo de visibilidade.",
            },
            { type: "h2", text: "App" },
            {
              type: "p",
              text: "A aplicação móvel dá a hóspedes, proprietários e colaboradores acesso aos mesmos dados que a web — por exemplo detalhes de reservas, mensagens ou tarefas, consoante o respetivo perfil.",
            },
            { type: "h2", text: "Três eixos de visibilidade separados" },
            {
              type: "ul",
              items: [
                "Site — o seu próprio site myNextDays",
                "Mercado da plataforma — o mercado global myBestDays",
                "Portais — Booking, Airbnb e outros, através do gestor de canais",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Os três eixos podem ser ativados ou desativados de forma independente. Em contrapartida, o bloqueio de vendas e o estado do imóvel aplicam-se de forma transversal aos três canais em simultâneo.",
            },
          ],
        },
      ],
    },
  ],
};
