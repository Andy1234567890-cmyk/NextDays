import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Application mobile",
  description: "L'application myNextDays pour rester connecté en déplacement.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "Application",
      articles: [
        {
          slug: "die-app",
          title: "L'application myNextDays",
          excerpt: "Un compte, quatre expériences : client, agence, propriétaire et employé.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "L'application myNextDays est la plateforme mobile pour l'ensemble de votre établissement. Ce n'est pas un produit distinct, mais une interface équivalente à votre tableau de bord web — les deux accèdent au même compte et aux mêmes données, seule l'interface est optimisée pour une utilisation en déplacement.",
            },
            { type: "h2", text: "Quatre expériences dans une seule application" },
            {
              type: "ul",
              items: [
                "Client : consulter les réservations, communiquer avec l'établissement, accéder aux informations d'arrivée.",
                "Agence : gérer plusieurs établissements et biens en un coup d'œil.",
                "Propriétaire : accès en lecture seule à ses propres biens, à l'occupation et aux rapports.",
                "Employé : calendrier, tâches et plannings de nettoyage pour le quotidien opérationnel.",
              ],
            },
            { type: "h2", text: "Quelle expérience vous voyez" },
            {
              type: "p",
              text: "Après la connexion, l'application affiche automatiquement l'expérience adaptée à votre rôle — le même rôle que celui utilisé dans le tableau de bord web. Un employé disposant de droits restreints voit dans l'application exactement les mêmes restrictions que dans le navigateur, car les autorisations sont vérifiées côté serveur.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pour en savoir plus sur les rôles et ce que chacun peut voir, consultez [Rôles et autorisations](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Aucune inscription distincte n'est nécessaire pour l'application — connectez-vous simplement avec vos identifiants myNextDays existants.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Installer l'application et se connecter",
          excerpt: "Comment télécharger l'application myNextDays et vous connecter.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "L'application myNextDays est disponible pour iOS et Android. La connexion s'effectue avec les mêmes identifiants que dans le tableau de bord web — aucun compte distinct ni nouvelle inscription n'est nécessaire.",
            },
            { type: "h2", text: "Installation" },
            {
              type: "steps",
              items: [
                "Ouvrez l'App Store (iOS) ou Google Play (Android).",
                "Recherchez « myNextDays ».",
                "Installez l'application sur votre smartphone ou votre tablette.",
                "Ouvrez l'application après l'installation.",
              ],
            },
            { type: "h2", text: "Connexion" },
            {
              type: "steps",
              items: [
                "Appuyez sur « Se connecter ».",
                "Saisissez votre adresse e-mail et votre mot de passe.",
                "Confirmez la demande d'authentification à deux facteurs le cas échéant.",
                "Vous accédez automatiquement à l'expérience adaptée à votre rôle.",
              ],
            },
            {
              type: "ul",
              items: [
                "Les identifiants sont identiques à ceux du tableau de bord web.",
                "Si votre accès a été révoqué, la connexion à l'application est également bloquée immédiatement.",
                "En cas de problème avec le mot de passe, utilisez « Mot de passe oublié » directement dans l'application.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Connectez-vous exclusivement via la fiche officielle « myNextDays » de l'App Store ; l'application ne demande jamais vos identifiants en dehors de l'écran de connexion.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Gérer en déplacement",
          excerpt: "Traitez réservations, messages et tâches directement depuis votre smartphone.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "L'application myNextDays est particulièrement adaptée à la gestion courante en déplacement : vous consultez les réservations en cours, répondez aux messages des clients et traitez les tâches sans avoir besoin d'un ordinateur — les modifications apparaissent en temps réel également dans le tableau de bord web.",
            },
            { type: "h2", text: "Vue d'ensemble des réservations" },
            {
              type: "p",
              text: "Dans la section « Réservations », vous voyez les arrivées et départs, l'occupation et le statut de chaque bien. Les employés et le personnel de nettoyage ne voient que les informations qui les concernent, sans les prix ni les détails commerciaux.",
            },
            { type: "h2", text: "Messages et tâches" },
            {
              type: "steps",
              items: [
                "Ouvrez la section « Messages » pour répondre directement aux demandes des clients.",
                "Passez à « Tâches » pour voir les tâches qui vous sont assignées.",
                "Appuyez sur une tâche pour ouvrir les détails et la marquer comme terminée.",
                "Marquez les rendez-vous de nettoyage effectués comme terminés directement sur place.",
              ],
            },
            {
              type: "ul",
              items: [
                "Les nouveaux messages et tâches apparaissent en direct, sans actualisation manuelle.",
                "Les tâches terminées sont immédiatement visibles également dans le tableau de bord web.",
                "Les propriétaires voient les réservations et rapports de leurs biens, mais en lecture seule.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Les notifications push vous informent des nouveaux messages et des tâches assignées, dès que vous les autorisez dans les paramètres de votre appareil.",
            },
          ],
        },
      ],
    },
  ],
};
