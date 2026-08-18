import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Conditions d'annulation",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "Chaque fournisseur choisit une condition d'annulation pour son hébergement. Celle qui s'applique figure dans l'annonce et dans votre confirmation de réservation. La présente page décrit les conditions que nous proposons aux fournisseurs.",
  ],
  sections: [
    {
      id: "modelle",
      heading: "1. Les conditions d'annulation en un coup d'œil",
      paragraphs: [
        "La condition indiquée dans l'annonce fait toujours foi. Les délais se rapportent au début du jour d'arrivée, heure locale de l'hébergement.",
      ],
      list: [
        "Flexible — annulation sans frais jusqu'à 24 heures avant l'arrivée. Ensuite, la première nuit est facturée, les autres nuits sont remboursées.",
        "Modérée — annulation sans frais jusqu'à 5 jours avant l'arrivée. Ensuite, 50 % du prix des nuitées est facturé.",
        "Stricte — annulation sans frais jusqu'à 14 jours avant l'arrivée, à condition que la réservation ait été effectuée au moins 14 jours avant l'arrivée. Ensuite, 50 % sont facturés jusqu'à 7 jours avant l'arrivée, puis le prix intégral.",
        "Non remboursable — pas d'annulation sans frais. Le prix est en règle générale inférieur ; nous attirons spécialement votre attention sur l'absence de remboursement avant la réservation.",
      ],
    },
    {
      id: "was-erstattet-wird",
      heading: "2. Ce qui est remboursé dans tous les cas",
      paragraphs: [
        "Quelle que soit la condition choisie, nous remboursons pour toute annulation :",
      ],
      list: [
        "la taxe de séjour et les autres redevances de transit, dans la mesure où elles ont été réglées via la plateforme et où la nuitée n'a pas lieu ;",
        "une caution prélevée via la plateforme, intégralement ;",
        "les prestations complémentaires non fournies.",
      ],
    },
    {
      id: "stornierung-durch-anbieter",
      heading: "3. Annulation par le fournisseur",
      paragraphs: [
        "Si le fournisseur annule, vous récupérez intégralement le montant réglé via la plateforme — quelle que soit la condition d'annulation choisie.",
        "Nous vous aidons en outre à trouver un hébergement comparable ; voir [Politique de relogement et de remboursement](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "widerruf",
      heading: "4. Absence de droit de rétractation légal",
      paragraphs: [
        "Pour les prestations d'hébergement réservées pour une période déterminée, il n'existe en règle générale pas de droit de rétractation légal au titre de l'article 16, point l), de la directive 2011/83/UE. Les conditions d'annulation décrites ici constituent donc un engagement contractuel et non la mise en œuvre d'un droit de rétractation.",
        "Les droits légaux impératifs, notamment les droits en cas de défaut de l'hébergement, ne sont pas affectés.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Modification au lieu d'annulation",
      paragraphs: [
        "Si vous souhaitez modifier la période ou le nombre de voyageurs, demandez la modification depuis votre réservation. Le fournisseur doit l'accepter ; jusque-là, la réservation initiale demeure.",
        "Si la modification entraîne un prix supérieur, la différence devient exigible. Si elle entraîne un prix inférieur, nous remboursons la différence dans la mesure où la condition d'annulation applicable le permet pour la partie supprimée.",
      ],
    },
    {
      id: "wie",
      heading: "6. Comment annuler",
      paragraphs: [
        "Annulez depuis votre compte, rubrique « Réservations ». Le moment déterminant pour le délai est celui où l'annulation nous parvient.",
        "Vous recevez une confirmation d'annulation indiquant le montant du remboursement. Sur le versement, voir les [Conditions de paiement](https://mybestdays.dk/rechtliches/zahlungsbedingungen#rueckerstattungen).",
      ],
    },
  ],
};
