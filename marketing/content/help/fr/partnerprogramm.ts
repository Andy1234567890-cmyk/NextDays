import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Programme de partenariat",
  description: "Recommandez des établissements, constituez une équipe et participez aux revenus des abonnements.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Comment ça marche",
      articles: [
        {
          slug: "ueberblick",
          title: "Aperçu du programme de partenariat",
          excerpt: "Qui peut participer, comment la commission est générée et ce que vous voyez.",
          updated: "Date : septembre 2026",
          body: [
            {
              type: "p",
              text: "En tant que partenaire, vous recommandez myNextDays aux propriétaires, agences et hôtels. Si un établissement s'inscrit avec votre code ou via votre lien et paie ses factures d'abonnement, vous recevez une part du chiffre d'affaires net des abonnements pendant douze mois. Le barème en fonction du nombre de clients payants est disponible en direct sur la page du programme.",
            },
            { type: "h2", text: "Qui peut devenir partenaire" },
            {
              type: "ul",
              items: [
                "Personnes et entreprises dans l'UE, en Suisse ou au Royaume-Uni ayant un véritable canal vers les hôtes : influenceurs, consultants, agences, cabinets fiscaux, associations.",
                "Même les clients myNextDays eux-mêmes — un abonnement n'est pas une condition préalable.",
                "Obligatoire pour la candidature : au moins un compte de réseau social (Instagram, TikTok, YouTube, Facebook, LinkedIn…) avec adresse, identifiant et portée. Site web ou newsletter sont un plus.",
              ],
            },
            { type: "h2", text: "Comment un établissement vous est attribué" },
            {
              type: "steps",
              items: [
                "Vous partagez votre lien (mynextdays.com/p/VOTRE-CODE) ou votre code.",
                "L'établissement voit le code lors de l'inscription dans le champ « Recommandé par » et le confirme en soumettant — sans cookie.",
                "La période de douze mois commence avec la première facture d'abonnement payée.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vous voyez vos clients de manière anonyme (Client #1, #2…) avec le pays, le statut et les montants — jamais le nom ou l'e-mail. Un établissement est attribué à un seul partenaire ; le premier gagne.",
            },
            { type: "h2", text: "Ce que vous trouvez dans le tableau de bord" },
            {
              type: "ul",
              items: [
                "Aperçu : rang, clics, établissements enregistrés et payants, commissions ouvertes, payables et payées.",
                "Commissions : chaque facture d'abonnement payée comme une ligne avec la base, le taux, le montant et le statut.",
                "Paiements : mensuels par devise à partir du montant minimum, avec crédit (auto-facturation) comme preuve.",
                "Liens et matériel : vos codes, matériel promotionnel et l'identification obligatoire par pays.",
                "Messages : le contact direct avec l'équipe partenaire.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Constituer une équipe : la commission d'équipe",
          excerpt: "Recrutez des partenaires qui rejoignent avec votre code — et participez aux revenus de leurs clients.",
          updated: "Date : septembre 2026",
          body: [
            {
              type: "p",
              text: "Vous pouvez intégrer d'autres partenaires à votre équipe. Si quelqu'un postule via votre lien d'équipe (mynextdays.com/p/VOTRE-CODE?team=1) et saisit visiblement votre code dans sa candidature, il fera partie de votre équipe après approbation. Vous recevez une commission d'équipe sur le chiffre d'affaires net des abonnements des clients de vos partenaires d'équipe.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "Le taux d'équipe dépend de VOTRE rang au moment du paiement — et non de la taille de votre équipe. Les taux sont indiqués sur la page du programme.",
                "Votre rang est uniquement basé sur vos propres clients payants. Les clients d'équipe ne comptent pas pour le rang.",
                "Une seule couche : vos partenaires d'équipe ne construisent pas leur propre équipe sous vous.",
                "Pas de frais de participation, pas d'argent pour le recrutement d'un partenaire. La commission d'équipe provient exclusivement du chiffre d'affaires des abonnements payés.",
                "Douze mois à compter de la première facture payée du client d'équipe concerné, fenêtre de remboursement de 30 jours, reprise en cas de remboursement ou de rétrofacturation — comme pour votre propre commission.",
                "La commission d'équipe n'est générée que si vous et votre partenaire d'équipe êtes approuvés ; sinon, elle est suspendue.",
              ],
            },
            { type: "h2", text: "L'évaluation de l'équipe" },
            {
              type: "p",
              text: "Sous « Équipe », vous voyez chaque partenaire d'équipe avec son rang, ses clients payants, le chiffre d'affaires d'abonnement de ses clients (30 jours et total) et votre commission d'équipe en résultant — ouverte, payable, payée — ainsi que l'historique des douze derniers mois. Vous ne voyez pas les détails des clients de vos partenaires d'équipe ; ils leur appartiennent.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Via « Équipe », vous pouvez contacter directement vos partenaires d'équipe par message — et votre sponsor vous contacte.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Le même domaine de messagerie ou les mêmes coordonnées bancaires entre le sponsor et le partenaire d'équipe sont marqués et vérifiés par l'équipe de partenaires avant que la commission d'équipe ne soit versée.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Paiement, crédit et impôts",
          excerpt: "Quand la commission est payable, comment le crédit est effectué et ce qui s'applique fiscalement.",
          updated: "Statut : Septembre 2026",
          body: [
            {
              type: "steps",
              items: [
                "Une ligne de commission est créée avec la facture d'abonnement payée et est « ouverte » pendant 30 jours (fenêtre de remboursement).",
                "Après cela, elle est payable. Le premier du mois, nous regroupons toutes les lignes payables par devise.",
                "Si le total dépasse le montant minimum de votre devise, un paiement avec crédit (auto-facturation) est généré. Vous n'avez pas besoin d'émettre de facture.",
                "Après le virement, le paiement apparaît comme « Payé » avec une référence dans le tableau de bord.",
              ],
            },
            {
              type: "ul",
              items: [
                "Entreprises : Le crédit porte la mention d'autoliquidation ; la condition est un numéro d'identification TVA confirmé (vérification VIES).",
                "Particuliers : Le crédit n'indique pas de TVA ; la commission doit être déclarée par vous-même.",
                "Paiement par SEPA, Wise ou PayPal — vous saisissez les données dans le profil ; les modifications nécessitent votre mot de passe.",
                "Pas de conversion : La commission en DKK est payée en DKK, la commission en EUR en EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La publicité doit être reconnaissable comme telle — au début de la publication, dans la langue de la publication. Les formulations attestées par pays se trouvent sous « Liens & Matériel ». Les infractions peuvent entraîner un blocage.",
            },
          ],
        },
      ],
    },
  ],
};
