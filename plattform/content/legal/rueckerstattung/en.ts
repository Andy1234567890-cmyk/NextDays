import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Rebooking and Refund Policy",
  stand: "Last updated: 18 August 2026",
  intro: [
    "This policy applies where something is fundamentally wrong with accommodation booked via myBestDays — it is therefore the commitment that goes beyond the provider's cancellation term.",
    "It applies to bookings concluded and paid via the Platform.",
  ],
  sections: [
    {
      id: "wann",
      heading: "1. When this policy applies",
      paragraphs: [
        "It applies where one of the following occurs before or during the stay:",
      ],
      list: [
        "The provider cancels the booking.",
        "The provider is unreachable on arrival or you cannot gain access to the accommodation.",
        "The accommodation is uninhabitable — for example lacking heating in cold weather, lacking running water, insufficiently clean, or posing a health risk.",
        "The accommodation differs materially from the listing — a different number of beds or rooms, a different location, or central amenities promised in the listing that are in fact missing.",
        "Another guest who was not announced is present in the accommodation.",
      ],
    },
    {
      id: "was-sie-tun",
      heading: "2. What you must do",
      paragraphs: [
        "Report the problem as early as possible, and no later than 24 hours after discovering it — for problems on arrival, therefore, on the day of arrival.",
        "Report it to the provider first through the messaging function and give it the opportunity to remedy the problem. This obligation does not apply where there is a risk to your health or the provider is unreachable.",
        "Evidence the problem where possible with photos, videos or messages. Without evidence we are often unable to establish the facts.",
      ],
    },
    {
      id: "was-wir-tun",
      heading: "3. What we do",
      paragraphs: [
        "If the problem is confirmed, you may choose between comparable replacement accommodation and a refund.",
        "If you choose replacement accommodation, we cover the additional cost compared with your original booking, provided the replacement is comparable in location, amenities and size.",
        "If you choose a refund, we refund the full amount paid via the Platform where the problem arises before arrival. Where the problem arises during the stay, we refund the share for the nights that cannot be used plus a reasonable amount for the impairment of the nights already spent.",
        "We inform you of our decision with reasons. You may have it reviewed via the route under [Complaints and dispute resolution](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "4. What is not covered",
      paragraphs: ["This policy does not apply to:"],
      list: [
        "circumstances described in the listing or apparent from the photos;",
        "minor deviations that do not impair use (such as a different wall colour or a different sofa);",
        "temporary faults that the provider remedies within a reasonable time;",
        "circumstances outside the accommodation over which the provider has no influence — weather, traffic, municipal roadworks, closure of attractions (for these the [Major Disruptive Events Policy](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen) applies);",
        "problems caused by you or your fellow travellers;",
        "bookings concluded or paid outside the Platform.",
      ],
    },
    {
      id: "verhaeltnis",
      heading: "5. Relationship to your statutory rights",
      paragraphs: [
        "This policy is a voluntary commitment by myBestDays. Your statutory claims against the provider — in particular price reduction and damages — are unaffected and may go further.",
        "To the extent that we refund you, corresponding claims against the provider pass to us.",
      ],
    },
  ],
};
