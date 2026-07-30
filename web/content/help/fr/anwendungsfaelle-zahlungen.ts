import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Paiements",
  description: "Gérer correctement les paiements.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Paiements",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Configurer un acompte",
          excerpt: "Comment ne demander qu'un montant partiel à la réservation au lieu de la somme totale.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ",
            },
            {
              type: "p",
              text: "Plutôt que de prélever immédiatement le montant total de la réservation, vous pouvez définir un acompte comme règle de paiement. Le voyageur ne paie qu'un montant partiel via Stripe ou PayPal au moment de la réservation, le reste étant réglé plus tard via un solde.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez la section « Règles de paiement » dans l'objet.",
                "Créez une nouvelle règle de type « Acompte ».",
                "Définissez le montant de l'acompte en pourcentage ou en montant fixe du total.",
                "Déterminez à quel moment l'acompte est exigible, en général immédiatement à la réservation.",
                "Enregistrez la règle et vérifiez-la sur une réservation test.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "L'acompte est traité via le prestataire de paiement défini pour l'objet. Pour automatiser le montant correspondant au solde, voir [Automatiser le solde](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Automatiser le solde",
          excerpt: "Comment le solde restant est prélevé automatiquement avant l'arrivée.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ",
            },
            {
              type: "p",
              text: "Après un acompte, un solde reste dû. Plutôt que de le suivre manuellement, configurez une règle de paiement qui prélève automatiquement le solde à une date fixe avant l'arrivée via Stripe ou PayPal.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez la section « Règles de paiement » dans l'objet.",
                "Créez une nouvelle règle de type « Solde », à condition qu'une règle d'acompte existe déjà.",
                "Déterminez le nombre de jours avant l'arrivée auquel le solde devient exigible.",
                "Activez le prélèvement automatique afin que le prestataire de paiement défini débite le montant automatiquement.",
                "Vérifiez ensuite le statut du solde dans la chronologie de réservation correspondante.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Si le prélèvement automatique échoue, par exemple en raison d'une carte expirée, la réservation n'est pas annulée automatiquement. Vérifiez rapidement les soldes en échec et contactez directement le voyageur.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Effectuer un remboursement",
          excerpt: "Comment rembourser un voyageur, en totalité ou en partie.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ",
            },
            {
              type: "p",
              text: "En cas d'annulation ou de réclamation, vous pouvez rembourser un voyageur en totalité ou en partie du montant payé. Le remboursement passe par le même prestataire de paiement que celui utilisé pour le paiement initial — Stripe ou PayPal.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez la réservation concernée dans la chronologie de réservation.",
                "Dans la section « Paiements », sélectionnez le paiement initial à rembourser.",
                "Choisissez entre un remboursement total ou partiel.",
                "En cas de remboursement partiel, saisissez le montant souhaité.",
                "Confirmez le remboursement et vérifiez le statut de paiement mis à jour dans la chronologie.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Un remboursement ne modifie automatiquement ni le statut de la réservation ni les nuits occupées dans le calendrier. En cas d'annulation, vérifiez également si les nuits concernées doivent être libérées dans le planning d'occupation.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Gérer une caution",
          excerpt: "Comment mettre en place une caution et la libérer après le séjour.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ",
            },
            {
              type: "p",
              text: "Une caution vous protège contre les dommages survenus pendant le séjour. Elle est définie comme une règle de paiement à part et, selon la configuration de l'objet, elle est soit pré-autorisée, soit prélevée via Stripe ou PayPal.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez la section « Règles de paiement » dans l'objet et créez une règle de type « Caution ».",
                "Déterminez le montant de la caution et le moment de l'autorisation, généralement peu avant l'arrivée.",
                "Vérifiez l'état de l'objet après le départ du voyageur.",
                "Si l'état est irréprochable, libérez intégralement la caution via la réservation.",
                "En cas de dommage, ne remboursez que la partie non nécessaire et documentez le motif de la retenue.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Une caution autorisée mais non prélevée expire automatiquement après un certain délai, selon le prestataire de paiement. Libérez la caution rapidement après le départ ou prélevez le montant nécessaire à temps.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Corriger une facture",
          excerpt: "Comment corriger a posteriori une facture déjà émise.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ",
            },
            {
              type: "p",
              text: "Si une facture déjà émise contient une erreur, par exemple sur l'adresse de facturation ou une ligne, corrigez-la via la réservation au lieu de simplement supprimer la facture d'origine.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez la réservation concernée dans la chronologie de réservation et passez à la section « Factures ».",
                "Sélectionnez la facture erronée.",
                "Créez une facture rectificative ou d'annulation par rapport à la facture d'origine.",
                "Créez ensuite une nouvelle facture corrigée avec les informations correctes.",
                "Renvoyez la facture corrigée au voyageur ou à l'adresse de facturation.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Une facture déjà envoyée ne doit pas être écrasée directement, pour des raisons de traçabilité. La correction via une facture d'annulation conserve le justificatif d'origine et rend la modification traçable.",
            },
          ],
        },
      ],
    },
  ],
};
