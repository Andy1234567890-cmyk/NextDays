// Französische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin
// (dort stehen auch die Belege für die technischen und organisatorischen
// Maßnahmen und die Liste der Unterauftragsverarbeiter).
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Accord de sous-traitance des données à caractère personnel",
  metaDescription:
    "Sous-traitance au titre de l’article 28 du RGPD entre myNextDays ApS et les établissements qui utilisent la plateforme : objet, instructions, sécurité, sous-traitants ultérieurs.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Le présent accord (ci-après l’« accord de sous-traitance ») s’applique entre l’établissement qui utilise la plateforme myNextDays (ci-après le « responsable du traitement ») et ${ANBIETER.firma} (ci-après le « sous-traitant » ou « nous ») et précise les obligations résultant de l’article 28 du règlement (UE) 2016/679 (RGPD).`,
    `Il est intégré par les [conditions générales](${AGB_URL}) et s’applique pendant toute la durée d’utilisation de la plateforme. Il prévaut sur les conditions générales pour tout ce qui concerne le traitement de données à caractère personnel pour le compte du responsable du traitement.`,
    "En complément, la [politique de confidentialité](/datenschutz) s’applique aux données que nous traitons en tant que responsable du traitement pour notre propre compte — en particulier les données du compte et de la relation commerciale.",
  ],
  sections: [
    {
      heading: "Objet et répartition des rôles",
      unterpunkte: [
        {
          paragraphs: [
            "L’objet est le traitement des données à caractère personnel que le responsable du traitement introduit dans la plateforme ou collecte par son intermédiaire, afin que nous puissions fournir les prestations convenues contractuellement : gestion des biens, des réservations et de l’occupation, communication avec les clients, traitement des paiements, comptabilité et décomptes des propriétaires, connexion aux portails de réservation, créateur de site web ainsi que gestion des tâches et de l’équipe.",
          ],
        },
        {
          paragraphs: [
            "Le responsable du traitement décide des finalités et des moyens de ce traitement. Nous traitons les données exclusivement sur son instruction documentée et non à nos propres fins.",
          ],
        },
        {
          paragraphs: [
            "Pour les données du compte, la facturation de nos propres prestations, la sécurité du système et la conservation légale, nous sommes nous-mêmes responsable du traitement. Ce traitement n’est pas l’objet du présent accord de sous-traitance.",
          ],
        },
      ],
    },
    {
      heading: "Nature, portée et finalité du traitement",
      paragraphs: [
        "Le traitement s’effectue par la collecte, la conservation, l’affichage, la modification, la communication à des destinataires choisis par le responsable du traitement (par exemple portails de réservation, prestataires de services de paiement), la limitation et l’effacement — sous forme automatisée dans la plateforme.",
        "Le lieu du traitement est l’Union européenne ; les exceptions sont énumérées de manière exhaustive à la section 8.",
      ],
    },
    {
      heading: "Catégories de personnes concernées",
      list: [
        "Les clients et les personnes qui réservent, y compris les compagnons de voyage",
        "Les personnes intéressées qui adressent des demandes ou envoient des messages",
        "Les propriétaires des biens gérés",
        "Les collaborateurs du responsable du traitement (équipe, ménage, service, réception)",
        "Les interlocuteurs des partenaires et des prestataires du responsable du traitement",
      ],
    },
    {
      heading: "Catégories de données à caractère personnel",
      list: [
        "Données de base : nom, adresse, date de naissance si elle est enregistrée, nationalité si elle est enregistrée aux fins de l’obligation de déclaration",
        "Données de contact : adresse électronique, numéro de téléphone",
        "Données de réservation : période, bien, nombre de voyageurs, prix, prestations supplémentaires, annulations",
        "Données de paiement : montant, devise, mode de paiement, statut du paiement, références (les données complètes de carte n’atteignent pas nos systèmes)",
        "Données de communication : messages, notes, avis",
        "Données d’accès et d’utilisation des collaborateurs : rôle, autorisations, moment de la connexion, appareil et adresse IP de la connexion",
        "Les catégories particulières visées à l’article 9 du RGPD ne sont pas l’objet de la mission ; le responsable du traitement n’introduit pas de telles données dans les champs de texte libre.",
      ],
    },
    {
      heading: "Instructions",
      unterpunkte: [
        {
          paragraphs: [
            "Le responsable du traitement donne ses instructions par l’utilisation et la configuration de la plateforme ainsi que sous forme écrite à notre adresse de contact. Nous confirmons les instructions orales sous forme écrite.",
          ],
        },
        {
          paragraphs: [
            "Si nous estimons qu’une instruction est illicite, nous le signalons sans délai et pouvons suspendre sa mise en œuvre jusqu’à ce que le responsable du traitement la confirme ou la modifie.",
          ],
        },
        {
          paragraphs: [
            "Lorsque nous sommes légalement tenus de traiter des données (par exemple à l’égard des autorités), nous en informons le responsable du traitement au préalable, dans la mesure où le droit nous l’autorise.",
          ],
        },
        {
          titel: "Connexion de services propres du responsable du traitement",
          paragraphs: [
            "Le responsable du traitement peut connecter son compte, via une interface, à un service qu’il a choisi lui-même et avec lequel il a conclu son propre contrat — par exemple un assistant d’intelligence artificielle. S’il accorde une telle connexion, il s’agit de son instruction explicite au sens de l’article 28, paragraphe 3, point a), du RGPD de transmettre à ce service les données autorisées. Elle couvre expressément aussi un transfert vers un pays tiers qui y est lié, lorsque le service est établi en dehors de l’Union européenne.",
            "En bref : une telle connexion relève de la seule décision du responsable du traitement, et c’est lui qui est compétent pour le service connecté.",
            "Seul un compte disposant de l’autorisation de gérer les connexions externes peut l’accorder. Cette autorisation est réservée au rôle « administrateur » ; les comptes dotés de droits restreints — y compris le rôle « co-administrateur » — ne peuvent pas accorder de connexion. Nous consignons qui l’a accordée, quand et pour quel service, quels types de données ont été autorisés et quelles consultations ont eu lieu ; cette consignation est mise à la disposition du responsable du traitement dans l’interface sous « Compte → Connexions », afin qu’il puisse satisfaire à son obligation de responsabilité et répondre aux demandes d’accès.",
            "Le service connecté n’est pas notre sous-traitant ultérieur : nous ne le mandatons pas, nous ne le choisissons pas et nous ne lui donnons pas d’instructions. Il traite les données sur la base du contrat que le responsable du traitement a conclu lui-même avec lui. C’est donc le responsable du traitement qui est compétent pour ce traitement, pour sa base juridique et pour les garanties du transfert vers un pays tiers ; celui-ci n’est pas l’objet du présent accord de sous-traitance.",
            "Les champs de texte libre — notes de réservation et contenu des messages des clients — sont par défaut exclus d’une telle connexion. Ils peuvent contenir des catégories particulières de données à caractère personnel au sens de l’article 9 du RGPD, par exemple des données concernant la santé. Le responsable du traitement doit les autoriser séparément lors de l’octroi ; sans cette autorisation, elles ne sont pas transmises.",
            "Le responsable du traitement peut à tout moment interrompre une connexion accordée dans l’interface. Les jetons de renouvellement sont alors supprimés et, à chaque nouvelle consultation, il est vérifié si le consentement existe toujours — un service déconnecté ne peut donc plus rien lire immédiatement, et non seulement à l’expiration de son jeton d’accès.",
          ],
        },
      ],
    },
    {
      heading: "Confidentialité",
      paragraphs: [
        "Toutes les personnes susceptibles d’avoir accès aux données dans le cadre de la mission sont tenues à la confidentialité et reçoivent régulièrement une formation en matière de protection des données. L’accès est limité à ce qui est nécessaire pour la tâche concernée.",
        "Les accès de nos collaborateurs aux données des clients n’ont lieu qu’aux fins de correction d’erreurs, sur demande d’assistance ou pour satisfaire à des obligations légales.",
      ],
    },
    {
      heading: "Sécurité du traitement",
      paragraphs: [
        "Nous prenons les mesures techniques et organisationnelles requises par l’article 32 du RGPD. Sont notamment mises en œuvre :",
      ],
      list: [
        "Le chiffrement du transport (TLS) pour toutes les connexions, des en-têtes HTTP de sécurité y compris une Content-Security-Policy stricte",
        "La séparation des clients directement dans la base de données : règles d’accès par ligne (Row Level Security) et retrait des droits de table pour les données sensibles, de sorte qu’un accès en dehors de son propre établissement est exclu même par la voie directe de la base de données",
        "Des autorisations fondées sur les rôles avec séparation des données : le personnel de service et de ménage ne reçoit aucune donnée financière ni commerciale, les propriétaires uniquement leurs propres biens ; les données des clients sont masquées pour les rôles non autorisés",
        "L’authentification à deux facteurs (TOTP) disponible pour les comptes ; nouvelle authentification en cas de modifications critiques pour la sécurité",
        "Un journal des connexions avec l’appareil, le moment et l’adresse IP, consultable par le responsable du traitement",
        "Seul un compte doté du rôle « administrateur » peut accorder des connexions à des services externes ; chaque consultation via une telle connexion est journalisée (outil, moment, portée — sans les contenus eux-mêmes) et consultable par le responsable du traitement. Une connexion interrompue perd immédiatement l’accès : à chaque consultation, il est vérifié si le consentement existe toujours",
        "La limitation de la fréquence des requêtes contre les attaques automatisées, la vérification des signatures des appels de webhook entrants",
        "Des copies de sauvegarde chiffrées, conservées en dehors du système de production, avec test de restauration régulier",
        "Des environnements séparés pour le développement et l’exploitation ; les modifications de la base de données exclusivement au moyen de migrations versionnées",
      ],
    },
    {
      heading: "Sous-traitants ultérieurs",
      paragraphs: [
        "Le responsable du traitement autorise le recours aux sous-traitants ultérieurs suivants. Des contrats au sens de l’article 28, paragraphe 4, du RGPD, comportant des obligations correspondant au présent accord de sous-traitance, existent avec chacun d’eux.",
      ],
      list: [
        "Hetzner Online GmbH, Allemagne (serveurs, base de données, médias, serveur de messagerie ; centre de données à Helsinki, Finlande)",
        "Stripe Payments Europe, Limited, Irlande (paiements, versements, vérification légale de l’identité)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxembourg (paiements, si le responsable du traitement les active)",
        "Channex.io Ltd, Royaume-Uni (connexion aux portails de réservation, si elle est activée)",
        "Meta Platforms Ireland Limited, Irlande (messages WhatsApp, s’ils sont activés)",
        "Google Ireland Limited, Irlande (traduction de contenus ; connexion avec Google, si elle est utilisée)",
        "Groq, Inc., États-Unis (propositions de réponse dans la boîte de réception, si elles sont activées)",
        "Cloudflare, Inc., États-Unis (gestion des enregistrements DNS des domaines propres, si elle est utilisée)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Nous communiquons tout changement ou ajout au moins 30 jours à l’avance. Le responsable du traitement peut s’y opposer dans ce délai pour un motif important lié à la protection des données ; si l’opposition n’est pas levée, il peut résilier la partie concernée de la prestation ou le contrat.",
          ],
        },
        {
          paragraphs: [
            "Les services que le responsable du traitement convient lui-même avec un tiers ne constituent pas une sous-traitance ultérieure, mais un transfert qu’il a lui-même provoqué. Cela vaut pour un portail de réservation avec lequel il a son propre contrat, comme pour un assistant d’intelligence artificielle ou un autre programme qu’il connecte à son compte via l’interface (voir la section « Instructions »).",
            "Ce qui importe n’est pas de savoir par quels systèmes les données circulent, mais qui fait appel au service : une sous-traitance ultérieure naît lorsque NOUS mandatons un prestataire supplémentaire pour fournir notre prestation. Si le responsable du traitement choisit lui-même le service et conclut le contrat avec lui, ce service traite pour le responsable du traitement — et non pour nous. Cette délimitation correspond à la pratique contractuelle de fournisseurs comparables pour les services tiers connectés par le client.",
          ],
        },
      ],
    },
    {
      heading: "Transferts vers des pays tiers",
      paragraphs: [
        "Les transferts vers des destinataires établis en dehors de l’UE se limitent aux services mentionnés ci-dessus dont le siège se trouve aux États-Unis ou au Royaume-Uni. Ils reposent sur les clauses types de protection des données de la Commission européenne au sens de l’article 46, paragraphe 2, point c), du RGPD ou sur une décision d’adéquation en vigueur ; des mesures de protection complémentaires (chiffrement, minimisation des données) sont appliquées.",
      ],
    },
    {
      heading: "Assistance au responsable du traitement",
      unterpunkte: [
        {
          paragraphs: [
            "Nous assistons le responsable du traitement dans la réponse aux demandes des personnes concernées (articles 15 à 22 du RGPD). La plateforme offre à cette fin l’accès, la rectification, l’export et l’effacement des données directement dans l’interface. Si des personnes concernées s’adressent directement à nous, nous les renvoyons au responsable du traitement et l’en informons.",
          ],
        },
        {
          paragraphs: [
            "Nous assistons en outre lors des analyses d’impact relatives à la protection des données, pour le respect des obligations découlant des articles 32 à 36 du RGPD et lors des demandes des autorités de contrôle.",
          ],
        },
      ],
    },
    {
      heading: "Violations de données à caractère personnel",
      paragraphs: [
        "Si nous prenons connaissance d’une violation de données à caractère personnel concernant les données du responsable du traitement, nous l’en informons sans délai, au plus tard dans les 48 heures suivant cette connaissance, sous forme écrite.",
        "La communication contient, dans la mesure où ils sont connus, la nature et le moment de l’incident, les catégories de données et les groupes de personnes concernés, les conséquences probables ainsi que les mesures prises et proposées. Nous assistons le responsable du traitement dans ses obligations de notification et de communication au titre des articles 33 et 34 du RGPD.",
      ],
    },
    {
      heading: "Justificatifs et contrôles",
      unterpunkte: [
        {
          paragraphs: [
            "Nous apportons sur demande la preuve du respect du présent accord de sous-traitance, en particulier par des informations sur les mesures prises et sur les sous-traitants ultérieurs auxquels il est recouru.",
          ],
        },
        {
          paragraphs: [
            "Le responsable du traitement peut procéder à des contrôles dans la mesure nécessaire ou les faire réaliser par un auditeur indépendant qui n’est pas notre concurrent. Les contrôles ont lieu après annonce dans un délai raisonnable, pendant les heures habituelles d’ouverture et sans perturber l’exploitation. Les frais d’un contrôle allant au-delà de la simple information sont supportés par le responsable du traitement, sauf si le contrôle est motivé par un incident que nous avons causé.",
          ],
        },
      ],
    },
    {
      heading: "Effacement et restitution",
      paragraphs: [
        "À la fin du contrat, nous mettons les données du responsable du traitement à disposition pour export, sur demande, dans un délai de 30 jours, dans un format courant et lisible par machine. Nous effaçons ensuite les données, y compris les copies.",
        "Sont exclues les données soumises à une obligation légale de conservation (en particulier les données de facturation et de comptabilité) ; celles-ci sont bloquées et effacées à l’expiration du délai. Les copies de sauvegarde sont écrasées selon le cycle de rotation habituel.",
      ],
    },
    {
      heading: "Responsabilité et ordre de priorité",
      paragraphs: [
        "L’article 82 du RGPD s’applique. Dans les rapports entre les parties, les règles de responsabilité des conditions générales s’appliquent en outre, dans la mesure où elles ne contredisent pas le RGPD.",
        "En cas de contradiction entre les conditions générales et le présent accord de sous-traitance s’agissant du traitement pour le compte du responsable du traitement, le présent accord prévaut. Si une disposition devient inefficace, le reste du contenu demeure valable ; les parties la remplacent par une disposition licite ayant la même finalité.",
      ],
    },
    {
      heading: "Modifications du présent accord",
      paragraphs: [
        "Nous pouvons adapter le présent accord de sous-traitance dans la mesure où cela devient nécessaire en raison de modifications législatives, d’exigences des autorités de contrôle, de prescriptions de prestataires de services de paiement ou d’évolutions techniques, et où le responsable du traitement n’en est pas désavantagé.",
        "Nous annonçons les modifications sous forme écrite au moins 30 jours avant leur entrée en vigueur. Si le responsable du traitement ne s’y oppose pas dans ce délai, elles sont réputées acceptées ; cette conséquence est signalée dans l’annonce. En cas d’opposition, chaque partie peut résilier le contrat à la date de l’entrée en vigueur.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        `Veuillez adresser les demandes relatives au présent accord, les instructions et les notifications à [${ANBIETER.email}](mailto:${ANBIETER.email}) ou à ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
