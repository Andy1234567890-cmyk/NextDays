import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "App móvil",
  description: "La app de myNextDays para cuando está fuera.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "App",
      articles: [
        {
          slug: "die-app",
          title: "La app de myNextDays",
          excerpt: "Una cuenta, cuatro experiencias: huésped, agencia, propietario y empleado.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "La app de myNextDays es la plataforma móvil para todo su negocio. No es un producto separado, sino un frontend del mismo rango que su panel web — ambos acceden a la misma cuenta y a los mismos datos, solo que la interfaz está optimizada para moverse.",
            },
            { type: "h2", text: "Cuatro experiencias en una app" },
            {
              type: "ul",
              items: [
                "Huésped: ver reservas, comunicarse con el negocio, consultar información de check-in.",
                "Agencia: gestionar varios negocios y alojamientos de un vistazo.",
                "Propietario: acceso de solo lectura a sus propios alojamientos, ocupación e informes.",
                "Empleado: calendario, tareas y planes de limpieza para el día a día operativo.",
              ],
            },
            { type: "h2", text: "Qué experiencia ve" },
            {
              type: "p",
              text: "Tras iniciar sesión, la app muestra automáticamente la experiencia adecuada para su rol — el mismo rol que se aplica también en el panel web. Un empleado con derechos limitados ve en la app exactamente las mismas restricciones que en el navegador, ya que el permiso se comprueba en el servidor.",
            },
            {
              type: "note",
              variant: "info",
              text: "Más información sobre los roles y lo que cada uno puede ver en [Roles y permisos](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "No necesita un registro separado para la app — simplemente inicie sesión con sus credenciales existentes de myNextDays.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Instalar la app e iniciar sesión",
          excerpt: "Así descarga la app de myNextDays e inicia sesión.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "La app de myNextDays está disponible para iOS y Android. El inicio de sesión se realiza con las mismas credenciales que en el panel web — no se necesita una cuenta separada ni un nuevo registro.",
            },
            { type: "h2", text: "Instalación" },
            {
              type: "steps",
              items: [
                "Abra la App Store (iOS) o Google Play (Android).",
                "Busque «myNextDays».",
                "Instale la app en su smartphone o tablet.",
                "Abra la app tras la instalación.",
              ],
            },
            { type: "h2", text: "Inicio de sesión" },
            {
              type: "steps",
              items: [
                "Pulse en «Iniciar sesión».",
                "Introduzca su dirección de correo electrónico y su contraseña.",
                "Confirme si es necesario la solicitud de dos factores.",
                "Accederá automáticamente a la experiencia adecuada para su rol.",
              ],
            },
            {
              type: "ul",
              items: [
                "Las credenciales son idénticas a las del panel web.",
                "Si se le ha retirado el acceso, el inicio de sesión en la app también queda bloqueado de inmediato.",
                "Ante problemas con la contraseña, use «Olvidé mi contraseña» directamente en la app.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Inicie sesión únicamente a través de la entrada oficial «myNextDays» de la tienda de aplicaciones; la app nunca solicita credenciales fuera de la pantalla de inicio de sesión.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Gestionar desde cualquier lugar",
          excerpt: "Edite reservas, mensajes y tareas directamente desde el smartphone.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "La app de myNextDays es especialmente adecuada para la operativa diaria mientras está fuera: consulta reservas actuales, responde mensajes de huéspedes y realiza tareas sin tener que estar frente al ordenador — los cambios aparecen en tiempo real también en el panel web.",
            },
            { type: "h2", text: "Reservas a la vista" },
            {
              type: "p",
              text: "En la sección «Reservas» ve entradas y salidas, ocupación y estado por alojamiento. Los empleados y el personal de limpieza ven solo la información relevante para ellos, sin precios ni detalles de ventas.",
            },
            { type: "h2", text: "Mensajes y tareas" },
            {
              type: "steps",
              items: [
                "Abra la sección «Mensajes» para responder directamente a las solicitudes de los huéspedes.",
                "Vaya a «Tareas» para ver las tareas que se le han asignado.",
                "Toque una tarea para abrir los detalles y completarla.",
                "Marque las limpiezas realizadas como completadas directamente in situ.",
              ],
            },
            {
              type: "ul",
              items: [
                "Los mensajes y tareas nuevos aparecen en directo, sin actualización manual.",
                "Las tareas completadas son visibles de inmediato también en el panel web.",
                "Los propietarios ven las reservas e informes de sus alojamientos, pero solo en modo lectura.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Las notificaciones push le informan de nuevos mensajes y tareas asignadas en cuanto las permite en la configuración del dispositivo.",
            },
          ],
        },
      ],
    },
  ],
};
