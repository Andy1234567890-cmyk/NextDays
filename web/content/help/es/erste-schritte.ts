import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Primeros pasos",
  description: "Configure su cuenta y empiece en pocos minutos.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Configuración",
      articles: [
        {
          slug: "willkommen",
          title: "Bienvenido a myNextDays",
          excerpt: "Una visión general del PMS, el gestor de canales, el marketplace y la app.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "myNextDays es su plataforma central para alojamientos vacacionales y hoteles. En lugar de varias soluciones aisladas, gestiona disponibilidad, precios, reservas y comunicación con los huéspedes en un solo lugar, ya sea que gestione una única casa de vacaciones o varias habitaciones de hotel.",
            },
            { type: "h2", text: "Los cuatro pilares" },
            {
              type: "ul",
              items: [
                "PMS (sistema de gestión de propiedades): alojamientos, calendario, precios, reservas, tareas y pagos.",
                "Gestor de canales: conexión con portales como Booking, Airbnb y otros — una sola entrada, muchos portales sincronizados.",
                "Marketplace de la plataforma: el propio marketplace de myNextDays, un canal de reserva del mismo rango que los portales.",
                "App: la aplicación móvil para huéspedes, propietarios y empleados con los mismos datos que en la web.",
              ],
            },
            { type: "h2", text: "Cómo interactúan los pilares" },
            {
              type: "p",
              text: "Usted mantiene el alojamiento, los precios y la disponibilidad una sola vez de forma centralizada en el PMS. Desde ahí, myNextDays distribuye automáticamente los datos a todos los canales activos. Una reserva —sin importar por qué canal entre— bloquea de inmediato las noches correspondientes en todas partes, de modo que quedan excluidas las reservas duplicadas.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Empiece configurando cuenta y negocio, después cree su primer alojamiento — este orden le ahorrará correcciones más adelante.",
            },
            { type: "h2", text: "Próximos pasos" },
            {
              type: "steps",
              items: [
                "Abra Cuenta en el menú y complete los datos de su negocio.",
                "Cree su primer alojamiento en Alojamientos.",
                "Compruebe que el equipamiento, las fotos y los precios estén completos.",
                "Haga clic en Publicar para que el alojamiento sea visible en todos los canales.",
              ],
            },
            {
              type: "p",
              text: "Más información sobre cada paso en [Configurar cuenta y negocio](/hilfe/erste-schritte/konto-einrichten) y [Crear su primer alojamiento](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Configurar cuenta y negocio",
          excerpt: "Registre correctamente los datos maestros, la dirección de facturación y la moneda.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Antes de crear alojamientos, configure su negocio en la cuenta. Estos datos se necesitan para las facturas, los portales y la liquidación con myNextDays, por lo que deben estar completos y ser correctos.",
            },
            { type: "h2", text: "Registrar los datos maestros" },
            {
              type: "steps",
              items: [
                "Abra Cuenta en el menú.",
                "Introduzca en Datos maestros el nombre de la empresa o del autónomo, la dirección y los datos de contacto.",
                "Registre la dirección de facturación — aparecerá en todas las facturas emitidas.",
                "Elija su moneda base. Se aplicará a todos los precios hasta que la cambie específicamente por alojamiento.",
              ],
            },
            { type: "h2", text: "Por qué es importante la moneda" },
            {
              type: "p",
              text: "La moneda no se adivina ni se completa automáticamente: si falta, ningún precio puede mostrarse ni facturarse correctamente. Por eso myNextDays exige una elección consciente al configurar, en lugar de aplicar un valor predeterminado.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Si cambia la moneda de un alojamiento posteriormente, todos los planes de tarifas vinculados a él se actualizarán también. Revise los precios una vez hecho el cambio.",
            },
            { type: "h2", text: "Dirección de facturación y liquidación" },
            {
              type: "p",
              text: "En Facturación, dentro de Cuenta, verá sus facturas en curso y la dirección de facturación registrada. Manténgala actualizada, especialmente ante un cambio de forma jurídica o de dirección, para que las facturas se emitan correctamente.",
            },
            {
              type: "ul",
              items: [
                "Nombre de la empresa o del autónomo",
                "Dirección de facturación con país",
                "NIF o número de IVA, si corresponde",
                "Moneda base para nuevos alojamientos",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Crear su primer alojamiento",
          excerpt: "Así crea paso a paso su primer alojamiento reservable.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Un alojamiento en myNextDays es siempre exactamente una unidad reservable: bien una única habitación en un hotel, bien un alojamiento vacacional completo. Si gestiona un hotel con varias habitaciones, cree un alojamiento propio para cada habitación.",
            },
            { type: "h2", text: "Crear el alojamiento" },
            {
              type: "steps",
              items: [
                "Abra Alojamientos en el menú.",
                "Haga clic en Añadir alojamiento.",
                "Elija el tipo de alojamiento: categoría, tipo de inmueble y modalidad de oferta.",
                "Complete dirección, capacidad y precio base en su moneda registrada.",
                "Guarde el alojamiento como borrador para completarlo más adelante.",
              ],
            },
            { type: "h2", text: "Qué falta después" },
            {
              type: "p",
              text: "Un alojamiento recién creado es al principio un borrador y no es visible en ningún canal. Complete equipamiento, fotos, descripción y disponibilidad del calendario antes de publicarlo — solo un alojamiento completo puede comercializarse de forma fiable.",
            },
            {
              type: "ul",
              items: [
                "Seleccionar las características de equipamiento de la lista de categorías",
                "Registrar al menos una foto de portada y una descripción",
                "Introducir correctamente la capacidad (adultos, niños, camas)",
                "Comprobar el precio base y la disponibilidad del calendario",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Si gestiona varios tipos de habitación, repita este proceso para cada habitación individual — no existe un nivel de edificio superior con habitaciones debajo.",
            },
            {
              type: "p",
              text: "Una vez completados todos los campos obligatorios, puede publicar el alojamiento; consulte [Publicar un alojamiento](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Publicar un alojamiento",
          excerpt: "Un clic activa a la vez el marketplace de la plataforma, los portales y la web.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Publicar hace que un alojamiento sea visible y reservable. Normalmente basta un solo clic para activar los tres canales de venta a la vez — pero puede ajustar la visibilidad de cada canal por separado en cualquier momento.",
            },
            { type: "h2", text: "Cómo publicar" },
            {
              type: "steps",
              items: [
                "Abra el alojamiento en Alojamientos.",
                "Compruebe en la pestaña Resumen que todos los datos obligatorios estén marcados en verde.",
                "Haga clic en Publicar.",
                "Confirme el diálogo — se activarán el marketplace de la plataforma, los portales y la web.",
              ],
            },
            { type: "h2", text: "Controlar los canales por separado" },
            {
              type: "p",
              text: "Tras la publicación encontrará en la pestaña Visibilidad tres interruptores independientes: Web, Marketplace de la plataforma y Portales. Si desea ofrecer un alojamiento, por ejemplo, solo en su propia web pero no a través de portales, simplemente desactive el interruptor correspondiente.",
            },
            {
              type: "ul",
              items: [
                "Web: visibilidad en su propia web de myNextDays",
                "Marketplace de la plataforma: visibilidad en el marketplace global de myNextDays",
                "Portales: visibilidad en Booking, Airbnb y otros",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Estos tres interruptores son independientes del estado del alojamiento (activo/inactivo). Un alojamiento activo puede seguir siendo invisible en canales concretos.",
            },
            { type: "h2", text: "Bloquear un alojamiento temporalmente" },
            {
              type: "p",
              text: "Si desea bloquear un solo día en lugar de todo el alojamiento, use Stop-Sell en el calendario — esto bloquea el día en todos los canales a la vez, independientemente de los interruptores de visibilidad.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Entender los tres canales de venta",
          excerpt: "Portales, marketplace de la plataforma y app de un vistazo.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "myNextDays comercializa cada alojamiento a través de varias vías del mismo rango simultáneamente. Entender cómo interactúan le ayuda a controlar la visibilidad y los precios de forma específica.",
            },
            { type: "h2", text: "Portales" },
            {
              type: "p",
              text: "A través del gestor de canales conecta su alojamiento con grandes portales de reserva como Booking, Airbnb y otros. La disponibilidad y los precios se sincronizan automáticamente, de modo que no tiene que mantener manualmente varios calendarios de portales.",
            },
            { type: "h2", text: "Marketplace de la plataforma" },
            {
              type: "p",
              text: "El marketplace de myNextDays es un canal de reserva propio y global, comparable a Booking o Airbnb, pero parte de la misma plataforma. No es un sustituto de la «reserva directa», sino un canal del mismo rango con su propio eje de visibilidad.",
            },
            { type: "h2", text: "App" },
            {
              type: "p",
              text: "La app móvil ofrece a huéspedes, propietarios y empleados acceso a los mismos datos que la web — por ejemplo, detalles de reservas, mensajes o tareas, según el rol correspondiente.",
            },
            { type: "h2", text: "Tres ejes de visibilidad independientes" },
            {
              type: "ul",
              items: [
                "Web — su propia web de myNextDays",
                "Marketplace de la plataforma — el marketplace global de myNextDays",
                "Portales — Booking, Airbnb y otros a través del gestor de canales",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Los tres ejes se pueden activar de forma independiente entre sí. En cambio, Stop-Sell y el estado del alojamiento actúan de forma transversal sobre los tres a la vez.",
            },
          ],
        },
      ],
    },
  ],
};
