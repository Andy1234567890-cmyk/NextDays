import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Channel Manager",
  description: "Master portals and the channel manager.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Channel Manager",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Connect your first portal",
          excerpt: "How to enable a portal for a property for the first time.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point: you have created a property but have not yet connected a portal",
            },
            {
              type: "p",
              text: "Your property is fully set up in myNextDays but is not yet visible on any portal such as Booking.com or Airbnb. Before a portal will accept a property, your account needs a one-time, account-wide portal connection — after that, every additional property only needs a mapping.",
            },
            {
              type: "steps",
              items: [
                "Open /konto, section “Portals & Channel Manager”, and set up the account-wide connection with your business details",
                "Then open the property under /objekte and switch to the “Portals” tab",
                "Select the desired portal and map it to the matching room or offer type",
                "Check photos, amenities, pricing, and cancellation terms — portals require complete information",
                "Enable visibility; the status changes to “Connected” once the portal has reviewed it",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "You only set up the account-wide connection once. Details are covered in [Connect Booking.com](/hilfe/portale-kanalmanager/booking-verbinden) and [Connect Airbnb](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Connect Booking.com",
          excerpt: "How to make a property bookable on Booking.com via the channel manager.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point: your property should also become visible on Booking.com",
            },
            {
              type: "p",
              text: "Booking.com is one of the portals connected through the channel manager. It requires the account-wide portal connection — if that is already set up, you only need one mapping per property for Booking.com.",
            },
            {
              type: "steps",
              items: [
                "Open the property under /objekte, “Portals” tab",
                "Select “Booking.com” from the list of available portals",
                "Map the matching room or offer type and confirm at least one rate with price and cancellation terms",
                "Add a valid payment method for commission billing",
                "Enable visibility for Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Approval by Booking.com can take a few hours. The status in the “Portals” tab shows once the connection is active.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Connect Airbnb",
          excerpt: "How to make a property bookable on Airbnb via the channel manager.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point: your property should also become visible on Airbnb",
            },
            {
              type: "p",
              text: "Airbnb is connected through the account-wide connection just like any other portal. Once that is set up, you activate Airbnb per property via a mapping — regardless of whether the property is already visible on Booking.com or other portals.",
            },
            {
              type: "steps",
              items: [
                "Open the property under /objekte, “Portals” tab",
                "Select “Airbnb” from the list of available portals",
                "Confirm the property category and mapped offer type",
                "Add photos, amenities, and house rules — Airbnb requires complete information before approval",
                "Enable visibility for Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Without saved cancellation terms and house rules, Airbnb will reject the approval. Add this information to the property first.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Keep pricing in sync across all portals",
          excerpt: "One calendar is enough — the channel manager distributes price changes to all portals automatically.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point: you change a price and want to make sure it is correct everywhere",
            },
            {
              type: "p",
              text: "You maintain pricing exclusively in the myNextDays calendar of the property — never individually in the portals themselves. The channel manager automatically transmits every change to every portal the property is actively mapped to.",
            },
            {
              type: "steps",
              items: [
                "Open the pricing calendar or the rate plans of the property",
                "Adjust the daily rate, minimum stay, or arrival/departure restriction",
                "Save the change — it takes effect internally on the property first",
                "In the “Portals” tab, check that all desired portals are still actively mapped",
                "Wait a few minutes until the change has been transmitted to the portals",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Never enter prices directly in the portal — such changes will be overwritten by the myNextDays calendar at the next sync.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Import a portal booking",
          excerpt: "Portal bookings land in your calendar automatically — here is how you check that the import worked.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point: a guest has booked through a portal, and the booking should arrive in myNextDays",
            },
            {
              type: "p",
              text: "When a guest books through Booking.com, Airbnb, or another connected portal, the channel manager imports the reservation automatically — you do not need to transfer anything manually. This guide describes how to verify and confirm the import.",
            },
            {
              type: "steps",
              items: [
                "Open the calendar or the reservation list of the affected property",
                "Find the new reservation — it carries a source badge for the portal, such as Booking.com or Airbnb",
                "Check guest details, dates, and price for completeness",
                "Confirm that the booked nights are shown as blocked on all other channels",
                "If needed, open the booking details to edit add-ons or the guest's messages",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "If the guest cancels through the portal or changes the dates, that is also picked up automatically and the nights are released again.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Resolve a double booking",
          excerpt: "What to do if the same night was, in rare cases, sold on two channels.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point: two reservations overlap for the same property and the same nights",
            },
            {
              type: "p",
              text: "The channel manager normally blocks booked nights across channels immediately. A double booking can still occur, for example with simultaneous bookings on two portals at the same moment, or with a manually created reservation that collides with a portal booking.",
            },
            {
              type: "steps",
              items: [
                "Open the property's calendar and identify both overlapping reservations",
                "Check the booking time and source badge of both reservations",
                "Contact the guest who booked more recently and offer an alternative property or dates",
                "Cancel the untenable reservation in the respective portal, not only in myNextDays",
                "Set Stop-Sell for the affected nights afterward until the case is fully resolved",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Always cancel a portal booking through the portal itself — cancelling only in myNextDays releases the night internally but does not reliably inform the portal.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Temporarily pause a portal",
          excerpt: "Switch off visibility per portal individually, without losing the mapping.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point: a property should temporarily not be bookable on one portal",
            },
            {
              type: "p",
              text: "Visibility can be toggled per portal individually — independent of the website and the platform marketplace. If, for example, you want to pause Airbnb briefly while keeping Booking.com running, disable only that one channel.",
            },
            {
              type: "steps",
              items: [
                "Open the property under /objekte, “Portals” tab",
                "Find the entry for the portal you want to pause",
                "Switch off visibility for that portal",
                "Save — the change takes effect within a few minutes, and the property disappears from that portal's search results",
                "Switch visibility back on once the property should be bookable again",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "The mapping stays intact while paused — you will not need to set up the connection to the portal again later. To block all channels completely, use Stop-Sell instead.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Check the property mapping",
          excerpt: "How to check whether your property is still correctly matched to the right offer type in the portal.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point: pricing or availability on a portal no longer matches myNextDays",
            },
            {
              type: "p",
              text: "If the display in the portal differs from your myNextDays calendar, the cause is often a faulty or broken mapping — the link between your property and the room or offer type in the portal.",
            },
            {
              type: "steps",
              items: [
                "Open the property under /objekte, “Portals” tab",
                "Check the status of the affected portal — it should show “Connected”, not “Error” or “Pending”",
                "Confirm that the mapped room or offer type in the portal still matches the actual property",
                "If there is a mismatch: unlink the mapping and reassign it, then re-enable visibility",
                "After the fix, wait a few minutes and check pricing and availability in the portal again",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "A property can be mapped to several portals at once — if something looks off, check specifically the one affected portal, not all of them at once.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Different rates per portal",
          excerpt: "How to assign a portal its own rate plan without affecting the other channels.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point: you want to offer a different price on one portal than on the other channels",
            },
            {
              type: "p",
              text: "Rate plans can be assigned individually per portal, for example a non-refundable rate plan for one portal and a flexible one for another. Base pricing stays maintained centrally on the property; the mapping determines which rate plan goes to which portal.",
            },
            {
              type: "steps",
              items: [
                "In the property, create the additional rate plan with the desired terms (price, cancellation terms, minimum stay)",
                "Open the “Portals” tab and select the affected portal",
                "In the mapping, assign the new rate plan to this portal",
                "Leave the other portals unchanged on their existing rate plan",
                "Save and check the price display in the respective portal after a few minutes",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Each rate plan is transmitted independently — a change to one rate plan does not affect portals mapped to a different rate plan.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Fix common portal errors",
          excerpt: "Typical causes when a portal rejects a property or synchronization stalls.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point: a portal's status shows an error, or the property is not being accepted",
            },
            {
              type: "p",
              text: "Portals usually reject a connection because of missing company details or incomplete property information. Work through the most common causes in order before contacting support.",
            },
            {
              type: "steps",
              items: [
                "Under /konto, check whether address, tax information, and contact details are complete",
                "In the property, check whether the description, photos, amenities, and at least one rate are complete",
                "Check whether a valid payment method for commissions is on file",
                "Open the “Portals” tab and read the exact error message next to the affected portal",
                "Fix the stated gap and enable visibility again",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A portal error always affects only that one portal — the other channels keep running independently, as long as their own requirements are met.",
            },
          ],
        },
      ],
    },
  ],
};
