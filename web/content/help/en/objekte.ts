import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Properties & Amenities",
  description: "Create and manage rooms and vacation rental properties.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Managing properties",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Property = one bookable unit",
          excerpt: "Why every property in myNextDays is exactly one bookable unit.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "In myNextDays, a property is always exactly one bookable unit — a single room in a hotel, or a complete vacation rental. This principle applies whether you run a vacation house, a vacation apartment, or a hotel, and it is the foundation for availability, pricing, and bookings.",
            },
            { type: "h2", text: "Not a building with rooms underneath" },
            {
              type: "p",
              text: "A common misunderstanding is to model a hotel building as a single property with multiple rooms underneath it. This is not how myNextDays works. If you run a hotel with eight double rooms and four single rooms, for example, you create twelve individual properties — not one property with a room count.",
            },
            {
              type: "note",
              variant: "warn",
              text: "There is deliberately no field like “number of rooms” at the property level. Each room needs its own property with its own calendar and its own prices.",
            },
            { type: "h2", text: "Vacation rentals" },
            {
              type: "p",
              text: "For a vacation house or vacation apartment, the entire property is the bookable unit. There is no further subdivision here — a vacation rental is always a standalone property with its own calendar.",
            },
            { type: "h2", text: "Why this matters" },
            {
              type: "ul",
              items: [
                "Every property has its own availability calendar — double bookings are prevented at the individual property level.",
                "Prices, amenities, and photos apply per property, not per building.",
                "A property always belongs to exactly one owner — no multiple assignment.",
                "Channel visibility (website, marketplace, portals) is controlled per property.",
              ],
            },
            {
              type: "p",
              text: "To learn how to choose the right property type for your room or vacation rental, see [Setting the property type](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Setting the property type",
          excerpt: "Correctly assign category, property type, and listing type.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "The property type determines how your property is categorized and filtered on portals and the marketplace. It consists of three dependent selection fields that you work through when creating or editing a property.",
            },
            { type: "h2", text: "The three selection levels" },
            {
              type: "steps",
              items: [
                "First select the category — for example, vacation rental or hotel.",
                "Based on that, select the property type — for example, vacation apartment, vacation house, double room, or single room.",
                "Select the listing type — for example, the entire property or a private room.",
                "Fill in the additional fields shown based on your selection, such as bed type or floor.",
              ],
            },
            { type: "h2", text: "Why the order matters" },
            {
              type: "p",
              text: "The three dropdowns depend on each other: selecting a category narrows down the available property types, and selecting a property type in turn narrows down the listing types. This ensures only meaningful combinations arise, matching those used on major portals.",
            },
            {
              type: "note",
              variant: "info",
              text: "If you change the category afterward, myNextDays checks whether the property type and listing type still match and, if needed, prompts you to make a new selection.",
            },
            { type: "h2", text: "Editing the property type" },
            {
              type: "p",
              text: "In the Properties menu, open the desired property and switch to the Basic Data tab. There you will find the three dropdowns under Property Type. When you save your change, the new classification is passed on to all active channels.",
            },
            {
              type: "ul",
              items: [
                "Category: top-level classification (e.g. vacation rental, hotel)",
                "Property type: the specific type (e.g. vacation apartment, double room)",
                "Listing type: exactly what is booked (e.g. entire property, private room)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Managing amenities",
          excerpt: "Select amenity features and keep them up to date.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "A property's amenities significantly affect how well it can be found and filtered on portals. Guests filter specifically by features like Wi-Fi, kitchen, or parking — missing information can exclude a property from search results.",
            },
            { type: "h2", text: "Selecting amenities" },
            {
              type: "steps",
              items: [
                "Open the property and switch to the Amenities tab.",
                "Select all applicable features from the predefined list.",
                "Add details as needed, such as the number of parking spaces or the type of kitchen.",
                "Save the changes — they are automatically sent to all active portals.",
              ],
            },
            { type: "h2", text: "Where the features come from" },
            {
              type: "p",
              text: "The amenities list follows the feature catalog used by major portals, so your information can be correctly mapped there. Custom, freely invented features are not supported, since they could not be reliably transmitted to portals.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Review the amenities after every structural change — such as a new air conditioning unit or an additional bathroom — so the information stays current across all channels.",
            },
            { type: "h2", text: "Common feature groups" },
            {
              type: "ul",
              items: [
                "Basic amenities: Wi-Fi, heating, air conditioning",
                "Kitchen & catering: fully equipped kitchen, dishwasher, coffee maker",
                "Bathroom & laundry: private bathroom, washing machine, towels",
                "Outdoor area: balcony, terrace, garden, parking",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Photos & description",
          excerpt: "Compelling photos and text for more bookings.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Photos and the description are the most important basis for guests' decisions. A property can only be published once at least one cover photo and a description have been added.",
            },
            { type: "h2", text: "Uploading photos" },
            {
              type: "steps",
              items: [
                "Open the property and switch to the Photos tab.",
                "Drag image files into the upload area or select them via the file dialog.",
                "Set a cover photo — it appears in search results and listing cards.",
                "Arrange the remaining photos into a sensible order by dragging them.",
              ],
            },
            { type: "h2", text: "Writing the description" },
            {
              type: "p",
              text: "Switch to the Description tab and enter a title and body text. Describe the property's location, special features, and target audience concretely — generic phrases come across as less convincing on portals than tangible details.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Photos of other properties or taken from the internet must not be used — portals check for this and can suspend properties for violations.",
            },
            { type: "h2", text: "Recommendations for good photos" },
            {
              type: "ul",
              items: [
                "At least five photos, ideally one for every room",
                "Landscape orientation, good lighting, no watermarks",
                "The cover photo shows the property in an inviting and unambiguous way",
                "Update regularly, especially after renovations",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Occupancy & capacity",
          excerpt: "Correctly set the maximum guest count and bed configuration.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "Occupancy defines how many guests a property can accommodate and is checked on every search and booking. Incorrect settings lead either to rejected requests or to overcrowding — you should avoid both.",
            },
            { type: "h2", text: "Entering occupancy" },
            {
              type: "steps",
              items: [
                "Open the property and switch to the Occupancy tab.",
                "Enter the maximum number of adults.",
                "Enter the maximum number of children, if allowed.",
                "Add the bed configuration per room, such as one double bed and two single beds.",
              ],
            },
            { type: "h2", text: "Occupancy limits" },
            {
              type: "p",
              text: "For every booking request, myNextDays automatically checks whether the requested number of guests falls within the configured occupancy. Requests that exceed the maximum capacity are rejected, or are not even shown as bookable in the first place.",
            },
            {
              type: "note",
              variant: "info",
              text: "An extra bed or crib only increases actual capacity if you explicitly record it in the bed configuration — otherwise the maximum guest count remains unchanged.",
            },
            { type: "h2", text: "Common sources of error" },
            {
              type: "ul",
              items: [
                "Maximum guest count set too high even though only a few beds are available",
                "Child count forgotten even though the property targets families",
                "Bed configuration not updated after a renovation",
              ],
            },
            {
              type: "p",
              text: "If occupancy and amenities don't match up, also check the [Amenities](/hilfe/objekte/ausstattung) tab.",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Property status & visibility",
          excerpt: "The difference between active/inactive and the three channel axes.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "myNextDays distinguishes between two different things that are often confused: property status (active or inactive) and visibility on individual sales channels. You control both separately from each other.",
            },
            { type: "h2", text: "Property status" },
            {
              type: "p",
              text: "The active status means a property is fundamentally sellable. The inactive status takes a property completely out of service — for example during a long-term renovation. An inactive property cannot be booked on any channel, regardless of the channel toggles.",
            },
            { type: "h2", text: "The three channel axes" },
            {
              type: "p",
              text: "If a property is active, three independent toggles determine exactly where it is visible:",
            },
            {
              type: "ul",
              items: [
                "Website — visibility on your own myNextDays website",
                "Marketplace — visibility on the global myBestDays marketplace",
                "Portals — visibility on Booking, Airbnb & Co.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "These three axes are completely independent of the property status and of each other. An active property can, for example, be visible only on the website but not on portals.",
            },
            { type: "h2", text: "Changing the status" },
            {
              type: "steps",
              items: [
                "Open the property and switch to the Overview tab.",
                "Set the status to active or inactive.",
                "If needed, also adjust the three channel toggles in the Visibility tab.",
                "Save the change — it takes effect immediately on all affected channels.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "For a short-term block of individual days, use Stop-Sell in the calendar instead — it specifically blocks days across all channels without deactivating the entire property.",
            },
          ],
        },
      ],
    },
  ],
};
