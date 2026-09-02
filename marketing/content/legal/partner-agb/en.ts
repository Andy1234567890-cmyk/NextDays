// Partner terms (affiliate programme, 0517/0520) — DRAFT. English rendering of
// de.ts; the German version is the source. Not reviewed by counsel yet (see
// intro). Other locales fall back to this file until the reviewed text exists.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "Terms of the myNextDays partner programme: attribution, commission basis, tiers, team commission, prohibited practices, disclosure, payout.",
  numbered: false,
  toc: true,
  title: "Partner Programme Terms (Partner Terms) — Draft",
  standIso: "2026-09-02",
  intro: [
    "DRAFT — These terms are a working version by myNextDays and have not yet been reviewed by counsel. Until the reviewed version is released they describe the programme; they are not the final contractual text. The reviewed version will be published at this address with a new version number, and partners will be asked to accept it again at their next login.",
    `These terms govern participation in the partner (affiliate) programme of ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Denmark, CVR no. ${ANBIETER.cvr} ("myNextDays", "we") by partners ("Partner").`,
    "The programme is open to persons and companies established in the EU, Switzerland or the United Kingdom who recommend myNextDays to businesses (hosts, agencies, hotels).",
  ],
  sections: [
    {
      heading: "§ 1 Participation and approval",
      paragraphs: [
        "Participation requires an application through the partner dashboard. Mandatory details are name or company, legal form, country, at least one social media account with address, handle and reach, and for companies the VAT identification number.",
        "myNextDays reviews every application personally and decides freely on approval. There is no right to admission. Participation is free of charge; a myNextDays subscription is not required.",
        "The Partner keeps their details current, in particular channels, legal form, tax and payout data.",
        "The stated reach is initially self-reported. The Partner may voluntarily connect their YouTube, Instagram, Facebook and TikTok accounts; followers and views are then read from the platform and shown as verified. Unverified reach carries less weight at approval and in later reviews. The connection can be removed in the dashboard at any time; details of the processing are set out in the privacy policy.",
      ],
    },
    {
      heading: "§ 2 Attribution of businesses",
      paragraphs: [
        "A business is attributed to the Partner when it registers with the Partner's referral code. The code is shown to the business visibly during registration and confirmed by submitting the form. No tracking cookies are set.",
        "A business is attributed to exactly one Partner; the code confirmed at registration is decisive. A later reassignment is made only by myNextDays in case of a proven error.",
        "Businesses of the Partner, its shareholders, employees or relatives, and businesses that are or were customers of myNextDays, are not attributed.",
      ],
    },
    {
      heading: "§ 3 Commission on own customers",
      paragraphs: [
        "The commission basis is the net subscription revenue of the attributed business (base plan and modules) from paid invoices — excluding VAT, portal commissions, add-on services, re-billing and other pass-through items.",
        "The commission rate depends on the Partner's tier at the time of payment. Tiers and rates are published on the programme page. The tier is determined by the number of paying customers in the Partner's structure: the Partner's own paying customers plus the paying customers of their team partners (§ 4), each customer counted once. The tier is assessed monthly on the reference date; a promotion applies immediately, a demotion only after the number has been below the threshold on two consecutive reference dates.",
        "When the Partner first reaches a tier from \"Aufsteiger\" upwards, they receive once the promotion bonus stated for that tier on the programme page (currently EUR 50.00 per tier, in euros for all Partners). Each tier is rewarded only once, also after demotion and renewed promotion. The bonus is subject to the refund window under § 7.",
        "Commission accrues per business for twelve months from its first chargeable subscription invoice; a free trial and a free month granted via the Partner do not count. If the subscription ends earlier, commission ends with the last paid invoice.",
        "From the \"Elite-Partner\" tier, the Partner additionally receives a super commission at the rate stated on the programme page (currently 2.5 %) on the net subscription revenue of all customers in their structure — own customers and customers of their team partners — without the twelve-month limit, for as long as the respective customer holds a paying subscription and the Partner holds the tier at the time of payment. It accrues in addition to the commission under sentence 2 and § 4.",
        "For every booking received and paid via myBestDays for a business attributed to the Partner or to one of their team partners, the Partner receives a booking share at the rate stated on the programme page (currently 0.5 %) of the booking amount paid by the guest, in the booking currency, without time limit for as long as the attribution exists. Security deposits are not a booking amount. Refunds to the guest reverse the share proportionally (§ 7).",
      ],
    },
    {
      heading: "§ 4 Team commission",
      paragraphs: [
        "From the \"Aufsteiger\" tier, a Partner may lead team partners. If another partner applies via the Partner's team link and visibly confirms the Partner's code in their application, they are assigned to the Partner's team (the Partner then being the \"Sponsor\") after approval. If the Sponsor does not hold that tier at the time of the application, the application remains valid but no team assignment is made.",
        "The Sponsor receives a team commission on the net subscription revenue of the customers of their team partners equal to the difference between the Sponsor's own commission rate and the team partner's commission rate, each according to the tier at the time of payment. If both hold the same tier, or the team partner a higher one, no team commission arises. The team partner's commission and the Sponsor's team commission together never exceed the highest rate of the scale (currently 30 %).",
        "The team commission is exactly one level deep: team partners receive no team commission on partners they recruit themselves. No payment is made for recruiting a partner; no participation fee is charged. Team commission arises exclusively from paid subscription revenue.",
        "Team commission runs per team customer for twelve months from their first paid invoice, is subject to the same refund window and is reversed proportionally on refunds or chargebacks (§ 7). It accrues only while both Sponsor and team partner are approved; otherwise it is held until clarified.",
        "The team assignment is made once. Changes are made only by myNextDays with a documented reason.",
      ],
    },
    {
      heading: "§ 5 Partner obligations and disclosure",
      paragraphs: [
        "The Partner labels every recommendation with their link or code as advertising — at the beginning of the post, in the language of the post, in line with the rules of their country (in Germany e.g. § 5a (4) UWG, in Denmark markedsføringsloven § 6 (4)). Wording per country is provided in the partner dashboard.",
        "The Partner makes only statements about myNextDays that match the published service descriptions and gives no commitments on behalf of myNextDays. In particular, success and guarantee claims (such as \"guaranteed full occupancy in three days\") and statements about earnings that do not follow from the published service descriptions are prohibited.",
        "Every video and every post that mentions myNextDays or carries the Partner's link is submitted as a file in the partner dashboard for review before publication. The Partner's link is created only after written approval by myNextDays; publication without approval is prohibited. myNextDays may revoke an approval; commission already accrued remains unaffected.",
        "For logos, screen recordings, B-roll, overlays and screenshots, the Partner uses exclusively the promotional material provided by myNextDays. Own, unreviewed software recordings are not permitted.",
      ],
    },
    {
      heading: "§ 6 Prohibited practices",
      paragraphs: ["The following in particular are prohibited:"],
      list: [
        "Brand bidding: paid ads on the brand \"myNextDays\", spelling variants and combinations (e.g. \"myNextDays pricing\") in search engines and networks;",
        "cookie dropping, hidden redirects, iframes, automated calls of the partner link or any other technical manipulation of attribution;",
        "self-referral: registering own businesses or those of shareholders, employees or relatives via the own code or a team partner's code;",
        "purchased reach (bought followers, click farms, bot traffic) and incentives to businesses for registering (rebates, gifts, sweepstakes);",
        "recruitment promises: recruiting partners with earnings claims not derived from paid subscription revenue, or presenting the programme as income from recruiting further partners;",
        "spam, unsolicited direct marketing and the use of third-party brands or content without rights.",
      ],
    },
    {
      heading: "§ 7 Refund window, reversal, withholding",
      paragraphs: [
        "Every commission line remains open for 30 days after it arises (refund window) and becomes payable thereafter. If an underlying invoice is refunded in whole or in part or charged back, the commission — including any team commission based on it — is reversed proportionally, also after payout by offsetting against future commissions.",
        "On suspicion of a breach of § 2, § 5 or § 6, myNextDays may hold attributions and commissions until clarified. If the breach is confirmed, the affected commissions lapse.",
      ],
    },
    {
      heading: "§ 8 Payout and self-billing credit note",
      paragraphs: [
        "Payable commissions are bundled monthly per currency and paid out once they reach the minimum amount of the respective currency stated on the programme page or in the dashboard. No currency conversion takes place.",
        "Settlement is by self-billing (momsloven § 52a): myNextDays issues a credit note per payout; the Partner does not issue an invoice. The Partner agrees to self-billing.",
        "Businesses receive the credit note with a reverse-charge note; a valid, verified VAT identification number is required. Private individuals receive the credit note without VAT and are responsible for taxing the commission themselves.",
        "Payout is made by SEPA transfer, Wise or PayPal to the details the Partner stores in the dashboard.",
      ],
    },
    {
      heading: "§ 9 Data and visibility",
      paragraphs: [
        "The Partner sees attributed businesses pseudonymously (number, country, status, amounts). Names, email addresses or booking data are not disclosed. A Sponsor sees of their team partners name or company, tier, number of paying customers and the resulting team commission — no customer details.",
        "For connected accounts and registered posts myNextDays sees followers, views, interactions as well as clicks and customers per post. Anomalies (such as a jump in followers without matching views or a marked deviation between self-reported and verified figures) are indications for a personal review under § 6 and § 10, not an automatic suspension.",
        "The processing of personal data in the partner programme is described in the privacy policy.",
      ],
    },
    {
      heading: "§ 10 Term, suspension and termination",
      paragraphs: [
        "Participation is open-ended and may be terminated by either side at any time in text form. Commissions already payable are paid out under § 8; no new commissions arise after termination.",
        "myNextDays may suspend the Partner for breaches of these terms. During suspension commissions are held; if the breach is confirmed they lapse.",
      ],
    },
    {
      heading: "§ 11 Changes",
      paragraphs: [
        "myNextDays may change these terms and the tiers with effect for the future. Changes are published in the partner dashboard and on this page with a version number; for material changes the Partner is asked to accept again. Commissions already accrued remain unaffected.",
      ],
    },
    {
      heading: "§ 12 Governing law",
      paragraphs: [
        "Danish law applies, excluding its conflict-of-laws rules. Mandatory consumer protection provisions of the state in which a private Partner has their habitual residence remain unaffected.",
      ],
    },
  ],
};
