import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Normes de protection des données pour les hôtes",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "Lorsque vous proposez un hébergement via myBestDays, vous recevez des données à caractère personnel de vos voyageurs. Vous en êtes responsable de traitement autonome au sens du règlement (UE) 2016/679 (RGPD). Les présentes normes décrivent ce que nous attendons de vous.",
  ],
  sections: [
    {
      id: "zweckbindung",
      heading: "1. Limitation des finalités",
      paragraphs: [
        "Vous n'utilisez les données des voyageurs que pour exécuter la réservation, communiquer avec le voyageur et satisfaire à vos obligations légales (par exemple fiche de police, taxe de séjour, obligations fiscales et de conservation).",
        "Toute autre utilisation — en particulier publicité, lettres d'information, transmission à des tiers, intégration dans un fichier de clientèle propre en vue de réservations directes ultérieures — requiert une base juridique propre, en règle générale le consentement du voyageur.",
        "Vous n'utilisez pas les données des voyageurs pour les inciter à réserver hors de la plateforme.",
      ],
    },
    {
      id: "datensparsamkeit",
      heading: "2. Minimisation des données",
      paragraphs: [
        "Vous ne collectez que les données dont vous avez effectivement besoin. Vous ne demandez de copies de pièces d'identité que lorsqu'une disposition légale l'exige, et ne les conservez que le temps prévu par cette disposition.",
        "Vous ne demandez pas de données de paiement. Les paiements transitent par la plateforme.",
      ],
    },
    {
      id: "sicherheit",
      heading: "3. Sécurité",
      paragraphs: [
        "Vous protégez les données des voyageurs par des mesures techniques et organisationnelles appropriées — accès réservé aux personnes qui en ont besoin, appareils protégés, transmission chiffrée.",
        "Si vous faites appel à des collaborateurs, des personnes de ménage ou des co-hôtes, vous les astreignez à la confidentialité et ne leur communiquez que les données nécessaires à leur mission.",
      ],
    },
    {
      id: "loeschung",
      heading: "4. Conservation et effacement",
      paragraphs: [
        "Vous effacez les données des voyageurs dès que la finalité a disparu et qu'aucune obligation de conservation ne subsiste.",
        "Vous conservez les fiches de police et les pièces pertinentes sur le plan fiscal aussi longtemps que le droit de votre pays l'impose — pas davantage.",
      ],
    },
    {
      id: "rechte",
      heading: "5. Droits des voyageurs",
      paragraphs: [
        "Si un voyageur vous adresse une demande d'accès, de rectification, d'effacement ou d'opposition, vous y répondez dans les délais. Si elle porte sur des données détenues par nous, vous le renvoyez vers nous.",
        "Vous informez vos voyageurs de la manière dont vous traitez leurs données, dans la mesure où vous allez au-delà de l'exécution de la réservation.",
      ],
    },
    {
      id: "vorfall",
      heading: "6. Violations de données",
      paragraphs: [
        "En cas de violation de la protection des données des voyageurs, vous informez sans délai l'autorité de contrôle compétente et, lorsque cela est requis, les voyageurs concernés.",
        "Si la violation porte sur des données que vous avez reçues via la plateforme, vous nous en informez également afin que nous puissions examiner nos propres obligations.",
      ],
    },
    {
      id: "kameras",
      heading: "7. Caméras et dispositifs d'enregistrement",
      paragraphs: [
        "Dans les pièces intérieures où existe une attente légitime d'intimité — chambres, salles de bains — les caméras et microphones sont interdits, même éteints.",
        "Vous divulguez dans l'annonce toutes les autres caméras, détecteurs de mouvement avec enregistrement, sonnettes avec caméra et capteurs sonores, en indiquant leur emplacement et ce qui est enregistré.",
      ],
    },
    {
      id: "folgen",
      heading: "8. Conséquences des violations",
      paragraphs: [
        "Nous traitons les violations des présentes normes comme des violations des [Conditions complémentaires pour les hôtes](https://mybestdays.dk/rechtliches/gastgeber-bedingungen) et pouvons prendre des mesures pouvant aller jusqu'à la suspension du compte.",
      ],
    },
  ],
};
