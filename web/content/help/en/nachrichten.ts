import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Messages & Guests",
  description: "Inbox, templates, and guest communication.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Communication",
      articles: [
        {
          slug: "posteingang",
          title: "The Platform Inbox",
          excerpt: "All guest messages for your properties come together centrally in the platform inbox.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "One Inbox for All Properties" },
            {
              type: "p",
              text: "The platform inbox brings together all messages from your guests in one place — regardless of which property or date range the conversation relates to. You open it at /nachrichten, where every conversation appears as its own thread.",
            },
            { type: "h2", text: "Structure of the Inbox" },
            {
              type: "ul",
              items: [
                "Left column: list of all conversations, newest first",
                "Middle column: the active message history with the guest",
                "Right column: context on the reservation — dates, property, guest details",
              ],
            },
            { type: "h2", text: "Replying to a Message" },
            {
              type: "steps",
              items: [
                "Open /nachrichten and select the conversation you want",
                "Write your reply in the text field or use a quick reply",
                "Send the message — the guest receives it through the same channel they used to write to you",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "The platform inbox shows only the direct communication between you and your guests on myNextDays — messages from the portals are still handled there.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Quick Replies",
          excerpt: "Templates for common questions save time in guest communication.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "What Quick Replies Are" },
            {
              type: "p",
              text: "Quick replies are pre-written text blocks for recurring questions — for example about arrival, the Wi-Fi password, or parking. Instead of typing every answer from scratch, you insert the matching template into the [Platform Inbox](/hilfe/nachrichten/posteingang) with a single click.",
            },
            { type: "h2", text: "Creating a Quick Reply" },
            {
              type: "steps",
              items: [
                "Open /nachrichten and click “Manage Quick Replies”",
                "Click “New Template” and give it a title, for example “Check-in Info”",
                "Write the reply text; placeholders such as guest name or arrival date are automatically filled in when sent",
                "Save the template — it is now available in every conversation",
              ],
            },
            { type: "h2", text: "Using Quick Replies Day to Day" },
            {
              type: "p",
              text: "In the message window, open the template list via the lightning-bolt icon, choose the matching reply, and adjust it individually if needed before sending.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Create templates for your five to ten most common questions — in practice, this covers the majority of incoming messages.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Automatic Messages",
          excerpt: "Confirmations, check-in info, and reminders can be sent to guests automatically.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "Automating Recurring Messages" },
            {
              type: "p",
              text: "Instead of sending booking confirmations, check-in instructions, or thank-you messages manually, set them up once as a rule — myNextDays then sends them automatically at the right time before, during, or after the stay.",
            },
            { type: "h2", text: "Typical Triggers for Automatic Messages" },
            {
              type: "ul",
              items: [
                "Immediately after booking — confirmation with the key details",
                "A few days before arrival — check-in information and access code",
                "On the departure day — thank-you message and request for a review",
              ],
            },
            { type: "h2", text: "Setting Up an Automatic Message" },
            {
              type: "steps",
              items: [
                "Open /nachrichten, section “Automatic Messages”",
                "Choose the trigger, for example “X days before arrival”",
                "Enter the text — placeholders such as guest name, property, or arrival date are filled in automatically",
                "Activate the rule; it applies to all properties unless restricted otherwise",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Automatic messages appear in the [Platform Inbox](/hilfe/nachrichten/posteingang) just like any other message and can be reviewed there at any time afterward.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Blocking Messages",
          excerpt: "You can block a person from further contact directly from the message history.",
          updated: "Last updated: July 2026",
          body: [
            { type: "h2", text: "When Blocking Makes Sense" },
            {
              type: "p",
              text: "For offensive messages, harassment, or repeated inappropriate behavior, you can block a person directly from the message thread. A blocked person can no longer send you new messages or create new bookings with you.",
            },
            { type: "h2", text: "Blocking a Person from the Thread" },
            {
              type: "steps",
              items: [
                "Open the relevant conversation in the [Platform Inbox](/hilfe/nachrichten/posteingang)",
                "Click the menu at the top of the thread and select “Block Person”",
                "Confirm the action — the block takes effect immediately",
              ],
            },
            { type: "h2", text: "What Blocking Means — and What It Doesn't" },
            {
              type: "ul",
              items: [
                "New messages from the blocked person are no longer delivered",
                "New booking requests from the person are declined",
                "If the person currently has an active reservation, communication remains possible as an exception for the duration of the stay",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A block can be lifted at any time in the “Blocked People” overview in your account. Before blocking, check whether an active booking already exists.",
            },
          ],
        },
      ],
    },
  ],
};
