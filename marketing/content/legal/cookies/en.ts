// Englische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Cookie Policy",
  metaDescription:
    "Which cookies myNextDays sets: strictly necessary cookies plus — only with your consent — functional, analytical and marketing cookies. Every category can be switched on and off individually.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `This policy explains which cookies and comparable storage technologies ${ANBIETER.firma} uses on this website and in the myNextDays platform.`,
    "In short: strictly necessary are only the cookies without which the website cannot work as requested. Everything else needs your consent and does not load without it — the spam protection on our contact form, the audience measurement, and the marketing cookies we use to measure how our advertising performs. You can allow or refuse each of these categories individually and withdraw your decision at any time.",
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
        "You need to consent to three categories, none of which loads without your permission: the spam protection on our contact form (reCAPTCHA by Google), the audience measurement on this website (Google Analytics 4) and the marketing cookies (Meta, LinkedIn, Google Ads). A window with a category list asks for this — on your first visit, with no pre-selection and a separate switch for each category. Until you have decided, “not allowed” applies, and nothing is measured or advertised.",
        "Your decision is stored in your browser's memory (local storage, value “nd_consent”); it contains only the category, the timestamp and a version number, no identifier of your person. Via the cookie icon at the bottom left of every page, you can change or withdraw it at any time. After six months we will ask again — a consent should not remain valid indefinitely.",
      ],
    },
    {
      heading: "This website",
      paragraphs: [
        "By itself this website sets no cookies. Fonts and icons are hosted on our own server — no third-party icon or font service is called for this. Only the services you allow are added: the spam protection on the contact form, the audience measurement and the marketing services. Which cookies they set, for how long and on which host is listed below under “Third-party cookies”. You can withdraw via the cookie icon at the bottom left — the service in question stops immediately and its cookies are deleted. Details are set out in the [Privacy Policy](/datenschutz).",
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
            "Records your decision about the services requiring consent — the spam protection on the contact form and the audience measurement — so the consent bar does not ask again on every visit. Only the categories, the timestamp and a version number are stored. The value never leaves your device and is not transmitted to our server; it applies to this browser. Lifetime: six months — after that the bar asks again. If you delete the value, it asks again on your next visit.",
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
        "Only with your consent do Google services set the following cookies on this website — two for the audience measurement, one for the spam protection. Without your consent the respective script is not loaded and none of these cookies is set; if you withdraw, we delete them.",
      ],
      unterpunkte: [
        {
          titel: "_fbp - Ad success measurement (consent required)",
          list: [
            "Purpose: Associates your visit with an advertisement so we can measure the success of our campaigns.",
            "Content: A randomly generated identifier; no name, email, or account information from us.",
            "Provider: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Ireland.",
            "Host: mynextdays.com (first-party cookie, set by Meta's script). Duration: approximately three months.",
          ],
        },
        {
          titel: "_gcl_au - Google Ads success measurement (consent required)",
          list: [
            "Purpose: Associates your visit with a Google ad so we can measure the success of our campaigns.",
            "Content: A randomly generated identifier with no personal reference.",
            "Provider: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland.",
            "Host: mynextdays.com (first-party cookie). Duration: approximately three months.",
          ],
        },
        {
          titel: "li_gc and bcookie - LinkedIn advertising (consent required)",
          list: [
            "Purpose: Identifies your browser to LinkedIn so that ads and their success can be attributed; li_gc also stores your consent there.",
            "Content: A browser identifier and the consent status; no information from your account with us.",
            "Provider: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Ireland.",
            "Host: linkedin.com (third-party cookies). Duration: approximately six months or one year.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — spam protection on the contact form (consent required)",
          list: [
            "Host: www.google.com (third-party cookie).",
            "Purpose: lets Google run the risk assessment that separates automated bulk messages from genuine enquiries.",
            "Content: an identifier generated by Google for that assessment; no name, email or account details from us.",
            "Provider: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland.",
            "Lifetime: set by Google, up to six months. It is only set once you have allowed the spam protection and opened the contact form.",
          ],
        },
        {
          titel: "_ga — audience measurement (consent required)",
          list: [
            "Host: mynextdays.com (first-party cookie, set by Google's script).",
            "Purpose: distinguishes visitors so that repeat visits are not counted twice.",
            "Content: a randomly generated identifier unrelated to your person; no name, email or account details.",
            "Provider: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland.",
            "Lifetime: up to two years.",
          ],
        },
        {
          titel: "_ga_<id> — measurement session state (consent required)",
          list: [
            "Host: mynextdays.com (first-party cookie, set by Google's script).",
            "Purpose: records when your current visit started, so page views of one session belong together.",
            "Content: session timestamp and counter; the id in the name identifies our property, not you.",
            "Provider: Google Ireland Limited.",
            "Lifetime: up to two years.",
          ],
        },
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
