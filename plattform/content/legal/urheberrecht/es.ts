import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Política de derechos de autor",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "myBestDays respeta los derechos de terceros y espera lo mismo de sus usuarios. Esta política describe cómo comunicar una infracción de derechos de autor y cómo la tramitamos.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principio",
      paragraphs: [
        "Quien publique contenidos en la plataforma garantiza disponer de los derechos necesarios. Ello rige en particular para fotos, planos, textos y fragmentos de mapas en los anuncios.",
        "Publicar contenidos ajenos sin autorización constituye una infracción de las [Condiciones de uso](https://mybestdays.dk/rechtliches/nutzungsbedingungen) y de las [Normas sobre contenidos adecuados](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
      ],
    },
    {
      id: "meldung",
      heading: "2. Comunicar una infracción",
      paragraphs: [
        "Comunique una infracción de derechos de autor mediante la función de notificación del contenido afectado o a través del punto de contacto indicado en [Reglamento de Servicios Digitales](https://mybestdays.dk/rechtliches/dsa). Una comunicación debería contener:",
      ],
      list: [
        "una designación exacta del contenido impugnado, en particular la URL;",
        "una descripción de la obra protegida y la acreditación de su titularidad de derechos o de su facultad para actuar en nombre del titular;",
        "una motivación de por qué el uso no está permitido;",
        "su nombre y una dirección de contacto;",
        "la declaración de que sus datos son exactos y completos según su leal saber y entender.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Cómo tramitamos las comunicaciones",
      paragraphs: [
        "Acusamos recibo de su comunicación sin demora y resolvemos con rapidez y diligencia.",
        "Si consideramos fundada la comunicación, retiramos el contenido o bloqueamos el acceso a él e informamos a la persona que lo publicó, indicando los motivos y la vía de reclamación.",
        "Si consideramos infundada la comunicación, se lo comunicamos motivadamente.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Oposición de la persona afectada",
      paragraphs: [
        "Si su contenido ha sido retirado y considera que ello es injustificado, puede reclamar gratuitamente en el plazo de seis meses. Exponga entonces por qué está facultado para el uso.",
        "Si la reclamación resulta fundada, restablecemos el contenido.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Infracciones reiteradas",
      paragraphs: [
        "Bloqueamos, previa advertencia, las cuentas a través de las cuales se publican reiteradamente contenidos infractores. Ello se corresponde con el artículo 23 del Reglamento (UE) 2022/2065.",
        "Del mismo modo bloqueamos la función de notificación a las personas que presenten reiteradamente comunicaciones manifiestamente infundadas.",
      ],
    },
  ],
};
