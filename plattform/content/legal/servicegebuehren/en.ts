import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Service fees",
  stand: "Last updated: 18 August 2026",
  intro: [
    "myBestDays is funded through a service fee on bookings it brokers. This page explains who pays it, how it is calculated and where it is disclosed.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Who pays the service fee",
      paragraphs: [
        "The service fee is borne by the provider. It is deducted from the booking value and reduces the payout to the provider; the guest does not pay it in addition.",
        "Where, exceptionally, a service fee is charged to the guest for a booking, we show it as a separate item in the total price before the booking is completed. Without that disclosure no fee is charged to the guest.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. How it is calculated",
      paragraphs: [
        "The service fee is a percentage of the booking value settled via the Platform. The rate applicable to your bookings is stated in your host account and in the agreement you accepted on registration.",
        "The basis of calculation is the accommodation price plus the surcharges settled via the Platform. Pass-through items that are not consideration for the provider's service — in particular tourist tax and the security deposit — are excluded.",
        "The service fee is calculated and disclosed in the currency of the listing.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. VAT",
      paragraphs: [
        "VAT is charged on the service fee where it is legally due. Whether it is shown or the reverse charge procedure applies depends on the provider's establishment and status.",
        "We issue the provider a statement for the service fee, which is available in its account.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Cancellation and refund",
      paragraphs: [
        "Where a booking is refunded in full, we refund the service fee pro rata to the extent the booking value is refunded.",
        "If the provider cancels without good cause, the service fee is not automatically waived; we reserve the right to claim the costs arising from the cancellation.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Changes to the service fee",
      paragraphs: [
        "We announce a change to the rate to providers at least 30 days before it takes effect on a durable medium; this corresponds to Article 3(2) of Regulation (EU) 2019/1150.",
        "For bookings already confirmed, the rate applicable at the time of booking continues to apply.",
      ],
    },
  ],
};
