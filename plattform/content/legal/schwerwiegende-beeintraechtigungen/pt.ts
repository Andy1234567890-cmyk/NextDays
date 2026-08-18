import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Política em caso de perturbações graves",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "Por vezes um acontecimento impede a viagem ou a estada sem que hóspede ou fornecedor lhe possam obstar. A presente política descreve que acontecimentos são esses e o que então se aplica.",
    "Prevalece sobre a condição de cancelamento escolhida no anúncio.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Que acontecimentos estão abrangidos",
      paragraphs: [
        "Estão abrangidos os acontecimentos que ocorram após a reserva, fossem imprevisíveis para ambas as partes e tornem a viagem ou a estada impossível ou juridicamente inadmissível:",
      ],
      list: [
        "proibições administrativas de viagem ou de permanência, recolher obrigatório e encerramento de fronteiras que afetem o destino ou o local de partida;",
        "catástrofes e fenómenos naturais que atinjam o destino — sismo, inundação, tempestade, grande incêndio, erupção vulcânica;",
        "guerra, conflitos armados, atentados terroristas e distúrbios no destino;",
        "uma epidemia ou pandemia declarada pelas autoridades com medidas que proíbam a permanência;",
        "a falha prolongada do fornecimento de eletricidade, água ou aquecimento no destino;",
        "a impossibilidade total de chegar ao destino em consequência de algum dos acontecimentos anteriores.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Que acontecimentos não estão abrangidos",
      paragraphs: ["Não estão abrangidos, em especial:"],
      list: [
        "doença ou lesão do hóspede ou dos seus familiares — para tal destina-se um seguro de viagem;",
        "impedimentos profissionais, datas de exames ou perda de férias;",
        "o cancelamento de um evento para o qual a viagem foi reservada, se o alojamento continuar utilizável;",
        "meteorologia que não constitua catástrofe natural — chuva, frio, calor, ausência de neve;",
        "a falha de meios de transporte isolados, enquanto se mantiver possível uma deslocação razoável;",
        "o cancelamento de um voo ou uma greve numa transportadora — para tal existem direitos perante a transportadora.",
      ],
    },
    {
      id: "folgen",
      heading: "3. O que se aplica quando ocorre um acontecimento abrangido",
      paragraphs: [
        "Se o acontecimento afetar o período da sua reserva, pode cancelar sem custos. Será integralmente reembolsado do montante pago através da plataforma.",
        "Se a estada já tiver começado, reembolsamos a parte correspondente às noites que já não podem ser utilizadas.",
        "De tal cancelamento não resulta qualquer desvantagem para o fornecedor na apreciação da sua fiabilidade.",
        "Em alternativa pode acordar um adiamento com o fornecedor; ajudamos na alteração.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Como invocar esta política",
      paragraphs: [
        "Contacte-nos pelas vias indicadas em [Reclamações e resolução de litígios](https://mybestdays.dk/rechtliches/beschwerden), indicando o número de reserva e o acontecimento.",
        "Verificamos com base em fontes publicamente acessíveis — atos administrativos, avisos oficiais, notícias de fontes reconhecidas — e decidimos com celeridade.",
        "Se a situação ainda não puder ser apreciada em definitivo, aguardamos a evolução até pouco antes do dia de chegada e decidimos então. Até lá a sua reserva mantém-se inalterada.",
      ],
    },
  ],
};
