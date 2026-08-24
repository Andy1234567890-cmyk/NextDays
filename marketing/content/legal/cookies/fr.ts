// Französische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Politique de cookies",
  metaDescription:
    "Quels cookies myNextDays utilise : exclusivement des cookies techniquement nécessaires et fonctionnels, aucun cookie de suivi ou publicitaire.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Cette politique explique quels cookies et techniques de stockage comparables ${ANBIETER.firma} utilise sur ce site web et sur la plateforme myNextDays.`,
    "En bref : nous utilisons exclusivement des cookies techniquement nécessaires et fonctionnels. Il n'existe aucun cookie d'analyse, publicitaire ou de suivi, et aucune donnée d'utilisation n'est transmise à des réseaux publicitaires.",
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
        "Vous devez donner votre consentement pour exactement une chose : la protection anti-spam de notre formulaire de contact. Elle provient de Google (reCAPTCHA Enterprise), il s'agit donc d'un service externe, qui n'est chargé que si vous l'avez autorisé. Un bandeau situé en bas de l'écran vous le demande — lors de votre première visite, avec des boutons de rang égal « Refuser » et « Accepter », sans sélection préalable. Tant que vous n'avez pas décidé, « non autorisé » s'applique.",
        "Votre décision est conservée dans le stockage de votre navigateur (Local Storage, valeur « nd_consent ») ; elle ne contient que la catégorie, l'horodatage et un numéro de version, aucune donnée permettant de vous identifier. Vous pouvez la modifier ou la révoquer à tout moment en bas de cette page.",
      ],
    },
    {
      heading: "Ce site web",
      paragraphs: [
        "Le site web marketing ne dépose aucun cookie. Les polices et les icônes sont hébergées sur notre propre serveur — aucun service tiers de polices ou d'icônes n'est sollicité à cette fin. Le seul service externe de cette page est la protection anti-spam du formulaire de contact, qui ne se charge qu'avec votre consentement. Les détails figurent dans la [politique de confidentialité](/datenschutz).",
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
          titel: "nd_refresh — prolongation de session (techniquement nécessaire)",
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
          titel: "sb-… — connexion avec Google (techniquement nécessaire, uniquement en cas d'utilisation)",
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
            "Conserve votre décision concernant la protection anti-spam du formulaire de contact, afin que le bandeau de consentement ne vous la redemande pas à chaque visite. Seules la catégorie, l'horodatage et un numéro de version sont enregistrés. La valeur ne quitte pas votre appareil et n'est pas transmise à notre serveur ; elle s'applique à ce navigateur. Si vous la supprimez, le bandeau vous interrogera à nouveau lors de votre prochaine visite.",
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
