import type { LegalDoc } from "../types";

// Französische Fassung der Gast-AGB. Quelle ist content/legal/agb/de.ts —
// Änderungen immer zuerst dort, dann hier nachziehen.
export const agb: LegalDoc = {
  title: "Conditions d'utilisation pour les voyageurs (CGU)",
  stand: "Dernière mise à jour : 3 juillet 2026",
  intro: [
    "Les présentes conditions d'utilisation régissent l'utilisation du portail de réservation myBestDays (ci-après la « Plateforme ») par les voyageurs et les personnes effectuant une réservation (ci-après le « Voyageur »).",
    "L'exploitant de la Plateforme est [dénomination sociale complète, forme juridique, adresse et données d'immatriculation de l'exploitant — à compléter avant publication] (ci-après « myBestDays » ou « nous »).",
  ],
  sections: [
    {
      heading: "§ 1 Champ d'application",
      paragraphs: [
        "Les présentes conditions s'appliquent à l'utilisation de la Plateforme, en particulier à la recherche d'hébergements et à la réservation de prestations d'hébergement via la Plateforme.",
        "La prestation d'hébergement elle-même est en outre régie par les conditions du prestataire concerné (p. ex. règlement intérieur, conditions d'annulation) indiquées dans l'offre.",
      ],
    },
    {
      heading: "§ 2 Rôle de myBestDays ; conclusion du contrat",
      paragraphs: [
        "myBestDays agit en tant qu'intermédiaire pour des prestations d'hébergement proposées par les prestataires concernés (agences, loueurs ou propriétaires, ci-après le « Prestataire »). Le contrat portant sur l'hébergement est conclu exclusivement entre le Voyageur et le Prestataire concerné. myBestDays ne devient pas partie au contrat d'hébergement.",
        "Le Prestataire concerné est désigné dans l'offre et dans la confirmation de réservation.",
      ],
    },
    {
      heading: "§ 3 Réservation et confirmation de réservation",
      paragraphs: [
        "La présentation des hébergements sur la Plateforme constitue une invitation à soumettre une offre de réservation. En finalisant le processus de réservation (clic sur le bouton de réservation avec obligation de paiement), le Voyageur soumet une offre ferme de conclure un contrat d'hébergement avec le Prestataire.",
        "Le contrat est conclu lorsque la réservation est confirmée. La confirmation de réservation est envoyée au Voyageur à l'adresse e-mail indiquée.",
        "Le Voyageur est tenu de fournir des informations exactes et complètes lors de la réservation (en particulier le nom, les coordonnées et le nombre de voyageurs).",
      ],
    },
    {
      heading: "§ 4 Prix et paiement",
      paragraphs: [
        "Les prix indiqués dans l'offre au moment de la réservation s'appliquent, y compris les taxes, frais et coûts supplémentaires qui y sont indiqués. Les prix sont affichés dans la devise indiquée dans l'offre. Des taxes locales supplémentaires (p. ex. taxe de séjour) peuvent s'appliquer sur place, dans la mesure où cela est indiqué dans l'offre.",
        "Le paiement est traité via le prestataire de services de paiement Stripe. Les données de paiement (p. ex. données de carte) sont collectées et traitées directement par Stripe ; myBestDays ne conserve pas de données de carte complètes. Stripe traite les données personnelles conformément à la [politique de confidentialité de Stripe](https://stripe.com/privacy).",
        "Si une caution est indiquée dans l'offre, elle peut faire l'objet d'une pré-autorisation lors de la réservation ou de l'arrivée et être retenue en tout ou en partie en cas de dommage ; les indications figurant dans l'offre font foi.",
      ],
    },
    {
      heading: "§ 5 Annulation, modification et rétractation",
      paragraphs: [
        "La possibilité d'annuler ou de modifier une réservation sans frais, ainsi que les conditions applicables, sont régies par les conditions d'annulation du Prestataire indiquées dans l'offre.",
        "Pour les prestations d'hébergement réservées pour une période déterminée, il n'existe en règle générale aucun droit de rétractation légal, conformément à l'article 16, point l), de la directive européenne relative aux droits des consommateurs ou aux dispositions nationales correspondantes. Les droits légaux impératifs du Voyageur demeurent inchangés.",
      ],
    },
    {
      heading: "§ 6 Obligations du Voyageur",
      paragraphs: [
        "Le Voyageur utilise l'hébergement conformément au contrat, respecte l'occupation maximale indiquée dans l'offre et observe le règlement intérieur du Prestataire.",
        "La Plateforme ne doit pas être utilisée de manière abusive, en particulier pour des réservations fictives, des paiements frauduleux ou la publication de contenus illicites (p. ex. dans des avis ou des messages).",
      ],
    },
    {
      heading: "§ 7 Responsabilité de myBestDays",
      paragraphs: [
        "Le Prestataire est seul responsable de la fourniture de la prestation d'hébergement. myBestDays ne répond pas de l'exactitude du contenu des offres publiées par les Prestataires, mais assure l'intermédiation et le traitement des paiements avec la diligence d'un commerçant avisé.",
        "myBestDays répond sans limitation en cas de faute intentionnelle et de négligence grave ainsi que des dommages résultant d'une atteinte à la vie, à l'intégrité physique ou à la santé. En cas de négligence simple, myBestDays ne répond que de la violation d'obligations contractuelles essentielles (obligations cardinales), dans la limite du dommage prévisible et typique du contrat. Les règles légales impératives en matière de responsabilité demeurent inchangées.",
      ],
    },
    {
      heading: "§ 8 Protection des données",
      paragraphs: [
        "myBestDays traite les données personnelles du Voyageur aux fins de l'intermédiation et de la réservation. Les données de réservation sont transmises au Prestataire concerné dans la mesure nécessaire à l'exécution du contrat d'hébergement. Le § 4 s'applique au traitement des paiements.",
        "Les modalités sont précisées dans les informations sur la protection des données de la Plateforme.",
      ],
    },
    {
      heading: "§ 9 Réclamations et règlement des litiges",
      paragraphs: [
        "Le Voyageur adresse d'abord ses réclamations concernant l'hébergement au Prestataire ; pour les questions relatives à la réservation ou au paiement, le support de myBestDays est joignable via les canaux de contact indiqués sur la Plateforme.",
        "myBestDays n'est ni tenue ni disposée à participer à une procédure de règlement des litiges devant un organisme de médiation de la consommation, sauf obligation légale.",
      ],
    },
    {
      heading: "§ 10 Modifications des présentes conditions",
      paragraphs: [
        "myBestDays peut modifier les présentes conditions avec effet pour l'avenir dans la mesure où cela est nécessaire pour des motifs valables (en particulier des modifications législatives ou des évolutions de la jurisprudence) et où le Voyageur n'en subit pas de désavantage déraisonnable. Les réservations déjà conclues restent régies par la version en vigueur au moment de la réservation.",
      ],
    },
    {
      heading: "§ 11 Dispositions finales",
      paragraphs: [
        "Le droit de l'État dans lequel l'exploitant a son siège s'applique, à l'exclusion de la Convention des Nations Unies sur les contrats de vente internationale de marchandises. Si le Voyageur est un consommateur, les dispositions impératives de protection des consommateurs de l'État dans lequel il a sa résidence habituelle demeurent inchangées.",
        "Si certaines dispositions des présentes conditions sont ou deviennent invalides, la validité des autres dispositions n'en est pas affectée.",
      ],
    },
  ],
};
