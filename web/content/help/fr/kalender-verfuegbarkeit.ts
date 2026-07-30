import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Calendrier et disponibilité",
  description: "Planning d'occupation, stop-sell et durée minimale de séjour.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Calendrier",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Lire le planning d'occupation",
          excerpt: "Comment interpréter correctement les réservations, la disponibilité et les prix dans le planning d'occupation.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Le planning d'occupation vous montre en un coup d'œil quelles nuits sont réservées, disponibles ou bloquées. Pour les logements de vacances, vous voyez une ligne par hébergement ; pour les hôtels, une vue imbriquée avec une ligne par catégorie de chambre et par plan tarifaire.",
            },
            { type: "h2", text: "Structure de la vue" },
            {
              type: "steps",
              items: [
                "Ouvrez le calendrier via l'élément de menu « Planning d'occupation ».",
                "Sélectionnez en haut la période que vous souhaitez consulter.",
                "Filtrez si besoin par hébergement ou par catégorie de chambre.",
                "Cliquez sur un jour pour ouvrir les détails de prix et de disponibilité.",
                "Cliquez sur une période occupée pour ouvrir la réservation correspondante.",
              ],
            },
            { type: "h2", text: "Couleurs et symboles" },
            {
              type: "ul",
              items: [
                "Occupé : la période est réservée par une réservation.",
                "Disponible : le jour peut être réservé sur tous les canaux actifs.",
                "Bloqué : le jour n'est pas réservable en raison d'un stop-sell ou d'un blocage manuel.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Chaque ligne du planning d'occupation représente exactement une unité réservable — une chambre ou un logement de vacances. Il n'existe pas de ligne conteneur regroupant plusieurs chambres à la fois.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Pour en savoir plus sur l'ouverture et la fermeture ciblées de jours individuels, consultez [Définir la disponibilité](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Définir la disponibilité",
          excerpt: "Ouvrez et fermez des jours ou des périodes de manière ciblée.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "La disponibilité détermine si un hébergement peut être réservé à une date donnée. Vous pouvez ouvrir ou fermer des jours individuels ou des périodes entières, directement dans le planning d'occupation.",
            },
            { type: "h2", text: "Modifier une période" },
            {
              type: "steps",
              items: [
                "Ouvrez le planning d'occupation de l'hébergement souhaité.",
                "Sélectionnez la période souhaitée en cliquant et en faisant glisser.",
                "Choisissez « Modifier la disponibilité » dans le menu d'actions.",
                "Confirmez si la période doit être ouverte ou fermée.",
                "Enregistrez la modification.",
              ],
            },
            { type: "h2", text: "Effet sur les canaux" },
            {
              type: "p",
              text: "Une modification de la disponibilité s'applique à tous les canaux de vente sur lesquels l'hébergement est visible : les portails comme Booking, Airbnb & Co., votre propre plateforme, ainsi que l'application. La transmission aux portails se fait automatiquement en arrière-plan.",
            },
            {
              type: "ul",
              items: [
                "Ouverture : le jour devient réservable sur tous les canaux actifs.",
                "Fermeture : le jour disparaît de la disponibilité à la réservation, mais reste visible dans le calendrier.",
                "Les réservations déjà existantes ne sont pas affectées par une modification de la disponibilité.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ne fermez pas une période dans l'intention de la bloquer complètement et durablement à la vente — c'est la fonction stop-sell qui est adaptée à cet usage, voir [Stop-sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-sell",
          excerpt: "Le stop-sell bloque un jour immédiatement sur tous les canaux de vente à la fois.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Le stop-sell est le moyen le plus rapide de retirer complètement un jour de la vente. Contrairement à une simple modification de disponibilité, le stop-sell agit de façon stricte et immédiate sur tous les canaux à la fois — sur les portails, votre propre plateforme et dans l'application.",
            },
            { type: "h2", text: "Activer le stop-sell" },
            {
              type: "steps",
              items: [
                "Ouvrez le planning d'occupation de l'hébergement concerné.",
                "Sélectionnez le jour ou la période souhaité.",
                "Cliquez sur « Activer le stop-sell » dans le menu d'actions.",
                "Confirmez le blocage.",
              ],
            },
            { type: "h2", text: "Quand utiliser le stop-sell" },
            {
              type: "ul",
              items: [
                "Travaux de maintenance à court terme ou problèmes techniques dans l'hébergement.",
                "Un cas particulier où vous ne voulez aucune nouvelle réservation, immédiatement et sans exception.",
                "Un blocage d'urgence rapide sur l'ensemble de la plateforme, sans avoir à traiter chaque canal séparément.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Le stop-sell ne connaît aucune exception spécifique à un canal : si un jour est bloqué, aucun voyageur ne peut réserver, quel que soit le canal, pas même via la réception ou une demande directe.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pour un usage personnel durable ou une maintenance planifiée, utilisez plutôt le [Blocage manuel](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung).",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Durée de séjour minimale et maximale",
          excerpt: "Pendant combien de temps, au minimum ou au maximum, les voyageurs peuvent réserver.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "La durée de séjour minimale et maximale vous permet de définir combien de nuits un voyageur peut réserver, au minimum ou au maximum, pour une date d'arrivée donnée. Cela aide à éviter les courtes réservations qui créent des trous dans le planning, ou à positionner votre hébergement pour des séjours plus longs.",
            },
            { type: "h2", text: "Configurer une règle" },
            {
              type: "steps",
              items: [
                "Dans l'hébergement, ouvrez le planning d'occupation ou l'onglet « Tarifs ».",
                "Sélectionnez la période concernée.",
                "Saisissez le nombre minimal de nuits sous « Durée de séjour minimale ».",
                "Saisissez éventuellement un nombre maximal de nuits sous « Durée de séjour maximale ».",
                "Enregistrez la règle.",
              ],
            },
            { type: "h2", text: "Cas d'usage typiques" },
            {
              type: "ul",
              items: [
                "Haute saison : durée minimale plus longue pour regrouper les jours de changement.",
                "Basse saison : durée minimale plus courte pour permettre davantage de réservations.",
                "Durée maximale : utile lorsque l'hébergement doit ensuite être libre pour une maintenance ou un autre usage.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La règle s'applique à la date d'arrivée : un voyageur ne peut pas arriver pour seulement deux nuits un jour où la durée de séjour minimale est de trois nuits, même si les jours pris individuellement sont disponibles.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Combinez des durées de séjour minimales plus longues avec les [Remises de séjour](/hilfe/preise-raten/aufenthaltsrabatte) pour renforcer l'incitation pour les voyageurs.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Blocage manuel",
          excerpt: "Réservez volontairement des périodes pour un usage personnel ou une maintenance.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Un blocage manuel réserve une période dans le calendrier sans qu'il y ait de réservation réelle de voyageur — par exemple pour un usage personnel, des travaux de maintenance planifiés ou des rénovations. La période s'affiche dans le planning d'occupation comme une réservation, mais est clairement identifiable comme un blocage.",
            },
            { type: "h2", text: "Créer un blocage" },
            {
              type: "steps",
              items: [
                "Ouvrez le planning d'occupation de l'hébergement concerné.",
                "Sélectionnez la période souhaitée.",
                "Choisissez « Bloquer manuellement » dans le menu d'actions.",
                "Indiquez un motif, par exemple « Usage personnel » ou « Maintenance ».",
                "Enregistrez le blocage.",
              ],
            },
            { type: "h2", text: "Différence avec le stop-sell" },
            {
              type: "p",
              text: "Un blocage manuel réserve concrètement une période pour un motif précis et documenté, et peut être levé plus tard. Le stop-sell, lui, est conçu pour un blocage d'urgence immédiat sur l'ensemble de la plateforme, sans période documentée.",
            },
            {
              type: "ul",
              items: [
                "Blocage manuel : planifié, avec motif, pour un usage personnel ou une maintenance.",
                "Levée possible à tout moment, dès que la période n'est plus nécessaire.",
                "Les nuits bloquées ne comptent pas comme une réservation de voyageur et n'apparaissent pas dans le récapitulatif des revenus.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Supprimez un blocage manuel dès que le motif n'est plus valable — sinon l'hébergement reste inutilement bloqué sur tous les canaux.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pour un blocage immédiat sans période planifiée, utilisez le [Stop-sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
