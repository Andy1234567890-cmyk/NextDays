// Portugiesische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Política de cookies",
  metaDescription:
    "Que cookies a myNextDays utiliza: exclusivamente cookies tecnicamente necessários e funcionais, sem cookies de rastreamento ou publicitários.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Esta política explica quais os cookies e técnicas de armazenamento semelhantes que a ${ANBIETER.firma} utiliza neste website e na plataforma myNextDays.`,
    "Resumindo: utilizamos exclusivamente cookies tecnicamente necessários e funcionais. Não existem cookies de análise, publicitários ou de rastreamento, nem qualquer partilha de dados de utilização com redes publicitárias.",
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
        "Há apenas uma coisa para a qual precisamos do seu consentimento: a proteção antispam do nosso formulário de contacto. Esta provém da Google (reCAPTCHA Enterprise), sendo, portanto, um serviço externo, e só é carregada se a tiver autorizado. Para isso, surge uma barra na parte inferior do ecrã — na primeira visita, com botões de igual destaque para «Rejeitar» e «Aceitar» e sem seleção prévia. Enquanto não tiver decidido, aplica-se «não permitido».",
        "A sua decisão fica guardada na memória do seu navegador (Local Storage, valor «nd_consent»); contém apenas a categoria, o momento e um número de versão, sem qualquer identificação da sua pessoa. Pode alterá-la ou revogá-la a qualquer momento através do ícone de cookies no canto inferior esquerdo de cada página. Após seis meses, voltaremos a perguntar — um consentimento não deve manter-se válido indefinidamente.",
      ],
    },
    {
      heading: "Este website",
      paragraphs: [
        "O website de marketing não define quaisquer cookies. Os tipos de letra e os ícones estão alojados no nosso próprio servidor — não é chamado nenhum serviço de ícones ou de tipos de letra de terceiros para o efeito. O único serviço externo desta página é a proteção antispam do formulário de contacto, que só é carregada com o seu consentimento. Os pormenores constam da [Política de Privacidade](/datenschutz).",
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
          titel: "nd_refresh — Prolongamento da sessão (tecnicamente necessário)",
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
            "Regista a sua decisão sobre a proteção antispam do formulário de contacto, para que a barra de consentimento não volte a perguntar em cada visita. São guardados apenas a categoria, o momento e um número de versão. O valor não sai do seu dispositivo e não é transmitido ao nosso servidor; aplica-se a este navegador. Validade: seis meses — depois desse prazo, a barra volta a perguntar. Se eliminar o valor, a barra volta a perguntar na próxima visita.",
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
