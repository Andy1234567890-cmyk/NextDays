// Portugiesische Fassung der Datenschutzerklärung (europäisches Portugiesisch).
//
// Referenz ist content/legal/datenschutz/de.ts — INHALTLICHE Änderungen gehören
// ZUERST dorthin und werden von dort in alle Sprachfassungen nachgezogen. Diese
// Datei hat dieselbe Struktur wie de.ts (20 Abschnitte, gleiche Absatzzahlen);
// Firmen-, Register-, Dienstleister- und Rechtsakt-Bezeichnungen bleiben
// unübersetzt.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Política de privacidade",
  metaDescription:
    "Como a myNextDays trata dados pessoais: finalidades, fundamentos jurídicos, destinatários, prazos de conservação e os seus direitos ao abrigo do RGPD.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Esta política descreve o modo como a ${ANBIETER.firma} trata dados pessoais — na visita a este sítio Web, na utilização da plataforma myNextDays (painel de gestão, mercado e aplicação móvel) e no âmbito da relação comercial com os nossos clientes.`,
    "Não vendemos dados nem criamos perfis que o identifiquem como pessoa. Neste site, medimos — apenas com o seu consentimento — o alcance das nossas páginas e o sucesso da nossa publicidade; ambas as categorias podem ser desativadas individualmente (ver seções Medição de Alcance e Publicidade e Medição de Sucesso). Para fins promocionais, processamos dados apenas onde você consentiu explicitamente — ou seja, para nossa newsletter (consulte a seção Comunicação), que você pode cancelar a qualquer momento com um clique.",
  ],
  sections: [
    {
      heading: "Responsável pelo tratamento",
      paragraphs: [
        "O responsável pelos tratamentos descritos nesta política é:",
      ],
      zeilen: [
        {
          label: "Empresa",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Endereço",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefone",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Âmbito de aplicação e papéis",
      unterpunkte: [
        {
          paragraphs: [
            "Quanto à visita a este sítio Web, à sua conta de cliente e à execução da nossa relação comercial, somos responsáveis pelo tratamento na aceção do artigo 4.º, n.º 7, do RGPD.",
          ],
        },
        {
          paragraphs: [
            "Quanto aos dados que os nossos clientes (arrendadores, hotéis, agências) tratam na plataforma sobre os seus hóspedes, proprietários e colaboradores, os clientes são responsáveis pelo tratamento e nós somos subcontratante nos termos do artigo 28.º do RGPD. Os pormenores constam do [contrato de subcontratação](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Se, como hóspede, reservar um alojamento através do nosso mercado, tratamos os seus dados de reserva e de contacto tanto em nome próprio (exploração do mercado, processamento de pagamentos) como em benefício da empresa que acolhe. O seu contrato de alojamento é celebrado exclusivamente com essa empresa; a política de privacidade da mesma aplica-se em paralelo.",
          ],
        },
      ],
    },
    {
      heading: "Visita a este sítio Web",
      unterpunkte: [
        {
          titel: "Ficheiros de registo do servidor",
          paragraphs: [
            "Em cada acesso, o seu navegador transmite dados tecnicamente necessários que o nosso servidor Web regista: endereço IP, data e hora, endereço acedido, volume de dados transferido, código de estado, referenciador e identificação do navegador. A finalidade é a disponibilização da página, bem como a deteção e a defesa contra ataques e perturbações. O fundamento jurídico é o artigo 6.º, n.º 1, alínea f), do RGPD; o nosso interesse legítimo consiste numa exploração segura e estável. Os registos são conservados apenas durante o tempo necessário à exploração e à segurança e não são combinados com outros dados.",
          ],
        },
        {
          titel: "Tipos de letra",
          paragraphs: [
            "Os tipos de letra utilizados estão integrados localmente no nosso servidor. Não ocorre qualquer ligação ao Google Fonts nem a outro serviço de tipos de letra.",
          ],
        },
        {
          titel: "Ícones",
          paragraphs: [
            "Os ícones deste sítio Web encontram-se, tal como os tipos de letra, junto de nós: são inseridos na página no nosso servidor e não são carregados de um serviço de ícones. Não ocorre qualquer ligação a um terceiro e o seu endereço IP não é transmitido a ninguém.",
          ],
        },
        {
          titel: "Proteção do formulário de contacto contra spam (reCAPTCHA)",
          paragraphs: [
            "O nosso formulário de contacto está protegido contra mensagens automatizadas em massa através do reCAPTCHA Enterprise da Google Ireland Limited. Só se der o seu consentimento é que o seu navegador carrega, ao preencher o formulário, um script de www.google.com; são então transmitidos à Google o seu endereço IP e informações sobre a sua interação com o formulário, ali analisados para distinguir pessoa de script. O fundamento jurídico é o artigo 6.º, n.º 1, alínea a), do RGPD (consentimento); aplica-se complementarmente a [política de privacidade da Google](https://policies.google.com/privacy).",
            "Sem o seu consentimento, nada do Google será carregado e nenhum dado será transmitido para lá; não aceitaremos o formulário, mas poderá enviar-nos um e-mail a qualquer momento. Se der o seu consentimento, o reCAPTCHA definirá o seu próprio cookie (_GRECAPTCHA, duração definida pelo Google, até seis meses), que é usado para avaliação de risco. Pode alterar ou revogar o seu consentimento a qualquer momento através do ícone de cookie no canto inferior esquerdo de cada página; o cookie será então excluído.",
          ],
        },
        {
          titel: "Medição de Alcance (Google Analytics)",
          paragraphs: [
            "Neste site, utilizamos o Google Analytics 4 da Google Ireland Limited para medir como as nossas páginas são utilizadas — quais páginas são visitadas, de onde vêm os visitantes e em que ponto eles saem. O objetivo é exclusivamente melhorar a oferta e a capacidade de localização.",
            'O carregamento ocorre exclusivamente com o seu consentimento. Se o conceder, o seu navegador carregará um script de www.googletagmanager.com e armazenará dois cookies ("_ga" e "_ga_<ID>", com duração de até dois anos) com um identificador gerado aleatoriamente; este identificador, as páginas visitadas, a fonte de referência, a localização aproximada a nível de país ou região, o dispositivo e o navegador, bem como o seu endereço IP, que o Google encurta antes de qualquer armazenamento, serão transmitidos. A base legal é o Art. 6, parágrafo 1, alínea a do RGPD (consentimento).',
            "Restringimos explicitamente a avaliação: os sinais do Google e a personalização de anúncios estão desativados. Portanto, não são criados perfis entre dispositivos nem públicos-alvo para publicidade, e não partilhamos dados de utilização com redes de publicidade. Não há fusão com a sua conta de cliente.",
            "O Google processa os dados como nosso subcontratante com base num contrato nos termos do Art. 28 do RGPD (Termos de Processamento de Dados do Google Ads). O encurtamento do seu endereço IP ocorre em servidores na UE antes que os dados sejam transferidos para os EUA; portanto, um conjunto de dados pseudónimo é transmitido. A base para a transmissão é a decisão de adequação da Comissão da UE para o Quadro de Privacidade de Dados UE-EUA (Art. 45 do RGPD), sob o qual o Google LLC é certificado; adicionalmente, o Google incluiu as cláusulas contratuais padrão da Comissão da UE (Art. 46 do RGPD). Salientamos expressamente que as autoridades dos EUA, de acordo com a Secção 702 da FISA, também podem aceder a dados de empresas certificadas e, portanto, um risco residual não pode ser completamente excluído. Além disso, aplica-se a [Política de Privacidade do Google](https://policies.google.com/privacy).",
            "Período de armazenamento: Os dados relacionados com eventos e utilizadores são automaticamente eliminados da nossa propriedade após 14 meses; os dados de relatórios agregados sem referência a visitantes individuais são mantidos para além desse período. O seu consentimento expira após seis meses.",
            "Sem o seu consentimento, nada é carregado, nenhum cookie é definido e nenhum dado é enviado para o Google. Pode revogar o seu consentimento a qualquer momento através do ícone de cookie no canto inferior esquerdo de cada página; a medição terminará imediatamente e os cookies mencionados serão eliminados. Após seis meses, perguntaremos novamente.",
          ],
        },
        {
          titel: "Publicidade e medição de sucesso",
          paragraphs: [
            "Com o seu consentimento, utilizamos cookies de marketing para medir o sucesso da nossa publicidade e para lhe mostrar anúncios relevantes noutras plataformas. Estão envolvidos Meta Platforms Ireland (Meta-Pixel, cookie _fbp), LinkedIn Ireland (Insight-Tag, cookies li_gc e bcookie) e Google Ireland Limited (Google Ads, cookie _gcl_au). A base legal é o Art. 6, parágrafo 1, alínea a do RGPD. Sem o seu consentimento, nenhum destes scripts será carregado e nenhum cookie será definido; em caso de revogação, iremos eliminá-los. Detalhes sobre cada cookie estão na [Política de Cookies](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Conta de cliente e utilização da plataforma",
      paragraphs: [
        "Para o registo e a manutenção de uma conta tratamos os dados que o utilizador ou a sua empresa introduzem: nome, firma e forma jurídica, endereço, endereço de e-mail, número de telefone, papel e permissões, dados de registo (por exemplo, número de registo comercial ou de IVA), conta bancária para pagamentos e os conteúdos criados na conta.",
        "Para proteger o acesso tratamos ainda registos de início de sessão (momento, endereço IP, dispositivo e navegador utilizados no início de sessão) e — se estiver ativada — os dados da autenticação de dois fatores.",
        "Início de sessão com a Google: em vez de e-mail e palavra-passe, também pode iniciar sessão com uma conta Google. Se escolher esta via, recebemos da Google Ireland Limited exclusivamente o seu endereço de e-mail, o seu nome, a sua imagem de perfil e um identificador da sua conta Google (os âmbitos «openid», «email», «profile») — expressamente nenhum acesso aos seus e-mails, contactos, ficheiros ou calendário. A sua palavra-passe da Google não chega ao nosso conhecimento. A Google trata o processo de início de sessão como responsável autónomo; aplica-se a [política de privacidade da Google](https://policies.google.com/privacy). O fundamento jurídico é o artigo 6.º, n.º 1, alínea b), do RGPD, uma vez que o início de sessão serve a execução do contrato; a escolha desta via é voluntária e pode ser substituída em qualquer momento pelo início de sessão com e-mail e palavra-passe.",
        "O fundamento jurídico é o artigo 6.º, n.º 1, alínea b), do RGPD (execução do contrato de utilização, ver [Termos e Condições Gerais](" +
          AGB_URL +
          ")), para a segurança do acesso o artigo 6.º, n.º 1, alínea f), do RGPD e, para a conservação por motivos fiscais e comerciais, o artigo 6.º, n.º 1, alínea c), do RGPD.",
      ],
    },
    {
      heading: "Reservas, dados de hóspedes e dados dos imóveis",
      paragraphs: [
        "Através da plataforma são tratadas reservas, dados de hóspedes, mensagens, tarefas e faturação. Incluem-se em especial o nome e os dados de contacto do hóspede, a chegada e a partida, o número de viajantes, os preços e o estado do pagamento, o historial de mensagens e — na medida em que a empresa os recolha — os dados de registo de hóspedes e os pedidos especiais.",
        "Este tratamento é efetuado por conta e segundo as instruções da respetiva empresa. Não utilizamos estes dados para finalidades próprias, nem para publicidade, nem para o treino de modelos de IA.",
        "Dentro de uma empresa os dados estão separados por papéis: o pessoal de limpeza e de serviço não vê dados financeiros nem comerciais, os proprietários apenas os seus próprios imóveis. Entre empresas diferentes os dados estão tecnicamente separados (regras de acesso por inquilino diretamente na base de dados).",
      ],
    },
    {
      heading: "Processamento de pagamentos",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Os pagamentos com cartão e os pagamentos a receber são processados através da Stripe Payments Europe, Limited, Irlanda. São transmitidos à Stripe os dados necessários ao pagamento (montante, moeda, meio de pagamento, nome, endereço de e-mail, referência da reserva) e, quanto às contas dos nossos clientes, os dados de identificação legalmente exigidos (titular, beneficiários efetivos, dados do documento de identificação, conta bancária). Os dados completos do cartão não chegam aos nossos sistemas. Os fundamentos jurídicos são o artigo 6.º, n.º 1, alínea b), do RGPD e, quanto aos deveres de identificação e de combate ao branqueamento de capitais, o artigo 6.º, n.º 1, alínea c), do RGPD. Os pormenores constam da [política de privacidade da Stripe](https://stripe.com/privacy).",
            "Ligações de pagamento para serviços adicionais: se uma empresa fatura ao seu hóspede um serviço adicional (por exemplo, limpeza ou lavandaria) através de uma ligação de pagamento, essa ligação conduz a uma página de pagamento explorada pela Stripe. Para o efeito transmitimos à Stripe a designação do serviço, o montante, a moeda e uma referência interna à reserva e à empresa; o logótipo da empresa é transferido para a respetiva conta Stripe, para que a página apresente a sua marca. Na própria página de pagamento, a Stripe recolhe os dados de pagamento e do dispositivo do hóspede sob responsabilidade própria. Regressam a nós apenas o estado do pagamento, o montante, os montantes retidos e os identificadores do pagamento — nenhuns dados de cartão.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Se a empresa oferecer o PayPal como método de pagamento, os dados de pagamento são transmitidos à PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburgo. Aplica-se a [política de privacidade da PayPal](https://www.paypal.com/de/webapps/mpp/ua/privacy-full).",
          ],
        },
      ],
    },
    {
      heading: "Canais de venda e portais",
      paragraphs: [
        "Se uma empresa vender os seus imóveis através de portais como o Booking.com, o Airbnb ou o Expedia, as disponibilidades, os preços, as restrições e os dados de reserva são trocados com o respetivo portal através do nosso prestador de serviços de integração Channex.io Ltd, Reino Unido. Nesse sentido inverso, recebemos os dados de reserva e de hóspedes do portal.",
        "Ao respetivo portal aplicam-se as suas próprias disposições de proteção de dados; nessa medida, o portal é responsável de forma autónoma. O fundamento jurídico da transmissão é o artigo 6.º, n.º 1, alínea b), do RGPD, em conjugação com a instrução da empresa.",
      ],
    },
    {
      heading: "Comunicação",
      unterpunkte: [
        {
          titel: "E-mail",
          paragraphs: [
            "Os e-mails no âmbito da utilização (confirmações de reserva, mensagens de sistema, apoio ao cliente, ligações de confirmação e de convite) são enviados e recebidos através de um servidor de correio próprio, explorado por nós. Para estas mensagens não está integrado qualquer serviço de envio externo.",
          ],
        },
        {
          titel: "Newsletter e pré-inscrição",
          paragraphs: [
            "No nosso sítio Web pode inscrever-se para receber novidades sobre a myNextDays (pré-inscrição/newsletter). São tratados o seu endereço de e-mail, o idioma e o local onde efetuou a inscrição.",
            "A inscrição segue o procedimento de duplo consentimento: depois de se inscrever, recebe um e-mail com uma ligação de confirmação; a inscrição só se torna eficaz com o clique nessa ligação. Como prova do consentimento conservamos o momento da inscrição e da confirmação, o endereço IP então utilizado, a identificação do navegador e o texto a que deu o seu acordo. Estes elementos servem exclusivamente de prova nos termos do artigo 7.º, n.º 1, do RGPD e não são analisados para fins publicitários.",
            "O fundamento jurídico é o seu consentimento nos termos do artigo 6.º, n.º 1, alínea a), do RGPD; a conservação da prova baseia-se no artigo 6.º, n.º 1, alínea c), em conjugação com o artigo 7.º, n.º 1, do RGPD. Pode retirar o consentimento em qualquer momento com efeitos para o futuro — através da ligação de cancelamento em cada e-mail da newsletter ou por simples e-mail dirigido a nós. A retirada não afeta a licitude do tratamento efetuado até esse momento.",
            "Para a gestão e o envio das newsletters recorremos à Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, França; sucursal alemã: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin) como subcontratante. São transmitidos o seu endereço de e-mail e os elementos adicionais referidos (idioma, origem). Os dados são tratados em servidores situados na União Europeia (França e Alemanha); com a Brevo existe um contrato de subcontratação nos termos do artigo 28.º do RGPD. Aplica-se a [política de privacidade da Brevo](https://www.brevo.com/legal/privacypolicy/).",
            "Quando enviamos uma newsletter, a Brevo mede por nossa conta se a mensagem foi aberta e se as ligações nela contidas foram clicadas. Esta medição ajuda-nos a ajustar o conteúdo e a frequência; faz parte do consentimento e termina com o cancelamento da subscrição. Não ocorre qualquer combinação com outras fontes de dados nem definição de perfis.",
            "Enquanto a confirmação estiver pendente, o seu endereço não é contactado nem transmitido à Brevo; uma inscrição não confirmada caduca após sete dias. Após um cancelamento, bloqueamos o endereço para envios e conservamos a prova do consentimento e do cancelamento enquanto dela possam resultar pretensões; a pedido, eliminamo-la integralmente.",
          ],
        },
        {
          titel: "Mensagens na plataforma",
          paragraphs: [
            "As mensagens entre hóspede e empresa são guardadas na plataforma, para que ambas as partes possam consultar o historial. Se uma empresa bloquear um hóspede, o canal de mensagens é fechado; as mensagens existentes mantêm-se para efeitos de rastreabilidade.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Se uma empresa utilizar a integração do WhatsApp, os conteúdos das mensagens e os números de telefone dos intervenientes são transmitidos através da WhatsApp Business Platform da Meta Platforms Ireland Limited. A utilização desta funcionalidade é decidida pela empresa; sem ativação não ocorre qualquer transmissão.",
          ],
        },
      ],
    },
    {
      heading: "Funcionalidades automatizadas e IA",
      paragraphs: [
        "Às funcionalidades aqui descritas aplica-se, além do RGPD, o Regulamento (UE) 2024/1689 (Regulamento da Inteligência Artificial, «AI Act»), cujos deveres de transparência previstos no artigo 50.º são aplicáveis desde 2 de agosto de 2026.",
      ],
      unterpunkte: [
        {
          titel: "Sugestões de resposta",
          paragraphs: [
            "Para as sugestões de resposta na caixa de entrada de mensagens utilizamos — desde que a funcionalidade esteja ativada para a empresa — a oferta de modelos de linguagem da Groq, Inc., EUA. É transmitido ao serviço o contexto da mensagem em causa. As sugestões não são enviadas automaticamente; o envio é sempre decidido por uma pessoa. Não ocorre qualquer decisão automatizada com efeitos jurídicos na aceção do artigo 22.º do RGPD.",
            "Não se trata, por conseguinte, de um sistema de IA que interaja diretamente com pessoas naturais na aceção do artigo 50.º, n.º 1, do Regulamento da Inteligência Artificial: o dever pressupõe uma interação DIRETA, na qual a própria IA comunica com a pessoa e não através de um intermediário humano. Aqui, a funcionalidade propõe à empresa um texto que um colaborador verifica, pode alterar e envia ele próprio — o colaborador é esse intermediário, o hóspede corresponde-se com a empresa e não com um chatbot. Não está em uso qualquer assistente de resposta automática. Segundo a nossa apreciação, a funcionalidade também não preenche nenhuma das situações de IA de risco elevado previstas no anexo III do Regulamento da Inteligência Artificial.",
            "As mensagens dirigidas a hóspedes também não são «texto sobre questões de interesse público» na aceção do artigo 50.º, n.º 4, do Regulamento da Inteligência Artificial: não são publicadas, mas enviadas individualmente a uma pessoa determinada, e dizem respeito ao processamento de uma estada. Independentemente disso, aplica-se aqui a verificação humana pelo colaborador que envia.",
            "Caso venha a ser oferecida uma funcionalidade que responda a hóspedes de forma autónoma — sem aprovação humana —, o hóspede será informado de forma visível, no início do diálogo, de que está a escrever com um sistema de IA. Sem essa indicação, tal funcionalidade não será disponibilizada.",
          ],
        },
        {
          titel: "Consultor de produto neste site",
          paragraphs: [
            "Neste site, um consultor de produto com IA responde a perguntas sobre nosso software. Ele usa exclusivamente conteúdo disponível publicamente neste site (artigos de ajuda, descrições de recursos, perguntas frequentes, textos legais), bem como os preços atuais de nossa faturação. Dados de clientes, reservas ou dados de hóspedes não estão disponíveis para ele.",
            "Ao contrário das sugestões de resposta na caixa de entrada, este consultor responde IMEDIATAMENTE e sem aprovação humana. É, portanto, um sistema de IA no sentido do Art. 50, parágrafo 1 do Regulamento de IA, que interage diretamente com pessoas físicas. Por isso, no início do diálogo, você será explicitamente informado de que as respostas vêm de um assistente de IA e podem conter erros.",
            "Sua pergunta e o idioma selecionado são processados. Ambos são transmitidos para o Google Cloud (Vertex AI) na região europe-west4 (Holanda) para resposta; nenhum processamento fora da UE ocorre. Não armazenamos as perguntas permanentemente e não as usamos para treinar modelos de IA. A base legal é nosso interesse legítimo em fornecer informações rápidas para interessados (Art. 6, parágrafo 1, alínea f do RGPD).",
            "Se o consultor não conseguir responder a uma pergunta com o conteúdo existente, ele oferece o encaminhamento para nosso suporte. Somente então — e apenas se você preencher o formulário — coletamos nome, endereço de e-mail e, opcionalmente, seu número de telefone; processamos esses dados de acordo com as regras na seção \"Comunicação\".",
          ],
        },
        {
          titel: "Papéis ao abrigo do Regulamento da Inteligência Artificial",
          paragraphs: [
            "Quanto às funcionalidades de IA integradas no produto, somos responsáveis pela implantação na aceção do artigo 3.º, n.º 4, do Regulamento da Inteligência Artificial; prestadores dos modelos de linguagem subjacentes são os respetivos fornecedores de modelos. Se uma empresa utilizar estas funcionalidades no âmbito da sua atividade profissional, é ela própria responsável pela implantação e recai sobre ela o dever de literacia em IA previsto no artigo 4.º do Regulamento da Inteligência Artificial, aplicável desde 2 de fevereiro de 2025 independentemente da dimensão da empresa. Desde 27 de julho de 2026 aplica-se na redação do Regulamento (UE) 2026/1744: os prestadores e os responsáveis pela implantação tomam medidas para apoiar o desenvolvimento da literacia em IA do seu pessoal; expressamente, não tem de ser garantido um determinado nível. Apoiamos através de indicações na aplicação e no nosso centro de ajuda; a formação dos próprios colaboradores continua a ser tarefa da empresa.",
            "Se uma empresa ligar a sua conta a um assistente de IA próprio (ver o ponto seguinte), é também quanto a isso responsável pela implantação na aceção do Regulamento da Inteligência Artificial — decide sobre a utilização e formula os pedidos. A interface em si não é um sistema de IA: lê dados da base de dados e devolve-os, sem efetuar inferências; o considerando 12 do Regulamento da Inteligência Artificial delimita expressamente tais sistemas face à IA.",
          ],
        },
        {
          titel: "Ligação a um assistente de IA próprio",
          paragraphs: [
            "Uma empresa pode ligar a sua conta, através de uma interface, a um assistente de IA por ela escolhido e com o qual tem um contrato próprio — por exemplo o Claude da Anthropic PBC, EUA. Concedida essa ligação, o assistente pode, a pedido da empresa, consultar em modo de leitura: ocupação, disponibilidade e preços diários; reservas com nome do hóspede, período de estada, imóvel, canal de reserva, estado, bem como montante e moeda, na medida em que o papel da conta que consulta possa ver montantes; e a lista das conversas na caixa de entrada. Sem uma ligação concedida não ocorre qualquer transmissão.",
            "Não são transmitidos o endereço de e-mail e o número de telefone dos hóspedes, os dados de cartão, as contas bancárias e os comprovativos de pagamento, os códigos de acesso nem os dossiês dos imóveis. As notas de reserva e o conteúdo das mensagens dos hóspedes estão excluídos por predefinição, porque podem conter indicações sobre a saúde ou outras categorias especiais na aceção do artigo 9.º do RGPD; a empresa tem de os autorizar expressamente e em separado ao conceder a ligação.",
            "A ligação só pode ser concedida por uma conta com o papel «administrador», não por qualquer conta com acesso. Cada consulta é registada e pode ser vista pela empresa em «Conta → Ligações»; a empresa pode aí desligar a ligação em qualquer momento, cessando o acesso de imediato.",
            "Juridicamente, esta transmissão é uma instrução da empresa dirigida a nós (artigo 28.º, n.º 3, alínea a), do RGPD). O prestador do assistente não é nosso subcontratante ulterior — não o contratamos nem lhe damos instruções; trata os dados com base no contrato que a própria empresa celebrou com ele. Pelo fundamento jurídico deste tratamento, pela informação aos seus hóspedes e pelas garantias de uma transferência para um país terceiro é, por isso, a empresa que é responsável.",
          ],
        },
        {
          titel: "Traduções",
          paragraphs: [
            "Os textos dos imóveis e de conteúdos podem ser traduzidos através da Cloud Translation API da Google Ireland Limited. São transmitidos os textos a traduzir; dados pessoais apenas na medida em que estejam contidos nesses textos.",
          ],
        },
        {
          titel: "Recomendações de preços",
          paragraphs: [
            "Para as recomendações de preços recorremos a dados de mercado, meteorológicos e de câmbio de fontes externas. Estas consultas não contêm dados pessoais, apenas o local, o período e as características do imóvel.",
          ],
        },
      ],
    },
    {
      heading: "Sítios Web e domínios dos nossos clientes",
      paragraphs: [
        "Se uma empresa criar, através do construtor de sítios, um sítio Web próprio com domínio próprio, gerimos os registos DNS necessários através da Cloudflare, Inc. São transmitidos dados de domínio e de configuração; os dados dos visitantes do sítio Web do cliente são tratados como descrito nesta política.",
        "Pelos conteúdos, pela ficha de identificação e pelas informações de proteção de dados do sítio Web do cliente é responsável a respetiva empresa.",
      ],
    },
    {
      heading: "Programa de Parceiros",
      paragraphs: [
        "Operamos um programa de parceiros através do qual parceiros (influenciadores, consultores, agências, clientes) podem recomendar empresas à myNextDays e receber uma comissão por isso. Neste processo, tratamos dados de parceiros e — em pequena escala — de empresas recomendadas.",
      ],
      unterpunkte: [
        {
          titel: "Dados dos Parceiros",
          paragraphs: [
            "No momento da candidatura, tratamos o nome, a empresa, a forma jurídica, o país, o endereço de e-mail, o idioma, as contas de redes sociais (plataforma, endereço, identificador, alcance autodeclarado), o número de identificação fiscal (verificação através do sistema VIES da UE), os dados de pagamento (IBAN, endereço Wise ou PayPal), bem como a aceitação dos termos e condições de participação com a versão e a data. A base jurídica é a execução do contrato de parceria (Art. 6.º, n.º 1, alínea b) do RGPD); para créditos e conservação, aplicam-se as obrigações fiscais e comerciais (Art. 6.º, n.º 1, alínea c) do RGPD).",
            "Se um parceiro lidera uma equipa, ele vê o nome ou a empresa dos seus parceiros de equipa, a classificação, o número de clientes pagantes e a comissão da equipa resultante. As mensagens entre o patrocinador e o parceiro de equipa são armazenadas na plataforma para que ambos possam ver o histórico.",
          ],
        },
        {
          titel: "Cliques em Links de Parceiros",
          paragraphs: [
            "Quando um visitante acede a um link de parceiro (mynextdays.com/p/CODE), armazenamos o código, a hora, a página acedida, a página de referência e quaisquer parâmetros de campanha, bem como o endereço IP e o identificador do navegador, exclusivamente como somas de verificação truncadas (hash) — para deteção de abuso (acumulações), não para reconhecimento. Não é definido um cookie de rastreamento. Eliminamos os dados de cliques após 90 dias. A base jurídica é o nosso interesse legítimo numa faturação do programa à prova de fraude (Art. 6.º, n.º 1, alínea f) do RGPD).",
          ],
        },
        {
          titel: "Contas e Publicações de Redes Sociais Conectadas",
          paragraphs: [
            "Os parceiros podem voluntariamente conectar as suas contas do YouTube (Google), Instagram e Facebook (Meta), bem como TikTok, ao painel de controlo de parceiros. Ao fazê-lo, concedem à respetiva plataforma uma autorização de leitura (OAuth); não escrevemos nada nessas contas. Armazenamos o identificador e o nome da conta, o token de acesso criptografado, a data da conexão, bem como uma métrica diária por conta: número de seguidores ou subscritores, visualizações dos últimos 28 dias, taxa de interação e número de publicações, cada um com a data da resposta da plataforma. Para as publicações que o parceiro cria no painel de controlo (título, plataforma, endereço, data de publicação), armazenamos adicionalmente visualizações, gostos, comentários, partilhas e guardados da plataforma.",
            "O objetivo é verificar o alcance indicado pelo parceiro e atribuir cliques e clientes a publicações individuais; informações não verificadas são menos ponderadas na aprovação. Indicações de inconsistências (como um salto de seguidores sem visualizações correspondentes) servem exclusivamente para nossa verificação manual e não levam a nenhuma decisão automatizada. A base legal é o consentimento do parceiro (Art. 6.º, n.º 1, alínea a) do RGPD), que ele concede ao conectar e pode revogar a qualquer momento no painel de controle em “Desconectar”; ao desconectar, excluímos o token de acesso imediatamente, os valores medidos armazenados permanecem como histórico e são excluídos com a conta do parceiro. Utilizamos exclusivamente as interfaces oficiais das plataformas; para o processamento por Google, Meta e TikTok, aplicam-se as suas próprias políticas de privacidade.",
          ],
        },
        {
          titel: "Empresas recomendadas",
          paragraphs: [
            "Se uma empresa se registrar com um código de parceiro, armazenamos a atribuição da empresa ao parceiro, bem como o horário, o método (link ou código) e o status. O parceiro vê a empresa apenas de forma pseudônima (número sequencial, país, status, valores) — nunca o nome, endereço de e-mail ou dados de reserva. Somente se a empresa concordar expressamente no momento do registro, o parceiro poderá contatá-la através da plataforma. Para o cálculo da comissão, processamos os valores líquidos da assinatura das faturas pagas da empresa; a base legal é a execução do contrato de parceria e do contrato de uso (Art. 6.º, n.º 1, alínea b) do RGPD).",
          ],
        },
      ],
    },
    {
      heading: "Alojamento e armazenamento",
      paragraphs: [
        "A plataforma, a base de dados, os ficheiros de multimédia e o servidor de correio funcionam em servidores da Hetzner Online GmbH, Alemanha, no centro de dados de Helsínquia (Finlândia) — portanto, dentro da União Europeia. Com a Hetzner existe um contrato de subcontratação.",
        "As cópias de segurança são criadas de forma cifrada e conservadas de forma cifrada num prestador de armazenamento situado na UE.",
      ],
    },
    {
      heading: "Destinatários em síntese",
      paragraphs: [
        "Além dos prestadores de serviços indicados, só transmitimos dados pessoais quando estamos legalmente obrigados a fazê-lo (por exemplo, autoridades fiscais, ação penal) ou quando o utilizador ou a empresa responsável o solicitem.",
      ],
      list: [
        "Hetzner Online GmbH (Alemanha/Finlândia) — alojamento, base de dados, ficheiros de multimédia, servidor de correio",
        "Stripe Payments Europe, Limited (Irlanda) — pagamentos, pagamentos a receber, verificação de identidade",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxemburgo) — pagamentos, se ativado",
        "Channex.io Ltd (Reino Unido) — integração com portais de reservas",
        "Meta Platforms Ireland Limited (Irlanda) — mensagens de WhatsApp, se ativado",
        "Sendinblue SAS / Brevo (França, Alemanha) — gestão e envio da newsletter, apenas com consentimento",
        "Google Ireland Limited (Irlanda) — traduções; proteção do formulário de contacto contra spam (reCAPTCHA Enterprise), apenas com consentimento; início de sessão com a Google, se utilizado; Medição de alcance (Google Analytics 4), apenas com consentimento",
        "Groq, Inc. (EUA) — sugestões de resposta, se ativado",
        "Cloudflare, Inc. (EUA) — gestão de DNS para domínios de clientes",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Não constam desta lista os serviços que uma empresa acorda ela própria com um terceiro e liga à sua conta através da interface — por exemplo um assistente de IA como o Claude da Anthropic PBC, EUA. Não são prestadores de serviços por nós contratados, mas destinatários por instrução da respetiva empresa; sem a ligação dessa empresa não flui para lá qualquer dado. De acordo com a lista oficial de participantes do Departamento do Comércio dos EUA, a Anthropic não está certificada ao abrigo do EU-US Data Privacy Framework; uma transferência baseia-se, por isso, nas cláusulas contratuais-tipo, pelas quais a respetiva empresa tem de responder na qualidade de responsável pelo tratamento.",
          ],
        },
      ],
    },
    {
      heading: "Transferências para países terceiros",
      paragraphs: [
        "O tratamento tem lugar, em princípio, dentro da UE. Nos serviços acima indicados com sede fora da UE pode ocorrer uma transferência para um país terceiro.",
        "Quanto à Groq, Inc. e à Cloudflare, Inc. (EUA), baseamos a transferência nas cláusulas contratuais-tipo da Comissão Europeia nos termos do artigo 46.º, n.º 2, alínea c), do RGPD, na medida em que o destinatário não possa invocar uma decisão de adequação (EU-US Data Privacy Framework).",
        "A contraparte contratual do processamento de pagamentos é a Stripe Payments Europe, Limited (Irlanda). Na medida em que a Stripe recorra para tal à Stripe, LLC (EUA), esta está certificada ao abrigo do EU-US Data Privacy Framework; nessa medida, a transferência baseia-se na decisão de adequação da Comissão Europeia nos termos do artigo 45.º do RGPD. Aplicam-se complementarmente as cláusulas contratuais-tipo constantes do [contrato de subcontratação da Stripe](https://stripe.com/legal/dpa).",
        "Quanto à Channex.io Ltd (Reino Unido), aplica-se a decisão de adequação da Comissão Europeia relativa ao Reino Unido; se esta caducar, aplicam-se as cláusulas contratuais-tipo.",
      ],
    },
    {
      heading: "Acesso por autoridades de países terceiros (US CLOUD Act)",
      paragraphs: [
        "Os prestadores sujeitos à jurisdição dos Estados Unidos podem, ao abrigo do CLOUD Act norte-americano (Clarifying Lawful Overseas Use of Data Act, 2018), ser obrigados a entregar dados a autoridades dos EUA — mesmo quando esses dados se encontram em servidores situados na União Europeia. Tal acesso pode ser contrário ao RGPD, e o prestador pode estar juridicamente impedido de nos informar ou de o informar a si. Nem a decisão de adequação relativa ao EU-US Data Privacy Framework nem as cláusulas contratuais-tipo excluem este risco.",
        "Limitamos este risco na medida em que os sistemas estruturantes — plataforma, base de dados, ficheiros de multimédia, servidor de correio e cópias de segurança — são explorados junto de prestadores europeus dentro da UE, onde não se aplica a jurisdição dos EUA.",
      ],
      unterpunkte: [
        {
          titel: "Serviços em causa",
          paragraphs: [
            "A jurisdição dos EUA só pode entrar em causa nos seguintes serviços adicionais, claramente delimitados:",
          ],
          list: [
            "Groq, Inc. (EUA) — sugestões de resposta na caixa de entrada de mensagens, apenas se a empresa ativar a funcionalidade. É transmitido o contexto da mensagem em causa.",
            "Cloudflare, Inc. (EUA) — gestão de DNS para domínios de clientes. São transmitidos dados de domínio e de configuração, nenhuns dados de hóspedes.",
            "Google LLC (EUA) — ao fazer login com o Google, em traduções e na medição de alcance (Google Analytics 4, apenas com consentimento); o parceiro contratual é sempre a Google Ireland Limited, mas o acesso da empresa-mãe dos EUA não está excluído.",
          ],
        },
        {
          titel: "Possibilidade de evitar",
          paragraphs: [
            "A utilização da plataforma é possível sem estes serviços: as sugestões de resposta podem ser desativadas, a gestão de DNS diz respeito apenas a clientes com domínio próprio e o início de sessão com a Google é uma alternativa voluntária ao início de sessão com e-mail e palavra-passe.",
          ],
        },
        {
          titel: "Delimitação face ao direito europeu",
          paragraphs: [
            "O CLOUD Act é direito norte-americano e não direito da União Europeia. Deve ser distinguido do EU Data Act (Regulamento (UE) 2023/2854), que regula a mudança de prestador e a portabilidade nos serviços de tratamento de dados, bem como do Cloud and AI Development Act, que, à data desta política, se encontra em processo legislativo europeu.",
          ],
        },
      ],
    },
    {
      heading: "Prazos de conservação",
      list: [
        "Dados da conta: durante a vigência da relação comercial; depois, eliminação, na medida em que não exista dever de conservação.",
        "Dados de reserva, de faturação e de pagamento: ao abrigo da lei dinamarquesa da contabilidade, cinco anos após o termo do exercício a que devam ser imputados; no caso de clientes com sede na Alemanha podem aplicar-se prazos mais longos de direito comercial e fiscal.",
        "Mensagens e dados de hóspedes na plataforma: segundo instrução da empresa responsável, no máximo até à eliminação por esta ou até ao termo do contrato.",
        "Newsletter: até à retirada do consentimento; as inscrições não confirmadas caducam após sete dias. A prova do consentimento e do cancelamento mantém-se além disso enquanto for necessária como prova.",
        "Registos de início de sessão e eventos de segurança: por curto prazo, para deteção de ataques.",
        "Ficheiros de registo do servidor: apenas durante o tempo necessário à exploração e à segurança.",
        "Cópias de segurança: em rotação, até serem substituídas por cópias mais recentes.",
      ],
    },
    {
      heading: "Os seus direitos",
      paragraphs: [
        "Tem direito de acesso (artigo 15.º), de retificação (artigo 16.º), de apagamento (artigo 17.º), de limitação do tratamento (artigo 18.º), de portabilidade dos dados (artigo 20.º) e de oposição a tratamentos baseados em interesses legítimos (artigo 21.º do RGPD). Um consentimento dado pode ser retirado em qualquer momento com efeitos para o futuro.",
        `Para tal, dirija-se a [${ANBIETER.email}](mailto:${ANBIETER.email}). Se os seus dados se referirem à utilização da plataforma por uma empresa, encaminhamos o seu pedido para a empresa responsável ou apoiamo-la na resposta.`,
        `Pode ainda apresentar reclamação a uma autoridade de controlo em matéria de proteção de dados — a competente para nós é a ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Pode igualmente dirigir-se à autoridade de controlo do seu local de residência.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Nicht mit „Ihre Rechte" zusammenlegen.
      heading: "Eliminar a conta e os dados da aplicação",
      paragraphs: [
        "Pode solicitar a eliminação da sua conta a qualquer momento — na aplicação, em «Perfil → Conta», ou através do nosso formulário na Web:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "A via na Web funciona deliberadamente também quando já não tem a aplicação instalada ou já não consegue iniciar sessão. Para proteção contra abusos, o processo tem dois passos: indica o endereço de e-mail da sua conta e recebe exatamente nesse endereço uma ligação de confirmação. Só o acesso a essa ligação torna o pedido válido — um endereço apenas indicado não produz qualquer efeito. Tratamos o pedido no prazo de 30 dias e respondemos por e-mail.",
        "Com a conta eliminamos os seus dados de acesso, o seu perfil, os seus dados de imóveis e de calendário e as suas mensagens. Não são eliminados os documentos sujeitos a um dever legal de conservação — em especial faturas e comprovativos de reserva de períodos faturados (dever de contabilidade ao abrigo do direito dinamarquês, em regra cinco anos). Estes documentos são bloqueados durante o prazo, ou seja, conservados exclusivamente para cumprimento desse dever, e eliminados depois.",
      ],
    },
    {
      heading: "Segurança do tratamento",
      paragraphs: [
        "Protegemos o tratamento com medidas técnicas e organizativas nos termos do artigo 32.º do RGPD, em especial: cifragem contínua do transporte (TLS), regras de acesso por inquilino diretamente na base de dados, permissões baseadas em papéis com separação dos dados financeiros e de serviço, autenticação de dois fatores opcional, limitação das tentativas de início de sessão, cópias de segurança cifradas com teste de restauro periódico e registo dos eventos relevantes para a segurança.",
      ],
    },
    {
      heading: "Obrigação de fornecer os dados",
      paragraphs: [
        "Os elementos de que necessitamos para a celebração do contrato, a faturação e o cumprimento de deveres legais são necessários — sem eles não podemos disponibilizar a plataforma. Todos os restantes elementos são facultativos.",
      ],
    },
    {
      heading: "Alterações a esta política",
      paragraphs: [
        "Adaptamos esta política quando o tratamento, os prestadores de serviços utilizados ou o enquadramento jurídico se alterarem. Aplica-se sempre a versão aqui publicada; a data no início indica a atualização.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte Export
// bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default datenschutz;
