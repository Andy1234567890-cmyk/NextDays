import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Règles de base pour les voyageurs",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "Les présentes règles de base s'appliquent à tout séjour réservé via myBestDays. Elles complètent le règlement intérieur du fournisseur concerné — lorsque celui-ci est plus strict, il s'applique en outre.",
    "Quiconque enfreint les règles de base s'expose à des mesures pouvant aller jusqu'à la suspension du compte et répond envers le fournisseur des dommages survenus.",
  ],
  sections: [
    {
      id: "belegung",
      heading: "1. Occupation",
      paragraphs: [
        "Seules les personnes indiquées lors de la réservation passent la nuit dans l'hébergement, et au plus autant que l'occupation maximale l'autorise.",
        "Les visites sans nuitée sont admises, sauf disposition contraire du règlement intérieur.",
        "L'hébergement ne peut être sous-loué ni cédé.",
      ],
    },
    {
      id: "ruhe",
      heading: "2. Égards et heures de calme",
      paragraphs: [
        "Ayez égard au voisinage. Respectez les heures de calme mentionnées dans le règlement intérieur ; en l'absence d'indication, le repos nocturne d'usage local s'applique.",
        "Les fêtes et manifestations ne sont pas autorisées sans l'accord exprès du fournisseur. Cela vaut même lorsque l'occupation maximale est respectée.",
        "L'usage commercial de l'hébergement — par exemple productions photo ou vidéo, manifestations de vente — requiert l'accord préalable du fournisseur.",
      ],
    },
    {
      id: "umgang",
      heading: "3. Usage de l'hébergement",
      paragraphs: [
        "Prenez soin de l'hébergement et de son mobilier et laissez-le en bon ordre.",
        "Signalez sans délai au fournisseur les dommages et dysfonctionnements — non seulement après le départ. Ce n'est qu'ainsi qu'il peut y remédier et que vous conservez vos droits.",
        "Vous répondez des dommages que vous ou vos compagnons de voyage causez. Si une caution est convenue, elle peut être mobilisée à cette fin.",
      ],
    },
    {
      id: "sicherheit",
      heading: "4. Sécurité",
      paragraphs: [
        "Maintenez les détecteurs de fumée, extincteurs et voies d'évacuation libres et opérationnels. Les détecteurs de fumée ne doivent être ni recouverts ni retirés.",
        "Fumer n'est autorisé que si le règlement intérieur le permet expressément, et uniquement dans les zones prévues à cet effet.",
        "Pour la piscine, le sauna, la cheminée, le barbecue ou le spa, suivez les instructions du fournisseur. Les enfants ne peuvent utiliser ces installations que sous surveillance.",
      ],
    },
    {
      id: "tiere",
      heading: "5. Animaux",
      paragraphs: [
        "Vous ne pouvez emmener des animaux que si l'annonce le permet et si vous les avez indiqués lors de la réservation.",
        "Les chiens d'assistance et les chiens guides sont toujours admis, même si l'annonce exclut les animaux. Merci de les annoncer afin que le fournisseur puisse s'y préparer.",
      ],
    },
    {
      id: "anreise",
      heading: "6. Arrivée et départ",
      paragraphs: [
        "Respectez les horaires d'arrivée et de départ mentionnés dans l'annonce. Si vous avez besoin d'horaires différents, convenez-en préalablement avec le fournisseur.",
        "Fournissez en temps utile les informations dont le fournisseur a besoin pour l'enregistrement (fiche de police, données d'identité, taxe de séjour).",
        "Vous ne transmettez pas à des tiers les identifiants d'accès, codes et clés.",
      ],
    },
    {
      id: "kommunikation",
      heading: "7. Communication",
      paragraphs: [
        "Effectuez la réservation, le paiement et les échanges via la plateforme. Ce n'est qu'ainsi qu'ils sont documentés et que nous pouvons intervenir en cas de litige.",
        "Restez factuel envers le fournisseur et notre équipe. Les injures et menaces entraînent immédiatement des mesures à l'encontre du compte.",
      ],
    },
  ],
};
