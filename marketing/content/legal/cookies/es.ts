// Spanische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Política de cookies",
  metaDescription:
    "Qué cookies utiliza myNextDays: cookies técnicamente necesarias y —solo con su consentimiento— cookies funcionales, analíticas y de marketing. Cada categoría se puede activar y desactivar individualmente.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Esta política explica qué cookies y técnicas de almacenamiento comparables utiliza ${ANBIETER.firma} en este sitio web y en la plataforma myNextDays.`,
    "En resumen: Solo son necesarias las cookies sin las cuales el sitio web no funciona como se solicita. Todo lo demás requiere su consentimiento y no se carga sin él: la protección contra spam de nuestro formulario de contacto, la medición de alcance y las cookies de marketing con las que medimos el éxito de nuestra publicidad. Puede permitir o denegar cada una de estas categorías individualmente y revocar su decisión en cualquier momento.",
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
        'Debe dar su consentimiento para tres categorías, que no se cargarán sin su permiso: la protección contra spam de nuestro formulario de contacto (reCAPTCHA de Google), la medición de alcance de este sitio web (Google Analytics 4) y las cookies de marketing (Meta, LinkedIn, Google Ads). Para ello, aparece una ventana con una lista de categorías —en la primera visita, sin preselección, cada categoría con su propio interruptor. Mientras no haya tomado una decisión, se aplica "no permitido", y no se realizará ninguna evaluación ni publicidad.',
        "Su decisión se guarda en el almacenamiento de su navegador (Local Storage, valor «nd_consent»); solo contiene la categoría, el momento y un número de versión, sin ningún identificador de su persona. A través del icono de cookies situado en la parte inferior izquierda de cada página puede modificarla o revocarla en cualquier momento. Transcurridos seis meses, volveremos a preguntar — un consentimiento no debe tener validez indefinida.",
      ],
    },
    {
      heading: "Este sitio web",
      paragraphs: [
        'Este sitio web no establece cookies por sí mismo. Las fuentes y los símbolos se encuentran en nuestro propio servidor; no se utiliza ningún servicio de símbolos o fuentes de terceros. Solo se añaden los servicios que usted permite: la protección contra spam del formulario de contacto, la medición de alcance y los servicios de marketing. Qué cookies se establecen, con qué duración y en qué host, se indica a continuación en la sección "Cookies de terceros". La revocación se realiza a través del icono de cookies en la parte inferior izquierda; el servicio correspondiente finaliza inmediatamente y sus cookies se eliminan. Los detalles se encuentran en la [Política de privacidad](/datenschutz).',
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
          titel:
            "sb-… — Inicio de sesión con Google (técnicamente necesaria, solo si se utiliza)",
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
            "Registra su decisión sobre los servicios que requieren consentimiento (protección contra spam del formulario de contacto y medición de audiencia).",
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
        "Solo con su consentimiento, los servicios de Google en este sitio web instalan las siguientes cookies: dos para la medición de audiencia y una para la protección contra spam. Sin su consentimiento, el script correspondiente no se cargará y ninguna de estas cookies se instalará; si lo revoca, las eliminaremos.",
      ],
      unterpunkte: [
        {
          titel:
            "_fbp — Medición de éxito de publicidad (requiere consentimiento)",
          list: [
            "Propósito: Asigna su visita a un anuncio para que podamos medir el éxito de nuestras campañas.",
            "Contenido: Un identificador generado aleatoriamente; no incluye su nombre, correo electrónico o información de cuenta de nuestra parte.",
            "Proveedor: Meta Platforms Ireland Limited, Merrion Road, Dublín 4, Irlanda.",
            "Host: mynextdays.com (cookie de origen, establecida por el script de Meta). Duración: aproximadamente tres meses.",
          ],
        },
        {
          titel:
            "_gcl_au — Medición de éxito de Google Ads (requiere consentimiento)",
          list: [
            "Propósito: Asigna su visita a un anuncio de Google para que podamos medir el éxito de nuestras campañas.",
            "Contenido: Un identificador generado aleatoriamente sin relación con su persona.",
            "Proveedor: Google Ireland Limited, Gordon House, Barrow Street, Dublín 4, Irlanda.",
            "Host: mynextdays.com (cookie de origen). Duración: aproximadamente tres meses.",
          ],
        },
        {
          titel:
            "li_gc y bcookie — Publicidad de LinkedIn (requiere consentimiento)",
          list: [
            "Propósito: Identifica su navegador ante LinkedIn para que los anuncios y su éxito puedan ser atribuidos; li_gc también almacena su consentimiento allí.",
            "Contenido: Un identificador de navegador y el estado del consentimiento; no incluye información de su cuenta con nosotros.",
            "Proveedor: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublín 2, Irlanda.",
            "Host: linkedin.com (cookies de terceros). Duración: aproximadamente seis meses o un año.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — Protección antispam del formulario de contacto (se requiere consentimiento)",
          list: [
            "Host: www.google.com (cookie de terceros).",
            "Propósito: permite a Google evaluar el riesgo, distinguiendo entre envíos masivos automatizados y consultas reales.",
            "Contenido: un identificador generado por Google para esta evaluación; no incluye su nombre, correo electrónico o datos de cuenta.",
            "Proveedor: Google Ireland Limited, Gordon House, Barrow Street, Dublín 4, Irlanda.",
            "Duración: determinada por Google, hasta seis meses. Se establece solo si ha permitido la protección antispam y ha abierto el formulario de contacto.",
          ],
        },
        {
          titel: "_ga — Medición de audiencia (se requiere consentimiento)",
          list: [
            "Host: mynextdays.com (cookie de origen, establecido por el script de Google).",
            "Propósito: distingue a los visitantes para que las visitas recurrentes no se cuenten dos veces.",
            "Contenido: identificador generado aleatoriamente sin relación con su persona; no hay datos de nombre, correo electrónico o cuenta.",
            "Proveedor: Google Ireland Limited, Gordon House, Barrow Street, Dublín 4, Irlanda.",
            "Duración: hasta dos años.",
          ],
        },
        {
          titel:
            "_ga_<ID> — Estado de la sesión de medición (se requiere consentimiento)",
          list: [
            "Host: mynextdays.com (cookie de origen, establecido por el script de Google).",
            "Propósito: registra cuándo comenzó su visita actual para que las visitas a páginas de una sesión pertenezcan juntas.",
            "Contenido: marca de tiempo y contador de la sesión; el identificador en el nombre se refiere a nuestra propiedad, no a usted.",
            "Proveedor: Google Ireland Limited.",
            "Duración: hasta dos años.",
          ],
        },
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
