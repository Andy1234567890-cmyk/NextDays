import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Preços e tarifas",
  description: "Planos de tarifas, preços sazonais e preços dinâmicos.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Definição de preços",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Preço base e moeda",
          excerpt: "Como definir o preço base e atribuir ao seu imóvel a moeda correta.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Cada imóvel no myNextDays é exatamente uma unidade reservável — um único quarto ou um alojamento de férias. Para esta unidade regista um preço base, bem como uma moeda central, que se aplica a todo o imóvel.",
            },
            { type: "h2", text: "Definir a moeda de forma centralizada" },
            {
              type: "p",
              text: "A moeda do imóvel é definida uma vez por imóvel e aplica-se automaticamente a todos os planos de tarifas que criar para esse imóvel. Não existe um valor de moeda por defeito em separado — se a moeda estiver em falta, não é possível guardar preços.",
            },
            {
              type: "steps",
              items: [
                "Abra o seu imóvel em “Imóveis”.",
                "Mude para o separador “Preços”.",
                "Em “Moeda do imóvel”, escolha a moeda adequada.",
                "Indique o preço base para a ocupação padrão.",
                "Guarde as alterações.",
              ],
            },
            { type: "h2", text: "O que acontece numa alteração de moeda" },
            {
              type: "p",
              text: "Se alterar a moeda do imóvel posteriormente, isso afeta todos os planos de tarifas existentes desse imóvel, uma vez que estes são sempre geridos na moeda do imóvel. Verifique depois os seus preços antes de os transmitir de novo aos portais.",
            },
            {
              type: "ul",
              items: [
                "Um imóvel tem exatamente uma moeda — não várias por plano de tarifas.",
                "O preço base é o valor de partida para as tarifas derivadas.",
                "Os valores são sempre apresentados na moeda registada do imóvel.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Sem uma moeda registada não é possível guardar nenhum preço nem transmitir nenhuma tarifa aos portais. Verifique isto primeiro se uma alteração de preço falhar.",
            },
            {
              type: "note",
              variant: "info",
              text: "Mais sobre preços derivados em [Tarifas derivadas](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Criar planos de tarifas",
          excerpt: "Os planos de tarifas reúnem preço, condições de cancelamento e regime de refeição para um imóvel.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Um plano de tarifas define em que condições um imóvel pode ser reservado: preço, regras de cancelamento, regime de refeição e estadia mínima. Um imóvel pode oferecer vários planos de tarifas em simultâneo, por exemplo um plano flexível e um não reembolsável.",
            },
            { type: "h2", text: "Criar um novo plano de tarifas" },
            {
              type: "steps",
              items: [
                "Abra o imóvel e mude para o separador “Preços”.",
                "Clique em “Criar novo plano de tarifas”.",
                "Indique um nome claro, por exemplo “Flexível” ou “Não reembolsável”.",
                "Defina se o plano é uma tarifa base ou uma tarifa derivada.",
                "Registe as condições de cancelamento e o regime de refeição.",
                "Guarde e ative o plano de tarifas.",
              ],
            },
            { type: "h2", text: "Tarifa base vs. outros planos de tarifas" },
            {
              type: "p",
              text: "Crie primeiro a sua tarifa base (frequentemente designada por “BAR”, Best Available Rate). Todos os restantes planos de tarifas podem ser geridos de forma independente ou derivados desta tarifa base.",
            },
            {
              type: "ul",
              items: [
                "Tarifa base: preço base por noite, gerido manualmente.",
                "Outros planos de tarifas: independentes ou como acréscimo/desconto sobre a tarifa base.",
                "Cada plano de tarifas pode ser transmitido individualmente aos portais.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Mantenha controlável o número de planos de tarifas por imóvel — demasiadas variantes dificultam a comparação para os hóspedes e aumentam o esforço de gestão.",
            },
            {
              type: "note",
              variant: "info",
              text: "Detalhes sobre acréscimos e descontos em [Tarifas derivadas](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Tarifas derivadas",
          excerpt: "Os planos de tarifas derivados são calculados automaticamente a partir de uma tarifa base.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Uma tarifa derivada é um plano de tarifas cujo preço não é gerido manualmente, mas sim calculado automaticamente a partir de uma tarifa base — como acréscimo fixo, desconto fixo ou percentagem. Isto poupa esforço de gestão, uma vez que uma alteração de preço na tarifa base atualiza automaticamente todos os planos derivados.",
            },
            { type: "h2", text: "Exemplo típico" },
            {
              type: "p",
              text: "Um padrão comum é um plano com pequeno-almoço, derivado da tarifa base sem refeição: o preço do pequeno-almoço é definido como um acréscimo por noite e por pessoa sobre a tarifa base. Se alterar a tarifa base, o preço do pequeno-almoço ajusta-se automaticamente.",
            },
            { type: "h2", text: "Configurar uma tarifa derivada" },
            {
              type: "steps",
              items: [
                "Abra o plano de tarifas pretendido no separador “Preços”.",
                "Escolha como origem do preço “Derivada de …” e a respetiva tarifa base.",
                "Defina se a diferença é aplicada como valor fixo ou como percentagem.",
                "Defina se se trata de um acréscimo ou de um desconto.",
                "Guarde a associação.",
              ],
            },
            {
              type: "ul",
              items: [
                "Acréscimo: por exemplo regime de refeição, cancelamento mais tardio.",
                "Desconto: por exemplo plano não reembolsável com vantagem de preço.",
                "A tarifa base mantém-se como a única origem gerida manualmente.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Uma tarifa derivada não pode ser sobreposta manualmente ao mesmo tempo. Desfaça primeiro a derivação se quiser definir um preço individual diferente.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Preços de época e de fim de semana",
          excerpt: "Ajustar de forma direcionada os preços para períodos de época e fins de semana.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "A procura varia ao longo do ano e dentro da semana. Com os preços de época e de fim de semana, ajusta o preço base para determinados períodos ou dias da semana, sem ter de aceder ao calendário dia a dia.",
            },
            { type: "h2", text: "Criar um período de época" },
            {
              type: "steps",
              items: [
                "Abra no imóvel o separador “Preços” e a área “Preços de época”.",
                "Crie um novo período com data de início e de fim.",
                "Registe o preço ou o desvio percentual em relação ao preço base para esse período.",
                "Guarde o período de época.",
              ],
            },
            { type: "h2", text: "Preços de fim de semana" },
            {
              type: "p",
              text: "Adicionalmente, pode aplicar a dias da semana individuais, por exemplo sexta-feira e sábado, um acréscimo próprio. Este acréscimo aplica-se em complemento ao preço de época ou base em vigor.",
            },
            {
              type: "ul",
              items: [
                "Os preços de época aplicam-se a períodos contínuos.",
                "Os preços de fim de semana aplicam-se por dia da semana, independentemente da época.",
                "Ambas as regras podem ser combinadas.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Se vários períodos de época se sobrepuserem, aplica-se a regra criada mais recentemente ou mais específica. Verifique o calendário depois de guardar.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Para ajustes automáticos baseados na procura, é ainda mais adequado o recurso a [Preços dinâmicos](/hilfe/preise-raten/dynamische-preise).",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Preços dinâmicos",
          excerpt: "Ajustar preços automaticamente à procura, à antecedência e à ocupação.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Os preços dinâmicos ajustam automaticamente o preço base com base em fatores como a antecedência da reserva, a ocupação atual e a procura — de forma semelhante ao que os grandes portais fazem nas suas próprias recomendações de preço. Assim, reage a alterações do mercado sem ter de ajustar manualmente todos os dias.",
            },
            { type: "h2", text: "Ativar os preços dinâmicos" },
            {
              type: "steps",
              items: [
                "Abra no imóvel o separador “Preços” e a área “Preços dinâmicos”.",
                "Ative a função para a tarifa base do imóvel.",
                "Defina um limite mínimo e um limite máximo de preço.",
                "Determine em que medida a ocupação pode influenciar o preço.",
                "Guarde as configurações.",
              ],
            },
            { type: "h2", text: "Limites e segurança" },
            {
              type: "p",
              text: "O limite mínimo e o limite máximo de preço impedem que o algoritmo automático defina preços insustentáveis para o seu negócio. Os planos de tarifas derivados acompanham automaticamente a tarifa base calculada de forma dinâmica.",
            },
            {
              type: "ul",
              items: [
                "O limite mínimo protege contra preços demasiado baixos em períodos de procura fraca.",
                "O limite máximo protege contra preços exagerados em períodos de procura elevada.",
                "As tarifas derivadas assumem automaticamente a nova tarifa base.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Os preços dinâmicos atuam apenas sobre a tarifa base. Os planos de tarifas definidos manualmente de forma fixa, sem derivação, não se alteram automaticamente.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Descontos por duração de estadia",
          excerpt: "Configurar descontos para estadias mais longas e reservas antecipadas.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Os descontos por duração de estadia recompensam os hóspedes por reservas mais longas ou por reservar com antecedência. São aplicados como percentagem sobre o preço total da estadia e podem ser configurados de forma independente por imóvel.",
            },
            { type: "h2", text: "Tipos de desconto" },
            {
              type: "ul",
              items: [
                "Desconto de longa duração: a partir de um determinado número de noites, por exemplo a partir de 7 ou de 28 noites.",
                "Desconto de reserva antecipada: quando a reserva é feita com suficiente antecedência.",
                "Desconto de última hora: em reservas de última hora, próximas da data de chegada.",
              ],
            },
            { type: "h2", text: "Configurar um desconto" },
            {
              type: "steps",
              items: [
                "Abra no imóvel o separador “Preços” e a área “Descontos”.",
                "Escolha o tipo de desconto pretendido.",
                "Defina o limite, por exemplo o número mínimo de noites ou a antecedência.",
                "Indique o desconto em percentagem.",
                "Guarde a regra.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Os descontos aplicam-se ao preço total do respetivo plano de tarifas e já são apresentados ao hóspede na visão geral de preços.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Combine descontos de longa duração com [Estadia mínima e máxima](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt), para incentivar de forma direcionada reservas mais longas.",
            },
          ],
        },
      ],
    },
  ],
};
