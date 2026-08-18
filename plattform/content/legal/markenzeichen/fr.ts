import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Règles relatives aux marques",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "« myBestDays », le logo myBestDays et les éléments graphiques associés sont des signes distinctifs de l'exploitant. Les présentes règles décrivent comment ils peuvent être utilisés.",
  ],
  sections: [
    {
      id: "erlaubt",
      heading: "1. Ce qui est autorisé sans accord particulier",
      paragraphs: [
        "Vous pouvez citer le nom « myBestDays » de manière descriptive pour renvoyer véridiquement à la plateforme — par exemple « Cet hébergement est réservable sur myBestDays ».",
        "Les fournisseurs peuvent créer depuis leur propre site un lien vers leur annonce sur myBestDays et citer le nom à cette occasion.",
        "Dans les contenus rédactionnels et les reportages, le nom peut être cité et le logo reproduit dans la mesure nécessaire à l'information.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "2. Ce qui n'est pas autorisé",
      paragraphs: ["Sans notre accord écrit préalable, sont notamment interdits :"],
      list: [
        "modifier, redessiner, déformer, recolorer le logo ou le combiner avec d'autres signes ;",
        "utiliser le nom ou le logo de manière à créer l'impression d'un partenariat, d'une certification, d'une recommandation ou d'une appartenance qui n'existe pas ;",
        "employer « myBestDays » ou des signes similaires prêtant à confusion dans une dénomination sociale, un nom de produit, un nom de domaine, un nom de compte ou de profil ;",
        "réserver le nom ou le logo comme mot-clé dans une publicité payante sur les moteurs de recherche ;",
        "utiliser nos signes sur des marchandises, dans des applications ou dans des modèles destinés à la vente ou à la diffusion.",
      ],
    },
    {
      id: "darstellung",
      heading: "3. Représentation",
      paragraphs: [
        "N'utilisez le logo que dans la version que nous fournissons, dans des proportions inchangées et avec une zone de protection suffisante. Sur fond sombre, utilisez la version claire.",
        "Écrivez toujours le nom « myBestDays » — un seul mot, m minuscule, B et D majuscules. Les abréviations telles que « BestDays » ne sont pas autorisées.",
      ],
    },
    {
      id: "abgrenzung",
      heading: "4. Distinction avec myNextDays",
      paragraphs: [
        "« myNextDays » est un signe distinct désignant le logiciel de gestion de l'exploitant. Les deux marques ne doivent être ni confondues ni employées l'une pour l'autre.",
      ],
    },
    {
      id: "verstoesse",
      heading: "5. Violations",
      paragraphs: [
        "En cas de violation, nous mettons en demeure de cesser l'usage et nous réservons d'autres actions en justice. Les fournisseurs qui enfreignent les présentes règles s'exposent en outre à des mesures à l'encontre de leur compte.",
        "Les questions relatives à l'utilisation sont à adresser aux coordonnées figurant dans les [Mentions légales](https://mybestdays.dk/rechtliches/impressum).",
      ],
    },
  ],
};
