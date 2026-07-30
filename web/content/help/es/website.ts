import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Constructor de sitios web",
  description: "Cree su propio sitio web de reservas con el constructor.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Constructor de sitios web",
      articles: [
        {
          slug: "website-erstellen",
          title: "Crear un sitio web",
          excerpt: "Con el constructor crea en pocos minutos su propio sitio web de reservas.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "El constructor de sitios web le crea su propio sitio web de reservas — un canal de venta adicional junto a los portales y el marketplace de myNextDays. Usted mantiene el control total sobre la estructura, los contenidos y la marca.",
            },
            { type: "h2", text: "Así crea un sitio web" },
            {
              type: "steps",
              items: [
                "Abra Web en el menú.",
                "Haga clic en Crear sitio web.",
                "Elija una plantilla como punto de partida para su diseño.",
                "Confirme con Crear sitio web — accederá directamente al editor.",
              ],
            },
            { type: "h2", text: "Qué incluye el constructor" },
            {
              type: "ul",
              items: [
                "Un editor visual con páginas, capas y vista previa",
                "Bloques predefinidos para listas de alojamientos, galerías y formularios de contacto",
                "Un proceso de reserva directo basado en la disponibilidad de su calendario",
                "Colores, fuentes y logotipo personalizables acordes a su marca",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Empiece con una plantilla cercana a su tipo de alojamiento — vacacional u hotel — esto le ahorrará tiempo más adelante al ajustar los bloques.",
            },
            { type: "h2", text: "Próximos pasos" },
            {
              type: "p",
              text: "Tras la creación, ajuste páginas y diseño, vea [Editar páginas y diseño](/hilfe/website/seiten-layout), y muestre sus alojamientos en el sitio web, vea [Mostrar alojamientos en el sitio web](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Editar páginas y diseño",
          excerpt: "Ajuste páginas, capas y bloques en el editor visual.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "El editor se organiza en tres áreas: a la izquierda, el resumen de páginas y capas; en el centro, la vista previa de su sitio web; a la derecha, la configuración del bloque seleccionado en cada momento.",
            },
            { type: "h2", text: "Editar una página" },
            {
              type: "steps",
              items: [
                "Elija a la izquierda, en Páginas, la página deseada.",
                "Haga clic en la vista previa sobre un bloque para seleccionarlo.",
                "Ajuste a la derecha el texto, la imagen o el espaciado del bloque.",
                "Arrastre los bloques para cambiar su orden.",
              ],
            },
            { type: "h2", text: "Añadir nuevas páginas y bloques" },
            {
              type: "p",
              text: "Mediante el botón Añadir página crea subpáginas adicionales, por ejemplo Sobre nosotros o Contacto. Dentro de una página, mediante Añadir bloque inserta nuevas secciones como galería, reseñas o formulario de contacto.",
            },
            {
              type: "ul",
              items: [
                "Página de inicio, resumen de alojamientos y contacto vienen predefinidos en cada plantilla",
                "Otras páginas pueden nombrarse libremente e incluirse en la navegación",
                "Los bloques son responsivos y se adaptan a escritorio, tablet y smartphone",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Los cambios en el editor son al principio solo un borrador. Solo un clic en Publicar los aplica a su sitio web público.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Conectar un dominio",
          excerpt: "Vincule un dominio propio con su sitio web de myNextDays.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Por defecto, su sitio web es accesible a través de un subdominio de myNextDays. Si en su lugar desea usar un dominio propio, como su-negocio.es, conéctelo en la sección Dominio.",
            },
            { type: "h2", text: "Registrar el dominio" },
            {
              type: "steps",
              items: [
                "Abra en el sitio web la configuración y ahí Dominio.",
                "Introduzca su dominio propio y haga clic en Conectar.",
                "Configure en su proveedor de dominio los registros DNS mostrados.",
                "Espere la confirmación — la comprobación se realiza automáticamente en segundo plano.",
              ],
            },
            { type: "h2", text: "Configurar correctamente los registros DNS" },
            {
              type: "p",
              text: "myNextDays le muestra exactamente los registros necesarios para su proveedor de dominio. La conexión se activa solo cuando estos registros están correctamente configurados y se han propagado globalmente — esto puede tardar varias horas según el proveedor.",
            },
            {
              type: "ul",
              items: [
                "Configurar el registro CNAME o A según las instrucciones mostradas",
                "Eliminar previamente registros existentes y contradictorios para el mismo dominio",
                "El certificado para https se emite automáticamente tras una conexión exitosa",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Sin los registros DNS correctamente configurados, su sitio web no será accesible bajo el dominio propio — compruebe cuidadosamente la ortografía frente a los datos de su proveedor.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Mostrar alojamientos en el sitio web",
          excerpt: "Qué alojamientos son visibles y reservables a través del sitio web se controla por separado por alojamiento.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Para que un alojamiento aparezca en su sitio web, la visibilidad web debe estar activada para ese alojamiento. Este interruptor es independiente de la visibilidad en el marketplace de myNextDays o en los portales.",
            },
            { type: "h2", text: "Habilitar un alojamiento para el sitio web" },
            {
              type: "steps",
              items: [
                "Abra el alojamiento en Alojamientos.",
                "Vaya a la pestaña Visibilidad.",
                "Active el interruptor Web.",
                "Vaya al sitio web y compruebe el bloque Resumen de alojamientos en la vista previa.",
              ],
            },
            { type: "h2", text: "Ajustar el orden y la presentación" },
            {
              type: "p",
              text: "En el bloque Resumen de alojamientos determina si los alojamientos se ordenan automáticamente por disponibilidad o si establece un orden fijo. Cada alojamiento muestra la foto de portada, el precio base en su moneda registrada y las características de equipamiento más importantes.",
            },
            {
              type: "ul",
              items: [
                "Ordenación automática por disponibilidad u orden manual",
                "Filtro por tipo de alojamiento o equipamiento activable opcionalmente",
                "Los pasos de reserva se realizan directamente en el sitio web, sin pasar por un portal",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Un alojamiento sin la visibilidad web activada permanece oculto del resumen de alojamientos, aunque sea visible en el marketplace o en los portales.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Publicar el sitio web",
          excerpt: "Los borradores solo se hacen visibles públicamente con un clic en Publicar.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "p",
              text: "Mientras trabaja en el editor, solo usted ve el borrador actual. Solo un clic en Publicar hace que los cambios sean visibles bajo su dominio para todos los visitantes.",
            },
            { type: "h2", text: "Así publica" },
            {
              type: "steps",
              items: [
                "Abra en el editor la vista previa y revise todas las páginas.",
                "Haga clic arriba a la derecha en Publicar.",
                "Confirme el diálogo — el sitio web queda en línea de inmediato.",
                "Abra su dominio en una nueva pestaña para comprobar el resultado.",
              ],
            },
            { type: "h2", text: "Borradores y restablecer" },
            {
              type: "p",
              text: "Mientras aún no haya publicado, puede volver en cualquier momento a la última versión publicada sin perder definitivamente el borrador — use para ello Descartar borrador en la configuración del sitio web.",
            },
            {
              type: "ul",
              items: [
                "Los cambios publicados son visibles de inmediato bajo su dominio",
                "Un borrador no publicado permanece interno hasta que lo confirme",
                "Cada publicación queda registrada con fecha en el historial",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Revise antes de publicar la vista móvil en la vista previa — la mayoría de los huéspedes acceden a los sitios web de reservas desde el smartphone.",
            },
          ],
        },
      ],
    },
  ],
};
