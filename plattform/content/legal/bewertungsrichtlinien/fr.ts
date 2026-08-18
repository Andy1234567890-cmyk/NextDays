import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politique relative aux avis",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "Les avis constituent pour les voyageurs la principale source indépendante. La présente politique décrit qui peut déposer un avis, comment nous garantissons que les avis émanent de voyageurs réels et quand nous supprimons un avis.",
  ],
  sections: [
    {
      id: "echtheit",
      heading: "1. Comment nous garantissons l'authenticité",
      paragraphs: [
        "Seule peut déposer un avis la personne qui a réservé l'hébergement via myBestDays et dont la période de séjour a commencé. L'avis est techniquement rattaché à la réservation concrète.",
        "Nous satisfaisons ainsi à l'obligation résultant du point 23 ter de l'annexe I de la directive 2005/29/CE de ne présenter comme avis de voyageurs que ceux pour lesquels nous avons pris des mesures raisonnables afin de vérifier qu'ils émanent de voyageurs réels.",
        "Nous n'achetons ni ne commandons d'avis et ne publions pas de faux avis. Nous ne tolérons pas davantage que des fournisseurs le fassent.",
      ],
    },
    {
      id: "frist",
      heading: "2. Délai et publication",
      paragraphs: [
        "Après le départ, vous disposez de 14 jours pour déposer un avis. Le fournisseur peut déposer un avis à votre sujet dans le même délai.",
        "Les deux avis sont publiés simultanément dès que les deux existent ou que le délai est expiré. Ainsi, aucune des parties n'influence l'autre.",
        "Vous pouvez retirer un avis déposé dans le délai. Après publication, toute modification est exclue ; vous pouvez le faire supprimer.",
      ],
    },
    {
      id: "antwort",
      heading: "3. Réponse du fournisseur",
      paragraphs: [
        "Le fournisseur peut répondre publiquement à un avis. Les mêmes règles s'appliquent à la réponse qu'à l'avis lui-même.",
        "Une réponse ne modifie pas l'avis et ne change rien à la note globale.",
      ],
    },
    {
      id: "entfernung",
      heading: "4. Quand nous supprimons un avis",
      paragraphs: [
        "Nous ne supprimons pas un avis parce qu'il est négatif ou parce que le fournisseur n'en est pas satisfait. Nous le supprimons lorsqu'il :",
      ],
      list: [
        "enfreint les [Règles relatives aux contenus appropriés](https://mybestdays.dk/rechtliches/inhaltsrichtlinien) ;",
        "contient des données à caractère personnel de tiers ;",
        "se rapporte manifestement à un autre hébergement ou à un autre séjour ;",
        "porte pour l'essentiel sur des circonstances sur lesquelles ni le voyageur ni le fournisseur n'avaient d'influence (par exemple météo, chantier communal, circulation à l'arrivée) — dans ce cas, nous ne supprimons que la partie concernée si elle peut être isolée ;",
        "vise manifestement à exercer une pression, par exemple parce qu'il a été assorti d'une exigence ;",
        "a été obtenu au moyen d'incitations ou déposé de manière concertée.",
      ],
    },
    {
      id: "anreize",
      heading: "5. Les incitations sont interdites",
      paragraphs: [
        "Les fournisseurs ne peuvent offrir ni argent, ni remises, ni surclassements, ni cadeaux ou autres avantages en contrepartie d'un avis — ni pour s'abstenir d'en déposer un.",
        "Les fournisseurs peuvent inviter les voyageurs à déposer un avis sans influencer la note. Une invitation qui n'appelle à déposer un avis qu'en cas d'expérience positive est interdite.",
      ],
    },
    {
      id: "darstellung",
      heading: "6. Comment nous présentons les avis",
      paragraphs: [
        "La note globale est la moyenne non pondérée de tous les avis publiés relatifs à un hébergement. Nous ne pondérons aucun avis davantage au motif qu'il est plus favorable.",
        "Le tri par défaut affiche les avis les plus récents en premier. Vous pouvez basculer vers d'autres tris ; le tri actif est affiché.",
        "Nous indiquons le nombre d'avis sur lequel repose une note globale. En dessous de trois avis, nous n'affichons pas de note globale, seulement les avis individuels.",
      ],
    },
    {
      id: "beschwerde",
      heading: "7. Réclamation contre une décision",
      paragraphs: [
        "Si nous supprimons votre avis ou refusons la suppression d'un avis, nous motivons cette décision et indiquons la voie de réclamation — voir [Réclamations et règlement des litiges](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
  ],
};
