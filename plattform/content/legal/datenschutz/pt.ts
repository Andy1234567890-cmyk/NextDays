import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Política de privacidade",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "A presente política descreve que dados pessoais a myBestDays trata, para que finalidades, com que fundamento jurídico e que direitos lhe assistem. Aplica-se ao sítio web, às aplicações móveis e a todos os demais acessos à plataforma.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Responsável pelo tratamento e encarregado da proteção de dados",
      paragraphs: [
        `O responsável pelo tratamento na aceção do Regulamento (UE) 2016/679 (RGPD) é a ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dinamarca, CVR n.º ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Os dados completos do prestador constam das [Informações legais](https://mybestdays.dk/rechtliches/impressum).`,
        "Não foi designado encarregado da proteção de dados; não se verificam os pressupostos do artigo 37.º do RGPD. Dirija as questões de proteção de dados ao endereço de correio eletrónico acima indicado.",
        "Os fornecedores junto dos quais reserva são responsáveis autónomos pelos dados que recebem de nós. Aplicam-se-lhes as [Normas de proteção de dados para anfitriões](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Que dados tratamos",
      paragraphs: ["Consoante a forma como utiliza a plataforma, tratamos:"],
      list: [
        "dados de identificação — nome, endereço de correio eletrónico, número de telefone, idioma e moeda, palavra-passe em forma cifrada;",
        "dados de reserva — alojamento reservado, período, número e nomes dos viajantes, pedidos especiais, estado da reserva;",
        "dados de pagamento — montante, moeda, estado do pagamento, os últimos dígitos do meio de pagamento e a referência da operação do nosso prestador de serviços de pagamento. Os dados completos dos cartões não chegam até nós;",
        "dados de comunicação — mensagens entre si e o fornecedor, pedidos ao nosso apoio ao cliente, reclamações;",
        "dados de conteúdo — avaliações, fotografias, listas de desejos;",
        "dados de utilização — páginas visitadas, pesquisas efetuadas, momento do acesso;",
        "dados técnicos — endereço IP, identificadores de navegador e dispositivo, sistema operativo, referenciador.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Finalidades e fundamentos jurídicos",
      paragraphs: [
        "Disponibilização da plataforma, conta, pesquisa, reserva, processamento de pagamentos e comunicação com o fornecedor — artigo 6.º, n.º 1, alínea b), do RGPD (contrato ou diligências pré-contratuais).",
        "Apoio ao cliente, tratamento de reclamações e resolução de litígios — artigo 6.º, n.º 1, alíneas b) e f), do RGPD.",
        "Deteção e prevenção de fraude, abuso e incidentes de segurança, aplicação das nossas condições — artigo 6.º, n.º 1, alínea f), do RGPD (interesse legítimo num mercado seguro).",
        "Avaliações e a sua publicação — artigo 6.º, n.º 1, alíneas b) e f), do RGPD.",
        "Cumprimento de obrigações legais, em especial deveres de conservação comerciais e fiscais, o dever de comunicação nos termos da Diretiva (UE) 2021/514 (DAC7) e os deveres decorrentes do Regulamento (UE) 2022/2065 — artigo 6.º, n.º 1, alínea c), do RGPD.",
        "Melhoria da plataforma mediante a análise de dados de utilização agregados — artigo 6.º, n.º 1, alínea f), do RGPD.",
        "Mensagens publicitárias e cookies não necessários — artigo 6.º, n.º 1, alínea a), do RGPD (consentimento), que pode retirar a todo o tempo com efeitos para o futuro.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Destinatários",
      paragraphs: [
        "Os fornecedores recebem os dados de que necessitam para executar a sua reserva e cumprir os seus deveres legais — em especial nome, contactos, período, número de viajantes e as suas mensagens dirigidas a eles.",
        "O nosso prestador de serviços de pagamento Stripe trata dados de pagamento como responsável autónomo; aplica-se ainda a [política de privacidade da Stripe](https://stripe.com/privacy).",
        "Os prestadores que asseguram para nós alojamento técnico, exploração de bases de dados, envio de correio eletrónico, diagnóstico de erros e ferramentas de apoio ao cliente tratam dados exclusivamente sob instrução, com base em contrato nos termos do artigo 28.º do RGPD.",
        "Autoridades e tribunais recebem dados apenas na medida em que a tal estejamos obrigados; ver [Regras aplicáveis a pedidos de autoridades e autoridades policiais](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "As autoridades fiscais recebem os dados sobre fornecedores a comunicar nos termos do DAC7.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Transferências para países terceiros",
      paragraphs: [
        "Os nossos servidores e os dos nossos subcontratantes situam-se na União Europeia.",
        "Na medida em que, em casos concretos, ocorra tratamento fora do Espaço Económico Europeu, tal só sucede com base numa decisão de adequação da Comissão Europeia ou nas cláusulas contratuais-tipo nos termos do artigo 46.º, n.º 2, alínea c), do RGPD, acompanhadas de garantias complementares.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Prazos de conservação",
      paragraphs: [
        "Conservamos os dados da conta enquanto a conta existir e eliminamo-los depois, salvo se a tal obstar um dever de conservação.",
        "Os dados de reserva e de pagamento estão sujeitos a prazos de conservação comerciais e fiscais; segundo o direito contabilístico dinamarquês são, em regra, cinco anos a contar do fim do exercício a que os dados respeitam.",
        "Conservamos as mensagens relativas a uma reserva até três anos após o fim da estada, para podermos esclarecer litígios.",
        "As avaliações permanecem em forma anonimizada após a eliminação da sua conta, por fazerem parte da base de avaliação de um alojamento.",
        "Os dados relativos a casos de fraude e abuso são conservados pelo tempo necessário para evitar novas violações e, no máximo, três anos após o último incidente.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Os seus direitos",
      paragraphs: ["Nos termos do RGPD assistem-lhe os seguintes direitos:"],
      list: [
        "acesso aos dados conservados a seu respeito (artigo 15.º);",
        "retificação de dados inexatos (artigo 16.º);",
        "apagamento (artigo 17.º), salvo se a tal obstar um dever de conservação;",
        "limitação do tratamento (artigo 18.º);",
        "portabilidade dos dados (artigo 20.º);",
        "oposição a tratamento fundado em interesses legítimos (artigo 21.º), em especial a marketing direto;",
        "retirada de consentimento prestado, com efeitos para o futuro (artigo 7.º, n.º 3);",
        `reclamação junto de uma autoridade de controlo (artigo 77.º) — é competente a autoridade da sua residência, do seu local de trabalho ou do local da alegada violação. Na sede do responsável é a ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Dinamarca, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Como exercer os seus direitos",
      paragraphs: [
        `Muitos dados pode consultá-los, alterá-los ou eliminá-los diretamente na sua conta. Para tudo o resto dirija-se a ${ANBIETER.email}.`,
        "Respondemos sem demora e, o mais tardar, no prazo de um mês. Se não pudermos cumprir esse prazo, comunicamo-lo de forma fundamentada.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Decisões automatizadas",
      paragraphs: [
        "Utilizamos procedimentos automatizados para detetar fraude, abuso e conteúdos ilícitos. Se um desses procedimentos conduzir a uma medida contra a sua conta ou os seus conteúdos, fundamentamo-la e pode requerer reapreciação por uma pessoa.",
        "Não tomamos decisões exclusivamente baseadas em tratamento automatizado com efeitos jurídicos na aceção do artigo 22.º do RGPD.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Obrigatoriedade de fornecer dados",
      paragraphs: [
        "Tem de fornecer os dados necessários a uma reserva; sem eles não pode ser celebrado contrato nem disponibilizado o alojamento. Todos os demais dados são facultativos.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Alterações da presente política",
      paragraphs: [
        "Adaptamos a presente política quando o tratamento ou o quadro jurídico se alterem. A versão em vigor pode ser consultada aqui; a data de atualização consta do topo.",
      ],
    },
  ],
};
