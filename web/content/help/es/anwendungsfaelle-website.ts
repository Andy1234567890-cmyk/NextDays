import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Sitio web",
  description: "Aproveche al máximo su sitio web.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Sitio web",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Poner en línea su sitio web",
          excerpt: "Así publica su propio sitio web como canal de venta independiente.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida",
            },
            {
              type: "p",
              text: "Su sitio web es un canal de venta propio junto a los portales y la plataforma. Construye las páginas en el editor, pero solo con la publicación el sitio web se vuelve visible para los huéspedes y sus alojamientos aparecen ahí como reservables.",
            },
            {
              type: "steps",
              items: [
                "Abra el editor del sitio web y compruebe que todas las páginas deseadas tengan contenido.",
                "Elija en la pestaña de alojamiento, por cada alojamiento, si debe ser visible en el sitio web — esta visibilidad es independiente de los portales y de la plataforma.",
                "Revise la vista previa en escritorio y en móvil antes de publicar.",
                "Haga clic en «Publicar» para activar el sitio web para los huéspedes.",
                "Tras la publicación, compruebe la URL pública y pruebe una reserva de ejemplo a través del sitio web.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La visibilidad web de un alojamiento es un eje propio — un alojamiento puede estar activo en los portales pero oculto en el sitio web, y viceversa. Más detalles en [Configurar un dominio propio](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Configurar un dominio propio",
          excerpt: "Así conecta su propio dominio con su sitio web de myNextDays.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida",
            },
            {
              type: "p",
              text: "Un dominio propio como www.su-negocio.es transmite más profesionalidad que una dirección estándar y refuerza su marca frente a los huéspedes que quieren reservar directamente con usted.",
            },
            {
              type: "steps",
              items: [
                "Abra en el editor del sitio web la sección «Dominio» e introduzca el dominio propio que desee.",
                "Configure en el proveedor de su dominio los registros DNS mostrados (normalmente CNAME o registro A).",
                "Espere hasta que el dominio se muestre como conectado y el certificado SSL como activo — según el proveedor esto puede tardar varias horas.",
                "Pruebe el acceso al dominio propio en una ventana privada del navegador para descartar entradas antiguas en caché.",
                "Compruebe que las direcciones estándar antiguas siguen redirigiendo al nuevo dominio, para que los enlaces existentes no queden rotos.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Cambie los registros DNS solo tal como se muestran — valores incorrectos pueden alterar la configuración de correo electrónico existente de su dominio. En caso de duda, consulte con el proveedor de su dominio antes de sobrescribir registros existentes.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Aumentar las reservas directas",
          excerpt: "Así dirige a más huéspedes hacia su propio sitio web en lugar de los portales.",
          updated: "Actualizado: julio de 2026",
          body: [
            {
              type: "h2",
              text: "Situación de partida",
            },
            {
              type: "p",
              text: "Las reservas a través del propio sitio web suelen ser más económicas para su negocio que las de los portales, ya que aquí no se aplica ninguna comisión de portal. Con algunas medidas específicas, aumenta la proporción de reservas directas a través de su sitio web como canal independiente.",
            },
            {
              type: "steps",
              items: [
                "Asegúrese de que todos los alojamientos reservables sean visibles en el sitio web y cuenten con fotos y descripciones actuales.",
                "Configure un descuento o ventaja exclusiva del sitio web, por ejemplo, una pequeña rebaja de precio frente a los portales.",
                "Enlace su dominio propio en las confirmaciones de reserva y en la comunicación con huéspedes que ya hayan reservado antes.",
                "Revise periódicamente las estadísticas de reservas para observar en el tiempo la proporción del sitio web sobre el total de reservas.",
                "Optimice el tiempo de carga y la visualización móvil del sitio web, ya que la mayoría de los huéspedes reserva desde el smartphone.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Una ventaja exclusiva del sitio web solo funciona si los huéspedes llegan a encontrar el sitio web — remita activamente a él en lugar de confiar solo en los portales. Sobre la publicación, vea [Poner en línea su sitio web](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
