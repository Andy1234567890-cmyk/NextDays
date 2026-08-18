import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politique relative aux cookies",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "La présente politique explique quels cookies et technologies similaires myBestDays utilise, à quelles fins, pendant combien de temps ils sont conservés et comment vous pouvez les paramétrer.",
    "Elle complète la [Politique de confidentialité](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Ce que sont les cookies",
      paragraphs: [
        "Les cookies sont de petits fichiers texte qu'un site web enregistre dans votre navigateur. Des technologies similaires sont le stockage local du navigateur et les pixels de suivi dans les courriels.",
        "Les cookies strictement nécessaires au fonctionnement de la plateforme peuvent être déposés sans votre consentement. Pour tous les autres, nous recueillons votre consentement (article 5, paragraphe 3, de la directive 2002/58/CE).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Cookies nécessaires",
      paragraphs: [
        "Ces cookies sont nécessaires au fonctionnement et ne peuvent être désactivés. Nous déposons actuellement :",
      ],
      list: [
        "« nd_access » — maintient votre session ouverte. Lisible uniquement par le serveur (HttpOnly), durée correspondant à la validité de la session.",
        "« nd_refresh » — renouvelle votre connexion afin que vous n'ayez pas à vous reconnecter constamment. Lisible uniquement par le serveur, durée 30 jours.",
        "« nd_gast_locale » — mémorise la langue que vous avez choisie. Durée un an.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Cookies fonctionnels, statistiques et publicitaires",
      paragraphs: [
        "myBestDays ne dépose actuellement aucun cookie à des fins de statistiques, de mesure d'audience ou de publicité et n'intègre aucun réseau publicitaire ni service d'analyse.",
        "Si cela devait changer, nous recueillerions au préalable votre consentement au moyen d'une boîte de dialogue où refuser est aussi simple qu'accepter, et compléterions la présente politique par les cookies concrets.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Contenus de tiers intégrés",
      paragraphs: [
        "Des cartes peuvent être intégrées sur les pages de détail. Nous ne chargeons de tels contenus qu'après activation expresse de votre part ; ce n'est qu'alors que des données peuvent être transmises au prestataire concerné.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Comment paramétrer les cookies",
      paragraphs: [
        "Vous pouvez modifier ou retirer votre consentement à tout moment via les paramètres relatifs aux cookies dans le pied de page.",
        "Vous pouvez en outre supprimer ou bloquer les cookies dans votre navigateur. Si vous supprimez les cookies nécessaires, vous êtes déconnecté et la plateforme ne fonctionne que de manière limitée.",
      ],
    },
  ],
};
