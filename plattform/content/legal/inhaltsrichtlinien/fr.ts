import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Règles relatives aux contenus appropriés",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "Les présentes règles s'appliquent à tous les contenus publiés par les utilisateurs sur myBestDays : annonces, photos, avis, messages, informations de profil et réponses aux avis.",
    "Elles font partie des [Conditions d'utilisation](https://mybestdays.dk/rechtliches/nutzungsbedingungen). Une violation peut entraîner la suppression du contenu et des mesures à l'encontre du compte.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Ce qui n'est pas autorisé",
      paragraphs: ["Sur myBestDays, les contenus suivants sont notamment interdits :"],
      list: [
        "les contenus illicites de toute nature, notamment les incitations à commettre des infractions, les contenus terroristes et les représentations d'abus sexuels sur mineurs ;",
        "les contenus incitant à la haine ou à la violence contre des personnes ou des groupes en raison de l'origine, de la couleur de peau, de la religion, des convictions, du sexe, de l'identité de genre, de l'orientation sexuelle, du handicap ou de l'âge ;",
        "les injures, menaces, harcèlements et la mise au pilori ciblée de personnes ;",
        "les données à caractère personnel de tiers sans leur consentement, notamment noms, adresses, numéros de téléphone, données d'identité ou de paiement ;",
        "les indications trompeuses sur un hébergement, sa situation, ses équipements, sa taille ou sa disponibilité ;",
        "les photos, textes ou marques de tiers sans les droits nécessaires ;",
        "la publicité, le spam et les contenus renvoyant vers d'autres voies de réservation hors de la plateforme ;",
        "les logiciels malveillants, les tentatives d'hameçonnage et les liens vers de tels contenus ;",
        "les offres portant sur autre chose qu'une prestation d'hébergement.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Photos",
      paragraphs: [
        "Les photos doivent montrer l'hébergement effectivement proposé et avoir été prises dans un état correspondant à l'état actuel.",
        "Les photos ne doivent pas montrer de personnes identifiables sans leur consentement. Les retouches sont admises dans la mesure où elles ne faussent pas l'impression de l'hébergement — un éclaircissement oui, un bâtiment voisin effacé non.",
        "La vidéosurveillance dans l'hébergement doit être divulguée dans l'annonce. Dans les pièces intérieures où les voyageurs ont une attente légitime d'intimité — chambres, salles de bains — les caméras sont interdites, même éteintes.",
      ],
    },
    {
      id: "melden",
      heading: "3. Signaler des contenus",
      paragraphs: [
        "Si vous estimez qu'un contenu est illicite ou contraire aux présentes règles, vous pouvez le signaler via la fonction de signalement présente sur chaque annonce, chaque avis et chaque message.",
        "La procédure de signalement au titre de l'article 16 du règlement (UE) 2022/2065 et le traitement des signalements sont décrits sous [Règlement sur les services numériques](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Comment nous faisons appliquer ces règles",
      paragraphs: [
        "Nous examinons chaque contenu signalé et retenons la mesure la moins sévère adaptée : un avertissement, la suppression de la partie concernée, la suppression de l'intégralité du contenu, la restriction de la visibilité, le blocage d'une fonctionnalité ou la suspension du compte.",
        "Les violations répétées ou graves pèsent davantage. En présence de contenus manifestement illicites ou d'un danger pour des personnes, nous agissons immédiatement.",
        "Nous motivons chaque mesure envers la personne concernée et indiquons la voie de réclamation. La réclamation est traitée par des personnes.",
      ],
    },
  ],
};
