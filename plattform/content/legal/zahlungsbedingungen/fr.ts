import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Conditions de paiement",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "Les présentes conditions de paiement régissent le traitement des paiements liés à une réservation via myBestDays. Elles complètent les [Conditions d'utilisation pour les voyageurs](https://mybestdays.dk/rechtliches/nutzungsbedingungen) ; en cas de contradiction sur des questions de paiement, les présentes conditions de paiement prévalent.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Notre rôle dans le paiement",
      paragraphs: [
        "myBestDays traite les paiements pour le compte du fournisseur. Nous ne sommes ni un établissement de paiement ni un établissement de monnaie électronique ; le service de paiement lui-même est fourni par notre prestataire de services de paiement.",
        "Les paiements via la plateforme sont traités par Stripe (Stripe Payments Europe, Limited). Les données de carte et autres données de paiement sont collectées et traitées directement par Stripe. myBestDays ne conserve aucune donnée de carte complète.",
        "Si vous payez via la plateforme, votre obligation de paiement envers le fournisseur est réputée exécutée à hauteur du montant payé dès que le paiement a été autorisé et encaissé avec succès par notre prestataire de services de paiement.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Moyens de paiement",
      paragraphs: [
        "Les moyens de paiement disponibles dépendent de l'annonce, du pays du fournisseur et de votre pays. Les moyens disponibles sont affichés avant la finalisation de la réservation.",
        "Pour certains moyens de paiement, une authentification forte du client est requise en vertu de la directive (UE) 2015/2366. Sans authentification réussie, le paiement ne peut être exécuté.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Exigibilité, acompte et solde",
      paragraphs: [
        "Le moment auquel chaque montant devient exigible est déterminé par le fournisseur dans l'annonce. Trois modèles sont courants : paiement intégral à la réservation, acompte à la réservation avec solde avant l'arrivée, ou paiement sur place auprès du fournisseur.",
        "Le modèle applicable à votre réservation et les échéances sont affichés avant la finalisation de la réservation et rappelés dans la confirmation de réservation.",
        "Avant l'exigibilité du solde, nous vous envoyons un rappel à l'adresse électronique indiquée. À défaut de règlement du solde, le fournisseur peut se retirer du contrat conformément à ses conditions d'annulation.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Devise",
      paragraphs: [
        "Le règlement s'effectue dans la devise de l'annonce. Cette devise est indiquée pour chaque prix et lors du paiement.",
        "Si un montant est en outre affiché dans une autre devise, il s'agit d'une conversion indicative sans valeur contraignante.",
        "Si votre prestataire de services de paiement effectue une conversion dans une autre devise ou prélève des frais à l'étranger, ces coûts sont à votre charge. Ils ne font pas partie du prix total et ne sont ni fixés ni perçus par nous.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Caution",
      paragraphs: [
        "Si l'annonce prévoit une caution, son montant est indiqué avant la finalisation de la réservation.",
        "Selon l'annonce, la caution est préautorisée sur votre moyen de paiement (le montant est réservé mais non débité) ou prélevée. Une préautorisation peut réduire temporairement votre plafond de carte disponible.",
        "Après le séjour, la préautorisation est libérée ou la caution prélevée est remboursée, à moins que le fournisseur ne fasse valoir un dommage. S'il fait valoir un dommage, il doit l'établir ; le bien-fondé de la demande relève de la relation entre vous et le fournisseur.",
        "Si le fournisseur exige la caution sur place, il s'agit d'un poste de frais sur place, non traité via la plateforme.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Remboursements",
      paragraphs: [
        "Les remboursements sont effectués sur le moyen de paiement utilisé, sauf convention contraire ou impossibilité technique.",
        "Nous engageons un remboursement sans délai dès que son motif est établi. Le délai d'apparition du crédit sur votre compte ou votre carte dépend de votre prestataire de services de paiement ; cinq à dix jours ouvrés bancaires sont habituels.",
        "L'existence et l'étendue d'un droit au remboursement résultent des [Conditions d'annulation](https://mybestdays.dk/rechtliches/stornierungsbedingungen) et de la [Politique de relogement et de remboursement](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Paiements échoués et rétrofacturations",
      paragraphs: [
        "En cas d'échec d'un paiement, nous vous en informons et vous donnons la possibilité d'enregistrer un autre moyen de paiement. À défaut de paiement, la réservation peut être annulée.",
        "Si vous rétrofacturez un paiement déjà exécuté sans droit au remboursement, le fournisseur peut continuer à réclamer le montant. Les frais que nous supportons du fait d'une rétrofacturation injustifiée peuvent vous être facturés.",
        "Si nous estimons qu'un paiement est frauduleux, nous pouvons le retenir ou annuler la réservation. Nous vous en informons et motivons la décision.",
      ],
    },
    {
      id: "belege",
      heading: "8. Justificatifs et décomptes",
      paragraphs: [
        "Pour les montants réglés via la plateforme, nous mettons à disposition un justificatif que vous pouvez consulter dans votre compte sous « Réservations ».",
        "La facture de la prestation d'hébergement est établie par le fournisseur ; il est le professionnel prestataire. Sur les taxes, voir la [Politique fiscale](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Modification des présentes conditions de paiement",
      paragraphs: [
        "La section A22 des [Conditions d'utilisation](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen) s'applique aux modifications des présentes conditions de paiement.",
      ],
    },
  ],
};
