import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Terms of Service for Guests",
  stand: "Last updated: 18 August 2026",
  intro: [
    "These Terms of Service govern the use of the myBestDays booking platform (the “Platform”) by travellers and bookers (“Guest” or “you”).",
    `The Platform is operated by ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Denmark, CVR no. ${ANBIETER.cvr} (“myBestDays” or “we”). myBestDays is a brand of that company and not a separate legal entity. Full provider details are set out in the [Legal Notice](https://mybestdays.dk/rechtliches/impressum).`,
    "By using the Platform you agree to these Terms. Please read them carefully.",
  ],
  summary: {
    heading: "Summary of these Terms",
    paragraphs: [
      "myBestDays is a marketplace. We provide the platform on which providers offer their accommodation — we do not provide the accommodation itself. The accommodation contract is concluded between you and the provider, not with us.",
      "What you see in a listing comes from the provider: description, photos, amenities, price, cancellation terms and house rules. We review listings, but we cannot vouch for every statement a provider makes.",
      "The price you see when completing your booking is the total price for the services booked. Amounts payable only on arrival (such as tourist tax or a security deposit) are shown separately beforehand.",
      "If something goes wrong, contact us first. Section A15 explains how to submit a complaint and what routes are open to you afterwards.",
      "This summary explains the Terms but does not replace them. The full text prevails.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. All bookings via myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Definitions",
          paragraphs: [
            "Capitalised terms used in these Terms are explained in the glossary at the end of this document. The most important are:",
          ],
          list: [
            "“Platform” — the website, the mobile applications and all other channels through which myBestDays displays accommodation and brokers bookings.",
            "“Provider” — the natural or legal person offering accommodation via the Platform (host, landlord, agency, hotel or accommodation business).",
            "“Accommodation” — the accommodation service offered by the provider, that is a holiday property or a unit of a room or property type.",
            "“Booking” — the reservation of accommodation for a specific period concluded via the Platform.",
            "“Total price” — the amount shown when completing the booking, including all taxes, fees and surcharges settled via the Platform.",
            "“On-site costs” — amounts not settled via the Platform but payable to the provider (for example tourist tax, security deposit, final cleaning where the provider so chooses).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. About these Terms",
          paragraphs: [
            "These Terms apply to any use of the Platform, whether or not you create an account and whether or not a booking is concluded.",
            "Section A applies to all bookings. Section B contains the additional rules for accommodation. Where they conflict, Section B prevails.",
            "The accommodation service itself is additionally governed by the provider's own terms (in particular house rules and cancellation terms) as set out in the listing. Those provider terms apply in addition to ours; they cannot override our Terms as far as your relationship with us is concerned.",
            "These Terms are available in all 24 official languages of the European Union. Where the language versions diverge, the German version prevails, unless mandatory law of your country of residence provides otherwise.",
            "Mandatory consumer rights under the law of your country of residence are unaffected by these Terms.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. About myBestDays",
          paragraphs: [
            "myBestDays is an online marketplace for holiday accommodation and accommodation businesses. We operate the platform on which providers present their accommodation and guests can book it.",
            "We are an intermediary, not an accommodation provider. We do not own, operate, manage or control any of the accommodation offered on the Platform and we are not a party to the accommodation contract.",
            "myBestDays is an intermediary service within the meaning of Regulation (EU) 2022/2065 on a Single Market for Digital Services. Our disclosures and procedures under that Regulation are set out under [Digital Services Act](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays is not a tour operator. We do not assemble packages within the meaning of Directive (EU) 2015/2302; on linked travel arrangements see A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Our Platform",
          paragraphs: [
            "The content of a listing — description, photos, amenities, occupancy limits, prices, availability, cancellation terms and house rules — comes from the respective provider. The provider is responsible for its accuracy and completeness.",
            "We review listings before publication and on an ongoing basis for obvious breaches of our [Content Policy](https://mybestdays.dk/rechtliches/inhaltsrichtlinien). There is no obligation to monitor all content generally, and under Article 8 of Regulation (EU) 2022/2065 such an obligation would not be permissible.",
            "How we order search results and which factors determine that order is explained under [Prices, ranking and recommendations](https://mybestdays.dk/rechtliches/preisangaben).",
            "We aim for a continuously available platform but do not owe uninterrupted availability. Maintenance, faults and adjustments may occur.",
            "Translations of provider content may be machine-generated. The original version supplied by the provider prevails.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Our values",
          paragraphs: [
            "We expect guests and providers to treat each other with respect. Discrimination on grounds of origin, colour, religion, belief, sex, gender identity, sexual orientation, disability, age or comparable characteristics is not tolerated on the Platform — see [Non-discrimination Policy](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Conduct during a stay is governed by the [Ground Rules for Guests](https://mybestdays.dk/rechtliches/grundregeln-gaeste), and for providers by the [Code of Conduct for Providers](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Your account and your use of the Platform",
          paragraphs: [
            "You may create an account in order to book. You are responsible for keeping your credentials confidential and must notify us without delay if you suspect unauthorised use.",
            "You may only use the Platform if you have legal capacity and can validly enter into contracts.",
            "The information you provide on registration and when booking must be accurate and complete — in particular name, contact details and number of travellers. The provider needs this information to supply the accommodation and to comply with its registration obligations.",
            "The following in particular are not permitted:",
          ],
          list: [
            "sham bookings, fraudulent payments or the use of another person's payment method without authorisation;",
            "automated extraction of the Platform (scraping, crawling) beyond what our robots.txt permits;",
            "measures that disrupt or overload the Platform or its underlying infrastructure or circumvent its security safeguards;",
            "posting unlawful, abusive or misleading content in reviews, messages or profile details;",
            "attempting to complete a booking outside the Platform after contact was made through it — see [Fees outside the Platform](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Prices",
          paragraphs: [
            "All prices are shown as a total price including taxes and all fees settled via the Platform, as soon as the travel details (period and number of travellers) are known. Where an element is payable only on arrival, we show it separately before the booking is completed.",
            "Prices are shown in the currency of the listing. Where an amount is additionally shown in another currency, that is a non-binding conversion for guidance only; settlement is in the currency of the listing unless otherwise stated at checkout.",
            "Prices may change until the booking is completed, for example because the provider adjusts them or availability changes. The price shown to you immediately before the binding booking and stated in the booking confirmation prevails.",
            "Obvious pricing errors (for example an amount wrong by orders of magnitude) bind neither us nor the provider. If we identify such an error we will inform you without delay; you may then cancel the booking free of charge.",
            "How service fees are composed is set out under [Service fees](https://mybestdays.dk/rechtliches/servicegebuehren). On taxes and levies see the [Tax Policy](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Payment",
          paragraphs: [
            "Payments via the Platform are processed by the payment service provider Stripe. Payment data (for example card details) is collected and processed directly by Stripe; myBestDays does not store full card details.",
            "Which amount falls due when — deposit, balance or payment on site — depends on the listing and is shown before the booking is completed. Details are set out in the [Payment Terms](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Where the listing states a security deposit, it may be pre-authorised or collected and retained in whole or in part in the event of damage; the statements in the listing prevail.",
            "If a payment fails or is charged back, the booking may be cancelled. The provider may still claim the amounts arising under its cancellation terms.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Policies",
          paragraphs: [
            "In addition to these Terms, the following policies apply and form part of the contract between you and us:",
          ],
          list: [
            "[Content Policy](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Review Policy](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Non-discrimination Policy](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Ground Rules for Guests](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Cancellation Terms](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Rebooking and Refund Policy](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Major Disruptive Events Policy](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Copyright Policy](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Privacy and cookies",
          paragraphs: [
            "How we process personal data is set out in the [Privacy Policy](https://mybestdays.dk/rechtliches/datenschutz). Which cookies and similar technologies we use is set out in the [Cookie Policy](https://mybestdays.dk/rechtliches/cookies).",
            "For a booking we pass to the provider the data it needs in order to supply the accommodation service. The provider is an independent controller in that respect; the [Host Privacy Standards](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber) apply to it.",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Accessibility",
          paragraphs: [
            "The state of accessibility of the Platform and how to report barriers is described in the [Accessibility Statement](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Information about the accessibility of an accommodation comes from the provider. If you depend on particular features, please clarify them with the provider through the messaging function before booking.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Reviews and user-generated content",
          paragraphs: [
            "After your stay you may leave a review. Reviews may only be submitted by someone who booked through the Platform and started the stay or could have started it — this is how we ensure that published reviews come from actual guests.",
            "We do not pay for reviews, do not alter their content and do not suppress a review merely because it is negative. Details, and the grounds on which we remove a review, are set out in the [Review Policy](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "You remain responsible for the content you post — reviews, photos, messages, profile details. You grant us a non-exclusive, worldwide, perpetual, royalty-free right to reproduce, adapt (for example crop, translate) and make that content publicly available in connection with operating and promoting the Platform. You may delete your content; uses already made in compilations already published are unaffected.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Messages and communication with the provider",
          paragraphs: [
            "Messages between you and the provider run through the Platform. We provide the messaging function but are neither sender nor recipient of the content.",
            "We may check messages automatically for breaches of these Terms (for example contact details used to circumvent the Platform, fraud patterns, unlawful content) and withhold or remove the messages concerned. We will inform you of any removal with a statement of reasons in accordance with A17.",
            "We send you messages about your booking (confirmation, changes, arrival information) to the email address you provided. These are contractual communications and cannot be unsubscribed from while the booking exists. You will receive promotional messages only where you have consented or where the law permits without consent; you may object at any time.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Intellectual property rights",
          paragraphs: [
            "The Platform, its design, software, databases, texts and trade marks are protected. You receive a non-exclusive, non-transferable right to use the Platform to search for and book accommodation — nothing more.",
            "Use of our trade marks and logos is governed by the [Trademark Guidelines](https://mybestdays.dk/rechtliches/markenzeichen).",
            "If you believe that content on the Platform infringes your copyright, please follow the [Copyright Policy](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. What to do if something goes wrong",
          paragraphs: [
            "If the problem concerns the accommodation itself, contact the provider first — through the messaging function or on site. Many problems are resolved fastest that way.",
            "If you make no progress with the provider, or if the problem concerns the Platform, the payment or the booking process, contact us. How to reach us and how we handle complaints is set out under [Complaints and dispute resolution](https://mybestdays.dk/rechtliches/beschwerden).",
            "Please have to hand: your booking number, the email address used for the booking, a short description of the problem stating how you would like us to help, and the supporting evidence (photos, messages, receipts).",
            "If the accommodation is unavailable on arrival or differs materially from the listing, the [Rebooking and Refund Policy](https://mybestdays.dk/rechtliches/rueckerstattung) applies.",
            "The European Commission's online dispute resolution platform (ODR platform) was repealed by Regulation (EU) 2024/3228 and has ceased operating; it is no longer available as a route. Which bodies take its place is set out under [Complaints and dispute resolution](https://mybestdays.dk/rechtliches/beschwerden).",
            "Where we have taken a measure against your content or your account, you may in addition to our internal complaint procedure turn to an out-of-court dispute settlement body certified under Article 21 of Regulation (EU) 2022/2065. Their decisions are not binding on us.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Measures against inappropriate conduct",
          paragraphs: [
            "If you breach these Terms or any of the policies listed in A9, we may — graduated according to the severity, frequency and effect of the breach — remove content or restrict its visibility, disable functions, cancel bookings or suspend your account temporarily or permanently.",
            "Before taking a measure we examine the individual case. Where content is manifestly illegal, where persons are at risk or where there is fraud, we may act immediately.",
            "We give reasons for every measure and inform you of the complaint route — see A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Reporting illegal content and statements of reasons",
          paragraphs: [
            "Anyone may report content to us that they consider illegal. The notice and action mechanism under Article 16 of Regulation (EU) 2022/2065, our points of contact and how we handle notices are described under [Digital Services Act](https://mybestdays.dk/rechtliches/dsa).",
            "If we take a measure against content you posted or against your account, you will receive a statement of reasons setting out the ground, the facts relied on, the legal basis or the contractual provision breached, and the available redress.",
            "You may complain against any measure free of charge within six months. Complaints are handled by people, not solely by automated means.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Limitation of liability",
          paragraphs: [
            "We are liable without limitation for intent and gross negligence, for injury to life, body or health and to the extent of any guarantee we have given. Claims under product liability law are unaffected.",
            "Otherwise our liability is limited to the foreseeable damage typically arising from breach of the obligations on whose fulfilment you may rely — and only to the extent that the applicable law permits such a limitation.",
            "We are not liable for the provision of the accommodation service itself, nor for the conduct of providers or other guests. The contractual partner for the accommodation service is the provider.",
            "We are not liable for the accuracy of information posted by providers, unless we knew of the inaccuracy or ought to have known of it. Once we become aware of unlawful information we act without delay.",
            "Any further liability is excluded. Mandatory statutory claims, in particular consumer rights, are unaffected.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Applicable law and jurisdiction",
          paragraphs: [
            "Danish law applies — the operator is established in Denmark — excluding the UN Convention on Contracts for the International Sale of Goods. Mandatory consumer protection provisions of the State in which you have your habitual residence remain unaffected under Article 6 of Regulation (EC) No 593/2008 (Rome I).",
            "As a consumer you may sue us in the courts of your domicile or at our seat in Denmark; we may sue you only in the courts of your domicile (Articles 17 to 19 of Regulation (EU) No 1215/2012).",
            "The accommodation contract is generally governed by the law of the State in which the accommodation is located; for proceedings concerning tenancies of immovable property, the courts of that State have exclusive jurisdiction.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Linked travel arrangements",
          paragraphs: [
            "myBestDays brokers accommodation services only. We do not offer flights, car hire, transport services, excursions or attractions and we do not assemble packages within the meaning of Directive (EU) 2015/2302.",
            "Should we broker further travel services in future, we will inform you before booking, using the prescribed standard form, whether a package or a linked travel arrangement arises and what rights this gives you.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Term, suspension and termination",
          paragraphs: [
            "The contract for use of the Platform runs for an indefinite period. You may delete your account at any time without giving reasons; existing bookings are unaffected and are settled under the terms of the respective provider.",
            "We may terminate the usage contract on 14 days' notice. In the event of a serious breach of these Terms we may terminate without notice and suspend the account.",
            "After termination we delete your data unless a statutory retention obligation or a legitimate interest in retention stands in the way; details are set out in the [Privacy Policy](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Modification clause",
          paragraphs: [
            "We may amend these Terms where there is an objective reason to do so — for example a change in the law, case law of the highest courts, new or discontinued Platform functions, or to close a gap in the rules.",
            "We will announce amendments in text form at least 30 days before they take effect. If you do not object before they take effect, the amended Terms are deemed accepted; we will draw your attention to this effect specifically in the announcement. If you object, we may terminate the usage contract with effect from the date the amendment takes effect.",
            "Bookings already concluded remain governed by the Terms in the version applicable at the time of booking.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Accommodation",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Scope of this section",
          paragraphs: [
            "This section applies to the booking of accommodation via the Platform — holiday properties as well as rooms and units of accommodation businesses.",
            "It supplements Section A. In the event of conflict, this Section B prevails.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Contractual relationship",
          paragraphs: [
            "The accommodation contract is concluded exclusively between you and the provider. myBestDays is not a party to it.",
            "The display of accommodation on the Platform is an invitation to you to submit a booking offer. By clicking the button that commits you to payment you make a binding offer.",
            "The contract is concluded when the booking is confirmed. We send the booking confirmation to the email address you provided; it names the provider, the service booked, the period, the total price and the cancellation terms.",
            "For accommodation with request booking, the contract is concluded only upon acceptance by the provider. Until then your payment method may be pre-authorised but not charged.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. What we do",
          paragraphs: [
            "We provide the Platform, display providers' listings, receive your booking, forward it to the provider and send you the booking confirmation.",
            "We process the payment where the listing provides for payment via the Platform, and we provide the messaging function between you and the provider.",
            "We do not provide or operate the accommodation and give no warranty as to its condition. We are not your tour operator.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. What you must do",
          paragraphs: [
            "Before booking, review the listing in full: amenities, occupancy limit, arrival and departure times, house rules, cancellation terms and the costs payable only on site.",
            "Observe the maximum occupancy stated in the listing. If more people arrive than were booked, the provider may refuse admission or charge a supplement.",
            "Observe the provider's house rules and the [Ground Rules for Guests](https://mybestdays.dk/rechtliches/grundregeln-gaeste). You will treat the accommodation with care and are liable for damage caused by you or your fellow travellers.",
            "Where the provider or an authority requires registration information (for example a registration form, identity data, tourist tax declaration), provide it in good time.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Prices and payment",
          paragraphs: [
            "The total price comprises the accommodation price for the period booked and the surcharges and fees stated in the listing that are settled via the Platform.",
            "Additional amounts may fall due on site — in particular tourist tax or local levies, a security deposit, and extras you book only on site. We show these as on-site costs before the booking is completed, to the extent the provider has stated them.",
            "Where the listing provides for a deposit, the balance falls due at the time stated in the listing. If the balance is not paid, the provider may withdraw from the contract in accordance with its cancellation terms.",
            "We do not accept and cannot trace payments made to the provider outside the Platform; they are not covered by our payment processing — see [Fees outside the Platform](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Changes, cancellations and refunds",
          paragraphs: [
            "Whether and on what terms a booking may be cancelled or changed free of charge is governed by the provider's cancellation terms as stated in the listing. The terms we make available to providers are described under [Cancellation Terms](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "For accommodation services booked for a specific period there is generally no statutory right of withdrawal under Article 16(l) of Directive 2011/83/EU or the corresponding national provisions. Mandatory statutory rights are unaffected.",
            "If the provider cancels, we refund the amount paid via the Platform in full. In addition the [Rebooking and Refund Policy](https://mybestdays.dk/rechtliches/rueckerstattung) applies.",
            "If an event beyond the control of both parties prevents the journey or the stay, the [Major Disruptive Events Policy](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen) applies.",
            "Refunds are made to the payment method used, unless otherwise agreed.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. What else you need to know",
          paragraphs: [
            "Providers may be private hosts or traders. We state in the listing whether a provider acts as a trader. Where the provider is not a trader, Union consumer protection provisions do not apply to the accommodation contract — we draw your attention to this in the listing.",
            "Information on location, surroundings, distances and third-party ratings is for guidance. Only the statements about the service booked itself are binding.",
            "In areas with a registration requirement for short-term rental, we state the registration number provided by the provider in the listing; see [Short-term rental](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Where several identical units of a property or room type exist, you book one unit of that type. The provider determines which specific unit you receive.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Glossary",
      paragraphs: [
        "The following terms have the meaning given here in these Terms.",
      ],
      definitions: [
        {
          term: "Provider",
          description:
            "The natural or legal person offering accommodation via the Platform and becoming the contractual partner under the accommodation contract.",
        },
        {
          term: "Request booking",
          description:
            "A booking that is concluded only after express acceptance by the provider, as opposed to an instant booking.",
        },
        {
          term: "Booking confirmation",
          description:
            "The message by which we confirm conclusion of the accommodation contract; it states provider, service, period, total price and cancellation terms.",
        },
        {
          term: "Unit",
          description:
            "The specific bookable object beneath a property or room type. The unit is what is sold; the type is what is described and priced.",
        },
        {
          term: "Total price",
          description:
            "The amount shown when completing the booking, including all taxes and all fees settled via the Platform.",
        },
        {
          term: "Maximum occupancy",
          description:
            "The largest number of persons permitted to stay overnight in the accommodation, as stated in the listing.",
        },
        {
          term: "Security deposit",
          description:
            "An amount required by the provider as security for damage, which is pre-authorised or collected and released or set off after the stay.",
        },
        {
          term: "Tourist tax",
          description:
            "A local levy on overnight stays, charged on site or via the provider depending on the municipality; it is not a service of myBestDays.",
        },
        {
          term: "Platform",
          description:
            "The website, the mobile applications and all other channels through which myBestDays displays accommodation and brokers bookings.",
        },
        {
          term: "Service fee",
          description:
            "The remuneration for the intermediary service of myBestDays. Who bears it and how it is shown is set out under Service fees.",
        },
        {
          term: "Cancellation terms",
          description:
            "The rules chosen by the provider on when and at what cost a booking may be cancelled or changed.",
        },
        {
          term: "Accommodation",
          description:
            "The accommodation service offered by the provider — a holiday property or a unit of a room or property type.",
        },
        {
          term: "On-site costs",
          description:
            "Amounts not settled via the Platform but payable to the provider, such as tourist tax, security deposit or extras booked on site.",
        },
      ],
    },
  ],
};
