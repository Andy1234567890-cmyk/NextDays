import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Reclamações e resolução de litígios",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "A presente página descreve como contactar a myBestDays, como tratamos as reclamações e que vias lhe ficam abertas se não concordar com a nossa decisão.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Como nos contactar",
      paragraphs: [
        "A via mais rápida é o centro de ajuda e os contactos aí indicados. Para uma reserva existente utilize as mensagens da sua conta — dispomos então já da reserva e do histórico.",
        `Por escrito pode contactar-nos em ${ANBIETER.email} ou ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dinamarca; por telefone através do ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. O que a sua reclamação deve conter",
      paragraphs: ["Para podermos ajudar rapidamente, indique:"],
      list: [
        "o seu número de reserva e o endereço de correio eletrónico utilizado na reserva;",
        "uma breve descrição do problema;",
        "que solução pretende;",
        "os comprovativos respetivos — fotografias, mensagens, recibos, extratos de conta.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Como tratamos",
      paragraphs: [
        "Cada reclamação é registada e recebe um número de processo com o qual pode acompanhar o seu estado.",
        "Acusamos a receção sem demora e respondemos de mérito, em regra, no prazo de sete dias. Se for necessária análise mais longa, comunicamos o ponto de situação.",
        "As reclamações em que existam pessoas em perigo ou uma chegada iminente são tratadas com prioridade.",
        "Fundamentamos a nossa decisão e indicamos o fundamento em que assenta.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Reclamação de uma medida por nós adotada",
      paragraphs: [
        "Se removemos conteúdos, limitámos a sua visibilidade, cancelámos uma reserva ou bloqueámos uma conta, pode reclamar gratuitamente no prazo de seis meses. Tal corresponde ao artigo 20.º do Regulamento (UE) 2022/2065.",
        "A reclamação é apreciada por pessoas, não exclusivamente por procedimentos automatizados. Se se revelar fundada, revogamos a medida.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Resolução extrajudicial de litígios",
      paragraphs: [
        "A plataforma de resolução de litígios em linha da Comissão Europeia (plataforma RLL) foi revogada pelo Regulamento (UE) 2024/3228 e cessou a atividade. Já não é possível apresentar reclamações por essa via.",
        "Não estamos obrigados nem disponíveis para participar num procedimento de resolução de litígios perante uma entidade de resolução de litígios de consumo.",
        `Independentemente disso, enquanto consumidor pode dirigir-se à entidade dinamarquesa competente: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Dinamarca ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Se residir noutro Estado-Membro, o Centro Europeu do Consumidor do seu país pode ajudá-lo.`,
        "Se o litígio respeitar a uma medida por nós adotada contra os seus conteúdos ou a sua conta, pode ainda recorrer a um organismo de resolução extrajudicial de litígios certificado nos termos do artigo 21.º do Regulamento (UE) 2022/2065. As suas decisões não nos vinculam e não estamos obrigados a participar em tais procedimentos.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Via judicial",
      paragraphs: [
        "A via judicial está-lhe aberta a todo o tempo, mesmo sem procedimento prévio de reclamação. Os tribunais competentes constam da secção A19 das [Condições de utilização](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Reclamações de fornecedores",
      paragraphs: [
        "Os fornecedores podem apresentar, pelo mesmo procedimento, reclamações sobre a aplicação das presentes condições, sobre decisões de ordenação e sobre limitações do seu anúncio. Tal corresponde ao artigo 11.º do Regulamento (UE) 2019/1150.",
        "Damos conta anualmente do número, do objeto e do tempo médio de tratamento dessas reclamações; o relatório pode ser consultado no [Regulamento dos Serviços Digitais](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
