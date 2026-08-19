import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Premiers pas",
  description: "Configurer votre compte et démarrer en quelques minutes.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Configuration",
      articles: [
        {
          slug: "willkommen",
          title: "Bienvenue chez myNextDays",
          excerpt: "Un aperçu du PMS, du gestionnaire de canaux, de la marketplace et de l'application.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "myNextDays est votre plateforme centrale pour les objets de vacances et les hôtels. Au lieu de plusieurs solutions isolées, vous gérez disponibilité, prix, réservations et communication avec les voyageurs en un seul endroit — que vous exploitiez une seule maison de vacances ou plusieurs chambres d'hôtel.",
            },
            { type: "h2", text: "Les quatre piliers" },
            {
              type: "ul",
              items: [
                "PMS (système de gestion immobilière) : objets, calendrier, prix, réservations, tâches et paiements.",
                "Gestionnaire de canaux : connexion à des portails comme Booking, Airbnb & Co. — une seule saisie, plusieurs portails synchronisés.",
                "Marketplace de la plateforme : la marketplace myBestDays propre, un canal de réservation à part entière aux côtés des portails.",
                "Application : l'application mobile pour voyageurs, propriétaires et employés, avec les mêmes données que sur le web.",
              ],
            },
            { type: "h2", text: "Comment les piliers s'articulent" },
            {
              type: "p",
              text: "Vous gérez l'objet, les prix et la disponibilité une seule fois, de façon centralisée dans le PMS. À partir de là, myNextDays distribue automatiquement les données à tous les canaux actifs. Une réservation — quel que soit le canal par lequel elle arrive — bloque immédiatement les nuits correspondantes partout, ce qui exclut les doubles réservations.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Commencez par configurer le compte et l'établissement, puis créez votre premier objet — cet ordre vous évite des corrections ultérieures.",
            },
            { type: "h2", text: "Prochaines étapes" },
            {
              type: "steps",
              items: [
                "Ouvrez le menu Compte et complétez les informations de votre établissement.",
                "Créez votre premier objet dans le menu Objets.",
                "Vérifiez que l'équipement, les photos et les prix sont complets.",
                "Cliquez sur Publier pour rendre l'objet visible sur tous les canaux.",
              ],
            },
            {
              type: "p",
              text: "Pour en savoir plus sur chaque étape, consultez [Configurer le compte et l'établissement](/hilfe/erste-schritte/konto-einrichten) et [Créer votre premier objet](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Configurer le compte et l'établissement",
          excerpt: "Renseigner correctement les données de base, l'adresse de facturation et la devise.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Avant de créer des objets, configurez votre établissement dans le compte. Ces données sont nécessaires pour les factures, les portails et le décompte avec myNextDays, et doivent donc être complètes et exactes.",
            },
            { type: "h2", text: "Renseigner les données de base" },
            {
              type: "steps",
              items: [
                "Ouvrez le menu Compte.",
                "Saisissez sous Données de base le nom de l'entreprise ou de l'entreprise individuelle, l'adresse et les coordonnées.",
                "Renseignez l'adresse de facturation — elle apparaît sur toutes les factures émises.",
                "Choisissez votre devise de base. Elle s'applique à tous les prix, jusqu'à ce que vous la modifiiez spécifiquement par objet.",
              ],
            },
            { type: "h2", text: "Pourquoi la devise est importante" },
            {
              type: "p",
              text: "La devise n'est ni devinée ni complétée automatiquement : si elle est absente, aucun prix ne peut être affiché ou facturé correctement. C'est pourquoi myNextDays exige un choix conscient lors de la configuration, plutôt que d'utiliser une valeur par défaut.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Si vous modifiez la devise d'un objet a posteriori, tous les plans tarifaires qui en dépendent sont également mis à jour. Vérifiez ensuite les prix une fois.",
            },
            { type: "h2", text: "Adresse de facturation et facturation" },
            {
              type: "p",
              text: "Sous Facturation dans le compte, vous voyez vos factures en cours et l'adresse de facturation renseignée. Tenez-la à jour, en particulier lors d'un changement de forme juridique ou d'adresse, afin que les factures soient émises correctement.",
            },
            {
              type: "ul",
              items: [
                "Nom de l'entreprise ou de l'entreprise individuelle",
                "Adresse de facturation avec le pays",
                "Numéro fiscal ou de TVA intracommunautaire, le cas échéant",
                "Devise de base pour les nouveaux objets",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Créer votre premier objet",
          excerpt: "Comment créer étape par étape votre premier objet réservable.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Un objet dans myNextDays est toujours exactement une unité réservable : soit une chambre individuelle dans un hôtel, soit un objet de vacances complet. Si vous exploitez un hôtel avec plusieurs chambres, créez un objet distinct pour chaque chambre.",
            },
            { type: "h2", text: "Créer un objet" },
            {
              type: "steps",
              items: [
                "Ouvrez le menu Objets.",
                "Cliquez sur Ajouter un objet.",
                "Choisissez le type d'objet : catégorie, type de bien et mode d'offre.",
                "Complétez l'adresse, l'occupation et le prix de base dans votre devise renseignée.",
                "Enregistrez l'objet comme brouillon pour le compléter plus tard.",
              ],
            },
            { type: "h2", text: "Ce qu'il manque ensuite" },
            {
              type: "p",
              text: "Un objet nouvellement créé est d'abord un brouillon et n'est visible sur aucun canal. Complétez l'équipement, les photos, la description et la disponibilité du calendrier avant de le publier — seul un objet complet peut être commercialisé de façon fiable.",
            },
            {
              type: "ul",
              items: [
                "Sélectionner les caractéristiques d'équipement dans la liste de la catégorie",
                "Renseigner au moins une photo de couverture et une description",
                "Saisir correctement l'occupation (adultes, enfants, lits)",
                "Vérifier le prix de base et la disponibilité du calendrier",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Si vous exploitez plusieurs types de chambres, répétez cette procédure pour chaque chambre — il n'existe pas de niveau de bâtiment supérieur regroupant des chambres en dessous.",
            },
            {
              type: "p",
              text: "Une fois tous les champs obligatoires remplis, vous pouvez publier l'objet, voir [Publier un objet](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Publier un objet",
          excerpt: "Un clic active ensemble la marketplace de la plateforme, les portails et le site web.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "La publication rend un objet visible et réservable. Dans le cas normal, un seul clic suffit pour activer simultanément les trois canaux de vente — vous pouvez toutefois ajuster la visibilité de chaque canal individuellement à tout moment.",
            },
            { type: "h2", text: "Comment publier" },
            {
              type: "steps",
              items: [
                "Ouvrez l'objet sous Objets.",
                "Vérifiez dans l'onglet Vue d'ensemble que toutes les informations obligatoires sont marquées en vert.",
                "Cliquez sur Publier.",
                "Confirmez la boîte de dialogue — la marketplace de la plateforme, les portails et le site web sont activés.",
              ],
            },
            { type: "h2", text: "Piloter les canaux individuellement" },
            {
              type: "p",
              text: "Après la publication, vous trouvez dans l'onglet Visibilité trois interrupteurs distincts : Site web, Marketplace de la plateforme et Portails. Si vous souhaitez par exemple proposer un objet uniquement sur votre propre site web, mais pas via les portails, désactivez simplement l'interrupteur correspondant.",
            },
            {
              type: "ul",
              items: [
                "Site web : visibilité sur votre propre site myNextDays",
                "Marketplace de la plateforme : visibilité sur la marketplace globale myBestDays",
                "Portails : visibilité sur Booking, Airbnb & Co.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ces trois interrupteurs sont indépendants du statut de l'objet (actif/inactif). Un objet actif peut malgré tout être invisible sur certains canaux.",
            },
            { type: "h2", text: "Bloquer temporairement un objet" },
            {
              type: "p",
              text: "Si vous souhaitez bloquer un seul jour plutôt que l'objet entier, utilisez le Stop-Sell dans le calendrier — il bloque le jour sur tous les canaux simultanément, indépendamment des interrupteurs de visibilité.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Comprendre les trois canaux de vente",
          excerpt: "Portails, marketplace de la plateforme et application en un coup d'œil.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "myNextDays commercialise chaque objet simultanément via plusieurs voies équivalentes. Comprendre comment elles s'articulent vous aide à piloter précisément visibilité et prix.",
            },
            { type: "h2", text: "Portails" },
            {
              type: "p",
              text: "Via le gestionnaire de canaux, vous connectez votre objet aux grands portails de réservation comme Booking, Airbnb & Co. Disponibilité et prix sont synchronisés automatiquement, si bien que vous n'avez pas à gérer manuellement plusieurs calendriers de portails.",
            },
            { type: "h2", text: "Marketplace de la plateforme" },
            {
              type: "p",
              text: "La marketplace myBestDays est un canal de réservation propre et global — comparable à Booking ou Airbnb, mais faisant partie de la même plateforme. Ce n'est pas un substitut de « réservation directe », mais un canal à part entière avec son propre axe de visibilité.",
            },
            { type: "h2", text: "Application" },
            {
              type: "p",
              text: "L'application mobile donne aux voyageurs, propriétaires et employés accès aux mêmes données que le web — par exemple les détails de réservation, les messages ou les tâches, selon le rôle respectif.",
            },
            { type: "h2", text: "Trois axes de visibilité distincts" },
            {
              type: "ul",
              items: [
                "Site web — votre propre site myNextDays",
                "Marketplace de la plateforme — la marketplace globale myBestDays",
                "Portails — Booking, Airbnb & Co. via le gestionnaire de canaux",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Les trois axes sont activables indépendamment les uns des autres. Le Stop-Sell et le statut de l'objet, en revanche, agissent sur tous les canaux simultanément.",
            },
          ],
        },
      ],
    },
  ],
};
