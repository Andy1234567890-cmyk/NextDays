import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Gestionnaire de canaux",
  description: "Maîtriser les portails et le gestionnaire de canaux.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Gestionnaire de canaux",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Connecter votre premier portail",
          excerpt: "Comment activer un portail pour un bien pour la première fois.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ : vous avez créé un bien, mais aucun portail n'est encore connecté",
            },
            {
              type: "p",
              text: "Votre bien est entièrement configuré dans myNextDays, mais n'est encore visible sur aucun portail tel que Booking.com ou Airbnb. Avant qu'un portail n'accepte un bien, votre compte a besoin, une seule fois, d'une connexion aux portails valable pour tout le compte — ensuite, un simple mapping suffit pour chaque bien supplémentaire.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez /konto, section « Portails & gestionnaire de canaux », et configurez la connexion valable pour tout le compte avec les données de votre établissement",
                "Ouvrez ensuite le bien sous /objekte et passez à l'onglet « Portails »",
                "Sélectionnez le portail souhaité et associez-le au type de chambre ou d'offre correspondant",
                "Vérifiez les photos, les équipements, les prix et les conditions d'annulation — les portails exigent des informations complètes",
                "Activez la visibilité ; le statut passe à « Connecté » après vérification par le portail",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vous ne configurez la connexion valable pour tout le compte qu'une seule fois. Plus de détails sous [Connecter Booking.com](/hilfe/portale-kanalmanager/booking-verbinden) et [Connecter Airbnb](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Connecter Booking.com",
          excerpt: "Comment rendre un bien réservable sur Booking.com via le gestionnaire de canaux.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ : votre bien doit également devenir visible sur Booking.com",
            },
            {
              type: "p",
              text: "Booking.com est l'un des portails connectés via le gestionnaire de canaux. La condition préalable est la connexion aux portails valable pour tout le compte — si celle-ci est déjà configurée, il ne vous reste plus qu'à créer un mapping par bien pour Booking.com.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez le bien sous /objekte, onglet « Portails »",
                "Sélectionnez « Booking.com » dans la liste des portails disponibles",
                "Associez le type de chambre ou d'offre correspondant et confirmez au moins un tarif avec prix et conditions d'annulation",
                "Renseignez un moyen de paiement valide pour la facturation des commissions",
                "Activez la visibilité pour Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La validation par Booking.com peut prendre quelques heures. Le statut dans l'onglet « Portails » s'affiche dès que la connexion est active.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Connecter Airbnb",
          excerpt: "Comment rendre un bien réservable sur Airbnb via le gestionnaire de canaux.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ : votre bien doit également devenir visible sur Airbnb",
            },
            {
              type: "p",
              text: "Airbnb est connecté comme tout autre portail via la connexion valable pour tout le compte. Une fois celle-ci configurée, vous activez Airbnb par bien via un mapping — indépendamment du fait que le bien soit déjà visible sur Booking.com ou d'autres portails.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez le bien sous /objekte, onglet « Portails »",
                "Sélectionnez « Airbnb » dans la liste des portails disponibles",
                "Confirmez la catégorie du bien et le type d'offre associé",
                "Complétez les photos, les équipements et le règlement intérieur — Airbnb exige des informations complètes avant la validation",
                "Activez la visibilité pour Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Sans conditions d'annulation et règlement intérieur renseignés, Airbnb refuse la validation. Complétez d'abord ces informations dans le bien.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Synchroniser les prix sur tous les portails",
          excerpt: "Un seul calendrier suffit — le gestionnaire de canaux diffuse automatiquement les changements de prix à tous les portails.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ : vous modifiez un prix et souhaitez vous assurer qu'il est correct partout",
            },
            {
              type: "p",
              text: "Vous gérez les prix exclusivement dans le calendrier myNextDays du bien — jamais individuellement dans les portails eux-mêmes. Le gestionnaire de canaux transmet automatiquement chaque modification à tous les portails pour lesquels le bien dispose d'un mapping actif.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez le calendrier des prix ou les plans tarifaires du bien",
                "Ajustez le prix journalier, la durée de séjour minimale ou les restrictions d'arrivée/de départ",
                "Enregistrez la modification — elle s'applique d'abord en interne dans le bien",
                "Vérifiez dans l'onglet « Portails » que tous les portails souhaités disposent toujours d'un mapping actif",
                "Patientez quelques minutes le temps que la modification soit transmise aux portails",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Ne saisissez jamais de prix directement dans le portail — ce type de modification sera écrasé par le calendrier myNextDays lors de la prochaine synchronisation.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Importer une réservation issue d'un portail",
          excerpt: "Les réservations issues des portails arrivent automatiquement dans le calendrier — voici comment vérifier que l'import a fonctionné.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ : un client a réservé via un portail, la réservation doit arriver dans myNextDays",
            },
            {
              type: "p",
              text: "Lorsqu'un client réserve via Booking.com, Airbnb ou un autre portail connecté, le gestionnaire de canaux importe automatiquement la réservation — vous n'avez rien à transférer manuellement. Cette procédure décrit comment suivre et confirmer l'import.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez le calendrier ou la liste des réservations du bien concerné",
                "Recherchez la nouvelle réservation — elle porte un badge d'origine indiquant le portail, par exemple Booking.com ou Airbnb",
                "Vérifiez que les données du client, la période et le prix sont complets",
                "Contrôlez que les nuits réservées apparaissent comme bloquées sur tous les autres canaux",
                "Ouvrez si nécessaire les détails de la réservation pour traiter les prestations complémentaires ou les messages du client",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Si le client annule via le portail ou modifie la période, cela est également repris automatiquement et les nuits sont de nouveau libérées.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Résoudre une réservation en double",
          excerpt: "Comment procéder lorsque, exceptionnellement, la même nuit a été vendue sur deux canaux.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ : deux réservations se chevauchent pour le même bien et les mêmes nuits",
            },
            {
              type: "p",
              text: "Le gestionnaire de canaux bloque normalement les nuits réservées immédiatement sur tous les canaux. Une réservation en double peut néanmoins survenir, par exemple lors de réservations simultanées sur deux portails au même moment, ou lors d'une réservation créée manuellement qui entre en conflit avec une réservation issue d'un portail.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez le calendrier du bien et identifiez les deux réservations qui se chevauchent",
                "Vérifiez l'heure de réservation et le badge d'origine des deux réservations",
                "Contactez le client dont la réservation est arrivée en dernier et proposez-lui un bien de remplacement ou une période alternative",
                "Annulez la réservation intenable dans le portail concerné, pas seulement dans myNextDays",
                "Appliquez ensuite un stop-vente pour les nuits concernées jusqu'à ce que le cas soit entièrement résolu",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Annulez toujours une réservation issue d'un portail via le portail lui-même — une annulation effectuée uniquement dans myNextDays libère certes la nuit en interne, mais n'informe pas le portail de manière fiable.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Mettre un portail en pause temporairement",
          excerpt: "Désactivez la visibilité portail par portail sans perdre le mapping.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ : un bien doit temporairement ne plus être réservable sur un portail",
            },
            {
              type: "p",
              text: "La visibilité est activable individuellement par portail — indépendamment du site web et du marketplace de la plateforme. Si vous souhaitez par exemple mettre Airbnb en pause temporairement tout en laissant Booking.com actif, désactivez exclusivement ce seul canal.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez le bien sous /objekte, onglet « Portails »",
                "Recherchez l'entrée du portail que vous souhaitez mettre en pause",
                "Désactivez la visibilité pour ce portail",
                "Enregistrez — la modification prend effet en quelques minutes, le bien disparaît des résultats de recherche de ce portail",
                "Réactivez la visibilité dès que le bien doit redevenir réservable",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Le mapping est conservé lors de la mise en pause — vous n'aurez pas à recréer l'association avec le portail par la suite. Pour bloquer complètement tous les canaux, utilisez plutôt le stop-vente.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Vérifier le mapping du bien",
          excerpt: "Comment vérifier que votre bien est toujours correctement associé au bon type d'offre dans le portail.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ : les prix ou la disponibilité sur un portail ne correspondent plus à myNextDays",
            },
            {
              type: "p",
              text: "Si l'affichage dans le portail diverge de votre calendrier myNextDays, la cause est souvent un mapping incorrect ou interrompu — le lien entre votre bien et le type de chambre ou d'offre dans le portail.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez le bien sous /objekte, onglet « Portails »",
                "Vérifiez le statut du portail concerné — il devrait afficher « Connecté », et non « Erreur » ou « En attente »",
                "Contrôlez si le type de chambre ou d'offre associé dans le portail correspond toujours au bien réel",
                "En cas d'écart : supprimez le mapping puis recréez-le, avant de réactiver la visibilité",
                "Après la correction, patientez quelques minutes puis revérifiez les prix et la disponibilité dans le portail",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Un bien peut être associé à plusieurs portails simultanément — en cas d'incohérence, vérifiez spécifiquement le portail concerné, et non tous en même temps.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Des tarifs différents par portail",
          excerpt: "Comment attribuer un plan tarifaire propre à un portail sans influencer les autres canaux.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ : vous souhaitez proposer sur un portail un prix différent de celui des autres canaux",
            },
            {
              type: "p",
              text: "Les plans tarifaires peuvent être associés individuellement à chaque portail, par exemple un plan non remboursable pour un portail et un plan flexible pour un autre. Les prix de base restent gérés de manière centralisée dans le bien, le mapping détermine quel plan tarifaire est envoyé à quel portail.",
            },
            {
              type: "steps",
              items: [
                "Créez dans le bien le plan tarifaire supplémentaire avec les conditions souhaitées (prix, conditions d'annulation, durée de séjour minimale)",
                "Ouvrez l'onglet « Portails » et sélectionnez le portail concerné",
                "Associez dans le mapping le nouveau plan tarifaire à ce portail",
                "Laissez les autres portails inchangés sur leur plan tarifaire actuel",
                "Enregistrez et vérifiez après quelques minutes l'affichage des prix dans le portail concerné",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Chaque plan tarifaire est transmis indépendamment — une modification apportée à un plan tarifaire n'affecte pas les portails associés à un autre plan tarifaire.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Résoudre les erreurs de portail fréquentes",
          excerpt: "Causes fréquentes lorsqu'un portail refuse un bien ou que la synchronisation se bloque.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ : le statut d'un portail affiche une erreur ou le bien n'est pas repris",
            },
            {
              type: "p",
              text: "Les portails refusent généralement une connexion en raison de données de base manquantes ou d'informations incomplètes sur le bien. Passez en revue les causes les plus fréquentes avant de contacter le support.",
            },
            {
              type: "steps",
              items: [
                "Vérifiez sous /konto que l'adresse, les informations fiscales et les coordonnées sont entièrement renseignées",
                "Contrôlez dans le bien que la description, les photos, les équipements et au moins un tarif sont complets",
                "Vérifiez qu'un moyen de paiement valide est renseigné pour les commissions",
                "Ouvrez l'onglet « Portails » et lisez le message d'erreur précis à côté du portail concerné",
                "Corrigez le manque signalé et réactivez la visibilité",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Une erreur de portail ne concerne toujours que ce seul portail — les autres canaux continuent de fonctionner indépendamment, tant que leurs propres exigences sont remplies.",
            },
          ],
        },
      ],
    },
  ],
};
