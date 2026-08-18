import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Terceros y servicios de pago",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "myBestDays recurre a servicios de terceros para el funcionamiento de la plataforma. Esta página los enumera y explica qué papel desempeñan y qué condiciones resultan aplicables.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principio",
      paragraphs: [
        "Cuando un tercero presta un servicio directamente a usted, sus condiciones y su política de privacidad se aplican junto con las nuestras. Lo advertimos en el lugar correspondiente.",
        "Cuando un tercero trata datos exclusivamente por nuestra cuenta, seguimos siendo su interlocutor. Los encargados del tratamiento que utilizamos figuran en la [Política de privacidad](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Proveedor de servicios de pago",
      paragraphs: [
        "Los pagos a través de la plataforma los tramita Stripe. Stripe recoge y trata los datos de pago directamente y es responsable del tratamiento de forma autónoma. Se aplica además la [política de privacidad de Stripe](https://stripe.com/privacy).",
        "Para el abono a los anfitriones, Stripe realiza la verificación de identidad legalmente exigida.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Directiva de servicios de pago y acceso de terceros",
      paragraphs: [
        "La Directiva (UE) 2015/2366 («PSD2») exige autenticación reforzada del cliente para numerosos pagos. La realiza su banco o el emisor de su tarjeta; sin una autenticación satisfactoria un pago puede ser rechazado.",
        "myBestDays no es un servicio de iniciación de pagos ni de información sobre cuentas y no accede a sus cuentas bancarias.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Mapas, imágenes y contenidos incrustados",
      paragraphs: [
        "Para las representaciones cartográficas y los datos de ubicación incrustamos servicios de mapas de terceros. Al cargar dichos contenidos pueden transferirse datos al proveedor correspondiente; los detalles y el control del consentimiento figuran en la [Política de cookies](https://mybestdays.dk/rechtliches/cookies).",
        "Las imágenes y descripciones de los anuncios proceden del proveedor correspondiente, no de nosotros.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Sitios enlazados",
      paragraphs: [
        "La plataforma puede enlazar a sitios de terceros. No tenemos influencia sobre sus contenidos ni asumimos responsabilidad por ellos. En cuanto tengamos conocimiento de una infracción, retiraremos el enlace sin demora.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. Tiendas de aplicaciones",
      paragraphs: [
        "Si obtiene la aplicación myBestDays a través de una tienda de aplicaciones, se aplican además las condiciones del operador de dicha tienda. El operador de la tienda no es parte del contrato entre usted y nosotros y no debe soporte ni garantía por la aplicación.",
      ],
    },
  ],
};
