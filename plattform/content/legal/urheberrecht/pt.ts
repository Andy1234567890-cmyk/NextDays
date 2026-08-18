import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Política de direitos de autor",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "A myBestDays respeita os direitos de terceiros e espera o mesmo dos seus utilizadores. A presente política descreve como comunicar uma violação de direitos de autor e como a tratamos.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Princípio",
      paragraphs: [
        "Quem publica conteúdos na plataforma garante dispor dos direitos necessários. Tal vale em especial para fotografias, plantas, textos e extratos cartográficos nos anúncios.",
        "Publicar conteúdos alheios sem autorização constitui violação das [Condições de utilização](https://mybestdays.dk/rechtliches/nutzungsbedingungen) e das [Regras sobre conteúdos adequados](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
      ],
    },
    {
      id: "meldung",
      heading: "2. Comunicar uma violação",
      paragraphs: [
        "Comunique uma violação de direitos de autor através da função de comunicação no conteúdo em causa ou através do ponto de contacto indicado no [Regulamento dos Serviços Digitais](https://mybestdays.dk/rechtliches/dsa). Uma comunicação deve conter:",
      ],
      list: [
        "a identificação exata do conteúdo impugnado, em especial o URL;",
        "a descrição da obra protegida e a prova da sua titularidade ou da sua legitimidade para atuar em nome do titular;",
        "a fundamentação de por que razão a utilização não é permitida;",
        "o seu nome e um endereço de contacto;",
        "a declaração de que as suas indicações são, tanto quanto sabe, corretas e completas.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Como tratamos as comunicações",
      paragraphs: [
        "Acusamos a receção da sua comunicação sem demora e decidimos com celeridade e diligência.",
        "Se considerarmos a comunicação fundada, removemos o conteúdo ou bloqueamos o acesso ao mesmo e informamos quem o publicou, indicando os fundamentos e a via de reclamação.",
        "Se considerarmos a comunicação infundada, comunicamo-lo de forma fundamentada.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Oposição da pessoa visada",
      paragraphs: [
        "Se o seu conteúdo foi removido e considera tal injustificado, pode reclamar gratuitamente no prazo de seis meses. Exponha então por que motivo está legitimado à utilização.",
        "Se a reclamação se revelar fundada, repomos o conteúdo.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Violações reiteradas",
      paragraphs: [
        "Bloqueamos, mediante advertência prévia, as contas através das quais são publicados reiteradamente conteúdos violadores. Tal corresponde ao artigo 23.º do Regulamento (UE) 2022/2065.",
        "Do mesmo modo bloqueamos a função de comunicação às pessoas que apresentem reiteradamente comunicações manifestamente infundadas.",
      ],
    },
  ],
};
