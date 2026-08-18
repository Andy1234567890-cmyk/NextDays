import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Política de no discriminación",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "myBestDays está abierta a todos. Quien reserva u ofrece a través de la plataforma no puede tratar peor a nadie por razón de características personales.",
    "Esta política forma parte de las [Condiciones de uso](https://mybestdays.dk/rechtliches/nutzungsbedingungen) y se aplica tanto a huéspedes como a proveedores.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principio",
      paragraphs: [
        "En myBestDays no está permitido perjudicar a una persona por razón de su origen, color de piel, nacionalidad, pertenencia étnica, religión o convicciones, sexo, identidad de género, orientación sexual, discapacidad, edad o estado civil.",
        "Ello rige para la aceptación o el rechazo de reservas, para precios y condiciones, para el trato durante la estancia y para la comunicación a través de la plataforma.",
        "Se aplica además el artículo 20 del Reglamento (UE) 2018/302: los proveedores no pueden restringir el acceso a su oferta por razón de la nacionalidad, el lugar de residencia o el lugar de establecimiento de un huésped dentro de la Unión.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. Qué significa esto para los proveedores",
      paragraphs: ["Como proveedor, en particular, no puede:"],
      list: [
        "rechazar una solicitud de reserva por razón de alguna de las características mencionadas;",
        "exigir precios, fianzas o condiciones distintos a huéspedes porque presenten alguna de esas características;",
        "declarar en el anuncio o en mensajes que determinados grupos de personas no son bienvenidos;",
        "rechazar perros de asistencia o perros guía, aun cuando sus normas de la casa excluyan animales;",
        "tratar de forma distinta a un huésped por razón de su residencia en otro Estado miembro de la Unión.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. Qué sigue estando permitido",
      paragraphs: [
        "Puede fijar la ocupación máxima, una edad mínima para la persona que reserva y normas de la casa objetivas (por ejemplo, prohibición de fumar u horas de silencio), siempre que se apliquen por igual a todos los huéspedes.",
        "Si usted mismo habita el alojamiento y comparte espacios con el huésped, puede indicarlo claramente en el anuncio; no obstante, las características de la sección 1 no justifican un rechazo.",
        "Puede rechazar una reserva cuando existan indicios concretos de infracción de las normas de la casa o de fraude. El motivo debe referirse a la conducta, no a la persona.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Accesibilidad",
      paragraphs: [
        "Los datos sobre la accesibilidad de un alojamiento deben ser exactos. Describir como accesible un alojamiento que no lo es constituye asimismo una infracción de las [Normas sobre contenidos adecuados](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
        "Cuando una adaptación sea posible sin esfuerzo desproporcionado, esperamos que los proveedores la realicen.",
      ],
    },
    {
      id: "melden",
      heading: "5. Comunicar discriminación",
      paragraphs: [
        "Si ha sufrido u observado discriminación, comuníquenoslo mediante la función de notificación o a través de las vías de contacto indicadas en [Reclamaciones y resolución de litigios](https://mybestdays.dk/rechtliches/beschwerden).",
        "Examinamos toda comunicación. Si se confirma una infracción, adoptamos medidas que pueden llegar al bloqueo permanente de la cuenta. Si por ese motivo se le denegó una reserva, le ayudamos a encontrar un alojamiento comparable.",
      ],
    },
  ],
};
