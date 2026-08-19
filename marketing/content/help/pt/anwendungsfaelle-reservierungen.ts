import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Reservas e calendário",
  description: "Manter reservas e calendário sob controlo.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Reservas e calendário",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Evitar reservas duplicadas de forma fiável",
          excerpt: "Como garantir que um imóvel nunca é reservado duas vezes.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial",
            },
            {
              type: "p",
              text: "Um imóvel é vendido em vários canais ao mesmo tempo — portais como Booking, Airbnb e outros, a plataforma própria e a aplicação. Uma reserva duplicada acontece quando a disponibilidade não é bloqueada a tempo num canal depois de ter havido uma reserva noutro canal.",
            },
            {
              type: "steps",
              items: [
                "Verifique no mapa de ocupação que cada imóvel corresponde exatamente a uma linha com uma unidade reservável — nunca uma capacidade partilhada por vários quartos.",
                "Crie novas reservas exclusivamente através do mapa de ocupação ou dos canais ligados, nunca preenchendo manualmente dias individuais.",
                "Verifique, após cada reserva, se as noites reservadas aparecem imediatamente como ocupadas no calendário.",
                "Em caso de problemas técnicos ou manutenção, use imediatamente o bloqueio de vendas em vez de deixar o dia aberto.",
                "Em caso de dúvida, verifique a linha do tempo da reserva em causa para perceber a sequência dos acontecimentos.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Nunca altere noites ou bloqueios manualmente fora do mapa de ocupação — só assim fica garantido que todos os canais veem o mesmo estado de disponibilidade e que não surge nenhuma lacuna que permita uma reserva duplicada.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Mudar uma reserva para outro imóvel",
          excerpt: "Como transferir de forma limpa uma reserva existente para outro imóvel.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial",
            },
            {
              type: "p",
              text: "Por vezes um hóspede precisa de mudar de um imóvel para outro, por exemplo devido a uma avaria técnica ou a pedido do hóspede. Na mudança, as noites de calendário anteriores são libertadas automaticamente e ocupadas de novo no imóvel de destino.",
            },
            {
              type: "steps",
              items: [
                "Abra a reserva em causa na linha do tempo da reserva.",
                "Selecione no menu de ações “Mudar de imóvel” ou “Transferir”.",
                "Escolha o imóvel de destino e verifique a sua disponibilidade no período selecionado.",
                "Confirme a mudança.",
                "Verifique depois no mapa de ocupação se as noites antigas voltam a aparecer como disponíveis no imóvel de origem.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "O sistema liberta automaticamente as noites antigas — não precisa de abrir manualmente o período de origem. Informe o hóspede sobre a mudança de imóvel, sobretudo se o equipamento ou o acesso forem diferentes.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Criar uma reserva de longa duração",
          excerpt: "Como criar corretamente uma reserva para um período mais longo.",
          updated: "Atualizado: julho de 2026",
          body: [
            {
              type: "h2",
              text: "Situação inicial",
            },
            {
              type: "p",
              text: "Para hóspedes de longa duração — por exemplo várias semanas ou meses — cria a reserva como habitualmente, mas presta atenção adicional à estadia mínima, às regras de pagamento e à visibilidade nos canais do imóvel ao longo de todo o período.",
            },
            {
              type: "steps",
              items: [
                "Abra o mapa de ocupação do imóvel pretendido e marque o período completo.",
                "Crie a reserva com os dados do hóspede e as datas de chegada e partida previstas.",
                "Se necessário, configure uma regra de pagamento com sinal e pagamento final, em vez de exigir o valor total de imediato.",
                "Verifique se nenhuma regra de estadia mínima ou máxima contradiz o período longo.",
                "Guarde a reserva e verifique se todo o período aparece corretamente como ocupado no calendário.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Em estadias muito longas recomenda-se um pagamento final em várias parcelas em vez de um único valor elevado — assim o risco de pagamento mantém-se controlável. Detalhes em [Automatizar o pagamento final](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
