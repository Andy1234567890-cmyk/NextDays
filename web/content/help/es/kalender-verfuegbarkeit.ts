import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Calendario y disponibilidad",
  description: "Plan de ocupación, Stop-Sell y estancia mínima.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Calendario",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Leer el plan de ocupación",
          excerpt: "Así lee correctamente reservas, disponibilidad y precios en el plan de ocupación.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "El plan de ocupación le muestra de un vistazo qué noches están reservadas, disponibles o bloqueadas. En alojamientos vacacionales verá una línea por alojamiento; en hoteles, una vista anidada con una línea por categoría de habitación y plan de tarifa.",
            },
            { type: "h2", text: "Estructura de la vista" },
            {
              type: "steps",
              items: [
                "Abra el calendario a través del elemento de menú «Plan de ocupación».",
                "Elija arriba el periodo que desea consultar.",
                "Filtre, si lo necesita, por alojamientos o categorías de habitación concretas.",
                "Haga clic en un día para abrir los detalles de precio y disponibilidad.",
                "Haga clic en un periodo ocupado para abrir la reserva correspondiente.",
              ],
            },
            { type: "h2", text: "Colores y símbolos" },
            {
              type: "ul",
              items: [
                "Ocupado: el periodo está reservado por una reserva.",
                "Disponible: el día puede reservarse en todos los canales activos.",
                "Bloqueado: el día no es reservable debido a Stop-Sell o a un bloqueo manual.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Cada línea del plan de ocupación representa exactamente una unidad reservable — una habitación o un alojamiento vacacional. No existe una línea contenedora para varias habitaciones a la vez.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Más información sobre cómo abrir y cerrar días concretos de forma específica en [Establecer disponibilidad](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Establecer disponibilidad",
          excerpt: "Abra y cierre días o periodos concretos de forma específica.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "La disponibilidad determina si un alojamiento puede reservarse en un día concreto. Puede abrir o cerrar días individuales o periodos completos directamente en el plan de ocupación.",
            },
            { type: "h2", text: "Editar un periodo" },
            {
              type: "steps",
              items: [
                "Abra el plan de ocupación del alojamiento deseado.",
                "Marque el periodo deseado haciendo clic y arrastrando.",
                "Elija en el menú de acciones «Cambiar disponibilidad».",
                "Confirme si el periodo debe abrirse o cerrarse.",
                "Guarde el cambio.",
              ],
            },
            { type: "h2", text: "Efecto sobre los canales" },
            {
              type: "p",
              text: "Un cambio de disponibilidad afecta a todos los canales de venta en los que el alojamiento es visible: portales como Booking, Airbnb y otros, la plataforma propia y la app. La transmisión a los portales se realiza automáticamente en segundo plano.",
            },
            {
              type: "ul",
              items: [
                "Abrir: el día se vuelve reservable en todos los canales activos.",
                "Cerrar: el día desaparece de la disponibilidad de reserva, pero sigue siendo visible en el calendario.",
                "Las reservas ya existentes no se ven afectadas por un cambio de disponibilidad.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "No cierre un periodo con la intención de bloquearlo total y permanentemente para la venta — para eso la función correcta es Stop-Sell, vea [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-Sell",
          excerpt: "Stop-Sell bloquea un día de inmediato en todos los canales de venta a la vez.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Stop-Sell es la forma más rápida de retirar por completo un solo día de la venta. A diferencia de un simple cambio de disponibilidad, Stop-Sell actúa de forma estricta e inmediata en todos los canales a la vez — en los portales, en la plataforma propia y en la app.",
            },
            { type: "h2", text: "Activar Stop-Sell" },
            {
              type: "steps",
              items: [
                "Abra el plan de ocupación del alojamiento afectado.",
                "Seleccione el día o el periodo deseado.",
                "Haga clic en el menú de acciones en «Activar Stop-Sell».",
                "Confirme el bloqueo.",
              ],
            },
            { type: "h2", text: "Cuándo tiene sentido Stop-Sell" },
            {
              type: "ul",
              items: [
                "Trabajos de mantenimiento a corto plazo o problemas técnicos en el alojamiento.",
                "Un caso especial en el que no quiere ninguna reserva nueva, de inmediato y sin excepción.",
                "Un bloqueo de emergencia rápido en toda la plataforma, sin tener que editar cada canal por separado.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell no admite excepciones por canal: si un día está bloqueado, ningún huésped puede reservar por ningún canal, tampoco a través de recepción o de una solicitud directa.",
            },
            {
              type: "note",
              variant: "info",
              text: "Para uso propio permanente o mantenimiento planificado es más adecuado el [Bloqueo manual](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung).",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Estancia mínima y máxima",
          excerpt: "Cuánto tiempo mínimo o máximo pueden reservar los huéspedes.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Con la estancia mínima y máxima determina cuántas noches puede reservar como mínimo o como máximo un huésped para un día de llegada. Esto ayuda a evitar reservas de hueco cortas o a posicionar su alojamiento de forma específica para estancias más largas.",
            },
            { type: "h2", text: "Configurar la regla" },
            {
              type: "steps",
              items: [
                "Abra en el alojamiento el plan de ocupación o la pestaña «Precios».",
                "Seleccione el periodo afectado.",
                "Introduzca en «Estancia mínima» el número mínimo de noches.",
                "Introduzca opcionalmente en «Estancia máxima» un número máximo de noches.",
                "Guarde la regla.",
              ],
            },
            { type: "h2", text: "Casos de uso habituales" },
            {
              type: "ul",
              items: [
                "Temporada alta: estancia mínima más alta, para agrupar los días de cambio.",
                "Temporada baja: estancia mínima más baja, para permitir más reservas.",
                "Estancia máxima: útil cuando un alojamiento debe quedar libre después para mantenimiento u otro uso.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La regla se aplica al día de llegada: un huésped no puede llegar para solo dos noches en un día con una estancia mínima de tres noches, aunque los días individuales estén disponibles.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Combine estancias mínimas más largas con [Descuentos por estancia](/hilfe/preise-raten/aufenthaltsrabatte) para aumentar el incentivo para los huéspedes.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Bloqueo manual",
          excerpt: "Reserve periodos de forma específica para uso propio o mantenimiento.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Un bloqueo manual reserva un periodo en el calendario sin que exista una reserva real de huésped — por ejemplo, para uso propio, trabajos de mantenimiento planificados o reformas. El periodo se muestra en el plan de ocupación como una reserva, pero se reconoce claramente como bloqueo.",
            },
            { type: "h2", text: "Crear un bloqueo" },
            {
              type: "steps",
              items: [
                "Abra el plan de ocupación del alojamiento afectado.",
                "Marque el periodo deseado.",
                "Elija en el menú de acciones «Bloquear manualmente».",
                "Indique un motivo, p. ej. «Uso propio» o «Mantenimiento».",
                "Guarde el bloqueo.",
              ],
            },
            { type: "h2", text: "Diferencia con Stop-Sell" },
            {
              type: "p",
              text: "Un bloqueo manual reserva concretamente un periodo para un fin determinado y documentado, y puede liberarse de nuevo más adelante. Para un bloqueo de emergencia inmediato y en toda la plataforma, sin periodo documentado, está pensado en cambio Stop-Sell.",
            },
            {
              type: "ul",
              items: [
                "Bloqueo manual: planificado, con motivo, para uso propio o mantenimiento.",
                "Liberación posible en cualquier momento, en cuanto el periodo ya no sea necesario.",
                "Las noches bloqueadas no cuentan como reserva de huésped y no aparecen en el resumen de ingresos.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Elimine un bloqueo manual en cuanto desaparezca el motivo — de lo contrario el alojamiento permanece innecesariamente bloqueado en todos los canales.",
            },
            {
              type: "note",
              variant: "info",
              text: "Para un bloqueo inmediato sin periodo planificado, use [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
