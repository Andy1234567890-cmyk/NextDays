import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Reservas y calendario",
  description: "Mantener el control de las reservas y el calendario.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Reservas y calendario",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Evitar el overbooking de forma fiable",
          excerpt: "Así se asegura de que un alojamiento nunca se reserve dos veces.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida",
            },
            {
              type: "p",
              text: "Un alojamiento se vende simultáneamente a través de varios canales: portales como Booking, Airbnb y otros, la plataforma propia y la aplicación. El overbooking se produce cuando la disponibilidad no se bloquea a tiempo en un canal después de que se haya reservado en otro.",
            },
            {
              type: "steps",
              items: [
                "Compruebe en el plan de ocupación que cada alojamiento es exactamente una línea con una unidad reservable, sin capacidad compartida entre varias habitaciones.",
                "Cree las nuevas reservas exclusivamente a través del plan de ocupación o de los canales conectados, nunca marcando manualmente días concretos.",
                "Compruebe después de cada reserva que las noches reservadas aparecen inmediatamente como ocupadas en el calendario.",
                "Ante problemas técnicos o tareas de mantenimiento, utilice de inmediato Stop-Sell en lugar de dejar el día abierto.",
                "Ante cualquier duda, revise la línea de tiempo de la reserva correspondiente para reconstruir la secuencia de los hechos.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "No modifique nunca noches ni bloqueos manualmente fuera del plan de ocupación: solo así se garantiza que todos los canales vean el mismo estado de disponibilidad y que no se produzca ningún hueco que permita una reserva duplicada.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Trasladar una reserva a otro alojamiento",
          excerpt: "Así traslada de forma correcta una reserva existente a otro alojamiento.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida",
            },
            {
              type: "p",
              text: "A veces un huésped debe trasladarse de un alojamiento a otro, por ejemplo por una avería técnica o a petición del huésped. Durante el traslado, las noches anteriores del calendario se liberan automáticamente y se vuelven a ocupar en el alojamiento de destino.",
            },
            {
              type: "steps",
              items: [
                "Abra la reserva correspondiente en la línea de tiempo de la reserva.",
                "Seleccione en el menú de acciones “Cambiar de alojamiento” o “Trasladar”.",
                "Seleccione el alojamiento de destino y compruebe su disponibilidad en el periodo elegido.",
                "Confirme el traslado.",
                "A continuación, compruebe en el plan de ocupación que las noches anteriores vuelven a aparecer como disponibles en el alojamiento de origen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "El sistema se encarga automáticamente de liberar las noches anteriores; no es necesario que abra manualmente el periodo de origen. Informe al huésped del cambio de alojamiento, especialmente si el equipamiento o el acceso son diferentes.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Crear una reserva de larga estancia",
          excerpt: "Así crea correctamente una reserva para un periodo más largo.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida",
            },
            {
              type: "p",
              text: "Para huéspedes de larga estancia, por ejemplo varias semanas o meses, cree la reserva como de costumbre, pero preste además atención a la estancia mínima, las reglas de pago y la visibilidad por canal del alojamiento durante todo el periodo.",
            },
            {
              type: "steps",
              items: [
                "Abra el plan de ocupación del alojamiento deseado y marque el periodo completo.",
                "Cree la reserva con los datos del huésped y las fechas de entrada y salida previstas.",
                "Configure, si es necesario, una regla de pago con depósito y pago restante, en lugar de exigir el importe completo de inmediato.",
                "Compruebe que ninguna regla de estancia mínima o máxima entra en conflicto con el periodo largo.",
                "Guarde la reserva y compruebe que todo el periodo aparece correctamente como ocupado en el calendario.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "En estancias muy largas, se recomienda dividir el pago restante en varios importes parciales en lugar de un único vencimiento elevado, de modo que el riesgo de pago se mantenga controlado. Más detalles en [Automatizar el pago restante](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
