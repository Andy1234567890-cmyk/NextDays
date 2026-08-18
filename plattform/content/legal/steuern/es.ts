import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Política fiscal",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "Esta página explica qué impuestos y tributos pueden devengarse en una reserva a través de myBestDays, quién los debe y qué obligaciones de comunicación nos incumben como operador de plataforma.",
    "No constituye asesoramiento fiscal. Para su tratamiento fiscal concreto, diríjase a un asesor fiscal.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Lo que afecta a los huéspedes",
      paragraphs: [
        "El precio total mostrado incluye los impuestos liquidados a través de la plataforma — en particular el IVA sobre el servicio de alojamiento, en la medida en que el proveedor lo adeude.",
        "Los tributos locales como la tasa turística, el impuesto sobre estancias o la tasa de turismo se liquidan, según el municipio, a través de la plataforma o se recaudan en destino. Indicamos el supuesto aplicable antes de finalizar la reserva.",
        "La factura del servicio de alojamiento la emite el proveedor; él es el empresario prestador. Si necesita una factura con IVA desglosado, solicítela al proveedor.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Lo que afecta a los proveedores",
      paragraphs: [
        "Los proveedores son responsables del tratamiento fiscal correcto de sus ingresos — impuesto sobre la renta o de sociedades, IVA y tributos locales.",
        "Si un arrendamiento está sujeto a IVA y qué tipo se aplica se rige por el Derecho del Estado en el que se encuentre el alojamiento (lugar de realización del hecho imponible en inmuebles).",
        "Los proveedores consignan en el inmueble los tributos aplicables a su alojamiento para que se indiquen correctamente en el anuncio.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Comunicación a las administraciones tributarias (DAC7)",
      paragraphs: [
        "Como operador de una plataforma digital estamos obligados, en virtud de la Directiva (UE) 2021/514 («DAC7») y de las disposiciones nacionales de transposición, a comunicar anualmente a la administración tributaria competente datos sobre los proveedores sujetos a comunicación y las contraprestaciones obtenidas a través de la plataforma.",
        "Se comunican, en particular, nombre, dirección, número de identificación fiscal, fecha de nacimiento o número de registro, datos de la cuenta de abono, dirección del alojamiento y las contraprestaciones abonadas por trimestre, así como las comisiones retenidas.",
        "Los proveedores reciben copia de los datos comunicados que les conciernen.",
        "Si un proveedor no facilita los datos necesarios para la comunicación pese a dos requerimientos, estamos obligados a retener los abonos y bloquear la cuenta.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Retenciones",
      paragraphs: [
        "Cuando el Derecho de un Estado nos obligue a retener e ingresar impuestos de un abono, lo haremos e indicaremos la retención en la liquidación.",
      ],
    },
  ],
};
