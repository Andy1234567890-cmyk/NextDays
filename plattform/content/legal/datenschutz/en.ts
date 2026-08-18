import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Privacy Policy",
  stand: "Last updated: 18 August 2026",
  intro: [
    "This policy describes which personal data myBestDays processes, for what purposes, on what legal basis and what rights you have. It applies to the website, the mobile applications and all other channels to the Platform.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Controller and data protection officer",
      paragraphs: [
        `The controller within the meaning of Regulation (EU) 2016/679 (GDPR) is ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Denmark, CVR no. ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Full provider details are set out in the [Legal Notice](https://mybestdays.dk/rechtliches/impressum).`,
        "No data protection officer has been designated; the conditions of Article 37 GDPR are not met. Please send data protection enquiries to the email address above.",
        "Providers with whom you book are independent controllers for the data they receive from us. The [Host Privacy Standards](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber) apply to them.",
      ],
    },
    {
      id: "kategorien",
      heading: "2. What data we process",
      paragraphs: ["Depending on how you use the Platform, we process:"],
      list: [
        "master data — name, email address, telephone number, language and currency, password in encrypted form;",
        "booking data — accommodation booked, period, number and names of travellers, special requests, booking status;",
        "payment data — amount, currency, payment status, the last digits of the payment method and our payment service provider's transaction reference. Full card details do not reach us;",
        "communication data — messages between you and the provider, enquiries to our customer service, complaints;",
        "content data — reviews, photos, wish lists;",
        "usage data — pages viewed, search queries, time of access;",
        "technical data — IP address, browser and device identifiers, operating system, referrer.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Purposes and legal bases",
      paragraphs: [
        "Provision of the Platform, account, search, booking, payment processing and communication with the provider — Article 6(1)(b) GDPR (contract or pre-contractual measure).",
        "Customer service, complaint handling and dispute resolution — Article 6(1)(b) and (f) GDPR.",
        "Detection and prevention of fraud, abuse and security incidents, enforcement of our terms — Article 6(1)(f) GDPR (legitimate interest in a safe marketplace).",
        "Reviews and their publication — Article 6(1)(b) and (f) GDPR.",
        "Compliance with legal obligations, in particular commercial and tax retention obligations, the reporting obligation under Directive (EU) 2021/514 (DAC7) and the obligations under Regulation (EU) 2022/2065 — Article 6(1)(c) GDPR.",
        "Improvement of the Platform through analysis of aggregated usage data — Article 6(1)(f) GDPR.",
        "Promotional emails and non-essential cookies — Article 6(1)(a) GDPR (consent), which you may withdraw at any time with effect for the future.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Recipients",
      paragraphs: [
        "Providers receive the data they need to perform your booking and to comply with their legal obligations — in particular name, contact details, period, number of travellers and your messages to them.",
        "Our payment service provider Stripe processes payment data as an independent controller; the [Stripe Privacy Policy](https://stripe.com/privacy) applies in addition.",
        "Service providers performing hosting, database operation, email dispatch, error diagnostics and customer service tools for us process data solely on our instructions on the basis of a contract under Article 28 GDPR.",
        "Authorities and courts receive data only where we are obliged to provide it; see [Guidelines for authority and law enforcement requests](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Tax authorities receive the information about providers to be reported under DAC7.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Transfers to third countries",
      paragraphs: [
        "Our servers and those of our processors are located in the European Union.",
        "Where processing takes place outside the European Economic Area in an individual case, it does so only on the basis of an adequacy decision of the European Commission or the standard contractual clauses under Article 46(2)(c) GDPR together with supplementary safeguards.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Retention periods",
      paragraphs: [
        "We store account data for as long as your account exists and delete it thereafter, unless a retention obligation stands in the way.",
        "Booking and payment data are subject to commercial and tax retention periods; depending on the State of establishment these are regularly five to ten years from the end of the year in which the booking was concluded.",
        "Messages relating to a booking are stored until three years after the end of the stay, so that disputes can be resolved.",
        "Reviews remain in anonymised form after deletion of your account, because they form part of the rating basis of an accommodation.",
        "Data on fraud and abuse cases are stored for as long as necessary to prevent further breaches, but for no longer than three years after the last incident.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Your rights",
      paragraphs: ["Under the GDPR you have the following rights:"],
      list: [
        "access to the data stored about you (Article 15);",
        "rectification of inaccurate data (Article 16);",
        "erasure (Article 17), unless a retention obligation stands in the way;",
        "restriction of processing (Article 18);",
        "data portability (Article 20);",
        "objection to processing based on legitimate interests (Article 21), in particular to direct marketing;",
        "withdrawal of consent given, with effect for the future (Article 7(3));",
        `complaint to a supervisory authority (Article 77) — the authority of your residence, your place of work or the place of the alleged infringement is competent. At the controller\u0027s seat this is ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Denmark, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. How to exercise your rights",
      paragraphs: [
        `Much information can be viewed, changed or deleted directly in your account. For everything else, contact us at ${ANBIETER.email}.`,
        "We respond without delay and at the latest within one month. If we cannot meet that deadline we will inform you with reasons.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Automated decisions",
      paragraphs: [
        "We use automated procedures to detect fraud, abuse and illegal content. Where such a procedure leads to a measure against your account or your content, we give reasons and you may request review by a human.",
        "We do not take decisions based solely on automated processing with legal effect within the meaning of Article 22 GDPR.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Obligation to provide data",
      paragraphs: [
        "You must provide the data required for a booking; without it no contract can be concluded and the accommodation cannot be supplied. All other information is voluntary.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Changes to this policy",
      paragraphs: [
        "We adapt this policy where the processing or the legal position changes. The version in force is available here; the date of last update is shown above.",
      ],
    },
  ],
};
