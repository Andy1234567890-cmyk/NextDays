import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Propriétaires & décomptes",
  description: "Comptes propriétaires, décomptes et commissions.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Propriétaires",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Créer un propriétaire",
          excerpt: "Comment créer un nouveau compte propriétaire dans myNextDays.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Les propriétaires sont des comptes distincts dans myNextDays, à travers lesquels vous gérez des objets appartenant à une personne ou une société déterminée. Un compte propriétaire dispose d'un accès limité, en lecture seule, à ses propres objets, sans possibilité d'apporter lui-même des modifications à l'établissement.",
            },
            { type: "h2", text: "Créer un nouveau compte propriétaire" },
            {
              type: "steps",
              items: [
                "Ouvrez la section « Propriétaires » dans le menu principal.",
                "Cliquez sur « Créer un nouveau propriétaire ».",
                "Saisissez le nom, l'adresse e-mail et les coordonnées.",
                "Renseignez si besoin l'adresse de facturation pour les décomptes.",
                "Enregistrez le compte.",
              ],
            },
            { type: "h2", text: "Configurer l'accès" },
            {
              type: "p",
              text: "Une fois le compte créé, vous pouvez envoyer au propriétaire une invitation pour son propre accès. Le propriétaire se connecte ensuite avec ses propres identifiants et ne voit que les objets qui lui sont associés.",
            },
            {
              type: "ul",
              items: [
                "Un compte propriétaire peut regrouper plusieurs objets.",
                "Chaque objet appartient exactement à un seul propriétaire.",
                "Les coordonnées et l'adresse de facturation peuvent être modifiées à tout moment par la suite.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Pour savoir comment associer un objet existant à un propriétaire, consultez [Associer un objet à un propriétaire](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Associer un objet à un propriétaire",
          excerpt: "Chaque objet appartient exactement à un propriétaire — voici comment configurer l'association.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Dans myNextDays, chaque objet appartient exactement à un propriétaire. Une association multiple n'est pas prévue — si un objet doit appartenir à un autre propriétaire, supprimez d'abord l'association existante avant d'en définir une nouvelle.",
            },
            { type: "h2", text: "Effectuer l'association" },
            {
              type: "steps",
              items: [
                "Ouvrez l'objet dans « Objets ».",
                "Passez à l'onglet « Propriétaire ».",
                "Sélectionnez le propriétaire concerné dans la liste.",
                "Confirmez l'association.",
                "Enregistrez la modification sur l'objet.",
              ],
            },
            { type: "h2", text: "Changement de propriétaire" },
            {
              type: "p",
              text: "Si le propriétaire d'un objet change, par exemple à la suite d'une vente, remplacez l'association existante par la nouvelle. Les décomptes déjà créés pour des périodes passées restent associés au propriétaire d'origine.",
            },
            {
              type: "ul",
              items: [
                "Un objet ne peut être associé qu'à un seul propriétaire à la fois.",
                "Sans association, l'objet n'apparaît dans aucun accès propriétaire.",
                "Les décomptes passés restent conservés chez le propriétaire d'origine.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "L'association d'un objet à plusieurs propriétaires simultanément est exclue — le système n'autorise pas une seconde association en parallèle.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Décompte propriétaire (relevé)",
          excerpt: "Comment créer un relevé des revenus, déduction faite de la commission, pour un propriétaire.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Le décompte propriétaire, également appelé relevé, réunit pour une période donnée l'ensemble des revenus des objets associés et déduit votre commission convenue. Le résultat correspond au montant que vous versez au propriétaire.",
            },
            { type: "h2", text: "Créer un relevé" },
            {
              type: "steps",
              items: [
                "Ouvrez la section « Propriétaires » et sélectionnez le propriétaire souhaité.",
                "Passez à l'onglet « Décompte ».",
                "Choisissez la période de décompte.",
                "Vérifiez les réservations et revenus listés par objet.",
                "Faites générer le relevé avec la commission déduite.",
              ],
            },
            { type: "h2", text: "Structure du relevé" },
            {
              type: "p",
              text: "Un relevé liste, pour chaque objet, les revenus bruts issus des réservations, la commission déduite et le montant de versement qui en résulte. Les coûts supplémentaires comme le nettoyage ou les frais peuvent, selon l'accord, être présentés séparément.",
            },
            {
              type: "ul",
              items: [
                "Revenus bruts : somme de toutes les réservations de la période, par objet.",
                "Commission : votre part convenue, déduite des revenus.",
                "Montant de versement : revenus moins commission et, le cas échéant, autres postes.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Les montants du relevé sont toujours exprimés dans la devise de l'objet — il n'existe aucune devise de repli par défaut.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Créez les relevés régulièrement à la même date de référence, afin que les propriétaires disposent d'un rythme fiable pour leurs versements.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Accès propriétaire",
          excerpt: "Ce que les propriétaires peuvent voir dans leur accès en lecture seule.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "L'accès propriétaire est une connexion distincte, en lecture seule, à myNextDays. Les propriétaires y voient exclusivement les objets qui leur sont associés ainsi que les occupations et décomptes correspondants — sans possibilité de modifier eux-mêmes les paramètres.",
            },
            { type: "h2", text: "Ce que voient les propriétaires" },
            {
              type: "ul",
              items: [
                "Le calendrier d'occupation de leurs propres objets.",
                "Les relevés créés, avec les revenus et la commission déduite.",
                "Les données de base de leurs objets, par exemple les équipements et la description.",
              ],
            },
            { type: "h2", text: "Activer l'accès" },
            {
              type: "steps",
              items: [
                "Ouvrez le propriétaire dans « Propriétaires ».",
                "Cliquez sur « Inviter à l'accès ».",
                "Le propriétaire reçoit un e-mail pour créer son propre mot de passe.",
                "Après connexion, le propriétaire ne voit automatiquement que ses objets associés.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "L'accès propriétaire est strictement en lecture seule : seuls vous, en tant qu'établissement, pouvez modifier les prix, les disponibilités ou les données d'objet, pas le propriétaire lui-même.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pour en savoir plus sur l'association des objets, consultez [Associer un objet à un propriétaire](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
