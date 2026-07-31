import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Website Builder",
  description: "Create your own booking website with the website builder.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Website Builder",
      articles: [
        {
          slug: "website-erstellen",
          title: "Create a website",
          excerpt: "Use the website builder to set up your own booking website in just a few minutes.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "The website builder creates your own booking website for you — an additional sales channel alongside portals and the myBestDays marketplace. You keep full control over structure, content, and branding.",
            },
            { type: "h2", text: "How to create a website" },
            {
              type: "steps",
              items: [
                "Open Website in the menu.",
                "Click Create website.",
                "Choose a template as the starting point for your layout.",
                "Confirm with Create website — you land directly in the editor.",
              ],
            },
            { type: "h2", text: "What the builder includes" },
            {
              type: "ul",
              items: [
                "A visual editor with pages, layers, and a preview view",
                "Ready-made blocks for property listings, galleries, and contact forms",
                "A direct booking flow based on your calendar availability",
                "Customizable colors, fonts, and logo to match your brand",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Start with a template close to your property type — vacation rental or hotel — this saves you time later when adjusting the blocks.",
            },
            { type: "h2", text: "Next steps" },
            {
              type: "p",
              text: "After creating your website, adjust pages and layout — see [Edit pages & layout](/hilfe/website/seiten-layout) — and display your properties on the website — see [Show properties on the website](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Edit pages & layout",
          excerpt: "Adjust pages, layers, and blocks in the visual editor.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "The editor is divided into three areas: the pages and layers overview on the left, the preview of your website in the middle, and the settings for the currently selected block on the right.",
            },
            { type: "h2", text: "Edit a page" },
            {
              type: "steps",
              items: [
                "On the left, under Pages, select the page you want.",
                "Click a block in the preview to select it.",
                "On the right, adjust the text, image, or spacing of the block.",
                "Drag blocks to reorder them.",
              ],
            },
            { type: "h2", text: "Add new pages & blocks" },
            {
              type: "p",
              text: "Use the Add page button to create additional subpages, such as About us or Contact. Within a page, use Add block to insert new sections such as a gallery, reviews, or a contact form.",
            },
            {
              type: "ul",
              items: [
                "Home, Property overview, and Contact are pre-set with every template",
                "Additional pages can be freely named and added to navigation",
                "Blocks are responsive and adapt to desktop, tablet, and smartphone",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Changes in the editor are initially only a draft. Only clicking Publish applies them to your public website.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Connect a domain",
          excerpt: "Link your own domain to your myNextDays website.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "By default, your website is reachable via a myNextDays subdomain. If you would rather use your own domain, such as your-business.com, connect it in the Domain section.",
            },
            { type: "h2", text: "Add a domain" },
            {
              type: "steps",
              items: [
                "In the website, open Settings and then Domain.",
                "Enter your own domain and click Connect.",
                "Create the displayed DNS records with your domain provider.",
                "Wait for confirmation — the check runs automatically in the background.",
              ],
            },
            { type: "h2", text: "Set DNS records correctly" },
            {
              type: "p",
              text: "myNextDays shows you the exact records required for your domain provider. The connection only becomes active once these records are set correctly and have propagated worldwide — depending on the provider, this can take a few hours.",
            },
            {
              type: "ul",
              items: [
                "Set the CNAME or A record as shown in the instructions",
                "Remove any existing, conflicting records for the same domain beforehand",
                "The https certificate is issued automatically once the connection succeeds",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Without correctly set DNS records, your website will not be reachable under your own domain — check the spelling carefully against your provider's details.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Show properties on the website",
          excerpt: "You control which properties are visible and bookable on the website separately, per property.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "For a property to appear on your website, website visibility must be switched on for that property. This toggle is independent of visibility on the myBestDays marketplace or on portals.",
            },
            { type: "h2", text: "Enable a property for the website" },
            {
              type: "steps",
              items: [
                "Open the property under Properties.",
                "Switch to the Visibility tab.",
                "Turn on the Website toggle.",
                "Switch to Website and check the Property overview block in the preview.",
              ],
            },
            { type: "h2", text: "Adjust order & display" },
            {
              type: "p",
              text: "In the Property overview block, you decide whether properties are sorted automatically by availability or shown in a fixed order you define. Each property displays its cover photo, base price in its saved currency, and the most important amenities.",
            },
            {
              type: "ul",
              items: [
                "Automatic sorting by availability or a manual order",
                "Filtering by property type or amenities can be enabled optionally",
                "Booking steps run directly on the website, with no portal detour",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A property without website visibility enabled stays hidden from the property overview, even if it is visible on the marketplace or on portals.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Publish your website",
          excerpt: "Drafts only become publicly visible once you click Publish.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "While you are working in the editor, only you see the current draft. Only clicking Publish makes the changes visible to all visitors under your domain.",
            },
            { type: "h2", text: "How to publish" },
            {
              type: "steps",
              items: [
                "In the editor, open the preview and check every page.",
                "Click Publish in the top right.",
                "Confirm the dialog — the website goes live immediately afterward.",
                "Open your domain in a new tab to check the result.",
              ],
            },
            { type: "h2", text: "Drafts & reverting" },
            {
              type: "p",
              text: "As long as you have not published yet, you can return to the last published state at any time without permanently losing your draft — use Discard draft in the website settings for this.",
            },
            {
              type: "ul",
              items: [
                "Published changes are visible under your domain immediately",
                "An unpublished draft stays internal until you confirm it",
                "Every publish is recorded with a date in the history",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Before publishing, check the mobile view in the preview — most guests visit booking websites from their smartphone.",
            },
          ],
        },
      ],
    },
  ],
};
