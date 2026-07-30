import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Website",
  description: "Get the most out of your website.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Website",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Publishing your website",
          excerpt: "How to publish your own website as an independent sales channel.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point",
            },
            {
              type: "p",
              text: "Your website is its own sales channel alongside portals and the platform. You build the pages in the editor, but the website only becomes visible to guests — with your properties appearing bookable — once you publish it.",
            },
            {
              type: "steps",
              items: [
                "Open the website editor and check that all the pages you want are filled with content.",
                "In the property tab, choose for each property whether it should be visible on the website — this visibility is independent of portals and the platform.",
                "Check the preview in both desktop and mobile view before going live.",
                "Click “Publish” to make the website available to guests.",
                "After publishing, check the public URL and test a sample booking through the website.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A property’s website visibility is its own axis — a property can be active on portals but hidden on the website, and vice versa. See [Setting up your own domain](/hilfe/website/domain-verbinden) for details.",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Setting up your own domain",
          excerpt: "How to connect your own domain to your myNextDays website.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point",
            },
            {
              type: "p",
              text: "A domain of your own, such as www.your-business.com, looks more professional than a default address and strengthens your brand with guests who want to book directly with you.",
            },
            {
              type: "steps",
              items: [
                "In the website editor, open the “Domain” section and enter the domain you want to use.",
                "With your domain provider, set up the DNS records shown (typically a CNAME or A record).",
                "Wait until the domain shows as connected and the SSL certificate as active — depending on the provider, this can take a few hours.",
                "Test loading your own domain in a private browser window to rule out cached old entries.",
                "Check that old default addresses continue to redirect to the new domain so existing links do not break.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Only change DNS records as shown — incorrect values can disrupt your domain’s existing email settings. If in doubt, check with your domain provider before overwriting existing records.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Increasing direct bookings",
          excerpt: "How to steer more guests to your own website instead of portals.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point",
            },
            {
              type: "p",
              text: "Bookings through your own website are usually cheaper for your business than through portals, since no portal commission applies. A few targeted measures will increase the share of direct bookings through your website as an independent channel.",
            },
            {
              type: "steps",
              items: [
                "Make sure all bookable properties are visible on the website with up-to-date photos and descriptions.",
                "Set up a website-exclusive discount or perk, such as a small price reduction compared to portals.",
                "Link your own domain in booking confirmations and in communication with guests who have already booked once before.",
                "Regularly check the booking statistics to track the website’s share of all bookings over time.",
                "Optimize the website’s loading time and mobile display, since most guests book from their smartphone.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "A website-exclusive perk only works if guests can actually find the website — actively point them to it instead of relying only on portals. For publishing, see [Publishing your website](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
