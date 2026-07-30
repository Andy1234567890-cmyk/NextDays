import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portals & Channel Manager",
  description: "Manage Booking, Airbnb, Expedia & Co. centrally.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Connecting portals",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "What is the channel manager?",
          excerpt:
            "The channel manager automatically synchronizes prices, availability and bookings between myNextDays and the portals.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "One connection for all portals" },
            {
              type: "p",
              text: "The channel manager is the bridge between myNextDays and the major booking portals such as Booking, Airbnb & Co. Instead of maintaining prices, availability and occupancy separately in each portal, you enter everything once in myNextDays — the channel manager automatically distributes it to all connected portals.",
            },
            { type: "h2", text: "What is synchronized automatically" },
            {
              type: "ul",
              items: [
                "Availability — every reservation blocks the night immediately on all portals",
                "Prices and minimum stays from your price calendar",
                "Incoming portal bookings are automatically imported into myNextDays",
                "Cancellations and stop-sell apply across all channels",
              ],
            },
            { type: "h2", text: "What you no longer have to do manually" },
            {
              type: "p",
              text: "Without a channel manager, you would have to manually block the night in every portal after each booking — a common cause of double bookings. With the channel manager active, myNextDays handles this synchronization in both directions, several times a day and in real time for new bookings.",
            },
            {
              type: "note",
              variant: "info",
              text: "The portal connection is set up once for the entire account. For each individual property, you then only need to activate the mapping — more on this under [Assign a property to a portal](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Set up the portal connection",
          excerpt:
            "You set up the connection to the portals once for the entire account — not again for every property.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "Once for the entire account" },
            {
              type: "p",
              text: "The connection to the portals is an account-wide setting: you connect your myNextDays account to the channel manager exactly once. All properties you create later automatically use this single connection — you don’t need to set it up again for each property.",
            },
            { type: "h2", text: "How to set up the connection" },
            {
              type: "steps",
              items: [
                "Open /konto and select the “Portals & Channel Manager” section",
                "Click “Set up connection” and confirm your business details (address, contact, legal form)",
                "Check the automatically transferred master data — it is passed on to all portals",
                "Complete the setup; the status changes to “Connected”",
              ],
            },
            { type: "h2", text: "Next step: assigning properties" },
            {
              type: "p",
              text: "After the one-time setup, no property is visible yet — for that, you assign each property individually to a portal (mapping) and connect the desired portals such as Booking.com or Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Without complete master data (address, tax information, contact), the portals will reject the connection. Check these details first under /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Assign a property to a portal",
          excerpt:
            "Once the account-wide connection is set up, you only need to activate the mapping to the respective portal for each property.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "Mapping instead of a new connection" },
            {
              type: "p",
              text: "Once the portal connection is set up account-wide, you connect each property only via what is known as a mapping: you define which myNextDays property corresponds to which room type or listing type in the portal. This is a one-time step per property.",
            },
            { type: "h2", text: "How to assign a property" },
            {
              type: "steps",
              items: [
                "Open the property under /objekte and switch to the “Portals” tab",
                "Select the desired portal, for example Booking.com or Airbnb",
                "Map the property to the matching room type or listing type in the portal",
                "Activate synchronization — prices and availability are transferred from now on",
              ],
            },
            { type: "h2", text: "One property, multiple portals" },
            {
              type: "p",
              text: "A single property can be assigned to several portals at the same time. Each assignment is independent — for example, you can make a property visible on Booking.com and Airbnb while leaving it deactivated on Expedia for the time being.",
            },
            {
              type: "note",
              variant: "tip",
              text: "After mapping, check the visibility right away — see [Visibility per portal](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Connect Booking.com",
          excerpt: "How to enable Booking.com as a sales channel for a property.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "Prerequisite: account-wide connection" },
            {
              type: "p",
              text: "Before you activate Booking.com for a property, the account-wide portal connection must be set up (see [Set up the portal connection](/hilfe/portale-kanalmanager/portal-verbindung)). After that, Booking.com is only a matter of mapping for every additional property.",
            },
            { type: "h2", text: "Activating Booking.com" },
            {
              type: "steps",
              items: [
                "Open the property under /objekte, “Portals” tab",
                "Select “Booking.com” from the list of available portals",
                "Map the matching room type or listing type and confirm the rate plans",
                "Activate visibility — the property goes live after review by Booking.com",
              ],
            },
            { type: "h2", text: "What Booking.com expects from you" },
            {
              type: "ul",
              items: [
                "A complete property description, photos and amenities",
                "At least one rate with price and cancellation conditions",
                "A valid payment method for commissions",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Approval by Booking.com can take a few hours. The status in the property’s “Portals” tab shows whether the connection is already active.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Connect Airbnb",
          excerpt: "How to make a property bookable on Airbnb via the channel manager.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "Airbnb as another portal" },
            {
              type: "p",
              text: "Airbnb is connected via the account-wide connection just like any other portal. Once that is set up, you activate Airbnb per property via the mapping — regardless of whether the property is already visible on Booking.com or other portals.",
            },
            { type: "h2", text: "Activating Airbnb for a property" },
            {
              type: "steps",
              items: [
                "Open the property under /objekte, “Portals” tab",
                "Select “Airbnb” from the list of available portals",
                "Confirm the property category and the assigned listing type",
                "Check photos, amenities and house rules — Airbnb requires complete details before approval",
                "Activate visibility for Airbnb",
              ],
            },
            { type: "h2", text: "After activation" },
            {
              type: "p",
              text: "Once Airbnb has approved the property, prices and availability run automatically through the channel manager. Bookings received on Airbnb then appear automatically in your reservation calendar.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Without stored cancellation conditions and house rules, Airbnb will reject the approval. Add these details to the property first.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Synchronize prices & availability",
          excerpt:
            "Prices and availability are transferred automatically to all connected portals.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "One calendar, all portals" },
            {
              type: "p",
              text: "You maintain prices and availability exclusively in the myNextDays calendar of the respective property. The channel manager automatically transfers every change to all portals for which the property is actively mapped — without you having to enter anything twice.",
            },
            { type: "h2", text: "What gets transferred" },
            {
              type: "ul",
              items: [
                "Daily prices from your price calendar or rate plans",
                "Available nights and blocks",
                "Minimum stay and arrival/departure restrictions",
                "Stop-sell days — these automatically block on all portals",
              ],
            },
            { type: "h2", text: "How quickly synchronization takes effect" },
            {
              type: "p",
              text: "Changes to prices and availability are passed on to the portals within a few minutes. New reservations block the affected nights immediately, so the same night cannot be sold again on any other channel.",
            },
            {
              type: "note",
              variant: "tip",
              text: "For more on blocking individual days across channels, see [Avoiding overbookings](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Receive portal bookings",
          excerpt: "Bookings from Booking, Airbnb & Co. land automatically in your calendar.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "Automatic import" },
            {
              type: "p",
              text: "If a guest books through a portal such as Booking.com or Airbnb, the channel manager automatically imports the reservation into myNextDays. You don’t need to transfer anything manually — the booking appears in the calendar and the reservation list of the affected property.",
            },
            { type: "h2", text: "What happens with a portal booking" },
            {
              type: "steps",
              items: [
                "The portal reports the new booking to the channel manager",
                "myNextDays creates the reservation with guest details, period and price",
                "The booked nights are immediately blocked on all other channels",
                "You receive a notification and find the booking in the calendar",
              ],
            },
            { type: "h2", text: "Cancellations and changes" },
            {
              type: "p",
              text: "If a guest cancels through the portal or changes the period, this is likewise transferred automatically to myNextDays and the affected nights are released again.",
            },
            {
              type: "note",
              variant: "info",
              text: "Portal bookings can be recognized in the reservation details by their source badge, for example Booking.com or Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Avoid overbookings",
          excerpt: "Stop-sell and automatic blocking prevent double bookings across multiple portals.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "Why overbookings happen" },
            {
              type: "p",
              text: "Without central control, it can easily happen that the same night is sold on two portals at the same time — for example when prices and availability are maintained manually across several systems. The channel manager closes this gap by having every booking on every channel immediately block all other channels.",
            },
            { type: "h2", text: "Your tools against overbookings" },
            {
              type: "ul",
              items: [
                "Automatic blocking: every new reservation — regardless of the channel — blocks the nights everywhere",
                "Stop-sell: manually blocks a day on all channels at once, for example for personal use or maintenance",
                "Minimum stay and arrival restrictions prevent unsuitable short bookings",
              ],
            },
            { type: "h2", text: "Setting stop-sell" },
            {
              type: "steps",
              items: [
                "Open the property’s occupancy calendar",
                "Mark the affected day or period",
                "Select “Stop-sell” — the day is then blocked on all portals as well as on the website and platform",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-sell applies to all channels without exception. There is no way to block a day for a single portal only while leaving it open for others.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Visibility per portal",
          excerpt: "Each portal can be switched on or off independently of the website and platform marketplace.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "Three independent sales channels" },
            {
              type: "p",
              text: "A property can be sold through several channels at the same time: through the portals (Booking, Airbnb & Co.), through the myNextDays platform marketplace, and through your own website. Each channel has its own visibility switch — they are fully independent of one another.",
            },
            { type: "h2", text: "Controlling visibility per portal" },
            {
              type: "p",
              text: "Within the portals, each individual portal can additionally be switched separately. A property can, for example, be active on Booking.com but deactivated on Airbnb — both assignments remain unaffected.",
            },
            { type: "h2", text: "How to change visibility" },
            {
              type: "steps",
              items: [
                "Open the property under /objekte, “Portals” tab",
                "Switch the desired channel (individual portal, website or platform marketplace) on or off individually",
                "Save — the change takes effect within a few minutes",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "The property status (active/inactive) as well as stop-sell take precedence and apply to all channels. The visibility switches only control on which additional channels an already active property appears.",
            },
          ],
        },
      ],
    },
  ],
};
