import type { LegalDoc } from "../types";

// Spanische Fassung der Gast-AGB. Quelle ist content/legal/agb/de.ts —
// Änderungen immer zuerst dort.
export const agb: LegalDoc = {
  title: "Condiciones de uso para huéspedes (CGC)",
  stand: "Última actualización: 3 de julio de 2026",
  intro: [
    "Las presentes Condiciones de uso regulan la utilización del portal de reservas myBestDays (en adelante, la «Plataforma») por parte de viajeros y personas que efectúan reservas (en adelante, el «Huésped»).",
    "La Plataforma es operada por [razón social completa, forma jurídica, dirección y datos registrales del operador — completar antes de la publicación] (en adelante, «myBestDays» o «nosotros»).",
  ],
  sections: [
    {
      heading: "§ 1 Ámbito de aplicación",
      paragraphs: [
        "Las presentes condiciones se aplican al uso de la Plataforma, en particular a la búsqueda de alojamientos y a la reserva de servicios de hospedaje a través de la Plataforma.",
        "Al propio servicio de hospedaje se aplican, adicionalmente, las condiciones del respectivo proveedor (p. ej., normas de la casa, condiciones de cancelación) indicadas en la oferta.",
      ],
    },
    {
      heading: "§ 2 Papel de myBestDays; celebración del contrato",
      paragraphs: [
        "myBestDays actúa como intermediaria de los servicios de hospedaje ofrecidos por los respectivos proveedores (agencias, arrendadores o propietarios, en adelante, el «Proveedor»). El contrato sobre el alojamiento se celebra exclusivamente entre el Huésped y el respectivo Proveedor. myBestDays no es parte del contrato de hospedaje.",
        "El respectivo Proveedor se identifica en la oferta y en la confirmación de la reserva.",
      ],
    },
    {
      heading: "§ 3 Reserva y confirmación de la reserva",
      paragraphs: [
        "La presentación de los alojamientos en la Plataforma constituye una invitación a presentar una oferta de reserva. Al finalizar el proceso de reserva (clic en el botón de reserva con obligación de pago), el Huésped presenta una oferta vinculante para la celebración de un contrato de hospedaje con el Proveedor.",
        "El contrato se celebra cuando la reserva es confirmada. La confirmación de la reserva se envía al Huésped a la dirección de correo electrónico indicada.",
        "El Huésped está obligado a facilitar datos veraces y completos al realizar la reserva (en particular, nombre, datos de contacto y número de viajeros).",
      ],
    },
    {
      heading: "§ 4 Precios y pago",
      paragraphs: [
        "Se aplican los precios indicados en la oferta en el momento de la reserva, incluidos los impuestos, las tasas y los costes adicionales allí indicados. Los precios se muestran en la moneda indicada en la oferta. En el lugar del alojamiento pueden aplicarse tasas locales adicionales (p. ej., la tasa turística), siempre que así se indique en la oferta.",
        "El pago se procesa a través del proveedor de servicios de pago Stripe. Los datos de pago (p. ej., los datos de la tarjeta) son recogidos y tratados directamente por Stripe; myBestDays no almacena datos completos de tarjetas. Stripe trata los datos personales de conformidad con la [política de privacidad de Stripe](https://stripe.com/privacy).",
        "Si en la oferta se indica una fianza, esta podrá preautorizarse en el momento de la reserva o de la llegada y retenerse total o parcialmente en caso de daños; serán determinantes las indicaciones de la oferta.",
      ],
    },
    {
      heading: "§ 5 Cancelación, modificación de la reserva y desistimiento",
      paragraphs: [
        "Que una reserva pueda cancelarse o modificarse sin coste, y en qué condiciones, se rige por las condiciones de cancelación del Proveedor indicadas en la oferta.",
        "En el caso de los servicios de hospedaje reservados para un período determinado, con arreglo al artículo 16, letra l), de la Directiva de la UE sobre los derechos de los consumidores o a las disposiciones nacionales correspondientes, por regla general no existe un derecho legal de desistimiento. Los derechos legales imperativos del Huésped permanecen inalterados.",
      ],
    },
    {
      heading: "§ 6 Obligaciones del Huésped",
      paragraphs: [
        "El Huésped utilizará el alojamiento conforme a lo pactado, respetará la ocupación máxima indicada en la oferta y observará las normas de la casa del Proveedor.",
        "La Plataforma no podrá utilizarse de forma abusiva, en particular para reservas ficticias, pagos fraudulentos o la publicación de contenidos ilícitos (p. ej., en valoraciones o mensajes).",
      ],
    },
    {
      heading: "§ 7 Responsabilidad de myBestDays",
      paragraphs: [
        "El Proveedor es el único responsable de la prestación del servicio de hospedaje. myBestDays no responde de la exactitud de los contenidos de las ofertas publicados por los Proveedores, pero realiza la intermediación y el procesamiento de los pagos con la diligencia de un ordenado comerciante.",
        "myBestDays responde de forma ilimitada en caso de dolo y negligencia grave, así como de los daños derivados de lesiones a la vida, la integridad física o la salud. En caso de negligencia leve, myBestDays solo responde por el incumplimiento de obligaciones contractuales esenciales (obligaciones cardinales), limitándose a los daños previsibles y típicos del contrato. Las normas legales imperativas en materia de responsabilidad permanecen inalteradas.",
      ],
    },
    {
      heading: "§ 8 Protección de datos",
      paragraphs: [
        "myBestDays trata datos personales del Huésped para llevar a cabo la intermediación y la reserva. Los datos de la reserva se transmiten al respectivo Proveedor en la medida en que ello sea necesario para la ejecución del contrato de hospedaje. Al procesamiento de pagos se aplica el § 4.",
        "Los detalles se recogen en la información de protección de datos de la Plataforma.",
      ],
    },
    {
      heading: "§ 9 Reclamaciones y resolución de litigios",
      paragraphs: [
        "Las reclamaciones relativas al alojamiento las dirigirá el Huésped en primer lugar al Proveedor; para cuestiones sobre la reserva o el pago, el soporte de myBestDays está disponible a través de los canales de contacto indicados en la Plataforma.",
        "myBestDays no está obligada ni dispuesta a participar en procedimientos de resolución de litigios ante una junta arbitral de consumo, salvo que exista una obligación legal.",
      ],
    },
    {
      heading: "§ 10 Modificaciones de las presentes condiciones",
      paragraphs: [
        "myBestDays podrá modificar las presentes condiciones con efectos para el futuro, siempre que ello sea necesario por motivos justificados (en particular, cambios legislativos o cambios en la jurisprudencia) y el Huésped no resulte perjudicado de forma desproporcionada. A las reservas ya celebradas se les aplica la versión vigente en el momento de la reserva.",
      ],
    },
    {
      heading: "§ 11 Disposiciones finales",
      paragraphs: [
        "Se aplicará el Derecho del Estado en el que la operadora tenga su domicilio social, con exclusión de la Convención de las Naciones Unidas sobre los Contratos de Compraventa Internacional de Mercaderías. Si el Huésped es consumidor, las disposiciones imperativas de protección de los consumidores del Estado en el que tenga su residencia habitual permanecen inalteradas.",
        "Si alguna disposición de las presentes condiciones fuera o deviniera ineficaz, ello no afectará a la validez de las restantes disposiciones.",
      ],
    },
  ],
};
