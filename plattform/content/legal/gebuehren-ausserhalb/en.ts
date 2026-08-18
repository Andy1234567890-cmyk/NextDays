import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Fees outside the Platform",
  stand: "Last updated: 18 August 2026",
  intro: [
    "This policy governs which amounts a provider may charge outside the Platform and which it may not. It protects guests from being confronted on site with demands that were not in the listing.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principle",
      paragraphs: [
        "Everything payable for the service booked must be disclosed in the listing before the booking is completed — either as part of the total price or as an on-site cost item.",
        "An amount disclosed neither in the total price nor as an on-site cost is not owed by the guest.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. What may be charged on site",
      paragraphs: ["Only the following may be charged on site:"],
      list: [
        "amounts expressly disclosed in the listing as on-site costs (for example final cleaning, linen package, parking space);",
        "local levies such as tourist tax, to the extent local rules require payment on site;",
        "a security deposit disclosed in the listing;",
        "services the guest books voluntarily on site, at a price stated in advance;",
        "compensation for substantiated damage caused by the guest.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. What may not be charged",
      paragraphs: ["The following in particular are not permitted:"],
      list: [
        "an additional demand on the accommodation price after the booking has been completed;",
        "a fee for the fact that the booking was made via myBestDays;",
        "a handling, booking or card fee not disclosed in the listing;",
        "a request to cancel the booking and rebook the same accommodation outside the Platform;",
        "a request to pay the price or part of it by transfer, cash or a payment service outside the Platform where the listing provides for payment via the Platform.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Circumventing the Platform",
      paragraphs: [
        "Where contact between guest and provider was made via the Platform, the booking may not be settled outside it. This applies to both sides.",
        "Anyone circumventing the Platform loses its protection: payments are not secured, our cancellation and refund policies do not apply, and we cannot mediate in a dispute.",
        "Breaches may lead to suspension of the account. In the case of providers we may also claim the service fee lost.",
      ],
    },
    {
      id: "melden",
      heading: "5. Reporting",
      paragraphs: [
        "If an amount not stated in the listing is demanded from you on site, do not pay it and report it to us via the contact routes under [Complaints and dispute resolution](https://mybestdays.dk/rechtliches/beschwerden). If you have already paid, we will help you recover it.",
      ],
    },
  ],
};
