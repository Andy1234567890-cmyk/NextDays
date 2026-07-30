import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Precios y tarifas",
  description: "Planes de tarifa, precios de temporada y precios dinámicos.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Fijación de precios",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Precio base y moneda",
          excerpt: "Así fija el precio base y asigna la moneda correcta a su alojamiento.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Cada alojamiento en myNextDays es exactamente una unidad reservable — una única habitación o un alojamiento vacacional. Para esta unidad registra un precio base y una moneda central, que se aplica a todo el alojamiento.",
            },
            { type: "h2", text: "Fijar la moneda de forma centralizada" },
            {
              type: "p",
              text: "La moneda del alojamiento se establece una vez por alojamiento y se aplica automáticamente a todos los planes de tarifa que cree para ese alojamiento. No existe un valor de moneda predeterminado por separado — si falta la moneda, no puede guardar precios.",
            },
            {
              type: "steps",
              items: [
                "Abra su alojamiento en «Alojamientos».",
                "Vaya a la pestaña «Precios».",
                "Elija en «Moneda del alojamiento» la moneda correspondiente.",
                "Introduzca el precio base para la ocupación estándar.",
                "Guarde los cambios.",
              ],
            },
            { type: "h2", text: "Qué ocurre al cambiar la moneda" },
            {
              type: "p",
              text: "Si cambia la moneda del alojamiento posteriormente, esto afecta a todos los planes de tarifa existentes de ese alojamiento, ya que siempre se gestionan en la moneda del alojamiento. Revise después sus precios antes de volver a transmitirlos a los portales.",
            },
            {
              type: "ul",
              items: [
                "Un alojamiento tiene exactamente una moneda — no varias por plan de tarifa.",
                "El precio base es el valor de partida para las tarifas derivadas.",
                "Los importes siempre se muestran con la moneda del alojamiento registrada.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Sin una moneda registrada no se puede guardar ningún precio ni transmitir ninguna tarifa a los portales. Compruebe esto primero si falla un cambio de precio.",
            },
            {
              type: "note",
              variant: "info",
              text: "Más información sobre precios derivados en [Tarifas derivadas](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Crear planes de tarifa",
          excerpt: "Los planes de tarifa agrupan precio, condiciones de cancelación y régimen de alojamiento para un alojamiento.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Un plan de tarifa define en qué condiciones puede reservarse un alojamiento: precio, reglas de cancelación, régimen y estancia mínima. Un alojamiento puede ofrecer varios planes de tarifa a la vez, por ejemplo uno flexible y uno no reembolsable.",
            },
            { type: "h2", text: "Crear un nuevo plan de tarifa" },
            {
              type: "steps",
              items: [
                "Abra el alojamiento y vaya a la pestaña «Precios».",
                "Haga clic en «Crear nuevo plan de tarifa».",
                "Asigne un nombre descriptivo, p. ej. «Flexible» o «No reembolsable».",
                "Determine si el plan es una tarifa base o una tarifa derivada.",
                "Registre las condiciones de cancelación y el régimen.",
                "Guarde y active el plan de tarifa.",
              ],
            },
            { type: "h2", text: "Tarifa base frente a otros planes de tarifa" },
            {
              type: "p",
              text: "Cree primero su tarifa base (a menudo denominada «BAR», Best Available Rate). Todos los demás planes de tarifa pueden gestionarse de forma independiente o derivarse de esta tarifa base.",
            },
            {
              type: "ul",
              items: [
                "Tarifa base: precio base por noche gestionado manualmente.",
                "Otros planes de tarifa: independientes o como recargo/descuento sobre la tarifa base.",
                "Cada plan de tarifa puede transmitirse individualmente a los portales.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Mantenga el número de planes de tarifa por alojamiento manejable — demasiadas variantes dificultan la comparación para los huéspedes y aumentan el esfuerzo de mantenimiento.",
            },
            {
              type: "note",
              variant: "info",
              text: "Encontrará detalles sobre recargos y descuentos en [Tarifas derivadas](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Tarifas derivadas",
          excerpt: "Los planes de tarifa derivados se calculan automáticamente a partir de una tarifa base.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Una tarifa derivada es un plan de tarifa cuyo precio no se gestiona manualmente, sino que se calcula automáticamente a partir de una tarifa base — como un recargo fijo, un descuento fijo o un porcentaje. Esto ahorra esfuerzo de mantenimiento, ya que un cambio de precio en la tarifa base actualiza automáticamente todos los planes derivados.",
            },
            { type: "h2", text: "Ejemplo típico" },
            {
              type: "p",
              text: "Un patrón habitual es un plan con desayuno derivado de la tarifa base sin régimen: el precio del desayuno se define como un recargo por noche y persona sobre la tarifa base. Si cambia la tarifa base, el precio del desayuno se ajusta automáticamente.",
            },
            { type: "h2", text: "Configurar una tarifa derivada" },
            {
              type: "steps",
              items: [
                "Abra el plan de tarifa deseado en la pestaña «Precios».",
                "Elija como fuente de precio «Derivado de…» y la tarifa base correspondiente.",
                "Determine si la diferencia se aplica como importe fijo o como porcentaje.",
                "Establezca si se trata de un recargo o de un descuento.",
                "Guarde la asignación.",
              ],
            },
            {
              type: "ul",
              items: [
                "Recargo: p. ej. régimen de alimentación, cancelación posterior.",
                "Descuento: p. ej. plan no reembolsable con ventaja de precio.",
                "La tarifa base sigue siendo la única fuente gestionada manualmente.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Una tarifa derivada no puede sobrescribirse manualmente al mismo tiempo. Elimine primero la derivación si desea fijar un precio individual distinto.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Precios de temporada y fin de semana",
          excerpt: "Ajuste de forma específica los precios para periodos de temporada y fines de semana.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "La demanda fluctúa a lo largo del año y dentro de la semana. Con los precios de temporada y de fin de semana ajusta el precio base para periodos concretos o días de la semana, sin tener que entrar en el calendario día por día.",
            },
            { type: "h2", text: "Crear un periodo de temporada" },
            {
              type: "steps",
              items: [
                "Abra en el alojamiento la pestaña «Precios» y la sección «Precios de temporada».",
                "Cree un nuevo periodo con fecha de inicio y fin.",
                "Registre el precio o la variación porcentual sobre el precio base para ese periodo.",
                "Guarde el periodo de temporada.",
              ],
            },
            { type: "h2", text: "Precios de fin de semana" },
            {
              type: "p",
              text: "Además, puede aplicar un recargo propio a días concretos de la semana, por ejemplo viernes y sábado. Este recargo se aplica adicionalmente al precio de temporada o base vigente en cada caso.",
            },
            {
              type: "ul",
              items: [
                "Los precios de temporada se aplican a periodos continuos.",
                "Los precios de fin de semana se aplican por día de la semana, independientemente de la temporada.",
                "Ambas reglas pueden combinarse.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Si varios periodos de temporada se solapan, se aplica la regla creada en último lugar o la más específica. Revise el calendario después de guardar.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Para ajustes automáticos basados en la demanda, es adecuado además [Precios dinámicos](/hilfe/preise-raten/dynamische-preise).",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Precios dinámicos",
          excerpt: "Ajuste automáticamente los precios según la demanda, la antelación y la ocupación.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Los precios dinámicos ajustan automáticamente el precio base según factores como la antelación de la reserva, la ocupación actual y la demanda — de forma similar a como lo hacen los grandes portales con sus propias recomendaciones de precio. Así reacciona a los cambios del mercado sin tener que ajustar manualmente cada día.",
            },
            { type: "h2", text: "Activar los precios dinámicos" },
            {
              type: "steps",
              items: [
                "Abra en el alojamiento la pestaña «Precios» y la sección «Precios dinámicos».",
                "Active la función para la tarifa base del alojamiento.",
                "Establezca un límite mínimo y un límite máximo de precio.",
                "Determine con qué intensidad puede influir la ocupación en el precio.",
                "Guarde la configuración.",
              ],
            },
            { type: "h2", text: "Límites y seguridad" },
            {
              type: "p",
              text: "El límite mínimo y el límite máximo de precio evitan que el algoritmo automático fije precios que no sean sostenibles para su negocio. Los planes de tarifa derivados siguen automáticamente la tarifa base calculada de forma dinámica.",
            },
            {
              type: "ul",
              items: [
                "El límite mínimo protege frente a precios demasiado bajos en épocas de baja demanda.",
                "El límite máximo protege frente a precios excesivos en épocas de alta demanda.",
                "Las tarifas derivadas adoptan automáticamente la nueva tarifa base.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Los precios dinámicos solo actúan sobre la tarifa base. Los planes de tarifa fijados manualmente sin derivación no cambian automáticamente con ella.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Descuentos por estancia",
          excerpt: "Configure descuentos por estancias más largas y reservas anticipadas.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Los descuentos por estancia recompensan a los huéspedes por reservas más largas o por reservar con antelación. Se aplican como porcentaje sobre el precio total de la estancia y pueden configurarse de forma independiente por alojamiento.",
            },
            { type: "h2", text: "Tipos de descuento" },
            {
              type: "ul",
              items: [
                "Descuento por larga estancia: a partir de un número determinado de noches, p. ej. desde 7 o 28 noches.",
                "Descuento por reserva anticipada: al reservar con suficiente antelación.",
                "Descuento de última hora: al reservar a corto plazo, cerca de la fecha de llegada.",
              ],
            },
            { type: "h2", text: "Configurar un descuento" },
            {
              type: "steps",
              items: [
                "Abra en el alojamiento la pestaña «Precios» y la sección «Descuentos».",
                "Elija el tipo de descuento deseado.",
                "Establezca el umbral, p. ej. noches mínimas o antelación.",
                "Introduzca el descuento en porcentaje.",
                "Guarde la regla.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Los descuentos actúan sobre el precio total del plan de tarifa correspondiente y se muestran al huésped ya en el resumen de precios.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Combine descuentos por larga estancia con [Estancia mínima y máxima](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt) para fomentar de forma específica las reservas más largas.",
            },
          ],
        },
      ],
    },
  ],
};
