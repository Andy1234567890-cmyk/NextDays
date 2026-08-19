import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Messages et voyageurs",
  description: "Messagerie, modèles et communication avec les voyageurs.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Communication",
      articles: [
        {
          slug: "posteingang",
          title: "La messagerie de la plateforme",
          excerpt: "Tous les messages des voyageurs de vos hébergements arrivent de façon centralisée dans la messagerie de la plateforme.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Une messagerie pour tous les hébergements" },
            {
              type: "p",
              text: "La messagerie de la plateforme regroupe en un seul endroit tous les messages de vos voyageurs — quel que soit l'hébergement ou la période concernés par la conversation. Vous l'ouvrez sous /nachrichten et y voyez chaque échange sous forme de fil distinct.",
            },
            { type: "h2", text: "Structure de la messagerie" },
            {
              type: "ul",
              items: [
                "Colonne de gauche : liste de toutes les conversations, les plus récentes en premier",
                "Colonne du milieu : l'historique des messages en cours avec le voyageur",
                "Colonne de droite : contexte de la réservation — période, hébergement, informations sur le voyageur",
              ],
            },
            { type: "h2", text: "Répondre à un message" },
            {
              type: "steps",
              items: [
                "Ouvrez /nachrichten et sélectionnez la conversation souhaitée",
                "Rédigez votre réponse dans le champ de texte ou utilisez une réponse rapide",
                "Envoyez le message — le voyageur le reçoit par le même canal que celui utilisé pour vous écrire",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "La messagerie de la plateforme n'affiche que la communication directe entre vous et vos voyageurs sur myNextDays — les messages provenant des portails continuent d'être traités directement sur ceux-ci.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Réponses rapides",
          excerpt: "Des modèles pour les questions fréquentes qui vous font gagner du temps dans les échanges avec les voyageurs.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Ce que sont les réponses rapides" },
            {
              type: "p",
              text: "Les réponses rapides sont des blocs de texte préformulés pour les questions récurrentes — par exemple sur l'arrivée, le mot de passe Wi-Fi ou les places de stationnement. Plutôt que de retaper chaque réponse, insérez le modèle adapté en un clic dans la [messagerie de la plateforme](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Créer une réponse rapide" },
            {
              type: "steps",
              items: [
                "Ouvrez /nachrichten et cliquez sur « Gérer les réponses rapides »",
                "Cliquez sur « Nouveau modèle » et donnez-lui un titre, par exemple « Infos check-in »",
                "Rédigez le texte de la réponse ; les variables telles que le nom du voyageur ou la date d'arrivée sont insérées automatiquement lors de l'envoi",
                "Enregistrez le modèle — il est immédiatement disponible dans chaque conversation",
              ],
            },
            { type: "h2", text: "Utiliser les réponses rapides au quotidien" },
            {
              type: "p",
              text: "Dans la fenêtre de messagerie, ouvrez la liste des modèles via l'icône en forme d'éclair, choisissez la réponse adaptée et personnalisez-la si besoin avant de l'envoyer.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Créez des modèles pour les cinq à dix questions les plus fréquentes — en pratique, cela couvre la majorité des messages reçus.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Messages automatiques",
          excerpt: "Les confirmations, informations de check-in et rappels peuvent être envoyés automatiquement aux voyageurs.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Automatiser les messages récurrents" },
            {
              type: "p",
              text: "Plutôt que d'envoyer manuellement les confirmations de réservation, les informations de check-in ou les messages de remerciement, définissez-les une fois sous forme de règle — myNextDays les envoie ensuite automatiquement au bon moment, avant, pendant ou après le séjour.",
            },
            { type: "h2", text: "Déclencheurs typiques des messages automatiques" },
            {
              type: "ul",
              items: [
                "Juste après la réservation — confirmation avec les informations essentielles",
                "Quelques jours avant l'arrivée — informations de check-in et code d'accès",
                "Le jour du départ — remerciement et demande d'avis",
              ],
            },
            { type: "h2", text: "Configurer un message automatique" },
            {
              type: "steps",
              items: [
                "Ouvrez /nachrichten, section « Messages automatiques »",
                "Choisissez le déclencheur, par exemple « X jours avant l'arrivée »",
                "Renseignez le texte — les variables telles que le nom du voyageur, l'hébergement ou la date d'arrivée sont remplies automatiquement",
                "Activez la règle ; elle s'applique à tous les hébergements, sauf restriction spécifique",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Les messages automatiques apparaissent normalement dans la [messagerie de la plateforme](/hilfe/nachrichten/posteingang) et peuvent y être consultés à tout moment ultérieurement.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Bloquer des messages",
          excerpt: "Vous pouvez bloquer une personne directement depuis l'historique des messages pour empêcher tout nouveau contact.",
          updated: "Mise à jour : juillet 2026",
          body: [
            { type: "h2", text: "Quand un blocage est utile" },
            {
              type: "p",
              text: "En cas de messages insultants, de harcèlement ou de comportement inapproprié répété, vous pouvez bloquer une personne directement depuis le fil de messages. Une personne bloquée ne peut ensuite plus vous envoyer de nouveaux messages ni effectuer de nouvelle réservation chez vous.",
            },
            { type: "h2", text: "Bloquer une personne depuis le fil de messages" },
            {
              type: "steps",
              items: [
                "Ouvrez la conversation concernée dans la [messagerie de la plateforme](/hilfe/nachrichten/posteingang)",
                "Cliquez sur le menu en haut du fil et choisissez « Bloquer la personne »",
                "Confirmez l'opération — le blocage prend effet immédiatement",
              ],
            },
            { type: "h2", text: "Ce que signifie le blocage — et ce qu'il ne signifie pas" },
            {
              type: "ul",
              items: [
                "Les nouveaux messages de la personne bloquée ne sont plus délivrés",
                "Les nouvelles demandes de réservation de cette personne sont refusées",
                "Si une réservation de cette personne est en cours, la communication reste exceptionnellement possible pendant la durée du séjour",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Un blocage peut être levé à tout moment dans l'aperçu « Personnes bloquées » du compte. Vérifiez avant de bloquer si une réservation en cours existe déjà.",
            },
          ],
        },
      ],
    },
  ],
};
