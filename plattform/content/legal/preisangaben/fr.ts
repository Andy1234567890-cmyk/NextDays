import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Prix, classement et recommandations",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "La présente page explique comment les prix sont affichés sur myBestDays, ce qui détermine l'ordre des résultats de recherche et comment naissent les recommandations. Elle satisfait aux obligations de transparence résultant de l'article 6 bis de la directive 2005/29/CE, de l'article 5 du règlement (UE) 2019/1150 et de l'article 27 du règlement (UE) 2022/2065.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Comment les prix sont affichés",
      paragraphs: [
        "Dès que la période et le nombre de voyageurs sont connus, nous affichons le prix total pour l'ensemble du séjour, taxes et frais réglés via la plateforme inclus.",
        "Tant qu'aucune période n'est choisie, nous affichons un prix par nuit à titre indicatif et le signalons comme tel.",
        "Les frais dus seulement sur place sont indiqués séparément avant la finalisation de la réservation. Ils ne font pas partie du prix total mais sont visibles avant la réservation.",
        "Lorsque nous affichons un prix de comparaison barré, il s'agit du prix le plus bas pratiqué par le fournisseur pour la même prestation au cours des 30 jours précédant la réduction (article 6 bis de la directive 98/6/CE).",
        "Les prix sont identiques pour tous les voyageurs. Nous n'adaptons pas le prix à votre personne, à votre appareil ou à votre historique de recherche.",
      ],
    },
    {
      id: "ranking",
      heading: "2. Ce qui détermine l'ordre des résultats de recherche",
      paragraphs: [
        "Dans le tri par défaut, les critères suivants déterminent l'ordre, par importance décroissante :",
      ],
      list: [
        "la correspondance avec votre recherche — disponibilité sur la période recherchée, capacité pour le nombre de voyageurs, situation dans la zone recherchée et filtres appliqués ;",
        "l'exhaustivité et la qualité de l'annonce — description, photos, informations d'équipement tenues à jour ;",
        "les avis — note globale et nombre d'avis ;",
        "la fiabilité du fournisseur — réactivité, taux d'acceptation et annulations de son fait ;",
        "l'actualité des prix et des disponibilités ;",
        "le rapport qualité-prix comparé à des annonces similaires dans la même zone.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Placement payant",
      paragraphs: [
        "Un fournisseur ne peut acheter une meilleure place dans le tri par défaut. Le niveau des frais de service n'influence pas l'ordre.",
        "Si nous devions proposer à l'avenir des placements payants, nous les identifierions sans équivoque comme publicité et les séparerions visiblement des autres résultats.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Modifier le tri",
      paragraphs: [
        "Vous pouvez modifier le tri à tout moment, par exemple par prix ou par avis. Le tri actif est affiché au-dessus de la liste de résultats.",
        "Vous disposez d'au moins un tri qui ne repose pas sur un profilage au sens de l'article 4, point 4, du règlement (UE) 2016/679.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Recommandations",
      paragraphs: [
        "Lorsque nous vous présentons des suggestions (« pourrait vous plaire », « hébergements similaires »), celles-ci reposent sur la recherche en cours, sur les annonces consultées précédemment et sur les caractéristiques d'hébergements similaires.",
        "Vous pouvez désactiver les recommandations personnalisées dans votre compte. Vous verrez alors des suggestions fondées uniquement sur la recherche en cours.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Les avis dans le classement",
      paragraphs: [
        "La manière dont les avis sont recueillis et vérifiés figure dans la [Politique relative aux avis](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). Les avis entrent dans l'ordre d'affichage, mais nous ne pondérons pas davantage certains avis et ne supprimons pas les avis négatifs.",
      ],
    },
  ],
};
