// Englische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin
// (dort stehen auch die Belege für die technischen und organisatorischen
// Maßnahmen und die Liste der Unterauftragsverarbeiter).
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Data Processing Agreement",
  metaDescription:
    "Data processing under Article 28 GDPR between myNextDays ApS and the businesses using the platform: subject matter, instructions, security, sub-processors.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `This agreement (the “DPA”) applies between the business using the myNextDays platform (the “controller”) and ${ANBIETER.firma} (the “processor” or “we”) and gives effect to the obligations under Article 28 of Regulation (EU) 2016/679 (GDPR).`,
    `It is incorporated by the [Terms and Conditions](${AGB_URL}) and applies for the entire duration of the use of the platform. It takes precedence over the Terms and Conditions in so far as the processing of personal data on behalf of the controller is concerned.`,
    "In addition, the [privacy policy](/datenschutz) applies to the data we process as controller in our own right — in particular the data of the account and of the business relationship.",
  ],
  sections: [
    {
      heading: "Subject matter and allocation of roles",
      unterpunkte: [
        {
          paragraphs: [
            "The subject matter is the processing of personal data that the controller enters into the platform or collects through it so that we can provide the contractually agreed services: management of properties, reservations and occupancy, communication with guests, payment processing, accounting and owner statements, connection to booking portals, website builder as well as task and team management.",
          ],
        },
        {
          paragraphs: [
            "The controller decides on the purposes and means of this processing. We process the data solely on its documented instructions and not for our own purposes.",
          ],
        },
        {
          paragraphs: [
            "For the data of the account, the billing of our own services, system security and statutory retention, we are the controller ourselves. That processing is not the subject matter of this DPA.",
          ],
        },
      ],
    },
    {
      heading: "Nature, scope and purpose of the processing",
      paragraphs: [
        "Processing takes place by way of collection, storage, display, alteration, disclosure to recipients chosen by the controller (e.g. booking portals, payment service providers), restriction and erasure — in automated form within the platform.",
        "The place of processing is the European Union; exceptions are listed exhaustively in section 8.",
      ],
    },
    {
      heading: "Categories of data subjects",
      list: [
        "Guests and bookers, including fellow travellers",
        "Prospective guests who submit enquiries or send messages",
        "Owners of the managed properties",
        "Staff of the controller (team, cleaning, service, reception)",
        "Contact persons of the controller’s partners and service providers",
      ],
    },
    {
      heading: "Categories of personal data",
      list: [
        "Master data: name, address, date of birth where recorded, nationality where recorded for the registration obligation",
        "Contact data: e-mail address, telephone number",
        "Booking data: period, property, number of travellers, prices, additional services, cancellations",
        "Payment data: amount, currency, payment method, payment status, references (complete card details never reach our systems)",
        "Communication data: messages, notes, reviews",
        "Access and usage data of staff: role, permissions, time of sign-in, device and IP address of the sign-in",
        "Special categories under Article 9 GDPR are not the subject matter of the assignment; the controller does not enter such data into free-text fields.",
      ],
    },
    {
      heading: "Instructions",
      unterpunkte: [
        {
          paragraphs: [
            "The controller issues instructions by using and configuring the platform and in text form to our contact address. We confirm oral instructions in text form.",
          ],
        },
        {
          paragraphs: [
            "If we consider an instruction to be unlawful, we notify the controller without delay and may suspend its implementation until the controller confirms or amends it.",
          ],
        },
        {
          paragraphs: [
            "Where we are legally obliged to process data (for example vis-à-vis public authorities), we inform the controller in advance in so far as the law permits us to do so.",
          ],
        },
        {
          titel: "Connecting the controller’s own services",
          paragraphs: [
            "The controller can connect its account via an interface to a service that it has chosen itself and with which it has concluded its own contract — for example an AI assistant. If it grants such a connection, this is its explicit instruction under Article 28(3)(a) GDPR to release the shared data to that service. It expressly also covers any transfer to a third country associated with it if the service is established outside the European Union.",
            "In short: only the controller decides on such a connection, and the controller is itself responsible for the connected service.",
            "Only an account with the permission to manage external connections can grant it. This permission is reserved for the “administrator” role; accounts with restricted rights — including the “co-administrator” role — cannot grant a connection. We record who granted it, when and for which service, which categories of data were released and which retrievals took place; this record is available to the controller in the interface under “Account → Connections” so that it can meet its accountability obligation and answer requests for information.",
            "The connected service is not a sub-processor of ours: we do not commission it, do not select it and do not instruct it. It processes the data on the basis of the contract that the controller has concluded with it itself. Responsibility for that processing, for its legal basis and for the safeguards of a transfer to a third country therefore lies with the controller; it is not the subject matter of this DPA.",
            "Free-text fields — booking notes and the content of guest messages — are excluded from such a connection by default. They may contain special categories of personal data under Article 9 GDPR, such as health data. The controller must release them separately when granting the connection; without that release they are not transmitted.",
            "The controller can disconnect a granted connection at any time in the interface. The refresh tokens are deleted in the process, and every further retrieval checks whether the consent still exists — a disconnected service can therefore no longer read anything immediately, not only once its access token has expired.",
          ],
        },
      ],
    },
    {
      heading: "Confidentiality",
      paragraphs: [
        "All persons who may have access to the data in the performance of the assignment are bound to confidentiality and are instructed on data protection at regular intervals. Access is limited to what is necessary for the respective task.",
        "Our staff access customer data only for troubleshooting, upon a support request or to comply with statutory obligations.",
      ],
    },
    {
      heading: "Security of processing",
      paragraphs: [
        "We implement the technical and organisational measures required under Article 32 GDPR. The following in particular are in place:",
      ],
      list: [
        "Transport encryption (TLS) for all connections, HTTP security headers including a strict Content-Security-Policy",
        "Tenant separation directly in the database: row-based access rules (Row Level Security) plus revoked table privileges for sensitive data, so that access outside one’s own business is ruled out even by the direct database route",
        "Role-based permissions with data separation: service and cleaning staff receive no financial or sales data, owners only their own properties; guest data is masked for roles that are not authorised",
        "Two-factor authentication (TOTP) available for accounts; re-authentication for security-critical changes",
        "Log of sign-ins with device, time and IP address, viewable by the controller",
        "Only an account with the “administrator” role can grant connections to external services; every retrieval via such a connection is logged (tool, time, scope — without the content itself) and can be viewed by the controller. A disconnected connection loses access immediately: every retrieval checks whether the consent still exists",
        "Rate limiting of requests against automated attacks, verification of the signatures of incoming webhook calls",
        "Encrypted backup copies stored outside the production system with regular restore testing",
        "Separate environments for development and operation; changes to the database exclusively through versioned migrations",
      ],
    },
    {
      heading: "Sub-processors",
      paragraphs: [
        "The controller approves the use of the following sub-processors. Contracts under Article 28(4) GDPR with obligations corresponding to this DPA are in place with each of them.",
      ],
      list: [
        "Hetzner Online GmbH, Germany (servers, database, media, mail server; data centre in Helsinki, Finland)",
        "Stripe Payments Europe, Limited, Ireland (payments, payouts, statutory identity verification)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxembourg (payments, where the controller activates them)",
        "Channex.io Ltd, United Kingdom (connection to booking portals, where activated)",
        "Meta Platforms Ireland Limited, Ireland (WhatsApp messages, where activated)",
        "Google Ireland Limited, Ireland (translation of content; sign-in with Google, where used)",
        "Groq, Inc., USA (suggested replies in the inbox, where activated)",
        "Cloudflare, Inc., USA (management of the DNS records for own domains, where used)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "We give notice of a change or an addition at least 30 days in advance. Within that period the controller may object for an important reason relating to data protection; if the objection is not resolved, it may terminate the part of the service concerned or the contract.",
          ],
        },
        {
          paragraphs: [
            "Services that the controller itself agrees with a third party are not sub-processing but a transfer initiated by the controller. This applies to a booking portal with which it has its own contract just as it does to an AI assistant or another program that it connects to its account via the interface (see section “Instructions”).",
            "What matters is not whose systems the data flows through but who brings in the service: sub-processing arises where WE engage a further service provider in order to provide our service. If the controller selects the service itself and concludes the contract with it, that service processes data for the controller — not for us. This distinction corresponds to the contractual practice of comparable providers for third-party services connected by the customer.",
          ],
        },
      ],
    },
    {
      heading: "Transfers to third countries",
      paragraphs: [
        "Transfers to recipients outside the EU are limited to the services listed above as being established in the USA or the United Kingdom. They are based on the standard data protection clauses of the European Commission under Article 46(2)(c) GDPR or on an applicable adequacy decision; supplementary protective measures (encryption, data minimisation) are applied.",
      ],
    },
    {
      heading: "Assistance to the controller",
      unterpunkte: [
        {
          paragraphs: [
            "We assist the controller in responding to requests from data subjects (Articles 15 to 22 GDPR). For this purpose the platform provides access, rectification, export and erasure of the data directly in the interface. If data subjects contact us directly, we refer them to the controller and inform the controller.",
          ],
        },
        {
          paragraphs: [
            "We also assist with data protection impact assessments, with compliance with the obligations under Articles 32 to 36 GDPR and with requests from supervisory authorities.",
          ],
        },
      ],
    },
    {
      heading: "Personal data breaches",
      paragraphs: [
        "If we become aware of a personal data breach affecting the controller’s data, we inform the controller without delay, at the latest within 48 hours of becoming aware of it, in text form.",
        "The notification contains, in so far as known, the nature and time of the incident, the categories of data and groups of persons affected, the likely consequences and the measures taken and proposed. We assist the controller with its notification and communication obligations under Articles 33 and 34 GDPR.",
      ],
    },
    {
      heading: "Evidence and audits",
      unterpunkte: [
        {
          paragraphs: [
            "We demonstrate compliance with this DPA on request, in particular by providing information on the measures taken and on the sub-processors engaged.",
          ],
        },
        {
          paragraphs: [
            "The controller may carry out audits to the extent necessary or have them carried out by an independent auditor who is not in competition with us. Audits take place after notice with reasonable advance warning, during normal business hours and without disrupting operations. The controller bears the cost of an audit going beyond the provision of information, unless the audit is prompted by an incident caused by us.",
          ],
        },
      ],
    },
    {
      heading: "Erasure and return",
      paragraphs: [
        "After the end of the contract we make the controller’s data available for export on request within 30 days in a common, machine-readable format. We then erase the data including the copies.",
        "Data subject to a statutory retention obligation is excluded (in particular invoicing and accounting data); it is blocked and erased once the period has expired. Backup copies are overwritten with the regular rotation cycle.",
      ],
    },
    {
      heading: "Liability and order of precedence",
      paragraphs: [
        "Article 82 GDPR applies. In the relationship between the parties, the liability rules of the Terms and Conditions apply in addition, in so far as they do not conflict with the GDPR.",
        "Where the Terms and Conditions and this DPA conflict in relation to processing on behalf of the controller, this DPA prevails. If a provision becomes invalid, the remaining content remains effective; the parties replace it with a permissible provision having the same purpose.",
      ],
    },
    {
      heading: "Amendments to this agreement",
      paragraphs: [
        "We may adapt this DPA in so far as this becomes necessary due to changes in the law, requirements of supervisory authorities, requirements of payment service providers or technical developments and the controller is not placed in a worse position as a result.",
        "We give notice of amendments in text form at least 30 days before they take effect. If the controller does not object within that period, they are deemed to be accepted; this consequence is pointed out in the notice. In the event of an objection, either party may terminate the contract with effect from the date on which the amendments take effect.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        `Please address enquiries regarding this agreement, instructions and notifications to [${ANBIETER.email}](mailto:${ANBIETER.email}) or to ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
