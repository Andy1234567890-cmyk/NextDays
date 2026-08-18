import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Alquiler de corta duración y obligaciones de registro",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "En muchas ciudades y regiones el alquiler de corta duración de viviendas está sujeto a autorización, registro o comunicación. Esta página explica qué significa para proveedores y para huéspedes.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Marco jurídico",
      paragraphs: [
        "El Reglamento (UE) 2024/1028 sobre la recopilación e intercambio de datos relativos a los servicios de alquiler de alojamientos de corta duración crea un marco uniforme: allí donde un Estado miembro o una entidad local haya implantado un procedimiento de registro, cada unidad recibe un número de registro.",
        "Las plataformas deben mostrar dicho número, comprobar su validez por muestreo y transmitir periódicamente a las autoridades competentes datos sobre la actividad.",
        "Además siguen siendo aplicables las normas nacionales y locales — por ejemplo, sobre cambio de uso de viviendas, número máximo de días de alquiler, protección contra incendios y registro de huéspedes.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Qué deben hacer los proveedores",
      paragraphs: [
        "Compruebe antes de publicar si su alojamiento está sujeto a obligación de registro, autorización o comunicación y cúmplala.",
        "Introduzca el número de registro en el inmueble si existe. Lo mostramos en el anuncio.",
        "Respete el número máximo de días de alquiler y demás límites locales. Vigilarlos es tarea suya, no nuestra.",
        "No podemos mostrar de forma permanente un anuncio sin el número de registro exigido. Si falta o resulta inválido, lo requerimos; si no se facilita, desactivamos el anuncio.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. Qué significa esto para los huéspedes",
      paragraphs: [
        "Si un alojamiento está sujeto a obligación de registro, verá el número de registro en el anuncio. Es un indicio de que el alquiler ha sido comunicado a la autoridad competente.",
        "En destino puede ser necesario un registro (parte de entrada, datos de identidad, declaración de tasa turística). El proveedor solicitará los datos necesarios; facilítelos con tiempo suficiente.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Transmisión de datos a las autoridades",
      paragraphs: [
        "En la medida en que el Reglamento (UE) 2024/1028 o el Derecho nacional lo prevean, transmitimos a las autoridades competentes datos sobre la actividad de alquiler — en particular, número de registro, dirección de la unidad, número de noches ocupadas y número de huéspedes.",
        "Esta transmisión se realiza para cumplir una obligación legal conforme al artículo 6, apartado 1, letra c), del Reglamento (UE) 2016/679. Los detalles figuran en la [Política de privacidad](https://mybestdays.dk/rechtliches/datenschutz).",
        "Al margen de ello subsiste la obligación de comunicación fiscal conforme a DAC7; véase la [Política fiscal](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Comunicar incumplimientos",
      paragraphs: [
        "Si tiene indicios de que un alojamiento se ofrece sin la autorización o el registro exigidos, comuníquenoslo mediante la función de notificación del anuncio. Damos seguimiento a toda comunicación.",
      ],
    },
  ],
};
