import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Équipe & autorisations",
  description: "Employés, rôles et droits d'accès.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Accès",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Inviter un employé",
          excerpt: "Comment inviter de nouveaux employés à rejoindre votre compte myNextDays.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Vous pouvez inviter autant d'employés que vous le souhaitez au sein de votre établissement — par exemple pour la réception, le nettoyage ou l'administration. Chaque invitation est liée à une adresse e-mail et attribue immédiatement un rôle fixe, qui détermine l'accès sur le web et dans l'application myNextDays.",
            },
            { type: "h2", text: "Envoyer une invitation" },
            {
              type: "steps",
              items: [
                "Ouvrez « Compte » et passez à la section « Équipe ».",
                "Cliquez sur « Inviter un employé ».",
                "Saisissez l'adresse e-mail de la personne.",
                "Choisissez le rôle approprié, par exemple Employé ou Nettoyage.",
                "Confirmez l'invitation.",
              ],
            },
            { type: "h2", text: "Ce qui se passe ensuite" },
            {
              type: "p",
              text: "La personne invitée reçoit un e-mail avec un lien pour créer son propre mot de passe et se connecter. La connexion est valable aussi bien pour le tableau de bord web que pour l'application myNextDays — il n'existe pas de compte séparé par interface.",
            },
            {
              type: "ul",
              items: [
                "Une invitation reste valable jusqu'à ce qu'elle soit acceptée ou retirée.",
                "Les invitations en attente s'affichent dans la section « Équipe » avec le statut « En attente ».",
                "Le rôle peut être ajusté à tout moment par la suite.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Pour savoir quel rôle a accès à quelles sections, consultez [Rôles & autorisations](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Attribuez dès le départ le rôle le plus restreint qui convient — les droits peuvent toujours être étendus plus tard.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Rôles & autorisations",
          excerpt: "Les cinq rôles de myNextDays et ce que chacun peut faire.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "myNextDays distingue cinq rôles : Admin, Co-admin, Employé, Nettoyage et Propriétaire. Chaque rôle détermine les sections visibles dans le tableau de bord web et dans l'application myNextDays — les droits sont appliqués côté serveur, pas seulement masqués dans l'interface.",
            },
            { type: "h2", text: "Aperçu des rôles" },
            {
              type: "ul",
              items: [
                "Admin : accès complet à toutes les sections, y compris finances, ventes et gestion de l'équipe.",
                "Co-admin : accès quasi complet comme Admin, pour le second niveau de direction de l'établissement.",
                "Employé : accès opérationnel aux réservations, au calendrier et aux tâches, sans visibilité sur les finances ou les ventes.",
                "Nettoyage : accès exclusif aux tâches de nettoyage assignées et aux détails de l'objet, sans visibilité sur les finances ou les ventes.",
                "Propriétaire : accès en lecture seule à ses propres objets, sans gestion des objets d'autrui.",
              ],
            },
            { type: "h2", text: "Attribuer ou modifier un rôle" },
            {
              type: "steps",
              items: [
                "Ouvrez « Compte » → « Équipe ».",
                "Sélectionnez l'employé concerné dans la liste.",
                "Cliquez sur « Modifier le rôle ».",
                "Choisissez le nouveau rôle et confirmez.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Employé et Nettoyage ne voient en principe jamais les prix, les revenus ou les canaux de réservation — cette exclusion est appliquée côté serveur et ne peut pas être contournée via l'interface.",
            },
            {
              type: "note",
              variant: "info",
              text: "Un aperçu par rôle est disponible sous [Ce que voit chaque rôle](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Ce que voit chaque rôle",
          excerpt: "Sections et vues concrètes par rôle, sur le web et dans l'application.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "En complément des droits généraux décrits dans [Rôles & autorisations](/hilfe/team-rollen/rollen-berechtigungen), un aperçu concret des différentes sections vous aide à définir les bonnes attentes lors de l'intégration de nouveaux employés.",
            },
            { type: "h2", text: "Calendrier & réservations" },
            {
              type: "p",
              text: "Admin, Co-admin et Employé voient le planning d'occupation complet avec les données des clients et les tâches. Nettoyage ne voit que les rendez-vous qui lui sont assignés, avec l'adresse de l'objet et la liste de contrôle, mais ni les noms des clients ni les prix. Les propriétaires voient le calendrier d'occupation exclusivement pour leurs propres objets, en lecture seule.",
            },
            { type: "h2", text: "Finances & ventes" },
            {
              type: "ul",
              items: [
                "Revenus, commissions et factures : réservés à Admin et Co-admin.",
                "Portails (connexion OTA) et visibilité sur la plateforme : réservés à Admin et Co-admin.",
                "Employé et Nettoyage : aucun accès aux sections financières ou commerciales, même pas aux pages de détail.",
              ],
            },
            { type: "h2", text: "Équipe & paramètres" },
            {
              type: "p",
              text: "La gestion des employés, des rôles et des paramètres du compte reste réservée à Admin et Co-admin. Les propriétaires et les rôles opérationnels ne voient même pas cette section, ni dans l'application myNextDays ni dans le tableau de bord web.",
            },
            {
              type: "note",
              variant: "info",
              text: "Cette répartition est identique dans le tableau de bord web et dans l'application myNextDays, car les deux interfaces interrogent le même rôle depuis votre compte.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Testez brièvement les nouveaux rôles avec l'employé concerné juste après l'invitation, afin d'éviter tout malentendu sur les sections visibles.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Révoquer un accès",
          excerpt: "Supprimer immédiatement et complètement l'accès d'un employé.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Si un employé quitte votre établissement ou que la collaboration évolue, retirez l'accès directement depuis le compte. La révocation s'applique côté serveur et immédiatement — pas seulement à l'expiration d'une session existante.",
            },
            { type: "h2", text: "Supprimer l'accès" },
            {
              type: "steps",
              items: [
                "Ouvrez « Compte » → « Équipe ».",
                "Sélectionnez l'employé concerné.",
                "Cliquez sur « Révoquer l'accès ».",
                "Confirmez l'opération.",
              ],
            },
            { type: "h2", text: "Effet sur les sessions en cours" },
            {
              type: "p",
              text: "Après la révocation, la personne ne peut plus se reconnecter ni sur le tableau de bord web ni dans l'application myNextDays. Réassignez au préalable à un autre employé les tâches ou rendez-vous de nettoyage déjà attribués, afin que rien ne reste sans suite.",
            },
            {
              type: "ul",
              items: [
                "Réassignez les tâches ouvertes avant la révocation.",
                "L'accès peut être rétabli ultérieurement via une nouvelle invitation.",
                "La révocation ne concerne que cet établissement, pas les autres comptes de la personne.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Révoquez l'accès rapidement dès la fin d'une collaboration — des comptes employés encore actifs constituent sinon un risque de sécurité inutile.",
            },
          ],
        },
      ],
    },
  ],
};
