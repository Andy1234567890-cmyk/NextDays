import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Programa de socios",
  description: "Recomiende negocios, forme un equipo y participe en los ingresos por suscripciones.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Cómo funciona",
      articles: [
        {
          slug: "ueberblick",
          title: "Descripción general del programa de socios",
          excerpt: "Quién puede participar, cómo se generan las comisiones y qué puede ver.",
          updated: "Estado: septiembre de 2026",
          body: [
            {
              type: "p",
              text: "Como socio, usted recomienda myNextDays a propietarios, agencias y hoteles. Si un negocio se registra con su código o a través de su enlace y paga sus facturas de suscripción, usted recibirá una parte de los ingresos netos de la suscripción durante doce meses. La escala según el número de clientes de pago está disponible en la página del programa.",
            },
            { type: "h2", text: "Quién puede ser socio" },
            {
              type: "ul",
              items: [
                "Personas y empresas en la UE, Suiza o el Reino Unido con un canal real hacia los anfitriones: influencers, consultores, agencias, despachos de abogados, asociaciones.",
                "También los propios clientes de myNextDays — una suscripción no es un requisito.",
                "Obligatorio en la solicitud: al menos una cuenta de redes sociales (Instagram, TikTok, YouTube, Facebook, LinkedIn…) con dirección, nombre de usuario y alcance. Un sitio web o un boletín de noticias son bienvenidos como complemento.",
              ],
            },
            { type: "h2", text: "Cómo se le asigna un negocio" },
            {
              type: "steps",
              items: [
                "Usted comparte su enlace (mynextdays.com/p/SU-CÓDIGO) o su código.",
                "El negocio ve el código en el campo \"Recomendado por\" durante el registro y lo confirma al enviarlo, sin cookies.",
                "El período de doce meses comienza con la primera factura de suscripción pagada.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Usted ve a sus clientes de forma seudónima (Cliente #1, #2…) con país, estado e importes — nunca el nombre o el correo electrónico. Un negocio se asigna exactamente a un socio; el primero gana.",
            },
            { type: "h2", text: "Qué encontrará en el panel de control" },
            {
              type: "ul",
              items: [
                "Resumen: rango, clics, negocios registrados y de pago, comisiones pendientes, pagaderas y pagadas.",
                "Comisiones: cada factura de suscripción pagada como una línea con base, tasa, importe y estado.",
                "Pagos: mensualmente por moneda a partir del importe mínimo, con abono (autofacturación) como comprobante.",
                "Enlaces y material: sus códigos, material publicitario y la identificación obligatoria por país.",
                "Mensajes: el contacto directo con el equipo de socios.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Formar equipo: la comisión de equipo",
          excerpt: "Reclute socios que se unan con su código y participe en los ingresos de sus clientes.",
          updated: "Estado: septiembre de 2026",
          body: [
            {
              type: "p",
              text: "Puede incorporar a otros socios a su equipo. Si alguien se postula a través de su enlace de equipo (mynextdays.com/p/SU-CÓDIGO?team=1) e introduce su código de forma visible en la solicitud, una vez aprobado, pertenecerá a su equipo. Usted recibirá una comisión de equipo sobre los ingresos netos de las suscripciones de los clientes de sus socios de equipo.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "La tasa de equipo se basa en SU rango en el momento del pago, no en el tamaño de su equipo. Las tasas se encuentran en la página del programa.",
                "Su rango se genera únicamente a partir de sus propios clientes de pago. Los clientes de equipo no cuentan para el rango.",
                "Exactamente un nivel: sus socios de equipo no forman su propio equipo debajo de usted.",
                "Sin cuota de participación, sin dinero por reclutar a un socio. La comisión de equipo se genera exclusivamente a partir de los ingresos por suscripciones pagadas.",
                "Doce meses a partir de la primera factura pagada del cliente de equipo correspondiente, ventana de reembolso de 30 días, reversión en caso de reembolso o contracargo, como con la propia comisión.",
                "La provisión de equipo solo se genera si usted y su compañero de equipo están aprobados; de lo contrario, se retendrá.",
              ],
            },
            { type: "h2", text: "Evaluación del equipo" },
            {
              type: "p",
              text: "En \"Equipo\", verá a cada compañero de equipo con su rango, clientes de pago, ingresos por suscripción de sus clientes (30 días y total) y su provisión de equipo resultante — pendiente, pagadera, pagada — así como el historial de los últimos doce meses. No verá los detalles de los clientes de sus compañeros de equipo; esos les pertenecen a ellos.",
            },
            {
              type: "note",
              variant: "tip",
              text: "A través de \"Equipo\", puede contactar directamente a sus compañeros de equipo por mensaje — y su patrocinador a usted.",
            },
            {
              type: "note",
              variant: "warn",
              text: "El mismo dominio de correo electrónico o la misma cuenta bancaria entre el patrocinador y el compañero de equipo se marcan y son revisados por el equipo de socios antes de que se pague la provisión de equipo.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Pago, crédito e impuestos",
          excerpt: "Cuándo la provisión es pagadera, cómo se ve el crédito y qué se aplica fiscalmente.",
          updated: "Estado: septiembre de 2026",
          body: [
            {
              type: "steps",
              items: [
                "Una línea de provisión se genera con la factura de suscripción pagada y está \"abierta\" durante 30 días (ventana de reembolso).",
                "Después de eso, es pagadera. El primer día del mes, agrupamos todas las líneas pagaderas por moneda.",
                "Si la suma supera el importe mínimo de su moneda, se genera un pago con crédito (autofacturación). No necesita emitir una factura.",
                "Después de la transferencia, el pago aparece como \"Pagado\" con referencia en el panel de control.",
              ],
            },
            {
              type: "ul",
              items: [
                "Empresas: El crédito lleva la mención de inversión del sujeto pasivo; el requisito es un número de identificación fiscal (IVA) confirmado (verificación VIES).",
                "Personas físicas: El crédito no muestra IVA; la provisión debe ser autodeclarada.",
                "Pago por SEPA, Wise o PayPal — los datos se introducen en el perfil; los cambios requieren su contraseña.",
                "Sin conversión: La provisión en DKK se paga en DKK, la provisión en EUR en EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La publicidad debe ser reconocible como publicidad — al principio de la publicación, en el idioma de la publicación. Las formulaciones probadas por país se encuentran en \"Enlaces y material\". Las infracciones pueden llevar a la suspensión.",
            },
          ],
        },
      ],
    },
  ],
};
