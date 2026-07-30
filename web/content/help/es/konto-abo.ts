import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Cuenta y suscripción",
  description: "Datos maestros, tarifa, seguridad y 2FA.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Cuenta",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Datos maestros del negocio",
          excerpt: "Mantenga de forma centralizada el nombre de la empresa, la dirección y los datos de contacto de su negocio.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "En /konto, myNextDays agrupa todas las funciones de negocio y cuenta como secciones en una sola página — no tiene que cambiar entre muchas subpáginas. Los datos maestros del negocio forman la base: nombre de la empresa, forma jurídica, dirección y datos de contacto, que se utilizan para facturas, portales y la comunicación con los huéspedes.",
            },
            { type: "h2", text: "Abrir y editar los datos maestros" },
            {
              type: "steps",
              items: [
                "Abra /konto.",
                "Vaya a la sección «Datos maestros del negocio».",
                "Compruebe el nombre de la empresa, la dirección, el teléfono y el correo electrónico de contacto.",
                "Realice sus cambios.",
                "Guarde la sección.",
              ],
            },
            { type: "h2", text: "Por qué estos datos son importantes" },
            {
              type: "p",
              text: "Los datos maestros del negocio se incluyen en las facturas, en el registro en los portales conectados y en indicaciones legalmente obligatorias como el aviso legal. Una dirección incompleta o desactualizada puede provocar que las facturas se emitan de forma incorrecta o que las conexiones con portales se retrasen.",
            },
            {
              type: "ul",
              items: [
                "El nombre de la empresa y la forma jurídica aparecen en todas las facturas emitidas.",
                "La dirección se necesita para el registro en los portales.",
                "Los datos de contacto sirven como vía de respaldo si no llegan las notificaciones del sistema.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Si cambia su dirección de facturación, compruebe después las facturas ya emitidas en [Facturación y calculadora de tarifas](/hilfe/konto-abo/abrechnung-tarifrechner) — los comprobantes existentes no se ajustan de forma retroactiva.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Suscripción y tarifa",
          excerpt: "Su tarifa determina el cupo de alojamientos — el número de alojamientos contratado se ve siempre en la cuenta.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Su suscripción a myNextDays incluye un cupo de alojamientos: el número máximo de alojamientos (habitaciones o alojamientos vacacionales) que puede gestionar activamente al mismo tiempo. El número de alojamientos actualmente contratado se muestra en la sección «Suscripción y tarifa» de /konto, junto con el cupo restante.",
            },
            { type: "h2", text: "Mantener a la vista el cupo" },
            {
              type: "p",
              text: "El cupo se hace cumplir en el servidor: si alcanza el límite máximo de su tarifa, no podrá crear otro alojamiento hasta que desactive uno existente o amplíe su tarifa. Esto se aplica independientemente de si el nuevo alojamiento es una habitación o un alojamiento vacacional — ambos cuentan igual para el cupo.",
            },
            {
              type: "steps",
              items: [
                "Abra /konto y la sección «Suscripción y tarifa».",
                "Compruebe el número de alojamientos contratado en relación con el cupo de su tarifa.",
                "Elija, si es necesario, una tarifa mayor para crear más alojamientos.",
                "Confirme el cambio de tarifa.",
              ],
            },
            {
              type: "ul",
              items: [
                "Cada alojamiento cuenta individualmente para el cupo, independientemente del tipo de alojamiento.",
                "Un cambio de tarifa afecta de inmediato al cupo disponible.",
                "Un downgrade solo es posible si el número de alojamientos activos encaja con el nuevo cupo.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Un downgrade a una tarifa con un cupo menor se rechaza mientras haya más alojamientos activos de los que permite la nueva tarifa. Desactive primero los alojamientos sobrantes.",
            },
            {
              type: "note",
              variant: "info",
              text: "Encontrará más detalles sobre facturas y el cálculo de la tarifa en [Facturación y calculadora de tarifas](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Facturación y calculadora de tarifas",
          excerpt: "Dirección de facturación, facturas anteriores y la calculadora de tarifas para su cupo de alojamientos.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "La sección «Facturación y calculadora de tarifas» en /konto agrupa todo lo relacionado con la facturación: su dirección de facturación, la lista de facturas anteriores para descargar y una calculadora de tarifas con la que puede comprobar el coste de su cupo de alojamientos actual o de uno mayor.",
            },
            { type: "h2", text: "Dirección de facturación y facturas" },
            {
              type: "p",
              text: "La dirección de facturación puede diferir de la dirección de su negocio, por ejemplo si una asesoría fiscal recibe los comprobantes. Las facturas ya emitidas se muestran ordenadas cronológicamente; cada una puede descargarse como PDF.",
            },
            { type: "h2", text: "Usar la calculadora de tarifas" },
            {
              type: "steps",
              items: [
                "Abra /konto y la sección «Facturación y calculadora de tarifas».",
                "Introduzca en la calculadora de tarifas el número de alojamientos deseado.",
                "Compare los costes resultantes por nivel de tarifa.",
                "Cambie, si lo desea, directamente desde la calculadora a la tarifa adecuada.",
              ],
            },
            {
              type: "ul",
              items: [
                "La calculadora de tarifas muestra los costes en la moneda registrada para su cuenta.",
                "Las facturas están disponibles permanentemente para descargar.",
                "La dirección de facturación puede mantenerse de forma independiente de los datos maestros del negocio.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Compare regularmente con la calculadora de tarifas si su cupo de alojamientos sigue encajando con el número de alojamientos realmente contratado — vea [Suscripción y tarifa](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Cambiar contraseña y correo electrónico",
          excerpt: "Los cambios críticos para la seguridad exigen volver a iniciar sesión y un paso de confirmación.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "La contraseña y la dirección de correo electrónico son de los datos más críticos para la seguridad de su cuenta. Por eso myNextDays exige una nueva autenticación para ambos cambios — confirma el cambio con su contraseña actual, incluso si ya ha iniciado sesión.",
            },
            { type: "h2", text: "Cambiar la contraseña" },
            {
              type: "steps",
              items: [
                "Abra /konto y la sección «Cambiar contraseña y correo electrónico».",
                "Introduzca su contraseña actual como confirmación.",
                "Asigne la nueva contraseña y repítala.",
                "Guarde el cambio.",
              ],
            },
            { type: "h2", text: "Cambiar la dirección de correo electrónico" },
            {
              type: "p",
              text: "El cambio de dirección de correo electrónico se realiza mediante doble confirmación: tras confirmar su contraseña actual, recibe un enlace de confirmación en la NUEVA dirección. Solo al hacer clic en ese enlace se hace efectivo el cambio — la dirección antigua sigue activa hasta entonces, para que el acceso a su cuenta nunca se interrumpa.",
            },
            {
              type: "ul",
              items: [
                "Sin la contraseña actual no se puede cambiar ni la contraseña ni el correo electrónico.",
                "El enlace de confirmación para la nueva dirección de correo tiene una validez limitada en el tiempo.",
                "Hasta la confirmación, la dirección de correo anterior sigue activa para el inicio de sesión y las notificaciones.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Tras un cambio de correo electrónico, revise también la autenticación de dos factores — vea [Autenticación de dos factores](/hilfe/konto-abo/zwei-faktor) — si los códigos de recuperación estaban vinculados a la dirección antigua.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Autenticación de dos factores",
          excerpt: "Un paso de inicio de sesión adicional protege su cuenta contra el acceso no autorizado.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "La autenticación de dos factores (2FA) complementa su contraseña con un segundo factor a través de una app de autenticación. Así, una contraseña robada por sí sola ya no basta para iniciar sesión en su cuenta de myNextDays.",
            },
            { type: "h2", text: "Configurar la 2FA" },
            {
              type: "steps",
              items: [
                "Abra /konto y la sección «Autenticación de dos factores».",
                "Confirme su contraseña actual para volver a autenticarse.",
                "Escanee el código QR mostrado con una app de autenticación.",
                "Introduzca el código generado como confirmación.",
                "Guarde los códigos de recuperación mostrados en un lugar seguro.",
              ],
            },
            { type: "h2", text: "Desactivar la 2FA" },
            {
              type: "p",
              text: "Desactivar la autenticación de dos factores también requiere volver a autenticarse con su contraseña actual. Así myNextDays impide que alguien con una sesión ya abierta desactive simplemente su protección.",
            },
            {
              type: "ul",
              items: [
                "Los códigos de recuperación permiten el acceso si se pierde la app de autenticación.",
                "Cada código de recuperación solo puede usarse una vez.",
                "Activar y desactivar la 2FA están igualmente vinculados a una confirmación de contraseña.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Guarde sus códigos de recuperación separados del dispositivo con la app de autenticación, por ejemplo en un gestor de contraseñas.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Historial de dispositivos",
          excerpt: "Mantenga a la vista desde qué dispositivos ha iniciado sesión su cuenta.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "El historial de dispositivos en /konto le muestra en qué dispositivos ha iniciado sesión actualmente su cuenta — con tipo de dispositivo, ubicación aproximada y momento de la última actividad. Así detecta rápidamente si un inicio de sesión realmente proviene de usted.",
            },
            { type: "h2", text: "Comprobar el historial de dispositivos" },
            {
              type: "steps",
              items: [
                "Abra /konto y la sección «Historial de dispositivos».",
                "Revise la lista de dispositivos conectados.",
                "Si reconoce un dispositivo desconocido, ciérrele la sesión.",
                "A continuación, cambie su contraseña por precaución.",
              ],
            },
            { type: "h2", text: "Cuándo tiene sentido revisar" },
            {
              type: "p",
              text: "Revise el historial de dispositivos especialmente tras un cambio de contraseña o de correo electrónico, así como tras usar un dispositivo ajeno o público. Una entrada desconocida es una señal de alerta clara de acceso no autorizado.",
            },
            {
              type: "ul",
              items: [
                "Cada entrada muestra tipo de dispositivo, ubicación aproximada y última actividad.",
                "Los dispositivos individuales pueden desconectarse de forma específica, sin afectar a los demás.",
                "Un dispositivo no reconocido es motivo para un cambio de contraseña inmediato.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Si no reconoce un dispositivo, ciérrele la sesión de inmediato y después cambie su contraseña en [Cambiar contraseña y correo electrónico](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Privacidad",
          excerpt: "Controle la indexación en buscadores por alojamiento y exporte sus datos.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "En la sección «Privacidad» de /konto controla dos cosas: si sus páginas de alojamiento pueden ser indexadas por buscadores, y cómo puede exportar sus datos almacenados en myNextDays.",
            },
            { type: "h2", text: "Indexación en buscadores por alojamiento" },
            {
              type: "p",
              text: "Por defecto, la indexación en buscadores está desactivada para los alojamientos nuevos. Solo cuando la activa de forma consciente por alojamiento, buscadores como Google pueden incluir la página pública del alojamiento en su índice. Así mantiene el control sobre qué alojamientos son localizables fuera de los portales y de la plataforma propia.",
            },
            {
              type: "steps",
              items: [
                "Abra /konto y la sección «Privacidad».",
                "Seleccione el alojamiento deseado de la lista.",
                "Active o desactive la indexación en buscadores.",
                "Con varios alojamientos, use el interruptor colectivo para configurarlos todos de manera uniforme.",
              ],
            },
            { type: "h2", text: "Exportar datos" },
            {
              type: "p",
              text: "A través de la función de exportación de datos solicita una copia completa de sus datos almacenados en la cuenta. La exportación se recopila y luego se pone a su disposición para descargar.",
            },
            {
              type: "ul",
              items: [
                "La indexación puede controlarse individualmente por alojamiento, con interruptor colectivo para todos los alojamientos.",
                "Los alojamientos nuevos empiezan por principio sin indexación en buscadores.",
                "La exportación de datos contiene sus datos de cuenta y de alojamiento en forma estructurada.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La indexación en buscadores es independiente de la visibilidad en portales y en el marketplace propio — solo afecta a la página pública del alojamiento en los buscadores.",
            },
          ],
        },
      ],
    },
  ],
};
