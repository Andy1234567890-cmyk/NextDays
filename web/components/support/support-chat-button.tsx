"use client";

// Schwebender Support-Knopf unten rechts — der direkte Weg in den Live-Chat mit
// dem myNextDays-Team.
//
// Er steht an der Stelle, an der vorher der Sprach-Assistent („Andy") schwebte:
// der ist noch nicht fertig und deshalb im Layout abgeschaltet (Code bleibt
// liegen, siehe `dashboard/voice-assistant.tsx`). Ein Knopf, der zu einer
// halbfertigen Funktion führt, ist schlechter als keiner — der Chat hier
// funktioniert.
//
// Muster wie bei Intercom/Crisp: runder Knopf, Ungelesen-Zähler als Badge,
// verschwindet, während das Chat-Panel offen ist (sonst überdeckt er es).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { useSupportChat } from "./support-chat";

export function SupportChatButton() {
  const t = useTranslations("supportChat");
  const chat = useSupportChat();
  if (chat.offen) return null;
  return (
    <button
      type="button"
      onClick={chat.oeffnen}
      aria-label={t("titel")}
      title={t("titel")}
      className="fixed bottom-6 right-6 z-50 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Icon icon="ph:chat-circle-dots-fill" className="size-7" />
      {chat.ungelesen > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-xs font-semibold text-destructive-foreground">
          {chat.ungelesen}
        </span>
      )}
    </button>
  );
}
