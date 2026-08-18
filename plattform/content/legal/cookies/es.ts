import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Política de cookies",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "Esta política explica qué cookies y tecnologías similares utiliza myBestDays, con qué finalidad, cuánto tiempo se conservan y cómo puede gestionarlas.",
    "Complementa la [Política de privacidad](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Qué son las cookies",
      paragraphs: [
        "Las cookies son pequeños archivos de texto que un sitio web almacena en su navegador. Tecnologías similares son el almacenamiento local del navegador y los píxeles de seguimiento en los correos electrónicos.",
        "Las cookies estrictamente necesarias para el funcionamiento de la plataforma pueden instalarse sin su consentimiento. Para todas las demás recabamos su consentimiento (artículo 5, apartado 3, de la Directiva 2002/58/CE).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Cookies necesarias",
      paragraphs: [
        "Estas cookies son necesarias para el funcionamiento y no pueden desactivarse. Actualmente instalamos:",
      ],
      list: [
        "«nd_access»: mantiene su sesión iniciada. Legible solo por el servidor (HttpOnly), duración correspondiente a la validez de la sesión.",
        "«nd_refresh»: renueva su inicio de sesión para que no tenga que autenticarse continuamente. Legible solo por el servidor, duración 30 días.",
        "«nd_gast_locale»: recuerda el idioma elegido. Duración un año.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Cookies funcionales, estadísticas y publicitarias",
      paragraphs: [
        "myBestDays no instala actualmente cookies de estadística, medición de audiencia o publicidad y no incorpora redes publicitarias ni servicios de analítica.",
        "Si esto cambiara, recabaríamos previamente su consentimiento mediante un cuadro de diálogo en el que rechazar sea tan sencillo como aceptar, y completaríamos esta política con las cookies concretas.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Contenidos de terceros incrustados",
      paragraphs: [
        "En las páginas de detalle pueden incrustarse mapas. Solo cargamos dichos contenidos cuando usted los activa expresamente; solo entonces pueden transmitirse datos al proveedor correspondiente.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Cómo gestionar las cookies",
      paragraphs: [
        "Puede modificar o retirar su consentimiento en cualquier momento a través de la configuración de cookies del pie de página.",
        "Además puede eliminar o bloquear cookies en su navegador. Si elimina las cookies necesarias, se cerrará su sesión y la plataforma funcionará de forma limitada.",
      ],
    },
  ],
};
