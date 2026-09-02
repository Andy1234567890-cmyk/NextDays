// Französische Fassung der Datenschutzerklärung. Quelle der Wahrheit ist
// `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin und werden von dort
// hier nachgezogen. Struktur (Abschnitte, Absätze, Listen) bleibt identisch.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Politique de confidentialité",
  metaDescription:
    "Comment myNextDays traite les données à caractère personnel : finalités, bases légales, destinataires, durées de conservation et vos droits au titre du RGPD.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `La présente déclaration décrit la manière dont ${ANBIETER.firma} traite les données à caractère personnel — lors de la visite de ce site web, lors de l’utilisation de la plateforme myNextDays (tableau de bord, place de marché et application mobile) et dans le cadre de la relation commerciale avec nos clients.`,
    "Nous ne vendons pas de données et ne créons pas de profils qui vous identifient personnellement. Sur ce site web, nous mesurons — uniquement avec votre consentement — l'audience de nos pages et le succès de notre publicité ; les deux catégories peuvent être désélectionnées individuellement (voir les sections Mesure d'audience et Publicité et mesure de performance). Nous traitons les données à des fins publicitaires uniquement si vous y avez expressément consenti, notamment pour notre newsletter (voir la section Communication), que vous pouvez à tout moment annuler en un seul clic.",
  ],
  sections: [
    {
      heading: "Responsable du traitement",
      paragraphs: [
        "Le responsable des traitements décrits dans la présente déclaration est :",
      ],
      zeilen: [
        {
          label: "Entreprise",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Adresse",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Téléphone",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Champ d’application et rôles",
      unterpunkte: [
        {
          paragraphs: [
            "Pour la visite de ce site web, pour votre compte client et pour l’exécution de notre relation commerciale, nous sommes responsable du traitement au sens de l’art. 4, point 7), du RGPD.",
          ],
        },
        {
          paragraphs: [
            "Pour les données que nos clients (loueurs, hôtels, agences) traitent dans la plateforme au sujet de leurs hôtes, de leurs propriétaires et de leur personnel, les clients sont responsables du traitement et nous sommes sous-traitant au sens de l’art. 28 du RGPD. Les modalités figurent dans l’[accord de sous-traitance](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Si vous réservez un hébergement en tant qu’hôte via notre place de marché, nous traitons vos données de réservation et de contact aussi bien en notre propre nom (exploitation de la place de marché, traitement des paiements) que pour le compte de l’établissement d’accueil. Votre contrat d’hébergement est conclu exclusivement avec l’établissement ; les informations de celui-ci en matière de protection des données s’appliquent en complément.",
          ],
        },
      ],
    },
    {
      heading: "Visite de ce site web",
      unterpunkte: [
        {
          titel: "Fichiers journaux du serveur",
          paragraphs: [
            "À chaque consultation, votre navigateur transmet des données techniquement nécessaires que notre serveur web enregistre : adresse IP, date et heure, adresse consultée, volume de données transféré, code de statut, référent et identification du navigateur. La finalité est la mise à disposition de la page ainsi que la détection et la prévention d’attaques et de dysfonctionnements. La base légale est l’art. 6, paragraphe 1, point f), du RGPD ; notre intérêt légitime réside dans une exploitation sûre et stable. Les journaux ne sont conservés que le temps nécessaire à l’exploitation et à la sécurité, et ne sont pas rapprochés d’autres données.",
          ],
        },
        {
          titel: "Polices de caractères",
          paragraphs: [
            "Les polices utilisées sont hébergées localement sur notre serveur. Aucune connexion à Google Fonts ou à un autre service de polices n’a lieu.",
          ],
        },
        {
          titel: "Icônes",
          paragraphs: [
            "Les icônes de ce site web sont hébergées chez nous, tout comme les polices : elles sont intégrées à la page sur notre serveur et ne sont pas chargées depuis un service d’icônes. Aucune connexion à un tiers n’a lieu à cette occasion, et votre adresse IP n’est transmise à personne.",
          ],
        },
        {
          titel: "Protection anti-spam du formulaire de contact (reCAPTCHA)",
          paragraphs: [
            "Notre formulaire de contact est protégé contre les envois automatisés en masse par reCAPTCHA Enterprise de Google Ireland Limited. Ce n’est que si vous y consentez que votre navigateur charge, lors du remplissage du formulaire, un script depuis www.google.com ; votre adresse IP et des informations relatives à votre interaction avec le formulaire sont alors transmises à Google et y sont analysées afin de distinguer un être humain d’un script. La base légale est l’art. 6, paragraphe 1, point a), du RGPD (consentement) ; la [politique de confidentialité de Google](https://policies.google.com/privacy) s’applique en complément.",
            "Sans votre consentement, rien ne sera chargé depuis Google et aucune donnée ne lui sera transmise ; nous n'accepterons alors pas le formulaire, mais vous pouvez nous envoyer un e-mail à tout moment. Si vous donnez votre consentement, reCAPTCHA installera son propre cookie (_GRECAPTCHA, durée définie par Google, jusqu'à six mois) qui sert à l'évaluation des risques. Vous pouvez modifier ou révoquer votre consentement à tout moment via l'icône de cookie en bas à gauche de chaque page ; le cookie sera alors supprimé.",
          ],
        },
        {
          titel: "Mesure d'audience (Google Analytics)",
          paragraphs: [
            "Sur ce site web, nous utilisons Google Analytics 4 de Google Ireland Limited pour mesurer l'utilisation de nos pages — quelles pages sont consultées, d'où viennent les visiteurs et où ils abandonnent. L'objectif est uniquement d'améliorer l'offre et la visibilité.",
            "Le chargement s'effectue exclusivement avec votre consentement. Si vous le donnez, votre navigateur charge un script de www.googletagmanager.com et stocke deux cookies (« _ga » et « _ga_<ID> », durée de vie jusqu'à deux ans) avec un identifiant généré aléatoirement ; cet identifiant, les pages consultées, la source de référence, la localisation approximative au niveau du pays ou de la région, l'appareil et le navigateur, ainsi que votre adresse IP, que Google raccourcit avant chaque stockage, sont transmis. La base juridique est l'art. 6, paragraphe 1, lettre a du RGPD (consentement).",
            "Nous avons expressément limité l'évaluation : les signaux Google et la personnalisation publicitaire sont désactivés. Par conséquent, aucun profil inter-appareils n'est créé, aucun public n'est ciblé pour la publicité, et nous ne transmettons aucune donnée d'utilisation aux réseaux publicitaires. Aucune fusion avec votre compte client n'a lieu.",
            "Google traite les données en tant que notre sous-traitant sur la base d'un contrat conformément à l'art. 28 du RGPD (Conditions de traitement des données Google Ads). Le raccourcissement de votre adresse IP a lieu sur des serveurs dans l'UE avant que les données ne soient transférées aux États-Unis ; un ensemble de données pseudonyme est donc transmis. La base du transfert est la décision d'adéquation de la Commission européenne concernant le cadre de confidentialité des données UE-États-Unis (art. 45 du RGPD), en vertu duquel Google LLC est certifié ; en outre, Google a inclus les clauses contractuelles types de la Commission européenne (art. 46 du RGPD). Nous attirons expressément votre attention sur le fait que les autorités américaines peuvent également accéder aux données des entreprises certifiées en vertu de la section 702 du FISA et qu'un risque résiduel ne peut donc pas être entièrement exclu. La [politique de confidentialité de Google](https://policies.google.com/privacy) s'applique également.",
            "Durée de conservation : Les données relatives aux événements et aux utilisateurs sont automatiquement supprimées de notre propriété après 14 mois ; les données de rapport agrégées sans lien avec des visiteurs individuels sont conservées au-delà. Votre consentement lui-même expire après six mois.",
            "Sans votre consentement, rien n'est chargé, aucun cookie n'est défini et aucune donnée n'est transmise à Google. Vous pouvez révoquer votre consentement à tout moment via l'icône de cookie en bas à gauche de chaque page ; la mesure prendra alors fin immédiatement et les cookies mentionnés seront supprimés. Après six mois, nous vous demanderons à nouveau.",
          ],
        },
        {
          titel: "Publicité et mesure de performance",
          paragraphs: [
            "Avec votre consentement, nous utilisons des cookies marketing pour mesurer le succès de nos publicités et vous montrer des annonces pertinentes sur d'autres plateformes. Sont impliqués Meta Platforms Ireland (Meta-Pixel, cookie _fbp), LinkedIn Ireland (Insight-Tag, cookies li_gc et bcookie) et Google Ireland Limited (Google Ads, cookie _gcl_au). La base juridique est l'Art. 6, paragraphe 1, lettre a du RGPD. Sans votre consentement, aucun de ces scripts ne sera chargé et aucun cookie ne sera placé ; en cas de révocation, nous les supprimerons. Les détails de chaque cookie sont disponibles dans la [Politique en matière de cookies](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Compte client et utilisation de la plateforme",
      paragraphs: [
        "Pour l’inscription et la gestion d’un compte, nous traitons les informations que vous ou votre établissement saisissez : nom, dénomination sociale et forme juridique, adresse, adresse e-mail, numéro de téléphone, rôle et autorisations, données d’immatriculation (par exemple numéro au registre du commerce ou numéro de TVA), coordonnées bancaires pour les versements ainsi que les contenus créés dans le compte.",
        "Afin de sécuriser l’accès, nous traitons en outre les journaux de connexion (moment, adresse IP, appareil et navigateur utilisés lors de la connexion) et — si elle est activée — les données de l’authentification à deux facteurs.",
        "Connexion avec Google : au lieu d’une adresse e-mail et d’un mot de passe, vous pouvez également vous connecter avec un compte Google. Si vous choisissez cette voie, Google Ireland Limited ne nous communique que votre adresse e-mail, votre nom, votre photo de profil et un identifiant de votre compte Google (portées « openid », « email », « profile ») — expressément aucun accès à vos e-mails, contacts, fichiers ou agendas. Nous ne connaissons pas votre mot de passe Google. Google traite l’opération de connexion en tant que responsable du traitement distinct ; la [politique de confidentialité de Google](https://policies.google.com/privacy) s’applique. La base légale est l’art. 6, paragraphe 1, point b), du RGPD, la connexion servant à l’exécution du contrat ; le choix de ce mode de connexion est facultatif et peut à tout moment être remplacé par la connexion avec adresse e-mail et mot de passe.",
        "La base légale est l’art. 6, paragraphe 1, point b), du RGPD (exécution du contrat d’utilisation, voir les [CGU](" +
          AGB_URL +
          ")), l’art. 6, paragraphe 1, point f), du RGPD pour la sécurisation de l’accès et l’art. 6, paragraphe 1, point c), du RGPD pour la conservation à des fins fiscales et commerciales.",
      ],
    },
    {
      heading: "Réservations, données des hôtes et des biens",
      paragraphs: [
        "La plateforme permet de traiter des réservations, des données d’hôtes, des messages, des tâches et des facturations. Cela comprend notamment le nom et les coordonnées de l’hôte, les dates d’arrivée et de départ, le nombre de voyageurs, les prix et le statut de paiement, les historiques de messages ainsi que — dans la mesure où l’établissement les recueille — les données de déclaration de séjour et les demandes particulières.",
        "Ce traitement a lieu pour le compte et sur instruction de l’établissement concerné. Nous n’utilisons pas ces données à nos propres fins, ni à des fins publicitaires, ni pour l’entraînement de modèles d’IA.",
        "Au sein d’un établissement, les données sont séparées par rôles : le personnel de ménage et de service ne voit aucune donnée financière ou commerciale, les propriétaires ne voient que leurs propres biens. Entre différents établissements, les données sont séparées techniquement (règles d’accès par client dans la base de données).",
      ],
    },
    {
      heading: "Traitement des paiements",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Les paiements par carte et les versements passent par Stripe Payments Europe, Limited, Irlande. Sont alors transmises à Stripe les données nécessaires au paiement (montant, devise, moyen de paiement, nom, adresse e-mail, référence de réservation) ainsi que, pour les comptes de nos clients, les données d’identification légalement prescrites (titulaire, bénéficiaires effectifs, données d’identité, coordonnées bancaires). Les données de carte complètes n’atteignent pas nos systèmes. Les bases légales sont l’art. 6, paragraphe 1, point b), du RGPD et, pour les obligations d’identification et de lutte contre le blanchiment de capitaux, l’art. 6, paragraphe 1, point c), du RGPD. Les modalités sont régies par la [politique de confidentialité de Stripe](https://stripe.com/privacy).",
            "Liens de paiement pour les prestations complémentaires : lorsqu’un établissement facture à son hôte une prestation complémentaire (par exemple le ménage ou le linge) au moyen d’un lien de paiement, ce lien conduit à une page de paiement exploitée par Stripe. Nous transmettons à cette fin à Stripe la désignation de la prestation, le montant, la devise ainsi qu’une référence interne à la réservation et à l’établissement ; le logo de l’établissement est transféré vers son compte Stripe afin que la page affiche sa marque. Sur la page de paiement elle-même, Stripe collecte les données de paiement et d’appareil de l’hôte sous sa propre responsabilité. Ne nous reviennent que le statut du paiement, le montant, les montants retenus et les identifiants du paiement — aucune donnée de carte.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Si l’établissement propose PayPal comme moyen de paiement, les données de paiement sont transmises à PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxembourg. La [politique de confidentialité de PayPal](https://www.paypal.com/de/webapps/mpp/ua/privacy-full) s’applique.",
          ],
        },
      ],
    },
    {
      heading: "Canaux de distribution et portails",
      paragraphs: [
        "Lorsqu’un établissement commercialise ses biens via des portails tels que Booking.com, Airbnb ou Expedia, les disponibilités, les prix, les restrictions et les données de réservation sont échangés avec le portail concerné par l’intermédiaire de notre prestataire de connexion Channex.io Ltd, Royaume-Uni. Dans l’autre sens, nous recevons du portail les données de réservation et d’hôtes.",
        "Les dispositions du portail concerné en matière de protection des données s’appliquent à celui-ci ; dans cette mesure, le portail est responsable de manière autonome. La base légale de la transmission est l’art. 6, paragraphe 1, point b), du RGPD, en lien avec la mission confiée par l’établissement.",
      ],
    },
    {
      heading: "Communication",
      unterpunkte: [
        {
          titel: "E-mail",
          paragraphs: [
            "Les e-mails envoyés et reçus dans le cadre de l’utilisation (confirmations de réservation, messages système, assistance, liens de confirmation et d’invitation) passent par un serveur de messagerie que nous exploitons nous-mêmes. Aucun service d’envoi externe n’intervient pour ces messages.",
          ],
        },
        {
          titel: "Lettre d’information et préinscription",
          paragraphs: [
            "Sur notre site web, vous pouvez vous inscrire pour recevoir des actualités concernant myNextDays (préinscription/lettre d’information). Sont alors traités votre adresse e-mail, la langue et l’endroit où vous vous êtes inscrit.",
            "L’inscription se déroule selon la procédure du double opt-in : après votre inscription, vous recevez un e-mail contenant un lien de confirmation ; l’inscription ne prend effet qu’au clic sur ce lien. Afin de prouver le consentement, nous conservons le moment de l’inscription et de la confirmation, l’adresse IP utilisée à cette occasion, l’identification du navigateur ainsi que le texte auquel vous avez consenti. Ces informations servent exclusivement à la preuve exigée par l’art. 7, paragraphe 1, du RGPD et ne sont pas exploitées à des fins publicitaires.",
            "La base légale est votre consentement au titre de l’art. 6, paragraphe 1, point a), du RGPD ; la conservation de la preuve repose sur l’art. 6, paragraphe 1, point c), en lien avec l’art. 7, paragraphe 1, du RGPD. Vous pouvez retirer votre consentement à tout moment, avec effet pour l’avenir — via le lien de désabonnement figurant dans chaque envoi ou par simple e-mail adressé à nous. Le retrait ne remet pas en cause la licéité du traitement effectué jusqu’à cette date.",
            "Pour la gestion et l’envoi des lettres d’information, nous faisons appel à Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, France ; établissement allemand : Brevo GmbH, Köpenicker Straße 126, 10179 Berlin) en qualité de sous-traitant. Sont transmis votre adresse e-mail et les informations complémentaires mentionnées (langue, source). Les données sont traitées sur des serveurs situés dans l’Union européenne (France et Allemagne) ; un contrat de sous-traitance au sens de l’art. 28 du RGPD a été conclu avec Brevo. La [politique de confidentialité de Brevo](https://www.brevo.com/legal/privacypolicy/) s’applique.",
            "Lorsque nous envoyons une lettre d’information, Brevo mesure pour notre compte si le message a été ouvert et si les liens qu’il contient ont été cliqués. Cette mesure nous aide à adapter le contenu et la fréquence ; elle fait partie du consentement et cesse avec votre désabonnement. Aucun rapprochement avec d’autres sources de données ni aucun profilage n’a lieu.",
            "Tant que la confirmation fait défaut, votre adresse n’est pas sollicitée et n’est pas transmise à Brevo ; une inscription non confirmée expire au bout de sept jours. Après un désabonnement, nous bloquons l’adresse pour l’envoi et conservons la preuve du consentement et du désabonnement aussi longtemps que des droits peuvent en être tirés ; sur demande, nous la supprimons intégralement.",
          ],
        },
        {
          titel: "Messages dans la plateforme",
          paragraphs: [
            "Les messages échangés entre l’hôte et l’établissement sont conservés dans la plateforme afin que les deux parties puissent consulter l’historique. Si un établissement bloque un hôte, le canal de messagerie est fermé ; les messages existants sont conservés à des fins de traçabilité.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Si un établissement utilise la connexion WhatsApp, le contenu des messages et les numéros de téléphone des personnes concernées sont transmis via la WhatsApp Business Platform de Meta Platforms Ireland Limited. L’établissement décide de l’utilisation de cette fonctionnalité ; sans activation, aucune transmission n’a lieu.",
          ],
        },
      ],
    },
    {
      heading: "Fonctions automatisées et intelligence artificielle",
      paragraphs: [
        "Outre le RGPD, les fonctions décrites ici relèvent du règlement (UE) 2024/1689 (règlement sur l’intelligence artificielle, « AI Act »), dont les obligations de transparence prévues à l’art. 50 sont applicables depuis le 2 août 2026.",
      ],
      unterpunkte: [
        {
          titel: "Suggestions de réponse",
          paragraphs: [
            "Pour les suggestions de réponse dans la boîte de réception des messages, nous recourons — si la fonctionnalité est activée pour l’établissement — à l’offre de modèles de langage de Groq, Inc., États-Unis. Le contexte du message concerné est alors transmis à ce service. Les suggestions ne sont pas envoyées automatiquement ; l’envoi est toujours décidé par un être humain. Aucune prise de décision automatisée produisant des effets juridiques au sens de l’art. 22 du RGPD n’a lieu.",
            "Il ne s’agit donc pas d’un système d’IA qui interagit directement avec des personnes physiques au sens de l’art. 50, paragraphe 1, du règlement sur l’intelligence artificielle : cette obligation suppose une interaction DIRECTE, dans laquelle l’IA communique elle-même avec la personne et non par l’intermédiaire d’un être humain. Ici, la fonctionnalité propose à l’établissement un texte qu’un membre du personnel vérifie, peut modifier et envoie lui-même — ce membre du personnel est cet intermédiaire, l’hôte correspond avec l’établissement et non avec un agent conversationnel. Aucun assistant répondant automatiquement n’est utilisé. Selon notre analyse, la fonctionnalité ne relève pas non plus de l’un des cas d’IA à haut risque énumérés à l’annexe III du règlement sur l’intelligence artificielle.",
            "Les messages adressés aux hôtes ne constituent en outre pas un « texte portant sur des questions d’intérêt public » au sens de l’art. 50, paragraphe 4, du règlement sur l’intelligence artificielle : ils ne sont pas publiés, mais envoyés individuellement à une personne déterminée, et concernent le déroulement d’un séjour. Indépendamment de cela, la vérification humaine par le membre du personnel expéditeur s’applique ici.",
            "Si une fonctionnalité répondant d’elle-même aux hôtes — sans validation humaine — devait être proposée à l’avenir, l’hôte sera informé de manière visible, dès le début du dialogue, qu’il écrit à un système d’IA. Sans cette information, une telle fonctionnalité ne sera pas mise à disposition.",
          ],
        },
        {
          titel: "Rôles au titre du règlement sur l’intelligence artificielle",
          paragraphs: [
            "Pour les fonctions d’IA intégrées au produit, nous sommes déployeur au sens de l’art. 3, point 4), du règlement sur l’intelligence artificielle ; les fournisseurs des modèles de langage sous-jacents sont les fournisseurs de modèles concernés. Lorsqu’un établissement utilise ces fonctions dans le cadre de son activité professionnelle, il en est lui-même déployeur et l’obligation de maîtrise de l’IA prévue à l’art. 4 du règlement lui incombe, obligation applicable depuis le 2 février 2025 indépendamment de la taille de l’entreprise. Depuis le 27 juillet 2026, elle s’applique dans sa version issue du règlement (UE) 2026/1744 : les fournisseurs et les déployeurs prennent des mesures pour soutenir le développement de la maîtrise de l’IA de leur personnel ; un niveau déterminé n’a expressément pas à être garanti. Nous apportons notre soutien par des indications dans l’application et dans notre centre d’aide ; la formation de son propre personnel demeure à la charge de l’établissement.",
            "Lorsqu’un établissement relie son compte à son propre assistant d’IA (voir le point suivant), il en est également déployeur au sens du règlement sur l’intelligence artificielle — il décide de son utilisation et formule les requêtes. L’interface elle-même n’est pas un système d’IA : elle lit des données dans la base de données et les restitue, sans opérer d’inférences ; le considérant 12 du règlement sur l’intelligence artificielle distingue expressément de tels systèmes de l’IA.",
          ],
        },
        {
          titel: "Connexion avec un assistant d’IA propre",
          paragraphs: [
            "Un établissement peut relier son compte, via une interface, à un assistant d’IA qu’il a choisi lui-même et avec lequel il a conclu son propre contrat — par exemple Claude d’Anthropic PBC, États-Unis. Lorsqu’une telle connexion est accordée, l’assistant peut, à la demande de l’établissement, consulter en lecture seule : l’occupation, les disponibilités et les prix journaliers ; les réservations avec le nom de l’hôte, la période de séjour, le bien, le canal de réservation, le statut ainsi que le montant et la devise, dans la mesure où le rôle du compte interrogateur est autorisé à voir des montants ; et l’aperçu des conversations de la boîte de réception. Sans connexion accordée, aucune transmission n’a lieu.",
            "Ne sont pas transmis l’adresse e-mail et le numéro de téléphone des hôtes, les données de carte, les coordonnées bancaires et les justificatifs de paiement, les codes d’accès ainsi que les dossiers des biens. Les notes de réservation et le contenu des messages des hôtes sont exclus par défaut, car ils peuvent contenir des indications relatives à la santé ou d’autres catégories particulières au sens de l’art. 9 du RGPD ; l’établissement doit les autoriser expressément et séparément lors de l’octroi.",
            "Seul un compte doté du rôle « administrateur » peut accorder la connexion, et non tout compte disposant d’un accès. Chaque consultation est journalisée et peut être consultée par l’établissement sous « Compte → Connexions » ; il peut y interrompre la connexion à tout moment, ce qui met immédiatement fin à l’accès.",
            "Juridiquement, cette transmission constitue une instruction de l’établissement à notre égard (art. 28, paragraphe 3, point a), du RGPD). Le fournisseur de l’assistant n’est pas notre sous-traitant ultérieur — nous ne le mandatons pas et ne lui donnons pas d’instructions ; il traite les données sur la base du contrat que l’établissement a lui-même conclu avec lui. C’est donc l’établissement qui est responsable de la base légale de ce traitement, de l’information de ses hôtes et des garanties encadrant un transfert vers un pays tiers.",
          ],
        },
        {
          titel: "Traductions",
          paragraphs: [
            "Les textes des biens et des contenus peuvent être traduits au moyen de la Cloud Translation API de Google Ireland Limited. Sont alors transmis les textes à traduire ; des données à caractère personnel uniquement dans la mesure où elles figurent dans ces textes.",
          ],
        },
        {
          titel: "Recommandations de prix",
          paragraphs: [
            "Pour les recommandations de prix, nous accédons à des données de marché, météorologiques et de taux de change provenant de sources externes. Ces requêtes ne contiennent aucune donnée à caractère personnel, mais uniquement le lieu, la période et les caractéristiques du bien.",
          ],
        },
      ],
    },
    {
      heading: "Sites web et domaines de nos clients",
      paragraphs: [
        "Lorsqu’un établissement crée, au moyen du constructeur de sites, son propre site web avec son propre domaine, nous gérons les enregistrements DNS nécessaires à cette fin via Cloudflare, Inc. Des données de domaine et de configuration sont alors transmises ; les données des visiteurs du site web du client sont traitées comme décrit dans la présente déclaration.",
        "L’établissement concerné est responsable du contenu, des mentions légales et des informations relatives à la protection des données du site web du client.",
      ],
    },
    {
      heading: "Programme de partenariat",
      paragraphs: [
        "Nous exploitons un programme de partenariat par lequel des partenaires (influenceurs, consultants, agences, clients) recommandent des entreprises à myNextDays et reçoivent une commission en retour. Dans ce cadre, nous traitons les données des partenaires et — dans une faible mesure — des entreprises recommandées.",
      ],
      unterpunkte: [
        {
          titel: "Données des partenaires",
          paragraphs: [
            "Lors de la candidature, nous traitons le nom, la raison sociale, la forme juridique, le pays, l'adresse e-mail, la langue, les comptes de médias sociaux (plateforme, adresse, identifiant, portée auto-déclarée), le numéro d'identification TVA (vérification via le système européen VIES), les données de paiement (IBAN, adresse Wise ou PayPal) ainsi que le consentement aux conditions de participation avec la version et la date. La base juridique est l'exécution du contrat de partenariat (Art. 6, paragraphe 1, lettre b du RGPD) ; pour les crédits et la conservation, les obligations fiscales et commerciales s'appliquent (Art. 6, paragraphe 1, lettre c du RGPD).",
            "Si un partenaire gère une équipe, il voit le nom ou la raison sociale, le rang, le nombre de clients payants et la commission d'équipe qui en résulte pour ses partenaires d'équipe. Les messages entre le sponsor et le partenaire d'équipe sont stockés sur la plateforme afin que les deux puissent voir l'historique.",
          ],
        },
        {
          titel: "Clics sur les liens de partenariat",
          paragraphs: [
            "Lorsqu'un visiteur accède à un lien de partenariat (mynextdays.com/p/CODE), nous enregistrons le code, l'heure, la page consultée, la page de référence et les éventuels paramètres de campagne, ainsi que l'adresse IP et l'identifiant du navigateur, exclusivement sous forme de sommes de contrôle hachées (hash) — pour la détection des abus (fréquence), et non pour la réidentification. Aucun cookie de suivi n'est défini. Nous supprimons les données de clic après 90 jours. La base juridique est notre intérêt légitime à une facturation du programme à l'abri de la fraude (Art. 6, paragraphe 1, lettre f du RGPD).",
          ],
        },
        {
          titel: "Comptes et publications de médias sociaux connectés",
          paragraphs: [
            "Les partenaires peuvent volontairement connecter leurs comptes YouTube (Google), Instagram et Facebook (Meta) ainsi que TikTok au tableau de bord des partenaires. Ce faisant, ils accordent à la plateforme respective une autorisation de lecture (OAuth) ; nous n'écrivons rien sur ces comptes. Nous stockons l'identifiant et le nom du compte, le jeton d'accès chiffré, la date de connexion ainsi qu'une mesure quotidienne par compte : nombre d'abonnés ou de followers, vues des 28 derniers jours, taux d'interaction et nombre de publications, chacun avec la date de la réponse de la plateforme. Pour les publications que le partenaire crée dans le tableau de bord (titre, plateforme, adresse, date de publication), nous stockons en outre les vues, les likes, les commentaires, les partages et les sauvegardes de la plateforme.",
            "Le but est de vérifier la portée indiquée par le partenaire et d'attribuer les clics et les clients à des publications individuelles ; les informations non vérifiées sont moins pondérées lors de la publication. Les indications d'incohérences (par exemple, un pic de followers sans vues correspondantes) servent exclusivement à notre vérification manuelle et ne mènent à aucune décision automatisée. La base juridique est le consentement du partenaire (article 6, paragraphe 1, point a du RGPD), qu'il donne en se connectant et qu'il peut révoquer à tout moment dans le tableau de bord sous « Déconnecter » ; lors de la déconnexion, nous supprimons immédiatement le jeton d'accès, les valeurs de mesure enregistrées restent comme historique et sont supprimées avec le compte partenaire. Nous utilisons exclusivement les interfaces officielles des plateformes ; le traitement par Google, Meta et TikTok est soumis à leurs propres politiques de confidentialité.",
          ],
        },
        {
          titel: "Établissements recommandés",
          paragraphs: [
            "Si un établissement s'enregistre avec un code partenaire, nous enregistrons l'attribution de l'établissement au partenaire ainsi que l'heure, le mode (lien ou code) et le statut. Le partenaire voit l'établissement uniquement de manière pseudonyme (numéro séquentiel, pays, statut, montants) — jamais le nom, l'adresse e-mail ou les données de réservation. Ce n'est que si l'établissement donne son consentement explicite lors de l'enregistrement que le partenaire peut le contacter via la plateforme. Pour le calcul des commissions, nous traitons les montants nets des abonnements des factures payées de l'établissement ; la base juridique est l'exécution du contrat de partenariat et du contrat d'utilisation (article 6, paragraphe 1, point b du RGPD).",
          ],
        },
      ],
    },
    {
      heading: "Hébergement et stockage",
      paragraphs: [
        "La plateforme, la base de données, les médias et le serveur de messagerie fonctionnent sur des serveurs de Hetzner Online GmbH, Allemagne, dans le centre de données d’Helsinki (Finlande) — donc au sein de l’Union européenne. Un contrat de sous-traitance a été conclu avec Hetzner.",
        "Les copies de sauvegarde sont créées sous forme chiffrée et conservées chiffrées auprès d’un prestataire de stockage situé dans l’UE.",
      ],
    },
    {
      heading: "Aperçu des destinataires",
      paragraphs: [
        "En dehors des prestataires mentionnés, nous ne communiquons des données à caractère personnel que lorsque nous y sommes légalement tenus (par exemple aux autorités fiscales, aux autorités de poursuite pénale) ou lorsque vous, ou l’établissement responsable, le demandez.",
      ],
      list: [
        "Hetzner Online GmbH (Allemagne/Finlande) — hébergement, base de données, médias, serveur de messagerie",
        "Stripe Payments Europe, Limited (Irlande) — paiements, versements, vérification d’identité",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxembourg) — paiements, si activés",
        "Channex.io Ltd (Royaume-Uni) — connexion aux portails de réservation",
        "Meta Platforms Ireland Limited (Irlande) — messages WhatsApp, si activés",
        "Sendinblue SAS / Brevo (France, Allemagne) — gestion et envoi de la lettre d’information, uniquement en cas de consentement",
        "Google Ireland Limited (Irlande) — traductions ; protection anti-spam du formulaire de contact (reCAPTCHA Enterprise), uniquement en cas de consentement ; connexion avec Google, si utilisée; Mesure d'audience (Google Analytics 4), uniquement avec consentement",
        "Groq, Inc. (États-Unis) — suggestions de réponse, si activées",
        "Cloudflare, Inc. (États-Unis) — gestion DNS pour les domaines des clients",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Ne figurent pas dans cette liste les services qu’un établissement convient lui-même avec un tiers et qu’il relie à son compte via l’interface — par exemple un assistant d’IA tel que Claude d’Anthropic PBC, États-Unis. Il ne s’agit pas de prestataires que nous avons mandatés, mais de destinataires agissant sur instruction de l’établissement concerné ; sans la connexion accordée par celui-ci, aucune donnée n’y est transmise. Selon la liste officielle des participants tenue par le ministère du Commerce des États-Unis, Anthropic n’est pas certifié au titre de l’EU-US Data Privacy Framework ; un transfert repose donc sur les clauses contractuelles types, dont l’établissement concerné doit répondre en tant que responsable du traitement.",
          ],
        },
      ],
    },
    {
      heading: "Transferts vers des pays tiers",
      paragraphs: [
        "Le traitement a en principe lieu au sein de l’UE. Pour les services mentionnés ci-dessus dont le siège se situe en dehors de l’UE, un transfert vers un pays tiers peut se produire.",
        "Pour Groq, Inc. et Cloudflare, Inc. (États-Unis), nous fondons le transfert sur les clauses contractuelles types de la Commission européenne au titre de l’art. 46, paragraphe 2, point c), du RGPD, dans la mesure où le destinataire ne peut pas se prévaloir d’une décision d’adéquation (EU-US Data Privacy Framework).",
        "Le cocontractant pour le traitement des paiements est Stripe Payments Europe, Limited (Irlande). Dans la mesure où Stripe recourt à cette occasion à Stripe, LLC (États-Unis), celle-ci est certifiée au titre de l’EU-US Data Privacy Framework ; le transfert repose alors sur la décision d’adéquation de la Commission européenne au titre de l’art. 45 du RGPD. À titre complémentaire, les clauses contractuelles types du [contrat de sous-traitance de Stripe](https://stripe.com/legal/dpa) s’appliquent.",
        "Pour Channex.io Ltd (Royaume-Uni), la décision d’adéquation de la Commission européenne relative au Royaume-Uni s’applique ; si celle-ci disparaît, les clauses contractuelles types prennent le relais.",
      ],
    },
    {
      heading: "Accès des autorités de pays tiers (CLOUD Act des États-Unis)",
      paragraphs: [
        "Les fournisseurs soumis à la compétence juridique des États-Unis peuvent être contraints, en vertu du CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018) des États-Unis, de communiquer des données à des autorités américaines — y compris lorsque ces données se trouvent sur des serveurs situés dans l’Union européenne. Un tel accès peut être contraire au RGPD, et le fournisseur peut être juridiquement empêché de nous ou de vous en informer. Ni la décision d’adéquation relative à l’EU-US Data Privacy Framework ni les clauses contractuelles types n’excluent ce risque.",
        "Nous limitons ce risque en faisant exploiter les systèmes porteurs — plateforme, base de données, médias, serveur de messagerie et copies de sauvegarde — auprès de fournisseurs européens au sein de l’UE, où aucune compétence juridique américaine ne s’applique.",
      ],
      unterpunkte: [
        {
          titel: "Services concernés",
          paragraphs: [
            "Une compétence juridique américaine n’est envisageable que pour les services complémentaires suivants, clairement délimités :",
          ],
          list: [
            "Groq, Inc. (États-Unis) — suggestions de réponse dans la boîte de réception des messages, uniquement si l’établissement active la fonctionnalité. Le contexte du message concerné est transmis.",
            "Cloudflare, Inc. (États-Unis) — gestion DNS pour les domaines des clients. Sont transmises des données de domaine et de configuration, aucune donnée d’hôtes.",
            "Google LLC (USA) — lors de l'inscription avec Google, pour les traductions et pour la mesure d'audience (Google Analytics 4, uniquement avec consentement) ; le partenaire contractuel est Google Ireland Limited, mais un accès par la société mère américaine n'est pas exclu.",
          ],
        },
        {
          titel: "Caractère évitable",
          paragraphs: [
            "L’utilisation de la plateforme est possible sans ces services : les suggestions de réponse peuvent être désactivées, la gestion DNS ne concerne que les clients disposant de leur propre domaine, et la connexion avec Google est une alternative facultative à la connexion avec adresse e-mail et mot de passe.",
          ],
        },
        {
          titel: "Distinction avec le droit européen",
          paragraphs: [
            "Le CLOUD Act relève du droit des États-Unis, et non du droit de l’Union européenne. Il doit être distingué de l’EU Data Act (règlement (UE) 2023/2854), qui régit le changement de prestataire et la portabilité pour les services de traitement de données, ainsi que du Cloud and AI Development Act, qui se trouve, à la date de la présente déclaration, dans la procédure législative européenne.",
          ],
        },
      ],
    },
    {
      heading: "Durées de conservation",
      list: [
        "Données du compte : pendant la durée de la relation commerciale ; ensuite suppression, dans la mesure où aucune obligation de conservation ne s’y oppose.",
        "Données de réservation, de facturation et de paiement : selon la loi danoise sur la comptabilité, cinq ans après la fin de l’exercice auquel elles se rattachent ; pour les clients établis en Allemagne, des délais commerciaux et fiscaux plus longs peuvent s’appliquer.",
        "Messages et données d’hôtes dans la plateforme : sur instruction de l’établissement responsable, au plus tard jusqu’à leur suppression par celui-ci ou jusqu’à la fin du contrat.",
        "Lettre d’information : jusqu’au retrait du consentement ; les inscriptions non confirmées expirent au bout de sept jours. La preuve du consentement et du désabonnement est conservée au-delà, aussi longtemps qu’elle est nécessaire à titre de preuve.",
        "Journaux de connexion et événements de sécurité : à court terme, aux fins de la détection des attaques.",
        "Fichiers journaux du serveur : uniquement le temps nécessaire à l’exploitation et à la sécurité.",
        "Copies de sauvegarde : par rotation, jusqu’à leur remplacement par des sauvegardes plus récentes.",
      ],
    },
    {
      heading: "Vos droits",
      paragraphs: [
        "Vous disposez du droit d’accès (art. 15), de rectification (art. 16), d’effacement (art. 17), à la limitation du traitement (art. 18), à la portabilité des données (art. 20) et d’opposition aux traitements fondés sur des intérêts légitimes (art. 21 du RGPD). Vous pouvez retirer à tout moment un consentement donné, avec effet pour l’avenir.",
        `Adressez-vous pour cela à [${ANBIETER.email}](mailto:${ANBIETER.email}). Si vos données concernent l’utilisation de la plateforme par un établissement, nous transmettons votre demande à l’établissement responsable ou assistons celui-ci dans sa réponse.`,
        `Vous pouvez en outre introduire une réclamation auprès d’une autorité de contrôle en matière de protection des données — celle qui est compétente pour nous est ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Vous pouvez également vous adresser à l’autorité de contrôle de votre lieu de résidence.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Ein Abschnitt „Ihre Rechte", der die
      // Löschung nur als DSGVO-Artikel erwähnt, genügt der Prüfung nicht.
      heading: "Supprimer le compte et les données de l’application",
      paragraphs: [
        "Vous pouvez à tout moment demander vous-même la suppression de votre compte — dans l’application sous « Profil → Compte » ou au moyen de notre formulaire sur le web :",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "La voie web fonctionne délibérément aussi lorsque vous n’avez plus l’application installée ou que vous ne pouvez plus vous connecter. Pour prévenir les abus, cela se déroule en deux étapes : vous indiquez l’adresse e-mail de votre compte et vous recevez, à cette adresse précise, un lien de confirmation. Seule l’ouverture de ce lien rend la demande valable — une adresse indiquée ne produit à elle seule aucun effet. Nous traitons la demande dans un délai de 30 jours et répondons par e-mail.",
        "Avec le compte, nous supprimons vos données d’accès, votre profil, vos données de biens et de calendrier ainsi que vos messages. Ne sont pas supprimés les documents soumis à une obligation légale de conservation — en particulier les factures et les justificatifs de réservation des périodes facturées (obligation comptable de droit danois, en règle générale cinq ans). Ces documents sont bloqués pendant la durée du délai, c’est-à-dire conservés exclusivement aux fins de l’exécution de cette obligation, puis supprimés.",
      ],
    },
    {
      heading: "Sécurité du traitement",
      paragraphs: [
        "Nous sécurisons le traitement par des mesures techniques et organisationnelles conformes à l’art. 32 du RGPD, en particulier : chiffrement du transport de bout en bout (TLS), règles d’accès par client directement dans la base de données, autorisations fondées sur les rôles avec séparation des données financières et des données de service, authentification à deux facteurs facultative, limitation des tentatives de connexion, copies de sauvegarde chiffrées avec test de restauration régulier ainsi que journalisation des événements pertinents pour la sécurité.",
      ],
    },
    {
      heading: "Obligation de fournir les données",
      paragraphs: [
        "Les informations dont nous avons besoin pour la conclusion du contrat, la facturation et les obligations légales sont nécessaires — sans elles, nous ne pouvons pas mettre la plateforme à disposition. Toutes les autres informations sont facultatives.",
      ],
    },
    {
      heading: "Modifications de la présente déclaration",
      paragraphs: [
        "Nous adaptons la présente déclaration lorsque les traitements, les prestataires utilisés ou la situation juridique évoluent. La version publiée ici est celle qui s’applique ; la date indiquée en haut en précise l’état.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default datenschutz;
