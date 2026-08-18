import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Reglamento de Servicios Digitales",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "myBestDays es un servicio intermediario y una plataforma en línea en el sentido del Reglamento (UE) 2022/2065 relativo a un mercado único de servicios digitales (Reglamento de Servicios Digitales, DSA). Esta página reúne la información y los procedimientos que dicho Reglamento exige.",
    "myBestDays no es una plataforma en línea de muy gran tamaño en el sentido del artículo 33 del Reglamento. Las obligaciones adicionales aplicables a estas — evaluación de riesgos sistémicos, auditoría independiente, repositorio de anuncios y publicación del número mensual de usuarios conforme al procedimiento allí previsto — no nos incumben.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Puntos de contacto (artículos 11 y 12)",
      paragraphs: [
        `Punto de contacto único para las autoridades de los Estados miembros, la Comisión y la Junta Europea de Servicios Digitales: ${ANBIETER.email}, por correo postal ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dinamarca.`,
        `Punto de contacto único para usuarios: ${ANBIETER.email}. Nos alcanza allí directamente y sin sistemas automatizados previos.`,
        "Con ambos puntos de contacto puede comunicarse en alemán, danés e inglés.",
        "No procede designar representante legal en la Unión conforme al artículo 13: el operador está establecido en Dinamarca y, por tanto, en la Unión.",
        `Coordinador de servicios digitales competente conforme al artículo 49: ${DSA_KOORDINATOR.name}, Dinamarca ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Notificar contenidos ilícitos (artículo 16)",
      paragraphs: [
        "Cualquier persona puede notificarnos contenidos que considere ilícitos. Utilice la función de notificación disponible en cada anuncio, valoración y mensaje, o el punto de contacto para usuarios.",
        "Para que podamos valorar una notificación sin un examen jurídico exhaustivo, debería contener:",
      ],
      list: [
        "una explicación suficientemente motivada de por qué el contenido es ilícito;",
        "la localización electrónica exacta, en particular la URL;",
        "el nombre y la dirección de correo electrónico de la persona notificante — salvo en notificaciones relativas a delitos contra la libertad sexual de menores, en las que ese dato es voluntario;",
        "la declaración de que los datos son exactos y completos según su leal saber y entender.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Cómo tramitamos las notificaciones",
      paragraphs: [
        "Acusamos recibo sin demora y resolvemos de forma tempestiva, diligente, no arbitraria y objetiva.",
        "Si una notificación contiene los datos indicados en la sección 2, fundamenta nuestro conocimiento en el sentido del artículo 6 del Reglamento.",
        "Comunicamos nuestra decisión a la persona notificante e indicamos las vías de recurso.",
        "Si la tramitación es automatizada, lo hacemos constar.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Motivación de las medidas (artículo 17)",
      paragraphs: [
        "Cuando restringimos la visibilidad de un contenido, lo retiramos, bloqueamos el acceso a él, suspendemos pagos, suspendemos la prestación del servicio o la cuenta, la persona afectada recibe una motivación clara y específica.",
        "La motivación indica la naturaleza y el alcance de la medida, su ámbito territorial y temporal, los hechos y circunstancias de la decisión, si intervino un tratamiento automatizado, el fundamento jurídico o la cláusula contractual infringida y las vías de recurso disponibles.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Sospecha de delito (artículo 18)",
      paragraphs: [
        "Cuando existan indicios de un delito que suponga un peligro para la vida o la seguridad de una persona, informaremos sin demora a las autoridades policiales o judiciales competentes.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Sistema interno de tramitación de reclamaciones (artículo 20)",
      paragraphs: [
        "Contra toda medida conforme a la sección 4 y contra la desestimación de una notificación puede reclamarse gratuitamente en el plazo de seis meses.",
        "Las reclamaciones se tramitan de forma tempestiva, no discriminatoria y diligente — bajo la supervisión de personal cualificado y no exclusivamente por medios automatizados.",
        "Si una reclamación resulta fundada, revocamos la medida. La vía se describe en [Reclamaciones y resolución de litigios](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Resolución extrajudicial de litigios (artículo 21)",
      paragraphs: [
        "Para los litigios sobre medidas conforme a la sección 4, los usuarios pueden acudir a un órgano de resolución extrajudicial de litigios certificado por el coordinador de servicios digitales competente. La Comisión Europea mantiene la lista de órganos certificados.",
        "Las decisiones de dichos órganos no nos vinculan; no estamos obligados a participar en procedimientos de proveedores independientes. La vía judicial permanece abierta.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Alertadores fiables (artículo 22)",
      paragraphs: [
        "Las notificaciones presentadas por un alertador reconocido como alertador fiable dentro de su ámbito de especialidad se tramitan de forma prioritaria.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Medidas contra los usos indebidos (artículo 23)",
      paragraphs: [
        "Bloqueamos durante un plazo razonable, previa advertencia, las cuentas a través de las cuales se facilitan con frecuencia contenidos manifiestamente ilícitos.",
        "Suspendemos la tramitación de notificaciones y reclamaciones para las personas que presentan con frecuencia notificaciones o reclamaciones manifiestamente infundadas — igualmente previa advertencia.",
        "Valoramos siempre el caso concreto: número, proporción y gravedad de los supuestos afectados, así como la intención.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Informes de transparencia (artículos 15 y 24)",
      paragraphs: [
        "Publicamos anualmente un informe sobre moderación de contenidos: número de órdenes de autoridades, número y tipo de notificaciones, medidas adoptadas, número de reclamaciones y su resultado, datos sobre el empleo de medios automatizados y número de litigios ante órganos extrajudiciales.",
        `Las microempresas y pequeñas empresas están exentas de parte de estas obligaciones conforme al artículo 19 del Reglamento. Mientras rija la exención, facilitamos los datos previa solicitud en ${ANBIETER.email}; en cuanto se publique el primer informe se enlazará aquí.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Trazabilidad de los comerciantes (artículos 30 a 32)",
      paragraphs: [
        "Los proveedores que actúan profesionalmente en la plataforma solo pueden ofertar tras habernos facilitado nombre, dirección, número de teléfono, dirección de correo electrónico, datos registrales, número de identificación a efectos del IVA y cuenta de pago, y siempre que sus datos resulten verosímiles.",
        "Mostramos dichos datos en el anuncio en la medida en que el Reglamento lo prevé.",
        "Si tenemos conocimiento de que un anuncio se refería a un producto o servicio ilícito, informamos a los huéspedes afectados en la medida en que dispongamos de sus datos de contacto.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Sistemas de recomendación (artículo 27)",
      paragraphs: [
        "Los principales parámetros del orden de los resultados de búsqueda y de las recomendaciones, así como la posibilidad de influir en ellos, se describen en [Precios, clasificación y recomendaciones](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Publicidad (artículo 26)",
      paragraphs: [
        "Actualmente no mostramos publicidad de pago de terceros ni posicionamientos de pago en los resultados de búsqueda.",
        "Si introdujéramos publicidad, la identificaríamos claramente, indicaríamos el anunciante y los principales parámetros de su difusión. Excluimos la publicidad basada en categorías especiales de datos personales conforme al artículo 9 del Reglamento (UE) 2016/679 y la publicidad dirigida a menores basada en la elaboración de perfiles.",
      ],
    },
  ],
};
