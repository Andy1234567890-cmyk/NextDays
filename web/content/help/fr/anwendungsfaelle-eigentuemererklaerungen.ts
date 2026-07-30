import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Relevés propriétaires",
  description: "Créer des relevés propriétaires.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Relevés propriétaires",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Générer un relevé propriétaire",
          excerpt: "Comment créer pour un propriétaire un décompte clair de sa période.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ",
            },
            {
              type: "p",
              text: "Si vous gérez des objets pour des propriétaires, ceux-ci ont régulièrement besoin d'une vue d'ensemble claire des revenus, de la commission déduite et du versement de leurs objets pour une période donnée — le relevé propriétaire rassemble automatiquement ces données.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez la section Propriétaires dans le compte et sélectionnez le propriétaire concerné.",
                "Choisissez la période de facturation pour laquelle le relevé doit être créé.",
                "Vérifiez que tous les objets de ce propriétaire sont correctement rattachés, car seuls les objets rattachés sont intégrés au relevé.",
                "Faites générer le relevé et contrôlez que les réservations listées sont complètes.",
                "Mettez le relevé à disposition du propriétaire via son accès propriétaire ou exportez-le sous forme de document.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Le relevé affiche chaque réservation avec son montant dans la devise de l'objet concerné — il n'y a pas d'indication de devise globale, car plusieurs objets peuvent aussi avoir des devises différentes. Plus d'informations sur le rattachement dans [Rattacher un objet à un propriétaire](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Décompter la commission avec le propriétaire",
          excerpt: "Comment vous assurer que votre commission est correctement calculée sur les revenus du propriétaire.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ",
            },
            {
              type: "p",
              text: "Votre commission pour la gestion d'un objet est définie dans le tarif du propriétaire et est automatiquement déduite des revenus bruts à chaque relevé. Pour que le décompte soit exact, le taux de commission doit être correctement défini avant la première réservation de la période.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez le tarif du propriétaire concerné dans le compte et vérifiez le taux de commission défini.",
                "Ajustez le taux si nécessaire avant que de nouvelles réservations n'arrivent pour la prochaine période de facturation.",
                "Générez le relevé propriétaire pour la période et vérifiez que la commission est correctement indiquée pour chaque réservation.",
                "Contrôlez la cohérence entre revenus bruts, commission déduite et versement net.",
                "En cas d'écart, clarifiez la situation directement avec le propriétaire avant validation du relevé, plutôt que de modifier le relevé a posteriori.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Une modification ultérieure du taux de commission ne s'applique qu'aux périodes futures, pas rétroactivement aux relevés déjà générés. Vérifiez donc le taux suffisamment tôt avant le début d'une nouvelle période de facturation — voir aussi [Décompte propriétaire (relevé)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
