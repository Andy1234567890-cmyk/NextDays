import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Condições de utilização para hóspedes",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "As presentes condições de utilização regulam a utilização do portal de reservas myBestDays (adiante «a plataforma») por viajantes e por quem efetua a reserva (adiante «hóspede» ou «o utilizador»).",
    `A plataforma é explorada pela ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dinamarca, CVR n.º ${ANBIETER.cvr} (adiante «myBestDays» ou «nós»). myBestDays é uma marca desta sociedade e não uma pessoa coletiva autónoma. Os dados completos do prestador constam das [Informações legais](https://mybestdays.dk/rechtliches/impressum).`,
    "Ao utilizar a plataforma, aceita as presentes condições. Solicitamos que as leia com atenção.",
  ],
  summary: {
    heading: "Síntese das presentes condições",
    paragraphs: [
      "myBestDays é um mercado. Disponibilizamos a plataforma na qual os fornecedores oferecem o seu alojamento — o alojamento em si não é prestado por nós. O contrato de alojamento é celebrado entre si e o fornecedor, não connosco.",
      "O que vê num anúncio provém do fornecedor: descrição, fotografias, equipamento, preço, condições de cancelamento e regras da casa. Verificamos os anúncios, mas não podemos responder por cada indicação de um fornecedor.",
      "O preço apresentado ao concluir a reserva é o preço total dos serviços reservados. Os montantes devidos apenas no local (por exemplo, taxa turística ou caução) são indicados separadamente de forma prévia.",
      "Se algo correr mal, dirija-se primeiro a nós. A secção A15 descreve como apresentar uma reclamação e que vias lhe ficam depois abertas.",
      "Esta síntese explica as condições mas não as substitui. Prevalece o texto integral.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Todas as reservas através da myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Definições",
          paragraphs: [
            "Os termos utilizados nas presentes condições são explicados no glossário no final deste documento. Os principais são:",
          ],
          list: [
            "«Plataforma» — o sítio web, as aplicações móveis e todos os demais acessos através dos quais a myBestDays apresenta alojamentos e intermedeia reservas.",
            "«Fornecedor» — a pessoa singular ou coletiva que oferece alojamento através da plataforma (anfitrião, senhorio, agência, estabelecimento hoteleiro ou de alojamento).",
            "«Alojamento» — a prestação de alojamento oferecida pelo fornecedor, ou seja, um imóvel de férias ou uma unidade de um tipo de quarto ou de imóvel.",
            "«Reserva» — a reserva de um alojamento por um período determinado, celebrada através da plataforma.",
            "«Preço total» — o montante indicado ao concluir a reserva, incluindo todos os impostos, taxas e suplementos liquidados através da plataforma.",
            "«Custos no local» — montantes não liquidados através da plataforma, mas devidos ao fornecedor (por exemplo, taxa turística, caução, limpeza final consoante a opção do fornecedor).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. Sobre as presentes condições",
          paragraphs: [
            "As presentes condições aplicam-se a qualquer utilização da plataforma, independentemente de criar uma conta e de vir a ser celebrada uma reserva.",
            "A secção A aplica-se a todas as reservas. A secção B contém as regras complementares relativas a alojamentos. Em caso de contradição prevalece a secção B.",
            "À prestação de alojamento propriamente dita aplicam-se ainda as condições do respetivo fornecedor (em especial regras da casa e condições de cancelamento) indicadas no anúncio. Essas condições do fornecedor acrescem às nossas; não podem afastar as nossas condições no que respeita à sua relação connosco.",
            "As presentes condições estão disponíveis em todas as 24 línguas oficiais da União Europeia. Em caso de divergência entre as versões linguísticas prevalece a versão alemã, salvo disposição imperativa em contrário do direito do seu Estado de residência.",
            "Os direitos imperativos dos consumidores previstos no direito do seu Estado de residência não são afetados pelas presentes condições.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. Sobre a myBestDays",
          paragraphs: [
            "myBestDays é um mercado em linha para alojamentos de férias e estabelecimentos de alojamento. Exploramos a plataforma na qual os fornecedores apresentam o seu alojamento e os hóspedes o podem reservar.",
            "Somos intermediários, não prestadores de alojamento. Não detemos, exploramos, administramos nem controlamos qualquer dos alojamentos oferecidos na plataforma e não somos parte no contrato de alojamento.",
            "myBestDays é um serviço intermediário na aceção do Regulamento (UE) 2022/2065 relativo aos serviços digitais. As nossas indicações e procedimentos ao abrigo desse regulamento constam do [Regulamento dos Serviços Digitais](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays não é operador turístico. Não organizamos viagens organizadas na aceção da Diretiva (UE) 2015/2302; quanto a serviços de viagem conexos, ver A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. A nossa plataforma",
          paragraphs: [
            "O conteúdo de um anúncio — descrição, fotografias, equipamento, limites de ocupação, preços, disponibilidade, condições de cancelamento e regras da casa — provém do respetivo fornecedor, que é responsável pela sua exatidão e integralidade.",
            "Verificamos os anúncios antes da publicação e de forma contínua quanto a violações manifestas das nossas [Regras sobre conteúdos adequados](https://mybestdays.dk/rechtliches/inhaltsrichtlinien). Não existe dever de vigilância geral de todos os conteúdos e, nos termos do artigo 8.º do Regulamento (UE) 2022/2065, tal também não seria admissível.",
            "A forma como ordenamos os resultados de pesquisa e os fatores que determinam essa ordem são explicados em [Preços, ordenação e recomendações](https://mybestdays.dk/rechtliches/preisangaben).",
            "Procuramos manter a plataforma permanentemente disponível, mas não garantimos disponibilidade ininterrupta. São possíveis manutenções, perturbações e adaptações.",
            "As traduções de conteúdos dos fornecedores podem ser automáticas. Prevalece a versão original introduzida pelo fornecedor.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Os nossos valores",
          paragraphs: [
            "Esperamos de hóspedes e fornecedores um trato respeitoso. A discriminação em razão da origem, cor da pele, religião, convicções, sexo, identidade de género, orientação sexual, deficiência, idade ou características análogas não é tolerada na plataforma — ver [Política de não discriminação](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Ao comportamento durante a estada aplicam-se as [Regras básicas para hóspedes](https://mybestdays.dk/rechtliches/grundregeln-gaeste) e, aos fornecedores, o [Código de conduta para fornecedores](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. A sua conta e a sua utilização da plataforma",
          paragraphs: [
            "Para reservar pode criar uma conta. É responsável pela confidencialidade das suas credenciais e informa-nos sem demora se suspeitar de utilização não autorizada.",
            "Só pode utilizar a plataforma se tiver capacidade jurídica e puder celebrar contratos validamente.",
            "Os seus dados no registo e na reserva devem ser corretos e completos — em especial nome, contactos e número de viajantes. O fornecedor necessita destas informações para disponibilizar o alojamento e cumprir os seus deveres de registo.",
            "Não é permitido, em especial:",
          ],
          list: [
            "reservas simuladas, pagamentos fraudulentos ou a utilização de meios de pagamento alheios sem autorização;",
            "a extração automatizada da plataforma (scraping, rastreadores) para além do que o nosso robots.txt permite;",
            "atos que perturbem ou sobrecarreguem a plataforma ou a infraestrutura subjacente ou contornem as suas medidas de segurança;",
            "a publicação de conteúdos ilícitos, injuriosos ou enganosos em avaliações, mensagens ou dados de perfil;",
            "a tentativa de concretizar a reserva fora da plataforma depois de o contacto ter sido estabelecido através dela — ver [Encargos fora da plataforma](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Preços",
          paragraphs: [
            "Todos os preços são apresentados como preço total, incluindo impostos e todas as taxas liquidadas através da plataforma, logo que os dados da viagem (período e número de viajantes) estejam definidos. Se um elemento apenas for devido no local, indicamo-lo separadamente antes da conclusão da reserva.",
            "Os preços são apresentados na moeda do anúncio. Se um montante for adicionalmente apresentado noutra moeda, trata-se de uma conversão indicativa sem caráter vinculativo; a liquidação é feita na moeda do anúncio, salvo indicação em contrário no pagamento.",
            "Os preços podem alterar-se até à conclusão da reserva, por exemplo porque o fornecedor os ajusta ou a disponibilidade muda. Prevalece o preço apresentado imediatamente antes da reserva vinculativa e indicado na confirmação de reserva.",
            "Erros de preço manifestos (por exemplo, um montante errado por uma ordem de grandeza) não vinculam nem a nós nem ao fornecedor. Se detetarmos tal erro, informamo-lo sem demora; poderá então cancelar a reserva sem custos.",
            "A composição das taxas de serviço consta de [Taxas de serviço](https://mybestdays.dk/rechtliches/servicegebuehren). Quanto a impostos e taxas, ver a [Política fiscal](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Pagamento",
          paragraphs: [
            "Os pagamentos através da plataforma são processados pelo prestador de serviços de pagamento Stripe. Os dados de pagamento (por exemplo, dados do cartão) são recolhidos e tratados diretamente pela Stripe; a myBestDays não conserva dados completos de cartões.",
            "O momento em que cada montante se vence — sinal, remanescente ou pagamento no local — depende do anúncio e é apresentado antes da conclusão da reserva. Os pormenores constam das [Condições de pagamento](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Se o anúncio previr uma caução, esta pode ser pré-autorizada ou cobrada e retida total ou parcialmente em caso de danos; prevalecem as indicações do anúncio.",
            "Se um pagamento falhar ou for objeto de estorno, a reserva pode ser cancelada. O fornecedor pode continuar a exigir os montantes decorrentes das suas condições de cancelamento.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Políticas",
          paragraphs: [
            "Além das presentes condições aplicam-se as seguintes políticas, que fazem parte do contrato entre si e nós:",
          ],
          list: [
            "[Regras sobre conteúdos adequados](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Política de avaliações](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Política de não discriminação](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Regras básicas para hóspedes](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Condições de cancelamento](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Política de realojamento e reembolso](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Política em caso de perturbações graves](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Política de direitos de autor](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Proteção de dados e cookies",
          paragraphs: [
            "A forma como tratamos dados pessoais consta da [Política de privacidade](https://mybestdays.dk/rechtliches/datenschutz). Os cookies e tecnologias análogas que utilizamos constam da [Política de cookies](https://mybestdays.dk/rechtliches/cookies).",
            "Para uma reserva transmitimos ao fornecedor os dados de que necessita para prestar o serviço de alojamento. O fornecedor é responsável autónomo pelo tratamento; aplicam-se-lhe as [Normas de proteção de dados para anfitriões](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Acessibilidade",
          paragraphs: [
            "O estado da acessibilidade da plataforma e a forma de comunicar barreiras constam da [Declaração de acessibilidade](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "As indicações sobre a acessibilidade de um alojamento provêm do fornecedor. Se depender de determinadas características, esclareça-as com o fornecedor através das mensagens antes de reservar.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Avaliações e conteúdos gerados pelos utilizadores",
          paragraphs: [
            "Após a estada pode deixar uma avaliação. Só pode avaliar quem tenha reservado através da plataforma e tenha iniciado a estada ou a pudesse ter iniciado — assim asseguramos que as avaliações publicadas provêm de hóspedes reais.",
            "Não pagamos por avaliações, não alteramos o seu conteúdo e não suprimimos uma avaliação apenas por ser negativa. Os pormenores e os fundamentos para removermos uma avaliação constam da [Política de avaliações](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "Continua responsável pelos conteúdos que publica — avaliações, fotografias, mensagens, dados de perfil. Concede-nos um direito não exclusivo, sem limitação territorial ou temporal e gratuito, de reproduzir, adaptar (por exemplo, recortar, traduzir) e comunicar ao público esses conteúdos no âmbito da exploração e promoção da plataforma. Pode eliminar os seus conteúdos; as utilizações já efetuadas em compilações já publicadas não são afetadas.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Mensagens e comunicação com o fornecedor",
          paragraphs: [
            "As mensagens entre si e o fornecedor circulam pela plataforma. Disponibilizamos a função de mensagens, mas não somos remetente nem destinatário dos conteúdos.",
            "Podemos verificar mensagens de forma automatizada quanto a violações das presentes condições (por exemplo, contactos destinados a contornar a plataforma, padrões de fraude, conteúdos ilícitos) e reter ou remover as mensagens em causa. Informamo-lo de qualquer remoção com fundamentação nos termos de A17.",
            "Enviamos-lhe mensagens sobre a sua reserva (confirmação, alterações, informações de chegada) para o endereço de correio eletrónico indicado. Estas mensagens são comunicação contratual e não podem ser canceladas enquanto a reserva existir. Só recebe mensagens publicitárias se tiver consentido ou se a lei o permitir sem consentimento; pode opor-se a qualquer momento.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Direitos de propriedade intelectual",
          paragraphs: [
            "A plataforma, o seu desenho, software, bases de dados, textos e marcas estão protegidos. Recebe um direito não exclusivo e intransmissível de utilizar a plataforma para procurar e reservar alojamento — e nada mais.",
            "A utilização das nossas marcas e logótipos rege-se pelas [Regras sobre marcas](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Se considerar que um conteúdo da plataforma viola o seu direito de autor, siga a [Política de direitos de autor](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. O que fazer se algo correr mal",
          paragraphs: [
            "Se o problema respeitar ao próprio alojamento, dirija-se primeiro ao fornecedor — através das mensagens ou no local. Muitos problemas resolvem-se assim mais depressa.",
            "Se não avançar com o fornecedor, ou se o problema respeitar à plataforma, ao pagamento ou ao processamento da reserva, dirija-se a nós. Como nos contactar e como tratamos as reclamações consta de [Reclamações e resolução de litígios](https://mybestdays.dk/rechtliches/beschwerden).",
            "Tenha à mão: o seu número de reserva, o endereço de correio eletrónico da reserva, uma breve descrição do problema com o que pretende que façamos e os respetivos comprovativos (fotografias, mensagens, recibos).",
            "Se o alojamento não estiver disponível à chegada ou divergir substancialmente do anúncio, aplica-se a [Política de realojamento e reembolso](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "A plataforma de resolução de litígios em linha da Comissão Europeia (plataforma RLL) foi revogada pelo Regulamento (UE) 2024/3228 e cessou a atividade; deixou de estar disponível como via. Os organismos que a substituem constam de [Reclamações e resolução de litígios](https://mybestdays.dk/rechtliches/beschwerden).",
            "Se tivermos adotado uma medida contra os seus conteúdos ou a sua conta, além do nosso procedimento interno de reclamação pode recorrer a um organismo de resolução extrajudicial de litígios certificado nos termos do artigo 21.º do Regulamento (UE) 2022/2065. As suas decisões não nos vinculam.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Medidas contra comportamentos inadequados",
          paragraphs: [
            "Se violar as presentes condições ou alguma das políticas indicadas em A9, podemos — de forma graduada consoante a gravidade, a frequência e os efeitos da violação — remover conteúdos ou limitar a sua visibilidade, bloquear funcionalidades, cancelar reservas ou suspender a sua conta temporária ou definitivamente.",
            "Antes de qualquer medida analisamos o caso concreto. Perante conteúdos manifestamente ilícitos, perigo para pessoas ou fraude podemos agir de imediato.",
            "Fundamentamos cada medida perante si e indicamos a via de reclamação — ver A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Comunicação de conteúdos ilícitos e fundamentação das medidas",
          paragraphs: [
            "Qualquer pessoa pode comunicar-nos conteúdos que considere ilícitos. O procedimento de comunicação nos termos do artigo 16.º do Regulamento (UE) 2022/2065, os nossos pontos de contacto e o tratamento das comunicações constam do [Regulamento dos Serviços Digitais](https://mybestdays.dk/rechtliches/dsa).",
            "Se adotarmos uma medida contra conteúdos por si publicados ou contra a sua conta, receberá uma fundamentação com indicação do motivo, da base factual, do fundamento jurídico ou da cláusula contratual violada e das possibilidades de reclamação.",
            "Contra qualquer medida pode reclamar gratuitamente no prazo de seis meses. As reclamações são tratadas por pessoas, não exclusivamente de forma automatizada.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Limitação da responsabilidade",
          paragraphs: [
            "Respondemos sem limitação por dolo e negligência grosseira, por danos decorrentes de lesão da vida, do corpo ou da saúde, bem como no âmbito de garantia por nós assumida. Os direitos decorrentes da responsabilidade do produtor não são afetados.",
            "Quanto ao restante, a nossa responsabilidade limita-se ao dano previsível que resulte tipicamente da violação dos deveres em cujo cumprimento pode confiar — e apenas na medida em que o direito aplicável admita tal limitação.",
            "Não respondemos pela prestação do próprio serviço de alojamento nem pelo comportamento de fornecedores ou de outros hóspedes. A contraparte do serviço de alojamento é o fornecedor.",
            "Não respondemos pela exatidão das indicações publicadas pelos fornecedores, na medida em que não as conhecêssemos nem devêssemos conhecer. Logo que tomemos conhecimento de uma indicação ilícita, agimos sem demora.",
            "Fica excluída qualquer responsabilidade adicional. Os direitos legais imperativos, em especial os direitos dos consumidores, não são afetados.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Lei aplicável e foro competente",
          paragraphs: [
            "Aplica-se o direito dinamarquês — o operador está estabelecido na Dinamarca — com exclusão da Convenção das Nações Unidas sobre os Contratos de Compra e Venda Internacional de Mercadorias. As disposições imperativas de proteção do consumidor do Estado em que tem a sua residência habitual não são afetadas, nos termos do artigo 6.º do Regulamento (CE) n.º 593/2008 (Roma I).",
            "Enquanto consumidor pode demandar-nos no tribunal do seu domicílio ou no da nossa sede na Dinamarca; nós só o podemos demandar no tribunal do seu domicílio (artigos 17.º a 19.º do Regulamento (UE) n.º 1215/2012).",
            "Ao contrato de alojamento aplica-se, em regra, o direito do Estado em que o alojamento se situa; para ações relativas ao arrendamento de imóveis são exclusivamente competentes os tribunais desse Estado.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Serviços de viagem conexos",
          paragraphs: [
            "myBestDays intermedeia exclusivamente serviços de alojamento. Não oferecemos voos, aluguer de automóveis, serviços de transporte, excursões ou atrações e não organizamos viagens organizadas na aceção da Diretiva (UE) 2015/2302.",
            "Se no futuro viermos a intermediar outros serviços de viagem, informá-lo-emos antes da reserva, mediante o formulário normalizado legalmente previsto, sobre se surge uma viagem organizada ou um serviço de viagem conexo e que direitos daí resultam.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Duração, suspensão e cessação",
          paragraphs: [
            "O contrato de utilização da plataforma é celebrado por tempo indeterminado. Pode eliminar a sua conta a qualquer momento sem indicação de motivo; as reservas existentes não são afetadas e são processadas segundo as condições do respetivo fornecedor.",
            "Podemos denunciar o contrato de utilização com pré-aviso de 14 dias. Em caso de violação grave das presentes condições podemos resolvê-lo sem pré-aviso e bloquear a conta.",
            "Após a cessação eliminamos os seus dados, salvo se a tal obstar um dever legal de conservação ou um interesse legítimo na sua conservação; os pormenores constam da [Política de privacidade](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Cláusula de alteração",
          paragraphs: [
            "Podemos alterar as presentes condições quando exista um motivo objetivo — por exemplo, alteração legislativa, jurisprudência dos tribunais superiores, funcionalidades novas ou suprimidas da plataforma ou o preenchimento de lacunas.",
            "Anunciamos as alterações com, pelo menos, 30 dias de antecedência relativamente à sua entrada em vigor, em forma escrita. Se não se opuser antes da entrada em vigor, as condições alteradas consideram-se aceites; chamamos especialmente a atenção para este efeito no anúncio. Em caso de oposição, podemos denunciar o contrato de utilização com efeitos na data da entrada em vigor.",
            "Às reservas já celebradas aplicam-se as condições na versão em vigor no momento da reserva.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Alojamentos",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Âmbito da presente secção",
          paragraphs: [
            "A presente secção aplica-se à reserva de alojamentos através da plataforma — imóveis de férias, bem como quartos e unidades de estabelecimentos de alojamento.",
            "Complementa a secção A. Em caso de contradição prevalece a presente secção B.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Relação contratual",
          paragraphs: [
            "O contrato de alojamento é celebrado exclusivamente entre si e o fornecedor. A myBestDays não é parte no contrato.",
            "A apresentação de um alojamento na plataforma constitui um convite a que apresente uma proposta de reserva. Ao clicar no botão de reserva com obrigação de pagamento, apresenta uma proposta vinculativa.",
            "O contrato conclui-se com a confirmação da reserva. Enviamos a confirmação de reserva para o endereço de correio eletrónico por si indicado; nela constam o fornecedor, o serviço reservado, o período, o preço total e as condições de cancelamento.",
            "Em alojamentos com reserva sob consulta, o contrato só se conclui com a aceitação pelo fornecedor. Até lá, o seu meio de pagamento pode ser pré-autorizado, mas não debitado.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. O que fazemos nós",
          paragraphs: [
            "Disponibilizamos a plataforma, apresentamos os anúncios dos fornecedores, recebemos a sua reserva, transmitimo-la ao fornecedor e enviamos-lhe a confirmação de reserva.",
            "Processamos o pagamento na medida em que o anúncio preveja pagamento através da plataforma e disponibilizamos as mensagens entre si e o fornecedor.",
            "Não disponibilizamos o alojamento, não o exploramos e não garantimos o seu estado. Não somos o seu operador turístico.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. O que deve fazer",
          paragraphs: [
            "Antes de reservar, analise o anúncio na íntegra: equipamento, limite de ocupação, horários de chegada e partida, regras da casa, condições de cancelamento e os custos devidos apenas no local.",
            "Respeite a ocupação máxima indicada no anúncio. Se chegarem mais pessoas do que as reservadas, o fornecedor pode recusar a entrada ou exigir um suplemento.",
            "Observe as regras da casa do fornecedor e as [Regras básicas para hóspedes](https://mybestdays.dk/rechtliches/grundregeln-gaeste). Tratará o alojamento com cuidado e responde pelos danos causados por si ou pelos seus acompanhantes.",
            "Se o fornecedor ou uma autoridade necessitar de dados para o registo (por exemplo, boletim de alojamento, dados de identificação, declaração de taxa turística), disponibilize-os atempadamente.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Preços e pagamento",
          paragraphs: [
            "O preço total compreende o preço da estada pelo período reservado e os suplementos e taxas indicados no anúncio que sejam liquidados através da plataforma.",
            "No local podem ser devidos montantes adicionais — em especial taxa turística ou tributos locais, uma caução, bem como serviços adicionais que reserve apenas no local. Indicamo-los como custos no local antes da conclusão da reserva, na medida em que o fornecedor os tenha declarado.",
            "Se o anúncio previr um sinal, o remanescente vence-se na data indicada no anúncio. Na falta de pagamento, o fornecedor pode resolver o contrato nos termos das suas condições de cancelamento.",
            "Não aceitamos nem conseguimos rastrear pagamentos ao fornecedor efetuados fora da plataforma; não estão abrangidos pelo nosso processamento de pagamentos — ver [Encargos fora da plataforma](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Alterações, cancelamentos e reembolsos",
          paragraphs: [
            "Se e em que condições uma reserva pode ser cancelada ou alterada sem custos depende das condições de cancelamento do fornecedor indicadas no anúncio. As condições que disponibilizamos aos fornecedores são descritas em [Condições de cancelamento](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "Nas prestações de alojamento reservadas por um período determinado não existe, em regra, direito legal de livre resolução nos termos do artigo 16.º, alínea l), da Diretiva 2011/83/UE ou das disposições nacionais correspondentes. Os direitos legais imperativos não são afetados.",
            "Se o fornecedor cancelar, reembolsamos integralmente o montante pago através da plataforma. Acresce a [Política de realojamento e reembolso](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Se um acontecimento fora do controlo de ambas as partes impedir a viagem ou a estada, aplica-se a [Política em caso de perturbações graves](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "Os reembolsos são efetuados no meio de pagamento utilizado, salvo acordo em contrário.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. O que deve ainda saber",
          paragraphs: [
            "Os fornecedores podem ser anfitriões particulares ou profissionais. Indicamos no anúncio se um fornecedor atua como profissional. Se não se tratar de um profissional, as disposições da União em matéria de proteção do consumidor não se aplicam ao contrato de alojamento — chamamos a sua atenção para tal no anúncio.",
            "As indicações sobre localização, envolvente, distâncias e avaliações de terceiros têm caráter orientador. São vinculativas as indicações sobre o próprio serviço reservado.",
            "Em zonas com obrigação de registo para arrendamento de curta duração indicamos no anúncio o número de registo comunicado pelo fornecedor; ver [Arrendamento de curta duração](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Havendo várias unidades idênticas de um tipo de imóvel ou quarto, reserva uma unidade desse tipo. Qual a unidade concreta que lhe é atribuída é determinado pelo fornecedor.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Glossário",
      paragraphs: [
        "Os termos seguintes têm nas presentes condições o significado aqui indicado.",
      ],
      definitions: [
        {
          term: "Fornecedor",
          description:
            "A pessoa singular ou coletiva que oferece alojamento através da plataforma e se torna contraparte do contrato de alojamento.",
        },
        {
          term: "Reserva sob consulta",
          description:
            "Reserva que só se conclui após aceitação expressa pelo fornecedor, por oposição à reserva imediata.",
        },
        {
          term: "Confirmação de reserva",
          description:
            "A mensagem pela qual lhe confirmamos a celebração do contrato de alojamento; contém fornecedor, serviço, período, preço total e condições de cancelamento.",
        },
        {
          term: "Unidade",
          description:
            "O objeto concreto reservável dentro de um tipo de imóvel ou quarto. Vende-se a unidade; descreve-se e tarifa-se o tipo.",
        },
        {
          term: "Preço total",
          description:
            "O montante indicado ao concluir a reserva, incluindo todos os impostos e todas as taxas liquidadas através da plataforma.",
        },
        {
          term: "Ocupação máxima",
          description:
            "O número máximo de pessoas autorizadas a pernoitar no alojamento, conforme indicado no anúncio.",
        },
        {
          term: "Caução",
          description:
            "Montante exigido pelo fornecedor como garantia de danos, pré-autorizado ou cobrado e libertado ou compensado após a estada.",
        },
        {
          term: "Taxa turística",
          description:
            "Tributo local sobre dormidas, cobrado consoante o município no local ou através do fornecedor; não é uma prestação da myBestDays.",
        },
        {
          term: "Plataforma",
          description:
            "O sítio web, as aplicações móveis e todos os demais acessos através dos quais a myBestDays apresenta alojamentos e intermedeia reservas.",
        },
        {
          term: "Taxa de serviço",
          description:
            "A remuneração do serviço de intermediação da myBestDays. Quem a suporta e como é indicada consta de Taxas de serviço.",
        },
        {
          term: "Condições de cancelamento",
          description:
            "As regras escolhidas pelo fornecedor sobre até quando e a que custo uma reserva pode ser cancelada ou alterada.",
        },
        {
          term: "Alojamento",
          description:
            "A prestação de alojamento oferecida pelo fornecedor — um imóvel de férias ou uma unidade de um tipo de quarto ou de imóvel.",
        },
        {
          term: "Custos no local",
          description:
            "Montantes não liquidados através da plataforma, mas devidos ao fornecedor, como taxa turística, caução ou serviços adicionais reservados no local.",
        },
      ],
    },
  ],
};
