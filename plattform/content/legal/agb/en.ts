import type { LegalDoc } from "../types";

// Englische Fassung (Brückensprache). Quelle ist content/legal/agb/de.ts.
export const agb: LegalDoc = {
  title: "Terms of Use for Guests",
  stand: "Last updated: 3 July 2026",
  intro: [
    "These Terms of Use govern the use of the myBestDays booking portal (the “Platform”) by travellers and bookers (the “Guest”).",
    "The Platform is operated by [full legal name, legal form, address and register details of the operating company — to be completed before publication] (“myBestDays”, “we”).",
  ],
  sections: [
    {
      heading: "§ 1 Scope",
      paragraphs: [
        "These terms apply to the use of the Platform, in particular to searching for accommodation and booking accommodation services via the Platform.",
        "The accommodation service itself is additionally governed by the terms of the respective provider (e.g. house rules, cancellation conditions) stated in the listing.",
      ],
    },
    {
      heading: "§ 2 Role of myBestDays; conclusion of contract",
      paragraphs: [
        "myBestDays acts as an intermediary for accommodation services offered by the respective providers (agencies, property managers or owners, the “Provider”). The contract for the accommodation is concluded exclusively between the Guest and the respective Provider. myBestDays does not become a party to the accommodation contract.",
        "The respective Provider is named in the listing and in the booking confirmation.",
      ],
    },
    {
      heading: "§ 3 Booking and booking confirmation",
      paragraphs: [
        "The presentation of accommodation on the Platform is an invitation to submit a booking offer. By completing the booking process (clicking the button that obliges payment), the Guest submits a binding offer to conclude an accommodation contract with the Provider.",
        "The contract is concluded when the booking is confirmed. The booking confirmation is sent to the Guest at the e-mail address provided.",
        "The Guest must provide accurate and complete information when booking (in particular name, contact details and number of travellers).",
      ],
    },
    {
      heading: "§ 4 Prices and payment",
      paragraphs: [
        "The prices stated in the listing at the time of booking apply, including the taxes, fees and additional costs stated there. Prices are displayed in the currency stated in the listing. Additional local charges (e.g. tourist tax) may apply on site where stated in the listing.",
        "Payment is processed via the payment service provider Stripe. Payment data (e.g. card details) are collected and processed directly by Stripe; myBestDays does not store complete card details. Stripe processes personal data in accordance with the [Stripe Privacy Policy](https://stripe.com/privacy).",
        "If a security deposit is stated in the listing, it may be pre-authorised at the time of booking or arrival and retained in whole or in part in the event of damage; the details in the listing are decisive.",
      ],
    },
    {
      heading: "§ 5 Cancellation, rebooking and withdrawal",
      paragraphs: [
        "Whether and under what conditions a booking can be cancelled or changed free of charge is governed by the Provider’s cancellation conditions stated in the listing.",
        "For accommodation services booked for a specific period, there is generally no statutory right of withdrawal pursuant to Article 16(l) of the EU Consumer Rights Directive or the corresponding national provisions. Mandatory statutory rights of the Guest remain unaffected.",
      ],
    },
    {
      heading: "§ 6 Obligations of the Guest",
      paragraphs: [
        "The Guest uses the accommodation as agreed, observes the maximum occupancy stated in the listing and complies with the Provider’s house rules.",
        "The Platform must not be misused, in particular not for sham bookings, fraudulent payments or the posting of unlawful content (e.g. in reviews or messages).",
      ],
    },
    {
      heading: "§ 7 Liability of myBestDays",
      paragraphs: [
        "The Provider alone is responsible for providing the accommodation service. myBestDays is not liable for the accuracy of listing content posted by Providers, but performs the intermediation and payment processing with the diligence of a prudent business.",
        "myBestDays is liable without limitation for intent and gross negligence and for damage resulting from injury to life, body or health. In cases of simple negligence, myBestDays is only liable for the breach of essential contractual obligations (cardinal obligations), limited to the foreseeable damage typical for the contract. Mandatory statutory liability rules remain unaffected.",
      ],
    },
    {
      heading: "§ 8 Data protection",
      paragraphs: [
        "myBestDays processes the Guest’s personal data to perform the intermediation and booking. Booking data are transmitted to the respective Provider to the extent necessary to perform the accommodation contract. § 4 applies to payment processing.",
        "Details are set out in the Platform’s privacy information.",
      ],
    },
    {
      heading: "§ 9 Complaints and dispute resolution",
      paragraphs: [
        "The Guest should first address complaints about the accommodation to the Provider; for questions about the booking or payment, myBestDays support can be reached via the contact channels stated on the Platform.",
        "myBestDays is neither obliged nor willing to participate in dispute resolution proceedings before a consumer arbitration board, unless required by law.",
      ],
    },
    {
      heading: "§ 10 Changes to these terms",
      paragraphs: [
        "myBestDays may amend these terms with effect for the future where this is necessary for valid reasons (in particular changes in legislation or case law) and the Guest is not unreasonably disadvantaged as a result. Bookings already concluded are governed by the version in force at the time of booking.",
      ],
    },
    {
      heading: "§ 11 Final provisions",
      paragraphs: [
        "The law of the state in which the operator has its registered office applies, excluding the UN Convention on Contracts for the International Sale of Goods. If the Guest is a consumer, the mandatory consumer-protection provisions of the state in which the Guest has their habitual residence remain unaffected.",
        "Should individual provisions of these terms be or become invalid, the validity of the remaining provisions remains unaffected.",
      ],
    },
  ],
};
