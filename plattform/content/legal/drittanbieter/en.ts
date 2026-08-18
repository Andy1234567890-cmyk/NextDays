import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Third-party providers and payment services",
  stand: "Last updated: 18 August 2026",
  intro: [
    "myBestDays uses third-party services to operate the Platform. This page names them and explains their role and whose terms apply in each case.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principle",
      paragraphs: [
        "Where a third party provides a service directly to you, its terms and its privacy policy apply in addition to ours. We point this out at the relevant place.",
        "Where a third party processes solely on our instructions, we remain your point of contact. Which processors we use is set out in the [Privacy Policy](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Payment service provider",
      paragraphs: [
        "Payments via the Platform are processed by Stripe. Stripe collects and processes payment data directly and is an independent controller in that respect. The [Stripe Privacy Policy](https://stripe.com/privacy) applies in addition.",
        "For payouts to hosts, Stripe carries out the identity verification required by law.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Payment Services Directive and third-party access",
      paragraphs: [
        "Directive (EU) 2015/2366 (“PSD2”) requires strong customer authentication for many payments. Your bank or card issuer carries it out; without successful authentication a payment may be declined.",
        "myBestDays is not a payment initiation or account information service and does not access your bank accounts.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Maps, images and embedded content",
      paragraphs: [
        "For map displays and location information we embed third-party map services. Loading such content may transmit data to the respective provider; details and the consent controls are set out in the [Cookie Policy](https://mybestdays.dk/rechtliches/cookies).",
        "Images and descriptions in listings come from the respective provider, not from us.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Linked sites",
      paragraphs: [
        "The Platform may link to third-party sites. We have no influence over their content and accept no responsibility for it. Once we become aware of an infringement we remove the link without delay.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. App stores",
      paragraphs: [
        "If you obtain the myBestDays app through an app store, the terms of the respective store operator apply in addition. The store operator is not a party to the contract between you and us and owes neither support nor warranty for the app.",
      ],
    },
  ],
};
