import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Prices & Rates",
  description: "Rate plans, seasonal pricing, and dynamic pricing.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Pricing",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Base Price & Currency",
          excerpt: "How to set the base price and assign the correct currency to your property.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Every property in myNextDays is exactly one bookable unit — a single room or a vacation rental. For this unit you set a base price as well as a central currency that applies to the entire property.",
            },
            { type: "h2", text: "Setting the Currency Centrally" },
            {
              type: "p",
              text: "The property currency is set once per property and automatically applies to all rate plans you create for this property. There is no separate currency fallback — if the currency is missing, you cannot save prices.",
            },
            {
              type: "steps",
              items: [
                "Open your property under “Properties”.",
                "Switch to the “Prices” tab.",
                "Select the appropriate currency under “Property Currency”.",
                "Enter the base price for the standard occupancy.",
                "Save the changes.",
              ],
            },
            { type: "h2", text: "What Happens When You Change the Currency" },
            {
              type: "p",
              text: "If you change the property currency afterward, it affects all existing rate plans for this property, since they are always managed in the property currency. Check your prices afterward before transmitting them to the portals again.",
            },
            {
              type: "ul",
              items: [
                "A property has exactly one currency — not several per rate plan.",
                "The base price is the starting value for derived rates.",
                "Amounts are always shown in the stored property currency.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Without a stored currency, no price can be saved and no rate can be transmitted to portals. Check this first if a price change fails.",
            },
            {
              type: "note",
              variant: "info",
              text: "For more on derived prices, see [Derived Rates](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Creating Rate Plans",
          excerpt: "Rate plans bundle price, cancellation terms, and board type for a property.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "A rate plan defines the conditions under which a property can be booked: price, cancellation rules, board type, and minimum stay. A property can offer several rate plans at the same time, for example a flexible and a non-refundable plan.",
            },
            { type: "h2", text: "Creating a New Rate Plan" },
            {
              type: "steps",
              items: [
                "Open the property and switch to the “Prices” tab.",
                "Click “Create New Rate Plan”.",
                "Give it a descriptive name, e.g. “Flexible” or “Non-Refundable”.",
                "Determine whether the plan is a base rate or a derived rate.",
                "Enter cancellation terms and board type.",
                "Save and activate the rate plan.",
              ],
            },
            { type: "h2", text: "Base Rate vs. Further Rate Plans" },
            {
              type: "p",
              text: "Create your base rate first (often called “BAR”, Best Available Rate). All further rate plans can either be maintained independently or derived from this base rate.",
            },
            {
              type: "ul",
              items: [
                "Base rate: a manually maintained base price per night.",
                "Further rate plans: independent, or as a surcharge/discount on the base rate.",
                "Each rate plan can be transmitted to portals individually.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Keep the number of rate plans per property manageable — too many variants make comparison harder for guests and increase maintenance effort.",
            },
            {
              type: "note",
              variant: "info",
              text: "Details on surcharges and discounts can be found under [Derived Rates](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Derived Rates",
          excerpt: "Derived rate plans are calculated automatically from a base rate.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "A derived rate is a rate plan whose price is not maintained manually, but calculated automatically from a base rate — as a fixed surcharge, discount, or percentage. This saves maintenance effort, since a price change on the base rate automatically updates all derived plans.",
            },
            { type: "h2", text: "Typical Example" },
            {
              type: "p",
              text: "A common pattern is a breakfast-included plan derived from the base rate without board: the breakfast price is defined as a surcharge per night and person on the base rate. If you change the base rate, the breakfast price adjusts automatically.",
            },
            { type: "h2", text: "Setting Up a Derived Rate" },
            {
              type: "steps",
              items: [
                "Open the desired rate plan in the “Prices” tab.",
                "Select “Derived From …” as the price source and the associated base rate.",
                "Determine whether the difference applies as a fixed amount or a percentage.",
                "Determine whether it is a surcharge or a discount.",
                "Save the mapping.",
              ],
            },
            {
              type: "ul",
              items: [
                "Surcharge: e.g. board type, later cancellability.",
                "Discount: e.g. a non-refundable plan with a price advantage.",
                "The base rate remains the only manually maintained source.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A derived rate cannot be manually overridden at the same time. Remove the derivation first if you want to set an individual price differently.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Seasonal & Weekend Pricing",
          excerpt: "Adjust prices for seasonal periods and weekends specifically.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Demand fluctuates over the year and within the week. With seasonal and weekend pricing, you adjust the base price for specific periods or days of the week, without having to go into the calendar for every single day.",
            },
            { type: "h2", text: "Creating a Seasonal Period" },
            {
              type: "steps",
              items: [
                "Open the “Prices” tab on the property and the “Seasonal Pricing” section.",
                "Create a new period with a start and end date.",
                "Enter the price or the percentage deviation from the base price for this period.",
                "Save the seasonal period.",
              ],
            },
            { type: "h2", text: "Weekend Pricing" },
            {
              type: "p",
              text: "You can also apply your own surcharge to individual days of the week, such as Friday and Saturday. This surcharge applies in addition to the currently applicable seasonal or base price.",
            },
            {
              type: "ul",
              items: [
                "Seasonal pricing applies to contiguous periods.",
                "Weekend pricing applies per day of the week, independent of the season.",
                "Both rules can be combined.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "If multiple seasonal periods overlap, the most recently created or most specific rule applies. Check the calendar after saving.",
            },
            {
              type: "note",
              variant: "tip",
              text: "For automatic, demand-based adjustments, [Dynamic Pricing](/hilfe/preise-raten/dynamische-preise) is also suitable.",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Dynamic Pricing",
          excerpt: "Automatically adjust prices based on demand, lead time, and occupancy.",
          updated: "Last updated: August 2026",
          body: [
            {
              type: "note",
              variant: "info",
              text: "Dynamic pricing is a paid add-on module. You book it under “Extensions”, where you will also find the price. Without the module, the automation does not calculate anything.",
            },
            {
              type: "p",
              text: "Dynamic pricing automatically adjusts the base price based on factors such as booking lead time, current occupancy, and demand — similar to how large portals handle their own price recommendations. This lets you respond to market changes without manually adjusting every day.",
            },
            { type: "h2", text: "Enabling Dynamic Pricing" },
            {
              type: "steps",
              items: [
                "Book the module under “Tools → Extensions” — without the module the automation does not calculate.",
                "Open “Distribution → Dynamic pricing” in the main menu.",
                "In the property table, click the pencil icon next to the property (“Set base price”).",
                "Choose the base price strategy: data-driven or a fixed base price.",
                "Set a minimum and maximum price and use “Occupancy sensitivity (%)” to decide how strongly occupancy influences the price.",
                "Switch on “Dynamic pricing active” and save.",
              ],
            },
            { type: "h2", text: "Limits and Safeguards" },
            {
              type: "p",
              text: "The price floor and price ceiling prevent the automatic algorithm from setting prices that are not viable for your business. Derived rate plans automatically follow the dynamically calculated base rate.",
            },
            {
              type: "ul",
              items: [
                "The price floor protects against prices that are too low in weak demand.",
                "The price ceiling protects against excessive prices under high demand.",
                "Derived rates automatically adopt the new base rate.",
                "A day price set manually in the calendar always takes precedence over the automation.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dynamic pricing only affects the base rate. Manually fixed rate plans without a derivation do not change automatically along with it.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Length-of-Stay Discounts",
          excerpt: "Set up discounts for longer stays and early bookings.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Length-of-stay discounts reward guests for longer bookings or booking early. They are applied as a percentage of the total stay price and can be configured independently per property.",
            },
            { type: "h2", text: "Discount Types" },
            {
              type: "ul",
              items: [
                "Long-stay discount: from a certain number of nights, e.g. from 7 or 28 nights.",
                "Early-bird discount: for bookings made sufficiently far in advance.",
                "Last-minute discount: for short-notice bookings close to the arrival date.",
              ],
            },
            { type: "h2", text: "Setting Up a Discount" },
            {
              type: "steps",
              items: [
                "Open the “Prices” tab on the property and the “Discounts” section.",
                "Select the desired discount type.",
                "Set the threshold, e.g. minimum nights or lead time.",
                "Enter the discount as a percentage.",
                "Save the rule.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Discounts apply to the total price of the respective rate plan and are already shown to the guest in the price overview.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Combine long-stay discounts with [Minimum & Maximum Stay](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt) to specifically encourage longer bookings.",
            },
          ],
        },
      ],
    },
  ],
};
