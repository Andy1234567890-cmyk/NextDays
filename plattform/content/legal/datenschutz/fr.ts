import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politique de confidentialité",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "La présente politique décrit quelles données à caractère personnel myBestDays traite, à quelles fins, sur quelle base juridique et quels droits vous en tirez. Elle s'applique au site web, aux applications mobiles et à tous autres accès à la plateforme.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Responsable du traitement et délégué à la protection des données",
      paragraphs: [
        `Le responsable du traitement au sens du règlement (UE) 2016/679 (RGPD) est ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danemark, CVR n° ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Les mentions complètes figurent dans les [Mentions légales](https://mybestdays.dk/rechtliches/impressum).`,
        "Aucun délégué à la protection des données n'est désigné ; les conditions de l'article 37 du RGPD ne sont pas réunies. Adressez vos demandes en matière de protection des données à l'adresse électronique indiquée ci-dessus.",
        "Les fournisseurs auprès desquels vous réservez sont responsables de traitement autonomes pour les données qu'ils reçoivent de nous. Les [Normes de protection des données pour les hôtes](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber) leur sont applicables.",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Quelles données nous traitons",
      paragraphs: ["Selon votre utilisation de la plateforme, nous traitons :"],
      list: [
        "les données de base — nom, adresse électronique, numéro de téléphone, langue et devise, mot de passe sous forme chiffrée ;",
        "les données de réservation — hébergement réservé, période, nombre et noms des voyageurs, souhaits particuliers, statut de la réservation ;",
        "les données de paiement — montant, devise, statut du paiement, les derniers chiffres du moyen de paiement ainsi que la référence de transaction de notre prestataire de services de paiement. Les données de carte complètes ne nous parviennent pas ;",
        "les données de communication — messages entre vous et le fournisseur, demandes à notre service client, réclamations ;",
        "les données de contenu — avis, photos, listes d'envies ;",
        "les données d'utilisation — pages consultées, requêtes de recherche, moment de l'accès ;",
        "les données techniques — adresse IP, identifiants de navigateur et d'appareil, système d'exploitation, référent.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Finalités et bases juridiques",
      paragraphs: [
        "Mise à disposition de la plateforme, compte, recherche, réservation, traitement des paiements et communication avec le fournisseur — article 6, paragraphe 1, point b), du RGPD (contrat ou mesures précontractuelles).",
        "Service client, traitement des réclamations et règlement des litiges — article 6, paragraphe 1, points b) et f), du RGPD.",
        "Détection et prévention de la fraude, des abus et des incidents de sécurité, mise en œuvre de nos conditions — article 6, paragraphe 1, point f), du RGPD (intérêt légitime à une place de marché sûre).",
        "Avis et leur publication — article 6, paragraphe 1, points b) et f), du RGPD.",
        "Respect d'obligations légales, notamment les obligations de conservation commerciales et fiscales, l'obligation de déclaration au titre de la directive (UE) 2021/514 (DAC7) et les obligations résultant du règlement (UE) 2022/2065 — article 6, paragraphe 1, point c), du RGPD.",
        "Amélioration de la plateforme par l'analyse de données d'utilisation agrégées — article 6, paragraphe 1, point f), du RGPD.",
        "Courriels publicitaires et cookies non nécessaires — article 6, paragraphe 1, point a), du RGPD (consentement), que vous pouvez retirer à tout moment pour l'avenir.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Destinataires",
      paragraphs: [
        "Les fournisseurs reçoivent les données dont ils ont besoin pour exécuter votre réservation et satisfaire à leurs obligations légales — notamment nom, coordonnées, période, nombre de voyageurs et vos messages à leur intention.",
        "Notre prestataire de services de paiement Stripe traite les données de paiement en qualité de responsable de traitement autonome ; la [politique de confidentialité de Stripe](https://stripe.com/privacy) s'applique en complément.",
        "Les prestataires qui assurent pour nous l'hébergement, l'exploitation des bases de données, l'envoi de courriels, le diagnostic d'erreurs et les outils de service client traitent les données exclusivement sur instruction, sur la base d'un contrat conforme à l'article 28 du RGPD.",
        "Les autorités et juridictions ne reçoivent des données que dans la mesure où nous y sommes tenus ; voir [Règles applicables aux demandes des autorités et des services répressifs](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Les administrations fiscales reçoivent les informations relatives aux fournisseurs devant être déclarées au titre de DAC7.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Transferts vers des pays tiers",
      paragraphs: [
        "Nos serveurs et ceux de nos sous-traitants se situent dans l'Union européenne.",
        "Dans la mesure où un traitement a lieu, dans un cas particulier, en dehors de l'Espace économique européen, il n'intervient que sur le fondement d'une décision d'adéquation de la Commission européenne ou des clauses contractuelles types prévues à l'article 46, paragraphe 2, point c), du RGPD, assorties de garanties complémentaires.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Durées de conservation",
      paragraphs: [
        "Nous conservons les données de compte tant que votre compte existe et les supprimons ensuite, sauf obligation de conservation contraire.",
        "Les données de réservation et de paiement sont soumises aux délais de conservation commerciaux et fiscaux ; en droit comptable danois, ils sont en règle générale de cinq ans à compter de la fin de l'exercice auquel les données se rapportent.",
        "Nous conservons les messages relatifs à une réservation jusqu'à trois ans après la fin du séjour, afin de pouvoir résoudre les litiges.",
        "Les avis subsistent sous forme anonymisée après la suppression de votre compte, car ils font partie de la base d'évaluation d'un hébergement.",
        "Nous conservons les données relatives aux cas de fraude et d'abus aussi longtemps que nécessaire pour prévenir de nouvelles violations, mais au maximum trois ans après le dernier incident.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Vos droits",
      paragraphs: ["Le RGPD vous confère les droits suivants :"],
      list: [
        "accès aux données conservées à votre sujet (article 15) ;",
        "rectification des données inexactes (article 16) ;",
        "effacement (article 17), sauf obligation de conservation contraire ;",
        "limitation du traitement (article 18) ;",
        "portabilité des données (article 20) ;",
        "opposition à un traitement fondé sur des intérêts légitimes (article 21), en particulier à la prospection directe ;",
        "retrait d'un consentement donné, pour l'avenir (article 7, paragraphe 3) ;",
        `réclamation auprès d'une autorité de contrôle (article 77) — est compétente l'autorité de votre résidence, de votre lieu de travail ou du lieu de la violation alléguée. Au siège du responsable du traitement, il s'agit de ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Danemark, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Comment exercer vos droits",
      paragraphs: [
        `De nombreuses informations peuvent être consultées, modifiées ou supprimées directement dans votre compte. Pour tout le reste, adressez-vous à ${ANBIETER.email}.`,
        "Nous répondons sans délai, au plus tard dans un délai d'un mois. Si nous ne pouvons respecter ce délai, nous vous en informons en le motivant.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Décisions automatisées",
      paragraphs: [
        "Nous recourons à des procédés automatisés pour détecter la fraude, les abus et les contenus illicites. Si un tel procédé conduit à une mesure à l'encontre de votre compte ou de vos contenus, nous la motivons et vous pouvez demander un réexamen par une personne.",
        "Nous ne prenons pas de décision fondée exclusivement sur un traitement automatisé produisant des effets juridiques au sens de l'article 22 du RGPD.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Obligation de fournir des données",
      paragraphs: [
        "Vous devez fournir les données nécessaires à une réservation ; à défaut, aucun contrat ne peut être conclu et l'hébergement ne peut être mis à disposition. Toutes les autres indications sont facultatives.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Modifications de la présente politique",
      paragraphs: [
        "Nous adaptons la présente politique lorsque le traitement ou l'état du droit évolue. La version en vigueur est consultable ici ; la date de mise à jour figure en haut.",
      ],
    },
  ],
};
