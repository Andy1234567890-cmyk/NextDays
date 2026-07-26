import type { LegalDoc } from "../types";

// Französische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort, dann hier nachziehen. § 5 Absatz 1–2 folgt Stripes offiziellem
// Empfehlungstext (Stripe Connected Account Agreement) — URLs nicht verändern.
export const agb: LegalDoc = {
  title: "Conditions générales d'utilisation (CGU) pour les agences et les loueurs",
  stand: "Dernière mise à jour : 26 juillet 2026",
  intro: [
    "Les présentes conditions générales d'utilisation (ci-après les « CGU ») régissent l'utilisation de la plateforme logicielle myNextDays (ci-après la « Plateforme ») par les agences, les loueurs, les gestionnaires de biens et les autres utilisateurs professionnels (ci-après l'« Utilisateur »).",
    "L'exploitant de la Plateforme est [dénomination sociale complète, forme juridique, adresse et données d'immatriculation de l'exploitant — à compléter avant publication] (ci-après « myNextDays » ou « nous »).",
    "La Plateforme s'adresse exclusivement aux entrepreneurs au sens de l'article 14 du Code civil allemand (BGB) ou des dispositions correspondantes de l'État membre de l'UE concerné. Elle ne s'adresse pas aux consommateurs.",
  ],
  sections: [
    {
      heading: "§ 1 Champ d'application",
      paragraphs: [
        "Les présentes CGU s'appliquent à l'ensemble des contrats relatifs à l'utilisation de la Plateforme conclus entre myNextDays et l'Utilisateur ainsi qu'à toutes les prestations et à tous les modules fournis par son intermédiaire.",
        "Les conditions générales de l'Utilisateur divergentes, contraires ou complémentaires ne deviennent partie intégrante du contrat que si myNextDays a expressément consenti à leur application sous forme de texte.",
      ],
    },
    {
      heading: "§ 2 Objet du contrat et prestations",
      paragraphs: [
        "myNextDays met à la disposition de l'Utilisateur un logiciel en nuage (cloud) pour la gestion de locations de vacances et d'établissements d'hébergement. L'étendue des fonctionnalités résulte de la description des prestations en vigueur et comprend notamment :",
      ],
      list: [
        "la gestion des biens, des calendriers d'occupation et des réservations (système de gestion locative, Property-Management-System),",
        "la connexion à des canaux de réservation tiers (p. ex. Booking.com, Airbnb) via un channel manager,",
        "la publication d'offres via le canal de réservation propre à la plateforme, myNextDays,",
        "la création de sites web propres via le page builder intégré,",
        "des fonctions de comptabilité, de facturation et de reporting, y compris les décomptes destinés aux propriétaires,",
        "la communication avec les voyageurs ainsi que l'encaissement des paiements via le traitement des paiements intégré (§ 5).",
      ],
    },
    {
      heading: "§ 3 Enregistrement, compte et informations de l'Utilisateur",
      paragraphs: [
        "L'utilisation de la Plateforme requiert l'enregistrement d'un compte. L'Utilisateur est tenu de fournir, lors de l'enregistrement et pendant toute la durée du contrat, des informations exactes, à jour et complètes sur sa personne et son entreprise, et de les mettre à jour sans délai en cas de modification.",
        "Les identifiants de connexion doivent être tenus secrets et protégés contre tout accès de tiers. L'Utilisateur doit informer myNextDays sans délai s'il existe des indices d'une utilisation abusive de son compte.",
        "Un compte n'est pas transférable. L'Utilisateur veille à ce que toutes les personnes qui utilisent le compte en son nom respectent les présentes CGU.",
      ],
    },
    {
      heading: "§ 4 Rôle de myNextDays dans les réservations",
      paragraphs: [
        "Les contrats d'hébergement portant sur les hébergements proposés sur la Plateforme, sur des canaux tiers connectés ou sur le site web propre de l'Utilisateur sont conclus exclusivement entre l'Utilisateur (ou le propriétaire qu'il représente) et le voyageur concerné. myNextDays ne devient pas partie au contrat d'hébergement.",
        "L'Utilisateur est seul responsable de l'exactitude et de la licéité du contenu des offres (descriptions, photos, prix, disponibilités, taxes et redevances).",
      ],
    },
    {
      heading: "§ 5 Traitement des paiements par Stripe",
      paragraphs: [
        "Les services de traitement des paiements pour les agences et les loueurs sur myNextDays sont fournis par Stripe et sont soumis au [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), qui inclut les conditions d'utilisation de Stripe (ensemble, le « Contrat-cadre Stripe »). En acceptant les présentes CGU ou en poursuivant son activité d'agence ou de loueur sur myNextDays, l'Utilisateur accepte d'être lié par le Contrat-cadre Stripe, lequel peut être modifié par Stripe de temps à autre.",
        "La mise à disposition par myNextDays de services de traitement des paiements via Stripe est subordonnée à la condition que l'Utilisateur fournisse à myNextDays des informations exactes et complètes sur sa personne et son entreprise. L'Utilisateur autorise myNextDays à transmettre à Stripe ces informations ainsi que les données de transaction liées à l'utilisation des services de traitement des paiements fournis par Stripe.",
        "Le texte contractuel en langue anglaise accessible via le lien, dans sa version en vigueur, régit la relation juridique avec Stripe. Le cocontractant pour les utilisateurs de l'Espace économique européen est la société Stripe désignée dans le Contrat-cadre Stripe (actuellement Stripe Payments Europe, Limited, Irlande). Stripe traite les données personnelles conformément à la [politique de confidentialité de Stripe](https://stripe.com/privacy).",
        "Afin de satisfaire aux obligations légales d'identification et de vérification (notamment la prévention du blanchiment de capitaux et les exigences « Know Your Customer »), myNextDays et Stripe peuvent à tout moment exiger des informations et justificatifs supplémentaires, en particulier des documents d'identité, des informations sur les bénéficiaires effectifs et les coordonnées bancaires. Si les informations ou justificatifs demandés ne sont pas fournis dans le délai imparti, l'acceptation des paiements ou les versements peuvent être suspendus en tout ou en partie jusqu'à ce que les informations soient complètes.",
      ],
    },
    {
      heading: "§ 6 Versements, rétrofacturations et soldes négatifs",
      paragraphs: [
        "Le circuit de paiement dépend du canal de réservation. Pour les réservations effectuées via le moteur de réservation propre de l'Utilisateur et pour les réservations via des portails de distribution connectés, les paiements des clients sont encaissés directement sur le compte de paiement de l'Utilisateur ; dans ces cas, l'Utilisateur est, à l'égard du client, le bénéficiaire du paiement et la partie contractante de la prestation d'hébergement (§ 4), et myNextDays ne devient à aucun moment détenteur de ces fonds. myNextDays ne prélève aucune commission de réservation en pourcentage sur ces réservations ; la commission relative aux réservations via des portails de distribution connectés est indiquée séparément et facturée a posteriori.",
        "Pour les réservations réalisées via le portail de réservation myNextDays, le paiement est traité par myNextDays. myNextDays retient à ce titre la commission d'intermédiation indiquée dans la liste de prix en vigueur, y compris les frais de traitement des paiements, et reverse le montant restant à l'Utilisateur conformément aux paragraphes ci-dessous. La rémunération de l'utilisation du logiciel (§ 7) n'en est pas affectée.",
        "Les versements sont effectués sur le compte bancaire indiqué par l'Utilisateur. myNextDays peut adapter le rythme des versements pour des raisons de risque, en particulier en cas de nouveaux comptes, de schémas de transactions inhabituels ou de vérifications en cours.",
        "Les remboursements aux clients sont économiquement supportés par l'Utilisateur. Les rétrofacturations et les frais en résultant sont supportés par l'Utilisateur pour les réservations effectuées via son propre moteur de réservation et via les portails de distribution connectés, l'Utilisateur étant dans ces cas le bénéficiaire du paiement ; pour les réservations effectuées via le portail de réservation myNextDays, myNextDays supporte le risque de rétrofacturation, sauf si celle-ci résulte d'un manquement de l'Utilisateur (notamment non-fourniture ou écart substantiel de la prestation d'hébergement). myNextDays est en droit de compenser les montants à la charge de l'Utilisateur avec les versements futurs.",
        "Si un solde négatif apparaît sur le compte de paiement de l'Utilisateur, celui-ci doit le régulariser sans délai. L'Utilisateur autorise myNextDays et Stripe à prélever les soldes négatifs sur le compte bancaire enregistré, dans la mesure où la loi le permet.",
      ],
    },
    {
      heading: "§ 7 Rémunération et facturation",
      paragraphs: [
        "Les frais d'utilisation de la Plateforme résultent de la liste de prix convenue lors de la conclusion du contrat ou de l'offre individuelle. Tous les prix s'entendent hors taxes légales applicables et dans la devise indiquée dans le contrat.",
        "Les frais liés aux transactions (p. ex. frais de paiement ou de canal) peuvent être retenus ou compensés directement lors du traitement de la transaction concernée.",
        "Si l'Utilisateur est en retard de paiement, myNextDays peut, après notification préalable, bloquer l'accès à la Plateforme jusqu'au règlement des créances en souffrance.",
      ],
    },
    {
      heading: "§ 8 Obligations de l'Utilisateur ; textes juridiques propres",
      paragraphs: [
        "L'Utilisateur veille à ce que ses offres, ses contenus et ses pratiques commerciales soient conformes aux lois applicables, en particulier au droit de l'hébergement, aux obligations de déclaration, au droit fiscal et au droit de la protection des consommateurs applicables au lieu de l'hébergement. L'Utilisateur détient sous sa propre responsabilité les autorisations, enregistrements et licences requis.",
        "L'Utilisateur est lui-même responsable des sites web qu'il exploite via le page builder ainsi que de ses offres sur la Plateforme ; cela comprend notamment ses propres conditions générales à l'égard des voyageurs, ses propres mentions légales et ses propres informations sur la protection des données.",
        "Sont notamment interdits : la publication d'offres inexactes ou trompeuses, la réalisation d'opérations fictives ou de transactions frauduleuses, le contournement du traitement des paiements prévu au § 5 pour les réservations conclues via la Plateforme, ainsi que toute utilisation portant atteinte à la sécurité ou à la disponibilité de la Plateforme.",
      ],
    },
    {
      heading: "§ 9 Canaux de réservation tiers",
      paragraphs: [
        "En cas de connexion de canaux tiers (p. ex. Booking.com, Airbnb), les conditions de l'exploitant du canal concerné s'appliquent en outre. L'Utilisateur conclut lui-même les contrats nécessaires à cet effet avec l'exploitant du canal.",
        "myNextDays assure la synchronisation technique des disponibilités, des prix et des données de réservation, mais n'a aucune influence sur les contenus, les commissions ou les décisions des exploitants de canaux et ne répond pas de leur disponibilité.",
      ],
    },
    {
      heading: "§ 10 Disponibilité et évolution",
      paragraphs: [
        "myNextDays fournit les prestations avec la diligence d'un commerçant avisé et vise une haute disponibilité de la Plateforme. Les fenêtres de maintenance, les évolutions et les circonstances échappant au contrôle de myNextDays (p. ex. perturbations chez des prestataires tiers) peuvent limiter temporairement la disponibilité.",
        "myNextDays peut faire évoluer la Plateforme et modifier des fonctionnalités, dans la mesure où l'objet du contrat n'en est pas compromis et où la modification est raisonnablement acceptable pour l'Utilisateur.",
      ],
    },
    {
      heading: "§ 11 Données et protection des données",
      paragraphs: [
        "Dans la mesure où myNextDays traite des données personnelles pour le compte de l'Utilisateur dans le cadre de la fourniture de la Plateforme (en particulier des données de voyageurs), les parties concluent un accord de sous-traitance conformément à l'art. 28 du RGPD.",
        "L'Utilisateur demeure responsable de la licéité, au regard du droit de la protection des données, de la collecte et du traitement des données qu'il apporte. Les modalités du traitement des données par myNextDays résultent des informations sur la protection des données de la Plateforme ; le § 5 s'applique au traitement des données par Stripe.",
      ],
    },
    {
      heading: "§ 12 Propriété intellectuelle",
      paragraphs: [
        "Tous les droits sur la Plateforme, son logiciel et ses contenus (à l'exception des contenus mis en ligne par l'Utilisateur) appartiennent à myNextDays ou à ses concédants de licence. L'Utilisateur reçoit, pour la durée du contrat, un droit non exclusif et non transférable d'utiliser la Plateforme dans les limites convenues au contrat.",
        "Sur les contenus qu'il met en ligne, l'Utilisateur concède à myNextDays les droits d'utilisation non exclusifs nécessaires à l'exploitation de la Plateforme (en particulier le stockage, la reproduction, l'affichage et la transmission aux canaux connectés).",
      ],
    },
    {
      heading: "§ 13 Responsabilité",
      paragraphs: [
        "myNextDays répond sans limitation en cas de faute intentionnelle et de négligence grave ainsi que des dommages résultant d'une atteinte à la vie, à l'intégrité physique ou à la santé.",
        "En cas de négligence simple, myNextDays ne répond que de la violation d'obligations contractuelles essentielles (obligations cardinales), dans la limite du dommage prévisible et typique du contrat. La responsabilité au titre de la loi allemande sur la responsabilité du fait des produits ainsi qu'au titre des garanties consenties demeure inchangée.",
        "En cas de perte de données, myNextDays ne répond que dans la mesure où le dommage se serait également produit si l'Utilisateur avait effectué des sauvegardes régulières et appropriées, sauf si la sauvegarde des données incombe contractuellement à myNextDays.",
      ],
    },
    {
      heading: "§ 14 Durée, résiliation et suspension",
      paragraphs: [
        "La durée et les délais de résiliation résultent du contrat concerné. Le droit de résiliation extraordinaire pour motif grave demeure inchangé.",
        "myNextDays peut suspendre temporairement l'accès à la Plateforme ou certaines fonctionnalités (y compris l'acceptation des paiements et les versements) s'il existe des indices concrets d'une violation des présentes CGU, d'une fraude ou d'une utilisation abusive, ou si myNextDays y est tenue par la loi ou par injonction d'un prestataire de services de paiement. L'Utilisateur est informé de la suspension dans la mesure où la loi le permet.",
        "À la fin du contrat, myNextDays met, sur demande, les données de l'Utilisateur à sa disposition pour export dans un format courant dans un délai de 30 jours ; les données sont ensuite supprimées, sauf obligations légales de conservation contraires.",
      ],
    },
    {
      heading: "§ 15 Modifications des présentes CGU",
      paragraphs: [
        "myNextDays peut modifier les présentes CGU avec effet pour l'avenir dans la mesure où cela est nécessaire pour des motifs valables (en particulier des modifications législatives, des évolutions de la jurisprudence ou des exigences de prestataires de services de paiement) et où l'Utilisateur n'en subit pas de désavantage déraisonnable.",
        "Les modifications sont annoncées à l'Utilisateur sous forme de texte au moins six semaines avant leur entrée en vigueur. Si l'Utilisateur ne s'y oppose pas dans le délai d'annonce ou continue d'utiliser la Plateforme après leur entrée en vigueur, les CGU modifiées sont réputées acceptées ; cette conséquence est expressément signalée dans l'annonce.",
      ],
    },
    {
      heading: "§ 16 Dispositions finales",
      paragraphs: [
        "Le droit de l'État dans lequel l'exploitant a son siège s'applique, à l'exclusion de la Convention des Nations Unies sur les contrats de vente internationale de marchandises. Les dispositions impératives de l'État dans lequel l'Utilisateur a son siège demeurent inchangées.",
        "Le for exclusif pour tous les litiges découlant du présent contrat ou en lien avec celui-ci est — dans la mesure où la loi le permet — le siège de l'exploitant.",
        "Si certaines dispositions des présentes CGU sont ou deviennent invalides, la validité des autres dispositions n'en est pas affectée.",
      ],
    },
  ],
};
