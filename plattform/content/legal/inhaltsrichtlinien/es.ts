import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Normas sobre contenidos adecuados",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "Estas normas se aplican a todos los contenidos que los usuarios publican en myBestDays: anuncios, fotos, valoraciones, mensajes, datos de perfil y respuestas a valoraciones.",
    "Forman parte de las [Condiciones de uso](https://mybestdays.dk/rechtliches/nutzungsbedingungen). Una infracción puede dar lugar a la retirada del contenido y a medidas contra la cuenta.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Qué no está permitido",
      paragraphs: ["En myBestDays no se admiten, en particular, los siguientes contenidos:"],
      list: [
        "contenidos ilícitos de cualquier tipo, en particular incitaciones a delinquir, contenidos terroristas y representaciones de abuso sexual de menores;",
        "contenidos que inciten al odio o a la violencia contra personas o grupos por razón de origen, color de piel, religión, convicciones, sexo, identidad de género, orientación sexual, discapacidad o edad;",
        "injurias, amenazas, acoso y la exposición dirigida de personas concretas;",
        "datos personales de terceros sin su consentimiento, en particular nombres, direcciones, números de teléfono, datos de identidad o de pago;",
        "indicaciones engañosas sobre un alojamiento, su ubicación, equipamiento, tamaño o disponibilidad;",
        "fotos, textos o marcas ajenos sin los derechos necesarios;",
        "publicidad, spam y contenidos que conduzcan a otras vías de reserva fuera de la plataforma;",
        "software malicioso, intentos de phishing y enlaces a tales contenidos;",
        "ofertas de algo distinto de un servicio de alojamiento.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Fotos",
      paragraphs: [
        "Las fotos deben mostrar el alojamiento efectivamente ofrecido y haberse tomado en un estado que corresponda al actual.",
        "Las fotos no pueden mostrar a personas identificables sin su consentimiento. La edición es admisible en la medida en que no falsee la impresión del alojamiento — aclarar la imagen sí, retocar para eliminar un edificio contiguo no.",
        "La videovigilancia en el alojamiento debe divulgarse en el anuncio. En espacios interiores en los que los huéspedes tienen una expectativa legítima de intimidad — dormitorios, baños — las cámaras no están permitidas, ni siquiera apagadas.",
      ],
    },
    {
      id: "melden",
      heading: "3. Notificar contenidos",
      paragraphs: [
        "Si considera que un contenido es ilícito o contrario a estas normas, puede notificarlo mediante la función de notificación disponible en cada anuncio, valoración y mensaje.",
        "El procedimiento de notificación conforme al artículo 16 del Reglamento (UE) 2022/2065 y la tramitación de las notificaciones se describen en [Reglamento de Servicios Digitales](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Cómo aplicamos estas normas",
      paragraphs: [
        "Examinamos todo contenido notificado y elegimos la medida idónea menos gravosa: una advertencia, la retirada de la parte afectada, la retirada de todo el contenido, la restricción de la visibilidad, el bloqueo de una función o el bloqueo de la cuenta.",
        "Las infracciones reiteradas o graves tienen mayor peso. Ante contenidos manifiestamente ilícitos o peligro para personas actuamos de inmediato.",
        "Motivamos toda medida frente a la persona afectada e indicamos la vía de reclamación. La reclamación es tramitada por personas.",
      ],
    },
  ],
};
