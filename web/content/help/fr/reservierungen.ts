import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Réservations",
  description: "Gérer, déplacer et annuler des réservations.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Réservations",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Saisir une réservation manuellement",
          excerpt:
            "Comment saisir directement dans myNextDays une réservation reçue par téléphone ou par e-mail.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Quand saisir manuellement" },
            {
              type: "p",
              text: "Toutes les réservations n'arrivent pas via un portail ou votre propre plateforme — les demandes par téléphone, e-mail ou sur place doivent être créées par vous-même, afin que l'objet soit correctement bloqué dans myNextDays et qu'aucune double occupation ne se produise.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez Réservations et cliquez sur « Nouvelle réservation ».",
                "Choisissez l'objet — chaque objet dans myNextDays est une unité réservable unique, c'est-à-dire une chambre ou un objet de vacances déterminé.",
                "Définissez l'arrivée et le départ ainsi que le nombre de voyageurs.",
                "Renseignez les données du voyageur (nom, contact, éventuellement adresse pour la facture).",
                "Vérifiez le prix proposé et ajustez-le si nécessaire.",
                "Enregistrez la réservation — les nuits sont immédiatement bloquées dans le calendrier.",
              ],
            },
            { type: "h2", text: "Paiement et confirmation" },
            {
              type: "p",
              text: "Après l'enregistrement, les mêmes règles de paiement s'appliquent que pour les réservations en ligne. Si un prestataire de paiement est connecté, vous pouvez envoyer directement un lien de paiement au voyageur ou marquer manuellement le paiement comme reçu.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Notez immédiatement les demandes particulières (arrivée anticipée, lits d'appoint) dans les notes — l'équipe les voit dans la chronologie de réservation.",
            },
            { type: "h2", text: "Après la création" },
            {
              type: "p",
              text: "La nouvelle réservation apparaît immédiatement dans [La chronologie de réservation](/hilfe/reservierungen/buchungs-zeitleiste), avec toutes les autres étapes telles que messages, tâches et paiements réunies en un seul endroit.",
            },
            {
              type: "ul",
              items: [
                "Le calendrier et les portails sont synchronisés automatiquement dès l'enregistrement.",
                "Le voyageur reçoit si nécessaire un message de confirmation automatique.",
                "Vous saisissez les modifications de dates via « Déplacer la réservation ».",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "La chronologie de réservation",
          excerpt:
            "La chronologie de réservation regroupe l'ensemble du déroulement d'une réservation en un seul endroit.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Ce que montre la chronologie" },
            {
              type: "p",
              text: "Chaque réservation dispose de sa propre chronologie, qui retrace l'ensemble du déroulement de façon chronologique — de la demande de réservation ou de l'import depuis un portail jusqu'au départ. Vous voyez ainsi d'un coup d'œil ce qui s'est déjà passé et ce qui reste à venir.",
            },
            {
              type: "ul",
              items: [
                "Messages avec le voyageur",
                "Tâches, par exemple le ménage ou la préparation",
                "Paiements et factures",
                "Add-ons et prestations complémentaires réservés",
                "Déplacements (Move) et annulations",
              ],
            },
            { type: "h2", text: "Utiliser la chronologie au quotidien" },
            {
              type: "steps",
              items: [
                "Ouvrez Réservations et sélectionnez la réservation souhaitée.",
                "Passez à l'onglet « Chronologie ».",
                "Faites défiler l'ensemble des événements de façon chronologique.",
                "Utilisez les actions rapides pour envoyer directement un message ou créer une tâche.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Si une réservation est déplacée ou annulée, cette étape apparaît également dans la chronologie — y compris les nuits libérées dans le calendrier.",
            },
            { type: "h2", text: "Pourquoi c'est important" },
            {
              type: "p",
              text: "Comme l'équipe, le propriétaire et le support voient la même chronologie, aucun écart d'information n'apparaît entre messages, tâches et paiements. Pour les détails sur les remboursements, voir [Remboursements](/hilfe/zahlungen/rueckerstattungen), pour les prestations complémentaires voir [Add-ons et prestations complémentaires](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Déplacer une réservation",
          excerpt:
            "Comment déplacer une réservation existante vers une nouvelle période sans perturber le calendrier.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Vérifier avant de déplacer" },
            {
              type: "p",
              text: "Avant de déplacer une réservation, vérifiez la disponibilité de l'objet réservé pour la nouvelle période. myNextDays ne libère les nuits initialement réservées qu'une fois la nouvelle période confirmée — il n'y a ainsi aucune brèche pendant laquelle l'objet serait considéré à tort comme libre ou en double occupation.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez la réservation dans Réservations.",
                "Choisissez « Déplacer » et saisissez la nouvelle période.",
                "Vérifiez la disponibilité affichée pour les nouvelles dates.",
                "Confirmez le déplacement.",
                "Vérifiez si le prix change en raison du nouveau nombre de nuits, et ajustez-le si nécessaire.",
              ],
            },
            { type: "h2", text: "Ce qui se passe automatiquement" },
            {
              type: "p",
              text: "Après la confirmation, les anciennes nuits sont correctement libérées dans le calendrier et les nouvelles nuits sont bloquées, les portails connectés sont mis à jour. L'opération est enregistrée dans la chronologie de réservation.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Si la réservation a été reçue via un portail, un déplacement peut y être soumis à des règles propres — vérifiez les conditions du portail avant d'effectuer des modifications importantes.",
            },
            { type: "h2", text: "Différences de paiement" },
            {
              type: "p",
              text: "Si le prix change suite au déplacement, ajustez les règles de paiement en conséquence — voir [Règles de paiement](/hilfe/zahlungen/zahlungsregeln). Pour en savoir plus sur le déroulement complet d'une réservation, consultez [La chronologie de réservation](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Annulation et remboursement",
          excerpt:
            "Comment annuler correctement une réservation et déclencher un remboursement si nécessaire.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Annuler une réservation" },
            {
              type: "p",
              text: "Une annulation libère immédiatement l'objet pour la période réservée — sur votre calendrier comme sur tous les portails connectés. Avant l'annulation, vérifiez quelles conditions d'annulation s'appliquent à cette réservation.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez la réservation dans Réservations.",
                "Choisissez « Annuler » et indiquez un motif.",
                "Vérifiez le montant de remboursement proposé.",
                "Confirmez l'annulation.",
              ],
            },
            { type: "h2", text: "Déclencher un remboursement" },
            {
              type: "p",
              text: "Si le paiement a été traité via un prestataire de paiement connecté, vous pouvez déclencher le remboursement directement depuis la réservation. Le montant est indiqué dans la devise définie pour cet objet. Pour les détails sur le déroulement, voir [Remboursements](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Remboursement total ou partiel possible",
                "L'opération apparaît dans la chronologie de réservation",
                "Pour les réservations via un portail, les règles du portail concerné s'appliquent également",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Une annulation ne peut pas être annulée. Vérifiez soigneusement la période et le voyageur avant de confirmer.",
            },
            { type: "h2", text: "Après l'annulation" },
            {
              type: "p",
              text: "L'objet redevient immédiatement réservable, les tâches en cours liées à la réservation — par exemple la préparation — sont automatiquement marquées comme n'étant plus nécessaires. L'ensemble de l'opération reste traçable dans la [chronologie de réservation](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Arrivée et départ",
          excerpt: "Comment documenter l'arrivée et le départ d'un voyageur dans myNextDays.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Enregistrer l'arrivée" },
            {
              type: "p",
              text: "L'enregistrement de l'arrivée marque le début du séjour et est particulièrement utile en cas d'arrivée autonome ou de remise des clés par l'équipe, pour tenir à jour le statut de chaque réservation.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez la réservation dans Réservations.",
                "Choisissez « Arrivée » le jour de l'arrivée.",
                "Ajoutez si nécessaire une note, par exemple l'heure ou des particularités.",
              ],
            },
            { type: "h2", text: "Départ et remise" },
            {
              type: "p",
              text: "Au départ, vous marquez le séjour comme terminé. Cela déclenche souvent automatiquement une tâche de ménage pour l'objet, afin qu'il soit préparé pour la prochaine réservation.",
            },
            {
              type: "ul",
              items: [
                "L'arrivée et le départ font partie de la chronologie de réservation",
                "Les horaires peuvent être définis par objet dans les paramètres de l'objet",
                "En cas d'accès mobile, l'équipe peut enregistrer l'arrivée et le départ directement sur place",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Un départ manqué ne bloque pas automatiquement les tâches suivantes — vérifiez régulièrement les statuts en retard dans Réservations.",
            },
            { type: "h2", text: "Lien avec les tâches" },
            {
              type: "p",
              text: "L'arrivée et le départ sont étroitement liés aux tâches et à la chronologie. Pour en savoir plus sur le déroulement complet, consultez [La chronologie de réservation](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Add-ons et prestations complémentaires",
          excerpt:
            "Comment proposer aux voyageurs des prestations complémentaires réservables telles que le petit-déjeuner ou un transfert, et les saisir dans la réservation.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Ce que sont les add-ons" },
            {
              type: "p",
              text: "Les add-ons sont des prestations complémentaires optionnelles à une réservation — par exemple le petit-déjeuner, une arrivée anticipée, un transfert ou un départ tardif. Ils sont définis par objet et peuvent être ajoutés à la réservation par le voyageur lui-même ou par votre équipe.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez l'objet et créez sous « Add-ons » les prestations complémentaires souhaitées avec leur prix.",
                "Ouvrez une réservation existante dans Réservations.",
                "Choisissez « Ajouter un add-on » et sélectionnez la prestation souhaitée.",
                "Confirmez la quantité et le moment de la prestation.",
              ],
            },
            { type: "h2", text: "Facturation" },
            {
              type: "p",
              text: "Les add-ons sont facturés dans la devise de l'objet concerné et apparaissent comme une ligne distincte sur la facture. Les add-ons déjà payés peuvent être remboursés au prorata en cas d'annulation.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Définissez une fois pour toutes les add-ons populaires au niveau de l'objet — ils peuvent ainsi être ajoutés en quelques clics à chaque nouvelle réservation.",
            },
            { type: "h2", text: "Visibilité pour le voyageur" },
            {
              type: "p",
              text: "Si la plateforme ou votre propre site web est actif, les voyageurs peuvent souvent déjà sélectionner les add-ons appropriés pendant la réservation elle-même. Chaque ajout apparaît ensuite dans la [chronologie de réservation](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Les add-ons peuvent être nommés et tarifés individuellement par objet",
                "Un ajout ultérieur est possible à tout moment via la réservation",
                "Les add-ons annulés sont remboursés au prorata",
              ],
            },
          ],
        },
      ],
    },
  ],
};
