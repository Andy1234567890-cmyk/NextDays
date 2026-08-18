import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politique en matière de droit d'auteur",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "myBestDays respecte les droits des tiers et attend la même chose de ses utilisateurs. La présente politique décrit comment signaler une atteinte au droit d'auteur et comment nous la traitons.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principe",
      paragraphs: [
        "Quiconque publie des contenus sur la plateforme garantit détenir les droits nécessaires. Cela vaut en particulier pour les photos, plans, textes et extraits de cartes figurant dans les annonces.",
        "Publier des contenus de tiers sans autorisation constitue une violation des [Conditions d'utilisation](https://mybestdays.dk/rechtliches/nutzungsbedingungen) et des [Règles relatives aux contenus appropriés](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
      ],
    },
    {
      id: "meldung",
      heading: "2. Signaler une atteinte",
      paragraphs: [
        "Signalez une atteinte au droit d'auteur via la fonction de signalement présente sur le contenu concerné ou via le point de contact mentionné sous [Règlement sur les services numériques](https://mybestdays.dk/rechtliches/dsa). Un signalement devrait contenir :",
      ],
      list: [
        "une désignation précise du contenu contesté, en particulier l'URL ;",
        "une description de l'œuvre protégée et la preuve de votre qualité de titulaire de droits ou de votre habilitation à agir pour le titulaire ;",
        "une motivation expliquant pourquoi l'utilisation n'est pas autorisée ;",
        "votre nom et une adresse de contact ;",
        "la déclaration que vos indications sont exactes et complètes en l'état de vos connaissances.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Comment nous traitons les signalements",
      paragraphs: [
        "Nous accusons réception de votre signalement sans délai et décidons rapidement et avec soin.",
        "Si nous estimons le signalement fondé, nous supprimons le contenu ou en bloquons l'accès et informons la personne qui l'a publié, en indiquant les motifs et la voie de réclamation.",
        "Si nous estimons le signalement non fondé, nous vous en informons avec une motivation.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Opposition de la personne concernée",
      paragraphs: [
        "Si votre contenu a été supprimé et que vous estimez cette suppression injustifiée, vous pouvez déposer une réclamation gratuite dans un délai de six mois. Exposez alors pourquoi vous êtes habilité à cette utilisation.",
        "Si la réclamation s'avère fondée, nous rétablissons le contenu.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Violations répétées",
      paragraphs: [
        "Nous suspendons, après avertissement préalable, les comptes par lesquels des contenus contrefaisants sont publiés de manière répétée. Cela correspond à l'article 23 du règlement (UE) 2022/2065.",
        "De même, nous suspendons la fonction de signalement pour les personnes qui déposent de manière répétée des signalements manifestement non fondés.",
      ],
    },
  ],
};
