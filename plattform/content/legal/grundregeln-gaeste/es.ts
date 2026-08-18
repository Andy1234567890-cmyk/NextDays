import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Reglas básicas para huéspedes",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "Estas reglas básicas se aplican a toda estancia reservada a través de myBestDays. Complementan las normas de la casa del proveedor correspondiente — si estas son más estrictas, se aplican además.",
    "Quien infrinja las reglas básicas debe contar con medidas que pueden llegar al bloqueo de la cuenta y responde frente al proveedor de los daños producidos.",
  ],
  sections: [
    {
      id: "belegung",
      heading: "1. Ocupación",
      paragraphs: [
        "En el alojamiento pernoctan únicamente las personas indicadas en la reserva, y como máximo tantas como permita la ocupación máxima.",
        "Las visitas que no pernocten están permitidas, salvo que las normas de la casa dispongan otra cosa.",
        "El alojamiento no puede subarrendarse ni cederse.",
      ],
    },
    {
      id: "ruhe",
      heading: "2. Consideración y horas de silencio",
      paragraphs: [
        "Tenga consideración con los vecinos. Respete las horas de silencio indicadas en las normas de la casa; a falta de indicación rige el descanso nocturno habitual del lugar.",
        "Las fiestas y eventos no están permitidos sin autorización expresa del proveedor. Ello rige también cuando se respete la ocupación máxima.",
        "El uso comercial del alojamiento — por ejemplo, producciones fotográficas o audiovisuales, eventos de venta — requiere el consentimiento previo del proveedor.",
      ],
    },
    {
      id: "umgang",
      heading: "3. Uso del alojamiento",
      paragraphs: [
        "Trate el alojamiento y su mobiliario con cuidado y déjelo en orden.",
        "Comunique los daños y averías al proveedor sin demora — no solo tras la salida. Solo así podrá subsanarlos y solo así conservará usted sus derechos.",
        "Usted responde de los daños que usted o sus acompañantes causen. Si se ha pactado una fianza, podrá aplicarse a tal fin.",
      ],
    },
    {
      id: "sicherheit",
      heading: "4. Seguridad",
      paragraphs: [
        "Mantenga los detectores de humo, extintores y vías de evacuación libres y operativos. Los detectores de humo no pueden taparse ni retirarse.",
        "Fumar solo está permitido si las normas de la casa lo autorizan expresamente, y únicamente en las zonas habilitadas.",
        "En piscina, sauna, chimenea, barbacoa o bañera de hidromasaje siga las indicaciones del proveedor. Los menores solo podrán utilizar dichas instalaciones bajo supervisión.",
      ],
    },
    {
      id: "tiere",
      heading: "5. Animales",
      paragraphs: [
        "Solo puede llevar animales si el anuncio lo permite y usted los indicó en la reserva.",
        "Los perros de asistencia y los perros guía están siempre permitidos, aun cuando el anuncio excluya animales. Anúncielos para que el proveedor pueda prepararse.",
      ],
    },
    {
      id: "anreise",
      heading: "6. Llegada y salida",
      paragraphs: [
        "Respete los horarios de llegada y salida indicados en el anuncio. Si necesita horarios distintos, acuérdelos previamente con el proveedor.",
        "Facilite con tiempo suficiente los datos que el proveedor necesite para el registro (parte de entrada, datos de identidad, tasa turística).",
        "No transmita a terceros los datos de acceso, códigos ni llaves.",
      ],
    },
    {
      id: "kommunikation",
      heading: "7. Comunicación",
      paragraphs: [
        "Realice la reserva, el pago y los acuerdos a través de la plataforma. Solo así quedan documentados y solo así podemos ayudar en caso de conflicto.",
        "Manténgase objetivo frente al proveedor y a nuestro equipo. Las injurias y amenazas dan lugar de inmediato a medidas contra la cuenta.",
      ],
    },
  ],
};
