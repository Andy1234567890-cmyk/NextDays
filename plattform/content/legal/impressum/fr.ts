import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Mentions légales",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    `Informations relatives au fournisseur de la place de marché myBestDays. L'exploitant est ${ANBIETER.firma} ; myBestDays est une marque de cette société et non une personne morale distincte.`,
    "Mentions obligatoires au titre de l'article 7 de la loi danoise sur le commerce électronique, qui transpose l'article 5 de la directive 2000/31/CE, ainsi qu'au titre des articles 11 et 12 du règlement (UE) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Exploitant de la plateforme",
      paragraphs: [
        `${ANBIETER.firma} — société à responsabilité limitée (anpartsselskab, ApS) de droit danois`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Danemark`,
        `Direction habilitée à représenter la société : ${ANBIETER.direktion.join(" et ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Contact",
      paragraphs: [
        `Courriel : ${ANBIETER.email}`,
        `Téléphone : ${ANBIETER.telefon}`,
        "Pour toute question relative à une réservation existante, utilisez la messagerie de votre compte — nous disposons alors déjà de la réservation et de l'historique ; voir [Réclamations et règlement des litiges](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Registre et TVA",
      paragraphs: [
        `CVR n° ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Danemark.`,
        ...(ANBIETER.ustId
          ? [`Numéro de TVA intracommunautaire : ${ANBIETER.ustId}.`]
          : [
              "Il n'existe actuellement pas de numéro de TVA intracommunautaire ; l'article 7 de la loi sur le commerce électronique n'en impose la mention qu'en présence d'un enregistrement à la TVA.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Points de contact au titre du règlement (UE) 2022/2065",
      paragraphs: [
        `Point de contact unique pour les autorités au titre de l'article 11 et pour les utilisateurs au titre de l'article 12 : ${ANBIETER.email}, par courrier à l'adresse indiquée ci-dessus.`,
        "Les langues de communication sont l'allemand, le danois et l'anglais.",
        "Les procédures prévues par ce règlement — signalement de contenus illicites, motivation des mesures, traitement des réclamations — sont décrites sous [Règlement sur les services numériques](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Autorités compétentes",
      paragraphs: [
        `Coordinateur pour les services numériques au titre de l'article 49 du règlement (UE) 2022/2065 : ${DSA_KOORDINATOR.name}, Danemark ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Autorité de contrôle en matière de protection des données : ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Danemark, ${AUFSICHTSBEHOERDE.email}.`,
        "L'intermédiation de prestations d'hébergement ne requiert au Danemark aucune autorisation particulière ; il n'existe donc pas d'autorité de tutelle professionnelle.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Règlement des litiges de consommation",
      paragraphs: [
        "La plateforme de règlement en ligne des litiges de la Commission européenne a été abrogée par le règlement (UE) 2024/3228 et a cessé son activité.",
        "Nous ne sommes ni tenus ni disposés à participer à une procédure de règlement des litiges devant un organe de règlement des litiges de consommation.",
        `Indépendamment de cela, en qualité de consommateur, vous pouvez saisir l'organe danois compétent : ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Danemark ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Si vous résidez dans un autre État membre, le Centre européen des consommateurs de votre pays peut vous aider.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Remarques sur les contenus et les liens",
      paragraphs: [
        "Les contenus des annonces proviennent des fournisseurs concernés. myBestDays ne se les approprie pas ; voir la section A4 des [Conditions d'utilisation](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "L'exploitant d'un site tiers vers lequel un lien renvoie est responsable de son contenu. Dès que nous avons connaissance d'une violation du droit, nous supprimons le lien sans délai.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Droit d'auteur",
      paragraphs: [
        `Les contenus propres, textes, éléments graphiques et marques publiés sur la présente plateforme sont protégés par le droit d'auteur et le droit des marques. Toute utilisation en dehors des cas légalement admis requiert l'accord écrit préalable de ${ANBIETER.firma} ; pour les marques, les [Règles relatives aux marques](https://mybestdays.dk/rechtliches/markenzeichen) s'appliquent.`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Droit applicable",
      paragraphs: [
        `${ANBIETER.firma} a son siège au Danemark et n'est établie que dans cet État. Le droit danois s'applique donc à la présente offre en ligne — y compris à la version française (principe du pays d'origine résultant de l'article 3 de la directive 2000/31/CE). Les dispositions impératives de protection des consommateurs de votre État de résidence ne sont pas affectées.`,
      ],
    },
  ],
};
