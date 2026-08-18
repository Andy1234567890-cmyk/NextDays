import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Content Policy",
  stand: "Last updated: 18 August 2026",
  intro: [
    "This policy applies to all content that users post on myBestDays: listings, photos, reviews, messages, profile details and responses to reviews.",
    "It forms part of the [Terms of Service](https://mybestdays.dk/rechtliches/nutzungsbedingungen). A breach may lead to removal of the content and to measures against the account.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. What is not permitted",
      paragraphs: ["The following content in particular is not permitted on myBestDays:"],
      list: [
        "illegal content of any kind, in particular incitement to criminal offences, terrorist content and child sexual abuse material;",
        "content inciting hatred or violence against persons or groups on grounds of origin, colour, religion, belief, sex, gender identity, sexual orientation, disability or age;",
        "insults, threats, harassment and the targeted exposure of individuals;",
        "third-party personal data without their consent, in particular names, addresses, telephone numbers, identity or payment data;",
        "misleading statements about an accommodation, its location, amenities, size or availability;",
        "third-party photos, texts or trade marks without the necessary rights;",
        "advertising, spam and content directing users to booking routes outside the Platform;",
        "malware, phishing attempts and links to such content;",
        "offers for anything other than an accommodation service.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Photos",
      paragraphs: [
        "Photos must show the accommodation actually offered and must have been taken in a condition corresponding to the current one.",
        "Photos must not show identifiable persons without their consent. Editing is permitted provided it does not distort the impression of the accommodation — brightening yes, a retouched neighbouring building no.",
        "Camera-based surveillance inside the accommodation must be disclosed in the listing. In interior spaces where guests have a legitimate expectation of privacy — bedrooms, bathrooms — cameras are not permitted, even when switched off.",
      ],
    },
    {
      id: "melden",
      heading: "3. Reporting content",
      paragraphs: [
        "If you consider content illegal or in breach of this policy, you can report it using the reporting function on every listing, review and message.",
        "The notice and action mechanism under Article 16 of Regulation (EU) 2022/2065 and how notices are handled are described under [Digital Services Act](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. How we enforce",
      paragraphs: [
        "We review every reported item and choose the mildest suitable measure: a warning, removal of the part concerned, removal of the entire content, restriction of visibility, disabling of a function or suspension of the account.",
        "Repeated or serious breaches weigh more heavily. Where content is manifestly illegal or persons are at risk we act immediately.",
        "We give reasons for every measure to the person concerned and inform them of the complaint route. Complaints are handled by people.",
      ],
    },
  ],
};
