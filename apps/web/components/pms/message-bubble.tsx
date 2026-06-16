// Fachliche PMS-Komponente: Inbox-Nachrichten-Bubble (Lastenheft §2.4).
// Zeigt Absender, Kanal-Icon (E-Mail/SMS/OTA), Text und Zeitstempel.
// Eingehend (links) und ausgehend (rechts) werden unterschiedlich gestylt.
// Stil/Tokens wie components/ui/button.tsx — Icons NUR via @iconify/react (ph:*).
import { Icon } from "@iconify/react";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Kommunikationskanal der Nachricht. Lastenheft §2.4 (Inbox/Unified Messaging):
// E-Mail, SMS sowie OTA (Buchungsportal-Postfach wie Booking.com/Airbnb).
export type MessageChannel = "email" | "sms" | "ota";

// Richtung der Nachricht: eingehend (Gast) vs. ausgehend (Team).
export type MessageDirection = "incoming" | "outgoing";

// Zuordnung Kanal -> ph-Icon + deutsches Label.
const CHANNEL_CONFIG: Record<
  MessageChannel,
  { icon: string; label: string }
> = {
  email: { icon: "ph:envelope-simple", label: "E-Mail" },
  sms: { icon: "ph:chat-circle-text", label: "SMS" },
  ota: { icon: "ph:buildings", label: "OTA" },
};

// Bubble-Stil je Richtung: ausgehend (Primary, rechts) / eingehend (Secondary, links).
const bubbleVariants = cva(
  "flex max-w-[80%] flex-col gap-1 rounded-(--radius) px-3 py-2 text-sm",
  {
    variants: {
      direction: {
        incoming: "bg-secondary text-foreground rounded-tl-sm",
        outgoing: "bg-primary text-primary-foreground rounded-tr-sm",
      },
    },
    defaultVariants: { direction: "incoming" },
  },
);

type MessageBubbleProps = ComponentProps<"div"> &
  VariantProps<typeof bubbleVariants> & {
    // Anzeigename des Absenders (z.B. Vorname des Gastes oder Team-Mitglied).
    sender: string;
    // Kommunikationskanal der Nachricht.
    channel: MessageChannel;
    // Nachrichtentext.
    text: string;
    // Bereits formatierter Zeitstempel (z.B. "14:32" oder "Gestern, 09:10").
    timestamp: string;
    // Optionale Avatar-Bild-URL des Absenders.
    avatarUrl?: string;
  };

// Initialen aus dem Absendernamen für den Avatar-Fallback.
function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function MessageBubble({
  className,
  direction = "incoming",
  sender,
  channel,
  text,
  timestamp,
  avatarUrl,
  ...props
}: MessageBubbleProps) {
  const isOutgoing = direction === "outgoing";
  const { icon, label } = CHANNEL_CONFIG[channel];

  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isOutgoing ? "flex-row-reverse" : "flex-row",
        className,
      )}
      {...props}
    >
      {/* Absender-Avatar mit Initialen-Fallback */}
      <Avatar className="h-8 w-8">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={sender} />}
        <AvatarFallback className="text-xs">
          {getInitials(sender)}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "flex flex-col gap-1",
          isOutgoing ? "items-end" : "items-start",
        )}
      >
        {/* Kopfzeile: Absender + Kanal-Icon */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{sender}</span>
          <Icon icon={icon} aria-hidden className="h-3.5 w-3.5" />
          <span>{label}</span>
        </div>

        {/* Sprechblase mit Nachrichtentext */}
        <div className={cn(bubbleVariants({ direction }))}>
          <p className="whitespace-pre-wrap break-words">{text}</p>
          <span
            className={cn(
              "self-end text-[10px]",
              isOutgoing
                ? "text-primary-foreground/70"
                : "text-muted-foreground",
            )}
          >
            {timestamp}
          </span>
        </div>
      </div>
    </div>
  );
}

export { bubbleVariants, CHANNEL_CONFIG };
