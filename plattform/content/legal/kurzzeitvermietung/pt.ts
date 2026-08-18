import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Arrendamento de curta duração e deveres de registo",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "Em muitas cidades e regiões o arrendamento de curta duração de habitação está sujeito a licença, registo ou comunicação. A presente página explica o que tal significa para fornecedores e para hóspedes.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Quadro jurídico",
      paragraphs: [
        "O Regulamento (UE) 2024/1028 relativo à recolha e partilha de dados respeitantes aos serviços de arrendamento de alojamento de curta duração cria um quadro uniforme: onde um Estado-Membro ou uma autarquia tenha instituído um procedimento de registo, cada unidade recebe um número de registo.",
        "As plataformas devem apresentar esse número, verificar a sua validade por amostragem e transmitir periodicamente às autoridades competentes dados sobre a atividade.",
        "Continuam ainda aplicáveis normas nacionais e locais — por exemplo sobre alteração de uso da habitação, número máximo de dias de arrendamento, segurança contra incêndios e registo de hóspedes.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. O que os fornecedores devem fazer",
      paragraphs: [
        "Verifique antes da publicação se ao seu alojamento se aplica um dever de registo, licenciamento ou comunicação e cumpra-o.",
        "Insira o número de registo no imóvel, se existir. Apresentamo-lo no anúncio.",
        "Respeite o número máximo de dias de arrendamento e os demais limites locais. A sua fiscalização é tarefa sua, não nossa.",
        "Não podemos apresentar de forma permanente um anúncio sem o número de registo exigido. Se faltar ou se revelar inválido, solicitamo-lo; na ausência de indicação desativamos o anúncio.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. O que isto significa para os hóspedes",
      paragraphs: [
        "Se a um alojamento se aplicar um dever de registo, verá o número de registo no anúncio. Constitui indicação de que o arrendamento foi comunicado à autoridade competente.",
        "No destino pode ser exigido um registo (boletim de alojamento, dados de identificação, declaração de taxa turística). O fornecedor solicitará os dados necessários; disponibilize-os atempadamente.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Transmissão de dados às autoridades",
      paragraphs: [
        "Na medida em que o Regulamento (UE) 2024/1028 ou o direito nacional o prevejam, transmitimos às autoridades competentes dados sobre a atividade de arrendamento — em especial número de registo, morada da unidade, número de noites ocupadas e número de hóspedes.",
        "Essa transmissão é feita para cumprir uma obrigação legal nos termos do artigo 6.º, n.º 1, alínea c), do Regulamento (UE) 2016/679. Os pormenores constam da [Política de privacidade](https://mybestdays.dk/rechtliches/datenschutz).",
        "Independentemente disso subsiste o dever de comunicação fiscal nos termos do DAC7; ver a [Política fiscal](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Comunicar incumprimentos",
      paragraphs: [
        "Se tiver indícios de que um alojamento é oferecido sem a licença ou o registo exigidos, comunique-nos através da função de comunicação do anúncio. Damos seguimento a cada comunicação.",
      ],
    },
  ],
};
