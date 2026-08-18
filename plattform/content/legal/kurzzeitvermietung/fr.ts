import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Location de courte durée et obligations d'enregistrement",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "Dans de nombreuses villes et régions, la location de courte durée de logements est soumise à autorisation, enregistrement ou déclaration. La présente page explique ce que cela implique pour les fournisseurs et pour les voyageurs.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Cadre juridique",
      paragraphs: [
        "Le règlement (UE) 2024/1028 relatif à la collecte et au partage de données concernant les services de location de logements de courte durée instaure un cadre uniforme : lorsqu'un État membre ou une collectivité a instauré une procédure d'enregistrement, chaque unité reçoit un numéro d'enregistrement.",
        "Les plateformes doivent afficher ce numéro, en vérifier la validité par sondage et transmettre périodiquement aux autorités compétentes des données relatives à l'activité.",
        "Par ailleurs, les dispositions nationales et locales demeurent applicables — par exemple sur le changement d'usage des logements, le nombre maximal de jours de location, la sécurité incendie et l'enregistrement des voyageurs.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Ce que les fournisseurs doivent faire",
      paragraphs: [
        "Vérifiez avant la publication si une obligation d'enregistrement, d'autorisation ou de déclaration s'applique à votre hébergement et satisfaites-y.",
        "Saisissez le numéro d'enregistrement dans le bien lorsqu'il en existe un. Nous l'affichons dans l'annonce.",
        "Respectez le nombre maximal de jours de location et les autres limites locales. Il vous appartient de les surveiller, non à nous.",
        "Nous ne pouvons afficher durablement une annonce dépourvue du numéro d'enregistrement requis. S'il manque ou s'avère invalide, nous le réclamons ; à défaut d'indication, nous désactivons l'annonce.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. Ce que cela signifie pour les voyageurs",
      paragraphs: [
        "Lorsqu'une obligation d'enregistrement s'applique à un hébergement, vous voyez le numéro d'enregistrement dans l'annonce. Il indique que la location a été déclarée auprès de l'autorité compétente.",
        "À destination, un enregistrement peut être requis (fiche de police, données d'identité, déclaration de taxe de séjour). Le fournisseur sollicite les informations nécessaires ; fournissez-les en temps utile.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Transmission de données aux autorités",
      paragraphs: [
        "Dans la mesure où le règlement (UE) 2024/1028 ou le droit national le prévoit, nous transmettons aux autorités compétentes des données relatives à l'activité de location — notamment le numéro d'enregistrement, l'adresse de l'unité, le nombre de nuits occupées et le nombre de voyageurs.",
        "Cette transmission est effectuée pour satisfaire à une obligation légale au sens de l'article 6, paragraphe 1, point c), du règlement (UE) 2016/679. Les détails figurent dans la [Politique de confidentialité](https://mybestdays.dk/rechtliches/datenschutz).",
        "Distincte de cela, l'obligation de déclaration fiscale au titre de DAC7 subsiste ; voir la [Politique fiscale](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Signaler des manquements",
      paragraphs: [
        "Si vous avez des indices qu'un hébergement est proposé sans l'autorisation ou l'enregistrement requis, signalez-le-nous via la fonction de signalement de l'annonce. Nous donnons suite à chaque signalement.",
      ],
    },
  ],
};
