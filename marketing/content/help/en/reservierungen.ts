import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Reservations & Bookings",
  description: "Manage, move, and cancel bookings.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Bookings",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Recording a Booking Manually",
          excerpt:
            "How to record a booking received by phone or email directly in myNextDays.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "When to Record Manually" },
            {
              type: "p",
              text: "Not every booking comes in through a portal or your own platform — requests by phone, email, or in person need to be entered yourself, so the property is correctly blocked in myNextDays and no double booking occurs.",
            },
            {
              type: "steps",
              items: [
                "Open Reservations and click “New Booking”.",
                "Select the property — every property in myNextDays is a single bookable unit, meaning a specific room or vacation rental.",
                "Set the arrival and departure dates as well as the number of guests.",
                "Enter the guest details (name, contact information, and address for the invoice if applicable).",
                "Review the suggested price and adjust it if needed.",
                "Save the booking — the nights are blocked in the calendar immediately.",
              ],
            },
            { type: "h2", text: "Payment and Confirmation" },
            {
              type: "p",
              text: "After saving, the same payment rules apply as for online bookings. If a payment provider is connected, you can send a payment link to the guest directly or mark the payment as received manually.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Add any special requests (early arrival, extra beds) to the notes right away — the team sees them in the booking timeline.",
            },
            { type: "h2", text: "After Creating the Booking" },
            {
              type: "p",
              text: "The new booking immediately appears in the [The Booking Timeline](/hilfe/reservierungen/buchungs-zeitleiste), with all further steps such as messages, tasks, and payments in one place.",
            },
            {
              type: "ul",
              items: [
                "The calendar and portals sync automatically as soon as you save.",
                "The guest receives an automatic confirmation message if applicable.",
                "Record date changes using “Move Booking”.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "The Booking Timeline",
          excerpt:
            "The booking timeline brings together the entire course of a reservation in one place.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "What the Timeline Shows" },
            {
              type: "p",
              text: "Every reservation has its own timeline that maps the entire process chronologically — from the booking request or portal import through to check-out. This lets you see at a glance what has already happened and what comes next.",
            },
            {
              type: "ul",
              items: [
                "Messages with the guest",
                "Tasks, such as cleaning or preparation",
                "Payments and invoices",
                "Booked add-ons and extra services",
                "Moves and cancellations",
              ],
            },
            { type: "h2", text: "Using the Timeline Day to Day" },
            {
              type: "steps",
              items: [
                "Open Reservations and select the desired booking.",
                "Switch to the “Timeline” tab.",
                "Scroll chronologically through all events.",
                "Use the quick actions to send a message or create a task directly.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "If a booking is moved or canceled, this step also appears in the timeline — including the nights released in the calendar.",
            },
            { type: "h2", text: "Why This Matters" },
            {
              type: "p",
              text: "Because the team, owner, and support all see the same timeline, no information gaps arise between messages, tasks, and payments. For details on refunds, see [Refunds](/hilfe/zahlungen/rueckerstattungen); for extra services, see [Add-ons & Extra Services](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Moving a Booking",
          excerpt:
            "How to move an existing booking to a new date range without throwing off the calendar.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "Before You Move a Booking" },
            {
              type: "p",
              text: "Before moving a booking, check availability for the new date range for the booked property. myNextDays only releases the originally reserved nights once the new date range is confirmed — so there is never a gap in which the property is incorrectly shown as available or double-booked.",
            },
            {
              type: "steps",
              items: [
                "Open the booking in Reservations.",
                "Select “Move” and enter the new date range.",
                "Check the displayed availability for the new dates.",
                "Confirm the move.",
                "Check whether the price changes due to the new number of nights, and adjust it if needed.",
              ],
            },
            { type: "h2", text: "What Happens Automatically" },
            {
              type: "p",
              text: "After confirmation, the old nights are correctly released in the calendar and the new nights are blocked; connected portals are updated. The process is logged in the booking timeline.",
            },
            {
              type: "note",
              variant: "warn",
              text: "If the booking was received through a portal, moving it there may be subject to its own rules — check the portal's policies before making major changes.",
            },
            { type: "h2", text: "Payment Differences" },
            {
              type: "p",
              text: "If the price changes as a result of the move, adjust the payment rules accordingly — see [Payment Rules](/hilfe/zahlungen/zahlungsregeln). For more on the overall booking process, see [The Booking Timeline](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Cancellation & Refund",
          excerpt:
            "How to cancel a booking correctly and trigger a refund if needed.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "Canceling a Booking" },
            {
              type: "p",
              text: "A cancellation immediately releases the property for the booked date range again — on your calendar as well as on all connected portals. Before canceling, check which cancellation terms apply to this booking.",
            },
            {
              type: "steps",
              items: [
                "Open the booking in Reservations.",
                "Select “Cancel” and provide a reason.",
                "Review the suggested refund amount.",
                "Confirm the cancellation.",
              ],
            },
            { type: "h2", text: "Triggering a Refund" },
            {
              type: "p",
              text: "If the payment was processed through a connected payment provider, you can initiate the refund directly from the booking. The amount is shown in the currency stored for this property. For details on the process, see [Refunds](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Full or partial refunds are possible",
                "The process appears in the booking timeline",
                "For portal bookings, the respective portal's rules also apply",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A cancellation cannot be undone. Carefully check the date range and guest before confirming.",
            },
            { type: "h2", text: "After the Cancellation" },
            {
              type: "p",
              text: "The property is immediately bookable again, and open tasks related to the booking — such as preparation — are automatically marked as no longer needed. The entire process remains traceable in the [Booking Timeline](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Check-in & Check-out",
          excerpt: "How to document a guest's arrival and departure in myNextDays.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "Recording Check-in" },
            {
              type: "p",
              text: "Check-in marks the start of the stay and is especially useful for self check-in or key handover by the team to keep the status of every booking up to date.",
            },
            {
              type: "steps",
              items: [
                "Open the booking in Reservations.",
                "Select “Check-in” on the arrival day.",
                "If needed, add a note, for example the time or any special circumstances.",
              ],
            },
            { type: "h2", text: "Check-out and Handover" },
            {
              type: "p",
              text: "At check-out, you mark the stay as completed. In many cases, this automatically triggers a cleaning task for the property so it can be prepared for the next booking.",
            },
            {
              type: "ul",
              items: [
                "Check-in and check-out are part of the booking timeline",
                "Times can be defined per property in the property settings",
                "With mobile access, the team can record check-in and check-out directly on site",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A missed check-out does not automatically block subsequent tasks — regularly check for overdue statuses in Reservations.",
            },
            { type: "h2", text: "Connection to Tasks" },
            {
              type: "p",
              text: "Check-in and check-out are closely linked to tasks and the timeline. Read more about the overall process under [The Booking Timeline](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Add-ons & Extra Services",
          excerpt:
            "How to offer guests bookable extra services such as breakfast or a transfer, and record them in the reservation.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "What Add-ons Are" },
            {
              type: "p",
              text: "Add-ons are optional extra services for a booking — such as breakfast, early arrival, a transfer, or a late check-out. They are set up per property and can be added to the booking either by the guest themselves or by your team.",
            },
            {
              type: "steps",
              items: [
                "Open the property and, under “Add-ons”, create the desired extra services with a price.",
                "Open an existing booking in Reservations.",
                "Select “Add Add-on” and choose the desired service.",
                "Confirm the quantity and timing of the service.",
              ],
            },
            { type: "h2", text: "Billing" },
            {
              type: "p",
              text: "Add-ons are billed in the respective property's currency and appear as a separate line item on the invoice. Add-ons that have already been paid can be refunded proportionally in the event of a cancellation.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Set up popular add-ons once, centrally on the property — this lets you add them to every new booking with just a few clicks.",
            },
            { type: "h2", text: "Visibility for the Guest" },
            {
              type: "p",
              text: "If the platform or your own website is active, guests can often select matching add-ons themselves already during the booking. Each addition then appears in the [Booking Timeline](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Add-ons can be individually named and priced per property",
                "Adding them afterward is possible at any time via the booking",
                "Canceled add-ons are refunded proportionally",
              ],
            },
          ],
        },
      ],
    },
  ],
};
