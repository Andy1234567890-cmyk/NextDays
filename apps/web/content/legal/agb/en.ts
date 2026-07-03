import type { LegalDoc } from "../types";

// Englische Fassung (Brückensprache). Quelle ist content/legal/agb/de.ts.
// § 5 Absatz 1–2 verwendet Stripes offiziellen englischen Empfehlungstext
// (recommended disclosure language) — Wortlaut und URLs nicht verändern.
export const agb: LegalDoc = {
  title: "Terms and Conditions for Agencies and Property Managers",
  stand: "Last updated: 3 July 2026",
  intro: [
    "These Terms and Conditions (the “Terms”) govern the use of the myNextDays software platform (the “Platform”) by agencies, property managers, landlords and other business users (the “User”).",
    "The Platform is operated by [full legal name, legal form, address and register details of the operating company — to be completed before publication] (“myNextDays”, “we”).",
    "The Platform is intended exclusively for businesses within the meaning of Section 14 of the German Civil Code (BGB) or the corresponding provisions of the relevant EU member state. It is not intended for consumers.",
  ],
  sections: [
    {
      heading: "§ 1 Scope",
      paragraphs: [
        "These Terms apply to all contracts concerning the use of the Platform between myNextDays and the User and to all services and modules provided through it.",
        "Deviating, conflicting or supplementary terms of the User only become part of the contract if myNextDays has expressly agreed to them in text form.",
      ],
    },
    {
      heading: "§ 2 Subject matter and services",
      paragraphs: [
        "myNextDays provides the User with cloud-based software for managing holiday rentals and accommodation businesses. The scope of functions results from the current service description and includes in particular:",
      ],
      list: [
        "management of properties, availability calendars and reservations (property management system),",
        "connection to third-party booking channels (e.g. Booking.com, Airbnb) via a channel manager,",
        "publication of listings via the Platform’s own booking channel myNextDays,",
        "creation of the User’s own websites via the integrated page builder,",
        "accounting, settlement and reporting functions including owner statements,",
        "guest communication and acceptance of payments via the integrated payment processing (§ 5).",
      ],
    },
    {
      heading: "§ 3 Registration, account and User information",
      paragraphs: [
        "Use of the Platform requires registration of an account. The User must provide accurate, current and complete information about themselves and their business upon registration and throughout the term of the contract, and must update it without undue delay whenever it changes.",
        "Login credentials must be kept confidential and protected against access by third parties. The User must inform myNextDays without undue delay if there are indications of misuse of their account.",
        "An account is not transferable. The User ensures that all persons using the account on their behalf comply with these Terms.",
      ],
    },
    {
      heading: "§ 4 Role of myNextDays in bookings",
      paragraphs: [
        "Accommodation contracts for the properties offered on the Platform, on connected third-party channels or on the User’s own website are concluded exclusively between the User (or the owner represented by the User) and the respective guest. myNextDays does not become a party to the accommodation contract.",
        "The User is solely responsible for the accuracy and legality of the listing content (descriptions, photos, prices, availability, taxes and charges).",
      ],
    },
    {
      heading: "§ 5 Payment processing by Stripe",
      paragraphs: [
        "Payment processing services for agencies and property managers on myNextDays are provided by Stripe and are subject to the [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), which includes the Stripe Terms of Service (collectively, the “Stripe Services Agreement”). By agreeing to these Terms or continuing to operate as an agency or property manager on myNextDays, you agree to be bound by the Stripe Services Agreement, which may be modified by Stripe from time to time.",
        "As a condition of myNextDays enabling payment processing services via Stripe, you agree to provide myNextDays accurate and complete information about you and your business, and authorize myNextDays to share such information and transaction data related to your use of the payment processing services provided by Stripe.",
        "The linked English contract text, as amended from time to time, governs the legal relationship with Stripe. The contracting Stripe entity for users in the European Economic Area is the Stripe company named in the Stripe Services Agreement (currently Stripe Payments Europe, Limited, Ireland). Stripe processes personal data in accordance with the [Stripe Privacy Policy](https://stripe.com/privacy).",
        "To satisfy statutory identification and verification obligations (including anti-money-laundering and “know your customer” requirements), myNextDays and Stripe may at any time request further information and supporting documents, in particular identity documents, information on beneficial owners and bank account details. If requested information or documents are not provided within the set deadline, acceptance of payments or payouts may be suspended in whole or in part until the information is complete.",
      ],
    },
    {
      heading: "§ 6 Payouts, chargebacks and negative balances",
      paragraphs: [
        "Payouts are made to the bank account provided by the User. myNextDays may adjust the payout schedule for risk reasons, in particular for new accounts, unusual transaction patterns or ongoing reviews.",
        "Chargebacks, refunds and any resulting fees relating to the User’s bookings are borne by the User. myNextDays is entitled to set such amounts off against future payouts.",
        "If a negative balance arises on the User’s payment account, the User must settle it without undue delay. The User authorizes myNextDays and Stripe to debit negative balances from the bank account on file, to the extent legally permissible.",
      ],
    },
    {
      heading: "§ 7 Fees and invoicing",
      paragraphs: [
        "The fees for using the Platform result from the price list agreed at the time of contracting or from the individual offer. All prices are exclusive of applicable statutory taxes and are stated in the currency specified in the contract.",
        "Transaction-based fees (e.g. payment or channel fees) may be withheld or set off directly when the respective transaction is processed.",
        "If the User is in default of payment, myNextDays may, after prior notice, suspend access to the Platform until the outstanding amounts have been settled.",
      ],
    },
    {
      heading: "§ 8 Obligations of the User; own legal texts",
      paragraphs: [
        "The User ensures that their listings, content and business practices comply with the applicable laws, in particular accommodation, registration, tax and consumer-protection law at the location of the property. The User maintains all required permits, registrations and licences at their own responsibility.",
        "The User is responsible for websites operated via the page builder and for their listings on the Platform; this includes in particular the User’s own guest terms and conditions, legal notice (imprint) and privacy information.",
        "The following are prohibited in particular: publishing inaccurate or misleading listings, processing sham or fraudulent transactions, circumventing the payment processing under § 5 for bookings concluded via the Platform, and any use that impairs the security or availability of the Platform.",
      ],
    },
    {
      heading: "§ 9 Third-party booking channels",
      paragraphs: [
        "When connecting third-party channels (e.g. Booking.com, Airbnb), the terms of the respective channel operator additionally apply. The User concludes the contracts required for this with the channel operator directly.",
        "myNextDays performs the technical synchronisation of availability, prices and booking data, but has no influence on the content, commissions or decisions of the channel operators and is not liable for their availability.",
      ],
    },
    {
      heading: "§ 10 Availability and further development",
      paragraphs: [
        "myNextDays provides the services with the diligence of a prudent business and aims for high availability of the Platform. Maintenance windows, further development and circumstances outside the control of myNextDays (e.g. outages at third-party providers) may temporarily limit availability.",
        "myNextDays may further develop the Platform and change functions, provided that the purpose of the contract is not jeopardised and the change is reasonable for the User.",
      ],
    },
    {
      heading: "§ 11 Data and data protection",
      paragraphs: [
        "Where myNextDays processes personal data on behalf of the User when providing the Platform (in particular guest data), the parties enter into a data processing agreement pursuant to Art. 28 GDPR.",
        "The User remains responsible for the lawfulness of the collection and processing of the data they contribute. Details of data processing by myNextDays are set out in the Platform’s privacy information; § 5 applies to data processing by Stripe.",
      ],
    },
    {
      heading: "§ 12 Intellectual property",
      paragraphs: [
        "All rights in the Platform, its software and its content (except content contributed by the User) belong to myNextDays or its licensors. For the term of the contract, the User receives a simple, non-transferable right to use the Platform to the extent agreed in the contract.",
        "The User grants myNextDays the simple usage rights to the content they contribute that are required to operate the Platform (in particular storage, reproduction, display and transmission to connected channels).",
      ],
    },
    {
      heading: "§ 13 Liability",
      paragraphs: [
        "myNextDays is liable without limitation for intent and gross negligence and for damage resulting from injury to life, body or health.",
        "In cases of simple negligence, myNextDays is only liable for the breach of essential contractual obligations (cardinal obligations), limited to the foreseeable damage typical for the contract. Liability under product liability law and under guarantees assumed remains unaffected.",
        "For loss of data, myNextDays is only liable to the extent that the damage would also have occurred if the User had performed proper, regular data backups, unless the data backup is contractually the responsibility of myNextDays.",
      ],
    },
    {
      heading: "§ 14 Term, termination and suspension",
      paragraphs: [
        "Term and notice periods result from the respective contract. The right to extraordinary termination for good cause remains unaffected.",
        "myNextDays may temporarily suspend access to the Platform or individual functions (including acceptance of payments and payouts) if there are concrete indications of a breach of these Terms, of fraud or of abusive use, or if myNextDays is required to do so by law or by order of a payment service provider. The User will be informed of the suspension to the extent legally permissible.",
        "After the end of the contract, myNextDays will, on request, make the User’s data available for export in a common format within 30 days; thereafter the data will be deleted unless statutory retention obligations require otherwise.",
      ],
    },
    {
      heading: "§ 15 Changes to these Terms",
      paragraphs: [
        "myNextDays may amend these Terms with effect for the future where this is necessary for valid reasons (in particular changes in legislation, case law or requirements of payment service providers) and the User is not unreasonably disadvantaged as a result.",
        "Amendments will be announced to the User in text form at least six weeks before they take effect. If the User does not object within the announcement period or continues to use the Platform after the amendments take effect, the amended Terms are deemed accepted; the announcement will specifically point out this consequence.",
      ],
    },
    {
      heading: "§ 16 Final provisions",
      paragraphs: [
        "The law of the state in which the operator has its registered office applies, excluding the UN Convention on Contracts for the International Sale of Goods. Mandatory provisions of the state in which the User has its registered office remain unaffected.",
        "The exclusive place of jurisdiction for all disputes arising out of or in connection with this contract is — to the extent legally permissible — the registered office of the operator.",
        "Should individual provisions of these Terms be or become invalid, the validity of the remaining provisions remains unaffected.",
      ],
    },
  ],
};
