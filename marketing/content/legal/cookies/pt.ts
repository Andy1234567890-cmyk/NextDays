// Portugiesische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Política de cookies",
  metaDescription:
    "Quais cookies myNextDays define: cookies tecnicamente necessários e — apenas com o seu consentimento — cookies funcionais, analíticos e de marketing. Cada categoria pode ser ativada e desativada individualmente.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Esta política explica quais os cookies e técnicas de armazenamento semelhantes que a ${ANBIETER.firma} utiliza neste website e na plataforma myNextDays.`,
    "Em resumo: Apenas os cookies sem os quais o site não funciona como solicitado são necessários. Tudo o mais requer o seu consentimento e não será carregado sem ele — a proteção contra spam do nosso formulário de contato, a medição de alcance e os cookies de marketing com os quais medimos o sucesso da nossa publicidade. Você pode permitir ou recusar cada uma dessas categorias individualmente e revogar sua decisão a qualquer momento.",
  ],
  sections: [
    {
      heading: "O que são cookies",
      paragraphs: [
        "Cookies são pequenos ficheiros de texto que um website guarda no navegador. Permitem reconhecer uma sessão — por exemplo, para que continue com sessão iniciada depois de se autenticar. Além dos cookies, os navegadores utilizam outros tipos de armazenamento, como o Local Storage, que funcionam de forma tecnicamente semelhante.",
      ],
    },
    {
      heading: "Para que precisamos do seu consentimento",
      paragraphs: [
        "O consentimento só é necessário nos termos do artigo 9.º do regulamento dinamarquês sobre cookies (Cookie-bekendtgørelsen) (que transpõe o artigo 5.º, n.º 3, da Diretiva 2002/58/CE), quando o acesso ao seu dispositivo não se destina exclusivamente à transmissão de uma comunicação ou não é estritamente necessário para um serviço expressamente solicitado.",
        "Todos os cookies que definimos são necessários para o início de sessão, para a segurança da sessão ou para uma definição escolhida por si — por isso não solicitamos nada, e também não definimos nada que exigisse consentimento.",
        'Você deve consentir para três categorias, todas as quais não serão carregadas sem sua permissão: a proteção contra spam do nosso formulário de contato (reCAPTCHA do Google), a medição de alcance deste site (Google Analytics 4) e os cookies de marketing (Meta, LinkedIn, Google Ads). Para isso, uma janela com uma lista de categorias aparece — na primeira visita, sem pré-seleção, cada categoria com seu próprio interruptor. Enquanto você não decidir, "não permitido" se aplica, e nada será avaliado ou anunciado.',
        "A sua decisão fica guardada na memória do seu navegador (Local Storage, valor «nd_consent»); contém apenas a categoria, o momento e um número de versão, sem qualquer identificação da sua pessoa. Pode alterá-la ou revogá-la a qualquer momento através do ícone de cookies no canto inferior esquerdo de cada página. Após seis meses, voltaremos a perguntar — um consentimento não deve manter-se válido indefinidamente.",
      ],
    },
    {
      heading: "Este website",
      paragraphs: [
        'Este site não define cookies por si só. Fontes e símbolos estão em nosso próprio servidor — nenhum serviço de símbolos ou fontes de terceiros é chamado para isso. Além disso, apenas os serviços que você permite são adicionados: a proteção contra spam do formulário de contato, a medição de alcance e os serviços de marketing. Quais cookies são definidos, com qual duração e em qual host, estão listados abaixo na seção "Cookies de Terceiros". A revogação é feita através do ícone de cookie no canto inferior esquerdo — o serviço respectivo termina imediatamente e seus cookies são excluídos. Detalhes estão na [Política de Privacidade](/datenschutz).',
      ],
    },
    {
      heading: "Cookies da plataforma",
      paragraphs: [
        "Assim que iniciar sessão no painel de controlo, no marketplace ou na vista móvel, são definidos os seguintes cookies:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — Início de sessão (tecnicamente necessário)",
          list: [
            "Finalidade: identifica a sua sessão com sessão iniciada perante o servidor.",
            "Conteúdo: token de acesso de curta duração; legível apenas pelo servidor (HttpOnly), transmitido apenas via HTTPS.",
            "Duração: sessão ou até à expiração do token.",
          ],
        },
        {
          titel:
            "nd_refresh — Prolongamento da sessão (tecnicamente necessário)",
          list: [
            "Finalidade: renova o token de acesso, para que não tenha de iniciar sessão constantemente.",
            "Conteúdo: token de renovação; HttpOnly, apenas via HTTPS.",
            "Duração: até ao terminar de sessão ou à expiração.",
          ],
        },
        {
          titel: "nd_locale — Seleção de idioma (funcional)",
          list: [
            "Finalidade: memoriza o idioma escolhido por si.",
            "Conteúdo: código do idioma, por exemplo «de» ou «en».",
            "Duração: até à alteração ou eliminação.",
          ],
        },
        {
          titel: "sidebar_state — Barra lateral (funcional)",
          list: [
            "Finalidade: memoriza se a barra de navegação está expandida ou recolhida.",
            "Conteúdo: «true» ou «false».",
            "Duração: até à alteração ou eliminação.",
          ],
        },
        {
          titel:
            "sb-… — Início de sessão com a Google (tecnicamente necessário, apenas em caso de utilização)",
          list: [
            "Finalidade: mantém a sessão quando inicia sessão através da Google.",
            "Conteúdo: token de sessão do serviço de início de sessão.",
            "Duração: sessão ou até à expiração do token. Só é definido se optar pelo início de sessão com a Google.",
          ],
        },
      ],
    },
    {
      heading: "Local Storage",
      unterpunkte: [
        {
          titel: "nd_consent",
          paragraphs: [
            "Registra sua decisão sobre os serviços que exigem consentimento (proteção contra spam do formulário de contato e medição de alcance).",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Só é definido se abrir o chat neste website e enviar uma mensagem. É a chave da sua própria conversa — sem ele, não conseguiria encontrar novamente a nossa resposta após mudar de página. Não contém quaisquer dados sobre si e é utilizado apenas para esta finalidade.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Guarda no navegador se concordou com a utilização da entrada de voz, para que o consentimento não seja pedido novamente em cada visita. O valor não sai do seu dispositivo.",
          ],
        },
      ],
    },
    {
      heading: "Cookies da aplicação móvel",
      paragraphs: [
        "A aplicação móvel não funciona com cookies. Os tokens de acesso e de renovação são guardados no armazenamento seguro de chaves do dispositivo (iOS Keychain, Android Keystore) e eliminados ao terminar sessão.",
      ],
    },
    {
      heading: "Cookies de terceiros",
      paragraphs: [
        "Se efetuar um pagamento, o prestador de serviços de pagamento (Stripe ou PayPal) pode definir, na sua própria página, cookies necessários para o processamento e a prevenção de fraudes. Aplicam-se as disposições do respetivo prestador.",
        "Nos websites que os operadores criam com o nosso construtor de sites, é o respetivo operador quem decide sobre cookies adicionais e é responsável pelas informações aí apresentadas.",
        "Apenas com o seu consentimento, os serviços Google neste website instalam os seguintes cookies — dois para medição de alcance, um para proteção contra spam. Sem o seu consentimento, o respetivo script não será carregado e nenhum destes cookies será instalado; em caso de revogação, nós os apagaremos.",
      ],
      unterpunkte: [
        {
          titel:
            "_fbp — Medição de sucesso de publicidade (consentimento necessário)",
          list: [
            "Finalidade: associa a sua visita a um anúncio para que possamos medir o sucesso das nossas campanhas.",
            "Conteúdo: um identificador gerado aleatoriamente; não contém o seu nome, e-mail ou informações de conta da nossa parte.",
            "Fornecedor: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Irlanda.",
            "Host: mynextdays.com (cookie primário, definido pelo script da Meta). Duração: aproximadamente três meses.",
          ],
        },
        {
          titel:
            "_gcl_au — Medição de sucesso do Google Ads (consentimento necessário)",
          list: [
            "Finalidade: associa a sua visita a um anúncio do Google para que possamos medir o sucesso das nossas campanhas.",
            "Conteúdo: um identificador gerado aleatoriamente sem referência à sua pessoa.",
            "Fornecedor: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlanda.",
            "Host: mynextdays.com (cookie primário). Duração: aproximadamente três meses.",
          ],
        },
        {
          titel:
            "li_gc e bcookie — Publicidade do LinkedIn (consentimento necessário)",
          list: [
            "Finalidade: identifica o seu navegador para o LinkedIn, para que os anúncios e o seu sucesso possam ser atribuídos; li_gc também armazena o seu consentimento lá.",
            "Conteúdo: um identificador de navegador e o status de consentimento; não contém informações da sua conta connosco.",
            "Fornecedor: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Irlanda.",
            "Host: linkedin.com (cookies de terceiros). Duração: aproximadamente seis meses ou um ano.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — Proteção contra spam do formulário de contacto (consentimento necessário)",
          list: [
            "Host: www.google.com (cookie de terceiros).",
            "Finalidade: permite que a Google avalie riscos, distinguindo mensagens em massa automatizadas de pedidos genuínos.",
            "Conteúdo: um identificador gerado pela Google para esta avaliação; não inclui o seu nome, e-mail ou informações de conta.",
            "Fornecedor: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlanda.",
            "Duração: definida pela Google, até seis meses. Só é definido depois de permitir a proteção contra spam e abrir o formulário de contacto.",
          ],
        },
        {
          titel: "_ga — Medição de alcance (consentimento necessário)",
          list: [
            "Host: mynextdays.com (cookie primário, definido pelo script do Google).",
            "Finalidade: distingue visitantes para que chamadas recorrentes não sejam contadas duas vezes.",
            "Conteúdo: identificador gerado aleatoriamente sem relação com sua pessoa; sem informações de nome, e-mail ou conta.",
            "Provedor: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlanda.",
            "Duração: até dois anos.",
          ],
        },
        {
          titel:
            "_ga_<ID> — Status da sessão da medição (consentimento necessário)",
          list: [
            "Host: mynextdays.com (cookie primário, definido pelo script do Google).",
            "Finalidade: registra quando sua visita atual começou, para que as visualizações de página de uma sessão pertençam juntas.",
            "Conteúdo: carimbo de data/hora e contador da sessão; o identificador no nome designa nossa propriedade, não você.",
            "Provedor: Google Ireland Limited.",
            "Duração: até dois anos.",
          ],
        },
      ],
    },
    {
      heading: "Eliminar e controlar cookies",
      paragraphs: [
        "Pode eliminar ou bloquear cookies a qualquer momento nas definições do seu navegador. Se bloquear os cookies necessários, o início de sessão na plataforma torna-se tecnicamente impossível — o website público e o marketplace continuam utilizáveis sem sessão iniciada.",
        "Ao terminar sessão, nós próprios removemos os cookies de início de sessão.",
      ],
    },
    {
      heading: "Alterações a esta política",
      paragraphs: [
        "Se forem adicionadas funcionalidades que necessitem de cookies adicionais, atualizaremos esta lista. Aplica-se sempre a versão aqui publicada; a data no topo indica a atualização.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
