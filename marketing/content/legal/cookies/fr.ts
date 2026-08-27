// Französische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Politique de cookies",
  metaDescription:
    "Quels cookies myNextDays utilise : des cookies techniquement nécessaires et — uniquement avec votre consentement — des cookies fonctionnels, analytiques et marketing. Chaque catégorie peut être activée et désactivée individuellement.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Cette politique explique quels cookies et techniques de stockage comparables ${ANBIETER.firma} utilise sur ce site web et sur la plateforme myNextDays.`,
    "En bref : Seuls les cookies sans lesquels le site web ne fonctionne pas comme demandé sont nécessaires. Tout le reste nécessite votre consentement et ne se charge pas sans lui — la protection anti-spam de notre formulaire de contact, la mesure d'audience et les cookies marketing avec lesquels nous mesurons le succès de notre publicité. Vous pouvez autoriser ou refuser chacune de ces catégories individuellement et révoquer votre décision à tout moment.",
  ],
  sections: [
    {
      heading: "Ce que sont les cookies",
      paragraphs: [
        "Les cookies sont de petits fichiers texte qu'un site web enregistre dans le navigateur. Ils permettent de reconnaître une session — par exemple pour que vous restiez connecté après vous être identifié. Outre les cookies, les navigateurs utilisent d'autres formes de stockage, comme le Local Storage, qui fonctionnent techniquement de manière similaire.",
      ],
    },
    {
      heading: "Pourquoi nous avons besoin de votre consentement",
      paragraphs: [
        "Un consentement n'est nécessaire, en vertu de l'article 9 du règlement danois sur les cookies (Cookie-bekendtgørelsen) (transposant l'article 5, paragraphe 3, de la directive 2002/58/CE), que lorsque l'accès à votre appareil ne sert pas exclusivement à transmettre une communication ou n'est pas strictement nécessaire à un service que vous avez expressément demandé.",
        "Tous les cookies que nous déposons sont nécessaires à la connexion, à la sécurité de la session ou à un paramètre que vous avez vous-même défini — nous ne demandons donc rien pour cela et, inversement, nous ne déposons rien qui nécessiterait un consentement.",
        "Vous devez consentir à trois catégories, qui ne seront pas chargées sans votre permission : la protection anti-spam de notre formulaire de contact (reCAPTCHA de Google), la mesure d'audience de ce site web (Google Analytics 4) et les cookies marketing (Meta, LinkedIn, Google Ads). Une fenêtre avec une liste de catégories s'affiche à cet effet — lors de la première visite, sans présélection, chaque catégorie avec son propre interrupteur. Tant que vous n'avez pas pris de décision, la mention « non autorisé » s'applique, et aucune évaluation ni publicité n'est effectuée.",
        "Votre décision est conservée dans le stockage de votre navigateur (Local Storage, valeur « nd_consent ») ; elle ne contient que la catégorie, l'horodatage et un numéro de version, aucune donnée permettant de vous identifier. Vous pouvez la modifier ou la révoquer à tout moment via l'icône cookies en bas à gauche de chaque page. Au bout de six mois, nous vous la redemanderons — un consentement ne doit pas rester valable indéfiniment.",
      ],
    },
    {
      heading: "Ce site web",
      paragraphs: [
        "Ce site web ne dépose aucun cookie de lui-même. Les polices et les symboles sont hébergés sur notre propre serveur — aucun service de symboles ou de polices tiers n'est appelé à cet effet. Seuls les services que vous autorisez sont ajoutés : la protection anti-spam du formulaire de contact, la mesure d'audience et les services marketing. Les cookies qui sont déposés, leur durée de vie et leur hôte sont indiqués ci-dessous dans la section « Cookies tiers ». La révocation s'effectue via l'icône de cookie en bas à gauche — le service concerné prend fin immédiatement et ses cookies sont supprimés. Les détails figurent dans la [politique de confidentialité](/datenschutz).",
      ],
    },
    {
      heading: "Cookies de la plateforme",
      paragraphs: [
        "Dès que vous vous connectez au tableau de bord, à la place de marché ou à l'affichage mobile, les cookies suivants sont déposés :",
      ],
      unterpunkte: [
        {
          titel: "nd_access — connexion (techniquement nécessaire)",
          list: [
            "Finalité : identifie votre session connectée auprès du serveur.",
            "Contenu : jeton d'accès de courte durée ; lisible uniquement par le serveur (HttpOnly), transmis uniquement via HTTPS.",
            "Durée de conservation : le temps de la session ou jusqu'à l'expiration du jeton.",
          ],
        },
        {
          titel:
            "nd_refresh — prolongation de session (techniquement nécessaire)",
          list: [
            "Finalité : renouvelle le jeton d'accès afin que vous n'ayez pas à vous reconnecter en permanence.",
            "Contenu : jeton de renouvellement ; HttpOnly, uniquement via HTTPS.",
            "Durée de conservation : jusqu'à la déconnexion ou l'expiration.",
          ],
        },
        {
          titel: "nd_locale — choix de la langue (fonctionnel)",
          list: [
            "Finalité : mémorise la langue que vous avez choisie.",
            "Contenu : code de langue, p. ex. « de » ou « en ».",
            "Durée de conservation : jusqu'à modification ou suppression.",
          ],
        },
        {
          titel: "sidebar_state — barre latérale (fonctionnel)",
          list: [
            "Finalité : mémorise si la barre de navigation est repliée ou dépliée.",
            "Contenu : « true » ou « false ».",
            "Durée de conservation : jusqu'à modification ou suppression.",
          ],
        },
        {
          titel:
            "sb-… — connexion avec Google (techniquement nécessaire, uniquement en cas d'utilisation)",
          list: [
            "Finalité : maintient la session lorsque vous vous connectez via Google.",
            "Contenu : jeton de session du service de connexion.",
            "Durée de conservation : le temps de la session ou jusqu'à l'expiration du jeton. N'est déposé que si vous choisissez la connexion via Google.",
          ],
        },
      ],
    },
    {
      heading: "Local Storage",
      unterpunkte: [
        {
          titel: "nd_consent",
          paragraphs: [
            "Enregistre votre décision concernant les services nécessitant un consentement (protection anti-spam du formulaire de contact et mesure d'audience).",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "N'est déposé que si vous ouvrez vous-même le chat de ce site web et envoyez un message. Il constitue la clé de votre propre conversation — sans lui, vous ne retrouveriez pas notre réponse après un changement de page. Il ne contient aucune information vous concernant et n'est utilisé qu'à cette fin.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Enregistre dans le navigateur si vous avez consenti à l'utilisation de la saisie vocale, afin que ce consentement ne soit pas redemandé à chaque visite. La valeur ne quitte pas votre appareil.",
          ],
        },
      ],
    },
    {
      heading: "Cookies de l'application mobile",
      paragraphs: [
        "L'application mobile ne fonctionne pas avec des cookies. Les jetons d'accès et de renouvellement sont stockés dans le trousseau sécurisé de l'appareil (iOS Keychain, Android Keystore) et supprimés lors de la déconnexion.",
      ],
    },
    {
      heading: "Cookies de tiers",
      paragraphs: [
        "Lorsque vous effectuez un paiement, le prestataire de paiement (Stripe ou PayPal) peut déposer, sur sa propre page, des cookies nécessaires au traitement de la transaction et à la prévention de la fraude. Les conditions du prestataire concerné s'appliquent à cet égard.",
        "Sur les sites web que les établissements créent avec notre outil de création, c'est l'établissement concerné qui décide des cookies supplémentaires et qui est responsable des informations qui y figurent.",
        "Avec votre consentement, les services Google sur ce site web utilisent les cookies suivants : deux pour la mesure d'audience, un pour la protection contre le spam. Sans votre consentement, le script respectif ne sera pas chargé et aucun de ces cookies ne sera défini ; en cas de révocation, nous les supprimerons.",
      ],
      unterpunkte: [
        {
          titel:
            "_fbp — Mesure de la performance publicitaire (consentement requis)",
          list: [
            "Objectif : associe votre visite à une publicité afin que nous puissions mesurer le succès de nos campagnes.",
            "Contenu : un identifiant généré aléatoirement ; aucune information de nom, d'e-mail ou de compte de notre part.",
            "Fournisseur : Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Irlande.",
            "Hébergeur : mynextdays.com (cookie de première partie, défini par le script de Meta). Durée : environ trois mois.",
          ],
        },
        {
          titel:
            "_gcl_au — Mesure de la performance Google Ads (consentement requis)",
          list: [
            "Objectif : associe votre visite à une annonce Google afin que nous puissions mesurer le succès de nos campagnes.",
            "Contenu : un identifiant généré aléatoirement sans lien avec votre personne.",
            "Fournisseur : Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlande.",
            "Hébergeur : mynextdays.com (cookie de première partie). Durée : environ trois mois.",
          ],
        },
        {
          titel: "li_gc et bcookie — Publicité LinkedIn (consentement requis)",
          list: [
            "Objectif : identifie votre navigateur auprès de LinkedIn afin que les annonces et leur succès puissent être attribués ; li_gc stocke également votre consentement.",
            "Contenu : un identifiant de navigateur et l'état du consentement ; aucune information de votre compte chez nous.",
            "Fournisseur : LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Irlande.",
            "Hébergeur : linkedin.com (cookies tiers). Durée : environ six mois ou un an.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — Protection anti-spam du formulaire de contact (consentement requis)",
          list: [
            "Hôte : www.google.com (cookie tiers).",
            "Objectif : permet à Google d'évaluer les risques afin de distinguer les envois de masse automatisés des demandes réelles.",
            "Contenu : un identifiant généré par Google pour cette évaluation ; aucune information de nom, d'e-mail ou de compte de notre part.",
            "Fournisseur : Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlande.",
            "Durée : déterminée par Google, jusqu'à six mois. Il n'est défini qu'après avoir autorisé la protection anti-spam et ouvert le formulaire de contact.",
          ],
        },
        {
          titel: "_ga — Mesure d'audience (consentement requis)",
          list: [
            "Hôte : mynextdays.com (cookie de première partie, défini par le script de Google).",
            "Objectif : distingue les visiteurs afin que les visites récurrentes ne soient pas comptées en double.",
            "Contenu : identifiant généré aléatoirement sans lien avec votre personne ; aucune information de nom, d'e-mail ou de compte.",
            "Fournisseur : Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlande.",
            "Durée : jusqu'à deux ans.",
          ],
        },
        {
          titel:
            "_ga_<ID> — État de la session de mesure (consentement requis)",
          list: [
            "Hôte : mynextdays.com (cookie de première partie, défini par le script de Google).",
            "Objectif : enregistre le début de votre visite actuelle afin que les pages vues d'une session soient regroupées.",
            "Contenu : horodatage et compteur de la session ; l'identifiant dans le nom désigne notre propriété, pas vous.",
            "Fournisseur : Google Ireland Limited.",
            "Durée : jusqu'à deux ans.",
          ],
        },
      ],
    },
    {
      heading: "Supprimer et gérer les cookies",
      paragraphs: [
        "Vous pouvez à tout moment supprimer ou bloquer les cookies dans les paramètres de votre navigateur. Si vous bloquez les cookies nécessaires, une connexion à la plateforme n'est techniquement pas possible — le site web public et la place de marché restent utilisables sans connexion.",
        "Lors de la déconnexion, nous supprimons nous-mêmes les cookies de connexion.",
      ],
    },
    {
      heading: "Modifications de cette politique",
      paragraphs: [
        "Si de nouvelles fonctionnalités nécessitant d'autres cookies sont ajoutées, nous mettrons à jour cette liste. C'est toujours la version publiée ici qui fait foi ; la date indiquée ci-dessus correspond à la mise à jour.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
