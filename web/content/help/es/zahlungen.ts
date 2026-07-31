import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Pagos y facturas",
  description: "Proveedores de pago, reglas de pago y facturas.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Pagos",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Conectar un proveedor de pago",
          excerpt:
            "Así conecta Stripe o PayPal con myNextDays para gestionar los pagos automáticamente.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Proveedores disponibles" },
            {
              type: "p",
              text: "myNextDays gestiona los pagos a través de proveedores de pago conectados. Actualmente se admiten Stripe y PayPal — puede conectar uno o ambos proveedores a la vez y usarlos según el alojamiento o la preferencia del huésped.",
            },
            {
              type: "steps",
              items: [
                "Abra Cuenta y vaya a la sección «Pagos».",
                "Elija el proveedor deseado — Stripe o PayPal.",
                "Siga el diálogo de conexión e inicie sesión con el proveedor o cree una cuenta nueva.",
                "Confirme la conexión — el estado pasa a «conectado».",
              ],
            },
            { type: "h2", text: "Qué ocurre después" },
            {
              type: "p",
              text: "En cuanto un proveedor está conectado, puede enviar enlaces de pago, cobrar depósitos y activar reembolsos directamente desde la reserva. Todos los importes se procesan en la moneda registrada para el alojamiento correspondiente.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Sin un proveedor conectado, solo puede marcar los pagos manualmente como recibidos — un cobro automático no es posible entonces.",
            },
            { type: "h2", text: "Varios alojamientos, un proveedor" },
            {
              type: "p",
              text: "Una conexión establecida una vez es válida para toda la cuenta y para todos sus alojamientos. Cómo se desarrolla el cobro en detalle lo determina en [Reglas de pago](/hilfe/zahlungen/zahlungsregeln). Los pagos a usted se realizan después a través del proveedor correspondiente, vea [Pagos a usted](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe es adecuado para pagos con tarjeta y muchos métodos de pago locales",
                "PayPal ofrece a los huéspedes una alternativa conocida",
                "Ambos proveedores pueden desconectarse y volver a conectarse de forma independiente",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Reglas de pago",
          excerpt: "Determine cuándo vencen el depósito y el pago restante de una reserva.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Depósito y pago restante" },
            {
              type: "p",
              text: "Las reglas de pago determinan cómo se gestiona financieramente una reserva — por ejemplo, un depósito al reservar y un pago restante antes de la llegada, o el pago completo de inmediato. Las reglas se aplican por alojamiento y pueden ajustarse en cualquier momento.",
            },
            {
              type: "steps",
              items: [
                "Abra el alojamiento y vaya a la sección «Reglas de pago».",
                "Elija si se cobra un depósito y determine el porcentaje.",
                "Establezca cuándo vence el pago restante, por ejemplo un número determinado de días antes de la llegada.",
                "Guarde la configuración.",
              ],
            },
            { type: "h2", text: "Cobro automático" },
            {
              type: "p",
              text: "Si hay un proveedor de pago conectado, myNextDays cobra automáticamente el depósito y el pago restante en el momento establecido e informa previamente al huésped mediante un mensaje.",
            },
            {
              type: "note",
              variant: "info",
              text: "Las reglas de pago solo se aplican a reservas con un proveedor de pago conectado. Sin proveedor, marca los pagos manualmente en la reserva.",
            },
            { type: "h2", text: "Diferencias por canal" },
            {
              type: "p",
              text: "En los portales puede aplicarse su propia gestión de pagos, de forma diferente — en ese caso, revise las condiciones del portal correspondiente. Para reservas a través de su propia plataforma o web siempre se aplican las reglas que ha registrado aquí. Detalles sobre la conexión de proveedores en [Conectar un proveedor de pago](/hilfe/zahlungen/zahlungsanbieter-verbinden), sobre la facturación en [Crear facturas](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Depósito posible como importe fijo o porcentaje",
                "Plazo del pago restante configurable libremente",
                "Los cambios solo afectan a las nuevas reservas, no con carácter retroactivo",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Crear facturas",
          excerpt: "Así crea una factura para una reserva con la dirección de facturación correcta.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Crear una factura" },
            {
              type: "p",
              text: "Para cada reserva puede crear una factura — para el propio huésped o para una empresa diferente, si la reserva se realiza con fines comerciales.",
            },
            {
              type: "steps",
              items: [
                "Abra la reserva en Reservas.",
                "Elija «Crear factura».",
                "Compruebe o complete la dirección de facturación.",
                "Revise las partidas indicadas — alojamiento, add-ons, tasas.",
                "Cree la factura y envíela al huésped.",
              ],
            },
            { type: "h2", text: "Mantener la dirección de facturación" },
            {
              type: "p",
              text: "Puede registrar la dirección de facturación directamente en la reserva o dejar que el huésped la complete después a través de la confirmación de la reserva. Sin una dirección completa, en determinados países no se puede emitir una factura legalmente válida.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Compruebe especialmente el nombre de la empresa y la dirección en el caso de clientes comerciales — las correcciones posteriores requieren una factura rectificativa.",
            },
            { type: "h2", text: "Importes y moneda" },
            {
              type: "p",
              text: "Todas las partidas se muestran en la moneda registrada para el alojamiento. Los pagos ya realizados se anotan en la factura como pago recibido. Cómo se generan el depósito y el pago restante se explica en [Reglas de pago](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Las facturas pueden descargarse como PDF",
                "Las facturas rectificativas son posibles en cualquier momento ante cambios",
                "Los add-ons aparecen como una partida propia",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Reembolsos",
          excerpt:
            "Así reembolsa un pago total o parcialmente cuando una reserva se cancela o se modifica.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Cuándo es necesario un reembolso" },
            {
              type: "p",
              text: "Un reembolso suele producirse ante una cancelación, pero también puede ser necesario ante un ajuste de precio posterior o un add-on cancelado.",
            },
            {
              type: "steps",
              items: [
                "Abra la reserva afectada en Reservas.",
                "Elija «Reembolso» en la sección de pagos de la reserva.",
                "Introduzca el importe a reembolsar — total o parcial.",
                "Confirme el reembolso.",
              ],
            },
            { type: "h2", text: "Proceso a través del proveedor de pago" },
            {
              type: "p",
              text: "El reembolso se ejecuta a través del proveedor utilizado en el pago —Stripe o PayPal— y se devuelve directamente al medio de pago original del huésped. El proceso se anota automáticamente en la línea de tiempo de la reserva.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Sin un proveedor de pago conectado, un reembolso no puede activarse automáticamente — en ese caso, resuelva la devolución directamente con el huésped.",
            },
            { type: "h2", text: "Efecto sobre las comisiones" },
            {
              type: "p",
              text: "Las comisiones de marketplace o de portal ya liquidadas se ajustan proporcionalmente ante un reembolso. Más información en [Entender las comisiones](/hilfe/zahlungen/provisionen-verstehen). Detalles sobre la propia cancelación en [Cancelación y reembolso](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Los reembolsos parciales son posibles para partidas individuales",
                "El estado de tramitación es visible en todo momento en la reserva",
                "Los reembolsos se realizan exclusivamente a través del proveedor originalmente utilizado",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Pagos a usted",
          excerpt:
            "Así recibe los ingresos de sus reservas de los proveedores de pago conectados.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Cómo funcionan los pagos" },
            {
              type: "p",
              text: "Los pagos entrantes se acumulan primero en el proveedor de pago conectado. Desde ahí se realiza el pago a su cuenta bancaria registrada según el ritmo habitual de cada proveedor.",
            },
            {
              type: "steps",
              items: [
                "Abra Cuenta y vaya a la sección «Pagos».",
                "Compruebe en «Pagos a usted» el estado del proveedor correspondiente.",
                "Abra si es necesario la vista detallada del proveedor para el historial completo de pagos.",
              ],
            },
            { type: "h2", text: "Qué se descuenta antes del pago" },
            {
              type: "p",
              text: "Antes del pago se tienen en cuenta las comisiones de marketplace y de portal aplicables, así como las tasas del proveedor. El importe pagado no corresponde necesariamente, por tanto, a la suma original de la reserva.",
            },
            {
              type: "note",
              variant: "info",
              text: "La estructura exacta de las deducciones se explica en [Entender las comisiones](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Varios alojamientos y propietarios" },
            {
              type: "p",
              text: "Si gestiona alojamientos para distintos propietarios, los pagos se asignan según las liquidaciones de propietario registradas. Ante discrepancias, revise primero el estado de las reservas subyacentes en Reservas.",
            },
            {
              type: "ul",
              items: [
                "El ritmo y el método de pago los determina el proveedor correspondiente",
                "Los importes retenidos, por ejemplo por reembolsos en curso, están señalados",
                "El historial completo está disponible directamente en el proveedor",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Entender las comisiones",
          excerpt:
            "Un resumen de cómo se componen las comisiones de marketplace y de portal, y dónde se liquidan.",
          updated: "Actualizado: julio de 2026",
          body: [
            { type: "h2", text: "Dos tipos de comisiones" },
            {
              type: "p",
              text: "En las reservas a través de myNextDays pueden aplicarse dos comisiones diferentes: la comisión de marketplace para reservas a través de la propia plataforma, y las comisiones de portal para reservas que llegan a través de portales conectados como Booking o Airbnb. Ambas son independientes entre sí y pueden variar según la vía de venta de una reserva.",
            },
            {
              type: "ul",
              items: [
                "Comisión de marketplace: se aplica en reservas a través de la plataforma de myBestDays",
                "Comisión de portal: la calcula el portal correspondiente según sus propias condiciones",
                "Las reservas directas a través de su propia web deben considerarse independientes de esto",
              ],
            },
            { type: "h2", text: "Dónde son visibles las comisiones" },
            {
              type: "steps",
              items: [
                "Abra Cuenta y vaya a la sección «Facturación».",
                "Elija el mes deseado.",
                "Revise el desglose por reserva con la comisión correspondiente.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Por qué canal entró una reserva se ve directamente en la propia reserva — eso explica qué comisión se aplicó en cada caso.",
            },
            { type: "h2", text: "Relación con los pagos" },
            {
              type: "p",
              text: "Las comisiones se descuentan de la suma de la reserva antes del pago. Encontrará detalles sobre el proceso de pago en [Pagos a usted](/hilfe/zahlungen/auszahlungen). Ante un reembolso, la comisión correspondiente se corrige proporcionalmente — el proceso completo de una reserva se muestra en la [línea de tiempo de la reserva](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
