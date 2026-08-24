// Portugiesische Fassung der Vereinbarung zur Auftragsverarbeitung
// (europäisches Portugiesisch). Übersetzung von `de.ts` — inhaltliche
// Änderungen gehören ZUERST dorthin und werden von dort in alle
// Sprachfassungen übernommen (dort stehen auch die Belege für die technischen
// und organisatorischen Maßnahmen und die Liste der Unterauftragsverarbeiter).
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Contrato de Subcontratação de Tratamento de Dados Pessoais",
  metaDescription:
    "Tratamento em subcontratação nos termos do artigo 28.º do RGPD entre a myNextDays ApS e os estabelecimentos que utilizam a plataforma: objeto, instruções, segurança, subcontratantes ulteriores.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `O presente contrato (doravante «Contrato de Subcontratação») aplica-se entre o estabelecimento que utiliza a plataforma myNextDays (doravante «responsável pelo tratamento») e a ${ANBIETER.firma} (doravante «subcontratante» ou «nós») e concretiza as obrigações decorrentes do artigo 28.º do Regulamento (UE) 2016/679 (RGPD).`,
    `É incorporado através dos [Termos e Condições Gerais](${AGB_URL}) e vigora durante todo o período de utilização da plataforma. Prevalece sobre os TCG no que respeita ao tratamento de dados pessoais por conta do responsável pelo tratamento.`,
    "Complementarmente, aplica-se a [Política de Privacidade](/datenschutz) aos dados que tratamos como responsável pelo tratamento por conta própria — em especial os dados da conta e da relação comercial.",
  ],
  sections: [
    {
      heading: "Objeto e repartição de papéis",
      unterpunkte: [
        {
          paragraphs: [
            "O objeto é o tratamento de dados pessoais que o responsável pelo tratamento introduz na plataforma ou recolhe através dela, para que possamos prestar os serviços contratualmente acordados: gestão de alojamentos, reservas e ocupação, comunicação com os hóspedes, processamento de pagamentos, contabilidade e extratos para proprietários, ligação a portais de reservas, construtor de websites, bem como gestão de tarefas e de equipas.",
          ],
        },
        {
          paragraphs: [
            "O responsável pelo tratamento decide sobre as finalidades e os meios deste tratamento. Tratamos os dados exclusivamente com base nas suas instruções documentadas e não para finalidades próprias.",
          ],
        },
        {
          paragraphs: [
            "Relativamente aos dados da conta, da faturação dos nossos próprios serviços, da segurança dos sistemas e da conservação legalmente exigida, somos nós o responsável pelo tratamento. Esse tratamento não é objeto do presente Contrato de Subcontratação.",
          ],
        },
      ],
    },
    {
      heading: "Natureza, âmbito e finalidade do tratamento",
      paragraphs: [
        "O tratamento realiza-se por recolha, conservação, consulta, alteração, transmissão a destinatários escolhidos pelo responsável pelo tratamento (p. ex. portais de reservas, prestadores de serviços de pagamento), limitação e apagamento — de forma automatizada na plataforma.",
        "O local de tratamento é a União Europeia; as exceções estão taxativamente indicadas na secção 8.",
      ],
    },
    {
      heading: "Categorias de titulares dos dados",
      list: [
        "Hóspedes e pessoas que reservam, incluindo acompanhantes",
        "Interessados que apresentam pedidos de informação ou enviam mensagens",
        "Proprietários dos alojamentos administrados",
        "Trabalhadores do responsável pelo tratamento (equipa, limpeza, serviço, receção)",
        "Pessoas de contacto de parceiros e prestadores de serviços do responsável pelo tratamento",
      ],
    },
    {
      heading: "Categorias de dados pessoais",
      list: [
        "Dados de identificação: nome, endereço, data de nascimento quando recolhida, nacionalidade quando recolhida para efeitos da obrigação de comunicação",
        "Dados de contacto: endereço de correio eletrónico, número de telefone",
        "Dados da reserva: período, alojamento, número de viajantes, preços, serviços adicionais, cancelamentos",
        "Dados de pagamento: montante, moeda, forma de pagamento, estado do pagamento, referências (os dados completos do cartão não chegam aos nossos sistemas)",
        "Dados de comunicação: mensagens, notas, avaliações",
        "Dados de acesso e de utilização dos trabalhadores: função, permissões, momento da autenticação, dispositivo e endereço IP da autenticação",
        "As categorias especiais previstas no artigo 9.º do RGPD não são objeto do contrato; o responsável pelo tratamento não introduz tais dados em campos de texto livre.",
      ],
    },
    {
      heading: "Instruções",
      unterpunkte: [
        {
          paragraphs: [
            "As instruções são dadas pelo responsável pelo tratamento através da utilização e da configuração da plataforma, bem como em forma de texto para o nosso endereço de contacto. As instruções verbais são por nós confirmadas em forma de texto.",
          ],
        },
        {
          paragraphs: [
            "Se considerarmos que uma instrução é ilícita, comunicamo-lo sem demora e podemos suspender a sua execução até que o responsável pelo tratamento a confirme ou a altere.",
          ],
        },
        {
          paragraphs: [
            "Se estivermos legalmente obrigados ao tratamento (por exemplo, perante autoridades), informamos previamente o responsável pelo tratamento, na medida em que a lei nos permita.",
          ],
        },
        {
          titel: "Ligação de serviços próprios do responsável pelo tratamento",
          paragraphs: [
            "O responsável pelo tratamento pode ligar a sua conta, através de uma interface, a um serviço que ele próprio escolheu e com o qual celebrou um contrato próprio — por exemplo, um assistente de IA. Se conceder tal ligação, isso constitui a sua instrução expressa, nos termos do artigo 28.º, n.º 3, alínea a), do RGPD, para disponibilizar os dados autorizados a esse serviço. Abrange expressamente também a transferência para um país terceiro daí resultante, caso o serviço tenha a sua sede fora da União Europeia.",
            "Em suma: sobre tal ligação decide exclusivamente o responsável pelo tratamento, e é ele o responsável pelo serviço ligado.",
            "Só pode concedê-la uma conta com a permissão de gerir ligações externas. Essa permissão está reservada à função «Administrador»; contas com direitos limitados — incluindo a função «Coadministrador» — não podem conceder qualquer ligação. Registamos quem a concedeu, quando e para que serviço, que tipos de dados foram autorizados e que consultas ocorreram; esse registo está à disposição do responsável pelo tratamento na interface, em «Conta → Ligações», para que possa cumprir o seu dever de responsabilidade e responder a pedidos de informação.",
            "O serviço ligado não é nosso subcontratante ulterior: não o contratamos, não o selecionamos e não lhe damos instruções. Trata os dados com base no contrato que o próprio responsável pelo tratamento celebrou com ele. Por esse tratamento, pela respetiva base jurídica e pelas garantias da transferência para um país terceiro é, por isso, competente o responsável pelo tratamento; esse tratamento não é objeto do presente Contrato de Subcontratação.",
            "Os campos de texto livre — as notas das reservas e o conteúdo das mensagens dos hóspedes — estão, por predefinição, excluídos de tal ligação. Podem conter categorias especiais de dados pessoais nos termos do artigo 9.º do RGPD, por exemplo dados relativos à saúde. O responsável pelo tratamento tem de autorizá-los separadamente no momento da concessão; sem essa autorização não são transmitidos.",
            "O responsável pelo tratamento pode, em qualquer momento, desligar na interface uma ligação concedida. Os tokens de renovação são apagados nessa altura e, em cada nova consulta, verifica-se se o consentimento subsiste — um serviço desligado deixa, por isso, de poder ler imediatamente, e não apenas depois de expirar o seu token de acesso.",
          ],
        },
      ],
    },
    {
      heading: "Confidencialidade",
      paragraphs: [
        "Todas as pessoas que, no âmbito do contrato, possam ter acesso aos dados estão obrigadas à confidencialidade e são regularmente instruídas em matéria de proteção de dados. O acesso está limitado ao necessário para a respetiva tarefa.",
        "Os acessos dos nossos trabalhadores a dados de clientes ocorrem apenas para a resolução de erros, a pedido de apoio ao cliente ou para o cumprimento de obrigações legais.",
      ],
    },
    {
      heading: "Segurança do tratamento",
      paragraphs: [
        "Adotamos as medidas técnicas e organizativas exigidas pelo artigo 32.º do RGPD. Estão implementadas, em especial:",
      ],
      list: [
        "Cifragem do transporte (TLS) em todas as ligações, cabeçalhos HTTP de segurança, incluindo uma Content-Security-Policy estrita",
        "Separação dos clientes diretamente na base de dados: regras de acesso ao nível da linha (Row Level Security) e revogação dos direitos de tabela para dados sensíveis, de modo que fique excluído um acesso fora do próprio estabelecimento, mesmo pela via direta da base de dados",
        "Permissões baseadas em funções com separação dos dados: o pessoal de serviço e de limpeza não recebe dados financeiros nem comerciais, os proprietários apenas os seus próprios alojamentos; os dados dos hóspedes são mascarados para as funções sem autorização",
        "Autenticação de dois fatores (TOTP) disponível para as contas; nova autenticação em alterações críticas para a segurança",
        "Registo das autenticações com dispositivo, momento e endereço IP, consultável pelo responsável pelo tratamento",
        "As ligações a serviços externos só podem ser concedidas por uma conta com a função «Administrador»; cada consulta através de tal ligação é registada (ferramenta, momento, âmbito — sem os próprios conteúdos) e pode ser consultada pelo responsável pelo tratamento. Uma ligação desligada perde o acesso imediatamente: em cada consulta verifica-se se o consentimento subsiste",
        "Limitação da frequência dos pedidos contra ataques automatizados, verificação das assinaturas das chamadas de webhook recebidas",
        "Cópias de segurança cifradas e conservadas fora do sistema de produção, com teste de restauro periódico",
        "Ambientes separados para o desenvolvimento e a produção; alterações à base de dados exclusivamente através de migrações versionadas",
      ],
    },
    {
      heading: "Subcontratantes ulteriores",
      paragraphs: [
        "O responsável pelo tratamento autoriza o recurso aos seguintes subcontratantes ulteriores. Com cada um deles existem contratos nos termos do artigo 28.º, n.º 4, do RGPD, com obrigações correspondentes às do presente Contrato de Subcontratação.",
      ],
      list: [
        "Hetzner Online GmbH, Alemanha (servidores, base de dados, ficheiros multimédia, servidor de correio; centro de dados em Helsínquia, Finlândia)",
        "Stripe Payments Europe, Limited, Irlanda (pagamentos, transferências, verificação legal da identidade)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburgo (pagamentos, caso o responsável pelo tratamento os ative)",
        "Channex.io Ltd, Reino Unido (ligação a portais de reservas, caso ativada)",
        "Meta Platforms Ireland Limited, Irlanda (mensagens de WhatsApp, caso ativadas)",
        "Google Ireland Limited, Irlanda (tradução de conteúdos; autenticação com a Google, caso utilizada)",
        "Groq, Inc., EUA (sugestões de resposta na caixa de entrada, caso ativadas)",
        "Cloudflare, Inc., EUA (gestão dos registos DNS de domínios próprios, caso utilizada)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Comunicamos qualquer substituição ou acrescento com, pelo menos, 30 dias de antecedência. O responsável pelo tratamento pode opor-se dentro desse prazo por motivo relevante relacionado com a proteção de dados; se a oposição não for superada, pode denunciar a parte do serviço em causa ou o contrato.",
          ],
        },
        {
          paragraphs: [
            "Os serviços que o próprio responsável pelo tratamento acorda com um terceiro não constituem subcontratação ulterior, mas uma transmissão por ele determinada. Isto vale para um portal de reservas com o qual ele tenha um contrato próprio, tal como para um assistente de IA ou outro programa que ligue à sua conta através da interface (ver a secção «Instruções»).",
            "O que é decisivo não é através de que sistemas os dados circulam, mas quem recorre ao serviço: existe subcontratação ulterior quando NÓS contratamos outro prestador de serviços para prestar o nosso serviço. Se o responsável pelo tratamento escolhe ele mesmo o serviço e celebra com ele o contrato, esse serviço trata os dados para o responsável pelo tratamento — não para nós. Esta delimitação corresponde à prática contratual de prestadores comparáveis quanto a serviços de terceiros ligados pelo cliente.",
          ],
        },
      ],
    },
    {
      heading: "Transferência para países terceiros",
      paragraphs: [
        "As transferências para destinatários fora da UE limitam-se aos serviços acima indicados com sede nos EUA ou no Reino Unido. Têm por base as cláusulas contratuais-tipo da Comissão Europeia nos termos do artigo 46.º, n.º 2, alínea c), do RGPD ou uma decisão de adequação em vigor; são aplicadas medidas de proteção complementares (cifragem, minimização dos dados).",
      ],
    },
    {
      heading: "Apoio ao responsável pelo tratamento",
      unterpunkte: [
        {
          paragraphs: [
            "Apoiamos o responsável pelo tratamento na resposta aos pedidos dos titulares dos dados (artigos 15.º a 22.º do RGPD). Para esse efeito, a plataforma oferece a informação, a retificação, a exportação e o apagamento dos dados diretamente na interface. Se os titulares dos dados se dirigirem diretamente a nós, remetemo-los para o responsável pelo tratamento e informamo-lo.",
          ],
        },
        {
          paragraphs: [
            "Apoiamos ainda nas avaliações de impacto sobre a proteção de dados, no cumprimento das obrigações dos artigos 32.º a 36.º do RGPD e nos pedidos das autoridades de controlo.",
          ],
        },
      ],
    },
    {
      heading: "Violações de dados pessoais",
      paragraphs: [
        "Se tomarmos conhecimento de uma violação de dados pessoais que afete dados do responsável pelo tratamento, informamo-lo sem demora, no prazo máximo de 48 horas a contar do conhecimento, em forma de texto.",
        "A comunicação contém, na medida do conhecido, a natureza e o momento do incidente, as categorias de dados e os grupos de pessoas afetados, as consequências prováveis e as medidas adotadas e propostas. Apoiamos o responsável pelo tratamento nos seus deveres de notificação e de comunicação nos termos dos artigos 33.º e 34.º do RGPD.",
      ],
    },
    {
      heading: "Comprovações e auditorias",
      unterpunkte: [
        {
          paragraphs: [
            "Comprovamos, a pedido, o cumprimento do presente Contrato de Subcontratação, em especial mediante informação sobre as medidas adotadas e sobre os subcontratantes ulteriores utilizados.",
          ],
        },
        {
          paragraphs: [
            "O responsável pelo tratamento pode realizar auditorias na medida do necessário ou fazê-las realizar por um auditor independente que não esteja em concorrência connosco. As auditorias têm lugar após aviso com prazo razoável, durante o horário normal de funcionamento e sem perturbação da atividade. Os custos de uma verificação que vá além da prestação de informação são suportados pelo responsável pelo tratamento, salvo se a verificação for motivada por um incidente por nós causado.",
          ],
        },
      ],
    },
    {
      heading: "Apagamento e devolução",
      paragraphs: [
        "Após o termo do contrato, disponibilizamos os dados do responsável pelo tratamento para exportação, a pedido, no prazo de 30 dias, num formato corrente e legível por máquina. Depois disso, apagamos os dados, incluindo as cópias.",
        "Excetuam-se os dados relativamente aos quais exista uma obrigação legal de conservação (em especial os dados de faturação e de contabilidade); esses são bloqueados e apagados depois de decorrido o prazo. As cópias de segurança são substituídas no ciclo de rotação normal.",
      ],
    },
    {
      heading: "Responsabilidade e prevalência",
      paragraphs: [
        "Aplica-se o artigo 82.º do RGPD. Na relação entre as partes aplicam-se, além disso, as regras de responsabilidade dos TCG, na medida em que não contrariem o RGPD.",
        "Se os TCG e o presente Contrato de Subcontratação forem contraditórios quanto ao tratamento por conta de outrem, prevalece o presente Contrato de Subcontratação. Se uma disposição for inválida, o restante conteúdo mantém-se válido; as partes substituem-na por uma regra admissível com a mesma finalidade.",
      ],
    },
    {
      heading: "Alterações do presente contrato",
      paragraphs: [
        "Podemos adaptar o presente Contrato de Subcontratação na medida em que isso se torne necessário por alterações legislativas, exigências de autoridades de controlo, requisitos de prestadores de serviços de pagamento ou desenvolvimentos técnicos, e desde que o responsável pelo tratamento não fique numa posição mais desfavorável.",
        "Anunciamos as alterações em forma de texto com, pelo menos, 30 dias de antecedência relativamente à sua entrada em vigor. Se o responsável pelo tratamento não se opuser dentro desse prazo, consideram-se aceites; esta consequência é indicada no anúncio. Em caso de oposição, qualquer das partes pode denunciar o contrato com efeitos na data da entrada em vigor.",
      ],
    },
    {
      heading: "Contacto",
      paragraphs: [
        `Os pedidos relativos ao presente contrato, as instruções e as comunicações devem ser dirigidos a [${ANBIETER.email}](mailto:${ANBIETER.email}) ou a ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
