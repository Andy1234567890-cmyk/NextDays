import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Major Disruptive Events Policy",
  stand: "Last updated: 18 August 2026",
  intro: [
    "Sometimes an event prevents the journey or the stay for which neither the guest nor the provider is responsible. This policy describes which events those are and what then applies.",
    "It takes precedence over the cancellation term selected in the listing.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Which events are covered",
      paragraphs: [
        "Covered are events occurring after the booking, unforeseeable for both sides, that make the journey or the stay impossible or legally impermissible:",
      ],
      list: [
        "official travel or stay bans, curfews and border closures affecting the destination or the place of departure;",
        "natural disasters and natural events affecting the destination — earthquake, flood, storm, major fire, volcanic eruption;",
        "war, armed conflict, terrorist attacks and civil unrest at the destination;",
        "an officially declared epidemic or pandemic with measures prohibiting the stay;",
        "failure of the supply of electricity, water or heat at the destination over an extended period;",
        "complete loss of the ability to travel to the destination as a result of one of the foregoing events.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Which events are not covered",
      paragraphs: ["Not covered are in particular:"],
      list: [
        "illness or injury of the guest or their relatives — travel insurance is intended for that;",
        "professional commitments, examination dates or cancelled leave;",
        "cancellation of an event for which the trip was booked, provided the accommodation remains usable;",
        "weather that does not amount to a natural disaster — rain, cold, heat, lack of snow;",
        "the failure of individual means of transport, as long as reasonable travel remains possible;",
        "the cancellation of a flight or a strike at a transport undertaking — claims lie against the transport undertaking.",
      ],
    },
    {
      id: "folgen",
      heading: "3. What applies if a covered event occurs",
      paragraphs: [
        "Where the event affects the period of your booking, you may cancel free of charge. You receive a full refund of the amount paid via the Platform.",
        "If the stay has already begun, we refund the share for the nights that can no longer be used.",
        "The provider suffers no disadvantage in the assessment of its reliability as a result of such a cancellation.",
        "Alternatively you may agree a postponement with the provider; we will help with the rebooking.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. How to invoke this policy",
      paragraphs: [
        "Contact us via the routes under [Complaints and dispute resolution](https://mybestdays.dk/rechtliches/beschwerden), stating the booking number and the event.",
        "We assess the matter on the basis of publicly available sources — official orders, official warnings, reports from recognised news sources — and decide promptly.",
        "Where the situation cannot yet be assessed conclusively, we await developments until shortly before the arrival day and then decide. Your booking remains unchanged until then.",
      ],
    },
  ],
};
