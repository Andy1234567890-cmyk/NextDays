import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Tâches et ménage",
  description: "Organiser les plannings de ménage et les tâches d'équipe.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Établissement",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Créer des tâches",
          excerpt: "Comment créer une nouvelle tâche pour un objet ou une période donnée.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Les tâches regroupent tout ce qui doit être fait autour d'un objet — du ménage après le check-out aux travaux d'entretien en passant par les demandes des clients. Chaque tâche est rattachée à exactement un objet et peut être assignée à un membre de l'équipe.",
            },
            { type: "h2", text: "Créer une nouvelle tâche" },
            {
              type: "steps",
              items: [
                "Ouvrez la section « Tâches » dans le menu principal.",
                "Cliquez sur « Nouvelle tâche ».",
                "Sélectionnez l'objet concerné.",
                "Attribuez un titre et, si besoin, une description.",
                "Définissez la date et l'heure d'échéance.",
                "Enregistrez la tâche.",
              ],
            },
            { type: "h2", text: "Types de tâches" },
            {
              type: "p",
              text: "Outre les tâches libres, il existe des tâches générées automatiquement par le système, comme les ménages planifiés après un check-out. Celles-ci sont déjà rattachées à l'objet et au créneau correspondant, et il ne reste plus qu'à les assigner à un membre de l'équipe.",
            },
            {
              type: "ul",
              items: [
                "Tâche manuelle : saisie librement, par exemple entretien ou demande spéciale.",
                "Tâche de ménage automatique : déduite de la date de check-out.",
                "Tâche récurrente : pour des contrôles ou inspections réguliers.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Pour les détails sur la planification automatique, consultez [Plannings de ménage](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Donnez des titres précis — dans la vue mobile, les membres de l'équipe ne voient souvent que le titre et l'objet en un coup d'œil.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Plannings de ménage",
          excerpt: "Planifier automatiquement le ménage après le check-out.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Un planning de ménage garantit qu'une tâche de ménage est automatiquement créée pour l'objet concerné après chaque check-out — sans que vous ayez à suivre chaque réservation individuellement. Cela réduit les oublis de remise en état et assure un déroulement fiable entre deux séjours.",
            },
            { type: "h2", text: "Activer la planification automatique" },
            {
              type: "steps",
              items: [
                "Ouvrez l'objet et accédez à l'onglet « Ménage ».",
                "Activez « Planifier automatiquement le ménage après le check-out ».",
                "Définissez le délai prévu pour le ménage après le check-out.",
                "Définissez, si besoin, une équipe ou une personne de ménage par défaut.",
                "Enregistrez le paramètre.",
              ],
            },
            { type: "h2", text: "Interaction avec le calendrier" },
            {
              type: "p",
              text: "Dès qu'une réservation est annulée ou déplacée, la tâche de ménage correspondante s'adapte automatiquement à la nouvelle date de check-out. Le planning de ménage reste ainsi toujours synchronisé avec l'occupation réelle.",
            },
            {
              type: "ul",
              items: [
                "Le ménage est créé automatiquement à chaque check-out lorsque le planning est actif.",
                "Si la réservation est déplacée, la tâche de ménage l'est également.",
                "Si le client annule le séjour, la tâche de ménage est supprimée.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Sans planning de ménage activé, aucune tâche automatique n'est créée — créez alors les ménages manuellement sous [Créer des tâches](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Assigner des tâches",
          excerpt: "Attribuer des tâches de façon ciblée à des agents de ménage ou à des membres de l'équipe.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Pour qu'une tâche soit réalisée, assignez-la à un membre précis de l'équipe — par exemple un agent de ménage ou un employé chargé de l'entretien. Par défaut, seule la personne assignée voit la tâche dans son propre aperçu.",
            },
            { type: "h2", text: "Assigner une tâche manuellement" },
            {
              type: "steps",
              items: [
                "Ouvrez la tâche dans la liste « Tâches ».",
                "Cliquez sur « Assigner ».",
                "Sélectionnez dans la liste le membre de l'équipe responsable.",
                "Confirmez l'attribution.",
              ],
            },
            { type: "h2", text: "Attribution par objet" },
            {
              type: "p",
              text: "Si un objet est déjà attribué de façon fixe à un agent de ménage, vous pouvez faire assigner automatiquement à cette personne les tâches concernant cet objet. Cela évite des clics superflus pour les ménages récurrents et réduit les questions.",
            },
            {
              type: "ul",
              items: [
                "Attribution manuelle : vous choisissez vous-même la personne pour chaque tâche.",
                "Attribution fixe par objet : les nouvelles tâches pour cet objet vont automatiquement à la personne enregistrée.",
                "Une tâche a toujours exactement une personne responsable.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Les agents de ménage et les employés ne voient que leurs propres tâches assignées, sans accès aux données financières ou commerciales de l'objet.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Suivre le statut des tâches",
          excerpt: "Garder un œil en temps réel sur l'avancement des tâches.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Chaque tâche suit un statut clair — d'ouverte à en cours puis terminée. Vous voyez ainsi à tout moment si un ménage ou un entretien sera achevé à temps avant le prochain check-in.",
            },
            { type: "h2", text: "Aperçu des statuts" },
            {
              type: "ul",
              items: [
                "Ouverte : la tâche est créée mais pas encore commencée.",
                "En cours : la personne assignée a commencé la tâche.",
                "Terminée : la tâche est réalisée et confirmée.",
              ],
            },
            { type: "h2", text: "Mettre à jour le statut" },
            {
              type: "steps",
              items: [
                "Ouvrez la tâche depuis la liste « Tâches ».",
                "Choisissez le statut correspondant, par exemple « En cours » ou « Terminée ».",
                "Ajoutez si besoin une brève note, par exemple sur une anomalie constatée dans l'objet.",
                "Enregistrez la modification.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Les changements de statut apparaissent immédiatement dans la liste des tâches partagée — un rechargement manuel n'est pas nécessaire.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Si un ménage est encore ouvert peu avant le prochain check-in, vérifiez d'abord l'attribution avant de contacter le client.",
            },
          ],
        },
      ],
    },
  ],
};
