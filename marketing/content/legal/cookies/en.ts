// Englische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Cookie Policy",
  metaDescription:
    "Which cookies myNextDays sets: strictly necessary and functional cookies only, no tracking or advertising cookies.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `This policy explains which cookies and comparable storage technologies ${ANBIETER.firma} uses on this website and in the myNextDays platform.`,
    "In short: we use only strictly necessary and functional cookies. There are no analytics, advertising or tracking cookies, and no usage data is shared with advertising networks.",
  ],
  sections: [
    {
      heading: "What cookies are",
      paragraphs: [
        "Cookies are small text files that a website stores in the browser. They make it possible to recognise a session again — for example, so that you stay logged in after signing in. Besides cookies, browsers use other storage such as local storage, which works in a technically similar way.",
      ],
    },
    {
      heading: "What we need your consent for",
      paragraphs: [
        "Consent is required under § 9 of the Danish Cookie Executive Order (Cookie-bekendtgørelsen) (implementing Article 5(3) of Directive 2002/58/EC) only where access to your device does not serve exclusively to carry out the transmission of a communication or is not strictly necessary for a service you have explicitly requested.",
        "All cookies we set are required for logging in, session security, or a setting you have chosen yourself — we do not ask for consent for these, and conversely we do not set anything that would require consent.",
        "There is exactly one thing you must consent to: the spam protection on our contact form. It comes from Google (reCAPTCHA Enterprise), so it is an external service, and it is loaded only once you have allowed it. A bar at the bottom of the screen asks for this — on your first visit, with equally weighted buttons for reject and accept and no pre-selection. Until you have decided, “not allowed” applies.",
        "Your decision is stored in your browser's memory (local storage, value “nd_consent”); it contains only the category, the timestamp and a version number, no identifier of your person. At the bottom of this page you can change or withdraw it at any time.",
      ],
    },
    {
      heading: "This website",
      paragraphs: [
        "The marketing website does not set any cookies. Fonts and icons are hosted on our own server — no third-party icon or font service is called for this. The only external service on this page is the spam protection on the contact form, and it loads only with your consent. Details are set out in the [Privacy Policy](/datenschutz).",
      ],
    },
    {
      heading: "Platform cookies",
      paragraphs: [
        "As soon as you log in to the dashboard, the marketplace or the mobile view, the following cookies are set:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — Login (strictly necessary)",
          list: [
            "Purpose: identifies your logged-in session to the server.",
            "Content: short-lived access token; readable only by the server (HttpOnly), transmitted only over HTTPS.",
            "Duration: session, or until the token expires.",
          ],
        },
        {
          titel: "nd_refresh — Session renewal (strictly necessary)",
          list: [
            "Purpose: renews the access token so you don't have to keep logging in again.",
            "Content: refresh token; HttpOnly, HTTPS only.",
            "Duration: until logout or expiry.",
          ],
        },
        {
          titel: "nd_locale — Language selection (functional)",
          list: [
            "Purpose: remembers the language you have chosen.",
            "Content: language code, e.g. “de” or “en”.",
            "Duration: until changed or deleted.",
          ],
        },
        {
          titel: "sidebar_state — Sidebar (functional)",
          list: [
            "Purpose: remembers whether the navigation bar is expanded or collapsed.",
            "Content: “true” or “false”.",
            "Duration: until changed or deleted.",
          ],
        },
        {
          titel: "sb-… — Login with Google (strictly necessary, only if used)",
          list: [
            "Purpose: maintains the session when you log in via Google.",
            "Content: session token of the login service.",
            "Duration: session, or until the token expires. Set only if you choose Google login.",
          ],
        },
      ],
    },
    {
      heading: "Local Storage",
      unterpunkte: [
        {
          titel: "nd_consent",
          paragraphs: [
            "Stores your decision about the contact form's spam protection so the consent bar doesn't ask again on every visit. Only the category, the timestamp and a version number are stored. The value never leaves your device and is not transmitted to our server; it applies to this browser. If you delete it, the bar will ask again on your next visit.",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Set only if you open the chat on this website yourself and send a message. It is the key to your own conversation — without it you would not be able to find our reply again after navigating to another page. It contains no information about you and is used only for this purpose.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Stores in the browser whether you have consented to the use of voice input, so consent is not asked for again on every visit. The value never leaves your device.",
          ],
        },
      ],
    },
    {
      heading: "Cookies in the mobile app",
      paragraphs: [
        "The mobile app does not use cookies. Access and refresh tokens are stored in the device's secure key store (iOS Keychain, Android Keystore) and deleted on logout.",
      ],
    },
    {
      heading: "Third-party cookies",
      paragraphs: [
        "When you make a payment, the payment provider (Stripe or PayPal) may set cookies on its own page that are required for processing and fraud prevention. The respective provider's terms apply to these.",
        "On websites that operators build with our site builder, the respective operator decides on any additional cookies and is responsible for the notices shown there.",
      ],
    },
    {
      heading: "Deleting and controlling cookies",
      paragraphs: [
        "You can delete or block cookies at any time in your browser settings. If you block the necessary cookies, logging in to the platform is not technically possible — the public website and the marketplace remain usable without logging in.",
        "When you log out, we remove the login cookies ourselves.",
      ],
    },
    {
      heading: "Changes to this policy",
      paragraphs: [
        "If features are added that require additional cookies, we will update this list. The version published here always applies; the date above shows its status.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
