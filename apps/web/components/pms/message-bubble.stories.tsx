/**
 * Message-Bubble — Inbox-Nachrichten-Bubble für das Unified-Messaging.
 *
 * Lastenheft-Modul: §2.4 (Inbox / Nachrichten-Posteingang).
 * Zugehörige Tabelle: `messages` (Felder u.a. `sender`, `channel`,
 * `direction`, `body`, `created_at`).
 * Kanäle (Kommunikation): E-Mail | SMS | OTA (Portal-Postfach).
 * Richtung: eingehend (Gast, links) | ausgehend (Team, rechts).
 */
import type { Meta, StoryObj } from "@storybook/react";

import { MessageBubble } from "./message-bubble";

const meta = {
  title: "PMS-Komponenten/Nachrichten-Bubble",
  component: MessageBubble,
  tags: ["autodocs"],
  argTypes: {
    direction: {
      control: "inline-radio",
      options: ["incoming", "outgoing"],
      description: "Richtung: eingehend (links) / ausgehend (rechts)",
    },
    channel: {
      control: "select",
      options: ["email", "sms", "ota"],
      description: "Kommunikationskanal (E-Mail/SMS/OTA)",
    },
    sender: { control: "text" },
    text: { control: "text" },
    timestamp: { control: "text" },
  },
  args: {
    sender: "Lena",
    channel: "email",
    direction: "incoming",
    text: "Hallo, wann genau ist am Anreisetag die Check-in-Zeit?",
    timestamp: "14:32",
  },
} satisfies Meta<typeof MessageBubble>;

export default meta;
type Story = StoryObj<typeof meta>;

// Standard: eingehende E-Mail vom Gast (links).
export const Standard: Story = {};

// Eingehende Nachricht (Gast) — links, neutraler Hintergrund.
export const Eingehend: Story = {
  args: {
    direction: "incoming",
    sender: "Markus",
    channel: "sms",
    text: "Wir sind etwas später dran, ca. 18 Uhr. Passt das?",
    timestamp: "13:05",
  },
};

// Ausgehende Nachricht (Team) — rechts, Primary-Hintergrund.
export const Ausgehend: Story = {
  args: {
    direction: "outgoing",
    sender: "Team NextDays",
    channel: "email",
    text: "Gerne! Check-in ist ab 15:00 Uhr möglich. Bis später!",
    timestamp: "14:40",
  },
};

// Alle Kanäle (E-Mail, SMS, OTA) im Vergleich.
export const AlleKanaele: Story = {
  render: () => (
    <div className="flex w-[28rem] flex-col gap-4">
      <MessageBubble
        direction="incoming"
        sender="Lena"
        channel="email"
        text="Frage per E-Mail: Ist ein Hochstuhl vorhanden?"
        timestamp="09:12"
      />
      <MessageBubble
        direction="incoming"
        sender="Markus"
        channel="sms"
        text="Kurz per SMS: Türcode funktioniert nicht."
        timestamp="09:30"
      />
      <MessageBubble
        direction="incoming"
        sender="Sofia"
        channel="ota"
        text="Nachricht über das Portal: Können wir früher anreisen?"
        timestamp="09:45"
      />
    </div>
  ),
};

// Kurzer Thread: Wechsel aus eingehenden und ausgehenden Nachrichten.
export const Thread: Story = {
  render: () => (
    <div className="flex w-[28rem] flex-col gap-4 rounded-(--radius) border border-border bg-background p-4">
      <MessageBubble
        direction="incoming"
        sender="Lena"
        channel="ota"
        text="Hallo! Wir freuen uns auf den Aufenthalt. Wann ist Check-in?"
        timestamp="Gestern, 18:02"
      />
      <MessageBubble
        direction="outgoing"
        sender="Team NextDays"
        channel="ota"
        text="Hallo Lena, schön dass Sie kommen! Check-in ist ab 15:00 Uhr."
        timestamp="Gestern, 18:20"
      />
      <MessageBubble
        direction="incoming"
        sender="Lena"
        channel="sms"
        text="Perfekt, danke! Gibt es vor Ort Parkplätze?"
        timestamp="08:15"
      />
      <MessageBubble
        direction="outgoing"
        sender="Team NextDays"
        channel="sms"
        text="Ja, ein kostenfreier Stellplatz direkt am Haus ist reserviert."
        timestamp="08:21"
      />
      <MessageBubble
        direction="incoming"
        sender="Lena"
        channel="email"
        text="Wunderbar, dann bis später. Vielen Dank!"
        timestamp="08:25"
      />
    </div>
  ),
};

// Langer Text und mit Avatar-Bild des Absenders.
export const MitAvatarUndLangemText: Story = {
  args: {
    direction: "incoming",
    sender: "Sofia Berg",
    channel: "email",
    avatarUrl: "https://i.pravatar.cc/80?img=47",
    text: "Guten Tag,\n\nwir reisen mit zwei Kindern an und wollten fragen, ob Bettwäsche und Handtücher gestellt werden und ob ein Wäschetrockner vorhanden ist. Vielen Dank im Voraus!",
    timestamp: "11:48",
  },
};
