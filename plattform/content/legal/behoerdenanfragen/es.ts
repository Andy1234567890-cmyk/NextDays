import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Normas aplicables a las solicitudes de autoridades y fuerzas de seguridad",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "Estas normas se dirigen a autoridades, tribunales y fuerzas de seguridad que soliciten datos a myBestDays o dirijan una orden relativa a contenidos. Se publican aquí para que también los usuarios puedan conocer en qué condiciones facilitamos datos.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principio",
      paragraphs: [
        "Solo facilitamos datos de usuarios cuando existe un fundamento jurídico válido y la solicitud cumple los requisitos formales. Una petición informal de datos no es suficiente.",
        "Examinamos toda solicitud en cuanto a competencia, fundamento jurídico, determinación y proporcionalidad y facilitamos únicamente los datos que la solicitud identifique.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Requisitos de una solicitud",
      paragraphs: ["Una solicitud debería contener:"],
      list: [
        "el organismo solicitante, la referencia del expediente y los datos de contacto de la persona instructora, en papel oficial;",
        "el fundamento jurídico conforme al Derecho nacional o de la Unión;",
        "una identificación precisa de la persona o cuenta afectada — dirección de correo electrónico, número de reserva o URL del anuncio;",
        "los datos concretamente identificados y el periodo;",
        "en su caso, una resolución judicial, en la medida en que el Derecho aplicable la exija;",
        "una indicación cuando informar a la persona afectada comprometería la investigación, con mención del fundamento jurídico.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Órdenes conforme al Reglamento (UE) 2022/2065",
      paragraphs: [
        "Las órdenes de actuar contra contenidos ilícitos (artículo 9) y las órdenes de facilitar información (artículo 10) deben contener los elementos allí previstos, en particular el fundamento jurídico, la localización electrónica exacta, la motivación, las vías de recurso y la lengua.",
        "Acusamos recibo y comunicamos a la autoridad emisora qué medidas hemos adoptado y cuándo.",
        "Informamos a la persona afectada de una orden a más tardar en el momento de su ejecución, salvo que la autoridad ordene su aplazamiento indicando el fundamento jurídico.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Situaciones de emergencia",
      paragraphs: [
        "Ante un peligro inminente para la vida o la integridad física facilitamos los datos necesarios para conjurarlo incluso sin orden formal previa. Identifique expresamente tal solicitud como emergencia y describa el peligro.",
        "Cuando existan indicios de un delito que suponga un peligro para la vida o la seguridad de una persona, informamos por iniciativa propia a las autoridades competentes (artículo 18 del Reglamento (UE) 2022/2065).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Qué datos conservamos",
      paragraphs: [
        "Las categorías de datos que tratamos y su plazo de conservación figuran en la [Política de privacidad](https://mybestdays.dk/rechtliches/datenschutz). Más allá de los plazos allí indicados no conservamos datos.",
        "No se realiza conservación más allá de lo necesario. Atendemos, dentro del marco jurídicamente admisible, un requerimiento de conservación provisional de datos para un procedimiento en curso.",
        "No disponemos de datos de pago completos; deben solicitarse al proveedor de servicios de pago.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Información a la persona afectada",
      paragraphs: [
        "Informamos a los usuarios afectados de una solicitud relativa a sus datos, salvo que una norma legal o una orden motivada de la autoridad lo prohíba o exista un peligro inminente para la vida o la integridad física.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Dónde dirigir las solicitudes",
      paragraphs: [
        "Dirija las solicitudes al punto de contacto único para autoridades indicado en [Reglamento de Servicios Digitales](https://mybestdays.dk/rechtliches/dsa). Las tramitamos en alemán, danés e inglés.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Transparencia",
      paragraphs: [
        "Indicamos el número y el tipo de órdenes de autoridades en nuestro informe anual de transparencia; véase [Reglamento de Servicios Digitales](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
