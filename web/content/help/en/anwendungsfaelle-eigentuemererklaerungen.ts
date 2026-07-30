import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Owner Statements",
  description: "Create owner statements.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Owner Statements",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Generate an owner statement",
          excerpt: "How to create a clear statement of a period for an owner.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point",
            },
            {
              type: "p",
              text: "If you manage properties for owners, they regularly need a transparent overview of income, deducted commission and payout for their properties over a given period — the owner statement summarizes this data automatically.",
            },
            {
              type: "steps",
              items: [
                "Open the Owners section in the account and select the relevant owner.",
                "Choose the billing period for which the statement should be created.",
                "Check that all of this owner's properties are correctly assigned, since only assigned properties are included in the statement.",
                "Generate the statement and check the listed reservations for completeness.",
                "Provide the statement to the owner via the owner portal or export it as a document.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "The statement shows every reservation with its amount in the respective property currency — there is no blanket currency note, since multiple properties may also use different currencies. More on assignment under [Assign a property to an owner](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Settle commission with the owner",
          excerpt: "How to make sure your commission is calculated correctly from the owner’s income.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point",
            },
            {
              type: "p",
              text: "Your commission for managing a property is stored in the owner’s tariff and is automatically deducted from gross income with every statement. For the settlement to be correct, the commission rate must be set correctly before the first booking in the period.",
            },
            {
              type: "steps",
              items: [
                "Open the tariff of the relevant owner in the account and check the stored commission rate.",
                "Adjust the rate if needed before new reservations come in for the upcoming billing period.",
                "Generate the owner statement for the period and check that the commission is shown correctly for each reservation.",
                "Check the total of gross income, deducted commission and net payout for plausibility.",
                "Clarify any discrepancies with the owner directly before approving the statement, rather than changing the statement afterward.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A subsequent change to the commission rate only affects future periods, not statements that have already been generated. Check the rate in good time before a new billing period begins — see also [Owner statement (billing)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
