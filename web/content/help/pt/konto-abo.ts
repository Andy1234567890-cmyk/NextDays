import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Conta e subscrição",
  description: "Dados base, plano, segurança e 2FA.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Conta",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Dados base do negócio",
          excerpt: "Gerir centralmente o nome da empresa, a morada e os dados de contacto do seu negócio.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Em /konto, o myNextDays reúne todas as funções de negócio e de conta como secções numa única página — não precisa de alternar entre muitas subpáginas. Os dados base do negócio são a base disso: nome da empresa, forma jurídica, morada e dados de contacto, usados em faturas, portais e na comunicação com hóspedes.",
            },
            { type: "h2", text: "Abrir e editar os dados base" },
            {
              type: "steps",
              items: [
                "Abra /konto.",
                "Mude para a secção “Dados base do negócio”.",
                "Verifique o nome da empresa, a morada, o número de telefone e o endereço de e-mail para pedidos de esclarecimento.",
                "Faça as suas alterações.",
                "Guarde a secção.",
              ],
            },
            { type: "h2", text: "Por que estes dados são importantes" },
            {
              type: "p",
              text: "Os dados base do negócio são usados em faturas, no registo junto de portais ligados e em informações legalmente obrigatórias, como o aviso legal. Uma morada incompleta ou desatualizada pode fazer com que as faturas sejam emitidas com erros ou que as ligações a portais sejam atrasadas.",
            },
            {
              type: "ul",
              items: [
                "O nome da empresa e a forma jurídica aparecem em todas as faturas emitidas.",
                "A morada é necessária para o registo junto de portais.",
                "Os dados de contacto servem como via alternativa, caso as notificações do sistema não cheguem.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Se alterar a sua morada de faturação, verifique depois as faturas já emitidas em [Faturação e simulador de planos](/hilfe/konto-abo/abrechnung-tarifrechner) — os documentos existentes não são ajustados retroativamente.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Subscrição e plano",
          excerpt: "O seu plano determina o limite de imóveis — pode ver a qualquer momento na conta o número de imóveis contratados.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "A sua subscrição myNextDays inclui um limite de imóveis: o número máximo de imóveis (quartos ou alojamentos de férias) que pode gerir ativamente ao mesmo tempo. O número de imóveis atualmente contratado é apresentado na secção “Subscrição e plano” em /konto, juntamente com o limite restante.",
            },
            { type: "h2", text: "Acompanhar o limite" },
            {
              type: "p",
              text: "O limite é aplicado no servidor: se atingir o limite máximo do seu plano, não é possível criar mais nenhum imóvel até desativar um imóvel existente ou expandir o seu plano. Isto aplica-se independentemente de o novo imóvel ser um quarto ou um alojamento de férias — ambos contam da mesma forma para o limite.",
            },
            {
              type: "steps",
              items: [
                "Abra /konto e a secção “Subscrição e plano”.",
                "Verifique o número de imóveis contratado face ao limite do seu plano.",
                "Se necessário, escolha um plano maior para poder criar mais imóveis.",
                "Confirme a mudança de plano.",
              ],
            },
            {
              type: "ul",
              items: [
                "Cada imóvel conta individualmente para o limite, independentemente do tipo de imóvel.",
                "Uma mudança de plano tem efeito imediato no limite disponível.",
                "Um downgrade só é possível se o número de imóveis ativos couber no novo limite.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Um downgrade para um plano com limite menor é recusado enquanto houver mais imóveis ativos do que os permitidos pelo novo plano. Desative primeiro os imóveis em excesso.",
            },
            {
              type: "note",
              variant: "info",
              text: "Detalhes sobre faturas e o cálculo do plano em [Faturação e simulador de planos](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Faturação e simulador de planos",
          excerpt: "Morada de faturação, faturas anteriores e o simulador de planos para o seu limite de imóveis.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "A secção “Faturação e simulador de planos” em /konto reúne tudo o que diz respeito à faturação: a sua morada de faturação, a lista de faturas anteriores para download, bem como um simulador de planos com o qual pode calcular os custos do seu limite de imóveis atual ou de um maior.",
            },
            { type: "h2", text: "Morada de faturação e faturas" },
            {
              type: "p",
              text: "A morada de faturação pode ser diferente da morada do seu negócio, por exemplo quando um gabinete de contabilidade recebe os documentos. Encontra as faturas já emitidas ordenadas cronologicamente; cada uma pode ser transferida em PDF.",
            },
            { type: "h2", text: "Usar o simulador de planos" },
            {
              type: "steps",
              items: [
                "Abra /konto e a secção “Faturação e simulador de planos”.",
                "Indique no simulador de planos o número de imóveis pretendido.",
                "Compare os custos resultantes por nível de plano.",
                "Se necessário, mude diretamente do simulador para o plano adequado.",
              ],
            },
            {
              type: "ul",
              items: [
                "O simulador de planos mostra os custos na moeda registada na sua conta.",
                "As faturas ficam disponíveis para download de forma permanente.",
                "A morada de faturação pode ser gerida independentemente dos dados base do negócio.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Compare regularmente com o simulador de planos se o seu limite de imóveis ainda corresponde ao número de imóveis efetivamente contratado — ver [Subscrição e plano](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Alterar palavra-passe e e-mail",
          excerpt: "Alterações críticas de segurança exigem uma nova autenticação e um passo de confirmação.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "A palavra-passe e o endereço de e-mail estão entre os dados mais críticos para a segurança da sua conta. Por isso, o myNextDays exige uma nova autenticação em ambas as alterações — confirma a alteração com a sua palavra-passe atual, mesmo que já tenha sessão iniciada.",
            },
            { type: "h2", text: "Alterar a palavra-passe" },
            {
              type: "steps",
              items: [
                "Abra /konto e a secção “Alterar palavra-passe e e-mail”.",
                "Indique a sua palavra-passe atual para confirmação.",
                "Defina a nova palavra-passe e repita-a.",
                "Guarde a alteração.",
              ],
            },
            { type: "h2", text: "Alterar o endereço de e-mail" },
            {
              type: "p",
              text: "A mudança do endereço de e-mail funciona como duplo opt-in: depois de confirmar a sua palavra-passe atual, recebe um link de confirmação no NOVO endereço. Só ao clicar nesse link a alteração se torna efetiva — o endereço antigo mantém-se ativo até lá, para que o acesso à sua conta nunca seja interrompido.",
            },
            {
              type: "ul",
              items: [
                "Sem a palavra-passe atual não é possível alterar nem a palavra-passe nem o e-mail.",
                "O link de confirmação para o novo endereço de e-mail tem validade limitada no tempo.",
                "Até à confirmação, o endereço de e-mail anterior mantém-se ativo para o início de sessão e para notificações.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Depois de uma alteração de e-mail, verifique também a autenticação de dois fatores — ver [Autenticação de dois fatores](/hilfe/konto-abo/zwei-faktor) — caso os códigos de recuperação estivessem associados ao endereço antigo.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Autenticação de dois fatores",
          excerpt: "Um passo de autenticação adicional protege a sua conta contra acessos não autorizados.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "A autenticação de dois fatores (2FA) complementa a sua palavra-passe com um segundo fator através de uma app autenticadora. Assim, uma palavra-passe roubada, por si só, já não é suficiente para iniciar sessão na sua conta myNextDays.",
            },
            { type: "h2", text: "Configurar a 2FA" },
            {
              type: "steps",
              items: [
                "Abra /konto e a secção “Autenticação de dois fatores”.",
                "Confirme a sua palavra-passe atual para nova autenticação.",
                "Digitalize o código QR apresentado com uma app autenticadora.",
                "Introduza o código gerado para confirmação.",
                "Guarde os códigos de recuperação apresentados num local seguro.",
              ],
            },
            { type: "h2", text: "Desativar a 2FA" },
            {
              type: "p",
              text: "Desativar a autenticação de dois fatores também exige uma nova autenticação com a sua palavra-passe atual. Assim, o myNextDays impede que alguém com uma sessão já aberta desative simplesmente a sua proteção.",
            },
            {
              type: "ul",
              items: [
                "Os códigos de recuperação permitem o acesso caso perca a app autenticadora.",
                "Cada código de recuperação só pode ser usado uma vez.",
                "Ativar e desativar a 2FA estão igualmente sujeitos à confirmação da palavra-passe.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Guarde os seus códigos de recuperação separados do dispositivo com a app autenticadora, por exemplo num gestor de palavras-passe.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Histórico de dispositivos",
          excerpt: "Acompanhe em que dispositivos a sua conta tem sessão iniciada.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "O histórico de dispositivos em /konto mostra em que dispositivos a sua conta está atualmente ligada — com tipo de dispositivo, localização aproximada e momento da última atividade. Assim, reconhece rapidamente se um início de sessão é realmente seu.",
            },
            { type: "h2", text: "Verificar o histórico de dispositivos" },
            {
              type: "steps",
              items: [
                "Abra /konto e a secção “Histórico de dispositivos”.",
                "Reveja a lista de dispositivos com sessão iniciada.",
                "Se reconhecer um dispositivo desconhecido, termine a sessão desse dispositivo.",
                "Depois, por precaução, altere a sua palavra-passe.",
              ],
            },
            { type: "h2", text: "Quando vale a pena verificar" },
            {
              type: "p",
              text: "Verifique o histórico de dispositivos especialmente após uma alteração de palavra-passe ou de e-mail, bem como depois de usar um dispositivo alheio ou público. Uma entrada desconhecida é um sinal de alerta claro de acesso não autorizado.",
            },
            {
              type: "ul",
              items: [
                "Cada entrada mostra o tipo de dispositivo, a localização aproximada e a última atividade.",
                "Dispositivos individuais podem ser desligados de forma direcionada, sem afetar os restantes.",
                "Um dispositivo não reconhecido é motivo para uma alteração imediata da palavra-passe.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Se não reconhecer um dispositivo, termine imediatamente a sessão e altere depois a sua palavra-passe em [Alterar palavra-passe e e-mail](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Proteção de dados",
          excerpt: "Controlar a indexação por motores de busca por imóvel e exportar os seus dados.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "p",
              text: "Na secção “Proteção de dados” em /konto controla duas coisas: se as páginas dos seus imóveis podem ser indexadas por motores de busca, e como pode exportar os dados armazenados no myNextDays.",
            },
            { type: "h2", text: "Indexação por motores de busca por imóvel" },
            {
              type: "p",
              text: "Por predefinição, a indexação por motores de busca está desativada para novos imóveis. Só quando a ativa conscientemente por imóvel é que motores de busca como o Google podem incluir a página pública do imóvel no seu índice. Assim, mantém o controlo sobre quais os imóveis que podem ser encontrados fora dos portais e da sua própria plataforma.",
            },
            {
              type: "steps",
              items: [
                "Abra /konto e a secção “Proteção de dados”.",
                "Selecione o imóvel pretendido na lista.",
                "Ative ou desative a indexação por motores de busca.",
                "Com vários imóveis, use o interruptor coletivo para definir todos os imóveis de forma uniforme.",
              ],
            },
            { type: "h2", text: "Exportar dados" },
            {
              type: "p",
              text: "Através da função de exportação de dados, pede uma cópia completa dos dados armazenados na sua conta. A exportação é preparada e depois disponibilizada para download.",
            },
            {
              type: "ul",
              items: [
                "A indexação pode ser controlada individualmente por imóvel, com interruptor coletivo para todos os imóveis.",
                "Os novos imóveis começam, por norma, sem indexação por motores de busca.",
                "A exportação de dados contém os dados da sua conta e dos imóveis de forma estruturada.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A indexação por motores de busca é independente da visibilidade nos portais e no próprio mercado — diz respeito exclusivamente à página pública do imóvel nos motores de busca.",
            },
          ],
        },
      ],
    },
  ],
};
