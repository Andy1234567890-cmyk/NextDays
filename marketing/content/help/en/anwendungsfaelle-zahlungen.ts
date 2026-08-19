import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Payments",
  description: "Handle payments correctly.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Payments",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Set up a deposit",
          excerpt: "How to charge only a partial amount at booking instead of the full sum.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point",
            },
            {
              type: "p",
              text: "Instead of charging the full booking amount immediately, you can set a deposit as a payment rule. The guest pays only a partial amount at booking via Stripe or PayPal, with the remainder collected later as a balance payment.",
            },
            {
              type: "steps",
              items: [
                "In the property, open the “Payment rules” section.",
                "Create a new rule of type “Deposit.”",
                "Set the deposit amount as a percentage or a fixed amount of the total.",
                "Define when the deposit is due, usually immediately at booking.",
                "Save the rule and verify it with a test booking.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "The deposit is processed through the payment provider configured for the property. Set up the matching amount for the remaining sum under [Automate the balance payment](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Automate the balance payment",
          excerpt: "How the outstanding balance is automatically collected before arrival.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point",
            },
            {
              type: "p",
              text: "After a deposit, a balance remains outstanding. Instead of tracking it manually, set up a payment rule that automatically collects the balance payment via Stripe or PayPal at a fixed point before arrival.",
            },
            {
              type: "steps",
              items: [
                "In the property, open the “Payment rules” section.",
                "Create a new rule of type “Balance payment,” provided a deposit rule already exists.",
                "Define how many days before arrival the balance payment is due.",
                "Enable automatic collection so the configured payment provider charges the amount on its own.",
                "Afterwards, check the status of the balance payment in the booking timeline of the respective reservation.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "If the automatic collection fails, for example due to an expired card, the booking is not cancelled automatically. Review failed balance payments promptly and contact the guest directly.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Issue a refund",
          excerpt: "How to refund a guest an amount in full or in part.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point",
            },
            {
              type: "p",
              text: "In the event of a cancellation or complaint, you can refund a guest the amount paid, either in full or in part. The refund runs through the same payment provider originally used for payment — Stripe or PayPal.",
            },
            {
              type: "steps",
              items: [
                "Open the affected booking in the booking timeline.",
                "In the “Payments” section, select the original payment to be refunded.",
                "Choose between a full or a partial refund.",
                "For a partial refund, enter the desired amount.",
                "Confirm the refund and check the updated payment status in the timeline.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A refund does not automatically change the booking status or the calendar nights that are held. In the case of a cancellation, also check whether the affected nights need to be released again in the availability calendar.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Manage a security deposit",
          excerpt: "How to set up a security deposit and release it again after the stay.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point",
            },
            {
              type: "p",
              text: "A security deposit protects you against damage during the stay. It is set up as its own payment rule and, via Stripe or PayPal, is either pre-authorized or collected upfront, depending on the property's configuration.",
            },
            {
              type: "steps",
              items: [
                "In the property, open the “Payment rules” section and create a rule of type “Security deposit.”",
                "Set the deposit amount and the time of authorization, usually shortly before arrival.",
                "After checkout, inspect the condition of the property.",
                "If everything is in order, release the full deposit through the booking.",
                "In the event of damage, refund only the portion that is not needed and document the reason for withholding the rest.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "An authorized but uncollected security deposit automatically expires after a certain period, depending on the payment provider. Release the deposit promptly after checkout, or collect the required amount in time.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Correct an invoice",
          excerpt: "How to correct an invoice that has already been issued.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point",
            },
            {
              type: "p",
              text: "If an already issued invoice contains an error, for example in the billing address or a line item, correct it through the booking instead of simply deleting the original invoice.",
            },
            {
              type: "steps",
              items: [
                "Open the affected booking in the booking timeline and switch to the “Invoices” section.",
                "Select the incorrect invoice.",
                "Create a correction or credit note for the original invoice.",
                "Then create a new, corrected invoice with the accurate details.",
                "Send the corrected invoice again to the guest or the billing address.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "For traceability, an already sent invoice should not be overwritten directly. Correcting it via a credit note preserves the original document and makes the change traceable.",
            },
          ],
        },
      ],
    },
  ],
};
