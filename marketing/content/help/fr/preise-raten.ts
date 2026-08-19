import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Prix et tarifs",
  description: "Plans tarifaires, prix saisonniers et prix dynamiques.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Tarification",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Prix de base et devise",
          excerpt: "Comment définir le prix de base et attribuer la bonne devise à votre objet.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Chaque objet dans myNextDays est exactement une unité réservable — une chambre individuelle ou un objet de vacances. Pour cette unité, vous définissez un prix de base ainsi qu'une devise centrale, qui s'applique à l'objet dans son ensemble.",
            },
            { type: "h2", text: "Définir la devise de façon centrale" },
            {
              type: "p",
              text: "La devise de l'objet est définie une fois par objet et s'applique automatiquement à tous les plans tarifaires que vous créez pour cet objet. Il n'existe pas de devise de secours : si la devise est absente, vous ne pouvez pas enregistrer de prix.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez votre objet sous « Objets ».",
                "Passez à l'onglet « Prix ».",
                "Choisissez la devise appropriée sous « Devise de l'objet ».",
                "Saisissez le prix de base pour l'occupation standard.",
                "Enregistrez les modifications.",
              ],
            },
            { type: "h2", text: "Ce qui se passe lors d'un changement de devise" },
            {
              type: "p",
              text: "Si vous modifiez la devise de l'objet a posteriori, cela affecte tous les plans tarifaires existants de cet objet, car ils sont toujours gérés dans la devise de l'objet. Vérifiez ensuite vos prix avant de les retransmettre aux portails.",
            },
            {
              type: "ul",
              items: [
                "Un objet a exactement une devise — pas plusieurs par plan tarifaire.",
                "Le prix de base est la valeur de départ pour les tarifs dérivés.",
                "Les montants sont toujours affichés dans la devise de l'objet définie.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Sans devise définie, aucun prix ne peut être enregistré et aucun tarif ne peut être transmis aux portails. Vérifiez cela en premier si une modification de prix échoue.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pour en savoir plus sur les tarifs dérivés, consultez [Tarifs dérivés](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Créer des plans tarifaires",
          excerpt: "Les plans tarifaires regroupent prix, conditions d'annulation et restauration pour un objet.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Un plan tarifaire définit les conditions dans lesquelles un objet peut être réservé : prix, règles d'annulation, restauration et durée minimale de séjour. Un objet peut proposer plusieurs plans tarifaires simultanément, par exemple un plan flexible et un plan non remboursable.",
            },
            { type: "h2", text: "Créer un nouveau plan tarifaire" },
            {
              type: "steps",
              items: [
                "Ouvrez l'objet et passez à l'onglet « Prix ».",
                "Cliquez sur « Créer un nouveau plan tarifaire ».",
                "Donnez-lui un nom explicite, par exemple « Flexible » ou « Non remboursable ».",
                "Déterminez s'il s'agit d'un tarif de base ou d'un tarif dérivé.",
                "Renseignez les conditions d'annulation et la restauration.",
                "Enregistrez et activez le plan tarifaire.",
              ],
            },
            { type: "h2", text: "Tarif de base contre autres plans tarifaires" },
            {
              type: "p",
              text: "Créez d'abord votre tarif de base (souvent appelé « BAR », Best Available Rate). Tous les autres plans tarifaires peuvent soit être gérés de façon autonome, soit être dérivés de ce tarif de base.",
            },
            {
              type: "ul",
              items: [
                "Tarif de base : prix de base par nuit géré manuellement.",
                "Autres plans tarifaires : autonomes ou en majoration/réduction par rapport au tarif de base.",
                "Chaque plan tarifaire peut être transmis individuellement aux portails.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Limitez le nombre de plans tarifaires par objet — trop de variantes compliquent la comparaison pour les voyageurs et augmentent la charge de gestion.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pour les détails sur les majorations et réductions, consultez [Tarifs dérivés](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Tarifs dérivés",
          excerpt: "Les plans tarifaires dérivés se calculent automatiquement à partir d'un tarif de base.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Un tarif dérivé est un plan tarifaire dont le prix n'est pas géré manuellement, mais calculé automatiquement à partir d'un tarif de base — sous forme de majoration, de réduction fixe ou de pourcentage. Cela réduit la charge de gestion, car une modification de prix sur le tarif de base met automatiquement à jour tous les plans dérivés.",
            },
            { type: "h2", text: "Exemple typique" },
            {
              type: "p",
              text: "Un schéma fréquent est un plan avec petit-déjeuner, dérivé du tarif de base sans restauration : le prix du petit-déjeuner est défini comme une majoration par nuit et par personne sur le tarif de base. Si vous modifiez le tarif de base, le prix du petit-déjeuner s'ajuste automatiquement.",
            },
            { type: "h2", text: "Configurer un tarif dérivé" },
            {
              type: "steps",
              items: [
                "Ouvrez le plan tarifaire souhaité dans l'onglet « Prix ».",
                "Choisissez comme source de prix « Dérivé de … » et le tarif de base correspondant.",
                "Déterminez si la différence s'applique en montant fixe ou en pourcentage.",
                "Déterminez s'il s'agit d'une majoration ou d'une réduction.",
                "Enregistrez l'association.",
              ],
            },
            {
              type: "ul",
              items: [
                "Majoration : par exemple restauration, annulation possible plus tardivement.",
                "Réduction : par exemple plan non remboursable avec avantage de prix.",
                "Le tarif de base reste la seule source gérée manuellement.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Un tarif dérivé ne peut pas être écrasé manuellement en même temps. Supprimez d'abord la dérivation si vous souhaitez fixer un prix individuel différent.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Prix saisonniers et de week-end",
          excerpt: "Adapter précisément les prix pour les périodes saisonnières et les week-ends.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "La demande varie au fil de l'année et au sein de la semaine. Avec les prix saisonniers et de week-end, vous ajustez le prix de base pour certaines périodes ou certains jours de la semaine, sans devoir passer par le calendrier jour par jour.",
            },
            { type: "h2", text: "Créer une période saisonnière" },
            {
              type: "steps",
              items: [
                "Ouvrez dans l'objet l'onglet « Prix » puis la section « Prix saisonniers ».",
                "Créez une nouvelle période avec une date de début et une date de fin.",
                "Renseignez le prix ou l'écart en pourcentage par rapport au prix de base pour cette période.",
                "Enregistrez la période saisonnière.",
              ],
            },
            { type: "h2", text: "Prix de week-end" },
            {
              type: "p",
              text: "Vous pouvez en outre appliquer une majoration propre à certains jours de la semaine, par exemple le vendredi et le samedi. Cette majoration s'applique en plus du prix saisonnier ou de base en vigueur.",
            },
            {
              type: "ul",
              items: [
                "Les prix saisonniers s'appliquent à des périodes continues.",
                "Les prix de week-end s'appliquent par jour de la semaine, indépendamment de la saison.",
                "Les deux règles peuvent être combinées.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Si plusieurs périodes saisonnières se chevauchent, la règle créée en dernier, ou la plus spécifique, s'applique. Vérifiez le calendrier après l'enregistrement.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Pour des ajustements automatiques basés sur la demande, les [Prix dynamiques](/hilfe/preise-raten/dynamische-preise) constituent un complément adapté.",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Prix dynamiques",
          excerpt: "Adapter automatiquement les prix à la demande, au délai de réservation et au taux d'occupation.",
          updated: "Mise à jour : août 2026",
          body: [
            {
              type: "note",
              variant: "info",
              text: "Les tarifs dynamiques sont un module payant. Vous l’activez dans « Extensions », où le prix est également indiqué. Sans ce module, l’automatisation ne calcule rien.",
            },
            {
              type: "p",
              text: "Les prix dynamiques ajustent automatiquement le prix de base en fonction de facteurs tels que le délai de réservation, le taux d'occupation actuel et la demande — de façon similaire à ce que font les grands portails avec leurs propres recommandations de prix. Vous réagissez ainsi aux évolutions du marché sans devoir ajuster manuellement chaque jour.",
            },
            { type: "h2", text: "Activer les prix dynamiques" },
            {
              type: "steps",
              items: [
                "Souscrivez le module dans « Outils → Extensions » — sans module souscrit, l'automatisme ne calcule pas.",
                "Ouvrez « Distribution → Tarification dynamique » dans le menu principal.",
                "Dans le tableau des objets, cliquez sur l'icône crayon de l'objet souhaité (« Définir le prix de base »).",
                "Choisissez la stratégie de prix de base : basée sur les données ou un prix de base fixe.",
                "Définissez un prix minimum et un prix maximum, puis réglez « Sensibilité au taux d'occupation (%) » pour déterminer l'influence du taux d'occupation.",
                "Activez « Tarification dynamique active » et enregistrez.",
              ],
            },
            { type: "h2", text: "Limites et sécurité" },
            {
              type: "p",
              text: "Le prix plancher et le prix plafond empêchent l'algorithme automatique de fixer des prix intenables pour votre établissement. Les plans tarifaires dérivés suivent automatiquement le tarif de base calculé de façon dynamique.",
            },
            {
              type: "ul",
              items: [
                "Le prix plancher protège contre des prix trop bas en cas de faible demande.",
                "Le prix plafond protège contre des prix excessifs en cas de forte demande.",
                "Les tarifs dérivés reprennent automatiquement le nouveau tarif de base.",
                "Un prix journalier saisi manuellement dans le calendrier prime toujours sur l'automatisme.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Les prix dynamiques n'agissent que sur le tarif de base. Les plans tarifaires fixés manuellement, sans dérivation, ne changent pas automatiquement.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Remises de séjour",
          excerpt: "Mettre en place des remises pour les séjours plus longs et les réservations anticipées.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Les remises de séjour récompensent les voyageurs pour des réservations plus longues ou une réservation anticipée. Elles s'appliquent en pourcentage sur le prix total du séjour et peuvent être configurées indépendamment par objet.",
            },
            { type: "h2", text: "Types de remises" },
            {
              type: "ul",
              items: [
                "Remise longue durée : à partir d'un certain nombre de nuits, par exemple à partir de 7 ou 28 nuits.",
                "Remise réservation anticipée : en cas de réservation suffisamment en avance.",
                "Remise dernière minute : en cas de réservation de dernière minute, proche de la date d'arrivée.",
              ],
            },
            { type: "h2", text: "Configurer une remise" },
            {
              type: "steps",
              items: [
                "Ouvrez dans l'objet l'onglet « Prix » puis la section « Remises ».",
                "Choisissez le type de remise souhaité.",
                "Définissez le seuil, par exemple le nombre minimal de nuits ou le délai de réservation.",
                "Saisissez la remise en pourcentage.",
                "Enregistrez la règle.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Les remises s'appliquent au prix total du plan tarifaire concerné et sont déjà affichées au voyageur dans l'aperçu des prix.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Combinez les remises longue durée avec [Durée de séjour minimale et maximale](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt) pour encourager spécifiquement les réservations plus longues.",
            },
          ],
        },
      ],
    },
  ],
};
