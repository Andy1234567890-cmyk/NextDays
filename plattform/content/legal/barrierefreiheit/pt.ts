import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Declaração de acessibilidade",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "A myBestDays deve poder ser utilizada por todos. A presente declaração descreve o estado da acessibilidade da plataforma, as limitações conhecidas e a forma de nos comunicar barreiras.",
    "Reporta-se aos requisitos da Diretiva (UE) 2019/882 relativa aos requisitos de acessibilidade dos produtos e serviços, aplicável desde 28 de junho de 2025 aos serviços de comércio eletrónico.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Estado da acessibilidade",
      paragraphs: [
        "Orientamo-nos pela norma harmonizada EN 301 549 e pelas subjacentes Web Content Accessibility Guidelines (WCAG) 2.1, nível de conformidade AA.",
        "Encontram-se implementados, entre outros: operabilidade integral por teclado, foco visível, estrutura semântica de títulos, etiquetas em todos os campos de formulário, alternativas textuais para os elementos de comando, contrastes de cor suficientes, escalabilidade do texto sem perda de conteúdo e uma apresentação que se adapta ao tamanho do ecrã.",
        "Os textos jurídicos estão disponíveis em todas as 24 línguas oficiais da União e têm marcação linguística correta, para que os leitores de ecrã os leiam adequadamente.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Limitações conhecidas",
      paragraphs: ["Atualmente não são acessíveis, em especial:"],
      list: [
        "As fotografias e descrições dos anúncios provêm dos fornecedores; as alternativas textuais às fotografias podem faltar ou ser insuficientes. Instamos os fornecedores a completá-las.",
        "As representações cartográficas de terceiros incorporadas só são operáveis por teclado de forma limitada. Todas as indicações de localização estão também disponíveis em texto.",
        "Os documentos carregados pelos fornecedores (por exemplo, regras da casa em PDF) não estão sistematicamente marcados para acessibilidade.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Acessibilidade dos alojamentos",
      paragraphs: [
        "A presente declaração respeita à plataforma, não aos alojamentos. As indicações sobre a acessibilidade construtiva de um alojamento provêm do fornecedor.",
        "Se depender de determinadas características — acesso sem degraus, largura das portas, duche ao nível do piso, elevador — esclareça-as com o fornecedor através das mensagens antes de reservar. Indicações inexatas sobre acessibilidade constituem violação das nossas regras e podem ser comunicadas.",
      ],
    },
    {
      id: "melden",
      heading: "4. Comunicar barreiras",
      paragraphs: [
        `Se encontrar uma barreira, comunique-nos para ${ANBIETER.email} ou através das vias de contacto indicadas em [Reclamações e resolução de litígios](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Descreva, por favor, que página está em causa, o que pretendia fazer e que tecnologias de apoio utiliza. Acusamos a receção e informamos como e até quando eliminaremos a barreira.",
        "Se necessitar de uma informação em formato acessível, disponibilizamo-la mediante pedido.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Procedimento de execução",
      paragraphs: [
        "Se não ficar satisfeito com a nossa resposta, pode dirigir-se à autoridade competente para a fiscalização do mercado nos termos da Diretiva (UE) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (anteriormente Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Dinamarca",
        "Telefone: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
