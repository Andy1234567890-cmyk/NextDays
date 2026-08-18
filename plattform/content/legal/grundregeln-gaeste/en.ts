import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Ground Rules for Guests",
  stand: "Last updated: 18 August 2026",
  intro: [
    "These ground rules apply to every stay booked via myBestDays. They supplement the respective provider's house rules — where the house rules are stricter, they apply in addition.",
    "Anyone breaching the ground rules must expect measures up to suspension of the account and is liable to the provider for any damage caused.",
  ],
  sections: [
    {
      id: "belegung",
      heading: "1. Occupancy",
      paragraphs: [
        "Only the persons stated at the time of booking may stay overnight in the accommodation, and no more than the maximum occupancy permits.",
        "Visitors who do not stay overnight are permitted unless the house rules provide otherwise.",
        "The accommodation may not be sublet or passed on.",
      ],
    },
    {
      id: "ruhe",
      heading: "2. Consideration and quiet hours",
      paragraphs: [
        "Be considerate of neighbours. Observe the quiet hours stated in the house rules; where none are stated, local night-time quiet hours apply.",
        "Parties and events are not permitted without the provider's express permission. This applies even where the maximum occupancy is observed.",
        "Commercial use of the accommodation — for example photo or film production, sales events — requires the provider's prior consent.",
      ],
    },
    {
      id: "umgang",
      heading: "3. Treatment of the accommodation",
      paragraphs: [
        "Treat the accommodation and its furnishings with care and leave it in an orderly condition.",
        "Report damage and faults to the provider without delay — not only after departure. Only then can the provider remedy them and only then do you retain your claims.",
        "You are liable for damage caused by you or your fellow travellers. Where a security deposit has been agreed, it may be drawn upon for that purpose.",
      ],
    },
    {
      id: "sicherheit",
      heading: "4. Safety",
      paragraphs: [
        "Keep smoke detectors, fire extinguishers and escape routes clear and functional. Smoke detectors must not be taped over or removed.",
        "Smoking is permitted only where the house rules expressly allow it, and only in the areas designated for it.",
        "For pools, saunas, fireplaces, barbecues or hot tubs, follow the provider's instructions. Children may use such facilities only under supervision.",
      ],
    },
    {
      id: "tiere",
      heading: "5. Animals",
      paragraphs: [
        "You may bring animals only where the listing permits it and you stated them at the time of booking.",
        "Assistance and guide dogs are always permitted, even where the listing excludes animals. Please announce them so that the provider can prepare.",
      ],
    },
    {
      id: "anreise",
      heading: "6. Arrival and departure",
      paragraphs: [
        "Observe the arrival and departure times stated in the listing. If you need different times, agree them with the provider in advance.",
        "Provide the information the provider needs for registration (registration form, identity data, tourist tax) in good time.",
        "Do not pass access data, key codes or keys to third parties.",
      ],
    },
    {
      id: "kommunikation",
      heading: "7. Communication",
      paragraphs: [
        "Conduct booking, payment and arrangements via the Platform. Only then are they documented and only then can we help in the event of a dispute.",
        "Remain factual towards the provider and our team. Insults and threats lead directly to measures against the account.",
      ],
    },
  ],
};
