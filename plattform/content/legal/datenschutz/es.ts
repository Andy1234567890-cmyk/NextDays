import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Política de privacidad",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "Esta política describe qué datos personales trata myBestDays, con qué finalidades, sobre qué base jurídica y qué derechos le asisten. Se aplica al sitio web, a las aplicaciones móviles y a todos los demás accesos a la plataforma.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Responsable del tratamiento y delegado de protección de datos",
      paragraphs: [
        `El responsable del tratamiento en el sentido del Reglamento (UE) 2016/679 (RGPD) es ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dinamarca, CVR n.º ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Los datos completos del prestador figuran en el [Aviso legal](https://mybestdays.dk/rechtliches/impressum).`,
        "No se ha designado delegado de protección de datos; no concurren los requisitos del artículo 37 del RGPD. Dirija sus consultas en materia de protección de datos a la dirección de correo electrónico indicada.",
        "Los proveedores con los que reserve son responsables autónomos del tratamiento de los datos que reciben de nosotros. Les son aplicables las [Normas de protección de datos para anfitriones](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Qué datos tratamos",
      paragraphs: ["Según cómo utilice la plataforma, tratamos:"],
      list: [
        "datos identificativos: nombre, dirección de correo electrónico, número de teléfono, idioma y moneda, contraseña en forma cifrada;",
        "datos de reserva: alojamiento reservado, periodo, número y nombres de los viajeros, peticiones especiales, estado de la reserva;",
        "datos de pago: importe, moneda, estado del pago, los últimos dígitos del medio de pago y la referencia de la operación de nuestro proveedor de servicios de pago. Los datos completos de tarjeta no llegan a nosotros;",
        "datos de comunicación: mensajes entre usted y el proveedor, consultas a nuestro servicio de atención al cliente, reclamaciones;",
        "datos de contenido: valoraciones, fotos, listas de favoritos;",
        "datos de uso: páginas visitadas, consultas de búsqueda, momento del acceso;",
        "datos técnicos: dirección IP, identificadores de navegador y dispositivo, sistema operativo, referente.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Finalidades y bases jurídicas",
      paragraphs: [
        "Puesta a disposición de la plataforma, cuenta, búsqueda, reserva, tramitación de pagos y comunicación con el proveedor: artículo 6, apartado 1, letra b), del RGPD (contrato o medidas precontractuales).",
        "Atención al cliente, tramitación de reclamaciones y resolución de litigios: artículo 6, apartado 1, letras b) y f), del RGPD.",
        "Detección y prevención de fraude, abuso e incidentes de seguridad, así como aplicación de nuestras condiciones: artículo 6, apartado 1, letra f), del RGPD (interés legítimo en un mercado seguro).",
        "Valoraciones y su publicación: artículo 6, apartado 1, letras b) y f), del RGPD.",
        "Cumplimiento de obligaciones legales, en particular obligaciones mercantiles y fiscales de conservación, la obligación de comunicación conforme a la Directiva (UE) 2021/514 (DAC7) y las obligaciones derivadas del Reglamento (UE) 2022/2065: artículo 6, apartado 1, letra c), del RGPD.",
        "Mejora de la plataforma mediante el análisis de datos de uso agregados: artículo 6, apartado 1, letra f), del RGPD.",
        "Correos publicitarios y cookies no necesarias: artículo 6, apartado 1, letra a), del RGPD (consentimiento), que puede retirar en cualquier momento con efectos para el futuro.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Destinatarios",
      paragraphs: [
        "Los proveedores reciben los datos que necesitan para ejecutar su reserva y cumplir sus obligaciones legales — en particular nombre, datos de contacto, periodo, número de viajeros y sus mensajes dirigidos a ellos.",
        "Nuestro proveedor de servicios de pago Stripe trata los datos de pago como responsable autónomo; se aplica además la [política de privacidad de Stripe](https://stripe.com/privacy).",
        "Los prestadores que realizan para nosotros alojamiento técnico, explotación de bases de datos, envío de correos, diagnóstico de errores y herramientas de atención al cliente tratan los datos exclusivamente siguiendo instrucciones, sobre la base de un contrato conforme al artículo 28 del RGPD.",
        "Las autoridades y los tribunales reciben datos únicamente en la medida en que estemos obligados a ello; véase [Normas aplicables a las solicitudes de autoridades y fuerzas de seguridad](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Las administraciones tributarias reciben los datos sobre proveedores que deben comunicarse conforme a DAC7.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Transferencias a terceros países",
      paragraphs: [
        "Nuestros servidores y los de nuestros encargados del tratamiento se encuentran en la Unión Europea.",
        "En la medida en que en casos concretos tenga lugar un tratamiento fuera del Espacio Económico Europeo, este se basa exclusivamente en una decisión de adecuación de la Comisión Europea o en las cláusulas contractuales tipo conforme al artículo 46, apartado 2, letra c), del RGPD, junto con garantías complementarias.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Plazos de conservación",
      paragraphs: [
        "Conservamos los datos de la cuenta mientras esta exista y los suprimimos después, salvo que se oponga una obligación de conservación.",
        "Los datos de reserva y de pago están sujetos a plazos mercantiles y fiscales de conservación; conforme al Derecho contable danés son, por regla general, de cinco años desde el fin del ejercicio al que se refieran.",
        "Conservamos los mensajes relativos a una reserva hasta tres años después del fin de la estancia, para poder aclarar controversias.",
        "Las valoraciones permanecen de forma anonimizada tras la eliminación de su cuenta, ya que forman parte de la base de valoración de un alojamiento.",
        "Los datos sobre casos de fraude y abuso se conservan mientras sea necesario para evitar nuevas infracciones, y como máximo tres años tras el último incidente.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Sus derechos",
      paragraphs: ["Conforme al RGPD le asisten los siguientes derechos:"],
      list: [
        "acceso a los datos conservados sobre usted (artículo 15);",
        "rectificación de datos inexactos (artículo 16);",
        "supresión (artículo 17), salvo que se oponga una obligación de conservación;",
        "limitación del tratamiento (artículo 18);",
        "portabilidad de los datos (artículo 20);",
        "oposición a un tratamiento basado en intereses legítimos (artículo 21), en particular a la publicidad directa;",
        "retirada de un consentimiento prestado, con efectos para el futuro (artículo 7, apartado 3);",
        `reclamación ante una autoridad de control (artículo 77) — es competente la autoridad de su residencia, de su lugar de trabajo o del lugar de la presunta infracción. En la sede del responsable es ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Dinamarca, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Cómo ejercer sus derechos",
      paragraphs: [
        `Muchos datos puede consultarlos, modificarlos o suprimirlos directamente en su cuenta. Para todo lo demás diríjase a ${ANBIETER.email}.`,
        "Respondemos sin demora y, a más tardar, en el plazo de un mes. Si no pudiéramos cumplir ese plazo, se lo comunicaremos motivadamente.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Decisiones automatizadas",
      paragraphs: [
        "Empleamos procedimientos automatizados para detectar fraude, abuso y contenidos ilícitos. Si uno de ellos conduce a una medida contra su cuenta o sus contenidos, la motivamos y usted puede solicitar su revisión por una persona.",
        "No adoptamos decisiones basadas únicamente en el tratamiento automatizado con efectos jurídicos en el sentido del artículo 22 del RGPD.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Obligación de facilitar datos",
      paragraphs: [
        "Debe facilitar los datos necesarios para una reserva; sin ellos no puede celebrarse contrato alguno ni ponerse a disposición el alojamiento. Todos los demás datos son voluntarios.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Modificaciones de esta política",
      paragraphs: [
        "Adaptamos esta política cuando cambian el tratamiento o el marco jurídico. La versión vigente en cada momento puede consultarse aquí; la fecha de actualización figura arriba.",
      ],
    },
  ],
};
