import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Frais en dehors de la plateforme",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "La présente politique détermine quels montants un fournisseur peut exiger en dehors de la plateforme et lesquels sont exclus. Elle protège les voyageurs contre des demandes sur place qui ne figuraient pas dans l'annonce.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principe",
      paragraphs: [
        "Tout ce qui est dû au titre de la prestation réservée doit figurer dans l'annonce avant la finalisation de la réservation — soit comme composante du prix total, soit comme poste de frais sur place.",
        "Un montant qui n'a été indiqué ni dans le prix total ni comme frais sur place n'est pas dû par le voyageur.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Ce qui peut être exigé sur place",
      paragraphs: ["Seuls peuvent être exigés sur place :"],
      list: [
        "les montants expressément indiqués dans l'annonce comme frais sur place (par exemple ménage de fin de séjour, forfait linge, place de stationnement) ;",
        "les redevances locales telles que la taxe de séjour, dans la mesure où les règles locales imposent son acquittement sur place ;",
        "une caution indiquée dans l'annonce ;",
        "les prestations que le voyageur réserve seulement sur place et de son plein gré, à un prix annoncé au préalable ;",
        "la réparation des dommages avérés causés par le voyageur.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Ce qui ne peut être exigé",
      paragraphs: ["Sont notamment interdits :"],
      list: [
        "un complément de prix sur le tarif des nuitées après la finalisation de la réservation ;",
        "des frais liés au fait que la réservation a été effectuée via myBestDays ;",
        "des frais de dossier, de réservation ou de carte non indiqués dans l'annonce ;",
        "l'invitation à annuler la réservation et à réserver de nouveau le même hébergement hors de la plateforme ;",
        "l'invitation à régler le prix ou une partie de celui-ci par virement, en espèces ou via un service de paiement hors de la plateforme, alors que l'annonce prévoit un paiement via la plateforme.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Contournement de la plateforme",
      paragraphs: [
        "Lorsque le contact entre voyageur et fournisseur s'est établi via la plateforme, la réservation ne peut être exécutée en dehors de celle-ci. Cela vaut pour les deux parties.",
        "Quiconque contourne la plateforme en perd la protection : les paiements ne sont pas sécurisés, nos politiques d'annulation et de remboursement ne s'appliquent pas, et nous ne pouvons intervenir en cas de litige.",
        "Les violations peuvent entraîner la suspension du compte. À l'égard des fournisseurs, nous pouvons en outre réclamer les frais de service perdus.",
      ],
    },
    {
      id: "melden",
      heading: "5. Signaler",
      paragraphs: [
        "Si un montant qui ne figurait pas dans l'annonce vous est réclamé sur place, ne le payez pas et signalez-le-nous via les voies de contact indiquées sous [Réclamations et règlement des litiges](https://mybestdays.dk/rechtliches/beschwerden). Si vous avez déjà payé, nous vous aidons à en obtenir le remboursement.",
      ],
    },
  ],
};
