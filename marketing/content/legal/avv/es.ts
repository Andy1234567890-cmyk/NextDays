// Spanische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin
// (dort stehen auch die Belege für die technischen und organisatorischen
// Maßnahmen und die Liste der Unterauftragsverarbeiter).
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Acuerdo de encargo del tratamiento",
  metaDescription:
    "Encargo del tratamiento conforme al artículo 28 del RGPD entre myNextDays ApS y los establecimientos que utilizan la plataforma: objeto, instrucciones, seguridad, subencargados del tratamiento.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `El presente acuerdo (en lo sucesivo, el «acuerdo de encargo») se aplica entre el establecimiento que utiliza la plataforma myNextDays (en lo sucesivo, el «responsable del tratamiento») y ${ANBIETER.firma} (en lo sucesivo, el «encargado del tratamiento» o «nosotros») y concreta las obligaciones derivadas del artículo 28 del Reglamento (UE) 2016/679 (RGPD).`,
    `Queda incorporado por las [condiciones generales](${AGB_URL}) y se aplica durante toda la duración del uso de la plataforma. Prevalece sobre las condiciones generales en lo que se refiere al tratamiento de datos personales por cuenta del responsable del tratamiento.`,
    "Con carácter complementario, la [política de privacidad](/datenschutz) se aplica a los datos que tratamos como responsable del tratamiento por cuenta propia — en particular los datos de la cuenta y de la relación comercial.",
  ],
  sections: [
    {
      heading: "Objeto y reparto de funciones",
      unterpunkte: [
        {
          paragraphs: [
            "El objeto es el tratamiento de los datos personales que el responsable del tratamiento introduce en la plataforma o recoge a través de ella para que podamos prestar los servicios acordados contractualmente: gestión de propiedades, reservas y ocupación, comunicación con los huéspedes, gestión de pagos, contabilidad y liquidación a propietarios, conexión con portales de reserva, creador de sitios web así como gestión de tareas y del equipo.",
          ],
        },
        {
          paragraphs: [
            "El responsable del tratamiento decide sobre los fines y los medios de este tratamiento. Tratamos los datos exclusivamente siguiendo sus instrucciones documentadas y no para fines propios.",
          ],
        },
        {
          paragraphs: [
            "Respecto de los datos de la cuenta, de la facturación de nuestros propios servicios, de la seguridad del sistema y de la conservación legal, somos nosotros mismos el responsable del tratamiento. Ese tratamiento no es objeto del presente acuerdo de encargo.",
          ],
        },
      ],
    },
    {
      heading: "Naturaleza, alcance y finalidad del tratamiento",
      paragraphs: [
        "El tratamiento se realiza mediante la recogida, la conservación, la visualización, la modificación, la comunicación a destinatarios elegidos por el responsable del tratamiento (por ejemplo, portales de reserva, proveedores de servicios de pago), la limitación y la supresión — de forma automatizada en la plataforma.",
        "El lugar del tratamiento es la Unión Europea; las excepciones se enumeran de forma exhaustiva en la sección 8.",
      ],
    },
    {
      heading: "Categorías de interesados",
      list: [
        "Huéspedes y personas que reservan, incluidos los acompañantes",
        "Personas interesadas que realizan consultas o envían mensajes",
        "Propietarios de las propiedades gestionadas",
        "Personal del responsable del tratamiento (equipo, limpieza, servicio, recepción)",
        "Personas de contacto de los socios y proveedores del responsable del tratamiento",
      ],
    },
    {
      heading: "Categorías de datos personales",
      list: [
        "Datos de identificación: nombre, dirección, fecha de nacimiento si se registra, nacionalidad si se registra a efectos de la obligación de declaración",
        "Datos de contacto: dirección de correo electrónico, número de teléfono",
        "Datos de la reserva: periodo, propiedad, número de viajeros, precios, servicios adicionales, cancelaciones",
        "Datos de pago: importe, moneda, forma de pago, estado del pago, referencias (los datos completos de la tarjeta no llegan a nuestros sistemas)",
        "Datos de comunicación: mensajes, notas, valoraciones",
        "Datos de acceso y de uso del personal: función, permisos, momento del inicio de sesión, dispositivo y dirección IP del inicio de sesión",
        "Las categorías especiales del artículo 9 del RGPD no son objeto del encargo; el responsable del tratamiento no introduce tales datos en campos de texto libre.",
      ],
    },
    {
      heading: "Instrucciones",
      unterpunkte: [
        {
          paragraphs: [
            "El responsable del tratamiento imparte instrucciones mediante el uso y la configuración de la plataforma, así como por escrito a nuestra dirección de contacto. Confirmamos por escrito las instrucciones verbales.",
          ],
        },
        {
          paragraphs: [
            "Si consideramos que una instrucción es ilícita, lo comunicamos sin dilación y podemos suspender su ejecución hasta que el responsable del tratamiento la confirme o la modifique.",
          ],
        },
        {
          paragraphs: [
            "Cuando estemos legalmente obligados a tratar datos (por ejemplo, frente a las autoridades), informamos previamente al responsable del tratamiento en la medida en que la ley nos lo permita.",
          ],
        },
        {
          titel: "Conexión de servicios propios del responsable del tratamiento",
          paragraphs: [
            "El responsable del tratamiento puede conectar su cuenta, a través de una interfaz, con un servicio que él mismo haya elegido y con el que haya celebrado su propio contrato — por ejemplo un asistente de inteligencia artificial. Si concede tal conexión, ello constituye su instrucción explícita en el sentido del artículo 28, apartado 3, letra a), del RGPD de entregar los datos liberados a dicho servicio. Comprende expresamente también una transferencia a un tercer país vinculada a ella, cuando el servicio tenga su sede fuera de la Unión Europea.",
            "En resumen: sobre tal conexión decide únicamente el responsable del tratamiento, y del servicio conectado responde él mismo.",
            "Solo puede concederla una cuenta con el permiso para gestionar conexiones externas. Este permiso está reservado a la función de «administrador»; las cuentas con derechos limitados —también la función de «coadministrador»— no pueden conceder ninguna conexión. Registramos quién la concedió, cuándo y para qué servicio, qué tipos de datos se liberaron y qué consultas se realizaron; ese registro está a disposición del responsable del tratamiento en la interfaz, en «Cuenta → Conexiones», para que pueda cumplir su obligación de responsabilidad proactiva y responder a las solicitudes de información.",
            "El servicio conectado no es un subencargado del tratamiento nuestro: no lo contratamos, no lo seleccionamos y no le damos instrucciones. Trata los datos sobre la base del contrato que el propio responsable del tratamiento ha celebrado con él. De ese tratamiento, de su base jurídica y de las garantías de la transferencia a un tercer país responde por tanto el responsable del tratamiento; no es objeto del presente acuerdo de encargo.",
            "Los campos de texto libre —notas de reserva y contenido de los mensajes de los huéspedes— quedan excluidos por defecto de tal conexión. Pueden contener categorías especiales de datos personales conforme al artículo 9 del RGPD, por ejemplo datos relativos a la salud. El responsable del tratamiento debe liberarlos por separado al conceder la conexión; sin esa liberación no se transmiten.",
            "El responsable del tratamiento puede desconectar en cualquier momento en la interfaz una conexión concedida. Los tokens de renovación se suprimen en ese momento y, en cada consulta posterior, se comprueba si el consentimiento sigue existiendo — por ello un servicio desconectado deja de poder leer de inmediato, y no solo cuando expira su token de acceso.",
          ],
        },
      ],
    },
    {
      heading: "Confidencialidad",
      paragraphs: [
        "Todas las personas que, en cumplimiento del encargo, pueden tener acceso a los datos están obligadas a la confidencialidad y reciben formación periódica en protección de datos. El acceso se limita a lo necesario para la tarea correspondiente.",
        "Los accesos de nuestro personal a los datos de los clientes se producen únicamente para la resolución de errores, a petición de soporte o para cumplir obligaciones legales.",
      ],
    },
    {
      heading: "Seguridad del tratamiento",
      paragraphs: [
        "Adoptamos las medidas técnicas y organizativas exigidas por el artículo 32 del RGPD. En particular, están implantadas las siguientes:",
      ],
      list: [
        "Cifrado del transporte (TLS) para todas las conexiones, cabeceras HTTP de seguridad, incluida una Content-Security-Policy estricta",
        "Separación de los clientes directamente en la base de datos: reglas de acceso por filas (Row Level Security) más retirada de los permisos de tabla para los datos sensibles, de modo que queda excluido el acceso fuera del propio establecimiento incluso por la vía directa de la base de datos",
        "Permisos basados en funciones con separación de datos: el personal de servicio y de limpieza no recibe datos financieros ni comerciales, los propietarios solo sus propias propiedades; los datos de los huéspedes se enmascaran para las funciones no autorizadas",
        "Autenticación de doble factor (TOTP) disponible para las cuentas; nueva autenticación en caso de modificaciones críticas para la seguridad",
        "Registro de los inicios de sesión con dispositivo, momento y dirección IP, consultable por el responsable del tratamiento",
        "Las conexiones con servicios externos solo puede concederlas una cuenta con la función de «administrador»; cada consulta a través de tal conexión se registra (herramienta, momento, alcance — sin los contenidos mismos) y es consultable por el responsable del tratamiento. Una conexión desconectada pierde el acceso de inmediato: en cada consulta se comprueba si el consentimiento sigue existiendo",
        "Limitación de la frecuencia de solicitudes frente a ataques automatizados, verificación de las firmas de las llamadas de webhook entrantes",
        "Copias de seguridad cifradas, almacenadas fuera del sistema de producción, con prueba de restauración periódica",
        "Entornos separados para desarrollo y explotación; modificaciones en la base de datos exclusivamente mediante migraciones versionadas",
      ],
    },
    {
      heading: "Subencargados del tratamiento",
      paragraphs: [
        "El responsable del tratamiento autoriza el recurso a los siguientes subencargados del tratamiento. Con cada uno de ellos existen contratos conforme al artículo 28, apartado 4, del RGPD con obligaciones que corresponden al presente acuerdo de encargo.",
      ],
      list: [
        "Hetzner Online GmbH, Alemania (servidores, base de datos, medios, servidor de correo; centro de datos en Helsinki, Finlandia)",
        "Stripe Payments Europe, Limited, Irlanda (pagos, abonos, verificación legal de la identidad)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburgo (pagos, si el responsable del tratamiento los activa)",
        "Channex.io Ltd, Reino Unido (conexión con portales de reserva, si está activada)",
        "Meta Platforms Ireland Limited, Irlanda (mensajes de WhatsApp, si están activados)",
        "Google Ireland Limited, Irlanda (traducción de contenidos; inicio de sesión con Google, si se utiliza)",
        "Groq, Inc., EE. UU. (propuestas de respuesta en la bandeja de entrada, si están activadas)",
        "Cloudflare, Inc., EE. UU. (gestión de los registros DNS de dominios propios, si se utiliza)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Comunicamos cualquier cambio o incorporación con al menos 30 días de antelación. El responsable del tratamiento puede oponerse dentro de ese plazo por un motivo importante relacionado con la protección de datos; si la oposición no se resuelve, puede resolver la parte del servicio afectada o el contrato.",
          ],
        },
        {
          paragraphs: [
            "Los servicios que el propio responsable del tratamiento acuerda con un tercero no constituyen un subencargo del tratamiento, sino una comunicación de datos iniciada por él. Ello se aplica a un portal de reserva con el que tiene su propio contrato, igual que a un asistente de inteligencia artificial o a otro programa que conecte con su cuenta a través de la interfaz (véase la sección «Instrucciones»).",
            "Lo determinante no es a través de qué sistemas fluyen los datos, sino quién recurre al servicio: el subencargo del tratamiento surge cuando NOSOTROS contratamos a otro proveedor para prestar nuestro servicio. Si el responsable del tratamiento elige el servicio por sí mismo y celebra el contrato con él, ese servicio trata datos para el responsable del tratamiento — no para nosotros. Esta delimitación corresponde a la práctica contractual de proveedores comparables respecto de servicios de terceros conectados por el cliente.",
          ],
        },
      ],
    },
    {
      heading: "Transferencias a terceros países",
      paragraphs: [
        "Las transferencias a destinatarios fuera de la UE se limitan a los servicios mencionados anteriormente con sede en EE. UU. o en el Reino Unido. Se basan en las cláusulas tipo de protección de datos de la Comisión Europea conforme al artículo 46, apartado 2, letra c), del RGPD o en una decisión de adecuación vigente; se aplican medidas de protección complementarias (cifrado, minimización de datos).",
      ],
    },
    {
      heading: "Asistencia al responsable del tratamiento",
      unterpunkte: [
        {
          paragraphs: [
            "Asistimos al responsable del tratamiento en la respuesta a las solicitudes de los interesados (artículos 15 a 22 del RGPD). Para ello, la plataforma ofrece el acceso, la rectificación, la exportación y la supresión de los datos directamente en la interfaz. Si los interesados se dirigen directamente a nosotros, los remitimos al responsable del tratamiento y le informamos.",
          ],
        },
        {
          paragraphs: [
            "Asistimos además en las evaluaciones de impacto relativas a la protección de datos, en el cumplimiento de las obligaciones de los artículos 32 a 36 del RGPD y en las solicitudes de las autoridades de control.",
          ],
        },
      ],
    },
    {
      heading: "Violaciones de la seguridad de los datos personales",
      paragraphs: [
        "Si tenemos conocimiento de una violación de la seguridad de los datos personales que afecte a los datos del responsable del tratamiento, le informamos sin dilación, a más tardar en un plazo de 48 horas desde el conocimiento, por escrito.",
        "La comunicación contiene, en la medida en que se conozcan, la naturaleza y el momento del incidente, las categorías de datos y los grupos de personas afectados, las consecuencias probables y las medidas adoptadas y propuestas. Asistimos al responsable del tratamiento en sus obligaciones de notificación y comunicación conforme a los artículos 33 y 34 del RGPD.",
      ],
    },
    {
      heading: "Justificantes y auditorías",
      unterpunkte: [
        {
          paragraphs: [
            "Acreditamos a solicitud el cumplimiento del presente acuerdo de encargo, en particular mediante información sobre las medidas adoptadas y sobre los subencargados del tratamiento utilizados.",
          ],
        },
        {
          paragraphs: [
            "El responsable del tratamiento puede llevar a cabo auditorías en la medida necesaria o encargarlas a un auditor independiente que no compita con nosotros. Las auditorías se realizan previo aviso con un plazo razonable, durante el horario comercial habitual y sin perturbar la explotación. El coste de una auditoría que vaya más allá de la información lo asume el responsable del tratamiento, salvo que la auditoría esté motivada por un incidente causado por nosotros.",
          ],
        },
      ],
    },
    {
      heading: "Supresión y devolución",
      paragraphs: [
        "Tras la finalización del contrato ponemos a disposición los datos del responsable del tratamiento para su exportación, a petición, en un plazo de 30 días y en un formato habitual y legible por máquina. Después suprimimos los datos, incluidas las copias.",
        "Quedan exceptuados los datos sujetos a una obligación legal de conservación (en particular los datos de facturación y contabilidad); estos se bloquean y se suprimen al expirar el plazo. Las copias de seguridad se sobrescriben con el ciclo de rotación habitual.",
      ],
    },
    {
      heading: "Responsabilidad y orden de prelación",
      paragraphs: [
        "Se aplica el artículo 82 del RGPD. En la relación entre las partes se aplican además las reglas de responsabilidad de las condiciones generales, en la medida en que no contradigan el RGPD.",
        "Si las condiciones generales y el presente acuerdo de encargo se contradicen en cuanto al tratamiento por cuenta del responsable del tratamiento, prevalece el presente acuerdo de encargo. Si una disposición deviene ineficaz, el resto del contenido sigue siendo válido; las partes la sustituyen por una regulación admisible con la misma finalidad.",
      ],
    },
    {
      heading: "Modificaciones del presente acuerdo",
      paragraphs: [
        "Podemos adaptar el presente acuerdo de encargo en la medida en que resulte necesario por cambios legislativos, requisitos de las autoridades de control, exigencias de proveedores de servicios de pago o desarrollos técnicos, y siempre que el responsable del tratamiento no quede en peor situación.",
        "Anunciamos las modificaciones por escrito con al menos 30 días de antelación a su entrada en vigor. Si el responsable del tratamiento no se opone dentro de ese plazo, se consideran aceptadas; en el anuncio se advierte de esta consecuencia. En caso de oposición, cada parte puede resolver el contrato con efecto en la fecha de entrada en vigor.",
      ],
    },
    {
      heading: "Contacto",
      paragraphs: [
        `Diríjase con las consultas relativas al presente acuerdo, las instrucciones y las notificaciones a [${ANBIETER.email}](mailto:${ANBIETER.email}) o a ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
