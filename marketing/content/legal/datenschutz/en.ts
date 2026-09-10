// Englische Sprachfassung (Brückensprache) der Datenschutzerklärung.
//
// Diese Datei ist die en-Übersetzung von `de.ts`. Inhaltliche Änderungen
// gehören ZUERST in `de.ts` und werden von dort nachgezogen — hier wird nur
// übersetzt. Struktur (Abschnitte, Reihenfolge, Anzahl der Absätze) ist mit
// `de.ts` deckungsgleich zu halten.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Privacy Policy",
  metaDescription:
    "How myNextDays processes personal data: purposes, legal bases, recipients, retention periods and your rights under the GDPR.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `This policy describes how ${ANBIETER.firma} processes personal data — when you visit this website, when you use the myNextDays platform (dashboard, marketplace and mobile app) and in the context of the business relationship with our customers.`,
    "It is based on Regulation (EU) 2016/679 (GDPR) and on the Danish Data Protection Act (databeskyttelsesloven). We do not sell data and we do not build profiles that identify you as a person. On this website we measure — only with your consent — the reach of our pages and how our advertising performs; both categories can be refused individually (see the Audience measurement and Advertising and performance measurement sections). We only process data for marketing purposes where you have expressly consented — namely for our newsletter (see the Communication section), which you can unsubscribe from at any time with a single click.",
  ],
  sections: [
    {
      heading: "Controller",
      paragraphs: [
        "The controller for the processing operations described in this policy is:",
      ],
      zeilen: [
        {
          label: "Company",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Address",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Email",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Phone",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Scope and roles",
      unterpunkte: [
        {
          paragraphs: [
            "For visits to this website, for your customer account and for the performance of our business relationship, we are the controller within the meaning of Art. 4(7) GDPR.",
          ],
        },
        {
          paragraphs: [
            "For the data that our customers (landlords, hotels, agencies) process in the Platform about their guests, owners and staff, the customers are the controllers and we are the processor pursuant to Art. 28 GDPR. The details are set out in the [Data Processing Agreement](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "If you book accommodation as a guest through our marketplace, we process your booking and contact data both in our own name (operation of the marketplace, payment processing) and on behalf of the hosting business. Your accommodation contract is concluded exclusively with that business; its own privacy information applies in addition.",
          ],
        },
      ],
    },
    {
      heading: "Visiting this website",
      unterpunkte: [
        {
          titel: "Server log files",
          paragraphs: [
            "Each time the site is accessed, your browser transmits technically necessary data which our web server logs: IP address, date and time, the address requested, the volume of data transferred, the status code, the referrer and the browser identifier. The purpose is to deliver the page and to detect and defend against attacks and malfunctions. The legal basis is Art. 6(1)(f) GDPR; our legitimate interest lies in secure and stable operation. The logs are kept only for as long as this is necessary for operation and security, and they are not combined with other data.",
          ],
        },
        {
          titel: "Fonts",
          paragraphs: [
            "The fonts used are hosted locally on our own server. No connection is made to Google Fonts or to any other font service.",
          ],
        },
        {
          titel: "Icons",
          paragraphs: [
            "The icons on this website, like the fonts, are held by us: they are inserted into the page on our own server and are not loaded from an icon service. No connection to a third party takes place in doing so, and your IP address is not transmitted to anyone.",
          ],
        },
        {
          titel: "Spam protection for the contact form (reCAPTCHA)",
          paragraphs: [
            "Our contact form is protected against automated bulk messages with reCAPTCHA Enterprise from Google Ireland Limited. Only if you consent does your browser load a script from www.google.com while you fill in the form; in that case your IP address and information about your interaction with the form are transmitted to Google and evaluated there in order to distinguish a human from a script. The legal basis is Art. 6(1)(a) GDPR (consent); in addition, the [Google Privacy Policy](https://policies.google.com/privacy) applies.",
            "Without your consent nothing is loaded from Google and no data flows there; we then do not accept the form, but you can email us at any time. If you give it, reCAPTCHA sets a cookie of its own (“_GRECAPTCHA”, lifetime set by Google, up to six months) used for the risk assessment. You can change or withdraw your consent at any time via the cookie icon at the bottom left of every page; the cookie is then deleted.",
          ],
        },
        {
          titel: "Audience measurement (Google Analytics)",
          paragraphs: [
            "On this website we use Google Analytics 4, provided by Google Ireland Limited, to measure how our pages are used — which pages are opened, where visitors come from and where they drop off. The sole purpose is to improve our offering and its findability.",
            "It only loads with your consent. If you give it, your browser loads a script from www.googletagmanager.com and stores two cookies (\u201c_ga\u201d and \u201c_ga_<id>\u201d, lifetime up to two years) holding a randomly generated identifier. Transmitted are that identifier, the pages opened, the referrer, an approximate location at country or region level, device and browser, plus your IP address, which Google truncates before any storage. The legal basis is Art. 6(1)(a) GDPR (consent).",
            "We have deliberately restricted the analysis: Google signals and ad personalisation are switched off. No cross-device profiles and no advertising audiences are created, and we do not share usage data with advertising networks. The data is not combined with your customer account.",
            "Google processes the data as our processor under a contract pursuant to Art. 28 GDPR (Google Ads Data Processing Terms). Your IP address is truncated on servers within the EU before any transfer to the United States, so what is transferred is a pseudonymous data set. The transfer relies on the European Commission's adequacy decision for the EU-US Data Privacy Framework (Art. 45 GDPR), under which Google LLC is certified; Google has additionally incorporated the Commission's Standard Contractual Clauses (Art. 46 GDPR). We expressly point out that US authorities may access data held by certified companies under Section 702 FISA, so a residual risk cannot be fully excluded. Google's [privacy policy](https://policies.google.com/privacy) applies in addition.",
            "Retention: event- and user-level data in our property is deleted automatically after 14 months; aggregated report data without reference to individual visitors is kept beyond that. Your consent itself expires after six months.",
            "Without your consent nothing is loaded, no cookie is set and no data reaches Google. You can withdraw your consent at any time via the cookie icon at the bottom left of every page; measurement stops immediately and the cookies named above are deleted.",
          ],
        },
        {
          titel: "Advertising and performance measurement",
          paragraphs: [
            "With your consent we use marketing cookies to measure how our advertising performs and to show you relevant ads on other platforms. The parties involved are Meta Platforms Ireland (Meta pixel, cookie “_fbp”), LinkedIn Ireland (Insight tag, cookies “li_gc” and “bcookie”) and Google Ireland Limited (Google Ads, cookie “_gcl_au”). The legal basis is Art. 6(1)(a) GDPR. Without your consent none of these scripts is loaded and no cookie is set; if you withdraw, we delete them. Details on each cookie are in the [Cookie Policy](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Customer account and use of the Platform",
      paragraphs: [
        "In order to register and operate an account, we process the information that you or your business enter: name, company name and legal form, address, email address, telephone number, role and permissions, register data (e.g. commercial register or VAT number), bank details for payouts, and the content created within the account.",
        "To secure access, we also process login records (time, IP address, device and browser used for the login) and — where activated — the data relating to two-factor authentication.",
        "Signing in with Google: instead of using an email address and password, you can also sign in with a Google account. If you choose this route, Google Ireland Limited provides us solely with your email address, your name, your profile picture and an identifier for your Google account (scopes “openid”, “email”, “profile”) — expressly no access to your emails, contacts, files or calendars. We never learn your Google password. Google processes the sign-in procedure as a controller in its own right; the [Google Privacy Policy](https://policies.google.com/privacy) applies. The legal basis is Art. 6(1)(b) GDPR, since the sign-in serves the performance of the contract; choosing this sign-in route is voluntary and can be replaced at any time by signing in with an email address and password.",
        "The legal basis is Art. 6(1)(b) GDPR (performance of the usage contract, see the [Terms and Conditions](" +
          AGB_URL +
          ")), Art. 6(1)(f) GDPR for securing access, and Art. 6(1)(c) GDPR for retention under tax and commercial law.",
      ],
    },
    {
      heading: "Bookings, guest and property data",
      paragraphs: [
        "Reservations, guest data, messages, tasks and settlements are processed through the Platform. These include in particular the guest’s name and contact details, arrival and departure, the number of travellers, prices and payment status, message histories and — where the business records them — registration data and special requests.",
        "This processing is carried out on behalf of and on the instructions of the respective business. We do not use this data for our own purposes, not for advertising and not for training AI models.",
        "Within a business, the data is separated by role: cleaning and service staff do not see financial and sales data, and owners see only their own properties. Between different businesses the data is separated technically (tenant-based access rules in the database).",
      ],
    },
    {
      heading: "Payment processing",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Card payments and payouts are processed by Stripe Payments Europe, Limited, Ireland. The data required for the payment (amount, currency, means of payment, name, email address, booking reference) and, for our customers’ accounts, the identification data required by law (account holder, beneficial owners, identity document data, bank details) are transmitted to Stripe. Full card details never reach our systems. The legal bases are Art. 6(1)(b) GDPR and, for identification and anti-money-laundering obligations, Art. 6(1)(c) GDPR. The details are governed by the [Stripe Privacy Policy](https://stripe.com/privacy).",
            "Payment links for additional services: if a business invoices its guest for an additional service (e.g. cleaning or laundry) through a payment link, that link leads to a payment page operated by Stripe. For this purpose we transmit to Stripe the name of the service, the amount, the currency and an internal reference to the booking and the business; the business’s company logo is transferred to its Stripe account so that the page shows its brand. On the payment page itself, Stripe collects the guest’s payment and device data as a controller in its own right. Only the payment status, the amount, the amounts withheld and the payment identifiers are returned to us — no card details.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Where the business offers PayPal as a means of payment, the payment data is transmitted to PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxembourg. The [PayPal Privacy Policy](https://www.paypal.com/de/webapps/mpp/ua/privacy-full) applies.",
          ],
        },
      ],
    },
    {
      heading: "Distribution channels and portals",
      paragraphs: [
        "Where a business sells its properties through portals such as Booking.com, Airbnb or Expedia, availability, prices, restrictions and booking data are exchanged with the respective portal through our connectivity provider Channex.io Ltd, United Kingdom. From that direction we receive the portal’s booking and guest data.",
        "The respective portal’s own data protection provisions apply; in that respect the portal is an independent controller. The legal basis for the transfer is Art. 6(1)(b) GDPR in conjunction with the instructions of the business.",
      ],
    },
    {
      heading: "Communication",
      unterpunkte: [
        {
          titel: "Email",
          paragraphs: [
            "We send and receive emails relating to the use of the Platform (booking confirmations, system messages, support, confirmation and invitation links) via our own mail server, which we operate ourselves. No external sending service is involved for these messages.",
          ],
        },
        {
          titel: "Newsletter and pre-registration",
          paragraphs: [
            "On our website you can sign up for news about myNextDays (pre-registration/newsletter). In doing so we process your email address, the language and the place where you signed up.",
            "Sign-up follows the double opt-in procedure: after you have entered your details you receive an email containing a confirmation link; the sign-up only takes effect when you click it. As evidence of consent we store the time of the sign-up and of the confirmation, the IP address used, the browser identifier and the wording you agreed to. This information serves solely as evidence pursuant to Art. 7(1) GDPR and is not evaluated for advertising purposes.",
            "The legal basis is your consent pursuant to Art. 6(1)(a) GDPR; the storage of the evidence is based on Art. 6(1)(c) GDPR in conjunction with Art. 7(1) GDPR. You can withdraw your consent at any time with effect for the future — via the unsubscribe link in every newsletter email or informally by email to us. The withdrawal does not affect the lawfulness of the processing carried out up to that point.",
            "For the administration and dispatch of the newsletter we use Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, France; German branch: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin) as a processor. Your email address and the additional information mentioned above (language, source) are transmitted. The data is processed on servers within the European Union (France and Germany); a data processing agreement pursuant to Art. 28 GDPR is in place with Brevo. The [Brevo Privacy Policy](https://www.brevo.com/legal/privacypolicy/) applies.",
            "When we send a newsletter, Brevo measures on our behalf whether the message was opened and whether any links it contained were clicked. This measurement helps us to adjust content and frequency; it forms part of the consent and ends when you unsubscribe. No combination with other data sources and no profiling takes place.",
            "For as long as the confirmation is outstanding, your address is not written to and not transmitted to Brevo; an unconfirmed entry expires after seven days. After you unsubscribe, we block the address for dispatch and retain the evidence of consent and unsubscription for as long as claims can be asserted on that basis; on request we delete it in full.",
          ],
        },
        {
          titel: "Messages within the Platform",
          paragraphs: [
            "Messages between guest and business are stored in the Platform so that both sides can view the history. If a business blocks a guest, the message channel is closed; existing messages are retained for the sake of traceability.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "If a business uses the WhatsApp connection, the message content and the telephone numbers of those involved are transmitted via the WhatsApp Business Platform operated by Meta Platforms Ireland Limited. The business decides whether to use this feature; without activation no transmission takes place.",
          ],
        },
      ],
    },
    {
      heading: "Automated features and AI",
      paragraphs: [
        "In addition to the GDPR, the features described here are subject to Regulation (EU) 2024/1689 (the “AI Act”), whose transparency obligations under Art. 50 have applied since 2 August 2026.",
      ],
      unterpunkte: [
        {
          titel: "Reply suggestions",
          paragraphs: [
            "For reply suggestions in the message inbox we use — where the feature is activated for the business — the language model offering of Groq, Inc., USA. In doing so the relevant message context is transmitted to that service. Suggestions are never sent automatically; a human always decides whether to send them. There is no automated decision-making with legal effect within the meaning of Art. 22 GDPR.",
            "This is therefore not an AI system that interacts directly with natural persons within the meaning of Art. 50(1) of the AI Act: that obligation presupposes DIRECT interaction in which the AI itself communicates with the person rather than through a human intermediary. Here the feature proposes a text to the business which a member of staff reviews, may amend and sends themselves — that member of staff is the intermediary, and the guest corresponds with the business and not with a chatbot. No automatically replying assistant is in use. On our assessment, the feature also does not meet any of the criteria for high-risk AI under Annex III of the AI Act.",
            "Furthermore, messages to guests are not a “text on matters of public interest” within the meaning of Art. 50(4) of the AI Act: they are not published but sent individually to a specific person, and they concern the handling of a stay. Irrespective of this, the human review by the member of staff sending the message applies here.",
            "Should a feature be offered in future that replies to guests on its own — without human approval — the guest will be informed visibly at the start of the dialogue that they are writing to an AI system. Without that notice, no such feature will be provided.",
          ],
        },
        {
          titel: "Product Advisor on this Website",
          paragraphs: [
            "On this website, an AI-powered product advisor answers questions about our software. It exclusively uses publicly available content from this website (help articles, feature descriptions, frequently asked questions, legal texts) as well as current prices from our billing system. Customer data, bookings, or guest data are not available to it.",
            "Unlike the suggested replies in the inbox, this advisor responds IMMEDIATELY and without human approval. It is therefore an AI system within the meaning of Art. 50 (1) of the AI Regulation that directly interacts with natural persons. You will therefore be visibly informed at the beginning of the dialogue that the answers come from an AI assistant and may contain errors.",
            "Your question and the selected language are processed. Both are transmitted to Google Cloud (Vertex AI) in the europe-west4 region (Netherlands) for answering; processing outside the EU does not take place. We do not permanently store the questions and do not use them for training AI models. The legal basis is our legitimate interest in providing quick information to interested parties (Art. 6 (1) lit. f GDPR).",
            "If the advisor cannot answer a question from the available content, it offers to forward it to our support. Only then - and only if you fill out the form - do we collect your name, email address, and optionally your phone number; we process this information according to the rules in the \"Communication\" section.",
          ],
        },
        {
          titel: "Roles under the AI Act",
          paragraphs: [
            "For the AI features built into the product we are the deployer within the meaning of Art. 3(4) of the AI Act; the providers of the underlying language models are the respective model providers. If a business uses these features in the course of its professional activity, it is itself a deployer in that respect and is subject to the AI literacy obligation under Art. 4 of the AI Act, which has applied since 2 February 2025 regardless of company size. Since 27 July 2026 it has applied in the version introduced by Regulation (EU) 2026/1744: providers and deployers take measures to support the development of AI literacy among their staff; expressly, no particular level has to be guaranteed. We provide support through notices in the application and in our help centre; training its own staff remains the responsibility of the business.",
            "If a business connects its account to an AI assistant of its own (see the following point), it is also the deployer for that within the meaning of the AI Act — it decides on the use and formulates the requests. The interface itself is not an AI system: it reads data from the database and outputs it without drawing any inferences; recital 12 of the AI Act expressly distinguishes such systems from AI.",
          ],
        },
        {
          titel: "Connecting your own AI assistant",
          paragraphs: [
            "A business can connect its account through an interface to an AI assistant that it has chosen itself and with which it has its own contract — for example Claude from Anthropic PBC, USA. Where such a connection has been granted, the assistant can, at the request of the business, read the following: occupancy, availability and daily rates; bookings including guest name, period of stay, property, booking channel, status as well as amount and currency, in so far as the role of the requesting account is permitted to see amounts; and the overview of conversations in the inbox. Without a granted connection no transmission takes place.",
            "Not transmitted are guests’ email addresses and telephone numbers, card details, bank details and payment receipts, access codes and property dossiers. Booking notes and the content of guest messages are excluded by default, because they may contain health information or other special categories of data within the meaning of Art. 9 GDPR; the business must release them expressly and separately when granting the connection.",
            "Only an account with the “Administrator” role can grant the connection, not every account with access. Every request is logged and can be viewed by the business under “Account → Connections”; the business can disconnect there at any time, and access ends immediately.",
            "In legal terms this transmission is an instruction from the business to us (Art. 28(3)(a) GDPR). The provider of the assistant is not a sub-processor of ours — we neither engage nor instruct it; it processes the data on the basis of the contract that the business has concluded with it itself. The business is therefore responsible for the legal basis of this processing, for informing its guests and for the safeguards for any transfer to a third country.",
          ],
        },
        {
          titel: "Translations",
          paragraphs: [
            "Property and content texts can be translated through the Cloud Translation API of Google Ireland Limited. The texts to be translated are transmitted for this purpose; personal data only in so far as it is contained in those texts.",
          ],
        },
        {
          titel: "Price recommendations",
          paragraphs: [
            "For price recommendations we access market, weather and exchange-rate data from external sources. These requests contain no personal data, only location, period and property characteristics.",
          ],
        },
      ],
    },
    {
      heading: "Websites and domains of our customers",
      paragraphs: [
        "Where a business creates its own website with its own domain through the page builder, we manage the necessary DNS records via Cloudflare, Inc. Domain and configuration data is transmitted in the process; we process visitor data of the customer website as described in this policy.",
        "The respective business is responsible for the content, legal notice and privacy information of the customer website.",
      ],
    },
    {
      heading: "Partner programme",
      paragraphs: [
        "We run a partner programme through which partners (influencers, consultants, agencies, customers) recommend businesses to myNextDays and receive a commission. In doing so we process data of partners and — to a limited extent — of referred businesses.",
      ],
      unterpunkte: [
        {
          titel: "Partner data",
          paragraphs: [
            "When applying we process name, company, legal form, country, email address, language, social media accounts (platform, address, handle, self-declared reach), VAT identification number (verified via the EU VIES system), payout details (IBAN, Wise or PayPal address) and the acceptance of the programme terms with version and time. The legal basis is the performance of the partner contract (Art. 6(1)(b) GDPR); for credit notes and retention the tax and commercial law obligations apply (Art. 6(1)(c) GDPR).",
            "If a partner leads a team, they see of their team partners name or company, tier, number of paying customers and the resulting team commission. Messages between sponsor and team partner are stored in the platform so both can see the history.",
          ],
        },
        {
          titel: "Clicks on partner links",
          paragraphs: [
            "When a visitor opens a partner link (mynextdays.com/p/CODE) we store the code, the time, the landing page, the referring page and any campaign parameters, plus the IP address and browser identifier solely as truncated checksums (hash) — for abuse detection (clusters), not for recognition. No tracking cookie is set. Click data is deleted after 90 days. The legal basis is our legitimate interest in fraud-proof settlement of the programme (Art. 6(1)(f) GDPR).",
          ],
        },
        {
          titel: "Connected social media accounts and posts",
          paragraphs: [
            "Partners may voluntarily connect their accounts on YouTube (Google), Instagram and Facebook (Meta) and TikTok to the partner dashboard. In doing so they grant the respective platform a read-only authorisation (OAuth); we never write to these accounts. We store the account identifier and name, the access token in encrypted form, the time of connection and one measurement per account per day: follower or subscriber count, views in the last 28 days, engagement rate and number of posts, each with the timestamp of the platform's response. For posts the partner registers in the dashboard (title, platform, address, publication date) we additionally store views, likes, comments, shares and saves from the platform.",
            "The purpose is to verify the reach stated by the partner and to attribute clicks and customers to individual posts; unverified figures carry less weight at approval. Indications of inconsistencies (for example a jump in followers without matching views) serve solely for manual review by us and do not lead to any automated decision. The legal basis is the partner's consent (Art. 6(1)(a) GDPR), given by connecting the account and revocable at any time in the dashboard under \"Disconnect\"; upon disconnection we delete the access token immediately, stored measurements are retained as history and deleted together with the partner account. We use only the platforms' official interfaces; processing by Google, Meta and TikTok is governed by their own privacy notices.",
          ],
        },
        {
          titel: "Referred businesses",
          paragraphs: [
            "When a business registers with a partner code we store the attribution of the business to the partner, together with time, method (link or code) and status. The partner sees the business only pseudonymously (sequential number, country, status, amounts) — never name, email address or booking data. Only if the business explicitly consents at registration may the partner contact it through the platform. For commission settlement we process the net subscription amounts of the business's paid invoices; the legal basis is the performance of the partner and the user contract (Art. 6(1)(b) GDPR).",
          ],
        },
      ],
    },
    {
      heading: "Hosting and storage",
      paragraphs: [
        "The Platform, the database, the media and the mail server run on servers of Hetzner Online GmbH, Germany, in the Helsinki data centre (Finland) — that is, within the European Union. A data processing agreement is in place with Hetzner.",
        "Backups are created in encrypted form and kept encrypted with a storage provider within the EU.",
      ],
    },
    {
      heading: "Recipients at a glance",
      paragraphs: [
        "Apart from the service providers named here, we only disclose personal data where we are legally obliged to do so (e.g. tax authorities, law enforcement) or where you or the business acting as controller request it.",
      ],
      list: [
        "Hetzner Online GmbH (Germany/Finland) — hosting, database, media, mail server",
        "Stripe Payments Europe, Limited (Ireland) — payments, payouts, identity verification",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxembourg) — payments, where activated",
        "Channex.io Ltd (United Kingdom) — connection to booking portals",
        "Meta Platforms Ireland Limited (Ireland) — WhatsApp messages, where activated",
        "Sendinblue SAS / Brevo (France, Germany) — newsletter administration and dispatch, only with consent",
        "Google Ireland Limited (Ireland) — translations; spam protection for the contact form (reCAPTCHA Enterprise), only with consent; audience measurement (Google Analytics 4), only with consent; signing in with Google, where used",
        "Groq, Inc. (USA) — reply suggestions, where activated",
        "Cloudflare, Inc. (USA) — DNS management for customer domains",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "This list does not include services that a business agrees itself with a third party and connects to its account through the interface — for example an AI assistant such as Claude from Anthropic PBC, USA. These are not service providers engaged by us but recipients acting on the instructions of the respective business; without that business’s connection no data flows to them. According to the official participant list of the US Department of Commerce, Anthropic is not certified under the EU-US Data Privacy Framework; any transfer is therefore based on the standard contractual clauses, for which the respective business is answerable as controller.",
          ],
        },
      ],
    },
    {
      heading: "Transfers to third countries",
      paragraphs: [
        "As a rule, processing takes place within the EU. With the services named above that are established outside the EU, a transfer to a third country may occur.",
        "For Groq, Inc. and Cloudflare, Inc. (USA) we base the transfer on the European Commission’s standard contractual clauses pursuant to Art. 46(2)(c) GDPR, in so far as the recipient cannot rely on an adequacy decision (EU-US Data Privacy Framework).",
        "The contracting party for payment processing is Stripe Payments Europe, Limited (Ireland). In so far as Stripe relies on Stripe, LLC (USA) in this context, that entity is certified under the EU-US Data Privacy Framework; to that extent the transfer is based on the European Commission’s adequacy decision pursuant to Art. 45 GDPR. In addition, the standard contractual clauses in the [Stripe Data Processing Agreement](https://stripe.com/legal/dpa) apply.",
        "For Channex.io Ltd (United Kingdom), the European Commission’s adequacy decision for the United Kingdom applies; should it cease to apply, the standard contractual clauses take effect.",
      ],
    },
    {
      heading: "Access by third-country authorities (US CLOUD Act)",
      paragraphs: [
        "Providers subject to United States jurisdiction may be required under the US CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018) to hand over data to US authorities — including where that data is held on servers within the European Union. Such access may conflict with the GDPR, and the provider may be legally prevented from informing us or you about it. Neither the adequacy decision on the EU-US Data Privacy Framework nor the standard contractual clauses exclude this risk.",
        "We limit this risk by operating the core systems — Platform, database, media, mail server and backups — with European providers within the EU, where US jurisdiction does not apply.",
      ],
      unterpunkte: [
        {
          titel: "Services affected",
          paragraphs: [
            "US jurisdiction can only come into consideration for the following clearly delimited additional services:",
          ],
          list: [
            "Groq, Inc. (USA) — reply suggestions in the message inbox, only where the business activates the feature. The relevant message context is transmitted.",
            "Cloudflare, Inc. (USA) — DNS management for customer domains. Domain and configuration data is transmitted, no guest data.",
            "Google LLC (USA) — for signing in with Google, for translations and for audience measurement (Google Analytics 4, only with consent); the contracting party in each case is Google Ireland Limited, but access by the US parent company cannot be ruled out.",
          ],
        },
        {
          titel: "Avoidability",
          paragraphs: [
            "The Platform can be used without these services: the reply suggestions can be switched off, the DNS management only concerns customers with their own domain, and signing in with Google is a voluntary alternative to signing in with an email address and password.",
          ],
        },
        {
          titel: "Distinction from European law",
          paragraphs: [
            "The CLOUD Act is United States law, not law of the European Union. It must be distinguished from the EU Data Act (Regulation (EU) 2023/2854), which governs switching and portability for data processing services, and from the Cloud and AI Development Act, which as at the date of this policy is still in the European legislative process.",
          ],
        },
      ],
    },
    {
      heading: "Retention periods",
      list: [
        "Account data: for the duration of the business relationship; thereafter deletion, in so far as no retention obligation applies.",
        "Booking, invoicing and payment data: under the Danish Bookkeeping Act, five years after the end of the financial year to which they relate; for customers established in Germany, longer commercial and tax law periods may apply.",
        "Messages and guest data in the Platform: on the instructions of the business acting as controller, at the latest until deletion by that business or until the end of the contract.",
        "Newsletter: until consent is withdrawn; unconfirmed sign-ups expire after seven days. The evidence of consent and unsubscription is retained beyond that for as long as it is needed as evidence.",
        "Login records and security events: for a short period, for the detection of attacks.",
        "Server log files: only for as long as this is necessary for operation and security.",
        "Backups: on a rolling basis, until they are replaced by more recent backups.",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        "You have the right of access (Art. 15), to rectification (Art. 16), to erasure (Art. 17), to restriction of processing (Art. 18), to data portability (Art. 20) and to object to processing based on legitimate interests (Art. 21 GDPR). You can withdraw any consent given at any time with effect for the future.",
        `To do so, please contact [${ANBIETER.email}](mailto:${ANBIETER.email}). Where your data relates to the use of the Platform by a business, we will forward your request to the business acting as controller or support that business in responding.`,
        `You can also lodge a complaint with a data protection supervisory authority — the authority responsible for us is ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). You may also contact the supervisory authority of your place of residence.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Ein Abschnitt „Ihre Rechte", der die
      // Löschung nur als DSGVO-Artikel erwähnt, genügt der Prüfung nicht —
      // gefordert ist der konkrete, benannte Weg.
      heading: "Deleting your account and app data",
      paragraphs: [
        "You can request the deletion of your account yourself at any time — in the app under ‘Profile → Account’ or through our web form:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "The route via the web deliberately works even if you no longer have the app installed or can no longer sign in. To protect against misuse, this happens in two steps: you enter the email address of your account and receive a confirmation link at precisely that address. Only opening that link makes the request valid — an address entered on its own has no effect. We process the request within 30 days and reply by email.",
        "Along with the account we delete your login credentials, your profile, your property and calendar data and your messages. Records subject to a statutory retention obligation are not deleted — in particular invoices and booking documents for settled periods (bookkeeping obligations under Danish law, generally five years). Those records are blocked for the duration of the period, meaning they are retained exclusively for the purpose of complying with that obligation and are deleted thereafter.",
      ],
    },
    {
      heading: "Security of processing",
      paragraphs: [
        "We safeguard the processing through technical and organisational measures pursuant to Art. 32 GDPR, in particular: end-to-end transport encryption (TLS), tenant-based access rules directly in the database, role-based permissions with a separation of financial and service data, optional two-factor authentication, limitation of login attempts, encrypted backups with regular restore testing, and logging of security-relevant events.",
      ],
    },
    {
      heading: "Obligation to provide data",
      paragraphs: [
        "The information we need in order to conclude the contract, to invoice and to meet our legal obligations is required — without it we cannot provide the Platform. All further information is voluntary.",
      ],
    },
    {
      heading: "Changes to this privacy policy",
      paragraphs: [
        "We adapt this policy when the processing, the service providers used or the legal position change. The version published here applies in each case; the date above shows the status.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default datenschutz;
