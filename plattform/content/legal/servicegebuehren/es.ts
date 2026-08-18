import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Comisiones de servicio",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "myBestDays se financia mediante una comisión de servicio sobre las reservas intermediadas. Esta página explica quién la paga, cómo se calcula y dónde se indica.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Quién paga la comisión de servicio",
      paragraphs: [
        "La comisión de servicio la soporta el proveedor. Se detrae del valor de la reserva y reduce el abono que le corresponde; el huésped no la paga adicionalmente.",
        "Si excepcionalmente se devengara una comisión de servicio para el huésped en una reserva, la indicamos como partida independiente del precio total antes de finalizar la reserva. Sin esa indicación, el huésped no soporta comisión alguna.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Cómo se calcula",
      paragraphs: [
        "La comisión de servicio es un porcentaje del valor de reserva liquidado a través de la plataforma. El tipo aplicable a sus reservas figura en su cuenta de anfitrión y en el acuerdo que aceptó al registrarse.",
        "La base de cálculo es el precio del alojamiento más los suplementos liquidados a través de la plataforma. No se incluyen las partidas de mero tránsito que no constituyen contraprestación del proveedor — en particular la tasa turística y la fianza.",
        "La comisión de servicio se calcula e indica en la moneda del anuncio.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. IVA",
      paragraphs: [
        "Sobre la comisión de servicio se devenga IVA en la medida en que legalmente proceda. Que se repercuta o se aplique la inversión del sujeto pasivo depende de la sede y del estatus del proveedor.",
        "Expedimos al proveedor una liquidación de la comisión de servicio, consultable en su cuenta.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Cancelación y reembolso",
      paragraphs: [
        "Si una reserva se reembolsa íntegramente, reembolsamos la comisión de servicio en proporción al valor de reserva reembolsado.",
        "Si el proveedor cancela sin causa justificada, la comisión de servicio no decae automáticamente; nos reservamos el derecho a reclamar los costes originados por la cancelación.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Modificación de la comisión de servicio",
      paragraphs: [
        "Anunciamos toda modificación del tipo a los proveedores al menos 30 días antes de su entrada en vigor en un soporte duradero; ello se corresponde con el artículo 3, apartado 2, del Reglamento (UE) 2019/1150.",
        "Para las reservas ya confirmadas rige el tipo vigente en el momento de la reserva.",
      ],
    },
  ],
};
