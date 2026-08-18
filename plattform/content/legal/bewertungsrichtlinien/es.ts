import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Política de valoraciones",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "Las valoraciones son para los huéspedes la fuente independiente más importante. Esta política describe quién puede valorar, cómo garantizamos que las valoraciones proceden de huéspedes reales y cuándo retiramos una valoración.",
  ],
  sections: [
    {
      id: "echtheit",
      heading: "1. Cómo garantizamos la autenticidad",
      paragraphs: [
        "Solo puede dejar una valoración quien haya reservado el alojamiento a través de myBestDays y cuyo periodo de estancia haya comenzado. La valoración se vincula técnicamente a la reserva concreta.",
        "Con ello cumplimos la obligación derivada del punto 23 ter del anexo I de la Directiva 2005/29/CE de presentar como valoraciones de huéspedes únicamente aquellas respecto de las cuales hayamos adoptado medidas razonables para comprobar que proceden de huéspedes reales.",
        "No compramos valoraciones, no las encargamos y no publicamos valoraciones falsas. Tampoco toleramos que lo hagan los proveedores.",
      ],
    },
    {
      id: "frist",
      heading: "2. Plazo y publicación",
      paragraphs: [
        "Tras la salida dispone de 14 días para dejar una valoración. El proveedor puede valorarle a usted dentro del mismo plazo.",
        "Ambas valoraciones se publican simultáneamente en cuanto existan las dos o haya transcurrido el plazo. Así ninguna de las partes influye en la otra.",
        "Puede retirar una valoración ya emitida dentro del plazo. Tras la publicación no es posible modificarla; puede solicitar su eliminación.",
      ],
    },
    {
      id: "antwort",
      heading: "3. Respuesta del proveedor",
      paragraphs: [
        "El proveedor puede responder públicamente a una valoración. A la respuesta se aplican las mismas reglas que a la valoración.",
        "Una respuesta no modifica la valoración ni altera la nota global.",
      ],
    },
    {
      id: "entfernung",
      heading: "4. Cuándo retiramos una valoración",
      paragraphs: [
        "No retiramos una valoración por ser negativa ni porque el proveedor esté descontento con ella. La retiramos cuando:",
      ],
      list: [
        "infringe las [Normas sobre contenidos adecuados](https://mybestdays.dk/rechtliches/inhaltsrichtlinien);",
        "contiene datos personales de terceros;",
        "se refiere manifiestamente a otro alojamiento o a otra estancia;",
        "versa esencialmente sobre circunstancias ajenas a la influencia tanto del huésped como del proveedor (por ejemplo, meteorología, obras municipales, tráfico a la llegada) — en tal caso solo retiramos la parte afectada si puede separarse;",
        "persigue manifiestamente una extorsión, por ejemplo porque se ha vinculado a una exigencia;",
        "se ha obtenido mediante incentivos o se ha emitido de forma coordinada.",
      ],
    },
    {
      id: "anreize",
      heading: "5. Los incentivos no están permitidos",
      paragraphs: [
        "Los proveedores no pueden ofrecer dinero, descuentos, mejoras de categoría, regalos u otras ventajas a cambio de una valoración — ni por abstenerse de valorar.",
        "Los proveedores pueden invitar a los huéspedes a valorar sin influir en la nota. No está permitida una invitación que solo solicite valoración en caso de experiencia positiva.",
      ],
    },
    {
      id: "darstellung",
      heading: "6. Cómo mostramos las valoraciones",
      paragraphs: [
        "La nota global es la media no ponderada de todas las valoraciones publicadas de un alojamiento. No ponderamos más una valoración por ser más favorable.",
        "La ordenación por defecto muestra primero las valoraciones más recientes. Puede cambiar a otras ordenaciones; se indica cuál está activa.",
        "Indicamos en cuántas valoraciones se basa una nota global. Con menos de tres valoraciones no mostramos nota global, solo las valoraciones individuales.",
      ],
    },
    {
      id: "beschwerde",
      heading: "7. Reclamación contra una decisión",
      paragraphs: [
        "Si retiramos su valoración o denegamos la retirada de una valoración, lo motivamos e indicamos la vía de reclamación — véase [Reclamaciones y resolución de litigios](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
  ],
};
