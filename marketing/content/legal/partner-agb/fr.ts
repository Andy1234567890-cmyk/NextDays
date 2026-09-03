// Partner-AGB — Französisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "Conditions de participation au programme de partenariat myNextDays : Attribution, base de commission, échelonnement, commission d'équipe, interdictions, identification, paiement.",
  numbered: false,
  toc: true,
  title: "Conditions de participation au programme de partenariat (CGP Partenaires) — Projet",
  standIso: "2026-09-02",
  intro: [
    "PROJET — Ces conditions sont un état de travail de myNextDays et n'ont pas encore été examinées par un avocat. Jusqu'à la publication de la version révisée, elles sont considérées comme une description du programme, et non comme un texte contractuel définitif. La version révisée sera publiée à cette adresse avec un nouveau numéro de version ; les partenaires seront invités à donner leur accord à nouveau lors de leur prochaine connexion.",
    `Ces conditions de participation régissent la participation au programme de partenariat (programme d'affiliation) de ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (ci-après « myNextDays » ou « nous ») par des partenaires (ci-après « Partenaire »).`,
    "Le programme de partenariat s'adresse aux personnes et aux entreprises établies dans l'UE, en Suisse ou au Royaume-Uni, qui recommandent des établissements (loueurs, agences, hôtels) sur myNextDays.",
  ],
  sections: [
    {
      heading: "§ 1 Participation et approbation",
      paragraphs: [
        "La participation nécessite une candidature via le tableau de bord du partenaire. Les informations obligatoires sont le nom ou la raison sociale, la forme juridique, le pays, au moins un compte de média social avec adresse, identifiant et portée, ainsi que, pour les entreprises, le numéro d'identification de TVA.",
        "myNextDays examine chaque candidature personnellement et décide librement de l'approbation. Il n'existe aucun droit à l'admission. La participation est gratuite ; un abonnement à myNextDays n'est pas une condition préalable.",
        "Le Partenaire maintient ses informations à jour, notamment les canaux, la forme juridique, les données fiscales et de paiement.",
        "La portée indiquée est initialement une auto-déclaration. Le Partenaire peut connecter volontairement ses comptes YouTube, Instagram, Facebook et TikTok ; les abonnés et les vues sont alors lus depuis la plateforme et affichés comme vérifiés. La portée non vérifiée est moins pondérée lors de l'approbation et des vérifications ultérieures. La connexion peut être déconnectée à tout moment dans le tableau de bord ; les détails du traitement sont disponibles dans la politique de confidentialité.",
      ],
    },
    {
      heading: "§ 2 Attribution des établissements (Attribution)",
      paragraphs: [
        "Un établissement est attribué au Partenaire s'il s'enregistre avec le code de recommandation du Partenaire. Le code est affiché de manière visible à l'établissement lors de l'enregistrement et confirmé par l'envoi. Aucun cookie de suivi n'est défini.",
        "Un établissement est attribué à un seul Partenaire ; le code confirmé lors de l'enregistrement est déterminant. Une réattribution ultérieure n'est effectuée par myNextDays qu'en cas d'erreur avérée.",
        "Ne sont pas attribués les établissements du Partenaire lui-même, de ses associés, employés ou proches, ainsi que les établissements qui sont ou ont été clients de myNextDays.",
      ],
    },
    {
      heading: "§ 3 Commission sur les propres clients",
      paragraphs: [
        "La base de la commission est le chiffre d'affaires net d'abonnement de l'établissement attribué (tarif de base et modules) provenant des factures payées — hors TVA, hors commissions de portail, services supplémentaires, recalculs et autres postes transitoires.",
        "Le taux de commission est basé sur le rang du partenaire au moment du paiement. Les rangs et les taux sont publiés sur la page du programme. Le rang est déterminé par le nombre de clients payants dans la structure du partenaire : ses propres clients payants et les clients payants de ses partenaires d'équipe (§ 4), chaque client étant compté une fois. Le rang est déterminé mensuellement à la date de référence ; une promotion prend effet immédiatement, un déclassement n'intervient que si le nombre est resté en dessous du seuil pendant deux dates de référence consécutives.",
        "Si le partenaire atteint pour la première fois un rang à partir de « Aufsteiger », il reçoit une prime de promotion unique, dont le montant est indiqué sur la page du programme pour ce rang (actuellement 50,00 EUR par rang, pour tous les partenaires en euros). Chaque rang n'est rémunéré qu'une seule fois, même après un déclassement et une nouvelle promotion. Le bonus est soumis à la fenêtre de remboursement conformément au § 7.",
        "La commission est générée par entreprise pendant douze mois à compter de sa première facture d'abonnement payante ; une phase de test gratuite et un mois gratuit intermédiés par le partenaire ne sont pas pris en compte. Si l'abonnement se termine avant, la commission prend fin avec la dernière facture payée.",
        "À partir du rang « Elite-Partner », le partenaire reçoit en outre une super-commission d'un montant indiqué sur la page du programme (actuellement 2,5 %) sur le chiffre d'affaires net des abonnements de tous les clients de sa structure — ses propres clients et les clients de ses partenaires d'équipe — sans la limite de douze mois, tant que le client concerné détient un abonnement payant et que le partenaire détient le rang au moment du paiement. Elle est générée en plus de la commission conformément à la phrase 2 et au § 4.",
        "À partir du rang « Elite-Partner », le partenaire reçoit, pour chaque réservation d'une entreprise associée à lui ou à l'un de ses partenaires d'équipe, reçue et payée via myBestDays, une part de réservation d'un montant indiqué sur la page du programme (actuellement 0,5 %) du montant de la réservation payé par le client dans la devise de la réservation, sans limite de temps, tant que l'association existe et que le partenaire détient le rang au moment du paiement de la réservation. Les cautions ne sont pas un montant de réservation. Les remboursements au client réduisent la part proportionnellement (§ 7).",
      ],
    },
    {
      heading: "§ 4 Commission d'équipe",
      paragraphs: [
        "À partir du rang « Aufsteiger », un partenaire peut diriger des partenaires d'équipe. Si un autre partenaire postule via le lien d'équipe du partenaire et confirme visiblement son code dans sa candidature, il sera associé à l'équipe du partenaire (ci-après « Sponsor ») après son approbation. Si le Sponsor ne détient pas le rang au moment de la candidature, la candidature reste valide, mais aucune association d'équipe n'est créée.",
        "Le Sponsor reçoit une commission d'équipe sur le chiffre d'affaires net des abonnements des clients de ses partenaires d'équipe, d'un montant correspondant à la différence entre son propre taux de commission et le taux de commission du partenaire d'équipe, chacun selon le rang au moment du paiement. Si les deux sont au même rang ou si le partenaire d'équipe est plus élevé, aucune commission d'équipe n'est générée. La commission du partenaire d'équipe et la commission d'équipe du Sponsor ne dépassent jamais ensemble le taux le plus élevé de la grille (actuellement 30 %).",
        "La commission d'équipe n'existe qu'à un seul niveau de profondeur : les partenaires d'équipe ne reçoivent pas de commission d'équipe sur les partenaires qu'ils recrutent eux-mêmes. Aucune rémunération n'est versée pour le recrutement d'un partenaire ; aucune participation n'est prélevée. La commission d'équipe est exclusivement générée par le chiffre d'affaires des abonnements payants.",
        "La commission d'équipe court pour chaque client d'équipe pendant douze mois à compter de sa première facture payée, est soumise à la même fenêtre de remboursement et est annulée proportionnellement en cas de remboursement ou de rétrofacturation (§ 7). Elle n'est générée que tant que le sponsor et le partenaire d'équipe sont approuvés ; sinon, elle est suspendue jusqu'à clarification.",
        "L'affectation à une équipe est unique. Une modification n'est effectuée que par myNextDays avec un motif documenté.",
      ],
    },
    {
      heading: "§ 5 Obligations du partenaire et identification",
      paragraphs: [
        "Le partenaire identifie chaque recommandation avec son lien ou son code comme publicité — au début de la publication, dans la langue de la publication, conformément aux exigences de son pays (en Allemagne, notamment § 5a al. 4 UWG, au Danemark, markedsføringsloven § 6 al. 4). myNextDays met à disposition les formulations par pays dans le tableau de bord du partenaire.",
        "Le partenaire ne fournit à myNextDays que des informations correspondant aux descriptions de services publiées et ne fait aucune promesse au nom de myNextDays. Sont notamment interdites les promesses de succès et de garantie (par exemple, « occupation complète garantie en trois jours ») ainsi que les déclarations concernant les revenus qui ne découlent pas des descriptions de services publiées.",
        "Chaque vidéo et chaque publication mentionnant myNextDays ou portant le lien du partenaire est soumise pour examen sous forme de fichier dans le tableau de bord du partenaire avant publication. Le lien du partenaire n'est créé qu'après l'approbation écrite de myNextDays ; toute publication sans approbation est interdite. myNextDays peut révoquer une approbation ; les commissions déjà générées restent inchangées.",
        "Pour les logos, captures d'écran, B-Roll, superpositions et captures d'écran, le partenaire utilise exclusivement le matériel publicitaire fourni par myNextDays. Les enregistrements logiciels propres et non vérifiés ne sont pas autorisés.",
      ],
    },
    {
      heading: "§ 6 Pratiques interdites",
      paragraphs: ["Sont notamment interdits :"],
      list: [
        "Le Brand-Bidding : annonces payantes sur la marque « myNextDays », ses variantes orthographiques et combinaisons (par exemple, « myNextDays Prix ») dans les moteurs de recherche et les réseaux ;",
        "Le Cookie-Dropping, les redirections cachées, les iFrames, l'appel automatisé du lien partenaire ou toute autre manipulation technique de l'attribution ;",
        "L'auto-promotion : l'enregistrement de ses propres entreprises, d'associés, d'employés ou de proches via son propre code ou le code d'un partenaire d'équipe ;",
        "L'audience achetée (followers achetés, fermes de clics, trafic de bots) ainsi que les incitations aux entreprises pour l'enregistrement (remboursements, cadeaux, jeux-concours) ;",
        "Les promesses de recrutement : le recrutement de partenaires avec des promesses de gains qui ne proviennent pas du chiffre d'affaires des abonnements payants, ou la présentation du programme comme source de revenus par le recrutement de partenaires supplémentaires ;",
        "Spam, publicité directe non sollicitée et utilisation de marques ou de contenus de tiers sans droit.",
      ],
    },
    {
      heading: "§ 7 Fenêtre de remboursement, reprise, rétention",
      paragraphs: [
        "Chaque ligne de commission est ouverte pendant 30 jours après sa création (fenêtre de remboursement) et est ensuite payable. Si une facture sous-jacente est remboursée en tout ou en partie ou fait l'objet d'une rétrofacturation (chargeback), la commission — y compris toute commission d'équipe basée sur celle-ci — est reprise proportionnellement, même après paiement, par compensation avec de futures commissions.",
        "En cas de suspicion d'une infraction aux § 2, § 5 ou § 6, myNextDays est autorisé à suspendre les attributions et les commissions jusqu'à clarification. Si l'infraction est confirmée, les commissions concernées sont annulées.",
      ],
    },
    {
      heading: "§ 8 Paiement et note de crédit",
      paragraphs: [
        "Les commissions payables sont regroupées mensuellement par devise et versées dès qu'elles atteignent le montant minimum de la devise respective indiqué sur la page du programme ou dans le tableau de bord. Aucune conversion entre les devises n'a lieu.",
        "La facturation s'effectue par le biais d'une procédure d'auto-facturation (momsloven § 52a) : myNextDays établit une note de crédit pour chaque paiement ; le partenaire n'émet pas de facture. Le partenaire accepte la procédure d'auto-facturation.",
        "Les entrepreneurs reçoivent la note de crédit avec une indication de l'inversion de la charge fiscale (Reverse Charge) ; la condition préalable est un numéro d'identification de TVA valide et confirmé. Les particuliers reçoivent la note de crédit sans TVA et déclarent eux-mêmes la commission.",
        "Le paiement est effectué par virement SEPA, Wise ou PayPal aux données enregistrées par le partenaire dans le tableau de bord.",
      ],
    },
    {
      heading: "§ 9 Données et aperçu",
      paragraphs: [
        "Le partenaire voit les établissements attribués de manière pseudonyme (numéro, pays, statut, montants). Les noms, adresses e-mail ou données de réservation des établissements ne sont pas divulgués. Un sponsor voit le nom ou la raison sociale, le rang, le nombre de clients payants et la commission d'équipe qui en résulte de ses partenaires d'équipe, mais pas les détails des clients.",
        "Pour les comptes connectés et les publications créées, myNextDays voit les abonnés, les vues, les interactions ainsi que les clics et les clients par publication. Les anomalies (par exemple, un saut d'abonnés sans vues correspondantes ou un écart significatif entre l'auto-déclaration et la valeur vérifiée) sont des indications pour un examen personnel conformément aux § 6 et § 10, et non un blocage automatique.",
        "Le traitement des données personnelles dans le programme de partenariat est décrit dans la politique de confidentialité.",
      ],
    },
    {
      heading: "§ 10 Durée, blocage et résiliation",
      paragraphs: [
        "La participation est à durée indéterminée et peut être résiliée par les deux parties à tout moment sous forme de texte. Les commissions déjà générées et payables sont versées conformément au § 8 ; aucune nouvelle commission n'est générée après la résiliation.",
        "myNextDays peut bloquer le partenaire en cas de violation des présentes conditions. Pendant le blocage, les commissions sont suspendues ; en cas de violation confirmée, elles sont annulées.",
      ],
    },
    {
      heading: "§ 11 Modifications",
      paragraphs: [
        "myNextDays peut modifier ces conditions et le barème avec effet pour l'avenir. Les modifications seront publiées sur le tableau de bord du partenaire et sur cette page avec un numéro de version ; en cas de modifications substantielles, le partenaire sera invité à donner son accord à nouveau. Les commissions déjà générées restent inchangées.",
      ],
    },
    {
      heading: "§ 12 Droit applicable",
      paragraphs: [
        "Le droit danois est applicable, à l'exclusion des règles de conflit de lois. Les dispositions impératives en matière de protection des consommateurs de l'État dans lequel un partenaire privé a sa résidence habituelle restent inchangées.",
      ],
    },
  ],
};
