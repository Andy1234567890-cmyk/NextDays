import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Regulamento dos Serviços Digitais",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "A myBestDays é um serviço intermediário e uma plataforma em linha na aceção do Regulamento (UE) 2022/2065 relativo a um mercado único para os serviços digitais (Regulamento dos Serviços Digitais, DSA). A presente página reúne as informações e os procedimentos exigidos por esse regulamento.",
    "A myBestDays não é uma plataforma em linha de muito grande dimensão na aceção do artigo 33.º do regulamento. Os deveres adicionais aplicáveis a essas plataformas — avaliação de riscos sistémicos, auditoria independente, repositório de anúncios e publicação do número mensal de utilizadores no procedimento aí previsto — não nos incumbem.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Pontos de contacto (artigos 11.º e 12.º)",
      paragraphs: [
        `Ponto de contacto único para as autoridades dos Estados-Membros, a Comissão e o Comité Europeu dos Serviços Digitais: ${ANBIETER.email}, por via postal ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dinamarca.`,
        `Ponto de contacto único para utilizadores: ${ANBIETER.email}. Contacta-nos diretamente, sem etapa automatizada prévia.`,
        "Com ambos os pontos de contacto é possível comunicar em alemão, dinamarquês e inglês.",
        "Não há que designar representante legal na União nos termos do artigo 13.º: o operador está estabelecido na Dinamarca e, portanto, na União.",
        `Coordenador dos serviços digitais competente nos termos do artigo 49.º: ${DSA_KOORDINATOR.name}, Dinamarca ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Comunicar conteúdos ilícitos (artigo 16.º)",
      paragraphs: [
        "Qualquer pessoa pode comunicar-nos conteúdos que considere ilícitos. Utilize a função de comunicação disponível em cada anúncio, avaliação e mensagem, ou o ponto de contacto para utilizadores.",
        "Para podermos apreciar uma comunicação sem exame jurídico aprofundado, esta deve conter:",
      ],
      list: [
        "uma explicação suficientemente fundamentada das razões pelas quais o conteúdo é ilícito;",
        "a localização eletrónica exata, em especial o URL;",
        "o nome e o endereço de correio eletrónico de quem comunica — salvo em comunicações relativas a crimes contra a autodeterminação sexual de crianças, em que tal indicação é facultativa;",
        "a declaração de que as informações são, tanto quanto se sabe, corretas e completas.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Como tratamos as comunicações",
      paragraphs: [
        "Acusamos a receção sem demora e decidimos de forma atempada, diligente, não arbitrária e objetiva.",
        "Se uma comunicação contiver os elementos referidos na secção 2, funda o nosso conhecimento na aceção do artigo 6.º do regulamento.",
        "Comunicamos a nossa decisão a quem apresentou a comunicação e indicamos os meios de recurso.",
        "Se o tratamento for automatizado, informamos desse facto.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Fundamentação das medidas (artigo 17.º)",
      paragraphs: [
        "Quando limitamos a visibilidade de um conteúdo, o removemos, bloqueamos o acesso ao mesmo, suspendemos pagamentos, suspendemos a prestação do serviço ou a conta, a pessoa visada recebe uma fundamentação clara e específica.",
        "A fundamentação indica a natureza e o alcance da medida, o seu âmbito territorial e temporal, os factos e circunstâncias da decisão, se houve intervenção de tratamento automatizado, o fundamento jurídico ou a cláusula contratual violada e os meios de recurso disponíveis.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Suspeita de crime (artigo 18.º)",
      paragraphs: [
        "Havendo indícios de crime que constitua perigo para a vida ou a segurança de uma pessoa, informamos sem demora as autoridades policiais ou judiciais competentes.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Sistema interno de tratamento de reclamações (artigo 20.º)",
      paragraphs: [
        "Contra qualquer medida da secção 4 e contra o indeferimento de uma comunicação pode reclamar-se gratuitamente no prazo de seis meses.",
        "As reclamações são tratadas de forma atempada, não discriminatória e diligente — sob supervisão de pessoal qualificado e não exclusivamente por meios automatizados.",
        "Se uma reclamação se revelar fundada, revogamos a medida. A via é descrita em [Reclamações e resolução de litígios](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Resolução extrajudicial de litígios (artigo 21.º)",
      paragraphs: [
        "Nos litígios relativos às medidas da secção 4 os utilizadores podem recorrer a um organismo de resolução extrajudicial de litígios certificado pelo coordenador dos serviços digitais competente. A lista de organismos certificados é mantida pela Comissão Europeia.",
        "As decisões desses organismos não nos vinculam; não estamos obrigados a participar em procedimentos de entidades independentes. A via judicial mantém-se aberta.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Sinalizadores de confiança (artigo 22.º)",
      paragraphs: [
        "As comunicações apresentadas por um sinalizador reconhecido como sinalizador de confiança no seu domínio são tratadas prioritariamente.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Medidas contra utilizações abusivas (artigo 23.º)",
      paragraphs: [
        "Bloqueamos por um período razoável, mediante advertência prévia, as contas através das quais são frequentemente disponibilizados conteúdos manifestamente ilícitos.",
        "Suspendemos o tratamento de comunicações e reclamações relativamente a pessoas que apresentem frequentemente comunicações ou reclamações manifestamente infundadas — também mediante advertência prévia.",
        "Apreciamos sempre o caso concreto: número, proporção e gravidade dos casos em apreço e a intenção subjacente.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Relatórios de transparência (artigos 15.º e 24.º)",
      paragraphs: [
        "Publicamos anualmente um relatório sobre moderação de conteúdos: número de ordens de autoridades, número e tipo de comunicações, medidas adotadas, número de reclamações e o seu desfecho, informações sobre o recurso a meios automatizados e número de litígios perante organismos extrajudiciais.",
        `As microempresas e pequenas empresas estão isentas de parte destes deveres nos termos do artigo 19.º do regulamento. Enquanto a isenção vigorar, disponibilizamos as informações mediante pedido em ${ANBIETER.email}; logo que o primeiro relatório seja publicado, será aqui ligado.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Rastreabilidade dos profissionais (artigos 30.º a 32.º)",
      paragraphs: [
        "Os fornecedores que atuem profissionalmente na plataforma só podem oferecer depois de nos terem comunicado nome, morada, número de telefone, endereço de correio eletrónico, dados de registo, número de identificação para efeitos de IVA e conta de pagamento, e desde que as suas indicações sejam plausíveis.",
        "Apresentamos esses dados no anúncio na medida em que o regulamento o preveja.",
        "Se soubermos que um anúncio respeitava a um produto ou serviço ilícito, informamos os hóspedes visados na medida em que disponhamos dos seus contactos.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Sistemas de recomendação (artigo 27.º)",
      paragraphs: [
        "Os principais parâmetros da ordem dos resultados de pesquisa e das recomendações, bem como a possibilidade de os influenciar, são descritos em [Preços, ordenação e recomendações](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Publicidade (artigo 26.º)",
      paragraphs: [
        "Atualmente não apresentamos publicidade paga de terceiros nem colocações pagas nos resultados de pesquisa.",
        "Se viermos a introduzir publicidade, identificá-la-emos claramente, indicaremos o anunciante e os principais parâmetros da sua difusão. Excluímos a publicidade baseada em categorias especiais de dados pessoais na aceção do artigo 9.º do Regulamento (UE) 2016/679 e a publicidade dirigida a menores baseada na definição de perfis.",
      ],
    },
  ],
};
