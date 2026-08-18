import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Conditions d'utilisation pour les voyageurs",
  stand: "Mise à jour : 18 août 2026",
  intro: [
    "Les présentes conditions d'utilisation régissent l'utilisation du portail de réservation myBestDays (ci-après « la plateforme ») par les voyageurs et les personnes qui réservent (ci-après « le voyageur » ou « vous »).",
    `La plateforme est exploitée par ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danemark, CVR n° ${ANBIETER.cvr} (ci-après « myBestDays » ou « nous »). myBestDays est une marque de cette société et non une personne morale distincte. Les mentions complètes figurent dans les [Mentions légales](https://mybestdays.dk/rechtliches/impressum).`,
    "En utilisant la plateforme, vous acceptez les présentes conditions. Veuillez les lire attentivement.",
  ],
  summary: {
    heading: "Résumé des présentes conditions",
    paragraphs: [
      "myBestDays est une place de marché. Nous mettons à disposition la plateforme sur laquelle des fournisseurs proposent leur hébergement — nous ne fournissons pas l'hébergement lui-même. Le contrat d'hébergement est conclu entre vous et le fournisseur, non avec nous.",
      "Ce que vous voyez dans une annonce provient du fournisseur : description, photos, équipements, prix, conditions d'annulation et règlement intérieur. Nous contrôlons les annonces, mais nous ne pouvons pas garantir chaque indication d'un fournisseur.",
      "Le prix affiché au moment de finaliser la réservation est le prix total des prestations réservées. Les montants dus seulement sur place (par exemple taxe de séjour ou caution) sont indiqués séparément au préalable.",
      "En cas de problème, adressez-vous d'abord à nous. La section A15 décrit comment déposer une réclamation et quelles voies vous sont ensuite ouvertes.",
      "Ce résumé explique les conditions mais ne les remplace pas. Le texte intégral fait foi.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Toutes les réservations via myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Définitions",
          paragraphs: [
            "Les termes employés dans les présentes conditions sont expliqués dans le lexique figurant à la fin du présent document. Les principaux sont :",
          ],
          list: [
            "« Plateforme » — le site web, les applications mobiles et tous autres accès par lesquels myBestDays affiche des hébergements et met en relation pour des réservations.",
            "« Fournisseur » — la personne physique ou morale qui propose un hébergement via la plateforme (hôte, bailleur, agence, établissement hôtelier ou d'hébergement).",
            "« Hébergement » — la prestation d'hébergement proposée par le fournisseur, à savoir un bien de vacances ou une unité d'un type de chambre ou de bien.",
            "« Réservation » — la réservation d'un hébergement pour une période déterminée, conclue via la plateforme.",
            "« Prix total » — le montant affiché au moment de finaliser la réservation, taxes, frais et suppléments réglés via la plateforme inclus.",
            "« Frais sur place » — les montants qui ne sont pas réglés via la plateforme mais dus au fournisseur (par exemple taxe de séjour, caution, ménage de fin de séjour selon le choix du fournisseur).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. À propos des présentes conditions",
          paragraphs: [
            "Les présentes conditions s'appliquent à toute utilisation de la plateforme, que vous créiez ou non un compte et qu'une réservation soit conclue ou non.",
            "La section A s'applique à toutes les réservations. La section B contient les règles complémentaires relatives aux hébergements. En cas de contradiction, la section B prévaut.",
            "La prestation d'hébergement elle-même est en outre régie par les conditions du fournisseur concerné (notamment règlement intérieur et conditions d'annulation) telles qu'indiquées dans l'annonce. Ces conditions du fournisseur s'ajoutent aux nôtres ; elles ne peuvent pas écarter nos conditions s'agissant de votre relation avec nous.",
            "Les présentes conditions existent dans les 24 langues officielles de l'Union européenne. En cas de divergence entre les versions linguistiques, la version allemande fait foi, sauf disposition impérative contraire du droit de votre État de résidence.",
            "Les droits impératifs des consommateurs prévus par le droit de votre État de résidence ne sont pas affectés par les présentes conditions.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. À propos de myBestDays",
          paragraphs: [
            "myBestDays est une place de marché en ligne pour hébergements de vacances et établissements d'hébergement. Nous exploitons la plateforme sur laquelle les fournisseurs présentent leur hébergement et les voyageurs peuvent le réserver.",
            "Nous sommes intermédiaire, non hébergeur. Nous ne possédons, n'exploitons, ne gérons ni ne contrôlons aucun des hébergements proposés sur la plateforme et nous ne sommes pas partie au contrat d'hébergement.",
            "myBestDays est un service intermédiaire au sens du règlement (UE) 2022/2065 relatif aux services numériques. Nos informations et procédures au titre de ce règlement figurent sous [Règlement sur les services numériques](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays n'est pas organisateur de voyages. Nous ne composons pas de forfaits au sens de la directive (UE) 2015/2302 ; sur les prestations de voyage liées, voir A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Notre plateforme",
          paragraphs: [
            "Le contenu d'une annonce — description, photos, équipements, limites d'occupation, prix, disponibilités, conditions d'annulation et règlement intérieur — provient du fournisseur concerné. Celui-ci est responsable de son exactitude et de son exhaustivité.",
            "Nous contrôlons les annonces avant publication et de manière continue au regard des violations manifestes de nos [Règles relatives aux contenus appropriés](https://mybestdays.dk/rechtliches/inhaltsrichtlinien). Il n'existe aucune obligation de surveillance générale de l'ensemble des contenus et une telle obligation ne serait d'ailleurs pas admissible au titre de l'article 8 du règlement (UE) 2022/2065.",
            "La manière dont nous classons les résultats de recherche et les critères qui déterminent cet ordre sont expliqués dans [Prix, classement et recommandations](https://mybestdays.dk/rechtliches/preisangaben).",
            "Nous nous efforçons d'assurer une plateforme disponible en permanence, mais nous ne devons pas une disponibilité ininterrompue. Des opérations de maintenance, des dysfonctionnements et des adaptations sont possibles.",
            "Les traductions des contenus des fournisseurs peuvent être automatiques. La version originale saisie par le fournisseur fait foi.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Nos valeurs",
          paragraphs: [
            "Nous attendons des voyageurs et des fournisseurs un comportement respectueux. Toute discrimination fondée sur l'origine, la couleur de peau, la religion, les convictions, le sexe, l'identité de genre, l'orientation sexuelle, le handicap, l'âge ou des caractéristiques comparables n'est pas tolérée sur la plateforme — voir [Politique de non-discrimination](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Le comportement durant le séjour est régi par les [Règles de base pour les voyageurs](https://mybestdays.dk/rechtliches/grundregeln-gaeste), et pour les fournisseurs par le [Code de conduite des fournisseurs](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Votre compte et votre utilisation de la plateforme",
          paragraphs: [
            "Pour réserver, vous pouvez créer un compte. Vous êtes responsable de la confidentialité de vos identifiants et nous informez sans délai si vous suspectez une utilisation non autorisée.",
            "Vous ne pouvez utiliser la plateforme que si vous avez la capacité juridique et pouvez conclure valablement des contrats.",
            "Vos indications lors de l'inscription et de la réservation doivent être exactes et complètes — en particulier le nom, les coordonnées et le nombre de voyageurs. Le fournisseur a besoin de ces informations pour mettre l'hébergement à disposition et satisfaire à ses obligations déclaratives.",
            "Sont notamment interdits :",
          ],
          list: [
            "les réservations fictives, les paiements frauduleux ou l'utilisation sans habilitation des moyens de paiement d'autrui ;",
            "l'extraction automatisée de la plateforme (scraping, robots d'indexation) au-delà de ce qu'autorise notre robots.txt ;",
            "les actions qui perturbent ou surchargent la plateforme ou l'infrastructure sous-jacente ou contournent ses mesures de sécurité ;",
            "la publication de contenus illicites, injurieux ou trompeurs dans les avis, les messages ou les informations de profil ;",
            "la tentative de conclure la réservation en dehors de la plateforme après que le contact a été établi par son intermédiaire — voir [Frais en dehors de la plateforme](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Prix",
          paragraphs: [
            "Tous les prix sont affichés comme prix total, taxes et frais réglés via la plateforme inclus, dès que les données de voyage (période et nombre de voyageurs) sont connues. Lorsqu'un élément n'est dû que sur place, nous l'indiquons séparément avant la finalisation de la réservation.",
            "Les prix sont affichés dans la devise de l'annonce. Si un montant est en outre affiché dans une autre devise, il s'agit d'une conversion indicative sans valeur contraignante ; le règlement s'effectue dans la devise de l'annonce, sauf indication contraire lors du paiement.",
            "Les prix peuvent évoluer jusqu'à la finalisation de la réservation, par exemple parce que le fournisseur les ajuste ou que la disponibilité change. Fait foi le prix qui vous est affiché immédiatement avant la réservation ferme et qui figure dans la confirmation de réservation.",
            "Les erreurs de prix manifestes (par exemple un montant erroné d'un facteur dix) ne lient ni nous ni le fournisseur. Si nous constatons une telle erreur, nous vous en informons sans délai ; vous pouvez alors annuler la réservation sans frais.",
            "La composition des frais de service figure dans [Frais de service](https://mybestdays.dk/rechtliches/servicegebuehren). Sur les taxes et redevances, voir la [Politique fiscale](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Paiement",
          paragraphs: [
            "Les paiements via la plateforme sont traités par le prestataire de services de paiement Stripe. Les données de paiement (par exemple les données de carte) sont collectées et traitées directement par Stripe ; myBestDays ne conserve aucune donnée de carte complète.",
            "Le moment auquel chaque montant est exigible — acompte, solde ou paiement sur place — dépend de l'annonce et est affiché avant la finalisation de la réservation. Les détails sont régis par les [Conditions de paiement](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Lorsqu'une caution est indiquée dans l'annonce, elle peut être préautorisée ou prélevée et retenue en tout ou partie en cas de dommage ; les indications de l'annonce font foi.",
            "En cas d'échec ou de rétrofacturation d'un paiement, la réservation peut être annulée. Le fournisseur peut continuer à réclamer les montants nés de ses conditions d'annulation.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Politiques",
          paragraphs: [
            "Outre les présentes conditions s'appliquent les politiques suivantes, qui font partie du contrat entre vous et nous :",
          ],
          list: [
            "[Règles relatives aux contenus appropriés](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Politique relative aux avis](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Politique de non-discrimination](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Règles de base pour les voyageurs](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Conditions d'annulation](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Politique de relogement et de remboursement](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Politique en cas de perturbations graves](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Politique en matière de droit d'auteur](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Protection des données et cookies",
          paragraphs: [
            "La manière dont nous traitons les données à caractère personnel figure dans la [Politique de confidentialité](https://mybestdays.dk/rechtliches/datenschutz). Les cookies et technologies similaires que nous utilisons figurent dans la [Politique relative aux cookies](https://mybestdays.dk/rechtliches/cookies).",
            "Pour une réservation, nous transmettons au fournisseur les données dont il a besoin pour fournir la prestation d'hébergement. Le fournisseur en est responsable de traitement autonome ; les [Normes de protection des données pour les hôtes](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber) lui sont applicables.",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Accessibilité",
          paragraphs: [
            "L'état de l'accessibilité de la plateforme et la manière de signaler des obstacles sont décrits dans la [Déclaration d'accessibilité](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Les informations relatives à l'accessibilité d'un hébergement proviennent du fournisseur. Si vous dépendez de caractéristiques déterminées, clarifiez-les avec le fournisseur via la messagerie avant de réserver.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Avis et contenus générés par les utilisateurs",
          paragraphs: [
            "Après le séjour, vous pouvez déposer un avis. Seule peut déposer un avis la personne qui a réservé via la plateforme et dont le séjour a commencé ou aurait pu commencer — nous garantissons ainsi que les avis publiés émanent de voyageurs réels.",
            "Nous ne rémunérons pas les avis, n'en modifions pas le contenu et ne supprimons pas un avis au seul motif qu'il est négatif. Les détails et les motifs pour lesquels nous supprimons un avis figurent dans la [Politique relative aux avis](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "Vous restez responsable des contenus que vous publiez — avis, photos, messages, informations de profil. Vous nous concédez un droit non exclusif, sans limitation géographique ni temporelle et à titre gratuit, de reproduire, adapter (par exemple recadrer, traduire) et communiquer au public ces contenus dans le cadre de l'exploitation et de la promotion de la plateforme. Vous pouvez supprimer vos contenus ; les utilisations déjà effectuées dans des compilations déjà publiées ne sont pas affectées.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Messages et communication avec le fournisseur",
          paragraphs: [
            "Les messages entre vous et le fournisseur transitent par la plateforme. Nous mettons la messagerie à disposition, mais nous ne sommes ni expéditeur ni destinataire des contenus.",
            "Nous pouvons contrôler les messages de manière automatisée au regard des violations des présentes conditions (par exemple coordonnées visant à contourner la plateforme, schémas de fraude, contenus illicites) et retenir ou supprimer les messages concernés. Nous vous informons de toute suppression avec un exposé des motifs conformément à A17.",
            "Nous vous envoyons des messages relatifs à votre réservation (confirmation, modifications, informations d'arrivée) à l'adresse électronique indiquée. Ces messages relèvent de la communication contractuelle et ne peuvent être désabonnés tant que la réservation existe. Vous ne recevez de messages publicitaires que dans la mesure où vous y avez consenti ou lorsque le droit l'autorise sans consentement ; vous pouvez vous y opposer à tout moment.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Droits de propriété intellectuelle",
          paragraphs: [
            "La plateforme, sa conception, ses logiciels, bases de données, textes et marques sont protégés. Vous obtenez un droit non exclusif et non transférable d'utiliser la plateforme pour rechercher et réserver des hébergements — rien de plus.",
            "L'utilisation de nos marques et logos est régie par les [Règles relatives aux marques](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Si vous estimez que des contenus de la plateforme portent atteinte à votre droit d'auteur, suivez la [Politique en matière de droit d'auteur](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Que faire en cas de problème",
          paragraphs: [
            "Si le problème concerne l'hébergement lui-même, adressez-vous d'abord au fournisseur — via la messagerie ou sur place. De nombreux problèmes se règlent ainsi le plus rapidement.",
            "Si vous n'avancez pas avec le fournisseur, ou si le problème concerne la plateforme, le paiement ou le traitement de la réservation, adressez-vous à nous. Nos coordonnées et notre traitement des réclamations figurent sous [Réclamations et règlement des litiges](https://mybestdays.dk/rechtliches/beschwerden).",
            "Tenez à disposition : votre numéro de réservation, l'adresse électronique de la réservation, une brève description du problème avec votre souhait quant à notre intervention, et les justificatifs correspondants (photos, messages, reçus).",
            "Si l'hébergement n'est pas disponible à l'arrivée ou s'écarte substantiellement de l'annonce, la [Politique de relogement et de remboursement](https://mybestdays.dk/rechtliches/rueckerstattung) s'applique.",
            "La plateforme de règlement en ligne des litiges de la Commission européenne (plateforme RLL) a été abrogée par le règlement (UE) 2024/3228 et a cessé son activité ; elle n'est plus disponible comme voie de recours. Les instances qui la remplacent figurent sous [Réclamations et règlement des litiges](https://mybestdays.dk/rechtliches/beschwerden).",
            "Si nous avons pris une mesure à l'encontre de vos contenus ou de votre compte, vous pouvez, en plus de notre procédure interne de réclamation, saisir un organe de règlement extrajudiciaire des litiges certifié au titre de l'article 21 du règlement (UE) 2022/2065. Ses décisions ne nous lient pas.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Mesures contre les comportements inappropriés",
          paragraphs: [
            "Si vous enfreignez les présentes conditions ou l'une des politiques mentionnées en A9, nous pouvons — de manière graduée selon la gravité, la fréquence et les effets de la violation — supprimer des contenus ou en restreindre la visibilité, bloquer des fonctionnalités, annuler des réservations ou suspendre votre compte temporairement ou définitivement.",
            "Avant toute mesure, nous examinons le cas individuel. En présence de contenus manifestement illicites, d'un danger pour des personnes ou d'une fraude, nous pouvons agir immédiatement.",
            "Nous motivons chaque mesure à votre égard et vous indiquons la voie de réclamation — voir A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Signalement de contenus illicites et motivation des mesures",
          paragraphs: [
            "Toute personne peut nous signaler des contenus qu'elle estime illicites. La procédure de signalement au titre de l'article 16 du règlement (UE) 2022/2065, nos points de contact et le traitement des signalements sont décrits sous [Règlement sur les services numériques](https://mybestdays.dk/rechtliches/dsa).",
            "Si nous prenons une mesure à l'encontre de contenus que vous avez publiés ou de votre compte, vous recevez un exposé des motifs indiquant le motif, les faits sur lesquels il repose, le fondement juridique ou la stipulation contractuelle enfreinte ainsi que les possibilités de réclamation.",
            "Vous pouvez contester toute mesure gratuitement dans un délai de six mois. Les réclamations sont traitées par des personnes, non uniquement de manière automatisée.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Limitation de responsabilité",
          paragraphs: [
            "Nous répondons sans limitation du dol et de la faute lourde, des dommages résultant d'une atteinte à la vie, à l'intégrité physique ou à la santé, ainsi que dans la limite d'une garantie que nous aurions consentie. Les actions fondées sur la responsabilité du fait des produits ne sont pas affectées.",
            "Pour le surplus, notre responsabilité est limitée au dommage prévisible résultant typiquement de la violation des obligations dont vous pouvez attendre l'exécution — et uniquement dans la mesure où le droit applicable admet une telle limitation.",
            "Nous ne répondons pas de l'exécution de la prestation d'hébergement elle-même ni du comportement des fournisseurs ou d'autres voyageurs. Le cocontractant de la prestation d'hébergement est le fournisseur.",
            "Nous ne répondons pas de l'exactitude des indications publiées par les fournisseurs, dans la mesure où nous n'en avions pas connaissance et ne devions pas en avoir connaissance. Dès que nous avons connaissance d'une indication illicite, nous agissons sans délai.",
            "Toute responsabilité plus étendue est exclue. Les droits légaux impératifs, notamment les droits des consommateurs, ne sont pas affectés.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Droit applicable et juridiction compétente",
          paragraphs: [
            "Le droit danois est applicable — l'exploitant est établi au Danemark — à l'exclusion de la Convention des Nations unies sur les contrats de vente internationale de marchandises. Les dispositions impératives de protection des consommateurs de l'État dans lequel vous avez votre résidence habituelle demeurent applicables en vertu de l'article 6 du règlement (CE) n° 593/2008 (Rome I).",
            "En tant que consommateur, vous pouvez nous assigner devant le tribunal de votre domicile ou devant celui de notre siège au Danemark ; nous ne pouvons vous assigner que devant le tribunal de votre domicile (articles 17 à 19 du règlement (UE) n° 1215/2012).",
            "Le contrat d'hébergement est en règle générale régi par le droit de l'État où se situe l'hébergement ; les juridictions de cet État sont exclusivement compétentes pour les actions en matière de baux d'immeubles.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Prestations de voyage liées",
          paragraphs: [
            "myBestDays met exclusivement en relation pour des prestations d'hébergement. Nous ne proposons ni vols, ni location de voitures, ni prestations de transport, ni excursions ou attractions et ne composons pas de forfaits au sens de la directive (UE) 2015/2302.",
            "Si nous devions à l'avenir proposer d'autres services de voyage, nous vous informerions avant la réservation, au moyen du formulaire standard légalement prescrit, de la constitution éventuelle d'un forfait ou d'une prestation de voyage liée et des droits qui en découlent pour vous.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Durée, suspension et résiliation",
          paragraphs: [
            "Le contrat d'utilisation de la plateforme est conclu pour une durée indéterminée. Vous pouvez supprimer votre compte à tout moment sans motif ; les réservations existantes ne sont pas affectées et sont exécutées selon les conditions du fournisseur concerné.",
            "Nous pouvons résilier le contrat d'utilisation moyennant un préavis de 14 jours. En cas de violation grave des présentes conditions, nous pouvons résilier sans préavis et suspendre le compte.",
            "Après la fin du contrat, nous supprimons vos données, sauf obligation légale de conservation ou intérêt légitime à leur conservation ; les détails figurent dans la [Politique de confidentialité](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Clause de modification",
          paragraphs: [
            "Nous pouvons modifier les présentes conditions lorsqu'un motif objectif le justifie — par exemple une évolution du droit, une jurisprudence des juridictions suprêmes, des fonctionnalités nouvelles ou supprimées de la plateforme ou le comblement d'une lacune.",
            "Nous annonçons les modifications au moins 30 jours avant leur entrée en vigueur sous forme de texte. À défaut d'opposition de votre part avant l'entrée en vigueur, les conditions modifiées sont réputées acceptées ; nous attirons spécialement votre attention sur cet effet dans l'annonce. En cas d'opposition, nous pouvons résilier le contrat d'utilisation à la date d'entrée en vigueur.",
            "Pour les réservations déjà conclues, les conditions dans leur version applicable au moment de la réservation demeurent en vigueur.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Hébergements",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Champ d'application de la présente section",
          paragraphs: [
            "La présente section s'applique à la réservation d'hébergements via la plateforme — biens de vacances ainsi que chambres et unités d'établissements d'hébergement.",
            "Elle complète la section A. En cas de contradiction, la présente section B prévaut.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Relation contractuelle",
          paragraphs: [
            "Le contrat d'hébergement est conclu exclusivement entre vous et le fournisseur. myBestDays n'est pas partie au contrat.",
            "La présentation d'un hébergement sur la plateforme constitue une invitation à nous adresser une offre de réservation. En cliquant sur le bouton de réservation avec obligation de paiement, vous formulez une offre ferme.",
            "Le contrat est conclu lorsque la réservation est confirmée. Nous envoyons la confirmation de réservation à l'adresse électronique que vous avez indiquée ; elle mentionne le fournisseur, la prestation réservée, la période, le prix total et les conditions d'annulation.",
            "Pour les hébergements à réservation sur demande, le contrat n'est conclu qu'à l'acceptation par le fournisseur. Jusque-là, votre moyen de paiement peut être préautorisé mais non débité.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Ce que nous faisons",
          paragraphs: [
            "Nous mettons la plateforme à disposition, affichons les annonces des fournisseurs, recevons votre réservation, la transmettons au fournisseur et vous adressons la confirmation de réservation.",
            "Nous traitons le paiement dans la mesure où l'annonce prévoit un paiement via la plateforme, et mettons à disposition la messagerie entre vous et le fournisseur.",
            "Nous ne mettons pas l'hébergement à disposition, ne l'exploitons pas et ne garantissons pas son état. Nous ne sommes pas votre organisateur de voyages.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Ce que vous devez faire",
          paragraphs: [
            "Avant de réserver, examinez l'annonce dans son intégralité : équipements, limite d'occupation, horaires d'arrivée et de départ, règlement intérieur, conditions d'annulation et frais dus seulement sur place.",
            "Respectez l'occupation maximale indiquée dans l'annonce. Si plus de personnes se présentent que ce qui a été réservé, le fournisseur peut refuser l'accès ou exiger un supplément.",
            "Respectez le règlement intérieur du fournisseur et les [Règles de base pour les voyageurs](https://mybestdays.dk/rechtliches/grundregeln-gaeste). Vous prenez soin de l'hébergement et répondez des dommages que vous ou vos compagnons de voyage causez.",
            "Si le fournisseur ou une autorité a besoin d'informations pour l'enregistrement (par exemple fiche de police, données d'identité, déclaration de taxe de séjour), fournissez-les en temps utile.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Prix et paiement",
          paragraphs: [
            "Le prix total comprend le prix des nuitées pour la période réservée et les suppléments et frais indiqués dans l'annonce qui sont réglés via la plateforme.",
            "Des montants supplémentaires peuvent être dus sur place — notamment la taxe de séjour ou des redevances locales, une caution ainsi que des prestations complémentaires que vous réservez seulement sur place. Nous les indiquons comme frais sur place avant la finalisation de la réservation, dans la mesure où le fournisseur les a renseignés.",
            "Si l'annonce prévoit un acompte, le solde est exigible à la date mentionnée dans l'annonce. À défaut de règlement du solde, le fournisseur peut se retirer du contrat conformément à ses conditions d'annulation.",
            "Nous n'acceptons pas et ne pouvons pas retracer les paiements effectués au fournisseur en dehors de la plateforme ; ils ne relèvent pas de notre traitement des paiements — voir [Frais en dehors de la plateforme](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Modifications, annulations et remboursements",
          paragraphs: [
            "La possibilité d'annuler ou de modifier une réservation sans frais et les conditions applicables dépendent des conditions d'annulation du fournisseur indiquées dans l'annonce. Les conditions que nous proposons aux fournisseurs sont décrites sous [Conditions d'annulation](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "Pour les prestations d'hébergement réservées pour une période déterminée, il n'existe en règle générale pas de droit de rétractation légal au titre de l'article 16, point l), de la directive 2011/83/UE ou des dispositions nationales correspondantes. Les droits légaux impératifs ne sont pas affectés.",
            "Si le fournisseur annule, nous remboursons intégralement le montant réglé via la plateforme. S'y ajoute la [Politique de relogement et de remboursement](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Si un événement échappant au contrôle des deux parties empêche le voyage ou le séjour, la [Politique en cas de perturbations graves](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen) s'applique.",
            "Les remboursements sont effectués sur le moyen de paiement utilisé, sauf convention contraire.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Ce que vous devez savoir par ailleurs",
          paragraphs: [
            "Les fournisseurs peuvent être des hôtes particuliers ou des professionnels. Nous indiquons dans l'annonce si un fournisseur agit en qualité de professionnel. S'il ne s'agit pas d'un professionnel, les dispositions de l'Union en matière de protection des consommateurs ne s'appliquent pas au contrat d'hébergement — nous attirons votre attention sur ce point dans l'annonce.",
            "Les indications relatives à la situation, aux environs, aux distances et aux évaluations de tiers sont fournies à titre indicatif. Seules les indications relatives à la prestation réservée elle-même sont contraignantes.",
            "Dans les zones soumises à obligation d'enregistrement pour la location de courte durée, nous indiquons dans l'annonce le numéro d'enregistrement communiqué par le fournisseur ; voir [Location de courte durée](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Lorsqu'il existe plusieurs unités identiques d'un type de bien ou de chambre, vous réservez une unité de ce type. Le fournisseur détermine l'unité concrète qui vous est attribuée.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Lexique",
      paragraphs: [
        "Les termes suivants ont, dans les présentes conditions, la signification indiquée ci-après.",
      ],
      definitions: [
        {
          term: "Fournisseur",
          description:
            "La personne physique ou morale qui propose un hébergement via la plateforme et devient cocontractant du contrat d'hébergement.",
        },
        {
          term: "Réservation sur demande",
          description:
            "Une réservation qui n'est conclue qu'après acceptation expresse par le fournisseur, par opposition à une réservation instantanée.",
        },
        {
          term: "Confirmation de réservation",
          description:
            "Le message par lequel nous vous confirmons la conclusion du contrat d'hébergement ; il indique le fournisseur, la prestation, la période, le prix total et les conditions d'annulation.",
        },
        {
          term: "Unité",
          description:
            "L'objet concret réservable relevant d'un type de bien ou de chambre. C'est l'unité qui est vendue, le type qui est décrit et tarifé.",
        },
        {
          term: "Prix total",
          description:
            "Le montant affiché au moment de finaliser la réservation, incluant toutes les taxes et tous les frais réglés via la plateforme.",
        },
        {
          term: "Occupation maximale",
          description:
            "Le nombre maximal de personnes autorisées à passer la nuit dans l'hébergement, tel qu'indiqué dans l'annonce.",
        },
        {
          term: "Caution",
          description:
            "Un montant exigé par le fournisseur à titre de garantie des dommages, préautorisé ou prélevé puis libéré ou compensé après le séjour.",
        },
        {
          term: "Taxe de séjour",
          description:
            "Une redevance locale sur les nuitées, perçue selon la commune sur place ou par l'intermédiaire du fournisseur ; elle n'est pas une prestation de myBestDays.",
        },
        {
          term: "Plateforme",
          description:
            "Le site web, les applications mobiles et tous autres accès par lesquels myBestDays affiche des hébergements et met en relation pour des réservations.",
        },
        {
          term: "Frais de service",
          description:
            "La rémunération de la prestation d'intermédiation de myBestDays. Qui les supporte et comment ils sont indiqués figure sous Frais de service.",
        },
        {
          term: "Conditions d'annulation",
          description:
            "Les règles choisies par le fournisseur quant au délai et au coût d'annulation ou de modification d'une réservation.",
        },
        {
          term: "Hébergement",
          description:
            "La prestation d'hébergement proposée par le fournisseur — un bien de vacances ou une unité d'un type de chambre ou de bien.",
        },
        {
          term: "Frais sur place",
          description:
            "Les montants qui ne sont pas réglés via la plateforme mais dus au fournisseur, tels que taxe de séjour, caution ou prestations complémentaires réservées sur place.",
        },
      ],
    },
  ],
};
