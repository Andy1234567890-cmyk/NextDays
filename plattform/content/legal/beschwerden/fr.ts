import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Réclamations et règlement des litiges",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "La présente page décrit comment nous joindre, comment nous traitons les réclamations et quelles voies vous sont ouvertes si vous n'êtes pas d'accord avec notre décision.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Comment nous joindre",
      paragraphs: [
        "Le plus rapide est de passer par le centre d'aide et les voies de contact qui y figurent. Pour une réservation existante, utilisez la messagerie de votre compte — nous disposons alors déjà de la réservation et de l'historique.",
        `Par écrit, vous pouvez nous joindre à ${ANBIETER.email} ou ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danemark ; par téléphone au ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Ce que votre réclamation devrait contenir",
      paragraphs: ["Pour que nous puissions vous aider rapidement, indiquez :"],
      list: [
        "votre numéro de réservation et l'adresse électronique utilisée pour la réservation ;",
        "une brève description du problème ;",
        "la solution que vous souhaitez ;",
        "les justificatifs correspondants — photos, messages, reçus, relevés de compte.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Comment nous traitons les réclamations",
      paragraphs: [
        "Chaque réclamation est enregistrée et reçoit un numéro de dossier permettant d'en suivre l'état.",
        "Nous accusons réception sans délai et répondons au fond en règle générale dans un délai de sept jours. Si un examen plus long est nécessaire, nous vous communiquons un état intermédiaire.",
        "Les réclamations mettant en jeu la sécurité de personnes ou concernant une arrivée imminente sont traitées en priorité.",
        "Nous motivons notre décision et indiquons le fondement sur lequel elle repose.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Réclamation contre une mesure prise par nous",
      paragraphs: [
        "Si nous avons supprimé des contenus, restreint leur visibilité, annulé une réservation ou suspendu un compte, vous pouvez déposer une réclamation gratuite dans un délai de six mois. Cela correspond à l'article 20 du règlement (UE) 2022/2065.",
        "La réclamation est examinée par des personnes, non uniquement par des procédés automatisés. Si elle s'avère fondée, nous rapportons la mesure.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Règlement extrajudiciaire des litiges",
      paragraphs: [
        "La plateforme de règlement en ligne des litiges de la Commission européenne (plateforme RLL) a été abrogée par le règlement (UE) 2024/3228 et a cessé son activité. Aucune réclamation ne peut plus y être déposée.",
        "Nous ne sommes ni tenus ni disposés à participer à une procédure de règlement des litiges devant un organe de règlement des litiges de consommation.",
        `Indépendamment de cela, en qualité de consommateur, vous pouvez saisir l'organe danois compétent : ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Danemark ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Si vous résidez dans un autre État membre, le Centre européen des consommateurs de votre pays peut vous aider.`,
        "Si le litige porte sur une mesure que nous avons prise à l'encontre de vos contenus ou de votre compte, vous pouvez en outre saisir un organe de règlement extrajudiciaire des litiges certifié au titre de l'article 21 du règlement (UE) 2022/2065. Ses décisions ne nous lient pas et nous ne sommes pas tenus de participer à de telles procédures.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Voie judiciaire",
      paragraphs: [
        "La voie judiciaire vous reste ouverte à tout moment, même sans procédure de réclamation préalable. Les juridictions compétentes sont indiquées à la section A19 des [Conditions d'utilisation](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Réclamations des fournisseurs",
      paragraphs: [
        "Les fournisseurs peuvent déposer, par la même procédure, des réclamations relatives à l'application des présentes conditions, aux décisions de classement et aux restrictions de leur annonce. Cela correspond à l'article 11 du règlement (UE) 2019/1150.",
        "Nous rendons compte annuellement du nombre, de l'objet et de la durée moyenne de traitement de ces réclamations ; le rapport est consultable sous [Règlement sur les services numériques](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
