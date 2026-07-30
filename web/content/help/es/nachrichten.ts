import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Mensajes y huéspedes",
  description: "Bandeja de entrada, plantillas y comunicación con huéspedes.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Comunicación",
      articles: [
        {
          slug: "posteingang",
          title: "La bandeja de entrada de la plataforma",
          excerpt: "Todos los mensajes de huéspedes de sus alojamientos confluyen de forma centralizada en la bandeja de entrada de la plataforma.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Una bandeja de entrada para todos los alojamientos" },
            {
              type: "p",
              text: "La bandeja de entrada de la plataforma reúne en un solo lugar todos los mensajes de sus huéspedes, independientemente del alojamiento o del periodo al que se refiera la conversación. La abre en /nachrichten y allí ve cada conversación como un hilo propio.",
            },
            { type: "h2", text: "Estructura de la bandeja de entrada" },
            {
              type: "ul",
              items: [
                "Columna izquierda: lista de todas las conversaciones, las más recientes primero",
                "Columna central: el historial de mensajes activo con el huésped",
                "Columna derecha: contexto de la reserva — periodo, alojamiento, datos del huésped",
              ],
            },
            { type: "h2", text: "Responder a un mensaje" },
            {
              type: "steps",
              items: [
                "Abra /nachrichten y seleccione la conversación deseada",
                "Escriba su respuesta en el campo de texto o use una respuesta rápida",
                "Envíe el mensaje — el huésped lo recibe por el mismo medio por el que escribió",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La bandeja de entrada de la plataforma muestra exclusivamente la comunicación directa entre usted y sus huéspedes en myNextDays — los mensajes de los portales se siguen gestionando ahí.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Respuestas rápidas",
          excerpt: "Las plantillas para preguntas frecuentes ahorran tiempo en el contacto con los huéspedes.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Qué son las respuestas rápidas" },
            {
              type: "p",
              text: "Las respuestas rápidas son fragmentos de texto preformulados para preguntas recurrentes — sobre la llegada, la contraseña del wifi o la situación del aparcamiento, por ejemplo. En lugar de escribir cada respuesta de nuevo, inserta la plantilla adecuada con un clic en la [bandeja de entrada de la plataforma](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Crear una respuesta rápida" },
            {
              type: "steps",
              items: [
                "Abra /nachrichten y haga clic en «Gestionar respuestas rápidas»",
                "Haga clic en «Nueva plantilla» y asigne un título, por ejemplo «Información de check-in»",
                "Escriba el texto de respuesta; marcadores de posición como el nombre del huésped o la fecha de llegada se rellenan automáticamente al enviar",
                "Guarde la plantilla — estará disponible de inmediato en cada conversación",
              ],
            },
            { type: "h2", text: "Usar las respuestas rápidas en el día a día" },
            {
              type: "p",
              text: "En la ventana de mensajes abre la lista de plantillas mediante el icono del rayo, elige la respuesta adecuada y la adapta de forma individual si es necesario antes de enviarla.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Cree plantillas para las cinco o diez preguntas más frecuentes — en la práctica esto cubre la mayor parte de los mensajes recibidos.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Mensajes automáticos",
          excerpt: "Las confirmaciones, la información de check-in y los recordatorios pueden enviarse automáticamente a los huéspedes.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Automatizar mensajes recurrentes" },
            {
              type: "p",
              text: "En lugar de enviar manualmente confirmaciones de reserva, avisos de check-in o mensajes de agradecimiento, los configura una sola vez como regla — myNextDays los envía entonces automáticamente en el momento adecuado antes, durante o después de la estancia.",
            },
            { type: "h2", text: "Disparadores típicos para mensajes automáticos" },
            {
              type: "ul",
              items: [
                "Justo después de la reserva — confirmación con los datos más importantes",
                "Pocos días antes de la llegada — información de check-in y código de acceso",
                "El día de salida — agradecimiento y solicitud de una reseña",
              ],
            },
            { type: "h2", text: "Configurar un mensaje automático" },
            {
              type: "steps",
              items: [
                "Abra /nachrichten, sección «Mensajes automáticos»",
                "Elija el disparador, por ejemplo «X días antes de la llegada»",
                "Registre el texto — marcadores de posición como nombre del huésped, alojamiento o fecha de llegada se rellenan automáticamente",
                "Active la regla; se aplica a todos los alojamientos, salvo que se restrinja de otro modo",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Los mensajes automáticos aparecen con normalidad en la [bandeja de entrada de la plataforma](/hilfe/nachrichten/posteingang) y pueden consultarse allí en cualquier momento con posterioridad.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Bloquear mensajes",
          excerpt: "Puede bloquear a una persona directamente desde el historial de mensajes para futuros contactos.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Cuándo tiene sentido un bloqueo" },
            {
              type: "p",
              text: "Ante mensajes ofensivos, acoso o un comportamiento reiteradamente inapropiado, puede bloquear a una persona directamente desde el hilo de mensajes. Una persona bloqueada ya no podrá escribirle nuevos mensajes ni crear una nueva reserva con usted.",
            },
            { type: "h2", text: "Bloquear a una persona desde el hilo" },
            {
              type: "steps",
              items: [
                "Abra la conversación afectada en la [bandeja de entrada de la plataforma](/hilfe/nachrichten/posteingang)",
                "Haga clic en el menú en la parte superior del hilo y elija «Bloquear persona»",
                "Confirme la operación — el bloqueo se aplica de inmediato",
              ],
            },
            { type: "h2", text: "Qué significa el bloqueo — y qué no" },
            {
              type: "ul",
              items: [
                "Los nuevos mensajes de la persona bloqueada ya no se entregan",
                "Las nuevas solicitudes de reserva de la persona se rechazan",
                "Si actualmente hay una reserva en curso de esa persona, la comunicación sigue siendo posible excepcionalmente durante la estancia",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Un bloqueo puede levantarse en cualquier momento desde el resumen «Personas bloqueadas» en la cuenta. Compruebe antes de bloquear si ya existe una reserva en curso.",
            },
          ],
        },
      ],
    },
  ],
};
