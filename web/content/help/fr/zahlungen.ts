import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Paiements et factures",
  description: "Prestataires de paiement, règles de paiement et factures.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Paiements",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Connecter un prestataire de paiement",
          excerpt:
            "Comment connecter Stripe ou PayPal à myNextDays pour traiter les paiements automatiquement.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Prestataires disponibles" },
            {
              type: "p",
              text: "myNextDays traite les paiements via des prestataires de paiement connectés. Stripe et PayPal sont actuellement pris en charge — vous pouvez connecter un seul prestataire ou les deux simultanément, et les utiliser selon l'objet ou la préférence du client.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez Compte et accédez à la section « Paiements ».",
                "Choisissez le prestataire souhaité — Stripe ou PayPal.",
                "Suivez la fenêtre de connexion et identifiez-vous chez le prestataire, ou créez un nouveau compte.",
                "Confirmez la connexion — le statut passe à « connecté ».",
              ],
            },
            { type: "h2", text: "Ce qui se passe ensuite" },
            {
              type: "p",
              text: "Dès qu'un prestataire est connecté, vous pouvez envoyer des liens de paiement, prélever des acomptes et déclencher des remboursements directement depuis la réservation. Tous les montants sont traités dans la devise définie pour l'objet concerné.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Sans prestataire connecté, vous ne pouvez marquer les paiements comme reçus que manuellement — un prélèvement automatique n'est alors pas possible.",
            },
            { type: "h2", text: "Plusieurs objets, un seul prestataire" },
            {
              type: "p",
              text: "Une fois établie, la connexion s'applique à l'ensemble de votre compte, pour tous vos objets. Le déroulement précis du prélèvement se définit dans [Règles de paiement](/hilfe/zahlungen/zahlungsregeln). Les versements qui vous sont dus passent ensuite par le prestataire concerné, voir [Versements](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe convient aux paiements par carte et à de nombreux moyens de paiement locaux",
                "PayPal offre aux clients une alternative familière",
                "Les deux prestataires peuvent être déconnectés et reconnectés indépendamment l'un de l'autre",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Règles de paiement",
          excerpt: "Définissez à quel moment l'acompte et le solde d'une réservation deviennent exigibles.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Acompte et solde" },
            {
              type: "p",
              text: "Les règles de paiement déterminent la manière dont une réservation est réglée financièrement — par exemple un acompte à la réservation et un solde avant l'arrivée, ou le paiement intégral immédiat. Ces règles s'appliquent par objet et peuvent être modifiées à tout moment.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez l'objet et accédez à la section « Règles de paiement ».",
                "Choisissez si un acompte est perçu et définissez-en la part.",
                "Déterminez à quel moment le solde devient exigible, par exemple un nombre de jours donné avant l'arrivée.",
                "Enregistrez les paramètres.",
              ],
            },
            { type: "h2", text: "Prélèvement automatique" },
            {
              type: "p",
              text: "Si un prestataire de paiement est connecté, myNextDays prélève automatiquement l'acompte et le solde à la date définie, et en informe le client au préalable par message.",
            },
            {
              type: "note",
              variant: "info",
              text: "Les règles de paiement ne s'appliquent qu'aux réservations disposant d'un prestataire de paiement connecté. Sans prestataire, vous marquez les paiements manuellement dans la réservation.",
            },
            { type: "h2", text: "Différences selon le canal" },
            {
              type: "p",
              text: "Sur les portails, leur propre traitement des paiements peut s'appliquer à la place — vérifiez dans ce cas les conditions du portail concerné. Pour les réservations via votre propre plateforme ou site web, ce sont toujours les règles définies ici qui s'appliquent. Pour les détails sur la connexion des prestataires, voir [Connecter un prestataire de paiement](/hilfe/zahlungen/zahlungsanbieter-verbinden), et pour la facturation, voir [Créer des factures](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Acompte possible sous forme de montant fixe ou de pourcentage",
                "Délai du solde librement paramétrable",
                "Les modifications s'appliquent uniquement aux nouvelles réservations, pas rétroactivement",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Créer des factures",
          excerpt: "Comment établir une facture pour une réservation avec l'adresse de facturation correcte.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Créer une facture" },
            {
              type: "p",
              text: "Une facture peut être établie pour chaque réservation — au nom du client lui-même ou d'une entreprise différente, si la réservation est effectuée à titre professionnel.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez la réservation dans Réservations.",
                "Sélectionnez « Créer une facture ».",
                "Vérifiez ou complétez l'adresse de facturation.",
                "Vérifiez les postes indiqués — nuitée, options, frais.",
                "Établissez la facture et envoyez-la au client.",
              ],
            },
            { type: "h2", text: "Gérer l'adresse de facturation" },
            {
              type: "p",
              text: "Vous pouvez saisir l'adresse de facturation directement dans la réservation ou la faire compléter ultérieurement par le client via la confirmation de réservation. Dans certains pays, une facture juridiquement valable ne peut pas être émise sans adresse complète.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Pour les clients professionnels, vérifiez en particulier la raison sociale et l'adresse — toute correction ultérieure nécessite une facture rectificative.",
            },
            { type: "h2", text: "Montants et devise" },
            {
              type: "p",
              text: "Tous les postes sont indiqués dans la devise définie pour l'objet. Les paiements déjà effectués sont mentionnés sur la facture comme encaissements. Pour comprendre comment l'acompte et le solde sont déterminés, consultez [Règles de paiement](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Les factures peuvent être téléchargées au format PDF",
                "Des factures rectificatives peuvent être établies à tout moment en cas de modification",
                "Les options apparaissent comme un poste distinct",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Remboursements",
          excerpt:
            "Comment rembourser un paiement en totalité ou en partie lorsqu'une réservation est annulée ou modifiée.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Quand un remboursement est nécessaire" },
            {
              type: "p",
              text: "Un remboursement intervient généralement lors d'une annulation, mais peut aussi être nécessaire en cas d'ajustement de prix ultérieur ou d'annulation d'une option.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez la réservation concernée dans Réservations.",
                "Sélectionnez « Remboursement » dans la section paiement de la réservation.",
                "Saisissez le montant à rembourser — en totalité ou en partie.",
                "Confirmez le remboursement.",
              ],
            },
            { type: "h2", text: "Déroulement via le prestataire de paiement" },
            {
              type: "p",
              text: "Le remboursement est exécuté via le prestataire utilisé lors du paiement — Stripe ou PayPal — et reversé directement sur le moyen de paiement d'origine du client. L'opération est automatiquement consignée dans la chronologie de la réservation.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Sans prestataire de paiement connecté, un remboursement ne peut pas être déclenché automatiquement — réglez alors le remboursement directement avec le client.",
            },
            { type: "h2", text: "Impact sur les commissions" },
            {
              type: "p",
              text: "Les commissions de marketplace ou de portail déjà facturées sont ajustées proportionnellement lors d'un remboursement. Pour en savoir plus, voir [Comprendre les commissions](/hilfe/zahlungen/provisionen-verstehen). Pour les détails sur l'annulation elle-même, voir [Annulation et remboursement](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Des remboursements partiels sont possibles pour des postes individuels",
                "Le statut de traitement est visible à tout moment dans la réservation",
                "Les remboursements passent exclusivement par le prestataire utilisé à l'origine",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Versements",
          excerpt:
            "Comment percevoir les recettes de vos réservations versées par les prestataires de paiement connectés.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Comment fonctionnent les versements" },
            {
              type: "p",
              text: "Les paiements entrants sont d'abord collectés chez le prestataire de paiement connecté. Le versement vers votre compte bancaire enregistré s'effectue ensuite selon le rythme habituel du prestataire.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez Compte et accédez à la section « Paiements ».",
                "Vérifiez sous « Versements » le statut du prestataire concerné.",
                "Ouvrez si nécessaire la vue détaillée du prestataire pour consulter l'historique complet des versements.",
              ],
            },
            { type: "h2", text: "Ce qui est déduit avant le versement" },
            {
              type: "p",
              text: "Avant le versement, les commissions de marketplace et de portail éventuelles ainsi que les frais du prestataire sont pris en compte. Le montant versé ne correspond donc pas nécessairement au montant initial de la réservation.",
            },
            {
              type: "note",
              variant: "info",
              text: "Le détail exact des déductions est expliqué dans [Comprendre les commissions](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Plusieurs objets et propriétaires" },
            {
              type: "p",
              text: "Si vous gérez des objets pour différents propriétaires, les versements sont répartis selon les décomptes propriétaires enregistrés. En cas d'écart, vérifiez d'abord le statut des réservations concernées dans Réservations.",
            },
            {
              type: "ul",
              items: [
                "Le rythme et la méthode de versement sont définis par le prestataire concerné",
                "Les montants retenus, par exemple en cas de remboursement en cours, sont signalés",
                "L'historique complet est consultable directement chez le prestataire",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Comprendre les commissions",
          excerpt:
            "Un aperçu de la composition des commissions de marketplace et de portail, et de leur mode de facturation.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Deux types de commissions" },
            {
              type: "p",
              text: "Pour les réservations via myNextDays, deux commissions distinctes peuvent s'appliquer : la commission de marketplace pour les réservations via votre propre plateforme, et les commissions de portail pour les réservations reçues via des portails connectés comme Booking ou Airbnb. Les deux sont indépendantes l'une de l'autre et peuvent varier selon le canal de distribution d'une réservation.",
            },
            {
              type: "ul",
              items: [
                "Commission de marketplace : s'applique aux réservations via la plateforme myNextDays",
                "Commission de portail : calculée par le portail concerné selon ses propres conditions",
                "Les réservations directes via votre propre site web sont à considérer indépendamment",
              ],
            },
            { type: "h2", text: "Où consulter les commissions" },
            {
              type: "steps",
              items: [
                "Ouvrez Compte et accédez à la section « Facturation ».",
                "Choisissez le mois souhaité.",
                "Consultez le détail par réservation avec la commission correspondante.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Le canal par lequel une réservation est arrivée est indiqué directement sur la réservation elle-même — cela explique quelle commission a été appliquée.",
            },
            { type: "h2", text: "Lien avec les versements" },
            {
              type: "p",
              text: "Les commissions sont déduites du montant de la réservation avant le versement. Pour les détails du processus de versement, voir [Versements](/hilfe/zahlungen/auszahlungen). En cas de remboursement, la commission correspondante est corrigée proportionnellement — le déroulement complet d'une réservation est visible dans la [Chronologie de réservation](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
