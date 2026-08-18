import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Regras aplicáveis a pedidos de autoridades e autoridades policiais",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "As presentes regras dirigem-se a autoridades, tribunais e autoridades policiais que solicitem dados à myBestDays ou dirijam uma ordem relativa a conteúdos. São aqui públicas para que também os utilizadores possam saber em que condições disponibilizamos dados.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Princípio",
      paragraphs: [
        "Só disponibilizamos dados de utilizadores quando exista fundamento jurídico válido e o pedido cumpra os requisitos formais. Um pedido informal de dados não é suficiente.",
        "Analisamos cada pedido quanto à competência, ao fundamento jurídico, à determinação e à proporcionalidade e disponibilizamos apenas os dados que o pedido identifique.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Requisitos de um pedido",
      paragraphs: ["Um pedido deve conter:"],
      list: [
        "a entidade requerente, a referência do processo e os contactos da pessoa responsável, em papel timbrado oficial;",
        "o fundamento jurídico no direito nacional ou da União;",
        "a identificação exata da pessoa ou conta em causa — endereço de correio eletrónico, número de reserva ou URL do anúncio;",
        "os dados exatamente identificados e o período;",
        "sendo caso disso, uma decisão judicial, na medida em que o direito aplicável o exija;",
        "uma indicação caso informar a pessoa visada comprometesse a investigação, com menção do fundamento jurídico.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Ordens nos termos do Regulamento (UE) 2022/2065",
      paragraphs: [
        "As ordens para atuar contra conteúdos ilegais (artigo 9.º) e as ordens para prestar informações (artigo 10.º) devem conter os elementos aí previstos, em especial o fundamento jurídico, a localização eletrónica exata, a fundamentação, os meios de recurso e a língua.",
        "Acusamos a receção e comunicamos à autoridade emitente que medidas adotámos e quando.",
        "Informamos a pessoa visada de uma ordem o mais tardar no momento da sua execução, salvo se a autoridade determinar o diferimento indicando o fundamento jurídico.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Situações de emergência",
      paragraphs: [
        "Havendo perigo iminente para a vida ou a integridade física, disponibilizamos os dados necessários para o afastar mesmo sem ordem formal prévia. Assinale expressamente esse pedido como emergência e descreva o perigo.",
        "Havendo indícios de crime que constitua perigo para a vida ou a segurança de uma pessoa, informamos por iniciativa própria as autoridades competentes (artigo 18.º do Regulamento (UE) 2022/2065).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Que dados conservamos",
      paragraphs: [
        "As categorias de dados que tratamos e os respetivos prazos de conservação constam da [Política de privacidade](https://mybestdays.dk/rechtliches/datenschutz). Para além dos prazos aí indicados não conservamos quaisquer dados.",
        "Não é feita conservação para além do necessário. Damos cumprimento, dentro dos limites juridicamente admissíveis, a um pedido de preservação temporária de dados para um processo pendente.",
        "Não dispomos de dados de pagamento completos; devem ser solicitados ao prestador de serviços de pagamento.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Informação da pessoa visada",
      paragraphs: [
        "Informamos os utilizadores visados de um pedido respeitante aos seus dados, salvo se uma norma legal ou uma ordem fundamentada da autoridade o proibir ou se existir perigo iminente para a vida ou a integridade física.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. A quem dirigir os pedidos",
      paragraphs: [
        "Dirija os pedidos ao ponto de contacto único para autoridades indicado no [Regulamento dos Serviços Digitais](https://mybestdays.dk/rechtliches/dsa). Tratamo-los em alemão, dinamarquês e inglês.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Transparência",
      paragraphs: [
        "Indicamos o número e o tipo de ordens de autoridades no nosso relatório anual de transparência; ver [Regulamento dos Serviços Digitais](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
