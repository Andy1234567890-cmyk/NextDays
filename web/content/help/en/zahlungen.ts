import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Payments & Invoices",
  description: "Payment providers, payment rules, and invoices.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Payments",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Connect a payment provider",
          excerpt:
            "How to connect Stripe or PayPal to myNextDays to process payments automatically.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "Available providers" },
            {
              type: "p",
              text: "myNextDays processes payments through connected payment providers. Stripe and PayPal are currently supported — you can connect one or both providers at the same time and use them depending on the property or the guest's preference.",
            },
            {
              type: "steps",
              items: [
                "Open Account and switch to the “Payments” section.",
                "Choose the desired provider — Stripe or PayPal.",
                "Follow the connection dialog and sign in with the provider or create a new account.",
                "Confirm the connection — the status changes to “connected.”",
              ],
            },
            { type: "h2", text: "What happens next" },
            {
              type: "p",
              text: "Once a provider is connected, you can send payment links, collect deposits, and trigger refunds directly from the booking. All amounts are processed in the currency configured for the respective property.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Without a connected provider, you can only mark payments as received manually — automatic charging is not possible in that case.",
            },
            { type: "h2", text: "Multiple properties, one provider" },
            {
              type: "p",
              text: "A connection, once established, applies account-wide to all your properties. You define exactly how the charging works under [Payment rules](/hilfe/zahlungen/zahlungsregeln). Payouts to you are then made through the respective provider, see [Payouts](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe is well suited for card payments and many local payment methods",
                "PayPal offers guests a familiar alternative",
                "Both providers can be disconnected and reconnected independently of each other",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Payment rules",
          excerpt: "Define when a booking's deposit and balance payment are due.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "Deposit and balance payment" },
            {
              type: "p",
              text: "Payment rules determine how a booking is settled financially — for example, a deposit at booking and a balance payment before arrival, or full payment immediately. The rules apply per property and can be adjusted at any time.",
            },
            {
              type: "steps",
              items: [
                "Open the property and switch to the “Payment rules” section.",
                "Choose whether a deposit is charged, and set the share.",
                "Define when the balance payment is due, for example a certain number of days before arrival.",
                "Save the settings.",
              ],
            },
            { type: "h2", text: "Automatic collection" },
            {
              type: "p",
              text: "If a payment provider is connected, myNextDays automatically collects the deposit and balance payment at the configured time and notifies the guest beforehand by message.",
            },
            {
              type: "note",
              variant: "info",
              text: "Payment rules only take effect for bookings with a connected payment provider. Without a provider, you mark payments manually in the booking.",
            },
            { type: "h2", text: "Differences by channel" },
            {
              type: "p",
              text: "On portals, their own payment processing may apply instead — in that case, check the respective portal's terms. For bookings made through your own platform or website, the rules you configure here always apply. Details on connecting a provider can be found under [Connect a payment provider](/hilfe/zahlungen/zahlungsanbieter-verbinden), and on invoicing under [Create invoices](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Deposit can be a fixed amount or a percentage",
                "Balance payment deadline is freely selectable",
                "Changes apply only to new bookings, not retroactively",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Create invoices",
          excerpt: "How to create an invoice for a booking with the correct billing address.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "Create an invoice" },
            {
              type: "p",
              text: "An invoice can be created for any booking — either for the guest directly or for a different company, if the booking is a business booking.",
            },
            {
              type: "steps",
              items: [
                "Open the booking in Reservations.",
                "Select “Create invoice.”",
                "Review or complete the billing address.",
                "Check the listed line items — accommodation, add-ons, fees.",
                "Create the invoice and send it to the guest.",
              ],
            },
            { type: "h2", text: "Maintaining the billing address" },
            {
              type: "p",
              text: "You can enter the billing address directly in the booking, or have the guest provide it later via the booking confirmation. Without a complete address, a legally valid invoice cannot be issued in certain countries.",
            },
            {
              type: "note",
              variant: "warn",
              text: "For business customers, pay particular attention to the company name and address — subsequent corrections require a credit note.",
            },
            { type: "h2", text: "Amounts and currency" },
            {
              type: "p",
              text: "All line items are shown in the currency configured for the property. Payments already made are recorded on the invoice as a payment received. To learn how the deposit and balance payment come about, see [Payment rules](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Invoices can be downloaded as a PDF",
                "Credit notes are possible at any time in the event of changes",
                "Add-ons appear as their own line item",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Refunds",
          excerpt:
            "How to refund a payment in full or in part when a booking is cancelled or changed.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "When a refund is needed" },
            {
              type: "p",
              text: "A refund is typically needed for a cancellation, but it may also be required for a subsequent price adjustment or a cancelled add-on.",
            },
            {
              type: "steps",
              items: [
                "Open the affected booking in Reservations.",
                "Select “Refund” in the booking's payment section.",
                "Enter the amount to be refunded — in full or in part.",
                "Confirm the refund.",
              ],
            },
            { type: "h2", text: "How it runs through the payment provider" },
            {
              type: "p",
              text: "The refund is carried out through the provider used for the payment — Stripe or PayPal — and transferred directly back to the guest's original payment method. The process is automatically recorded in the booking timeline.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Without a connected payment provider, a refund cannot be triggered automatically — in that case, arrange the repayment directly with the guest.",
            },
            { type: "h2", text: "Effect on commissions" },
            {
              type: "p",
              text: "Marketplace or portal commissions already billed are adjusted proportionally in the event of a refund. Read more under [Understanding commissions](/hilfe/zahlungen/provisionen-verstehen). Details on the cancellation itself can be found under [Cancellation & refund](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Partial refunds are possible for individual line items",
                "The processing status is visible in the booking at any time",
                "Refunds run exclusively through the provider originally used",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Payouts",
          excerpt:
            "How you receive the proceeds of your bookings paid out by the connected payment providers.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "How payouts work" },
            {
              type: "p",
              text: "Incoming payments first accumulate with the connected payment provider. From there, the payout to your registered bank account follows the provider's usual schedule.",
            },
            {
              type: "steps",
              items: [
                "Open Account and switch to the “Payments” section.",
                "Under “Payouts,” check the status of the respective provider.",
                "If needed, open the provider's detail view for the full payout history.",
              ],
            },
            { type: "h2", text: "What is deducted before the payout" },
            {
              type: "p",
              text: "Before the payout, applicable marketplace and portal commissions as well as provider fees are taken into account. The paid-out amount therefore does not necessarily match the original booking total.",
            },
            {
              type: "note",
              variant: "info",
              text: "The exact breakdown of the deductions is explained in [Understanding commissions](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Multiple properties and owners" },
            {
              type: "p",
              text: "If you manage properties for different owners, payouts are allocated according to the configured owner statements. If discrepancies arise, first check the status of the underlying bookings in Reservations.",
            },
            {
              type: "ul",
              items: [
                "Payout schedule and method are determined by the respective provider",
                "Amounts on hold, for example due to ongoing refunds, are flagged",
                "The full history is available for review directly with the provider",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Understanding commissions",
          excerpt:
            "An overview of how marketplace and portal commissions are made up and where they are billed.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "Two types of commissions" },
            {
              type: "p",
              text: "Two different commissions can apply to bookings made through myNextDays: the marketplace commission for bookings made through your own platform, and portal commissions for bookings that come in through connected portals such as Booking.com or Airbnb. Both are independent of each other and can differ depending on a booking's sales channel.",
            },
            {
              type: "ul",
              items: [
                "Marketplace commission: applies to bookings made through the myBestDays platform",
                "Portal commission: charged by the respective portal according to its own terms",
                "Direct bookings through your own website are to be considered independently of these",
              ],
            },
            { type: "h2", text: "Where commissions are visible" },
            {
              type: "steps",
              items: [
                "Open Account and switch to the “Billing” section.",
                "Select the desired month.",
                "Review the breakdown per booking together with the associated commission.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "You can see which channel a booking came in through directly on the booking itself — this explains which commission was applied in each case.",
            },
            { type: "h2", text: "Relationship to payouts" },
            {
              type: "p",
              text: "Commissions are deducted from the booking total before the payout. Details on the payout process can be found under [Payouts](/hilfe/zahlungen/auszahlungen). In the event of a refund, the associated commission is adjusted proportionally — the full course of a booking is shown in the [Booking timeline](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
