import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Owners & Billing",
  description: "Owner accounts, billing statements, and commissions.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Owners",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Creating an owner",
          excerpt: "How to create a new owner account in myNextDays.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Owners are dedicated accounts in myNextDays that let you manage properties belonging to a specific person or company. An owner account gets limited, read-only visibility into its own properties, without being able to make changes to the business itself.",
            },
            { type: "h2", text: "Creating a new owner account" },
            {
              type: "steps",
              items: [
                "Open the “Owners” section in the main menu.",
                "Click “Create new owner.”",
                "Enter the name, email address, and contact details.",
                "If needed, add the billing address for statements.",
                "Save the account.",
              ],
            },
            { type: "h2", text: "Setting up access" },
            {
              type: "p",
              text: "After creating the account, you can send the owner an invitation to their own access. The owner then logs in with their own credentials and sees only the properties assigned to them.",
            },
            {
              type: "ul",
              items: [
                "An owner account can include multiple properties.",
                "Each property belongs to exactly one owner.",
                "Contact details and the billing address can be updated at any time.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "To learn how to assign an existing property to an owner, see [Assigning a property to an owner](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Assigning a property to an owner",
          excerpt: "Each property belongs to exactly one owner — here is how to set up the assignment.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "In myNextDays, each property belongs to exactly one owner. Multiple assignments are not supported — if a property should belong to a different owner, remove the existing assignment first before setting a new one.",
            },
            { type: "h2", text: "Making the assignment" },
            {
              type: "steps",
              items: [
                "Open the property under “Properties.”",
                "Switch to the “Owner” tab.",
                "Select the responsible owner from the list.",
                "Confirm the assignment.",
                "Save the change to the property.",
              ],
            },
            { type: "h2", text: "Changing the owner" },
            {
              type: "p",
              text: "If the owner of a property changes, for example due to a sale, replace the existing assignment with the new one. Statements already created for past periods remain assigned to the original owner.",
            },
            {
              type: "ul",
              items: [
                "A property can only be assigned to one owner at any given time.",
                "Without an assignment, the property does not appear in any owner access.",
                "Past statements remain with the original owner.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Assigning a property to multiple owners at once is not possible — the system does not allow a second simultaneous assignment.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Owner statement (billing)",
          excerpt: "How to create a statement with revenue minus commission for an owner.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "The owner statement summarizes all revenue from the assigned properties for a selected period and deducts your agreed commission. The result is the amount you pay out to the owner.",
            },
            { type: "h2", text: "Creating a statement" },
            {
              type: "steps",
              items: [
                "Open the “Owners” section and select the desired owner.",
                "Switch to the “Billing” tab.",
                "Select the billing period.",
                "Review the listed bookings and revenue per property.",
                "Generate the statement with the commission deducted.",
              ],
            },
            { type: "h2", text: "Structure of the statement" },
            {
              type: "p",
              text: "A statement lists, per property, the gross revenue from bookings, the commission deducted from it, and the resulting payout amount. Depending on the agreement, additional costs such as cleaning or fees can be shown separately.",
            },
            {
              type: "ul",
              items: [
                "Gross revenue: the total of all bookings for the period, per property.",
                "Commission: your agreed share, deducted from the revenue.",
                "Payout amount: revenue minus commission and any additional items.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Amounts in the statement are always shown in the property's currency — there is no generic currency fallback.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Create statements regularly on the same date so owners have a reliable rhythm for their payouts.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Owner access",
          excerpt: "What owners can see in their read-only access.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Owner access is a dedicated, read-only login for myNextDays. It lets owners see only the properties assigned to them along with the associated occupancy and statements — without the ability to change settings themselves.",
            },
            { type: "h2", text: "What owners see" },
            {
              type: "ul",
              items: [
                "The occupancy calendar for their own properties.",
                "Generated statements with revenue and the deducted commission.",
                "Basic data for their properties, such as amenities and description.",
              ],
            },
            { type: "h2", text: "Activating access" },
            {
              type: "steps",
              items: [
                "Open the owner under “Owners.”",
                "Click “Invite access.”",
                "The owner receives an email to set up their own password.",
                "After logging in, the owner automatically sees only their assigned properties.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Owner access is strictly read-only: only you, as the business, can change prices, availability, or property data — not the owner.",
            },
            {
              type: "note",
              variant: "info",
              text: "For more on assigning properties, see [Assigning a property to an owner](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
