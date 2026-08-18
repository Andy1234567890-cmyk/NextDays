import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Informações legais",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    `Dados do prestador do mercado myBestDays. O operador é a ${ANBIETER.firma}; myBestDays é uma marca desta sociedade e não uma pessoa coletiva autónoma.`,
    "Indicações obrigatórias nos termos do § 7 da lei dinamarquesa do comércio eletrónico, que transpõe o artigo 5.º da Diretiva 2000/31/CE, bem como dos artigos 11.º e 12.º do Regulamento (UE) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Operador da plataforma",
      paragraphs: [
        `${ANBIETER.firma} — sociedade por quotas (anpartsselskab, ApS) de direito dinamarquês`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Dinamarca`,
        `Direção com poderes de representação: ${ANBIETER.direktion.join(" e ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Contacto",
      paragraphs: [
        `Correio eletrónico: ${ANBIETER.email}`,
        `Telefone: ${ANBIETER.telefon}`,
        "Para assuntos relativos a uma reserva existente utilize as mensagens da sua conta — dispomos então já da reserva e do histórico; ver [Reclamações e resolução de litígios](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Registo e IVA",
      paragraphs: [
        `CVR n.º ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dinamarca.`,
        ...(ANBIETER.ustId
          ? [`Número de identificação para efeitos de IVA: ${ANBIETER.ustId}.`]
          : [
              "Atualmente não existe número de identificação para efeitos de IVA; o § 7 da lei do comércio eletrónico só exige a sua indicação havendo registo para efeitos de IVA.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Pontos de contacto nos termos do Regulamento (UE) 2022/2065",
      paragraphs: [
        `Ponto de contacto único para autoridades nos termos do artigo 11.º e para utilizadores nos termos do artigo 12.º: ${ANBIETER.email}, por via postal na morada acima indicada.`,
        "As línguas de comunicação são alemão, dinamarquês e inglês.",
        "Os procedimentos previstos nesse regulamento — comunicação de conteúdos ilícitos, fundamentação das medidas, tratamento de reclamações — constam do [Regulamento dos Serviços Digitais](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Autoridades competentes",
      paragraphs: [
        `Coordenador dos serviços digitais nos termos do artigo 49.º do Regulamento (UE) 2022/2065: ${DSA_KOORDINATOR.name}, Dinamarca ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Autoridade de controlo em matéria de proteção de dados: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Dinamarca, ${AUFSICHTSBEHOERDE.email}.`,
        "A intermediação de prestações de alojamento não carece na Dinamarca de licença especial; não existe, por isso, autoridade de supervisão setorial.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Resolução de litígios de consumo",
      paragraphs: [
        "A plataforma de resolução de litígios em linha da Comissão Europeia foi revogada pelo Regulamento (UE) 2024/3228 e cessou a atividade.",
        "Não estamos obrigados nem disponíveis para participar num procedimento de resolução de litígios perante uma entidade de resolução de litígios de consumo.",
        `Independentemente disso, enquanto consumidor pode dirigir-se à entidade dinamarquesa competente: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Dinamarca ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Se residir noutro Estado-Membro, o Centro Europeu do Consumidor do seu país pode ajudá-lo.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Notas sobre conteúdos e ligações",
      paragraphs: [
        "Os conteúdos dos anúncios provêm dos respetivos fornecedores. A myBestDays não os assume como próprios; ver a secção A4 das [Condições de utilização](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "Pelo conteúdo de sítios de terceiros com ligação responde o respetivo operador. Logo que tomemos conhecimento de uma violação, removemos a ligação sem demora.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Direitos de autor",
      paragraphs: [
        `Os conteúdos próprios, textos, elementos gráficos e marcas publicados nesta plataforma estão protegidos por direito de autor e direito de marcas. Qualquer utilização fora dos casos legalmente permitidos carece de consentimento prévio por escrito da ${ANBIETER.firma}; quanto às marcas aplicam-se as [Regras sobre marcas](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Lei aplicável",
      paragraphs: [
        `A ${ANBIETER.firma} tem sede na Dinamarca e está estabelecida exclusivamente nesse Estado. À presente oferta em linha aplica-se, por isso, o direito dinamarquês — também à versão em português (princípio do país de origem nos termos do artigo 3.º da Diretiva 2000/31/CE). As disposições imperativas de proteção do consumidor do seu Estado de residência não são afetadas.`,
      ],
    },
  ],
};
