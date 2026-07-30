import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Tareas y limpieza",
  description: "Organice los planes de limpieza y las tareas del equipo.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Operativa",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Crear tareas",
          excerpt: "Así crea una nueva tarea para un alojamiento o un periodo.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Las tareas agrupan todo lo que hay que hacer en torno a un alojamiento — desde la limpieza tras el check-out hasta trabajos de mantenimiento o solicitudes de huéspedes. Cada tarea está vinculada exactamente a un alojamiento y puede asignarse a un miembro del equipo.",
            },
            { type: "h2", text: "Crear una nueva tarea" },
            {
              type: "steps",
              items: [
                "Abra la sección «Tareas» en el menú principal.",
                "Haga clic en «Nueva tarea».",
                "Seleccione el alojamiento afectado.",
                "Asigne un título y, opcionalmente, una descripción.",
                "Establezca la fecha y la hora de vencimiento.",
                "Guarde la tarea.",
              ],
            },
            { type: "h2", text: "Tipos de tarea" },
            {
              type: "p",
              text: "Además de las tareas libres, existen tareas generadas automáticamente por el sistema, como las limpiezas programadas automáticamente tras un check-out. Estas ya están vinculadas al alojamiento y a la franja horaria correspondiente, y solo falta asignarlas a un miembro del equipo.",
            },
            {
              type: "ul",
              items: [
                "Tarea manual: registrada libremente, p. ej. mantenimiento o petición especial.",
                "Tarea de limpieza automática: derivada de la fecha de check-out.",
                "Tarea recurrente: para controles o inspecciones periódicas.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Encontrará más información sobre la planificación automática en [Planes de limpieza](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Use títulos precisos — en la vista móvil, los miembros del equipo a menudo solo ven de un vistazo el título y el alojamiento.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Planes de limpieza",
          excerpt: "Deje que las limpiezas tras el check-out se planifiquen automáticamente.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Un plan de limpieza garantiza que tras cada check-out se cree automáticamente una tarea de limpieza para el alojamiento afectado, sin que tenga que hacer seguimiento de cada reserva individualmente. Esto reduce las entregas olvidadas y asegura un proceso fiable entre dos estancias.",
            },
            { type: "h2", text: "Activar la planificación automática" },
            {
              type: "steps",
              items: [
                "Abra el alojamiento y vaya a la pestaña «Limpieza».",
                "Active «Planificar automáticamente la limpieza tras el check-out».",
                "Establezca cuánto tiempo se reserva para la limpieza después del check-out.",
                "Determine opcionalmente un equipo o una persona de limpieza predeterminados.",
                "Guarde la configuración.",
              ],
            },
            { type: "h2", text: "Interacción con el calendario" },
            {
              type: "p",
              text: "En cuanto se cancela o se traslada una reserva, la tarea de limpieza correspondiente se adapta automáticamente a la nueva fecha de check-out. Así el plan de limpieza permanece siempre sincronizado con el estado de ocupación real.",
            },
            {
              type: "ul",
              items: [
                "La limpieza se crea automáticamente en cada check-out con un plan activo.",
                "Si la reserva se traslada, la tarea de limpieza se traslada con ella.",
                "Si el huésped cancela la estancia, la tarea de limpieza se elimina.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Sin un plan de limpieza activado no se crean tareas automáticas — en ese caso, cree las limpiezas manualmente en [Crear tareas](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Asignar tareas",
          excerpt: "Asigne tareas de forma específica a personal de limpieza o miembros del equipo.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Para que una tarea se realice, asígnela a un miembro concreto del equipo — por ejemplo, una persona de limpieza o un empleado responsable de mantenimiento. Por defecto, solo la persona asignada ve la tarea en su propia vista general.",
            },
            { type: "h2", text: "Asignar una tarea manualmente" },
            {
              type: "steps",
              items: [
                "Abra la tarea en la lista «Tareas».",
                "Haga clic en «Asignar».",
                "Seleccione en la lista al miembro del equipo responsable.",
                "Confirme la asignación.",
              ],
            },
            { type: "h2", text: "Asignación por alojamiento" },
            {
              type: "p",
              text: "Si una persona de limpieza ya tiene un alojamiento fijamente asignado, también puede hacer que las tareas de ese alojamiento se asignen automáticamente a esa persona. Esto ahorra clics en limpiezas recurrentes y reduce las consultas.",
            },
            {
              type: "ul",
              items: [
                "Asignación manual: usted elige la persona para cada tarea.",
                "Asignación fija de alojamiento: las nuevas tareas de ese alojamiento van automáticamente a la persona registrada.",
                "Una tarea siempre tiene exactamente una persona responsable.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "El personal de limpieza y los empleados ven exclusivamente sus propias tareas asignadas, sin datos financieros ni de ventas del alojamiento.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Hacer seguimiento del estado de las tareas",
          excerpt: "Mantenga a la vista en tiempo real el estado de las tareas.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Cada tarea pasa por un estado claro — de abierta a en curso y luego a completada. Así puede ver en todo momento si una limpieza o un mantenimiento estará listo a tiempo antes del próximo check-in.",
            },
            { type: "h2", text: "Resumen de estados" },
            {
              type: "ul",
              items: [
                "Abierta: la tarea está creada pero aún no se ha comenzado.",
                "En curso: la persona asignada ha iniciado la tarea.",
                "Completada: la tarea está realizada y confirmada.",
              ],
            },
            { type: "h2", text: "Actualizar el estado" },
            {
              type: "steps",
              items: [
                "Abra la tarea desde la lista «Tareas».",
                "Elija el estado correspondiente, p. ej. «En curso» o «Completada».",
                "Añada si es necesario una breve nota, por ejemplo sobre incidencias en el alojamiento.",
                "Guarde el cambio.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Los cambios de estado aparecen de inmediato en la lista de tareas compartida — no es necesario recargar manualmente.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Si una limpieza sigue abierta poco antes del próximo check-in, compruebe primero la asignación antes de contactar con el huésped.",
            },
          ],
        },
      ],
    },
  ],
};
