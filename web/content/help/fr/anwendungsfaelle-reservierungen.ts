import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Réservations et calendrier",
  description: "Gardez le contrôle sur vos réservations et votre calendrier.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Réservations et calendrier",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Éviter durablement les surréservations",
          excerpt: "Comment garantir qu'un bien ne soit jamais réservé en double.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ",
            },
            {
              type: "p",
              text: "Un bien est vendu simultanément sur plusieurs canaux — des portails tels que Booking, Airbnb & Co., la plateforme propre ainsi que l'application. Une surréservation survient lorsque la disponibilité sur un canal n'est pas bloquée à temps après une réservation effectuée sur un autre canal.",
            },
            {
              type: "steps",
              items: [
                "Vérifiez dans le planning d'occupation que chaque bien correspond exactement à une ligne représentant une unité réservable — jamais une capacité partagée entre plusieurs chambres.",
                "Créez les nouvelles réservations exclusivement via le planning d'occupation ou les canaux connectés, jamais en modifiant manuellement des jours individuels.",
                "Contrôlez après chaque réservation que les nuits réservées apparaissent immédiatement comme occupées dans le calendrier.",
                "En cas de problème technique ou de maintenance, appliquez immédiatement un stop-vente plutôt que de laisser le jour ouvert.",
                "En cas d'ambiguïté, consultez la chronologie de réservation de la réservation concernée pour retracer le déroulement chronologique.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ne modifiez jamais les nuits ou les blocages manuellement en dehors du planning d'occupation — c'est le seul moyen de garantir que tous les canaux voient le même état de disponibilité et qu'aucune brèche ne permette une réservation en double.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Déplacer une réservation vers un autre bien",
          excerpt: "Comment déplacer proprement une réservation existante vers un autre bien.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ",
            },
            {
              type: "p",
              text: "Il arrive qu'un client doive déménager d'un bien vers un autre, par exemple en raison d'un défaut technique ou à la demande du client. Lors du déplacement, les nuits de calendrier précédentes sont automatiquement libérées et réoccupées dans le bien de destination.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez la réservation concernée dans la chronologie de réservation.",
                "Sélectionnez dans le menu d'actions « Changer de bien » ou « Déplacer ».",
                "Choisissez le bien de destination et vérifiez sa disponibilité pour la période sélectionnée.",
                "Confirmez le déplacement.",
                "Vérifiez ensuite dans le planning d'occupation que les anciennes nuits du bien d'origine s'affichent de nouveau comme disponibles.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La libération des anciennes nuits est prise en charge automatiquement par le système — vous n'avez pas besoin d'ouvrir vous-même manuellement la période d'origine. Informez le client du changement de bien, en particulier si les équipements ou l'accès diffèrent.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Créer une réservation longue durée",
          excerpt: "Comment créer correctement une réservation sur une période prolongée.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ",
            },
            {
              type: "p",
              text: "Pour les clients en séjour longue durée — par exemple plusieurs semaines ou mois — vous créez une réservation comme d'habitude, en veillant en plus à la durée de séjour minimale, aux règles de paiement et à la visibilité du bien sur les canaux pendant toute la période.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez le planning d'occupation du bien souhaité et sélectionnez l'intégralité de la période.",
                "Créez la réservation avec les données du client et les dates d'arrivée et de départ prévues.",
                "Configurez si nécessaire une règle de paiement avec acompte et solde, plutôt que d'exiger le montant total immédiatement.",
                "Vérifiez qu'aucune règle de durée de séjour minimale ou maximale ne s'oppose à la période prolongée.",
                "Enregistrez la réservation et contrôlez que l'ensemble de la période apparaît correctement comme occupée dans le calendrier.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Pour les séjours très longs, il est recommandé de fractionner le solde en plusieurs échéances plutôt qu'une seule échéance importante — le risque de paiement reste ainsi maîtrisable. Plus de détails sous [Automatiser le solde](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
