import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Reservas y bookings",
  description: "Gestione, traslade y cancele reservas.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Reservas",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Registrar una reserva manualmente",
          excerpt:
            "Así registra directamente en myNextDays una reserva recibida por teléfono o correo electrónico.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Cuándo registrar manualmente" },
            {
              type: "p",
              text: "No todas las reservas llegan a través de un portal o de su propia plataforma — las solicitudes por teléfono, correo electrónico o en persona debe crearlas usted mismo, para que el alojamiento quede correctamente bloqueado en myNextDays y no se produzca una doble ocupación.",
            },
            {
              type: "steps",
              items: [
                "Abra Reservas y haga clic en «Nueva reserva».",
                "Elija el alojamiento — cada alojamiento en myNextDays es una unidad reservable individual, es decir, una habitación o alojamiento vacacional concreto.",
                "Fije la llegada y la salida, así como el número de huéspedes.",
                "Registre los datos del huésped (nombre, contacto, dirección de facturación si procede).",
                "Compruebe el precio propuesto y ajústelo si es necesario.",
                "Guarde la reserva — las noches se bloquean de inmediato en el calendario.",
              ],
            },
            { type: "h2", text: "Pago y confirmación" },
            {
              type: "p",
              text: "Tras guardar, se aplican las mismas reglas de pago que en las reservas en línea. Si hay un proveedor de pago conectado, puede enviar directamente un enlace de pago al huésped o marcar el pago manualmente como recibido.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Registre de inmediato en las notas los deseos especiales (llegada anticipada, camas adicionales) — el equipo los verá en la línea de tiempo de la reserva.",
            },
            { type: "h2", text: "Después de crearla" },
            {
              type: "p",
              text: "La nueva reserva aparece de inmediato en [La línea de tiempo de la reserva](/hilfe/reservierungen/buchungs-zeitleiste) con todos los pasos siguientes, como mensajes, tareas y pagos, en un solo lugar.",
            },
            {
              type: "ul",
              items: [
                "El calendario y los portales se sincronizan automáticamente en cuanto guarda.",
                "El huésped recibe, si procede, un mensaje de confirmación automático.",
                "Los cambios de fecha se registran mediante «Trasladar reserva».",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "La línea de tiempo de la reserva",
          excerpt:
            "La línea de tiempo de la reserva agrupa todo el proceso de una reserva en un solo lugar.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Qué muestra la línea de tiempo" },
            {
              type: "p",
              text: "Cada reserva tiene su propia línea de tiempo, que representa cronológicamente todo el proceso — desde la solicitud de reserva o la importación del portal hasta el check-out. Así ve de un vistazo lo que ya ha pasado y lo que viene a continuación.",
            },
            {
              type: "ul",
              items: [
                "Mensajes con el huésped",
                "Tareas, por ejemplo limpieza o preparación",
                "Pagos y facturas",
                "Add-ons y servicios adicionales reservados",
                "Traslados (move) y cancelaciones",
              ],
            },
            { type: "h2", text: "Usar la línea de tiempo en el día a día" },
            {
              type: "steps",
              items: [
                "Abra Reservas y elija la reserva deseada.",
                "Vaya a la pestaña «Línea de tiempo».",
                "Desplácese cronológicamente por todos los eventos.",
                "Use las acciones rápidas para enviar directamente un mensaje o crear una tarea.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Si una reserva se traslada o se cancela, este paso también aparece en la línea de tiempo, incluidas las noches liberadas en el calendario.",
            },
            { type: "h2", text: "Por qué es importante" },
            {
              type: "p",
              text: "Como el equipo, los propietarios y el soporte ven la misma línea de tiempo, no se producen lagunas de información entre mensajes, tareas y pagos. Detalles sobre reembolsos en [Reembolsos](/hilfe/zahlungen/rueckerstattungen), sobre servicios adicionales en [Add-ons y servicios adicionales](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Trasladar una reserva",
          excerpt:
            "Así traslada una reserva existente a un nuevo periodo sin desordenar el calendario.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Comprobar antes de trasladar" },
            {
              type: "p",
              text: "Antes de trasladar una reserva, compruebe la disponibilidad en el nuevo periodo para el alojamiento reservado. myNextDays libera las noches originalmente reservadas solo cuando el nuevo periodo está confirmado — así no se produce ningún hueco en el que el alojamiento aparezca erróneamente como libre o doblemente ocupado.",
            },
            {
              type: "steps",
              items: [
                "Abra la reserva en Reservas.",
                "Elija «Trasladar» e introduzca el nuevo periodo.",
                "Compruebe la disponibilidad mostrada para las nuevas fechas.",
                "Confirme el traslado.",
                "Compruebe si el nuevo número de noches cambia el precio y ajústelo si es necesario.",
              ],
            },
            { type: "h2", text: "Qué ocurre automáticamente" },
            {
              type: "p",
              text: "Tras la confirmación, las noches antiguas se liberan correctamente en el calendario y las nuevas se bloquean; los portales conectados se actualizan. El proceso queda registrado en la línea de tiempo de la reserva.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Si la reserva se recibió a través de un portal, un traslado puede estar sujeto allí a reglas propias — compruebe las políticas del portal antes de realizar cambios importantes.",
            },
            { type: "h2", text: "Diferencias de pago" },
            {
              type: "p",
              text: "Si el precio cambia debido al traslado, ajuste las reglas de pago correspondientes — vea [Reglas de pago](/hilfe/zahlungen/zahlungsregeln). Más información sobre el proceso completo de una reserva en [La línea de tiempo de la reserva](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Cancelación y reembolso",
          excerpt:
            "Así cancela correctamente una reserva y, si es necesario, activa un reembolso.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Cancelar una reserva" },
            {
              type: "p",
              text: "Una cancelación libera de inmediato el alojamiento para el periodo reservado — tanto en su calendario como en todos los portales conectados. Compruebe antes de cancelar qué condiciones de cancelación se aplican a esta reserva.",
            },
            {
              type: "steps",
              items: [
                "Abra la reserva en Reservas.",
                "Elija «Cancelar» e indique un motivo.",
                "Compruebe el importe de reembolso propuesto.",
                "Confirme la cancelación.",
              ],
            },
            { type: "h2", text: "Activar un reembolso" },
            {
              type: "p",
              text: "Si el pago se gestionó a través de un proveedor de pago conectado, puede iniciar el reembolso directamente desde la reserva. El importe se muestra en la moneda registrada para ese alojamiento. Detalles del proceso en [Reembolsos](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Reembolso total o parcial posible",
                "El proceso aparece en la línea de tiempo de la reserva",
                "En las reservas de portal se aplican además las reglas del portal correspondiente",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Una cancelación no se puede deshacer. Revise cuidadosamente el periodo y el huésped antes de confirmar.",
            },
            { type: "h2", text: "Después de la cancelación" },
            {
              type: "p",
              text: "El alojamiento vuelve a ser reservable de inmediato; las tareas abiertas relacionadas con la reserva —por ejemplo, la preparación— se marcan automáticamente como ya no necesarias. Todo el proceso permanece rastreable en la [línea de tiempo de la reserva](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Check-in y check-out",
          excerpt: "Así documenta la llegada y la salida de un huésped en myNextDays.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Registrar el check-in" },
            {
              type: "p",
              text: "El check-in marca el inicio de la estancia y resulta especialmente útil en el check-in autónomo o en la entrega de llaves por parte del equipo, para mantener actualizado el estado de cada reserva.",
            },
            {
              type: "steps",
              items: [
                "Abra la reserva en Reservas.",
                "Elija «Check-in» el día de llegada.",
                "Registre si es necesario una nota, por ejemplo la hora o particularidades.",
              ],
            },
            { type: "h2", text: "Check-out y entrega" },
            {
              type: "p",
              text: "En el check-out marca la estancia como finalizada. Esto activa en muchos casos automáticamente una tarea de limpieza para el alojamiento, para que quede preparado para la siguiente reserva.",
            },
            {
              type: "ul",
              items: [
                "Check-in y check-out forman parte de la línea de tiempo de la reserva",
                "Los horarios pueden definirse por alojamiento en la configuración del alojamiento",
                "Con acceso móvil, el equipo puede registrar el check-in y el check-out directamente in situ",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Un check-out olvidado no bloquea automáticamente las tareas siguientes — revise regularmente los estados pendientes en Reservas.",
            },
            { type: "h2", text: "Relación con las tareas" },
            {
              type: "p",
              text: "El check-in y el check-out están estrechamente vinculados a las tareas y a la línea de tiempo. Más información sobre el proceso completo en [La línea de tiempo de la reserva](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Add-ons y servicios adicionales",
          excerpt:
            "Así ofrece a los huéspedes servicios adicionales reservables, como desayuno o traslado, y los registra en la reserva.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Qué son los add-ons" },
            {
              type: "p",
              text: "Los add-ons son servicios adicionales opcionales para una reserva — por ejemplo, desayuno, llegada anticipada, traslado o salida tardía. Se registran por alojamiento y pueden añadirse a la reserva por el propio huésped o por su equipo.",
            },
            {
              type: "steps",
              items: [
                "Abra el alojamiento y cree en «Add-ons» los servicios adicionales deseados con su precio.",
                "Abra una reserva existente en Reservas.",
                "Elija «Añadir add-on» y seleccione el servicio deseado.",
                "Confirme la cantidad y el momento del servicio.",
              ],
            },
            { type: "h2", text: "Facturación" },
            {
              type: "p",
              text: "Los add-ons se facturan en la moneda del alojamiento correspondiente y aparecen como una partida propia en la factura. Los add-ons ya pagados pueden reembolsarse proporcionalmente en caso de cancelación.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Registre los add-ons populares una vez de forma centralizada en el alojamiento — así podrá añadirlos con pocos clics en cada nueva reserva.",
            },
            { type: "h2", text: "Visibilidad para el huésped" },
            {
              type: "p",
              text: "Si la plataforma o su propia web están activas, los huéspedes a menudo pueden seleccionar los add-ons adecuados ya durante la propia reserva. Cada adición aparece después en la [línea de tiempo de la reserva](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Los add-ons pueden nombrarse y ponerse precio de forma individual por alojamiento",
                "Añadirlos a posteriori es posible en cualquier momento desde la reserva",
                "Los add-ons cancelados se reembolsan proporcionalmente",
              ],
            },
          ],
        },
      ],
    },
  ],
};
