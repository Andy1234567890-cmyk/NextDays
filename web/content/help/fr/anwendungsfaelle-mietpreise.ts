import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Prix de location",
  description: "Fixer les prix de location de manière optimale.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Prix de location",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Optimiser les prix pour la haute saison",
          excerpt: "Comment augmenter vos prix de manière ciblée pour les périodes à forte demande.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ",
            },
            {
              type: "p",
              text: "En haute saison, la demande augmente nettement, alors que votre prix de base reste identique au reste de l'année. Sans ajustement saisonnier, vous laissez passer du chiffre d'affaires pendant la période la plus forte de l'année — l'ajustement se fait via le plan tarifaire de votre objet, et non en modifiant manuellement chaque jour.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez le plan tarifaire de l'objet concerné et créez une règle saisonnière pour la période souhaitée.",
                "Définissez la majoration en pourcentage ou en montant fixe au-dessus du prix de base — le plan tarifaire reprend automatiquement la devise de l'objet.",
                "Vérifiez dans le calendrier que le nouveau prix s'affiche correctement pour la période de haute saison avant de l'activer.",
                "Contrôlez la durée de séjour minimale pour la haute saison — une durée de réservation minimale plus élevée est souvent judicieuse pour garder une occupation prévisible.",
                "Après l'activation, observez les réservations pendant les premiers jours et ajustez la majoration si nécessaire.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Une règle saisonnière s'applique de la même façon sur tous les canaux : portails, plateforme et site web. Pour plus de détails sur la structure des règles, consultez [Plans tarifaires](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Encourager les séjours plus longs avec une réduction",
          excerpt: "Comment récompenser les clients pour des séjours plus longs et réduire les rotations.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ",
            },
            {
              type: "p",
              text: "Des séjours courts signifient plus d'arrivées et de départs, plus de nettoyages et un risque de vacance accru entre les réservations. Une réduction dégressive selon la durée du séjour rend les réservations plus longues plus attractives pour les clients et réduit sensiblement cette charge.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez le plan tarifaire de l'objet et créez une réduction liée à la durée de séjour.",
                "Définissez au moins un palier, par exemple à partir de 7 nuits ou à partir de 28 nuits, avec le taux de réduction correspondant.",
                "Vérifiez que les paliers ne se chevauchent pas et que la réduction ne s'applique qu'à partir de la durée minimale respective.",
                "Testez une réservation exemple dans le calendrier au-delà du seuil de réduction, pour confirmer la bonne application.",
                "Activez la réduction et observez son effet sur la durée de séjour moyenne et le taux d'occupation.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Les réductions liées à la durée de séjour peuvent être combinées avec des règles saisonnières — le plan tarifaire calcule les deux ajustements ensemble. Pour en savoir plus, consultez [Plans tarifaires](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
