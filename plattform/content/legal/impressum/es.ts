import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Aviso legal",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    `Datos del prestador del mercado myBestDays. El operador es ${ANBIETER.firma}; myBestDays es una marca de esta sociedad y no una persona jurídica independiente.`,
    "Menciones obligatorias conforme al artículo 7 de la ley danesa de comercio electrónico, que transpone el artículo 5 de la Directiva 2000/31/CE, así como conforme a los artículos 11 y 12 del Reglamento (UE) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Operador de la plataforma",
      paragraphs: [
        `${ANBIETER.firma} — sociedad de responsabilidad limitada (anpartsselskab, ApS) de Derecho danés`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Dinamarca`,
        `Dirección con facultad de representación: ${ANBIETER.direktion.join(" y ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Contacto",
      paragraphs: [
        `Correo electrónico: ${ANBIETER.email}`,
        `Teléfono: ${ANBIETER.telefon}`,
        "Para asuntos relativos a una reserva existente utilice la mensajería de su cuenta — así dispondremos ya de la reserva y del historial; véase [Reclamaciones y resolución de litigios](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Registro e IVA",
      paragraphs: [
        `CVR n.º ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dinamarca.`,
        ...(ANBIETER.ustId
          ? [`Número de identificación a efectos del IVA: ${ANBIETER.ustId}.`]
          : [
              "Actualmente no existe número de identificación a efectos del IVA; el artículo 7 de la ley de comercio electrónico solo exige indicarlo cuando existe registro a efectos del IVA.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Puntos de contacto conforme al Reglamento (UE) 2022/2065",
      paragraphs: [
        `Punto de contacto único para autoridades conforme al artículo 11 y para usuarios conforme al artículo 12: ${ANBIETER.email}, por correo postal en la dirección indicada arriba.`,
        "Las lenguas de comunicación son alemán, danés e inglés.",
        "Los procedimientos previstos en dicho Reglamento — notificación de contenidos ilícitos, motivación de las medidas, tramitación de reclamaciones — se describen en [Reglamento de Servicios Digitales](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Autoridades competentes",
      paragraphs: [
        `Coordinador de servicios digitales conforme al artículo 49 del Reglamento (UE) 2022/2065: ${DSA_KOORDINATOR.name}, Dinamarca ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Autoridad de control en materia de protección de datos: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Dinamarca, ${AUFSICHTSBEHOERDE.email}.`,
        "La intermediación de servicios de alojamiento no requiere en Dinamarca autorización especial; por ello no existe autoridad de supervisión profesional.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Resolución de litigios de consumo",
      paragraphs: [
        "La plataforma de resolución de litigios en línea de la Comisión Europea fue derogada por el Reglamento (UE) 2024/3228 y ha cesado su actividad.",
        "No estamos obligados ni dispuestos a participar en un procedimiento de resolución de litigios ante un órgano de resolución de litigios de consumo.",
        `Con independencia de ello, como consumidor puede dirigirse al órgano danés competente: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Dinamarca ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Si reside en otro Estado miembro, el Centro Europeo del Consumidor de su país puede ayudarle.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Indicaciones sobre contenidos y enlaces",
      paragraphs: [
        "Los contenidos de los anuncios proceden de los proveedores correspondientes. myBestDays no los hace suyos; véase la sección A4 de las [Condiciones de uso](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "Del contenido de los sitios de terceros enlazados responde su operador. En cuanto tengamos conocimiento de una infracción, retiraremos el enlace sin demora.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Derechos de autor",
      paragraphs: [
        `Los contenidos propios, textos, elementos gráficos y marcas publicados en esta plataforma están protegidos por el derecho de autor y el derecho de marcas. Cualquier uso fuera de los supuestos legalmente admitidos requiere el consentimiento previo por escrito de ${ANBIETER.firma}; para las marcas se aplican las [Normas sobre marcas](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Derecho aplicable",
      paragraphs: [
        `${ANBIETER.firma} tiene su domicilio social en Dinamarca y está establecida únicamente allí. A esta oferta en línea se aplica, por tanto, el Derecho danés — también a la versión en español (principio del país de origen conforme al artículo 3 de la Directiva 2000/31/CE). Las disposiciones imperativas de protección de los consumidores de su Estado de residencia no se ven afectadas.`,
      ],
    },
  ],
};
