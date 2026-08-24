// Traduction française des mentions légales. La version de référence est
// ./de.ts — toute modification de fond doit D'ABORD être apportée là-bas.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Mentions légales",
  metaDescription:
    "Informations sur le prestataire myNextDays ApS conformément à l'article 7 de la loi danoise sur le commerce électronique (e-handelslov) : société, adresse, direction, numéro CVR et contact.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Informations sur le prestataire de la plateforme myNextDays — un property management system et channel manager exploité par ${ANBIETER.firma}.`,
    "Mentions obligatoires en vertu de l'article 7 de la loi danoise sur le commerce électronique (e-handelslov), qui transpose l'article 5 de la directive 2000/31/CE sur le commerce électronique.",
  ],
  sections: [
    {
      heading: "Prestataire",
      zeilen: [
        {
          label: "Société",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Adresse",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Direction habilitée à représenter la société",
          werte: [`${ANBIETER.direktion.join(" et ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Contact",
      zeilen: [
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Téléphone",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Internet",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Registre du commerce et TVA",
      zeilen: [
        {
          label: "Registre du commerce",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Danemark",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Numéro de TVA intracommunautaire",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Point de contact au titre du règlement sur les services numériques",
      paragraphs: [
        `Point de contact central pour les autorités en vertu de l'article 11 et pour les utilisateurs en vertu de l'article 12 du règlement (UE) 2022/2065 (Digital Services Act) : ${ANBIETER.email}.`,
        "Les langues de communication sont l'allemand, le danois et l'anglais.",
      ],
    },
    {
      heading: "Règlement des litiges de consommation",
      paragraphs: [
        "Nous ne sommes ni disposés ni tenus de participer à une procédure de règlement des litiges devant un organisme de médiation de la consommation.",
      ],
    },
    {
      heading: "Responsabilité relative aux liens",
      paragraphs: [
        "Malgré un contrôle attentif du contenu, nous déclinons toute responsabilité quant au contenu des liens externes. Le contenu des sites liés relève exclusivement de la responsabilité de leurs exploitants respectifs.",
      ],
    },
    {
      heading: "Droits d'auteur",
      paragraphs: [
        `Les contenus, textes, graphismes et marques publiés sur ce site sont protégés par le droit d'auteur et le droit des marques. Toute utilisation dépassant le cadre légalement autorisé requiert le consentement écrit préalable de ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Autres documents juridiques",
      paragraphs: [
        "L'utilisation de la plateforme est régie par nos conditions générales de vente. La manière dont nous traitons les données à caractère personnel figure dans la politique de confidentialité ; les cookies utilisés sont énumérés dans la politique en matière de cookies.",
      ],
      links: [
        { label: "Conditions générales de vente", href: AGB_URL },
        { label: "Politique de confidentialité", href: "/datenschutz" },
        { label: "Politique en matière de cookies", href: "/cookie-richtlinie" },
        { label: "Accord de sous-traitance des données (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Droit applicable",
      paragraphs: [
        `${ANBIETER.firma} a son siège et est exclusivement établie au Danemark. Le droit danois s'applique donc à cette offre en ligne — y compris à la version en langue française (principe du pays d'origine selon l'article 3 de la directive 2000/31/CE). Les obligations d'information découlent de l'article 7 de la loi danoise sur le commerce électronique (e-handelslov).`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
