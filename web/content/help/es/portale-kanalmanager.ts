import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portales y gestor de canales",
  description: "Controle Booking, Airbnb, Expedia y otros de forma centralizada.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Conectar portales",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "¿Qué es el gestor de canales?",
          excerpt:
            "El gestor de canales sincroniza automáticamente precios, disponibilidad y reservas entre myNextDays y los portales.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Una conexión para todos los portales" },
            {
              type: "p",
              text: "El gestor de canales es el puente entre myNextDays y los grandes portales de reserva como Booking, Airbnb y otros. En lugar de mantener precios, disponibilidad y ocupación por separado en cada portal, lo introduce todo una vez en myNextDays — el gestor de canales lo distribuye automáticamente a todos los portales conectados.",
            },
            { type: "h2", text: "Qué se sincroniza automáticamente" },
            {
              type: "ul",
              items: [
                "Disponibilidad — cada reserva bloquea la noche de inmediato en todos los portales",
                "Precios y estancias mínimas de su calendario de precios",
                "Las reservas entrantes de los portales se importan automáticamente en myNextDays",
                "Las cancelaciones y Stop-Sell actúan de forma transversal entre canales",
              ],
            },
            { type: "h2", text: "Lo que ya no tiene que hacer manualmente" },
            {
              type: "p",
              text: "Sin gestor de canales tendría que bloquear a mano la noche en cada portal tras cada reserva — una causa frecuente de reservas duplicadas. Con el gestor de canales activo, myNextDays realiza esta sincronización en ambas direcciones, varias veces al día y en tiempo real ante nuevas reservas.",
            },
            {
              type: "note",
              variant: "info",
              text: "La conexión con los portales se configura una sola vez para toda la cuenta. Para cada alojamiento individual solo activa después el mapeo — más información en [Asignar un alojamiento a un portal](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Configurar la conexión con portales",
          excerpt:
            "Configura la conexión con los portales una sola vez para toda la cuenta — no para cada alojamiento de nuevo.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Una sola vez para toda la cuenta" },
            {
              type: "p",
              text: "La conexión con los portales es una configuración de toda la cuenta: conecta su cuenta de myNextDays exactamente una vez con el gestor de canales. Todos los alojamientos que cree posteriormente recurren automáticamente a esta única conexión — no tiene que volver a establecerla para cada alojamiento.",
            },
            { type: "h2", text: "Así configura la conexión" },
            {
              type: "steps",
              items: [
                "Abra /konto y elija la sección «Portales y gestor de canales»",
                "Haga clic en «Configurar conexión» y confirme los datos de su negocio (dirección, contacto, forma jurídica)",
                "Compruebe los datos maestros importados automáticamente — se transmiten a todos los portales",
                "Complete la configuración; el estado pasa a «Conectado»",
              ],
            },
            { type: "h2", text: "Siguiente paso: asignar alojamientos" },
            {
              type: "p",
              text: "Tras la configuración única, todavía ningún alojamiento es visible — para ello asigna cada alojamiento individualmente a un portal (mapeo) y conecta los portales deseados, como Booking.com o Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Sin datos maestros completos (dirección, información fiscal, contacto), los portales rechazan la conexión. Compruebe primero estos datos en /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Asignar un alojamiento a un portal",
          excerpt:
            "Tras la conexión de toda la cuenta, solo activa por alojamiento el mapeo con el portal correspondiente.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Mapeo en lugar de una nueva conexión" },
            {
              type: "p",
              text: "Una vez configurada la conexión de portales para toda la cuenta, conecta cada alojamiento únicamente mediante un llamado mapeo: determina qué alojamiento de myNextDays corresponde a qué tipo de habitación u oferta en el portal. Es un paso único por alojamiento.",
            },
            { type: "h2", text: "Así asigna un alojamiento" },
            {
              type: "steps",
              items: [
                "Abra el alojamiento en /objekte y vaya a la pestaña «Portales»",
                "Elija el portal deseado, por ejemplo Booking.com o Airbnb",
                "Asigne el alojamiento al tipo de habitación u oferta correspondiente del portal",
                "Active la sincronización — a partir de ahora se transmiten precios y disponibilidad",
              ],
            },
            { type: "h2", text: "Un alojamiento, varios portales" },
            {
              type: "p",
              text: "Un solo alojamiento puede estar asignado simultáneamente a varios portales. Cada asignación es independiente — puede, por ejemplo, hacer visible un alojamiento en Booking.com y Airbnb, pero dejarlo desactivado por ahora en Expedia.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Tras el mapeo, compruebe directamente la visibilidad — vea [Visibilidad por portal](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Conectar Booking.com",
          excerpt: "Así habilita Booking.com como canal de venta para un alojamiento.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Requisito: conexión de toda la cuenta" },
            {
              type: "p",
              text: "Antes de activar Booking.com para un alojamiento, debe estar configurada la conexión de portales de toda la cuenta (vea [Configurar la conexión con portales](/hilfe/portale-kanalmanager/portal-verbindung)). Después, Booking.com solo es cuestión de mapeo para cada alojamiento adicional.",
            },
            { type: "h2", text: "Activar Booking.com" },
            {
              type: "steps",
              items: [
                "Abra el alojamiento en /objekte, pestaña «Portales»",
                "Elija «Booking.com» de la lista de portales disponibles",
                "Asigne el tipo de habitación u oferta correspondiente y confirme los planes de tarifas",
                "Active la visibilidad — el alojamiento se pone en marcha tras la revisión de Booking.com",
              ],
            },
            { type: "h2", text: "Qué espera Booking.com de usted" },
            {
              type: "ul",
              items: [
                "Descripción completa del alojamiento, imágenes y equipamiento",
                "Al menos una tarifa con precio y condiciones de cancelación",
                "Un método de pago válido para las comisiones",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La habilitación por parte de Booking.com puede tardar algunas horas. El estado en la pestaña «Portales» del alojamiento muestra si la conexión ya está activa.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Conectar Airbnb",
          excerpt: "Así hace reservable un alojamiento en Airbnb a través del gestor de canales.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Airbnb como otro portal más" },
            {
              type: "p",
              text: "Airbnb se conecta como cualquier otro portal a través de la conexión de toda la cuenta. Una vez configurada, activa Airbnb por alojamiento mediante el mapeo — independientemente de si el alojamiento ya es visible en Booking.com u otros portales.",
            },
            { type: "h2", text: "Activar Airbnb para un alojamiento" },
            {
              type: "steps",
              items: [
                "Abra el alojamiento en /objekte, pestaña «Portales»",
                "Elija «Airbnb» de la lista de portales disponibles",
                "Confirme la categoría del alojamiento y el tipo de oferta asignado",
                "Compruebe fotos, equipamiento y normas de la casa — Airbnb exige datos completos antes de la habilitación",
                "Active la visibilidad para Airbnb",
              ],
            },
            { type: "h2", text: "Después de la activación" },
            {
              type: "p",
              text: "En cuanto Airbnb haya aprobado el alojamiento, precios y disponibilidad se gestionan automáticamente a través del gestor de canales. Las reservas que entren por Airbnb aparecerán entonces automáticamente en su calendario de reservas.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Sin condiciones de cancelación ni normas de la casa registradas, Airbnb rechaza la habilitación. Complete primero estos datos en el alojamiento.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Sincronizar precios y disponibilidad",
          excerpt:
            "Los precios y la disponibilidad se transmiten automáticamente a todos los portales conectados.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Un calendario, todos los portales" },
            {
              type: "p",
              text: "Mantiene precios y disponibilidad exclusivamente en el calendario de myNextDays del alojamiento correspondiente. El gestor de canales transmite automáticamente cada cambio a todos los portales para los que el alojamiento tenga mapeo activo — sin que tenga que introducir nada por duplicado.",
            },
            { type: "h2", text: "Qué se transmite" },
            {
              type: "ul",
              items: [
                "Precios diarios de su calendario de precios o de los planes de tarifas",
                "Noches disponibles y bloqueos",
                "Estancia mínima y restricciones de entrada/salida",
                "Días con Stop-Sell — estos se bloquean automáticamente en todos los portales",
              ],
            },
            { type: "h2", text: "Con qué rapidez actúa la sincronización" },
            {
              type: "p",
              text: "Los cambios de precios y disponibilidad se transmiten a los portales en pocos minutos. Las nuevas reservas bloquean de inmediato las noches afectadas, para que en ningún otro canal se pueda volver a vender la misma noche.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Más información sobre el bloqueo transversal de días concretos en [Evitar el overbooking](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Recibir reservas de portales",
          excerpt: "Las reservas de Booking, Airbnb y otros llegan automáticamente a su calendario.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Importación automática" },
            {
              type: "p",
              text: "Si un huésped reserva a través de un portal como Booking.com o Airbnb, el gestor de canales importa automáticamente la reserva a myNextDays. No tiene que transmitir nada manualmente — la reserva aparece en el calendario y en la lista de reservas del alojamiento afectado.",
            },
            { type: "h2", text: "Qué ocurre con una reserva de portal" },
            {
              type: "steps",
              items: [
                "El portal notifica la nueva reserva al gestor de canales",
                "myNextDays crea la reserva con los datos del huésped, el periodo y el precio",
                "Las noches reservadas se bloquean de inmediato en todos los demás canales",
                "Usted recibe una notificación y encuentra la reserva en el calendario",
              ],
            },
            { type: "h2", text: "Cancelaciones y cambios" },
            {
              type: "p",
              text: "Si un huésped cancela a través del portal o cambia el periodo, esto también se transmite automáticamente a myNextDays y las noches afectadas se vuelven a liberar.",
            },
            {
              type: "note",
              variant: "info",
              text: "Las reservas de portal se reconocen en los detalles de la reserva por su distintivo de origen, por ejemplo Booking.com o Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Evitar el overbooking",
          excerpt: "Stop-Sell y los bloqueos automáticos evitan reservas duplicadas entre varios portales.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Por qué se produce el overbooking" },
            {
              type: "p",
              text: "Sin un control centralizado, es fácil que la misma noche se venda simultáneamente en dos portales — por ejemplo, cuando los precios y la disponibilidad se mantienen manualmente en varios sistemas. El gestor de canales cierra esta brecha, ya que cada reserva en cada canal bloquea de inmediato todos los demás canales.",
            },
            { type: "h2", text: "Sus herramientas contra el overbooking" },
            {
              type: "ul",
              items: [
                "Bloqueo automático: cada nueva reserva, sin importar en qué canal, bloquea las noches en todas partes",
                "Stop-Sell: bloquea un día manualmente en todos los canales a la vez, por ejemplo para uso propio o mantenimiento",
                "La estancia mínima y las restricciones de llegada evitan reservas cortas inadecuadas",
              ],
            },
            { type: "h2", text: "Activar Stop-Sell" },
            {
              type: "steps",
              items: [
                "Abra el calendario de ocupación del alojamiento",
                "Marque el día o el periodo afectado",
                "Elija «Stop-Sell» — el día quedará bloqueado en todos los portales, así como en la web y la plataforma",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell se aplica sin excepción a todos los canales. No existe la posibilidad de bloquear un día solo para un portal concreto y dejarlo abierto para los demás.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Visibilidad por portal",
          excerpt: "Cada portal puede activarse o desactivarse de forma independiente de la web y del marketplace de la plataforma.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Tres vías de venta independientes" },
            {
              type: "p",
              text: "Un alojamiento puede venderse simultáneamente por varias vías: a través de los portales (Booking, Airbnb y otros), a través del marketplace de la plataforma de myNextDays y a través de su propia web. Cada vía tiene un interruptor de visibilidad propio — son totalmente independientes entre sí.",
            },
            { type: "h2", text: "Controlar la visibilidad por portal" },
            {
              type: "p",
              text: "Dentro de los portales, además, cada portal individual puede activarse o desactivarse por separado. Un alojamiento puede, por ejemplo, estar activo en Booking.com pero desactivado en Airbnb — ambas asignaciones permanecen sin verse afectadas.",
            },
            { type: "h2", text: "Así cambia la visibilidad" },
            {
              type: "steps",
              items: [
                "Abra el alojamiento en /objekte, pestaña «Portales»",
                "Active o desactive individualmente el canal deseado (portal concreto, web o marketplace de la plataforma)",
                "Guarde — el cambio surte efecto en pocos minutos",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "El estado del alojamiento (activo/inactivo) y Stop-Sell actúan de forma superior sobre todos los canales. Los interruptores de visibilidad solo controlan en qué canales adicionales aparece un alojamiento ya activo.",
            },
          ],
        },
      ],
    },
  ],
};
