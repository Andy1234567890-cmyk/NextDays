import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Equipo y permisos",
  description: "Empleados, roles y derechos de acceso.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Acceso",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Invitar a un empleado",
          excerpt: "Así invita a nuevos empleados a su cuenta de myNextDays.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "A su negocio puede invitar a tantos empleados como desee — por ejemplo, para recepción, limpieza o administración. Cada invitación está vinculada a una dirección de correo electrónico y asigna de inmediato un rol fijo, que determina el acceso en la web y en la app de myNextDays.",
            },
            { type: "h2", text: "Enviar una invitación" },
            {
              type: "steps",
              items: [
                "Abra «Cuenta» y vaya a la sección «Equipo».",
                "Haga clic en «Invitar empleado».",
                "Introduzca la dirección de correo electrónico de la persona.",
                "Elija el rol adecuado, p. ej. empleado o limpieza.",
                "Confirme la invitación.",
              ],
            },
            { type: "h2", text: "Qué ocurre después" },
            {
              type: "p",
              text: "La persona invitada recibe un correo electrónico con un enlace para asignar su propia contraseña e iniciar sesión. El inicio de sesión es válido tanto para el panel web como para la app de myNextDays — no hay una cuenta separada por cada frontend.",
            },
            {
              type: "ul",
              items: [
                "Una invitación es válida hasta que se acepta o se retira.",
                "Las invitaciones pendientes se muestran en la sección «Equipo» con el estado «Pendiente».",
                "El rol puede ajustarse en cualquier momento con posterioridad.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Qué áreas puede ver cada rol se explica en [Roles y permisos](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Asigne desde el principio el rol más restringido que corresponda — los permisos siempre pueden ampliarse más adelante.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Roles y permisos",
          excerpt: "Los cinco roles en myNextDays y lo que cada uno puede hacer.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "myNextDays distingue cinco roles: administrador, coadministrador, empleado, limpieza y propietario. Cada rol determina qué áreas son visibles en el panel web y en la app de myNextDays — los permisos se aplican en el servidor, no solo se ocultan en la interfaz.",
            },
            { type: "h2", text: "Los roles de un vistazo" },
            {
              type: "ul",
              items: [
                "Administrador: acceso completo a todas las áreas, incluidas finanzas, ventas y gestión del equipo.",
                "Coadministrador: acceso casi completo, como el administrador, para el segundo nivel de dirección del negocio.",
                "Empleado: acceso operativo a reservas, calendario y tareas, sin visión de finanzas ni de ventas.",
                "Limpieza: acceso exclusivo a las tareas de limpieza asignadas y a los detalles del alojamiento, sin visión de finanzas ni de ventas.",
                "Propietario: acceso de solo lectura a sus propios alojamientos, sin gestión de alojamientos ajenos.",
              ],
            },
            { type: "h2", text: "Asignar o cambiar un rol" },
            {
              type: "steps",
              items: [
                "Abra «Cuenta» → «Equipo».",
                "Seleccione el empleado correspondiente en la lista.",
                "Haga clic en «Cambiar rol».",
                "Elija el nuevo rol y confirme.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Los roles de empleado y limpieza no ven en ningún caso precios, ingresos ni canales de venta — esta exclusión se aplica en el servidor y no puede eludirse a través de la interfaz.",
            },
            {
              type: "note",
              variant: "info",
              text: "Encontrará un resumen por rol en [Lo que ve cada rol](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Lo que ve cada rol",
          excerpt: "Áreas y vistas concretas por rol en la web y en la app.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Además de los permisos básicos de [Roles y permisos](/hilfe/team-rollen/rollen-berechtigungen), una mirada concreta a áreas individuales le ayuda a establecer la expectativa correcta al incorporar nuevos empleados.",
            },
            { type: "h2", text: "Calendario y reservas" },
            {
              type: "p",
              text: "Administrador, coadministrador y empleado ven el plan de ocupación completo con datos del huésped y tareas. Limpieza ve solo las citas que se le han asignado, junto con la dirección del alojamiento y la lista de comprobación, pero sin nombres de huéspedes ni precios. Los propietarios ven el calendario de ocupación exclusivamente para sus propios alojamientos, solo en modo lectura.",
            },
            { type: "h2", text: "Finanzas y ventas" },
            {
              type: "ul",
              items: [
                "Ingresos, comisiones y facturas: solo administrador y coadministrador.",
                "Portales (conexión OTA) y visibilidad en la plataforma: solo administrador y coadministrador.",
                "Empleado y limpieza: sin acceso a las áreas de finanzas o ventas, tampoco a páginas de detalle.",
              ],
            },
            { type: "h2", text: "Equipo y configuración" },
            {
              type: "p",
              text: "La gestión de empleados, roles y configuración de cuenta queda reservada al administrador y al coadministrador. Los propietarios y los roles operativos ni siquiera ven esta área en la app de myNextDays ni en el panel web.",
            },
            {
              type: "note",
              variant: "info",
              text: "Esta división se aplica de forma idéntica en el panel web y en la app de myNextDays, ya que ambos frontends consultan el mismo rol de su cuenta.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Pruebe brevemente los nuevos roles junto con el empleado tras la invitación, para evitar malentendidos sobre las áreas visibles.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Retirar el acceso",
          excerpt: "Elimine el acceso de un empleado de forma inmediata y completa.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Si un empleado deja su negocio o cambia la colaboración, retire el acceso directamente en la cuenta. La retirada actúa en el servidor y de inmediato — no solo tras finalizar una sesión existente.",
            },
            { type: "h2", text: "Retirar el acceso" },
            {
              type: "steps",
              items: [
                "Abra «Cuenta» → «Equipo».",
                "Seleccione el empleado correspondiente.",
                "Haga clic en «Retirar acceso».",
                "Confirme la operación.",
              ],
            },
            { type: "h2", text: "Efecto sobre las sesiones activas" },
            {
              type: "p",
              text: "Tras la retirada, la persona no podrá volver a iniciar sesión ni en el panel web ni en la app de myNextDays. Las tareas o citas de limpieza ya asignadas deberían reasignarse antes a otro empleado, para que nada quede sin gestionar.",
            },
            {
              type: "ul",
              items: [
                "Reasigne las tareas abiertas antes de la retirada.",
                "El acceso puede restablecerse más adelante mediante una nueva invitación.",
                "La retirada solo afecta a este negocio, no a otras cuentas de la persona.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Retire el acceso sin demora en cuanto finalice una colaboración — de lo contrario, las cuentas de empleado abiertas siguen siendo un riesgo de seguridad innecesario.",
            },
          ],
        },
      ],
    },
  ],
};
