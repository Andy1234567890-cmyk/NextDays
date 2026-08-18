import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Règles applicables aux demandes des autorités et des services répressifs",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "Les présentes règles s'adressent aux autorités, juridictions et services répressifs qui demandent des données à myBestDays ou adressent une injonction visant des contenus. Elles sont publiques ici afin que les utilisateurs puissent également savoir dans quelles conditions nous communiquons des données.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principe",
      paragraphs: [
        "Nous ne communiquons des données d'utilisateurs que s'il existe un fondement juridique valable et si la demande satisfait aux exigences formelles. Une simple demande informelle ne suffit pas.",
        "Nous examinons chaque demande au regard de la compétence, du fondement juridique, de la précision et de la proportionnalité et ne communiquons que les données qu'elle désigne.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Exigences relatives à une demande",
      paragraphs: ["Une demande devrait contenir :"],
      list: [
        "l'autorité requérante, la référence du dossier et les coordonnées de la personne en charge, sur papier à en-tête officiel ;",
        "le fondement juridique en droit national ou en droit de l'Union ;",
        "une désignation précise de la personne ou du compte concerné — adresse électronique, numéro de réservation ou URL de l'annonce ;",
        "les données précisément désignées et la période visée ;",
        "le cas échéant, une décision judiciaire, dans la mesure où le droit applicable l'exige ;",
        "une indication si l'information de la personne concernée compromettrait l'enquête, avec mention du fondement juridique.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Injonctions au titre du règlement (UE) 2022/2065",
      paragraphs: [
        "Les injonctions d'agir contre des contenus illicites (article 9) et les injonctions de fournir des informations (article 10) doivent comporter les éléments qui y sont énoncés, notamment le fondement juridique, la localisation électronique exacte, la motivation, les voies de recours et la langue.",
        "Nous accusons réception et indiquons à l'autorité émettrice quelles mesures nous avons prises et à quelle date.",
        "Nous informons la personne concernée d'une injonction au plus tard au moment de sa mise en œuvre, sauf si l'autorité ordonne un report en indiquant le fondement juridique.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Situations d'urgence",
      paragraphs: [
        "En cas de danger imminent pour la vie ou l'intégrité physique, nous communiquons les données nécessaires pour l'écarter, même sans injonction formelle préalable. Signalez expressément une telle demande comme urgence et décrivez le danger.",
        "Lorsqu'il existe des indices d'une infraction pénale menaçant la vie ou la sécurité d'une personne, nous informons de notre propre initiative les autorités compétentes (article 18 du règlement (UE) 2022/2065).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Quelles données nous détenons",
      paragraphs: [
        "Les catégories de données que nous traitons et leur durée de conservation figurent dans la [Politique de confidentialité](https://mybestdays.dk/rechtliches/datenschutz). Au-delà des durées qui y sont indiquées, nous ne conservons aucune donnée.",
        "Aucune conservation au-delà du besoin n'a lieu. Nous donnons suite, dans les limites juridiquement admissibles, à une demande de conservation provisoire de données pour une procédure en cours.",
        "Nous ne détenons pas de données de paiement complètes ; elles doivent être demandées au prestataire de services de paiement.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Information de la personne concernée",
      paragraphs: [
        "Nous informons les utilisateurs concernés d'une demande portant sur leurs données, sauf si une disposition légale ou une injonction motivée d'une autorité l'interdit ou s'il existe un danger imminent pour la vie ou l'intégrité physique.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. À qui adresser les demandes",
      paragraphs: [
        "Adressez les demandes au point de contact unique pour les autorités mentionné sous [Règlement sur les services numériques](https://mybestdays.dk/rechtliches/dsa). Nous les traitons en allemand, en danois et en anglais.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Transparence",
      paragraphs: [
        "Nous indiquons le nombre et la nature des injonctions des autorités dans notre rapport annuel de transparence ; voir [Règlement sur les services numériques](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
