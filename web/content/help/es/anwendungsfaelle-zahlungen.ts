import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Pagos",
  description: "Gestionar los pagos correctamente.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Pagos",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Configurar un depósito",
          excerpt: "Así cobra al hacer la reserva solo una parte del importe en lugar de la suma total.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida",
            },
            {
              type: "p",
              text: "En lugar de cobrar de inmediato el importe total de la reserva, puede establecer un depósito como regla de pago. El huésped paga al reservar solo una parte del importe a través de Stripe o PayPal, y el resto más tarde mediante un pago restante.",
            },
            {
              type: "steps",
              items: [
                "Abra en el alojamiento la sección «Reglas de pago».",
                "Cree una nueva regla de tipo «Depósito».",
                "Determine el importe del depósito como porcentaje o cantidad fija del total.",
                "Establezca cuándo vence el depósito, normalmente de inmediato al reservar.",
                "Guarde la regla y compruébela con una reserva de prueba.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "El depósito se gestiona a través del proveedor de pago registrado en el alojamiento. El importe correspondiente al saldo restante se configura en [Automatizar el pago restante](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Automatizar el pago restante",
          excerpt: "Así se cobra automáticamente el saldo pendiente antes de la llegada.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida",
            },
            {
              type: "p",
              text: "Tras un depósito queda pendiente un saldo restante. En lugar de hacerle seguimiento manualmente, configure una regla de pago que cobre automáticamente el pago restante en un momento fijo antes de la llegada a través de Stripe o PayPal.",
            },
            {
              type: "steps",
              items: [
                "Abra en el alojamiento la sección «Reglas de pago».",
                "Cree una nueva regla de tipo «Pago restante», siempre que ya exista una regla de depósito.",
                "Determine con cuántos días de antelación a la llegada vence el pago restante.",
                "Active el cobro automático para que el proveedor de pago registrado retire el importe por su cuenta.",
                "Compruebe después el estado del pago restante en la línea de tiempo de la reserva correspondiente.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Si el cobro automático falla, por ejemplo por una tarjeta caducada, la reserva no se cancela automáticamente. Revise sin demora los pagos restantes fallidos y contacte directamente con el huésped.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Realizar un reembolso",
          excerpt: "Así reembolsa a un huésped un importe total o parcial.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida",
            },
            {
              type: "p",
              text: "Ante una cancelación o una reclamación, puede reembolsar a un huésped el importe pagado total o parcialmente. El reembolso se realiza a través del mismo proveedor de pago con el que se pagó originalmente — Stripe o PayPal.",
            },
            {
              type: "steps",
              items: [
                "Abra la reserva afectada en la línea de tiempo de la reserva.",
                "Seleccione en la sección «Pagos» el pago original que debe reembolsarse.",
                "Elija entre reembolso total o parcial.",
                "En caso de reembolso parcial, introduzca el importe deseado.",
                "Confirme el reembolso y compruebe el estado de pago actualizado en la línea de tiempo.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Un reembolso no cambia automáticamente el estado de la reserva ni las noches ocupadas en el calendario. Ante una cancelación, compruebe además si las noches afectadas deben volver a liberarse en el plan de ocupación.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Gestionar una fianza",
          excerpt: "Así configura una fianza y la libera de nuevo tras la estancia.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida",
            },
            {
              type: "p",
              text: "Una fianza le protege frente a daños durante la estancia. Se configura como una regla de pago propia y se autoriza previamente o se cobra a través de Stripe o PayPal, según la configuración del alojamiento.",
            },
            {
              type: "steps",
              items: [
                "Abra en el alojamiento la sección «Reglas de pago» y cree una regla de tipo «Fianza».",
                "Determine el importe de la fianza y el momento de la autorización, normalmente poco antes de la llegada.",
                "Compruebe el estado del alojamiento después del check-out.",
                "Libere la fianza por completo a través de la reserva si el estado es correcto.",
                "En caso de daño, reembolse solo la parte no necesaria y documente el motivo de la retención.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Una fianza autorizada pero no cobrada caduca automáticamente tras un plazo determinado, según el proveedor de pago. Libere la fianza sin demora tras el check-out o cobre a tiempo el importe necesario.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Corregir una factura",
          excerpt: "Así corrige a posteriori una factura ya emitida.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida",
            },
            {
              type: "p",
              text: "Si una factura ya emitida contiene un error, por ejemplo en la dirección de facturación o en una partida, corríjala a través de la reserva en lugar de simplemente eliminar la factura original.",
            },
            {
              type: "steps",
              items: [
                "Abra la reserva afectada en la línea de tiempo de la reserva y vaya a la sección «Facturas».",
                "Seleccione la factura errónea.",
                "Cree una factura rectificativa o de anulación de la factura original.",
                "A continuación, cree una nueva factura corregida con los datos correctos.",
                "Envíe de nuevo la factura corregida al huésped o a la dirección de facturación.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Una factura ya enviada no debería sobrescribirse directamente por motivos de trazabilidad. La corrección mediante una factura de anulación conserva el comprobante original y hace que el cambio sea rastreable.",
            },
          ],
        },
      ],
    },
  ],
};
