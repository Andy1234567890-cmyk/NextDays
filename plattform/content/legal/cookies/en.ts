import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Cookie Policy",
  stand: "Last updated: 18 August 2026",
  intro: [
    "This policy explains which cookies and similar technologies myBestDays uses, for what purpose, how long they are stored and how you can control them.",
    "It supplements the [Privacy Policy](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. What cookies are",
      paragraphs: [
        "Cookies are small text files that a website stores in your browser. Similar technologies are the browser's local storage and tracking pixels in emails.",
        "Cookies strictly necessary for operating the Platform may be set without your consent. For all others we obtain your consent (Article 5(3) of Directive 2002/58/EC).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Necessary cookies",
      paragraphs: [
        "These cookies are necessary for operation and cannot be switched off. We currently set:",
      ],
      list: [
        "“nd_access” — keeps you signed in. Readable only by the server (HttpOnly); lifetime corresponds to the validity of the session.",
        "“nd_refresh” — renews your sign-in so that you need not sign in repeatedly. Readable only by the server; lifetime 30 days.",
        "“nd_gast_locale” — remembers the language you selected. Lifetime one year.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Functional, statistical and marketing cookies",
      paragraphs: [
        "myBestDays currently sets no cookies for statistics, audience measurement or advertising and embeds no advertising networks or analytics services.",
        "Should this change, we will first obtain your consent through a selection dialogue in which refusing is as easy as agreeing, and we will extend this policy with the specific cookies.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Embedded third-party content",
      paragraphs: [
        "Maps may be embedded on detail pages. We load such content only once you expressly activate it; only then can data be transmitted to the respective provider.",
      ],
    },
    {
      id: "steuern",
      heading: "5. How to control cookies",
      paragraphs: [
        "You can change or withdraw your consent at any time via the cookie settings in the footer.",
        "In addition you can delete or block cookies in your browser. If you delete the necessary cookies you will be signed out and the Platform will function only in a limited way.",
      ],
    },
  ],
};
