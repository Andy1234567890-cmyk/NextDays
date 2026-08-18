import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Terceiros e serviços de pagamento",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "A myBestDays recorre a serviços de terceiros para a exploração da plataforma. A presente página identifica-os e explica o seu papel, bem como que condições se aplicam.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Princípio",
      paragraphs: [
        "Sempre que um terceiro preste um serviço diretamente a si, aplicam-se as suas condições e a sua política de privacidade em acréscimo às nossas. Assinalamo-lo no local respetivo.",
        "Sempre que um terceiro trate dados exclusivamente por nossa conta, mantemo-nos o seu interlocutor. Os subcontratantes que utilizamos constam da [Política de privacidade](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Prestador de serviços de pagamento",
      paragraphs: [
        "Os pagamentos através da plataforma são processados pela Stripe. A Stripe recolhe e trata dados de pagamento diretamente e é responsável autónoma pelo tratamento. Aplica-se ainda a [política de privacidade da Stripe](https://stripe.com/privacy).",
        "Para o pagamento aos anfitriões, a Stripe efetua a verificação de identidade legalmente exigida.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Diretiva dos serviços de pagamento e acesso de terceiros",
      paragraphs: [
        "A Diretiva (UE) 2015/2366 («DSP2») exige autenticação forte do cliente em muitos pagamentos. É efetuada pelo seu banco ou emitente do cartão; sem autenticação bem-sucedida um pagamento pode ser recusado.",
        "A myBestDays não é serviço de iniciação de pagamentos nem de informação sobre contas e não acede às suas contas bancárias.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Mapas, imagens e conteúdos incorporados",
      paragraphs: [
        "Para representações cartográficas e indicações de localização incorporamos serviços de mapas de terceiros. O carregamento desses conteúdos pode implicar a transmissão de dados ao respetivo prestador; os pormenores e o controlo do consentimento constam da [Política de cookies](https://mybestdays.dk/rechtliches/cookies).",
        "As imagens e descrições dos anúncios provêm do respetivo fornecedor, não de nós.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Sítios com ligação",
      paragraphs: [
        "A plataforma pode remeter para sítios de terceiros. Não temos influência sobre os seus conteúdos nem assumimos responsabilidade por eles. Logo que tomemos conhecimento de uma violação, removemos a ligação sem demora.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. Lojas de aplicações",
      paragraphs: [
        "Se obtiver a aplicação myBestDays através de uma loja de aplicações, aplicam-se ainda as condições do respetivo operador da loja. O operador da loja não é parte no contrato entre si e nós e não deve apoio nem garantia pela aplicação.",
      ],
    },
  ],
};
