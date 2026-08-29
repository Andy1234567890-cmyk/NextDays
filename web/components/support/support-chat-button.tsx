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
//
// Er ist kein fester Bestandteil der Oberfläche: ein kleines x blendet ihn weg,
// der Wunsch bleibt gespeichert. Zurück kommt er über „Hilfe holen" im
// Konto-Menü — deshalb ist das Wegblenden keine Sackgasse. Das x liegt hinter
// Hover/Fokus, damit der Normalfall (Chat öffnen) ein sauberer runder Knopf
// bleibt; per Tastatur ist es über Fokus-innerhalb trotzdem erreichbar.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { useSupportChat } from "./support-chat";

export function SupportChatButton({
  // IMMER sichtbar, nicht ausblendbar — so im Onboarding eingesetzt.
  //
  // Warum das dort anders ist als im Dashboard: Der Ausblenden-Wunsch liegt im
  // `localStorage` und gilt fuer die ganze Anwendung. Zurueckholen laesst er
  // sich nur ueber das Konto-Menue — das es im Onboarding NICHT gibt. Ein
  // Klick auf das kleine „x" war dort also endgueltig, und der Betrieb stand
  // ohne Weg zu uns da, genau an der Stelle, an der er Fragen hat
  // (Steuernummer, IBAN, Kleinunternehmer). Live passiert am 29.08.2026.
  immerSichtbar = false,
}: {
  immerSichtbar?: boolean;
} = {}) {
  const t = useTranslations("supportChat");
  const chat = useSupportChat();
  if (chat.offen || (!immerSichtbar && !chat.knopfSichtbar)) return null;
  return (
    <div className="group fixed bottom-6 right-6 z-50">
      <button
        type="button"
        onClick={chat.oeffnen}
        aria-label={t("titel")}
        title={t("titel")}
        className="inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Icon icon="ph:chat-circle-dots-fill" className="size-7" />
        {chat.ungelesen > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-xs font-semibold text-destructive-foreground">
            {chat.ungelesen}
          </span>
        )}
      </button>
      {!immerSichtbar && (
      <button
        type="button"
        onClick={chat.knopfAusblenden}
        aria-label={t("knopfAusblenden")}
        title={t("knopfAusblenden")}
        className="absolute -left-1 -top-1 inline-flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-focus-within:opacity-100 group-hover:opacity-100"
      >
        <Icon icon="ph:x" className="size-3.5" />
      </button>
      )}
    </div>
  );
}
