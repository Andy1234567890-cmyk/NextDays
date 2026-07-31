import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Platform (Marketplace)",
  description: "Selling on the myBestDays marketplace.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Marketplace",
      articles: [
        {
          slug: "der-marktplatz",
          title: "The myBestDays Marketplace",
          excerpt: "The global myBestDays marketplace is its own booking channel alongside portals and website.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "The myBestDays Marketplace (/plattform) is myBestDays' own global booking channel — comparable to Booking or Airbnb, yet part of the same platform. Guests search properties from all connected businesses there and book directly.",
            },
            { type: "h2", text: "Not “Direct”, but an Equal Channel" },
            {
              type: "p",
              text: "The marketplace does not replace direct bookings via your own website. It is an independent, third sales channel with its own visibility axis, its own guest base, and its own commission — just like a portal, only operated by myBestDays itself.",
            },
            { type: "h2", text: "How Properties Get onto the Marketplace" },
            {
              type: "ul",
              items: [
                "The property must be active (property status allows sales).",
                "Marketplace visibility must be switched on — separate from portals and website.",
                "Availability must exist in the calendar for the desired period.",
              ],
            },
            { type: "h2", text: "Bookings from the Marketplace" },
            {
              type: "p",
              text: "A marketplace booking immediately blocks the corresponding nights on all other channels — just like a portal or website booking. It appears in your calendar and in your reservations like any other booking, marked with the “Platform” channel.",
            },
            {
              type: "note",
              variant: "info",
              text: "Stop-sell and an inactive property status apply across channels and also block the marketplace — independent of the marketplace visibility switch.",
            },
            {
              type: "p",
              text: "To learn how to enable a property for the marketplace, see [Listing a Property on the Marketplace](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Listing a Property on the Marketplace",
          excerpt: "Marketplace visibility is its own switch, separate from portals and website.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "You control visibility on the marketplace via a dedicated switch on the property — independent of whether the same property is also visible on portals or your website.",
            },
            { type: "h2", text: "How to List a Property" },
            {
              type: "steps",
              items: [
                "Open the property under Properties.",
                "Switch to the Visibility tab.",
                "Enable the Platform Marketplace switch.",
                "Check that the property status is active and calendar availability exists.",
              ],
            },
            { type: "h2", text: "Prerequisite: Complete Profile" },
            {
              type: "p",
              text: "The marketplace only shows properties with complete information — a cover photo, description, amenities, and base price must be stored. If required information is missing, the property remains invisible despite the switch being enabled.",
            },
            {
              type: "ul",
              items: [
                "At least one cover photo and a description",
                "Amenities from the category list",
                "Occupancy and base price in the stored property currency",
                "Calendar availability for the desired period",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Clicking Publish normally enables the marketplace, portals, and website together — you can turn the marketplace switch back off individually at any time afterward.",
            },
            { type: "h2", text: "Removing Visibility Again" },
            {
              type: "p",
              text: "If you disable the Platform Marketplace switch, the property disappears from the marketplace search. Already confirmed bookings remain unaffected and continue as usual, see [Marketplace Commission](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Marketplace Commission",
          excerpt: "A commission set out in your plan applies to every booking made through the marketplace.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "As with any booking portal, a commission applies to bookings made through the myBestDays Marketplace. It is calculated per booking and is independent of any commissions for portals.",
            },
            { type: "h2", text: "How the Commission Is Calculated" },
            {
              type: "p",
              text: "The amount depends on the commission set out in your business's plan. You can find the current rate at any time under Account in the Billing section — no flat rate is assumed there; instead, the rate actually applicable to your plan is shown.",
            },
            { type: "h2", text: "Where to View the Commission" },
            {
              type: "steps",
              items: [
                "Open Account in the menu.",
                "Switch to the Billing section.",
                "Open a marketplace booking to see revenue and commission in detail.",
                "Check the overview of commissions for the current billing period.",
              ],
            },
            { type: "h2", text: "Distinction from Portal Commissions" },
            {
              type: "ul",
              items: [
                "Marketplace commission applies exclusively to bookings via the myBestDays Marketplace.",
                "Portal bookings (Booking, Airbnb & Co.) are subject to the respective portal's terms.",
                "Website bookings are subject to the terms stored for your plan, without a marketplace commission.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "The commission is determined automatically from your plan. A missing or unclear plan results in a clear error message instead of an estimated value.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Guest Profile & Reviews",
          excerpt: "Marketplace guests have a profile with booking history and can leave reviews.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Guests who book via the myBestDays Marketplace create their own guest profile. It collects their bookings, messages with businesses, and reviews they have submitted — similar to a portal guest account.",
            },
            { type: "h2", text: "What You See as a Business" },
            {
              type: "p",
              text: "In the reservation details of a marketplace booking, you will find the guest profile with previous stays at your business and, if released by the guest, publicly visible reviews of other accommodations.",
            },
            { type: "h2", text: "Reviews After the Stay" },
            {
              type: "steps",
              items: [
                "After checkout, the guest receives a prompt to leave a review.",
                "The review appears on the property page in the marketplace after a brief check.",
                "As a business, you can respond publicly to every review.",
                "You can submit unfair or abusive reviews for review via Report.",
              ],
            },
            {
              type: "ul",
              items: [
                "Reviews are tied to an actual booking — no review without a stay.",
                "The guest rates cleanliness, communication, location, and value for money.",
                "Your response is visible to all marketplace visitors.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Good reviews directly affect your property's ranking in marketplace search — respond promptly and objectively to criticism.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Blocked People",
          excerpt: "A business can block a guest, preventing messages and bookings.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "If problems arise with a guest, you can block them as a business. A blocked person can no longer send you messages or create a new booking with your business.",
            },
            { type: "h2", text: "Blocking a Person" },
            {
              type: "steps",
              items: [
                "Open the message thread or reservation with the guest in question.",
                "Click Block Guest.",
                "Confirm the dialog — the block takes effect immediately.",
                "The blocked person then appears under Account in Blocked People.",
              ],
            },
            { type: "h2", text: "What the Block Does" },
            {
              type: "ul",
              items: [
                "The guest can no longer send new messages to your business.",
                "The guest can no longer create a new booking with your business.",
                "An ongoing booking with an arrival already confirmed within the next two weeks remains unaffected by the block, so the stay can proceed as arranged.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "The block applies exclusively to your business. Other businesses on the marketplace do not see the block and are not affected by it.",
            },
            { type: "h2", text: "Lifting a Block" },
            {
              type: "p",
              text: "Open Account and then Blocked People. Select the entry and click Lift Block — the guest can then send messages and book again.",
            },
          ],
        },
      ],
    },
  ],
};
