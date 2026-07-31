import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Getting Started",
  description: "Set up your account and get going in just a few minutes.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Setup",
      articles: [
        {
          slug: "willkommen",
          title: "Welcome to myNextDays",
          excerpt: "An overview of the PMS, channel manager, marketplace, and app.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "myNextDays is your central platform for vacation rentals and hotels. Instead of juggling several disconnected tools, you manage availability, pricing, reservations, and guest communication in one place — whether you run a single vacation home or several hotel rooms.",
            },
            { type: "h2", text: "The four building blocks" },
            {
              type: "ul",
              items: [
                "PMS (Property Management System): properties, calendar, pricing, reservations, tasks, and payments.",
                "Channel manager: connection to portals such as Booking, Airbnb & Co. — enter data once, keep many portals in sync.",
                "Platform marketplace: the myBestDays marketplace itself, an equal booking channel alongside the portals.",
                "App: the mobile application for guests, owners, and staff, working from the same data as the web app.",
              ],
            },
            { type: "h2", text: "How the building blocks work together" },
            {
              type: "p",
              text: "You maintain property details, pricing, and availability once, centrally, in the PMS. From there, myNextDays automatically distributes the data to every active channel. A booking — no matter which channel it comes through — immediately blocks the corresponding nights everywhere, so double bookings cannot happen.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Start by setting up your account and business, then create your first property — this order saves you corrections later.",
            },
            { type: "h2", text: "Next steps" },
            {
              type: "steps",
              items: [
                "Open Account in the menu and complete your business details.",
                "Create your first property under Properties.",
                "Check amenities, photos, and pricing for completeness.",
                "Click Publish to make the property visible on all channels.",
              ],
            },
            {
              type: "p",
              text: "For more on each step, see [Set up your account & business](/hilfe/erste-schritte/konto-einrichten) and [Create your first property](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Set up your account & business",
          excerpt: "Enter your company details, billing address, and currency correctly.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Before creating properties, set up your business under Account. This information is needed for invoices, portals, and billing with myNextDays, so it should be complete and accurate.",
            },
            { type: "h2", text: "Enter your company details" },
            {
              type: "steps",
              items: [
                "Open Account in the menu.",
                "Under Company details, enter your company name (or sole-trader name), address, and contact information.",
                "Add your billing address — it appears on every invoice issued.",
                "Choose your base currency. This applies to all pricing until you change it for an individual property.",
              ],
            },
            { type: "h2", text: "Why the currency matters" },
            {
              type: "p",
              text: "The currency is never guessed or filled in automatically: without it, no price can be displayed or billed correctly. That is why myNextDays requires a deliberate choice during setup instead of applying a default value.",
            },
            {
              type: "note",
              variant: "warn",
              text: "If you change a property's currency afterward, every rate plan attached to it is converted along with it. Double-check pricing afterward.",
            },
            { type: "h2", text: "Billing address & invoicing" },
            {
              type: "p",
              text: "Under Billing in Account, you can see your current invoices and your saved billing address. Keep this up to date, especially after a change of legal form or address, so invoices are issued correctly.",
            },
            {
              type: "ul",
              items: [
                "Company name or sole-trader name",
                "Billing address including country",
                "Tax or VAT ID, if applicable",
                "Base currency for new properties",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Create your first property",
          excerpt: "A step-by-step guide to creating your first bookable property.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "A property in myNextDays is always exactly one bookable unit: either a single hotel room or a complete vacation rental. If you run a hotel with multiple rooms, create a separate property for each room.",
            },
            { type: "h2", text: "Create a property" },
            {
              type: "steps",
              items: [
                "Open Properties in the menu.",
                "Click Add property.",
                "Choose the property type: category, property category, and offer type.",
                "Add the address, occupancy, and base price in your saved currency.",
                "Save the property as a draft to complete it later.",
              ],
            },
            { type: "h2", text: "What is still missing afterward" },
            {
              type: "p",
              text: "A newly created property starts out as a draft and is not visible on any channel. Add amenities, photos, a description, and calendar availability before publishing it — only a complete property can be marketed reliably.",
            },
            {
              type: "ul",
              items: [
                "Select amenities from the category list",
                "Add at least one cover photo and a description",
                "Enter occupancy (adults, children, beds) correctly",
                "Check the base price and calendar availability",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "If you run several room types, repeat this process for each individual room — there is no overarching building level with rooms underneath it.",
            },
            {
              type: "p",
              text: "Once all required fields are filled in, you can publish the property — see [Publish a property](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Publish a property",
          excerpt: "One click activates the platform marketplace, portals, and website together.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Publishing makes a property visible and bookable. In most cases, a single click is enough to activate all three sales channels at once — but you can adjust visibility per channel individually at any time.",
            },
            { type: "h2", text: "How to publish" },
            {
              type: "steps",
              items: [
                "Open the property under Properties.",
                "In the Overview tab, check that all required fields are marked green.",
                "Click Publish.",
                "Confirm the dialog — the platform marketplace, portals, and website are activated.",
              ],
            },
            { type: "h2", text: "Control channels individually" },
            {
              type: "p",
              text: "After publishing, you will find three separate toggles in the Visibility tab: Website, Platform marketplace, and Portals. If, for example, you want to offer a property only on your own website but not through portals, simply switch off that one toggle.",
            },
            {
              type: "ul",
              items: [
                "Website: visibility on your own myNextDays website",
                "Platform marketplace: visibility on the global myBestDays marketplace",
                "Portals: visibility on Booking, Airbnb & Co.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "These three toggles are independent of the property status (active/inactive). An active property can still be invisible on individual channels.",
            },
            { type: "h2", text: "Temporarily block a property" },
            {
              type: "p",
              text: "If you want to block a single day rather than the entire property, use Stop-Sell in the calendar — this blocks the day on all channels at once, regardless of the visibility toggles.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Understanding the three sales channels",
          excerpt: "Portals, platform marketplace, and app at a glance.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "myNextDays markets every property through several equal channels at the same time. Understanding how these work together helps you control visibility and pricing precisely.",
            },
            { type: "h2", text: "Portals" },
            {
              type: "p",
              text: "Through the channel manager, you connect your property to major booking portals such as Booking, Airbnb & Co. Availability and pricing are synchronized automatically, so you never have to maintain multiple portal calendars by hand.",
            },
            { type: "h2", text: "Platform marketplace" },
            {
              type: "p",
              text: "The myBestDays marketplace is its own, global booking channel — comparable to Booking or Airbnb, yet part of the same platform. It is not a “direct booking” substitute, but an equal channel with its own visibility axis.",
            },
            { type: "h2", text: "App" },
            {
              type: "p",
              text: "The mobile app gives guests, owners, and staff access to the same data as the web app — such as booking details, messages, or tasks, depending on their role.",
            },
            { type: "h2", text: "Three separate visibility axes" },
            {
              type: "ul",
              items: [
                "Website — your own myNextDays website",
                "Platform marketplace — the global myBestDays marketplace",
                "Portals — Booking, Airbnb & Co. via the channel manager",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "All three axes can be toggled independently of each other. Stop-Sell and the property status, by contrast, act across all three channels at once.",
            },
          ],
        },
      ],
    },
  ],
};
