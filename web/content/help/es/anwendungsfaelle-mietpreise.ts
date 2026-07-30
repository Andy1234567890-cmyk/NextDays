import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Precios de alquiler",
  description: "Establecer los precios de alquiler de forma óptima.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Precios de alquiler",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Optimizar los precios para la temporada alta",
          excerpt: "Así aumenta de forma específica sus precios en los periodos de mayor demanda.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida",
            },
            {
              type: "p",
              text: "En temporada alta la demanda aumenta considerablemente, mientras que su precio base mantiene los mismos valores que el resto del año. Sin un ajuste estacional, está dejando de generar ingresos precisamente en la época más fuerte del año; el ajuste se realiza a través del plan de tarifas de su alojamiento, no sobrescribiendo manualmente días concretos.",
            },
            {
              type: "steps",
              items: [
                "Abra el plan de tarifas del alojamiento correspondiente y cree una regla de temporada para el periodo deseado.",
                "Establezca el incremento como porcentaje o como importe fijo sobre el precio base; el plan de tarifas toma automáticamente la moneda del alojamiento.",
                "Compruebe en el calendario que el nuevo precio se muestra correctamente para el periodo de temporada alta antes de activarlo.",
                "Revise la estancia mínima para la temporada alta; a menudo conviene una duración mínima de reserva más alta para mantener la ocupación planificable.",
                "Tras la activación, observe la situación de reservas durante los primeros días y ajuste el incremento si es necesario.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Una regla de temporada se aplica de forma transversal a todos los canales: portales, plataforma y sitio web por igual. Encontrará más detalles sobre cómo configurar las reglas en [Planes de tarifas](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Fomentar estancias más largas con descuentos",
          excerpt: "Así recompensa a los huéspedes con estancias más largas y reduce el trabajo de rotación.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida",
            },
            {
              type: "p",
              text: "Las estancias cortas implican más entradas y salidas, más limpiezas y un mayor riesgo de vacíos entre reservas. Un descuento escalonado por duración de estancia hace que las reservas más largas resulten más atractivas para los huéspedes y reduce notablemente este trabajo.",
            },
            {
              type: "steps",
              items: [
                "Abra el plan de tarifas del alojamiento y cree un descuento por duración de estancia.",
                "Defina al menos un tramo, por ejemplo a partir de 7 noches o a partir de 28 noches, con el porcentaje de descuento correspondiente.",
                "Compruebe que los tramos no se solapan y que el descuento solo se aplica a partir de la duración mínima correspondiente.",
                "Pruebe en el calendario una reserva de ejemplo que supere el límite del descuento para confirmar que se aplica correctamente.",
                "Active el descuento y observe su efecto en la duración media de estancia y en la ocupación.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Los descuentos por duración de estancia se pueden combinar con reglas de temporada; el plan de tarifas calcula ambos ajustes conjuntamente. Más información en [Planes de tarifas](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
