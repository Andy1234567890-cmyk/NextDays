import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Propietarios y liquidaciones",
  description: "Cuentas de propietarios, liquidaciones y comisiones.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Propietarios",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Crear un propietario",
          excerpt: "Así crea una nueva cuenta de propietario en myNextDays.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Los propietarios son cuentas propias en myNextDays con las que gestiona alojamientos que pertenecen a una persona o sociedad determinada. Una cuenta de propietario recibe una visión limitada, de solo lectura, de sus propios alojamientos, sin poder realizar cambios en el negocio.",
            },
            { type: "h2", text: "Crear una nueva cuenta de propietario" },
            {
              type: "steps",
              items: [
                "Abra la sección «Propietarios» en el menú principal.",
                "Haga clic en «Crear nuevo propietario».",
                "Introduzca el nombre, la dirección de correo electrónico y los datos de contacto.",
                "Registre, si es necesario, la dirección de facturación para las liquidaciones.",
                "Guarde la cuenta.",
              ],
            },
            { type: "h2", text: "Configurar el acceso" },
            {
              type: "p",
              text: "Tras crearla, puede enviar al propietario una invitación para su propio acceso. El propietario se conecta entonces con sus propias credenciales y ve exclusivamente los alojamientos que se le han asignado.",
            },
            {
              type: "ul",
              items: [
                "Una cuenta de propietario puede abarcar varios alojamientos.",
                "Cada alojamiento pertenece exactamente a un propietario.",
                "Los datos de contacto y la dirección de facturación pueden ajustarse en cualquier momento.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Cómo asignar un alojamiento existente a un propietario se explica en [Asignar un alojamiento a un propietario](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Asignar un alojamiento a un propietario",
          excerpt: "Cada alojamiento pertenece exactamente a un propietario — así configura la asignación.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "En myNextDays cada alojamiento pertenece exactamente a un propietario. No está prevista una asignación múltiple — si un alojamiento debe pertenecer a otro propietario, elimine primero la asignación existente antes de establecer una nueva.",
            },
            { type: "h2", text: "Realizar la asignación" },
            {
              type: "steps",
              items: [
                "Abra el alojamiento en «Alojamientos».",
                "Vaya a la pestaña «Propietario».",
                "Seleccione en la lista al propietario responsable.",
                "Confirme la asignación.",
                "Guarde el cambio en el alojamiento.",
              ],
            },
            { type: "h2", text: "Cambio de propietario" },
            {
              type: "p",
              text: "Si cambia el propietario de un alojamiento, por ejemplo por una venta, sustituya la asignación existente por la nueva. Las liquidaciones ya creadas para periodos pasados permanecen asignadas al propietario original.",
            },
            {
              type: "ul",
              items: [
                "Un alojamiento solo puede estar asignado a un propietario en cada momento.",
                "Sin asignación, el alojamiento no aparece en ningún acceso de propietario.",
                "Las liquidaciones pasadas se conservan con el propietario original.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Una asignación múltiple de un alojamiento a varios propietarios queda excluida — el sistema no permite una segunda asignación simultánea.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Liquidación de propietario (statement)",
          excerpt: "Así crea un statement con ingresos menos comisión para un propietario.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "La liquidación de propietario, también llamada statement, resume para un periodo elegido todos los ingresos de los alojamientos asignados y deduce su comisión acordada. El resultado es el importe que paga al propietario.",
            },
            { type: "h2", text: "Crear el statement" },
            {
              type: "steps",
              items: [
                "Abra la sección «Propietarios» y seleccione el propietario deseado.",
                "Vaya a la pestaña «Liquidación».",
                "Seleccione el periodo de liquidación.",
                "Revise las reservas e ingresos listados por alojamiento.",
                "Genere el statement con la comisión ya deducida.",
              ],
            },
            { type: "h2", text: "Estructura del statement" },
            {
              type: "p",
              text: "Un statement muestra por alojamiento los ingresos brutos de las reservas, la comisión deducida de ellos y el importe de pago resultante. Los costes adicionales, como limpieza o tasas, pueden mostrarse por separado según lo acordado.",
            },
            {
              type: "ul",
              items: [
                "Ingresos brutos: suma de todas las reservas del periodo por alojamiento.",
                "Comisión: su porcentaje acordado, se deduce de los ingresos.",
                "Importe de pago: ingresos menos comisión y, en su caso, otras partidas.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Los importes del statement siempre se muestran en la moneda del alojamiento — no existe un valor de moneda predeterminado genérico.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Cree los statements regularmente en la misma fecha de referencia, para que los propietarios tengan un ritmo fiable para sus pagos.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Acceso de propietario",
          excerpt: "Lo que los propietarios pueden ver en su acceso de solo lectura.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "El acceso de propietario es un inicio de sesión propio, de solo lectura, para myNextDays. En él, los propietarios ven exclusivamente los alojamientos que se les han asignado, así como las ocupaciones y liquidaciones correspondientes, sin poder cambiar la configuración por sí mismos.",
            },
            { type: "h2", text: "Qué ven los propietarios" },
            {
              type: "ul",
              items: [
                "Calendario de ocupación de sus propios alojamientos.",
                "Statements creados con ingresos y comisión deducida.",
                "Datos básicos de sus alojamientos, como equipamiento y descripción.",
              ],
            },
            { type: "h2", text: "Activar el acceso" },
            {
              type: "steps",
              items: [
                "Abra el propietario en «Propietarios».",
                "Haga clic en «Invitar acceso».",
                "El propietario recibe un correo electrónico para configurar su propia contraseña.",
                "Tras iniciar sesión, el propietario ve automáticamente solo sus alojamientos asignados.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "El acceso de propietario es estrictamente de solo lectura: solo usted, como negocio, puede cambiar precios, disponibilidades o datos del alojamiento, no el propietario mismo.",
            },
            {
              type: "note",
              variant: "info",
              text: "Más información sobre la asignación de alojamientos en [Asignar un alojamiento a un propietario](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
