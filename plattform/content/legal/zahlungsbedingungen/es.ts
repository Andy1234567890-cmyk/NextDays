import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Condiciones de pago",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "Estas condiciones de pago regulan cómo se tramitan los pagos relacionados con una reserva a través de myBestDays. Complementan las [Condiciones de uso para huéspedes](https://mybestdays.dk/rechtliches/nutzungsbedingungen); en caso de contradicción en materia de pagos prevalecen estas condiciones de pago.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Nuestro papel en el pago",
      paragraphs: [
        "myBestDays tramita los pagos por cuenta del proveedor. No somos entidad de pago ni entidad de dinero electrónico; el servicio de pago en sí lo presta nuestro proveedor de servicios de pago.",
        "Los pagos a través de la plataforma se tramitan mediante Stripe (Stripe Payments Europe, Limited). Los datos de tarjeta y demás datos de pago son recogidos y tratados directamente por Stripe. myBestDays no almacena datos completos de tarjeta.",
        "Si paga a través de la plataforma, su obligación de pago frente al proveedor se entiende cumplida por el importe abonado tan pronto como el pago haya sido autorizado y cobrado con éxito por nuestro proveedor de servicios de pago.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Formas de pago",
      paragraphs: [
        "Las formas de pago disponibles dependen del anuncio, del país del proveedor y de su país. Las formas disponibles se muestran antes de finalizar la reserva.",
        "Determinadas formas de pago requieren autenticación reforzada del cliente conforme a la Directiva (UE) 2015/2366. Sin una autenticación satisfactoria el pago no puede ejecutarse.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Vencimiento, anticipo e importe restante",
      paragraphs: [
        "Cuándo vence cada importe lo determina el proveedor en el anuncio. Son habituales tres modelos: pago íntegro al reservar, anticipo al reservar con pago del resto antes de la llegada, o pago en destino al proveedor.",
        "El modelo aplicable a su reserva y las fechas de vencimiento se muestran antes de finalizar la reserva y se reiteran en la confirmación de reserva.",
        "Antes del vencimiento del importe restante le enviamos un recordatorio a la dirección de correo electrónico indicada. Si no se abona, el proveedor podrá desistir del contrato conforme a sus condiciones de cancelación.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Moneda",
      paragraphs: [
        "La liquidación se efectúa en la moneda del anuncio. Dicha moneda se indica en cada precio y en el proceso de pago.",
        "Si además se muestra un importe en otra moneda, se trata de una conversión orientativa sin carácter vinculante.",
        "Si su proveedor de servicios de pago convierte a otra moneda o cobra una comisión por operación en el extranjero, dichos costes corren a su cargo. No forman parte del precio total y no los fijamos ni percibimos nosotros.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Fianza",
      paragraphs: [
        "Si el anuncio prevé una fianza, su importe se indica antes de finalizar la reserva.",
        "Según el anuncio, la fianza se preautoriza en su medio de pago (el importe se reserva pero no se carga) o se cobra. Una preautorización puede reducir temporalmente el límite disponible de su tarjeta.",
        "Tras la estancia se libera la preautorización o se reembolsa la fianza cobrada, salvo que el proveedor invoque un daño. Si lo hace, deberá acreditarlo; la procedencia de la reclamación se dirime en la relación entre usted y el proveedor.",
        "Si el proveedor exige la fianza en destino, se trata de una partida de costes en destino y no se tramita a través de la plataforma.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Reembolsos",
      paragraphs: [
        "Los reembolsos se efectúan al medio de pago utilizado, salvo pacto en contrario o imposibilidad técnica.",
        "Iniciamos el reembolso sin demora en cuanto queda determinado su motivo. El tiempo que tarda el abono en aparecer en su cuenta o tarjeta lo determina su proveedor de servicios de pago; lo habitual son entre cinco y diez días hábiles bancarios.",
        "Si existe derecho a reembolso y en qué medida resulta de las [Condiciones de cancelación](https://mybestdays.dk/rechtliches/stornierungsbedingungen) y de la [Política de recolocación y reembolso](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Pagos fallidos y retrocesiones",
      paragraphs: [
        "Si un pago falla, se lo comunicamos y le damos la oportunidad de registrar otro medio de pago. Si el pago no se efectúa, la reserva puede cancelarse.",
        "Si retrocede un pago ya ejecutado sin que exista derecho a reembolso, el proveedor podrá seguir reclamando el importe. Los costes que nos ocasione una retrocesión injustificada podremos facturárselos.",
        "Si consideramos que un pago es fraudulento, podemos retenerlo o cancelar la reserva. Se lo comunicaremos y motivaremos la decisión.",
      ],
    },
    {
      id: "belege",
      heading: "8. Justificantes y liquidaciones",
      paragraphs: [
        "Para los importes abonados a través de la plataforma ponemos a disposición un justificante que puede consultar en su cuenta, apartado «Reservas».",
        "La factura del servicio de alojamiento la emite el proveedor; él es el empresario prestador. Sobre impuestos, véase la [Política fiscal](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Modificación de estas condiciones de pago",
      paragraphs: [
        "A las modificaciones de estas condiciones de pago se aplica la sección A22 de las [Condiciones de uso](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen).",
      ],
    },
  ],
};
