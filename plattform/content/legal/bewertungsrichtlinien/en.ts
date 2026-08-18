import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Review Policy",
  stand: "Last updated: 18 August 2026",
  intro: [
    "Reviews are the most important independent source for guests. This policy sets out who may review, how we ensure that reviews come from actual guests, and when we remove a review.",
  ],
  sections: [
    {
      id: "echtheit",
      heading: "1. How we ensure authenticity",
      paragraphs: [
        "Only someone who booked the accommodation via myBestDays and whose stay has begun may submit a review. The review is technically tied to the specific booking.",
        "This satisfies the obligation under point 23b of Annex I to Directive 2005/29/EC to present as guest reviews only those for which we have taken reasonable steps to verify that they originate from actual guests.",
        "We do not buy reviews, do not commission any and do not post fake reviews. Nor do we tolerate providers doing so.",
      ],
    },
    {
      id: "frist",
      heading: "2. Deadline and publication",
      paragraphs: [
        "After departure you have 14 days to submit a review. The provider may submit a review about you within the same period.",
        "Both reviews are published simultaneously, once both are in or the deadline has expired. Neither side can therefore influence the other.",
        "You may withdraw a submitted review within the deadline. After publication it can no longer be changed; you can have it deleted.",
      ],
    },
    {
      id: "antwort",
      heading: "3. Provider response",
      paragraphs: [
        "The provider may respond publicly to a review. The same rules apply to the response as to the review itself.",
        "A response does not alter the review and does not affect the overall rating.",
      ],
    },
    {
      id: "entfernung",
      heading: "4. When we remove a review",
      paragraphs: [
        "We do not remove a review because it is negative or because the provider is unhappy with it. We remove it where it:",
      ],
      list: [
        "breaches the [Content Policy](https://mybestdays.dk/rechtliches/inhaltsrichtlinien);",
        "contains third-party personal data;",
        "evidently relates to a different accommodation or a different stay;",
        "essentially concerns circumstances beyond the control of both guest and provider (for example weather, municipal roadworks, traffic on arrival) — in that case we remove only the part concerned where it can be separated;",
        "evidently serves to extort, for example because it was linked to a demand;",
        "was obtained through incentives or submitted as part of a coordinated effort.",
      ],
    },
    {
      id: "anreize",
      heading: "5. Incentives are not permitted",
      paragraphs: [
        "Providers may not offer money, discounts, upgrades, gifts or other benefits for a review — nor for refraining from one.",
        "Providers may invite guests to review without influencing the rating. An invitation that asks for a review only in the event of a positive experience is not permitted.",
      ],
    },
    {
      id: "darstellung",
      heading: "6. How we present reviews",
      paragraphs: [
        "The overall rating is the unweighted average of all published reviews of an accommodation. We do not weight any review more heavily because it is more favourable.",
        "The default sorting shows the most recent reviews first. You can switch to other sortings; the active sorting is displayed.",
        "We state how many reviews an overall rating is based on. Where there are fewer than three reviews we show no overall rating, only the individual reviews.",
      ],
    },
    {
      id: "beschwerde",
      heading: "7. Complaining against a decision",
      paragraphs: [
        "If we remove your review or refuse to remove a review, we give reasons and inform you of the complaint route — see [Complaints and dispute resolution](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
  ],
};
