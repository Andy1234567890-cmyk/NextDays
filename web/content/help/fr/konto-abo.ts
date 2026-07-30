import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Compte et abonnement",
  description: "Coordonnées, forfait, sécurité et authentification à deux facteurs.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Compte",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Coordonnées de l'établissement",
          excerpt: "Gérez de manière centralisée le nom, l'adresse et les coordonnées de votre établissement.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Sous /konto, myNextDays regroupe toutes les fonctions liées à l'établissement et au compte sous forme de sections sur une seule page — vous n'avez pas besoin de naviguer entre de nombreuses sous-pages. Les coordonnées de l'établissement en constituent la base : nom de l'entreprise, forme juridique, adresse et coordonnées de contact, utilisées pour les factures, les portails et la communication avec les voyageurs.",
            },
            { type: "h2", text: "Ouvrir et modifier les coordonnées" },
            {
              type: "steps",
              items: [
                "Ouvrez /konto.",
                "Accédez à la section « Coordonnées de l'établissement ».",
                "Vérifiez le nom de l'entreprise, l'adresse, le numéro de téléphone et l'adresse e-mail de contact.",
                "Effectuez vos modifications.",
                "Enregistrez la section.",
              ],
            },
            { type: "h2", text: "Pourquoi ces données sont importantes" },
            {
              type: "p",
              text: "Les coordonnées de l'établissement figurent sur les factures, dans l'inscription auprès des portails connectés et dans les mentions légales obligatoires. Une adresse incomplète ou obsolète peut entraîner des factures erronées ou retarder la connexion aux portails.",
            },
            {
              type: "ul",
              items: [
                "Le nom de l'entreprise et la forme juridique apparaissent sur toutes les factures émises.",
                "L'adresse est nécessaire pour l'inscription auprès des portails.",
                "Les coordonnées de contact servent de solution de repli si les notifications système n'arrivent pas.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Si vous modifiez votre adresse de facturation, vérifiez ensuite les factures déjà émises sous [Facturation et simulateur de forfait](/hilfe/konto-abo/abrechnung-tarifrechner) — les justificatifs existants ne sont pas ajustés rétroactivement.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Abonnement et forfait",
          excerpt: "Votre forfait détermine le quota d'hébergements — le nombre d'hébergements réservés est visible à tout moment dans votre compte.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Votre abonnement myNextDays comprend un quota d'hébergements : le nombre maximal d'hébergements (chambres ou logements de vacances) que vous pouvez gérer activement en même temps. Le nombre d'hébergements actuellement réservés s'affiche dans la section « Abonnement et forfait » sous /konto, avec le quota restant.",
            },
            { type: "h2", text: "Garder un œil sur le quota" },
            {
              type: "p",
              text: "Le quota est appliqué côté serveur : une fois la limite de votre forfait atteinte, il n'est plus possible de créer un nouvel hébergement tant que vous ne désactivez pas un hébergement existant ou n'étendez pas votre forfait. Cela vaut que le nouvel hébergement soit une chambre ou un logement de vacances — les deux comptent de la même façon dans le quota.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez /konto et la section « Abonnement et forfait ».",
                "Comparez le nombre d'hébergements réservés au quota de votre forfait.",
                "Si besoin, choisissez un forfait supérieur pour créer davantage d'hébergements.",
                "Confirmez le changement de forfait.",
              ],
            },
            {
              type: "ul",
              items: [
                "Chaque hébergement compte individuellement dans le quota, quel que soit son type.",
                "Un changement de forfait affecte immédiatement le quota disponible.",
                "Une rétrogradation n'est possible que si le nombre d'hébergements actifs correspond au nouveau quota.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Une rétrogradation vers un forfait au quota plus petit est refusée tant que davantage d'hébergements sont actifs que ce que le nouveau forfait autorise. Désactivez d'abord les hébergements excédentaires.",
            },
            {
              type: "note",
              variant: "info",
              text: "Les détails sur les factures et le calcul du forfait se trouvent sous [Facturation et simulateur de forfait](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Facturation et simulateur de forfait",
          excerpt: "Adresse de facturation, historique des factures et simulateur pour votre quota d'hébergements.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "La section « Facturation et simulateur de forfait » sous /konto regroupe tout ce qui concerne la facturation : votre adresse de facturation, la liste des factures précédentes à télécharger, ainsi qu'un simulateur permettant d'estimer le coût de votre quota d'hébergements actuel ou d'un quota plus important.",
            },
            { type: "h2", text: "Adresse de facturation et factures" },
            {
              type: "p",
              text: "L'adresse de facturation peut différer de l'adresse de votre établissement, par exemple lorsqu'un cabinet comptable reçoit les justificatifs. Les factures déjà émises sont classées par ordre chronologique ; chacune peut être téléchargée au format PDF.",
            },
            { type: "h2", text: "Utiliser le simulateur de forfait" },
            {
              type: "steps",
              items: [
                "Ouvrez /konto et la section « Facturation et simulateur de forfait ».",
                "Saisissez dans le simulateur le nombre d'hébergements souhaité.",
                "Comparez les coûts obtenus pour chaque niveau de forfait.",
                "Passez si besoin directement au forfait adapté depuis le simulateur.",
              ],
            },
            {
              type: "ul",
              items: [
                "Le simulateur affiche les coûts dans la devise enregistrée pour votre compte.",
                "Les factures restent disponibles au téléchargement en permanence.",
                "L'adresse de facturation peut être gérée indépendamment des coordonnées de l'établissement.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Utilisez régulièrement le simulateur pour vérifier que votre quota d'hébergements correspond toujours au nombre d'hébergements réellement réservés — voir [Abonnement et forfait](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Modifier le mot de passe et l'e-mail",
          excerpt: "Les modifications sensibles nécessitent une nouvelle authentification et une étape de confirmation.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Le mot de passe et l'adresse e-mail comptent parmi les informations les plus sensibles de votre compte. myNextDays exige donc une nouvelle authentification pour ces deux modifications — vous confirmez le changement avec votre mot de passe actuel, même si vous êtes déjà connecté.",
            },
            { type: "h2", text: "Modifier le mot de passe" },
            {
              type: "steps",
              items: [
                "Ouvrez /konto et la section « Modifier le mot de passe et l'e-mail ».",
                "Saisissez votre mot de passe actuel pour confirmation.",
                "Définissez le nouveau mot de passe et répétez-le.",
                "Enregistrez la modification.",
              ],
            },
            { type: "h2", text: "Modifier l'adresse e-mail" },
            {
              type: "p",
              text: "Le changement d'adresse e-mail se fait par double confirmation : après avoir validé votre mot de passe actuel, vous recevez un lien de confirmation à la NOUVELLE adresse. La modification ne prend effet qu'après avoir cliqué sur ce lien — l'ancienne adresse reste active entre-temps, afin que l'accès à votre compte ne soit jamais interrompu.",
            },
            {
              type: "ul",
              items: [
                "Sans le mot de passe actuel, ni le mot de passe ni l'e-mail ne peuvent être modifiés.",
                "Le lien de confirmation pour la nouvelle adresse e-mail n'est valable que pendant une durée limitée.",
                "Jusqu'à la confirmation, l'adresse e-mail actuelle reste active pour la connexion et les notifications.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Après un changement d'adresse e-mail, vérifiez également l'authentification à deux facteurs — voir [Authentification à deux facteurs](/hilfe/konto-abo/zwei-faktor) — si des codes de récupération étaient liés à l'ancienne adresse.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Authentification à deux facteurs",
          excerpt: "Une étape de connexion supplémentaire protège votre compte contre les accès non autorisés.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "L'authentification à deux facteurs (2FA) complète votre mot de passe par un second facteur via une application d'authentification. Un mot de passe volé ne suffit ainsi plus à lui seul pour se connecter à votre compte myNextDays.",
            },
            { type: "h2", text: "Configurer la 2FA" },
            {
              type: "steps",
              items: [
                "Ouvrez /konto et la section « Authentification à deux facteurs ».",
                "Confirmez votre mot de passe actuel pour vous réauthentifier.",
                "Scannez le code QR affiché avec une application d'authentification.",
                "Saisissez le code généré pour confirmer.",
                "Conservez les codes de récupération affichés dans un endroit sûr.",
              ],
            },
            { type: "h2", text: "Désactiver la 2FA" },
            {
              type: "p",
              text: "La désactivation de l'authentification à deux facteurs exige elle aussi une nouvelle authentification avec votre mot de passe actuel. myNextDays empêche ainsi qu'une personne disposant d'une session déjà ouverte désactive simplement votre protection.",
            },
            {
              type: "ul",
              items: [
                "Les codes de récupération permettent d'accéder à votre compte si l'application d'authentification est perdue.",
                "Chaque code de récupération n'est utilisable qu'une seule fois.",
                "L'activation comme la désactivation de la 2FA sont toutes deux soumises à une confirmation par mot de passe.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Conservez vos codes de récupération séparément de l'appareil contenant l'application d'authentification, par exemple dans un gestionnaire de mots de passe.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Historique des appareils",
          excerpt: "Gardez un œil sur les appareils depuis lesquels votre compte est connecté.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "L'historique des appareils sous /konto vous indique sur quels appareils votre compte est actuellement connecté — avec le type d'appareil, la localisation approximative et l'horodatage de la dernière activité. Vous pouvez ainsi rapidement vérifier si une connexion provient réellement de vous.",
            },
            { type: "h2", text: "Vérifier l'historique des appareils" },
            {
              type: "steps",
              items: [
                "Ouvrez /konto et la section « Historique des appareils ».",
                "Consultez la liste des appareils connectés.",
                "Si vous repérez un appareil inconnu, déconnectez-le.",
                "Modifiez ensuite votre mot de passe par précaution.",
              ],
            },
            { type: "h2", text: "Quand vérifier" },
            {
              type: "p",
              text: "Vérifiez l'historique des appareils en particulier après un changement de mot de passe ou d'adresse e-mail, ainsi qu'après l'utilisation d'un appareil tiers ou public. Une entrée inconnue est un signal d'alerte clair d'un accès non autorisé.",
            },
            {
              type: "ul",
              items: [
                "Chaque entrée indique le type d'appareil, la localisation approximative et la dernière activité.",
                "Vous pouvez déconnecter un appareil précis sans affecter les autres.",
                "Un appareil non reconnu justifie un changement de mot de passe immédiat.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Si vous ne reconnaissez pas un appareil, déconnectez-le immédiatement puis modifiez votre mot de passe sous [Modifier le mot de passe et l'e-mail](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Confidentialité",
          excerpt: "Gérez l'indexation par les moteurs de recherche pour chaque hébergement et exportez vos données.",
          updated: "Mise à jour : juillet 2026",
          body: [
            {
              type: "p",
              text: "Dans la section « Confidentialité » sous /konto, vous gérez deux choses : si les pages de vos hébergements peuvent être indexées par les moteurs de recherche, et comment exporter les données enregistrées auprès de myNextDays.",
            },
            { type: "h2", text: "Indexation par les moteurs de recherche par hébergement" },
            {
              type: "p",
              text: "Par défaut, l'indexation par les moteurs de recherche est désactivée pour les nouveaux hébergements. Ce n'est qu'en l'activant délibérément pour un hébergement donné que des moteurs de recherche comme Google peuvent intégrer la page publique de cet hébergement à leur index. Vous gardez ainsi le contrôle sur les hébergements visibles en dehors des portails et de votre propre plateforme.",
            },
            {
              type: "steps",
              items: [
                "Ouvrez /konto et la section « Confidentialité ».",
                "Sélectionnez l'hébergement souhaité dans la liste.",
                "Activez ou désactivez l'indexation par les moteurs de recherche.",
                "Si vous avez plusieurs hébergements, utilisez le commutateur global pour appliquer le même réglage à tous.",
              ],
            },
            { type: "h2", text: "Exporter les données" },
            {
              type: "p",
              text: "La fonction d'export de données vous permet de demander une copie complète des données enregistrées dans votre compte. L'export est ensuite compilé et mis à votre disposition au téléchargement.",
            },
            {
              type: "ul",
              items: [
                "L'indexation est réglable individuellement par hébergement, avec un commutateur global pour tous les hébergements.",
                "Les nouveaux hébergements démarrent par principe sans indexation par les moteurs de recherche.",
                "L'export de données contient les informations de votre compte et de vos hébergements sous forme structurée.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "L'indexation par les moteurs de recherche est indépendante de la visibilité sur les portails et sur votre propre marketplace — elle concerne exclusivement la page publique de l'hébergement dans les moteurs de recherche.",
            },
          ],
        },
      ],
    },
  ],
};
