import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Calendar & Availability",
  description: "Availability calendar, stop-sell, and minimum stay.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Calendar",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Reading the Availability Calendar",
          excerpt: "How to correctly read bookings, availability, and prices in the availability calendar.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "The availability calendar shows you at a glance which nights are booked, available, or blocked. For vacation rentals you see one row per property; for hotels, a nested view with one row per room category and rate plan.",
            },
            { type: "h2", text: "Layout of the View" },
            {
              type: "steps",
              items: [
                "Open the calendar via the “Availability Calendar” menu item.",
                "Select the period you want to view at the top.",
                "Filter by individual properties or room categories if needed.",
                "Click on a day to open details on price and availability.",
                "Click on a booked period to open the associated reservation.",
              ],
            },
            { type: "h2", text: "Colors and Symbols" },
            {
              type: "ul",
              items: [
                "Booked: the period is reserved by a booking.",
                "Available: the day can be booked on all active channels.",
                "Blocked: the day cannot be booked due to stop-sell or a manual block.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Each row in the availability calendar represents exactly one bookable unit — a room or a vacation rental. There is no container row for multiple rooms at once.",
            },
            {
              type: "note",
              variant: "tip",
              text: "For more on opening and closing individual days, see [Setting Availability](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Setting Availability",
          excerpt: "Open and close individual days or periods as needed.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Availability determines whether a property can be booked on a specific day. You can open or close individual days or entire periods directly in the availability calendar.",
            },
            { type: "h2", text: "Editing a Period" },
            {
              type: "steps",
              items: [
                "Open the availability calendar for the desired property.",
                "Select the desired period by clicking and dragging.",
                "Choose “Change Availability” from the action menu.",
                "Confirm whether the period should be opened or closed.",
                "Save the change.",
              ],
            },
            { type: "h2", text: "Impact on Channels" },
            {
              type: "p",
              text: "An availability change affects all sales channels on which the property is visible: portals such as Booking, Airbnb & Co., the platform's own marketplace, and the app. Transmission to the portals happens automatically in the background.",
            },
            {
              type: "ul",
              items: [
                "Open: the day becomes bookable on all active channels.",
                "Close: the day disappears from bookability but remains visible in the calendar.",
                "Existing bookings are not affected by an availability change.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Do not close a period with the intent of blocking it completely and permanently for sale — stop-sell is the right feature for that, see [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-Sell",
          excerpt: "Stop-sell immediately blocks a day across all sales channels at once.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Stop-sell is the fastest way to take a single day completely out of sale. Unlike a plain availability change, stop-sell acts hard and immediately across all channels at once — on the portals, the platform's own marketplace, and in the app.",
            },
            { type: "h2", text: "Setting Stop-Sell" },
            {
              type: "steps",
              items: [
                "Open the availability calendar for the affected property.",
                "Select the desired day or period.",
                "Click “Activate Stop-Sell” in the action menu.",
                "Confirm the block.",
              ],
            },
            { type: "h2", text: "When Stop-Sell Makes Sense" },
            {
              type: "ul",
              items: [
                "Short-term maintenance work or technical issues at the property.",
                "A special case where you want no new booking immediately and without exception.",
                "A quick, platform-wide emergency block, without editing each channel individually.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-sell has no channel-specific exception: if a day is blocked, no guest can book through any channel, not even at the front desk or via a direct inquiry.",
            },
            {
              type: "note",
              variant: "info",
              text: "For permanent personal use or planned maintenance, use [Manual Block](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung) instead.",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Minimum & Maximum Stay",
          excerpt: "How long guests may book at minimum or maximum.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "With minimum and maximum stay, you set how many nights a guest can book at minimum or maximum for a given arrival day. This helps avoid short gap bookings or position your property specifically for longer stays.",
            },
            { type: "h2", text: "Setting Up a Rule" },
            {
              type: "steps",
              items: [
                "Open the availability calendar or the “Prices” tab for the property.",
                "Select the affected period.",
                "Enter the minimum number of nights under “Minimum Stay”.",
                "Optionally enter a maximum number of nights under “Maximum Stay”.",
                "Save the rule.",
              ],
            },
            { type: "h2", text: "Typical Use Cases" },
            {
              type: "ul",
              items: [
                "High season: higher minimum stay to bundle changeover days.",
                "Low season: lower minimum stay to allow more bookings.",
                "Maximum stay: useful when a property needs to be free afterward for maintenance or other use.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "The rule applies to the arrival day: a guest cannot arrive for only two nights on a day with a three-night minimum stay, even if the individual days are available.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Combine longer minimum stays with [Length-of-Stay Discounts](/hilfe/preise-raten/aufenthaltsrabatte) to increase the incentive for guests.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Manual Block",
          excerpt: "Reserve periods specifically for personal use or maintenance.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "A manual block reserves a period on the calendar without an actual guest booking — for example for personal use, planned maintenance work, or renovations. The period is displayed in the availability calendar like a booking, but is clearly recognizable as a block.",
            },
            { type: "h2", text: "Creating a Block" },
            {
              type: "steps",
              items: [
                "Open the availability calendar for the affected property.",
                "Select the desired period.",
                "Choose “Block Manually” from the action menu.",
                "Enter a reason, e.g. “Personal use” or “Maintenance”.",
                "Save the block.",
              ],
            },
            { type: "h2", text: "Difference from Stop-Sell" },
            {
              type: "p",
              text: "A manual block specifically reserves a period for a particular, documented purpose and can be released again later. For an immediate, platform-wide emergency block without a documented period, stop-sell is the intended feature instead.",
            },
            {
              type: "ul",
              items: [
                "Manual block: planned, with a reason, for personal use or maintenance.",
                "Can be released at any time once the period is no longer needed.",
                "Blocked nights do not count as a guest booking and do not appear in the revenue overview.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Delete a manual block as soon as the reason no longer applies — otherwise the property remains unnecessarily blocked on all channels.",
            },
            {
              type: "note",
              variant: "info",
              text: "For an immediate block without a planned period, use [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
