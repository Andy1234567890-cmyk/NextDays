import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Alojamientos y equipamiento",
  description: "Crear y mantener habitaciones y alojamientos vacacionales.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Gestionar alojamientos",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Alojamiento = una unidad reservable",
          excerpt: "Por qué cada alojamiento en myNextDays es exactamente una unidad reservable.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "En myNextDays, un alojamiento es siempre exactamente una unidad reservable — una única habitación en un hotel o un alojamiento vacacional completo. Este principio se aplica independientemente de si gestiona una casa de vacaciones, un apartamento vacacional o un hotel, y es la base para la disponibilidad, los precios y las reservas.",
            },
            { type: "h2", text: "Ningún edificio con habitaciones debajo" },
            {
              type: "p",
              text: "Un malentendido frecuente es representar un edificio de hotel como un alojamiento con varias habitaciones debajo. Esto no está previsto en myNextDays. Si, por ejemplo, gestiona un hotel con ocho habitaciones dobles y cuatro individuales, cree doce alojamientos individuales — no un alojamiento con un número de habitaciones.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Un campo como «número de habitaciones» a nivel de alojamiento no existe a propósito. Cada habitación necesita su propio alojamiento con su propio calendario y sus propios precios.",
            },
            { type: "h2", text: "Alojamientos vacacionales" },
            {
              type: "p",
              text: "En una casa de vacaciones o un apartamento vacacional, todo el alojamiento corresponde a la unidad reservable. Aquí no hay más subdivisión — un alojamiento vacacional es siempre un alojamiento independiente con su propio calendario.",
            },
            { type: "h2", text: "Por qué esto es importante" },
            {
              type: "ul",
              items: [
                "Cada alojamiento tiene su propio calendario de disponibilidad — se evitan las reservas duplicadas de forma exacta por alojamiento.",
                "Los precios, el equipamiento y las fotos se aplican por alojamiento, no por edificio.",
                "Un alojamiento pertenece siempre exactamente a un propietario — sin asignación múltiple.",
                "La visibilidad por canal (web, marketplace de la plataforma, portales) se controla por alojamiento.",
              ],
            },
            {
              type: "p",
              text: "Cómo elegir el tipo de alojamiento adecuado para su habitación o alojamiento vacacional se explica en [Definir el tipo de alojamiento](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Definir el tipo de alojamiento",
          excerpt: "Asigne correctamente la categoría, el tipo de inmueble y la modalidad de oferta.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "El tipo de alojamiento determina cómo se clasifica y filtra su alojamiento en los portales y en el marketplace de la plataforma. Consta de tres campos de selección dependientes entre sí, que recorre al crear o editar un alojamiento.",
            },
            { type: "h2", text: "Los tres niveles de selección" },
            {
              type: "steps",
              items: [
                "Elija primero la categoría — por ejemplo, alojamiento vacacional u hotel.",
                "Elija a continuación el tipo de inmueble — por ejemplo, apartamento vacacional, casa de vacaciones, habitación doble o habitación individual.",
                "Elija la modalidad de oferta — por ejemplo, todo el alojamiento o una habitación privada.",
                "Complete los campos adicionales que se muestren según la selección, por ejemplo el tipo de cama o la planta.",
              ],
            },
            { type: "h2", text: "Por qué el orden es importante" },
            {
              type: "p",
              text: "Los tres desplegables dependen entre sí: la selección de la categoría limita los tipos de inmueble disponibles, y la selección del tipo de inmueble limita a su vez las modalidades de oferta. Así solo surgen combinaciones con sentido, como también se usan en los grandes portales.",
            },
            {
              type: "note",
              variant: "info",
              text: "Si cambia la categoría a posteriori, myNextDays comprueba si el tipo de inmueble y la modalidad de oferta siguen encajando, y le pide que vuelva a elegir si es necesario.",
            },
            { type: "h2", text: "Editar el tipo de alojamiento" },
            {
              type: "p",
              text: "Abra el alojamiento deseado en el menú Alojamientos y vaya a la pestaña Datos básicos. Ahí encontrará los tres desplegables bajo Tipo de alojamiento. Al guardar su cambio, la nueva clasificación se transmite a todos los canales activos.",
            },
            {
              type: "ul",
              items: [
                "Categoría: clasificación superior (p. ej. alojamiento vacacional, hotel)",
                "Tipo de inmueble: tipo de alojamiento concreto (p. ej. apartamento vacacional, habitación doble)",
                "Modalidad de oferta: qué se reserva exactamente (p. ej. todo el alojamiento, habitación privada)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Mantener el equipamiento",
          excerpt: "Seleccione las características de equipamiento y manténgalas actualizadas.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "El equipamiento de un alojamiento influye de manera decisiva en lo bien que se encuentra y se filtra en los portales. Los huéspedes filtran de forma específica por características como wifi, cocina o aparcamiento — la falta de datos puede excluir un alojamiento de los resultados de búsqueda.",
            },
            { type: "h2", text: "Seleccionar el equipamiento" },
            {
              type: "steps",
              items: [
                "Abra el alojamiento y vaya a la pestaña Equipamiento.",
                "Seleccione todas las características que correspondan de la lista predefinida.",
                "Añada si es necesario detalles como el número de plazas de aparcamiento o el tipo de cocina.",
                "Guarde los cambios — se transmiten automáticamente a todos los portales activos.",
              ],
            },
            { type: "h2", text: "De dónde proceden las características" },
            {
              type: "p",
              text: "La lista de equipamiento sigue el catálogo de características de los grandes portales, para que sus datos se puedan asignar correctamente allí. No está previsto añadir características propias e inventadas libremente, ya que no podrían transmitirse correctamente a los portales.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Revise el equipamiento tras cada cambio estructural — por ejemplo, un aire acondicionado nuevo o un baño adicional — para que los datos se mantengan actualizados en todos los canales.",
            },
            { type: "h2", text: "Grupos de características habituales" },
            {
              type: "ul",
              items: [
                "Equipamiento básico: wifi, calefacción, aire acondicionado",
                "Cocina y alimentación: cocina totalmente equipada, lavavajillas, cafetera",
                "Baño y ropa de casa: baño propio, lavadora, toallas",
                "Zona exterior: balcón, terraza, jardín, aparcamiento",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Fotos y descripción",
          excerpt: "Imágenes y textos convincentes para más reservas.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Las fotos y la descripción son el criterio de decisión más importante para los huéspedes. Un alojamiento solo puede publicarse cuando se ha registrado al menos una foto de portada y una descripción.",
            },
            { type: "h2", text: "Subir fotos" },
            {
              type: "steps",
              items: [
                "Abra el alojamiento y vaya a la pestaña Fotos.",
                "Arrastre archivos de imagen a la zona de carga o selecciónelos mediante el diálogo de archivos.",
                "Defina una foto de portada — aparecerá en los resultados de búsqueda y en las tarjetas.",
                "Ordene las demás fotos arrastrándolas en una secuencia con sentido.",
              ],
            },
            { type: "h2", text: "Redactar la descripción" },
            {
              type: "p",
              text: "Vaya a la pestaña Descripción y escriba un título y un texto. Describa de forma concreta la ubicación, las particularidades y el público objetivo del alojamiento — las frases genéricas resultan menos convincentes en los portales que los detalles tangibles.",
            },
            {
              type: "note",
              variant: "warn",
              text: "No se pueden usar fotos de otros alojamientos ni de internet — los portales lo comprueban y pueden suspender alojamientos en caso de incumplimiento.",
            },
            { type: "h2", text: "Recomendaciones para buenas fotos" },
            {
              type: "ul",
              items: [
                "Al menos cinco fotos, idealmente una por cada estancia",
                "Formato horizontal, buena iluminación, sin marcas de agua",
                "La foto de portada muestra el alojamiento de forma atractiva y clara",
                "Actualícelas regularmente, especialmente tras reformas",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Ocupación y capacidad",
          excerpt: "Registre correctamente el número máximo de huéspedes y la distribución de camas.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "La ocupación determina cuántos huéspedes puede alojar un alojamiento y se comprueba en cada búsqueda y reserva. Los datos incorrectos provocan solicitudes rechazadas o sobreocupación — ambos casos deben evitarse.",
            },
            { type: "h2", text: "Registrar la ocupación" },
            {
              type: "steps",
              items: [
                "Abra el alojamiento y vaya a la pestaña Ocupación.",
                "Introduzca el número máximo de adultos.",
                "Introduzca el número máximo de niños, si se admiten.",
                "Registre la distribución de camas por estancia, por ejemplo una cama de matrimonio y dos individuales.",
              ],
            },
            { type: "h2", text: "Límites de la ocupación" },
            {
              type: "p",
              text: "Ante una solicitud de reserva, myNextDays comprueba automáticamente si el número de huéspedes solicitado está dentro de la ocupación registrada. Las solicitudes que superen la capacidad máxima se rechazan o directamente no se muestran como reservables.",
            },
            {
              type: "note",
              variant: "info",
              text: "Una cama supletoria o una cuna solo aumentan la capacidad real si las registra explícitamente en la distribución de camas — de lo contrario, el número máximo de huéspedes permanece invariable.",
            },
            { type: "h2", text: "Errores frecuentes" },
            {
              type: "ul",
              items: [
                "Número máximo de huéspedes fijado demasiado alto, aunque solo haya pocas camas",
                "Olvidar el número de niños, aunque el alojamiento se dirija a familias",
                "Distribución de camas no actualizada tras una reforma",
              ],
            },
            {
              type: "p",
              text: "Si la ocupación y el equipamiento no encajan, revise también la pestaña [Equipamiento](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Estado del alojamiento y visibilidad",
          excerpt: "Diferencia entre activo/inactivo y los tres ejes de canal.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "myNextDays distingue dos cosas diferentes que a menudo se confunden: el estado del alojamiento (activo o inactivo) y la visibilidad en canales de venta concretos. Ambos se controlan de forma separada.",
            },
            { type: "h2", text: "Estado del alojamiento" },
            {
              type: "p",
              text: "El estado active significa que un alojamiento es fundamentalmente vendible. El estado inactive pone un alojamiento completamente fuera de servicio — por ejemplo, durante una reforma de larga duración. Un alojamiento inactivo no es reservable en ningún canal, independientemente de los interruptores de canal.",
            },
            { type: "h2", text: "Los tres ejes de canal" },
            {
              type: "p",
              text: "Si un alojamiento está activo, tres interruptores independientes deciden exactamente dónde es visible:",
            },
            {
              type: "ul",
              items: [
                "Web — visibilidad en su propia web de myNextDays",
                "Marketplace de la plataforma — visibilidad en el marketplace global de myNextDays",
                "Portales — visibilidad en Booking, Airbnb y otros",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Estos tres ejes son totalmente independientes del estado del alojamiento y entre sí. Un alojamiento activo puede, por ejemplo, ser visible solo en la web, pero no en los portales.",
            },
            { type: "h2", text: "Cambiar el estado" },
            {
              type: "steps",
              items: [
                "Abra el alojamiento y vaya a la pestaña Resumen.",
                "Ponga el estado en activo o inactivo.",
                "Ajuste si es necesario también los tres interruptores de canal en la pestaña Visibilidad.",
                "Guarde el cambio — surte efecto de inmediato en todos los canales afectados.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Para un bloqueo a corto plazo de días concretos use en su lugar Stop-Sell en el calendario — esto bloquea de forma específica días en todos los canales, sin desactivar todo el alojamiento.",
            },
          ],
        },
      ],
    },
  ],
};
