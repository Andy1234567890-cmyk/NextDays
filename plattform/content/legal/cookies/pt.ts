import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Política de cookies",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "A presente política explica que cookies e tecnologias análogas a myBestDays utiliza, com que finalidade, durante quanto tempo são conservados e como os pode gerir.",
    "Complementa a [Política de privacidade](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. O que são cookies",
      paragraphs: [
        "Os cookies são pequenos ficheiros de texto que um sítio web guarda no seu navegador. Tecnologias análogas são o armazenamento local do navegador e os pixels de contagem em mensagens de correio eletrónico.",
        "Os cookies estritamente necessários ao funcionamento da plataforma podem ser colocados sem o seu consentimento. Para todos os demais recolhemos o seu consentimento (artigo 5.º, n.º 3, da Diretiva 2002/58/CE).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Cookies necessários",
      paragraphs: [
        "Estes cookies são necessários ao funcionamento e não podem ser desativados. Atualmente colocamos:",
      ],
      list: [
        "«nd_access» — mantém a sua sessão iniciada. Legível apenas pelo servidor (HttpOnly), duração correspondente à validade da sessão.",
        "«nd_refresh» — renova a sua sessão para não ter de iniciar sessão repetidamente. Legível apenas pelo servidor, duração 30 dias.",
        "«nd_gast_locale» — memoriza o idioma escolhido. Duração um ano.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Cookies funcionais, estatísticos e publicitários",
      paragraphs: [
        "A myBestDays não coloca atualmente cookies para estatística, medição de audiências ou publicidade e não incorpora redes publicitárias nem serviços de análise.",
        "Se tal mudar, recolheremos previamente o seu consentimento através de uma caixa de escolha em que recusar seja tão simples quanto aceitar, e completaremos a presente política com os cookies concretos.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Conteúdos de terceiros incorporados",
      paragraphs: [
        "Nas páginas de detalhe podem estar incorporados mapas. Só carregamos esses conteúdos depois de os ativar expressamente; só então podem ser transmitidos dados ao respetivo prestador.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Como gerir os cookies",
      paragraphs: [
        "Pode alterar ou retirar o seu consentimento a qualquer momento através das definições de cookies no rodapé.",
        "Pode ainda eliminar ou bloquear cookies no seu navegador. Se eliminar os cookies necessários, a sua sessão termina e a plataforma funcionará de forma limitada.",
      ],
    },
  ],
};
