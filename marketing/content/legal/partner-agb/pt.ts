// Partner-AGB — Portugiesisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "Termos de Participação do Programa de Parceiros myNextDays: Atribuição, Base de Comissão, Nível, Comissão de Equipe, Proibições, Identificação, Pagamento.",
  numbered: false,
  toc: true,
  title: "Termos de Participação do Programa de Parceiros (Termos e Condições de Parceiro) — Rascunho",
  standIso: "2026-09-02",
  intro: [
    "RASCUNHO — Estas condições são um estado de trabalho da myNextDays e ainda não foram revisadas por advogados. Até a liberação da versão revisada, elas servem como descrição do programa, não como texto contratual final. A versão revisada será publicada neste endereço com um novo número de versão; os Parceiros serão solicitados a concordar novamente no próximo login.",
    `Estes termos de participação regulam a participação no programa de parceiros (programa de afiliados) da ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (doravante "myNextDays" ou "nós") por Parceiros (doravante "Parceiro").`,
    "O programa de parceiros destina-se a pessoas e empresas sediadas na UE, Suíça ou Reino Unido que recomendam estabelecimentos (proprietários, agências, hotéis) na myNextDays.",
  ],
  sections: [
    {
      heading: "§ 1 Participação e Aprovação",
      paragraphs: [
        "A participação requer uma candidatura através do painel de controlo do Parceiro. As informações obrigatórias incluem nome ou empresa, forma jurídica, país, pelo menos uma conta de rede social com endereço, identificador e alcance, e, para empresas, o número de identificação fiscal.",
        "A myNextDays examina cada candidatura pessoalmente e decide livremente sobre a aprovação. Não há direito à admissão. A participação é gratuita; uma assinatura da myNextDays não é um pré-requisito.",
        "O Parceiro mantém as suas informações atualizadas, em particular canais, forma jurídica, dados fiscais e de pagamento.",
        "O alcance indicado é inicialmente uma autoavaliação. O Parceiro pode conectar voluntariamente as suas contas do YouTube, Instagram, Facebook e TikTok; então, os seguidores e visualizações são lidos da plataforma e exibidos como verificados. O alcance não verificado terá um peso menor na aprovação e em verificações posteriores. A conexão pode ser desfeita a qualquer momento no painel de controlo; detalhes sobre o processamento estão na política de privacidade.",
      ],
    },
    {
      heading: "§ 2 Atribuição de Estabelecimentos (Atribuição)",
      paragraphs: [
        "Um estabelecimento é atribuído ao Parceiro se este se registar com o código de recomendação do Parceiro. O código é exibido visivelmente ao estabelecimento no momento do registo e confirmado pelo envio. Não são definidos cookies de rastreamento.",
        "Um estabelecimento é atribuído a apenas um Parceiro; o código confirmado no registo é o decisivo. Uma reatribuição posterior só ocorrerá pela myNextDays em caso de erro comprovado.",
        "Não serão atribuídos estabelecimentos do próprio Parceiro, dos seus sócios, funcionários ou familiares, bem como estabelecimentos que já são ou foram clientes da myNextDays.",
      ],
    },
    {
      heading: "§ 3 Comissão sobre Clientes Próprios",
      paragraphs: [
        "A base da comissão é o volume de negócios líquido da assinatura do estabelecimento atribuído (tarifa base e módulos) proveniente de faturas pagas — sem IVA, sem comissões de portal, serviços adicionais, recálculos e outros itens transitórios.",
        "A taxa de comissão é determinada pela classificação do parceiro no momento do pagamento. As classificações e taxas são publicadas na página do programa. A classificação é determinada pelo número de clientes pagantes na estrutura do parceiro: seus próprios clientes pagantes e os clientes pagantes de seus parceiros de equipe (§ 4), cada cliente uma vez. A classificação é determinada mensalmente na data de referência; uma promoção é válida imediatamente, um rebaixamento somente se o número estiver abaixo do limite em duas datas de referência consecutivas.",
        "Se o parceiro atingir pela primeira vez uma classificação a partir de \"Ascendente\", ele receberá um bônus de ascensão único, conforme indicado para essa classificação na página do programa (atualmente 50,00 EUR por classificação, para todos os parceiros em Euro). Cada classificação é remunerada apenas uma vez, mesmo após rebaixamento e nova ascensão. O bônus está sujeito à janela de reembolso de acordo com o § 7.",
        "A comissão é gerada por operação por doze meses a partir da primeira fatura de assinatura paga; um período de teste gratuito e um mês gratuito intermediados pelo parceiro não são contabilizados. Se a assinatura terminar antes, a comissão termina com a última fatura paga.",
        "A partir da classificação \"Parceiro Elite\", o parceiro recebe adicionalmente uma supercomissão no valor indicado na página do programa (atualmente 2,5%) sobre o faturamento líquido da assinatura de todos os clientes de sua estrutura — clientes próprios e clientes de seus parceiros de equipe — sem o limite de doze meses, enquanto o respectivo cliente mantiver uma assinatura paga e o parceiro possuir a classificação no momento do pagamento. Ela surge além da comissão de acordo com a frase 2 e o § 4.",
        "A partir da classificação \"Parceiro Elite\", o parceiro recebe, para cada reserva recebida e paga via myBestDays de uma operação atribuída a ele ou a um de seus parceiros de equipe, uma parte da reserva no valor indicado na página do programa (atualmente 0,5%) do valor da reserva pago pelo hóspede na moeda da reserva, sem limite de tempo, enquanto a atribuição existir e o parceiro possuir a classificação no momento do pagamento da reserva. Cauções não são valor de reserva. Reembolsos ao hóspede reduzem a parte proporcionalmente (§ 7).",
      ],
    },
    {
      heading: "§ 4 Comissão de Equipe",
      paragraphs: [
        "A partir da classificação \"Ascendente\", um parceiro pode liderar parceiros de equipe. Se outro parceiro se candidatar através do link de equipe do parceiro e confirmar seu código visivelmente em sua candidatura, ele será atribuído à equipe do parceiro (doravante \"Patrocinador\") após sua aprovação. Se o Patrocinador não possuir a classificação no momento da candidatura, a candidatura permanece válida, mas não há atribuição de equipe.",
        "O Patrocinador recebe sobre o faturamento líquido da assinatura dos clientes de seus parceiros de equipe uma comissão de equipe no valor da diferença entre sua própria taxa de comissão e a taxa de comissão do parceiro de equipe, cada uma de acordo com a classificação no momento do pagamento. Se ambos estiverem na mesma classificação ou o parceiro de equipe estiver em uma classificação superior, não há comissão de equipe. A comissão do parceiro de equipe e a comissão de equipe do Patrocinador juntas nunca excedem a taxa mais alta da escala (atualmente 30%).",
        "A comissão de equipe consiste em exatamente um nível de profundidade: os parceiros de equipe não recebem comissão de equipe sobre os parceiros que eles próprios recrutam. Nenhuma remuneração é paga pelo recrutamento de um parceiro; nenhuma taxa de participação é cobrada. A comissão de equipe é gerada exclusivamente a partir da receita de assinaturas pagas.",
        "A comissão de equipe é válida por doze meses a partir da primeira fatura paga de cada cliente de equipe, está sujeita à mesma janela de reembolso e é proporcionalmente estornada em caso de reembolso ou estorno (§ 7). Ela só é gerada enquanto o patrocinador e o parceiro de equipe estiverem aprovados; caso contrário, será retida até o esclarecimento.",
        "A atribuição de equipe é única. Uma alteração só pode ser feita pela myNextDays com um motivo documentado.",
      ],
    },
    {
      heading: "§ 5 Deveres do Parceiro e Identificação",
      paragraphs: [
        "O Parceiro deve identificar cada recomendação com seu link ou código como publicidade — no início da postagem, no idioma da postagem, de acordo com as diretrizes de seu país (na Alemanha, entre outros, § 5a Abs. 4 UWG, na Dinamarca, markedsføringsloven § 6 Abs. 4). A myNextDays disponibiliza as formulações por país no painel do Parceiro.",
        "O Parceiro só deve fornecer informações sobre a myNextDays que correspondam às descrições de serviço publicadas e não deve fazer promessas em nome da myNextDays. São proibidas, em particular, promessas de sucesso e garantia (por exemplo, “ocupação total garantida em três dias”), bem como declarações sobre receitas que não resultem das descrições de serviço publicadas.",
        "Todo vídeo e toda postagem que mencione a myNextDays ou contenha o link do Parceiro deve ser submetido para revisão como arquivo no painel do Parceiro antes da publicação. O link do Parceiro só será criado após a aprovação por escrito da myNextDays; a publicação sem aprovação é proibida. A myNextDays pode revogar uma aprovação; as comissões já geradas permanecem inalteradas.",
        "Para logotipos, capturas de tela, B-Roll, sobreposições e capturas de tela, o Parceiro deve usar exclusivamente o material promocional fornecido pela myNextDays. Gravações de software próprias e não verificadas não são permitidas.",
      ],
    },
    {
      heading: "§ 6 Práticas Proibidas",
      paragraphs: ["São proibidas, em particular:"],
      list: [
        "Brand-Bidding: anúncios pagos para a marca “myNextDays”, variações de grafia e combinações (por exemplo, “myNextDays Preços”) em motores de busca e redes;",
        "Cookie-dropping, redirecionamentos ocultos, iFrames, chamadas automatizadas do link do Parceiro ou qualquer outra manipulação técnica da atribuição;",
        "Auto-promoção: registro de empresas próprias, de sócios, funcionários ou familiares através do próprio código ou do código de um Parceiro de Equipe;",
        "Alcance comprado (seguidores comprados, fazendas de cliques, tráfego de bots), bem como incentivos a empresas para o registro (reembolsos, presentes, sorteios);",
        "Promessas de recrutamento: o recrutamento de parceiros com promessas de ganhos que não provêm de receita de assinaturas pagas, ou a apresentação do programa como fonte de renda através do recrutamento de outros parceiros;",
        "Spam, publicidade direta não solicitada e o uso de marcas ou conteúdos de terceiros sem autorização.",
      ],
    },
    {
      heading: "§ 7 Período de Reembolso, Reversão, Retenção",
      paragraphs: [
        "Cada linha de comissão fica aberta por 30 dias após sua criação (período de reembolso) e é pagável após esse período. Se uma fatura subjacente for total ou parcialmente reembolsada ou estornada (chargeback), a comissão — incluindo qualquer comissão de equipe baseada nela — será revertida proporcionalmente, mesmo após o pagamento, mediante compensação com futuras comissões.",
        "Em caso de suspeita de violação do § 2, § 5 ou § 6, a myNextDays poderá reter atribuições e comissões até o esclarecimento. Se a violação for confirmada, as comissões afetadas serão canceladas.",
      ],
    },
    {
      heading: "§ 8 Pagamento e Crédito",
      paragraphs: [
        "As comissões pagáveis são agrupadas mensalmente por moeda e pagas assim que atingem o valor mínimo da respectiva moeda indicado na página do programa ou no painel de controle. Não há conversão entre moedas.",
        "A liquidação é feita por meio de procedimento de crédito (autofaturamento, momsloven § 52a): a myNextDays emite um crédito para cada pagamento; o Parceiro não emite fatura. O Parceiro concorda com o procedimento de crédito.",
        "Empresários recebem o crédito com indicação da responsabilidade fiscal do destinatário do serviço (Reverse Charge); a condição é um número de identificação fiscal válido e confirmado. Pessoas físicas recebem o crédito sem IVA e declaram a comissão por conta própria.",
        "O pagamento é feito por transferência SEPA, Wise ou PayPal para os dados fornecidos pelo Parceiro no painel de controle.",
      ],
    },
    {
      heading: "§ 9 Dados e Acesso",
      paragraphs: [
        "O Parceiro vê as empresas atribuídas de forma pseudônima (número, país, status, valores). Nomes, endereços de e-mail ou dados de reserva das empresas não são divulgados. Um Patrocinador vê de seus Parceiros de Equipe o nome ou empresa, classificação, número de clientes pagantes e a comissão de equipe resultante, sem detalhes do cliente.",
        "Para contas conectadas e postagens criadas, a myNextDays vê seguidores, visualizações, interações, bem como cliques e clientes por postagem. Anormalidades (como um salto de seguidores sem visualizações correspondentes ou uma diferença significativa entre a autoavaliação e o valor verificado) são indícios para uma verificação pessoal de acordo com o § 6 e § 10, não uma suspensão automática.",
        "O processamento de dados pessoais no programa de parceria é descrito na política de privacidade.",
      ],
    },
    {
      heading: "§ 10 Duração, Bloqueio e Rescisão",
      paragraphs: [
        "A participação é por tempo indeterminado e pode ser encerrada por ambas as partes a qualquer momento por escrito. As comissões pagáveis já geradas serão pagas de acordo com o § 8; após o término, nenhuma nova comissão será gerada.",
        "A myNextDays pode bloquear o Parceiro em caso de violação destas condições. Durante o bloqueio, as comissões são retidas; em caso de violação confirmada, elas são canceladas.",
      ],
    },
    {
      heading: "§ 11 Alterações",
      paragraphs: [
        "A myNextDays pode alterar estas condições e a escala com efeitos para o futuro. As alterações serão publicadas no painel de controlo do parceiro e nesta página com o número da versão; em caso de alterações significativas, o parceiro será solicitado a dar novamente o seu consentimento. As comissões já geradas permanecem inalteradas.",
      ],
    },
    {
      heading: "§ 12 Lei aplicável",
      paragraphs: [
        "Aplica-se a lei dinamarquesa, com exclusão das normas de conflito de leis. As disposições imperativas de proteção do consumidor do Estado em que um parceiro privado tem a sua residência habitual permanecem inalteradas.",
      ],
    },
  ],
};
