import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politique fiscale",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "La présente page explique quels impôts et redevances peuvent naître d'une réservation via myBestDays, qui en est redevable et quelles obligations déclaratives nous incombent en tant qu'exploitant de plateforme.",
    "Elle ne constitue pas un conseil fiscal. Pour votre situation fiscale individuelle, adressez-vous à un conseiller fiscal.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Ce qui concerne les voyageurs",
      paragraphs: [
        "Le prix total affiché comprend les taxes réglées via la plateforme — en particulier la TVA sur la prestation d'hébergement, dans la mesure où le fournisseur en est redevable.",
        "Les redevances locales telles que taxe de séjour, taxe sur les nuitées ou redevance touristique sont, selon la commune, soit réglées via la plateforme, soit perçues sur place. Nous indiquons le cas applicable avant la finalisation de la réservation.",
        "La facture de la prestation d'hébergement est établie par le fournisseur ; il est le professionnel prestataire. Si vous avez besoin d'une facture faisant apparaître la TVA, demandez-la au fournisseur.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Ce qui concerne les fournisseurs",
      paragraphs: [
        "Les fournisseurs sont eux-mêmes responsables du traitement fiscal correct de leurs revenus — impôt sur le revenu ou sur les sociétés, TVA et redevances locales.",
        "La question de savoir si une location est soumise à la TVA et à quel taux relève du droit de l'État où se situe l'hébergement (lieu de la prestation pour les immeubles).",
        "Les fournisseurs renseignent dans le bien les redevances applicables à leur hébergement afin qu'elles soient correctement indiquées dans l'annonce.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Déclaration aux administrations fiscales (DAC7)",
      paragraphs: [
        "En tant qu'exploitant d'une plateforme numérique, nous sommes tenus, en vertu de la directive (UE) 2021/514 (« DAC7 ») et des dispositions nationales de transposition, de déclarer annuellement à l'administration fiscale compétente des informations relatives aux fournisseurs à déclarer et aux rémunérations qu'ils perçoivent via la plateforme.",
        "Sont notamment déclarés les nom, adresse, numéro d'identification fiscale, date de naissance ou numéro d'immatriculation, coordonnées du compte de versement, adresse de l'hébergement ainsi que les rémunérations versées par trimestre et les frais retenus.",
        "Les fournisseurs reçoivent une copie des données les concernant qui ont été déclarées.",
        "Si un fournisseur ne fournit pas, malgré deux relances, les informations requises pour la déclaration, nous sommes tenus de retenir les versements et de suspendre le compte.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Retenues",
      paragraphs: [
        "Lorsque le droit d'un État nous oblige à retenir et à reverser un impôt sur un versement, nous le faisons et indiquons la retenue dans le décompte.",
      ],
    },
  ],
};
