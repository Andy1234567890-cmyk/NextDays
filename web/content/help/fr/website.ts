import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Créateur de site web",
  description: "Créez votre propre site de réservation avec le créateur de site.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Créateur de site web",
      articles: [
        {
          slug: "website-erstellen",
          title: "Créer un site web",
          excerpt: "Avec le créateur, vous mettez en place votre propre site de réservation en quelques minutes.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Le créateur de site web vous permet de créer votre propre site de réservation — un canal de vente supplémentaire en plus des portails et du marketplace myBestDays. Vous gardez un contrôle total sur la structure, le contenu et l'identité visuelle.",
            },
            { type: "h2", text: "Comment créer un site web" },
            {
              type: "steps",
              items: [
                "Ouvrez Site web dans le menu.",
                "Cliquez sur Créer un site web.",
                "Choisissez un modèle comme point de départ pour votre mise en page.",
                "Confirmez avec Créer le site web — vous accédez directement à l'éditeur.",
              ],
            },
            { type: "h2", text: "Ce que contient le créateur" },
            {
              type: "ul",
              items: [
                "Un éditeur visuel avec pages, calques et aperçu",
                "Des blocs prêts à l'emploi pour les listes de biens, les galeries et les formulaires de contact",
                "Un parcours de réservation direct basé sur la disponibilité de votre calendrier",
                "Des couleurs, polices et un logo personnalisables selon votre marque",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Commencez par un modèle proche de votre type de bien — hébergement de vacances ou hôtel — cela vous fera gagner du temps lors de la personnalisation des blocs par la suite.",
            },
            { type: "h2", text: "Prochaines étapes" },
            {
              type: "p",
              text: "Après la création, adaptez les pages et la mise en page, voir [Modifier les pages et la mise en page](/hilfe/website/seiten-layout), puis affichez vos biens sur le site web, voir [Afficher les biens sur le site web](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Modifier les pages et la mise en page",
          excerpt: "Personnalisez les pages, les calques et les blocs dans l'éditeur visuel.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "L'éditeur est organisé en trois zones : à gauche l'aperçu des pages et des calques, au centre la prévisualisation de votre site web, à droite les paramètres du bloc actuellement sélectionné.",
            },
            { type: "h2", text: "Modifier une page" },
            {
              type: "steps",
              items: [
                "Sélectionnez la page souhaitée à gauche, sous Pages.",
                "Cliquez sur un bloc dans l'aperçu pour le sélectionner.",
                "Ajustez à droite le texte, l'image ou l'espacement du bloc.",
                "Faites glisser les blocs par glisser-déposer pour modifier leur ordre.",
              ],
            },
            { type: "h2", text: "Ajouter de nouvelles pages et blocs" },
            {
              type: "p",
              text: "Le bouton Ajouter une page vous permet de créer d'autres sous-pages, par exemple À propos ou Contact. Au sein d'une page, le bouton Ajouter un bloc vous permet d'insérer de nouvelles sections telles que Galerie, Avis ou Formulaire de contact.",
            },
            {
              type: "ul",
              items: [
                "Accueil, Liste des biens et Contact sont préremplis dans chaque modèle",
                "D'autres pages peuvent être librement nommées et intégrées à la navigation",
                "Les blocs sont responsives et s'adaptent aux ordinateurs, tablettes et smartphones",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Les modifications dans l'éditeur ne sont d'abord qu'un brouillon. Seul un clic sur Publier les applique à votre site web public.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Connecter un domaine",
          excerpt: "Associez votre propre domaine à votre site web myNextDays.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Par défaut, votre site web est accessible via un sous-domaine myNextDays. Si vous souhaitez utiliser à la place votre propre domaine, par exemple votre-etablissement.fr, connectez-le dans la section Domaine.",
            },
            { type: "h2", text: "Renseigner un domaine" },
            {
              type: "steps",
              items: [
                "Ouvrez les paramètres du site web, puis Domaine.",
                "Saisissez votre propre domaine et cliquez sur Connecter.",
                "Créez chez votre fournisseur de domaine les enregistrements DNS affichés.",
                "Attendez la confirmation — la vérification s'effectue automatiquement en arrière-plan.",
              ],
            },
            { type: "h2", text: "Configurer correctement les enregistrements DNS" },
            {
              type: "p",
              text: "myNextDays vous indique précisément les enregistrements requis pour votre fournisseur de domaine. La connexion ne devient active qu'une fois ces enregistrements correctement configurés et propagés dans le monde entier — cela peut prendre quelques heures selon le fournisseur.",
            },
            {
              type: "ul",
              items: [
                "Configurez un enregistrement CNAME ou A selon les instructions affichées",
                "Supprimez au préalable les enregistrements existants contradictoires pour ce même domaine",
                "Le certificat https est délivré automatiquement une fois la connexion réussie",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Sans enregistrements DNS correctement configurés, votre site web reste inaccessible via votre propre domaine — vérifiez soigneusement l'orthographe par rapport aux indications de votre fournisseur.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Afficher les biens sur le site web",
          excerpt: "Vous contrôlez séparément, pour chaque bien, quels biens sont visibles et réservables via le site web.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Pour qu'un bien apparaisse sur votre site web, la visibilité Site web doit être activée pour ce bien. Ce réglage est indépendant de la visibilité sur le marketplace myBestDays ou sur les portails.",
            },
            { type: "h2", text: "Activer un bien pour le site web" },
            {
              type: "steps",
              items: [
                "Ouvrez le bien sous Biens.",
                "Passez à l'onglet Visibilité.",
                "Activez le commutateur Site web.",
                "Passez au site web et vérifiez le bloc Liste des biens dans l'aperçu.",
              ],
            },
            { type: "h2", text: "Ajuster l'ordre et l'affichage" },
            {
              type: "p",
              text: "Dans le bloc Liste des biens, vous définissez si les biens sont triés automatiquement selon la disponibilité ou si vous imposez un ordre fixe. Chaque bien affiche sa photo principale, son prix de base dans la devise renseignée et ses principales caractéristiques.",
            },
            {
              type: "ul",
              items: [
                "Tri automatique selon la disponibilité ou ordre manuel",
                "Filtres par type de bien ou équipements activables en option",
                "Le parcours de réservation se déroule directement sur le site web, sans détour par un portail",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Un bien dont la visibilité Site web n'est pas activée reste masqué de la liste des biens, même s'il est visible sur le marketplace ou sur les portails.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Publier le site web",
          excerpt: "Les brouillons ne deviennent visibles publiquement qu'après un clic sur Publier.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Tant que vous travaillez dans l'éditeur, vous êtes seul à voir le brouillon actuel. Seul un clic sur Publier rend les modifications visibles pour tous les visiteurs sur votre domaine.",
            },
            { type: "h2", text: "Comment publier" },
            {
              type: "steps",
              items: [
                "Ouvrez l'aperçu dans l'éditeur et vérifiez toutes les pages.",
                "Cliquez sur Publier en haut à droite.",
                "Confirmez la boîte de dialogue — le site web est en ligne immédiatement après.",
                "Ouvrez votre domaine dans un nouvel onglet pour vérifier le résultat.",
              ],
            },
            { type: "h2", text: "Brouillons et réinitialisation" },
            {
              type: "p",
              text: "Tant que vous n'avez pas encore publié, vous pouvez à tout moment revenir à la dernière version publiée sans perdre définitivement le brouillon — utilisez pour cela Annuler le brouillon dans les paramètres du site web.",
            },
            {
              type: "ul",
              items: [
                "Les modifications publiées sont immédiatement visibles sur votre domaine",
                "Un brouillon non publié reste interne jusqu'à ce que vous le confirmiez",
                "Chaque publication est enregistrée avec sa date dans l'historique",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Avant de publier, vérifiez l'affichage mobile dans l'aperçu — la plupart des clients consultent les sites de réservation depuis leur smartphone.",
            },
          ],
        },
      ],
    },
  ],
};
