import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Account & Subscription",
  description: "Business details, plan, security, and 2FA.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Account",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Business details",
          excerpt: "Manage your business’s company name, address, and contact details in one place.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Under /konto, myNextDays bundles all business and account functions as sections on a single page — you don’t need to switch between many subpages. Your business details form the foundation here: company name, legal form, address, and contact details, which are used for invoices, portals, and communication with guests.",
            },
            { type: "h2", text: "Opening and editing your business details" },
            {
              type: "steps",
              items: [
                "Open /konto.",
                "Switch to the “Business details” section.",
                "Check the company name, address, phone number, and email address for follow-up questions.",
                "Make your changes.",
                "Save the section.",
              ],
            },
            { type: "h2", text: "Why this data matters" },
            {
              type: "p",
              text: "Your business details feed into invoices, registration with connected portals, and legally required information such as the imprint. An incomplete or outdated address can cause invoices to be issued incorrectly or portal connections to be delayed.",
            },
            {
              type: "ul",
              items: [
                "Company name and legal form appear on every invoice issued.",
                "The address is required for registering with portals.",
                "Contact details serve as a fallback route if system notifications don’t arrive.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "If you change your billing address, then check the invoices already issued under [Billing & rate calculator](/hilfe/konto-abo/abrechnung-tarifrechner) — existing invoices are not adjusted retroactively.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Subscription & plan",
          excerpt: "Your plan determines your property quota — you can see the number of properties booked in your account at any time.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Your myNextDays subscription includes a property quota: the maximum number of properties (rooms or vacation rentals) you can actively manage at the same time. The number of properties currently booked is shown in the “Subscription & plan” section under /konto, together with the remaining quota.",
            },
            { type: "h2", text: "Keeping an eye on your quota" },
            {
              type: "p",
              text: "The quota is enforced server-side: once you reach your plan’s upper limit, you cannot create another property until you deactivate an existing property or upgrade your plan. This applies regardless of whether the new property is a room or a vacation rental — both count equally toward the quota.",
            },
            {
              type: "steps",
              items: [
                "Open /konto and the “Subscription & plan” section.",
                "Check the number of properties booked against your plan’s quota.",
                "If needed, choose a larger plan to create more properties.",
                "Confirm the plan change.",
              ],
            },
            {
              type: "ul",
              items: [
                "Each property counts individually toward the quota, regardless of property type.",
                "A plan change takes effect immediately on your available quota.",
                "A downgrade is only possible if the number of active properties fits the new quota.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A downgrade to a plan with a smaller quota is rejected as long as more properties are active than the new plan allows. Deactivate excess properties first.",
            },
            {
              type: "note",
              variant: "info",
              text: "For details on invoices and plan calculations, see [Billing & rate calculator](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Billing & rate calculator",
          excerpt: "Billing address, past invoices, and the rate calculator for your property quota.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "The “Billing & rate calculator” section under /konto brings together everything related to invoicing: your billing address, the list of past invoices for download, and a rate calculator that lets you work out the cost of your current or a larger property quota.",
            },
            { type: "h2", text: "Billing address and invoices" },
            {
              type: "p",
              text: "The billing address can differ from your business address, for example if a tax office receives your receipts. Invoices already issued are listed in chronological order; each one can be downloaded as a PDF.",
            },
            { type: "h2", text: "Using the rate calculator" },
            {
              type: "steps",
              items: [
                "Open /konto and the “Billing & rate calculator” section.",
                "Enter the desired number of properties into the rate calculator.",
                "Compare the resulting costs for each plan tier.",
                "If needed, switch directly from the calculator to the matching plan.",
              ],
            },
            {
              type: "ul",
              items: [
                "The rate calculator shows costs in the currency stored for your account.",
                "Invoices remain available for download indefinitely.",
                "The billing address can be maintained independently of the business details.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Use the rate calculator regularly to check whether your property quota still matches the number of properties actually booked — see [Subscription & plan](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Changing password & email",
          excerpt: "Security-critical changes require you to re-authenticate and confirm a further step.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Your password and email address are among the most security-critical details in your account. myNextDays therefore requires re-authentication for both changes — you confirm the change with your current password, even if you are already signed in.",
            },
            { type: "h2", text: "Changing your password" },
            {
              type: "steps",
              items: [
                "Open /konto and the “Change password & email” section.",
                "Enter your current password to confirm.",
                "Set your new password and repeat it.",
                "Save the change.",
              ],
            },
            { type: "h2", text: "Changing your email address" },
            {
              type: "p",
              text: "Changing your email address works as a double opt-in: after confirming your current password, you receive a confirmation link at the NEW address. The change only takes effect once you click this link — the old address stays active until then, so access to your account is never interrupted.",
            },
            {
              type: "ul",
              items: [
                "Neither the password nor the email can be changed without your current password.",
                "The confirmation link for the new email address is valid for a limited time only.",
                "Until confirmed, the previous email address remains active for sign-in and notifications.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "After changing your email, also check your two-factor authentication — see [Two-factor authentication](/hilfe/konto-abo/zwei-faktor) — in case recovery codes were tied to the old address.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Two-factor authentication",
          excerpt: "An extra sign-in step protects your account from unauthorized access.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Two-factor authentication (2FA) adds a second factor to your password via an authenticator app. This means a stolen password alone is no longer enough to sign in to your myNextDays account.",
            },
            { type: "h2", text: "Setting up 2FA" },
            {
              type: "steps",
              items: [
                "Open /konto and the “Two-factor authentication” section.",
                "Confirm your current password to re-authenticate.",
                "Scan the displayed QR code with an authenticator app.",
                "Enter the generated code to confirm.",
                "Store the displayed recovery codes in a safe place.",
              ],
            },
            { type: "h2", text: "Disabling 2FA" },
            {
              type: "p",
              text: "Disabling two-factor authentication also requires re-authentication with your current password. This prevents anyone with an already open session from simply turning off your protection.",
            },
            {
              type: "ul",
              items: [
                "Recovery codes provide access if the authenticator app is lost.",
                "Each recovery code can only be used once.",
                "Both enabling and disabling 2FA equally require password confirmation.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Keep your recovery codes separate from the device with the authenticator app, for example in a password manager.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Device history",
          excerpt: "Keep track of which devices your account is signed in on.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "The device history under /konto shows you which devices your account is currently signed in on — with device type, approximate location, and time of last activity. This lets you quickly recognize whether a sign-in actually came from you.",
            },
            { type: "h2", text: "Checking your device history" },
            {
              type: "steps",
              items: [
                "Open /konto and the “Device history” section.",
                "Review the list of signed-in devices.",
                "If you spot an unfamiliar device, sign it out.",
                "As a precaution, then change your password.",
              ],
            },
            { type: "h2", text: "When it’s worth taking a look" },
            {
              type: "p",
              text: "Check the device history especially after a password or email change, and after using a shared or public device. An unfamiliar entry is a clear warning sign of unauthorized access.",
            },
            {
              type: "ul",
              items: [
                "Each entry shows device type, approximate location, and last activity.",
                "Individual devices can be signed out selectively without affecting the others.",
                "An unrecognized device is reason for an immediate password change.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "If you don’t recognize a device, sign it out immediately and then change your password under [Changing password & email](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Privacy",
          excerpt: "Control search engine indexing per property and export your data.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "In the “Privacy” section under /konto, you control two things: whether your property pages may be indexed by search engines, and how you can export the data stored about you at myNextDays.",
            },
            { type: "h2", text: "Search engine indexing per property" },
            {
              type: "p",
              text: "Search engine indexing is disabled by default for new properties. Only once you deliberately enable it for a property may search engines such as Google add the public property page to their index. This keeps you in control of which properties can be found outside of portals and your own platform.",
            },
            {
              type: "steps",
              items: [
                "Open /konto and the “Privacy” section.",
                "Select the desired property from the list.",
                "Turn search engine indexing on or off.",
                "For multiple properties, use the bulk switch to set them all consistently.",
              ],
            },
            { type: "h2", text: "Exporting your data" },
            {
              type: "p",
              text: "The data export function lets you request a complete copy of the data stored in your account. The export is compiled and then made available to you for download.",
            },
            {
              type: "ul",
              items: [
                "Indexing can be controlled individually per property, with a bulk switch for all properties.",
                "New properties always start without search engine indexing.",
                "The data export contains your account and property data in structured form.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Search engine indexing is independent of visibility on portals and your own marketplace — it affects only the public property page in search engines.",
            },
          ],
        },
      ],
    },
  ],
};
