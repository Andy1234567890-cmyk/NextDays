import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Declaración de accesibilidad",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "myBestDays debe poder ser utilizada por todos. Esta declaración describe el estado de la accesibilidad de la plataforma, las limitaciones conocidas y la vía para comunicarnos barreras.",
    "Se refiere a los requisitos de la Directiva (UE) 2019/882 sobre los requisitos de accesibilidad de los productos y servicios, aplicable desde el 28 de junio de 2025 a los servicios de comercio electrónico.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Estado de la accesibilidad",
      paragraphs: [
        "Nos guiamos por la norma armonizada EN 301 549 y por las Web Content Accessibility Guidelines (WCAG) 2.1 subyacentes, nivel de conformidad AA.",
        "Están implementados, entre otros: manejo íntegro con teclado, foco visible, estructura semántica de encabezados, etiquetas en todos los campos de formulario, alternativas textuales para los elementos de control, contraste de color suficiente, escalabilidad del texto sin pérdida de contenido y una presentación que se adapta al tamaño de pantalla.",
        "Los textos legales están disponibles en las 24 lenguas oficiales de la Unión y llevan el marcado lingüístico correcto, de modo que los lectores de pantalla los lean adecuadamente.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Limitaciones conocidas",
      paragraphs: ["Actualmente no son accesibles, en particular:"],
      list: [
        "Las fotos y descripciones de los anuncios proceden de los proveedores; las alternativas textuales de las fotos pueden faltar o ser insuficientes. Instamos a los proveedores a completarlas.",
        "Las representaciones cartográficas de terceros incrustadas solo son manejables con teclado de forma limitada. Todos los datos de ubicación están disponibles además como texto.",
        "Los documentos cargados por los proveedores (por ejemplo, normas de la casa en PDF) no están etiquetados de forma sistemática para la accesibilidad.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Accesibilidad de los alojamientos",
      paragraphs: [
        "Esta declaración se refiere a la plataforma, no a los alojamientos. Los datos sobre la accesibilidad arquitectónica de un alojamiento proceden del proveedor.",
        "Si depende de determinadas características — acceso sin escalones, anchura de puertas, ducha a ras de suelo, ascensor — aclárelas con el proveedor a través de la mensajería antes de reservar. Los datos inexactos sobre accesibilidad constituyen una infracción de nuestras normas y pueden notificarse.",
      ],
    },
    {
      id: "melden",
      heading: "4. Comunicar barreras",
      paragraphs: [
        `Si encuentra una barrera, comuníquenoslo en ${ANBIETER.email} o a través de las vías de contacto indicadas en [Reclamaciones y resolución de litigios](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Describa, por favor, qué página está afectada, qué pretendía hacer y qué productos de apoyo utiliza. Acusamos recibo y le comunicamos cómo y cuándo eliminaremos la barrera.",
        "Si necesita una información en formato accesible, se la facilitamos previa solicitud.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Procedimiento de aplicación",
      paragraphs: [
        "Si no queda satisfecho con nuestra respuesta, puede dirigirse a la autoridad competente para la vigilancia del mercado conforme a la Directiva (UE) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (anteriormente Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Dinamarca",
        "Teléfono: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
