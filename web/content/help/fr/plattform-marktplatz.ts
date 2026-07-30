import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Plateforme (marketplace)",
  description: "Vendre sur la marketplace myNextDays.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Marketplace",
      articles: [
        {
          slug: "der-marktplatz",
          title: "La marketplace myNextDays",
          excerpt:
            "La marketplace mondiale myNextDays est un canal de réservation à part entière, aux côtés des portails et du site web.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "La marketplace myNextDays (/plattform) est le canal de réservation mondial de myNextDays lui-même — comparable à Booking ou Airbnb, mais faisant partie de la même plateforme. Les clients y parcourent les objets de tous les établissements affiliés et réservent directement.",
            },
            { type: "h2", text: "Pas un canal « direct », mais un canal à part entière" },
            {
              type: "p",
              text: "La marketplace ne remplace pas la réservation directe via votre propre site web. Elle constitue un troisième canal de distribution autonome, avec son propre axe de visibilité, sa propre clientèle et sa propre commission — exactement comme un portail, à ceci près qu'elle est exploitée par myNextDays lui-même.",
            },
            { type: "h2", text: "Comment les objets arrivent sur la marketplace" },
            {
              type: "ul",
              items: [
                "L'objet doit être actif (le statut de l'objet autorise la vente).",
                "La visibilité marketplace doit être activée — indépendamment des portails et du site web.",
                "Une disponibilité doit exister dans le calendrier pour la période souhaitée.",
              ],
            },
            { type: "h2", text: "Réservations issues de la marketplace" },
            {
              type: "p",
              text: "Une réservation marketplace bloque immédiatement les nuits correspondantes sur tous les autres canaux — exactement comme une réservation issue d'un portail ou du site web. Elle apparaît dans votre calendrier et dans les réservations comme n'importe quelle autre réservation, avec le canal « Plateforme » indiqué.",
            },
            {
              type: "note",
              variant: "info",
              text: "Le stop-sell et un statut d'objet inactif agissent sur l'ensemble des canaux et bloquent également la marketplace — indépendamment de l'activation de la visibilité marketplace.",
            },
            {
              type: "p",
              text: "Pour savoir comment activer un objet sur la marketplace, consultez [Lister un objet sur la marketplace](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Lister un objet sur la marketplace",
          excerpt: "La visibilité marketplace est un interrupteur distinct, indépendant des portails et du site web.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Vous contrôlez la visibilité sur la marketplace via un interrupteur propre à l'objet — indépendamment du fait que ce même objet soit aussi visible sur des portails ou votre site web.",
            },
            { type: "h2", text: "Comment lister un objet" },
            {
              type: "steps",
              items: [
                "Ouvrez l'objet dans Objets.",
                "Accédez à l'onglet Visibilité.",
                "Activez l'interrupteur Marketplace de la plateforme.",
                "Vérifiez que le statut de l'objet est actif et qu'une disponibilité existe dans le calendrier.",
              ],
            },
            { type: "h2", text: "Condition requise : un profil complet" },
            {
              type: "p",
              text: "La marketplace n'affiche que les objets dont les informations sont complètes — photo principale, description, équipements et prix de base doivent être renseignés. En l'absence d'informations obligatoires, l'objet reste invisible même si l'interrupteur est activé.",
            },
            {
              type: "ul",
              items: [
                "Au moins une photo principale et une description",
                "Des équipements issus de la liste de catégories",
                "Capacité d'accueil et prix de base dans la devise définie pour l'objet",
                "Disponibilité dans le calendrier pour la période souhaitée",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "En cliquant sur Publier, myNextDays active en principe la marketplace, les portails et le site web ensemble — vous pouvez ensuite désactiver l'interrupteur marketplace individuellement à tout moment.",
            },
            { type: "h2", text: "Retirer la visibilité" },
            {
              type: "p",
              text: "Si vous désactivez l'interrupteur Marketplace de la plateforme, l'objet disparaît de la recherche marketplace. Les réservations déjà confirmées n'en sont pas affectées et se poursuivent normalement, voir [Commission marketplace](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Commission marketplace",
          excerpt: "Pour chaque réservation conclue via la marketplace, la commission définie dans votre tarif s'applique.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Comme pour tout portail de réservation, une commission s'applique aux réservations conclues via la marketplace myNextDays. Elle est calculée par réservation et indépendante des commissions éventuelles appliquées aux portails.",
            },
            { type: "h2", text: "Comment la commission est calculée" },
            {
              type: "p",
              text: "Son montant dépend de la commission définie dans le tarif de votre établissement. Vous trouvez le taux actuel à tout moment sous Compte, dans la section Facturation — aucune valeur forfaitaire n'y est présumée, seul le taux réellement applicable à votre tarif est affiché.",
            },
            { type: "h2", text: "Où consulter la commission" },
            {
              type: "steps",
              items: [
                "Ouvrez Compte dans le menu.",
                "Accédez à la section Facturation.",
                "Ouvrez une réservation marketplace pour voir le détail du chiffre d'affaires et de la commission.",
                "Consultez la vue d'ensemble des commissions pour la période de facturation en cours.",
              ],
            },
            { type: "h2", text: "Distinction avec les commissions de portail" },
            {
              type: "ul",
              items: [
                "La commission marketplace s'applique exclusivement aux réservations via la marketplace myNextDays.",
                "Les réservations via portail (Booking, Airbnb & Co.) sont soumises aux conditions du portail concerné.",
                "Les réservations via le site web sont soumises aux conditions définies pour votre tarif, sans commission marketplace.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "La commission est déterminée automatiquement à partir de votre tarif. Un tarif manquant ou ambigu génère un message d'erreur explicite plutôt qu'une valeur estimée.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Profil client et avis",
          excerpt: "Les clients de la marketplace disposent d'un profil avec l'historique de leurs réservations et peuvent laisser des avis.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Les clients qui réservent via la marketplace myNextDays créent leur propre profil client. Celui-ci rassemble leurs réservations, leurs messages avec les établissements et les avis qu'ils ont déposés — comme pour un compte client de portail.",
            },
            { type: "h2", text: "Ce que vous voyez en tant qu'établissement" },
            {
              type: "p",
              text: "Dans le détail d'une réservation marketplace, vous trouvez le profil du client avec ses séjours précédents dans votre établissement et, si le client l'a autorisé, ses avis publics visibles sur d'autres hébergements.",
            },
            { type: "h2", text: "Avis après le séjour" },
            {
              type: "steps",
              items: [
                "Après le check-out, le client reçoit une invitation à laisser un avis.",
                "L'avis apparaît, après une brève vérification, sur la page de l'objet dans la marketplace.",
                "En tant qu'établissement, vous pouvez répondre publiquement à chaque avis.",
                "Les avis inappropriés ou abusifs peuvent être signalés pour vérification via Signaler.",
              ],
            },
            {
              type: "ul",
              items: [
                "Les avis sont liés à une réservation effective — pas d'avis sans séjour.",
                "Le client évalue la propreté, la communication, l'emplacement et le rapport qualité-prix.",
                "Votre réponse est visible par tous les visiteurs de la marketplace.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "De bons avis ont un impact direct sur le classement de votre objet dans la recherche marketplace — réagissez rapidement et avec objectivité aux critiques.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Personnes bloquées",
          excerpt: "Un établissement peut bloquer un client, empêchant ainsi tout message et toute réservation.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "En cas de problème avec un client, vous pouvez le bloquer en tant qu'établissement. Une personne bloquée ne peut plus vous envoyer de messages ni effectuer de nouvelle réservation auprès de votre établissement.",
            },
            { type: "h2", text: "Bloquer une personne" },
            {
              type: "steps",
              items: [
                "Ouvrez la conversation ou la réservation concernant le client en question.",
                "Cliquez sur Bloquer le client.",
                "Confirmez la fenêtre — le blocage prend effet immédiatement.",
                "La personne bloquée apparaît ensuite dans Compte, sous Personnes bloquées.",
              ],
            },
            { type: "h2", text: "Effets du blocage" },
            {
              type: "ul",
              items: [
                "Le client ne peut plus envoyer de nouveaux messages à votre établissement.",
                "Le client ne peut plus effectuer de nouvelle réservation auprès de votre établissement.",
                "Une réservation en cours avec une arrivée déjà confirmée dans les deux prochaines semaines n'est pas affectée par le blocage, afin que le séjour puisse se dérouler normalement.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Le blocage ne concerne que votre établissement. Les autres établissements de la marketplace ne voient pas ce blocage et n'en sont pas affectés.",
            },
            { type: "h2", text: "Lever le blocage" },
            {
              type: "p",
              text: "Ouvrez Compte, puis Personnes bloquées. Sélectionnez l'entrée concernée et cliquez sur Lever le blocage — le client peut ensuite de nouveau envoyer des messages et réserver.",
            },
          ],
        },
      ],
    },
  ],
};
