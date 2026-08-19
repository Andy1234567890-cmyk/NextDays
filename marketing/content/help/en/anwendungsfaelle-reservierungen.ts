import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Reservations & Calendar",
  description: "Keep reservations and your calendar under control.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Reservations & Calendar",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Reliably avoiding double bookings",
          excerpt: "How to make sure a property is never booked twice.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point",
            },
            {
              type: "p",
              text: "A property is sold across several channels at the same time — portals such as Booking, Airbnb & Co., your own platform, and the app. A double booking happens when availability on one channel is not blocked in time after a booking is made on another channel.",
            },
            {
              type: "steps",
              items: [
                "In the availability calendar, check that each property is exactly one row representing one bookable unit — never shared capacity across several rooms.",
                "Only create new bookings through the availability calendar or the connected channels, never by manually marking individual days.",
                "After every booking, confirm that the booked nights immediately show as occupied in the calendar.",
                "For technical issues or maintenance, use stop-sell right away instead of leaving the day open.",
                "If anything is unclear, check the booking timeline of the affected reservation to follow the sequence of events.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Never change nights or blocks manually outside the availability calendar — this is the only way to ensure all channels see the same availability status and no gap opens up for a double booking.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Moving a booking to a different property",
          excerpt: "How to cleanly move an existing reservation to another property.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point",
            },
            {
              type: "p",
              text: "Sometimes a guest needs to move from one property to another, for example due to a technical fault or at the guest’s request. During the move, the previous calendar nights are released automatically and rebooked on the destination property.",
            },
            {
              type: "steps",
              items: [
                "Open the affected booking in the booking timeline.",
                "In the action menu, select “Change property” or “Move”.",
                "Select the destination property and check its availability for the chosen period.",
                "Confirm the move.",
                "Afterwards, check in the availability calendar that the old nights on the original property show as available again.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "The system releases the old nights automatically — you do not need to open the original period yourself. Inform the guest about the property change, especially if amenities or access differ.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Creating a long-stay booking",
          excerpt: "How to correctly set up a reservation for an extended period.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "h2",
              text: "Starting point",
            },
            {
              type: "p",
              text: "For long-stay guests — for example several weeks or months — you create a reservation as usual, but also pay attention to the minimum stay, payment rules, and the property’s channel visibility across the entire period.",
            },
            {
              type: "steps",
              items: [
                "Open the availability calendar for the desired property and select the full period.",
                "Create the booking with the guest details and the planned check-in and check-out dates.",
                "If needed, set up a payment rule with a deposit and a balance payment instead of charging the full amount immediately.",
                "Check that no minimum- or maximum-stay rule conflicts with the long period.",
                "Save the booking and confirm that the entire period correctly shows as occupied in the calendar.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "For very long stays, it is advisable to split the balance payment into several instalments rather than a single large due date — this keeps the payment risk manageable. See [Automating the balance payment](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren) for details.",
            },
          ],
        },
      ],
    },
  ],
};
