import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portails & gestionnaire de canaux",
  description: "Pilotez Booking, Airbnb, Expedia & Co. depuis un seul endroit.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Connecter les portails",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Qu'est-ce que le gestionnaire de canaux ?",
          excerpt:
            "Le gestionnaire de canaux synchronise automatiquement les prix, la disponibilité et les réservations entre myNextDays et les portails.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Une connexion pour tous les portails" },
            {
              type: "p",
              text: "Le gestionnaire de canaux est le pont entre myNextDays et les grands portails de réservation comme Booking, Airbnb & Co. Plutôt que de gérer séparément les prix, la disponibilité et l'occupation dans chaque portail, vous saisissez tout une seule fois dans myNextDays — le gestionnaire de canaux le diffuse ensuite automatiquement vers tous les portails connectés.",
            },
            { type: "h2", text: "Ce qui est synchronisé automatiquement" },
            {
              type: "ul",
              items: [
                "Disponibilité — chaque réservation bloque immédiatement la nuit sur tous les portails",
                "Prix et durées de séjour minimales issus de votre calendrier tarifaire",
                "Les réservations entrantes des portails sont automatiquement importées dans myNextDays",
                "Les annulations et le stop-vente s'appliquent à tous les canaux",
              ],
            },
            { type: "h2", text: "Ce que vous n'avez plus à faire manuellement" },
            {
              type: "p",
              text: "Sans gestionnaire de canaux, vous devriez bloquer manuellement la nuit dans chaque portail après chaque réservation — une cause fréquente de surréservations. Avec le gestionnaire de canaux actif, myNextDays effectue cette synchronisation dans les deux sens, plusieurs fois par jour et en temps réel dès qu'une nouvelle réservation arrive.",
            },
            {
              type: "note",
              variant: "info",
              text: "La connexion aux portails est configurée une seule fois pour l'ensemble du compte. Pour chaque objet, vous activez ensuite uniquement le mappage — voir [Associer un objet à un portail](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Configurer la connexion aux portails",
          excerpt:
            "La connexion aux portails se configure une seule fois pour tout le compte — pas à nouveau pour chaque objet.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Une seule fois pour tout le compte" },
            {
              type: "p",
              text: "La connexion aux portails est un paramètre valable pour l'ensemble du compte : vous connectez votre compte myNextDays une seule fois au gestionnaire de canaux. Tous les objets que vous créez ensuite utilisent automatiquement cette connexion — vous n'avez pas besoin de la reconfigurer à chaque objet.",
            },
            { type: "h2", text: "Comment configurer la connexion" },
            {
              type: "steps",
              items: [
                "Ouvrez /konto et sélectionnez la section « Portails & gestionnaire de canaux »",
                "Cliquez sur « Configurer la connexion » et confirmez les données de votre établissement (adresse, contact, forme juridique)",
                "Vérifiez les données de base reprises automatiquement — elles seront transmises à tous les portails",
                "Terminez la configuration ; le statut passe à « Connecté »",
              ],
            },
            { type: "h2", text: "Étape suivante : associer les objets" },
            {
              type: "p",
              text: "Après cette configuration unique, aucun objet n'est encore visible — pour cela, vous associez chaque objet individuellement à un portail (mappage) et connectez les portails souhaités comme Booking.com ou Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Sans données de base complètes (adresse, informations fiscales, contact), les portails refusent la connexion. Vérifiez d'abord ces informations dans /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Associer un objet à un portail",
          excerpt:
            "Une fois la connexion établie pour tout le compte, il ne reste plus qu'à activer le mappage de chaque objet vers le portail concerné.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Un mappage plutôt qu'une nouvelle connexion" },
            {
              type: "p",
              text: "Une fois la connexion aux portails établie pour l'ensemble du compte, vous connectez chaque objet uniquement via ce qu'on appelle un mappage : vous définissez quel objet myNextDays correspond à quel type de chambre ou d'offre dans le portail. C'est une étape unique par objet.",
            },
            { type: "h2", text: "Comment associer un objet" },
            {
              type: "steps",
              items: [
                "Ouvrez l'objet dans /objekte et passez à l'onglet « Portails »",
                "Choisissez le portail souhaité, par exemple Booking.com ou Airbnb",
                "Associez l'objet au type de chambre ou d'offre correspondant dans le portail",
                "Activez la synchronisation — les prix et la disponibilité sont transmis dès maintenant",
              ],
            },
            { type: "h2", text: "Un objet, plusieurs portails" },
            {
              type: "p",
              text: "Un même objet peut être associé à plusieurs portails en même temps. Chaque association est indépendante — vous pouvez par exemple rendre un objet visible sur Booking.com et Airbnb, tout en le laissant désactivé pour l'instant sur Expedia.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Après le mappage, vérifiez directement la visibilité — voir [Visibilité par portail](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Connecter Booking.com",
          excerpt: "Comment activer Booking.com comme canal de vente pour un objet.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Condition préalable : la connexion pour tout le compte" },
            {
              type: "p",
              text: "Avant d'activer Booking.com pour un objet, la connexion aux portails doit être configurée pour l'ensemble du compte (voir [Configurer la connexion aux portails](/hilfe/portale-kanalmanager/portal-verbindung)). Ensuite, Booking.com n'est plus qu'une question de mappage pour chaque objet supplémentaire.",
            },
            { type: "h2", text: "Activer Booking.com" },
            {
              type: "steps",
              items: [
                "Ouvrez l'objet dans /objekte, onglet « Portails »",
                "Choisissez « Booking.com » dans la liste des portails disponibles",
                "Associez le type de chambre ou d'offre correspondant et confirmez les plans tarifaires",
                "Activez la visibilité — l'objet sera mis en ligne après vérification par Booking.com",
              ],
            },
            { type: "h2", text: "Ce que Booking.com attend de vous" },
            {
              type: "ul",
              items: [
                "Une description complète de l'objet, des photos et les équipements",
                "Au moins un tarif avec prix et conditions d'annulation",
                "Un mode de paiement valide pour les commissions",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La validation par Booking.com peut prendre quelques heures. Le statut dans l'onglet « Portails » de l'objet indique si la connexion est déjà active.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Connecter Airbnb",
          excerpt: "Comment rendre un objet réservable sur Airbnb via le gestionnaire de canaux.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Airbnb comme portail supplémentaire" },
            {
              type: "p",
              text: "Airbnb se connecte comme tout autre portail via la connexion établie pour l'ensemble du compte. Une fois celle-ci en place, vous activez Airbnb pour chaque objet via le mappage — que l'objet soit déjà visible ou non sur Booking.com ou d'autres portails.",
            },
            { type: "h2", text: "Activer Airbnb pour un objet" },
            {
              type: "steps",
              items: [
                "Ouvrez l'objet dans /objekte, onglet « Portails »",
                "Choisissez « Airbnb » dans la liste des portails disponibles",
                "Confirmez la catégorie de l'objet et le type d'offre associé",
                "Vérifiez les photos, les équipements et le règlement intérieur — Airbnb exige des informations complètes avant la validation",
                "Activez la visibilité pour Airbnb",
              ],
            },
            { type: "h2", text: "Après l'activation" },
            {
              type: "p",
              text: "Dès qu'Airbnb a validé l'objet, les prix et la disponibilité passent automatiquement par le gestionnaire de canaux. Les réservations reçues sur Airbnb apparaissent ensuite automatiquement dans votre calendrier de réservations.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Sans conditions d'annulation et règlement intérieur renseignés, Airbnb refuse la validation. Complétez d'abord ces informations dans l'objet.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Synchroniser prix & disponibilité",
          excerpt:
            "Les prix et la disponibilité sont automatiquement transmis à tous les portails connectés.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Un calendrier, tous les portails" },
            {
              type: "p",
              text: "Vous gérez les prix et la disponibilité exclusivement dans le calendrier myNextDays de l'objet concerné. Le gestionnaire de canaux transmet automatiquement chaque modification à tous les portails auxquels l'objet est activement mappé — sans double saisie de votre part.",
            },
            { type: "h2", text: "Ce qui est transmis" },
            {
              type: "ul",
              items: [
                "Les prix journaliers issus de votre calendrier tarifaire ou des plans tarifaires",
                "Les nuits disponibles et les blocages",
                "La durée de séjour minimale et les restrictions d'arrivée/de départ",
                "Les jours en stop-vente — ils se bloquent automatiquement sur tous les portails",
              ],
            },
            { type: "h2", text: "Rapidité de la synchronisation" },
            {
              type: "p",
              text: "Les modifications de prix et de disponibilité sont transmises aux portails en quelques minutes. Les nouvelles réservations bloquent immédiatement les nuits concernées, afin qu'aucun autre canal ne puisse revendre la même nuit.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Pour en savoir plus sur le blocage de jours à travers tous les canaux, voir [Éviter les surréservations](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Recevoir les réservations des portails",
          excerpt: "Les réservations issues de Booking, Airbnb & Co. arrivent automatiquement dans votre calendrier.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Importation automatique" },
            {
              type: "p",
              text: "Lorsqu'un client réserve via un portail comme Booking.com ou Airbnb, le gestionnaire de canaux importe automatiquement la réservation dans myNextDays. Vous n'avez rien à transférer manuellement — la réservation apparaît dans le calendrier et dans la liste des réservations de l'objet concerné.",
            },
            { type: "h2", text: "Ce qui se passe lors d'une réservation via un portail" },
            {
              type: "steps",
              items: [
                "Le portail signale la nouvelle réservation au gestionnaire de canaux",
                "myNextDays crée la réservation avec les données du client, la période et le prix",
                "Les nuits réservées sont immédiatement bloquées sur tous les autres canaux",
                "Vous recevez une notification et retrouvez la réservation dans le calendrier",
              ],
            },
            { type: "h2", text: "Annulations et modifications" },
            {
              type: "p",
              text: "Si un client annule via le portail ou modifie la période de séjour, cela est également transmis automatiquement à myNextDays et les nuits concernées sont de nouveau libérées.",
            },
            {
              type: "note",
              variant: "info",
              text: "Les réservations issues d'un portail sont reconnaissables dans le détail de la réservation grâce à leur badge d'origine, par exemple Booking.com ou Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Éviter les surréservations",
          excerpt: "Le stop-vente et les blocages automatiques évitent les doubles réservations sur plusieurs portails.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Pourquoi les surréservations surviennent" },
            {
              type: "p",
              text: "Sans pilotage centralisé, il arrive facilement que la même nuit soit vendue sur deux portails en même temps — par exemple lorsque les prix et la disponibilité sont gérés manuellement dans plusieurs systèmes. Le gestionnaire de canaux comble cette lacune : chaque réservation, sur n'importe quel canal, bloque immédiatement tous les autres canaux.",
            },
            { type: "h2", text: "Vos outils contre les surréservations" },
            {
              type: "ul",
              items: [
                "Blocage automatique : chaque nouvelle réservation — quel que soit le canal — bloque les nuits partout",
                "Stop-vente : bloque manuellement un jour sur tous les canaux en même temps, par exemple pour un usage personnel ou des travaux",
                "La durée de séjour minimale et les restrictions d'arrivée évitent les réservations courtes indésirables",
              ],
            },
            { type: "h2", text: "Activer le stop-vente" },
            {
              type: "steps",
              items: [
                "Ouvrez le calendrier d'occupation de l'objet",
                "Sélectionnez le jour ou la période concernée",
                "Choisissez « Stop-vente » — le jour est ensuite bloqué sur tous les portails ainsi que sur le site web et la plateforme",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Le stop-vente s'applique sans exception à tous les canaux. Il n'est pas possible de bloquer un jour uniquement pour un seul portail tout en le laissant ouvert sur les autres.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Visibilité par portail",
          excerpt: "Chaque portail peut être activé ou désactivé indépendamment du site web et du marché de la plateforme.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Trois canaux de vente indépendants" },
            {
              type: "p",
              text: "Un objet peut être vendu simultanément par plusieurs voies : par les portails (Booking, Airbnb & Co.), par le marché de la plateforme myNextDays et par votre propre site web. Chaque voie dispose de son propre interrupteur de visibilité — ils sont totalement indépendants les uns des autres.",
            },
            { type: "h2", text: "Piloter la visibilité par portail" },
            {
              type: "p",
              text: "Au sein des portails, chaque portail peut en outre être activé ou désactivé séparément. Un objet peut par exemple être actif sur Booking.com mais désactivé sur Airbnb — les deux associations restent inchangées dans ce cas.",
            },
            { type: "h2", text: "Comment modifier la visibilité" },
            {
              type: "steps",
              items: [
                "Ouvrez l'objet dans /objekte, onglet « Portails »",
                "Activez ou désactivez individuellement le canal souhaité (portail spécifique, site web ou marché de la plateforme)",
                "Enregistrez — la modification prend effet en quelques minutes",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Le statut de l'objet (actif/inactif) ainsi que le stop-vente s'appliquent à tous les canaux de manière prioritaire. Les interrupteurs de visibilité déterminent uniquement sur quels canaux supplémentaires un objet déjà actif apparaît.",
            },
          ],
        },
      ],
    },
  ],
};
