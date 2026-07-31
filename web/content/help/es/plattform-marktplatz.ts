import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Plataforma (marketplace)",
  description: "Vender en el marketplace de myBestDays.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Marketplace",
      articles: [
        {
          slug: "der-marktplatz",
          title: "El marketplace de myBestDays",
          excerpt: "El marketplace global de myBestDays es un canal de reserva propio junto a los portales y la web.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "El marketplace de myBestDays (/plattform) es el canal de reserva global de la propia myBestDays — comparable a Booking o Airbnb, pero parte de la misma plataforma. Ahí los huéspedes buscan alojamientos de todos los negocios conectados y reservan directamente.",
            },
            { type: "h2", text: "Ningún «directo», sino un canal del mismo rango" },
            {
              type: "p",
              text: "El marketplace no sustituye a la reserva directa a través de su propia web. Es una tercera vía de venta independiente con su propio eje de visibilidad, su propia base de huéspedes y su propia comisión — igual que un portal, solo que gestionado por la propia myBestDays.",
            },
            { type: "h2", text: "Cómo llegan los alojamientos al marketplace" },
            {
              type: "ul",
              items: [
                "El alojamiento debe estar activo (el estado del alojamiento permite la venta).",
                "La visibilidad en el marketplace debe estar activada — separada de los portales y de la web.",
                "Debe existir disponibilidad en el calendario para el periodo deseado.",
              ],
            },
            { type: "h2", text: "Reservas desde el marketplace" },
            {
              type: "p",
              text: "Una reserva del marketplace bloquea de inmediato las noches correspondientes en todos los demás canales — igual que una reserva de portal o de la web. Aparece en su calendario y en las reservas como cualquier otra reserva, marcada con el canal «Plataforma».",
            },
            {
              type: "note",
              variant: "info",
              text: "Stop-Sell y un estado de alojamiento inactivo actúan de forma transversal sobre los canales y bloquean también el marketplace — independientemente del interruptor de visibilidad del marketplace.",
            },
            {
              type: "p",
              text: "Cómo habilitar un alojamiento para el marketplace se explica en [Listar un alojamiento en el marketplace](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Listar un alojamiento en el marketplace",
          excerpt: "La visibilidad en el marketplace es un interruptor propio, separado de los portales y de la web.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Controla la visibilidad en el marketplace mediante un interruptor propio en el alojamiento — independientemente de si el mismo alojamiento también es visible en los portales o en su web.",
            },
            { type: "h2", text: "Así lista un alojamiento" },
            {
              type: "steps",
              items: [
                "Abra el alojamiento en Alojamientos.",
                "Vaya a la pestaña Visibilidad.",
                "Active el interruptor Marketplace de la plataforma.",
                "Compruebe que el estado del alojamiento sea activo y que exista disponibilidad en el calendario.",
              ],
            },
            { type: "h2", text: "Requisito: perfil completo" },
            {
              type: "p",
              text: "El marketplace solo muestra alojamientos con datos completos — foto de portada, descripción, equipamiento y precio base deben estar registrados. Si faltan datos obligatorios, el alojamiento permanece invisible pese al interruptor activado.",
            },
            {
              type: "ul",
              items: [
                "Al menos una foto de portada y una descripción",
                "Características de equipamiento de la lista de categorías",
                "Ocupación y precio base en la moneda registrada del alojamiento",
                "Disponibilidad de calendario para el periodo deseado",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Al hacer clic en Publicar, myNextDays activa normalmente a la vez el marketplace, los portales y la web — después puede desactivar el interruptor del marketplace individualmente en cualquier momento.",
            },
            { type: "h2", text: "Retirar de nuevo la visibilidad" },
            {
              type: "p",
              text: "Si desactiva el interruptor Marketplace de la plataforma, el alojamiento desaparece de la búsqueda del marketplace. Las reservas ya confirmadas no se ven afectadas y siguen su curso con normalidad, vea [Comisión del marketplace](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Comisión del marketplace",
          excerpt: "Por cada reserva intermediada a través del marketplace se aplica la comisión registrada en la tarifa.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Como en cualquier portal de reservas, se aplica una comisión por las reservas realizadas a través del marketplace de myBestDays. Se calcula por reserva y es independiente de las comisiones que pudieran aplicar los portales.",
            },
            { type: "h2", text: "Cómo se calcula la comisión" },
            {
              type: "p",
              text: "El importe se rige por la comisión registrada en la tarifa de su negocio. Encontrará la tasa actual en cualquier momento en Cuenta, en la sección Facturación — ahí no se asume ningún valor genérico, sino que se muestra la tasa realmente vigente para su tarifa.",
            },
            { type: "h2", text: "Dónde consultar la comisión" },
            {
              type: "steps",
              items: [
                "Abra Cuenta en el menú.",
                "Vaya a la sección Facturación.",
                "Abra una reserva del marketplace para ver los ingresos y la comisión en detalle.",
                "Revise el resumen de comisiones del periodo de liquidación en curso.",
              ],
            },
            { type: "h2", text: "Diferencia con las comisiones de portales" },
            {
              type: "ul",
              items: [
                "La comisión del marketplace se aplica exclusivamente a reservas a través del marketplace de myBestDays.",
                "Las reservas de portales (Booking, Airbnb y otros) están sujetas a las condiciones del portal correspondiente.",
                "Las reservas de la web están sujetas a las condiciones registradas para su tarifa, sin comisión de marketplace.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "La comisión se determina automáticamente a partir de su tarifa. Una tarifa faltante o poco clara produce un mensaje de error claro en lugar de un valor estimado.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Perfil de huésped y reseñas",
          excerpt: "Los huéspedes del marketplace tienen un perfil con historial de reservas y pueden dejar reseñas.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Los huéspedes que reservan a través del marketplace de myBestDays crean un perfil de huésped propio. En él se acumulan sus reservas, los mensajes con los negocios y las reseñas realizadas — de forma similar a una cuenta de huésped de un portal.",
            },
            { type: "h2", text: "Lo que usted ve como negocio" },
            {
              type: "p",
              text: "En los detalles de la reserva de una reserva del marketplace encontrará el perfil del huésped con las estancias anteriores en su negocio y, si el huésped lo ha autorizado, reseñas visibles públicamente sobre otros alojamientos.",
            },
            { type: "h2", text: "Reseñas tras la estancia" },
            {
              type: "steps",
              items: [
                "Tras el check-out, el huésped recibe una solicitud para dejar una reseña.",
                "La reseña aparece en la página del alojamiento del marketplace tras una breve revisión.",
                "Como negocio, puede responder públicamente a cada reseña.",
                "Las reseñas ofensivas o abusivas pueden enviarse a revisión mediante la función de denuncia.",
              ],
            },
            {
              type: "ul",
              items: [
                "Las reseñas están vinculadas a una reserva real — ninguna reseña sin estancia.",
                "El huésped valora la limpieza, la comunicación, la ubicación y la relación calidad-precio.",
                "Su respuesta es visible para todos los visitantes del marketplace.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Las buenas reseñas influyen directamente en la posición de su alojamiento en la búsqueda del marketplace — responda a las críticas con rapidez y de forma objetiva.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Personas bloqueadas",
          excerpt: "Un negocio puede bloquear a un huésped, impidiendo mensajes y reservas.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Si surgen problemas con un huésped, puede bloquearlo como negocio. Una persona bloqueada ya no podrá enviarle mensajes ni crear una nueva reserva con su negocio.",
            },
            { type: "h2", text: "Bloquear a una persona" },
            {
              type: "steps",
              items: [
                "Abra el historial de mensajes o la reserva con el huésped en cuestión.",
                "Haga clic en Bloquear huésped.",
                "Confirme el diálogo — el bloqueo se aplica de inmediato.",
                "La persona bloqueada aparece después en Cuenta, en Personas bloqueadas.",
              ],
            },
            { type: "h2", text: "Qué provoca el bloqueo" },
            {
              type: "ul",
              items: [
                "El huésped ya no puede enviar nuevos mensajes a su negocio.",
                "El huésped ya no puede crear una nueva reserva con su negocio.",
                "Una reserva en curso con una llegada ya confirmada dentro de las próximas dos semanas no se ve afectada por el bloqueo, para que la estancia pueda gestionarse con normalidad.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "El bloqueo se aplica exclusivamente a su negocio. Otros negocios del marketplace no ven el bloqueo y no se ven afectados por él.",
            },
            { type: "h2", text: "Levantar de nuevo el bloqueo" },
            {
              type: "p",
              text: "Abra Cuenta y ahí Personas bloqueadas. Seleccione la entrada y haga clic en Levantar bloqueo — el huésped podrá volver a enviar mensajes y reservar.",
            },
          ],
        },
      ],
    },
  ],
};
