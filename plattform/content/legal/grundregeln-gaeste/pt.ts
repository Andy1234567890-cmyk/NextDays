import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Regras básicas para hóspedes",
  stand: "Atualizado: 18 de agosto de 2026",
  intro: [
    "As presentes regras básicas aplicam-se a qualquer estada reservada através da myBestDays. Complementam as regras da casa do respetivo fornecedor — se estas forem mais restritivas, aplicam-se em acréscimo.",
    "Quem violar as regras básicas deve contar com medidas até ao bloqueio da conta e responde perante o fornecedor pelos danos ocorridos.",
  ],
  sections: [
    {
      id: "belegung",
      heading: "1. Ocupação",
      paragraphs: [
        "No alojamento pernoitam apenas as pessoas indicadas na reserva e, no máximo, tantas quantas a ocupação máxima permita.",
        "As visitas que não pernoitem são permitidas, salvo disposição em contrário das regras da casa.",
        "O alojamento não pode ser subarrendado nem cedido.",
      ],
    },
    {
      id: "ruhe",
      heading: "2. Respeito e horas de silêncio",
      paragraphs: [
        "Tenha consideração pelos vizinhos. Respeite as horas de silêncio indicadas nas regras da casa; na sua falta vale o descanso noturno habitual do local.",
        "Festas e eventos não são permitidos sem autorização expressa do fornecedor. Tal vale mesmo quando a ocupação máxima seja respeitada.",
        "A utilização comercial do alojamento — por exemplo, produções fotográficas ou de vídeo, eventos de venda — carece de consentimento prévio do fornecedor.",
      ],
    },
    {
      id: "umgang",
      heading: "3. Utilização do alojamento",
      paragraphs: [
        "Trate o alojamento e o seu recheio com cuidado e deixe-o em ordem.",
        "Comunique danos e avarias ao fornecedor sem demora — e não apenas após a partida. Só assim ele os pode reparar e só assim mantém os seus direitos.",
        "Responde pelos danos causados por si ou pelos seus acompanhantes. Se estiver acordada uma caução, pode ser utilizada para esse efeito.",
      ],
    },
    {
      id: "sicherheit",
      heading: "4. Segurança",
      paragraphs: [
        "Mantenha detetores de fumo, extintores e vias de evacuação desimpedidos e operacionais. Os detetores de fumo não podem ser tapados nem removidos.",
        "Fumar só é permitido se as regras da casa o autorizarem expressamente, e apenas nas zonas destinadas para o efeito.",
        "Em piscina, sauna, lareira, grelhador ou jacuzzi siga as indicações do fornecedor. As crianças só podem utilizar tais instalações sob vigilância.",
      ],
    },
    {
      id: "tiere",
      heading: "5. Animais",
      paragraphs: [
        "Só pode levar animais se o anúncio o permitir e se os tiver indicado na reserva.",
        "Os cães de assistência e cães-guia são sempre permitidos, mesmo que o anúncio exclua animais. Anuncie-os para que o fornecedor se possa preparar.",
      ],
    },
    {
      id: "anreise",
      heading: "6. Chegada e partida",
      paragraphs: [
        "Respeite os horários de chegada e partida indicados no anúncio. Se necessitar de horários diferentes, acorde-os previamente com o fornecedor.",
        "Disponibilize atempadamente os dados de que o fornecedor necessita para o registo (boletim de alojamento, dados de identificação, taxa turística).",
        "Não transmita a terceiros credenciais de acesso, códigos e chaves.",
      ],
    },
    {
      id: "kommunikation",
      heading: "7. Comunicação",
      paragraphs: [
        "Efetue reserva, pagamento e acordos através da plataforma. Só assim ficam documentados e só assim podemos ajudar em caso de litígio.",
        "Mantenha-se objetivo perante o fornecedor e a nossa equipa. Injúrias e ameaças conduzem de imediato a medidas contra a conta.",
      ],
    },
  ],
};
