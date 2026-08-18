import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Política ante perturbaciones graves",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "A veces un acontecimiento impide el viaje o la estancia sin que huésped ni proveedor puedan evitarlo. Esta política describe cuáles son esos acontecimientos y qué se aplica entonces.",
    "Prevalece sobre la condición de cancelación elegida en el anuncio.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Qué acontecimientos están cubiertos",
      paragraphs: [
        "Están cubiertos los acontecimientos que se produzcan tras la reserva, fueran imprevisibles para ambas partes y hagan imposible o jurídicamente inadmisible el viaje o la estancia:",
      ],
      list: [
        "prohibiciones administrativas de viaje o estancia, toques de queda y cierres de fronteras que afecten al destino o al lugar de origen;",
        "catástrofes y fenómenos naturales que afecten al destino — terremoto, inundación, temporal, gran incendio, erupción volcánica;",
        "guerra, conflictos armados, atentados terroristas y disturbios en el destino;",
        "una epidemia o pandemia declarada por las autoridades con medidas que prohíban la estancia;",
        "el fallo prolongado del suministro de electricidad, agua o calefacción en el destino;",
        "la desaparición total de la posibilidad de llegar al destino como consecuencia de alguno de los acontecimientos anteriores.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Qué acontecimientos no están cubiertos",
      paragraphs: ["No están cubiertos, en particular:"],
      list: [
        "la enfermedad o lesión del huésped o de sus allegados — para ello está prevista una póliza de viaje;",
        "impedimentos profesionales, fechas de examen o la supresión de las vacaciones;",
        "la suspensión de un evento por el que se reservó el viaje, si el alojamiento sigue siendo utilizable;",
        "la meteorología que no constituya catástrofe natural — lluvia, frío, calor, ausencia de nieve;",
        "el fallo de medios de transporte concretos, mientras siga siendo posible un desplazamiento razonable;",
        "la cancelación de un vuelo o una huelga en una empresa de transporte — para ello existen derechos frente a la empresa de transporte.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Qué se aplica cuando se produce un acontecimiento cubierto",
      paragraphs: [
        "Si el acontecimiento afecta al periodo de su reserva, puede cancelar sin coste. Se le reembolsará íntegramente el importe abonado a través de la plataforma.",
        "Si la estancia ya ha comenzado, reembolsamos la parte correspondiente a las noches que ya no puedan utilizarse.",
        "Tal cancelación no perjudica al proveedor en la valoración de su fiabilidad.",
        "Alternativamente puede acordar un aplazamiento con el proveedor; le ayudamos con el cambio.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Cómo invocar esta política",
      paragraphs: [
        "Diríjase a nosotros por las vías indicadas en [Reclamaciones y resolución de litigios](https://mybestdays.dk/rechtliches/beschwerden) indicando el número de reserva y el acontecimiento.",
        "Verificamos sobre la base de fuentes públicamente accesibles — resoluciones administrativas, avisos oficiales, informaciones de fuentes periodísticas reconocidas — y resolvemos con rapidez.",
        "Si la situación aún no puede valorarse de forma definitiva, esperamos la evolución hasta poco antes del día de llegada y decidimos entonces. Hasta ese momento su reserva permanece inalterada.",
      ],
    },
  ],
};
