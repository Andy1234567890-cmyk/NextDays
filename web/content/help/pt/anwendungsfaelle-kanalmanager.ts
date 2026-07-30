import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Gestor de canais",
  description: "Dominar portais e o gestor de canais.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Gestor de canais",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Ligar o seu primeiro portal",
          excerpt: "Como ativar pela primeira vez um portal para um imóvel.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial: já criou um imóvel, mas ainda não ligou nenhum portal",
            },
            {
              type: "p",
              text: "O seu imóvel está totalmente configurado no myNextDays, mas ainda não está visível em nenhum portal como Booking.com ou Airbnb. Antes de um portal aceitar um imóvel, a sua conta precisa, uma única vez, de uma ligação a portais válida para toda a conta — depois disso, cada novo imóvel só precisa de uma associação (mapping).",
            },
            {
              type: "steps",
              items: [
                "Abra /konto, secção “Portais e gestor de canais”, e configure a ligação válida para toda a conta com os dados do seu negócio",
                "Depois, abra o imóvel em /objekte e mude para o separador “Portais”",
                "Escolha o portal pretendido e associe-o ao tipo de quarto ou de oferta correspondente",
                "Verifique fotos, equipamento, preços e condições de cancelamento — os portais exigem dados completos",
                "Ative a visibilidade; o estado muda para “Ligado” depois da verificação pelo portal",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A ligação válida para toda a conta configura-se apenas uma vez. Detalhes em [Ligar o Booking.com](/hilfe/portale-kanalmanager/booking-verbinden) e [Ligar o Airbnb](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Ligar o Booking.com",
          excerpt: "Como tornar um imóvel reservável no Booking.com através do gestor de canais.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial: o seu imóvel deve também ficar visível no Booking.com",
            },
            {
              type: "p",
              text: "O Booking.com é um dos portais ligados através do gestor de canais. É necessária a ligação válida para toda a conta — se esta já estiver configurada, só precisa de uma associação por imóvel para o Booking.com.",
            },
            {
              type: "steps",
              items: [
                "Abra o imóvel em /objekte, separador “Portais”",
                "Escolha “Booking.com” na lista de portais disponíveis",
                "Associe o tipo de quarto ou de oferta correspondente e confirme pelo menos uma tarifa com preço e condições de cancelamento",
                "Registe um método de pagamento válido para a faturação da comissão",
                "Ative a visibilidade para o Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A ativação por parte do Booking.com pode demorar algumas horas. O estado no separador “Portais” mostra assim que a ligação estiver ativa.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Ligar o Airbnb",
          excerpt: "Como tornar um imóvel reservável no Airbnb através do gestor de canais.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial: o seu imóvel deve também ficar visível no Airbnb",
            },
            {
              type: "p",
              text: "O Airbnb é ligado como qualquer outro portal, através da ligação válida para toda a conta. Uma vez configurada, ativa o Airbnb por imóvel através de uma associação (mapping) — independentemente de o imóvel já estar visível no Booking.com ou noutros portais.",
            },
            {
              type: "steps",
              items: [
                "Abra o imóvel em /objekte, separador “Portais”",
                "Escolha “Airbnb” na lista de portais disponíveis",
                "Confirme a categoria do imóvel e o tipo de oferta associado",
                "Complete fotos, equipamento e regras da casa — o Airbnb exige dados completos antes da ativação",
                "Ative a visibilidade para o Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Sem condições de cancelamento e regras da casa registadas, o Airbnb recusa a ativação. Complete primeiro estes dados no imóvel.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Manter os preços sincronizados em todos os portais",
          excerpt: "Basta um calendário — o gestor de canais distribui automaticamente as alterações de preço a todos os portais.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial: altera um preço e quer garantir que fica correto em todo o lado",
            },
            {
              type: "p",
              text: "Os preços são geridos exclusivamente no calendário myNextDays do imóvel — nunca individualmente nos próprios portais. O gestor de canais transmite automaticamente cada alteração a todos os portais aos quais o imóvel está ativamente associado.",
            },
            {
              type: "steps",
              items: [
                "Abra o calendário de preços ou os planos de tarifas do imóvel",
                "Ajuste o preço diário, a estadia mínima ou a restrição de chegada/partida",
                "Guarde a alteração — ela aplica-se primeiro internamente no imóvel",
                "No separador “Portais”, verifique se todos os portais pretendidos continuam associados e ativos",
                "Aguarde alguns minutos até a alteração ser transmitida aos portais",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Nunca introduza preços diretamente no portal — essas alterações são substituídas na próxima sincronização pelo calendário myNextDays.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Importar uma reserva de portal",
          excerpt: "As reservas de portal chegam automaticamente ao calendário — aqui verifica se a importação correu bem.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial: um hóspede reservou através de um portal e a reserva deve chegar ao myNextDays",
            },
            {
              type: "p",
              text: "Se um hóspede reservar através do Booking.com, do Airbnb ou de outro portal ligado, o gestor de canais importa a reserva automaticamente — não precisa de transferir nada manualmente. Este procedimento descreve como acompanhar e confirmar a importação.",
            },
            {
              type: "steps",
              items: [
                "Abra o calendário ou a lista de reservas do imóvel em causa",
                "Procure a nova reserva — traz uma etiqueta de origem do portal, por exemplo Booking.com ou Airbnb",
                "Verifique se os dados do hóspede, o período e o preço estão completos",
                "Confirme que as noites reservadas aparecem bloqueadas em todos os outros canais",
                "Se necessário, abra os detalhes da reserva para tratar serviços adicionais ou mensagens do hóspede",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Se o hóspede cancelar através do portal ou alterar o período, isso também é assumido automaticamente e as noites voltam a ficar disponíveis.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Resolver uma reserva duplicada",
          excerpt: "Como proceder quando, excecionalmente, a mesma noite foi vendida em dois canais.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial: duas reservas sobrepõem-se para o mesmo imóvel e as mesmas noites",
            },
            {
              type: "p",
              text: "O gestor de canais normalmente bloqueia de imediato as noites reservadas em todos os canais. Ainda assim pode surgir uma reserva duplicada, por exemplo com reservas simultâneas em dois portais no mesmo momento, ou com uma reserva criada manualmente que colide com uma reserva de portal.",
            },
            {
              type: "steps",
              items: [
                "Abra o calendário do imóvel e identifique as duas reservas que se sobrepõem",
                "Verifique o momento da reserva e a etiqueta de origem de ambas",
                "Contacte o hóspede que reservou por último e ofereça um imóvel alternativo ou um período alternativo",
                "Cancele a reserva que não pode ser mantida diretamente no respetivo portal, não apenas no myNextDays",
                "Depois, defina bloqueio de vendas para as noites em causa até o caso estar totalmente resolvido",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Cancele sempre uma reserva de portal através do próprio portal — um cancelamento feito só no myNextDays liberta a noite internamente, mas não informa o portal de forma fiável.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Pausar temporariamente um portal",
          excerpt: "Desativar a visibilidade de um portal isoladamente, sem perder a associação (mapping).",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial: um imóvel não deve estar reservável temporariamente num portal",
            },
            {
              type: "p",
              text: "A visibilidade pode ser ativada ou desativada individualmente por portal — independentemente do site e do mercado da plataforma. Se, por exemplo, quiser pausar o Airbnb por pouco tempo mas manter o Booking.com a funcionar, desative exclusivamente esse canal.",
            },
            {
              type: "steps",
              items: [
                "Abra o imóvel em /objekte, separador “Portais”",
                "Procure a entrada do portal que pretende pausar",
                "Desative a visibilidade para esse portal",
                "Guarde — a alteração aplica-se em poucos minutos, e o imóvel desaparece dos resultados de pesquisa desse portal",
                "Volte a ativar a visibilidade assim que o imóvel deva estar novamente reservável",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A associação (mapping) mantém-se ao pausar — não precisa de a configurar novamente mais tarde. Para bloquear todos os canais por completo, use antes o bloqueio de vendas.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Verificar a associação do imóvel",
          excerpt: "Como controlar se o seu imóvel continua corretamente associado ao tipo de oferta certo no portal.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial: os preços ou a disponibilidade num portal já não correspondem ao myNextDays",
            },
            {
              type: "p",
              text: "Se a apresentação no portal diferir do seu calendário myNextDays, a causa está normalmente numa associação (mapping) incorreta ou interrompida — a ligação entre o seu imóvel e o tipo de quarto ou de oferta no portal.",
            },
            {
              type: "steps",
              items: [
                "Abra o imóvel em /objekte, separador “Portais”",
                "Verifique o estado do portal em causa — deve mostrar “Ligado”, não “Erro” nem “Pendente”",
                "Confirme se o tipo de quarto ou de oferta associado no portal ainda corresponde ao imóvel real",
                "Em caso de divergência: desfaça a associação, associe novamente e depois reative a visibilidade",
                "Depois da correção, aguarde alguns minutos e verifique novamente preços e disponibilidade no portal",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Um imóvel pode estar associado a vários portais em simultâneo — em caso de divergências, verifique de forma direcionada apenas o portal em causa, não todos ao mesmo tempo.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Tarifas diferentes por portal",
          excerpt: "Como atribuir a um portal um plano de tarifas próprio, sem afetar os restantes canais.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial: quer oferecer num portal um preço diferente do dos restantes canais",
            },
            {
              type: "p",
              text: "Os planos de tarifas podem ser associados individualmente por portal, por exemplo um plano não reembolsável para um portal e um flexível para outro. Os preços base continuam geridos centralmente no imóvel; a associação determina qual o plano de tarifas que vai para qual portal.",
            },
            {
              type: "steps",
              items: [
                "Crie no imóvel o plano de tarifas adicional com as condições pretendidas (preço, condições de cancelamento, estadia mínima)",
                "Abra o separador “Portais” e escolha o portal em causa",
                "Na associação, atribua o novo plano de tarifas a esse portal",
                "Deixe os restantes portais sem alterações, no seu plano de tarifas anterior",
                "Guarde e, após alguns minutos, verifique a apresentação do preço no respetivo portal",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Cada plano de tarifas é transmitido de forma independente — uma alteração num plano de tarifas não afeta portais associados a outro plano de tarifas.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Resolver erros comuns de portal",
          excerpt: "Causas típicas quando um portal recusa um imóvel ou a sincronização fica presa.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial: o estado de um portal mostra um erro ou o imóvel não é aceite",
            },
            {
              type: "p",
              text: "Os portais recusam normalmente uma ligação por falta de dados base ou dados de imóvel incompletos. Percorra as causas mais comuns pela ordem indicada antes de contactar o suporte.",
            },
            {
              type: "steps",
              items: [
                "Verifique em /konto se a morada, os dados fiscais e os dados de contacto estão completos",
                "Confirme no imóvel se a descrição, as fotos, o equipamento e pelo menos uma tarifa estão completos",
                "Verifique se está registado um método de pagamento válido para as comissões",
                "Abra o separador “Portais” e leia a mensagem de erro exata junto ao portal em causa",
                "Corrija a falha indicada e ative novamente a visibilidade",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Um erro de portal afeta sempre apenas esse portal — os restantes canais continuam a funcionar de forma independente, desde que os seus próprios requisitos estejam cumpridos.",
            },
          ],
        },
      ],
    },
  ],
};
