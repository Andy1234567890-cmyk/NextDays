import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Precios, clasificación y recomendaciones",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "Esta página explica cómo se muestran los precios en myBestDays, qué determina el orden de los resultados de búsqueda y cómo surgen las recomendaciones. Cumple las obligaciones de transparencia derivadas del artículo 6 bis de la Directiva 2005/29/CE, del artículo 5 del Reglamento (UE) 2019/1150 y del artículo 27 del Reglamento (UE) 2022/2065.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Cómo se muestran los precios",
      paragraphs: [
        "En cuanto se conocen el periodo y el número de viajeros, mostramos el precio total de toda la estancia, incluidos impuestos y todas las tasas liquidadas a través de la plataforma.",
        "Mientras no se haya elegido un periodo, mostramos un precio por noche a título orientativo y lo señalamos como tal.",
        "Los costes que solo se devengan en destino los indicamos por separado antes de finalizar la reserva. No forman parte del precio total, pero son visibles antes de la reserva.",
        "Cuando mostramos un precio de comparación tachado, se trata del precio más bajo aplicado por el proveedor por el mismo servicio en los 30 días anteriores a la reducción (artículo 6 bis de la Directiva 98/6/CE).",
        "Los precios son iguales para todos los huéspedes. No adaptamos el precio a su persona, a su dispositivo ni a su historial de búsqueda.",
      ],
    },
    {
      id: "ranking",
      heading: "2. Qué determina el orden de los resultados de búsqueda",
      paragraphs: [
        "En la ordenación por defecto, los siguientes factores determinan el orden, en importancia decreciente:",
      ],
      list: [
        "la coincidencia con su búsqueda — disponibilidad en el periodo buscado, capacidad para el número de viajeros, ubicación en la zona buscada y filtros aplicados;",
        "la integridad y calidad del anuncio — descripción, fotos, datos de equipamiento mantenidos;",
        "las valoraciones — nota global y número de valoraciones;",
        "la fiabilidad del proveedor — capacidad de respuesta, tasa de aceptación y cancelaciones por su parte;",
        "la actualidad de precios y disponibilidad;",
        "la relación calidad-precio en comparación con anuncios similares de la misma zona.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Posicionamiento de pago",
      paragraphs: [
        "Un proveedor no puede comprar una mejor posición en la ordenación por defecto. La cuantía de la comisión de servicio no influye en el orden.",
        "Si en el futuro ofreciéramos posicionamientos de pago, los identificaríamos inequívocamente como publicidad y los separaríamos visiblemente del resto de resultados.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Cambiar la ordenación",
      paragraphs: [
        "Puede cambiar la ordenación en cualquier momento, por ejemplo por precio o por valoración. La ordenación activa se muestra encima de la lista de resultados.",
        "Dispone al menos de una ordenación que no se basa en la elaboración de perfiles en el sentido del artículo 4, punto 4, del Reglamento (UE) 2016/679.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Recomendaciones",
      paragraphs: [
        "Cuando le mostramos sugerencias («podría gustarle», «alojamientos similares»), estas se basan en la búsqueda actual, en anuncios consultados previamente y en características de alojamientos similares.",
        "Puede desactivar las recomendaciones personalizadas en su cuenta. Después verá sugerencias basadas únicamente en la búsqueda actual.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Las valoraciones en la clasificación",
      paragraphs: [
        "Cómo se obtienen y verifican las valoraciones figura en la [Política de valoraciones](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). Las valoraciones influyen en el orden, pero ni ponderamos más determinadas valoraciones ni suprimimos las negativas.",
      ],
    },
  ],
};
