import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Gestor de canales",
  description: "Dominar los portales y el gestor de canales.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Gestor de canales",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Conectar su primer portal",
          excerpt: "Así activa por primera vez un portal para un alojamiento.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida: ha creado un alojamiento, pero aún no ha conectado ningún portal",
            },
            {
              type: "p",
              text: "Su alojamiento está completamente configurado en myNextDays, pero todavía no es visible en ningún portal como Booking.com o Airbnb. Antes de que un portal acepte un alojamiento, su cuenta necesita una única conexión con el portal a nivel de cuenta; después, para cada alojamiento adicional basta con una asignación (mapping).",
            },
            {
              type: "steps",
              items: [
                "Abra /konto, sección “Portales y gestor de canales”, y configure la conexión a nivel de cuenta con los datos de su negocio",
                "A continuación, abra el alojamiento en /objekte y vaya a la pestaña “Portales”",
                "Seleccione el portal deseado y asígnelo al tipo de habitación o de oferta correspondiente",
                "Revise las fotos, el equipamiento, los precios y las condiciones de cancelación; los portales exigen información completa",
                "Active la visibilidad; el estado cambiará a “Conectado” tras la revisión del portal",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La conexión a nivel de cuenta solo se configura una vez. Más detalles en [Conectar Booking.com](/hilfe/portale-kanalmanager/booking-verbinden) y [Conectar Airbnb](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Conectar Booking.com",
          excerpt: "Así hace reservable un alojamiento en Booking.com a través del gestor de canales.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida: quiere que su alojamiento también sea visible en Booking.com",
            },
            {
              type: "p",
              text: "Booking.com es uno de los portales que se conectan a través del gestor de canales. El requisito es la conexión con el portal a nivel de cuenta; si ya está configurada, solo necesita una asignación (mapping) por alojamiento para Booking.com.",
            },
            {
              type: "steps",
              items: [
                "Abra el alojamiento en /objekte, pestaña “Portales”",
                "Seleccione “Booking.com” en la lista de portales disponibles",
                "Asigne el tipo de habitación o de oferta correspondiente y confirme al menos una tarifa con precio y condiciones de cancelación",
                "Registre un método de pago válido para la liquidación de comisiones",
                "Active la visibilidad para Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La activación por parte de Booking.com puede tardar algunas horas. El estado en la pestaña “Portales” lo indicará en cuanto la conexión esté activa.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Conectar Airbnb",
          excerpt: "Así hace reservable un alojamiento en Airbnb a través del gestor de canales.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida: quiere que su alojamiento también sea visible en Airbnb",
            },
            {
              type: "p",
              text: "Airbnb se conecta, como cualquier otro portal, a través de la conexión a nivel de cuenta. Una vez configurada, active Airbnb por alojamiento mediante una asignación (mapping), independientemente de que el alojamiento ya sea visible en Booking.com u otros portales.",
            },
            {
              type: "steps",
              items: [
                "Abra el alojamiento en /objekte, pestaña “Portales”",
                "Seleccione “Airbnb” en la lista de portales disponibles",
                "Confirme la categoría del alojamiento y el tipo de oferta asignado",
                "Complete las fotos, el equipamiento y las normas de la casa; Airbnb exige información completa antes de la activación",
                "Active la visibilidad para Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Sin condiciones de cancelación y normas de la casa registradas, Airbnb rechazará la activación. Complete primero estos datos en el alojamiento.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Mantener los precios sincronizados en todos los portales",
          excerpt: "Con un solo calendario basta: el gestor de canales distribuye automáticamente los cambios de precio a todos los portales.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida: cambia un precio y quiere asegurarse de que sea correcto en todas partes",
            },
            {
              type: "p",
              text: "Los precios se gestionan exclusivamente en el calendario de myNextDays del alojamiento, nunca de forma individual en los propios portales. El gestor de canales transmite automáticamente cada cambio a todos los portales en los que el alojamiento tiene una asignación activa.",
            },
            {
              type: "steps",
              items: [
                "Abra el calendario de precios o los planes de tarifas del alojamiento",
                "Ajuste el precio diario, la estancia mínima o las restricciones de entrada/salida",
                "Guarde el cambio; primero se aplica internamente en el alojamiento",
                "Compruebe en la pestaña “Portales” que todos los portales deseados siguen teniendo una asignación activa",
                "Espere unos minutos hasta que el cambio se transmita a los portales",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Nunca introduzca precios directamente en el portal: esos cambios se sobrescribirán en la siguiente sincronización con el calendario de myNextDays.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Importar una reserva de un portal",
          excerpt: "Las reservas de los portales llegan automáticamente al calendario; aquí comprueba que la importación se ha realizado correctamente.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida: un huésped ha reservado a través de un portal y la reserva debe llegar a myNextDays",
            },
            {
              type: "p",
              text: "Cuando un huésped reserva a través de Booking.com, Airbnb u otro portal conectado, el gestor de canales importa la reserva automáticamente; no es necesario transferir nada manualmente. Este proceso describe cómo comprobar y confirmar la importación.",
            },
            {
              type: "steps",
              items: [
                "Abra el calendario o la lista de reservas del alojamiento correspondiente",
                "Busque la nueva reserva; lleva una etiqueta de origen del portal, por ejemplo Booking.com o Airbnb",
                "Compruebe que los datos del huésped, el periodo y el precio estén completos",
                "Compruebe que las noches reservadas aparecen bloqueadas en todos los demás canales",
                "Abra los detalles de la reserva si es necesario para gestionar servicios adicionales o mensajes del huésped",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Si el huésped cancela a través del portal o modifica el periodo, este cambio también se aplica automáticamente y las noches se vuelven a liberar.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Resolver una reserva duplicada",
          excerpt: "Así debe proceder si, excepcionalmente, la misma noche se ha vendido en dos canales.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida: dos reservas se solapan para el mismo alojamiento y las mismas noches",
            },
            {
              type: "p",
              text: "El gestor de canales normalmente bloquea las noches reservadas de inmediato en todos los canales. Aun así, puede producirse una reserva duplicada, por ejemplo por reservas simultáneas en dos portales en el mismo instante o por una reserva creada manualmente que coincide con una reserva de un portal.",
            },
            {
              type: "steps",
              items: [
                "Abra el calendario del alojamiento e identifique las dos reservas que se solapan",
                "Compruebe el momento de la reserva y la etiqueta de origen de ambas reservas",
                "Contacte con el huésped que reservó en último lugar y ofrézcale un alojamiento alternativo o un periodo distinto",
                "Cancele la reserva que no se puede mantener en el portal correspondiente, no solo en myNextDays",
                "A continuación, active Stop-Sell para las noches afectadas hasta que el caso quede totalmente resuelto",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Cancele siempre una reserva de un portal a través del propio portal: una cancelación realizada solo en myNextDays libera la noche internamente, pero no informa de forma fiable al portal.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Pausar temporalmente un portal",
          excerpt: "Desactive la visibilidad de un portal concreto sin perder la asignación (mapping).",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida: un alojamiento no debe ser reservable temporalmente en un portal",
            },
            {
              type: "p",
              text: "La visibilidad se puede activar o desactivar de forma individual por portal, independientemente del sitio web y del mercado de la plataforma. Si, por ejemplo, quiere pausar Airbnb brevemente pero mantener Booking.com activo, desactive únicamente ese canal.",
            },
            {
              type: "steps",
              items: [
                "Abra el alojamiento en /objekte, pestaña “Portales”",
                "Busque la entrada del portal que desea pausar",
                "Desactive la visibilidad de este portal",
                "Guarde los cambios; el efecto se aplica en pocos minutos y el alojamiento desaparece de los resultados de búsqueda de ese portal",
                "Vuelva a activar la visibilidad en cuanto el alojamiento deba volver a ser reservable",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La asignación (mapping) se mantiene al pausar el portal; no será necesario volver a configurarla más adelante. Para bloquear por completo todos los canales, utilice en su lugar Stop-Sell.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Comprobar la asignación del alojamiento",
          excerpt: "Así comprueba si su alojamiento sigue correctamente asignado al tipo de oferta correcto en el portal.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida: los precios o la disponibilidad ya no coinciden entre un portal y myNextDays",
            },
            {
              type: "p",
              text: "Si lo que se muestra en el portal difiere de su calendario de myNextDays, la causa suele ser una asignación (mapping) incorrecta o interrumpida, es decir, el vínculo entre su alojamiento y el tipo de habitación o de oferta en el portal.",
            },
            {
              type: "steps",
              items: [
                "Abra el alojamiento en /objekte, pestaña “Portales”",
                "Compruebe el estado del portal correspondiente; debería mostrar “Conectado”, no “Error” ni “Pendiente”",
                "Compruebe si el tipo de habitación o de oferta asignado en el portal sigue correspondiéndose con el alojamiento real",
                "En caso de discrepancia: elimine la asignación y vuelva a crearla, y después reactive la visibilidad",
                "Tras la corrección, espere unos minutos y vuelva a comprobar los precios y la disponibilidad en el portal",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Un alojamiento puede estar asignado a varios portales al mismo tiempo; ante discrepancias, revise específicamente el portal afectado, no todos a la vez.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Tarifas distintas por portal",
          excerpt: "Cómo asignar a un portal un plan de tarifas propio sin afectar a los demás canales.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida: quiere ofrecer en un portal un precio distinto al de los demás canales",
            },
            {
              type: "p",
              text: "Los planes de tarifas se pueden asignar individualmente por portal, por ejemplo, un plan no reembolsable para un portal y uno flexible para otro. Los precios base se siguen gestionando de forma centralizada en el alojamiento; la asignación determina qué plan de tarifas va a cada portal.",
            },
            {
              type: "steps",
              items: [
                "Cree en el alojamiento el plan de tarifas adicional con las condiciones deseadas (precio, condiciones de cancelación, estancia mínima)",
                "Abra la pestaña “Portales” y seleccione el portal correspondiente",
                "Asigne en el mapping el nuevo plan de tarifas a ese portal",
                "Deje los demás portales sin cambios en su plan de tarifas anterior",
                "Guarde los cambios y compruebe al cabo de unos minutos la visualización de precios en el portal correspondiente",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Cada plan de tarifas se transmite de forma independiente: un cambio en un plan de tarifas no afecta a los portales asignados a otro plan distinto.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Resolver errores habituales de los portales",
          excerpt: "Causas habituales cuando un portal rechaza un alojamiento o la sincronización se bloquea.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida: el estado de un portal muestra un error o el alojamiento no se acepta",
            },
            {
              type: "p",
              text: "Los portales suelen rechazar una conexión por falta de datos maestros o por información incompleta del alojamiento. Revise las causas más habituales en orden antes de ponerse en contacto con el soporte.",
            },
            {
              type: "steps",
              items: [
                "Compruebe en /konto si la dirección, la información fiscal y los datos de contacto están completos",
                "Compruebe en el alojamiento si la descripción, las fotos, el equipamiento y al menos una tarifa están completos",
                "Compruebe si hay un método de pago válido registrado para las comisiones",
                "Abra la pestaña “Portales” y lea el mensaje de error exacto junto al portal correspondiente",
                "Solucione la carencia indicada y vuelva a activar la visibilidad",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Un error de un portal siempre afecta únicamente a ese portal: los demás canales siguen funcionando de forma independiente, siempre que cumplan sus propios requisitos.",
            },
          ],
        },
      ],
    },
  ],
};
