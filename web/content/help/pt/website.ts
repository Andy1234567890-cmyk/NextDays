import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Construtor de sites",
  description: "Criar o seu próprio site de reservas com o construtor.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Construtor de sites",
      articles: [
        {
          slug: "website-erstellen",
          title: "Criar um site",
          excerpt: "Com o construtor, cria em poucos minutos o seu próprio site de reservas.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "O construtor de sites cria para si o seu próprio site de reservas — um canal de vendas adicional, ao lado dos portais e do mercado myBestDays. Mantém o controlo total sobre a estrutura, os conteúdos e a identidade visual.",
            },
            { type: "h2", text: "Como criar um site" },
            {
              type: "steps",
              items: [
                "Abra Site no menu.",
                "Clique em Criar site.",
                "Escolha um modelo como ponto de partida para o seu layout.",
                "Confirme com Criar site — é encaminhado diretamente para o editor.",
              ],
            },
            { type: "h2", text: "O que o construtor inclui" },
            {
              type: "ul",
              items: [
                "Um editor visual com páginas, camadas e vista de pré-visualização",
                "Blocos pré-construídos para listas de imóveis, galerias e formulários de contacto",
                "Um percurso de reserva direto, baseado na disponibilidade do seu calendário",
                "Cores, tipos de letra e logótipo personalizáveis, adequados à sua marca",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Comece com um modelo próximo do seu tipo de imóvel — alojamento de férias ou hotel — isso poupa-lhe tempo mais tarde ao ajustar os blocos.",
            },
            { type: "h2", text: "Próximos passos" },
            {
              type: "p",
              text: "Depois de criar, ajuste páginas e layout, ver [Editar páginas e layout](/hilfe/website/seiten-layout), e mostre os seus imóveis no site, ver [Mostrar imóveis no site](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Editar páginas e layout",
          excerpt: "Ajustar páginas, camadas e blocos no editor visual.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "O editor divide-se em três áreas: à esquerda, a visão geral de páginas e camadas; ao centro, a pré-visualização do seu site; à direita, as configurações do bloco atualmente selecionado.",
            },
            { type: "h2", text: "Editar uma página" },
            {
              type: "steps",
              items: [
                "Escolha à esquerda, em Páginas, a página pretendida.",
                "Clique num bloco na pré-visualização para o selecionar.",
                "Ajuste à direita o texto, a imagem ou o espaçamento do bloco.",
                "Arraste os blocos para alterar a ordem.",
              ],
            },
            { type: "h2", text: "Adicionar novas páginas e blocos" },
            {
              type: "p",
              text: "Através do botão Adicionar página, cria mais subpáginas, por exemplo Sobre nós ou Contacto. Dentro de uma página, insere através de Adicionar bloco novas secções, como Galeria, Avaliações ou Formulário de contacto.",
            },
            {
              type: "ul",
              items: [
                "Página inicial, visão geral de imóveis e contacto vêm pré-configuradas em todos os modelos",
                "As restantes páginas podem ser livremente nomeadas e incluídas na navegação",
                "Os blocos são responsivos e adaptam-se a computador, tablet e smartphone",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "As alterações no editor são inicialmente apenas um rascunho. Só um clique em Publicar as aplica ao seu site público.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Associar um domínio",
          excerpt: "Associar um domínio próprio ao seu site myNextDays.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Por predefinição, o seu site está acessível através de um subdomínio myNextDays. Se preferir usar um domínio próprio, como por exemplo o-seu-negocio.pt, associe-o na área Domínio.",
            },
            { type: "h2", text: "Registar o domínio" },
            {
              type: "steps",
              items: [
                "Abra no site as configurações e, aí, Domínio.",
                "Introduza o seu domínio próprio e clique em Associar.",
                "Configure junto do seu fornecedor de domínio os registos DNS apresentados.",
                "Aguarde pela confirmação — a verificação é feita automaticamente em segundo plano.",
              ],
            },
            { type: "h2", text: "Configurar corretamente os registos DNS" },
            {
              type: "p",
              text: "O myNextDays mostra-lhe exatamente os registos necessários para o seu fornecedor de domínio. A associação só fica ativa quando estes registos estiverem corretamente configurados e propagados globalmente — isso pode demorar algumas horas, dependendo do fornecedor.",
            },
            {
              type: "ul",
              items: [
                "Configurar o registo CNAME ou A conforme as instruções apresentadas",
                "Remover previamente registos existentes e contraditórios para o mesmo domínio",
                "O certificado para https é emitido automaticamente após a associação ser bem-sucedida",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Sem os registos DNS corretamente configurados, o seu site não fica acessível através do domínio próprio — verifique cuidadosamente a grafia face às informações do seu fornecedor.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Mostrar imóveis no site",
          excerpt: "Quais os imóveis visíveis e reserváveis através do site é controlado separadamente por imóvel.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Para que um imóvel apareça no seu site, a visibilidade no site tem de estar ativada para esse imóvel. Este interruptor é independente da visibilidade no mercado myBestDays ou nos portais.",
            },
            { type: "h2", text: "Ativar o imóvel para o site" },
            {
              type: "steps",
              items: [
                "Abra o imóvel em Imóveis.",
                "Mude para o separador Visibilidade.",
                "Ative o interruptor Site.",
                "Mude para o site e verifique o bloco Visão geral de imóveis na pré-visualização.",
              ],
            },
            { type: "h2", text: "Ajustar ordem e apresentação" },
            {
              type: "p",
              text: "No bloco Visão geral de imóveis, define se os imóveis são ordenados automaticamente pela disponibilidade ou se define uma ordem fixa. Cada imóvel mostra a foto de capa, o preço base na sua moeda registada e as principais características de equipamento.",
            },
            {
              type: "ul",
              items: [
                "Ordenação automática por disponibilidade ou ordem manual",
                "Filtro por tipo de imóvel ou equipamento ativável opcionalmente",
                "Os passos de reserva decorrem diretamente no site, sem passar por um portal",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Um imóvel sem a visibilidade no site ativada permanece oculto na visão geral de imóveis, mesmo que esteja visível no mercado ou nos portais.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Publicar o site",
          excerpt: "Os rascunhos só se tornam publicamente visíveis com um clique em Publicar.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Enquanto trabalha no editor, só você vê o rascunho atual. Só um clique em Publicar torna as alterações visíveis, no seu domínio, para todos os visitantes.",
            },
            { type: "h2", text: "Como publicar" },
            {
              type: "steps",
              items: [
                "Abra no editor a pré-visualização e verifique todas as páginas.",
                "Clique em Publicar, no canto superior direito.",
                "Confirme a caixa de diálogo — o site fica em direto imediatamente a seguir.",
                "Abra o seu domínio num novo separador para verificar o resultado.",
              ],
            },
            { type: "h2", text: "Rascunhos e reposição" },
            {
              type: "p",
              text: "Enquanto ainda não publicou, pode a qualquer momento voltar à última versão publicada, sem perder definitivamente o rascunho — use para isso Descartar rascunho nas configurações do site.",
            },
            {
              type: "ul",
              items: [
                "As alterações publicadas ficam de imediato visíveis no seu domínio",
                "Um rascunho não publicado mantém-se interno até o confirmar",
                "Cada publicação fica registada com data no histórico",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Verifique a vista móvel na pré-visualização antes de publicar — a maioria dos hóspedes acede a sites de reservas através do smartphone.",
            },
          ],
        },
      ],
    },
  ],
};
