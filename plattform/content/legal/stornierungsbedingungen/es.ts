import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Condiciones de cancelación",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "Cada proveedor elige una condición de cancelación para su alojamiento. Cuál se aplica figura en el anuncio y en su confirmación de reserva. Esta página describe las condiciones que ofrecemos a los proveedores.",
  ],
  sections: [
    {
      id: "modelle",
      heading: "1. Las condiciones de cancelación de un vistazo",
      paragraphs: [
        "Prevalece siempre la condición indicada en el anuncio. Los plazos se refieren al inicio del día de llegada en la hora local del alojamiento.",
      ],
      list: [
        "Flexible: cancelación gratuita hasta 24 horas antes de la llegada. Después se factura la primera noche y se reembolsan las restantes.",
        "Moderada: cancelación gratuita hasta 5 días antes de la llegada. Después se factura el 50 % del precio del alojamiento.",
        "Estricta: cancelación gratuita hasta 14 días antes de la llegada, siempre que la reserva se hiciera al menos 14 días antes. Después se factura el 50 % hasta 7 días antes de la llegada y, a partir de entonces, el precio íntegro.",
        "No reembolsable: sin cancelación gratuita. El precio suele ser inferior; advertimos expresamente de la ausencia de reembolso antes de la reserva.",
      ],
    },
    {
      id: "was-erstattet-wird",
      heading: "2. Qué se reembolsa en todo caso",
      paragraphs: [
        "Con independencia de la condición elegida, en toda cancelación reembolsamos:",
      ],
      list: [
        "la tasa turística y demás tributos de mero tránsito, en la medida en que se hayan liquidado a través de la plataforma y la pernoctación no se produzca;",
        "íntegramente una fianza cobrada a través de la plataforma;",
        "los servicios adicionales no prestados.",
      ],
    },
    {
      id: "stornierung-durch-anbieter",
      heading: "3. Cancelación por el proveedor",
      paragraphs: [
        "Si cancela el proveedor, recibirá íntegramente el importe abonado a través de la plataforma — con independencia de la condición de cancelación elegida.",
        "Además le ayudamos a encontrar un alojamiento comparable; véase [Política de recolocación y reembolso](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "widerruf",
      heading: "4. Inexistencia de derecho legal de desistimiento",
      paragraphs: [
        "En los servicios de alojamiento reservados para un periodo determinado no existe, por regla general, derecho legal de desistimiento conforme al artículo 16, letra l), de la Directiva 2011/83/UE. Las condiciones de cancelación descritas aquí son, por tanto, un compromiso contractual y no la aplicación de un derecho de desistimiento.",
        "Los derechos legales imperativos, en particular los derechos por defectos del alojamiento, no se ven afectados.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Modificación en lugar de cancelación",
      paragraphs: [
        "Si desea modificar el periodo o el número de viajeros, solicite el cambio desde su reserva. El proveedor debe aceptarlo; hasta entonces subsiste la reserva original.",
        "Si el cambio supone un precio superior, la diferencia resulta exigible. Si supone un precio inferior, reembolsamos la diferencia en la medida en que la condición de cancelación aplicable lo permita para la parte suprimida.",
      ],
    },
    {
      id: "wie",
      heading: "6. Cómo cancelar",
      paragraphs: [
        "Cancele desde su cuenta, apartado «Reservas». Para el plazo es determinante el momento en que la cancelación nos llega.",
        "Recibirá una confirmación de cancelación con el importe del reembolso. Sobre el abono, véanse las [Condiciones de pago](https://mybestdays.dk/rechtliches/zahlungsbedingungen#rueckerstattungen).",
      ],
    },
  ],
};
