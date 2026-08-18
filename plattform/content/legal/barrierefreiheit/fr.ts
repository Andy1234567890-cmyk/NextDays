import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Déclaration d'accessibilité",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "myBestDays doit être utilisable par tous. La présente déclaration décrit l'état de l'accessibilité de la plateforme, les limitations connues et la manière de nous signaler des obstacles.",
    "Elle se rapporte aux exigences de la directive (UE) 2019/882 relative aux exigences en matière d'accessibilité applicables aux produits et services, applicable depuis le 28 juin 2025 aux services de commerce électronique.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. État de l'accessibilité",
      paragraphs: [
        "Nous nous appuyons sur la norme harmonisée EN 301 549 et sur les Web Content Accessibility Guidelines (WCAG) 2.1 sous-jacentes, niveau de conformité AA.",
        "Sont notamment mis en œuvre : une utilisabilité complète au clavier, un focus visible, une structure de titres sémantique, des étiquettes sur tous les champs de formulaire, des équivalents textuels pour les éléments de commande, des contrastes de couleurs suffisants, la mise à l'échelle du texte sans perte de contenu ainsi qu'un affichage s'adaptant à la taille de l'écran.",
        "Les textes juridiques sont disponibles dans les 24 langues officielles de l'Union et pourvus d'un marquage linguistique correct, afin que les lecteurs d'écran les restituent correctement.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Limitations connues",
      paragraphs: ["Ne sont actuellement pas accessibles, notamment :"],
      list: [
        "Les photos et descriptions des annonces proviennent des fournisseurs ; les équivalents textuels des photos peuvent manquer ou être insuffisants. Nous invitons les fournisseurs à les compléter.",
        "Les représentations cartographiques de tiers intégrées ne sont utilisables au clavier que de manière limitée. Toutes les indications de localisation sont également disponibles sous forme de texte.",
        "Les documents téléversés par les fournisseurs (par exemple un règlement intérieur au format PDF) ne sont pas systématiquement balisés pour l'accessibilité.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Accessibilité des hébergements",
      paragraphs: [
        "La présente déclaration porte sur la plateforme, non sur les hébergements. Les indications relatives à l'accessibilité architecturale d'un hébergement proviennent du fournisseur.",
        "Si vous dépendez de caractéristiques déterminées — accès de plain-pied, largeur des portes, douche à l'italienne, ascenseur — clarifiez-les avec le fournisseur via la messagerie avant de réserver. Des indications inexactes sur l'accessibilité constituent une violation de nos règles et peuvent être signalées.",
      ],
    },
    {
      id: "melden",
      heading: "4. Signaler des obstacles",
      paragraphs: [
        `Si vous rencontrez un obstacle, signalez-le-nous à ${ANBIETER.email} ou via les voies de contact indiquées sous [Réclamations et règlement des litiges](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Merci de décrire la page concernée, ce que vous souhaitiez faire et les technologies d'assistance que vous utilisez. Nous accusons réception et vous indiquons comment et dans quel délai nous supprimerons l'obstacle.",
        "Si vous avez besoin d'une information sous une forme accessible, nous la mettons à disposition sur demande.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Procédure de mise en œuvre",
      paragraphs: [
        "Si notre réponse ne vous satisfait pas, vous pouvez saisir l'autorité compétente pour la surveillance du marché au titre de la directive (UE) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (anciennement Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Danemark",
        "Téléphone: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
