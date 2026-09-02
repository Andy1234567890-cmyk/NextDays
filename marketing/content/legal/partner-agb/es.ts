// Partner-AGB — Spanisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "Condiciones de participación del programa de socios de myNextDays: Atribución, base de la comisión, escalado, comisión de equipo, prohibiciones, identificación, pago.",
  numbered: false,
  toc: true,
  title: "Condiciones de participación del programa de socios (Condiciones Generales de Socios) — Borrador",
  standIso: "2026-09-02",
  intro: [
    "BORRADOR — Estas condiciones son un estado de trabajo de myNextDays y aún no han sido revisadas por un abogado. Hasta la publicación de la versión revisada, se consideran una descripción del programa, no un texto contractual definitivo. La versión revisada se publicará en esta dirección con un nuevo número de versión; se solicitará a los socios que den su consentimiento nuevamente en el próximo inicio de sesión.",
    `Estas condiciones de participación regulan la participación en el programa de socios (programa de afiliados) de ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (en adelante, “myNextDays” o “nosotros”) por parte de los socios (en adelante, “Socio”).`,
    "El programa de socios está dirigido a personas y empresas con sede en la UE, Suiza o el Reino Unido que recomienden negocios (propietarios, agencias, hoteles) en myNextDays.",
  ],
  sections: [
    {
      heading: "§ 1 Participación y aprobación",
      paragraphs: [
        "La participación requiere una solicitud a través del panel de control del socio. Los datos obligatorios son el nombre o la empresa, la forma jurídica, el país, al menos una cuenta de redes sociales con dirección, nombre de usuario y alcance, y, en el caso de las empresas, el número de identificación fiscal.",
        "myNextDays revisa cada solicitud personalmente y decide libremente sobre la aprobación. No existe derecho a ser admitido. La participación es gratuita; una suscripción a myNextDays no es un requisito.",
        "El Socio mantendrá sus datos actualizados, en particular los canales, la forma jurídica, los datos fiscales y de pago.",
        "El alcance indicado es inicialmente una autodeclaración. El Socio puede conectar voluntariamente sus cuentas de YouTube, Instagram, Facebook y TikTok; entonces los seguidores y las visualizaciones se leerán de la plataforma y se mostrarán como verificados. El alcance no verificado tendrá menos peso en la aprobación y en las revisiones posteriores. La conexión se puede desconectar en cualquier momento en el panel de control; los detalles sobre el procesamiento se encuentran en la política de privacidad.",
      ],
    },
    {
      heading: "§ 2 Asignación de negocios (Atribución)",
      paragraphs: [
        "Un negocio se asigna al Socio si se registra con el código de recomendación del Socio. El código se muestra visiblemente al negocio durante el registro y se confirma al enviarlo. No se establecen cookies de seguimiento.",
        "Un negocio se asigna exactamente a un Socio; el código confirmado durante el registro es determinante. Una reasignación posterior solo la realizará myNextDays en caso de error comprobado.",
        "No se asignarán los negocios del propio Socio, de sus socios, empleados o familiares, así como los negocios que ya sean o hayan sido clientes de myNextDays.",
      ],
    },
    {
      heading: "§ 3 Comisión sobre clientes propios",
      paragraphs: [
        "La base de la comisión es la facturación neta de la suscripción del negocio asignado (tarifa básica y módulos) de las facturas pagadas, sin IVA, sin comisiones de portal, servicios adicionales, recargos y otros elementos de paso.",
        "La tasa de comisión se basa en el rango del socio en el momento del pago. Los rangos y las tasas se publican en la página del programa. El rango se determina por el número de clientes de pago en la estructura del socio: sus propios clientes de pago y los clientes de pago de sus socios de equipo (§ 4), cada cliente una vez. El rango se establece mensualmente en la fecha de referencia; un ascenso es inmediato, una degradación solo si el número ha estado por debajo del umbral en dos fechas de referencia consecutivas.",
        "Si el socio alcanza por primera vez un rango a partir de \"Ascendente\", recibirá una vez el bono de ascenso indicado para este rango en la página del programa (actualmente 50,00 EUR por rango, para todos los socios en euros). Cada rango se compensa solo una vez, incluso después de una degradación y un nuevo ascenso. El bono está sujeto a la ventana de reembolso según el § 7.",
        "La comisión se genera por cada operación durante doce meses a partir de su primera factura de suscripción de pago; una fase de prueba gratuita y un mes gratuito intermediados a través del socio no cuentan. Si la suscripción finaliza antes, la comisión finaliza con la última factura pagada.",
        "A partir del rango de \"Socio Élite\", el socio recibe adicionalmente una supercomisión por el importe indicado en la página del programa (actualmente 2,5 %) sobre la facturación neta de suscripciones de todos los clientes de su estructura —clientes propios y clientes de sus socios de equipo—, sin el límite de doce meses, siempre que el cliente respectivo mantenga una suscripción de pago y el socio ostente el rango en el momento del pago. Esta se genera además de la comisión según la frase 2 y el § 4.",
        "Por cada reserva recibida y pagada a través de myBestDays de una operación asignada al socio o a uno de sus socios de equipo, el socio recibe una parte de la reserva por el importe indicado en la página del programa (actualmente 0,5 %) del importe de la reserva pagado por el huésped en la moneda de la reserva, sin límite de tiempo, siempre que la asignación exista. Las fianzas no son un importe de reserva. Los reembolsos al huésped reducen la parte proporcionalmente (§ 7).",
      ],
    },
    {
      heading: "§ 4 Comisión de equipo",
      paragraphs: [
        "A partir del rango de \"Ascendente\", un socio puede dirigir socios de equipo. Si otro socio se postula a través del enlace de equipo del socio y confirma su código visiblemente en su solicitud, se le asignará al equipo del socio (en adelante, \"Patrocinador\") después de su aprobación. Si el Patrocinador no ostenta el rango en el momento de la solicitud, la solicitud sigue siendo válida, pero no se crea una asignación de equipo.",
        "El Patrocinador recibe una comisión de equipo sobre la facturación neta de suscripciones de los clientes de sus socios de equipo por el importe de la diferencia entre su propia tasa de comisión y la tasa de comisión del socio de equipo, cada una según el rango en el momento del pago. Si ambos están en el mismo rango o el socio de equipo está en un rango superior, no se genera comisión de equipo. La comisión del socio de equipo y la comisión de equipo del Patrocinador nunca superan juntas la tasa más alta de la escala (actualmente 30 %).",
        "La comisión de equipo existe exactamente un nivel por debajo: los socios de equipo no reciben comisión de equipo por los socios que ellos mismos reclutan. No se paga ninguna remuneración por la captación de un socio; no se cobra ninguna cuota de participación. La comisión de equipo se genera exclusivamente a partir de los ingresos por suscripciones pagadas.",
        "La comisión de equipo se devenga por cada cliente de equipo durante doce meses a partir de su primera factura pagada, está sujeta a la misma ventana de reembolso y se retira proporcionalmente en caso de reembolso o contracargo (§ 7). Solo se devenga mientras el patrocinador y el socio de equipo estén aprobados; de lo contrario, se retendrá hasta que se aclare la situación.",
        "La asignación de equipo es única. Un cambio solo será realizado por myNextDays con una razón documentada.",
      ],
    },
    {
      heading: "§ 5 Obligaciones del socio e identificación",
      paragraphs: [
        "El socio identificará cada recomendación con su enlace o código como publicidad —al principio de la publicación, en el idioma de la publicación, de acuerdo con las directrices de su país (en Alemania, entre otros, § 5a Abs. 4 UWG, en Dinamarca markedsføringsloven § 6 Abs. 4). myNextDays proporcionará los textos para cada país en el panel de control del socio.",
        "El socio solo hará declaraciones sobre myNextDays que se correspondan con las descripciones de servicios publicadas y no hará promesas en nombre de myNextDays. Están prohibidas, en particular, las promesas de éxito y garantía (por ejemplo, «ocupación total garantizada en tres días»), así como las declaraciones sobre ingresos que no se deriven de las descripciones de servicios publicadas.",
        "Cada video y cada publicación que mencione myNextDays o que contenga el enlace del socio se presentará como archivo en el panel de control del socio para su revisión antes de su publicación. El enlace del socio solo se creará después de la aprobación por escrito de myNextDays; está prohibida la publicación sin aprobación. myNextDays puede revocar una aprobación; las comisiones ya devengadas no se verán afectadas.",
        "Para logotipos, capturas de pantalla, B-Roll, superposiciones y capturas de pantalla, el socio utilizará exclusivamente el material publicitario proporcionado por myNextDays. No se permiten grabaciones de software propias no revisadas.",
      ],
    },
    {
      heading: "§ 6 Prácticas prohibidas",
      paragraphs: ["Están prohibidas, en particular:"],
      list: [
        "Brand-Bidding: anuncios pagados con la marca «myNextDays», variantes de escritura y combinaciones (por ejemplo, «myNextDays Precios») en motores de búsqueda y redes;",
        "Cookie-dropping, redirecciones encubiertas, iFrames, llamadas automatizadas al enlace del socio u otra manipulación técnica de la asignación;",
        "Auto-promoción: registro de empresas propias, de socios, empleados o familiares a través del propio código o del código de un socio de equipo;",
        "Alcance comprado (seguidores comprados, granjas de clics, tráfico de bots), así como incentivos a las empresas para el registro (reembolsos, regalos, sorteos);",
        "Promesas de reclutamiento: la captación de socios con promesas de ganancias que no provengan de ingresos por suscripciones pagadas, o la presentación del programa como fuente de ingresos mediante la captación de más socios;",
        "Spam, publicidad directa no autorizada y el uso de marcas o contenidos de terceros sin derecho.",
      ],
    },
    {
      heading: "§ 7 Período de reembolso, reversión, retención",
      paragraphs: [
        "Cada línea de comisión está abierta durante 30 días después de su creación (período de reembolso) y es pagadera a partir de entonces. Si una factura subyacente es reembolsada total o parcialmente o se produce una retrocesión (chargeback), la comisión —incluida cualquier comisión de equipo basada en ella— será revertida proporcionalmente, incluso después del pago, mediante compensación con futuras comisiones.",
        "En caso de sospecha de una infracción del § 2, § 5 o § 6, myNextDays podrá retener asignaciones y comisiones hasta que se aclare la situación. Si se confirma la infracción, las comisiones afectadas caducarán.",
      ],
    },
    {
      heading: "§ 8 Pago y abono",
      paragraphs: [
        "Las comisiones pagaderas se agrupan y pagan mensualmente por moneda, tan pronto como alcanzan el importe mínimo de la moneda respectiva indicado en la página del programa o en el panel de control. No se realiza ninguna conversión entre monedas.",
        "La liquidación se realiza mediante el procedimiento de abono (autofacturación, momsloven § 52a): myNextDays emite un abono por cada pago; el Socio no emite factura. El Socio acepta el procedimiento de abono.",
        "Los empresarios reciben el abono con una indicación de la inversión del sujeto pasivo (Reverse Charge); el requisito es un número de identificación fiscal válido y confirmado. Las personas físicas reciben el abono sin IVA y declaran la comisión por sí mismas.",
        "El pago se realiza mediante transferencia SEPA, Wise o PayPal a los datos introducidos por el Socio en el panel de control.",
      ],
    },
    {
      heading: "§ 9 Datos e información",
      paragraphs: [
        "El Socio ve los negocios asignados de forma seudónima (número, país, estado, importes). Los nombres, direcciones de correo electrónico o datos de reserva de los negocios no se divulgan. Un patrocinador ve de sus Socios de equipo el nombre o la empresa, el rango, el número de clientes de pago y la comisión de equipo resultante, no los detalles del cliente.",
        "Para las cuentas conectadas y las publicaciones creadas, myNextDays ve los seguidores, las visualizaciones, las interacciones, así como los clics y los clientes por publicación. Las anomalías (por ejemplo, un salto de seguidores sin visualizaciones correspondientes o una desviación significativa entre la autodeclaración y el valor verificado) son indicios para una revisión personal según el § 6 y el § 10, no un bloqueo automático.",
        "El procesamiento de datos personales en el programa de socios se describe en la política de privacidad.",
      ],
    },
    {
      heading: "§ 10 Duración, bloqueo y rescisión",
      paragraphs: [
        "La participación es indefinida y puede ser terminada por cualquiera de las partes en cualquier momento por escrito. Las comisiones ya devengadas y pagaderas se abonarán según el § 8; después de la terminación no se generarán nuevas comisiones.",
        "myNextDays podrá bloquear al Socio en caso de infracción de estas condiciones. Durante el bloqueo, las comisiones se retendrán; si se confirma la infracción, caducarán.",
      ],
    },
    {
      heading: "§ 11 Modificaciones",
      paragraphs: [
        "myNextDays podrá modificar estas condiciones y la escala con efecto futuro. Las modificaciones se publicarán en el panel de control del socio y en esta página con número de versión; en caso de modificaciones sustanciales, se solicitará al socio que dé su consentimiento de nuevo. Las comisiones ya devengadas no se verán afectadas.",
      ],
    },
    {
      heading: "§ 12 Ley aplicable",
      paragraphs: [
        "Se aplicará la legislación danesa, con exclusión de las normas de conflicto de leyes. Las disposiciones imperativas de protección del consumidor del Estado en el que un socio privado tenga su residencia habitual no se verán afectadas.",
      ],
    },
  ],
};
