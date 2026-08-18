import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politique en cas de perturbations graves",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "Il arrive qu'un événement empêche le voyage ou le séjour sans que le voyageur ni le fournisseur n'y soient pour quelque chose. La présente politique décrit quels sont ces événements et ce qui s'applique alors.",
    "Elle prévaut sur la condition d'annulation choisie dans l'annonce.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Quels événements sont couverts",
      paragraphs: [
        "Sont couverts les événements survenant après la réservation, imprévisibles pour les deux parties et rendant le voyage ou le séjour impossible ou juridiquement inadmissible :",
      ],
      list: [
        "interdictions administratives de voyage ou de séjour, couvre-feux et fermetures de frontières concernant la destination ou le lieu de départ ;",
        "catastrophes et phénomènes naturels frappant la destination — séisme, inondation, tempête, incendie majeur, éruption volcanique ;",
        "guerre, conflits armés, attentats terroristes et troubles à la destination ;",
        "une épidémie ou pandémie constatée par les autorités, assortie de mesures interdisant le séjour ;",
        "la défaillance prolongée de l'approvisionnement en électricité, en eau ou en chauffage à la destination ;",
        "la disparition totale de la possibilité de rejoindre la destination du fait de l'un des événements précités.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Quels événements ne sont pas couverts",
      paragraphs: ["Ne sont notamment pas couverts :"],
      list: [
        "la maladie ou la blessure du voyageur ou de ses proches — une assurance voyage est prévue à cet effet ;",
        "un empêchement professionnel, des dates d'examen ou la suppression de congés ;",
        "l'annulation d'une manifestation pour laquelle le voyage avait été réservé, si l'hébergement demeure utilisable ;",
        "la météo ne constituant pas une catastrophe naturelle — pluie, froid, chaleur, absence de neige ;",
        "la défaillance de moyens de transport isolés, tant qu'un acheminement raisonnable reste possible ;",
        "l'annulation d'un vol ou une grève chez un transporteur — des droits existent alors à l'encontre du transporteur.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Ce qui s'applique lorsqu'un événement couvert survient",
      paragraphs: [
        "Si l'événement affecte la période de votre réservation, vous pouvez annuler sans frais. Vous obtenez le remboursement intégral du montant réglé via la plateforme.",
        "Si le séjour a déjà commencé, nous remboursons la part correspondant aux nuits qui ne peuvent plus être utilisées.",
        "Une telle annulation n'entraîne aucun désavantage pour le fournisseur dans l'appréciation de sa fiabilité.",
        "Vous pouvez également convenir d'un report avec le fournisseur ; nous aidons au relogement.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Comment vous en prévaloir",
      paragraphs: [
        "Contactez-nous par les voies indiquées sous [Réclamations et règlement des litiges](https://mybestdays.dk/rechtliches/beschwerden) en précisant le numéro de réservation et l'événement.",
        "Nous vérifions sur la base de sources accessibles au public — décisions administratives, avertissements officiels, informations de sources d'actualité reconnues — et décidons rapidement.",
        "Si la situation ne peut encore être appréciée définitivement, nous attendons l'évolution jusqu'à peu avant le jour d'arrivée puis décidons. Votre réservation demeure inchangée jusque-là.",
      ],
    },
  ],
};
