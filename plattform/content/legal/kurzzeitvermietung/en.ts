import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Short-term rental and registration requirements",
  stand: "Last updated: 18 August 2026",
  intro: [
    "In many cities and regions the short-term letting of residential property requires a permit, registration or notification. This page explains what that means for providers and for guests.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Legal framework",
      paragraphs: [
        "Regulation (EU) 2024/1028 on data collection and sharing relating to short-term accommodation rental services creates a uniform framework: where a Member State or a local authority has introduced a registration procedure, each unit receives a registration number.",
        "Platforms must display that number, verify its validity on a random basis and transmit data on the activity to the competent authorities at regular intervals.",
        "National and local rules continue to apply in addition — for example on change of use of residential property, maximum letting days, fire safety and guest registration.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. What providers must do",
      paragraphs: [
        "Before publishing, check whether a registration, permit or notification requirement applies to your accommodation, and comply with it.",
        "Enter the registration number in the property record where one exists. We display it in the listing.",
        "Observe maximum letting days and other local limits. Monitoring them is your task, not ours.",
        "We may not permanently display a listing without the required registration number. If it is missing or proves invalid we will request it; if it is not supplied we deactivate the listing.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. What this means for guests",
      paragraphs: [
        "Where a registration requirement applies to an accommodation, you will see the registration number in the listing. It indicates that the letting has been notified to the competent authority.",
        "Registration may be required at the destination (registration form, identity data, tourist tax declaration). The provider will request the necessary information; please supply it in good time.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Transmission of data to authorities",
      paragraphs: [
        "Where Regulation (EU) 2024/1028 or national law so provides, we transmit data on letting activity to the competent authorities — in particular the registration number, the address of the unit, the number of nights occupied and the number of guests.",
        "That transmission is made to comply with a legal obligation under Article 6(1)(c) of Regulation (EU) 2016/679. Details are set out in the [Privacy Policy](https://mybestdays.dk/rechtliches/datenschutz).",
        "Separately from this, the tax reporting obligation under DAC7 applies; see [Tax Policy](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Reporting breaches",
      paragraphs: [
        "If you have indications that an accommodation is offered without the required permit or registration, report it to us using the reporting function on the listing. We follow up every report.",
      ],
    },
  ],
};
