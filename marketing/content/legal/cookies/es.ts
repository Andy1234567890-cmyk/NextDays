// Spanische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Política de cookies",
  metaDescription:
    "Qué cookies utiliza myNextDays: exclusivamente cookies técnicamente necesarias y funcionales, sin cookies de seguimiento ni publicitarias.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Esta política explica qué cookies y técnicas de almacenamiento comparables utiliza ${ANBIETER.firma} en este sitio web y en la plataforma myNextDays.`,
    "En resumen: utilizamos exclusivamente cookies técnicamente necesarias y funcionales. No existen cookies de análisis, publicidad o seguimiento, ni se transmiten datos de uso a redes publicitarias.",
  ],
  sections: [
    {
      heading: "Qué son las cookies",
      paragraphs: [
        "Las cookies son pequeños archivos de texto que un sitio web guarda en el navegador. Permiten reconocer de nuevo una sesión — por ejemplo, para que permanezca conectado tras iniciar sesión. Además de las cookies, los navegadores utilizan otros almacenamientos, como el Local Storage, que funcionan de forma técnicamente similar.",
      ],
    },
    {
      heading: "Para qué necesitamos su consentimiento",
      paragraphs: [
        "El consentimiento solo es necesario conforme al artículo 9 del reglamento danés de cookies (Cookie-bekendtgørelsen) (que transpone el artículo 5, apartado 3, de la Directiva 2002/58/CE) cuando el acceso a su dispositivo no sirva exclusivamente para transmitir una comunicación o no sea estrictamente necesario para un servicio que usted haya solicitado expresamente.",
        "Todas las cookies que utilizamos son necesarias para el inicio de sesión, la seguridad de la sesión o una configuración que usted mismo ha elegido; para ello no le pedimos nada y, a la inversa, tampoco utilizamos nada que requiera consentimiento.",
        "Solo debe dar su consentimiento para una cosa: la protección contra spam de nuestro formulario de contacto. Proviene de Google (reCAPTCHA Enterprise), es decir, un servicio externo, y solo se carga si usted lo ha permitido. Para ello aparece una barra en la parte inferior de la pantalla — en la primera visita, con botones de igual peso para rechazar y aceptar y sin preselección. Mientras no haya decidido, se aplica «no permitido».",
        "Su decisión se guarda en el almacenamiento de su navegador (Local Storage, valor «nd_consent»); solo contiene la categoría, el momento y un número de versión, sin ningún identificador de su persona. Al final de esta página puede modificarla o revocarla en cualquier momento.",
      ],
    },
    {
      heading: "Este sitio web",
      paragraphs: [
        "El sitio web de marketing no utiliza cookies. Las fuentes y los iconos se alojan en nuestro propio servidor — no se recurre a ningún servicio de iconos o fuentes de terceros para ello. El único servicio externo de esta página es la protección contra spam del formulario de contacto, que solo se carga con su consentimiento. Los detalles figuran en la [Política de privacidad](/datenschutz).",
      ],
    },
    {
      heading: "Cookies de la plataforma",
      paragraphs: [
        "En cuanto inicie sesión en el panel, en el mercado o en la vista móvil, se establecen las siguientes cookies:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — Inicio de sesión (técnicamente necesaria)",
          list: [
            "Finalidad: identifica su sesión iniciada ante el servidor.",
            "Contenido: token de acceso de corta duración; legible solo por el servidor (HttpOnly), transmitido únicamente por HTTPS.",
            "Duración: la sesión o hasta la expiración del token.",
          ],
        },
        {
          titel: "nd_refresh — Renovación de sesión (técnicamente necesaria)",
          list: [
            "Finalidad: renueva el token de acceso para que no tenga que iniciar sesión constantemente.",
            "Contenido: token de renovación; HttpOnly, solo por HTTPS.",
            "Duración: hasta el cierre de sesión o la expiración.",
          ],
        },
        {
          titel: "nd_locale — Selección de idioma (funcional)",
          list: [
            "Finalidad: recuerda el idioma que usted ha elegido.",
            "Contenido: código de idioma, p. ej. «de» o «en».",
            "Duración: hasta que se modifique o elimine.",
          ],
        },
        {
          titel: "sidebar_state — Barra lateral (funcional)",
          list: [
            "Finalidad: recuerda si la barra de navegación está desplegada o contraída.",
            "Contenido: «true» o «false».",
            "Duración: hasta que se modifique o elimine.",
          ],
        },
        {
          titel: "sb-… — Inicio de sesión con Google (técnicamente necesaria, solo si se utiliza)",
          list: [
            "Finalidad: mantiene la sesión cuando inicia sesión mediante Google.",
            "Contenido: token de sesión del servicio de inicio de sesión.",
            "Duración: la sesión o hasta la expiración del token. Solo se establece si elige el inicio de sesión con Google.",
          ],
        },
      ],
    },
    {
      heading: "Local Storage",
      unterpunkte: [
        {
          titel: "nd_consent",
          paragraphs: [
            "Guarda su decisión sobre la protección contra spam del formulario de contacto para que la barra de consentimiento no vuelva a preguntar en cada visita. Solo se almacenan la categoría, el momento y un número de versión. El valor no sale de su dispositivo ni se transmite a nuestro servidor; se aplica a este navegador. Si lo elimina, la barra volverá a preguntar en la próxima visita.",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Solo se establece si usted mismo abre el chat de este sitio web y envía un mensaje. Es la clave de su propia conversación — sin él no podría volver a encontrar nuestra respuesta tras cambiar de página. No contiene ningún dato sobre usted y se utiliza únicamente para este fin.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Guarda en el navegador si ha dado su consentimiento para el uso de la entrada de voz, de modo que no se vuelva a pedir en cada visita. El valor no sale de su dispositivo.",
          ],
        },
      ],
    },
    {
      heading: "Cookies de la aplicación móvil",
      paragraphs: [
        "La aplicación móvil no utiliza cookies. Los tokens de acceso y renovación se almacenan en el almacén seguro de claves del dispositivo (iOS Keychain, Android Keystore) y se eliminan al cerrar sesión.",
      ],
    },
    {
      heading: "Cookies de terceros",
      paragraphs: [
        "Cuando realiza un pago, el proveedor de servicios de pago (Stripe o PayPal) puede establecer en su propia página cookies necesarias para la tramitación y la prevención del fraude. Para ellas se aplican las condiciones del proveedor correspondiente.",
        "En los sitios web que los negocios crean con nuestro constructor, el negocio correspondiente decide sobre cookies adicionales y es responsable de los avisos que allí se muestren.",
      ],
    },
    {
      heading: "Eliminar y controlar las cookies",
      paragraphs: [
        "Puede eliminar o bloquear las cookies en cualquier momento desde la configuración de su navegador. Si bloquea las cookies necesarias, el inicio de sesión en la plataforma no será técnicamente posible — el sitio web público y el mercado siguen siendo utilizables sin iniciar sesión.",
        "Al cerrar sesión, nosotros mismos eliminamos las cookies de inicio de sesión.",
      ],
    },
    {
      heading: "Cambios en esta política",
      paragraphs: [
        "Si se añaden funciones que requieran cookies adicionales, actualizaremos esta lista. Se aplica siempre la versión publicada aquí; la fecha indicada arriba muestra su vigencia.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
