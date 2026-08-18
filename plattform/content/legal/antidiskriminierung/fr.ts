import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politique de non-discrimination",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "myBestDays est ouvert à tous. Quiconque réserve ou propose via la plateforme ne doit traiter personne moins favorablement en raison de caractéristiques personnelles.",
    "La présente politique fait partie des [Conditions d'utilisation](https://mybestdays.dk/rechtliches/nutzungsbedingungen) et s'applique aux voyageurs comme aux fournisseurs.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principe",
      paragraphs: [
        "Sur myBestDays, il est interdit de désavantager une personne en raison de son origine, de sa couleur de peau, de sa nationalité, de son appartenance ethnique, de sa religion ou de ses convictions, de son sexe, de son identité de genre, de son orientation sexuelle, d'un handicap, de son âge ou de sa situation de famille.",
        "Cela vaut pour l'acceptation ou le refus des réservations, pour les prix et les conditions, pour le comportement durant le séjour et pour la communication via la plateforme.",
        "S'y ajoute l'article 20 du règlement (UE) 2018/302 : les fournisseurs ne peuvent restreindre l'accès à leur offre en raison de la nationalité, du lieu de résidence ou du lieu d'établissement d'un voyageur au sein de l'Union.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. Ce que cela signifie pour les fournisseurs",
      paragraphs: ["En tant que fournisseur, vous ne pouvez notamment pas :"],
      list: [
        "refuser une demande de réservation en raison de l'une des caractéristiques mentionnées ;",
        "exiger des prix, cautions ou conditions différents de voyageurs au motif qu'ils présentent l'une de ces caractéristiques ;",
        "déclarer dans l'annonce ou dans des messages que certains groupes de personnes sont indésirables ;",
        "refuser les chiens d'assistance ou les chiens guides, même si votre règlement intérieur exclut les animaux ;",
        "traiter différemment un voyageur en raison de sa résidence dans un autre État membre de l'Union.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. Ce qui reste autorisé",
      paragraphs: [
        "Vous pouvez fixer une occupation maximale, un âge minimum pour la personne réservant à titre principal et des règles intérieures objectives (par exemple interdiction de fumer ou heures de calme), pour autant qu'elles s'appliquent de la même manière à tous les voyageurs.",
        "Si vous habitez vous-même l'hébergement et partagez des espaces de vie avec le voyageur, vous pouvez l'indiquer clairement dans l'annonce ; les caractéristiques visées à la section 1 ne justifient néanmoins pas un refus.",
        "Vous pouvez refuser une réservation lorsqu'il existe des indices concrets d'une violation du règlement intérieur ou d'une fraude. Le motif doit se rapporter au comportement, non à la personne.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Accessibilité",
      paragraphs: [
        "Les informations relatives à l'accessibilité d'un hébergement doivent être exactes. Décrire comme accessible un hébergement qui ne l'est pas constitue également une violation des [Règles relatives aux contenus appropriés](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
        "Lorsqu'un aménagement est possible sans effort disproportionné, nous attendons des fournisseurs qu'ils le réalisent.",
      ],
    },
    {
      id: "melden",
      heading: "5. Signaler une discrimination",
      paragraphs: [
        "Si vous avez subi ou observé une discrimination, signalez-le-nous via la fonction de signalement ou via les voies de contact indiquées sous [Réclamations et règlement des litiges](https://mybestdays.dk/rechtliches/beschwerden).",
        "Nous examinons chaque signalement. Si une violation est confirmée, nous prenons des mesures pouvant aller jusqu'à la suspension définitive du compte. Si une réservation vous a été refusée pour ce motif, nous vous aidons à trouver un hébergement comparable.",
      ],
    },
  ],
};
