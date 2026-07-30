import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portais e gestor de canais",
  description: "Controlar centralmente o Booking, o Airbnb, a Expedia e outros.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Ligar portais",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "O que é o gestor de canais?",
          excerpt:
            "O gestor de canais sincroniza automaticamente preços, disponibilidade e reservas entre o myNextDays e os portais.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Uma ligação para todos os portais" },
            {
              type: "p",
              text: "O gestor de canais é a ponte entre o myNextDays e os grandes portais de reservas como Booking, Airbnb e outros. Em vez de gerir preços, disponibilidade e ocupação individualmente em cada portal, regista tudo uma vez no myNextDays — o gestor de canais distribui-o automaticamente por todos os portais ligados.",
            },
            { type: "h2", text: "O que é sincronizado automaticamente" },
            {
              type: "ul",
              items: [
                "Disponibilidade — cada reserva bloqueia a noite de imediato em todos os portais",
                "Preços e estadias mínimas do seu calendário de preços",
                "As reservas de portal recebidas são importadas automaticamente para o myNextDays",
                "Cancelamentos e bloqueio de vendas aplicam-se de forma transversal aos canais",
              ],
            },
            { type: "h2", text: "O que deixa de precisar de fazer manualmente" },
            {
              type: "p",
              text: "Sem o gestor de canais, teria de bloquear manualmente a noite em cada portal após cada reserva — um motivo frequente de reservas duplicadas. Com o gestor de canais ativo, o myNextDays trata desta sincronização em ambos os sentidos, várias vezes por dia e em tempo real em novas reservas.",
            },
            {
              type: "note",
              variant: "info",
              text: "A ligação aos portais é configurada uma única vez, válida para toda a conta. Para cada imóvel individual, ativa depois apenas a associação (mapping) — mais sobre isto em [Associar um imóvel a um portal](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Configurar a ligação a portais",
          excerpt:
            "A ligação aos portais configura-se uma vez, válida para toda a conta — não é preciso repetir para cada imóvel.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Uma única vez para toda a conta" },
            {
              type: "p",
              text: "A ligação aos portais é uma configuração válida para toda a conta: liga a sua conta myNextDays ao gestor de canais exatamente uma vez. Todos os imóveis que criar mais tarde utilizam automaticamente essa mesma ligação — não precisa de a configurar de novo por imóvel.",
            },
            { type: "h2", text: "Como configurar a ligação" },
            {
              type: "steps",
              items: [
                "Abra /konto e escolha a secção “Portais e gestor de canais”",
                "Clique em “Configurar ligação” e confirme os dados do seu negócio (morada, contacto, forma jurídica)",
                "Verifique os dados base assumidos automaticamente — são transmitidos a todos os portais",
                "Conclua a configuração; o estado muda para “Ligado”",
              ],
            },
            { type: "h2", text: "Próximo passo: associar imóveis" },
            {
              type: "p",
              text: "Depois da configuração única, ainda nenhum imóvel está visível — para isso, associa cada imóvel individualmente a um portal (mapping) e liga os portais pretendidos, como o Booking.com ou o Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Sem dados base completos (morada, dados fiscais, contacto), os portais recusam a ligação. Verifique primeiro estes dados em /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Associar um imóvel a um portal",
          excerpt:
            "Depois da ligação válida para toda a conta, ativa por imóvel apenas a associação ao respetivo portal.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Associação em vez de nova ligação" },
            {
              type: "p",
              text: "Uma vez configurada a ligação aos portais para toda a conta, cada imóvel passa a ser ligado apenas através de uma chamada associação (mapping): define qual o imóvel do myNextDays que corresponde a qual tipo de quarto ou de oferta no portal. Este passo é feito uma única vez por imóvel.",
            },
            { type: "h2", text: "Como associar um imóvel" },
            {
              type: "steps",
              items: [
                "Abra o imóvel em /objekte e mude para o separador “Portais”",
                "Escolha o portal pretendido, por exemplo o Booking.com ou o Airbnb",
                "Associe o imóvel ao tipo de quarto ou de oferta correspondente no portal",
                "Ative a sincronização — os preços e a disponibilidade passam a ser transmitidos a partir de agora",
              ],
            },
            { type: "h2", text: "Um imóvel, vários portais" },
            {
              type: "p",
              text: "Um único imóvel pode estar associado a vários portais em simultâneo. Cada associação é independente — pode, por exemplo, tornar um imóvel visível no Booking.com e no Airbnb, mas deixá-lo desativado na Expedia por enquanto.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Depois da associação, verifique diretamente a visibilidade — ver [Visibilidade por portal](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Ligar o Booking.com",
          excerpt: "Como ativar o Booking.com como canal de vendas para um imóvel.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Requisito: ligação válida para toda a conta" },
            {
              type: "p",
              text: "Antes de ativar o Booking.com para um imóvel, a ligação a portais válida para toda a conta tem de estar configurada (ver [Configurar a ligação a portais](/hilfe/portale-kanalmanager/portal-verbindung)). Depois disso, o Booking.com passa a ser, para cada novo imóvel, apenas uma questão de associação.",
            },
            { type: "h2", text: "Ativar o Booking.com" },
            {
              type: "steps",
              items: [
                "Abra o imóvel em /objekte, separador “Portais”",
                "Escolha “Booking.com” na lista de portais disponíveis",
                "Associe o tipo de quarto ou de oferta correspondente e confirme os planos de tarifas",
                "Ative a visibilidade — o imóvel fica ativo após a verificação pelo Booking.com",
              ],
            },
            { type: "h2", text: "O que o Booking.com espera de si" },
            {
              type: "ul",
              items: [
                "Descrição completa do imóvel, imagens e equipamento",
                "Pelo menos uma tarifa com preço e condições de cancelamento",
                "Um método de pagamento válido para as comissões",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A ativação por parte do Booking.com pode demorar algumas horas. O estado no separador “Portais” do imóvel mostra se a ligação já está ativa.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Ligar o Airbnb",
          excerpt: "Como tornar um imóvel reservável no Airbnb através do gestor de canais.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Airbnb como mais um portal" },
            {
              type: "p",
              text: "O Airbnb é ligado como qualquer outro portal, através da ligação válida para toda a conta. Uma vez configurada, ativa o Airbnb por imóvel através da associação — independentemente de o imóvel já estar visível no Booking.com ou noutros portais.",
            },
            { type: "h2", text: "Ativar o Airbnb para um imóvel" },
            {
              type: "steps",
              items: [
                "Abra o imóvel em /objekte, separador “Portais”",
                "Escolha “Airbnb” na lista de portais disponíveis",
                "Confirme a categoria do imóvel e o tipo de oferta associado",
                "Verifique fotos, equipamento e regras da casa — o Airbnb exige dados completos antes da ativação",
                "Ative a visibilidade para o Airbnb",
              ],
            },
            { type: "h2", text: "Depois da ativação" },
            {
              type: "p",
              text: "Assim que o Airbnb aprovar o imóvel, os preços e a disponibilidade passam a ser geridos automaticamente pelo gestor de canais. As reservas feitas no Airbnb aparecem depois automaticamente no seu calendário de reservas.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Sem condições de cancelamento e regras da casa registadas, o Airbnb recusa a ativação. Complete primeiro estes dados no imóvel.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Sincronizar preços e disponibilidade",
          excerpt:
            "Os preços e a disponibilidade são transmitidos automaticamente a todos os portais ligados.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Um calendário, todos os portais" },
            {
              type: "p",
              text: "Gere os preços e a disponibilidade exclusivamente no calendário myNextDays do respetivo imóvel. O gestor de canais transmite automaticamente cada alteração a todos os portais aos quais o imóvel está ativamente associado — sem que tenha de introduzir nada em duplicado.",
            },
            { type: "h2", text: "O que é transmitido" },
            {
              type: "ul",
              items: [
                "Preços diários do seu calendário de preços ou dos planos de tarifas",
                "Noites disponíveis e bloqueios",
                "Estadia mínima e restrições de chegada/partida",
                "Dias com bloqueio de vendas — estes bloqueiam automaticamente em todos os portais",
              ],
            },
            { type: "h2", text: "Com que rapidez a sincronização atua" },
            {
              type: "p",
              text: "As alterações de preços e disponibilidade são transmitidas aos portais em poucos minutos. Novas reservas bloqueiam de imediato as noites em causa, para que a mesma noite não possa voltar a ser vendida em nenhum outro canal.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Mais sobre o bloqueio transversal de dias individuais em [Evitar reservas duplicadas](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Receber reservas de portal",
          excerpt: "As reservas do Booking, do Airbnb e de outros chegam automaticamente ao seu calendário.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Importação automática" },
            {
              type: "p",
              text: "Se um hóspede reservar através de um portal como o Booking.com ou o Airbnb, o gestor de canais importa a reserva automaticamente para o myNextDays. Não precisa de transferir nada manualmente — a reserva aparece no calendário e na lista de reservas do imóvel em causa.",
            },
            { type: "h2", text: "O que acontece numa reserva de portal" },
            {
              type: "steps",
              items: [
                "O portal comunica a nova reserva ao gestor de canais",
                "O myNextDays cria a reserva com os dados do hóspede, o período e o preço",
                "As noites reservadas são bloqueadas de imediato em todos os outros canais",
                "Recebe uma notificação e encontra a reserva no calendário",
              ],
            },
            { type: "h2", text: "Cancelamentos e alterações" },
            {
              type: "p",
              text: "Se o hóspede cancelar através do portal ou alterar o período, isso também é transmitido automaticamente ao myNextDays e as noites em causa voltam a ficar disponíveis.",
            },
            {
              type: "note",
              variant: "info",
              text: "As reservas de portal são reconhecíveis nos detalhes da reserva pela sua etiqueta de origem, por exemplo Booking.com ou Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Evitar reservas duplicadas",
          excerpt: "O bloqueio de vendas e os bloqueios automáticos evitam reservas duplicadas entre vários portais.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Por que surgem reservas duplicadas" },
            {
              type: "p",
              text: "Sem um controlo centralizado, acontece facilmente a mesma noite ser vendida em dois portais ao mesmo tempo — por exemplo quando os preços e a disponibilidade são geridos manualmente em vários sistemas. O gestor de canais fecha esta lacuna, fazendo com que cada reserva, em qualquer canal, bloqueie de imediato todos os outros canais.",
            },
            { type: "h2", text: "As suas ferramentas contra reservas duplicadas" },
            {
              type: "ul",
              items: [
                "Bloqueio automático: cada nova reserva — independentemente do canal — bloqueia as noites em todo o lado",
                "Bloqueio de vendas: bloqueia manualmente um dia em todos os canais ao mesmo tempo, por exemplo para uso próprio ou manutenção",
                "A estadia mínima e as restrições de chegada evitam reservas curtas inadequadas",
              ],
            },
            { type: "h2", text: "Definir o bloqueio de vendas" },
            {
              type: "steps",
              items: [
                "Abra o calendário de ocupação do imóvel",
                "Marque o dia ou o período em causa",
                "Escolha “Bloqueio de vendas” — o dia fica então bloqueado em todos os portais, bem como no site e na plataforma",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "O bloqueio de vendas aplica-se sem exceção a todos os canais. Não existe forma de bloquear um dia apenas num único portal e deixá-lo aberto nos restantes.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Visibilidade por portal",
          excerpt: "Cada portal pode ser ativado ou desativado independentemente do site e do mercado da plataforma.",
          updated: "Atualizado: julho de 2026",
          body: [
            { type: "h2", text: "Três caminhos de vendas independentes" },
            {
              type: "p",
              text: "Um imóvel pode ser vendido simultaneamente por vários caminhos: através dos portais (Booking, Airbnb e outros), através do mercado da plataforma myNextDays e através do seu próprio site. Cada caminho tem o seu próprio interruptor de visibilidade — são totalmente independentes uns dos outros.",
            },
            { type: "h2", text: "Controlar a visibilidade por portal" },
            {
              type: "p",
              text: "Dentro dos portais, cada portal individual pode também ser ativado ou desativado em separado. Um imóvel pode, por exemplo, estar ativo no Booking.com mas desativado no Airbnb — ambas as associações mantêm-se inalteradas.",
            },
            { type: "h2", text: "Como alterar a visibilidade" },
            {
              type: "steps",
              items: [
                "Abra o imóvel em /objekte, separador “Portais”",
                "Ative ou desative individualmente o canal pretendido (portal individual, site ou mercado da plataforma)",
                "Guarde — a alteração aplica-se em poucos minutos",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "O estado do imóvel (ativo/inativo), bem como o bloqueio de vendas, aplicam-se de forma superior a todos os canais. Os interruptores de visibilidade controlam apenas em que canais adicionais aparece um imóvel já ativo.",
            },
          ],
        },
      ],
    },
  ],
};
