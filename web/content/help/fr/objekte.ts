import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Objets et équipements",
  description: "Créer et gérer chambres et objets de vacances.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Gérer les objets",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Objet = une unité réservable",
          excerpt: "Pourquoi chaque objet dans myNextDays est exactement une unité réservable.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Dans myNextDays, un objet est toujours exactement une unité réservable — une chambre individuelle dans un hôtel ou un objet de vacances complet. Ce principe s'applique que vous exploitiez une maison de vacances, un appartement de vacances ou un hôtel, et constitue la base de la disponibilité, des prix et des réservations.",
            },
            { type: "h2", text: "Pas un bâtiment avec des chambres en dessous" },
            {
              type: "p",
              text: "Un malentendu fréquent consiste à représenter un bâtiment d'hôtel comme un seul objet regroupant plusieurs chambres. Ce n'est pas prévu dans myNextDays. Si vous exploitez par exemple un hôtel avec huit chambres doubles et quatre chambres simples, vous créez douze objets distincts — pas un objet avec un nombre de chambres.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Un champ tel que « nombre de chambres » au niveau de l'objet n'existe volontairement pas. Chaque chambre a besoin de son propre objet, avec son propre calendrier et ses propres prix.",
            },
            { type: "h2", text: "Objets de vacances" },
            {
              type: "p",
              text: "Pour une maison ou un appartement de vacances, l'objet entier correspond à l'unité réservable. Il n'y a pas de subdivision supplémentaire — un objet de vacances est toujours un objet autonome avec son propre calendrier.",
            },
            { type: "h2", text: "Pourquoi c'est important" },
            {
              type: "ul",
              items: [
                "Chaque objet dispose de son propre calendrier de disponibilité — les doubles réservations sont évitées objet par objet.",
                "Les prix, l'équipement et les photos s'appliquent par objet, pas par bâtiment.",
                "Un objet appartient toujours à exactement un propriétaire — pas d'attribution multiple.",
                "La visibilité par canal (site web, marketplace de la plateforme, portails) se gère par objet.",
              ],
            },
            {
              type: "p",
              text: "Pour savoir comment choisir le type d'objet adapté à votre chambre ou objet de vacances, consultez [Définir le type d'objet](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Définir le type d'objet",
          excerpt: "Attribuer correctement catégorie, type de bien et mode d'offre.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Le type d'objet détermine comment votre objet est classé et filtré sur les portails et sur la marketplace de la plateforme. Il se compose de trois champs de sélection qui s'enchaînent, à parcourir lors de la création ou de la modification d'un objet.",
            },
            { type: "h2", text: "Les trois niveaux de sélection" },
            {
              type: "steps",
              items: [
                "Choisissez d'abord la catégorie — par exemple hébergement de vacances ou hôtel.",
                "Choisissez ensuite le type de bien correspondant — par exemple appartement de vacances, maison de vacances, chambre double ou chambre simple.",
                "Choisissez le mode d'offre — par exemple l'objet entier ou une chambre privée.",
                "Complétez les champs supplémentaires qui s'affichent selon votre sélection, par exemple le type de lit ou l'étage.",
              ],
            },
            { type: "h2", text: "Pourquoi l'ordre est important" },
            {
              type: "p",
              text: "Les trois listes déroulantes dépendent les unes des autres : le choix de la catégorie limite les types de biens disponibles, et le choix du type de bien limite à son tour les modes d'offre. Cela garantit uniquement des combinaisons cohérentes, comme celles utilisées sur les grands portails.",
            },
            {
              type: "note",
              variant: "info",
              text: "Si vous modifiez la catégorie a posteriori, myNextDays vérifie si le type de bien et le mode d'offre restent cohérents et vous invite, le cas échéant, à les redéfinir.",
            },
            { type: "h2", text: "Modifier le type d'objet" },
            {
              type: "p",
              text: "Ouvrez l'objet souhaité dans le menu Objets et passez à l'onglet Données de base. Vous y trouverez les trois listes déroulantes sous Type d'objet. En enregistrant votre modification, la nouvelle classification est transmise à tous les canaux actifs.",
            },
            {
              type: "ul",
              items: [
                "Catégorie : classification générale (p. ex. hébergement de vacances, hôtel)",
                "Type de bien : type d'objet concret (p. ex. appartement de vacances, chambre double)",
                "Mode d'offre : ce qui est exactement réservé (p. ex. objet entier, chambre privée)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Gérer l'équipement",
          excerpt: "Sélectionner les caractéristiques d'équipement et les tenir à jour.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "L'équipement d'un objet influence fortement sa visibilité et son filtrage sur les portails. Les voyageurs filtrent spécifiquement par caractéristiques telles que le Wi-Fi, la cuisine ou le parking — des informations manquantes peuvent exclure un objet des résultats de recherche.",
            },
            { type: "h2", text: "Sélectionner l'équipement" },
            {
              type: "steps",
              items: [
                "Ouvrez l'objet et passez à l'onglet Équipement.",
                "Sélectionnez toutes les caractéristiques applicables dans la liste proposée.",
                "Complétez si nécessaire des détails tels que le nombre de places de parking ou le type de cuisine.",
                "Enregistrez les modifications — elles sont transmises automatiquement à tous les portails actifs.",
              ],
            },
            { type: "h2", text: "D'où proviennent les caractéristiques" },
            {
              type: "p",
              text: "La liste d'équipement suit le catalogue de caractéristiques des grands portails, afin que vos informations y soient correctement classées. Les caractéristiques librement inventées ne sont pas prévues, car elles ne pourraient pas être transmises correctement aux portails.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Vérifiez l'équipement après chaque modification structurelle — par exemple une nouvelle climatisation ou une salle de bain supplémentaire — afin que les informations restent à jour sur tous les canaux.",
            },
            { type: "h2", text: "Groupes de caractéristiques fréquents" },
            {
              type: "ul",
              items: [
                "Équipement de base : Wi-Fi, chauffage, climatisation",
                "Cuisine et restauration : cuisine entièrement équipée, lave-vaisselle, machine à café",
                "Salle de bain et linge : salle de bain privative, lave-linge, serviettes",
                "Extérieur : balcon, terrasse, jardin, parking",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Photos et description",
          excerpt: "Des images et des textes convaincants pour plus de réservations.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Les photos et la description constituent le critère de décision le plus important pour les voyageurs. Un objet ne peut être publié que si au moins une photo de couverture et une description sont renseignées.",
            },
            { type: "h2", text: "Téléverser des photos" },
            {
              type: "steps",
              items: [
                "Ouvrez l'objet et passez à l'onglet Photos.",
                "Glissez des fichiers image dans la zone de dépôt ou sélectionnez-les via la boîte de dialogue de fichiers.",
                "Définissez une photo de couverture — elle apparaît dans les résultats de recherche et les vignettes.",
                "Réorganisez les autres photos par glisser-déposer dans un ordre pertinent.",
              ],
            },
            { type: "h2", text: "Rédiger la description" },
            {
              type: "p",
              text: "Passez à l'onglet Description et saisissez un titre ainsi qu'un texte. Décrivez précisément l'emplacement, les particularités et le public cible de l'objet — des formules générales sont moins convaincantes sur les portails que des détails concrets.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Les photos d'autres objets ou trouvées sur Internet ne doivent pas être utilisées — les portails le vérifient et peuvent suspendre des objets en cas d'infraction.",
            },
            { type: "h2", text: "Recommandations pour de bonnes photos" },
            {
              type: "ul",
              items: [
                "Au moins cinq photos, idéalement une par pièce",
                "Format paysage, bonne luminosité, pas de filigrane",
                "La photo de couverture montre l'objet de façon accueillante et claire",
                "Mise à jour régulière, en particulier après des rénovations",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Occupation et capacité",
          excerpt: "Renseigner correctement le nombre maximal de voyageurs et la répartition des lits.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "L'occupation détermine combien de voyageurs un objet peut accueillir, et elle est vérifiée à chaque recherche et réservation. Des informations erronées entraînent soit des demandes refusées, soit une suroccupation — les deux sont à éviter.",
            },
            { type: "h2", text: "Renseigner l'occupation" },
            {
              type: "steps",
              items: [
                "Ouvrez l'objet et passez à l'onglet Occupation.",
                "Saisissez le nombre maximal d'adultes.",
                "Saisissez le nombre maximal d'enfants, s'ils sont autorisés.",
                "Renseignez la répartition des lits par pièce, par exemple un lit double et deux lits simples.",
              ],
            },
            { type: "h2", text: "Limites de l'occupation" },
            {
              type: "p",
              text: "Lors d'une demande de réservation, myNextDays vérifie automatiquement si le nombre de voyageurs demandé se situe dans l'occupation renseignée. Les demandes dépassant la capacité maximale sont refusées, ou ne sont même pas affichées comme réservables.",
            },
            {
              type: "note",
              variant: "info",
              text: "Un lit d'appoint ou un lit bébé n'augmente la capacité réelle que si vous le renseignez explicitement dans la répartition des lits — sinon le nombre maximal de voyageurs reste inchangé.",
            },
            { type: "h2", text: "Erreurs fréquentes" },
            {
              type: "ul",
              items: [
                "Nombre maximal de voyageurs fixé trop haut alors que peu de lits sont disponibles",
                "Nombre d'enfants oublié alors que l'objet s'adresse aux familles",
                "Répartition des lits non mise à jour après une rénovation",
              ],
            },
            {
              type: "p",
              text: "Si l'occupation et l'équipement ne correspondent pas, vérifiez également l'onglet [Équipement](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Statut et visibilité de l'objet",
          excerpt: "Différence entre actif/inactif et les trois axes de canaux.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "myNextDays distingue deux notions souvent confondues : le statut de l'objet (actif ou inactif) et la visibilité sur chaque canal de vente. Vous gérez les deux séparément.",
            },
            { type: "h2", text: "Statut de l'objet" },
            {
              type: "p",
              text: "Le statut active signifie qu'un objet est fondamentalement vendable. Le statut inactive met un objet complètement hors service — par exemple lors d'une rénovation de longue durée. Un objet inactif n'est réservable sur aucun canal, indépendamment des réglages de canaux.",
            },
            { type: "h2", text: "Les trois axes de canaux" },
            {
              type: "p",
              text: "Si un objet est actif, trois interrupteurs indépendants déterminent où exactement il est visible :",
            },
            {
              type: "ul",
              items: [
                "Site web — visibilité sur votre propre site myNextDays",
                "Marketplace de la plateforme — visibilité sur la marketplace globale myBestDays",
                "Portails — visibilité sur Booking, Airbnb & Co.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ces trois axes sont entièrement indépendants du statut de l'objet et les uns des autres. Un objet actif peut par exemple n'être visible que sur le site web, mais pas sur les portails.",
            },
            { type: "h2", text: "Modifier le statut" },
            {
              type: "steps",
              items: [
                "Ouvrez l'objet et passez à l'onglet Vue d'ensemble.",
                "Réglez le statut sur actif ou inactif.",
                "Ajustez si nécessaire également les trois interrupteurs de canaux dans l'onglet Visibilité.",
                "Enregistrez la modification — elle s'applique immédiatement sur tous les canaux concernés.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Pour un blocage ponctuel de certains jours, utilisez plutôt le Stop-Sell dans le calendrier — il bloque de façon ciblée des jours sur tous les canaux, sans désactiver l'objet entier.",
            },
          ],
        },
      ],
    },
  ],
};
