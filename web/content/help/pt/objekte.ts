import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Imóveis e equipamento",
  description: "Criar e gerir quartos e alojamentos de férias.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Gerir imóveis",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Imóvel = uma unidade reservável",
          excerpt: "Por que cada imóvel no myNextDays é exatamente uma unidade reservável.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "No myNextDays, um imóvel é sempre exatamente uma unidade reservável — um único quarto num hotel ou um alojamento de férias completo. Este princípio aplica-se independentemente de operar uma casa de férias, um apartamento de férias ou um hotel, e é a base para a disponibilidade, os preços e as reservas.",
            },
            { type: "h2", text: "Não é um edifício com quartos por baixo" },
            {
              type: "p",
              text: "Um equívoco comum é representar um edifício de hotel como um único imóvel com vários quartos por baixo. Isso não está previsto no myNextDays. Se, por exemplo, operar um hotel com oito quartos duplos e quatro quartos individuais, cria doze imóveis individuais — e não um imóvel com um número de quartos.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Não existe propositadamente um campo como “número de quartos” ao nível do imóvel. Cada quarto precisa do seu próprio imóvel, com o seu próprio calendário e os seus próprios preços.",
            },
            { type: "h2", text: "Alojamentos de férias" },
            {
              type: "p",
              text: "No caso de uma casa de férias ou de um apartamento de férias, todo o imóvel corresponde à unidade reservável. Não existe aqui mais nenhuma subdivisão — um alojamento de férias é sempre um imóvel independente, com o seu próprio calendário.",
            },
            { type: "h2", text: "Por que isto é importante" },
            {
              type: "ul",
              items: [
                "Cada imóvel tem o seu próprio calendário de disponibilidade — as reservas duplicadas são evitadas com precisão por imóvel.",
                "Os preços, o equipamento e as fotos aplicam-se por imóvel, não por edifício.",
                "Um imóvel pertence sempre exatamente a um proprietário — sem associação múltipla.",
                "A visibilidade por canal (site, mercado da plataforma, portais) é controlada por imóvel.",
              ],
            },
            {
              type: "p",
              text: "Como escolher o tipo de imóvel adequado para o seu quarto ou alojamento de férias, veja em [Definir o tipo de imóvel](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Definir o tipo de imóvel",
          excerpt: "Associar corretamente categoria, tipo de propriedade e tipo de oferta.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "O tipo de imóvel determina como o seu imóvel é classificado e filtrado nos portais e no mercado da plataforma. É composto por três campos de seleção interligados, que percorre ao criar ou editar um imóvel.",
            },
            { type: "h2", text: "Os três níveis de seleção" },
            {
              type: "steps",
              items: [
                "Escolha primeiro a categoria — por exemplo alojamento de férias ou hotel.",
                "Com base nisso, escolha o tipo de propriedade — por exemplo apartamento de férias, casa de férias, quarto duplo ou quarto individual.",
                "Escolha o tipo de oferta — por exemplo o imóvel inteiro ou um quarto privado.",
                "Complete os campos adicionais apresentados consoante a seleção, por exemplo tipo de cama ou piso.",
              ],
            },
            { type: "h2", text: "Por que a ordem é importante" },
            {
              type: "p",
              text: "As três listas dependem umas das outras: a escolha da categoria limita os tipos de propriedade disponíveis, e a escolha do tipo de propriedade limita, por sua vez, os tipos de oferta. Assim, surgem apenas combinações com sentido, como as usadas também nos grandes portais.",
            },
            {
              type: "note",
              variant: "info",
              text: "Se alterar a categoria posteriormente, o myNextDays verifica se o tipo de propriedade e o tipo de oferta ainda são compatíveis e, se necessário, pede-lhe para os selecionar de novo.",
            },
            { type: "h2", text: "Editar o tipo de imóvel" },
            {
              type: "p",
              text: "Abra no menu Imóveis o imóvel pretendido e mude para o separador Dados base. Aí encontra as três listas em Tipo de imóvel. Ao guardar a alteração, a nova classificação é transmitida a todos os canais ativos.",
            },
            {
              type: "ul",
              items: [
                "Categoria: classificação de nível superior (por exemplo alojamento de férias, hotel)",
                "Tipo de propriedade: tipo de imóvel concreto (por exemplo apartamento de férias, quarto duplo)",
                "Tipo de oferta: o que exatamente é reservado (por exemplo imóvel inteiro, quarto privado)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Gerir o equipamento",
          excerpt: "Selecionar as características de equipamento e mantê-las atualizadas.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "O equipamento de um imóvel influencia de forma determinante a facilidade com que este é encontrado e filtrado nos portais. Os hóspedes filtram de forma direcionada por características como Wi-Fi, cozinha ou estacionamento — dados em falta podem excluir um imóvel dos resultados de pesquisa.",
            },
            { type: "h2", text: "Selecionar o equipamento" },
            {
              type: "steps",
              items: [
                "Abra o imóvel e mude para o separador Equipamento.",
                "Selecione todas as características aplicáveis na lista predefinida.",
                "Se necessário, complete detalhes como o número de lugares de estacionamento ou o tipo de cozinha.",
                "Guarde as alterações — são transmitidas automaticamente a todos os portais ativos.",
              ],
            },
            { type: "h2", text: "De onde vêm as características" },
            {
              type: "p",
              text: "A lista de equipamento segue o catálogo de características dos grandes portais, para que os seus dados possam ser corretamente associados lá. Não estão previstas características próprias, criadas livremente, uma vez que não poderiam ser transmitidas de forma limpa aos portais.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Verifique o equipamento depois de cada alteração estrutural — por exemplo um novo ar condicionado ou uma casa de banho adicional — para que os dados se mantenham atualizados em todos os canais.",
            },
            { type: "h2", text: "Grupos de características comuns" },
            {
              type: "ul",
              items: [
                "Equipamento básico: Wi-Fi, aquecimento, ar condicionado",
                "Cozinha e alimentação: cozinha totalmente equipada, máquina de lavar loiça, máquina de café",
                "Casa de banho e roupa: casa de banho privativa, máquina de lavar roupa, toalhas",
                "Área exterior: varanda, terraço, jardim, estacionamento",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Fotos e descrição",
          excerpt: "Imagens e textos convincentes para mais reservas.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "As fotos e a descrição são o critério de decisão mais importante para os hóspedes. Um imóvel só pode ser publicado quando estiverem registados pelo menos uma foto de capa e uma descrição.",
            },
            { type: "h2", text: "Carregar fotos" },
            {
              type: "steps",
              items: [
                "Abra o imóvel e mude para o separador Fotos.",
                "Arraste os ficheiros de imagem para a área de carregamento ou selecione-os através do seletor de ficheiros.",
                "Defina uma foto de capa — esta aparece nos resultados de pesquisa e nos cartões.",
                "Ordene as restantes fotos arrastando-as, numa sequência com sentido.",
              ],
            },
            { type: "h2", text: "Redigir a descrição" },
            {
              type: "p",
              text: "Mude para o separador Descrição e indique um título e um texto corrido. Descreva de forma concreta a localização, as particularidades e o público-alvo do imóvel — frases genéricas resultam menos convincentes nos portais do que detalhes concretos.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Não podem ser usadas fotos de outros imóveis nem retiradas da internet — os portais verificam isto e podem bloquear imóveis em caso de infração.",
            },
            { type: "h2", text: "Recomendações para boas fotos" },
            {
              type: "ul",
              items: [
                "Pelo menos cinco fotos, idealmente uma por cada divisão",
                "Formato horizontal, boa iluminação, sem marcas de água",
                "A foto de capa mostra o imóvel da forma mais convidativa e clara possível",
                "Atualize regularmente, sobretudo após renovações",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Ocupação e capacidade",
          excerpt: "Registar corretamente o número máximo de hóspedes e a distribuição de camas.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "A ocupação define quantos hóspedes um imóvel pode acolher e é verificada em cada pesquisa e reserva. Dados incorretos levam a pedidos recusados ou a sobreocupação — deve evitar ambas as situações.",
            },
            { type: "h2", text: "Registar a ocupação" },
            {
              type: "steps",
              items: [
                "Abra o imóvel e mude para o separador Ocupação.",
                "Indique o número máximo de adultos.",
                "Indique o número máximo de crianças, caso sejam permitidas.",
                "Registe a distribuição de camas por divisão, por exemplo uma cama de casal e duas camas individuais.",
              ],
            },
            { type: "h2", text: "Limites da ocupação" },
            {
              type: "p",
              text: "Num pedido de reserva, o myNextDays verifica automaticamente se o número de hóspedes solicitado está dentro da ocupação registada. Os pedidos que excedam a capacidade máxima são recusados, ou nem sequer chegam a ser apresentados como reserváveis.",
            },
            {
              type: "note",
              variant: "info",
              text: "Uma cama extra ou uma cama de bebé só aumenta a capacidade real se a registar explicitamente na distribuição de camas — caso contrário, o número máximo de hóspedes mantém-se inalterado.",
            },
            { type: "h2", text: "Fontes de erro típicas" },
            {
              type: "ul",
              items: [
                "Número máximo de hóspedes definido demasiado alto, apesar de haver poucas camas",
                "Número de crianças esquecido, apesar de o imóvel se dirigir a famílias",
                "Distribuição de camas não atualizada após uma renovação",
              ],
            },
            {
              type: "p",
              text: "Se a ocupação e o equipamento não estiverem alinhados, verifique também o separador [Equipamento](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Estado do imóvel e visibilidade",
          excerpt: "Diferença entre ativo/inativo e os três eixos de canal.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "O myNextDays distingue duas coisas diferentes, frequentemente confundidas: o estado do imóvel (ativo ou inativo) e a visibilidade em canais de vendas individuais. Ambos são controlados separadamente.",
            },
            { type: "h2", text: "Estado do imóvel" },
            {
              type: "p",
              text: "O estado ativo significa que um imóvel está, em princípio, apto para venda. O estado inativo coloca um imóvel completamente fora de serviço — por exemplo durante uma renovação de longa duração. Um imóvel inativo não pode ser reservado em nenhum canal, independentemente dos interruptores de canal.",
            },
            { type: "h2", text: "Os três eixos de canal" },
            {
              type: "p",
              text: "Se um imóvel estiver ativo, três interruptores independentes decidem onde exatamente é visível:",
            },
            {
              type: "ul",
              items: [
                "Site — visibilidade no seu próprio site myNextDays",
                "Mercado da plataforma — visibilidade no mercado global myNextDays",
                "Portais — visibilidade no Booking, Airbnb e outros",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Estes três eixos são totalmente independentes do estado do imóvel e uns dos outros. Um imóvel ativo pode, por exemplo, estar visível apenas no site, mas não nos portais.",
            },
            { type: "h2", text: "Alterar o estado" },
            {
              type: "steps",
              items: [
                "Abra o imóvel e mude para o separador Visão geral.",
                "Defina o estado como ativo ou inativo.",
                "Se necessário, ajuste também os três interruptores de canal no separador Visibilidade.",
                "Guarde a alteração — aplica-se de imediato a todos os canais afetados.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Para bloquear dias individuais a curto prazo, use antes o bloqueio de vendas no calendário — isso bloqueia dias de forma direcionada em todos os canais, sem desativar o imóvel inteiro.",
            },
          ],
        },
      ],
    },
  ],
};
