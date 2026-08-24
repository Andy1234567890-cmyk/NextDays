// Traducción al español del aviso legal. La versión de referencia es
// ./de.ts — los cambios de contenido deben hacerse PRIMERO allí.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Aviso legal",
  metaDescription:
    "Datos del proveedor myNextDays ApS conforme al artículo 7 de la ley danesa de comercio electrónico (e-handelslov): empresa, domicilio, dirección, número de CVR y contacto.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Datos sobre el proveedor de la plataforma myNextDays — un property management system y channel manager operado por ${ANBIETER.firma}.`,
    "Información obligatoria conforme al artículo 7 de la ley danesa de comercio electrónico (e-handelslov), que transpone el artículo 5 de la Directiva 2000/31/CE sobre comercio electrónico.",
  ],
  sections: [
    {
      heading: "Proveedor",
      zeilen: [
        {
          label: "Empresa",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Domicilio",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Dirección con poder de representación",
          werte: [`${ANBIETER.direktion.join(" y ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Contacto",
      zeilen: [
        {
          label: "Correo electrónico",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Teléfono",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Internet",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Registro mercantil e IVA",
      zeilen: [
        {
          label: "Registro mercantil",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dinamarca",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Número de identificación a efectos del IVA",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Punto de contacto conforme a la Ley de Servicios Digitales",
      paragraphs: [
        `Punto de contacto central para las autoridades conforme al artículo 11 y para los usuarios conforme al artículo 12 del Reglamento (UE) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Los idiomas de comunicación son el alemán, el danés y el inglés.",
      ],
    },
    {
      heading: "Resolución de litigios de consumo",
      paragraphs: [
        "No estamos dispuestos ni obligados a participar en un procedimiento de resolución de litigios ante una junta arbitral de consumo.",
      ],
    },
    {
      heading: "Responsabilidad por enlaces",
      paragraphs: [
        "Pese a un control cuidadoso del contenido, no asumimos responsabilidad alguna por el contenido de enlaces externos. Del contenido de las páginas enlazadas son responsables exclusivamente sus respectivos operadores.",
      ],
    },
    {
      heading: "Derechos de autor",
      paragraphs: [
        `Los contenidos, textos, gráficos y marcas publicados en este sitio web están protegidos por derechos de autor y de marca. Cualquier uso que exceda los casos permitidos por la ley requiere el consentimiento previo por escrito de ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Otros documentos legales",
      paragraphs: [
        "El uso de la plataforma se rige por nuestras condiciones generales de contratación. El modo en que tratamos los datos personales figura en la política de privacidad; las cookies utilizadas se enumeran en la política de cookies.",
      ],
      links: [
        { label: "Condiciones generales de contratación", href: AGB_URL },
        { label: "Política de privacidad", href: "/datenschutz" },
        { label: "Política de cookies", href: "/cookie-richtlinie" },
        { label: "Acuerdo de encargo de tratamiento (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Derecho aplicable",
      paragraphs: [
        `${ANBIETER.firma} tiene su domicilio social y está establecida exclusivamente en Dinamarca. Por ello, a esta oferta en línea le es aplicable el derecho danés — también a la versión en español (principio del país de origen conforme al artículo 3 de la Directiva 2000/31/CE). Las obligaciones de información se rigen por el artículo 7 de la ley danesa de comercio electrónico (e-handelslov).`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
