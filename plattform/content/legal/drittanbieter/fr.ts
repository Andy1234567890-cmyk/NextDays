import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Tiers et services de paiement",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "myBestDays recourt à des services de tiers pour l'exploitation de la plateforme. La présente page les nomme et explique leur rôle ainsi que les conditions applicables.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principe",
      paragraphs: [
        "Lorsqu'un tiers fournit une prestation directement à votre égard, ses conditions et sa politique de confidentialité s'appliquent en complément des nôtres. Nous le signalons à l'endroit concerné.",
        "Lorsqu'un tiers traite exclusivement pour notre compte, nous restons votre interlocuteur. Les sous-traitants auxquels nous recourons figurent dans la [Politique de confidentialité](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Prestataire de services de paiement",
      paragraphs: [
        "Les paiements via la plateforme sont traités par Stripe. Stripe collecte et traite directement les données de paiement et en est responsable de traitement autonome. La [politique de confidentialité de Stripe](https://stripe.com/privacy) s'applique en complément.",
        "Pour le versement aux hôtes, Stripe effectue la vérification d'identité légalement prescrite.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Directive sur les services de paiement et accès des tiers",
      paragraphs: [
        "La directive (UE) 2015/2366 (« DSP2 ») impose une authentification forte du client pour de nombreux paiements. Votre banque ou votre émetteur de carte l'effectue ; sans authentification réussie, un paiement peut être refusé.",
        "myBestDays n'est ni un service d'initiation de paiement ni un service d'information sur les comptes et n'accède pas à vos comptes bancaires.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Cartes, images et contenus intégrés",
      paragraphs: [
        "Pour les représentations cartographiques et les indications de localisation, nous intégrons des services de cartographie de tiers. Le chargement de tels contenus peut entraîner un transfert de données au prestataire concerné ; les détails et le pilotage du consentement figurent dans la [Politique relative aux cookies](https://mybestdays.dk/rechtliches/cookies).",
        "Les images et descriptions des annonces proviennent du fournisseur concerné, non de nous.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Sites liés",
      paragraphs: [
        "La plateforme peut renvoyer vers des sites de tiers. Nous n'avons aucune influence sur leur contenu et n'en assumons aucune responsabilité. Dès que nous avons connaissance d'une violation du droit, nous supprimons le lien sans délai.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. Boutiques d'applications",
      paragraphs: [
        "Si vous obtenez l'application myBestDays via une boutique d'applications, les conditions de l'exploitant de la boutique s'appliquent en complément. L'exploitant de la boutique n'est pas partie au contrat entre vous et nous et ne doit ni assistance ni garantie pour l'application.",
      ],
    },
  ],
};
