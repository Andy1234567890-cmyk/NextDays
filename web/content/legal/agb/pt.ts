import type { LegalDoc } from "../types";

// Portugiesische Fassung (Europäisches Portugiesisch). Quelle ist
// content/legal/agb/de.ts — Änderungen immer zuerst dort, dann hier nachziehen.
// § 5 Absatz 1–2 folgt Stripes offiziellem Empfehlungstext (recommended
// disclosure language) — Wortlaut sinngemäß, URLs nicht verändern.
export const agb: LegalDoc = {
  title: "Termos e Condições Gerais (TCG) para Agências e Arrendadores",
  stand: "Última atualização: 3 de julho de 2026",
  intro: [
    "Estes Termos e Condições Gerais (doravante «TCG») regulam a utilização da plataforma de software myNextDays (doravante «Plataforma») por agências, arrendadores, empresas de administração de imóveis e outros utilizadores profissionais (doravante «Utilizador»).",
    "A Plataforma é disponibilizada por [firma completa, forma jurídica, morada e dados de registo da entidade operadora — a completar antes da publicação] (doravante «myNextDays» ou «nós»).",
    "A Plataforma destina-se exclusivamente a empresários na aceção do § 14 do Código Civil alemão (BGB) ou das disposições correspondentes do respetivo Estado-Membro da UE. Não se destina a consumidores.",
  ],
  sections: [
    {
      heading: "§ 1 Âmbito de aplicação",
      paragraphs: [
        "Estes TCG aplicam-se a todos os contratos relativos à utilização da Plataforma celebrados entre a myNextDays e o Utilizador, bem como a todos os serviços e módulos disponibilizados através da mesma.",
        "Condições gerais do Utilizador divergentes, contrárias ou complementares só passam a integrar o contrato se a myNextDays tiver consentido expressamente na sua aplicação em forma de texto.",
      ],
    },
    {
      heading: "§ 2 Objeto do contrato e serviços",
      paragraphs: [
        "A myNextDays disponibiliza ao Utilizador um software baseado na nuvem para a gestão de alojamentos de férias e estabelecimentos de alojamento. O âmbito funcional resulta da descrição de serviços em vigor e inclui, em particular:",
      ],
      list: [
        "gestão de alojamentos, calendários de ocupação e reservas (sistema de gestão de propriedades),",
        "ligação a canais de reserva de terceiros (p. ex. Booking.com, Airbnb) através de um gestor de canais (channel manager),",
        "publicação de ofertas através do canal de reservas próprio da plataforma, myNextDays,",
        "criação de websites próprios através do construtor de páginas (page builder) integrado,",
        "funções de contabilidade, faturação e análise, incluindo extratos para proprietários,",
        "comunicação com hóspedes e aceitação de pagamentos através do processamento de pagamentos integrado (§ 5).",
      ],
    },
    {
      heading: "§ 3 Registo, conta e informações do Utilizador",
      paragraphs: [
        "A utilização da Plataforma pressupõe o registo de uma conta. O Utilizador obriga-se a prestar, no registo e durante toda a vigência do contrato, informações corretas, atuais e completas sobre a sua pessoa e a sua empresa e a atualizá-las sem demora sempre que se alterem.",
        "Os dados de acesso devem ser mantidos em sigilo e protegidos contra o acesso de terceiros. O Utilizador deve informar a myNextDays sem demora caso existam indícios de utilização abusiva da sua conta.",
        "A conta não é transmissível. O Utilizador assegura que todas as pessoas que utilizam a conta em seu nome cumprem estes TCG.",
      ],
    },
    {
      heading: "§ 4 Papel da myNextDays nas reservas",
      paragraphs: [
        "Os contratos de alojamento relativos aos alojamentos oferecidos na Plataforma, através de canais de terceiros ligados ou através do website próprio do Utilizador são celebrados exclusivamente entre o Utilizador (ou o proprietário por ele representado) e o respetivo hóspede. A myNextDays não se torna parte do contrato de alojamento.",
        "O Utilizador é o único responsável pela exatidão e pela legalidade dos conteúdos das ofertas (descrições, fotografias, preços, disponibilidades, impostos e taxas).",
      ],
    },
    {
      heading: "§ 5 Processamento de pagamentos pela Stripe",
      paragraphs: [
        "Os serviços de processamento de pagamentos para agências e arrendadores na myNextDays são prestados pela Stripe e estão sujeitos ao [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), que inclui os termos de utilização da Stripe (em conjunto, o «Contrato-Quadro da Stripe»). Ao aceitar estes TCG ou ao continuar a operar como agência ou arrendador na myNextDays, o Utilizador declara-se vinculado ao Contrato-Quadro da Stripe, que pode ser alterado pela Stripe de tempos a tempos.",
        "Como condição para que a myNextDays disponibilize serviços de processamento de pagamentos através da Stripe, o Utilizador obriga-se a fornecer à myNextDays informações corretas e completas sobre si e sobre a sua empresa. O Utilizador autoriza a myNextDays a transmitir à Stripe essas informações, bem como os dados de transação relacionados com a utilização dos serviços de processamento de pagamentos prestados pela Stripe.",
        "A relação jurídica com a Stripe rege-se pelo texto contratual em língua inglesa acessível através da hiperligação, na sua versão em vigor a cada momento. A entidade contratante da Stripe para utilizadores no Espaço Económico Europeu é a sociedade Stripe designada no Contrato-Quadro da Stripe (atualmente a Stripe Payments Europe, Limited, Irlanda). A Stripe trata dados pessoais em conformidade com a [Política de Privacidade da Stripe](https://stripe.com/privacy).",
        "Para o cumprimento de obrigações legais de identificação e verificação (nomeadamente prevenção do branqueamento de capitais e «conhecimento do cliente» — Know Your Customer), a myNextDays e a Stripe podem, a qualquer momento, exigir informações e comprovativos adicionais, em particular documentos de identificação, informações sobre beneficiários efetivos e dados bancários. Se as informações ou os comprovativos solicitados não forem fornecidos dentro do prazo fixado, a aceitação de pagamentos ou as transferências para o Utilizador podem ser suspensas, total ou parcialmente, até que as informações estejam completas.",
      ],
    },
    {
      heading: "§ 6 Transferências, estornos e saldos negativos",
      paragraphs: [
        "As transferências são efetuadas para a conta bancária indicada pelo Utilizador. A myNextDays pode ajustar a periodicidade das transferências por motivos de risco, em particular no caso de contas novas, padrões de transação invulgares ou verificações em curso.",
        "Os estornos (chargebacks), os reembolsos e as taxas daí resultantes relacionados com reservas do Utilizador são suportados pelo Utilizador. A myNextDays tem o direito de compensar os montantes correspondentes com transferências futuras.",
        "Se surgir um saldo negativo na conta de pagamentos do Utilizador, o Utilizador deve regularizá-lo sem demora. O Utilizador autoriza a myNextDays e a Stripe a debitar saldos negativos da conta bancária indicada, na medida em que tal seja legalmente admissível.",
      ],
    },
    {
      heading: "§ 7 Remuneração e faturação",
      paragraphs: [
        "As remunerações pela utilização da Plataforma resultam da lista de preços acordada no momento da celebração do contrato ou da proposta individual. A todos os preços acrescem os impostos legalmente aplicáveis, sendo os preços indicados na moeda especificada no contrato.",
        "As remunerações dependentes de transações (p. ex. taxas de pagamento ou de canal) podem ser retidas ou compensadas diretamente no processamento da respetiva transação.",
        "Se o Utilizador entrar em mora no pagamento, a myNextDays pode, após aviso prévio, bloquear o acesso à Plataforma até à regularização dos montantes em dívida.",
      ],
    },
    {
      heading: "§ 8 Obrigações do Utilizador; textos legais próprios",
      paragraphs: [
        "O Utilizador assegura que as suas ofertas, conteúdos e práticas comerciais cumprem a legislação aplicável, em particular o direito em matéria de alojamento, de registo, fiscal e de defesa do consumidor no local do alojamento. O Utilizador mantém, sob a sua própria responsabilidade, todas as autorizações, registos e licenças necessários.",
        "O Utilizador é o próprio responsável pelos websites que opera através do construtor de páginas, bem como pelas suas ofertas na Plataforma; tal inclui, em particular, condições gerais próprias para hóspedes, um aviso legal próprio (ficha técnica) e informações de privacidade próprias.",
        "São proibidos, em particular: a publicação de ofertas incorretas ou enganosas, a realização de negócios simulados ou de transações fraudulentas, o contornamento do processamento de pagamentos previsto no § 5 para reservas celebradas através da Plataforma, bem como qualquer utilização que prejudique a segurança ou a disponibilidade da Plataforma.",
      ],
    },
    {
      heading: "§ 9 Canais de reserva de terceiros",
      paragraphs: [
        "Na ligação de canais de terceiros (p. ex. Booking.com, Airbnb) aplicam-se adicionalmente as condições do respetivo operador do canal. O Utilizador celebra diretamente com o operador do canal os contratos necessários para o efeito.",
        "A myNextDays assegura a sincronização técnica de disponibilidades, preços e dados de reserva, mas não tem qualquer influência sobre os conteúdos, comissões ou decisões dos operadores dos canais e não responde pela disponibilidade dos mesmos.",
      ],
    },
    {
      heading: "§ 10 Disponibilidade e desenvolvimento contínuo",
      paragraphs: [
        "A myNextDays presta os serviços com a diligência de um comerciante prudente e procura assegurar uma elevada disponibilidade da Plataforma. Janelas de manutenção, desenvolvimentos e circunstâncias fora da esfera de influência da myNextDays (p. ex. falhas em prestadores terceiros) podem limitar temporariamente a disponibilidade.",
        "A myNextDays pode desenvolver a Plataforma e alterar funções, desde que a finalidade do contrato não seja posta em causa e a alteração seja razoável para o Utilizador.",
      ],
    },
    {
      heading: "§ 11 Dados e proteção de dados",
      paragraphs: [
        "Na medida em que a myNextDays trate dados pessoais por conta do Utilizador no âmbito da disponibilização da Plataforma (em particular dados de hóspedes), as partes celebram um acordo de subcontratação nos termos do art. 28.º do RGPD.",
        "O Utilizador continua a ser responsável pela licitude, em matéria de proteção de dados, da recolha e do tratamento dos dados por si introduzidos. Os detalhes do tratamento de dados pela myNextDays constam das informações de privacidade da Plataforma; ao tratamento de dados pela Stripe aplica-se o § 5.",
      ],
    },
    {
      heading: "§ 12 Propriedade intelectual",
      paragraphs: [
        "Todos os direitos sobre a Plataforma, o seu software e os seus conteúdos (com exceção dos conteúdos introduzidos pelo Utilizador) pertencem à myNextDays ou aos seus licenciantes. O Utilizador recebe, pela duração do contrato, um direito simples e não transmissível de utilização da Plataforma no âmbito acordado no contrato.",
        "Sobre os conteúdos por si introduzidos, o Utilizador concede à myNextDays os direitos simples de utilização necessários à operação da Plataforma (em particular para armazenamento, reprodução, apresentação e transmissão aos canais ligados).",
      ],
    },
    {
      heading: "§ 13 Responsabilidade",
      paragraphs: [
        "A myNextDays responde de forma ilimitada por dolo e negligência grosseira, bem como por danos resultantes de lesões à vida, ao corpo ou à saúde.",
        "Em caso de negligência simples, a myNextDays responde apenas pela violação de obrigações contratuais essenciais (obrigações cardinais), limitando-se a responsabilidade ao dano previsível e típico do contrato. A responsabilidade nos termos da legislação sobre responsabilidade do produtor, bem como decorrente de garantias assumidas, permanece inalterada.",
        "Pela perda de dados, a myNextDays responde apenas na medida em que o dano também teria ocorrido se o Utilizador tivesse efetuado cópias de segurança adequadas e regulares dos dados, salvo se a cópia de segurança dos dados for contratualmente da responsabilidade da myNextDays.",
      ],
    },
    {
      heading: "§ 14 Duração, resolução e bloqueio",
      paragraphs: [
        "A duração e os prazos de denúncia resultam do respetivo contrato. O direito à resolução extraordinária com justa causa permanece inalterado.",
        "A myNextDays pode bloquear temporariamente o acesso à Plataforma ou a funções individuais (incluindo a aceitação de pagamentos e as transferências) se existirem indícios concretos de violação destes TCG, de fraude ou de utilização abusiva, ou se a myNextDays estiver obrigada a fazê-lo por lei ou por determinação de um prestador de serviços de pagamento. O Utilizador será informado do bloqueio, na medida em que tal seja legalmente admissível.",
        "Após o termo do contrato, a myNextDays disponibiliza ao Utilizador, mediante pedido, os seus dados para exportação num formato corrente no prazo de 30 dias; em seguida, os dados são eliminados, salvo se obrigações legais de conservação a tal se opuserem.",
      ],
    },
    {
      heading: "§ 15 Alterações destes TCG",
      paragraphs: [
        "A myNextDays pode alterar estes TCG com efeitos para o futuro, na medida em que tal seja necessário por motivos válidos (em particular alterações legislativas, alterações da jurisprudência ou exigências de prestadores de serviços de pagamento) e o Utilizador não seja prejudicado de forma desproporcionada.",
        "As alterações serão comunicadas ao Utilizador em forma de texto com, pelo menos, seis semanas de antecedência relativamente à sua entrada em vigor. Se o Utilizador não se opuser dentro do prazo de comunicação ou continuar a utilizar a Plataforma após a entrada em vigor, os TCG alterados consideram-se aceites; esta consequência será expressamente assinalada na comunicação.",
      ],
    },
    {
      heading: "§ 16 Disposições finais",
      paragraphs: [
        "Aplica-se o direito do Estado em que a operadora tem a sua sede, com exclusão da Convenção das Nações Unidas sobre os Contratos de Compra e Venda Internacional de Mercadorias. As disposições imperativas do Estado em que o Utilizador tem a sua sede permanecem inalteradas.",
        "O foro exclusivo para todos os litígios emergentes deste contrato ou com ele relacionados é — na medida em que tal seja legalmente admissível — o da sede da operadora.",
        "Se disposições individuais destes TCG forem ou se tornarem inválidas, a validade das restantes disposições permanece inalterada.",
      ],
    },
  ],
};
