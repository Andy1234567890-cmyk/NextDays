import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Rental Pricing",
  description: "Set rental prices optimally.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Rental Pricing",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Optimize prices for peak season",
          excerpt: "How to specifically raise your prices for periods of high demand.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point",
            },
            {
              type: "p",
              text: "During peak season, demand rises significantly while your base price stays the same as the rest of the year. Without seasonal adjustment, you leave revenue on the table during the strongest time of the year — the adjustment is made via your property’s rate plan, not by manually overriding individual days.",
            },
            {
              type: "steps",
              items: [
                "Open the rate plan of the relevant property and create a season rule for the desired period.",
                "Set the surcharge as a percentage or a fixed amount above the base price — the rate plan automatically applies the property currency.",
                "Check in the calendar that the new price displays correctly for the peak-season period before you activate it.",
                "Check the minimum stay for peak season — a higher minimum booking length is often useful to keep occupancy predictable.",
                "After activation, monitor booking activity over the first few days and adjust the surcharge if needed.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "A season rule applies across channels equally on portals, the platform and your website. Details on setting up rules can be found under [Rate plans](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Encourage longer stays with a discount",
          excerpt: "How to reward guests for longer stays and reduce turnover effort.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point",
            },
            {
              type: "p",
              text: "Short stays mean more arrivals and departures, more cleanings and more vacancy risk between bookings. A tiered length-of-stay discount makes longer bookings more attractive for guests and noticeably reduces this effort.",
            },
            {
              type: "steps",
              items: [
                "Open the rate plan of the property and create a length-of-stay discount.",
                "Define at least one tier, for example from 7 nights or from 28 nights, with the respective discount rate.",
                "Check that the tiers do not overlap and that the discount only applies from the respective minimum duration onward.",
                "Test a sample booking in the calendar that crosses the discount threshold, to confirm it is applied correctly.",
                "Activate the discount and monitor its effect on average length of stay and occupancy.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Length-of-stay discounts can be combined with season rules — the rate plan calculates both adjustments together. More on this under [Rate plans](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
