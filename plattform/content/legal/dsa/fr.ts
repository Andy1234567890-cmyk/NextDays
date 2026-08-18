import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Règlement sur les services numériques",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "myBestDays est un service intermédiaire et une plateforme en ligne au sens du règlement (UE) 2022/2065 relatif à un marché unique des services numériques (règlement sur les services numériques, DSA). La présente page regroupe les informations et procédures exigées par ce règlement.",
    "myBestDays n'est pas une très grande plateforme en ligne au sens de l'article 33 du règlement. Les obligations supplémentaires applicables à celles-ci — évaluation des risques systémiques, audit indépendant, registre des publicités et publication du nombre mensuel d'utilisateurs selon la procédure qui y est prévue — ne nous incombent donc pas.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Points de contact (articles 11 et 12)",
      paragraphs: [
        `Point de contact unique pour les autorités des États membres, la Commission et le comité européen des services numériques : ${ANBIETER.email}, par courrier ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danemark.`,
        `Point de contact unique pour les utilisateurs : ${ANBIETER.email}. Vous nous y joignez directement, sans dispositif automatisé préalable.`,
        "Les deux points de contact peuvent être sollicités en allemand, en danois et en anglais.",
        "Aucun représentant légal dans l'Union au titre de l'article 13 ne doit être désigné : l'exploitant est établi au Danemark, donc dans l'Union.",
        `Coordinateur pour les services numériques compétent au titre de l'article 49 : ${DSA_KOORDINATOR.name}, Danemark ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Signaler des contenus illicites (article 16)",
      paragraphs: [
        "Toute personne peut nous signaler des contenus qu'elle estime illicites. Utilisez à cette fin la fonction de signalement disponible sur chaque annonce, chaque avis et chaque message, ou le point de contact pour les utilisateurs.",
        "Afin que nous puissions apprécier un signalement sans examen juridique approfondi, il devrait contenir :",
      ],
      list: [
        "une explication suffisamment motivée des raisons pour lesquelles le contenu est illicite ;",
        "la localisation électronique exacte, en particulier l'URL ;",
        "le nom et l'adresse électronique de la personne signalante — sauf pour les signalements relatifs à des infractions portant atteinte à l'autodétermination sexuelle des enfants, où cette indication est facultative ;",
        "la déclaration que les informations sont exactes et complètes en l'état de ses connaissances.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Comment nous traitons les signalements",
      paragraphs: [
        "Nous accusons réception sans délai et statuons en temps utile, avec soin, de manière non arbitraire et objective.",
        "Lorsqu'un signalement contient les éléments visés à la section 2, il fonde notre connaissance au sens de l'article 6 du règlement.",
        "Nous informons la personne signalante de notre décision et lui indiquons les voies de recours.",
        "Lorsque le traitement est automatisé, nous le précisons.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Motivation des mesures (article 17)",
      paragraphs: [
        "Lorsque nous restreignons la visibilité d'un contenu, le supprimons, en bloquons l'accès, suspendons des paiements, suspendons la fourniture du service ou le compte, la personne concernée reçoit un exposé des motifs clair et spécifique.",
        "L'exposé indique la nature et l'étendue de la mesure, son champ d'application territorial et temporel, les faits et circonstances de la décision, l'éventuelle intervention d'un traitement automatisé, le fondement juridique ou la stipulation contractuelle enfreinte ainsi que les voies de recours disponibles.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Soupçon d'infraction pénale (article 18)",
      paragraphs: [
        "Lorsqu'il existe des indices d'une infraction pénale menaçant la vie ou la sécurité d'une personne, nous informons sans délai les autorités répressives ou judiciaires compétentes.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Système interne de traitement des réclamations (article 20)",
      paragraphs: [
        "Toute mesure visée à la section 4 et tout rejet d'un signalement peuvent faire l'objet d'une réclamation gratuite dans un délai de six mois.",
        "Les réclamations sont traitées en temps utile, de manière non discriminatoire et diligente — sous la supervision de personnes qualifiées et non exclusivement par des moyens automatisés.",
        "Si une réclamation s'avère fondée, nous rapportons la mesure. La voie à suivre est décrite sous [Réclamations et règlement des litiges](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Règlement extrajudiciaire des litiges (article 21)",
      paragraphs: [
        "Pour les litiges relatifs aux mesures visées à la section 4, les utilisateurs peuvent saisir un organe de règlement extrajudiciaire des litiges certifié par le coordinateur pour les services numériques compétent. La Commission européenne tient la liste des organes certifiés.",
        "Les décisions de ces organes ne nous lient pas ; nous ne sommes pas tenus de participer aux procédures d'organes indépendants. L'accès aux tribunaux demeure ouvert.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Signaleurs de confiance (article 22)",
      paragraphs: [
        "Les signalements émanant d'un signaleur reconnu comme signaleur de confiance dans son domaine d'expertise sont traités en priorité.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Mesures contre les usages abusifs (article 23)",
      paragraphs: [
        "Nous suspendons pour une durée raisonnable, après avertissement préalable, les comptes par lesquels des contenus manifestement illicites sont fréquemment fournis.",
        "Nous suspendons le traitement des signalements et réclamations des personnes qui soumettent fréquemment des signalements ou réclamations manifestement non fondés — également après avertissement préalable.",
        "Nous apprécions toujours le cas individuel : nombre, proportion et gravité des éléments concernés ainsi que l'intention.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Rapports de transparence (articles 15 et 24)",
      paragraphs: [
        "Nous publions annuellement un rapport sur la modération des contenus : nombre d'injonctions des autorités, nombre et nature des signalements, mesures prises, nombre de réclamations et leur issue, indications sur le recours à des moyens automatisés ainsi que nombre de litiges portés devant des organes extrajudiciaires.",
        `Les microentreprises et petites entreprises sont exonérées d'une partie de ces obligations au titre de l'article 19 du règlement. Tant que l'exonération s'applique, nous mettons les informations à disposition sur demande à ${ANBIETER.email} ; dès la publication du premier rapport, il sera lié ici.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Traçabilité des professionnels (articles 30 à 32)",
      paragraphs: [
        "Les fournisseurs agissant à titre professionnel sur la plateforme ne peuvent proposer d'offres qu'après nous avoir communiqué nom, adresse, numéro de téléphone, adresse électronique, mentions d'immatriculation, numéro de TVA et compte de paiement, et sous réserve de la plausibilité de leurs indications.",
        "Nous affichons ces informations dans l'annonce dans la mesure où le règlement le prévoit.",
        "Si nous apprenons qu'une annonce portait sur un produit ou un service illicite, nous informons les voyageurs concernés dans la mesure où nous disposons de leurs coordonnées.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Systèmes de recommandation (article 27)",
      paragraphs: [
        "Les principaux paramètres de l'ordre des résultats de recherche et des recommandations ainsi que la possibilité de les influencer sont décrits sous [Prix, classement et recommandations](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Publicité (article 26)",
      paragraphs: [
        "Nous n'affichons actuellement aucune publicité payante de tiers ni placement payant dans les résultats de recherche.",
        "Si nous devions introduire de la publicité, nous l'identifierions clairement, nommerions l'annonceur et indiquerions les principaux paramètres de sa diffusion. Nous excluons la publicité fondée sur des catégories particulières de données à caractère personnel au sens de l'article 9 du règlement (UE) 2016/679 ainsi que la publicité à destination des mineurs fondée sur le profilage.",
      ],
    },
  ],
};
