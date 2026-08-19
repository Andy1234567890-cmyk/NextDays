import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Liquidaciones de propietarios",
  description: "Crear liquidaciones de propietarios.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Liquidaciones de propietarios",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Generar una liquidación para un propietario",
          excerpt: "Así puede crear una liquidación clara del periodo de un propietario.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida",
            },
            {
              type: "p",
              text: "Si gestiona alojamientos para propietarios, estos necesitan periódicamente un resumen claro de los ingresos, la comisión deducida y el pago de sus alojamientos durante un periodo determinado; la liquidación del propietario reúne automáticamente estos datos.",
            },
            {
              type: "steps",
              items: [
                "Abra en la cuenta la sección Propietarios y seleccione al propietario correspondiente.",
                "Seleccione el periodo de facturación para el que se debe crear la liquidación.",
                "Compruebe que todos los alojamientos de este propietario están correctamente asignados, ya que solo los alojamientos asignados se incluyen en la liquidación.",
                "Genere la liquidación y compruebe que las reservas mostradas están completas.",
                "Ponga la liquidación a disposición del propietario a través del acceso de propietario o expórtela como documento.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La liquidación muestra cada reserva con el importe en la moneda correspondiente del alojamiento; no hay ninguna indicación de moneda genérica, ya que varios alojamientos también pueden tener monedas distintas. Más información sobre la asignación en [Asignar un alojamiento a un propietario](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Liquidar la comisión con el propietario",
          excerpt: "Así se asegura de que su comisión se calcule correctamente a partir de los ingresos del propietario.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida",
            },
            {
              type: "p",
              text: "Su comisión por la gestión de un alojamiento está registrada en la tarifa del propietario y se deduce automáticamente de los ingresos brutos en cada liquidación. Para que la facturación sea correcta, el porcentaje de comisión debe estar configurado correctamente antes de la primera reserva del periodo.",
            },
            {
              type: "steps",
              items: [
                "Abra en la cuenta la tarifa del propietario correspondiente y compruebe el porcentaje de comisión registrado.",
                "Ajuste el porcentaje si es necesario antes de que lleguen nuevas reservas en el próximo periodo de facturación.",
                "Genere la liquidación del propietario para el periodo y compruebe que la comisión se muestra correctamente por cada reserva.",
                "Compruebe la coherencia de la suma de ingresos brutos, comisión deducida y pago neto.",
                "Aclare cualquier discrepancia directamente con el propietario antes de aprobar la liquidación, en lugar de modificarla a posteriori.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Un cambio posterior del porcentaje de comisión solo afecta a periodos futuros, no de forma retroactiva a liquidaciones ya generadas. Por ello, compruebe el porcentaje con antelación antes del inicio de un nuevo periodo de facturación; consulte también [Liquidación de propietarios (statement)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
