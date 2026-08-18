import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Cargos fuera de la plataforma",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "Esta política regula qué importes puede exigir un proveedor fuera de la plataforma y cuáles no. Protege a los huéspedes frente a exigencias en destino que no figuraban en el anuncio.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principio",
      paragraphs: [
        "Todo lo que deba abonarse por el servicio reservado debe figurar en el anuncio antes de finalizar la reserva — bien como componente del precio total, bien como partida de costes en destino.",
        "Un importe que no figuraba ni en el precio total ni como coste en destino no es debido por el huésped.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Qué puede exigirse en destino",
      paragraphs: ["En destino solo pueden exigirse:"],
      list: [
        "los importes expresamente indicados en el anuncio como costes en destino (por ejemplo, limpieza final, paquete de ropa de cama, plaza de aparcamiento);",
        "los tributos locales como la tasa turística, en la medida en que las normas locales exijan su abono en destino;",
        "una fianza indicada en el anuncio;",
        "los servicios que el huésped contrate voluntariamente ya en destino, a un precio comunicado previamente;",
        "la reparación de daños acreditados causados por el huésped.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Qué no puede exigirse",
      paragraphs: ["No está permitido, en particular:"],
      list: [
        "un recargo sobre el precio del alojamiento tras finalizar la reserva;",
        "un cargo por el hecho de que la reserva se haya realizado a través de myBestDays;",
        "gastos de gestión, de reserva o por uso de tarjeta no indicados en el anuncio;",
        "la invitación a cancelar la reserva y volver a reservar el mismo alojamiento fuera de la plataforma;",
        "la invitación a abonar el precio o parte de él mediante transferencia, en efectivo o por un servicio de pago ajeno a la plataforma, cuando el anuncio prevé el pago a través de la plataforma.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Elusión de la plataforma",
      paragraphs: [
        "Si el contacto entre huésped y proveedor se estableció a través de la plataforma, la reserva no puede tramitarse al margen de ella. Ello rige para ambas partes.",
        "Quien elude la plataforma pierde su protección: los pagos no están asegurados, nuestras políticas de cancelación y reembolso no se aplican y no podemos mediar en caso de conflicto.",
        "Las infracciones pueden dar lugar al bloqueo de la cuenta. Frente a los proveedores podemos además reclamar la comisión de servicio perdida.",
      ],
    },
    {
      id: "melden",
      heading: "5. Comunicar",
      paragraphs: [
        "Si en destino se le exige un importe que no figuraba en el anuncio, no lo abone y comuníquenoslo a través de las vías de contacto indicadas en [Reclamaciones y resolución de litigios](https://mybestdays.dk/rechtliches/beschwerden). Si ya ha pagado, le ayudamos a reclamarlo.",
      ],
    },
  ],
};
