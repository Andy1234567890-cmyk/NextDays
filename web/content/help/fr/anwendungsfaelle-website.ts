import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Site web",
  description: "Tirer le meilleur parti de votre site web.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Site web",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Mettre votre site web en ligne",
          excerpt: "Comment publier votre propre site web comme canal de vente indépendant.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ",
            },
            {
              type: "p",
              text: "Votre site web est un canal de vente à part entière, aux côtés des portails et de la plateforme. Vous construisez vos pages dans l'éditeur, mais le site ne devient visible pour les voyageurs, et vos objets réservables, qu'après la publication.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez l'éditeur de site et vérifiez que toutes les pages souhaitées contiennent du contenu.",
                "Dans l'onglet Objet, choisissez pour chaque objet s'il doit être visible sur le site — cette visibilité est indépendante des portails et de la plateforme.",
                "Contrôlez l'aperçu en version bureau et mobile avant de passer en ligne.",
                "Cliquez sur « Publier » pour rendre le site accessible aux voyageurs.",
                "Après la publication, vérifiez l'URL publique et testez une réservation type sur le site.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La visibilité d'un objet sur le site est un réglage à part — un objet peut être actif sur les portails tout en étant masqué sur le site, et inversement. Détails dans [Configurer votre propre domaine](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Configurer votre propre domaine",
          excerpt: "Comment relier votre propre domaine à votre site myNextDays.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ",
            },
            {
              type: "p",
              text: "Un domaine personnel comme www.votre-etablissement.fr paraît plus professionnel qu'une adresse standard et renforce votre marque auprès des voyageurs qui souhaitent réserver directement chez vous.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez la section « Domaine » dans l'éditeur de site et saisissez le domaine personnel souhaité.",
                "Configurez chez votre fournisseur de domaine les entrées DNS affichées (généralement un CNAME ou un enregistrement A).",
                "Attendez que le domaine s'affiche comme connecté et le certificat SSL comme actif — cela peut prendre plusieurs heures selon le fournisseur.",
                "Testez l'accès à votre domaine dans une fenêtre de navigation privée afin d'exclure d'anciennes entrées mises en cache.",
                "Vérifiez que les anciennes adresses standard redirigent toujours vers le nouveau domaine, afin que les liens existants ne pointent pas dans le vide.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ne modifiez les entrées DNS que selon les indications affichées — des valeurs erronées peuvent perturber les paramètres de messagerie existants de votre domaine. En cas de doute, vérifiez avec votre fournisseur de domaine avant d'écraser des entrées existantes.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Augmenter les réservations directes",
          excerpt: "Comment orienter davantage de voyageurs vers votre propre site plutôt que vers les portails.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "h2",
              text: "Situation de départ",
            },
            {
              type: "p",
              text: "Les réservations effectuées via votre propre site sont généralement plus avantageuses pour votre établissement que celles passant par les portails, car aucune commission de portail ne s'applique. Quelques mesures ciblées suffisent pour augmenter la part des réservations directes via votre site en tant que canal indépendant.",
            },
            {
              type: "steps",
              items: [
                "Assurez-vous que tous les objets réservables sont visibles sur le site, avec des photos et des descriptions à jour.",
                "Mettez en place un avantage exclusif au site, par exemple une légère réduction de prix par rapport aux portails.",
                "Indiquez votre propre domaine dans les confirmations de réservation et dans les échanges avec les voyageurs ayant déjà réservé une fois.",
                "Contrôlez régulièrement les statistiques de réservation pour suivre l'évolution de la part du site dans l'ensemble des réservations.",
                "Optimisez le temps de chargement et l'affichage mobile du site, car une grande partie des voyageurs réserve depuis un smartphone.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Un avantage exclusif au site ne fonctionne que si les voyageurs trouvent le site — mentionnez-le activement au lieu de miser uniquement sur les portails. Pour la publication, voir [Mettre votre site web en ligne](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
