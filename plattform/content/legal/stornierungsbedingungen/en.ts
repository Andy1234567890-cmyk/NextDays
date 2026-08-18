import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Cancellation Terms",
  stand: "Last updated: 18 August 2026",
  intro: [
    "Every provider selects a cancellation term for its accommodation. Which one applies is stated in the listing and in your booking confirmation. This page describes the terms we make available to providers.",
  ],
  sections: [
    {
      id: "modelle",
      heading: "1. The cancellation terms at a glance",
      paragraphs: [
        "The term stated in the listing always prevails. The deadlines relate to the start of the arrival day in the local time of the accommodation.",
      ],
      list: [
        "Flexible — free cancellation up to 24 hours before arrival. Thereafter the first night is charged and the remaining nights are refunded.",
        "Moderate — free cancellation up to 5 days before arrival. Thereafter 50 % of the accommodation price is charged.",
        "Strict — free cancellation up to 14 days before arrival, provided the booking was made at least 14 days before arrival. Thereafter 50 % is charged up to 7 days before arrival, and the full price after that.",
        "Non-refundable — no free cancellation. The price is generally lower; we draw your attention to the absence of a refund before booking.",
      ],
    },
    {
      id: "was-erstattet-wird",
      heading: "2. What is refunded in any event",
      paragraphs: [
        "Regardless of the term selected, we refund on any cancellation:",
      ],
      list: [
        "tourist tax and other pass-through levies, to the extent they were settled via the Platform and the stay does not take place;",
        "a security deposit collected via the Platform, in full;",
        "extras that were not supplied.",
      ],
    },
    {
      id: "stornierung-durch-anbieter",
      heading: "3. Cancellation by the provider",
      paragraphs: [
        "If the provider cancels, you receive back in full the amount paid via the Platform — regardless of the cancellation term selected.",
        "In addition we will support you in finding comparable accommodation; see [Rebooking and Refund Policy](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "widerruf",
      heading: "4. No statutory right of withdrawal",
      paragraphs: [
        "For accommodation services booked for a specific period there is generally no statutory right of withdrawal under Article 16(l) of Directive 2011/83/EU. The cancellation terms described here are therefore a contractual commitment, not the implementation of a right of withdrawal.",
        "Mandatory statutory rights, in particular warranty rights where the accommodation is defective, are unaffected.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Change instead of cancellation",
      paragraphs: [
        "If you wish to change the period or the number of travellers, request the change through your booking. The provider must agree; until then the original booking remains in place.",
        "If the change results in a higher price, the difference falls due. If it results in a lower price, we refund the difference to the extent the applicable cancellation term permits for the part that falls away.",
      ],
    },
    {
      id: "wie",
      heading: "6. How to cancel",
      paragraphs: [
        "Cancel via your account under “Bookings”. The time at which the cancellation reaches us determines whether the deadline is met.",
        "You receive a cancellation confirmation stating the refund amount. On payout see the [Payment Terms](https://mybestdays.dk/rechtliches/zahlungsbedingungen#rueckerstattungen).",
      ],
    },
  ],
};
