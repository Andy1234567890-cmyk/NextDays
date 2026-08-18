import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Reclamaciones y resolución de litigios",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "Esta página describe cómo contactar con myBestDays, cómo tramitamos las reclamaciones y qué vías tiene abiertas si no está conforme con nuestra decisión.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Cómo contactarnos",
      paragraphs: [
        "La vía más rápida es el centro de ayuda y los canales de contacto allí indicados. Para una reserva existente utilice la mensajería de su cuenta — así dispondremos ya de la reserva y del historial.",
        `Por escrito puede contactarnos en ${ANBIETER.email} o ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dinamarca; por teléfono en ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Qué debería contener su reclamación",
      paragraphs: ["Para que podamos ayudarle con rapidez, indique:"],
      list: [
        "su número de reserva y la dirección de correo electrónico utilizada para la reserva;",
        "una breve descripción del problema;",
        "qué solución desea;",
        "los justificantes correspondientes — fotos, mensajes, recibos, extractos bancarios.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Cómo tramitamos",
      paragraphs: [
        "Toda reclamación queda registrada y recibe un número de expediente con el que puede seguir su estado.",
        "Acusamos recibo sin demora y respondemos sobre el fondo, por regla general, en un plazo de siete días. Si es necesario un examen más prolongado, le comunicamos el estado intermedio.",
        "Las reclamaciones en las que haya personas en peligro o una llegada inminente se tramitan con prioridad.",
        "Motivamos nuestra decisión e indicamos el fundamento en que se basa.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Reclamación contra una medida adoptada por nosotros",
      paragraphs: [
        "Si hemos retirado contenidos, restringido su visibilidad, cancelado una reserva o bloqueado una cuenta, puede reclamar gratuitamente en el plazo de seis meses. Ello se corresponde con el artículo 20 del Reglamento (UE) 2022/2065.",
        "La reclamación es examinada por personas, no exclusivamente por procedimientos automatizados. Si resulta fundada, revocamos la medida.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Resolución extrajudicial de litigios",
      paragraphs: [
        "La plataforma de resolución de litigios en línea de la Comisión Europea (plataforma RLL) fue derogada por el Reglamento (UE) 2024/3228 y ha cesado su actividad. Ya no pueden presentarse reclamaciones por esa vía.",
        "No estamos obligados ni dispuestos a participar en un procedimiento de resolución de litigios ante un órgano de resolución de litigios de consumo.",
        `Con independencia de ello, como consumidor puede dirigirse al órgano danés competente: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Dinamarca ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Si reside en otro Estado miembro, el Centro Europeo del Consumidor de su país puede ayudarle.`,
        "Si el litigio versa sobre una medida que hemos adoptado contra sus contenidos o su cuenta, puede además acudir a un órgano de resolución extrajudicial de litigios certificado conforme al artículo 21 del Reglamento (UE) 2022/2065. Sus decisiones no nos vinculan y no estamos obligados a participar en tales procedimientos.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Vía judicial",
      paragraphs: [
        "La vía judicial le está abierta en todo momento, también sin procedimiento previo de reclamación. Los tribunales competentes se indican en la sección A19 de las [Condiciones de uso](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Reclamaciones de proveedores",
      paragraphs: [
        "Los proveedores pueden presentar por el mismo procedimiento reclamaciones sobre la aplicación de estas condiciones, sobre decisiones de clasificación y sobre restricciones de su anuncio. Ello se corresponde con el artículo 11 del Reglamento (UE) 2019/1150.",
        "Informamos anualmente sobre el número, el objeto y el tiempo medio de tramitación de dichas reclamaciones; el informe puede consultarse en [Reglamento de Servicios Digitales](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
