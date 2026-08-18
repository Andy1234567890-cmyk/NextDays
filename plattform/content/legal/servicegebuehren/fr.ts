import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Frais de service",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "myBestDays se finance par des frais de service sur les réservations intermédiées. La présente page explique qui les paie, comment ils sont calculés et où ils sont indiqués.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Qui paie les frais de service",
      paragraphs: [
        "Les frais de service sont supportés par le fournisseur. Ils sont retenus sur la valeur de réservation et réduisent le versement qui lui revient ; le voyageur ne les paie pas en supplément.",
        "Si, à titre exceptionnel, des frais de service sont dus par le voyageur pour une réservation, nous les indiquons comme poste distinct du prix total avant la finalisation de la réservation. À défaut d'une telle indication, aucun frais n'est dû par le voyageur.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Comment ils sont calculés",
      paragraphs: [
        "Les frais de service correspondent à un pourcentage de la valeur de réservation réglée via la plateforme. Le taux applicable à vos réservations figure dans votre compte hôte et dans le contrat que vous avez accepté lors de l'inscription.",
        "La base de calcul est le prix des nuitées majoré des suppléments réglés via la plateforme. Sont exclus les postes de simple transit qui ne constituent pas une contrepartie du fournisseur — en particulier la taxe de séjour et la caution.",
        "Les frais de service sont calculés et indiqués dans la devise de l'annonce.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. TVA",
      paragraphs: [
        "La TVA s'applique aux frais de service dans la mesure où elle est légalement due. Son affichage ou l'application de l'autoliquidation dépend du lieu d'établissement et du statut du fournisseur.",
        "Nous établissons au fournisseur un décompte des frais de service, consultable dans son compte.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Annulation et remboursement",
      paragraphs: [
        "Si une réservation est intégralement remboursée, nous remboursons les frais de service au prorata du montant de réservation remboursé.",
        "Si le fournisseur annule sans motif sérieux, les frais de service ne sont pas automatiquement supprimés ; nous nous réservons le droit de réclamer les coûts nés de l'annulation.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Modification des frais de service",
      paragraphs: [
        "Nous annonçons toute modification du taux aux fournisseurs au moins 30 jours avant son entrée en vigueur sur un support durable ; cela correspond à l'article 3, paragraphe 2, du règlement (UE) 2019/1150.",
        "Pour les réservations déjà confirmées, le taux applicable au moment de la réservation demeure en vigueur.",
      ],
    },
  ],
};
