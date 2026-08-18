import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Regras sobre conteúdos adequados",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "As presentes regras aplicam-se a todos os conteúdos que os utilizadores publicam na myBestDays: anúncios, fotografias, avaliações, mensagens, dados de perfil e respostas a avaliações.",
    "Fazem parte das [Condições de utilização](https://mybestdays.dk/rechtliches/nutzungsbedingungen). Uma violação pode determinar a remoção do conteúdo e medidas contra a conta.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. O que não é permitido",
      paragraphs: ["Na myBestDays não são admissíveis, em especial, os seguintes conteúdos:"],
      list: [
        "conteúdos ilícitos de qualquer natureza, em especial incitamentos a crimes, conteúdos terroristas e material de abuso sexual de crianças;",
        "conteúdos que incitem ao ódio ou à violência contra pessoas ou grupos em razão da origem, cor da pele, religião, convicções, sexo, identidade de género, orientação sexual, deficiência ou idade;",
        "injúrias, ameaças, assédio e a exposição dirigida de pessoas concretas;",
        "dados pessoais de terceiros sem o seu consentimento, em especial nomes, moradas, números de telefone, dados de identificação ou de pagamento;",
        "indicações enganosas sobre um alojamento, a sua localização, equipamento, dimensão ou disponibilidade;",
        "fotografias, textos ou marcas alheios sem os direitos necessários;",
        "publicidade, spam e conteúdos que remetam para outras vias de reserva fora da plataforma;",
        "software malicioso, tentativas de phishing e ligações para tais conteúdos;",
        "ofertas de algo distinto de uma prestação de alojamento.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Fotografias",
      paragraphs: [
        "As fotografias devem mostrar o alojamento efetivamente oferecido e ter sido captadas num estado correspondente ao atual.",
        "As fotografias não podem mostrar pessoas identificáveis sem o seu consentimento. A edição é admissível desde que não falseie a impressão do alojamento — aclarar sim, apagar um edifício vizinho não.",
        "A videovigilância no alojamento deve ser divulgada no anúncio. Em espaços interiores em que os hóspedes têm expectativa legítima de privacidade — quartos, casas de banho — as câmaras não são admissíveis, mesmo desligadas.",
      ],
    },
    {
      id: "melden",
      heading: "3. Comunicar conteúdos",
      paragraphs: [
        "Se considerar um conteúdo ilícito ou contrário às presentes regras, pode comunicá-lo através da função de comunicação disponível em cada anúncio, avaliação e mensagem.",
        "O procedimento de comunicação nos termos do artigo 16.º do Regulamento (UE) 2022/2065 e o tratamento das comunicações constam do [Regulamento dos Serviços Digitais](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Como asseguramos o cumprimento",
      paragraphs: [
        "Analisamos cada conteúdo comunicado e escolhemos a medida adequada menos gravosa: uma advertência, a remoção da parte em causa, a remoção da totalidade do conteúdo, a limitação da visibilidade, o bloqueio de uma funcionalidade ou o bloqueio da conta.",
        "As violações reiteradas ou graves pesam mais. Perante conteúdos manifestamente ilícitos ou perigo para pessoas agimos de imediato.",
        "Fundamentamos cada medida perante a pessoa visada e indicamos a via de reclamação. A reclamação é tratada por pessoas.",
      ],
    },
  ],
};
