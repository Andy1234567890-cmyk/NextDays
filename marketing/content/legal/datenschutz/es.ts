// Spanische Fassung der Datenschutzerklärung — Übersetzung von `de.ts`.
// Inhaltliche Änderungen gehören ZUERST in `de.ts` und werden von dort
// nachgezogen; hier wird ausschließlich übersetzt, nie ergänzt.
// Struktur (Abschnitte, Reihenfolge, Anzahl der Absätze und Unterpunkte) ist
// mit `de.ts` deckungsgleich zu halten.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Política de privacidad",
  metaDescription:
    "Cómo trata myNextDays los datos personales: finalidades, bases jurídicas, destinatarios, plazos de conservación y sus derechos conforme al RGPD.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Esta declaración describe cómo trata ${ANBIETER.firma} los datos personales — al visitar este sitio web, al utilizar la plataforma myNextDays (panel de control, mercado y aplicación móvil) y en el marco de la relación comercial con nuestros clientes.`,
    "No vendemos datos ni creamos perfiles que lo identifiquen como persona. En este sitio web medimos —solo con su consentimiento— el alcance de nuestras páginas y el éxito de nuestra publicidad; ambas categorías se pueden deseleccionar individualmente (véanse las secciones Medición de alcance y Publicidad y medición de éxito). Procesamos datos con fines publicitarios solo si usted ha dado su consentimiento explícito, por ejemplo, para nuestro boletín (véase la sección Comunicación), al que puede darse de baja en cualquier momento con un solo clic.",
  ],
  sections: [
    {
      heading: "Responsable del tratamiento",
      paragraphs: [
        "El responsable de los tratamientos descritos en esta declaración es:",
      ],
      zeilen: [
        {
          label: "Empresa",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Dirección",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Correo electrónico",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Teléfono",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Ámbito de aplicación y roles",
      unterpunkte: [
        {
          paragraphs: [
            "Respecto de la visita a este sitio web, de su cuenta de cliente y de la ejecución de nuestra relación comercial, somos responsables del tratamiento en el sentido del art. 4, punto 7, del RGPD.",
          ],
        },
        {
          paragraphs: [
            "Respecto de los datos que nuestros clientes (arrendadores, hoteles, agencias) tratan en la plataforma sobre sus huéspedes, propietarios y empleados, los clientes son responsables del tratamiento y nosotros, encargados del tratamiento conforme al art. 28 del RGPD. Los detalles constan en el [Contrato de encargo del tratamiento](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Si reserva como huésped un alojamiento a través de nuestro mercado, tratamos sus datos de reserva y de contacto tanto en nombre propio (explotación del mercado, tramitación del pago) como para el establecimiento anfitrión. Su contrato de hospedaje se celebra exclusivamente con el establecimiento; junto a esta declaración se aplican las indicaciones de protección de datos de dicho establecimiento.",
          ],
        },
      ],
    },
    {
      heading: "Visita a este sitio web",
      unterpunkte: [
        {
          titel: "Archivos de registro del servidor",
          paragraphs: [
            "Cada vez que se accede, su navegador transmite datos técnicamente necesarios que nuestro servidor web registra: dirección IP, fecha y hora, dirección solicitada, volumen de datos transferido, código de estado, referente e identificación del navegador. La finalidad es la puesta a disposición de la página, así como la detección y la defensa frente a ataques y perturbaciones. La base jurídica es el art. 6, apdo. 1, letra f), del RGPD; nuestro interés legítimo reside en un funcionamiento seguro y estable. Los registros se conservan únicamente durante el tiempo que resulta necesario para el funcionamiento y la seguridad, y no se combinan con otros datos.",
          ],
        },
        {
          titel: "Tipografías",
          paragraphs: [
            "Las tipografías utilizadas están integradas localmente en nuestro servidor. No se establece ninguna conexión con Google Fonts ni con otro servicio de tipografías.",
          ],
        },
        {
          titel: "Iconos",
          paragraphs: [
            "Los iconos de este sitio web se encuentran, igual que las tipografías, en nuestro servidor: se insertan en la página desde nuestro propio servidor y no se cargan posteriormente desde ningún servicio de iconos. En ese proceso no se establece ninguna conexión con un tercero y su dirección IP no se transmite a nadie.",
          ],
        },
        {
          titel: "Protección antispam del formulario de contacto (reCAPTCHA)",
          paragraphs: [
            "Nuestro formulario de contacto está protegido frente a los envíos masivos automatizados con reCAPTCHA Enterprise de Google Ireland Limited. Solo si usted lo consiente, su navegador carga al rellenar el formulario un script de www.google.com; en ese proceso se transmiten a Google su dirección IP y los datos sobre su interacción con el formulario, que allí se analizan para distinguir entre una persona y un script. La base jurídica es el art. 6, apdo. 1, letra a), del RGPD (consentimiento); con carácter complementario se aplica la [política de privacidad de Google](https://policies.google.com/privacy).",
            "Sin su consentimiento, no se cargará nada de Google y no se transferirán datos a Google; en ese caso, no aceptaremos el formulario, pero siempre puede enviarnos un correo electrónico. Si lo otorga, reCAPTCHA establecerá su propia cookie (_GRECAPTCHA, duración establecida por Google, hasta seis meses), que se utiliza para la evaluación de riesgos. Puede cambiar o revocar su consentimiento en cualquier momento a través del icono de cookies en la parte inferior izquierda de cada página; la cookie se eliminará entonces.",
          ],
        },
        {
          titel: "Medición de alcance (Google Analytics)",
          paragraphs: [
            "En este sitio web, utilizamos Google Analytics 4 de Google Ireland Limited para medir cómo se utilizan nuestras páginas: qué páginas se visitan, de dónde provienen los visitantes y en qué punto abandonan. El único propósito es mejorar la oferta y la visibilidad.",
            'La carga se realiza exclusivamente con su consentimiento. Si lo otorga, su navegador cargará un script de www.googletagmanager.com y almacenará dos cookies ("_ga" y "_ga_<ID>", con una duración de hasta dos años) con un identificador generado aleatoriamente; se transmitirán este identificador, las páginas visitadas, la fuente de referencia, la ubicación aproximada a nivel de país o región, el dispositivo y el navegador, así como su dirección IP, que Google acorta antes de cada almacenamiento. La base legal es el Art. 6 Párr. 1 lit. a del RGPD (consentimiento).',
            "Hemos restringido explícitamente la evaluación: las señales de Google y la personalización de anuncios están desactivadas. Por lo tanto, no se crean perfiles entre dispositivos ni audiencias para publicidad, y no compartimos datos de uso con redes publicitarias. No se realiza ninguna combinación con su cuenta de cliente.",
            "Google procesa los datos como nuestro encargado del tratamiento en virtud de un contrato conforme al Art. 28 del RGPD (Condiciones de procesamiento de datos de Google Ads). Su dirección IP se acorta en servidores de la UE antes de que los datos se transfieran a EE. UU.; por lo tanto, se transmite un conjunto de datos seudonimizado. La base de la transferencia es la decisión de adecuación de la Comisión de la UE para el Marco de Privacidad de Datos UE-EE. UU. (Art. 45 del RGPD), bajo el cual Google LLC está certificada; además, Google ha incluido las cláusulas contractuales tipo de la Comisión de la UE (Art. 46 del RGPD). Advertimos expresamente que las autoridades estadounidenses, según la Sección 702 de la FISA, también pueden acceder a los datos de empresas certificadas y, por lo tanto, no se puede excluir por completo un riesgo residual. Además, se aplica la [Política de privacidad de Google](https://policies.google.com/privacy).",
            "Duración del almacenamiento: Los datos relacionados con eventos y usuarios se eliminan automáticamente de nuestra propiedad después de 14 meses; los datos de informes agregados sin referencia a visitantes individuales se conservan más allá de ese período. Su consentimiento caduca después de seis meses.",
            "Sin su consentimiento, no se carga nada, no se establece ninguna cookie y no se transfieren datos a Google. Puede revocar su consentimiento en cualquier momento a través del icono de cookie en la parte inferior izquierda de cada página; la medición finalizará inmediatamente y las cookies mencionadas se eliminarán. Después de seis meses, le preguntaremos de nuevo.",
          ],
        },
        {
          titel: "Publicidad y medición de resultados",
          paragraphs: [
            "Con su consentimiento, utilizamos cookies de marketing para medir el éxito de nuestra publicidad y mostrarle anuncios relevantes en otras plataformas. Participan Meta Platforms Ireland (Meta-Pixel, cookie _fbp), LinkedIn Ireland (Insight-Tag, cookies li_gc y bcookie) y Google Ireland Limited (Google Ads, cookie _gcl_au). La base legal es el Art. 6, párrafo 1, letra a del RGPD. Sin su consentimiento, ninguno de estos scripts se cargará y ninguna cookie se establecerá; en caso de revocación, los eliminaremos. Los detalles de cada cookie se encuentran en la [Política de Cookies](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Cuenta de cliente y uso de la plataforma",
      paragraphs: [
        "Para el registro y la gestión de una cuenta tratamos los datos que usted o su establecimiento introducen: nombre, denominación social y forma jurídica, dirección, dirección de correo electrónico, número de teléfono, rol y permisos, datos registrales (p. ej., número de registro mercantil o número de identificación fiscal), datos bancarios para los desembolsos, así como los contenidos que se creen en la cuenta.",
        "Para proteger el acceso tratamos además registros de inicio de sesión (momento, dirección IP, dispositivo y navegador del inicio de sesión) y —si está activada— los datos de la autenticación de doble factor.",
        "Inicio de sesión con Google: en lugar de con correo electrónico y contraseña, también puede iniciar sesión con una cuenta de Google. Si elige esta vía, Google Ireland Limited nos facilita exclusivamente su dirección de correo electrónico, su nombre, su imagen de perfil y un identificador de su cuenta de Google (ámbitos «openid», «email», «profile») y, expresamente, ningún acceso a sus correos electrónicos, contactos, archivos o calendarios. No conocemos su contraseña de Google. Google trata el proceso de inicio de sesión como responsable independiente; se aplica la [política de privacidad de Google](https://policies.google.com/privacy). La base jurídica es el art. 6, apdo. 1, letra b), del RGPD, ya que el inicio de sesión sirve a la ejecución del contrato; la elección de esta vía de acceso es voluntaria y puede sustituirse en cualquier momento por el inicio de sesión con correo electrónico y contraseña.",
        "La base jurídica es el art. 6, apdo. 1, letra b), del RGPD (cumplimiento del contrato de uso, véanse las [CGC](" +
          AGB_URL +
          ")); para la protección del acceso, el art. 6, apdo. 1, letra f), del RGPD y, para la conservación fiscal y mercantil, el art. 6, apdo. 1, letra c), del RGPD.",
      ],
    },
    {
      heading: "Reservas, datos de huéspedes y de alojamientos",
      paragraphs: [
        "A través de la plataforma se tratan reservas, datos de huéspedes, mensajes, tareas y liquidaciones. Ello incluye, en particular, el nombre y los datos de contacto del huésped, la llegada y la salida, el número de viajeros, los precios y el estado del pago, los historiales de mensajes, así como —cuando el establecimiento los registre— los datos de registro de viajeros y las peticiones especiales.",
        "Este tratamiento se realiza por encargo y siguiendo las instrucciones del establecimiento correspondiente. No utilizamos estos datos para fines propios, ni para publicidad, ni para el entrenamiento de modelos de IA.",
        "Dentro de un establecimiento, los datos están separados por roles: el personal de limpieza y de servicio no ve datos financieros ni comerciales, y los propietarios solo ven sus propios alojamientos. Entre distintos establecimientos, los datos están separados técnicamente (reglas de acceso específicas de cada cliente en la base de datos).",
      ],
    },
    {
      heading: "Tramitación de pagos",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Los pagos con tarjeta y los desembolsos se tramitan a través de Stripe Payments Europe, Limited, Irlanda. En ese proceso se transmiten a Stripe los datos necesarios para el pago (importe, moneda, medio de pago, nombre, dirección de correo electrónico, referencia de la reserva) y, en el caso de las cuentas de nuestros clientes, los datos de identificación legalmente exigidos (titular, titulares reales, datos del documento de identidad, datos bancarios). Los datos completos de tarjeta no llegan a nuestros sistemas. Las bases jurídicas son el art. 6, apdo. 1, letra b), del RGPD y, para las obligaciones de identificación y de prevención del blanqueo de capitales, el art. 6, apdo. 1, letra c), del RGPD. Los detalles se regulan en la [política de privacidad de Stripe](https://stripe.com/privacy).",
            "Enlaces de pago para servicios adicionales: si un establecimiento factura a su huésped un servicio adicional (p. ej., limpieza o lavandería) mediante un enlace de pago, dicho enlace conduce a una página de pago operada por Stripe. Para ello transmitimos a Stripe la denominación del servicio, el importe, la moneda y una referencia interna a la reserva y al establecimiento; el logotipo de la empresa del establecimiento se transfiere a su cuenta de Stripe para que la página muestre su marca. En la propia página de pago, Stripe recaba los datos de pago y de dispositivo del huésped bajo su propia responsabilidad. A nosotros solo regresan el estado del pago, el importe, los importes retenidos y los identificadores del pago; ningún dato de tarjeta.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Si el establecimiento ofrece PayPal como forma de pago, los datos de pago se transmiten a PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburgo. Se aplica la [política de privacidad de PayPal](https://www.paypal.com/de/webapps/mpp/ua/privacy-full).",
          ],
        },
      ],
    },
    {
      heading: "Canales de distribución y portales",
      paragraphs: [
        "Cuando un establecimiento vende sus alojamientos a través de portales como Booking.com, Airbnb o Expedia, las disponibilidades, los precios, las restricciones y los datos de reserva se intercambian con el portal correspondiente a través de nuestro prestador de conexión Channex.io Ltd, Reino Unido. Desde esa misma dirección recibimos los datos de reserva y de huéspedes del portal.",
        "Para cada portal se aplican sus propias disposiciones de protección de datos; en esa medida, el portal es responsable de forma autónoma. La base jurídica de la transmisión es el art. 6, apdo. 1, letra b), del RGPD, en relación con el encargo del establecimiento.",
      ],
    },
    {
      heading: "Comunicación",
      unterpunkte: [
        {
          titel: "Correo electrónico",
          paragraphs: [
            "Los correos electrónicos en el marco del uso (confirmaciones de reserva, mensajes del sistema, soporte, enlaces de confirmación y de invitación) los enviamos y recibimos a través de un servidor de correo propio que explotamos nosotros mismos. Para estos mensajes no se recurre a ningún servicio de envío externo.",
          ],
        },
        {
          titel: "Boletín y preinscripción",
          paragraphs: [
            "En nuestro sitio web puede suscribirse a las novedades sobre myNextDays (preinscripción/boletín). En ese proceso se tratan su dirección de correo electrónico, el idioma y el lugar en el que se ha suscrito.",
            "La suscripción se realiza mediante el procedimiento de doble confirmación (double opt-in): tras suscribirse recibirá un correo electrónico con un enlace de confirmación; la suscripción solo será efectiva al hacer clic en él. Como prueba del consentimiento conservamos el momento de la suscripción y de la confirmación, la dirección IP utilizada, la identificación del navegador y el texto al que ha dado su consentimiento. Estos datos sirven exclusivamente como prueba conforme al art. 7, apdo. 1, del RGPD y no se analizan con fines publicitarios.",
            "La base jurídica es su consentimiento conforme al art. 6, apdo. 1, letra a), del RGPD; la conservación de la prueba la basamos en el art. 6, apdo. 1, letra c), en relación con el art. 7, apdo. 1, del RGPD. Puede retirar el consentimiento en cualquier momento con efectos para el futuro, a través del enlace de baja de cada correo del boletín o sin formalidad alguna por correo electrónico dirigido a nosotros. La retirada no afecta a la licitud del tratamiento realizado hasta ese momento.",
            "Para la gestión y el envío de los boletines recurrimos a Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Francia; sucursal alemana: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin) como encargado del tratamiento. Se transmiten su dirección de correo electrónico y los datos adicionales indicados (idioma, origen). Los datos se tratan en servidores situados dentro de la Unión Europea (Francia y Alemania); con Brevo existe un contrato de encargo del tratamiento conforme al art. 28 del RGPD. Se aplica la [política de privacidad de Brevo](https://www.brevo.com/legal/privacypolicy/).",
            "Cuando enviamos un boletín, Brevo mide por nuestro encargo si el mensaje se ha abierto y si se ha hecho clic en los enlaces que contiene. Esta medición nos ayuda a ajustar el contenido y la frecuencia; forma parte del consentimiento y finaliza con su baja. No se produce ninguna combinación con otras fuentes de datos ni ninguna elaboración de perfiles.",
            "Mientras la confirmación esté pendiente, su dirección no recibe ningún envío y no se transmite a Brevo; una suscripción no confirmada caduca al cabo de siete días. Tras una baja, bloqueamos la dirección para el envío y conservamos la prueba del consentimiento y de la baja mientras puedan ejercerse pretensiones derivadas de ella; si así lo solicita, la suprimimos por completo.",
          ],
        },
        {
          titel: "Mensajes en la plataforma",
          paragraphs: [
            "Los mensajes entre el huésped y el establecimiento se almacenan en la plataforma para que ambas partes puedan consultar el historial. Si un establecimiento bloquea a un huésped, el canal de mensajes queda cerrado; los mensajes existentes se conservan para su trazabilidad.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Si un establecimiento utiliza la conexión con WhatsApp, los contenidos de los mensajes y los números de teléfono de los participantes se transmiten a través de la WhatsApp Business Platform de Meta Platforms Ireland Limited. El uso de esta función lo decide el establecimiento; sin activación no se produce ninguna transmisión.",
          ],
        },
      ],
    },
    {
      heading: "Funciones automatizadas e IA",
      paragraphs: [
        "A las funciones aquí descritas se les aplica, además del RGPD, el Reglamento (UE) 2024/1689 (Reglamento de Inteligencia Artificial, «AI Act»), cuyas obligaciones de transparencia conforme al art. 50 son aplicables desde el 2 de agosto de 2026.",
      ],
      unterpunkte: [
        {
          titel: "Propuestas de respuesta",
          paragraphs: [
            "Para las propuestas de respuesta en la bandeja de entrada de mensajes recurrimos —siempre que la función esté activada para el establecimiento— a la oferta de modelos de lenguaje de Groq, Inc., EE. UU. En ese proceso se transmite al servicio el contexto del mensaje correspondiente. Las propuestas no se envían automáticamente; sobre el envío decide siempre una persona. No se produce ninguna decisión automatizada con efectos jurídicos en el sentido del art. 22 del RGPD.",
            "No se trata, por tanto, de un sistema de IA que interactúe directamente con personas físicas en el sentido del art. 50, apdo. 1, del Reglamento de Inteligencia Artificial: la obligación presupone una interacción DIRECTA en la que la propia IA se comunica con la persona y no a través de un intermediario humano. Aquí la función propone al establecimiento un texto que un empleado revisa, puede modificar y envía él mismo — el empleado es ese intermediario, y el huésped se comunica con el establecimiento y no con un chatbot. No se emplea ningún asistente que responda de forma automática. Según nuestra valoración, la función tampoco cumple ninguno de los supuestos de IA de alto riesgo del anexo III del Reglamento de Inteligencia Artificial.",
            "Los mensajes a los huéspedes tampoco son un «texto sobre asuntos de interés público» en el sentido del art. 50, apdo. 4, del Reglamento de Inteligencia Artificial: no se publican, sino que se envían individualmente a una persona determinada, y se refieren a la gestión de una estancia. Con independencia de ello, aquí interviene la revisión humana del empleado que realiza el envío.",
            "Si en el futuro se ofreciera una función que respondiera a los huéspedes por sí misma, sin aprobación humana, se advertirá al huésped de forma visible al inicio del diálogo de que está escribiendo con un sistema de IA. Sin esa advertencia, tal función no se pondrá a disposición.",
          ],
        },
        {
          titel: "Asesor de producto en este sitio web",
          paragraphs: [
            "En este sitio web, un asesor de producto basado en IA responde preguntas sobre nuestro software. Accede exclusivamente a contenido disponible públicamente en este sitio web (artículos de ayuda, descripciones de funciones, preguntas frecuentes, textos legales) así como a los precios actuales de nuestra facturación. Los datos de clientes, reservas o huéspedes no están a su disposición.",
            "A diferencia de las sugerencias de respuesta en la bandeja de entrada, este asesor responde INMEDIATAMENTE y sin aprobación humana. Por lo tanto, es un sistema de IA en el sentido del Artículo 50, párrafo 1 del Reglamento de IA, que interactúa directamente con personas físicas. Por ello, al inicio del diálogo, se le informará visiblemente de que las respuestas provienen de un asistente de IA y pueden contener errores.",
            "Se procesan su pregunta y el idioma seleccionado. Ambos se transmiten a Google Cloud (Vertex AI) en la región europe-west4 (Países Bajos) para su respuesta; no se realiza ningún procesamiento fuera de la UE. No almacenamos las preguntas de forma permanente y no las utilizamos para entrenar modelos de IA. La base legal es nuestro interés legítimo en proporcionar información rápida a los interesados (Artículo 6, párrafo 1, letra f del RGPD).",
            "Si el asesor no puede responder una pregunta con el contenido existente, ofrece la opción de redirigirla a nuestro soporte. Solo entonces, y solo si completa el formulario, recopilaremos su nombre, dirección de correo electrónico y, opcionalmente, su número de teléfono; procesamos esta información de acuerdo con las reglas de la sección «Comunicación».",
          ],
        },
        {
          titel: "Roles conforme al Reglamento de Inteligencia Artificial",
          paragraphs: [
            "Respecto de las funciones de IA integradas en el producto, somos responsables del despliegue en el sentido del art. 3, punto 4, del Reglamento de Inteligencia Artificial; proveedores de los modelos de lenguaje subyacentes son los respectivos proveedores de modelos. Si un establecimiento utiliza estas funciones en el marco de su actividad profesional, será a su vez responsable del despliegue y le corresponderá la obligación de alfabetización en materia de IA conforme al art. 4 del Reglamento de Inteligencia Artificial, que se aplica desde el 2 de febrero de 2025 con independencia del tamaño de la empresa. Desde el 27 de julio de 2026 se aplica en la redacción del Reglamento (UE) 2026/1744: los proveedores y los responsables del despliegue adoptan medidas para apoyar el desarrollo de la alfabetización en materia de IA de su personal, sin que deba garantizarse expresamente un nivel determinado. Nosotros prestamos apoyo mediante indicaciones en la aplicación y en nuestro centro de ayuda; la formación de sus propios empleados sigue siendo tarea del establecimiento.",
            "Si un establecimiento conecta su cuenta con un asistente de IA propio (véase el punto siguiente), será también responsable del despliegue en el sentido del Reglamento de Inteligencia Artificial: él decide sobre su uso y formula las consultas. La interfaz en sí no es un sistema de IA: lee datos de la base de datos y los devuelve, sin realizar inferencias; el considerando 12 del Reglamento de Inteligencia Artificial delimita expresamente tales sistemas frente a la IA.",
          ],
        },
        {
          titel: "Conexión con un asistente de IA propio",
          paragraphs: [
            "Un establecimiento puede conectar su cuenta, a través de una interfaz, con un asistente de IA que él mismo haya elegido y con el que tenga un contrato propio, por ejemplo Claude de Anthropic PBC, EE. UU. Si se ha otorgado tal conexión, el asistente puede consultar en modo de lectura, a petición del establecimiento: ocupación, disponibilidad y precios diarios; reservas con nombre del huésped, periodo de estancia, alojamiento, canal de reserva, estado, así como importe y moneda, en la medida en que el rol de la cuenta consultante pueda ver importes; y el resumen de las conversaciones de la bandeja de entrada. Sin una conexión otorgada no se produce ninguna transmisión.",
            "No se transmiten la dirección de correo electrónico ni el número de teléfono de los huéspedes, los datos de tarjeta, los datos bancarios y los justificantes de pago, los códigos de acceso ni los dosieres de los alojamientos. Las notas de reserva y el contenido de los mensajes de los huéspedes están excluidos por defecto, porque pueden contener datos relativos a la salud u otras categorías especiales conforme al art. 9 del RGPD; el establecimiento debe habilitarlos de forma expresa y separada al otorgar la conexión.",
            "La conexión solo puede otorgarla una cuenta con el rol «administrador», no cualquier cuenta con acceso. Cada consulta se registra y el establecimiento puede consultarla en «Cuenta → Conexiones»; allí puede interrumpir la conexión en cualquier momento, con lo que el acceso finaliza de inmediato.",
            "Jurídicamente, esta transmisión es una instrucción del establecimiento dirigida a nosotros (art. 28, apdo. 3, letra a), del RGPD). El proveedor del asistente no es un subencargado del tratamiento nuestro: no lo contratamos ni le damos instrucciones; trata los datos en virtud del contrato que el propio establecimiento ha celebrado con él. Por ello, de la base jurídica de este tratamiento, de la información a sus huéspedes y de las garantías de una transmisión a un tercer país responde el establecimiento.",
          ],
        },
        {
          titel: "Traducciones",
          paragraphs: [
            "Los textos de los alojamientos y de los contenidos pueden traducirse a través de la Cloud Translation API de Google Ireland Limited. Se transmiten los textos que deben traducirse; datos personales, solo en la medida en que estén contenidos en dichos textos.",
          ],
        },
        {
          titel: "Recomendaciones de precios",
          paragraphs: [
            "Para las recomendaciones de precios accedemos a datos de mercado, meteorológicos y de tipos de cambio de fuentes externas. Estas consultas no contienen datos personales, sino únicamente lugar, periodo y características del alojamiento.",
          ],
        },
      ],
    },
    {
      heading: "Sitios web y dominios de nuestros clientes",
      paragraphs: [
        "Si un establecimiento crea con el editor de páginas un sitio web propio con dominio propio, gestionamos las entradas DNS necesarias a través de Cloudflare, Inc. En ese proceso se transmiten datos de dominio y de configuración; los datos de los visitantes del sitio web del cliente los tratamos como se describe en esta declaración.",
        "De los contenidos, del aviso legal y de las indicaciones de protección de datos del sitio web del cliente responde el establecimiento correspondiente.",
      ],
    },
    {
      heading: "Programa de afiliados",
      paragraphs: [
        "Operamos un programa de afiliados a través del cual los socios (influencers, consultores, agencias, clientes) pueden recomendar negocios a myNextDays y recibir una comisión por ello. En este proceso, tratamos datos de los socios y, en menor medida, de los negocios recomendados.",
      ],
      unterpunkte: [
        {
          titel: "Datos de los socios",
          paragraphs: [
            "Durante la solicitud, tratamos el nombre, la empresa, la forma jurídica, el país, la dirección de correo electrónico, el idioma, las cuentas de redes sociales (plataforma, dirección, identificador, alcance autodeclarado), el número de identificación fiscal (verificación a través del sistema VIES de la UE), los datos de pago (IBAN, dirección de Wise o PayPal), así como la aceptación de los términos y condiciones con la versión y la fecha. La base jurídica es la ejecución del contrato de afiliación (Art. 6, apdo. 1, letra b del RGPD); para los créditos y la conservación, se aplican las obligaciones fiscales y mercantiles (Art. 6, apdo. 1, letra c del RGPD).",
            "Si un socio dirige un equipo, puede ver el nombre o la empresa de sus socios de equipo, el rango, el número de clientes de pago y la comisión de equipo resultante. Los mensajes entre el patrocinador y el socio de equipo se almacenan en la plataforma para que ambos puedan ver el historial.",
          ],
        },
        {
          titel: "Clics en enlaces de afiliados",
          paragraphs: [
            "Cuando un visitante accede a un enlace de afiliado (mynextdays.com/p/CODE), almacenamos el código, la hora, la página visitada, la página de referencia y cualquier parámetro de campaña, así como la dirección IP y el identificador del navegador, exclusivamente como sumas de comprobación abreviadas (hash), para la detección de abusos (acumulaciones), no para la reidentificación. No se establece ninguna cookie de seguimiento. Eliminamos los datos de clics después de 90 días. La base jurídica es nuestro interés legítimo en una facturación del programa a prueba de fraudes (Art. 6, apdo. 1, letra f del RGPD).",
          ],
        },
        {
          titel: "Cuentas y publicaciones de redes sociales conectadas",
          paragraphs: [
            "Los socios pueden conectar voluntariamente sus cuentas de YouTube (Google), Instagram y Facebook (Meta), así como TikTok, con el panel de control de socios. Al hacerlo, otorgan a la plataforma correspondiente un permiso de lectura (OAuth); nosotros no escribimos nada en estas cuentas. Almacenamos el identificador y el nombre de la cuenta, el token de acceso cifrado, la hora de la conexión y, diariamente, una métrica por cuenta: número de seguidores o suscriptores, visualizaciones de los últimos 28 días, tasa de interacción y número de publicaciones, cada uno con la hora de la respuesta de la plataforma. Para las publicaciones que el socio crea en el panel de control (título, plataforma, dirección, fecha de publicación), almacenamos adicionalmente las visualizaciones, los me gusta, los comentarios, las comparticiones y los guardados de la plataforma.",
            "La finalidad es verificar el alcance indicado por el socio y asignar clics y clientes a publicaciones individuales; la información no verificada se pondera menos en la aprobación. Las indicaciones de inconsistencias (por ejemplo, un salto de seguidores sin las vistas correspondientes) se utilizan exclusivamente para nuestra revisión manual y no dan lugar a ninguna decisión automatizada. La base jurídica es el consentimiento del socio (art. 6, apdo. 1, letra a del RGPD), que otorga al conectar y puede revocar en cualquier momento en el panel de control en «Desconectar»; al desconectar, eliminamos el token de acceso inmediatamente, los valores medidos guardados permanecen como historial y se eliminan con la cuenta del socio. Utilizamos exclusivamente las interfaces oficiales de las plataformas; para el tratamiento por parte de Google, Meta y TikTok, se aplican sus propias políticas de privacidad.",
          ],
        },
        {
          titel: "Empresas recomendadas",
          paragraphs: [
            "Si una empresa se registra con un código de socio, almacenamos la asignación de la empresa al socio, así como la hora, el método (enlace o código) y el estado. El socio ve la empresa exclusivamente de forma seudónima (número de serie, país, estado, importes), nunca el nombre, la dirección de correo electrónico o los datos de reserva. Solo si la empresa da su consentimiento expreso al registrarse, el socio podrá ponerse en contacto con ella a través de la plataforma. Para la liquidación de comisiones, procesamos los importes netos de las suscripciones de las facturas pagadas de la empresa; la base jurídica es la ejecución del contrato de socio y del contrato de uso (art. 6, apdo. 1, letra b del RGPD).",
          ],
        },
      ],
    },
    {
      heading: "Alojamiento y almacenamiento",
      paragraphs: [
        "La plataforma, la base de datos, los medios y el servidor de correo funcionan en servidores de Hetzner Online GmbH, Alemania, en el centro de datos de Helsinki (Finlandia), es decir, dentro de la Unión Europea. Con Hetzner existe un contrato de encargo del tratamiento.",
        "Las copias de seguridad se crean cifradas y se conservan cifradas en un proveedor de almacenamiento situado dentro de la UE.",
      ],
    },
    {
      heading: "Resumen de los destinatarios",
      paragraphs: [
        "Al margen de los prestadores mencionados, solo comunicamos datos personales cuando estamos legalmente obligados a ello (p. ej., autoridades tributarias, persecución penal) o cuando usted o el establecimiento responsable lo solicitan.",
      ],
      list: [
        "Hetzner Online GmbH (Alemania/Finlandia) — alojamiento, base de datos, medios, servidor de correo",
        "Stripe Payments Europe, Limited (Irlanda) — pagos, desembolsos, verificación de identidad",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxemburgo) — pagos, si está activado",
        "Channex.io Ltd (Reino Unido) — conexión con los portales de reserva",
        "Meta Platforms Ireland Limited (Irlanda) — mensajes de WhatsApp, si está activado",
        "Sendinblue SAS / Brevo (Francia, Alemania) — gestión y envío del boletín, solo con consentimiento",
        "Google Ireland Limited (Irlanda) — traducciones; protección antispam del formulario de contacto (reCAPTCHA Enterprise), solo con consentimiento; inicio de sesión con Google, si se utiliza; Medición de alcance (Google Analytics 4), solo con consentimiento",
        "Groq, Inc. (EE. UU.) — propuestas de respuesta, si está activado",
        "Cloudflare, Inc. (EE. UU.) — gestión de DNS para dominios de clientes",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "En esta lista no figuran los servicios que un establecimiento acuerda por sí mismo con un tercero y conecta con su cuenta a través de la interfaz, por ejemplo un asistente de IA como Claude de Anthropic PBC, EE. UU. No son prestadores contratados por nosotros, sino destinatarios que reciben los datos siguiendo instrucciones del establecimiento correspondiente; sin la conexión de este, allí no fluye ningún dato. Según la lista oficial de participantes del Departamento de Comercio de EE. UU., Anthropic no está certificada en el marco del EU-US Data Privacy Framework; por ello, una transmisión se basa en las cláusulas contractuales tipo, de las que debe responder el establecimiento correspondiente como responsable del tratamiento.",
          ],
        },
      ],
    },
    {
      heading: "Transmisión a terceros países",
      paragraphs: [
        "El tratamiento se realiza, en principio, dentro de la UE. En los servicios mencionados con sede fuera de la UE puede producirse una transmisión a un tercer país.",
        "En el caso de Groq, Inc. y Cloudflare, Inc. (EE. UU.), basamos la transmisión en las cláusulas contractuales tipo de la Comisión Europea conforme al art. 46, apdo. 2, letra c), del RGPD, en la medida en que el destinatario no pueda invocar una decisión de adecuación (EU-US Data Privacy Framework).",
        "La parte contratante de la tramitación de pagos es Stripe Payments Europe, Limited (Irlanda). En la medida en que Stripe recurra para ello a Stripe, LLC (EE. UU.), esta está certificada en el marco del EU-US Data Privacy Framework; en ese punto, la transmisión se basa en la decisión de adecuación de la Comisión Europea conforme al art. 45 del RGPD. Con carácter complementario se aplican las cláusulas contractuales tipo del [contrato de encargo del tratamiento de Stripe](https://stripe.com/legal/dpa).",
        "Para Channex.io Ltd (Reino Unido) se aplica la decisión de adecuación de la Comisión Europea relativa al Reino Unido; si esta deja de existir, se aplicarán las cláusulas contractuales tipo.",
      ],
    },
    {
      heading: "Acceso de autoridades de terceros Estados (US CLOUD Act)",
      paragraphs: [
        "Los prestadores sujetos a una jurisdicción estadounidense pueden verse obligados, en virtud del CLOUD Act de los Estados Unidos (Clarifying Lawful Overseas Use of Data Act, 2018), a entregar datos a autoridades estadounidenses, incluso cuando esos datos se encuentren en servidores situados dentro de la Unión Europea. Tal acceso puede resultar contrario al RGPD, y el prestador puede estar jurídicamente impedido para informarnos a nosotros o a usted al respecto. Ni la decisión de adecuación relativa al EU-US Data Privacy Framework ni las cláusulas contractuales tipo excluyen este riesgo.",
        "Limitamos este riesgo haciendo que los sistemas centrales —plataforma, base de datos, medios, servidor de correo y copias de seguridad— se exploten en prestadores europeos dentro de la UE, donde no rige ninguna jurisdicción estadounidense.",
      ],
      unterpunkte: [
        {
          titel: "Servicios afectados",
          paragraphs: [
            "Una jurisdicción estadounidense solo puede entrar en consideración en los siguientes servicios adicionales, claramente delimitados:",
          ],
          list: [
            "Groq, Inc. (EE. UU.) — propuestas de respuesta en la bandeja de entrada de mensajes, solo si el establecimiento activa la función. Se transmite el contexto del mensaje correspondiente.",
            "Cloudflare, Inc. (EE. UU.) — gestión de DNS para dominios de clientes. Se transmiten datos de dominio y de configuración, ningún dato de huéspedes.",
            "Google LLC (EE. UU.) — al iniciar sesión con Google, en las traducciones y en la medición de alcance (Google Analytics 4, solo con consentimiento); el socio contractual es Google Ireland Limited, sin embargo, no se excluye el acceso de la empresa matriz estadounidense.",
          ],
        },
        {
          titel: "Evitabilidad",
          paragraphs: [
            "El uso de la plataforma es posible sin estos servicios: las propuestas de respuesta se pueden desactivar, la gestión de DNS solo afecta a los clientes con dominio propio y el inicio de sesión con Google es una alternativa voluntaria al inicio de sesión con correo electrónico y contraseña.",
          ],
        },
        {
          titel: "Delimitación frente al Derecho europeo",
          paragraphs: [
            "El CLOUD Act es Derecho de los Estados Unidos, no Derecho de la Unión Europea. Debe distinguirse del EU Data Act (Reglamento (UE) 2023/2854), que regula el cambio de proveedor y la portabilidad en los servicios de tratamiento de datos, así como del Cloud and AI Development Act, que a la fecha de esta declaración se encuentra en el procedimiento legislativo europeo.",
          ],
        },
      ],
    },
    {
      heading: "Plazos de conservación",
      list: [
        "Datos de la cuenta: durante la vigencia de la relación comercial; después, supresión, salvo que exista una obligación de conservación.",
        "Datos de reservas, de facturación y de pagos: conforme a la ley danesa de contabilidad, cinco años desde el final del ejercicio al que corresponden; en el caso de clientes con sede en Alemania pueden aplicarse plazos mercantiles y fiscales más largos.",
        "Mensajes y datos de huéspedes en la plataforma: siguiendo las instrucciones del establecimiento responsable, como máximo hasta su supresión por parte de este o hasta la finalización del contrato.",
        "Boletín: hasta la retirada del consentimiento; las suscripciones no confirmadas caducan al cabo de siete días. La prueba del consentimiento y de la baja se conserva más allá de ese momento, mientras siga siendo necesaria como prueba.",
        "Registros de inicio de sesión y eventos de seguridad: a corto plazo, para la detección de ataques.",
        "Archivos de registro del servidor: únicamente durante el tiempo que resulta necesario para el funcionamiento y la seguridad.",
        "Copias de seguridad: de forma rotatoria, hasta que sean sustituidas por copias más recientes.",
      ],
    },
    {
      heading: "Sus derechos",
      paragraphs: [
        "Le asisten el derecho de acceso (art. 15), de rectificación (art. 16), de supresión (art. 17), de limitación del tratamiento (art. 18), de portabilidad de los datos (art. 20) y de oposición a los tratamientos basados en intereses legítimos (art. 21 del RGPD). Un consentimiento otorgado puede retirarlo en cualquier momento con efectos para el futuro.",
        `Diríjase para ello a [${ANBIETER.email}](mailto:${ANBIETER.email}). Si sus datos se refieren al uso de la plataforma por parte de un establecimiento, remitiremos su solicitud al establecimiento responsable o le prestaremos apoyo en la respuesta.`,
        `Además, puede presentar una reclamación ante una autoridad de control de protección de datos; la competente para nosotros es ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). También puede dirigirse a la autoridad de control de su lugar de residencia.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Ein Abschnitt „Ihre Rechte", der die
      // Löschung nur als DSGVO-Artikel erwähnt, genügt der Prüfung nicht —
      // gefordert ist der konkrete, benannte Weg.
      heading: "Suprimir la cuenta y los datos de la aplicación",
      paragraphs: [
        "La supresión de su cuenta puede solicitarla usted mismo en cualquier momento, en la aplicación en «Perfil → Cuenta» o a través de nuestro formulario en la web:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "La vía web funciona deliberadamente también cuando ya no tiene la aplicación instalada o cuando ya no puede iniciar sesión. Para proteger frente a un uso indebido, esto se realiza en dos pasos: usted indica la dirección de correo electrónico de su cuenta y recibe en esa misma dirección un enlace de confirmación. Solo al abrirlo la solicitud es válida; una dirección indicada por sí sola no produce ningún efecto. Tramitamos la solicitud en un plazo de 30 días y respondemos por correo electrónico.",
        "Con la cuenta suprimimos sus credenciales de acceso, su perfil, los datos de sus alojamientos y de su calendario, así como sus mensajes. No se suprimen los documentos respecto de los que existe una obligación legal de conservación, en particular las facturas y los justificantes de reserva de los periodos ya liquidados (obligación contable conforme al Derecho danés, por regla general cinco años). Estos documentos se bloquean durante el plazo, es decir, se conservan exclusivamente para el cumplimiento de esa obligación y después se suprimen.",
      ],
    },
    {
      heading: "Seguridad del tratamiento",
      paragraphs: [
        "Protegemos el tratamiento mediante medidas técnicas y organizativas conforme al art. 32 del RGPD, en particular: cifrado del transporte de extremo a extremo (TLS), reglas de acceso específicas de cada cliente directamente en la base de datos, permisos basados en roles con separación de los datos financieros y de servicio, autenticación de doble factor opcional, limitación de los intentos de inicio de sesión, copias de seguridad cifradas con pruebas de restauración periódicas y registro de los eventos relevantes para la seguridad.",
      ],
    },
    {
      heading: "Obligación de facilitar los datos",
      paragraphs: [
        "Los datos que necesitamos para la celebración del contrato, la facturación y las obligaciones legales son necesarios: sin ellos no podemos poner la plataforma a disposición. Todos los demás datos son voluntarios.",
      ],
    },
    {
      heading: "Modificaciones de esta declaración",
      paragraphs: [
        "Adaptamos esta declaración cuando cambian el tratamiento, los prestadores utilizados o el marco jurídico. Se aplica en cada caso la versión aquí publicada; la fecha que figura arriba indica su estado de actualización.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default datenschutz;
