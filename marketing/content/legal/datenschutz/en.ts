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
    "It is based on Regulation (EU) 2016/679 (GDPR) and on the Danish Data Protection Act (databeskyttelsesloven). We do not sell data, we do not create profiles and we do not use any analytics, tracking or advertising services on our websites. We only process data for marketing purposes where you have expressly consented — namely for our newsletter (see the Communication section), which you can unsubscribe from at any time with a single click.",
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
            "Without your consent nothing is loaded from Google and no data flows there; in that case we do not accept the form, but you can write to us by email at any time. You can change or withdraw your consent in the [Cookie Policy](/cookie-richtlinie).",
          ],
        },
        {
          titel: "No analytics, no advertising",
          paragraphs: [
            "We do not use any analytics, tracking or advertising services (no Google Analytics, no pixels, no ad networks) and we do not create profiles. The cookies that the Platform technically requires are listed in the [Cookie Policy](/cookie-richtlinie).",
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
        "Google Ireland Limited (Ireland) — translations; spam protection for the contact form (reCAPTCHA Enterprise), only with consent; signing in with Google, where used",
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
            "Google LLC (USA) — only for signing in with Google and for translations; the contracting party in each case is Google Ireland Limited, but access by the US parent company cannot be ruled out.",
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
